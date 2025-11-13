#!/usr/bin/env python3
"""
Find Latest DO Message - Comprehensive Search

This script searches ALL DO storage to find the absolute newest message,
regardless of which conversation key it's in.

Usage:
    python3 find-latest-do-message.py
"""

import requests
import json
from datetime import datetime

API_BASE = "https://saywhatwant-do-worker.bootloaders.workers.dev"

def main():
    print("=" * 80)
    print("FINDING LATEST MESSAGE IN DO STORAGE")
    print("=" * 80)
    
    # Step 1: Get ALL conversation keys
    print("\n1. Listing ALL DO keys...")
    keys_response = requests.get(f"{API_BASE}/api/admin/list-keys")
    all_keys = keys_response.json().get('keys', [])
    
    conv_keys = [k for k in all_keys if k.startswith('conv:')]
    godmode_keys = [k for k in all_keys if k.startswith('godmode:')]
    
    print(f"   Total keys: {len(all_keys)}")
    print(f"   conv: keys: {len(conv_keys)}")
    print(f"   godmode: keys: {len(godmode_keys)}")
    
    # Step 2: Query each conversation key and find latest message
    print("\n2. Searching ALL conversations for newest message...")
    
    latest_message = None
    latest_timestamp = 0
    source_key = None
    
    # Check conv: keys
    for key in conv_keys:
        # Parse key to get conversation params
        parts = key.split(':')
        if len(parts) >= 5:
            human_user, human_color, ai_user, ai_color = parts[1], parts[2], parts[3], parts[4]
            
            # Query this conversation
            conv_url = f"{API_BASE}/api/conversation?humanUsername={human_user}&humanColor={human_color}&aiUsername={ai_user}&aiColor={ai_color}"
            conv_response = requests.get(conv_url)
            messages = conv_response.json()
            
            # Find latest in this conversation
            if messages:
                for msg in messages:
                    if msg['timestamp'] > latest_timestamp:
                        latest_timestamp = msg['timestamp']
                        latest_message = msg
                        source_key = key
    
    # Check godmode: keys (if any exist)
    if godmode_keys:
        print(f"\n   Found {len(godmode_keys)} godmode: keys to check...")
        for key in godmode_keys:
            parts = key.split(':')
            if len(parts) >= 6:
                human_user, human_color, ai_user, ai_color = parts[1], parts[2], parts[3], parts[4]
                
                conv_url = f"{API_BASE}/api/conversation?humanUsername={human_user}&humanColor={human_color}&aiUsername={ai_user}&aiColor={ai_color}"
                conv_response = requests.get(conv_url)
                messages = conv_response.json()
                
                if messages:
                    for msg in messages:
                        if msg['timestamp'] > latest_timestamp:
                            latest_timestamp = msg['timestamp']
                            latest_message = msg
                            source_key = key
    
    # Step 3: Display result
    print("\n" + "=" * 80)
    print("LATEST MESSAGE FOUND")
    print("=" * 80)
    
    if latest_message:
        # Convert timestamp to readable date
        dt = datetime.fromtimestamp(latest_timestamp / 1000)
        
        print(f"\nTimestamp: {latest_timestamp}")
        print(f"Date: {dt.strftime('%I:%M %p %B %d, %Y')}")
        print(f"Source Key: {source_key}")
        print(f"\n{'=' * 80}")
        print("FULL MESSAGE PAYLOAD:")
        print("=" * 80)
        print(json.dumps(latest_message, indent=2))
        
        # Highlight key fields
        print(f"\n{'=' * 80}")
        print("KEY FIELDS:")
        print("=" * 80)
        print(f"  ID: {latest_message['id']}")
        print(f"  Username: {latest_message['username']}")
        print(f"  Text: {latest_message['text'][:100]}...")
        
        if 'botParams' in latest_message:
            bp = latest_message['botParams']
            print(f"\n  botParams:")
            for key, value in bp.items():
                print(f"    {key}: {value}")
            
            if 'sessionId' in bp:
                print(f"\n  ✅ sessionId PRESENT: {bp['sessionId']}")
            else:
                print(f"\n  ❌ sessionId MISSING")
        else:
            print(f"\n  ❌ No botParams")
            
    else:
        print("\n❌ No messages found in any conversation!")
    
    print("\n" + "=" * 80)

if __name__ == "__main__":
    main()

