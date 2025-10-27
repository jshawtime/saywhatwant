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

**IMPORTANT: Check if export has URL field!**
```
URL: https://saywhatwant.app/#u=Human:080195229+EmotionalGuide:186207080...
```

**If URL is missing:** Tab is using OLD cached code! Hard refresh that specific tab (Cmd+Shift+R) or close and reopen.

**Known issue:** Chrome sometimes caches old code even after hard refresh. If 5/6 tabs show URL but 1/6 doesn't, that tab has stale code. Close it and open fresh.

**You now have:**
- **Message IDs** for exact lookup
- **UTC timestamps** matching KV/PM2
- **Entity** selection
- **Color** values (human's color)
- **AIS parameter** - shows what AI color/username the FILTER expects!
- **Status** (pending/complete/failed)
- **ReplyTo** links

**CRITICAL:** The AIS field shows what your filter is looking for!
```
AIS: EmotionalGuide:080203170
```
This means the frontend will ONLY show AI responses with username "EmotionalGuide" AND color "080203170"!

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
CACHE_SIZE may change. The below example is a conceptual reference only. CACHE_SIZE n is the only way to accurately understand. Self healing should fix cache size issues anyway.
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
1. **Worker POST failed** - Check response.status in PM2 logs
2. **Frontend filter rejected it** - Color mismatch (most common!)
3. **Message in KV but outside cache window** - Check with direct KV key lookup
4. **Network timeout during POST** - Would show error in PM2 logs

**How to investigate each:**

**1. Check if POST succeeded:**
```bash
# PM2 logs now show:
[POST] Posting AI: EmotionalGuide color:080203170 replyTo:1761569423412
[POST] Worker confirmed: 1761569430123-abc123
```
If you see "Worker confirmed" → POST succeeded, message IS in KV!

**2. Check for color mismatch:**
```
Filter expects: EmotionalGuide:080203170
Bot posted with: EmotionalGuide:080229166  ← MISMATCH!
```
Filter rejects → message in KV but not displayed!

**3. Check KV directly by messageId:**
```bash
curl "https://sww-comments.bootloaders.workers.dev/api/comments/[messageId]"
```
If found → it's in KV, just not in cache!

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

### Issue: Message Has No AI Reply (Still Pending)

**COPY ALL shows:**
```
Human [1761597329124-whudmew0k]
  Time: 10/27/2025, 1:35:29 PM
  Status: pending  ← Still pending after 3+ minutes!
  Entity: mental-health
  Text: What's another?
```

**PM2 logs show:**
```bash
grep "1761597329124" ~/.pm2/logs/ai-bot-simple-out.log
```

**Results:**
```
[WORKER] ✅ Claimed
[PROCESS] Got response (313 chars)  ← Ollama responded!
[TRIM] Trimmed after "Human:" - 313 → 1 chars  ← Almost everything trimmed!
[POST] ❌ Text empty after filtering, skipping post  ← Didn't post!
[WORKER] ✅ Completed
```

**Diagnosis:** LLM role-played as human, entire response was trimmed by `trimAfter: ["Human:"]` filter!

**What happened:**
1. User asked: "What's another?"
2. Ollama generated: "Human: Another benefit is..." (313 chars)
3. trimAfter found "Human:" very early
4. Trimmed everything after it → 1 char left
5. Empty check: ❌ Skipped posting
6. Message marked complete but NO AI response posted

**How to confirm:**
- PM2 logs show "Text empty after filtering"
- PM2 logs show trimmed chars: 313 → 1 (or similar drastic reduction)
- Message status: pending forever (never gets AI response)

**This is CORRECT behavior** - filtering prevented posting garbage role-play response!

**Success rate:** 97% (29/30) - occasional LLM role-play causes 3% loss, which is acceptable trade-off for quality.

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

### Real Case Study: Message Missing After 6-Tab Stress Test

**Date:** October 27, 2025 13:31 UTC

**COPY ALL - verbose shows:**
```
Human [1761571872625-2qa6p4o4k]
  Time: 2025-10-27 13:31:12 UTC
  Color: 080195229
  Entity: emotional-intelligence
  AIS: EmotionalGuide:186207080  ← Filter expects this color!
  Text: Why are socks colorful sometimes?
```

**Step 1: Check PM2 logs**
```bash
grep "1761571872625" ~/.pm2/logs/ai-bot-simple-out.log
```

**Results:**
```
[WORKER] Found 1 pending messages: 1761571872625-2qa6p4o4k ✅
[WORKER] ✅ Claimed
[PROCESS] Got response (133 chars) ✅
[POST] Posting AI: EmotionalGuide color:186207080 ✅ Color matches!
[POST] Worker confirmed: 1761571878343-oqdi9sg ✅ POST succeeded!
[WORKER] ✅ Completed
```

**Step 2: Check KV cache (200 messages)**
```bash
curl ".../api/comments?limit=200" | python3 check_for_id.py
```

**Results:**
```
Total messages in cache: 111 (not 200!)
AI response 1761571878343-oqdi9sg: NOT FOUND
Cache order: Oldest first
```

**Step 3: Analysis**

**What we know:**
1. ✅ PM2 processed message successfully
2. ✅ Worker accepted POST (returned ID)
3. ✅ Color matches filter expectations
4. ❌ AI response NOT in cache at all
5. ❌ Cache only has 111 messages (should have 200)
6. ❌ Waited 5+ minutes - did NOT self-heal

**Diagnosis:** Worker's `addToCache()` function failed to add the AI response to cache! The message was saved to its individual KV key but cache wasn't updated.

**Why self-healing didn't work:**
- Self-healing assumes message is in individual KV key with `status='pending'`
- PM2 would re-discover it on next poll
- But this is an AI response (already posted), not a pending human message
- No self-healing mechanism for missing AI responses in cache

**Root cause:** Cache order was wrong! Worker was keeping oldest 111 messages instead of newest 200.

**Fix:** Sort cache by timestamp before trimming - ensures newest messages always kept.

**Success criteria:** 100% ONLY - no exceptions! 83% is NOT acceptable, 99% is NOT acceptable. Every message MUST get AI response or it's a bug that needs fixing.

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

## Known Issues (Acceptable Trade-offs)

### Issue: Messages Lost During Worker Deployment

**Symptom:**
- Message posted during Worker deployment window
- PM2 logs show: "Posted AI response" ✅
- Worker logs show: "Worker confirmed: [messageId]" ✅
- But message NOT in cache ❌
- Frontend doesn't display it

**Why it happens:**
1. Worker deployment clears cache (cache starts empty)
2. Messages posted in first 30-60 seconds after deployment
3. Those messages saved to individual KV keys ✅
4. But cache was empty/rebuilding during POST
5. Cache accumulation missed those early messages
6. Cache only includes messages posted AFTER accumulation stabilized

**Example timeline:**
```
21:06:00 - Worker deployed, cache empty
21:06:27 - Message posted, saved to KV ✅
21:06:27 - addToCache() called, cache still empty/unstable
21:06:54 - Next message posted, cache accumulation working ✅
... (cache grows from here)
```

**Why we accept this:**
- Only happens during Worker deployments (rare in production)
- Affects ~30-60 seconds worth of messages
- Messages ARE in individual KV keys (not lost from KV!)
- Just not in cache, so frontend polling doesn't see them
- User can repost if needed (happens so rarely it's acceptable)

**Trade-off decision:**
- ✅ Simple cache accumulation (zero rebuild cost)
- ✅ Fast and scalable
- ❌ Lose messages during deployment window (rare, acceptable)
- **Better than:** Complex rebuild with KV.list() costing $900+/month

**Frequency:** Only during deployments (maybe 1-2 times per month in production)

**Impact:** Minimal - affects < 5 messages per deployment, user can repost

**This is an ACCEPTABLE trade-off for the cost savings and simplicity!**

---

**Status:** Standard workflow for all future debugging  
**Related:** README-154 (COPY ALL - verbose implementation), README-155 (Cache accumulation architecture)

