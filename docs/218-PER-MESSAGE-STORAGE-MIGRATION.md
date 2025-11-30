# 218: Per-Message Storage Migration

## Executive Summary

**Problem:** Cloudflare Durable Objects bill storage operations in 4KB increments. Our current architecture stores entire conversations as single arrays, causing costs to scale with conversation length.

**Impact:** A 150-message conversation costs **23x more per message** than a new conversation.

**Solution:** Migrate from per-conversation storage to per-message storage.

---

## Current Architecture

### Storage Structure

```
Key: "conv:{humanUsername}:{humanColor}:{aiUsername}:{aiColor}"
Value: [message1, message2, message3, ... message150]  // ENTIRE ARRAY
```

**Example:**
```javascript
Key: "conv:Human:080164205-hCkCdpLZwf:BodyScore:176208080-vph5826sjL"
Value: [
  { id: "abc123", text: "Hello", timestamp: 1732834352000, ... },
  { id: "def456", text: "Hi there", timestamp: 1732834358000, ... },
  // ... up to 150 messages
]
```

### Current Operations Per Message

When a human sends a message and bot responds:

| Operation | What Happens | Storage Calls |
|-----------|--------------|---------------|
| POST human msg | Read conv, append msg, write conv | 1 read + 1 write |
| Claim message | Read conv, update status, write conv | 1 read + 1 write |
| Complete message | Read conv, update status, write conv | 1 read + 1 write |
| POST AI response | Read conv, append msg, write conv | 1 read + 1 write |
| PATCH eqScore | Read conv, update field, write conv | 1 read + 1 write |
| **Total** | | **5 reads + 5 writes** |

### The 4KB Billing Problem

**Cloudflare's billing model:**
- Each 4KB of data = 1 billable unit
- A 24KB conversation = 6 units per read/write

**Verified data from production:**

| Conversation | Size | Messages | Reads per msg | Units per call |
|--------------|------|----------|---------------|----------------|
| ClimbLadder | 1,709 bytes | 4 | 6 | 1 |
| ConflictHelper | 24,282 bytes | 40 | 24 | 6 |

**Cost scaling:**

| Conversation Size | Data Size | Units/Call | Reads/Msg | Cost Multiplier |
|-------------------|-----------|------------|-----------|-----------------|
| 4 messages | ~2KB | 1 | 5 | 1x (baseline) |
| 40 messages | ~24KB | 6 | 30 | 6x |
| 100 messages | ~60KB | 15 | 75 | 15x |
| 150 messages | ~90KB | 23 | 115 | 23x |

---

## Proposed Architecture

### New Storage Structure

**Individual message storage:**
```
Key: "msg:{conversationId}:{messageId}"
Value: { single message object }
```

**Conversation index:**
```
Key: "idx:{conversationId}"
Value: { messageIds: ["id1", "id2", ...], metadata: {...} }
```

**Example:**
```javascript
// Conversation index
Key: "idx:Human:080164205:BodyScore:176208080"
Value: {
  messageIds: ["abc123", "def456", "ghi789"],
  humanUsername: "Human",
  humanColor: "080164205",
  aiUsername: "BodyScore", 
  aiColor: "176208080",
  createdAt: 1732834352000,
  lastMessageAt: 1732834400000,
  messageCount: 3
}

// Individual messages
Key: "msg:Human:080164205:BodyScore:176208080:abc123"
Value: {
  id: "abc123",
  text: "Hello",
  timestamp: 1732834352000,
  username: "Human",
  color: "080164205",
  "message-type": "human",
  botParams: { status: "pending", entity: "the-body-keeps-the-score", ... }
}

Key: "msg:Human:080164205:BodyScore:176208080:def456"
Value: {
  id: "def456",
  text: "Hi there",
  timestamp: 1732834358000,
  username: "BodyScore",
  color: "176208080",
  "message-type": "AI",
  replyTo: "abc123"
}
```

### New Operations Per Message

| Operation | What Happens | Storage Calls | Units |
|-----------|--------------|---------------|-------|
| POST human msg | Read index, write msg, write index | 1 read + 2 writes | 3 |
| Claim message | Read msg, write msg | 1 read + 1 write | 2 |
| Complete message | Read msg, write msg | 1 read + 1 write | 2 |
| POST AI response | Read index, write msg, write index | 1 read + 2 writes | 3 |
| PATCH eqScore | Read msg, write msg | 1 read + 1 write | 2 |
| **Total** | | **5 reads + 7 writes** | **12** |

**Note:** Slightly more writes, but each is ~600 bytes (1 unit) instead of 24KB+ (6+ units).

### Cost Comparison

| Scenario | Current (array) | New (per-message) | Savings |
|----------|-----------------|-------------------|---------|
| 4-msg conv | 5 reads × 1 unit = 5 | 5 reads × 1 unit = 5 | 0% |
| 40-msg conv | 5 reads × 6 units = 30 | 5 reads × 1 unit = 5 | **83%** |
| 100-msg conv | 5 reads × 15 units = 75 | 5 reads × 1 unit = 5 | **93%** |
| 150-msg conv | 5 reads × 23 units = 115 | 5 reads × 1 unit = 5 | **96%** |

---

## Implementation Plan

### Phase 1: New Storage Layer

**File:** `MessageQueue.js`

#### 1.1 New Helper Methods

```javascript
// Generate conversation ID from participants
getConversationId(humanUsername, humanColor, aiUsername, aiColor) {
  return `${humanUsername}:${humanColor}:${aiUsername}:${aiColor}`;
}

// Message key format
getMessageKey(conversationId, messageId) {
  return `msg:${conversationId}:${messageId}`;
}

// Index key format
getIndexKey(conversationId) {
  return `idx:${conversationId}`;
}
```

#### 1.2 New Storage Methods

```javascript
// Store single message
async storeMessage(conversationId, message) {
  const key = this.getMessageKey(conversationId, message.id);
  await this.storagePut(key, message);
}

// Get single message
async getMessage(conversationId, messageId) {
  const key = this.getMessageKey(conversationId, messageId);
  return await this.storageGet(key);
}

// Update single message (for claim, complete, patch)
async updateMessage(conversationId, messageId, updates) {
  const key = this.getMessageKey(conversationId, messageId);
  const message = await this.storageGet(key);
  if (!message) return null;
  
  const updated = { ...message, ...updates };
  await this.storagePut(key, updated);
  return updated;
}

// Get/update conversation index
async getIndex(conversationId) {
  const key = this.getIndexKey(conversationId);
  return await this.storageGet(key) || { messageIds: [], metadata: {} };
}

async updateIndex(conversationId, index) {
  const key = this.getIndexKey(conversationId);
  await this.storagePut(key, index);
}
```

### Phase 2: Update Message Operations

#### 2.1 postMessage() Changes

**Current:**
```javascript
let conversation = await this.storageGet(conversationKey) || [];
conversation.unshift(message);
// ... rolling window logic ...
await this.storagePut(conversationKey, conversation);
```

**New:**
```javascript
const conversationId = this.getConversationId(humanUsername, humanColor, aiUsername, aiColor);

// Store message individually (1 write, ~600 bytes = 1 unit)
await this.storeMessage(conversationId, message);

// Update index (1 read + 1 write, ~2KB = 1 unit each)
const index = await this.getIndex(conversationId);
index.messageIds.push(message.id);
index.metadata.lastMessageAt = message.timestamp;
index.metadata.messageCount = index.messageIds.length;

// Rolling window: keep only last 150 message IDs in index
// (Old messages stay in storage until explicit cleanup)
if (index.messageIds.length > 150) {
  index.messageIds = index.messageIds.slice(-150);
}

await this.updateIndex(conversationId, index);
```

#### 2.2 claimMessage() / claimNextMessage() Changes

**Current:**
```javascript
const conversation = await this.storageGet(conversationKey);
const msgIndex = conversation.findIndex(m => m.id === messageId);
conversation[msgIndex] = message;
await this.storagePut(conversationKey, conversation);
```

**New:**
```javascript
// Direct message update (1 read + 1 write, ~600 bytes = 1 unit each)
const updated = await this.updateMessage(conversationId, messageId, {
  botParams: {
    ...existingBotParams,
    status: 'processing',
    claimedBy: workerId,
    claimedAt: Date.now()
  }
});
```

#### 2.3 completeMessage() Changes

**Current:** Same pattern as claim - read whole conversation, update, write back.

**New:**
```javascript
await this.updateMessage(conversationId, messageId, {
  botParams: {
    ...existingBotParams,
    status: 'complete',
    completedAt: Date.now()
  }
});
```

#### 2.4 patchMessage() Changes

**Current:** Same pattern - read whole conversation, update, write back.

**New:**
```javascript
await this.updateMessage(conversationId, messageId, {
  eqScore: body.eqScore
});
```

### Phase 3: Update Query Operations

#### 3.1 getConversation() Changes

**Current:**
```javascript
const conversation = await this.storageGet(conversationKey) || [];
return conversation.slice(-limit);
```

**New:**
```javascript
const conversationId = this.getConversationId(humanUsername, humanColor, aiUsername, aiColor);
const index = await this.getIndex(conversationId);

// Get last N message IDs
const messageIds = index.messageIds.slice(-limit);

// Batch fetch messages (multiple small reads vs one large read)
const messages = await Promise.all(
  messageIds.map(id => this.getMessage(conversationId, id))
);

return messages.filter(m => m !== null);
```

**Cost analysis for getConversation():**
- Current (40 messages): 1 read × 6 units = 6 units
- New (40 messages): 1 index read + 40 message reads = 41 reads × 1 unit = 41 units

**⚠️ Trade-off:** getConversation() becomes MORE expensive with per-message storage!

**Solution:** Use batch read with `storage.get(keys)` which reads multiple keys in one operation:

```javascript
// Batch read (counts as multiple read units but single round-trip)
const messageKeys = messageIds.map(id => this.getMessageKey(conversationId, id));
const messagesMap = await this.state.storage.get(messageKeys);
const messages = Array.from(messagesMap.values());
```

### Phase 4: Bot Worker Context Fetching

#### Current Flow

1. Frontend sends `context[]` array with human message
2. Bot worker receives pre-formatted context
3. No additional DO reads needed for context

**This is already optimal!** The frontend builds context from its in-memory cache.

#### New Consideration

If bot worker needs to fetch context directly from DO (e.g., for recovery):

```javascript
// Bot worker fetches conversation context
async function fetchConversationContext(conversationId, limit = 20) {
  const response = await fetch(
    `${DO_URL}/api/conversation?` +
    `humanUsername=${encodeURIComponent(humanUsername)}&` +
    `humanColor=${encodeURIComponent(humanColor)}&` +
    `aiUsername=${encodeURIComponent(aiUsername)}&` +
    `aiColor=${encodeURIComponent(aiColor)}&` +
    `limit=${limit}`
  );
  return await response.json();
}
```

This uses the optimized `getConversation()` with batch reads.

### Phase 5: Initialize() and In-Memory Cache

#### Current initialize()

```javascript
async initialize() {
  // Load ALL conversations from storage
  const convKeys = await this.storageList({ prefix: 'conv:' });
  const conversations = await Promise.all(
    allKeys.map(key => this.storageGet(key))
  );
  
  // Flatten to all messages
  const allMessages = conversations.flat();
  
  // Build caches
  this.recentMessages = allMessages.slice(0, this.MAX_CACHE_SIZE);
  this.pendingQueue = allMessages.filter(m => m.botParams?.status === 'pending');
}
```

#### New initialize()

```javascript
async initialize() {
  // Load all indexes (small, ~2KB each)
  const indexKeys = await this.storageList({ prefix: 'idx:' });
  const indexes = await Promise.all(
    Array.from(indexKeys.keys()).map(key => this.storageGet(key))
  );
  
  // Collect all message IDs from indexes
  const allMessageIds = [];
  for (const index of indexes) {
    if (index && index.messageIds) {
      const conversationId = /* extract from index */;
      for (const msgId of index.messageIds) {
        allMessageIds.push({ conversationId, msgId });
      }
    }
  }
  
  // Batch load messages (in chunks to avoid memory issues)
  const BATCH_SIZE = 1000;
  const allMessages = [];
  
  for (let i = 0; i < allMessageIds.length; i += BATCH_SIZE) {
    const batch = allMessageIds.slice(i, i + BATCH_SIZE);
    const keys = batch.map(({ conversationId, msgId }) => 
      this.getMessageKey(conversationId, msgId)
    );
    const messagesMap = await this.state.storage.get(keys);
    allMessages.push(...Array.from(messagesMap.values()));
  }
  
  // Build caches (same as before)
  allMessages.sort((a, b) => b.timestamp - a.timestamp);
  this.recentMessages = allMessages.slice(0, this.MAX_CACHE_SIZE);
  this.pendingQueue = allMessages.filter(m => 
    m['message-type'] === 'human' && 
    m.botParams?.status === 'pending'
  );
}
```

### Phase 6: Clean Slate Deployment

**Since we're in development with no production users:**

1. Purge all existing data via `/api/admin/purge`
2. Deploy new code
3. Start fresh with per-message storage

```bash
# Purge existing data
curl -X POST https://saywhatwant-do-worker.bootloaders.workers.dev/api/admin/purge

# Deploy new code
cd saywhatwant && npx wrangler deploy --config wrangler-do.toml
```

No migration needed. No backwards compatibility needed.

---

## Rolling Window Cleanup

### Current Behavior

- Keep last 150 completed messages per conversation
- Delete older messages from array

### New Behavior

**Index rolling window:**
```javascript
// Keep last 150 message IDs in index
if (index.messageIds.length > 150) {
  const toRemove = index.messageIds.slice(0, -150);
  index.messageIds = index.messageIds.slice(-150);
  
  // Optionally delete old messages from storage
  for (const msgId of toRemove) {
    await this.storageDelete(this.getMessageKey(conversationId, msgId));
  }
}
```

**Note:** We can choose to:
1. Delete old messages immediately (saves storage cost)
2. Keep old messages (allows historical access, costs storage)

---

## God Mode Sessions

### Current

```
Key: "godmode:{humanUsername}:{humanColor}:{aiUsername}:{aiColor}:{sessionId}"
Value: [message1, message2, ...]
```

### New

```
Key: "idx:godmode:{humanUsername}:{humanColor}:{aiUsername}:{aiColor}:{sessionId}"
Value: { messageIds: [...], metadata: {...} }

Key: "msg:godmode:{conversationId}:{messageId}"
Value: { single message }
```

Same pattern, just with `godmode:` prefix.

---

## Risks and Mitigations

### Risk 1: getConversation() Cost Increase

**Problem:** Fetching 40 messages = 40 reads instead of 1.

**Mitigation:** 
- Use `storage.get(keys)` for batch reads
- Frontend already has in-memory cache
- Bot worker uses frontend-provided context

### Risk 2: Initialize() Slower

**Problem:** Loading 50K messages individually is slower than loading conversation arrays.

**Mitigation:**
- Use batch reads with `storage.get(keys)`
- Initialize happens only on DO startup (rare)
- Can parallelize batch fetches

### Risk 3: Index Corruption

**Problem:** Index could get out of sync with messages.

**Mitigation:**
- Atomic operations (index update after message write)
- Index rebuild capability if needed
- Store message metadata redundantly

---

## Success Metrics

| Metric | Current | Target | Measurement |
|--------|---------|--------|-------------|
| Cost per message (mature conv) | 115 units | 12 units | Cloudflare dashboard |
| Storage reads/write | O(n) | O(1) | Internal logging |
| Initialize time | ~500ms | ~1000ms | Console timing |
| getConversation time | ~50ms | ~100ms | Console timing |

---

## Implementation Checklist

- [ ] **Phase 1:** Add new storage helper methods
- [ ] **Phase 2:** Update postMessage() to use per-message storage
- [ ] **Phase 3:** Update claim/complete/patch to use per-message storage
- [ ] **Phase 4:** Update getConversation() with batch reads
- [ ] **Phase 5:** Update initialize() for new storage format
- [ ] **Phase 6:** Purge old data and deploy fresh
- [ ] **Phase 7:** Test and verify cost reduction

---

## References

- [Cloudflare DO Pricing](https://developers.cloudflare.com/durable-objects/platform/pricing/) - "A request unit is defined as 4 KB of data read or written"
- Doc 217: DO Storage Operations Analysis (root cause discovery)
- Doc 215: Cost Optimization (in-memory caching)

