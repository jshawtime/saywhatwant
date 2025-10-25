# 150-REGRESSIVE-POLLING-SYSTEM.md

**Tags:** #polling #regressive #adaptive #performance #power-saving  
**Created:** October 25, 2025  
**Status:** 🔄 READY TO IMPLEMENT

---

## Executive Summary

Implements adaptive regressive polling that starts at 5 seconds and gradually slows to 100 seconds max when inactive, resetting to 5 seconds immediately when activity occurs (user posts OR new messages received). Reduces server load during inactive periods while maintaining instant responsiveness when active.

**Impact:** 95% reduction in polling requests during inactive periods, instant reset to fast polling on activity, scalable and power-efficient.

---

## The Concept

### Current Fixed Polling
```
Poll every 5 seconds forever
→ 12 polls/minute
→ 720 polls/hour
→ 17,280 polls/day
(Even when user is idle for hours!)
```

### New Regressive Polling
```
Active conversation:
  Poll 1: 5s
  Poll 2: 5s (user posts) → RESET
  Poll 3: 5s
  Poll 4: 5s (new message) → RESET
  Poll 5: 5s
  
Inactive (no activity):
  Poll 1: 5s
  Poll 2: 6s
  Poll 3: 7s
  ...
  Poll 95: 99s
  Poll 96+: 100s (max)
  
(User posts OR new message arrives)
  → RESET to 5s immediately!
```

---

## Configuration

### New Config in `message-system.ts`

```typescript
export interface MessageSystemConfig {
  // ... existing fields ...
  
  // Regressive Polling Settings
  pollingIntervalMin: number;      // Starting interval (5000ms)
  pollingIntervalMax: number;      // Maximum interval (100000ms)  
  pollingIntervalIncrement: number; // Increase per poll (1000ms)
}

export const MESSAGE_SYSTEM_CONFIG: MessageSystemConfig = {
  // ... existing settings ...
  
  // Regressive Polling
  pollingIntervalMin: 5000,     // Start at 5 seconds
  pollingIntervalMax: 100000,   // Max 100 seconds
  pollingIntervalIncrement: 1000, // Increase 1 second per poll
};
```

### Remove Old Config

**File:** `/Volumes/Macintosh HD-1/Users/ms1281/Desktop/hm-server-deployment/AI-Bot-Deploy/config-aientities.json`

**Remove:**
```json
"botSettings": {
  "pollingInterval": 3000,  ← DELETE THIS
  ...
}
```

**PM2 bot doesn't need polling interval config** - it's separate from frontend!

---

## Implementation

### 1. Track Current Interval

```typescript
// In CommentsStream.tsx
const currentPollingInterval = useRef(MESSAGE_SYSTEM_CONFIG.pollingIntervalMin);
```

### 2. Increase After Each Poll

```typescript
// After polling completes
const increaseInterval = () => {
  const current = currentPollingInterval.current;
  const increment = MESSAGE_SYSTEM_CONFIG.pollingIntervalIncrement;
  const max = MESSAGE_SYSTEM_CONFIG.pollingIntervalMax;
  
  currentPollingInterval.current = Math.min(current + increment, max);
  
  console.log(`[Regressive Polling] Next poll in ${currentPollingInterval.current / 1000}s`);
};
```

### 3. Reset on Activity

```typescript
// Reset function
const resetPollingInterval = () => {
  currentPollingInterval.current = MESSAGE_SYSTEM_CONFIG.pollingIntervalMin;
  console.log(`[Regressive Polling] Reset to ${currentPollingInterval.current / 1000}s`);
};

// Call when user posts message
handleSubmit() {
  // ... post logic ...
  resetPollingInterval();
}

// Call when new messages received
if (newMessages.length > 0) {
  resetPollingInterval();
}
```

### 4. Use Dynamic Interval in Polling

```typescript
// In pollingSystem.ts or CommentsStream
setInterval(() => {
  checkForNewComments();
  increaseInterval(); // Slow down for next poll
}, currentPollingInterval.current); // Use current value
```

**Wait - setInterval uses fixed value!**

Need to use **recursive setTimeout** instead:

```typescript
const poll = () => {
  checkForNewComments().then(() => {
    increaseInterval();
    setTimeout(poll, currentPollingInterval.current); // Dynamic!
  });
};

// Start polling
setTimeout(poll, currentPollingInterval.current);
```

---

## Benefits

### Power Saving
**Inactive for 1 hour:**
- Fixed polling: 720 requests
- Regressive polling: ~60 requests (after reaching max 100s)
- **92% reduction!**

### Server Load
**1000 users, 80% inactive:**
- Fixed: 1000 × 12 polls/min = 12,000 req/min
- Regressive: 200 active × 12 + 800 inactive × 0.6 = 2,400 + 480 = 2,880 req/min
- **76% reduction!**

### Responsiveness
- Active users: 5-second polls (instant feel!)
- Returns to activity: Immediate reset to 5s
- No perceived lag

---

## Files to Modify

### 1. `config/message-system.ts`
- Add `pollingIntervalMin`, `pollingIntervalMax`, `pollingIntervalIncrement`

### 2. `components/CommentsStream.tsx`
- Add `currentPollingInterval` ref
- Add `increaseInterval()` function
- Add `resetPollingInterval()` function  
- Call reset on user post
- Call reset on new messages received

### 3. `modules/pollingSystem.ts`
- Change from `setInterval` to recursive `setTimeout`
- Accept dynamic interval via ref or callback

### 4. PM2 Bot Config (10.0.0.100)
- Remove `pollingInterval` from `config-aientities.json` botSettings
- PM2 bot keeps fixed 3-second polling (different system)

---

## Edge Cases

**Q: What if interval changes while setTimeout is waiting?**  
**A:** Next poll uses new interval - graceful

**Q: What if user posts multiple messages rapidly?**  
**A:** Interval resets to 5s on each post - stays fast

**Q: What if messages arrive but filter rejects them?**  
**A:** Still counts as activity, resets interval - correct behavior

**Q: What if tab backgrounded?**  
**A:** Browser throttles setTimeout - acceptable, resets on return

---

## Status

**Date:** October 25, 2025  
**Status:** Specification complete, ready to implement  
**Impact:** 92% reduction in polling during inactive periods  
**Complexity:** Low - simple recursive setTimeout  
**Risk:** Very low - graceful fallback behavior

---

**This implements intelligent adaptive polling that conserves resources during inactivity while maintaining instant responsiveness during active conversations.**

