#!/usr/bin/env python3
"""
Direct LM Studio Test
Tests LM Studio's behavior when sending chat completion while model is loading

Bypasses: Queue, Bot, KV entirely
Tests: LM Studio model loading + chat completion directly
"""

import subprocess
import time
import json
import urllib.request
from datetime import datetime

# Configuration
LM_STUDIO_HOST = "10.0.0.100"
LM_STUDIO_PORT = 1234
TEST_MODEL = "dystopian-survival-guide@f32"

def log(msg, level="INFO"):
    timestamp = datetime.now().strftime("%H:%M:%S.%f")[:-3]
    print(f"[{timestamp}] [{level}] {msg}")

def run_cli(cmd):
    """Execute CLI command"""
    log(f"CLI: {cmd}", "CMD")
    try:
        result = subprocess.run(cmd, shell=True, capture_output=True, text=True, timeout=10)
        if result.returncode == 0:
            log(f"✅ {result.stdout.strip()}", "CMD")
            return True
        else:
            log(f"❌ {result.stderr.strip()}", "CMD")
            return False
    except Exception as e:
        log(f"❌ {e}", "CMD")
        return False

def get_models():
    """Get model list from LM Studio"""
    try:
        url = f"http://{LM_STUDIO_HOST}:{LM_STUDIO_PORT}/api/v0/models"
        with urllib.request.urlopen(url, timeout=5) as response:
            data = json.loads(response.read())
            return data.get('data', [])
    except Exception as e:
        log(f"Failed to get models: {e}", "API")
        return []

def check_model_state(model_name):
    """Check model state"""
    models = get_models()
    for m in models:
        if m['id'] == model_name:
            return m.get('state', 'unknown')
    return 'not-found'

def send_chat_completion(model_name, messages):
    """Send chat completion request to LM Studio"""
    log(f"📤 Sending chat completion request...", "CHAT")
    log(f"Model: {model_name}", "CHAT")
    log(f"Messages: {len(messages)}", "CHAT")
    
    payload = {
        "model": model_name,
        "messages": messages,
        "temperature": 0.6,
        "max_tokens": 200,
        "stream": False
    }
    
    try:
        data = json.dumps(payload).encode('utf-8')
        req = urllib.request.Request(
            f"http://{LM_STUDIO_HOST}:{LM_STUDIO_PORT}/v1/chat/completions",
            data=data,
            headers={"Content-Type": "application/json"}
        )
        
        log("⏳ Waiting for response from LM Studio...", "CHAT")
        start = time.time()
        
        with urllib.request.urlopen(req, timeout=300) as response:  # 5 minute timeout
            elapsed = time.time() - start
            result = json.loads(response.read())
            
            log(f"✅ Response received in {elapsed:.1f}s", "CHAT")
            
            if 'choices' in result and len(result['choices']) > 0:
                content = result['choices'][0]['message']['content']
                log(f"Response: {content[:100]}...", "CHAT")
                return (True, content, elapsed)
            else:
                log(f"⚠️  Unexpected response format", "CHAT")
                return (False, None, elapsed)
                
    except urllib.error.HTTPError as e:
        elapsed = time.time() - start
        error_body = e.read().decode('utf-8')
        log(f"❌ HTTP {e.code}: {error_body}", "CHAT")
        return (False, None, elapsed)
    except Exception as e:
        elapsed = time.time() - start
        log(f"❌ Exception: {e}", "CHAT")
        return (False, None, elapsed)

def test_scenario_1():
    """
    Scenario 1: Load model, THEN send request
    (This should always work - control test)
    """
    log("="*80, "TEST")
    log("SCENARIO 1: Load model first, then send request", "TEST")
    log("="*80, "TEST")
    
    # Unload all
    log("Step 1: Unload all models", "TEST")
    run_cli(f"lms unload --all --host {LM_STUDIO_HOST}")
    time.sleep(2)
    
    # Verify unloaded
    state = check_model_state(TEST_MODEL)
    log(f"Model state: {state}", "TEST")
    
    # Load model
    log("Step 2: Load model explicitly", "TEST")
    run_cli(f"lms load {TEST_MODEL} --host {LM_STUDIO_HOST}")
    
    # Wait for model to load
    log("Step 3: Wait for model to reach 'loaded' state", "TEST")
    for i in range(60):  # 5 minute max
        time.sleep(5)
        state = check_model_state(TEST_MODEL)
        log(f"Poll {i+1}: Model state = {state}", "TEST")
        
        if state == 'loaded':
            log(f"✅ Model loaded after {(i+1)*5}s", "TEST")
            break
    
    if state != 'loaded':
        log(f"❌ Model never reached 'loaded' state", "TEST")
        return False
    
    # Send request
    log("Step 4: Send chat completion request", "TEST")
    messages = [
        {"role": "system", "content": "You provide survival advice."},
        {"role": "user", "content": "Give me survival tips."}
    ]
    
    success, response, elapsed = send_chat_completion(TEST_MODEL, messages)
    
    if success:
        log(f"✅ SCENARIO 1 PASSED - Response in {elapsed:.1f}s", "TEST")
        return True
    else:
        log(f"❌ SCENARIO 1 FAILED - No response", "TEST")
        return False

def test_scenario_2():
    """
    Scenario 2: Send request WHILE model is loading
    (This tests if LM Studio queues requests or drops them)
    """
    log("="*80, "TEST")
    log("SCENARIO 2: Send request immediately, let model load", "TEST")
    log("="*80, "TEST")
    
    # Unload all
    log("Step 1: Unload all models", "TEST")
    run_cli(f"lms unload --all --host {LM_STUDIO_HOST}")
    time.sleep(2)
    
    # Verify unloaded
    state = check_model_state(TEST_MODEL)
    log(f"Model state: {state}", "TEST")
    
    if state != 'not-loaded':
        log(f"❌ Model not unloaded cleanly", "TEST")
        return False
    
    # Trigger load by sending chat request immediately
    log("Step 2: Send chat completion (model not loaded yet)", "TEST")
    log("⚠️  This will trigger JIT loading in LM Studio", "TEST")
    
    messages = [
        {"role": "system", "content": "You provide survival advice."},
        {"role": "user", "content": "Give me survival tips."}
    ]
    
    # Monitor model state in parallel
    import threading
    
    def monitor_model_state():
        log("👀 Starting model state monitor thread...", "MONITOR")
        for i in range(60):
            time.sleep(5)
            state = check_model_state(TEST_MODEL)
            log(f"Model state: {state} (t={i*5}s)", "MONITOR")
            if state == 'loaded':
                log(f"✅ Model reached 'loaded' at t={i*5}s", "MONITOR")
                break
    
    # Start monitoring thread
    monitor_thread = threading.Thread(target=monitor_model_state, daemon=True)
    monitor_thread.start()
    
    # Send request (will block until response or timeout)
    success, response, elapsed = send_chat_completion(TEST_MODEL, messages)
    
    if success:
        log(f"✅ SCENARIO 2 PASSED - Response in {elapsed:.1f}s", "TEST")
        log("✅ LM Studio CAN handle requests during loading!", "TEST")
        return True
    else:
        log(f"❌ SCENARIO 2 FAILED - No response after {elapsed:.1f}s", "TEST")
        log("❌ LM Studio DROPS requests sent during loading", "TEST")
        return False

def main():
    log("🧪 LM Studio Direct Test Suite", "MAIN")
    log(f"Testing: {TEST_MODEL}", "MAIN")
    log(f"Server: {LM_STUDIO_HOST}:{LM_STUDIO_PORT}", "MAIN")
    print()
    
    # Scenario 1: Control test (should always work)
    result1 = test_scenario_1()
    print()
    
    if not result1:
        log("❌ Control test failed - LM Studio not working properly", "MAIN")
        return False
    
    time.sleep(10)  # Wait between tests
    
    # Scenario 2: The real test (does LM Studio queue requests?)
    result2 = test_scenario_2()
    print()
    
    # Summary
    log("="*80, "MAIN")
    log("📊 RESULTS", "MAIN")
    log("="*80, "MAIN")
    log(f"Scenario 1 (Load first): {'✅ PASS' if result1 else '❌ FAIL'}", "MAIN")
    log(f"Scenario 2 (Send during load): {'✅ PASS' if result2 else '❌ FAIL'}", "MAIN")
    print()
    
    if result1 and result2:
        log("✅ LM Studio queues requests during loading", "MAIN")
        log("The bot should work if we just send the request!", "MAIN")
        return True
    elif result1 and not result2:
        log("⚠️  LM Studio DROPS requests sent during loading", "MAIN")
        log("We MUST wait for model to load before sending request", "MAIN")
        log("Parallel queue architecture is REQUIRED", "MAIN")
        return False
    else:
        log("❌ LM Studio not working at all", "MAIN")
        return False

if __name__ == "__main__":
    try:
        success = main()
        exit(0 if success else 1)
    except KeyboardInterrupt:
        log("\n⚠️  Test interrupted", "MAIN")
        exit(1)
    except Exception as e:
        log(f"❌ Fatal: {e}", "MAIN")
        import traceback
        traceback.print_exc()
        exit(1)

