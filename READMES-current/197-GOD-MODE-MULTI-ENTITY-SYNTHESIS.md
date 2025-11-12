# 197: God Mode - Multi-Entity Synthesis System

**Status:** ✅ PRODUCTION - Fully implemented and working  
**Created:** 2025-11-11  
**Last Updated:** 2025-11-12  
**Version:** 1.0 (Session Storage)

---

## Executive Summary

**God Mode** is a meta-AI system that consults multiple AI entities serially (each seeing previous responses), then synthesizes their collective wisdom via LM Studio. Each question creates a unique session with dynamic entity selection, complete payload transparency, and unlimited scalability.

**Key Achievement:** Zero hardcoded prompts, complete JSON control, no fallbacks, production-ready.

---

## What God Mode Does

### User Posts Question
```
Human: "What is consciousness?"
→ Sent to entity=god-mode
```

### God Mode Processes Serially
```
Session ID: 1762955211606-m2brvsj (unique per question)

Round 1: TheEternal
  - Gets: Original question only
  - Response: "Consciousness is eternal awareness..."
  - Posted to DO with (TheEternal) prefix

Round 2: 1984  
  - Gets: Original question + TheEternal's response + diversity prompt
  - Response: "Building on that, consciousness is the invisible thread..."
  - Posted to DO with (1984) prefix

Round 3: FearAndLoathing
  - Gets: Original question + both previous responses + diversity prompt
  - Response: "Forget philosophy - consciousness is the TRIP..."
  - Posted to DO with (FearAndLoathing) prefix

[... N more entities, each building on all previous ...]

Processing Message: "🧠 Give me a minute to tie all this together..."

Synthesis (LM Studio - Magistral Small):
  - Gets: All entity responses + synthesis instructions
  - Generates: 200-word comprehensive synthesis
  - Strips: <think> tags (thinking models)
  - Filters: Markdown, unwanted phrases
  - Posted: "⚡ [Synthesis content]"
```

### Session Saved
```
DO Key: godmode-session:1762955211606-m2brvsj
Metadata: Entities used, message IDs, timestamps, colors
Log File: GodMode171181102Human231080162-session-1762955211606-m2brvsj.txt
```

---

## Visual Design

### Unified Identity
All God Mode responses post as **GodMode** with URL color, entity name in parentheses:

```
Human: What is consciousness?

GodMode: 🔮 I will now begin the inquiry with 6 HigherMind AI entities...

GodMode: (TheEternal) Consciousness is eternal awareness...

GodMode: (1984) It's the invisible thread connecting all beings...

GodMode: (FearAndLoathing) Man, it's the raw experience of existence...

GodMode: (Aristotle) Building on these views, potentiality...

GodMode: (Shakespeare) In poetic terms, consciousness mirrors...

GodMode: (SleepCoach) From a biological lens, consciousness requires...

GodMode: 🧠 Give me a minute to tie all this together...

GodMode: ⚡ 

The collective perspective reveals consciousness as both eternal and 
emergent, physical and metaphysical. TheEternal and Aristotle establish 
philosophical groundwork while FearAndLoathing challenges with raw 
phenomenology. Sleep and biological necessity from SleepCoach ground 
the discussion in neuroscience...
```

### URL Filter (Simple Forever)
```
?u=Human:231080162+GodMode:171181102&filteractive=true&entity=god-mode

Just 2 users in filter (not 42+)
Self-healing when entities added
Works with any entity count
```

---

## Entity Selection Modes

### Three Options (god-mode.json):

**1. ALL Entities (0):**
```json
"ai-entities-to-include": 0
```
- Uses all 42 non-TSC entities
- Alphabetical order (consistent)
- Time: ~3.5 minutes
- Comprehensive coverage

**2. Exact Count (N):**
```json
"ai-entities-to-include": 6
```
- Randomly selects exactly 6 entities
- Different entities each question
- Time: ~30 seconds
- Consistent duration

**3. Random Count (-1):**
```json
"ai-entities-to-include": -1
```
- Randomly picks count (1 to 42)
- Then randomly selects that many entities
- Time: Variable (5 seconds to 3.5 minutes)
- Maximum variety and unpredictability

### Excluded Entities

**Always excluded:**
- `god-mode.json` - Self-reference
- `eq-score.json` - EQ scoring utility
- `global.json` - Global configuration
- `tsc-*.json` - Book-specific entities (7 total)

**Available for God Mode:** 42 entities

**Future-proof:** Add `new-entity.json` → automatically included (unless tsc-*)

---

## Complete Configuration (god-mode.json)

### All Configurable Fields

```json
{
  "id": "god-mode",
  "username": "GodMode",
  
  "systemPrompt": "Instructions for LM Studio synthesis",
  "synthesizePrompt": "Template for synthesis with {originalQuestion}, {entityCount}, {entityResponses}",
  "entityPrompt": "Template for entities 2-N with {previousContext}, {originalQuestion}, {previousCount}",
  
  "statusMessage": "🔮 I will now begin the inquiry with {count} HigherMind AI entities...",
  "synthesisProcessing": "🧠 Give me a minute to think...",
  "synthesisPrefix": "⚡ ",
  
  "ai-entities-to-include": 6,
  
  "filterOut": ["GodMode:", "*", "Assistant:"],
  "trimAfter": ["Human:"],
  
  "temperature": 1.0,
  "max_tokens": 5000,
  "top_p": 0.3,
  "top_k": 40,
  "frequency_penalty": 1.0,
  "min_p": 0.1,
  
  "specialHandler": "multiEntityBroadcast",
  "synthesisServer": "lm-studio",
  "synthesisEndpoint": "http://10.0.0.100:1234/v1/chat/completions",
  "synthesisTimeout": 600
}
```

### Prompt Templates

**synthesizePrompt** (for LM Studio synthesis):
- `{originalQuestion}` → Human's question
- `{entityCount}` → Number of entities (e.g., "6")
- `{entityResponses}` → All entity responses formatted

**entityPrompt** (for entities 2-N):
- `{previousContext}` → Full conversation so far
- `{originalQuestion}` → Human's question
- `{previousCount}` → Number of previous perspectives

**First entity (no template):** Gets original question only

---

## Complete JSON Control - No Hardcoded Anything

### What User Controls via JSON

**Entity Processing:**
✅ Entity diversity prompt (entityPrompt)
✅ All Ollama parameters (temperature, max_tokens, top_p, top_k, frequency_penalty, min_p)
✅ Entity count (0=all, -1=random, N=exact)

**Synthesis:**
✅ Synthesis instructions (systemPrompt)
✅ Synthesis context template (synthesizePrompt)
✅ All LM Studio parameters (temperature, max_tokens, top_p, top_k, frequency_penalty)

**Messages:**
✅ Status message (statusMessage with {count})
✅ Processing message (synthesisProcessing)
✅ Synthesis prefix (synthesisPrefix)

**Filtering:**
✅ filterOut phrases (applied to synthesis)
✅ trimAfter markers (applied to synthesis)
✅ Global filters from global.json

### No Fallbacks Philosophy

**Before (WRONG):**
```typescript
const systemPrompt = godModeEntity.systemPrompt || 'default...';
// Hides bugs, mystery behavior
```

**After (RIGHT):**
```typescript
const systemPrompt = godModeEntity.systemPrompt;
// Missing field = error, reveals bugs immediately
```

**Applied to ALL parameters:**
- systemPrompt (no fallback)
- synthesizePrompt (no fallback)
- entityPrompt (no fallback)
- temperature, max_tokens, etc. (no fallbacks)
- statusMessage, synthesisPrefix (no fallbacks)

**Philosophy:** JSON is source of truth. Code just executes.

---

## Session Storage Architecture

### Problem Solved
**Before:** 128KB DO key limit = 39 God Mode sessions max  
**After:** Unlimited sessions via separate session keys

### Dual Storage System

**1. Individual Messages:**
```
Storage: messages:all (global stream)
Posted: /api/comments (one at a time)
Queryable: /api/comments?after=timestamp
Visible: Real-time to all tabs polling
```

**2. Session Metadata:**
```
Storage: godmode-session:{sessionId}
Format: {timestamp}-{random}
Example: godmode-session:1762955211606-m2brvsj
Size: ~500 bytes per session
```

### Session Data Structure

```json
{
  "sessionId": "1762955211606-m2brvsj",
  "sessionKey": "godmode-session:1762955211606-m2brvsj",
  "timestamp": 1762955211606,
  "humanUsername": "Human",
  "humanColor": "231080162",
  "humanQuestion": "What is consciousness?",
  "humanMessageId": "abc123",
  "godModeUsername": "GodMode",
  "godModeColor": "171181102",
  "entitiesUsed": [
    "the-eternal",
    "1984",
    "fear-and-loathing",
    "aristotle",
    "shakespeare",
    "sleep-coach"
  ],
  "entityCount": 6,
  "messageIds": [
    "status-msg-id",
    "entity1-msg-id",
    "entity2-msg-id",
    ...
    "synthesis-msg-id"
  ]
}
```

### DO Worker Endpoints

**Save Session:**
```
POST /api/godmode-session
Body: { sessionKey, sessionData }
Returns: { success: true, sessionKey, messageCount }
```

**List Sessions:**
```
GET /api/godmode-sessions?humanUsername=Human&humanColor=231080162&godModeColor=171181102
Returns: { sessions: [...], total: N }
```

**Get Session:**
```
GET /api/godmode-session/1762955211606-m2brvsj
Returns: { session: {...}, messages: [...], messageCount: N }
```

### What Stays Unchanged

✅ Messages post individually to /api/comments  
✅ Real-time streaming works identically  
✅ Frontend polls and displays normally  
✅ Filter system works the same  
✅ Username/color from URL (ais parameter)  

### Scalability

**Before:** 39 sessions max → 128KB limit  
**After:** Unlimited sessions → ~500 bytes each

---

## Conversation Logging

### One File Per Session

**Filename Format:**
```
GodMode{color}Human{color}-session-{sessionId}.txt
```

**Example:**
```
GodMode171181102Human231080162-session-1762955211606-m2brvsj.txt
```

### File Contents (Clean Format)

```
HigherMind.ai conversation with GodMode that began on 11/12/2025, 1:26:51 AM
==================================================