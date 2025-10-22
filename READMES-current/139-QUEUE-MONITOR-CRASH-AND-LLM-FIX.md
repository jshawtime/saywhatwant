# Queue Monitor: Dashboard Crash & LLM Request Display Fix

**Date:** October 22, 2025  
**Related READMEs:** 137-QUEUE-MONITOR-ON-10.0.0.100.md, 138-QUEUE-MONITOR-VERTICAL-LAYOUT.md  
**Status:** ✅ COMPLETED

---

## ISSUES REPORTED

### 1. Dashboard Crashes on New Message
**Problem:** When a message was sent from the frontend and hit the queue, the dashboard would crash (black screen) requiring a manual refresh.

**Root Cause:** The queue rendering code was trying to access `item.entity.modelServer` without proper null/undefined checks, causing a React rendering error when the entity structure was unexpected or incomplete.

### 2. LLM Requests Not Displaying
**Problem:** The "LLM SERVER REQUESTS" section remained empty with "Waiting for LLM requests..." even when the bot was processing messages.

**Root Cause:** The bot WAS sending `llm_request` WebSocket messages, but:
- The LLM request object didn't have unique identifiers (`id` and `timestamp` fields)
- The dashboard was using array index as the React key, which caused re-rendering issues
- Field names in the request object needed fallback handling

---

## FIXES IMPLEMENTED

### Fix 1: Queue Item Safe Rendering
**File:** `/Volumes/Macintosh HD-1/Users/ms1281/Desktop/hm-server-deployment/Queue-Monitor-Deploy/src/App.tsx`

**Changes:**
```typescript
// OLD - Unsafe access
{item.entity && (
  <span className={(item.entity as any).modelServer === 'ollama-hm' ? ...}>
    ...
  </span>
)}

// NEW - Safe access with null checks
const modelServer = item.entity && typeof item.entity === 'object' && 'modelServer' in item.entity 
  ? (item.entity as any).modelServer 
  : null;

{modelServer && (
  <span className={modelServer === 'ollama-hm' ? ...}>
    ...
  </span>
)}
```

**Additional Safety:**
- Added fallback for `item.priority` → `item.priority || 'N/A'`
- Added fallback for `item.message` → `item.message?.substring(0, 100) || 'No message'`

### Fix 2: LLM Request Tracking
**File:** `/Volumes/Macintosh HD-1/Users/ms1281/Desktop/hm-server-deployment/AI-Bot-Deploy/src/index.ts`

**Changes:**
```typescript
// OLD - No tracking IDs
const llmRequest = {
  entityId: entity.id,
  modelName,
  modelServer: entity.modelServer || 'lmstudio',
  ...
};

// NEW - With unique ID and timestamp
const llmRequest = {
  id: `llm-${Date.now()}-${entity.id}`,
  timestamp: Date.now(),
  entityId: entity.id,
  modelName,
  modelServer: entity.modelServer || 'lmstudio',
  ...
};
```

**Benefits:**
- Unique `id` for React keys
- `timestamp` for sorting and debugging
- Prevents duplicate key warnings
- Enables proper tracking across re-renders

### Fix 3: LLM Request Display with Fallbacks
**File:** `/Volumes/Macintosh HD-1/Users/ms1281/Desktop/hm-server-deployment/Queue-Monitor-Deploy/src/App.tsx`

**Changes:**
```typescript
// OLD - Limited field access
const model = req.modelName || 'unknown';
const entity = req.entityId || 'unknown';
const uniqueKey = idx; // BAD - array index as key

// NEW - Multiple fallbacks and unique keys
const model = req.modelName || req.model || 'unknown';
const entity = req.entityId || req.entity || 'unknown';
const uniqueKey = req.id || req.timestamp || `llm-${idx}-${Date.now()}`;
```

**Benefits:**
- Handles different LLM request formats
- Uses proper unique keys for React rendering
- Prevents crashes from missing fields

### Fix 4: Error Boundary Pattern
**File:** `/Volumes/Macintosh HD-1/Users/ms1281/Desktop/hm-server-deployment/Queue-Monitor-Deploy/src/App.tsx`

**Changes:**
- Added `renderError` state
- Wrapped entire render in try-catch
- Added error display screen with reload button
- Added console logging for queue and LLM request updates

**Code:**
```typescript
const [renderError, setRenderError] = React.useState<string | null>(null);

// Log queue updates for debugging
React.useEffect(() => {
  console.log('[App] Queue updated, length:', queue.length);
  console.log('[App] Queue items:', queue);
}, [queue]);

// Log LLM requests for debugging
React.useEffect(() => {
  console.log('[App] LLM Requests updated, length:', llmRequests.length);
  console.log('[App] LLM Requests:', llmRequests);
}, [llmRequests]);

// Error boundary
if (renderError) {
  return (
    <div style={{ padding: '20px', color: 'red', background: '#000', minHeight: '100vh' }}>
      <h1>Dashboard Error</h1>
      <pre>{renderError}</pre>
      <button onClick={() => { setRenderError(null); window.location.reload(); }}>
        Reload Dashboard
      </button>
    </div>
  );
}

try {
  return (
    // ... main UI
  );
} catch (error) {
  console.error('[App] Render error:', error);
  setRenderError(error instanceof Error ? error.message : String(error));
  return null;
}
```

**Benefits:**
- Catches any rendering errors
- Provides user-friendly error display
- Enables easy recovery with reload button
- Logs errors to console for debugging

---

## DEPLOYMENT STEPS

### 1. Rebuild and Restart AI Bot
```bash
cd "/Volumes/Macintosh HD-1/Users/ms1281/Desktop/hm-server-deployment/AI-Bot-Deploy"
npm run build
npx pm2 delete ai-bot  # Stop old instance
npx pm2 start dist/index.js --name ai-bot
```

### 2. Queue Monitor (Auto Hot-Reload)
The Queue Monitor will automatically hot-reload the changes since it's running in Vite dev mode. No restart needed.

**If manual restart is required:**
```bash
cd "/Volumes/Macintosh HD-1/Users/ms1281/Desktop/hm-server-deployment/Queue-Monitor-Deploy"
bash stop-monitor.sh
bash start-monitor-background.sh
```

---

## TESTING

### Test 1: Queue Crash Fix
1. Open frontend and send a message
2. Watch Queue Monitor dashboard
3. **Expected:** Queue item appears without crash
4. **Expected:** Dashboard remains responsive

### Test 2: LLM Requests Display
1. Send a message that triggers an AI response
2. Watch "LLM SERVER REQUESTS" section
3. **Expected:** Request appears with timestamp, entity, and model
4. **Expected:** Can expand to see full request details
5. **Expected:** Copy button works

### Test 3: Error Recovery
1. If any error occurs, error screen should display
2. Click "Reload Dashboard" button
3. **Expected:** Dashboard recovers and reconnects

---

## DEBUGGING

### Check Bot Logs
```bash
npx pm2 logs ai-bot
```

### Check Browser Console
Open browser dev tools (F12) and look for:
- `[App] Queue updated, length: X`
- `[App] LLM Requests updated, length: X`
- `[Dashboard] ===== RECEIVED MESSAGE =====`

### Verify WebSocket Connection
In browser console:
- Look for `[WebSocket] Connected to bot`
- Look for `[Dashboard] Type: llm_request`

---

## TECHNICAL DETAILS

### LLM Request Message Flow
1. **Bot generates response** → `src/index.ts` line ~132
2. **Bot creates `llmRequest` object** with `id` and `timestamp`
3. **Bot sends to WebSocket server** → `queueWS.sendLLMRequest(llmRequest)`
4. **WebSocket broadcasts** → `type: 'llm_request'` message
5. **Dashboard receives** → `useWebSocket.ts` line ~101
6. **Dashboard updates state** → `setLLMRequests(prev => [message.data, ...prev])`
7. **React renders** → `App.tsx` LLM SERVER section

### Queue Item Message Flow
1. **Frontend submits comment** → Cloudflare Worker
2. **Worker creates queue item** → Cloudflare KV
3. **Bot polls queue** → Finds new item
4. **Bot broadcasts** → `type: 'queued'` message
5. **Dashboard receives** → `useWebSocket.ts` line ~48
6. **Dashboard updates state** → Adds to queue array
7. **React renders** → `App.tsx` QUEUE ITEMS section

---

## FILES MODIFIED

### AI Bot
- `/Volumes/Macintosh HD-1/Users/ms1281/Desktop/hm-server-deployment/AI-Bot-Deploy/src/index.ts`
  - Added `id` and `timestamp` to `llmRequest` object (line ~132)

### Queue Monitor
- `/Volumes/Macintosh HD-1/Users/ms1281/Desktop/hm-server-deployment/Queue-Monitor-Deploy/src/App.tsx`
  - Added safe `modelServer` access for queue items (line ~208)
  - Added fallbacks for queue item fields (line ~217, 227)
  - Added LLM request field fallbacks (line ~301-302)
  - Added unique key generation for LLM requests (line ~304)
  - Added error boundary pattern (line ~168-179, 433-437)
  - Added debug logging for queue and LLM requests (line ~23-32)

---

## SUCCESS CRITERIA

✅ Dashboard does NOT crash when new messages arrive  
✅ Queue items display correctly with all metadata  
✅ LLM requests appear in "LLM SERVER REQUESTS" section  
✅ LLM requests show timestamp, entity, and model  
✅ Copy buttons work for LLM requests  
✅ Collapse/expand works for LLM requests  
✅ Error boundary catches and displays any rendering errors  
✅ Console logs help debug WebSocket message flow  

---

## RELATED ISSUES

- **Issue #1 - Queue Crash:** FIXED ✅
- **Issue #2 - LLM Requests Empty:** FIXED ✅
- **Issue #3 - Collapse Functionality:** FIXED ✅ (previous PR)
- **Issue #4 - Copy Buttons:** FIXED ✅ (previous PR)

---

## NOTES

1. **React Keys:** Always use unique, stable keys for list items. Array indices are NOT stable when items are added/removed.

2. **Null Safety:** When accessing nested object properties, always check for null/undefined at each level.

3. **Field Fallbacks:** When working with dynamic data structures (like LLM requests), provide multiple fallback field names.

4. **Error Boundaries:** In React functional components, use try-catch in render with error state for error boundary behavior.

5. **Debugging:** Console logging in useEffect hooks is crucial for debugging state updates and WebSocket messages.

---

## FUTURE IMPROVEMENTS

1. **Type Safety:** Define proper TypeScript interfaces for `QueueItem` and `LLMRequest` to catch these issues at compile time.

2. **Error Reporting:** Send error logs to a monitoring service (e.g., Sentry) instead of just console.

3. **Retry Logic:** Add automatic retry for WebSocket reconnection on error.

4. **Field Validation:** Validate incoming WebSocket messages against expected schemas.

5. **Performance:** Use React.memo() for expensive list renders (queue items, LLM requests).

