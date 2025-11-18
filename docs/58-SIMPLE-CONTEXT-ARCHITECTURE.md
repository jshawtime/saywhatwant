# 🎯 Simple Context Architecture - "Send What You See"

**Date**: October 7, 2025 - 2:00 PM  
**Status**: IMPLEMENTATION READY  
**Philosophy**: Dead simple. No complexity. Just send what's displayed.

---

## The Problem

**Current (Broken):**
1. Frontend filters messages → `allComments = [5 filtered messages]`
2. Frontend throws away those messages
3. Frontend sends only usernames: `contextUsers: ["Me", "MyAI"]`
4. Bot fetches 50 messages from KV
5. Bot re-filters those 50 using usernames
6. **Duplicate work. Coordination complexity. Bugs.**

---

## The Solution

**New (Simple):**
1. Frontend filters messages → `allComments = [5 filtered messages]`
2. Frontend formats them: `["Me: Hello", "MyAI: Hi", ...]`
3. Frontend sends formatted context with message
4. Bot receives context, uses it directly
5. **Done. Zero filtering. Zero complexity.**

---

## What Changes

### Type Definition

**File:** `types/index.ts`

```typescript
export interface Comment {
  id: string;
  text: string;
  timestamp: number;
  username: string;
  domain: string;
  color: string;
  language: string;
  'message-type': string;
  misc: string;
  context?: string[];  // Pre-formatted context from frontend
  botParams?: BotParams;
}
```

**Delete:** `contextUsers?: string[];` field entirely

---

### Frontend - Build Context

**File:** `components/CommentsStream.tsx` (Line ~1003)

**Replace this:**
```typescript
const contextUsersArray = isFilterEnabled && filterUsernames.length > 0
  ? filterUsernames.map(u => u.username)
  : undefined;
```

**With this:**
```typescript
// Build pre-formatted context from displayed messages
const contextArray = (() => {
  const nomLimit = urlNom || 100;
  const messages = allComments.slice(-nomLimit);
  return messages.length > 0 
    ? messages.map(m => `${m.username}: ${m.text}`)
    : undefined;
})();
```

**Update submit call (Line ~1036):**
```typescript
// OLD
await submitComment(inputText, username, userColor, flashUsername, contextUsersArray, aiStateParam, botParams);

// NEW
await submitComment(inputText, username, userColor, flashUsername, contextArray, aiStateParam, botParams);
```

**Delete logging (Line ~1026-1028):**
```typescript
// DELETE THESE LINES
if (contextUsersArray) {
  console.log('[CommentsStream] Filtered context:', contextUsersArray);
}
```

**Add new logging:**
```typescript
if (contextArray) {
  console.log('[CommentsStream] Sending context:', contextArray.length, 'messages');
}
```

---

### Frontend - Submission Module

**File:** `modules/commentSubmission.ts`

**Update function signature (Line ~74):**
```typescript
// OLD
export function prepareCommentData(
  text: string,
  username: string,
  userColor: string,
  processVideo?: (text: string) => string,
  contextUsers?: string[],
  ais?: string,
  botParams?: BotParams
): Comment

// NEW
export function prepareCommentData(
  text: string,
  username: string,
  userColor: string,
  processVideo?: (text: string) => string,
  context?: string[],
  ais?: string,
  botParams?: BotParams
): Comment
```

**Update return (Line ~89-101):**
```typescript
return {
  id: generateCommentId(),
  text: processedText,
  timestamp: Date.now(),
  username: username,
  color: colorForStorage,
  domain: 'saywhatwant.app',
  language: 'en',
  'message-type': 'human',
  misc: ais || '',
  context,  // NEW
  botParams,
};
```

**Delete:** `contextUsers,` line

**Update hook signature (Line ~114):**
```typescript
// OLD
const handleSubmit = useCallback(async (
  inputText: string,
  username: string | undefined,
  userColor: string,
  onUsernameFlash?: () => void,
  contextUsers?: string[],
  ais?: string,
  botParams?: BotParams
): Promise<boolean> => {

// NEW
const handleSubmit = useCallback(async (
  inputText: string,
  username: string | undefined,
  userColor: string,
  onUsernameFlash?: () => void,
  context?: string[],
  ais?: string,
  botParams?: BotParams
): Promise<boolean> => {
```

**Update cloud API call (Line ~184-195):**
```typescript
postCommentToCloud({
  id: newComment.id,
  timestamp: newComment.timestamp,
  text: newComment.text,
  username: newComment.username,
  color: newComment.color,
  domain: config.domain,
  language: newComment.language,
  'message-type': 'human',
  misc: newComment.misc,
  context: newComment.context,  // NEW
  botParams: newComment.botParams,
})
```

**Delete:** `contextUsers: newComment.contextUsers,` line

---

### Worker - Store Context

**File:** `workers/comments-worker.js` (Line ~407-449)

**Replace this:**
```javascript
const contextUsers = body.contextUsers;
```

**With this:**
```javascript
const context = body.context;
```

**Update comment object:**
```javascript
const comment = {
  id: body.id || generateId(),
  text: text,
  timestamp: body.timestamp || Date.now(),
  username: username,
  color: color,
  domain: domain,
  language: language,
  'message-type': messageType,
  misc: misc,
  ...(context && Array.isArray(context) && context.length > 0 && {
    context: context  // NEW
  }),
  ...(botParams && typeof botParams === 'object' && {
    botParams: botParams
  })
};
```

**Delete:** All references to `contextUsers`

---

### Bot - Use Context Directly

**File:** `ai/src/index.ts`

**Replace filtering logic (Line ~336-361):**

**DELETE THIS ENTIRE BLOCK:**
```typescript
// 4. FILTER CONTEXT if contextUsers present (filtered conversations)
let contextMessages = messages;
if (message.contextUsers && Array.isArray(message.contextUsers) && message.contextUsers.length > 0) {
  contextMessages = messages.filter(m => 
    m.username && message.contextUsers!.includes(m.username)
  );
  console.log(chalk.magenta('[FILTERED CONVERSATION]'));
  console.log(chalk.cyan('  Users:'), message.contextUsers.join(', '));
  console.log(chalk.cyan('  Context:'), `${messages.length} → ${contextMessages.length} messages`);
}

// 5. DETERMINE CONTEXT SIZE (with fallback chain)
let nomToUse;
if (botParams.nom === 'ALL') {
  nomToUse = contextMessages.length;
} else if (botParams.nom) {
  nomToUse = Math.min(botParams.nom, contextMessages.length);
} else {
  nomToUse = Math.min(entity.nom || 100, contextMessages.length);
}

// Build context from (filtered) messages
const contextForLLM = contextMessages.slice(-nomToUse).map(m => `${m.username}: ${m.text}`);
```

**REPLACE WITH:**
```typescript
// Use pre-formatted context from frontend (if present)
const contextForLLM = message.context && message.context.length > 0
  ? message.context
  : messages.slice(-(entity.nom || 100)).map(m => `${m.username}: ${m.text}`);

console.log(chalk.cyan('[CONTEXT]'), `Using ${contextForLLM.length} messages`);
```

**Update logging (Line ~364-371):**

**DELETE:**
```typescript
console.log(chalk.cyan('[QUEUE]'), 'Configuration:');
console.log(chalk.cyan('  Entity:'), entity.id);
console.log(chalk.cyan('  Model:'), modelToUse);
console.log(chalk.cyan('  Priority:'), priority);
console.log(chalk.cyan('  Context size:'), contextForLLM.length);
if (message.contextUsers) {
  console.log(chalk.cyan('  Context users:'), message.contextUsers.join(', '));
}
```

**REPLACE WITH:**
```typescript
console.log(chalk.cyan('[QUEUE]'), 'Configuration:');
console.log(chalk.cyan('  Entity:'), entity.id);
console.log(chalk.cyan('  Model:'), modelToUse);
console.log(chalk.cyan('  Priority:'), priority);
console.log(chalk.cyan('  Context:'), contextForLLM.length, 'messages');
```

**Remove from buildRouterReason (Line ~386-396):**

**DELETE:**
```typescript
if (msg.contextUsers) reasons.push(`Filtered: ${msg.contextUsers.join(', ')}`);
```

**Remove from ping handling (Line ~446-467):**

**DELETE:**
```typescript
// NEW: Filter context if ping message has contextUsers
let pingContextMessages = messages;
if (pingMessage.contextUsers && Array.isArray(pingMessage.contextUsers) && pingMessage.contextUsers.length > 0) {
  pingContextMessages = messages.filter(m => 
    m.username && pingMessage.contextUsers!.includes(m.username)
  );
  console.log(chalk.magenta('[PING - FILTERED]'), 
    `Context: ${messages.length} → ${pingContextMessages.length} (${pingMessage.contextUsers.join(', ')})`);
}
```

**REPLACE WITH:**
```typescript
// Use context from message if present, otherwise use all messages
const pingContextMessages = pingMessage.context || messages.slice(-(entity.nom || 100)).map(m => `${m.username}: ${m.text}`);
```

---

### Bot Types

**File:** `ai/src/types.ts`

```typescript
export interface Comment {
  id: string;
  text: string;
  timestamp: number;
  username: string;
  domain: string;
  color: string;
  language: string;
  'message-type': string;
  misc: string;
  context?: string[];  // NEW
  botParams?: BotParams;
}
```

**Delete:** `contextUsers?: string[];`

---

## Implementation Checklist

- [ ] **types/index.ts** - Replace contextUsers with context
- [ ] **ai/src/types.ts** - Replace contextUsers with context
- [ ] **CommentsStream.tsx** - Build context from allComments
- [ ] **commentSubmission.ts** - Update signatures, replace contextUsers
- [ ] **comments-worker.js** - Accept context instead of contextUsers
- [ ] **ai/src/index.ts** - Use message.context directly, delete filtering

**Total time:** 15 minutes  
**Complexity:** Dead simple  
**Lines changed:** ~30 lines

---

## How It Works

```
USER SEES THIS:
  Me: Hello
  MyAI: Hi there
  Me: How are you?

FRONTEND SENDS:
  context: [
    "Me: Hello",
    "MyAI: Hi there", 
    "Me: How are you?"
  ]

BOT RECEIVES:
  message.context = ["Me: Hello", "MyAI: Hi there", "Me: How are you?"]

BOT USES:
  await llm.generate(message.context.join('\n'))

DONE.
```

No filtering. No coordination. No complexity.

---

## Testing

**Test 1: Filtered conversation**
```
URL: #u=MyAI:255069000+Me:195080200&filteractive=true&ais=MyAI:255069000

Frontend sees: 5 messages [Me, MyAI]
Frontend sends: 5 messages as context
Bot uses: 5 messages directly
✅ Works
```

**Test 2: No filter**
```
URL: #filteractive=false

Frontend sees: 50 messages (all users)
Frontend sends: last 100 (gets 50)
Bot uses: 50 messages directly
✅ Works
```

**Test 3: Empty view**
```
URL: #u=NonExistent:111222333&filteractive=true

Frontend sees: 0 messages
Frontend sends: undefined
Bot uses: fetched messages (fallback)
✅ Works
```

---

## What This Fixes

1. ✅ MyAI messages appear in filtered view (they have context)
2. ✅ Bot uses correct context (what user sees)
3. ✅ No redundant filtering
4. ✅ No coordination bugs
5. ✅ Simple, obvious, scalable

---

**Status**: Ready to implement  
**Time**: 15 minutes  
**Complexity**: Minimal

Just replace contextUsers with context everywhere. That's it.
