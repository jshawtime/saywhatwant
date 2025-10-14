#!/usr/bin/env python3
"""
Model Loading Test Script
Tests the complete flow: unload model → post message → monitor loading → verify response

Does NOT modify production code - pure testing
"""

import subprocess
import time
import json
import urllib.request
import urllib.parse
from datetime import datetime

# Configuration
LM_STUDIO_HOST = "10.0.0.100"
LM_STUDIO_PORT = 1234
KV_API_URL = "https://sww-comments.bootloaders.workers.dev/api/comments"
WEBSOCKET_URL = "ws://localhost:4002"

TEST_ENTITY = "dystopian-survival-guide"
TEST_MODEL = "dystopian-survival-guide@f32"
TEST_USERNAME = "TestBot"
TEST_COLOR = "080219215"

def log(msg, level="INFO"):
    timestamp = datetime.now().strftime("%H:%M:%S.%f")[:-3]
    print(f"[{timestamp}] [{level}] {msg}")

def run_cli_command(cmd):
    """Execute LM Studio CLI command"""
    log(f"Executing: {cmd}", "CLI")
    try:
        result = subprocess.run(
            cmd, 
            shell=True, 
            capture_output=True, 
            text=True, 
            timeout=10
        )
        if result.returncode == 0:
            log(f"✅ Success: {result.stdout.strip()}", "CLI")
            return True
        else:
            log(f"❌ Error: {result.stderr.strip()}", "CLI")
            return False
    except subprocess.TimeoutExpired:
        log("❌ Command timed out", "CLI")
        return False
    except Exception as e:
        log(f"❌ Exception: {e}", "CLI")
        return False

def check_model_loaded(model_name):
    """Check if model is loaded via LM Studio API"""
    try:
        url = f"http://{LM_STUDIO_HOST}:{LM_STUDIO_PORT}/api/v0/models"
        with urllib.request.urlopen(url, timeout=5) as response:
            data = json.loads(response.read())
            for model in data.get('data', []):
                if model['id'] == model_name:
                    state = model.get('state', 'unknown')
                    log(f"Model {model_name}: state={state}", "API")
                    return state == 'loaded'
            log(f"Model {model_name}: not found in model list", "API")
            return False
    except Exception as e:
        log(f"Failed to check model status: {e}", "API")
        return False

def get_loaded_models():
    """Get list of all loaded models"""
    try:
        url = f"http://{LM_STUDIO_HOST}:{LM_STUDIO_PORT}/api/v0/models"
        with urllib.request.urlopen(url, timeout=5) as response:
            data = json.loads(response.read())
            loaded = [m['id'] for m in data.get('data', []) if m.get('state') == 'loaded']
            return loaded
    except Exception as e:
        log(f"Failed to get loaded models: {e}", "API")
        return []

def unload_all_models():
    """Unload all models on LM Studio server"""
    log("🔄 Unloading all models...", "SETUP")
    
    loaded = get_loaded_models()
    if loaded:
        log(f"Currently loaded: {loaded}", "SETUP")
    else:
        log("No models currently loaded", "SETUP")
    
    success = run_cli_command(f"lms unload --all --host {LM_STUDIO_HOST}")
    
    if success:
        time.sleep(2)
        loaded_after = get_loaded_models()
        if not loaded_after:
            log("✅ All models unloaded successfully", "SETUP")
            return True
        else:
            log(f"⚠️  Models still loaded: {loaded_after}", "SETUP")
            return False
    return False

def post_test_message(text):
    """Post a message to KV"""
    log(f"📤 Posting message: '{text}'", "KV")
    
    message = {
        "text": text,
        "username": TEST_USERNAME,
        "color": TEST_COLOR,
        "domain": "saywhatwant.app",
        "language": "en",
        "message-type": "human",
        "misc": "",
        "context": [],
        "botParams": {
            "entity": TEST_ENTITY,
            "priority": 5,
            "ais": f"SurvivalGuide:{TEST_COLOR}"
        }
    }
    
    try:
        data = json.dumps(message).encode('utf-8')
        req = urllib.request.Request(
            KV_API_URL,
            data=data,
            headers={"Content-Type": "application/json"}
        )
        
        with urllib.request.urlopen(req, timeout=10) as response:
            result = json.loads(response.read())
            message_id = result.get('id', 'unknown')
            log(f"✅ Message posted successfully", "KV")
            log(f"Message ID: {message_id}", "KV")
            return message_id
    except Exception as e:
        log(f"❌ Exception posting message: {e}", "KV")
        return None

def get_recent_messages(limit=10):
    """Get recent messages from KV"""
    try:
        url = f"{KV_API_URL}?limit={limit}&domain=all&sort=timestamp&order=desc"
        with urllib.request.urlopen(url, timeout=10) as response:
            data = json.loads(response.read())
            return data.get('comments', [])
    except Exception as e:
        log(f"Failed to fetch messages: {e}", "KV")
        return []

def find_ai_response(test_message_id, timeout=180):
    """
    Monitor KV for AI response to our test message
    Returns: (success, response_text, elapsed_time)
    """
    log(f"👀 Monitoring for AI response (timeout: {timeout}s)...", "MONITOR")
    
    start_time = time.time()
    last_check = 0
    
    while (time.time() - start_time) < timeout:
        elapsed = int(time.time() - start_time)
        
        # Log every 10 seconds
        if elapsed > last_check + 10:
            log(f"Waiting for response... ({elapsed}s elapsed)", "MONITOR")
            
            # Check model status
            is_loaded = check_model_loaded(TEST_MODEL)
            if is_loaded:
                log(f"✅ Model is now LOADED", "MONITOR")
            else:
                log(f"⏳ Model still loading...", "MONITOR")
            
            last_check = elapsed
        
        # Check for response
        messages = get_recent_messages(20)
        
        for msg in messages:
            # Look for AI response that came after our test message
            if (msg.get('message-type') == 'AI' and 
                msg.get('username') == 'DystopianSurvival'):
                # Check if this is a response to our message
                # (AI messages appear after human messages they respond to)
                msg_timestamp = msg.get('timestamp', 0)
                
                # Get our test message to compare timestamps
                for human_msg in messages:
                    if human_msg.get('id') == test_message_id:
                        if msg_timestamp > human_msg.get('timestamp', 0):
                            elapsed = int(time.time() - start_time)
                            log(f"✅ AI RESPONSE FOUND! (after {elapsed}s)", "MONITOR")
                            log(f"Response: {msg.get('text', '')[:100]}...", "MONITOR")
                            return (True, msg.get('text'), elapsed)
        
        time.sleep(2)  # Check every 2 seconds
    
    log(f"❌ TIMEOUT: No response after {timeout}s", "MONITOR")
    return (False, None, timeout)

def check_pm2_status():
    """Check PM2 status"""
    try:
        result = subprocess.run(
            "pm2 jlist",
            shell=True,
            capture_output=True,
            text=True,
            timeout=5
        )
        if result.returncode == 0:
            data = json.loads(result.stdout)
            for process in data:
                if process.get('name') == 'ai-bot':
                    status = process.get('pm2_env', {}).get('status')
                    restarts = process.get('pm2_env', {}).get('restart_time', 0)
                    uptime = process.get('pm2_env', {}).get('pm_uptime')
                    
                    log(f"PM2 Status: {status}, Restarts: {restarts}", "PM2")
                    return status == 'online'
    except Exception as e:
        log(f"Failed to check PM2: {e}", "PM2")
    return False

def run_test(test_number):
    """Run a complete test cycle"""
    log("="*80)
    log(f"🧪 STARTING TEST #{test_number}", "TEST")
    log("="*80)
    
    # Step 1: Check PM2 is running
    if not check_pm2_status():
        log("❌ PM2 bot not online!", "TEST")
        return False
    
    # Step 2: Unload all models
    if not unload_all_models():
        log("⚠️  Failed to unload models, continuing anyway...", "TEST")
    
    time.sleep(3)
    
    # Step 3: Verify model is unloaded
    if check_model_loaded(TEST_MODEL):
        log("❌ Model still loaded after unload!", "TEST")
        return False
    
    log("✅ Model confirmed unloaded", "TEST")
    time.sleep(2)
    
    # Step 4: Post test message
    test_text = f"test message {test_number} at {datetime.now().strftime('%H:%M:%S')}"
    message_id = post_test_message(test_text)
    
    if not message_id:
        log("❌ Failed to post message", "TEST")
        return False
    
    log(f"✅ Message posted: ID={message_id}", "TEST")
    time.sleep(5)  # Give bot time to poll
    
    # Step 5: Monitor for response
    success, response_text, elapsed = find_ai_response(message_id, timeout=180)
    
    if success:
        log(f"✅✅✅ TEST #{test_number} PASSED! Response received in {elapsed}s", "TEST")
        log(f"Response: {response_text}", "TEST")
        return True
    else:
        log(f"❌❌❌ TEST #{test_number} FAILED! No response after {elapsed}s", "TEST")
        
        # Check if model loaded at least
        if check_model_loaded(TEST_MODEL):
            log("⚠️  Model DID load, but no response was posted", "TEST")
            log("This suggests request was lost AFTER model loaded", "TEST")
        else:
            log("⚠️  Model never finished loading", "TEST")
            log("This suggests model load timeout or failure", "TEST")
        
        return False

def main():
    """Run the test suite"""
    log("🚀 Model Loading Test Suite", "MAIN")
    log(f"Entity: {TEST_ENTITY}", "MAIN")
    log(f"Model: {TEST_MODEL}", "MAIN")
    log(f"LM Studio: {LM_STUDIO_HOST}:{LM_STUDIO_PORT}", "MAIN")
    log(f"KV API: {KV_API_URL}", "MAIN")
    print()
    
    # Run test 3 times for reliability
    results = []
    for i in range(1, 4):
        success = run_test(i)
        results.append(success)
        
        if success:
            log(f"✅ Test {i}/3 passed", "MAIN")
        else:
            log(f"❌ Test {i}/3 failed", "MAIN")
        
        if i < 3:
            log("⏸  Waiting 30 seconds before next test...", "MAIN")
            time.sleep(30)
        
        print()
    
    # Summary
    log("="*80)
    log("📊 TEST SUMMARY", "MAIN")
    log("="*80)
    passed = sum(results)
    total = len(results)
    log(f"Passed: {passed}/{total}", "MAIN")
    
    if passed == total:
        log("✅✅✅ ALL TESTS PASSED!", "MAIN")
        log("The model loading system is working correctly!", "MAIN")
    elif passed > 0:
        log(f"⚠️  INTERMITTENT ISSUE: {passed}/{total} passed", "MAIN")
        log("System works sometimes but not consistently", "MAIN")
    else:
        log("❌❌❌ ALL TESTS FAILED!", "MAIN")
        log("The model loading system is broken", "MAIN")
    
    return passed == total

if __name__ == "__main__":
    try:
        success = main()
        exit(0 if success else 1)
    except KeyboardInterrupt:
        log("\n⚠️  Test interrupted by user", "MAIN")
        exit(1)
    except Exception as e:
        log(f"❌ Fatal error: {e}", "MAIN")
        import traceback
        traceback.print_exc()
        exit(1)

