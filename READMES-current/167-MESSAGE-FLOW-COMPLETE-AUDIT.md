# 167: Complete Message Flow Audit

**Date**: 2025-11-01  
**Status**: INVESTIGATING 9/14 FAILURE RATE (64% success)  
**Previous**: 60/60 success (100%)

## Problem Statement

System is experiencing message delivery failures:
- **Current**: 9/14 messages successfully delivered (64%)
- **Previous**: 60/60 messages successfully delivered (100%)
- **Symptom**: Human posts message → AI bot never processes it → No AI reply on frontend
- **Observable**: PM2 logs show `[KVr:3 KVw:1]` constantly, indicating Worker finds 2 ghost messages in cache repeatedly

## Complete Message Flow

### 1. Human Posts Message

**Location**: Frontend (`CommentsStream.tsx`)

```
User types message → handleSubmit()
  ↓
POST /api/comments
  body: { text, username, color, domain, message-type: "human", ... }
```

**Key Code**: `saywhatwant/components/CommentsStream.tsx`

---

### 2. Worker Receives POST

**Location**: `saywhatwant/workers/comments-worker.js`

```
handlePostComment(request, env)
  ↓
1. Generate messageId: `${timestamp}-${randomId}`
2. Create message object with botParams:
   {
     status: 'pending',        // Initially pending for bot
     priority: 5,              // Default priority
     processed: false,
     entity: (extracted from domain or defaults to 'default')
   }
3. Store in KV:
   - Key: `comment:${messageId}`
   - Value: JSON.stringify(message)
4. Update cache:
   - Read `recent:comments` (contains last 200 messages)
   - Prepend new message
   - Trim to 200 messages
   - Write back to `recent:comments`
5. Return response with messageId
```

**Key Operations**:
- **KV Write**: `comment:${messageId}` → Individual message
- **KV Read**: `recent:comments` → Cache
- **KV Write**: `recent:comments` → Updated cache

**Critical**: Cache update is NOT atomic with message write!

---

### 3. Frontend Polling Detects Message

**Location**: Frontend (`CommentsStream.tsx`)

```
useEffect polling (every 1s when active)
  ↓
GET /api/comments?since=${lastFetch}
  ↓
Worker returns messages from recent:comments cache where timestamp > since
  ↓
Frontend renders message immediately
```

**Race Condition Potential**: If cache update fails/delays, frontend won't see message even though it's in KV.

---

### 4. PM2 Bot Polls for Pending

**Location**: `hm-server-deployment/AI-Bot-Deploy/src/index-simple.ts`

```
Every 3 seconds:
  ↓
GET /api/queue/pending?limit=10
  ↓
Worker: handleGetPending(env, url)
```

**Worker Logic** (`comments-worker.js` lines 908-1045):

```javascript
handleGetPending(env, url) {
  1. Read cache: `recent:comments`
     - KVr: 1
  
  2. Filter for messages where status === 'pending'
  
  3. For each pending message:
     - Read actual KV: `comment:${msg.id}`  
     - KVr: +1 per message
     - SELF-HEALING: If cache status ≠ actual status:
       * Update cache in-memory
       * Mark cacheNeedsUpdate = true
     - If actual status === 'pending':
       * Add to allMessages[]
  
  4. If cacheNeedsUpdate:
     - Write updated cache back
     - KVw: 1
  
  5. Sort by priority (desc), then timestamp (asc)
  
  6. Return top N messages
}
```

**KV Operations**:
- **Best case** (0 pending): KVr:1, KVw:0
- **Normal case** (2 pending with stale cache): KVr:3 (1 cache + 2 verifies), KVw:1
- **Current issue**: Every poll shows KVr:3, KVw:1 → 2 ghost messages stuck in cache as "pending"

---

### 5. PM2 Bot Claims Message

**Location**: `hm-server-deployment/AI-Bot-Deploy/src/index-simple.ts`

```
For each pending message from step 4:
  ↓
POST /api/queue/claim
  body: { messageId, workerId: SERVER_ID }
```

**Worker Logic** (`comments-worker.js` lines 1051-1143):

```javascript
handleClaimMessage(request, env) {
  1. Read message: `comment:${messageId}`
     - KVr: 1
  
  2. Verify status === 'pending'
     - If not pending → return 409 Conflict
  
  3. Update status to 'processing':
     message.botParams.status = 'processing'
     message.botParams.claimedBy = workerId
     message.botParams.claimedAt = Date.now()
  
  4. Write message back
     - KVw: 1
  
  5. Update cache (NON-ATOMIC):
     - Read recent:comments
     - Find and update message
     - Write back
  
  6. Return success with message data
}
```

**Race Condition Potential**: If multiple PM2 instances poll simultaneously, both could see "pending" and try to claim. The first write wins, second gets 409 Conflict.

---

### 6. PM2 Bot Generates AI Response

**Location**: `hm-server-deployment/AI-Bot-Deploy/src/index-simple.ts`

```
generateResponse(humanMessage, entity)
  ↓
Uses Ollama API to generate response
  ↓
Applies filtering (filterOut, trimAfter, trimWhitespace)
  ↓
Returns filtered text
```

**No KV operations** - pure computation.

---

### 7. PM2 Bot Posts AI Response

**Location**: `hm-server-deployment/AI-Bot-Deploy/src/index-simple.ts`

```
postAIResponse(text, humanMessage, entity)
  ↓
POST /api/comments
  body: {
    text: filteredText,
    username: entity.username,
    color: entity.color,
    domain: 'saywhatwant.app',
    message-type: 'AI',
    replyTo: humanMessage.id  // Links to human message
  }
```

**Worker processes this exactly like step 2**:
- Creates new messageId for AI response
- Stores in KV
- Updates cache
- **Does NOT update human message status yet**

**Critical Gap**: Human message is still `status: 'processing'` at this point!

---

### 8. PM2 Bot Marks Complete

**Location**: `hm-server-deployment/AI-Bot-Deploy/src/index-simple.ts`

```
After successful AI post:
  ↓
POST /api/queue/complete
  body: { messageId: humanMessage.id }
```

**Worker Logic**:

```javascript
handleCompleteMessage(request, env) {
  1. Read human message: `comment:${messageId}`
     - KVr: 1
  
  2. Verify status === 'processing'
  
  3. Update status to 'complete':
     message.botParams.status = 'complete'
     message.botParams.processed = true
     message.botParams.completedAt = Date.now()
  
  4. Write message back
     - KVw: 1
  
  5. Update cache (NON-ATOMIC):
     - Read recent:comments
     - Find and update message
     - Write back
  
  6. Return success
}
```

---

### 9. Frontend Sees AI Response

**Location**: Frontend (`CommentsStream.tsx`)

```
Polling loop (step 3) fetches new messages
  ↓
Sees AI response with replyTo: humanMessageId
  ↓
Renders AI response below human message
```

---

### 10. Frontend Self-Healing

**Location**: Frontend (`CommentsStream.tsx`)

```
Every 30 seconds:
  ↓
For each human message without AI reply:
  - If age > 30 seconds:
    - Check if message exists in KV: GET /api/comments/${messageId}
    - If found in KV but not in local state:
      - Trigger full refetch
    - Log to console
```

**Purpose**: Catch messages that were posted to KV but missed by polling (cache race condition).

---

## Key Failure Points

### A. Cache Update Failures

**Symptoms**:
- PM2 never sees message in `/api/queue/pending`
- Frontend self-heal finds message in KV
- KVr:1 (only cache read, no verification reads)

**Cause**: Message written to KV but cache update failed.

**Fix**: Worker's `handleGetPending` should fall back to scanning actual KV if cache is stale (NOT IMPLEMENTED).

---

### B. Stale Cache Ghost Messages

**Symptoms**:
- KVr:3 KVw:1 on every poll
- Worker keeps finding same 2 messages as "pending" in cache
- Worker verifies them, finds they're actually "complete"
- Worker updates cache, but next poll shows same issue

**Cause**: Cache write in step 4 is failing or being overwritten.

**Theories**:
1. Multiple PM2 instances writing conflicting cache updates
2. Cache writes timing out
3. Cache being regenerated from stale source

**Current State**: This is happening RIGHT NOW (as of 2025-11-01 19:59).

---

### C. Claim Race Condition

**Symptoms**:
- PM2 logs show "Message not pending" or 409 Conflict errors
- Multiple bots try to claim same message

**Cause**: Multiple PM2 instances polling simultaneously.

**Mitigation**: 409 Conflict is handled gracefully, bot moves to next message.

---

### D. Frontend Cache Race

**Symptoms**:
- User posts message
- Message doesn't appear in frontend
- Hard refresh shows message

**Cause**: POST returns success but cache update fails, so next GET doesn't include the message.

**Mitigation**: Frontend self-healing (step 10) catches this after 30s.

---

## Critical Questions

1. **Why KVr:3 KVw:1 constantly?**
   - Worker finds 2 messages in cache as "pending"
   - Verifies them (2 extra reads = 3 total)
   - Finds they're actually "complete"
   - Updates cache (1 write)
   - **BUT**: Next poll, same 2 messages are "pending" in cache again!
   - **Question**: Why isn't the cache write sticking?

2. **Why 9/14 failure rate?**
   - Are messages getting written to KV? (Need to verify)
   - Are messages making it to cache? (Need to verify)
   - Are messages being claimed but never completed? (Need to check processing status)
   - Are AI responses being posted but not linked correctly?

3. **Is there one PM2 instance or multiple?**
   - Multiple instances could cause cache thrashing
   - Need to verify: `pm2 list`

4. **What are the 2 ghost messages?**
   - Need their IDs
   - Need to check their actual status in KV
   - Need to understand why Worker keeps seeing them as "pending"

---

## Investigation Plan

### Step 1: Identify Ghost Messages

```bash
# Check PM2 logs for which messages are being verified repeatedly
npx pm2 logs ai-bot-simple --lines 100 --nostream | grep "Self-heal"
```

### Step 2: Check Actual KV Status

```bash
# For each ghost message ID:
curl "https://sww-comments.bootloaders.workers.dev/api/comments/${messageId}"
# Check botParams.status
```

### Step 3: Verify PM2 Instance Count

```bash
npx pm2 list
# Should show only 1 instance of ai-bot-simple
```

### Step 4: Test Message Flow

```bash
# Post test message
# Monitor PM2 logs
# Check if bot sees it in /api/queue/pending
# Track through claim → process → complete
```

### Step 5: Audit Cache Consistency

```bash
# Get cache
curl "https://sww-comments.bootloaders.workers.dev/api/comments?limit=200"
# For each message, verify status matches actual KV
```

---

## Next Steps

1. ✅ Roll back all changes (DONE - system restored to working state)
2. 🔄 **CURRENT**: Investigate KVr:3 ghost message issue
3. ⏳ Test 14 messages again to see if failure persists
4. ⏳ If failure persists, investigate message flow bottleneck
5. ⏳ Consider disabling Worker's self-healing to see if cache thrashing stops

---

## Related READMEs

- `164-QUEUE-CACHE-VERIFICATION-ISSUE.md` - Previous cache verification debugging
- `156-DEBUG-WORKFLOW-COPY-VERBOSE.md` - Debug workflow for message failures
- `152-QUEUE-PM2-ARCHITECTURE-REDESIGN.md` - Queue system architecture
- `146-MESSAGE-FLOW-END-TO-END-AUDIT.md` - Previous message flow audit

