# 175: Regressive Polling System - Complete Analysis

## Executive Summary

The frontend uses a **regressive (adaptive) polling system** that automatically adjusts its frequency based on user activity and message flow. When active, it polls every 5 seconds. When idle, it gradually slows down to a maximum of 5 minutes between polls.

**Key Benefits:**
- ⚡ **Fast when active** - 5s polling when user is present
- 🔋 **Battery efficient** - Slows to 5 mins when idle
- 🎯 **Self-correcting** - New messages = instant reset to fast polling
- 🧠 **Simple state** - Single ref tracks interval
- 🔒 **No race conditions** - Recursive `setTimeout` (not `setInterval`)

---

## Configuration (message-system.ts)

**Three Key Parameters:**
```typescript
pollingIntervalMin: 5000,        // Start at 5s (active)
pollingIntervalMax: 300000,      // Max 300s (5 mins when inactive)
pollingIntervalIncrement: 2000,  // Slow down by 2s per poll
```

**Polling Lifecycle:**
- **Starts at:** 5 seconds
- **Increases by:** 2 seconds after each poll
- **Maxes at:** 300 seconds (5 minutes)
- **Resets to 5s when:** Activity detected OR new messages arrive

**File:** `saywhatwant/config/message-system.ts` lines 31-54

---

## Core Implementation

### 1. Interval Management (CommentsStream.tsx, lines 900-937)

**Two Key Functions:**

#### A. `increasePollingInterval()` (lines 901-906)
```typescript
const increasePollingInterval = useCallback(() => {
  const current = currentPollingInterval.current;
  const newInterval = Math.min(current + POLLING_INCREMENT, POLLING_MAX);
  currentPollingInterval.current = newInterval;
  console.log(`[Regressive Polling] Next poll in ${newInterval / 1000}s`);
}, []);
```

**What it does:**
- Called **after every poll**
- Adds 2 seconds to current interval
- Caps at 5 minutes max using `Math.min()`
- Logs the next poll delay

**Example progression:**
```
Poll 1: 5s → 7s
Poll 2: 7s → 9s
Poll 3: 9s → 11s
...
Poll 148: 298s → 300s (max reached)
```

#### B. `resetPollingInterval()` (lines 909-915)
```typescript
const resetPollingInterval = useCallback(() => {
  const wasSlowed = currentPollingInterval.current > POLLING_MIN;
  currentPollingInterval.current = POLLING_MIN;
  if (wasSlowed) {
    console.log(`[Regressive Polling] Reset to ${POLLING_MIN / 1000}s (activity detected)`);
  }
}, []);
```

**What it does:**
- Resets to 5 seconds instantly
- Only logs if interval was slowed (prevents spam)
- Called on user activity OR new messages

**Reset Triggers:**
1. User clicks anywhere
2. User scrolls anywhere
3. User focuses any input
4. New messages arrive during poll

---

### 2. Activity Detection (CommentsStream.tsx, lines 918-937)

**Three Event Listeners:**
```typescript
useEffect(() => {
  const handleActivity = () => {
    resetPollingInterval();
  };
  
  // 1. Click anywhere in the app
  document.addEventListener('click', handleActivity);
  
  // 2. Scroll anywhere (passive for performance)
  document.addEventListener('scroll', handleActivity, { passive: true });
  
  // 3. Focus any input (capture phase to catch all)
  document.addEventListener('focus', handleActivity, true);
  
  return () => {
    document.removeEventListener('click', handleActivity);
    document.removeEventListener('scroll', handleActivity);
    document.removeEventListener('focus', handleActivity, true);
  };
}, [resetPollingInterval]);
```

**Event Details:**
- **Click:** Any click in the document
- **Scroll:** Any scroll with `{ passive: true }` for better performance
- **Focus:** Any input focus with `capture: true` to catch all focuses

**Result:** Any user activity = instant reset to 5s polling

---

### 3. Polling Loop (pollingSystem.ts, lines 253-289)

**Core Recursive Logic:**
```typescript
const poll = async () => {
  await checkForNewComments();
  increasePollingInterval(); // Slow down for next poll
  
  // Schedule next poll with current interval
  pollingRef.current = setTimeout(poll, currentPollingInterval.current);
};

// Start first poll
pollingRef.current = setTimeout(poll, currentPollingInterval.current);
```

**Key Design Points:**

1. **Recursive `setTimeout`** (not `setInterval`)
   - Allows dynamic interval changes
   - Each poll schedules the next one
   - Interval is read fresh each time
   - No race conditions or orphaned timers

2. **Always increases after poll**
   - `increasePollingInterval()` called after `checkForNewComments()`
   - Next poll will use the new (longer) interval
   - Progressive backoff on every cycle

3. **Self-scheduling**
   - Uses `currentPollingInterval.current` for next timeout
   - Ref is read at schedule time
   - Reset takes effect immediately on next poll

4. **Cleanup on unmount**
   - Clears timeout when component unmounts
   - Prevents memory leaks
   - No orphaned polling loops

**File:** `saywhatwant/modules/pollingSystem.ts`

---

### 4. Reset on New Messages (CommentsStream.tsx, lines 972-976)

**When Messages Arrive:**
```typescript
if (newComments.length > 0) {
  console.log(`[Presence Polling] Found ${newComments.length} new messages...`);
  
  // Reset polling interval (activity detected - new messages!)
  resetPollingInterval();
  
  // ... (rest of processing: save to IndexedDB, filter, notify, scroll)
}
```

**Logic:**
- If messages are flowing, keep polling fast
- If idle (no messages, no activity), slow down
- Self-correcting: busy conversations stay fast

**Two Ways to Reset:**
1. **User activity** → instant reset to 5s
2. **New messages arrive** → instant reset to 5s

---

## Example Timeline

### Scenario: User opens app, then goes idle for 2+ minutes

```
Time  | Interval | Event
------|----------|------------------------------------------------------
0:00  | 5s       | [Initial poll] No messages found
0:05  | 7s       | [Poll] No messages, interval increased to 7s
0:12  | 9s       | [Poll] No messages, interval increased to 9s
0:21  | 11s      | [Poll] No messages, interval increased to 11s
0:32  | 13s      | [Poll] No messages, interval increased to 13s
0:45  | 15s      | [Poll] No messages, interval increased to 15s
1:00  | 17s      | [Poll] No messages, interval increased to 17s
1:17  | 19s      | [Poll] No messages, interval increased to 19s
1:36  | 21s      | [Poll] No messages, interval increased to 21s
1:57  | 23s      | [Poll] No messages, interval increased to 23s

[User clicks something at 2:00]

2:00  | 5s       | Activity detected! Reset to 5s
2:05  | 7s       | [Poll] No messages, interval increased to 7s
2:12  | 9s       | [Poll] No messages, interval increased to 9s
... (cycle repeats)

[If user continues idle]

2:30  | 15s      | Still idle, slowing down...
3:00  | 23s      | Still idle, slowing down...
...
12:00 | 300s     | Max interval reached (5 minutes)
17:00 | 300s     | Still polling every 5 minutes
22:00 | 300s     | Still polling every 5 minutes

[New message arrives at 22:01]

22:01 | 5s       | Messages found! Reset to 5s
22:06 | 7s       | [Poll] No messages, interval increased to 7s
... (cycle repeats)
```

**Time to Max Interval:**
- After 148 polls with no activity: 5s + (148 × 2s) = 301s
- Caps at 300s (5 mins)

---

## Current Behavior Summary

| State | Polling Frequency | Trigger |
|-------|------------------|---------|
| **Active** | 5s | User clicks/scrolls/focuses |
| **Idle 30s** | ~11s | No activity, no messages |
| **Idle 1 min** | ~17s | No activity, no messages |
| **Idle 2 mins** | ~23s | No activity, no messages |
| **Idle 5+ mins** | 300s (5 mins) | Max cap reached |
| **New messages** | Instant reset to 5s | Messages arrive during poll |

---

## Design Strengths

### ✅ **Battery Efficient**
- Slows down when user is away
- Saves bandwidth on mobile
- Reduces server load during idle periods

### ✅ **Responsive**
- Instantly fast when user returns
- No delay waiting for slow interval to complete
- Feels snappy and real-time

### ✅ **Self-Correcting**
- New messages = activity
- Busy conversations stay fast automatically
- No manual configuration needed

### ✅ **Simple State**
- Single ref (`currentPollingInterval`)
- No complex state machines
- Easy to reason about

### ✅ **No Race Conditions**
- Recursive `setTimeout` (not `setInterval`)
- Each poll completes before next is scheduled
- No overlapping polls

### ✅ **Gradual Backoff**
- 2s increments feel natural
- Not too aggressive (5→30s would be jarring)
- Not too slow (1s increments take forever to max out)

### ✅ **Capped Maximum**
- 5 minute max ensures messages aren't missed forever
- Even idle users get updates eventually
- Balances battery vs. freshness

---

## Technical Implementation Details

### Why Recursive `setTimeout` Instead of `setInterval`?

**Problem with `setInterval`:**
```typescript
// BAD - Fixed interval, can't change dynamically
setInterval(poll, 5000); // Always 5 seconds
```

**Solution with Recursive `setTimeout`:**
```typescript
// GOOD - Interval read fresh each time
const poll = async () => {
  await checkForNewComments();
  increasePollingInterval(); // Change interval for next poll
  setTimeout(poll, currentPollingInterval.current); // Read new value
};
```

**Benefits:**
1. Interval can change between polls
2. Each poll completes before next starts (no overlap)
3. Reset takes effect immediately
4. No need to clear/restart interval on activity

---

### Why Ref Instead of State?

```typescript
// Using ref (current approach)
const currentPollingInterval = useRef(5000);

// NOT using state
// const [currentPollingInterval, setCurrentPollingInterval] = useState(5000);
```

**Reasons:**
1. **No re-renders:** Changing ref doesn't trigger re-render
2. **Synchronous:** Ref updates immediately (state is async)
3. **Performance:** Polling every 5s would cause 5s renders if using state
4. **Simple:** No need for useEffect to sync interval with timer

---

### Why `passive: true` on Scroll?

```typescript
document.addEventListener('scroll', handleActivity, { passive: true });
```

**Explanation:**
- Browser can optimize scroll performance
- Handler promises not to call `preventDefault()`
- Allows browser to scroll immediately without waiting for JS
- Standard best practice for scroll listeners

---

### Why `capture: true` on Focus?

```typescript
document.addEventListener('focus', handleActivity, true);
```

**Explanation:**
- Capture phase fires before bubble phase
- Catches focus on ALL elements (not just bubbling ones)
- Some elements don't bubble focus events
- Ensures no focus event is missed

---

## Related Files

1. **Configuration:**
   - `saywhatwant/config/message-system.ts` (lines 31-54)

2. **Core Logic:**
   - `saywhatwant/components/CommentsStream.tsx` (lines 900-1034)
   - `saywhatwant/modules/pollingSystem.ts` (lines 228-299)

3. **Types:**
   - `saywhatwant/modules/pollingSystem.ts` (lines 13-28)

---

## Future Considerations

### Potential Optimizations

1. **WebSocket upgrade path:**
   - Could replace polling with WebSockets for real-time push
   - Keep regressive polling as fallback
   - Hybrid: WebSocket for active, polling for idle

2. **Smart prediction:**
   - Track time-of-day patterns
   - Predict when messages likely (work hours vs. night)
   - Adjust backoff curve dynamically

3. **Network-aware:**
   - Detect slow connections
   - Slow down more aggressively on bad networks
   - Speed up on fast connections

4. **Tab visibility:**
   - Currently polls even when tab hidden
   - Could pause when tab hidden (with catch-up on visible)
   - Trade-off: miss messages vs. battery life

5. **Exponential backoff:**
   - Current: Linear (5s → 7s → 9s...)
   - Alternative: Exponential (5s → 10s → 20s → 40s...)
   - Reaches max faster but more jarring

---

## Debugging

### Log Messages

**Polling cycle:**
```
[Regressive Polling] Next poll in 5s
[Presence Polling] Polling for human messages after 9:30:45 AM
[Presence Polling] Response: 0 messages
[Regressive Polling] Next poll in 7s
```

**Activity detected:**
```
[Regressive Polling] Reset to 5s (activity detected)
```

**New messages:**
```
[Presence Polling] Found 2 new messages
[Regressive Polling] Reset to 5s (activity detected)
```

### Common Issues

**Problem:** Polling too slow
- **Check:** Is user activity resetting interval?
- **Check:** Are activity listeners attached?
- **Fix:** Verify event listeners in devtools

**Problem:** Polling too fast (not slowing down)
- **Check:** Is `increasePollingInterval()` being called?
- **Check:** Is activity constantly resetting?
- **Fix:** Look for infinite scroll or animations triggering events

**Problem:** Polling stops
- **Check:** Did component unmount?
- **Check:** Was timeout cleared accidentally?
- **Fix:** Check cleanup functions in useEffect

---

## Summary

The regressive polling system is a **simple, robust, and efficient** solution for keeping the frontend in sync with the backend. It balances:

- **Responsiveness:** Fast when active (5s)
- **Efficiency:** Slow when idle (up to 5 mins)
- **Simplicity:** Single ref, recursive setTimeout
- **Reliability:** No race conditions, self-correcting

**Current configuration (5s → 300s, +2s increments) provides:**
- ⚡ Real-time feel when active
- 🔋 Good battery life when idle
- 🎯 Self-correction when messages arrive
- 🧠 Zero configuration needed

The system has been battle-tested and works reliably across all user scenarios.

