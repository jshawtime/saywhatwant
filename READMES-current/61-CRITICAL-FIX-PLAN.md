# 🚨 CRITICAL FIX PLAN - Duplicate Processing & Queue Monitor

**Date**: October 7, 2025 - 9:25 PM  
**Status**: URGENT - Bot processing same messages repeatedly  
**Priority**: CRITICAL

---

## Issue 1: Bot Re-Processing Old Messages ❌ CRITICAL

### The Problem

**Current behavior:**
```
Human posts: "Hello" → Bot queues it, responds
Human posts: "How are you?" → Bot queues BOTH messages, responds twice
Human posts: "What's up?" → Bot queues ALL THREE messages, responds 3 times
```

**PM2 logs show:**
```
[QUEUE] Queued 7 new messages, skipped 93 duplicates
```

Bot is queueing 7 messages when user only posted 1!

### Root Cause

**Bot code (ai/src/index.ts line 274-416):**
```typescript
for (const message of messages) {
  // Skip if already processed
  if (processedMessageIds.has(message.id)) {
    skipped++;
    continue;
  }
  
  // Queue the message
  await queueService.enqueue(queueItem);
  processedMessageIds.add(message.id);
}
```

**Problem:** `processedMessageIds` is in-memory Set that resets when PM2 restarts.

After restart, bot sees all old messages as "new" and queues them all.

### The Fix

**Option A: Only process messages with botParams (filtered conversations)**

Bot should ONLY queue messages that have `botParams` AND are newer than last poll.

**Option B: Track last processed timestamp**

Store `lastProcessedTimestamp` and only queue messages after that.

**Option C: Only process latest message**

When user posts, only the NEWEST message should trigger bot response.

### Recommendation: Option C (Simplest)

**Change:**
```typescript
// OLD: Queue ALL messages
for (const message of messages) {
  await queueService.enqueue(message);
}

// NEW: Only queue LATEST message (if it has botParams)
const latestMessage = messages[messages.length - 1];
if (latestMessage && latestMessage.botParams && !processedMessageIds.has(latestMessage.id)) {
  await queueService.enqueue(latestMessage);
  processedMessageIds.add(latestMessage.id);
}
```

---

## Issue 2: Queue Monitor Offline ❌

### The Problem

Queue monitor shows "OFFLINE" even though WebSocket is working.

### Root Cause

Queue monitor expects connection but something's misconfigured.

### The Fix

**Add PM2 control buttons:**
- Start PM2 bot
- Stop PM2 bot
- Restart PM2 bot
- Show connection status

**Check WebSocket connection:**
- Monitor connects to `ws://localhost:4002`
- Show READY when connected
- Show actual queue stats

---

## Issue 3: URL Documentation ❌

### Create Central Reference

**File:** `READMES-current/00-URLS.md`

```markdown
# System URLs

## Production
- **Main App:** https://saywhatwant.app
- **Analytics:** https://saywhatwant.app/analytics.html
- **Worker API:** https://sww-comments.bootloaders.workers.dev/api/comments

## Development
- **Main App:** http://localhost:3000
- **Queue Monitor:** http://localhost:5173
- **WebSocket:** ws://localhost:4002 (backend only)

## Bot Management
- **PM2 Status:** `pm2 list`
- **PM2 Logs:** `pm2 logs ai-bot`
- **Restart:** `pm2 restart ai-bot`
```

---

## Implementation Plan

### Step 1: Fix Duplicate Processing (CRITICAL)

**File:** `ai/src/index.ts`

**Current (line 274-416):** Queues all messages with botParams

**New:** Only queue LATEST message

```typescript
// After fetching messages
if (messages.length > 0) {
  if (USE_QUEUE && queueService) {
    // Only process LATEST message
    const latestMessage = messages[messages.length - 1];
    
    // Check if it's new and has botParams
    if (!processedMessageIds.has(latestMessage.id)) {
      const botParams = latestMessage.botParams || {};
      
      // Select entity
      let entity;
      if (botParams.entity) {
        entity = fullConfig.entities.find((e: any) => e.id === botParams.entity);
        if (!entity) {
          console.warn('Entity not found, using random');
          entity = entityManager.selectRandomEntity();
        }
      } else {
        entity = entityManager.selectRandomEntity();
      }
      
      // Check rate limits
      const rateLimitCheck = entityManager.checkRateLimits(entity.id);
      if (!rateLimitCheck.allowed) {
        console.log(`Skipping: ${rateLimitCheck.reason}`);
      } else {
        // Determine priority
        const priority = botParams.priority !== undefined 
          ? Math.max(0, Math.min(99, botParams.priority))
          : (entity.defaultPriority || 50);
        
        // Use context from message if present
        const contextForLLM = latestMessage.context || 
          messages.slice(-(entity.nom || 100)).map(m => `${m.username}: ${m.text}`);
        
        // Queue the message
        await queueService.enqueue({
          id: `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          priority,
          timestamp: Date.now(),
          message: latestMessage,
          context: contextForLLM,
          entity,
          model: botParams.model || entity.model,
          routerReason: buildRouterReason(latestMessage, botParams, priority),
          maxRetries: QUEUE_MAX_RETRIES
        });
        
        processedMessageIds.add(latestMessage.id);
        
        console.log(`[QUEUE] Queued latest message: ${latestMessage.username} (priority ${priority})`);
      }
    }
  }
}
```

**This ensures:** Only newest message triggers ONE bot response.

---

### Step 2: Add PM2 Controls to Queue Monitor

**File:** `dashboards/queue-monitor/src/App.tsx`

Add buttons in SYSTEM STATUS section:

```tsx
<button onClick={handlePM2Start}>Start PM2</button>
<button onClick={handlePM2Stop}>Stop PM2</button>
<button onClick={handlePM2Restart}>Restart PM2</button>
```

**Implementation:**
```typescript
const handlePM2Start = async () => {
  try {
    const response = await fetch('/api/pm2/start', { method: 'POST' });
    const result = await response.json();
    alert(result.message);
  } catch (error) {
    alert('Failed to start PM2');
  }
};
```

**Backend API:**
- Create `/api/pm2/start` endpoint
- Executes `pm2 start ai-bot`
- Returns status

---

### Step 3: Fix WebSocket Status Display

**File:** `dashboards/queue-monitor/src/App.tsx`

**Current:** Shows "OFFLINE" always

**Fix:** Actually check WebSocket connection state

```typescript
const [wsStatus, setWsStatus] = useState<'READY' | 'OFFLINE'>('OFFLINE');

useEffect(() => {
  if (ws && ws.readyState === WebSocket.OPEN) {
    setWsStatus('READY');
  } else {
    setWsStatus('OFFLINE');
  }
}, [ws]);
```

---

### Step 4: Create URLs Reference

**File:** `READMES-current/00-SYSTEM-URLS.md`

Complete reference of all URLs and how to access everything.

---

## Testing After Fix

### Expected Behavior

**Test:** Post 3 messages in filtered conversation

**Should see:**
```
You: "Hello"
Bot: [Response 1]
You: "How are you?"
Bot: [Response 2]
You: "What's up?"
Bot: [Response 3]
```

**NOT:**
```
You: "Hello"
Bot: [Response 1]
You: "How are you?"
Bot: [Response 1 AGAIN]
Bot: [Response 2]
Bot: [Response 2 AGAIN]
```

---

## Success Criteria

- [ ] Bot processes only latest message
- [ ] No duplicate responses
- [ ] PM2 control buttons work
- [ ] Queue monitor shows READY
- [ ] All URLs documented
- [ ] Filtered conversations work smoothly

---

**This is the final critical fix needed for production readiness.**


