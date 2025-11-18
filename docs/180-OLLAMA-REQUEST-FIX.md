# 180: Ollama Request Fix - Missing Parameters and Context Issues

## Status: 🚧 READY FOR IMPLEMENTATION

**Created:** 2025-11-04  
**Priority:** CRITICAL  
**Issue:** DO bot not sending complete Ollama parameters, context formatting wrong, duplicate human message

---

## Executive Summary

**Problems Found:**
1. Missing Ollama parameters (topP, topK, repeatPenalty, minP)
2. Wrong context separator (`\n\n` should be `\n`)
3. Duplicate human message at end of context
4. Missing AI username insertion (`addEntityUsername` not working)

**Impact:** AI responses are suboptimal due to missing configuration

---

## What We Have (Broken)

### 1. Missing Ollama Parameters

**Current DO bot (`index-do-simple.ts` lines 257-266):**
```javascript
const ollamaPayload = {
  model: modelName,
  messages: [...],
  temperature: entity.temperature || 0.7,
  max_tokens: entity.maxTokens || 150,
  stream: false
  // ❌ MISSING: top_p, top_k, repeat_penalty, min_p
};
```

**Old KV bot (`index.ts` lines 151-159) - CORRECT:**
```javascript
parameters: {
  temperature: entity.temperature,
  max_tokens: entity.maxTokens,
  top_p: entity.topP,        // ✅ Present
  top_k: entity.topK,        // ✅ Present
  repeat_penalty: entity.repeatPenalty,  // ✅ Present
  min_p: entity.minP,        // ✅ Present
}
```

**Config values being ignored:**
```json
{
  "topP": 0.8,
  "topK": 100,
  "repeatPenalty": 1.15,
  "minP": 0.5
}
```

### 2. Wrong Context Separator

**Current (`index-do-simple.ts` line 247):**
```javascript
const fullContext = [...contextMessages, userMessage].join('\n\n');
//                                                            ^^^^ WRONG - double newline
```

**Config says:**
```json
{
  "addNewlineToContext": true  // Should be single \n, not \n\n
}
```

**Result:**
```
Human: Hello\n\nTheEternal: Response\n\nHuman: Next
// Should be:
Human: Hello\nTheEternal: Response\nHuman: Next
```

### 3. Duplicate Human Message

**Current context building (lines 245-247):**
```javascript
const contextMessages = conversationMessages.map(m => `${m.username}: ${m.text}`);
const userMessage = `${humanMessage.username}: ${humanMessage.text}`;
const fullContext = [...contextMessages, userMessage].join('\n\n');
//                                       ^^^^^^^^^^^ DUPLICATE!
```

**Result:**
```
"content": "Human: Previous\n\nTheEternal: Reply\n\nHuman: My curiosity\n\nHuman: My curiosity"
//                                                                     ^^^^^^^^^^^^^^^^^^^^^ DUPLICATE
```

**Why:** `humanMessage` is ALREADY in `conversationMessages` (it was posted to DO before PM2 claimed it), so adding it again creates a duplicate.

### 4. Missing AI Username Insertion

**Config says:**
```json
{
  "addEntityUsername": true  // Should add '\nTheEternal: ' before sending to Ollama
}
```

**Current:** Not implemented

**Should be:**
```
Human: My curiosity
TheEternal: [This is where AI will respond]
```

The `\nTheEternal: ` should be appended to the context so Ollama knows to continue as that entity.

---

## What We Want (Fixed)

### 1. Complete Ollama Parameters

```javascript
const ollamaPayload = {
  model: modelName,
  messages: [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: fullContext }
  ],
  temperature: entity.temperature || 0.7,
  max_tokens: entity.maxTokens || 150,
  top_p: entity.topP || 0.9,                    // ✅ ADD
  top_k: entity.topK || 40,                     // ✅ ADD
  repeat_penalty: entity.repeatPenalty || 1.1,  // ✅ ADD
  min_p: entity.minP || 0.05,                   // ✅ ADD
  stream: false
};
```

### 2. Correct Context Separator

```javascript
// Single newline (respects addNewlineToContext: true)
const fullContext = contextMessages.join('\n');
```

### 3. Remove Duplicate Human Message

```javascript
// Don't add humanMessage again - it's already in conversationMessages
const contextMessages = conversationMessages.map(m => `${m.username}: ${m.text}`);
const fullContext = contextMessages.join('\n');  // No duplicate!
```

### 4. Add AI Username (if enabled)

```javascript
let fullContext = contextMessages.join('\n');

// Add AI username prompt if enabled
if (entity.addEntityUsername) {
  fullContext += `\n${aiUsername}: `;  // Prompts AI to respond as this entity
}
```

---

## How to Implement

### File: `hm-server-deployment/AI-Bot-Deploy/src/index-do-simple.ts`

**In `generateResponse()` function (lines 244-270):**

```javascript
// Build context (messages already filtered and sorted by DO)
const contextMessages = conversationMessages.map(m => `${m.username}: ${m.text}`);

// Build full context (single newline separator)
let fullContext = contextMessages.join('\n');

// Add AI username if configured (prompts AI to continue as this entity)
if (entity.addEntityUsername) {
  fullContext += `\n${aiUsername}: `;
}

// Build system prompt
const systemPrompt = entity.systemPrompt || `You are ${entity.username}.`;

// Create AbortController with 5-minute timeout for model loading
const controller = new AbortController();
const timeoutId = setTimeout(() => controller.abort(), 300000);

// Build Ollama request payload with ALL parameters
const ollamaPayload = {
  model: modelName,
  messages: [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: fullContext }
  ],
  temperature: entity.temperature || 0.7,
  max_tokens: entity.maxTokens || 150,
  top_p: entity.topP || 0.9,
  top_k: entity.topK || 40,
  repeat_penalty: entity.repeatPenalty || 1.1,
  min_p: entity.minP || 0.05,
  stream: false
};

// Log complete Ollama request
console.log('[OLLAMA-all]', JSON.stringify(ollamaPayload, null, 2));

// Call Ollama
const ollamaResponse = await fetch('http://10.0.0.110:11434/v1/chat/completions', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(ollamaPayload),
  signal: controller.signal
});
```

---

## Verification

### Before Fix

**Ollama request:**
```json
{
  "model": "the-eternal-f16",
  "messages": [
    {
      "role": "user",
      "content": "Human: Hello\n\nTheEternal: Response\n\nHuman: Curiosity\n\nHuman: Curiosity"
    }
  ],
  "temperature": 0.7,
  "max_tokens": 200,
  "stream": false
}
```

**Issues:**
- ❌ Missing top_p, top_k, repeat_penalty, min_p
- ❌ Double newlines `\n\n`
- ❌ Duplicate "Human: Curiosity"
- ❌ Missing "TheEternal: " at end

### After Fix

**Ollama request:**
```json
{
  "model": "the-eternal-f16",
  "messages": [
    {
      "role": "system",
      "content": "You are a wise and thoughtful being..."
    },
    {
      "role": "user",
      "content": "Human: Hello\nTheEternal: Response\nHuman: Curiosity\nTheEternal: "
    }
  ],
  "temperature": 0.7,
  "max_tokens": 200,
  "top_p": 0.8,
  "top_k": 100,
  "repeat_penalty": 1.15,
  "min_p": 0.5,
  "stream": false
}
```

**Fixed:**
- ✅ All parameters present
- ✅ Single newlines
- ✅ No duplicate
- ✅ "TheEternal: " prompts AI to respond

---

## Testing

**After implementing:**
1. Send a message from frontend
2. Check `[OLLAMA-all]` log
3. Verify all parameters present
4. Verify context formatting correct
5. Verify no duplicate human message
6. Verify AI username present at end

---

**Last Updated:** 2025-11-04 07:10 UTC  
**Author:** Claude (Anthropic) - AI Engineering Agent  
**Related:** README 174 (Testing methodology)

