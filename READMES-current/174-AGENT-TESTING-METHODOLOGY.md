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

## ⚠️ FUNDAMENTAL TEST - DO THIS FIRST

### Before ANY other testing, verify you can POST and RETRIEVE a message from DO

**This is the most basic test. If this fails, everything else is folly.**

### The Test:

```bash
# 1. POST a test message (mimics PM2 God Mode post)
# Use human-readable timestamp in text for easy identification
curl -X POST "https://saywhatwant-do-worker.bootloaders.workers.dev/api/comments" \
  -H "Content-Type: application/json" \
  -d '{
    "text": "(TestEntity) Test God Mode message - posted at 2:49 AM 13th November 2025",
    "username": "GodMode",
    "color": "999888777",
    "message-type": "AI",
    "replyTo": "test-msg",
    "botParams": {
      "humanUsername": "Human",
      "humanColor": "888777666",
      "entity": "god-mode",
      "ais": "GodMode:999888777",
      "sessionId": "test-session-2025-11-13-0249"
    }
  }'

# Should return: {"id":"XXXXX","timestamp":NNNNNN,"status":"success"}
# Note the ID!

# 2. Verify user confirms it appears in frontend
# (This proves the message exists somewhere)

# 3. Find that EXACT message in DO by searching for unique text
curl -s "https://saywhatwant-do-worker.bootloaders.workers.dev/api/comments?after=0&limit=500" \
  > /tmp/do_messages.json

python3 << 'PYEOF'
import json

with open('/tmp/do_messages.json') as f:
    data = json.load(f)

# Search for our unique test message
target = [m for m in data if 'AGENT_TEST_MESSAGE_UNIQUE_12345' in m.get('text', '')]

if target:
    print("✅ SUCCESS! Found test message in DO!")
    print("\nMessage structure:")
    print(json.dumps(target[0], indent=2))
    
    # Verify sessionId
    bp = target[0].get('botParams', {})
    if 'sessionId' in bp:
        print(f"\n✅✅ sessionId PRESERVED: {bp['sessionId']}")
    else:
        print(f"\n❌ sessionId MISSING from botParams")
        print(f"botParams keys: {list(bp.keys())}")
else:
    print("❌ FAILED! Test message NOT in DO!")
    print(f"Checked {len(data)} messages")
    print("Message posted successfully but not retrievable")
    print("\nThis means:")
    print("- DO is returning success but not storing")
    print("- OR message in a key that /api/comments doesn't query")
    print("- OR deployment hasn't propagated")
PYEOF

# 4. Check which DO key it was stored in
curl -s "https://saywhatwant-do-worker.bootloaders.workers.dev/api/admin/list-keys" \
  | python3 -c "import json, sys; \
  keys=json.load(sys.stdin)['keys']; \
  session_keys=[k for k in keys if 'agent-test-session-unique' in k]; \
  godmode_keys=[k for k in keys if k.startswith('godmode:')]; \
  print(f'\\nKeys with our test sessionId: {len(session_keys)}'); \
  [print(f'  {k}') for k in session_keys]; \
  print(f'\\nTotal godmode: keys: {len(godmode_keys)}')"
```

### Success Criteria:

✅ **POST returns success**  
✅ **Message appears in frontend** (user confirms)  
✅ **Message retrievable from DO** (found by unique text)  
✅ **sessionId in botParams** (if testing God Mode)  
✅ **Correct DO key created** (godmode: format for God Mode)  

### If ANY of these fail:

❌ **Don't proceed with other tests**  
❌ **Fix the fundamental issue first**  
❌ **All other testing is meaningless until this works**  

---

## ⚠️ CRITICAL: How to Query DO Messages Correctly

### WRONG WAY (Will Miss Messages):
```bash
# DON'T DO THIS for finding specific messages:
curl "https://saywhatwant-do-worker.bootloaders.workers.dev/api/comments?after=0&limit=500"
```

**Why this fails:**
- Queries ALL conversation keys (298+ keys)
- limit=500 spreads across ALL keys (~1-2 messages per key)
- Large conversations (200+ messages) are mostly INVISIBLE
- You'll miss recent messages in busy conversations!

### RIGHT WAY (Gets All Messages):
```bash
# DO THIS to find messages in a specific conversation:
curl "https://saywhatwant-do-worker.bootloaders.workers.dev/api/conversation?humanUsername=Human&humanColor=231080166&aiUsername=GodMode&aiColor=171181106"
```

**Why this works:**
- Queries ONE SPECIFIC conversation
- Returns ALL messages from that conversation (no limit!)
- Works for conversations with 1 or 1000 messages
- Guaranteed to find everything for this Human:AI pair

### BEST WAY (Search All Conversations):
```bash
# Use the test script: TEST-SCRIPTS/find-latest-do-message.py
python3 TEST-SCRIPTS/find-latest-do-message.py
```

**What it does:**
1. Lists all conversation keys
2. Queries EACH conversation individually
3. Finds the absolute latest message across ALL conversations
4. Shows full payload with all fields

**This is the ONLY reliable way to find the newest message in DO!**

### Rule of Thumb:

**Looking for latest overall message?**
→ Use `find-latest-do-message.py` script

**Looking for messages in specific conversation?**
→ Use `/api/conversation?humanUsername=X&humanColor=Y&aiUsername=Z&aiColor=W`

**DON'T use `/api/comments?limit=N` for verification!**
→ It's for frontend polling (recent messages), NOT for finding specific messages

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

## Methodology 4: God Mode Session Storage Testing

### Why This is Different:
- God Mode uses session-based DO keys (not conversation keys)
- Multiple storage formats (godmode: vs conv:)
- Session metadata tracking
- Large synthesis responses

### Step 1: Verify Session Key Creation

**After posting God Mode question, check DO:**

```bash
# List all God Mode session keys
curl -s "https://saywhatwant-do-worker.bootloaders.workers.dev/api/admin/list-keys" \
  | python3 -c "import json, sys; keys=json.load(sys.stdin).get('keys',[]); \
  godmode=[k for k in keys if k.startswith('godmode:')]; \
  print(f'God Mode session keys: {len(godmode)}'); \
  [print(f'  {k}') for k in godmode[-5:]]"
```

**Expected:**
```
God Mode session keys: 5
  godmode:Human:231080166:GodMode:171181106:1763027011418-1mmzaea
  godmode:Human:231080166:GodMode:171181106:1763027234567-abc123x
  ...
```

**Red flags:**
- ❌ 0 keys found → Session routing not working
- ❌ Keys use conv: format → sessionId not preserved
- ❌ Keys missing sessionId suffix → Routing logic broken

### Step 2: Verify sessionId in Message botParams

**Check if stored messages have sessionId:**

```bash
# Get latest God Mode message
curl -s "https://saywhatwant-do-worker.bootloaders.workers.dev/api/comments?after=0&limit=5" \
  > /tmp/recent.json

python3 << 'PYEOF'
import json

with open('/tmp/recent.json') as f:
    data = json.load(f)

godmode = [m for m in data if m.get('username') == 'GodMode']
if godmode:
    m = godmode[-1]
    print(f"Latest GodMode message:")
    print(f"  ID: {m['id']}")
    print(f"  Text: {m['text'][:50]}...")
    
    bp = m.get('botParams', {})
    print(f"\nbotParams fields:")
    for key in bp.keys():
        print(f"  {key}: {bp[key]}")
    
    if 'sessionId' in bp:
        print(f"\n✅ sessionId preserved!")
    else:
        print(f"\n❌ sessionId MISSING - DO worker dropping it!")
PYEOF
```

**Expected:**
```
botParams fields:
  status: complete
  priority: 5
  entity: god-mode
  ais: GodMode:171181106
  sessionId: 1763027011418-1mmzaea  ← Must be present!
```

### Step 3: Verify Session Isolation

**Post 3 God Mode questions, check each has separate key:**

```bash
# List all session keys for specific Human:GodMode pair
curl -s "https://saywhatwant-do-worker.bootloaders.workers.dev/api/admin/list-keys" \
  | python3 -c "import json, sys; keys=json.load(sys.stdin).get('keys',[]); \
  target_keys=[k for k in keys if 'Human:231080166' in k and 'GodMode:171181106' in k]; \
  print(f'Keys for Human:231080166 + GodMode:171181106:'); \
  [print(f'  {k}') for k in target_keys]"
```

**Expected (after 3 sessions):**
```
godmode:Human:231080166:GodMode:171181106:1763027011418-1mmzaea (Session 1)
godmode:Human:231080166:GodMode:171181106:1763027234567-abc123x (Session 2)
godmode:Human:231080166:GodMode:171181106:1763027456789-xyz789p (Session 3)
```

**Red flag:**
- ❌ Only 1 key → All sessions merged (broken)
- ❌ conv: format → Old behavior (not using sessions)

### Step 4: Check Conversation Key Size

**Verify session keys don't grow beyond limit:**

```bash
# Check size of a specific session key
curl -s "https://saywhatwant-do-worker.bootloaders.workers.dev/api/conversation?humanUsername=Human&humanColor=231080166&aiUsername=GodMode&aiColor=171181106" \
  | python3 -c "import json, sys; data=json.load(sys.stdin); \
  size=len(json.dumps(data)); \
  print(f'Messages: {len(data)}'); \
  print(f'Size: {size:,} bytes ({size/1024:.1f} KB)'); \
  print(f'128KB limit: 131,072 bytes'); \
  print(f'Status: {\"OVER!\" if size > 131072 else \"OK\"}'); \
  print(f'Percentage: {(size/131072)*100:.1f}%')"
```

**With session-based storage:**
- Each key should be <50KB (one session only)
- Multiple keys for same Human:GodMode pair
- Never exceeds 128KB per key

**Without session-based storage (broken):**
- One key grows with each session
- After 3-7 sessions: Exceeds 128KB
- 500 errors start appearing

### Step 5: Test Session Retrieval

**Query all sessions for a user:**

```bash
# Get all sessions for Human:231080166 + GodMode:171181106
curl -s "https://saywhatwant-do-worker.bootloaders.workers.dev/api/godmode-sessions?humanUsername=Human&humanColor=231080166&godModeColor=171181106" \
  | python3 -m json.tool
```

**Expected:**
```json
{
  "sessions": [
    {
      "sessionId": "1763027011418-1mmzaea",
      "timestamp": 1763027011418,
      "humanQuestion": "What should an AI...",
      "entitiesUsed": ["god-is-a-machine", "how-to-get-what-you-want"],
      "entityCount": 2,
      "messageIds": ["msg1", "msg2", "msg3", "msg4", "msg5"]
    }
  ],
  "total": 1
}
```

---

## Methodology 5: Investigating DO Storage Issues

### Technique 1: Search by Key Pattern

**Find keys matching pattern:**

```bash
# All God Mode related keys
curl -s "https://saywhatwant-do-worker.bootloaders.workers.dev/api/admin/list-keys" \
  | python3 -c "import json, sys; keys=json.load(sys.stdin).get('keys',[]); \
  matches=[k for k in keys if 'GodMode' in k]; \
  print(f'Keys containing GodMode: {len(matches)}'); \
  [print(f'  {k}') for k in matches[:10]]"

# Session-specific search
curl -s "https://saywhatwant-do-worker.bootloaders.workers.dev/api/admin/list-keys" \
  | python3 -c "import json, sys; keys=json.load(sys.stdin).get('keys',[]); \
  session=[k for k in keys if 'session-' in k or k.startswith('godmode:')]; \
  print(f'Session keys: {len(session)}'); \
  [print(f'  {k}') for k in session]"
```

### Technique 2: Check Message Structure

**Verify fields are preserved:**

```python
import json

# Load message from DO
with open('/tmp/message.json') as f:
    msg = json.load(f)

# Check all fields
print("Message structure:")
for key, value in msg.items():
    if isinstance(value, dict):
        print(f"  {key}:")
        for k, v in value.items():
            print(f"    {k}: {v}")
    else:
        val_str = str(value)[:50]
        print(f"  {key}: {val_str}")

# Verify botParams
if 'botParams' in msg:
    bp = msg['botParams']
    required = ['entity', 'ais', 'sessionId']  # For God Mode
    for field in required:
        if field in bp:
            print(f"✅ {field}: present")
        else:
            print(f"❌ {field}: MISSING!")
```

### Technique 3: Compare Key Sizes

**Identify which keys are growing:**

```bash
# Save all keys to file
curl -s "https://saywhatwant-do-worker.bootloaders.workers.dev/api/admin/list-keys" \
  > /tmp/keys_before.json

# Post messages...

# Check again
curl -s "https://saywhatwant-do-worker.bootloaders.workers.dev/api/admin/list-keys" \
  > /tmp/keys_after.json

# Compare
python3 << 'PYEOF'
import json

with open('/tmp/keys_before.json') as f:
    before = set(json.load(f)['keys'])

with open('/tmp/keys_after.json') as f:
    after = set(json.load(f)['keys'])

new_keys = after - before
print(f"New keys created: {len(new_keys)}")
for key in new_keys:
    print(f"  {key}")
PYEOF
```

### Technique 4: Trace Message Flow

**Follow a message through the entire system:**

```bash
# 1. POST message, capture ID
MESSAGE_ID=$(curl -s -X POST https://saywhatwant-do-worker.bootloaders.workers.dev/api/comments \
  -H "Content-Type: application/json" \
  -d '{"text":"Test","username":"Test","color":"123123123","message-type":"human","botParams":{"entity":"god-mode","sessionId":"test-session-123"}}' \
  | python3 -c "import sys, json; print(json.load(sys.stdin)['id'])")

echo "Message ID: $MESSAGE_ID"

# 2. Check if it appears in pending
curl -s "https://saywhatwant-do-worker.bootloaders.workers.dev/api/queue/pending" \
  | python3 -c "import sys, json; data=json.load(sys.stdin); \
  msg=[m for m in data['pending'] if m['id']=='$MESSAGE_ID']; \
  print('Found in pending:', len(msg)>0); \
  if msg: print('SessionId:', msg[0].get('botParams',{}).get('sessionId','NONE'))"

# 3. Check which key it was stored in
curl -s "https://saywhatwant-do-worker.bootloaders.workers.dev/api/admin/list-keys" \
  | python3 -c "import json, sys; \
  print('Checking for key with test-session-123:'); \
  keys=json.load(sys.stdin)['keys']; \
  matches=[k for k in keys if 'test-session-123' in k]; \
  print(f'Found {len(matches)} keys:'); \
  [print(f'  {k}') for k in matches]"
```

**This traces:**
- POST → What ID was assigned
- Pending → Is it queryable with sessionId
- Keys → Which key format was used

### Technique 5: PM2 Session Tracking

**Verify PM2 generated and used sessionId:**

```bash
# Check PM2 logs for session ID
npx pm2 logs ai-bot-do --lines 200 --nostream 2>&1 \
  | grep "Starting session:" \
  | tail -5

# Expected:
# [GOD-MODE] Starting session: 1763027011418-1mmzaea

# Check if that sessionId appears in payloads
npx pm2 logs ai-bot-do --lines 500 --nostream 2>&1 \
  | grep "1763027011418-1mmzaea"

# Should appear in:
# - Starting session log
# - Session complete log
# - Possibly in payload logs (if we log botParams)
```

### Technique 6: Conversation Log Cross-Reference

**Use conversation logs to find session IDs:**

```bash
# List recent God Mode conversation logs
ls -lt /path/to/AI-Bot-Deploy/conversation-logs/GodMode*.txt | head -5

# Example:
# GodMode171181106Human231080166-session-1763027011418-1mmzaea.txt

# Extract session ID from filename
SESSION_ID=$(ls -t conversation-logs/GodMode*.txt | head -1 | grep -o 'session-[^.]*' | cut -d- -f2-)

echo "Latest session ID: $SESSION_ID"

# Search DO for that session key
curl -s "https://saywhatwant-do-worker.bootloaders.workers.dev/api/admin/list-keys" \
  | python3 -c "import json, sys; \
  keys=json.load(sys.stdin)['keys']; \
  matches=[k for k in keys if '$SESSION_ID' in k]; \
  print(f'DO keys with session {SESSION_ID}: {len(matches)}'); \
  [print(f'  {k}') for k in matches]"
```

**Cross-reference:**
- Conversation log exists → PM2 processed it
- DO key exists → Storage working
- DO key missing → Routing broken

### Technique 7: Check botParams Preservation

**Verify DO worker preserves all botParams fields:**

```bash
# Post message with custom botParams
curl -X POST https://saywhatwant-do-worker.bootloaders.workers.dev/api/comments \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Test message",
    "username": "TestUser",
    "color": "123123123",
    "message-type": "AI",
    "replyTo": "test123",
    "botParams": {
      "humanUsername": "Human",
      "humanColor": "231080166",
      "entity": "god-mode",
      "ais": "GodMode:171181106",
      "sessionId": "test-preserve-123",
      "customField": "should-this-survive"
    }
  }'

# Retrieve and check
curl -s "https://saywhatwant-do-worker.bootloaders.workers.dev/api/comments?after=0&limit=1" \
  | python3 -c "import json, sys; data=json.load(sys.stdin); \
  msg=data[0]; bp=msg.get('botParams',{}); \
  print('botParams fields preserved:'); \
  print(f'  sessionId: {\"sessionId\" in bp}'); \
  print(f'  customField: {\"customField\" in bp}'); \
  print(f'\\nAll fields: {list(bp.keys())}')"
```

**This reveals:**
- Which fields DO worker preserves
- Which fields get dropped
- If sessionId is being stripped

### Technique 8: Cloudflare Deployment Verification

**Confirm deployment actually updated:**

```bash
# Get current deployment version
curl -s "https://saywhatwant-do-worker.bootloaders.workers.dev/api/comments?after=0&limit=1" \
  -H "Cache-Control: no-cache" \
  | python3 -c "import json, sys; msg=json.load(sys.stdin)[0]; \
  bp=msg.get('botParams',{}); \
  print('Deployment check:'); \
  print(f'  sessionId field exists: {\"sessionId\" in bp}'); \
  print(f'  If FALSE: Deployment not propagated or code not deployed')"

# Force cache clear
curl -s "https://saywhatwant-do-worker.bootloaders.workers.dev/api/comments?after=0&limit=1&_nocache=$(date +%s)" \
  > /dev/null

# Try again after cache clear
```

**Cloudflare propagation:**
- Can take 5-30 seconds
- Test endpoint directly (not through frontend)
- Use cache-busting parameters

---

## Advanced Debugging Patterns

### Pattern 1: God Mode Session Not Creating Keys

**Symptoms:**
- PM2 logs show session ID
- Conversation logs created with session ID
- DO has 0 godmode: keys
- Messages in conv: keys instead

**Debug steps:**
1. Verify PM2 is sending sessionId (check logs)
2. Verify DO worker preserves sessionId (check stored message)
3. Verify routing logic triggers (check DO worker code line 152)
4. Test deployment propagation (wait 30s, try again)

**Common causes:**
- DO worker not preserving sessionId field
- Routing logic condition not met
- Deployment not propagated
- JavaScript error in DO worker

### Pattern 2: Large Synthesis Fails to Post

**Symptoms:**
- PM2 logs show synthesis generated (25KB+)
- Synthesis not in DO
- 500 error when posting
- Conversation breaks

**Debug steps:**
```bash
# Check conversation key size before synthesis
curl -s "https://saywhatwant-do-worker.bootloaders.workers.dev/api/conversation?..." \
  | python3 -c "import json, sys; data=json.load(sys.stdin); \
  size=len(json.dumps(data)); \
  print(f'{size:,} bytes'); \
  print(f'{(size/131072)*100:.1f}% of 128KB'); \
  print(f'Adding 25KB synthesis would exceed' if size > 106000 else 'Should fit')"
```

**Common causes:**
- Conversation key near 128KB limit
- Adding synthesis exceeds limit
- Need session-based storage

### Pattern 3: Frontend Not Seeing God Mode Messages

**Symptoms:**
- PM2 processed God Mode
- Messages in DO
- Frontend doesn't display them

**Debug steps:**
```bash
# Check if frontend is polling with includeGodMode
# Browser console should show:
# [Presence Polling] ... (including God Mode)

# If not, check URL:
# - Has entity=god-mode? OR
# - Has filter with "GodMode" username?

# If neither: Frontend won't poll godmode: keys!
```

---

**Status:** ✅ COMPLETE - Agent testing methodology documented  
**Last Updated:** November 12, 2025  
**Audience:** AI Agents conducting system tests  
**Related:** README 173 (Context field fix), README 200 (God Mode sessions)

