# Hypothesis Testing Framework

**Created:** October 21, 2025  
**Purpose:** Scientific approach to debugging and testing  
**Philosophy:** Theory before action, prediction before observation

---

## Introduction

This document establishes a **hypothesis-driven testing methodology** for SayWhatWant development. Instead of trial-and-error debugging, we formulate explicit hypotheses with technical predictions for both possible outcomes before running tests.

### Why This Matters

**Traditional debugging approach:**
1. Something breaks
2. Try random fixes
3. Test and see what happens
4. Repeat until it works

**Problems:**
- Wastes time on unfocused attempts
- Doesn't build understanding
- Same issues recur
- No learning captured

**Hypothesis-driven approach:**
1. Observe symptoms
2. Formulate hypothesis with technical reasoning
3. Predict outcomes for both true/false cases
4. Run controlled test
5. Analyze results against predictions
6. Document learnings

**Benefits:**
- Forces deeper thinking before acting
- Builds mental models of system behavior
- Creates reusable knowledge
- Accelerates future debugging
- Captures reasoning for future reference

### How to Use This Document

**For each test:**
1. **Before testing:** Write hypothesis with technical predictions
2. **Run test:** Execute controlled experiment
3. **After testing:** Document actual results
4. **Analyze:** Compare predictions to reality, update mental model

**Each entry contains:**
- **Test description:** What we're testing
- **Timestamp:** When hypothesis was formed
- **Hypothesis:** What we predict will happen
- **If TRUE reasoning:** Technical explanation for positive case
- **If FALSE reasoning:** Technical explanation for negative case
- **Test results:** Actual outcome observed
- **Analysis:** Why predictions were correct/incorrect

---

## Testing Best Practices

### Before Formulating Hypothesis

1. **Observe symptoms carefully**
   - What exactly happened?
   - What logs show success/failure?
   - Is it consistent or intermittent?

2. **Review recent changes**
   - What code was modified?
   - What configuration changed?
   - What was working before?

3. **Consider the architecture**
   - Which components are involved?
   - What are the data flows?
   - Where could race conditions occur?

### Writing Good Hypotheses

**Good hypothesis:**
- Specific and testable
- Based on technical understanding
- Explains both outcomes
- References actual code/config

**Bad hypothesis:**
- Vague ("something is wrong")
- No technical reasoning
- Only explains one outcome
- Generic guesses

### After Testing

1. **Document everything**
   - Exact test procedure
   - Actual results observed
   - Any unexpected behaviors

2. **Compare to predictions**
   - Which predictions were accurate?
   - Which were wrong?
   - What was missing from mental model?

3. **Update understanding**
   - Revise mental model based on results
   - Document new insights
   - Apply learnings to future hypotheses

---

## Hypothesis Categories

### Performance Hypotheses
- Timing and latency issues
- Throughput and scaling
- Resource utilization

### Race Condition Hypotheses
- Concurrent access patterns
- State consistency
- Lock-free data structures

### Cache/Storage Hypotheses
- Cache invalidation strategies
- Persistence and consistency
- Data freshness vs availability

### Queue/Worker Hypotheses
- Message ordering
- Deduplication logic
- Worker coordination

### Integration Hypotheses
- Cross-component interactions
- API contracts
- Event timing

---

## Success Metrics

**This framework is working if:**
- We're catching bugs faster
- We understand system behavior better
- We're making fewer blind attempts
- Knowledge is being captured and reused
- Future debugging is accelerating

**Review this document often to assess effectiveness and refine approach.**


-----------------------------------------
HYPOTHESESE BELOW IN ORDER OF NEWEST TO OLDEST
-----------------------------------------


### Test #1: 4 Rapid Messages with Minimal Rate Limiting
**Timestamp:** October 21, 2025 - 6:50 AM Local Time


**Test:** Send message "617" from 4 different browser tabs in rapid succession (~2 seconds apart). Rate limiting set to effectively unlimited:
```json
"minSecondsBetweenPosts": 1,
"maxPostsPerMinute": 1000,
"maxPostsPerHour": 30000
```

**Hypothesis:** All 4 messages will receive AI replies and all replies will appear in the frontend.

**If the hypothesis is TRUE, it is likely caused by:**

1. **Rate limiting was the only blocker**
   - Previous test: `minSecondsBetweenPosts: 5` caused 1/4 messages to be skipped
   - Log showed: `[bot] Skipping queue: Must wait 4s before posting`
   - With `minSecondsBetweenPosts: 1`, all messages should pass rate limit check
   - Messages arrive ~2 seconds apart, all satisfy 1-second minimum

2. **Cache fix resolved race condition**
   - Worker no longer deletes cache on PATCH (commit `183aff2`)
   - Cache always exists during frontend polling
   - No rebuild delays that could cause missed messages
   - All 4 POST operations will find cache intact

3. **Single worker provides serialization**
   - `maxConcurrentWorkers: 1` means messages process sequentially
   - No race conditions between parallel workers
   - Each message fully completes (POST + PATCH) before next starts
   - Message IDs remain correct throughout processing

**If the hypothesis is FALSE (fewer than 4 replies appear), it is likely caused by:**

1. **Queue deduplication logic issue**
   - Bot uses `queuedThisSession` Map to prevent duplicate queueing
   - With 4 rapid messages, Map might see messages before they're marked processed
   - Rolling cleanup is every 5 minutes - might not clean fast enough for 4 rapid messages
   - Messages arriving within same 3-second polling cycle could trigger edge case

2. **KV eventual consistency**
   - Cloudflare KV has eventual consistency across edge locations
   - POST writes might not be immediately visible to GET requests
   - With 4 rapid POSTs, later GETs might miss earlier POSTs
   - Cache update might succeed but individual key reads lag

3. **Worker PATCH timing issue**
   - Each worker takes ~4-6 seconds to complete (LM Studio + KV operations)
   - With 4 messages queued rapidly, first message still processing when later messages arrive
   - PATCH might update wrong message ID if timing overlaps
   - Similar to bug we fixed with deep cloning (commit from earlier session)

4. **Frontend polling frequency**
   - Frontend polls every 5 seconds (default `cloudPollingInterval`)
   - If all 4 AI responses POST within a 5-second window
   - And PATCH invalidates cache (shouldn't happen but worth checking)
   - Frontend might miss responses that POST between poll cycles

**Test Result/Analysis:**

**What the outcome was:** ✅ **SUCCESS - All 4/4 messages received AI replies and all appeared in frontend**

**Why TRUE hypothesis was CORRECT:**

1. ✅ **Rate limiting was the only blocker**
   - With `minSecondsBetweenPosts: 1`, all 4 messages passed rate limit check
   - No "Skipping queue: Must wait" messages in logs
   - Each message separated by ~2 seconds satisfied the 1-second minimum
   - **Conclusion:** Previous failure was purely rate limiting, not a deeper issue

2. ✅ **Cache fix resolved race condition**
   - Worker no longer deletes cache on PATCH (commit `183aff2`)
   - All 4 AI responses appeared immediately in frontend
   - No delays or missing messages despite rapid succession
   - **Conclusion:** Cache remaining intact during PATCH operations is critical

3. ✅ **Single worker provides serialization**
   - Messages processed sequentially without race conditions
   - Each message fully completed (POST + PATCH) before next started
   - No message ID mismatches or duplicate processing
   - **Conclusion:** Single worker eliminates concurrency issues for now

**Why FALSE hypothesis paths were NOT triggered:**

- ❌ **Queue deduplication:** Not an issue - `queuedThisSession` Map worked correctly
- ❌ **KV consistency:** Not an issue - Cloudflare KV eventual consistency did not cause problems
- ❌ **PATCH timing:** Not an issue - Sequential processing prevented any timing overlaps
- ❌ **Frontend polling:** Not an issue - All responses visible despite 5-second polling interval

**Learnings captured:**

1. **Rate limiting is the primary throttle mechanism** - When working with rapid messages, entity-level rate limits (`minSecondsBetweenPosts`) are the first thing to check. They work as designed and effectively control message throughput.

2. **Cache invalidation fix is solid** - The change from deleting cache to updating in-place (commit `183aff2`) completely resolved the race condition. No missed messages even with 4 rapid posts.

3. **Single worker is stable** - With `maxConcurrentWorkers: 1`, the system handles rapid messages reliably. Sequential processing eliminates race conditions.

4. **System is ready for scale testing** - Now that basic rapid messaging works with 1 worker, we can test with multiple workers (`maxConcurrentWorkers: 6`) to verify the cache fix holds under parallel load.

**Next test recommendation:** Test with `maxConcurrentWorkers: 6` to verify cache fix works with parallel processing.

---

## Completed Hypotheses

_(Tests will be added here after completion with full analysis)_

-------------------------------------------

