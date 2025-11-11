# 197: God Mode - Multi-Entity Synthesis System

## Status: 📋 DESIGN PHASE

**Created:** 2025-11-11  
**Priority:** HIGH (Experimental Feature)  
**Type:** New Feature - Meta-AI System

---

## Executive Summary

**What:** A "God Mode" entity that broadcasts questions to ALL AI entities simultaneously, displays their responses in real-time, then synthesizes them into a unified answer using a large language model.

**Why:** Provides multi-perspective analysis on complex questions, showing diverse viewpoints before delivering a comprehensive synthesis.

**How:** Special PM2 handler broadcasts to all entities in parallel, posts responses to DO as they arrive, then uses Mistral Small 3.1 32B to synthesize.

**Impact:** Transforms single-AI responses into panel discussions with expert synthesis.

---

## What We Have (Current System)

### Single-Entity Conversations

```
User → Asks question
  ↓
PM2 → Processes with ONE entity
  ↓
Ollama → Generates response
  ↓
DO → Stores message
  ↓
Frontend → Displays response
```

**Limitation:** Only one perspective per conversation.

**To see multiple perspectives:** User must open multiple tabs with different entities.

---

## What We Want (God Mode)

### Multi-Entity Serial Conversation

```
User → Asks: "What is consciousness?"
  ↓
God Mode Entity → Processes with ALL 44 entities SERIALLY
  ↓
┌─────────────────────────────────────────────────┐
│ ROUND 1: TheEternal                             │
│ Context: [Human question only]                  │
│ Response: "Consciousness is eternal..."         │
│ → Posted to conversation (user sees it)         │
└─────────────────────────────────────────────────┘
  ↓
┌─────────────────────────────────────────────────┐
│ ROUND 2: Aristotle                              │
│ Context: Human + TheEternal's response          │
│ Prompt: "Add your UNIQUE perspective that       │
│         hasn't been covered yet..."             │
│ Response: "Building on that, potentiality..."   │
│ → Posted to conversation (user sees it)         │
└─────────────────────────────────────────────────┘
  ↓
┌─────────────────────────────────────────────────┐
│ ROUND 3: FearAndLoathing                        │
│ Context: Human + TheEternal + Aristotle         │
│ Prompt: "Add your UNIQUE perspective..."        │
│ Response: "Forget philosophy - it's the TRIP!"  │
│ → Posted to conversation (user sees it)         │
└─────────────────────────────────────────────────┘
  ↓
[... 41 more rounds, each building on all previous ...]
  ↓
Frontend → User watches conversation develop (2-5 sec per response)
Total time: ~3-4 minutes for all 44 entities
  ↓
After all entities respond:
  ↓
Mistral Small 32B → Synthesizes all 44 unique perspectives
  ↓
GodMode → Posts: "[SYNTHESIS] Drawing from 44 diverse perspectives..."
```

### Why Serial (Not Parallel)?

**Parallel Problem:**
- All 44 AIs answer the SAME question independently
- No awareness of other perspectives
- Results in massive overlap and redundancy
- 10 philosophy AIs say nearly identical things

**Serial Solution:**
- Each AI sees ALL previous responses in context
- Explicitly prompted to add UNIQUE perspective
- Forced to avoid repeating what's been said
- Later AIs can build on, challenge, or synthesize earlier views

**Result:** 44 genuinely DIFFERENT perspectives instead of variations on the same themes.

---

## 🎨 Visual Design: Unified Identity System

**Problem:** If each entity posts with its own username, the URL filter would be enormous:
```
Bad: ?u=Human:080210153+TheEternal:080175220+Aristotle:080228169+FearAndLoathing:196080172+...+GodMode:200150080
→ 49+ entities = unmaintainable URL, breaks when you add new entities
```

**Solution:** All God Mode responses post as **GodMode** with entity name prepended:

### Message Format
```
Username: GodMode
Color: 200150080 (gold)
Text: (EntityName) actual response text
```

### Example Conversation
```
Human: What is consciousness?

GodMode: 🔮 Consulting 49 AI entities serially...

GodMode: (TheEternal) Consciousness is the fundamental awareness...

GodMode: (Aristotle) Building upon TheEternal's perspective...

GodMode: (FearAndLoathing) Listen, man, they're both right but...

[... 46 more entity responses ...]

GodMode: ⚡ [SYNTHESIS]

The consensus across all 49 perspectives reveals...
```

### URL Filter
```
Clean: ?u=Human:080210153+GodMode:200150080&filteractive=true
→ Just 2 users, works forever, self-healing when entities added
```

### Benefits

1. ✅ **Simple URL** - Filter shows Human + GodMode only (2 users, not 50+)
2. ✅ **Clear attribution** - See which model said what: (TheEternal), (Aristotle), etc.
3. ✅ **Unified visual identity** - All gold, all GodMode, instantly recognizable
4. ✅ **Self-healing** - Add new entity JSON → automatically included, URL unchanged
5. ✅ **Future-proof** - Works with 3 entities or 300 entities
6. ✅ **Clean synthesis input** - Context uses unprefixed text for better synthesis

### Technical Details

**Posted to DO:**
```json
{
  "username": "GodMode",
  "color": "200150080",
  "text": "(TheEternal) Consciousness is the fundamental awareness...",
  "messageType": "AI",
  "replyTo": "human-message-id"
}
```

**Context for next entity (unprefixed):**
```
Consciousness is the fundamental awareness...
```

This ensures synthesis receives clean text without parenthetical prefixes cluttering the input.

---

## User Experience Flow

### Timeline (Option A - Show All Responses)

```
10:30:00 - Human: "What is consciousness?"
           [Message sent to GodMode entity]

10:30:01 - GodMode: "🔮 Consulting 44 AI entities serially..."
           [Status message posted]

10:30:03 - TheEternal: "Consciousness is the eternal..."
           [Round 1: First response - no prior context]

10:30:08 - Aristotle: "Building on TheEternal's eternal view, 
            I see consciousness as potentiality..."
           [Round 2: References Round 1]

10:30:13 - FearAndLoathing: "Forget the philosophy - consciousness 
            is the TRIP, man, the raw experience..."
           [Round 3: Challenges philosophy with experiential view]

10:30:18 - Astrophysics: "From a neuroscience lens, while TheEternal 
            and Aristotle explore metaphysics..."
           [Round 4: Adds scientific counterpoint]

[... 40 more responses, each building on all previous ...]
[User watches conversation evolve, ~5 seconds between responses]
[Total viewing time: ~3-4 minutes]

10:33:30 - GodMode: "[SYNTHESIS] 
           After consulting 44 diverse perspectives, a rich 
           tapestry emerges:
           
           PHILOSOPHICAL FOUNDATIONS: TheEternal and Aristotle 
           established metaphysical groundwork...
           
           EXPERIENTIAL CHALLENGE: FearAndLoathing countered 
           with raw phenomenology...
           
           SCIENTIFIC GROUNDING: Astrophysics provided empirical 
           context that both supported and challenged...
           
           UNIQUE INSIGHTS: 
           - GodIsAMachine's mechanistic view directly opposed...
           - EmotionalIntelligence connected to affect theory...
           - TSC-Ulysses used stream-of-consciousness to mirror...
           
           KEY DEBATES:
           1. Eternal vs Emergent (7 entities each side)
           2. Physical vs Non-Physical (10 vs 8)
           3. Individual vs Collective (debate across 12 entities)
           
           COMPREHENSIVE SYNTHESIS: [300-word synthesis]"
```

### What User Sees (Visual)

```
┌─────────────────────────────────────────────────┐
│ Message Stream                                  │
├─────────────────────────────────────────────────┤
│ You: What is consciousness?                     │
│                                                  │
│ 🔮 GodMode: Consulting 44 entities...          │
│                                                  │
│ TheEternal: Consciousness is the eternal...     │
│ [Philosophy perspective, 150 words]             │
│                                                  │
│ FearAndLoathing: Man, consciousness is like...  │
│ [Gonzo perspective, 120 words]                  │
│                                                  │
│ Aristotle: In my philosophical view...          │
│ [Classical philosophy, 180 words]               │
│                                                  │
│ [... 41 more responses ...]                     │
│                                                  │
│ ⚡ GodMode: [SYNTHESIS]                         │
│ [Comprehensive 300-word synthesis]              │
└─────────────────────────────────────────────────┤
│ Input: [Type message...]                     🎨 │
└─────────────────────────────────────────────────┘
```

---

## Architecture

### Conversation Storage

**DO Key Format:**
```
conv:Human:080150227:GodMode:200150080
```

**Messages in conversation:**
```json
[
  {
    "id": "msg1",
    "username": "Human",
    "color": "080150227",
    "text": "What is consciousness?",
    "message-type": "human",
    "timestamp": 1699000000000
  },
  {
    "id": "msg2",
    "username": "TheEternal",
    "color": "080175220",
    "text": "Consciousness is eternal...",
    "message-type": "AI",
    "replyTo": "msg1",
    "timestamp": 1699000003000
  },
  {
    "id": "msg3",
    "username": "Aristotle",
    "color": "100200080",
    "text": "In my view...",
    "message-type": "AI",
    "replyTo": "msg1",
    "timestamp": 1699000005000
  },
  ...
  {
    "id": "msg45",
    "username": "GodMode",
    "color": "200150080",
    "text": "[SYNTHESIS] Drawing from 44 perspectives...",
    "message-type": "AI",
    "replyTo": "msg1",
    "timestamp": 1699000030000
  }
]
```

**Key insight:** All responses use DIFFERENT usernames but go to SAME conversation key.

### URL Structure

**Current (single entity):**
```
#ais=TheEternal:080175220&entity=the-eternal
```

**God Mode (multiple AI identities):**
```
#ais=GodMode:200150080&entity=god-mode
```

**URL Filter for Display (optional):**
If user wants to filter the 44 responses, they can add username filters:
```
#ais=GodMode:200150080&entity=god-mode&u=TheEternal:080175220+Aristotle:100200080
```

But by default, ALL messages in the conversation show (including all 44 entity responses).

---

## Entity Selection Strategy

### Current Implementation (V1): ALL Entities

**Default behavior:** God Mode consults ALL 44 entities serially.

**Dynamic entity loading:** God Mode automatically discovers and includes ALL entities in the `ai-entities/` directory at runtime.

**Why ALL entities:**
- Maximum diversity of perspectives
- User enjoys watching the conversation develop
- Time (3-4 minutes) is acceptable for the depth gained
- No need to decide which entities are "relevant"
- Comprehensive coverage of all angles

**Entity discovery (automatic):**
```typescript
// At runtime, PM2 loads ALL entity JSON files
// Location: AI-Bot-Deploy/ai-entities/*.json
const fs = require('fs');
const path = require('path');

// Automatically discover all entity files
const entitiesDir = path.join(__dirname, '../ai-entities');
const entityFiles = fs.readdirSync(entitiesDir).filter(f => f.endsWith('.json'));

// Load each entity
const allEntities = entityFiles
  .map(file => {
    const config = JSON.parse(fs.readFileSync(path.join(entitiesDir, file), 'utf8'));
    return config;
  })
  .filter(entity => entity.enabled); // Only enabled entities

console.log(`[GOD-MODE] Discovered ${allEntities.length} entities`);
```

**Entity processing order:**
```typescript
// Get all enabled entities (excluding utility files)
const allEntities = getAllEntities().filter(e => 
  e.enabled && 
  e.id !== 'god-mode' &&      // Exclude self-reference
  e.id !== 'eq-score' &&      // Exclude EQ scoring utility
  e.id !== 'global'           // Exclude global utility config
);

// Process in alphabetical order by filename (consistent order)
allEntities.sort((a, b) => a.id.localeCompare(b.id));

// Process each entity serially
for (const entity of allEntities) {
  await processEntityWithContext(entity);
}
```

**Excluded entities:**
- `god-mode.json` - Self-reference (can't consult itself)
- `eq-score.json` - EQ scoring utility (not conversational)
- `global.json` - Global configuration utility (not conversational)

**Automatic scaling:**
- Add new entity file → God Mode automatically includes it (no code changes)
- Remove entity file → God Mode automatically excludes it
- Disable entity (`"enabled": false`) → God Mode skips it
- Current count: 52 entities total, 49 consultable (excludes god-mode, eq-score, global)

**Example:**
```
Current entities (November 2024):
- 1984.json
- alcohol-addiction-support.json
- aristotle.json
- art-of-war.json
- astrophysics-a-deep-dive.json
- astrophysics-for-people-in-a-hurry.json
- being-and-nothingness.json
- climate-change-solutions.json
- climb-the-corporate-ladder-fast.json
- conflict-helper.json
- crucial-conversations.json
- crushing-it.json
- cryptocurrency.json
- dystopian-survival-guide.json
- emotional-intelligence.json
- emotional-support-therapist.json
- eq-score.json (EXCLUDED - special purpose)
- fahrenheit-451.json
- fear-and-loathing.json
- find-enlightenment.json
- global.json
- god-is-a-machine.json
- god-mode.json (EXCLUDED - self-reference)
- how-to-get-what-you-want.json
- how-to-talk-so-kids-will-listen.json
- mind-control-for-health-living.json
- modern-parenting.json
- monetize-your-passion.json
- philosophy-philosophy-philosophy.json
- sleep-coach.json
- stress-free-living.json
- the-body-keeps-the-score.json
- the-complete-works-of-aristotle.json
- the-eternal.json
- the-four-agreements.json
- the-money-mentor.json
- the-new-american-dream.json
- the-road-not-taken.json
- the-teachings-of-don-juan.json
- the-truth-teller.json
- the-uninhabitable-earth.json
- this-or-that.json
- toxic-heal-your-body-from-mold-toxicity.json
- true-freedom-is-for-anyone.json
- tsc-alice-in-wonderland.json
- tsc-frankenstein.json
- tsc-grimms-fairy-tales.json
- tsc-pride-and-prejudice.json
- tsc-shakespeare-the-complete-collection.json
- tsc-the-odyssey-by-homer.json
- tsc-ulysses-by-james-joyce.json
- what-color-is-your-parachute.json
- why-we-sleep-unlocking-the-power-of-sleep.json
- why-zebras-dont-get-ulcers.json
- your-money-or-your-life.json

Total: 52 entities
God Mode will consult: 49 entities (excludes god-mode, eq-score, global)
```

**Future-proof:**
```
Add new entity file:
  ai-entities/quantum-physics.json

Result:
  God Mode automatically includes it in next run
  No code changes needed
  No configuration updates required
  
Processing time increases by ~5 seconds per new entity
  Current: 49 entities × 5 sec = 245 seconds (~4 minutes)
  With 1 new: 50 entities × 5 sec = 250 seconds (~4.15 minutes)
```

### Future Enhancement (V2): Mistral-Powered Entity Selection

**Vision:** Let Mistral Small analyze the human's question and intelligently select 12-15 most relevant entities.

**How it would work:**

**Step 1: Question Analysis**
```typescript
// Send question to Mistral Small for analysis
const analysisPrompt = `
Human question: "${humanQuestion}"

Available AI entities and their specializations:
1. TheEternal (id: the-eternal) - Metaphysics, eternal consciousness, timeless truths
2. Aristotle (id: aristotle) - Classical philosophy, logic, virtue ethics
3. Astrophysics (id: astrophysics-a-deep-dive) - Neuroscience, physics, cosmology
4. FearAndLoathing (id: fear-and-loathing) - Gonzo journalism, experiential truth
5. EmotionalIntelligence (id: emotional-intelligence) - Psychology, affect, EQ
... [all 44 entities with descriptions]

Task: Select 12-15 entities that would provide the MOST DIVERSE 
and RELEVANT perspectives for this specific question. Consider:
- Question domain (science? philosophy? practical?)
- Need for contrasting viewpoints
- Balance of approaches (theoretical, practical, critical)
- Unique angles only each entity can provide

Return ONLY entity IDs as comma-separated list.
Example: the-eternal,aristotle,fear-and-loathing,astrophysics-a-deep-dive,...
`;

const selectedEntityIds = await callMistralForSelection(analysisPrompt);
```

**Step 2: Filter Entities**
```typescript
// Parse Mistral's response
const entityIds = selectedEntityIds.split(',').map(id => id.trim());

// Get selected entities
const selectedEntities = entityIds
  .map(id => getEntity(id))
  .filter(Boolean);

console.log(`[GOD-MODE] Mistral selected ${selectedEntities.length} entities`);

// Process only these entities
for (const entity of selectedEntities) {
  await processEntityWithContext(entity);
}
```

**Example Selections:**

**Question: "What is consciousness?"**
Mistral selects:
- TheEternal (metaphysics)
- Aristotle (classical philosophy)
- BeingAndNothingness (existentialism)
- Astrophysics (neuroscience)
- EmotionalIntelligence (psychology)
- TSC-Ulysses (stream-of-consciousness literature)
- FearAndLoathing (experiential)
- 1984 (control/surveillance angle)
- GodIsAMachine (mechanistic view)
- FindEnlightenment (spiritual)
- SleepCoach (biological necessity)
- TheBodyKeepsTheScore (embodied cognition)

**Question: "How do I start a business?"**
Mistral selects:
- CrushingIt (entrepreneurship)
- MonetizeYourPassion (business models)
- TheMoneyMentor (finance)
- WhatColorIsYourParachute (career)
- EmotionalIntelligence (EQ in leadership)
- ArtOfWar (strategy)
- ClimbTheCorporateLadder (corporate skills)
- CrucialConversations (communication)
- StressFreeLiving (work-life balance)
- FearAndLoathing (contrarian view)
- 1984 (corporate critique)

**Question: "Why can't I sleep?"**
Mistral selects:
- SleepCoach (primary expert)
- WhyWeSleep (sleep science)
- TheBodyKeepsTheScore (trauma/sleep)
- StressFreeLiving (stress management)
- EmotionalIntelligence (emotional regulation)
- Astrophysics (circadian rhythms)
- ModernParenting (if family context)
- ToxicHeal (environmental factors)
- FindEnlightenment (meditation)
- FearAndLoathing (substance effects)

### Code Architecture for Easy V2 Migration

**Current V1 code structure:**
```typescript
async function handleGodMode(message: any, godModeEntity: any) {
  // V1: Get ALL entities
  const entities = await selectEntities(message, godModeEntity);
  
  // Process entities serially
  for (const entity of entities) {
    await processEntityWithContext(message, entity, context);
  }
  
  // Synthesize
  await generateSynthesis(context);
}

// V1 implementation (simple)
async function selectEntities(message: any, godModeEntity: any) {
  // Return ALL entities
  return getAllEntities().filter(e => 
    e.enabled && 
    e.id !== 'god-mode' && 
    e.id !== 'eq-score'
  );
}
```

**V2 migration (just replace selectEntities function):**
```typescript
// V2 implementation (Mistral-powered)
async function selectEntities(message: any, godModeEntity: any) {
  // Check if entity has selectionStrategy
  if (godModeEntity.selectionStrategy === 'mistral') {
    // Use Mistral to select relevant entities
    return await selectEntitiesWithMistral(message);
  }
  
  // Default: return ALL entities
  return getAllEntities().filter(e => 
    e.enabled && 
    e.id !== 'god-mode' && 
    e.id !== 'eq-score'
  );
}

async function selectEntitiesWithMistral(message: any) {
  // Build entity catalog with descriptions
  const entityCatalog = buildEntityCatalog();
  
  // Ask Mistral to select
  const analysisPrompt = buildSelectionPrompt(message.text, entityCatalog);
  const selectedIds = await callMistralForSelection(analysisPrompt);
  
  // Return selected entities
  return selectedIds
    .map(id => getEntity(id))
    .filter(Boolean);
}
```

**god-mode.json configuration:**
```json
{
  "id": "god-mode",
  "selectionStrategy": "all",  // V1: "all", V2: "mistral"
  "selectionModel": "mistral-small",  // For V2
  "maxSelectedEntities": 15,  // For V2
  ...
}
```

**Benefits of this architecture:**
1. ✅ V1 works perfectly with ALL entities
2. ✅ V2 migration requires ONLY:
   - Add `selectEntitiesWithMistral()` function
   - Update `selectEntities()` to check strategy
   - Change config: `"selectionStrategy": "mistral"`
3. ✅ Can A/B test both approaches
4. ✅ User can choose via URL: `&selection=all` or `&selection=mistral`

### Why Start with ALL (V1)?

**Reasons to implement ALL-entity approach first:**

1. **Simplicity:** No selection logic needed
2. **Full Coverage:** Guaranteed to hit all angles
3. **Quality Baseline:** See what ALL entities contribute
4. **Selection Insight:** Learn which entities add value (informs V2)
5. **User Preference:** User wants to watch full conversation develop
6. **Time Acceptable:** 3-4 minutes is fine for the depth gained

**When to implement Mistral selection (V2):**
- After using V1 and seeing patterns
- When speed becomes priority
- For specific use cases (research vs quick answers)
- As optional enhancement (not replacement)

---

### **Phase 0: Preparation (Current)**

**Status:** ⏳ In Progress

**Tasks:**
1. ✅ Design architecture and user flow
2. ✅ Create README documentation
3. ✅ LM Studio running on 10.0.0.100 with model loaded
4. ⏳ Test synthesis with LM Studio API
5. ⏳ Verify no impact on existing system

**LM Studio Setup (10.0.0.100):**

LM Studio is already running on 10.0.0.100:1234 with OpenAI-compatible API.

**API Endpoint:**
```
http://10.0.0.100:1234/v1/chat/completions
```

**Model Selection:**
- Whatever model is loaded in LM Studio will handle synthesis
- User can swap models anytime (Magistral, Mistral, Llama, etc.)
- No code changes needed to change synthesis model
- Maximum flexibility for experimentation

**Testing synthesis:**
```bash
# Test LM Studio API from PM2 machine (10.0.0.110)
curl -X POST http://10.0.0.100:1234/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "any",
    "messages": [
      {"role": "user", "content": "Synthesize these 3 views: 1) Eternal 2) Biological 3) Illusion"}
    ],
    "temperature": 0.7,
    "max_tokens": 500
  }'
```

**Success Criteria:**
- ✅ LM Studio responds to API calls
- ✅ Synthesis quality is high
- ✅ Response time acceptable (~20-60 seconds)
- ✅ Existing Ollama entities still work (10.0.0.110)

---

### **Phase 1: Basic God Mode (MVP)**

**Status:** 📋 Planned

**Goal:** Get God Mode working with 3-5 entities first (proof of concept).

#### **1.1: Create God Mode Entity**

**File:** `ai-entities/god-mode.json`

```json
{
  "id": "god-mode",
  "username": "GodMode",
  "baseModel": "the-eternal",
  "quantizations": {
    "f16": {
      "modelPath": "the-eternal-f16",
      "enabled": true
    }
  },
  "defaultQuantization": "f16",
  "systemRole": "system",
  "systemPrompt": "You are a meta-synthesizer. Your task is to analyze multiple AI perspectives and create a comprehensive, balanced synthesis.",
  "userPrompt": "",
  "filterOut": [
    "GodMode:",
    "Assistant:"
  ],
  "trimAfter": ["Human:"],
  "trimWhitespace": true,
  "addNewlineToContext": false,
  "addVariableToContext": "",
  "addEntityUsername": false,
  "nom": 100,
  "defaultPriority": 50,
  "temperature": 0.7,
  "max_tokens": 500,
  "top_p": 0.9,
  "top_k": 40,
  "frequency_penalty": 0.0,
  "min_p": 0.1,
  "responseChance": 1.0,
  "rateLimits": {
    "minSecondsBetweenPosts": 1,
    "maxPostsPerMinute": 1000,
    "maxPostsPerHour": 30000
  },
  "enabled": true,
  "modelServer": "ollama-hm",
  "specialHandler": "multiEntityBroadcast",
  "synthesisServer": "lm-studio",
  "synthesisEndpoint": "http://10.0.0.100:1234/v1/chat/completions",
  "synthesisTimeout": 600
}
```

**Key fields:**
- `specialHandler: "multiEntityBroadcast"` - Triggers God Mode processing
- `synthesisServer: "lm-studio"` - Use LM Studio for synthesis (not Ollama)
- `synthesisEndpoint` - LM Studio API on 10.0.0.100
- `synthesisTimeout: 600` - Max 10 minutes for synthesis (allows for slower models)

#### **1.2: Add Special Handler Detection**

**File:** `src/index-do-simple.ts`

**Add before main processing:**

```typescript
// Special handler for God Mode
if (entity.specialHandler === 'multiEntityBroadcast') {
  console.log('[GOD-MODE] Detected multi-entity broadcast request');
  await handleGodMode(message, entity);
  return; // Don't continue with normal processing
}
```

#### **1.3: Implement handleGodMode Function**

**File:** `src/index-do-simple.ts`

```typescript
async function handleGodMode(message: any, godModeEntity: any): Promise<void> {
  console.log('[GOD-MODE] Starting multi-entity broadcast');
  
  // PHASE 1: Start with just 3 entities for testing
  const testEntities = ['the-eternal', 'aristotle', 'fear-and-loathing'];
  
  const entities = testEntities.map(id => getEntity(id)).filter(Boolean);
  
  console.log(`[GOD-MODE] Broadcasting to ${entities.length} entities`);
  
  // Post initial status message
  await postToAPI({
    text: `🔮 Consulting ${entities.length} AI entities...`,
    username: godModeEntity.username,
    color: godModeEntity.color || '200150080',
    messageType: 'AI',
    replyTo: message.id,
    priority: message.botParams?.priority,
    ais: message.botParams?.ais
  });
  
  // Broadcast to all entities in parallel
  const responses = await Promise.all(
    entities.map(async (entity) => {
      try {
        console.log(`[GOD-MODE] Processing with ${entity.id}`);
        
        // Process message with this entity
        const response = await processMessageWithEntity(message, entity);
        
        return {
          entity: entity.id,
          username: entity.username,
          response: response
        };
      } catch (error: any) {
        console.error(`[GOD-MODE] Error with ${entity.id}:`, error.message);
        return null;
      }
    })
  );
  
  // Filter out failed responses
  const successfulResponses = responses.filter(r => r !== null);
  
  console.log(`[GOD-MODE] Collected ${successfulResponses.length} responses`);
  
  // Build synthesis prompt
  const synthesisPrompt = buildSynthesisPrompt(
    message.text,
    successfulResponses
  );
  
  // Call synthesis via LM Studio
  console.log('[GOD-MODE] Generating synthesis with LM Studio...');
  const synthesis = await callLMStudioForSynthesis(
    godModeEntity.synthesisEndpoint,
    synthesisPrompt
  );
  
  // Post synthesis
  await postToAPI({
    text: `⚡ [SYNTHESIS]\n\n${synthesis}`,
    username: godModeEntity.username,
    color: godModeEntity.color || '200150080',
    messageType: 'AI',
    replyTo: message.id,
    priority: message.botParams?.priority,
    ais: message.botParams?.ais
  });
  
  console.log('[GOD-MODE] Synthesis complete');
}
```

#### **1.4: Implement Helper Functions**

```typescript
async function processMessageWithEntity(
  message: any, 
  entity: any
): Promise<string> {
  // Get entity's system prompt
  const systemPrompt = entity.systemPrompt || '';
  
  // Build messages array
  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: message.text }
  ];
  
  // Call Ollama
  const modelName = `${entity.baseModel}-${entity.defaultQuantization}`;
  
  const response = await fetch('http://10.0.0.110:11434/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: modelName,
      messages: messages,
      temperature: entity.temperature || 1.0,
      max_tokens: entity.max_tokens || 200,
      stream: false
    })
  });
  
  if (!response.ok) {
    throw new Error(`Ollama error: ${response.status}`);
  }
  
  const data = await response.json() as any;
  const text = data.choices?.[0]?.message?.content || '';
  
  // Post this entity's response to DO
  await postToAPI({
    text: text,
    username: entity.username,
    color: entity.color || '100200080',
    messageType: 'AI',
    replyTo: message.id,
    priority: message.botParams?.priority,
    ais: message.botParams?.ais
  });
  
  return text;
}

function buildSynthesisPrompt(
  question: string, 
  responses: Array<{entity: string, username: string, response: string}>
): string {
  let prompt = `The human asked: "${question}"\n\n`;
  prompt += `Here are responses from ${responses.length} different AI perspectives:\n\n`;
  
  responses.forEach((r) => {
    prompt += `--- ${r.username} (${r.entity}) ---\n`;
    prompt += `${r.response}\n\n`;
  });
  
  prompt += `Your task: Synthesize these perspectives into a comprehensive answer that:\n`;
  prompt += `1. Identifies common themes and consensus points\n`;
  prompt += `2. Highlights interesting disagreements or unique angles\n`;
  prompt += `3. Provides a balanced, multi-faceted answer\n`;
  prompt += `4. Is concise yet thorough (200-300 words)\n\n`;
  prompt += `Format your response as:\n`;
  prompt += `- Brief overview of consensus\n`;
  prompt += `- Key insights from each perspective\n`;
  prompt += `- Notable disagreements or unique views\n`;
  prompt += `- Comprehensive conclusion\n\n`;
  prompt += `Synthesis:`;
  
  return prompt;
}

async function callLMStudioForSynthesis(
  endpoint: string,
  prompt: string
): Promise<string> {
  // Call LM Studio API (OpenAI-compatible)
  // Uses whatever model is currently loaded in LM Studio
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'loaded-model',  // LM Studio ignores this, uses loaded model
      messages: [
        { role: 'user', content: prompt }
      ],
      temperature: 0.7,
      max_tokens: 500,
      stream: false
    })
  });
  
  if (!response.ok) {
    throw new Error(`LM Studio synthesis failed: ${response.status}`);
  }
  
  const data = await response.json() as any;
  return data.choices?.[0]?.message?.content || 'Synthesis failed.';
}
```

**Testing Phase 1:**
```bash
# Test with 3 entities
# URL: #ais=GodMode:200150080&entity=god-mode

# Expected flow:
1. Post: "What is consciousness?"
2. See: "🔮 Consulting 3 AI entities..."
3. See: TheEternal's response
4. See: Aristotle's response
5. See: FearAndLoathing's response
6. See: "⚡ [SYNTHESIS] ..."
```

**Success Criteria:**
- ✅ All 3 responses appear in conversation
- ✅ Synthesis appears after responses
- ✅ No errors in PM2 logs
- ✅ Existing entities still work

---

### **Phase 2: Full Entity Rollout**

**Status:** 📋 Planned (after Phase 1 success)

**Goal:** Expand to all 44 entities with optimizations.

#### **2.1: Expand Entity List**

Change from:
```typescript
const testEntities = ['the-eternal', 'aristotle', 'fear-and-loathing'];
```

To:
```typescript
// Get all enabled entities (excluding god-mode and eq-score)
const allEntities = getAllEntities().filter(e => 
  e.enabled && 
  e.id !== 'god-mode' && 
  e.id !== 'eq-score'
);
```

#### **2.2: Add Timeout Handling**

```typescript
// Set timeout for entity responses
const ENTITY_TIMEOUT = 30000; // 30 seconds

const responses = await Promise.race([
  Promise.all(entities.map(e => processMessageWithEntity(message, e))),
  new Promise(resolve => setTimeout(() => {
    console.log('[GOD-MODE] Timeout reached, proceeding with collected responses');
    resolve([]);
  }, ENTITY_TIMEOUT))
]);
```

#### **2.3: Add Batching (Optional)**

If Ollama struggles with 44 parallel requests:

```typescript
// Process in batches of 10
const BATCH_SIZE = 10;
const allResponses: any[] = [];

for (let i = 0; i < entities.length; i += BATCH_SIZE) {
  const batch = entities.slice(i, i + BATCH_SIZE);
  console.log(`[GOD-MODE] Processing batch ${i / BATCH_SIZE + 1}`);
  
  const batchResponses = await Promise.all(
    batch.map(e => processMessageWithEntity(message, e))
  );
  
  allResponses.push(...batchResponses);
}
```

**Testing Phase 2:**
```bash
# Test with all 44 entities
# Expected: 44 responses + 1 synthesis in ~30 seconds
```

**Success Criteria:**
- ✅ All 44 responses appear
- ✅ Synthesis incorporates all perspectives
- ✅ Completes within 30-35 seconds
- ✅ No Ollama server crashes

---

### **Phase 3: Optimization & Polish**

**Status:** 📋 Future

**Goal:** Improve performance, UX, and add advanced features.

#### **3.1: Smart Entity Selection**

Instead of all 44, curate a diverse subset:

```typescript
const diverseEntities = [
  // Philosophy
  'the-eternal',
  'aristotle',
  'being-and-nothingness',
  
  // Science
  'astrophysics-a-deep-dive',
  
  // Literature
  'fear-and-loathing',
  
  // Psychology
  'emotional-intelligence',
  
  // Dystopian
  '1984',
  
  // Self-help
  'how-to-get-what-you-want',
  
  // Technical
  'cryptocurrency',
  
  // Health
  'sleep-coach',
  
  // Business
  'crushing-it',
  
  // Spirituality
  'find-enlightenment'
];
```

**Benefit:** Faster (12 entities vs 44), still comprehensive.

#### **3.2: Response Quality Filtering**

```typescript
// Filter out low-quality responses
const qualityResponses = responses.filter(r => 
  r.response.length > 50 && // Not too short
  !r.response.includes('I don\'t know') && // Actually answered
  !r.response.includes('error') // No errors
);
```

#### **3.3: Enhanced Synthesis Prompt**

```typescript
prompt += `Special instructions:\n`;
prompt += `- Group similar viewpoints together\n`;
prompt += `- Highlight the most unique or surprising perspective\n`;
prompt += `- Note which perspectives are backed by science vs philosophy\n`;
prompt += `- End with actionable insights if applicable\n`;
```

#### **3.4: Caching for Repeated Questions**

```typescript
// Check cache before broadcasting
const cacheKey = `godmode:${hashQuestion(message.text)}`;
const cached = await getCachedSynthesis(cacheKey);

if (cached && isCacheFresh(cached.timestamp)) {
  // Return cached synthesis
  await postToAPI({
    text: `⚡ [CACHED SYNTHESIS]\n\n${cached.synthesis}`,
    ...
  });
  return;
}
```

#### **3.5: Frontend Loading Animation**

```typescript
// In CommentsStream.tsx
if (message.text.includes('🔮 Consulting')) {
  showLoadingAnimation({
    message: 'Gathering perspectives...',
    duration: 30000
  });
}
```

---

## Technical Specifications

### Entity Configuration

**god-mode.json fields:**
- `specialHandler`: `"multiEntityBroadcast"` - Triggers special processing
- `synthesisModel`: `"mistral-small"` - Model for final synthesis
- `synthesisTimeout`: `30` - Max seconds to wait for responses

### DO Storage Impact

**Conversation key:** Standard format (no changes needed)
```
conv:Human:080150227:GodMode:200150080
```

**Message count per God Mode question:**
- 1 human message
- 1 status message ("Consulting...")
- 44 entity responses (or fewer if timeout/filtering)
- 1 synthesis message

**Total:** ~47 messages per God Mode question

**Storage impact:** Same as 47 regular messages (no special handling needed).

### Ollama Load

**Parallel requests:** Up to 44 simultaneous
**Expected duration:** 3-5 seconds per entity
**Total time:** ~30 seconds (parallel processing)

**Server specs (10.0.0.110):**
- Mac Studio (M2 Max)
- 512GB RAM
- Should handle 44 parallel requests comfortably

**Monitoring:** Watch PM2 logs and Ollama logs for:
- Model swapping delays
- Memory pressure
- Request queuing

### URL Structure

**God Mode URL:**
```
https://saywhatwant.com/#ais=GodMode:200150080&entity=god-mode
```

**With filters (optional):**
```
https://saywhatwant.com/#ais=GodMode:200150080&entity=god-mode&u=TheEternal:080175220+Aristotle:100200080&filteractive=true
```

**Compatibility:** Existing filter system handles this automatically (no changes needed).

---

## Zero-Impact Guarantees

### How This Doesn't Break Existing System

**1. Isolated Handler:**
```typescript
if (entity.specialHandler === 'multiEntityBroadcast') {
  await handleGodMode(message, entity);
  return; // Early exit - normal processing never runs
}
```

**2. Entity-Specific:**
- Only triggers when `entity=god-mode`
- All other entities use normal processing
- No shared state or global changes

**3. DO Storage:**
- Uses standard conversation keys
- No new storage patterns
- Frontend polls/displays normally

**4. Ollama:**
- Same API endpoints
- Same request format
- Just more parallel requests (server can handle it)

**5. Frontend:**
- Zero code changes needed
- Displays messages as normal
- Filter system already supports multiple AI usernames in one conversation

### Testing Checklist (Before Each Phase)

**Before deploying any phase:**

1. ✅ Test existing entity (e.g., TheEternal)
   - Post message
   - Get response
   - Verify timing (~5s)

2. ✅ Test God Mode
   - Post message
   - See all responses
   - See synthesis

3. ✅ Test existing entity again
   - Verify still works
   - Verify no slowdown

4. ✅ Check PM2 logs
   - No errors
   - Normal processing for non-God-Mode

5. ✅ Check Ollama
   - Models still loaded
   - No crashes
   - Response times normal

---

## Performance Expectations

### Phase 1 (3 entities - MVP)

- **Time:** ~15-20 seconds
- **Messages:** 5 total (status + 3 responses + synthesis)
- **Load:** Minimal
- **Purpose:** Prove serial context architecture works

### Phase 2 (ALL 49 entities - Production)

- **Time:** ~4 minutes (245 seconds)
- **Breakdown:**
  - 49 entities × ~5 seconds each = 245 seconds
  - User watches responses stream every 5 seconds
  - Feels faster because of constant activity
- **Messages:** ~52 total (status + 49 responses + synthesis)
- **Load:** Serial processing = no Ollama overload
- **User Experience:** Engaging to watch conversation develop

### Phase 3 (Mistral Selection - Future)

- **Time:** ~60-90 seconds (12-15 entities)
- **Messages:** ~15-18 total (status + entities + synthesis)
- **Load:** Moderate
- **Purpose:** Faster responses for time-sensitive queries

---

## Risks & Mitigations

### Risk 1: Ollama Overload

**Symptom:** Sequential processing still overloads Ollama

**Mitigation:**
- Serial processing = NO parallel load (safe by design)
- Each request waits for previous to complete
- Ollama only processes 1 entity at a time
- No risk of overload with serial approach

### Risk 2: Slow Synthesis

**Symptom:** Synthesis takes too long (>10s)

**Mitigation:**
- Use faster quantization (q8_0 instead of f16)
- Shorter max_tokens (300 instead of 500)
- Simpler synthesis prompt

### Risk 3: Poor Synthesis Quality

**Symptom:** Synthesis doesn't capture all perspectives

**Mitigation:**
- Improve synthesis prompt with examples
- Try different synthesis models (Gemma 27B)
- Filter low-quality entity responses before synthesis

### Risk 4: Storage Bloat

**Symptom:** DO storage fills up faster

**Mitigation:**
- Not a real concern (47 messages vs 2 is negligible)
- Normal rolling window (300 messages) handles this
- Can implement God Mode response pruning if needed

---

## Success Metrics

### Phase 1 Success

- ✅ 3 entities respond correctly
- ✅ Synthesis appears and makes sense
- ✅ No impact on existing entities
- ✅ Completes in <10 seconds

### Phase 2 Success

- ✅ 44 entities respond (or timeout gracefully)
- ✅ Synthesis incorporates all perspectives
- ✅ Completes in <35 seconds
- ✅ No Ollama crashes

### Phase 3 Success

- ✅ Smart selection gives quality results
- ✅ Completes in <20 seconds
- ✅ Synthesis quality high
- ✅ User satisfaction high

---

## Future Enhancements

### V2 Features (Post-MVP)

**1. User-Selected Entities**
```
URL: #ais=GodMode:200150080&entity=god-mode&godmode-entities=the-eternal+aristotle+1984
```

**2. Weighted Synthesis**
```typescript
// Give more weight to certain entity types
const weights = {
  philosophy: 2.0,
  science: 1.5,
  other: 1.0
};
```

**3. Debate Mode**
```typescript
// Entities respond to each other's responses
// Round 1: All entities respond to question
// Round 2: Each entity responds to opposing views
// Round 3: Synthesis
```

**4. Summary-Only Mode**
```typescript
// Don't show individual responses
// Just collect and synthesize
// Faster, cleaner
```

**5. Custom Synthesis Prompts**
```typescript
// User can choose synthesis style:
// - Academic (formal, citations)
// - Creative (metaphors, storytelling)
// - Actionable (steps, recommendations)
// - Debate (pros/cons, arguments)
```

---

## FAQ

### Q: Will this slow down normal conversations?
**A:** No. God Mode only runs when `entity=god-mode`. All other entities use normal processing.

### Q: What if some entities fail?
**A:** God Mode proceeds with successful responses and synthesizes what it got.

### Q: Can I filter the 44 responses?
**A:** Yes! Use normal username filters. Or wait for synthesis if you just want the summary.

### Q: How long does it take?
**A:** Phase 1: ~10s, Phase 2: ~30s, Phase 3: ~20s (optimized)

### Q: Can I use God Mode with context?
**A:** Not in MVP. But we could add this in V2 (each entity sees conversation history).

### Q: What if two God Mode requests happen at once?
**A:** Each is independent. Both will broadcast to all entities. Ollama queues requests.

### Q: Can I choose which entities to consult?
**A:** Not in MVP. Phase 3 has smart selection. V2 will have user selection.

---

## Installation & Setup

### Prerequisites

1. ✅ Ollama running on 10.0.0.110
2. ✅ PM2 bot worker running
3. ✅ DO worker deployed
4. ✅ Frontend deployed

### Step 1: Install Mistral Small

```bash
# SSH to 10.0.0.110
ssh user@10.0.0.110

# Pull Mistral Small 3.1 32B
ollama pull mistral-small:latest

# Test it
ollama run mistral-small:latest "Hello, test synthesis"

# Verify model loaded
ollama list | grep mistral-small
```

### Step 2: Create god-mode.json

```bash
cd /path/to/AI-Bot-Deploy/ai-entities
nano god-mode.json
# [Paste entity config from Phase 1]
```

### Step 3: Update PM2 Worker

```bash
cd /path/to/AI-Bot-Deploy
# [Add God Mode handler code to src/index-do-simple.ts]
npm run build
pm2 restart ai-bot-worker
```

### Step 4: Test

```bash
# Open frontend
# URL: #ais=GodMode:200150080&entity=god-mode
# Post: "What is consciousness?"
# Watch responses stream in
```

---

## Rollback Plan

### If Something Breaks

**Immediate rollback:**
```bash
# Disable God Mode entity
cd /path/to/AI-Bot-Deploy/ai-entities
# Edit god-mode.json: "enabled": false

# Restart PM2
pm2 restart ai-bot-worker

# God Mode now disabled, all other entities work normally
```

**Code rollback:**
```bash
git revert <commit-hash-of-god-mode-changes>
npm run build
pm2 restart ai-bot-worker
```

**Nuclear option:**
```bash
# Delete god-mode.json
rm ai-entities/god-mode.json
# Comment out God Mode handler in index-do-simple.ts
# Rebuild and restart
```

---

## Related Documentation

- README-192: Per-file entity configuration system
- README-163: Ollama server installation
- README-179: DO conversation storage architecture
- README-03: Features documentation

---

**Status:** Ready for Phase 0 (Mistral Small installation & testing)

**Next Steps:**
1. Install Mistral Small on 10.0.0.110
2. Test synthesis with simple prompts
3. Proceed to Phase 1 implementation

**Last Updated:** 2025-11-11  
**Author:** Claude (Anthropic) - AI Engineering Agent

