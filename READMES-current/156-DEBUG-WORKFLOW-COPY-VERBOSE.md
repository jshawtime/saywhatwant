# 156-DEBUG-WORKFLOW-COPY-VERBOSE.md

**Tags:** #debugging #workflow #copy-verbose #investigation #cross-reference  
**Created:** October 27, 2025  
**Status:** ✅ COMPLETE - Standard debugging workflow

---

## Debugging Workflow Using COPY ALL - Verbose

### Quick Investigation Process

**When messages fail or behave unexpectedly, use this 3-step workflow:**

### Step 1: Get COPY ALL - Verbose Export

1. Right-click domain title in frontend
2. Click "Copy ALL - verbose"
3. Paste into text editor

**You now have:**
- Message IDs for exact lookup
- UTC timestamps matching KV/PM2
- Entity selection
- Color values
- Status (pending/complete/failed)
- ReplyTo links

### Step 2: Cross-Reference with PM2 Logs

```bash
grep "[messageId]" ~/.pm2/logs/ai-bot-simple-out.log
```

**PM2 verbose format matches COPY ALL exactly:**
```
[WORKER] ✅ Claimed:
  Human [1761539881444-bplfpcqcv]
  Time: 2025-10-27 04:38:01 UTC
  Entity: emotional-intelligence
  Text: My recommendation: Option D - Remove TTL...
```

**Verify:**
- ✅ Was message discovered? (search for ID)
- ✅ Which entity processed it? (Entity line)
- ✅ When was it claimed/completed? (timestamps)

### Step 3: Check KV for Ground Truth

```bash
curl "https://sww-comments.bootloaders.workers.dev/api/comments?limit=20" | grep [messageId]
```

**Verify:**
- ✅ Message exists in KV
- ✅ Status field correct (pending/complete)
- ✅ Entity matches expected
- ✅ ReplyTo links valid

---

## Common Issues & Diagnosis

### Issue: Message Posted But No AI Reply

**COPY ALL shows:**
```
Human [1761535317016-h9ixux3ot]
  Status: pending  ← Still pending!
  Entity: stress-helper
```

**Check PM2:**
```bash
grep "1761535317016" ~/.pm2/logs/ai-bot-simple-out.log
# No results = bot never saw it!
```

**Check KV:**
```bash
curl "...api/comments?limit=50" | grep "1761535317016"
# Not found = never saved to KV!
```

**Diagnosis:** Worker POST failed or message fell out of cache

**IMPORTANT: Before assuming cache issue, do the math!**

**Cache Math:**
- CACHE_SIZE = 200 messages
- Each stress test: 6 human + 6 AI = 12 messages
- Headroom: 200 - 12 = **188 messages of safety!**

**Cache would only be an issue if:**
- You post 100+ messages in rapid succession
- Cache fills with 200 messages
- Your message gets pushed out before frontend polls

**But even then, it self-heals:**
- Message exists in individual KV key with `status='pending'`
- Next PM2 poll (3 seconds later) checks actual KV keys
- Pending endpoint verifies status from KV, not cache
- Message gets discovered and processed

**So cache is almost NEVER the issue - it's:**
1. Worker POST actually failed (check Worker logs)
2. Frontend filter rejecting the response (color mismatch)
3. Message posted but to wrong KV namespace (rare)
4. Network timeout during POST

**DON'T assume cache until you verify the math shows it's actually full!**

---

### Investigation Protocol (CRITICAL)

**When a message doesn't appear:**

1. **Gather evidence first** - Run all 3 diagnostic steps
2. **Do the math** - Is cache actually full? (usually NO!)
3. **Form hypothesis** - Based on evidence, not assumptions
4. **CHECK WITH OWNER** - Present hypothesis and evidence
5. **Wait for confirmation** - Don't implement fix until approved
6. **Then fix** - Implement confirmed solution only

**Example of WRONG approach:**
```
❌ "Message missing → must be cache → increase cache size"
```

**Example of RIGHT approach:**
```
✅ "Message missing → check PM2 (found/processed) → check KV (not found)
   → PM2 posted it but not in KV
   → Worker POST might have failed
   → Check Worker logs for errors
   → Present findings to owner before fixing"
```

**NEVER assume root cause without evidence and owner confirmation!**

---

### Issue: Wrong Entity Responded

**COPY ALL shows:**
```
Human [ID]
  Entity: stress-helper  ← Expected StressHelper

AI [ID]  
  Username: EmotionalGuide  ← Wrong! Got EmotionalGuide instead
```

**PM2 logs show:**
```
[PROCESS] Processing with EmotionalGuide (emotional-intelligence)
```

**Diagnosis:** Bot used wrong entity - check botParams in KV for corruption

---

## Benefits

**Debugging time:**
- Before: 10+ minutes (manual KV checks, log searching, guesswork)
- After: 30 seconds (copy, grep messageID, done!)

**Information density:**
- One COPY ALL export contains everything needed
- No switching between browser/terminal/KV dashboard
- UTC timestamps eliminate timezone confusion
- Message IDs enable instant lookup

**Cross-reference workflow:**
1. Frontend (COPY ALL - verbose) → What user sees
2. PM2 logs (grep messageID) → What bot processed
3. KV (curl + grep) → Ground truth

**All three sources use identical format (messageID, UTC time, entity) making correlation instant!**

---

**Status:** Standard workflow for all future debugging  
**Related:** README-154 (COPY ALL - verbose implementation)

