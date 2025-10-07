# 🎯 Filtered AI Conversations - Direct External Integration

**Date**: October 4, 2025  
**Status**: DESIGN PHASE  
**Use Case**: External websites create direct AI conversations with filtered context

---

## Executive Summary

**Goal**: Enable external websites to create isolated AI conversations where:
1. User identity is set via URL (uis parameter)
2. Conversation is filtered to show only user + specific AI
3. Bot reads ONLY the filtered messages as context
4. Bot responds in that filtered conversation
5. Creates private, focused AI dialogue

**Current URL Example**:
```
https://saywhatwant.app/#u=TheEternal:255069000+Me:195080200&filteractive=true&mt=ALL&uis=Me:195080200&priority=0
```

**What This Does**:
- Sets username to "Me" with color 195080200
- Filters to show only "Me" + "TheEternal" messages
- Shows both human and AI messages (mt=ALL)
- Priority 0 = immediate response, bypasses router

---

## The Challenge

### Current Bot Behavior

**What bot does now:**
```
1. Fetch last 50 messages from KV (ALL users, ALL conversations)
2. Send all 50 to LLM as context
3. LLM generates response based on full context
4. Post response to main conversation
```

**Problem**: Bot doesn't know about the filter!
- User sees filtered view: Only Me + TheEternal
- Bot sees full view: All 50 messages
- Response based on wrong context
- Posted to wrong conversation scope

### What We Need

**What bot SHOULD do for filtered conversations:**
```
1. User posts message from filtered URL
2. Message includes metadata about the filter
3. Bot detects filtered conversation
4. Fetches ONLY filtered messages as context
5. LLM generates response based on filtered context
6. Posts back with filter metadata
7. Response appears in filtered conversation
```

---

## The Solution: Send What's In The Window (Simple & Elegant)

### The Core Principle

**"The messages window IS the LLM context"**

**How it works:**
1. User loads filtered URL → See only [Me, TheEternal] messages
2. User posts message → Include simple list: `contextUsers: ["Me", "TheEternal"]`
3. Bot receives message → Sees contextUsers field
4. Bot filters its 50 messages to match: Only messages from Me or TheEternal
5. Bot sends filtered messages to LLM (not all 50!)
6. LLM responds based on filtered context
7. Response appears in conversation (naturally visible in filtered view)

**Implementation: Dead Simple**

**Step 1: Frontend Sends Filter Usernames**
```typescript
// components/CommentsStream.tsx - in handleSubmitMessage

const comment = {
  text: messageText,
  username: username,
  color: userColor,
  domain: currentDomain,
  'message-type': 'human',
  
  // SIMPLE: Just send who's in the filter (if active)
  contextUsers: isFilterEnabled && filterUsernames.length > 0 
    ? filterUsernames.map(u => u.username)
    : undefined
};
```

**Step 2: Bot Filters Context**
```typescript
// ai/src/index.ts - in message processing

// If message has contextUsers, filter the context
let contextMessages = messages;  // Default: all 50

if (message.contextUsers && message.contextUsers.length > 0) {
  contextMessages = messages.filter(m => 
    message.contextUsers.includes(m.username)
  );
  
  console.log(chalk.cyan('[FILTERED]'), 
    `Context: ${messages.length} → ${contextMessages.length} (filtered to: ${message.contextUsers.join(', ')})`
  );
}

// Apply nom (default 250 if not specified)
const nom = getNomFromURL(message) || 250;
const finalContext = nom === 'ALL' 
  ? contextMessages 
  : contextMessages.slice(-nom);

// Send to LLM
const response = await lmStudio.generate(finalContext);
```

**That's it!** No complex metadata, no JSON parsing, just a simple array.

---

## Your Use Case: Me + TheEternal Private Conversation

### Your URL (Corrected)
```
https://saywhatwant.app/#u=TheEternal:255069000+Me:195080200&filteractive=true&mt=ALL&uis=Me:195080200&priority=5&entity=storyteller
```

**What each parameter does:**

| Parameter | Value | Effect |
|-----------|-------|--------|
| `u=TheEternal:255069000+Me:195080200` | Filter users | Show only TheEternal + Me messages |
| `filteractive=true` | Enable filters | Apply the filter |
| `mt=ALL` | Both channels | Show human AND AI messages |
| `uis=Me:195080200` | Set user identity | Your username becomes "Me" |
| `priority=5` | High priority | Priority 5 in queue (high, but not bypassing router) |
| `entity=storyteller` | Force entity | Always use storyteller entity (not random) |

**Note**: Should be `entity=` not `entity-id=`. Valid entity IDs from config:
- philosopher, joker, sage, curious, poet, tech, zen, storyteller, empath, rebel

### Will This URL Work? (Analysis)

**✅ What Works Now (Already Implemented):**
- `uis=Me:195080200` → Sets username to "Me" ✅
- `filteractive=true` → Activates filters ✅
- `u=TheEternal:255069000+Me:195080200` → Shows only those two ✅
- `mt=ALL` → Shows both human + AI ✅

**❌ What Doesn't Work Yet (Needs Implementation):**
- `priority=5` → Not sent with message, bot doesn't see it ❌
- `entity=storyteller` → Not sent with message, bot uses random ❌
- Bot context → Bot sees all 50 messages, not just filtered ones ❌

**After Implementation:**
- Message includes: `contextUsers: ["TheEternal", "Me"]` ✅
- Bot filters: 50 messages → Only [TheEternal, Me] ✅
- Bot uses: storyteller entity (from URL) ✅
- Bot queues: priority 5 (from URL) ✅
- Response: Based on filtered context only ✅

### What Happens (Step-by-Step)

**1. Page Loads:**
```
✅ Username set to "Me"
✅ Color set to rgb(195, 80, 200)
✅ Filter shows only: Me + TheEternal
✅ Both human and AI messages visible
✅ Clean, focused conversation view
```

**2. You Post Message:**
```
Current: Message posted with no filter metadata
         Bot sees all 50 messages
         Responds based on full context ❌

Needed:  Message posted WITH filter metadata
         Bot sees only Me + TheEternal messages
         Responds based on filtered context ✅
```

**3. Bot Processes:**
```
Current: 
- Fetch 50 messages
- Random entity selection
- Full context to LLM
- Priority based on content matching

Needed:
- Fetch 50 messages
- Filter to only [Me, TheEternal]
- Use specified entity (from URL or metadata)
- Priority 0 (from URL)
- Filtered context to LLM
- Response with same filter metadata
```

**4. Bot Responds:**
```
Current: Posts to main conversation (all users see it)

Needed: Posts with conversationFilter metadata
        Only visible in filtered view
        Continues the private conversation
```

---

## Implementation: The Simple Way

### Frontend (2 changes)

**Change 1: Add contextUsers to Message**
```typescript
// components/CommentsStream.tsx - in handleSubmitMessage

const comment = {
  text: messageText,
  username: username,
  color: userColor,
  domain: currentDomain,
  'message-type': 'human',
  
  // NEW: Send filter usernames (what's visible in window)
  contextUsers: isFilterEnabled && filterUsernames.length > 0
    ? filterUsernames.map(u => u.username)  // ["Me", "TheEternal"]
    : undefined  // No filter = send undefined, bot uses all messages
};
```

**Change 2: Add Cloudflare Worker Field**
```typescript
// workers/comments-worker.js - Update schema to accept contextUsers

// Allow contextUsers array in POST request
if (comment.contextUsers && Array.isArray(comment.contextUsers)) {
  storedComment.contextUsers = comment.contextUsers;
}
```

---

### Backend (1 change)

**Change: Filter Context Based on contextUsers**
```typescript
// ai/src/index.ts - in message processing loop

// Determine context messages
let contextMessages = messages;  // Default: all 50 from KV

if (message.contextUsers && Array.isArray(message.contextUsers)) {
  // FILTER: Use only messages from specified users
  contextMessages = messages.filter(m => 
    message.contextUsers.includes(m.username)
  );
  
  console.log(chalk.cyan('[CONTEXT]'), 
    `Filtered: ${messages.length} → ${contextMessages.length} messages`);
  console.log(chalk.cyan('[CONTEXT]'), 
    `Users: ${message.contextUsers.join(', ')}`);
} else {
  console.log(chalk.gray('[CONTEXT]'), 
    `Unfiltered: Using all ${messages.length} messages`);
}

// Apply nom limit (default 250)
const nomLimit = 250;  // Can read from URL later if needed
const finalContext = contextMessages.slice(-nomLimit);

console.log(chalk.cyan('[CONTEXT]'), 
  `Sending ${finalContext.length} messages to LLM`);

// Send finalContext to LLM (not all messages!)
```

---

### That's The Entire Implementation

**3 simple changes:**
1. Frontend: Add contextUsers array to message
2. Worker: Allow contextUsers field
3. Bot: Filter messages if contextUsers present

**No complex metadata, no JSON, just an array of usernames!**

---

## Implementation Steps

### Step 1: Frontend (10 minutes)

**Step 2.1: Parse Conversation Metadata**
```typescript
// ai/src/index.ts - in message processing loop

// Parse conversation filter from message
let conversationFilter: ConversationFilter | null = null;
if (message.misc) {
  try {
    conversationFilter = JSON.parse(message.misc);
    console.log(chalk.cyan('[FILTERED]'), 'Conversation filter detected:', conversationFilter);
  } catch (e) {
    // Not JSON, ignore
  }
}
```

**Step 2.2: Filter Context Messages**
```typescript
// ai/src/index.ts - when building context

let contextMessages = messages;  // Default: all messages

if (conversationFilter && conversationFilter.users) {
  // Filter to only users in the conversation
  contextMessages = messages.filter(m => 
    conversationFilter.users.includes(m.username)
  );
  
  console.log(chalk.cyan('[FILTERED]'), `Context filtered: ${messages.length} → ${contextMessages.length} messages`);
  console.log(chalk.cyan('[FILTERED]'), `Conversation between: ${conversationFilter.users.join(', ')}`);
}

// Apply nom override if specified
const messagesToSend = conversationFilter?.nom === 'ALL' 
  ? contextMessages 
  : contextMessages.slice(-(conversationFilter?.nom || entity.messagesToRead));

console.log(chalk.cyan('[FILTERED]'), `Sending ${messagesToSend.length} messages to LLM`);
```

**Step 2.3: Use Specified Entity/Model**
```typescript
// ai/src/index.ts - entity selection

let selectedEntity;
if (conversationFilter?.entity) {
  // Use specified entity from URL
  selectedEntity = fullConfig.entities.find(e => e.id === conversationFilter.entity);
  if (!selectedEntity) {
    console.warn(chalk.yellow('[FILTERED]'), `Entity ${conversationFilter.entity} not found, using random`);
    selectedEntity = entityManager.selectRandomEntity();
  } else {
    console.log(chalk.green('[FILTERED]'), `Using specified entity: ${selectedEntity.id}`);
  }
} else {
  selectedEntity = entityManager.selectRandomEntity();
}

// Override model if specified
const modelToUse = conversationFilter?.model || selectedEntity.model;
```

**Step 2.4: Queue with Correct Priority**
```typescript
// ai/src/index.ts - queueing

const priority = conversationFilter?.priority ?? 
                 (text.includes('?') ? 25 : 50);

console.log(chalk.cyan('[FILTERED]'), `Queue priority: ${priority} (from ${conversationFilter ? 'URL' : 'auto'})`);

const queueItem = {
  id: `req-${Date.now()}-${messageIndex}-${Math.random().toString(36).substr(2, 9)}`,
  priority,
  timestamp: Date.now(),
  message,
  context: messagesToSend.map(m => `${m.username}: ${m.text}`),
  entity: selectedEntity,
  model: modelToUse,
  routerReason: conversationFilter ? 'Filtered conversation' : 'Auto-assigned',
  maxRetries: QUEUE_MAX_RETRIES,
  
  // IMPORTANT: Preserve filter for response
  conversationFilter
};
```

**Step 2.5: Post Response with Filter Metadata**
```typescript
// ai/src/index.ts - in postComment

const responseComment = {
  id: generateId(),
  text: response,
  username: entity.username,
  color: entity.color,
  timestamp: Date.now(),
  domain: 'ai.saywhatwant.app',
  'message-type': 'AI',
  
  // CRITICAL: Include same filter so response appears in filtered view
  misc: item.conversationFilter ? JSON.stringify(item.conversationFilter) : ''
};
```

---

## Example Flow

### Your URL in Action

**URL**:
```
https://saywhatwant.app/#u=TheEternal:255069000+Me:195080200&filteractive=true&mt=ALL&uis=Me:195080200&priority=0&entity=storyteller
```

**Flow:**

**T=0s - Page Loads:**
```
✅ uis applied: Username = "Me", Color = rgb(195, 80, 200)
✅ Filters active: Show only [Me, TheEternal]
✅ View shows: Last 50 messages from Me + TheEternal
✅ UI shows both human and AI messages
```

**T=5s - You Type Message:**
```
You: "Tell me about consciousness"
```

**T=6s - Message Posted:**
```
POST to Cloudflare KV:
{
  text: "Tell me about consciousness",
  username: "Me",
  color: "195080200",
  domain: "saywhatwant.app",
  "message-type": "human",
  misc: "{\"users\":[\"TheEternal\",\"Me\"],\"priority\":0,\"entity\":\"storyteller\"}"
}
```

**T=10s - Bot Fetches:**
```
[POLLING] Fetched 50 messages
[FILTERED] Found message with conversation filter
[FILTERED] Conversation between: TheEternal, Me
[FILTERED] Context filtered: 50 → 8 messages (only Me + TheEternal)
[FILTERED] Using specified entity: storyteller
[FILTERED] Queue priority: 0 (from URL)
[QUEUE] Queued with priority 0 (highest!)
```

**T=11s - Worker Claims:**
```
[WORKER] Claimed priority 0 item (filtered conversation)
[WORKER] Context: 8 messages (filtered)
[CLUSTER] Sending to LM Studio with filtered context:
  Me: Hello
  TheEternal: Greetings
  Me: How are you?
  TheEternal: I am well
  Me: Tell me about consciousness ← Latest
```

**T=15s - LLM Responds:**
```
LLM Response: "Consciousness is the dance between observer and observed..."
```

**T=16s - Bot Posts:**
```
POST to Cloudflare KV:
{
  text: "Consciousness is the dance between observer and observed...",
  username: "TheEternal",
  color: "255069000",
  domain: "ai.saywhatwant.app",
  "message-type": "AI",
  misc: "{\"users\":[\"TheEternal\",\"Me\"],\"priority\":0,\"entity\":\"storyteller\"}"
}
```

**T=17s - You See Response:**
```
Your filtered view:
  Me: Tell me about consciousness
  TheEternal: Consciousness is the dance between observer and observed...
  
✅ Response appears in your filtered view
✅ Based on filtered context only
✅ Private conversation maintained
```

---

## Implementation Checklist

### Frontend Changes

**url-filter-simple.ts:**
- [ ] Add getPriorityFromURL()
- [ ] Add getEntityFromURL()
- [ ] Add getModelFromURL()
- [ ] Add getNomFromURL()
- [ ] Add getConversationFilter() (combines all)

**CommentsStream.tsx:**
- [ ] Import new URL helpers
- [ ] Build conversationFilter when posting
- [ ] Include in comment.misc field
- [ ] Log when posting filtered message

**types/index.ts:**
- [ ] Add ConversationFilter interface
- [ ] Update Comment.misc to optional string

### Backend Changes

**ai/src/index.ts:**
- [ ] Parse conversationFilter from message.misc
- [ ] Filter context messages if conversationFilter present
- [ ] Use specified entity if provided
- [ ] Use specified model if provided
- [ ] Use specified nom if provided
- [ ] Queue with specified priority
- [ ] Preserve conversationFilter in queue item
- [ ] Include conversationFilter in response

**ai/src/modules/queueService.ts:**
- [ ] Add conversationFilter to QueueItem type
- [ ] Preserve through claim/complete cycle

**ai/src/modules/kvClient.ts:**
- [ ] Ensure misc field is sent/received correctly

---

## Testing Scenarios

### Scenario 1: Simple Filtered Conversation
```
URL: #u=AI:255000000+Me:195080200&filteractive=true&mt=ALL&uis=Me:195080200&priority=0

1. Load page → Username = "Me"
2. See only Me + AI messages
3. Post: "Hello AI"
4. Bot responds with filtered context
5. See response in filtered view
```

### Scenario 2: Philosopher Conversation
```
URL: #u=FearAndLoathing:128000255+Seeker:random&filteractive=true&mt=ALL&uis=Seeker:random&priority=0&entity=philosopher&nom=ALL

1. Load page → Username = "Seeker", random color
2. Filter to FearAndLoathing + Seeker
3. Post philosophical question
4. Philosopher entity responds
5. Uses ALL message history as context
6. Private deep discussion
```

### Scenario 3: Multi-Entity Conversation
```
URL: #u=TheEternal:255069000+FearAndLoathing:128000255+Me:195080200&filteractive=true&mt=ALL&uis=Me:195080200

1. Three-way conversation
2. Both AI entities can respond
3. All see same filtered context
4. Isolated group chat
```

---

## Benefits of This Approach

### 1. **Self-Contained Messages**
- Filter metadata travels with the message
- No server-side session state needed
- Works across page reloads
- Scalable to millions of conversations

### 2. **Privacy**
- Filtered conversations are isolated
- Responses only appear in filtered view
- No cross-contamination
- Clean separation

### 3. **Flexibility**
- Each conversation can have different:
  - Entity (philosopher, tech, poet, etc.)
  - Model (different LLM models)
  - Priority (immediate vs queued)
  - Context size (nom parameter)

### 4. **External Integration**
- External websites can create deep links
- Users click → Instant AI conversation
- No setup required
- URL contains everything needed

---

## Alternative: URL-Based Context (Not Recommended)

**How it would work:**
- Bot polls KV API with filter parameters
- API returns only filtered messages
- Simpler implementation

**Why not recommended:**
- Bot doesn't know user's filter intent
- Would need to guess from message content
- Not self-contained
- Harder to scale

**Metadata approach is better because:**
- Message carries its own context
- Bot knows exactly what to do
- No guessing or heuristics
- Works for all scenarios

---

## Current Status

**What Works:**
- ✅ URL sets username (uis parameter)
- ✅ URL creates filtered view
- ✅ UI shows only filtered messages
- ✅ Priority parameter parsed

**What's Missing:**
- ❌ Conversation filter not sent with message
- ❌ Bot doesn't filter context
- ❌ Bot doesn't respect priority from message
- ❌ Response appears in main conversation (not filtered)

**Next Steps:**
1. Implement URL helper functions
2. Add conversationFilter to message posting
3. Update bot to parse and respect filter
4. Test filtered conversations
5. Verify isolation works

---

## Example Implementation Code

### Frontend: Build Conversation Filter

```typescript
// lib/url-filter-simple.ts

export interface ConversationFilter {
  users: string[];
  priority?: number;
  entity?: string;
  model?: string;
  nom?: number | 'ALL';
}

export function getConversationFilterFromURL(filterState: FilterState): ConversationFilter | null {
  // Only create filter if filters are active and users are specified
  if (!filterState.filterActive || filterState.users.length === 0) {
    return null;
  }
  
  const hash = window.location.hash.slice(1);
  
  const filter: ConversationFilter = {
    users: filterState.users.map(u => u.username)
  };
  
  // Parse optional parameters
  const priorityMatch = hash.match(/priority=(\d+)/);
  if (priorityMatch) filter.priority = parseInt(priorityMatch[1]);
  
  const entityMatch = hash.match(/entity=([^&]+)/);
  if (entityMatch) filter.entity = entityMatch[1];
  
  const modelMatch = hash.match(/model=([^&]+)/);
  if (modelMatch) filter.model = modelMatch[1];
  
  const nomMatch = hash.match(/nom=(ALL|\d+)/);
  if (nomMatch) filter.nom = nomMatch[1] === 'ALL' ? 'ALL' : parseInt(nomMatch[1]);
  
  return filter;
}
```

### Backend: Use Conversation Filter

```typescript
// ai/src/index.ts

// Parse conversation filter from message
let conversationFilter: ConversationFilter | null = null;
if (message.misc) {
  try {
    conversationFilter = JSON.parse(message.misc);
  } catch (e) {
    // Not JSON, ignore
  }
}

if (conversationFilter) {
  console.log(chalk.magenta('[FILTERED CONVERSATION]'));
  console.log(chalk.cyan('  Users:'), conversationFilter.users.join(', '));
  console.log(chalk.cyan('  Priority:'), conversationFilter.priority ?? 'auto');
  console.log(chalk.cyan('  Entity:'), conversationFilter.entity ?? 'random');
  console.log(chalk.cyan('  Model:'), conversationFilter.model ?? 'default');
  console.log(chalk.cyan('  Context:'), conversationFilter.nom ?? 'entity default');
  
  // Filter messages to conversation participants
  const filteredMessages = messages.filter(m => 
    conversationFilter.users.includes(m.username)
  );
  
  // Use filtered context
  const entity = conversationFilter.entity 
    ? fullConfig.entities.find(e => e.id === conversationFilter.entity)
    : entityManager.selectRandomEntity();
  
  const priority = conversationFilter.priority ?? 50;
  const nom = conversationFilter.nom ?? entity.messagesToRead;
  
  const contextForLLM = nom === 'ALL' 
    ? filteredMessages 
    : filteredMessages.slice(-nom);
  
  // Queue with metadata preserved
  await queueService.enqueue({
    id: generateId(),
    priority,
    message,
    context: contextForLLM.map(m => `${m.username}: ${m.text}`),
    entity,
    model: conversationFilter.model || entity.model,
    conversationFilter,  // Preserve for response
    maxRetries: QUEUE_MAX_RETRIES
  });
}
```

---

## Success Criteria

**After implementation, this URL should work:**
```
https://saywhatwant.app/#u=TheEternal:255069000+Me:195080200&filteractive=true&mt=ALL&uis=Me:195080200&priority=0&entity=storyteller&nom=ALL
```

**Expected behavior:**
1. ✅ Username becomes "Me"
2. ✅ Filter shows only Me + TheEternal
3. ✅ You post message
4. ✅ Message includes conversation filter in misc
5. ✅ Bot detects filtered conversation
6. ✅ Bot filters context to only Me + TheEternal
7. ✅ Bot uses storyteller entity
8. ✅ Bot sends ALL filtered messages as context
9. ✅ Bot queues with priority 0
10. ✅ Response appears in filtered view
11. ✅ Private conversation maintained

**This enables the complete external website integration use case!**

---

**Ready to implement?** This will make your external link use case fully functional. Users can click links and have instant, private, context-aware AI conversations.
