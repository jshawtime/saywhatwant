# IndexedDB Clear Utility

## Purpose
The clear-indexeddb.html utility helps resolve IndexedDB corruption issues, duplicate messages, or when you need to start fresh with the local message storage.

## How to Access
1. **Local Development**: http://localhost:3000/clear-indexeddb.html
2. **Production**: https://saywhatwant.app/clear-indexeddb.html

## What It Does

### Clear IndexedDB Button
- Deletes the entire SayWhatWant database
- Clears related localStorage items:
  - `sww-indexeddb-initialized`
  - `sww-indexeddb-messages-count`
- Handles blocked database connections
- Completely resets local message storage

### Check Database Status Button
Shows current state of:
- **messages_temp**: Temporary message storage
- **messages_perm**: Permanent message storage  
- **lifetime_filters**: Filter history
- **filter_stats**: Filter usage statistics
- **Total Messages**: Combined count from all message stores

## When to Use
1. **Seeing duplicate messages**: Database corruption can cause messages to appear multiple times
2. **More than 500 messages showing**: When message limit isn't being respected
3. **After metadata changes**: When message structure changes require a fresh start
4. **Performance issues**: When IndexedDB becomes too large or fragmented

## Usage Instructions
1. Open the clear utility page in your browser
2. Click "Check Database Status" to see current state
3. Click "Clear IndexedDB" to wipe the database
4. **Important**: Close all other Say What Want tabs before clearing
5. After clearing, refresh the main Say What Want page

## What Happens After Clearing
- IndexedDB will be completely empty
- The main app will recreate the database structure on next visit
- Only new messages (from that point forward) will be stored
- Historical messages from before the clear will not be recovered
- All filter statistics will be reset

## Troubleshooting
- **"Database is blocked" error**: Close all Say What Want tabs and try again
- **Messages still appearing after clear**: Hard refresh the main page (Ctrl+F5 or Cmd+Shift+R)
- **Clear doesn't work**: Try opening browser DevTools > Application > Storage > Clear Site Data

## Technical Details
- Database name: `SayWhatWant`
- Database version: 1
- Storage limit: 1GB (rolling deletion at ~990MB)
- Stores cleared:
  - messages_temp (ephemeral messages)
  - messages_perm (persistent messages)
  - lifetime_filters (filter history)
  - filter_stats (filter analytics)
