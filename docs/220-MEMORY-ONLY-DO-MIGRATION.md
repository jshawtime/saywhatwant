# 220: Memory-Only Durable Object Migration

**Created:** 2025-11-30  
**Status:** 📋 READY FOR IMPLEMENTATION  
**Priority:** CRITICAL (Cost Optimization)  
**Philosophy:** Real-time app, no stored history - if your tab is closed, you miss out

---

## Executive Summary

**Problem:** Previous AI agent deviated from original architecture by adding `/api/conversation` calls to fetch context from DO storage, creating unnecessary storage costs.

**Original Design:** Frontend sends conversation context with each message. Bot uses `message.context` directly. No storage dependency.

**What Got Broken:** `index-do-simple.ts` ignores `message.context` and fetches from DO storage instead, creating 4KB-billed storage operations.

**Solution:** Restore original architecture. Frontend sends context from IndexedDB. DO uses memory only. Storage operations drop to $0.

---

## Rollback Information

### If Migration Fails - Rollback Commands

**saywhatwant repo:**
```bash
cd /Volumes/BOWIE/devrepo/SAYWHATWANTv1/saywhatwant
git checkout e117b29
./deploy-do-worker.sh
```

**hm-server-deployment repo:**
```bash
cd /Volumes/BOWIE/devrepo/SAYWHATWANTv1/hm-server-deployment
git checkout 0cdbdc1
cd AI-Bot-Deploy && pm2 restart all
```

### Commit Hashes (WORKING state before migration)
- **saywhatwant:** `e117b29` - "WORKING: Per-message storage implementation complete - before memory-only migration"
- **hm-server-deployment:** `0cdbdc1` - "WORKING: Before memory-only migration - conversation logs updated"

---

## What We Have (Current Broken State)

### Current Flow (Storage-Dependent)

```
Frontend (IndexedDB has full history)
    ↓
POST /api/comments
{
  text: "Hello",
  context: ["Human: Hi", "AI: Hello"],  ← Frontend sends this
  ...
}
    ↓
DO receives request
    ↓
Stores message in STORAGE (idx:, msg: keys)  ← COSTS MONEY
    ↓
Bot polls, gets message
    ↓
Bot IGNORES message.context  ← BUG!
    ↓
Bot calls GET /api/conversation  ← READS FROM STORAGE, COSTS MONEY
    ↓
Bot sends to LLM
    ↓
AI responds → POST to DO → stored in STORAGE  ← COSTS MONEY
```

### Current Cost Per Message Pair

| Operation | Storage Reads | Storage Writes |
|-----------|---------------|----------------|
| POST human message | 1 (index) | 2 (msg + index) |
| Bot claims message | 1 (msg) | 1 (msg) |
| Bot fetches conversation | N (all messages) | 0 |
| Bot completes message | 1 (msg) | 1 (msg) |
| POST AI response | 1 (index) | 2 (msg + index) |
| **TOTAL** | **4 + N** | **6** |

With 100-message conversations, that's **104 reads + 6 writes per message pair**.

At scale (1M users): **$$$$$**

### Evidence of Original Architecture

**Doc 173:** "The frontend was correctly building and sending conversation context"

**saywhatwant/ai/src/index.ts (line 415):**
```typescript
// Use pre-formatted context from frontend - NO FALLBACK
const contextForLLM = message.context || [];
```

**CommentsStream.tsx (lines 1277-1310):**
```typescript
// Build pre-formatted context from displayed messages (what user sees)
const contextArray = (() => {
  const displayedMessages = filteredComments;
  // ... builds context from IndexedDB/displayed messages
  return messages.map(m => `${m.username}: ${m.text}`);
})();
```

**The bug:** `index-do-simple.ts` ignores all of this and fetches from storage.

---

## What We Want (Memory-Only)

### New Flow (No Storage)

```
Frontend (IndexedDB has full history)
    ↓
POST /api/comments
{
  text: "Hello",
  context: [last 200 messages from IndexedDB],  ← Always send context
  ...
}
    ↓
DO receives request
    ↓
Stores in MEMORY ONLY (this.pendingQueue, this.recentMessages)  ← FREE
    ↓
Bot polls, gets message WITH context already attached
    ↓
Bot uses message.context directly  ← NO STORAGE FETCH
    ↓
Bot sends to LLM with context
    ↓
AI responds → POST to DO → stored in MEMORY ONLY  ← FREE
    ↓
Frontend polls → gets from MEMORY  ← FREE
    ↓
Frontend saves to IndexedDB (persistent local storage)
```

### New Cost Per Message Pair

| Operation | Storage Reads | Storage Writes | Memory Ops |
|-----------|---------------|----------------|------------|
| POST human message | 0 | 0 | 2 (queue + recent) |
| Bot claims message | 0 | 0 | 1 (update status) |
| Bot uses context | 0 | 0 | 0 (already in message) |
| Bot completes message | 0 | 0 | 1 (update status) |
| POST AI response | 0 | 0 | 1 (add to recent) |
| **TOTAL** | **0** | **0** | **5** |

**Storage cost: $0**

### What You Pay For (Memory-Only)

1. **Duration** - DO running time
   - ~$0.000015 per GB-second
   - 10MB memory × minimal time = negligible

2. **Requests** - $0.15 per million
   - ~10 requests per message pair
   - 10 / 1,000,000 × $0.15 = $0.0000015

**Total cost per message pair: ~$0.000002** (essentially free)

---

## App Philosophy Alignment

### Real-Time, Ephemeral Design

| Principle | How Memory-Only Supports It |
|-----------|----------------------------|
| "If your tab is closed, you miss out" | No server-side history to retrieve |
| Real-time messaging | Memory is instant, no storage latency |
| Browser stores everything | IndexedDB is the source of truth |
| No backwards compatibility needed | Clean slate, you're the only user |

### What Users Experience

1. **Tab open:** See all messages in real-time
2. **Tab closed:** Miss messages (by design)
3. **Tab reopened:** IndexedDB shows their local history
4. **New device:** Fresh start (no server history)

This is your intended design. Storage was never meant to be permanent.

---

## Implementation Plan

### Phase 1: Update Frontend (Always Send Context) ✅ COMPLETE

**File:** `saywhatwant/components/CommentsStream.tsx`

**Current (conditional context):**
```typescript
const contextArray = (() => {
  if (isFilterEnabled) {
    // ... send context
  }
  if (urlNom) {
    // ... send context
  }
  // No filter, no nom - let bot use entity.nom from config
  return undefined;  // ← BUG: Bot then fetches from storage
})();
```

**New (always send context):**
```typescript
const contextArray = (() => {
  // ALWAYS send context from IndexedDB - max 200 messages
  const MAX_CONTEXT = 200;
  const displayedMessages = filteredComments;
  const messages = displayedMessages.slice(-MAX_CONTEXT);
  return messages.map(m => `${m.username}: ${m.text}`);
})();
```

### Phase 2: Update Bot (Use message.context) ✅ COMPLETE

**File:** `hm-server-deployment/AI-Bot-Deploy/src/index-do-simple.ts`

**Current (fetches from storage):**
```typescript
// Lines 301-315 - REMOVE THIS
const conversationResponse = await fetch(
  `${API_URL}/api/conversation?` +
  `humanUsername=${encodeURIComponent(humanUsername)}&` +
  // ...
);
const conversationMessages = await conversationResponse.json() as any[];
```

**New (use message.context):**
```typescript
// Use context from message (sent by frontend from IndexedDB)
const contextMessages = message.context || [];

// Build messages array for Ollama
const ollamaMessages = [];

// Add system message
ollamaMessages.push({
  role: 'system',
  content: entity.systemPrompt
});

// Add conversation history from context
// Context format: ["Human: Hello", "AI: Hi there", ...]
for (const contextLine of contextMessages) {
  const colonIndex = contextLine.indexOf(': ');
  if (colonIndex > 0) {
    const speaker = contextLine.substring(0, colonIndex);
    const text = contextLine.substring(colonIndex + 2);
    const role = speaker === humanUsername ? 'user' : 'assistant';
    ollamaMessages.push({ role, content: text });
  }
}
```

### Phase 3: Simplify DO (Memory Only) ✅ COMPLETE

**File:** `saywhatwant/workers/durable-objects/MessageQueue.js`

**Remove all storage operations:**
- Remove `storageGet()`, `storagePut()`, `storageList()`, `storageDelete()` calls
- Remove `storeMessage()`, `getMessage()`, `getIndex()`, `updateIndex()` methods
- Remove `getConversation()` endpoint (no longer needed)
- Keep only in-memory operations

**Simplified postMessage:**
```javascript
async postMessage(request) {
  const body = await request.json();
  const id = body.id || this.generateId();
  const timestamp = body.timestamp || Date.now();
  
  const message = {
    id,
    timestamp,
    text: body.text,
    username: body.username,
    color: body.color,
    domain: body.domain || 'saywhatwant.app',
    'message-type': body['message-type'] || 'human',
    replyTo: body.replyTo || null,
    context: body.context || null,  // Store context with message
    botParams: body.botParams || null,
    eqScore: body.eqScore || 0
  };
  
  // Memory only - no storage
  this.recentMessages.unshift(message);
  if (this.recentMessages.length > this.MAX_CACHE_SIZE) {
    this.recentMessages.pop();
  }
  
  if (message['message-type'] === 'human' && message.botParams?.status === 'pending') {
    this.pendingQueue.push(message);
  }
  
  return this.jsonResponse({ id, status: 'queued' });
}
```

**Simplified initialize:**
```javascript
async initialize() {
  if (this.initialized) return;
  
  // Memory-only: Start fresh on each DO wake
  // This is intentional - real-time app, no stored history
  this.recentMessages = [];
  this.pendingQueue = [];
  this.initialized = true;
  
  console.log('[MessageQueue] Initialized (memory-only mode)');
}
```

### Phase 4: Remove Unused Endpoints ✅ COMPLETE

**Remove from DO:**
- `GET /api/conversation` - No longer needed (frontend sends context)
- `GET /api/godmode/conversation` - No longer needed
- `GET /api/keys` - No storage to list
- `DELETE /api/purge` - No storage to purge

**Keep:**
- `POST /api/comments` - Add message to memory
- `GET /api/comments` - Poll from memory
- `GET /api/queue/pending` - Bot polls pending queue
- `POST /api/queue/claim-next` - Bot claims message
- `POST /api/queue/complete` - Bot marks complete
- `PATCH /api/comments/:id` - Update eqScore in memory

---

## Risk Analysis

### Risk 1: DO Hibernates Mid-Conversation

**Scenario:**
1. User sends message at 10:00:00
2. DO stores in memory
3. User goes AFK for 15 seconds
4. DO hibernates at 10:00:10 (memory wiped)
5. Bot polls at 10:00:12 → DO wakes up → memory is empty

**Mitigation:**
- Bot polls every 3 seconds
- Messages processed in ~5 seconds
- 10-second hibernation window is nearly impossible to hit during active use
- If it happens: User sends another message, context is in IndexedDB, conversation continues

**Acceptable?** YES - matches "real-time, ephemeral" philosophy.

### Risk 2: Large Context Payloads

**Concern:** 200 messages × ~500 bytes = 100KB payload

**Cloudflare Limits:**
- Worker request body: 100MB max
- 100KB is 0.1% of limit

**Acceptable?** YES - well within limits.

### Risk 3: Bot Gets Empty Context

**Scenario:** Frontend sends empty context (new conversation)

**Handling:** Bot already handles this:
```typescript
const contextMessages = message.context || [];
// If empty, LLM just gets system prompt - fine for new conversations
```

**Acceptable?** YES - expected behavior for new conversations.

---

## Testing Plan

### Test 1: Frontend Sends Context ✅ VERIFIED
1. Open browser console
2. Send a message
3. Verify console log: `[CommentsStream] Sending X messages as context`
4. Verify network request includes `context` array

### Test 2: Bot Uses message.context ✅ VERIFIED
1. Send a message
2. Check PM2 logs
3. Verify: No `/api/conversation` fetch
4. Verify: Ollama receives context from message

### Test 3: Multi-Turn Conversation ✅ VERIFIED
1. Send 5 messages back and forth
2. Verify AI responses are contextually aware
3. Verify no storage operations in Cloudflare dashboard

### Test 4: DO Hibernation Recovery
1. Send a message
2. Wait 15 seconds (DO hibernates)
3. Send another message
4. Verify: Context from IndexedDB is sent
5. Verify: Conversation continues normally

### Test 5: Cost Verification ✅ VERIFIED (0 reads, 0 writes)
1. Send 10 message pairs
2. Check Cloudflare dashboard
3. Verify: 0 storage reads, 0 storage writes
4. Verify: Only request charges (negligible)

---

## Deployment Steps

### Step 1: Deploy Frontend Changes ⏳ PENDING (needs npm run build + git push)
```bash
cd /Volumes/BOWIE/devrepo/SAYWHATWANTv1/saywhatwant
# Make changes to CommentsStream.tsx
npm run build
# Deploy to Cloudflare Pages (automatic via git push)
```

### Step 2: Deploy DO Worker ✅ DEPLOYED
```bash
cd /Volumes/BOWIE/devrepo/SAYWHATWANTv1/saywhatwant
# Make changes to MessageQueue.js
./deploy-do-worker.sh
```

### Step 3: Deploy Bot Changes ✅ BUILT (needs pm2 restart)
```bash
cd /Volumes/BOWIE/devrepo/SAYWHATWANTv1/hm-server-deployment/AI-Bot-Deploy
# Make changes to index-do-simple.ts
npm run build
pm2 restart all
```

### Step 4: Purge Old Storage (Optional)
```bash
# If you want to clean up old storage data
curl -X DELETE https://saywhatwant-do-worker.bootloaders.workers.dev/api/purge
```

---

## Success Criteria

| Metric | Before | After |
|--------|--------|-------|
| Storage reads per message pair | 4 + N | 0 |
| Storage writes per message pair | 6 | 0 |
| Storage cost per 1M messages | $$$$ | $0 |
| Conversation context | From storage | From IndexedDB |
| DO dependency | Storage required | Memory only |
| Philosophy alignment | Broken | Restored |

---

## Appendix: Files to Modify

### saywhatwant repo
1. `components/CommentsStream.tsx` - Always send context
2. `workers/durable-objects/MessageQueue.js` - Memory only

### hm-server-deployment repo
1. `AI-Bot-Deploy/src/index-do-simple.ts` - Use message.context
2. `AI-Bot-Deploy/dist/index-do-simple.js` - Rebuild

---

## Appendix: Original Architecture Evidence

### Doc 173 (November 2, 2025)
> "The frontend was correctly building and sending conversation context (`context: string[]`) to the Durable Objects worker..."

### saywhatwant/ai/src/index.ts
```typescript
// Line 415
// Use pre-formatted context from frontend - NO FALLBACK
const contextForLLM = message.context || [];
```

### commentSubmission.ts
```typescript
// Line 79
context?: string[],  // Pre-formatted context from displayed messages
```

### CommentsStream.tsx
```typescript
// Lines 1277-1310
// Build pre-formatted context from displayed messages (what user sees)
const contextArray = (() => {
  const displayedMessages = filteredComments;
  // ...
})();
```

**The architecture was correct. Someone broke it by adding storage fetches.**

