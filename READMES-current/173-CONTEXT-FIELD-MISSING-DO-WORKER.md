# 173: Context Field Missing in Durable Objects Worker

**Tags:** #critical #durable-objects #context #conversation-history #bug  
**Created:** November 2, 2025  
**Status:** 🚨 CRITICAL BUG - Context field not being stored

---

## Executive Summary

The frontend is correctly building and sending conversation context (`context: string[]`) to the Durable Objects worker, but the DO worker is **not storing this field**. This means every AI response is generated with **zero conversation history**, making filtered conversations and `nom` parameters completely useless.

**Impact:** Bot has no memory of what was said before in the conversation.

---

## What We Have (Current State)

### ✅ Frontend IS Sending Context Correctly

**File: `saywhatwant/modules/commentSubmission.ts`**
- Lines 79, 99, 119, 146, 194: Frontend builds and sends `context` array
- Context format: `["username1: message1", "username2: message2", ...]`

**File: `saywhatwant/components/CommentsStream.tsx`**
- Lines 1052-1078: Builds context from `filteredComments`
- When filters active: sends visible messages as context
- When `nom` parameter set: sends last N messages
- Logs: `[CommentsStream] Filter active - sending X messages as context`

**File: `saywhatwant/modules/cloudApiClient.ts`**
- Lines 80, 88, 94: Includes `context: string[]` in POST body
- Sends to worker: `body.context`

**Example POST body sent by frontend:**
```javascript
{
  id: "abc123xyz",
  timestamp: 1730581234567,
  text: "What is the meaning of life?",
  username: "Human",
  color: "169080199",
  domain: "saywhatwant.app",
  "message-type": "human",
  context: [
    "Human: Hello",
    "FourAgreements: Hello! How can I help you today?",
    "Human: I have a question about the first agreement"
  ],
  botParams: {
    entity: "the-four-agreements",
    priority: 5,
    ais: "FourAgreements:080150203"
  }
}
```

---

## What the OLD KV Worker DID (Reference Implementation)

**File: `saywhatwant/workers/comments-worker.js`**

**Line 441:** Extracted context from request
```javascript
const context = body.context; // Pre-formatted context messages from frontend
```

**Line 447:** Logged it for debugging
```javascript
console.log('[Worker]   body.context:', body.context?.length || 'undefined');
```

**Lines 483-485:** STORED context in message object
```javascript
// Pre-formatted context messages from frontend (store even if empty)
...(context && Array.isArray(context) && {
  context: context
}),
```

**Result:** Context was preserved in KV and available to PM2 bot.

---

## What the NEW DO Worker is NOT Doing (BUG)

**File: `saywhatwant/workers/durable-objects/MessageQueue.js`**

**Lines 100-118:** Message object creation
```javascript
const message = {
  id,
  timestamp,
  text: body.text,
  username: body.username,
  color: body.color,
  domain: body.domain || 'saywhatwant.app',
  'message-type': messageType,
  replyTo: body.replyTo || null,
  botParams: {
    status: messageType === 'human' ? 'pending' : 'complete',
    priority: body.botParams?.priority || body.priority || 5,
    entity,
    ais: body.botParams?.ais || null,
    claimedBy: null,
    claimedAt: null,
    completedAt: messageType === 'AI' ? timestamp : null
  }
};
```

**MISSING:**
- No extraction of `body.context`
- No `context` field in message object
- Context is sent by frontend but **thrown away**

---

## How PM2 Bot Uses Context

**File: `hm-server-deployment/AI-Bot-Deploy/src/index-do-simple.ts`**

**Lines 186-191:** Bot reads context from message
```typescript
// Build context from message.context array
const systemPrompt = entity.systemPrompt || `You are ${entity.username}.`;
const contextMessages = humanMessage.context || [];
const userMessage = `${humanMessage.username}: ${humanMessage.text}`;

const fullContext = [...contextMessages, userMessage].join('\n');
```

**Line 205:** Passes to Ollama
```typescript
messages: [
  { role: 'system', content: systemPrompt },
  { role: 'user', content: fullContext }
],
```

**Bot EXPECTS:** `humanMessage.context` to exist  
**Bot USES:** It to build conversation history for LLM  
**Current reality:** `humanMessage.context` is always `undefined` or `[]`

---

## What We Want (Desired State)

### ✅ DO Worker Should Store Context Field

The Durable Objects worker should:
1. Extract `body.context` from the POST request
2. Store it in the message object
3. Make it available to PM2 bot when fetching pending messages

**Example message object (with context):**
```javascript
{
  id: "abc123xyz",
  timestamp: 1730581234567,
  text: "What is the meaning of life?",
  username: "Human",
  color: "169080199",
  domain: "saywhatwant.app",
  "message-type": "human",
  replyTo: null,
  context: [  // ← THIS FIELD IS MISSING
    "Human: Hello",
    "FourAgreements: Hello! How can I help you today?",
    "Human: I have a question about the first agreement"
  ],
  botParams: {
    status: "pending",
    priority: 5,
    entity: "the-four-agreements",
    ais: "FourAgreements:080150203",
    claimedBy: null,
    claimedAt: null,
    completedAt: null
  }
}
```

---

## Implementation Plan

### Step 1: Update MessageQueue.js - Add Context Field

**File: `saywhatwant/workers/durable-objects/MessageQueue.js`**  
**Location:** Line ~100-118 (inside `postMessage` method)

**Change:** Add context field to message object

**Before:**
```javascript
const message = {
  id,
  timestamp,
  text: body.text,
  username: body.username,
  color: body.color,
  domain: body.domain || 'saywhatwant.app',
  'message-type': messageType,
  replyTo: body.replyTo || null,
  botParams: { /* ... */ }
};
```

**After:**
```javascript
const message = {
  id,
  timestamp,
  text: body.text,
  username: body.username,
  color: body.color,
  domain: body.domain || 'saywhatwant.app',
  'message-type': messageType,
  replyTo: body.replyTo || null,
  context: body.context || null,  // ← ADD THIS LINE
  botParams: { /* ... */ }
};
```

### Step 2: Deploy DO Worker

```bash
cd /Volumes/BOWIE/devrepo/SAYWHATWANTv1/saywhatwant
./deploy-do-worker.sh
```

### Step 3: Verify Context is Being Stored

**Test message POST:**
```bash
curl -X POST https://saywhatwant-do-worker.bootloaders.workers.dev/api/comments \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Test message",
    "username": "TestUser",
    "color": "169080199",
    "domain": "saywhatwant.app",
    "message-type": "human",
    "context": ["User1: Hello", "User2: Hi there"],
    "botParams": {
      "entity": "test-entity",
      "priority": 5
    }
  }'
```

**Check pending queue:**
```bash
curl https://saywhatwant-do-worker.bootloaders.workers.dev/api/queue/pending
```

**Expected:** Message object should include `context` field with the array.

### Step 4: Test End-to-End with Frontend

1. Open filtered conversation: `https://saywhatwant.app/#filteractive=true&entity=the-four-agreements&ais=FourAgreements:080150203`
2. Send a message
3. Check PM2 logs: Should see Ollama receiving full context

**PM2 Logs Should Show:**
```
[CLAIMED] Human:abc123:169080199 | the-four-agreements | "What is the meaning of life?"
[OLLAMA] the-four-agreements-f16 → generating...
```

**Ollama should receive:**
```
System: You are the Four Agreements...
User: Human: Hello
FourAgreements: Hello! How can I help you today?
Human: I have a question about the first agreement
Human: What is the meaning of life?
```

---

## Verification Checklist

- [ ] MessageQueue.js updated with `context: body.context || null`
- [ ] DO worker deployed
- [ ] Test POST includes context field
- [ ] GET /pending returns messages with context field
- [ ] PM2 bot receives context in `humanMessage.context`
- [ ] Ollama generates responses using full conversation history
- [ ] Filtered conversations work correctly (bot knows history)
- [ ] `nom` parameter works correctly (bot receives last N messages)

---

## Why This Bug Happened

During the Durable Objects migration (README 169), we focused on:
1. Core message fields (id, text, username, color)
2. Bot control fields (botParams, entity, ais, status)
3. Strong consistency and atomic operations

**We missed:** The `context` field, which was a "pass-through" field in the KV worker (lines 483-485 of comments-worker.js).

**Root cause:** Context wasn't explicitly mentioned in the migration checklist, so it was inadvertently dropped during the DO worker implementation.

---

## Related Files

### Frontend (Sending Context):
- `saywhatwant/modules/commentSubmission.ts` - Builds context array
- `saywhatwant/components/CommentsStream.tsx` - Extracts from filteredComments
- `saywhatwant/modules/cloudApiClient.ts` - Sends to worker

### Workers (Storing Context):
- `saywhatwant/workers/durable-objects/MessageQueue.js` - **NEEDS FIX** (add context field)
- `saywhatwant/workers/comments-worker.js` - OLD KV worker (reference implementation)

### Backend (Using Context):
- `hm-server-deployment/AI-Bot-Deploy/src/index-do-simple.ts` - Reads context for Ollama

---

## Status After Fix

**Before:** Bot generates responses with zero conversation history  
**After:** Bot generates responses using full filtered conversation context  
**Result:** Filtered conversations and `nom` parameters work as designed

---

**Status:** Ready to implement  
**Priority:** CRITICAL - Core functionality broken  
**Estimated fix time:** 5 minutes (1 line of code)  
**Testing time:** 10 minutes  
**Last Updated:** November 2, 2025

