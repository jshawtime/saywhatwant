# 82. Polling Interval vs Fetch Cooldown Bug Fix

## Date: October 14, 2025

## Issue
User set `pollingInterval: 2000` (2 seconds) in `config-aientities.json` and restarted PM2, but the bot was still only fetching from KV every ~5 seconds instead of every 2 seconds.

## Root Cause Analysis

### The Bug
There were **TWO separate throttling mechanisms** working against each other:

1. **Polling Interval** (configurable, line 27 in `index.ts`)
   ```typescript
   const POLLING_INTERVAL = startupConfig.botSettings?.pollingInterval || 30000;
   ```
   - Set to `2000ms` in config
   - Bot loop runs every 2 seconds ✓

2. **KV Fetch Cooldown** (hardcoded, line 23 in `kvClient.ts`)
   ```typescript
   private fetchCooldown: number = 5000; // HARDCODED!
   ```
   - Hardcoded to `5000ms` (5 seconds)
   - Prevented actual KV fetches if less than 5 seconds since last fetch ✗

### What Was Happening
```
Time  | Polling Loop | KV Fetch     | Result
------|--------------|--------------|------------------
0s    | ✓ Run        | ✓ Fetch      | Fetched 50 msgs
2s    | ✓ Run        | ✗ Skip       | "too soon since last fetch"
4s    | ✓ Run        | ✗ Skip       | "too soon since last fetch"  
6s    | ✓ Run        | ✓ Fetch      | Fetched 50 msgs (5s+ elapsed)
```

**Result:** Bot polled every 2 seconds but only fetched every ~5 seconds!

### The Evidence
PM2 logs showed:
```bash
0|ai-bot   | [POLLING] Fetching from KV (interval: 2s)
0|ai-bot   | [bot-1760533074523] Skipping fetch - too soon since last fetch  ← THE SMOKING GUN
0|ai-bot   | [POLLING] Fetched 0 messages
0|ai-bot   | [POLLING] Cycle took 1ms, sleeping 1999ms (2s)
```

The message `"Skipping fetch - too soon since last fetch"` revealed the hardcoded throttle was blocking fetches.

## The Fix

### 1. Make KVClient Accept Fetch Cooldown Parameter

**File:** `ai/src/modules/kvClient.ts`

**Before:**
```typescript
export class KVClient {
  private apiUrl: string;
  private lastFetchTime: number = 0;
  private fetchCooldown: number = 5000; // HARDCODED!
  
  constructor(apiUrl: string = CONFIG.SWW_API.baseURL + CONFIG.SWW_API.endpoints.postComment) {
    this.apiUrl = apiUrl;
  }
```

**After:**
```typescript
export class KVClient {
  private apiUrl: string;
  private lastFetchTime: number = 0;
  private fetchCooldown: number; // Will be set from config
  
  constructor(apiUrl: string = CONFIG.SWW_API.baseURL + CONFIG.SWW_API.endpoints.postComment, fetchCooldown?: number) {
    this.apiUrl = apiUrl;
    // Use provided cooldown or default to 5000ms
    this.fetchCooldown = fetchCooldown || 5000;
  }
```

### 2. Update getKVClient Factory

**File:** `ai/src/modules/kvClient.ts`

**Before:**
```typescript
export function getKVClient(): KVClient {
  if (!kvClientInstance) {
    kvClientInstance = new KVClient();
  }
  return kvClientInstance;
}
```

**After:**
```typescript
export function getKVClient(fetchCooldown?: number): KVClient {
  if (!kvClientInstance) {
    kvClientInstance = new KVClient(undefined, fetchCooldown);
  }
  return kvClientInstance;
}
```

### 3. Fix Initialization Order and Pass Polling Interval

**File:** `ai/src/index.ts`

**Before:**
```typescript
// Initialize modules
const entityManager = getEntityManager();
const entityValidator = new EntityValidator();
const analyzer = getConversationAnalyzer();
const kvClient = getKVClient();  // ← Created BEFORE config loaded!

// Load configuration ONCE for startup settings
const startupConfig = getConfigOnce();

// Read settings from config
const POLLING_INTERVAL = startupConfig.botSettings?.pollingInterval || 30000;
```

**After:**
```typescript
// Load configuration FIRST for startup settings (polling, websocket, etc.)
const startupConfig = getConfigOnce();

// Read settings from config (these don't need hot-reload)
const POLLING_INTERVAL = startupConfig.botSettings?.pollingInterval || 30000;

// Initialize modules (after config is loaded so we can pass polling interval)
const entityManager = getEntityManager();
const entityValidator = new EntityValidator();
const analyzer = getConversationAnalyzer();
const kvClient = getKVClient(POLLING_INTERVAL); // ← Pass polling interval as fetch cooldown
```

## Verification

### Before Fix:
```bash
pm2 logs ai-bot --lines 10
# Shows:
0|ai-bot   | [POLLING] Fetching from KV (interval: 2s)
0|ai-bot   | [bot-XXX] Skipping fetch - too soon since last fetch  ← BAD
0|ai-bot   | [POLLING] Fetched 0 messages
```

### After Fix:
```bash
pm2 logs ai-bot --lines 10
# Shows:
0|ai-bot   | [POLLING] Fetching from KV (interval: 2s)
0|ai-bot   | [POLLING] Fetched 50 messages  ← GOOD! Actually fetching
0|ai-bot   | [POLLING] Cycle took 2ms, sleeping 1998ms (2s)
```

No more "Skipping fetch" messages! ✅

## Deployment Steps

```bash
# 1. Edit config (already done by user)
nano /Users/pbmacstudiomain/devrepo/SAYWHATWANTv1/saywhatwant/ai/config-aientities.json
# Set: "pollingInterval": 2000

# 2. Rebuild TypeScript
cd /Users/pbmacstudiomain/devrepo/SAYWHATWANTv1/saywhatwant/ai
npm run build

# 3. Restart PM2
pm2 restart ai-bot

# 4. Verify
pm2 logs ai-bot --lines 20 | grep POLLING
```

## Key Learnings

### 1. **Multiple Throttling Layers Can Conflict**
- Always check for redundant rate limiting across different modules
- Make all throttling configurable from a single source of truth

### 2. **Hardcoded Values Are Evil**
- The hardcoded `5000ms` fetch cooldown was impossible to change without code modification
- All timing values should come from config

### 3. **Initialization Order Matters**
- KVClient was created before config was loaded
- Fixed by loading config first, then passing values to constructors

### 4. **Log Messages Are Your Friend**
- The "Skipping fetch - too soon since last fetch" message was the key clue
- Good debug logging makes bugs visible

### 5. **TypeScript Requires Rebuild**
- PM2 runs compiled JavaScript from `dist/` folder
- Always rebuild after TypeScript changes
- Config JSON files are read at runtime (no rebuild needed)

## Related Settings

### Settings That Require PM2 Restart:
- `pollingInterval` ← This one!
- `websocketPort`
- `lmStudioServers`
- `queueSettings`

### Settings That Hot-Reload (No Restart):
- Entity configs (systemPrompt, temperature, etc.)
- Entity colors, usernames
- Response chances
- Context sizes (nom)

## Performance Impact

### With `pollingInterval: 2000`:
- **Before Fix:** Effective polling = ~5 seconds (limited by hardcoded cooldown)
- **After Fix:** Effective polling = ~2 seconds (respects config)
- **Improvement:** 2.5x faster message detection

### Trade-offs:
- **Faster polling** = faster bot responses
- **Faster polling** = more API calls to Cloudflare Worker
- **2-second polling** is reasonable for production (30 calls/minute)
- **Cloudflare Workers KV** can easily handle this load

## Future Improvements

1. **Add config validation** on startup to warn about unrealistic polling intervals
2. **Add metrics** to track actual vs configured polling rates
3. **Consider adaptive polling** (faster when messages are active, slower when idle)
4. **Add circuit breaker** if KV fetch fails repeatedly

## Status
✅ **FIXED** - KV fetch cooldown now respects polling interval from config
