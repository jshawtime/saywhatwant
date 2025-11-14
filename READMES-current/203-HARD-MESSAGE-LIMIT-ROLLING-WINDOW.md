# 203: Hard Message Limit - True Rolling Window

**Status:** 📋 PLANNING - Fix growing message limit  
**Created:** 2025-11-13  
**Priority:** MEDIUM - Performance degradation with >1000 messages  
**Problem:** Message limit grows with lazy loading, causing UI slowdown

---

## 🎯 The Problem

### Current Behavior (Growing Limit):

**Initial state:**
```
maxMessages = 1000 (from config)
Messages displayed: 308
UI: Responsive ✅
```

**After lazy loading 50 messages:**
```typescript
const newMax = initialMax + newLoadedCount + 50;
// newMax = 1000 + 50 + 50 = 1100
setMaxMessages(1100);
```

**After lazy loading 100 more:**
```
maxMessages = 1000 + 150 + 50 = 1200
Messages displayed: 308 (current)
But limit allows: 1200
```

**After extensive lazy loading:**
```
maxMessages = 1000 + 500 + 50 = 1550
Messages displayed: 308+
UI: Starts to slow down ⚠️
```

**The limit keeps growing and NEVER resets!**

---

### Impact:

**Performance degradation:**
- More messages in DOM = slower rendering
- More messages to filter = slower updates  
- More messages to scroll = slower scrolling
- Memory usage increases

**User reported:**
```
Current state: 308 messages displayed
Feels less responsive
Limit has grown beyond 1000
```

---

## 🎯 What We Want

### Hard Rolling Window (Fixed Limit):

**Always maintain exactly N messages (default 1000):**

```
Initial: 1000 messages (newest)
Lazy load 50: Still 1000 messages (drop 50 oldest, add 50 older)
Lazy load 50 more: Still 1000 messages (drop 50 oldest, add 50 older)
```

**When new messages arrive via polling:**
```
Current: 1000 messages
New messages: 5
Total would be: 1005
Action: Drop 5 oldest messages
Result: Still 1000 messages (newest 1000)
```

**Benefits:**
- ✅ Consistent performance (always 1000 messages max)
- ✅ Predictable memory usage
- ✅ Faster rendering
- ✅ True rolling window

---

## 🏗️ Implementation Plan

### Step 1: Remove Growing Limit Logic

**File:** `saywhatwant/hooks/useMessageLoadingState.ts`

**Current (line 155):**
```typescript
const newMax = initialMax + newLoadedCount + 50; // GROWS!
setMaxMessages(newMax);
```

**New:**
```typescript
// Keep limit fixed at initialMax (true rolling window)
// Don't increase limit when lazy loading
console.log(`[LoadingState] Keeping hard limit at ${initialMax} messages`);
// setMaxMessages stays at initialMax
```

---

### Step 2: Enforce Hard Limit When Adding Messages

**File:** `saywhatwant/components/CommentsStream.tsx`

**Current (line 779):**
```typescript
const trimmed = messages.slice(-dynamicMaxMessages);
// Uses dynamic limit (which grows)
```

**Already correct!** This trims to whatever the limit is.

**But ensure limit never grows:**
- Don't call `setMaxMessages` with values > initialMax
- Always trim to fixed 1000

---

### Step 3: Trim After Lazy Loading

**Current lazy load behavior:**
```typescript
// Load 50 more messages
// Increase limit to fit them
// Show all messages (1050 total)
```

**New lazy load behavior:**
```typescript
// Load 50 more messages
// Merge with existing
// Trim to keep newest 1000
// Drop 50 newest (which just arrived at top)
```

**Wait - that's wrong!** When lazy loading, we want to show OLDER messages at the TOP!

**Actually, the current behavior might be intentional:**
- User wants to see history (lazy load)
- Limit grows to accommodate
- They can scroll back through time

**But you said it's causing performance issues...**

---

## 🤔 Design Decision Needed

### Option A: Hard 1000 Limit (What You Requested)

**Lazy loading:**
- Load 50 older messages
- Total = 1050
- Drop 50 NEWEST messages (at bottom)
- Keep 1000 (oldest 950 from before + 50 new old ones)

**Problem:** You lose recent messages to see old ones!

---

### Option B: Hard 1000 Limit + Don't Allow Lazy Load Beyond It

**Lazy loading:**
- Can only lazy load if total < 1000
- If at 1000: "Can't load more without dropping recent messages"

**Problem:** Can't see full history

---

### Option C: Separate Limits for Lazy vs New

**Two limits:**
- Forward limit: Always keep newest 500
- Backward limit: Can load up to 500 old
- Total max: 1000

**Lazy load:**
- Can load 500 older messages
- Never drops recent messages
- Total stays at 1000

---

### Option D: Reset Limit on Page Load

**Current session:**
- Limit can grow to accommodate user's exploration
- Performance impact accepted

**Next page load:**
- Reset to 1000
- Fresh start

---

## 💡 My Recommendation: Option D + Periodic Trim

**During session:**
- Allow limit to grow as user lazy loads (current behavior)
- But add periodic trimming

**Periodic trim (every 5 minutes):**
```typescript
// If limit has grown beyond 1000
if (messages.length > 1000) {
  // Trim to newest 1000
  const trimmed = messages.slice(-1000);
  setMessages(trimmed);
  setMaxMessages(1000); // Reset limit
  console.log('[Trim] Periodic trim: Reset to 1000 messages');
}
```

**Benefits:**
- ✅ User can lazy load and explore
- ✅ Performance recovers after 5 min
- ✅ Doesn't interrupt active reading
- ✅ Simple to implement

---

## 📊 Your Current Situation

**Console shows:**
```
Total messages in storage: 5052
found 308 total matches, returning 308
```

**You have 308 messages displayed (under 1000 limit).**

**But you said UI feels slow?**

**Possible causes:**
1. The 5052 messages in IndexedDB (full scan is slow)
2. The 308 filtered messages are complex to render
3. Something else is causing slowdown

**Question:** Is it the 308 displayed messages that feel slow, or the filtering/scanning of 5052 total messages?

---

## 🔧 Quick Fix (If Problem is Display Count)

**Reduce hard limit from 1000 to 500:**

**File:** `saywhatwant/config/message-system.ts`

```typescript
maxDisplayMessages: 500,  // Was 1000
```

**This would:**
- ✅ Faster rendering (fewer DOM nodes)
- ✅ Less memory
- ✅ More responsive UI
- ⚠️ Less history visible

---

## 🧪 Testing

**To verify limit is enforced:**

1. Check current message count: Browser console should show count
2. Lazy load multiple times
3. Check count again - should stay at limit
4. New messages arrive - count should stay at limit (drop oldest)

---

**What approach do you prefer? Hard limit? Periodic trim? Lower limit?**


