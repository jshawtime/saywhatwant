# Llama.cpp Context Size Debugging Session

**Date:** December 21, 2025  
**Issue:** HTTP 400 errors after extended conversations  
**Status:** RESOLVED ✅

---

## Problem Statement

After 35+ successful message exchanges in a conversation with `emotional-support-therapist`, Llama.cpp started returning HTTP 400 errors with the fallback message:
```
[AI tried to respond but something went wrong. Try posting that again 🤞]
```

### User's Initial Testing Results

| Test | Computer | Entity | Context | Result |
|------|----------|--------|---------|--------|
| 1 | Original | emotional-support-therapist | 46 messages in IndexedDB | FAILS - 400 error |
| 2 | Original | Different entity | Fresh/new conversation | WORKS perfectly |
| 3 | Different computer | emotional-support-therapist (same URL) | No context (fresh browser) | WORKS perfectly |

**Initial Conclusion:** Issue was specific to conversation context stored in IndexedDB on the original computer.

---

## Debugging Process

### Step 1: Add Verbose Error Logging

The original error handling only logged the HTTP status code:
```typescript
// BEFORE
if (!response.ok) {
  throw new Error(`Llama.cpp request failed: ${response.status}`);
}
```

**Fix:** Read and log the full error response body from Llama.cpp:
```typescript
// AFTER
if (!response.ok) {
  let errorBody = await response.text();
  
  console.error('[LLAMA.CPP ERROR] Request failed with status:', response.status);
  console.error('[LLAMA.CPP ERROR] Response body:', errorBody);
  console.error('[LLAMA.CPP ERROR] Request stats:');
  console.error(`  - Total messages: ${messages.length}`);
  console.error(`  - Total characters: ${totalChars}`);
  console.error(`  - Approx tokens (chars/4): ${approxTokens}`);
  // ... message breakdown ...
}
```

**File:** `hm-server-deployment/AI-Bot-Deploy/src/modules/llmBackend.ts`

### Step 2: Actual Error Revealed

With verbose logging, the real error was exposed:
```json
{
  "error": {
    "code": 400,
    "message": "the request exceeds the available context size, try increasing it",
    "type": "exceed_context_size_error",
    "n_prompt_tokens": 1140,
    "n_ctx": 1024
  }
}
```

**Key insight:** Request needed 1,140 tokens but server only had 1,024 available.

### Step 3: Investigate Why n_ctx Was 1024

The pool-manager.js was configured with `CTX_SIZE: 8192`, so why was the server running with 1024?

**Discovery:** The pool manager had a `PARALLEL_SLOTS` configuration:
```javascript
PARALLEL_SLOTS: {
  'emotional-intelligence-f16': 10,  // <-- PROBLEM
  'default': 1
}
```

**Root Cause:** When Llama.cpp runs with `--parallel 10`, it divides the context among slots:
```
8192 ÷ 10 = ~819 tokens per slot (rounded to 1024)
```

The `emotional-intelligence-f16` model was incorrectly configured for high parallelism, but this model is used by `emotional-support-therapist` which needs full context for conversations.

---

## Root Cause Summary

| Component | Setting | Problem |
|-----------|---------|---------|
| pool-manager.js | `emotional-intelligence-f16: 10` parallel | Divided 8192 into 10 slots |
| Per-slot context | 8192 ÷ 10 = 1024 tokens | Too small for conversations |
| Request needed | 1,140 tokens | Exceeded 1,024 limit |

The parallel slots were intended for the `eq-score` entity (which has tiny prompts), but were mistakenly applied to the emotional-intelligence model which serves multiple entities including the therapist.

---

## Fixes Implemented

### Fix 1: Verbose Error Logging (llmBackend.ts)

Both `OllamaBackend` and `LlamaCppBackend` now log complete error details:
- HTTP status code
- Full response body from server
- Total messages, characters, approximate tokens
- Breakdown of each message (role, length, preview)

### Fix 2: Token-Aware Context Truncation (index-do-simple.ts)

Added automatic sliding window that truncates oldest messages if context exceeds budget:

```typescript
const MAX_CONTEXT_TOKENS = 8192;
const RESPONSE_TOKEN_RESERVE = 500;
const SAFE_TOKEN_BUDGET = MAX_CONTEXT_TOKENS - RESPONSE_TOKEN_RESERVE;  // 7692

if (totalTokens > effectiveBudget) {
  // Remove oldest conversation messages until we fit
  while (totalTokens > effectiveBudget && ollamaMessages.length > historyStartIndex + 3) {
    ollamaMessages.splice(historyStartIndex, 1);  // Remove oldest
    removedCount++;
    totalTokens = calculateMessageTokens(ollamaMessages);
  }
  console.log(`[CONTEXT-OVERFLOW] ✂️ Truncated ${removedCount} oldest messages`);
}
```

**What's Protected (Never Removed):**
- System prompt (index 0)
- InitContext messages (indices 1-4 if enabled)
- Current user message
- Empty assistant message (for completion mode)

**What Gets Truncated:**
- Oldest conversation messages (removed first)

### Fix 3: Pool Manager Configuration (10.0.0.110)

Changed the parallel slots config to only apply to the actual EQ-score model:

```javascript
// BEFORE (wrong)
PARALLEL_SLOTS: {
  'emotional-intelligence-f16': 10,  // Wrong! Used by therapist entity
  'default': 1
}

// AFTER (correct)  
PARALLEL_SLOTS: {
  'eq-score-f16': 10,  // Only EQ-score should use parallel (short prompts)
  'default': 1         // All other models get full 8192 context
}
```

**File on server:** `~/llama.cpp/pool-manager.js`

---

## How Context Management Works Now

### Token Budget

```
8192  - Total context (--ctx-size)
-500  - Reserved for response (max_tokens + overhead)
=7692 - Available for prompt (SAFE_TOKEN_BUDGET)
```

### Automatic Truncation

When a conversation approaches the limit:

```
[CONTEXT] Token estimate: 7500/7692 (97% of budget)
```

If it exceeds:
```
[CONTEXT-OVERFLOW] ⚠️ Token count 8500 exceeds budget 7692
[CONTEXT-OVERFLOW] ✂️ Truncated 12 oldest messages to fit context
[CONTEXT-OVERFLOW] New token count: 7200 (budget: 7692)
```

### Per-Entity Settings

Each entity has a `nom` (number of messages) setting that limits context before it even reaches Llama.cpp:

```json
{
  "id": "emotional-support-therapist",
  "nom": 100,  // Max 100 messages from IndexedDB
  "initContext": true,  // Adds 4 warm-up messages
  "max_tokens": 200  // Response length limit
}
```

---

## Log Examples

### Successful Request
```
[CONTEXT] Using 25 messages from frontend (nom=100, available=25)
[CONTEXT] Token estimate: 3200/7692 (42% of budget)
[ModelRouter] emotional-intelligence-f16 → 10.0.0.110:8080 (Llama.cpp)
[LLAMA.CPP-response] Full response from llama-cpp: ...
```

### Truncation Event
```
[CONTEXT] Using 100 messages from frontend (nom=100, available=156)
[CONTEXT-OVERFLOW] ⚠️ Token count 9500 exceeds budget 7692
[CONTEXT-OVERFLOW] ✂️ Truncated 28 oldest messages to fit context
[CONTEXT-OVERFLOW] New token count: 7400 (budget: 7692)
```

### Error (Before Fix)
```
[LLAMA.CPP ERROR] Request failed with status: 400
[LLAMA.CPP ERROR] Response body: {"error":{"code":400,"message":"the request exceeds the available context size","n_prompt_tokens":1140,"n_ctx":1024}}
```

---

## Files Modified

| File | Location | Change |
|------|----------|--------|
| `llmBackend.ts` | AI-Bot-Deploy/src/modules/ | Verbose error logging |
| `index-do-simple.ts` | AI-Bot-Deploy/src/ | Token-aware truncation |
| `pool-manager.js` | 10.0.0.110:~/llama.cpp/ | Fixed parallel slots config |

---

## Server Commands Used

```bash
# Check pool manager status
curl -s http://10.0.0.110:9000/status | python3 -m json.tool

# Delete misconfigured llama server
ssh ms512-1@10.0.0.110 'eval "$(/opt/homebrew/bin/brew shellenv)" && npx pm2 delete llama-emotional-intelligence-f16'

# Restart pool manager to pick up config change
ssh ms512-1@10.0.0.110 'eval "$(/opt/homebrew/bin/brew shellenv)" && npx pm2 restart pool-manager'

# View llama server logs
ssh ms512-1@10.0.0.110 'eval "$(/opt/homebrew/bin/brew shellenv)" && npx pm2 logs llama-emotional-intelligence-f16 --lines 50'

# Check PM2 process arguments
ssh ms512-1@10.0.0.110 'eval "$(/opt/homebrew/bin/brew shellenv)" && npx pm2 jlist'
```

---

## Key Lessons

1. **Always log error response bodies** - HTTP status codes alone don't explain why requests fail

2. **Parallel slots divide context** - `--ctx-size 8192` with `--parallel 10` means only ~1024 tokens per request

3. **Match parallelism to use case:**
   - High parallelism (10+) = short prompts only (EQ-score)
   - Low parallelism (1) = full context for conversations

4. **Defense in depth:**
   - Entity `nom` setting limits messages from frontend
   - Token truncation catches overflow before sending to Llama.cpp
   - Llama.cpp validates and returns clear error if still too large

5. **Pool manager state is in-memory** - Deleting PM2 process doesn't update pool manager's internal map; must restart pool manager too

---

## Related Documentation

- `203-HARD-MESSAGE-LIMIT-ROLLING-WINDOW.md` - Original hard limit implementation
- `209-DYNAMIC-MODEL-SERVER-POOL.md` - Pool manager architecture
- `204-LLAMACPP-PARALLEL-BACKEND.md` - Llama.cpp integration details

