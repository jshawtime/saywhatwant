# 174: Agent Testing Methodology for DO Workers and PM2 Bots

**Tags:** #agent-guide #testing #methodology #verification #do-worker #pm2  
**Created:** November 2, 2025  
**Audience:** AI Agents (technical, verbose)  
**Status:** ✅ REFERENCE GUIDE

---

## Purpose

This README documents the **exact methodology** for testing Durable Objects workers and PM2 bots to verify functionality, identify bugs, and confirm fixes. This is a **technical guide for AI agents** to replicate systematic testing workflows.

**Key principle:** Never assume anything works. Verify every layer of the stack independently, then test end-to-end.

---

## Testing Stack Overview

### Layer 1: Durable Objects Worker (Cloudflare Edge)
- **What:** Handles HTTP requests, stores messages in DO storage
- **Endpoint:** `https://saywhatwant-do-worker.bootloaders.workers.dev`
- **Test method:** Direct `curl` commands
- **Verification:** JSON responses, field presence, data correctness

### Layer 2: PM2 Bot (Local Server)
- **What:** Polls DO worker, processes messages, calls Ollama
- **Location:** `/Volumes/BOWIE/devrepo/SAYWHATWANTv1/hm-server-deployment/AI-Bot-Deploy`
- **Test method:** Live logs via `npx pm2 logs ai-bot-do`
- **Verification:** Log output format, timing, success/failure patterns

### Layer 3: Ollama (Local LLM Server)
- **What:** Generates AI responses
- **Endpoint:** `http://10.0.0.110:11434/v1/chat/completions`
- **Test method:** Indirect via PM2 logs
- **Verification:** Response time, character count, completion status

### Layer 4: Frontend (Next.js App)
- **What:** User interface, sends messages, polls for updates
- **URL:** `https://saywhatwant.app`
- **Test method:** Browser console logs, network tab
- **Verification:** Message appearance, timing, filter behavior

---

## Methodology 1: Testing Durable Objects Worker Directly

### Why This First?
- Isolates the data layer
- Verifies storage is working before testing bot
- Quick to run (no bot startup required)
- Easy to reproduce and debug

### Step 1: POST a Message with All Fields

**Purpose:** Verify the worker accepts and stores all expected fields.

**Command Template:**
```bash
curl -X POST https://saywhatwant-do-worker.bootloaders.workers.dev/api/comments \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Test message with all fields",
    "username": "TestUser",
    "color": "169080199",
    "domain": "saywhatwant.app",
    "message-type": "human",
    "context": ["User1: Hello", "User2: Hi there", "User1: How are you?"],
    "botParams": {
      "entity": "test-entity",
      "priority": 5,
      "ais": "TestAI:200100080"
    }
  }'
```

**Expected Response:**
```json
{
  "id": "abc123xyz",
  "timestamp": 1762123456789,
  "status": "success"
}
```

**What to Check:**
- ✅ HTTP status 200
- ✅ Response contains `id` field (10-char random string)
- ✅ Response contains `timestamp` field (13-digit Unix milliseconds)
- ✅ Response contains `status: "success"`

**Red Flags:**
- ❌ HTTP 400/500 errors → Worker code issue
- ❌ Missing fields in response → Worker not returning expected format
- ❌ CORS errors → Worker CORS headers misconfigured

### Step 2: GET Pending Messages

**Purpose:** Verify the message was stored with all fields intact.

**Command:**
```bash
curl -s https://saywhatwant-do-worker.bootloaders.workers.dev/api/queue/pending | python3 -m json.tool
```

**Why `python3 -m json.tool`?**
- Pretty-prints JSON for human/agent readability
- Makes it easy to spot missing or malformed fields
- Standard tool available on macOS/Linux

**Expected Response Structure:**
```json
{
  "pending": [
    {
      "id": "abc123xyz",
      "timestamp": 1762123456789,
      "text": "Test message with all fields",
      "username": "TestUser",
      "color": "169080199",
      "domain": "saywhatwant.app",
      "message-type": "human",
      "replyTo": null,
      "context": [
        "User1: Hello",
        "User2: Hi there",
        "User1: How are you?"
      ],
      "botParams": {
        "status": "pending",
        "priority": 5,
        "entity": "test-entity",
        "ais": "TestAI:200100080",
        "claimedBy": null,
        "claimedAt": null,
        "completedAt": null
      }
    }
  ],
  "kvStats": {
    "reads": 1,
    "writes": 0
  }
}
```

**What to Check (Field-by-Field):**
- ✅ `id`: Same as POST response
- ✅ `timestamp`: Same as POST response
- ✅ `text`: Exact match to POST body
- ✅ `username`: Exact match to POST body
- ✅ `color`: Exact match to POST body (9-digit format)
- ✅ `domain`: Exact match or default `saywhatwant.app`
- ✅ `message-type`: Must be `"human"` (with hyphen)
- ✅ `replyTo`: Should be `null` for human messages
- ✅ **`context`**: **CRITICAL** - Array must be present with exact strings
- ✅ `botParams.status`: Must be `"pending"`
- ✅ `botParams.priority`: Should match POST body (default 5)
- ✅ `botParams.entity`: Must be present
- ✅ `botParams.ais`: Should match POST body if provided
- ✅ `botParams.claimedBy`: Should be `null` (not yet claimed)
- ✅ `botParams.claimedAt`: Should be `null`
- ✅ `botParams.completedAt`: Should be `null`

**Red Flags:**
- ❌ `pending` array is empty → Message not stored or already processed
- ❌ `context` field missing → **CRITICAL BUG** (see README 173)
- ❌ `context` is `null` instead of array → Worker not handling correctly
- ❌ `botParams.ais` missing → AI identity override broken
- ❌ `message-type` is camelCase (`messageType`) → Frontend won't filter correctly
- ❌ Any field has wrong type (string vs number) → Type coercion issue

### Step 3: Verify Field Preservation Over Time

**Purpose:** Ensure fields aren't lost during claim/complete cycle.

**Command Sequence:**
```bash
# 1. POST message
MESSAGE_ID=$(curl -s -X POST https://saywhatwant-do-worker.bootloaders.workers.dev/api/comments \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Persistence test",
    "username": "PersistenceBot",
    "color": "100200080",
    "message-type": "human",
    "context": ["Line1: test", "Line2: test"],
    "botParams": {"entity": "test", "priority": 5}
  }' | python3 -c "import sys, json; print(json.load(sys.stdin)['id'])")

# 2. Immediately check pending
curl -s https://saywhatwant-do-worker.bootloaders.workers.dev/api/queue/pending | python3 -m json.tool | grep -A 5 "context"

# 3. Wait for bot to process (or manually claim/complete)
sleep 5

# 4. Check all messages (not just pending)
curl -s "https://saywhatwant-do-worker.bootloaders.workers.dev/api/comments?since=0" | python3 -m json.tool | grep -A 10 "$MESSAGE_ID"
```

**What to Check:**
- ✅ Context field present in initial pending query
- ✅ Context field preserved after bot claims message
- ✅ Context field still present in final completed state
- ✅ All other fields intact throughout lifecycle

---

## Methodology 2: Testing PM2 Bot Behavior

### Why This Second?
- Depends on working DO worker (verify Layer 1 first)
- More complex to debug (logs, timing, LLM interactions)
- Requires understanding log format

### Step 1: Verify Bot is Running

**Command:**
```bash
npx pm2 list
```

**Expected Output:**
```
┌─────┬──────────────┬─────────────┬─────────┬─────────┬──────────┐
│ id  │ name         │ namespace   │ version │ mode    │ pid      │
├─────┼──────────────┼─────────────┼─────────┼─────────┼──────────┤
│ 0   │ ai-bot-do    │ default     │ 1.0.0   │ fork    │ 12345    │
└─────┴──────────────┴─────────────┴─────────┴─────────┴──────────┘
```

**What to Check:**
- ✅ Status is `online` (green)
- ✅ Process name is `ai-bot-do` (not old `ai-bot-simple`)
- ✅ Restart count is low (< 5) indicating stability

**Red Flags:**
- ❌ Status is `errored` or `stopped` → Bot crashed
- ❌ High restart count (> 10) → Bot repeatedly crashing
- ❌ Wrong process name → Old bot still running

**Fix if not running:**
```bash
cd /Volumes/BOWIE/devrepo/SAYWHATWANTv1/hm-server-deployment/AI-Bot-Deploy
./PM2-DO-kill-rebuild-and-start.sh
```

### Step 2: Monitor PM2 Logs in Real-Time

**Command:**
```bash
npx pm2 logs ai-bot-do --lines 50
```

**Why `--lines 50`?**
- Shows recent history for context
- Helps identify patterns (idle polls, processing)
- Default is 20 lines (often too few)

**Expected Log Pattern (Idle):**
```
[POLL 1] Idle
[POLL 2] Idle
[POLL 3] Idle
...
```

**Expected Log Pattern (Processing):**
```
[POLL 15] Found 1 pending
[CLAIMED] Human:abc123xyz:169080199 | test-entity | "Test message with all..."
[OLLAMA] test-entity-f16 → generating...
[OLLAMA] ✓ 245 chars in 1.8s
[POSTED] def456uvw | TestAI:200100080 → Human:abc123xyz | "Here is my response..."
[COMPLETE] Human:abc123xyz:169080199 | def456uvw TestAI:200100080 (2.1s total)
[POLL 1] Idle
```

**What Each Log Line Means:**

**`[POLL N] Idle`**
- Bot polled `/api/queue/pending`, found nothing
- N increments until work found (shows idle duration)
- Polls every 3 seconds
- **Expected:** During periods of no activity

**`[POLL N] Found X pending`**
- Bot found X pending messages
- Resets poll counter to 0
- **Expected:** When messages are waiting

**`[CLAIMED] Human:ID:COLOR | ENTITY | "TEXT"`**
- Bot claimed a specific message for processing
- Shows: message ID, user color, entity, truncated text
- **Expected:** Immediately after "Found pending"

**`[OLLAMA] MODEL → generating...`**
- Bot is calling Ollama with the specified model
- **Expected:** Immediately after CLAIMED

**`[OLLAMA] ✓ CHARS chars in TIME s`**
- Ollama successfully generated response
- Shows: character count and generation time
- **Expected:** 0.5-5.0 seconds for most models
- **Red flag:** > 10 seconds indicates slow model or cold start

**`[OLLAMA] ✗ ERROR`**
- Ollama failed to generate response
- Shows: error message
- **Red flags:**
  - "Connection refused" → Ollama not running
  - "Model not found" → Wrong model name in config
  - "Timeout" → Model too slow, increase timeout

**`[POSTED] AI_ID | AI_USERNAME:AI_COLOR → Human:HUMAN_ID | "AI_TEXT"`**
- Bot posted AI response to DO worker
- Shows: AI message ID, AI username, AI color, human message ID, truncated AI text
- **Expected:** Immediately after successful Ollama generation

**`[COMPLETE] Human:HUMAN_ID:HUMAN_COLOR | AI_ID AI_USERNAME:AI_COLOR (TIME s total)`**
- Bot marked human message as complete
- Shows: human message ID, human color, AI message ID, AI username, AI color, total processing time
- **Expected:** Immediately after POSTED
- **Total time:** Typically 2-5 seconds (Ollama + overhead)

**`[ERROR] CONTEXT | MESSAGE`**
- Something went wrong
- Shows: where error occurred and error message
- **Red flags:** Any ERROR line indicates a problem

### Step 3: Test Bot Response to New Message

**Procedure:**
1. **Open PM2 logs in one terminal:**
   ```bash
   npx pm2 logs ai-bot-do --lines 50
   ```

2. **In another terminal, POST a test message:**
   ```bash
   curl -X POST https://saywhatwant-do-worker.bootloaders.workers.dev/api/comments \
     -H "Content-Type: application/json" \
     -d '{
       "text": "Bot test message - please respond",
       "username": "BotTester",
       "color": "150100200",
       "message-type": "human",
       "context": ["Previous: context line 1", "Previous: context line 2"],
       "botParams": {
         "entity": "fear-and-loathing",
         "priority": 5
       }
     }'
   ```

3. **Watch PM2 logs for response (should happen within 3-6 seconds):**

**Expected Log Sequence:**
```
[POLL 8] Idle
[POLL 9] Found 1 pending
[CLAIMED] Human:xyz789abc:150100200 | fear-and-loathing | "Bot test message - please res..."
[OLLAMA] fear-and-loathing-f16 → generating...
[OLLAMA] ✓ 187 chars in 1.2s
[POSTED] mno345pqr | FearAndLoathing:163160080 → Human:xyz789abc | "The American Dream is a..."
[COMPLETE] Human:xyz789abc:150100200 | mno345pqr FearAndLoathing:163160080 (1.5s total)
[POLL 1] Idle
```

**Timing Analysis:**
- **Poll discovery:** 0-3 seconds (depends on poll timing)
- **Claim:** < 100ms
- **Ollama generation:** 0.5-3.0 seconds (typical)
- **Post + Complete:** < 200ms
- **Total:** ~2-5 seconds

**Red Flags:**
- ❌ No "Found pending" within 10 seconds → Bot not polling or message not stored
- ❌ "Found pending" but no "CLAIMED" → Bot can't claim (worker issue)
- ❌ "CLAIMED" but no "OLLAMA" → Bot crashed during processing
- ❌ "OLLAMA" but no "✓" → Ollama failed
- ❌ "OLLAMA ✓" but no "POSTED" → Bot can't post to worker
- ❌ "POSTED" but no "COMPLETE" → Bot can't mark complete

### Step 4: Verify Context is Being Logged (NEW REQUIREMENT)

**What to Look For in PM2 Logs:**
```
[CLAIMED] Human:abc123:169080199 | entity | "message text..." | CONTEXT: 3 msgs
```

**Or more detailed:**
```
[CLAIMED] Human:abc123:169080199 | entity | "message text..." | CTX: "Previous: context li..."
```

**Requirements:**
- Context presence should be logged
- Context should be truncated to ~25 characters
- Should show number of context messages OR first context line truncated

**Testing:**
1. POST message with context array
2. Check PM2 logs for context indicator
3. Verify truncation is working correctly

---

## Methodology 3: End-to-End Testing

### Purpose
- Verify entire flow from frontend → DO → PM2 → Ollama → DO → frontend
- Most realistic test but hardest to debug

### Step 1: Open Frontend with Filtered Conversation

**URL Template:**
```
https://saywhatwant.app/#filteractive=true&entity=ENTITY_ID&ais=AI_USERNAME:AI_COLOR&uis=HUMAN_USERNAME:HUMAN_COLOR
```

**Example:**
```
https://saywhatwant.app/#filteractive=true&entity=the-four-agreements&ais=FourAgreements:080150203&uis=Human:169080199
```

**Why Use Filters?**
- Tests context generation (filtered view)
- Tests AI identity override (`ais` parameter)
- More realistic user scenario

### Step 2: Open Browser Console

**Chrome/Safari:** Cmd+Option+J (Mac) or Ctrl+Shift+J (Windows)

**What to Watch:**
```
[CommentsStream] Filter active - sending 5 messages as context
[CommentSubmission] Sending context: 5 messages
[CloudAPI] Posting comment: {username: "Human", color: "169080199", context: 5, botParams: {...}}
[CommentSubmission] Server acknowledged: abc123xyz
[Presence Polling] Fetching after timestamp: 1762123456789
[Presence Polling] Response: 1 messages
[CommentsStream] New messages: 1 (AI: 1, Human: 0)
```

**What This Shows:**
- Context is being built from filtered view
- Context count is logged
- Server acknowledged the post
- Polling is working
- AI response appeared

### Step 3: Verify Message Appears with Correct Identity

**Frontend Display:**
- Message should appear from correct AI username (from `ais` parameter)
- Message should have correct color (from `ais` parameter)
- Message should be contextually aware (references previous conversation)

**Example:**
If context was:
```
Human: What is the first agreement?
FourAgreements: Be impeccable with your word.
Human: What does that mean?
```

AI response should reference this context:
```
FourAgreements: As I mentioned, being impeccable with your word means...
```

### Step 4: Export Debug Data

**User Action:** Click "Copy All (verbose)"

**What to Check in Export:**
```
Human [abc123xyz]
  Time: 2025-11-02 19:45:23 UTC
  Color: 169080199
  Entity: the-four-agreements
  Priority: 5
  AIS: FourAgreements:080150203
  Text: What does that mean?

FourAgreements [def456uvw]
  Time: 2025-11-02 19:45:25 UTC
  Color: 080150203  ← Must match ais parameter
  ReplyTo: abc123xyz
  Text: As I mentioned, being impeccable with your word means...
```

**Verification:**
- ✅ AI color matches `ais` parameter (080150203)
- ✅ AI username matches `ais` parameter (FourAgreements)
- ✅ AI response is contextually aware
- ✅ Timing is reasonable (< 10 seconds)

---

## UPDATED: Multi-Turn Message Format (Nov 4, 2025)

### New Context Format

**As of Nov 4, 2025, context is sent as structured messages array:**

```json
{
  "model": "the-eternal-f16",
  "messages": [
    {"role": "system", "content": "You are a wise being..."},
    {"role": "user", "content": "Hello"},
    {"role": "assistant", "content": "Hi there"},
    {"role": "user", "content": "How are you?"},
    {"role": "assistant", "content": "I'm well"},
    {"role": "user", "content": "What is reality?"}
  ],
  "temperature": 0.7,
  "max_tokens": 200,
  "top_p": 0.9,
  "top_k": 100,
  "repeat_penalty": 1.25,
  "min_p": 0.5
}
```

**Key changes:**
- Each conversation turn is separate message object
- Proper role mapping: human → `user`, AI → `assistant`
- Clean content (no "Username:" prefixes)
- Matches training data format
- All Ollama parameters included

### Testing the New Format

**Post test message:**
```bash
curl -X POST https://saywhatwant-do-worker.bootloaders.workers.dev/api/comments \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Test multi-turn format",
    "username": "Tester",
    "color": "100150200",
    "message-type": "human",
    "botParams": {
      "entity": "the-eternal",
      "priority": 5,
      "ais": "TheEternal:200100150"
    }
  }'
```

**Expected in [OLLAMA-all] log:**
- System message first
- Each conversation turn as separate object
- Roles correctly assigned
- All parameters present

**Related:** README 181 (Multi-turn format migration)

---

## Debugging Workflow

### When Something Doesn't Work

**1. Identify the Breaking Point**

Test each layer independently:
```
Layer 1: POST → GET pending (DO worker)
↓ Working? YES → Continue
↓ Working? NO → Fix DO worker

Layer 2: PM2 logs show "Found pending"?
↓ YES → Bot is polling correctly
↓ NO → Check bot is running, check API URL

Layer 3: PM2 logs show "CLAIMED"?
↓ YES → Bot can claim messages
↓ NO → Check DO worker /claim endpoint

Layer 4: PM2 logs show "OLLAMA ✓"?
↓ YES → Ollama is generating responses
↓ NO → Check Ollama server, model name

Layer 5: PM2 logs show "POSTED"?
↓ YES → Bot can post AI responses
↓ NO → Check DO worker /comments POST endpoint

Layer 6: PM2 logs show "COMPLETE"?
↓ YES → Bot can complete messages
↓ NO → Check DO worker /complete endpoint

Layer 7: Frontend shows AI message?
↓ YES → End-to-end working!
↓ NO → Check frontend polling, filtering
```

**2. Read the Logs Carefully**

- PM2 logs tell you EXACTLY where it's failing
- DO worker logs (if enabled) show what requests it's receiving
- Frontend console logs show what it's sending/receiving

**3. Use curl to Reproduce Manually**

If bot fails, try manually:
```bash
# 1. POST message
curl -X POST ...

# 2. GET pending
curl https://.../api/queue/pending

# 3. Claim it manually
curl -X POST https://.../api/queue/claim -d '{"messageId":"xyz","workerId":"manual-test"}'

# 4. POST AI response
curl -X POST https://.../api/comments -d '{... AI response ...}'

# 5. Complete it
curl -X POST https://.../api/queue/complete -d '{"messageId":"xyz"}'
```

This isolates whether the issue is in the worker or the bot.

**4. Check for Race Conditions**

If intermittent failures:
- POST message
- Immediately GET pending
- Check if message appears
- If not, wait 100ms and try again

If message takes time to appear → eventual consistency issue.

**5. Verify Field Types**

Common bugs:
- String vs Number (priority, timestamp)
- Hyphenated vs camelCase (`message-type` vs `messageType`)
- Array vs null (`context: []` vs `context: null`)
- Missing fields entirely

Use `python3 -m json.tool` to see actual field structure.

---

## Common Failure Patterns

### Pattern 1: Message Posts but Bot Doesn't See It

**Symptoms:**
- POST returns success
- GET /pending shows message
- PM2 logs stuck on "Idle"

**Causes:**
- Bot is polling wrong endpoint
- Bot expects different field names
- Bot filtering messages incorrectly

**Debug:**
```bash
# Check what bot is polling
npx pm2 logs ai-bot-do | grep "Polling"

# Check what GET /pending returns
curl -s https://.../api/queue/pending | python3 -m json.tool

# Compare expected vs actual format
```

### Pattern 2: Bot Sees Message but Can't Claim

**Symptoms:**
- PM2 shows "Found 1 pending"
- No "CLAIMED" line follows
- Message stays pending

**Causes:**
- /claim endpoint broken
- Message already claimed by another worker
- Status not "pending"

**Debug:**
```bash
# Try manual claim
curl -X POST https://.../api/queue/claim \
  -H "Content-Type: application/json" \
  -d '{"messageId":"xyz","workerId":"manual-test"}'

# Check response
```

### Pattern 3: Ollama Fails

**Symptoms:**
- "[OLLAMA] model → generating..."
- "[OLLAMA] ✗ error message"
- No AI response posted

**Causes:**
- Ollama not running
- Wrong model name
- Model not loaded
- Timeout too short

**Debug:**
```bash
# Check Ollama is running
curl http://10.0.0.110:11434/api/tags

# Check model exists
curl http://10.0.0.110:11434/api/tags | grep "fear-and-loathing"

# Try manual generation
curl -X POST http://10.0.0.110:11434/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "fear-and-loathing-f16",
    "messages": [{"role": "user", "content": "Test"}]
  }'
```

### Pattern 4: Context Not Being Used

**Symptoms:**
- AI response ignores previous conversation
- AI response is generic, not contextually aware
- PM2 logs don't mention context

**Causes:**
- Context field not stored in DO (see README 173)
- Context array empty
- Bot not reading context field
- Ollama prompt not including context

**Debug:**
```bash
# 1. Check DO storage
curl -s https://.../api/queue/pending | python3 -m json.tool | grep -A 5 "context"

# 2. Check PM2 logs for context mention
npx pm2 logs ai-bot-do | grep -i context

# 3. Check bot code reads context
# File: hm-server-deployment/AI-Bot-Deploy/src/index-do-simple.ts
# Line: const contextMessages = humanMessage.context || [];
```

---

## Success Criteria Checklist

### DO Worker Tests
- [ ] POST message returns 200 with id/timestamp
- [ ] GET /pending returns message with all fields
- [ ] `context` field present and is array
- [ ] `message-type` is hyphenated
- [ ] `botParams.ais` preserved correctly
- [ ] Message lifecycle (pending → processing → complete) works

### PM2 Bot Tests
- [ ] Bot shows "online" in pm2 list
- [ ] Bot logs show idle polling every 3 seconds
- [ ] Bot discovers new messages within 3 seconds
- [ ] Bot claims messages successfully
- [ ] Ollama generates responses (< 5 seconds typical)
- [ ] Bot posts AI responses with correct identity
- [ ] Bot completes messages successfully
- [ ] **Context is logged in CLAIMED line** (NEW)
- [ ] **Context truncated to ~25 chars** (NEW)

### End-to-End Tests
- [ ] Frontend sends message with context
- [ ] DO worker stores message with context
- [ ] PM2 bot receives message with context
- [ ] Ollama generates contextually aware response
- [ ] AI response appears in frontend within 10 seconds
- [ ] AI identity (username/color) matches `ais` parameter
- [ ] Filtered conversations work correctly

---

## Example Testing Session (Complete Workflow)

```bash
# Terminal 1: PM2 Logs
cd /Volumes/BOWIE/devrepo/SAYWHATWANTv1/hm-server-deployment/AI-Bot-Deploy
npx pm2 logs ai-bot-do --lines 50

# Terminal 2: Testing Commands

# 1. POST test message
curl -X POST https://saywhatwant-do-worker.bootloaders.workers.dev/api/comments \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Complete test of context system",
    "username": "Tester",
    "color": "100150200",
    "message-type": "human",
    "context": ["Line1: Previous message", "Line2: Another message", "Line3: Third message"],
    "botParams": {
      "entity": "fear-and-loathing",
      "priority": 5,
      "ais": "Hunter:163160080"
    }
  }'

# Expected: {"id":"xyz789","timestamp":1762123456789,"status":"success"}

# 2. Verify storage
curl -s https://saywhatwant-do-worker.bootloaders.workers.dev/api/queue/pending | python3 -m json.tool

# Expected: Message with context array [3 items], ais preserved

# 3. Watch Terminal 1 for PM2 logs
# Expected within 3-6 seconds:
# [POLL N] Found 1 pending
# [CLAIMED] Human:xyz789:100150200 | fear-and-loathing | "Complete test of context..." | CTX: "Line1: Previous messa..."
# [OLLAMA] fear-and-loathing-f16 → generating...
# [OLLAMA] ✓ 234 chars in 1.4s
# [POSTED] abc123 | Hunter:163160080 → Human:xyz789 | "The context shows we..."
# [COMPLETE] Human:xyz789:100150200 | abc123 Hunter:163160080 (1.8s total)

# 4. Verify AI response stored
curl -s "https://saywhatwant-do-worker.bootloaders.workers.dev/api/comments?since=0" | python3 -m json.tool | grep -A 10 "Hunter"

# Expected: AI message with username "Hunter", color "163160080", replyTo "xyz789"

# 5. SUCCESS: All layers working correctly
```

---

## Key Takeaways for Agents

1. **Test bottom-up**: DO worker → PM2 bot → End-to-end
2. **Verify every field**: Don't assume, check the actual JSON
3. **Use logs religiously**: PM2 logs are your source of truth
4. **Isolate failures**: Test each layer independently
5. **Use curl liberally**: Reproduce manually what the bot does
6. **Check timing**: 2-5 seconds is normal, > 10 seconds indicates a problem
7. **Watch for missing fields**: Most bugs are dropped fields during storage
8. **Pretty-print JSON**: Always use `python3 -m json.tool` for readability
9. **Monitor real-time**: Have PM2 logs open during tests
10. **Document findings**: Note exact error messages and reproduction steps

---

**Status:** ✅ COMPLETE - Agent testing methodology documented  
**Last Updated:** November 2, 2025  
**Audience:** AI Agents conducting system tests  
**Related:** README 173 (Context field fix)

