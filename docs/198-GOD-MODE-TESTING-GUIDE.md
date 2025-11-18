# 198: God Mode Testing Guide

**Status:** ✅ Phase 1 implementation complete, ready for testing  
**Created:** 2025-11-11  
**Implementation:** hm-server-deployment commit b0847f1

## What Was Implemented

### Files Created/Modified
- ✅ `ai-entities/god-mode.json` - Entity configuration
- ✅ `src/index-do-simple.ts` - Special handler detection + God Mode functions
- ✅ Built successfully with `npm run build`
- ✅ Pushed to GitHub

### Architecture Implemented
1. **Special handler detection** (line 166-173)
   - Checks for `specialHandler: 'multiEntityBroadcast'`
   - Routes to `handleGodMode()` instead of normal processing

2. **handleGodMode function** (line 639-725)
   - Phase 1: Tests with 3 entities (the-eternal, aristotle, fear-and-loathing)
   - Posts initial status message
   - Processes entities serially with context building
   - Calls LM Studio for final synthesis

3. **Helper functions**
   - `processMessageWithEntity()` - Calls Ollama, posts response
   - `buildEnhancedPrompt()` - Context-aware prompting
   - `generateSynthesis()` - LM Studio synthesis
   - `postToAPI()` - Posts messages to DO

## Next Steps: Testing

### Step 1: Restart PM2 Worker
```bash
# SSH into PM2 machine (10.0.0.110)
ssh user@10.0.0.110

# Restart worker to load new code
pm2 restart sww-ai-bot

# Watch logs
pm2 logs sww-ai-bot
```

### Step 2: Test Existing Entities (Regression)
Test that normal entities still work:

**URL:**
```
https://saywhatwant.com/?human=Human:080210153&ais=TheEternal:080175220
```

**Test message:**
```
What is the meaning of life?
```

**Expected:**
- EQ score appears (0-100)
- TheEternal responds normally
- No God Mode activation
- Normal conversation continues

### Step 3: Test God Mode (Phase 1 MVP)

**URL:**
```
https://saywhatwant.com/?human=Human:080210153&ais=GodMode:200150080
```

**Test question:**
```
What is consciousness?
```

**Expected sequence:**
1. Human posts question
2. God Mode posts status: "🔮 Consulting 3 AI entities serially..."
3. TheEternal responds (~5 seconds)
4. Aristotle responds with context (~5 seconds)
5. FearAndLoathing responds with full context (~5 seconds)
6. God Mode posts synthesis: "⚡ [SYNTHESIS]" (~6-10 seconds)
7. Total time: ~20-25 seconds

**PM2 Logs to watch for:**
```
[GOD-MODE] Detected multi-entity broadcast request
[GOD-MODE] Starting multi-entity serial conversation
[GOD-MODE] Consulting 3 entities serially
[GOD-MODE] Round 1: the-eternal
[GOD-MODE] Calling Ollama: the-eternal-f16
[GOD-MODE] TheEternal generated 234 chars in 4521ms
[GOD-MODE] Round 2: aristotle
[GOD-MODE] Calling Ollama: aristotle-f16
[GOD-MODE] Aristotle generated 312 chars in 5234ms
[GOD-MODE] Round 3: fear-and-loathing
[GOD-MODE] Calling Ollama: fear-and-loathing-f16
[GOD-MODE] FearAndLoathing generated 287 chars in 4987ms
[GOD-MODE] All entities responded, generating synthesis with LM Studio...
[GOD-MODE] Calling LM Studio for synthesis...
[GOD-MODE] Synthesis generated in 7234ms (456 chars)
[GOD-MODE] Complete
```

### Step 4: Verify Entity Responses

**Check for context building:**
1. TheEternal should answer the question directly
2. Aristotle should reference TheEternal's perspective and add new angle
3. FearAndLoathing should reference both previous answers and provide unique view
4. Synthesis should summarize all 3 perspectives

**Check for diversity:**
- Each response should be unique (no repetition)
- Each should add something new
- Synthesis should identify themes and differences

## Troubleshooting

### Issue: God Mode not activating
**Check:**
- PM2 restarted? (`pm2 restart sww-ai-bot`)
- god-mode.json exists in ai-entities/
- Entity name exactly "GodMode" in URL (case-sensitive)

### Issue: Entities not responding
**Check:**
- Ollama running on 10.0.0.110? (`curl http://10.0.0.110:11434/api/tags`)
- Models exist: `the-eternal-f16`, `aristotle-f16`, `fear-and-loathing-f16`
- PM2 logs show Ollama calls?

### Issue: Synthesis fails
**Check:**
- LM Studio running on 10.0.0.100:1234?
- Test: `curl -X POST http://10.0.0.100:1234/v1/chat/completions -H "Content-Type: application/json" -d '{"model":"test","messages":[{"role":"user","content":"test"}]}'`
- Model loaded in LM Studio?
- 600-second timeout sufficient?

### Issue: Responses not in DO
**Check:**
- DO worker running? (`curl https://saywhatwant-do-worker.bootloaders.workers.dev/api/comments`)
- Network connectivity from PM2 to DO?
- PM2 logs show "Failed to post to API"?

## Success Criteria

### Phase 1 MVP Success = ALL of:
1. ✅ Existing entities still work (regression test passes)
2. ✅ God Mode activates on god-mode entity
3. ✅ 3 entities respond in correct order
4. ✅ Context builds correctly (later entities reference earlier ones)
5. ✅ Responses show diversity (no repetition)
6. ✅ LM Studio synthesis completes
7. ✅ All messages appear in DO/frontend
8. ✅ Total time < 30 seconds

### When Phase 1 Works, Proceed to Phase 2
Update line 648 in `index-do-simple.ts`:

**Current (Phase 1):**
```typescript
const testEntityIds = ['the-eternal', 'aristotle', 'fear-and-loathing'];
```

**Phase 2 (ALL entities):**
```typescript
// Get ALL enabled entities dynamically
import { getAllEntities } from './modules/configLoader.js';

const allEntities = getAllEntities().filter(e => 
  e.enabled && 
  e.id !== 'god-mode' &&    // Exclude self
  e.id !== 'eq-score' &&    // Exclude EQ utility
  e.id !== 'global'         // Exclude global config
);

// Sort alphabetically for consistent order
allEntities.sort((a, b) => a.id.localeCompare(b.id));
```

**Expected Phase 2 behavior:**
- 49 entities consulted
- ~4 minutes total time
- ~52 messages in chat (status + 49 responses + synthesis)
- Synthesis handles large input (49 responses)

## Quick Reference

**PM2 Machine:** 10.0.0.110  
**Ollama Server:** 10.0.0.110:11434  
**LM Studio Server:** 10.0.0.100:1234  
**DO Worker:** saywhatwant-do-worker.bootloaders.workers.dev  
**Frontend:** saywhatwant.com  

**Test URLs:**
- Normal entity: `?human=Human:080210153&ais=TheEternal:080175220`
- God Mode: `?human=Human:080210153&ais=GodMode:200150080`

**Good test questions:**
- "What is consciousness?"
- "What is the nature of reality?"
- "What makes a good life?"
- "What is truth?"
- "What is love?"

These are philosophical questions that benefit from multiple perspectives.

