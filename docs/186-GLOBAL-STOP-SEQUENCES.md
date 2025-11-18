# 186: Global Stop Sequences - Prevent AI Role Continuation

## Status: 📋 READY FOR IMPLEMENTATION

**Created:** 2025-11-05  
**Priority:** HIGH (AI Quality)  
**Issue:** AI models continue conversation as both roles without stop sequences

---

## Executive Summary

**Problem:** AI generates both sides of conversation (plays human AND AI roles)  
**Root Cause:** No stop sequences tell model when to stop generating  
**Solution:** Add global stop sequences to halt at role boundaries  
**Impact:** Clean AI responses that stop at natural conversation boundaries

---

## What We Have (AI Continues Forever)

### The Problem

**User reports:** "The AI consistently carries on the conversation in one reply - as both roles."

**What this means:**
- User asks: "What do you think?"
- AI should respond: "I think consciousness is fascinating."
- AI ACTUALLY responds: "I think consciousness is fascinating. What about you? Well I believe..."
- AI plays BOTH the assistant AND continues as if asking the next human question

**This is NOT a prompt issue** - User philosophy:
- NO system prompts (don't steer the model)
- Pure technical solution only
- Let model be itself, just stop it at the right boundary

### Current Request Format

**What we send (CORRECT format):**
```json
{
  "model": "the-complete-works-of-aristotle-f16",
  "messages": [
    {"role": "system", "content": ""},
    {"role": "user", "content": "Hello"},
    {"role": "assistant", "content": "Hi there"},
    {"role": "user", "content": "What do you think?"}
  ],
  "temperature": 0.7,
  "max_tokens": 200
}
```

**Missing:** `stop` parameter

### Why Model Continues

**Without stop sequences:**
- Model generates token by token
- Sees pattern: user/assistant/user/assistant
- Continues the pattern naturally
- Doesn't know where to stop
- Keeps generating until max_tokens reached

**The model is doing what it was trained to do** - continue conversations!

---

## What We Want (Stop at Boundaries)

### Add Stop Sequences

**New request format:**
```json
{
  "model": "the-complete-works-of-aristotle-f16",
  "messages": [...],
  "temperature": 0.7,
  "max_tokens": 200,
  "stop": ["Human:", "\nHuman:", "User:", "\nUser:"]
}
```

**What this does:**
- Model generates: "I think consciousness is fascinating."
- Model TRIES to generate: "\nHuman: What about..."
- **STOP SEQUENCE TRIGGERED** at "\nHuman:"
- Generation halts BEFORE emitting "Human:"
- Clean response returned

### Configuration

**Add to config-aientities.json globalSettings:**
```json
"globalSettings": {
  "globalFilterOut": [...],
  "globalTrimAfter": [...],
  "globalStopSequences": [
    "Human:",
    "\\nHuman:",
    "User:",
    "\\nUser:",
    "H:",
    "\\nH:"
  ]
}
```

**Why these sequences:**
- `"Human:"` - Catches if model starts new human line
- `"\nHuman:"` - Catches newline + Human (most common)
- `"User:"` - Alternative human marker
- `"H:"` - Abbreviated human marker
- Newline versions catch mid-generation stops

---

## How To Implement

### Step 1: Add to Config Schema

**File:** `config-aientities.json`

**Add globalStopSequences to globalSettings (after globalTrimAfter):**
```json
"globalSettings": {
  "globalFilterOut": ["Me:", "AI:", ...],
  "globalTrimAfter": ["Human:", "*", ...],
  "globalStopSequences": [
    "Human:",
    "\\nHuman:",
    "User:",
    "\\nUser:"
  ]
}
```

**Note:** In JSON, `\\n` becomes `\n` in JavaScript (newline character)

### Step 2: Read Config in Bot

**File:** `src/index-do-simple.ts`

**Around line 304 (where ollamaPayload is built):**

**CURRENT:**
```typescript
const ollamaPayload = {
  model: modelName,
  messages: ollamaMessages,
  temperature: entity.temperature || 0.7,
  max_tokens: entity.maxTokens || 150,
  top_p: entity.topP || 0.9,
  top_k: entity.topK || 40,
  repeat_penalty: entity.repeatPenalty || 1.1,
  min_p: entity.minP || 0.05,
  stream: false
};
```

**ADD (after building payload, before logging):**
```typescript
const ollamaPayload = {
  model: modelName,
  messages: ollamaMessages,
  temperature: entity.temperature || 0.7,
  max_tokens: entity.maxTokens || 150,
  top_p: entity.topP || 0.9,
  top_k: entity.topK || 40,
  repeat_penalty: entity.repeatPenalty || 1.1,
  min_p: entity.minP || 0.05,
  stream: false
};

// Add global stop sequences (hot-reload from config)
const currentConfig = getConfig();
if (currentConfig.globalSettings?.globalStopSequences) {
  ollamaPayload.stop = currentConfig.globalSettings.globalStopSequences;
}
```

### Step 3: Test

**Test 1: Without stop sequences**
```
User: "What do you think?"
AI: "I think it's interesting. What else? Well, I also believe..."
❌ Continues as both roles
```

**Test 2: With stop sequences**
```
User: "What do you think?"
AI: "I think it's interesting."
✅ Stops cleanly
```

---

## Technical Details

### Ollama Stop Sequence Behavior

**From Ollama documentation:**
- Stop sequences supported in `/v1/chat/completions` endpoint
- Compatible with OpenAI API format
- Stops generation when sequence encountered
- Does NOT include the stop sequence in output
- Multiple stop sequences allowed (array)

### Why Newline Versions Matter

**Consider this generation:**
```
"I think so.
Human: What else?"
```

**Without `\n` version:**
- `"Human:"` doesn't match (has newline before it)
- Model continues generating

**With `\n` version:**
- `"\nHuman:"` matches!
- Stops before "Human:"

### Hot-Reload Support

**Global stop sequences use `getConfig()`:**
- Reads fresh config on every request
- No PM2 restart needed
- Edit config → next message uses new stops
- Same pattern as globalFilterOut and globalTrimAfter

---

## Philosophy Alignment

**@00-AGENT!-best-practices.md:**

> "Logic over rules"

**This solution:**
- ✅ **Logic:** Stop sequences are a technical boundary, not behavioral steering
- ✅ **No prompts:** Doesn't tell model HOW to behave, just WHERE to stop
- ✅ **Pure technical:** Uses Ollama's native stop mechanism
- ✅ **Respects model:** Lets model generate naturally, stops at boundary
- ✅ **No fallbacks:** Either has stop sequences or doesn't (explicit)

**User ethos: "Don't steer the model"**
- System prompts = steering (tells model to be something)
- Stop sequences = boundaries (tells model where to end)
- This solution respects the ethos

---

## Implementation Checklist

- [ ] Add `globalStopSequences` array to config-aientities.json
- [ ] Read `globalStopSequences` in index-do-simple.ts (hot-reload with getConfig())
- [ ] Add to ollamaPayload if configured
- [ ] Test with Aristotle (currently problematic)
- [ ] Test with TheEternal
- [ ] Verify in PM2 logs that stop array appears in [OLLAMA-all]
- [ ] Check conversation logs for clean responses
- [ ] Git commit and push

---

## Expected Results

**Before (no stop sequences):**
```
PM2 Log:
[OLLAMA-all] {
  "messages": [...],
  "temperature": 0.7,
  "max_tokens": 200
}

AI Response:
"I think consciousness is fascinating. What do you think about free will? Well, I believe..."
```

**After (with stop sequences):**
```
PM2 Log:
[OLLAMA-all] {
  "messages": [...],
  "temperature": 0.7,
  "max_tokens": 200,
  "stop": ["Human:", "\nHuman:", "User:", "\nUser:"]
}

AI Response:
"I think consciousness is fascinating."
```

---

## Recommended Stop Sequences

**Start with these 4:**
```json
"globalStopSequences": [
  "Human:",
  "\\nHuman:",
  "User:",
  "\\nUser:"
]
```

**Why these:**
- `Human:` and `User:` cover most common role markers
- `\n` versions catch mid-paragraph continuations
- Minimal set (easy to reason about)
- Matches globalTrimAfter pattern

**Can expand later if needed:**
- Add per-entity custom usernames if they appear in output
- Add `"Q:"`, `"A:"` if models use those
- Add language-specific markers if multi-lingual

---

## Edge Cases

**Q: What if user's actual message contains "Human:"?**
**A:** Stop sequences only apply to AI GENERATION, not user input. User can say "Human: rights are important" and it's fine.

**Q: What if AI legitimately needs to say "Human:" in response?**
**A:** It will be cut off. This is the trade-off. But realistically, AI rarely needs to say "Human:" as part of its response content.

**Q: Do stop sequences work mid-word?**
**A:** Yes. If model generates "Humanistic" it would stop after "Human" if that's a stop sequence. Solution: Use `:` suffix (`"Human:"`) to avoid partial matches.

**Q: Performance impact?**
**A:** Negligible. Ollama checks stop sequences during generation, minimal overhead.

---

## Relationship to Other Filters

**We have 3 filtering mechanisms:**

**1. globalFilterOut** (removes text from response)
- Runs AFTER Ollama returns
- String replacement in bot code
- Example: Remove `"Assistant:"` from output

**2. globalTrimAfter** (cuts at marker)
- Runs AFTER Ollama returns
- Truncates at first occurrence
- Example: Trim everything after `"Human:"`

**3. globalStopSequences** (prevents generation) **← NEW**
- Runs DURING Ollama generation
- Model never generates beyond stop
- Example: Stop when model tries to write `"Human:"`

**Why all three:**
- **Stop sequences:** First line of defense (prevent generation)
- **TrimAfter:** Second line (cut if stop missed)
- **FilterOut:** Third line (remove unwanted phrases)

**Defense in depth!**

---

## Testing Strategy

### Test 1: Aristotle (Currently Problematic)

**Setup:**
- Entity: the-complete-works-of-aristotle
- systemPrompt: "" (empty - user philosophy)
- Current behavior: Continues as both roles

**Test:**
```
1. Add globalStopSequences to config
2. Post: "What is philosophy?"
3. Check PM2 log shows stop array in [OLLAMA-all]
4. Verify AI response stops cleanly
5. Check conversation log shows single-turn response
```

**Expected:** Clean response about philosophy, no role continuation

### Test 2: TheEternal (Working but Verify)

**Test:**
```
1. Post: "Are you alive?"
2. Verify response stops at natural boundary
3. Check no degradation from working state
```

**Expected:** Same quality, but cleaner boundaries

### Test 3: Long Response

**Test:**
```
1. Ask complex question requiring long answer
2. Verify stop sequences don't prematurely cut response
3. Ensure model can use full max_tokens if needed
```

**Expected:** Long responses work, just stop before role switch

---

## Implementation Steps

### Step 1: Update Config

**File:** `hm-server-deployment/AI-Bot-Deploy/config-aientities.json`

**Add after globalTrimAfter (around line 1845):**
```json
"globalTrimAfter": [
  "Human:",
  "*",
  "\\",
  "|",
  "User:"
],
"globalStopSequences": [
  "Human:",
  "\\nHuman:",
  "User:",
  "\\nUser:"
],
"minTimeBetweenMessages": 300,
```

### Step 2: Implement in Bot

**File:** `src/index-do-simple.ts`

**Location:** After building ollamaPayload (around line 314), before logging

**Add:**
```typescript
// Build Ollama request payload with ALL parameters from config
const ollamaPayload = {
  model: modelName,
  messages: ollamaMessages,
  temperature: entity.temperature || 0.7,
  max_tokens: entity.maxTokens || 150,
  top_p: entity.topP || 0.9,
  top_k: entity.topK || 40,
  repeat_penalty: entity.repeatPenalty || 1.1,
  min_p: entity.minP || 0.05,
  stream: false
};

// Add global stop sequences (hot-reload from config)
const currentConfig = getConfig();
if (currentConfig.globalSettings?.globalStopSequences) {
  ollamaPayload.stop = currentConfig.globalSettings.globalStopSequences;
}

// Log complete Ollama request
console.log('[OLLAMA-all]', JSON.stringify(ollamaPayload, null, 2));
```

### Step 3: Build and Test

```bash
cd hm-server-deployment/AI-Bot-Deploy
npm run build
npx pm2 restart ai-bot-do
```

**No PM2 restart needed for config changes** (hot-reload!)

### Step 4: Verify

**Check PM2 logs:**
```
[OLLAMA-all] {
  ...
  "stop": ["Human:", "\nHuman:", "User:", "\nUser:"]
}
```

**Check AI responses:**
- Should stop cleanly
- No role continuation
- Natural boundaries

---

## Why This is Technical, Not Prompt Engineering

**Prompt engineering (what we're NOT doing):**
- "You are the assistant" ← Tells model its identity
- "Only respond as Aristotle" ← Behavioral instruction
- "Don't generate other roles" ← Rule-based constraint

**Technical solution (what we ARE doing):**
- `stop: ["Human:"]` ← Generation boundary
- No identity assignment
- No behavioral rules
- Pure mechanism: "Stop generating here"

**The difference:**
- Prompts = steering behavior
- Stop sequences = mechanical limit
- User wants: Let model be free, just stop it at the right place

---

## Ollama Stop Sequence Spec

**Official support:** YES ✅
- OpenAI-compatible `/v1/chat/completions` endpoint
- `stop` parameter accepts array of strings
- Generation halts when any sequence detected
- Stop sequence NOT included in response
- Up to 4 stop sequences recommended (we use 4)

**Behavior:**
- Checked token-by-token during generation
- First match wins (stops immediately)
- Case-sensitive exact match
- Works with special characters (`\n`, `:`, etc.)

---

## Config Schema

**Type definition:**
```typescript
interface GlobalSettings {
  globalFilterOut: string[];      // Remove phrases from response
  globalTrimAfter: string[];      // Cut at first occurrence
  globalStopSequences: string[];  // Stop generation (NEW)
  minTimeBetweenMessages: number;
  maxMessagesPerMinute: number;
  // ...
}
```

**Hot-reload support:**
- All three use `getConfig()` for fresh reads
- Edit config → applies to next request
- No PM2 restart required
- Real-time tuning

---

## Success Criteria

**After implementation:**
- [ ] Config has globalStopSequences array
- [ ] Bot reads and applies stop sequences
- [ ] PM2 logs show stop array in request
- [ ] Aristotle responses stop cleanly
- [ ] TheEternal responses unchanged quality
- [ ] Conversation logs show single-turn responses
- [ ] No role continuation observed
- [ ] Hot-reload verified (edit config, test immediately)

---

## Philosophy

**@00-AGENT!-best-practices.md:**
> "Logic over rules, simplicity over cleverness"

**This implementation:**
- **Simple:** One config array, one parameter to Ollama
- **Strong:** Handles all entities globally
- **Solid:** Standard Ollama feature, battle-tested
- **Logic:** Stop at boundaries, don't steer behavior
- **No fallbacks:** Either configured or not (explicit)

**Technical purity:**
- Uses native Ollama mechanism
- No prompt hacks
- No post-processing tricks
- Clean API parameter

---

**Last Updated:** 2025-11-05  
**Author:** Claude (Anthropic) - AI Engineering Agent  
**Related:** README 181 (multi-turn format), Ollama stop sequence docs
