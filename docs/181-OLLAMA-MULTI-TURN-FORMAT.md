# 181: Ollama Multi-Turn Message Format - Align with Training Data

## Status: 🚧 READY FOR IMPLEMENTATION

**Created:** 2025-11-04  
**Priority:** CRITICAL  
**Issue:** Context sent as text blob instead of structured messages array (misaligned with training data)

---

## Executive Summary

**Problem:** Conversation history sent as single text string in ONE user message  
**Solution:** Send each turn as separate message object with proper role (user/assistant)  
**Impact:** AI responses will dramatically improve by matching training data format  

---

## What We Have (Wrong Format)

### Current Implementation

**What we send to Ollama:**
```json
{
  "messages": [
    {
      "role": "system",
      "content": "You are a wise and thoughtful being..."
    },
    {
      "role": "user",
      "content": "Human: Hello\nTheEternal: Hi\nHuman: How are you?\nTheEternal: Good\nHuman: What is reality?\nTheEternal: "
    }
  ]
}
```

**Problem:** All conversation history crammed into ONE user message as text!

### Why This Is Wrong

**The model was trained on this format:**
```json
{
  "messages": [
    {"role": "user", "content": "Hello"},
    {"role": "assistant", "content": "Hi"},
    {"role": "user", "content": "How are you?"},
    {"role": "assistant", "content": "Good"},
    {"role": "user", "content": "What is reality?"}
  ]
}
```

**Mismatch impact:**
- Model expects structured role-based messages
- We're giving it unstructured text blob
- AI has to "parse" the conversation from text
- Responses are suboptimal

---

## What We Want (Correct Format)

### Training Data Example (Provided by User)

```json
{
  "messages": [
    {
      "role": "user",
      "content": "How can educated women influence the future of sex education?"
    },
    {
      "role": "assistant",
      "content": "Educated women can play a crucial role by advocating..."
    },
    {
      "role": "user",
      "content": "What do you mean by normalizing conversations?"
    },
    {
      "role": "assistant",
      "content": "Normalizing conversations means creating an environment..."
    },
    {
      "role": "user",
      "content": "How can sharing personal experiences really help?"
    },
    {
      "role": "assistant",
      "content": "Sharing personal experiences humanizes the topic..."
    },
    {
      "role": "user",
      "content": "But what about the biological side?"
    }
  ]
}
```

**Key characteristics:**
- Each turn is separate message object
- Alternating roles: user → assistant → user → assistant
- Clean content (no "Username:" prefixes)
- Last message is user (current question)

### Our Implementation Should Be

```json
{
  "messages": [
    {
      "role": "system",
      "content": "You are a wise and thoughtful being..."
    },
    {
      "role": "user",
      "content": "Hello"
    },
    {
      "role": "assistant",
      "content": "Hi"
    },
    {
      "role": "user",
      "content": "How are you?"
    },
    {
      "role": "assistant",
      "content": "Good"
    },
    {
      "role": "user",
      "content": "What is reality?"
    }
  ]
}
```

**Differences from training data:**
- We add system message (fine - Ollama supports this)
- Otherwise identical structure

---

## How to Implement

### Phase 1: Build Messages Array from Conversation

**File:** `hm-server-deployment/AI-Bot-Deploy/src/index-do-simple.ts`

**Current code (lines 244-267):**
```javascript
// Build context (messages already filtered and sorted by DO)
const contextMessages = conversationMessages.map(m => `${m.username}: ${m.text}`);

// Build full context (separator based on addNewlineToContext config)
const separator = entity.addNewlineToContext ? '\n' : '';
let fullContext = contextMessages.join(separator);

// Add custom variable and AI username...
```

**New code:**
```javascript
// Build messages array for Ollama (each turn = separate message)
const ollamaMessages = [];

// Add system message
ollamaMessages.push({
  role: 'system',
  content: entity.systemPrompt || `You are ${entity.username}.`
});

// Add conversation history as alternating user/assistant messages
for (const msg of conversationMessages) {
  const role = msg['message-type'] === 'human' ? 'user' : 'assistant';
  ollamaMessages.push({
    role: role,
    content: msg.text  // Just the text, no "Username:" prefix
  });
}

// Add current human message (from humanMessage parameter)
// This is already in conversationMessages, so DON'T add it again
// The last message in conversationMessages IS the current message

// Add variable context if configured
if (entity.addVariableToContext) {
  // Insert as user message or append to last message?
  // Option: Add as separate user message
  ollamaMessages.push({
    role: 'user',
    content: entity.addVariableToContext.trim()
  });
}

// Build Ollama request
const ollamaPayload = {
  model: modelName,
  messages: ollamaMessages,  // Array of message objects, not text blob!
  temperature: entity.temperature || 0.7,
  max_tokens: entity.maxTokens || 150,
  top_p: entity.topP || 0.9,
  top_k: entity.topK || 40,
  repeat_penalty: entity.repeatPenalty || 1.1,
  min_p: entity.minP || 0.05,
  stream: false
};
```

### Phase 2: Handle addEntityUsername

**Question:** With structured messages, how do we add "TheEternal: "?

**Option A:** Don't add it (model will naturally respond as assistant)
**Option B:** Add as assistant message with empty content (prompt model to continue)

**Recommendation:** Option A - the role='assistant' tells the model who it is, no need for explicit username.

### Phase 3: Remove Username Prefixes

**Current:** We prepend usernames: `"Human: Hello"`, `"TheEternal: Hi"`

**Should be:** Just the text: `"Hello"`, `"Hi"`

The role field already identifies who's speaking!

### Phase 4: Handle addVariableToContext

**Options:**
1. Add as separate user message
2. Append to last user message content
3. Add as system message

**Recommendation:** Append to last user message (preserves conversation flow).

---

## Benefits of Correct Format

**1. Matches Training Data ✅**
- Model trained on structured messages
- Will respond more accurately
- Better context understanding

**2. Cleaner Content ✅**
- No "Username:" prefixes needed
- Role field identifies speaker
- More natural conversation flow

**3. Better AI Performance ✅**
- Model doesn't have to "parse" text
- Direct role-based understanding
- Higher quality responses

**4. Simpler Context Building ✅**
- Map messages directly to array
- No string concatenation
- No separator logic needed

---

## Migration Plan

**Breaking changes:**
- `addNewlineToContext` becomes obsolete (no text concatenation)
- `addEntityUsername` becomes obsolete (role='assistant' is sufficient)
- `addVariableToContext` needs new implementation

**Backward compatibility:**
- Not needed (dev only, no production users)

**Testing:**
- Compare AI responses before/after
- Should be noticeably better

---

## Example Before/After

### BEFORE (Current - Wrong)

**Request:**
```json
{
  "messages": [
    {"role": "system", "content": "You are wise..."},
    {"role": "user", "content": "Human: How can educated women influence sex education?\nAssistant: Educated women can play a crucial role...\nHuman: What do you mean by normalizing?\nAssistant: Normalizing means...\nHuman: How can sharing help?\nAssistant: "}
  ]
}
```

**AI sees:** Text blob it has to parse

### AFTER (Correct - Matches Training)

**Request:**
```json
{
  "messages": [
    {"role": "system", "content": "You are wise..."},
    {"role": "user", "content": "How can educated women influence sex education?"},
    {"role": "assistant", "content": "Educated women can play a crucial role..."},
    {"role": "user", "content": "What do you mean by normalizing?"},
    {"role": "assistant", "content": "Normalizing means..."},
    {"role": "user", "content": "How can sharing help?"}
  ]
}
```

**AI sees:** Structured conversation exactly as it was trained

---

## Implementation Complexity

**Low complexity:**
- Simple array mapping
- Remove string concatenation logic
- Cleaner code overall

**Breaking changes:**
- Config fields become obsolete
- But no users affected (dev only)

---

**Last Updated:** 2025-11-04 15:50 UTC  
**Author:** Claude (Anthropic) - AI Engineering Agent  
**Related:** README 180 (Ollama request fix)

