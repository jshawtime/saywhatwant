# 158-HANDOFF-DASHBOARD-PM2-LOGS-PERSIST.md

**Tags:** #handoff #dashboard #pm2-logs #bug #unsolved  
**Created:** October 27, 2025  
**Status:** ✅ RESOLVED - Fixed October 27, 2025  
**Priority:** HIGH - Affects debugging experience

---

## ✅ SOLUTION THAT WORKED

**The Fix: Direct File Deletion**

Theory 2 from the handoff doc was correct - `pm2 flush` after `pm2 delete` doesn't work because the process no longer exists.

**Simple solution:**
```bash
npx pm2 delete all
rm -f ~/.pm2/logs/ai-bot-simple-*.log  # Direct file deletion
npx pm2 start dist/index-simple.js --name ai-bot-simple
```

**Why this works:**
- `pm2 flush` tries to flush logs for a process that doesn't exist (already deleted)
- Direct `rm -f` deletes the actual log files guaranteed
- Simple, reliable, no PM2 API quirks
- Exactly what we want: fresh logs on restart

**Files Modified:**
1. `/Volumes/BOWIE/devrepo/SAYWHATWANTv1/hm-server-deployment/AI-Bot-Deploy/start-simple-worker.sh`
   - Changed line 19-20 from `pm2 flush` to `rm -f ~/.pm2/logs/ai-bot-simple-*.log`
   
2. `/Volumes/BOWIE/devrepo/SAYWHATWANTv1/hm-server-deployment/AI-Bot-Deploy/PM2-kill-rebuild-and-start.sh`
   - Added lines 19-21 for log deletion before starting bot

**Testing Verified:**
- PM2 restart → Dashboard shows only current session logs ✅
- No old "Claimed" or "Completed" messages from previous sessions ✅
- Fresh logs appear within 3 seconds of PM2 restart ✅
- 100% accuracy - showing exactly current PM2 state ✅

**Philosophy: Simple. Strong. Solid.**
- No PM2 API complexity
- No timing issues
- No race conditions
- Just direct file system operations that work every time

---

## Problem Statement (Original)

**Queue Monitor Dashboard shows stale PM2 logs after PM2 restart instead of fresh current logs.**

**Expected behavior:**
1. PM2 restarts (fresh process, empty logs)
2. Dashboard auto-refreshes (polls every 3s)
3. Dashboard shows ONLY current PM2 session logs

**Actual behavior:**
1. PM2 restarts with empty logs
2. Dashboard continues showing old logs from previous PM2 session
3. Logs persist indefinitely, don't clear even after multiple hard refreshes

**Impact:** Dashboard shows incorrect historical data instead of current PM2 state, making debugging confusing and unreliable.

---

## System Architecture Overview

### The Application (SayWhatWant)

**Frontend:**
- Next.js app on Cloudflare Pages (saywhatwant.app)
- Users post messages
- Messages saved to Cloudflare KV via Worker API
- Frontend polls for new messages every 5s (regressive polling)

**Worker API:**
- Cloudflare Worker at sww-comments.bootloaders.workers.dev
- Handles POST /api/comments (save messages)
- Handles GET /api/comments (fetch messages from cache)
- Maintains cache of recent 200 messages in KV
- New queue endpoints: /api/queue/pending, /api/queue/claim, /api/queue/complete

**PM2 Bot:**
- Node.js process managed by PM2
- Polls Worker's /api/queue/pending every 3 seconds
- Claims pending messages
- Sends to Ollama for AI response generation
- Posts AI response back to Worker
- Marks message complete
- Logs all activity to PM2 log files

**Queue Monitor Dashboard:**
- React app (Vite) running on localhost:5174
- WebSocket connection to PM2 bot on port 4002
- Displays real-time PM2 logs
- Shows KV store contents
- Auto-refreshes every 3 seconds

### Data Flow

```
User → Frontend → Worker → KV (individual keys + cache)
                              ↓
                          PM2 Bot (polls pending)
                              ↓
                          Ollama (generates response)
                              ↓
                          Worker (posts AI response)
                              ↓
                          Frontend (displays)
```

### Dashboard → PM2 Logs Flow

```
PM2 Bot → WebSocket Server (port 4002)
             ↓
          Auto-refresh (every 3s)
             ↓
          Executes: npx pm2 logs ai-bot-simple --lines 500
             ↓
          Reads from PM2 log FILES (~/.pm2/logs/ai-bot-simple-out.log)
             ↓
          Broadcasts via WebSocket
             ↓
          Dashboard receives pm2_logs_update
             ↓
          Updates pm2Logs state
             ↓
          Parser extracts Claimed/Completed items
             ↓
          Display renders
```

---

## What Was Tried (All Failed)

### Attempt 1: Clear State on WebSocket Connection

**Implementation:**
```typescript
ws.onopen = () => {
  setPm2Logs(''); // Clear on connection
  setConnected(true);
};
```

**Why it failed:**
- State cleared, but 1 second later old logs reappeared
- Initial fetch (setTimeout 1000ms) runs after clear
- Fetches from PM2 log FILES which contain old data

**Commit:** 959a5b0

---

### Attempt 2: Detect PM2 Restart by Log Size

**Implementation:**
```typescript
case 'pm2_logs_update':
  setPm2Logs(prev => {
    const newLines = newData.split('\n').length;
    const prevLines = prev.split('\n').length;
    
    // If new data <50 lines and prev >100, PM2 restarted
    if (newLines < 50 && prevLines > 100) {
      console.log('PM2 restart detected');
      return newData; // Fresh start
    }
    return newData;
  });
```

**Why it failed:**
- Logic correct but PM2 log FILES still contain old data
- Even after restart, `pm2 logs --lines 500` returns old file contents
- Detection triggers but then loads old data anyway

**Commit:** 2250950

---

### Attempt 3: Reduce Initial Fetch to 50 Lines

**Implementation:**
Changed initial fetch from 1000 lines to 50 lines, hoping to avoid old logs.

**Why it failed:**
- Idiotic approach - limits useful history
- PM2 log files still contain old data
- Doesn't solve root cause

**Commit:** 36001c4 (reverted in ce20a83)

---

### Attempt 4: Flush PM2 Log Files on Restart

**Implementation:**
Added to `start-simple-worker.sh`:
```bash
echo "Flushing old PM2 log files..."
npx pm2 flush ai-bot-simple 2>/dev/null || echo "No logs to flush"
```

**Why it's failing:**
- Command added to script
- Should clear ~/.pm2/logs/ai-bot-simple-out.log
- But logs still persist in dashboard after PM2 restart
- **Either:**
  - Flush not actually running
  - Flush runs but dashboard already fetched before flush completed
  - Dashboard state persisting across refreshes somehow
  - Auto-refresh sending cached data

**Commit:** 6e8a9b9

**Current status:** STILL BROKEN after restart + flush + dashboard restart + hard refresh

---

## Technical Details

### PM2 Log File Locations

```
~/.pm2/logs/ai-bot-simple-out.log  (stdout)
~/.pm2/logs/ai-bot-simple-error.log (stderr)
```

**These files persist across PM2 restarts!** This is the root issue.

### WebSocket Auto-Refresh Code

**File:** `AI-Bot-Deploy/src/websocketServer.ts`

```typescript
private startAutoRefresh() {
  this.autoRefreshInterval = setInterval(async () => {
    if (this.clients.size === 0) return;
    
    try {
      const { stdout } = await execAsync(
        'npx pm2 logs ai-bot-simple --lines 500 --nostream 2>&1 || echo ""'
      );
      
      this.broadcast({
        type: 'pm2_logs_update',
        data: stdout || ''
      });
    } catch (error) {
      console.error('[WebSocket] Auto-refresh error:', error);
    }
  }, 3000);
}
```

**The command `pm2 logs --lines 500` reads from the LOG FILE, not from current process memory!**

### Dashboard State Management

**File:** `Queue-Monitor-Deploy/src/hooks/useWebSocket.ts`

```typescript
const [pm2Logs, setPm2Logs] = useState<string>('');

// On pm2_logs message
case 'pm2_logs':
  setPm2Logs(message.data || ''); // REPLACE
  break;

// On pm2_logs_update message  
case 'pm2_logs_update':
  setPm2Logs(message.data || ''); // REPLACE with latest
  break;
```

**State management looks correct - replaces on every update.**

### Parser

**File:** `Queue-Monitor-Deploy/src/App.tsx`

```typescript
const parsedPm2Items = React.useMemo(() => {
  // Strip ANSI codes
  const cleanLogs = stripAnsi(pm2Logs);
  
  // Parse into Claimed/Completed items
  // Returns ALL items, no limit
  
  return items.reverse(); // Newest first
}, [pm2Logs]);
```

**Parser depends on pm2Logs state - when state updates, it should re-parse.**

---

## Theories on Why It's Still Broken

### Theory 1: Flush Command Timing

**Hypothesis:** The flush happens, but dashboard fetches BEFORE flush completes.

**Sequence:**
1. Script runs `pm2 delete all`
2. Script runs `pm2 flush` (async, takes time)
3. Script runs `pm2 start` (immediately)
4. Dashboard connects (within 1s)
5. Dashboard fetches 1000 lines (before flush completes!)
6. Gets old data from partially-flushed files

**How to verify:**
Add delay after flush:
```bash
npx pm2 flush ai-bot-simple
sleep 2  # Wait for flush to complete
npx pm2 start ...
```

### Theory 2: PM2 Flush Doesn't Work for Deleted Processes

**Hypothesis:** `pm2 flush ai-bot-simple` fails because process was already deleted.

**Sequence:**
1. `pm2 delete all` - process gone
2. `pm2 flush ai-bot-simple` - fails silently (process doesn't exist)
3. Log files remain untouched
4. New process starts, appends to old log files
5. Dashboard reads old+new logs

**How to verify:**
Flush BEFORE delete:
```bash
npx pm2 flush ai-bot-simple
npx pm2 delete all
npx pm2 start ...
```

### Theory 3: Dashboard State Persisting via HMR

**Hypothesis:** Vite's Hot Module Replacement preserves React state across "restarts"

**When you "restart" dashboard with the script:**
- Vite dev server doesn't actually restart
- React component state persists via HMR
- `pm2Logs` state keeps old value
- Even though you hard refresh, state might persist

**How to verify:**
- Actually kill the Vite process (not just restart script)
- `lsof -ti:5174 | xargs kill -9`
- Then start fresh
- Or use production build instead of dev mode

### Theory 4: Multiple WebSocket Connections

**Hypothesis:** Multiple dashboard connections sending different data

**PM2 logs show:**
```
[WebSocket] Dashboard connected
[WebSocket] Dashboard disconnected
[WebSocket] Dashboard connected
```

**Multiple connect/disconnect cycles suggest:**
- React Strict Mode mounting twice
- Multiple WebSocket instances
- Old connection sending old data
- New connection sending new data
- Race condition on which one updates state last

**How to verify:**
Check PM2 logs for connection pattern when dashboard "restarts"

### Theory 5: Browser Cache Serving Old WebSocket Code

**Hypothesis:** Dashboard JavaScript is cached, using old WebSocket logic

**Even after hard refresh:**
- Service worker might cache WebSocket handling code
- Old code doesn't have the clear-on-connect logic
- Serves stale handlers

**How to verify:**
- Open DevTools → Application → Service Workers → Unregister all
- Clear all site data
- Hard refresh
- Check if COPY ALL - verbose has URL (proves code is current)

---

## What Still Needs Investigation

### 1. Verify Flush Actually Runs

**Add logging to script:**
```bash
echo "Flushing PM2 logs..."
npx pm2 flush ai-bot-simple 2>&1
ls -la ~/.pm2/logs/ai-bot-simple-*.log
echo "Log files after flush:"
wc -l ~/.pm2/logs/ai-bot-simple-out.log
```

### 2. Check WebSocket Server Startup Timing

**Question:** When does WebSocket server start sending auto-refreshes?

**Code:** `websocketServer.ts` starts auto-refresh in constructor (immediately)

**Possible issue:** Auto-refresh sends data from old log files before PM2 has written new logs

### 3. Verify Dashboard Actually Receives Fresh Data

**Add console.log to see what data arrives:**
```typescript
case 'pm2_logs_update':
  console.log('[WebSocket] Received pm2_logs_update, length:', message.data?.length);
  console.log('[WebSocket] First 100 chars:', message.data?.substring(0, 100));
  setPm2Logs(message.data || '');
```

---

## Files to Examine

### Critical Files

1. **`AI-Bot-Deploy/start-simple-worker.sh`** - PM2 startup script with flush
2. **`AI-Bot-Deploy/src/websocketServer.ts`** - WebSocket server, auto-refresh logic
3. **`Queue-Monitor-Deploy/src/hooks/useWebSocket.ts`** - Dashboard WebSocket client, state management
4. **`Queue-Monitor-Deploy/src/App.tsx`** - PM2 logs parser and display
5. **`Queue-Monitor-Deploy/DASHBOARD-kill-and-start.sh`** - Dashboard startup script

### Log Files

1. **`~/.pm2/logs/ai-bot-simple-out.log`** - PM2 stdout (this is the source of truth!)
2. **`~/.pm2/logs/ai-bot-simple-error.log`** - PM2 stderr

---

## READMEs to Read

**Essential context:**

1. **157-QUEUE-MONITOR-DASHBOARD-WORKING.md** - Dashboard implementation, what's supposed to work
2. **156-DEBUG-WORKFLOW-COPY-VERBOSE.md** - Investigation protocol, how to debug
3. **152-QUEUE-PM2-ARCHITECTURE-REDESIGN.md** - Simple queue system architecture

**Background:**

4. **00-AGENT!-best-practices.md** - Philosophy: think before coding, check with owner before fixing
5. **154-COPY-ALL-VERBOSE-DEBUG.md** - COPY ALL - verbose implementation

---

## Current System State

**What IS working:**
- ✅ Simple queue system (100% reliable, 6/6 stress tests when all tabs have current code)
- ✅ PM2 bot processing messages correctly
- ✅ WebSocket connection stable
- ✅ Auto-refresh sending data every 3s
- ✅ Cache sorted by timestamp (fixed today)
- ✅ Conversation logging to disk
- ✅ COPY ALL - verbose with URL and metadata

**What is NOT working:**
- ❌ Dashboard PM2 logs show stale data after PM2 restart
- ❌ Logs don't clear even after flush command
- ❌ Hard refresh doesn't fix it
- ❌ Restarting both PM2 and dashboard doesn't fix it

**Success rate:**
- Normal operation: 100% (messages get processed and appear)
- After PM2 restart: Dashboard shows wrong logs (stale)

---

## Attempted Fixes (All Failed)

### Fix 1: Clear PM2 Logs State on WebSocket Connection

**Commit:** 959a5b0  
**File:** Queue-Monitor-Deploy/src/hooks/useWebSocket.ts  
**Change:** Added `setPm2Logs('')` in `ws.onopen` handler

**Expected:** State clears when WebSocket connects, then refetches fresh data

**Result:** FAILED
- State clears momentarily
- ~1 second later, old logs reappear
- Initial fetch (setTimeout) loads old data from PM2 log files

**Root cause analysis:** PM2 log files persist across restarts, so fetching from files returns old data

---

### Fix 2: Detect PM2 Restart by Comparing Log Sizes

**Commit:** 2250950  
**File:** Queue-Monitor-Deploy/src/hooks/useWebSocket.ts  
**Change:** Added logic to detect if new data is significantly shorter than previous

```typescript
if (newLines < 50 && prevLines > 100) {
  console.log('[WebSocket] PM2 restart detected - clearing old logs');
  return newData; // Fresh start
}
```

**Expected:** Detect restart and clear old logs

**Result:** FAILED
- Detection logic never triggers because new data from log files is still hundreds of lines
- PM2 log files contain old session data
- Even "fresh" PM2 has old data in its log files

**Root cause analysis:** The condition for detecting restart is correct, but PM2 log files make it impossible to detect restart by line count

---

### Fix 3: Reduce Initial Fetch Lines (IDIOTIC)

**Commit:** 36001c4 (later reverted in ce20a83)  
**File:** Queue-Monitor-Deploy/src/hooks/useWebSocket.ts  
**Change:** Changed initial fetch from 1000 lines to 50 lines

**Expected:** Avoid loading old logs by fetching less

**Result:** FAILED (and idiotic approach)
- Limits useful history unnecessarily
- PM2 log files still contain old data in first 50 lines
- Doesn't solve root cause
- Reduces dashboard usefulness

**Root cause analysis:** Treating symptom instead of disease - log file persistence is the real issue

---

### Fix 4: Flush PM2 Log Files on Restart

**Commit:** 6e8a9b9  
**File:** AI-Bot-Deploy/start-simple-worker.sh  
**Change:** Added `npx pm2 flush ai-bot-simple` before starting PM2

```bash
npx pm2 delete all
npx pm2 flush ai-bot-simple 2>/dev/null || echo "No logs to flush"
npx pm2 start dist/index-simple.js --name ai-bot-simple
```

**Expected:** Empty log files before starting, dashboard sees only fresh logs

**Result:** STILL FAILING (as of this handoff)
- Command added to script
- Script runs without errors
- But dashboard STILL shows old logs after restart
- Multiple hard refreshes don't fix it

**Possible reasons:**
1. Flush runs after delete, process doesn't exist, command fails silently
2. Flush timing - dashboard connects before flush completes
3. Flush command not actually clearing files (PM2 bug?)
4. Dashboard fetching cached data from somewhere else
5. React state persisting via Vite HMR even across "restarts"

---

## Current Code State

### WebSocket Server (PM2 Bot)

**File:** AI-Bot-Deploy/src/websocketServer.ts

**Auto-refresh:** Sends 500 lines every 3 seconds
```typescript
await execAsync('npx pm2 logs ai-bot-simple --lines 500 --nostream 2>&1 || echo ""');
```

**Initial send on connect:** REMOVED (to prevent race with dashboard fetch)

**Commands handled:**
- `get_pm2_logs` - Fetch N lines from log files
- `clear_pm2_logs` - Flush log files
- `get_loaded_models` - Query Ollama

### Dashboard WebSocket Client

**File:** Queue-Monitor-Deploy/src/hooks/useWebSocket.ts

**State:**
- `pm2Logs` - string containing raw PM2 log output
- Starts as empty string `''`

**On connection:**
- Clears pm2Logs state: `setPm2Logs('')`
- Waits 1 second
- Fetches 1000 lines via command: `{ type: 'get_pm2_logs', data: { lines: 1000 } }`

**On pm2_logs message:**
- Replaces state: `setPm2Logs(message.data || '')`

**On pm2_logs_update message (every 3s):**
- Replaces state: `setPm2Logs(message.data || '')`
- Has restart detection (doesn't trigger)

### Dashboard Parser

**File:** Queue-Monitor-Deploy/src/App.tsx

**Parsing:**
- Strips ANSI color codes
- Filters out POLL lines
- Groups Claimed/Completed messages
- Extracts messageId, entity, text
- No limit on items returned

**Re-render trigger:**
- `pm2LogsKey` state increments on every `pm2Logs` change
- `<div key={pm2LogsKey}>` forces full re-render

---

## Diagnostic Commands

### Check PM2 Log Files Directly

```bash
# See actual file contents
cat ~/.pm2/logs/ai-bot-simple-out.log

# Count lines
wc -l ~/.pm2/logs/ai-bot-simple-out.log

# Check timestamps
ls -la ~/.pm2/logs/ai-bot-simple-*.log

# Manually flush
npx pm2 flush ai-bot-simple
```

### Check WebSocket Data Flow

**Add logging to useWebSocket.ts:**
```typescript
case 'pm2_logs':
  console.log('[DEBUG] pm2_logs received, length:', message.data?.length);
  console.log('[DEBUG] First line:', message.data?.split('\n')[0]);
  setPm2Logs(message.data || '');
```

### Check Dashboard State

**Add logging to App.tsx:**
```typescript
React.useEffect(() => {
  console.log('[DEBUG] pm2Logs state updated, length:', pm2Logs.length);
  console.log('[DEBUG] Parsed items:', parsedPm2Items.length);
}, [pm2Logs, parsedPm2Items]);
```

---

## Recommended Next Steps

### 1. Verify Flush Actually Works

**Test manually:**
```bash
# Restart PM2 and check logs exist
cd /Volumes/BOWIE/devrepo/SAYWHATWANTv1/hm-server-deployment/AI-Bot-Deploy
npx pm2 start dist/index-simple.js --name ai-bot-simple
sleep 5
npx pm2 logs ai-bot-simple --lines 10 --nostream

# Now flush
npx pm2 flush ai-bot-simple

# Check if files are empty
cat ~/.pm2/logs/ai-bot-simple-out.log
# Should be empty or very short
```

### 2. Move Flush to BEFORE Delete

**Current order:**
```bash
pm2 delete all
pm2 flush ai-bot-simple  # Might fail - process gone
pm2 start
```

**Try this order:**
```bash
pm2 flush ai-bot-simple  # Flush while process exists
pm2 delete all
pm2 start
```

### 3. Check if Vite HMR is Preserving State

**Kill dashboard completely:**
```bash
lsof -ti:5174 | xargs kill -9
# Wait 2 seconds
cd Queue-Monitor-Deploy
npm run dev
```

**Don't use the script** - manually kill process to ensure clean start

### 4. Add Aggressive Logging

**See exactly what data arrives:**
- Log every `pm2_logs` and `pm2_logs_update` message
- Log current state length before and after update
- Log parsed items count
- This will show if old data is arriving or if parsing is broken

### 5. Consider Alternative Approaches

**Option A: Don't use PM2 log files at all**
- Have PM2 bot maintain in-memory log buffer
- WebSocket sends from memory, not files
- Restart = memory clears = fresh logs

**Option B: Prefix current session logs**
- Add session ID to each log line
- Dashboard filters by session ID
- Old logs ignored even if in files

**Option C: Clear button**
- Accept that logs persist
- User clicks CLEAR when they restart PM2
- Simple but requires manual action

---

## Environment Details

**Dev Machine:**
- macOS (darwin 25.0.0)
- PM2 location: `/Volumes/BOWIE/devrepo/SAYWHATWANTv1/hm-server-deployment/AI-Bot-Deploy`
- Dashboard location: `/Volumes/BOWIE/devrepo/SAYWHATWANTv1/hm-server-deployment/Queue-Monitor-Deploy`

**PM2:**
- Process name: `ai-bot-simple`
- Script: `dist/index-simple.js`
- WebSocket port: 4002

**Dashboard:**
- Port: 5174
- WebSocket URL: `ws://localhost:4002`
- Mode: Vite dev server

---

## Success Criteria

**Dashboard must show ONLY current PM2 session logs:**

1. Restart PM2 → Dashboard shows empty/minimal logs (just startup)
2. Process messages → Dashboard updates with new Claimed/Completed items
3. NO old logs from previous sessions
4. Within 3 seconds of PM2 restart, dashboard reflects current state

**100% accuracy required - showing stale logs is a bug!**

---

## Last Known State

**As of October 27, 2025 ~14:40 UTC:**

**PM2 Bot:**
- Running successfully
- Processing messages 100%
- WebSocket server active on port 4002
- Auto-refresh sending data every 3s
- Flush command added to restart script (but not working)

**Dashboard:**
- Connected to WebSocket
- Receiving updates every 3s
- But displaying stale logs after PM2 restart
- Hard refresh doesn't clear stale logs

**Git commits:**
- saywhatwant: 7fe76f1
- hm-server-deployment: ce20a83

---

## Message to Next Agent

The core messaging system is rock solid - 100% reliable, fast, well-documented. This PM2 logs persistence issue is a dashboard-only problem that doesn't affect the actual queue functionality. It's frustrating but isolated.

The issue is clearly related to PM2 log files persisting across restarts. The flush command was added but isn't working. You need to verify if flush actually runs and clears the files, or if there's a timing/ordering issue.

Check Theory 2 first - flush before delete instead of after. That's most likely to work.

Don't assume anything - verify each step with the owner before implementing.

Good luck!

---

**Status:** ✅ RESOLVED - Simple file deletion fix deployed and working  
**Priority:** HIGH - Affects debugging workflow  
**Complexity:** LOW - Direct file deletion instead of PM2 API  
**Solution:** Theory 2 was correct - flush before delete doesn't work, direct `rm -f` works perfectly

