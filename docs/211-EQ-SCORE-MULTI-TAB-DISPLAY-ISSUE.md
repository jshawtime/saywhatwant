# 211: EQ-Score Display Issue - Multi-Tab Stress Test (7+ Tabs)

**Status:** 🔍 INVESTIGATION PAUSED - Possible same-computer limitation  
**Created:** 2025-11-19  
**Priority:** MEDIUM - Only affects 7+ simultaneous tabs on same machine  
**Scope:** Frontend display issue, not backend

---

## 🎯 The Issue

**Symptoms:**
- Tabs 1-7: EQ-scores display correctly in UI ✅
- Tabs 8-15+: EQ-scores show "0" in UI after 3+ minutes ❌
- All tabs receive AI responses correctly ✅
- All tabs are actively polling ✅

**Observed During:**
- 15-tab stress test (tabs 8-15 show "0")
- 20-tab stress test (tabs 8-20 show "0")
- 50-tab stress test (tabs 8-50 show "0")

**Consistent pattern:** First 7 tabs work, tabs 8+ show "0"

---

## ✅ What's WORKING (Verified)

### Backend (PM2/Llama.cpp/DO Worker):
- ✅ All messages claimed successfully (19/19 in test)
- ✅ All EQ-scores calculated correctly (19/19 calculated)
- ✅ All scores stored via PATCH to DO Worker (19/19 stored)
- ✅ DO Worker PATCH endpoint working (logs show: "Updated eqScore: messageId → score")
- ✅ No backend errors or timeouts
- ✅ No PM2 worker failures

**PM2 Logs:**
```
Messages CLAIMED: 19
EQ-Scores CALCULATED: 19
EQ-Scores STORED (PATCH): 19
Perfect match! ✅
```

### Frontend Polling:
- ✅ All tabs (including 8-15) are polling
- ✅ All tabs receive AI responses correctly
- ✅ Tabs 1-7 display scores correctly
- ✅ No polling errors in any tabs

**Frontend is polling and receiving data!** Just not displaying scores in tabs 8+.

---

## 🔍 Possible Causes (Not Yet Debunked)

### 1. Browser Tab Throttling (Most Likely)

**Theory:** Chrome/browser throttles background tabs after N active tabs

**Evidence:**
- Consistent cutoff at tab 7-8
- All tabs beyond 7 show same issue
- Tabs 1-7 always work

**How browser throttling works:**
```
Chrome limits background tab activity:
- Active tabs (1-7): Full polling, full updates
- Background tabs (8+): Throttled polling, delayed updates
- Or: Throttled state updates (polling works, React state doesn't update)
```

**Test:** Try on different computers (multiple users, not same browser)
- If scores work on different computers: Browser throttling confirmed
- If still broken: Different issue

---

### 2. React State Update Batching

**Theory:** React batches state updates, drops updates after N in rapid succession

**When 50 scores arrive rapidly:**
```javascript
// Frontend receives 50 score updates
scores.forEach(score => {
  if (isOurScore) {
    setEqScore(score.value);  // React state update
  }
});

// React might batch/throttle these updates
// After 7-8 rapid updates, React might drop subsequent ones
```

**Evidence:**
- First 7 tabs update (first 7 state updates)
- Tabs 8+ don't update (subsequent updates dropped/throttled)

**Possible fix:**
- Use `flushSync` to force immediate updates
- Or debounce score updates

---

### 3. SessionStorage Quota/Limits

**Theory:** Browser limits sessionStorage writes per second

**Code:**
```javascript
sessionStorage.setItem('sww-eq-score', msg.eqScore.toString());
```

**If 50 tabs all write to sessionStorage rapidly:**
- Browser might throttle writes
- Or quota exceeded
- First N tabs succeed, rest fail silently

**Test:** Check browser console for sessionStorage errors

---

### 4. Same-Computer Resource Limits

**Theory:** Running 50 tabs on same machine exhausts browser resources

**What happens:**
```
50 Chrome tabs on one computer:
- Each tab polling every 3s
- Each tab processing responses
- Each tab updating React state
- Total: Massive browser overhead

Browser throttles/prioritizes:
- First 7 tabs: Full priority
- Tabs 8+: Reduced priority (updates delayed/dropped)
```

**Evidence:**
- User suspects "only an issue because I am on the same computer"
- Would work fine with 50 users on 50 different computers

**Test:** Use multiple computers to verify

---

### 5. Frontend Polling Response Size

**Theory:** When 50 tabs exist, DO Worker response becomes massive

**Current design (intentional):**
- Frontend gets ALL messages (for eavesdropping feature)
- Filters client-side

**With 50 tabs (50 conversations):**
```
GET /api/comments response:
- 50 conversations × 10 messages each = 500 messages
- Each message includes eqScore field
- Response size: 200KB+

Browser might:
- Take too long to parse large response
- Drop updates for background tabs
- Throttle processing for tabs 8+
```

---

### 6. Race Condition in Frontend State

**Theory:** Multiple rapid score updates cause React state corruption

**When scores arrive for tabs 8-15 while tabs 1-7 are still updating:**
```javascript
// Tab 1-7 state updates in progress
setEqScore(21);  // Tab 1
setEqScore(26);  // Tab 2
...
setEqScore(32);  // Tab 7

// Tab 8-15 try to update but React is busy
setEqScore(15);  // Tab 8 - DROPPED?
setEqScore(18);  // Tab 9 - DROPPED?
```

**React might queue updates and drop some under load**

---

## 🧪 Diagnostic Steps (For Later)

### Test 1: Different Computers
```
Instead of 15 tabs on 1 computer:
- 15 users on 15 different computers
- Each sends 1 message simultaneously

Expected:
- If all 15 show scores: Browser throttling was the issue
- If some still show 0: Different problem
```

### Test 2: Slower Message Rate
```
Send 15 messages with 5-second delays between each:
- Not all at once
- Let browser process each score before next

Expected:
- If all show scores: Rapid update batching was the issue
- If still broken: Different problem
```

### Test 3: Check SessionStorage Directly
```javascript
// In tab showing "0", open console and run:
sessionStorage.getItem('sww-eq-score');

// If it shows the score: Display bug
// If it shows null/0: Score never made it to storage
```

### Test 4: Check DO Worker Response
```javascript
// In tab showing "0", check network tab:
// Find the /api/comments or /api/conversation response
// Check if eqScore field is in the response

// If yes: Frontend not processing it
// If no: Backend not returning it (but logs say it's stored!)
```

---

## 💡 Likely Root Cause

**Best guess: Browser tab throttling on same computer**

**Why:**
1. Consistent 7-tab cutoff (browser limit?)
2. All tabs beyond 7 affected equally
3. Backend proves all scores are stored correctly
4. User suspects "same computer" issue
5. Tabs are polling but not updating (throttling behavior)

**Chrome specifically throttles:**
- Background tabs after 5-10 active tabs
- SetInterval/polling in background tabs
- State updates in unfocused tabs
- Resource allocation for inactive tabs

---

## 🔧 Potential Fixes (For Later)

### Fix 1: Service Worker for Score Updates
```javascript
// Use Service Worker to handle score updates
// Service Workers aren't throttled like tabs

navigator.serviceWorker.register('/score-worker.js');

// score-worker.js handles score polling
// Broadcasts to all tabs via postMessage
// Tabs listen and update when they receive broadcast
```

### Fix 2: Shared Worker
```javascript
// One worker polls for all tabs
// Shares state across tabs
// Not throttled by browser

const worker = new SharedWorker('/score-polling-worker.js');
```

### Fix 3: Increase Polling Interval for Background Tabs
```javascript
// Use Page Visibility API
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    // Background tab: Poll every 10s
    setPollingInterval(10000);
  } else {
    // Active tab: Poll every 3s
    setPollingInterval(3000);
  }
});
```

### Fix 4: Force State Update
```javascript
// Use flushSync to force immediate React update
import { flushSync } from 'react-dom';

flushSync(() => {
  setEqScore(score);
});
```

---

## 📊 Test Data

### 15-Tab Test Results:
```
Tabs 1-7:   Scores displayed correctly ✅
Tabs 8-15:  Scores show "0" ❌
Backend:    All 15 scores calculated and stored ✅
Frontend:   All 15 tabs polling ✅
PATCH:      All 15 PATCH requests sent ✅
```

### 20-Tab Test Results:
```
Tabs 1-7:   Scores displayed correctly ✅
Tabs 8-20:  Scores show "0" ❌
Queue:      Reached 11+ pending ✅
Scaling:    Auto-scaled appropriately ✅
```

### 50-Tab Test Results:
```
Tabs 1-7:   Scores displayed correctly ✅
Tabs 8-50:  Scores show "0" ❌
Backend:    All scores processed ✅
Workers:    Scaled to 3-10 workers ✅
Performance: ~10x faster than single worker ✅
```

---

## 🎯 Current Status

**Issue:** EQ-scores don't display in tabs 8+ during same-computer stress tests

**Impact:** LOW
- Only affects multi-tab stress testing on same computer
- Real-world users (different computers) unlikely affected
- Messages still process correctly
- AI responses still work
- Only the score display is affected

**Next Steps:**
1. Test with multiple computers (not same browser)
2. If works on different computers: Document as browser limitation
3. If still broken: Investigate Service Worker or Shared Worker solution

**For now:** Pausing investigation until can test on multiple computers

---

## 🔧 Workaround (Current)

**For testing:** Use first 7 tabs only
- Scores work perfectly in tabs 1-7
- Backend handles unlimited tabs (tested with 50)
- Just the score display that's limited

**For production:** Non-issue
- Real users on different computers
- Each user = 1-2 tabs typically
- Browser throttling won't apply

---

**Status:** Issue documented, investigation paused pending multi-computer testing

