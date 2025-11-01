# 168: Message Flow System Architecture

**Date**: 2025-11-01  
**Purpose**: Pure structural analysis of message flow - no issue investigation

---

## System Flow Tree

```
HUMAN POSTS MESSAGE
│
├─→ Frontend: POST /api/comments
│   └─→ Worker: handlePostComment()
│       ├─→ Generate messageId (timestamp-random)
│       ├─→ KV Write: comment:{id} = message object
│       │   └─→ message.botParams.status = 'pending'
│       ├─→ KV Read: recent:comments (cache)
│       ├─→ KV Write: recent:comments (prepend new message, trim to 200)
│       └─→ Return: { id, timestamp }
│
├─→ Frontend: Poll every 1s
│   └─→ GET /api/comments?since={lastFetch}
│       └─→ Worker: Filter recent:comments cache by timestamp
│           └─→ Frontend renders human message
│
└─→ PM2 Bot: Poll every 3s
    └─→ GET /api/queue/pending
        └─→ Worker: handleGetPending()
            ├─→ KV Read: recent:comments
            ├─→ Filter where status='pending'
            ├─→ For each pending:
            │   └─→ KV Read: comment:{id} (verify actual status)
            ├─→ Return: pending messages
            │
            └─→ PM2: For first pending message:
                ├─→ POST /api/queue/claim
                │   └─→ Worker: handleClaimMessage()
                │       ├─→ KV Read: comment:{id}
                │       ├─→ Verify status='pending'
                │       ├─→ Set status='processing'
                │       ├─→ KV Write: comment:{id}
                │       └─→ KV Update: recent:comments cache
                │
                ├─→ PM2: Generate AI response via Ollama
                │
                ├─→ PM2: POST /api/comments (AI message)
                │   └─→ Worker: handlePostComment()
                │       ├─→ Generate new messageId for AI
                │       ├─→ message.replyTo = humanMessageId
                │       ├─→ KV Write: comment:{aiId}
                │       └─→ KV Update: recent:comments cache
                │
                └─→ PM2: POST /api/queue/complete
                    └─→ Worker: handleCompleteMessage()
                        ├─→ KV Read: comment:{humanId}
                        ├─→ Set status='complete', processed=true
                        ├─→ KV Write: comment:{humanId}
                        └─→ KV Update: recent:comments cache
```

---

## Data Structures

### Message Object
```javascript
{
  id: "1762025642726-e7e7ak33y",
  timestamp: 1762025642726,
  text: "Why is space black?",
  username: "Human",
  color: "169080199",
  domain: "saywhatwant.app",
  messageType: "human",  // or "AI"
  replyTo: null,         // or humanMessageId for AI replies
  botParams: {
    status: "pending",   // pending → processing → complete
    priority: 5,
    processed: false,
    entity: "fear-and-loathing"
  }
}
```

### KV Storage
```
comment:{messageId}     → Individual message (persistent)
recent:comments         → Array of last 200 messages (cache)
```

---

## State Transitions

```
Human Message:
  pending → processing → complete

AI Message:
  No state tracking (posts directly as complete)
```

---

## Cache Update Pattern

**Every state change follows this pattern:**
```
1. Read individual message from KV
2. Modify message
3. Write individual message to KV
4. Read recent:comments cache
5. Find message in cache
6. Update message in cache array
7. Write recent:comments cache
```

**Critical**: Steps 1-3 and 4-7 are NOT atomic.

---

## KV Operation Counts

### Human posts message:
- Writes: 2 (message + cache)
- Reads: 1 (cache)

### PM2 polls (0 pending):
- Reads: 1 (cache)
- Writes: 0

### PM2 polls (N pending):
- Reads: 1 + N (cache + verify each)
- Writes: 0 or 1 (if cache needs update)

### PM2 claims message:
- Reads: 2 (message + cache)
- Writes: 2 (message + cache)

### PM2 posts AI response:
- Writes: 2 (message + cache)
- Reads: 1 (cache)

### PM2 completes message:
- Reads: 2 (message + cache)
- Writes: 2 (message + cache)

### **Total for successful roundtrip:**
- **Reads**: 7 (1 post + 1 poll + 1 claim + 1 read + 1 AI post + 1 complete + 1 cache)
- **Writes**: 6 (2 post + 2 claim + 2 AI post + 2 complete)

---

## Critical Design Points

1. **Dual Storage**: Individual messages in KV + Cache array in KV
2. **Non-Atomic Updates**: Message write ≠ Cache write
3. **Poll-Based**: No events, only polling (Frontend: 1s, PM2: 3s)
4. **Single Cache**: All operations read/write same `recent:comments` key
5. **Self-Healing**: Worker verifies cache against actual KV on every poll

---

## Next Steps

This is the CURRENT system. Next README will propose redesign options.

