# DO Bot Logging Strategy

**Created**: 2025-11-01  
**Context**: Rethinking logs for Durable Objects architecture

---

## Philosophy: Log What Matters

**KV Bot** logged operation counts (`KVr:3 KVw:1`) because cache sync was fragile.  
**DO Bot** doesn't need this - state is always consistent.

### What DO Eliminates

❌ **No longer needed**:
- `KVr:X KVw:Y` - Operation counts (state always consistent)
- Self-heal logs (not needed anymore)
- Cache verification logs
- "Ghost message" debugging

✅ **Still needed**:
- Message processing flow (claim → AI → post → complete)
- Ollama generation status
- Error conditions
- Performance metrics

---

## Proposed Log Levels

### 1. **IDLE State** (Minimal)
When no messages pending:
```
[POLL 23] Idle
```

**Why**: Don't spam logs every 3 seconds when nothing is happening.

### 2. **ACTIVE State** (Detailed)
When processing a message:
```
[CLAIMED] Human [abc123] "Why is the sky blue?" | Entity: fear-and-loathing
[OLLAMA] Generating... (model: fear-and-loathing-f16)
[OLLAMA] ✓ 340 chars in 3.2s
[POSTED] AI [xyz789] → abc123
[COMPLETE] abc123 (total: 3.4s)
```

**Why**: Full visibility when work is being done.

### 3. **ERROR State** (Always Show)
Any failures:
```
[ERROR] Ollama timeout after 5m
[ERROR] Entity not found: invalid-entity
[ERROR] DO request failed: 500
```

**Why**: Always surface problems.

---

## Detailed Breakdown

### Polling Logs

**Current**:
```
[2025-11-01 21:56:52] [POLL 20] [DOr:1 DOw:0] Fetching pending messages...
```

**Proposed** (Idle):
```
[POLL 20] Idle
```

**Proposed** (Active):
```
[POLL 21] Found 3 pending messages
```

**Rationale**: 
- `[DOr:1 DOw:0]` doesn't help debug anything in DO
- Timestamp is already in PM2 logs
- "Fetching pending messages..." is noise

### Message Processing

**Current**:
```
[2025-11-01 21:47:35] [WORKER] ✅ Claimed:
  Human [6k9e6kmsrq]
  Time: 2025-11-01 21:47:35 UTC
  Entity: fear-and-loathing
  Text: Tell me about the American Dream
```

**Proposed**:
```
[CLAIMED] Human:6k9e6kmsrq | fear-and-loathing | "Tell me about the American Dream"
```

**Rationale**:
- One line instead of 5
- All critical info preserved
- Easier to scan visually

### Ollama Generation

**Current**:
```
[bot-1762033647449] [Ollama] Generating response for FearAndLoathing using model fear-and-loathing-f16
[bot-1762033647449] [Ollama] Generated response (340 chars)
```

**Proposed**:
```
[OLLAMA] fear-and-loathing-f16 → generating...
[OLLAMA] ✓ 340 chars in 3.2s
```

**Rationale**:
- Show model being used
- Show timing (important for performance)
- Single ✓ symbol for success

### AI Response Posting

**Current**:
```
[2025-11-01 21:47:38] [POST] Posting AI: FearAndLoathing color:225080170 replyTo:6k9e6kmsrq
[2025-11-01 21:47:38] [POST] AI response posted: f28clijp4e
```

**Proposed**:
```
[POSTED] AI:f28clijp4e → Human:6k9e6kmsrq
```

**Rationale**:
- One line instead of 2
- Show relationship (AI → Human)
- Color is in config, not useful in logs

### Completion

**Current**:
```
[2025-11-01 21:47:38] [WORKER] ✅ Completed:
  Human [6k9e6kmsrq]
  Time: 2025-11-01 21:47:35 UTC
  Entity: fear-and-loathing
  Text: Tell me about the American Dream
```

**Proposed**:
```
[COMPLETE] Human:6k9e6kmsrq | AI:f28clijp4e (3.4s total)
```

**Rationale**:
- Don't repeat info from CLAIMED log
- Show total time (useful metric)

---

## Complete Example Flow

### Before (Verbose)
```
[2025-11-01 21:47:35] [POLL 19] [DOr:1 DOw:0] Fetching pending messages...
[2025-11-01 21:47:35] [WORKER] Found 1 pending messages
[2025-11-01 21:47:35] [WORKER] ✅ Claimed:
  Human [6k9e6kmsrq]
  Time: 2025-11-01 21:47:35 UTC
  Entity: fear-and-loathing
  Text: Tell me about the American Dream
[bot-1762033647449] [Ollama] Generating response for FearAndLoathing using model fear-and-loathing-f16
[bot-1762033647449] [Ollama] Generated response (340 chars)
[2025-11-01 21:47:38] [POST] Posting AI: FearAndLoathing color:225080170 replyTo:6k9e6kmsrq
[2025-11-01 21:47:38] [POST] AI response posted: f28clijp4e
[2025-11-01 21:47:38] [WORKER] ✅ Completed:
  Human [6k9e6kmsrq]
  Time: 2025-11-01 21:47:35 UTC
  Entity: fear-and-loathing
  Text: Tell me about the American Dream
[2025-11-01 21:47:39] [POLL 1] [DOr:1 DOw:0] Fetching pending messages...
```

**14 lines**

### After (Concise)
```
[POLL 19] Idle
[POLL 20] Found 1 pending
[CLAIMED] Human:6k9e6kmsrq | fear-and-loathing | "Tell me about the American Dream"
[OLLAMA] fear-and-loathing-f16 → generating...
[OLLAMA] ✓ 340 chars in 3.2s
[POSTED] AI:f28clijp4e → Human:6k9e6kmsrq
[COMPLETE] Human:6k9e6kmsrq | AI:f28clijp4e (3.4s total)
[POLL 1] Idle
```

**8 lines** (43% reduction)

---

## Benefits

1. **Easier to scan**: One line per event
2. **Less noise**: Idle polls don't spam
3. **Better metrics**: Show timing
4. **No meaningless data**: Removed `DOr/DOw` (not useful in DO)
5. **Still debuggable**: All critical info preserved

---

## Implementation

### Log Format Template

```typescript
// Idle polling
`[POLL ${count}] Idle`

// Active polling
`[POLL ${count}] Found ${n} pending`

// Claimed
`[CLAIMED] Human:${msgId} | ${entity} | "${text.substring(0, 50)}"`

// Ollama start
`[OLLAMA] ${modelName} → generating...`

// Ollama success
`[OLLAMA] ✓ ${charCount} chars in ${duration}s`

// Ollama error
`[OLLAMA] ✗ ${errorMessage}`

// Posted
`[POSTED] AI:${aiMsgId} → Human:${humanMsgId}`

// Complete
`[COMPLETE] Human:${humanMsgId} | AI:${aiMsgId} (${totalDuration}s total)`

// Error
`[ERROR] ${context} | ${errorMessage}`
```

---

## Questions for Discussion

1. **Keep `[DOr:1 DOw:0]`?**
   - Pros: Shows DO is working
   - Cons: Not useful for debugging, adds noise
   - **Recommendation**: Remove

2. **Show model name on every generation?**
   - Pros: Useful to see which quantization is being used
   - Cons: Adds ~20 chars per log
   - **Recommendation**: Keep (useful for performance tuning)

3. **Log full message text or truncate?**
   - Pros (full): Complete context
   - Cons (full): Very long logs
   - **Recommendation**: Truncate to 50 chars with "..."

4. **Show timestamps?**
   - PM2 already adds timestamps to logs
   - **Recommendation**: Don't duplicate

5. **Separate log levels (DEBUG, INFO, ERROR)?**
   - Current: Everything goes to stdout
   - **Recommendation**: Keep simple, use prefixes: `[POLL]`, `[CLAIMED]`, `[ERROR]`

---

## Migration Plan

1. Create new logger module: `src/modules/doLogger.ts`
2. Implement new format functions
3. Replace existing console.log calls
4. Test with stress test (ensure readability)
5. Deploy and monitor

**Estimated effort**: 1-2 hours  
**Risk**: Low (only logging changes, no business logic)

---

## Appendix: Current vs Proposed

| Event | Current Lines | Proposed Lines | Savings |
|-------|---------------|----------------|---------|
| Idle Poll | 1 | 1 | 0% |
| Active Poll | 2 | 2 | 0% |
| Claimed | 5 | 1 | 80% |
| Ollama Gen | 2 | 2 | 0% |
| Posted | 2 | 1 | 50% |
| Completed | 5 | 1 | 80% |
| **Total** | **17** | **8** | **53%** |

**Per message**: 53% fewer log lines, same debuggability

