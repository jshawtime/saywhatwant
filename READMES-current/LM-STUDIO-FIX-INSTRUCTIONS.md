# LM Studio Configuration Fix Instructions

## The Problem
- **Mac Studio 1**: Shows only loaded models (correct behavior)
- **Mac Studio 2**: Shows ALL available models (incorrect for our use case)

## How to Fix Mac Studio 2 (10.0.0.100)

### Option 1: Check LM Studio UI Settings
1. Open LM Studio on Mac Studio 2
2. Look for Settings/Preferences (usually gear icon)
3. Find "Server" or "API" section
4. Look for options like:
   - [ ] "Show all models in API" → UNCHECK
   - [ ] "List only loaded models" → CHECK
   - [ ] "API model visibility" → Set to "Loaded only"

### Option 2: Check config.json
LM Studio stores settings in a config file:
```bash
# Common locations:
~/Library/Application Support/LM Studio/config.json
~/.lmstudio/config.json
~/.config/lmstudio/config.json
```

Look for settings like:
```json
{
  "api": {
    "showAllModels": false,  // Should be false
    "listOnlyLoaded": true    // Should be true
  }
}
```

### Option 3: Restart Strategy
Sometimes LM Studio behavior depends on startup state:

1. **On Mac Studio 2:**
   - Stop LM Studio completely
   - Start LM Studio
   - Load ONLY `highermind_the-eternal-1`
   - Start the server
   - Check if /v1/models now shows only 1 model

### Option 4: Version Check
Make sure both machines have the same LM Studio version:
- Mac Studio 1: Check Help → About
- Mac Studio 2: Check Help → About
- Update both to latest if different

## Quick Test After Fix

Run this to verify both servers now behave the same:
```bash
# Mac Studio 1
curl -s http://10.0.0.102:1234/v1/models | jq '.data | length'

# Mac Studio 2  
curl -s http://10.0.0.100:1234/v1/models | jq '.data | length'
```

Both should return the same count (ideally 1 if only highermind_the-eternal-1 is loaded).

## For True Extensibility

### The Standard Configuration (for ALL servers):

1. **LM Studio Settings:**
   - API shows: **Loaded models only**
   - Default model: `highermind_the-eternal-1`
   - Listen on: `0.0.0.0:1234`
   - CORS: Enabled for all origins

2. **Startup Procedure:**
   - Start LM Studio
   - Load `highermind_the-eternal-1`
   - Start server
   - Verify /v1/models shows exactly 1 model

3. **Adding New Server Checklist:**
   - [ ] Install same LM Studio version
   - [ ] Configure to show loaded models only
   - [ ] Load highermind_the-eternal-1 by default
   - [ ] Test /v1/models returns consistent format
   - [ ] Add to config-aientities.json

This ensures every server behaves identically!
