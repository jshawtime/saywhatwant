# 151-STRESS-TEST-6-TAB-CONCURRENT.md

**Tags:** #stress-test #reliability #concurrent #queue #debugging  
**Created:** October 25, 2025  
**Status:** 🔴 IN PROGRESS - 1/6 replies received

---

## Test Objective

Verify system reliability under concurrent load: 6 browser tabs posting messages ~2 seconds apart. Goal is 100% reliability (6/6 AI replies), not speed. Focus on PM2 queue and Ollama processing, not frontend (frontend working correctly).

---

## Test Procedure

### Setup
- 6 browser tabs open to same filtered conversation
- Messages sent ~2 seconds apart per tab
- Wait 5+ minutes for processing (allow for model loading)
- Generous timing to expose true bugs, not edge cases

### Message Format
- Tab 1: "1"
- Tab 2: "2"  
- Tab 3: "3"
- Tab 4: "4"
- Tab 5: "5"
- Tab 6: "6"

**Easy to track which tab sent which message.**

---

## Test #1 Results - October 25, 2025 12:38 PM

### Messages Sent

| Tab | Message | Time Sent | Expected Reply |
|-----|---------|-----------|----------------|
| 1 | "1" | 12:38:00 PM | EmotionalGuide reply |
| 2 | "2" | 12:38:03 PM | EmotionalGuide reply |
| 3 | "3" | 12:38:10 PM | EmotionalGuide reply |
| 4 | "4" | 12:38:13 PM | EmotionalGuide reply |
| 5 | "5" | 12:38:17 PM | EmotionalGuide reply |
| 6 | "6" | 12:38:22 PM | EmotionalGuide reply |

### Actual Results (Checked at 12:46 PM - 8 minutes later)

| Tab | Reply Received | Status |
|-----|----------------|--------|
| 1 | ❌ No reply | FAILED |
| 2 | ❌ No reply | FAILED |
| 3 | ✅ Reply at 12:38:31 PM | SUCCESS (21s) |
| 4 | ❌ No reply | FAILED |
| 5 | ❌ No reply | FAILED |
| 6 | ❌ No reply | FAILED |

**Result: 1/6 replies (17% success rate) - UNACCEPTABLE**

---

## Initial Analysis

### What Worked
- ✅ Tab 3 received reply (21 seconds - reasonable for model loading)
- ✅ Frontend posting works (all 6 messages sent)
- ✅ Not a filter issue (Tab 3 reply appeared)

### What Failed
- ❌ 5 out of 6 messages got no reply
- ❌ Not an Ollama issue (Tab 3 worked, so Ollama is running)
- ❌ Likely PM2 queue or message processing issue

---

## Investigation Plan

### Step 1: Check KV for All 6 Human Messages
Look for messages with IDs containing:
- Text: "1", "2", "3", "4", "5", "6"
- Timestamp around 12:38:00-12:38:22 PM
- Check `processed` flag status

**Expected:** All 6 should exist with `processed: true` or `false`

### Step 2: Check KV for AI Responses
Look for EmotionalGuide responses to messages 1, 2, 4, 5, 6

**Expected:** If AI response exists, PM2 processed it. If missing, PM2 never processed or Ollama failed.

### Step 3: Check PM2 Logs on 10.0.0.100
```bash
cd ~/Desktop/hm-server-deployment/AI-Bot-Deploy
npx pm2 logs ai-bot --lines 500 | grep -E "QUEUE|Queued|emotional-intelligence"
```

**Look for:**
- How many messages were queued?
- How many were claimed by workers?
- Any errors or failures?

### Step 4: Check Queue Monitor Dashboard
- How many items in queue?
- Any stuck items?
- LLM Server logs showing requests?

---

## Hypotheses

### Hypothesis #1: Messages Lost in Queue
**Theory:** PM2 queued all 6, but only 1 was claimed/processed  
**Test:** Check PM2 logs for queue activity  
**Fix:** Investigate queue claiming logic, worker availability

### Hypothesis #2: Ollama Queue Overflow  
**Theory:** Ollama has internal queue limit, dropped 5 requests  
**Test:** Check Ollama logs, check OLLAMA_MAX_QUEUE setting  
**Fix:** Increase queue size or add retry logic

### Hypothesis #3: PM2 Only Saw Some Messages
**Theory:** PM2 polling missed 5 messages (cache issue?)  
**Test:** Check which messages have `processed: false` in KV  
**Fix:** Improve cache reliability or polling logic

### Hypothesis #4: Worker Claiming Race Condition
**Theory:** Multiple workers tried to claim same message, conflicts  
**Test:** Check PM2 logs for claim patterns  
**Fix:** Improve atomic claiming logic

---

## Next Steps

1. Investigate KV entries for all 6 messages
2. Check PM2 logs for queue activity  
3. Identify which messages were queued vs processed
4. Determine where the 5 failures occurred in the pipeline
5. Implement fix based on findings
6. Re-test with same 6-tab procedure

---

---

## Investigation Results - Test #1

### PM2 Log Analysis

**Messages discovered by PM2:**
- Message "1" (`1761421080052`) - PATCHED ✅ at 19:38:03, QUEUED ✅ at 19:38:04
- Message "2" (`1761421083xxx`) - **NOT IN LOGS AT ALL** ❌
- Message "3" (`1761421090043`) - PATCHED ✅ at 19:38:28, QUEUED ✅ at 19:38:29, PROCESSED ✅, POSTED ✅
- Message "4" (`1761421093110`) - PATCHED ✅ at 19:38:30, QUEUED to **ASTROPHYSICS** ❌ (wrong entity!)
- Message "5" (`1761421097169`) - PATCHED ✅ at 19:38:32, **NOT QUEUED** ❌
- Message "6" (`1761421102449`) - PATCHED ✅ at 19:38:33, QUEUED to **ASTROPHYSICS** ❌ (wrong entity!)

### Critical Findings

**Issue #1: Message "2" Never Seen by PM2**
- Frontend posted it
- Worker should have saved to KV  
- PM2 polling never fetched it
- **Cache didn't update or PM2 missed it in cache**

**Issue #2: Wrong Entity Selected**
- Messages 4 and 6 queued to "astrophysics" instead of "emotional-intelligence"
- All 6 tabs had same `entity=emotional-intelligence` in URL
- **Entity selection logic is broken or random**

**Issue #3: Message "5" Patched But Not Queued**
- PATCH succeeded  
- But message was never queued for processing
- **Code after PATCH didn't execute?**

**Issue #4: Only Message "3" Fully Processed**
- PATCHED → QUEUED → PROCESSED → POSTED
- Got AI response in frontend
- **Why only this one succeeded?**

---

## Root Cause Analysis

**The 1-second KV propagation delay (line 488):**
```javascript
await new Promise(resolve => setTimeout(resolve, 1000));
```

**This is BLOCKING the bot's main polling loop!**

**Timeline:**
```
19:38:00 - Poll discovers message "1"
19:38:00 - Start 1s wait...
19:38:01 - PATCH message "1"
19:38:01 - Queue message "1"
19:38:03 - Poll again, discovers message "2"
19:38:03 - Start 1s wait...
(Meanwhile, messages 3, 4, 5, 6 posted within 22 seconds!)
19:38:04 - PATCH message "2"... but WHERE IS IT IN LOGS?
```

**The 1s blocking delay is causing the bot to process messages VERY SLOWLY, missing some entirely!**

**Also:** 6 workers but only processing 1-2 messages? Workers might be waiting or blocked!

---

## Recommended Fix

**REMOVE the 1-second delay entirely!**

The KV key simplification (README-148) means PATCH now uses direct access `comment:{messageId}` - **no KV.list() needed, so no propagation delay needed!**

**The 1s delay was for KV.list() cursor pagination to find the message.**

**Now that we use direct access, it's instant and doesn't need propagation time!**

---

---

## Fix #1: Remove 1-Second Blocking Delay

**Problem:** The 1s delay in PM2 bot (line 488) blocks the polling loop  
**Impact:** Bot processes messages slowly, misses some in cache  
**Solution:** Remove delay - not needed with direct KV access!

**File:** `AI-Bot-Deploy/src/index.ts` line 488  
**Changed:** Removed `await new Promise(resolve => setTimeout(resolve, 1000));`  
**Reason:** KV key format is now `comment:{messageId}` - direct access is instant, no propagation delay needed!

**Built:** ✅ PM2 bot rebuilt  
**Status:** Ready for restart and Test #2

---

## Outstanding Issues for Next Test

**Still need to fix:**
1. ❌ Message "2" not seen by PM2 (cache issue?)
2. ❌ Wrong entity selection (messages 4 & 6 went to astrophysics)
3. ❌ Message "5" patched but not queued

**Next test will reveal if removing 1s delay fixes these or if there are deeper issues.**

---

**Status:** Fix #1 implemented - await PM2 restart for Test #2  
**Last Updated:** October 25, 2025 12:51 PM - 1s delay removed, ready to retest

