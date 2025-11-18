# Queue Monitor: Dashboard Crash & LLM Request Display Fix

**Date:** October 22, 2025  
**Related READMEs:** 137-QUEUE-MONITOR-ON-10.0.0.100.md, 138-QUEUE-MONITOR-VERTICAL-LAYOUT.md  
**Status:** ✅ COMPLETED  
**Final Resolution:** Duplicate PM2 processes + React hooks violations + CSS mapping issues

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

---

## ADDITIONAL DASHBOARD FIXES (COMPLETED AFTER INITIAL FIXES)

### Fix 5: CSS Not Connected - Complete Overhaul
**Problem:** Editing `global.css` had no effect. Changes to colors/font sizes didn't appear in the dashboard.

**Root Causes:**
1. **Inline styles everywhere** - 100+ inline `style={{}}` objects with hardcoded hex colors bypassing CSS
2. **CSS variables not used** - Beautiful variable system created but never referenced
3. **Duplicate PM2 processes** - Two ai-bot processes running (one from old location, one from new), causing duplicate LLM requests
4. **Wrong CSS classes** - Dashboard used `.pm2-title` but developer edited `.pm2-log-entry` (unused class)
5. **Old CSS file conflict** - `terminal.module.css` had `:global(body) { background: #000000; }` overriding global.css

**Solutions:**
1. **Removed ALL inline styles** from App.tsx - Converted to CSS classes
2. **Removed ALL unused CSS classes** - Deleted 600+ lines of orphaned styles  
3. **Killed duplicate PM2 process** - `npx pm2 delete 0` (old location)
4. **Created CSS class mapping doc** - Lists exactly which classes are used where
5. **Removed terminal.module.css import** - Eliminated conflicting styles

**Result:** CSS file went from 1172 lines to 488 lines of ONLY used classes. Every color and font size now controllable via `global.css`.

### Fix 6: Copy Buttons Not Working
**Problem:** Copy buttons didn't copy to clipboard. No visual feedback.

**Root Cause:** `navigator.clipboard` API unavailable on HTTP (only works on HTTPS or localhost). Dashboard accessed via `http://10.0.0.100:5174` doesn't have clipboard access.

**Solution:**
```typescript
// Fallback copy method for HTTP contexts
const textArea = document.createElement('textarea');
textArea.value = text;
textArea.style.position = 'fixed';
textArea.style.left = '-999999px';
document.body.appendChild(textArea);
textArea.select();
document.execCommand('copy'); // Old-school but works on HTTP
document.body.removeChild(textArea);
```

**Result:** ✅ All copy buttons now work and show "COPIED!" feedback for 3 seconds

### Fix 7: Collapsible Sections Not Working
**Problem:** Clicking chevrons did nothing. Sections wouldn't collapse/expand.

**Root Cause:** `ResizableSection` component accepted `isCollapsed` and `onToggleCollapse` props, but App.tsx wasn't passing them.

**Solution:** Added collapse state management to App.tsx:
```typescript
const [collapsedSections, setCollapsedSections] = React.useState<Set<string>>(new Set());

const toggleSection = (sectionId: string, collapsed: boolean) => {
  setCollapsedSections(prev => {
    const next = new Set(prev);
    if (collapsed) next.add(sectionId);
    else next.delete(sectionId);
    return next;
  });
};

// Then pass to each section:
isCollapsed={collapsedSections.has('section-id')}
onToggleCollapse={toggleSection}
```

**Result:** ✅ All 6 sections now collapse/expand on click

### Fix 8: Collapsed State Not Persisting
**Problem:** Refreshing the dashboard reset all collapsed/expanded states.

**Solution:** Added localStorage persistence:
```typescript
// Load on mount
const [collapsedSections, setCollapsedSections] = React.useState<Set<string>>(() => {
  const saved = localStorage.getItem('collapsedSections');
  if (saved) return new Set(JSON.parse(saved));
  return new Set();
});

// Save on change
React.useEffect(() => {
  localStorage.setItem('collapsedSections', JSON.stringify(Array.from(collapsedSections)));
}, [collapsedSections]);
```

**Result:** ✅ Collapse states persist across page refreshes

### Fix 9: LLM Request Expand/Collapse Required Multiple Clicks
**Problem:** Clicking an LLM request to expand it sometimes required 3 clicks before it would show.

**Root Cause:** Used array index for tracking expanded state. When new LLM requests arrived and were prepended to the array, all indices shifted, causing state confusion.

**Solution:** Changed from index-based to ID-based tracking:
```typescript
// OLD - Breaks when array changes
const [expandedRequests, setExpandedRequests] = React.useState<Set<number>>(new Set());
const isExpanded = expandedRequests.has(idx);
onClick={() => toggleRequest(idx)}

// NEW - Stable across array changes
const [expandedRequests, setExpandedRequests] = React.useState<Set<string>>(new Set());
const uniqueKey = req.id || req.timestamp || `llm-${idx}`;
const isExpanded = expandedRequests.has(uniqueKey);
onClick={() => toggleRequest(uniqueKey)}
```

**Result:** ✅ Single click reliably expands/collapses LLM requests

### Fix 10: React Hooks Error ("Rendered more hooks than previous render")
**Problem:** Dashboard crashed with "Rendered more hooks than during the previous render" when new LLM requests arrived.

**Root Cause:** Used `React.useMemo()` INSIDE the `.map()` loop, violating React's Rules of Hooks (hook count must be consistent).

**Solution:** Moved processing outside the render loop:
```typescript
// Create ONE useMemo outside map (consistent hook count)
const llmRequestsData = React.useMemo(() => {
  return llmRequests.map((req, idx) => {
    const timestamp = req.timestamp ? new Date(req.timestamp).toLocaleTimeString() : 'No timestamp';
    // ... process all data
    return { uniqueKey, timestamp, model, entity, ... };
  });
}, [llmRequests]);

// Then render using processed data (NO hooks in map)
llmRequestsData.map((data) => { ... })
```

**Result:** ✅ No more hooks errors, timestamps stay static

### Fix 11: Animations Causing Perceived Lag
**Problem:** Font size/color changes appeared delayed or not to work. Dashboard felt sluggish.

**Root Cause:** Multiple CSS transitions and animations:
- `transition: all 3s ease-out` on expandable titles (3 second delay!)
- `animation: highlightNew 3s` on new items
- `animation: blink 1s infinite` on disconnected status
- `transition: transform 0.2s` on chevrons
- Multiple other `transition: all 0.2s` throughout

**Solution:** Removed ALL animations and transitions from dashboard:
```css
/* BEFORE */
.expandable-title {
  transition: all 3s ease-out;  /* ← 3 SECOND DELAY! */
}

/* AFTER */
.expandable-title {
  /* No transitions - instant updates */
}
```

**Result:** ✅ All CSS changes apply instantly, dashboard feels responsive

### Fix 12: Duplicate PM2 Processes (THE ROOT CAUSE)
**Problem:** Every LLM request appeared twice. Timestamps showed "No timestamp".

**Root Cause Discovery:**
```bash
npx pm2 list
# Showed TWO ai-bot processes:
# ID 0: /Users/ms1281/Desktop/AI-Bot-Deploy/dist/index.js (OLD)
# ID 1: /Users/ms1281/Desktop/hm-server-deployment/AI-Bot-Deploy/dist/index.js (NEW)
```

Both were:
- Polling the same Cloudflare KV
- Processing the same messages
- Sending WebSocket messages to the dashboard
- Running simultaneously (one had new code with id/timestamp, one had old code without)

**Solution:**
```bash
npx pm2 delete 0  # Kill old process
npx pm2 delete 1  # Kill new process
npx pm2 start dist/index.js --name ai-bot  # Start ONE from correct location
```

**Result:** ✅ No more duplicates, timestamps work correctly, only one bot processing messages

---

## FINAL ARCHITECTURE

### What's Working Now:
1. ✅ **Vertical collapsible layout** - 6 sections, click to collapse, drag to resize
2. ✅ **CSS fully connected** - All colors/sizes controlled by `global.css`
3. ✅ **CSS hot-reload** - Changes appear within 1-2 seconds (usePolling: true)
4. ✅ **Copy buttons** - All working with visual feedback (HTTP fallback method)
5. ✅ **Collapse state persistence** - localStorage saves collapsed sections across refresh
6. ✅ **LLM requests display** - With timestamps, entity, model info
7. ✅ **No duplicates** - Only ONE PM2 process running
8. ✅ **No crashes** - Safe property access throughout
9. ✅ **No animations** - Instant response to all changes
10. ✅ **Server badges** - Ollama (blue) vs LM Studio (orange) with IPs

### Key Files:
- **AI-Bot-Deploy/src/index.ts** - Adds id/timestamp to LLM requests
- **Queue-Monitor-Deploy/src/App.tsx** - Safe rendering, error boundary, state management
- **Queue-Monitor-Deploy/src/global.css** - Clean 488-line stylesheet
- **Queue-Monitor-Deploy/src/components/ResizableSection.tsx** - Collapsible/resizable sections
- **Queue-Monitor-Deploy/src/hooks/useWebSocket.ts** - Deduplication, debug logging

### Deployment Repo Created:
A separate git repository was created at `/Volumes/BOWIE/devrepo/SAYWHATWANTv1/hm-server-deployment/` containing:
- AI-Bot-Deploy/ (195 files)
- Queue-Monitor-Deploy/ (all source + scripts)
- ollama-HM/ (96 Modelfiles + scripts)
- Complete `.gitignore` (excludes node_modules, dist, logs)
- Comprehensive README

**Ready to push to private GitHub repo for cloud backup.**

---

## LESSONS LEARNED

1. **Check PM2 list FIRST** - Multiple processes cause mysterious duplicates
2. **Inline styles defeat CSS** - Use classes, not inline styles
3. **CSS variables require CSS classes** - Can't apply to inline styles
4. **React Rules of Hooks** - Never use hooks inside loops/conditionals
5. **Array indices are unstable** - Use unique IDs for React keys
6. **HTTP ≠ HTTPS** - Clipboard API requires secure context
7. **Remove animations from dashboards** - They cause perceived lag
8. **Hot-reload needs polling** - usePolling: true for remote/SSH editing
9. **Delete unused CSS** - Makes debugging 10x easier
10. **Document CSS class mapping** - Prevents editing wrong classes

---

**Status:** PRODUCTION READY ✅  
**Queue Monitor URL:** http://10.0.0.100:5174  
**All Systems Operational**

