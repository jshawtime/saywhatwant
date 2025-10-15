#!/usr/bin/env python3
"""
ALIVE Mode 2 Server - Flask server that logs to terminal for Cursor monitoring
This is the key to autonomous ALIVE operation: Cursor monitors this terminal output
"""

from flask import Flask, request, jsonify, send_from_directory
import json
from datetime import datetime
import os
import sys

app = Flask(__name__)

# Get the directory where this script is located
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))

@app.route('/')
def index():
    """Serve the main ALIVE prompt viewer"""
    return send_from_directory(SCRIPT_DIR, 'prompt-viewer.html')

@app.route('/<path:filename>')
def serve_static(filename):
    """Serve static files (prompt-data.js, etc.)"""
    return send_from_directory(SCRIPT_DIR, filename)

@app.route('/submit-conversation', methods=['POST'])
def submit_conversation():
    """
    ALIVE Mode 2 Endpoint - Logs conversation to terminal for Cursor monitoring
    This is where the magic happens - terminal output triggers Cursor execution
    """
    try:
        data = request.get_json()
        conversation = data.get('conversation', '')
        entity = data.get('entity', 'Unknown')
        timestamp = datetime.now().isoformat()
        
        # Parse conversation and owner comment
        if '#OWNER COMMENT:' in conversation:
            parts = conversation.split('#OWNER COMMENT:', 1)
            conversation_only = parts[0].strip()
            owner_comment = parts[1].strip() if len(parts) > 1 else 'No feedback provided'
        else:
            conversation_only = conversation.strip()
            owner_comment = 'No feedback provided'
        
        # CRITICAL: Log with clear markers for Cursor AI to monitor
        # This appears in terminal stdout that Cursor watches continuously
        print('\n\n')
        print('=' * 80)
        print('🎯 ALIVE_MODE_2_CONVERSATION_SUBMITTED 🎯')
        print('=' * 80)
        print(f'TIMESTAMP: {timestamp}')
        print(f'ENTITY: {entity}')
        print('=' * 80)
        print('CONVERSATION_START')
        print('-' * 80)
        print(conversation_only)
        print('-' * 80)
        print('CONVERSATION_END')
        print('=' * 80)
        print('OWNER_FEEDBACK_START')
        print('-' * 80)
        print(owner_comment)
        print('-' * 80)
        print('OWNER_FEEDBACK_END')
        print('=' * 80)
        print('')
        print('🤖 CURSOR AI INSTRUCTIONS:')
        print('1. Read conversation above')
        print('2. Read owner feedback above')
        print('3. Analyze what worked / what didn\'t work')
        print('4. Compare to CONVERSATIONAL GOAL in README')
        print('5. Update WORKING PROMPT in README with psychology improvements')
        print('6. Update prompt-data.js with new prompt')
        print('7. Mark changed sections with green highlighting')
        print('8. Update lastUpdated timestamp')
        print('9. Page will auto-refresh and show new prompt')
        print('=' * 80)
        print('\n\n')
        
        # Flush output immediately so Cursor sees it right away
        sys.stdout.flush()
        
        return jsonify({
            'status': 'success',
            'message': 'Conversation submitted! Cursor AI monitoring terminal output...',
            'timestamp': timestamp
        })
        
    except Exception as e:
        print(f'ERROR in submit_conversation: {e}')
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500

if __name__ == '__main__':
    print('\n🚀 ALIVE MODE 2 SERVER STARTING')
    print('=' * 50)
    print('URL: http://localhost:8080')
    print('Interface: ALIVE - Prompt Maker')
    print('Monitoring: Terminal stdout (this console)')
    print('=' * 50)
    print('✅ Ready for ALIVE triggers...\n')
    
    app.run(host='localhost', port=8080, debug=False)
