# 220: Memory-Only Durable Object Migration

**Created:** 2025-11-30  
**Status:** ✅ COMPLETE - Deployed and tested  
**Philosophy:** Real-time app, no stored history - if your tab is closed, you miss out

---

## Executive Summary

**Problem:** Bot was fetching context from DO storage instead of using `message.context` from frontend, causing unnecessary storage costs.

**Solution:** Frontend sends context from IndexedDB. Bot uses `message.context` directly. DO uses memory only. 

**Result:** Storage operations dropped from 4+N reads + 6 writes per message to **$0**.

---

## Architecture

### How It Works Now

```
Frontend (IndexedDB has full history)
    ↓
POST /api/comments
{
  text: "Hello",
  context: [last 200 messages from IndexedDB]
}
    ↓
DO stores in MEMORY ONLY (free)
    ↓
Bot polls, gets message with context attached
    ↓
Bot builds LLM payload:
  - System prompt
  - Context messages (from message.context)
  - Current user message (humanMessage.text)
  - Empty assistant for completion
    ↓
LLM responds → Bot posts to DO (memory) → Frontend polls
```

### Cost Per Message Pair

| Operation | Storage Ops | Cost |
|-----------|-------------|------|
| POST human message | 0 | $0 |
| Bot claims message | 0 | $0 |
| Bot uses context | 0 | $0 |
| POST AI response | 0 | $0 |
| **TOTAL** | **0** | **$0** |

**Only pay for:** DO requests ($0.15/million) + compute duration (negligible)

---

## Key Implementation Details

### Frontend (`CommentsStream.tsx`)
- Always sends last 200 messages as context
- Context format: `["Human: Hello", "AI: Hi there", ...]`

### Bot (`index-do-simple.ts`)
- Uses `message.context` for conversation history
- Adds current message (`humanMessage.text`) as final user message
- Adds empty assistant for completion mode

### DO (`MessageQueue.js`)
- Memory-only: `this.pendingQueue` and `this.recentMessages`
- No storage operations
- Starts fresh on hibernation (by design)

---

## Rollback (If Needed)

```bash
# saywhatwant repo
cd /Volumes/BOWIE/devrepo/SAYWHATWANTv1/saywhatwant
git checkout e117b29
./deploy-do-worker.sh

# hm-server-deployment repo
cd /Volumes/BOWIE/devrepo/SAYWHATWANTv1/hm-server-deployment
git checkout 0cdbdc1
cd AI-Bot-Deploy && npm run build && npx pm2 restart ai-bot-do
```

---

## Testing Completed

| Test | Result |
|------|--------|
| Frontend sends context | ✅ Verified |
| Bot uses message.context | ✅ Verified |
| Multi-turn conversation | ✅ Verified |
| God Mode | ✅ Verified |
| Storage operations = 0 | ✅ Verified |

---

## Bug Fix: Llama.cpp 500 Error

**Issue:** Llama.cpp rejects 2+ assistant messages at end of list.

**Cause:** Context could end with assistant message (e.g., error placeholder), and bot wasn't adding the current user message.

**Fix:** Bot now always adds:
1. Context messages (history)
2. Current user message (`humanMessage.text`)
3. Empty assistant for completion

This ensures proper `user → assistant` alternation.

---

**Status:** ✅ COMPLETE  
**Deployed:** 2025-11-30  
**Tested:** Normal conversations + God Mode
