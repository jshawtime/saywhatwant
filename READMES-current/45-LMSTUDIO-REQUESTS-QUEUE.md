# 🚀 LM Studio Intelligent Request Queue System

## 📌 Version
- **Date**: October 4, 2025
- **Version**: v2.0
- **Status**: Phase 1 COMPLETE ✅ | Router LLM: Future Phase
- **Philosophy**: Smart queue, dumb workers. Simple, scalable, battle-tested.

## ✅ IMPLEMENTATION STATUS

### Phase 1: Basic Queue System (COMPLETE)
- ✅ AsyncMutex for atomic operations
- ✅ Priority queue (min-heap)
- ✅ Queue service with stats
- ✅ Worker pull loop
- ✅ Dual-loop architecture (polling + worker)
- ✅ Feature flag: USE_QUEUE (default: enabled)
- ✅ Protected existing code (queue is optional layer)

### Router LLM: FUTURE PHASE
- 📋 Fully designed (see Router LLM System section)
- 📋 Feature flag ready: USE_ROUTER (default: disabled)
- 📋 Currently using default priority: 50 (medium)
- 📋 Will be implemented in Phase 2
- 📋 Queue already supports router decisions

**Current Behavior**: All queued items get priority 50 (medium). Router will enable intelligent priority assignment when activated.

## 🎯 Executive Summary

A priority-based request queue system capable of handling **300+ messages/minute** across **30+ distributed LM Studio servers**. Features a **Router LLM** for intelligent priority assignment, URL-based priority overrides, and atomic queue operations for race-condition-free processing.

## 📊 System Requirements

### Scale Targets
- **Throughput**: 300+ requests/minute sustained
- **Server Pool**: 30+ LM Studio instances
- **Latency**: < 2 seconds average response time
- **Availability**: 99.9% uptime
- **Concurrency**: Handle simultaneous requests safely

### Hardware Assumptions
- **Current**: 2 Mac Studios (10.0.0.102, 10.0.0.100)
- **Near Future**: 5-10 Macs
- **Long Term**: 30+ mixed hardware (Macs, PCs, cloud instances)
- **Network**: Local gigabit LAN (1000 Mbps)

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────┐
│  Incoming Messages (from Say What Want)             │
│  - Human messages                                    │
│  - AI messages (bot-to-bot allowed in AI channel)   │
│  - Rate: 300+ per minute potential                  │
└──────────────────┬──────────────────────────────────┘
                   ↓
┌─────────────────────────────────────────────────────┐
│  ROUTER LLM (Priority Assignment)                   │
│  - Analyzes conversation context                    │
│  - Determines appropriate entity                    │
│  - Assigns priority (0-99)                          │
│  - Suggests model to use                            │
│  - Response format: JSON parseable                  │
└──────────────────┬──────────────────────────────────┘
                   ↓
┌─────────────────────────────────────────────────────┐
│  PRIORITY QUEUE (Smart Orchestrator)                │
│  - Min-heap data structure                          │
│  - Priority 0 = highest (top of heap)               │
│  - Priority 99 = lowest (bottom of heap)            │
│  - Atomic dequeue operations                        │
│  - Thread-safe with mutex locks                     │
│  - Persistent (Redis or memory + disk backup)       │
└──────────────────┬──────────────────────────────────┘
                   ↓
┌─────────────────────────────────────────────────────┐
│  SERVER POOL (30+ LM Studio Instances)              │
│  - Workers PULL from queue (not pushed to)          │
│  - Each server polls: "Give me next task"           │
│  - Atomic claim mechanism prevents duplication      │
│  - Health-aware routing                             │
│  - Model-affinity optimization                      │
└──────────────────┬──────────────────────────────────┘
                   ↓
┌─────────────────────────────────────────────────────┐
│  Response Processing & KV Storage                   │
│  - Post to Say What Want                            │
│  - Update queue statistics                          │
│  - Release server back to pool                      │
└─────────────────────────────────────────────────────┘
```

## 🧠 Router LLM System

### Purpose
A specialized LLM that acts as an **intelligent traffic controller**, analyzing incoming messages and assigning optimal routing.

### Router Entity Configuration

#### In `config-aientities.json`:
```json
{
  "entities": [
    {
      "id": "router-primary",
      "enabled": true,
      "username": "__ROUTER__",
      "model": "router-model-fast",  // Optimized for quick decisions
      "role": "router",  // Special role identifier
      "systemPrompt": "You are a routing AI. Analyze the conversation and respond with ONLY a JSON object containing:\n{\n  \"priority\": 0-99,\n  \"entity\": \"entity-id\",\n  \"model\": \"model-name\",\n  \"reason\": \"brief explanation\"\n}\n\nPriority scale:\n0-10: Urgent/direct address\n11-30: High relevance\n31-60: Medium relevance\n61-90: Low relevance\n91-99: Background/optional\n\nSelect entity based on:\n- Direct mentions (highest priority)\n- Topic expertise match\n- Conversation patterns\n- Recent entity activity (diversity)\n\nRespond ONLY with valid JSON, nothing else.",
      "temperature": 0.3,  // Low temp for consistent routing
      "maxTokens": 100,
      "messagesToRead": 10,  // Only recent context needed
      "responseChance": 1.0,  // Always responds
      "rateLimits": {
        "minSecondsBetweenPosts": 0,  // No posting limit (doesn't post publicly)
        "maxPostsPerMinute": 300  // Can handle 300 routing decisions/min
      }
    }
  ]
}
```

#### In `config-highermind.json`:
```json
{
  "entities": [
    {
      "id": "router-highermind",
      "enabled": true,
      "username": "__ROUTER__",
      "model": "highermind_router",  // Specialized router model
      "role": "router",
      "systemPrompt": "You are an intelligent routing system for Highermind AI conversations. Analyze the context and respond with ONLY this JSON format:\n{\n  \"priority\": 0-99,\n  \"entity\": \"eternal-main|fear-main|eternal-tech|fear-creative\",\n  \"reason\": \"why this entity\"\n}\n\nPriority Guidelines:\n0-10: User directly addressed an entity\n11-30: Perfect topic/expertise match\n31-60: General conversation fit\n61-90: Weak match but possible\n91-99: Should probably skip\n\nReturn ONLY JSON, no other text.",
      "temperature": 0.2,  // Very consistent
      "maxTokens": 80,
      "messagesToRead": 5
    }
  ]
}
```

### Router Response Example

**Input**: "Hey FearAndLoathing, what do you think about consciousness?"

**Router Response**:
```json
{
  "priority": 5,
  "entity": "philosopher",
  "model": "fear_and_loathing",
  "reason": "Direct address + philosophical topic"
}
```

**Input**: "Anyone know how to fix this bug?"

**Router Response**:
```json
{
  "priority": 25,
  "entity": "tech",
  "model": "highermind_the-eternal-1",
  "reason": "Technical question, tech entity best fit"
}
```

## 📋 Priority Scale (0-99)

### Priority Bands

| Range | Category | Description | Example |
|-------|----------|-------------|---------|
| **0-10** | Critical | Direct address, urgent | "Hey HigherMind, help!" |
| **11-20** | High | Perfect topic match | Philosophy question → philosopher |
| **21-30** | Important | Strong relevance | Technical topic → tech entity |
| **31-50** | Medium | General conversation fit | Random chat → any entity |
| **51-70** | Low | Weak match | Off-topic but can respond |
| **71-90** | Background | Optional | Filler conversation |
| **91-99** | Minimal | Skip unless idle | Low-quality content |

### Priority Modifiers

```typescript
// Base priority from router
let priority = routerResponse.priority;  // 0-99

// BOOST: Direct user mention
if (message.includes('@HigherMind')) {
  priority = Math.max(0, priority - 20);  // Bump up 20 points
}

// BOOST: Question marks (seeking answer)
if (message.includes('?')) {
  priority = Math.max(0, priority - 5);   // Bump up 5 points
}

// PENALTY: Recent response from same entity
if (entity.lastResponseTime < 30000) {  // Within 30 seconds
  priority = Math.min(99, priority + 15);  // Drop 15 points
}

// PENALTY: Queue congestion
if (queueLength > 100) {
  priority = Math.min(99, priority + 10);  // Drop 10 points for non-critical
}
```

## 🔗 URL Priority Override

### Parameter: `priority=N`

```
https://saywhatwant.app/#priority=0&model=highermind_the-eternal-1&uis=Alice
```

**Behavior:**
- **Bypasses router** completely
- **Forces priority** to specified value (0-99)
- **Immediately queues** with that priority
- **Useful for**:
  - Private conversations (always priority 0)
  - Testing specific priority levels
  - Debugging queue behavior
  - VIP user experiences

### Priority URL Examples

```bash
# HIGHEST PRIORITY (0) - Immediate response
https://saywhatwant.app/#priority=0&model=eternal-main&uis=VIP

# MEDIUM PRIORITY (50) - Normal flow
https://saywhatwant.app/#priority=50&u=alice

# BACKGROUND (95) - Low priority testing
https://saywhatwant.app/#priority=95&model=test-entity
```

## 🗂️ Queue Data Structure

### Min-Heap Priority Queue

```typescript
interface QueueItem {
  id: string;                    // Unique request ID
  priority: number;              // 0-99 (0 = highest)
  timestamp: number;             // When queued
  message: Comment;              // The message to respond to
  context: ConversationContext;  // Analyzed context
  entity: AIEntity;              // Selected entity
  model: string;                 // Model to use
  routerReason: string;          // Why router chose this
  attempts: number;              // Retry counter
  claimedBy: string | null;      // Server IP if claimed
  claimedAt: number | null;      // When claimed
  maxRetries: number;            // Max attempts allowed
}

class PriorityQueue {
  private heap: QueueItem[];          // Min-heap array
  private itemMap: Map<string, number>; // ID → index for O(1) lookup
  private mutex: AsyncMutex;          // For atomic operations
  
  // Core operations (all atomic)
  async enqueue(item: QueueItem): Promise<void>
  async dequeue(): Promise<QueueItem | null>
  async peek(): Promise<QueueItem | null>
  async claim(serverId: string): Promise<QueueItem | null>
  async release(itemId: string, success: boolean): Promise<void>
  
  // Maintenance
  async requeue(itemId: string, newPriority?: number): Promise<void>
  async remove(itemId: string): Promise<void>
  async clearStale(maxAge: number): Promise<number>
  
  // Queries
  size(): number
  isEmpty(): boolean
  getStats(): QueueStats
}
```

### Heap Operations (O(log n))

```typescript
// Standard min-heap for priority queue
class MinHeap {
  // Insert new item - O(log n)
  push(item: QueueItem) {
    this.heap.push(item);
    this.bubbleUp(this.heap.length - 1);
  }
  
  // Remove highest priority - O(log n)
  pop(): QueueItem | null {
    if (this.heap.length === 0) return null;
    if (this.heap.length === 1) return this.heap.pop()!;
    
    const top = this.heap[0];
    this.heap[0] = this.heap.pop()!;
    this.bubbleDown(0);
    return top;
  }
  
  // Reorder after priority change - O(log n)
  updatePriority(itemId: string, newPriority: number) {
    const index = this.itemMap.get(itemId);
    if (index === undefined) return;
    
    const oldPriority = this.heap[index].priority;
    this.heap[index].priority = newPriority;
    
    if (newPriority < oldPriority) {
      this.bubbleUp(index);
    } else {
      this.bubbleDown(index);
    }
  }
}
```

## ⚛️ Atomic Queue Operations

### The Classic Race Condition Problem

```typescript
// ❌ WRONG - Race condition!
async badDequeue() {
  const item = this.heap[0];      // Thread 1 reads
  this.heap.shift();              // Thread 2 reads SAME item
  return item;                    // Both threads get same work!
}
```

### Solution: Mutex Lock Pattern

```typescript
// ✅ CORRECT - Atomic with mutex
class AsyncMutex {
  private locked = false;
  private queue: Array<() => void> = [];
  
  async acquire(): Promise<() => void> {
    while (this.locked) {
      await new Promise(resolve => this.queue.push(resolve));
    }
    this.locked = true;
    
    // Return release function
    return () => {
      this.locked = false;
      const next = this.queue.shift();
      if (next) next();
    };
  }
}

class PriorityQueue {
  async claim(serverId: string): Promise<QueueItem | null> {
    const release = await this.mutex.acquire();
    
    try {
      // Find first unclaimed item (atomic section)
      const item = this.heap.find(i => i.claimedBy === null);
      if (!item) return null;
      
      // Claim it
      item.claimedBy = serverId;
      item.claimedAt = Date.now();
      
      return item;
    } finally {
      release();  // Always release mutex
    }
  }
}
```

### Industry Standard: Redis Atomic Operations

For production with 30+ servers, use Redis:

```typescript
// Redis BLPOP is atomic (blocking pop)
async claim(serverId: string): Promise<QueueItem | null> {
  // Atomic: Pop from priority-sorted set
  const [key, data] = await redis.bzpopmin('request_queue', 5);
  
  if (!data) return null;
  
  const item = JSON.parse(data);
  item.claimedBy = serverId;
  item.claimedAt = Date.now();
  
  // Store in "processing" set with TTL
  await redis.setex(`processing:${item.id}`, 300, JSON.stringify(item));
  
  return item;
}
```

## 🎭 Router LLM Integration

### Router Workflow

```typescript
class RouterLLM {
  private routerEntity: AIEntity;
  private lmStudioCluster: LMStudioCluster;
  
  async route(message: Comment, context: ConversationContext): Promise<RoutingDecision> {
    // 1. Build routing prompt
    const prompt = this.buildRoutingPrompt(message, context);
    
    // 2. Call router model (fast, low temperature)
    const response = await this.lmStudioCluster.sendRequest({
      entityId: 'router-primary',
      model: this.routerEntity.model,
      prompt,
      temperature: 0.3,  // Consistent routing
      maxTokens: 100,
      skipQueue: true  // Routers bypass queue!
    });
    
    // 3. Parse JSON response
    const decision = this.parseRouterResponse(response);
    
    // 4. Validate and apply modifiers
    return this.applyPriorityModifiers(decision, message, context);
  }
  
  private buildRoutingPrompt(message: Comment, context: ConversationContext): string {
    return `
AVAILABLE ENTITIES:
${this.listAvailableEntities()}

RECENT CONVERSATION:
${context.recentMessages.slice(-5).map(m => `${m.username}: ${m.text}`).join('\n')}

NEW MESSAGE:
${message.username}: ${message.text}

CONTEXT:
- Active users: ${context.activeUsers.join(', ')}
- Topics: ${context.topics.join(', ')}
- Has question: ${context.hasQuestion}
- Mood: ${context.mood}

ROUTING TASK:
Select the best entity to respond and assign priority.
Return ONLY valid JSON:
{
  "priority": 0-99,
  "entity": "entity-id",
  "model": "model-name",
  "reason": "explanation"
}
    `.trim();
  }
  
  private parseRouterResponse(response: string): RoutingDecision {
    try {
      // Try to extract JSON from response (handles markdown code blocks)
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('No JSON found in response');
      
      const parsed = JSON.parse(jsonMatch[0]);
      
      // Validate structure
      if (typeof parsed.priority !== 'number' || 
          parsed.priority < 0 || 
          parsed.priority > 99) {
        throw new Error('Invalid priority value');
      }
      
      return {
        priority: parsed.priority,
        entityId: parsed.entity,
        modelName: parsed.model,
        reason: parsed.reason || 'Router decision'
      };
    } catch (error) {
      console.error('[Router] Failed to parse response:', error);
      // Fallback: Medium priority, random entity
      return {
        priority: 50,
        entityId: this.getRandomEntity().id,
        modelName: this.getRandomEntity().model,
        reason: 'Fallback - router parse failed'
      };
    }
  }
}
```

### Router Model Requirements

- **Fast**: < 500ms response time
- **Consistent**: Low temperature (0.2-0.3)
- **Small**: 7B parameter model sufficient
- **Specialized**: Fine-tuned for routing decisions (ideal)
- **Format**: MUST return parseable JSON

### Router Bypass Rules

```typescript
// RULE 1: Routers skip the queue - immediate processing
if (entity.role === 'router') {
  return await this.directProcess(request);
}

// RULE 2: Priority 0-9 bypasses router (direct conversations)
// Use case: Private AI conversations from external websites
if (urlPriority !== null && urlPriority >= 0 && urlPriority <= 9) {
  console.log('[Router] Priority 0-9 detected - bypassing router');
  return await this.directQueue(request, urlPriority);
}

// RULE 3: All other requests go through router
return await this.routeAndQueue(request);
```

### Direct Conversation Flow (Priority 0-9)

```
External Website Link
    ↓
URL: #priority=0&model=eternal-main&nom=50&uis=Alice
    ↓
BYPASSES ROUTER ← Direct to queue
    ↓
Queue with priority 0 (immediate processing)
    ↓
Server claims and processes
    ↓
Response posted to filtered conversation
```

## 🌐 URL Parameter System - Source of Truth

### Core Philosophy: URL > Config > Nothing

**CRITICAL RULE**: URL is the ABSOLUTE source of truth. If a parameter exists in the URL, it overrides everything. If not in URL, use config. NO global fallbacks ever.

```typescript
interface URLParameters {
  // Priority & Routing
  priority?: number;          // 0-99 (bypasses router if 0-9)
  entity?: string;            // Force specific entity ID
  model?: string;             // Force specific model
  
  // Context Control
  nom?: number | 'ALL';       // Number of messages to send to LLM
  
  // User State
  uis?: string;               // User initial state (username:color)
  
  // Filter State
  filteractive?: boolean;     // Filter toggle
  u?: string[];               // User filters
  w?: string[];               // Word filters
  mt?: 'human' | 'AI';        // Message type channel
}
```

### URL Parameter Priority Order

```typescript
function buildRequestConfig(urlParams: URLParameters, entity: AIEntity): RequestConfig {
  return {
    // URL FIRST, then entity config, NEVER a global default
    priority: urlParams.priority ?? null,  // No default - router assigns if missing
    model: urlParams.model ?? entity.model,  // URL → entity config
    messagesToRead: urlParams.nom ?? entity.messagesToRead,  // URL → entity config
    temperature: entity.temperature,  // Always from entity (no URL override for this)
    maxTokens: entity.maxTokens,  // Always from entity
    
    // NO FALLBACKS like this:
    // ❌ priority: urlParams.priority ?? entity.priority ?? 50  // WRONG!
    // ✅ priority: urlParams.priority ?? null  // Correct - router will assign
  };
}
```

### Number of Messages Parameter (nom)

```
URL Parameter: nom=N or nom=ALL
Purpose: Control how many messages are sent as context to the LLM
```

**Examples**:
```bash
# Send last 50 messages
https://saywhatwant.app/#priority=0&model=eternal-main&nom=50

# Send ALL messages in conversation
https://saywhatwant.app/#priority=0&model=eternal-main&nom=ALL

# Use entity's default (from config)
https://saywhatwant.app/#priority=0&model=eternal-main
→ Uses entity.messagesToRead from config
```

**Implementation**:
```typescript
interface NOMParameter {
  value: number | 'ALL';
  source: 'url' | 'entity' | 'default';
}

function parseNOM(urlParams: URLSearchParams, entity: AIEntity): NOMParameter {
  const nomParam = urlParams.get('nom');
  
  if (nomParam === 'ALL') {
    return { value: 'ALL', source: 'url' };
  }
  
  if (nomParam !== null) {
    const num = parseInt(nomParam);
    if (!isNaN(num) && num > 0) {
      return { value: num, source: 'url' };
    }
  }
  
  // No URL parameter - use entity config
  if (entity.messagesToRead) {
    return { value: entity.messagesToRead, source: 'entity' };
  }
  
  // Entity doesn't specify - no default! Return null or error
  throw new Error(`Entity ${entity.id} has no messagesToRead and URL has no nom parameter`);
}

// Usage in context building
function buildConversationContext(messages: Comment[], nomConfig: NOMParameter): string {
  if (nomConfig.value === 'ALL') {
    return messages.map(m => `${m.username}: ${m.text}`).join('\n');
  }
  
  // Take last N messages
  return messages
    .slice(-nomConfig.value)
    .map(m => `${m.username}: ${m.text}`)
    .join('\n');
}
```

### Parameter Resolution Matrix

| Parameter | URL Present | Entity Has | Result | Fallback |
|-----------|-------------|------------|--------|----------|
| **priority** | `priority=5` | N/A | Use 5 | Router assigns |
| **priority** | Not in URL | N/A | null | **Router MUST assign** |
| **model** | `model=X` | `"model": "Y"` | Use X | Never happens |
| **model** | Not in URL | `"model": "Y"` | Use Y | **Required in config** |
| **nom** | `nom=50` | `"messagesToRead": 30` | Use 50 | Never happens |
| **nom** | `nom=ALL` | `"messagesToRead": 30` | Use ALL | Never happens |
| **nom** | Not in URL | `"messagesToRead": 30` | Use 30 | **Required in config** |
| **nom** | Not in URL | Not in config | ERROR | **No fallback - must specify** |

### Config as Source of Truth (When URL Doesn't Override)

```typescript
// ❌ BAD: Global defaults everywhere
const temperature = urlParams.temp ?? entity.temperature ?? 0.7;  // WRONG!

// ✅ GOOD: URL → Config → Error
const temperature = urlParams.temp ?? entity.temperature ?? (() => {
  throw new Error(`Entity ${entity.id} missing temperature and URL has no temp parameter`);
})();

// ✅ BETTER: Just URL → Config (let it fail if both missing)
const temperature = urlParams.temp ?? entity.temperature;
// If both are undefined, TypeScript will catch it!
```

## 🌍 External Website Integration - Primary Use Case

### Scenario: Links from Other Websites

**Your Website** → **Direct AI Conversation Links** → **Say What Want Filtered View**

```html
<!-- On your-website.com -->
<a href="https://saywhatwant.app/#priority=0&model=eternal-main&nom=50&uis=Visitor:random&filteractive=true">
  Chat with TheEternal AI
</a>

<a href="https://saywhatwant.app/#priority=0&entity=philosopher&nom=ALL&uis=Seeker:random&filteractive=true">
  Philosophical Discussion
</a>

<a href="https://saywhatwant.app/#priority=0&model=fear_and_loathing&nom=30&uis=Creative:random&filteractive=true">
  Creative Brainstorming
</a>
```

### Complete External Link Flow

```
1. User on external website clicks link
   ↓
2. Link URL: 
   https://saywhatwant.app/#priority=0&model=eternal-main&nom=50&uis=Alice:random&filteractive=true&mt=AI
   ↓
3. Say What Want loads with:
   - User named "Alice" with random color
   - Filters ACTIVE
   - AI channel selected (mt=AI)
   - Conversation filtered to just Alice + AI entity
   - Ready for private conversation
   ↓
4. Alice types first message
   ↓
5. Message goes to queue with priority=0 (BYPASS ROUTER)
   ↓
6. Queue immediately assigns to first available server
   ↓
7. Server loads eternal-main model (if not already loaded)
   ↓
8. Server receives last 50 messages (nom=50) as context
   ↓
9. LLM generates response
   ↓
10. Response posted to Say What Want
    ↓
11. Alice sees response in filtered conversation
    ↓
12. Conversation continues... (Cloudflare → LM Studio cluster)
```

### Why Priority 0-9 Bypasses Router

**Rationale**: Direct conversations are **pre-configured** via URL. The human already chose:
- Which AI to talk to (via model/entity parameter)
- The conversation context (via filters)
- The priority level (always urgent for them)

**No need for router** because:
- User explicitly selected entity/model in URL
- Router would be redundant overhead
- Every message is highest priority to that user
- Sub-second response time critical

**Code Logic**:
```typescript
async function handleMessage(message: Comment, urlParams: URLParameters) {
  const urlPriority = urlParams.priority;
  
  if (urlPriority !== null && urlPriority >= 0 && urlPriority <= 9) {
    // DIRECT CONVERSATION MODE
    console.log('[Queue] Direct conversation - bypassing router');
    
    // Build request from URL + config only
    const entity = entityManager.getById(urlParams.entity) || 
                   entityManager.getByModel(urlParams.model);
    
    await queue.enqueue({
      priority: urlPriority,
      entity,
      model: urlParams.model ?? entity.model,
      messagesToRead: urlParams.nom ?? entity.messagesToRead,
      skipRouter: true,
      source: 'external-website'
    });
    
    return;  // Skip router completely
  }
  
  // ROUTER MODE (priority 10-99 or null)
  const routerDecision = await router.route(message, context);
  await queue.enqueue(routerDecision);
}
```

## 📦 Config Consolidation - Single Source

### Removing config-highermind.json

**Current State**: Two config files
- `config-aientities.json` - Community bots
- `config-highermind.json` - Private conversation AIs

**Problem**: Duplication, confusion, maintenance burden

**Solution**: **ONE config file** - `config-aientities.json`

### Consolidated Structure

```json
{
  "lmStudioServers": [ /* 30+ servers here */ ],
  
  "clusterSettings": { /* cluster config */ },
  
  "routerConfig": {
    "primaryRouter": {
      "entityId": "router-primary",
      "model": "router-model-fast",
      "temperature": 0.3,
      "maxTokens": 100,
      "messagesToRead": 10
    },
    "fallbackRouter": {
      "entityId": "router-fallback",
      "model": "fear_and_loathing",
      "temperature": 0.2,
      "maxTokens": 80,
      "messagesToRead": 5
    }
  },
  
  "entities": [
    // COMMUNITY BOTS (respond in public chat)
    {
      "id": "philosopher",
      "category": "community",
      "model": "fear_and_loathing",
      "username": "FearAndLoathing",
      "messagesToRead": 50,
      "conversationSettings": {
        "respondsToHumanMessages": true,
        "respondsToAllAiMessages": true
      }
      // ... full config
    },
    
    // PRIVATE CONVERSATION AIs (direct links only)
    {
      "id": "eternal-main",
      "category": "private",
      "model": "highermind_the-eternal-1",
      "username": "TheEternal",
      "messagesToRead": 50,
      "conversationSettings": {
        "respondsToHumanMessages": true,
        "respondsToAllAiMessages": false  // Only in private convos
      }
      // ... full config
    },
    
    // ROUTER ENTITIES (special role)
    {
      "id": "router-primary",
      "category": "router",
      "role": "router",
      "model": "router-model-fast",
      "username": "__ROUTER__",
      "messagesToRead": 10,
      "temperature": 0.3
      // ... router config
    }
  ],
  
  "globalSettings": {
    "minTimeBetweenMessages": 30000,
    "maxMessagesPerMinute": 2,
    "requireHumanActivity": true
  }
}
```

### Entity Categories

| Category | Purpose | Where Active | Router? |
|----------|---------|--------------|---------|
| **community** | Public chat bots | Main chat | Yes |
| **private** | Direct conversations | Filtered URLs | No (priority 0-9) |
| **router** | Routing decisions | Internal only | N/A (is the router) |

### Config Loading (One File Only)

```typescript
// Load the single config
const config = JSON.parse(readFileSync('config-aientities.json'));

// Categorize entities
const communityEntities = config.entities.filter(e => e.category === 'community');
const privateEntities = config.entities.filter(e => e.category === 'private');
const routers = config.entities.filter(e => e.category === 'router');

// Use based on context
if (urlPriority >= 0 && urlPriority <= 9) {
  // Direct conversation - use private entity
  const entity = privateEntities.find(e => e.id === urlParams.entity);
} else {
  // Community chat - router selects from community entities
  const entity = await router.selectFrom(communityEntities);
}
```

### Migration Plan (Remove config-highermind.json)

```typescript
// Step 1: Merge entities into config-aientities.json
// Step 2: Add "category" field to each entity
// Step 3: Update code to load single config
// Step 4: Delete config-highermind.json
// Step 5: Update all documentation

// No user impact - transparent change
```

## 🔗 Complete URL Example (External Website Link)

### Full-Featured Direct Conversation Link

```
https://saywhatwant.app/#priority=0&model=eternal-main&nom=ALL&uis=PhilosophyStudent:random&filteractive=true&mt=AI&u=TheEternal
```

**What This Does:**
1. **priority=0**: Highest priority, bypasses router
2. **model=eternal-main**: Uses highermind_the-eternal-1 model
3. **nom=ALL**: Sends entire conversation history as context
4. **uis=PhilosophyStudent:random**: User named PhilosophyStudent with random color
5. **filteractive=true**: Filters are ON
6. **mt=AI**: Show AI channel only
7. **u=TheEternal**: Filter to show only TheEternal messages

**Result**: Private, isolated conversation between PhilosophyStudent and TheEternal AI.

### Minimal Link (Use Config Defaults)

```
https://saywhatwant.app/#priority=0&model=eternal-main&uis=Guest:random
```

**Uses from config**:
- `nom` → entity.messagesToRead (e.g., 50)
- `temperature` → entity.temperature (e.g., 0.7)
- `maxTokens` → entity.maxTokens (e.g., 150)

**Only URL overrides**:
- priority=0 (direct)
- model selection
- User identity

## 📋 Complete Parameter Resolution Logic

### The Cascade (URL → Entity Config → ERROR)

```typescript
class ParameterResolver {
  resolve(urlParams: URLParameters, entity: AIEntity): ResolvedConfig {
    return {
      // Priority: URL → null (router assigns) → ERROR
      priority: urlParams.priority ?? null,
      
      // Model: URL → entity.model → ERROR (required)
      model: urlParams.model ?? entity.model ?? 
        (() => { throw new Error('No model specified'); })(),
      
      // Messages to read: URL nom → entity.messagesToRead → ERROR
      messagesToRead: this.resolveNOM(urlParams.nom, entity.messagesToRead),
      
      // Temperature: ALWAYS from entity (no URL override)
      temperature: entity.temperature ?? 
        (() => { throw new Error('Entity missing temperature'); })(),
      
      // User identity: URL only (no entity fallback)
      username: urlParams.uis?.split(':')[0] ?? 
        (() => { throw new Error('No username provided'); })(),
      
      // Filter active: URL → entity default → ERROR
      filterActive: urlParams.filteractive ?? entity.defaultFilterState ?? false,
      
      // Message type: URL → localStorage → 'human'
      messageType: urlParams.mt ?? localStorage.getItem('sww-message-channel') ?? 'human'
    };
  }
  
  private resolveNOM(urlNom: string | null, entityMessagesToRead: number | undefined): number | 'ALL' {
    // URL has nom parameter
    if (urlNom === 'ALL') return 'ALL';
    if (urlNom !== null) {
      const num = parseInt(urlNom);
      if (!isNaN(num) && num > 0) return num;
    }
    
    // Entity has messagesToRead
    if (entityMessagesToRead !== undefined) {
      return entityMessagesToRead;
    }
    
    // NEITHER - error!
    throw new Error('No nom in URL and entity has no messagesToRead');
  }
}
```

### Examples of Resolution

```typescript
// Example 1: Full URL override
URL: #priority=0&model=X&nom=100
Entity: { model: 'Y', messagesToRead: 50 }
Result: { priority: 0, model: 'X', nom: 100 }  // All from URL

// Example 2: Partial URL override
URL: #priority=0
Entity: { model: 'Y', messagesToRead: 50 }
Result: { priority: 0, model: 'Y', nom: 50 }  // Priority from URL, rest from entity

// Example 3: No URL parameters
URL: (empty)
Entity: { model: 'Y', messagesToRead: 50 }
Result: { priority: null, model: 'Y', nom: 50 }  // Router assigns priority

// Example 4: Missing required config
URL: #priority=0
Entity: { /* no model specified */ }
Result: ERROR - "No model specified"  // Fails loudly, no silent defaults
```

## 🔄 Updated Integration with Queue

```typescript
async queueMessage(message: Comment, context: ConversationContext) {
  const urlParams = parseAllURLParams();  // Parse ALL URL parameters
  
  // Determine entity (URL → router → error)
  let entity: AIEntity;
  let finalPriority: number;
  
  if (urlParams.priority !== null && urlParams.priority >= 0 && urlParams.priority <= 9) {
    // DIRECT CONVERSATION (priority 0-9)
    console.log('[Queue] Direct conversation mode - bypassing router');
    
    // Get entity from URL or config
    entity = urlParams.entity 
      ? entityManager.getById(urlParams.entity)
      : entityManager.getByModel(urlParams.model);
    
    if (!entity) {
      throw new Error('Cannot find entity for direct conversation');
    }
    
    finalPriority = urlParams.priority;  // Use URL priority directly
    
  } else {
    // ROUTER MODE (priority 10-99 or null)
    console.log('[Queue] Router mode - analyzing context');
    
    const routerDecision = await router.route(message, context);
    entity = entityManager.getById(routerDecision.entityId);
    finalPriority = urlParams.priority ?? routerDecision.priority;  // URL can override router
  }
  
  // Resolve all parameters (URL → entity config → error)
  const config = parameterResolver.resolve(urlParams, entity);
  
  // Build context with correct number of messages
  const contextMessages = config.messagesToRead === 'ALL'
    ? context.allMessages
    : context.allMessages.slice(-config.messagesToRead);
  
  // Enqueue the request
  await queue.enqueue({
    id: generateId(),
    priority: finalPriority,
    message,
    context: contextMessages,
    entity,
    model: config.model,
    temperature: config.temperature,
    maxTokens: config.maxTokens,
    routerReason: routerDecision?.reason || 'Direct URL',
    timestamp: Date.now(),
    attempts: 0,
    claimedBy: null,
    claimedAt: null,
    maxRetries: 3
  });
  
  console.log(`[Queue] Queued: priority=${finalPriority}, entity=${entity.id}, nom=${config.messagesToRead}`);
}
```

## 🔄 Queue Processing Flow

### Server Pull Model (Workers Pull Work)

```typescript
// Each LM Studio server runs this loop
class LMStudioWorker {
  private serverId: string;
  private serverIp: string;
  private queueClient: QueueClient;
  
  async startWorking() {
    console.log(`[Worker ${this.serverId}] Starting work loop`);
    
    while (this.isRunning) {
      try {
        // 1. PULL next item from queue (atomic operation)
        const item = await this.queueClient.claim(this.serverId);
        
        if (!item) {
          // Queue empty - wait a bit
          await this.sleep(1000);
          continue;
        }
        
        console.log(`[Worker ${this.serverId}] Claimed request ${item.id} (priority ${item.priority})`);
        
        // 2. Process the request
        const result = await this.processRequest(item);
        
        // 3. Release back to queue or mark complete
        if (result.success) {
          await this.queueClient.complete(item.id);
          console.log(`[Worker ${this.serverId}] Completed ${item.id}`);
        } else {
          // Failed - requeue with lower priority
          await this.queueClient.requeue(item.id, item.priority + 10);
          console.log(`[Worker ${this.serverId}] Requeued ${item.id} with priority ${item.priority + 10}`);
        }
        
      } catch (error) {
        console.error(`[Worker ${this.serverId}] Error:`, error);
        await this.sleep(5000);  // Back off on error
      }
    }
  }
  
  private async processRequest(item: QueueItem): Promise<{success: boolean}> {
    try {
      // 1. Ensure correct model loaded
      const currentModel = await this.getCurrentModel();
      if (currentModel !== item.model) {
        console.log(`[Worker] Loading model: ${item.model}`);
        await this.loadModel(item.model);
      }
      
      // 2. Generate response
      const response = await this.generateResponse(item);
      
      // 3. Post to Say What Want
      await this.postToKV(response);
      
      return { success: true };
    } catch (error) {
      console.error('[Worker] Process failed:', error);
      return { success: false };
    }
  }
}
```

### Claim Mechanism (Prevents Duplicate Work)

```typescript
// Central queue service (runs once, accessible to all workers)
class QueueService {
  async claim(serverId: string): Promise<QueueItem | null> {
    return await this.mutex.runExclusive(async () => {
      // Find first unclaimed item
      let item: QueueItem | null = null;
      
      for (let i = 0; i < this.heap.length; i++) {
        if (this.heap[i].claimedBy === null) {
          item = this.heap[i];
          break;
        }
      }
      
      if (!item) return null;
      
      // Claim it atomically
      item.claimedBy = serverId;
      item.claimedAt = Date.now();
      item.attempts++;
      
      // Set timeout for claim (auto-release if worker dies)
      this.setClaimTimeout(item.id, 60000);  // 60 second timeout
      
      return item;
    });
  }
  
  // Auto-release stale claims
  private setClaimTimeout(itemId: string, timeout: number) {
    setTimeout(async () => {
      const item = this.itemMap.get(itemId);
      if (item && item.claimedBy !== null) {
        // Still claimed - release it
        console.warn(`[Queue] Auto-releasing stale claim: ${itemId}`);
        item.claimedBy = null;
        item.claimedAt = null;
      }
    }, timeout);
  }
}
```

## 📡 Server Registration & Discovery

### Server Heartbeat System

```typescript
class ServerPool {
  private servers: Map<string, ServerStatus>;
  private healthCheckInterval = 5000;  // 5 seconds
  
  interface ServerStatus {
    ip: string;
    port: number;
    status: 'online' | 'offline' | 'busy' | 'degraded';
    loadedModels: string[];
    currentRequest: string | null;
    lastSeen: number;
    requestsProcessed: number;
    averageResponseTime: number;
    errorRate: number;
  }
  
  // Servers register themselves
  async registerServer(serverInfo: ServerInfo) {
    this.servers.set(serverInfo.ip, {
      ...serverInfo,
      status: 'online',
      lastSeen: Date.now(),
      requestsProcessed: 0,
      averageResponseTime: 0,
      errorRate: 0
    });
    
    console.log(`[Pool] Server registered: ${serverInfo.ip}`);
  }
  
  // Servers send heartbeats
  async heartbeat(serverId: string, status: Partial<ServerStatus>) {
    const server = this.servers.get(serverId);
    if (server) {
      Object.assign(server, status);
      server.lastSeen = Date.now();
      server.status = this.calculateStatus(server);
    }
  }
  
  // Detect dead servers
  async checkHealth() {
    const now = Date.now();
    const timeout = 30000;  // 30 seconds
    
    for (const [serverId, server] of this.servers) {
      if (now - server.lastSeen > timeout) {
        if (server.status !== 'offline') {
          console.warn(`[Pool] Server offline: ${serverId}`);
          server.status = 'offline';
          
          // Release any claimed items from this server
          await this.releaseServerClaims(serverId);
        }
      }
    }
  }
}
```

## 🚀 Complete System Flow

### 1. Message Arrives

```typescript
// New message from Say What Want
const newMessage: Comment = {
  id: '123',
  text: 'Hey FearAndLoathing, what do you think?',
  username: 'Alice',
  timestamp: Date.now()
};
```

### 2. Router Analysis

```typescript
const router = new RouterLLM();
const decision = await router.route(newMessage, conversationContext);

// Router returns:
{
  priority: 5,        // Direct address = high priority
  entity: 'philosopher',
  model: 'fear_and_loathing',
  reason: 'Direct address + philosophical context'
}
```

### 3. Queue Insertion

```typescript
await priorityQueue.enqueue({
  id: generateId(),
  priority: 5,
  message: newMessage,
  entity: entityManager.getEntityById('philosopher'),
  model: 'fear_and_loathing',
  timestamp: Date.now(),
  claimedBy: null
});

// Queue now: [priority:5, priority:12, priority:25, ...]
```

### 4. Server Claims Work

```typescript
// Server 10.0.0.102 polls queue
const item = await queueClient.claim('10.0.0.102');

// Atomically receives:
{
  id: 'abc123',
  priority: 5,  // Got the highest priority item!
  entity: 'philosopher',
  model: 'fear_and_loathing',
  claimedBy: '10.0.0.102',  // Marked as claimed
  claimedAt: 1696435200000
}
```

### 5. Server Processes

```typescript
// Check/load model
if (currentModel !== 'fear_and_loathing') {
  await lms.load('fear_and_loathing');
}

// Generate response
const response = await generateWithEntity(item);

// Post to Say What Want
await kvClient.post(response);

// Mark complete
await queueClient.complete(item.id);
```

### 6. Next Server Gets Next Item

```typescript
// Server 10.0.0.100 (finished with previous task) polls
const nextItem = await queueClient.claim('10.0.0.100');

// Gets priority:12 (next in queue)
// Process continues...
```

## 🎯 Queue Management Strategies

### Smart Dequeue Logic

```typescript
class SmartQueueManager {
  async getNextItem(serverId: string): Promise<QueueItem | null> {
    const server = this.serverPool.getServer(serverId);
    
    // 1. Get server's current loaded models
    const loadedModels = server.loadedModels;
    
    // 2. PREFER items matching already-loaded models (ZERO load time)
    const matchingItem = await this.findItemWithModel(loadedModels);
    if (matchingItem) {
      return await this.claim(matchingItem.id, serverId);
    }
    
    // 3. No match - get highest priority item regardless
    return await this.claimHighestPriority(serverId);
  }
  
  private async findItemWithModel(models: string[]): Promise<QueueItem | null> {
    // Find highest priority unclaimed item that uses one of these models
    return this.heap.find(item => 
      item.claimedBy === null && 
      models.includes(item.model)
    );
  }
}
```

### Congestion Management

```typescript
// When queue gets long, adjust priorities
class CongestionManager {
  async manageQueue() {
    const queueLength = await this.queue.size();
    
    if (queueLength > 100) {
      console.warn('[Queue] High congestion:', queueLength);
      
      // Strategy: Reduce low-priority items
      await this.queue.forEach(async (item) => {
        if (item.priority > 70 && item.claimedBy === null) {
          // Drop very low priority items
          await this.queue.remove(item.id);
          console.log(`[Queue] Dropped low-priority item: ${item.id}`);
        } else if (item.priority > 50) {
          // Lower medium-priority items
          await this.queue.updatePriority(item.id, item.priority + 10);
        }
      });
    }
    
    if (queueLength > 500) {
      // CRITICAL: Queue explosion
      console.error('[Queue] CRITICAL congestion:', queueLength);
      
      // Emergency: Only process priority < 30
      await this.queue.purgeAbovePriority(30);
    }
  }
}
```

## 📊 Queue Statistics & Monitoring

```typescript
interface QueueStats {
  // Current state
  totalItems: number;
  unclaimedItems: number;
  claimedItems: number;
  
  // Priority distribution
  priorityBands: {
    critical: number;    // 0-10
    high: number;        // 11-30
    medium: number;      // 31-60
    low: number;         // 61-90
    background: number;  // 91-99
  };
  
  // Performance
  averageWaitTime: number;  // Time in queue before claimed
  averageProcessTime: number;  // Time from claim to complete
  throughput: number;  // Items/minute
  
  // Health
  oldestItemAge: number;
  staleClaims: number;
  failureRate: number;
}

class QueueMonitor {
  getStats(): QueueStats {
    return {
      totalItems: this.queue.size(),
      unclaimedItems: this.countUnclaimed(),
      priorityBands: this.calculateBands(),
      averageWaitTime: this.calculateAvgWait(),
      throughput: this.calculateThroughput(),
      // ... more stats
    };
  }
  
  // Expose to monitoring console
  async reportToConsole() {
    const stats = this.getStats();
    
    await fetch('https://saywhatwant.app/api/ai-console', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-console-password': 'saywhatwant'
      },
      body: JSON.stringify({
        action: 'queue_stats',
        stats
      })
    });
  }
}
```

## 🧪 Testing Strategy

### Load Testing

```typescript
// Simulate 300 requests/minute
async function loadTest() {
  const requestsPerMinute = 300;
  const interval = 60000 / requestsPerMinute;  // ~200ms
  
  for (let i = 0; i < requestsPerMinute; i++) {
    setTimeout(async () => {
      const message = generateTestMessage();
      await queueManager.queueMessage(message, context);
    }, i * interval);
  }
  
  // Monitor queue health
  setInterval(() => {
    const stats = queueMonitor.getStats();
    console.log('Queue size:', stats.totalItems);
    console.log('Throughput:', stats.throughput, 'req/min');
    console.log('Avg wait:', stats.averageWaitTime, 'ms');
  }, 5000);
}
```

### Race Condition Testing

```typescript
// Simulate multiple servers claiming simultaneously
async function raceConditionTest() {
  // Add one item
  await queue.enqueue(testItem);
  
  // 10 servers try to claim simultaneously
  const claims = await Promise.all([
    queue.claim('server-1'),
    queue.claim('server-2'),
    queue.claim('server-3'),
    queue.claim('server-4'),
    queue.claim('server-5'),
    queue.claim('server-6'),
    queue.claim('server-7'),
    queue.claim('server-8'),
    queue.claim('server-9'),
    queue.claim('server-10'),
  ]);
  
  // Count non-null claims
  const successful = claims.filter(c => c !== null);
  
  // MUST be exactly 1
  assert(successful.length === 1, 'Race condition detected!');
  console.log('✅ Atomic claim working correctly');
}
```

## 🔧 Implementation Steps

### Phase 1: Queue Core (Week 1)
- [ ] Implement MinHeap priority queue
- [ ] Add AsyncMutex for atomic operations
- [ ] Create QueueItem interface
- [ ] Build enqueue/dequeue/claim methods
- [ ] Test with 2 workers (Mac Studios)

### Phase 2: Router Integration (Week 1-2)
- [ ] Create router entity in both configs
- [ ] Build routing prompt template
- [ ] Implement JSON response parsing
- [ ] Add priority modifiers
- [ ] Test router accuracy

### Phase 3: URL Priority (Week 2)
- [ ] Add priority parameter to URL parsing
- [ ] Integrate with queue system
- [ ] Add skip-router option
- [ ] Test priority overrides

### Phase 4: Server Pool (Week 2-3)
- [ ] Create server registration system
- [ ] Implement heartbeat monitoring
- [ ] Add health checking
- [ ] Build server selection logic
- [ ] Test with 5-10 servers

### Phase 5: Production Scale (Week 3-4)
- [ ] Migrate to Redis for queue (30+ servers)
- [ ] Add comprehensive monitoring
- [ ] Implement congestion management
- [ ] Load test with 300 req/min
- [ ] Add auto-scaling triggers

## 🎯 Success Criteria

- ✅ Handle 300+ requests/minute sustained
- ✅ < 2 second average latency
- ✅ Zero duplicate processing
- ✅ Graceful server failures
- ✅ Priority respected 99.9% of time
- ✅ Fair work distribution
- ✅ No memory leaks over 24 hours
- ✅ Sub-second queue operations

## 💡 Key Design Decisions

### Smart Queue, Dumb Workers
- **Queue**: Knows priorities, routing, health
- **Workers**: Just pull work and process
- **Benefits**: Easy to add workers, simple worker logic

### Pull Not Push
- **Workers pull**: "Give me next task"
- **Queue doesn't push**: No tracking worker addresses
- **Benefits**: Workers can restart without queue awareness

### Atomic Claims
- **Mutex-protected**: One claim at a time
- **Timeout-based release**: Dead workers don't block
- **Benefits**: Zero duplicate work, automatic recovery

### Router as Gatekeeper
- **LLM-powered**: Intelligent routing decisions
- **JSON output**: Easy parsing and validation
- **Fallback logic**: Never blocks on router failure

### Priority 0-9 Bypass
- **Direct conversations**: External website links
- **No router overhead**: Pre-configured in URL
- **Sub-second response**: Immediate queue assignment
- **User choice**: Human selected entity/model already

## 📊 New Requirements Summary (October 4, 2025)

### 1. Number of Messages Parameter (nom)
- **Format**: `nom=N` or `nom=ALL`
- **Purpose**: Control context size sent to LLM (NOT display filtering)
- **Priority**: URL → entity.messagesToRead → ERROR
- **Important**: This controls LLM context ONLY, not UI message display
- **Examples**: 
  - `nom=50` - Last 50 messages sent to LLM as context
  - `nom=ALL` - Entire conversation sent to LLM
  - No param - Uses entity.messagesToRead from config
- **NOT added to FilterState** - This is LLM parameter, not UI filter

### 2. URL as Absolute Source of Truth
- **Philosophy**: URL > Config > Nothing
- **No global fallbacks** ever
- **Fails loudly** if both missing
- **Examples**:
  - ✅ `url.priority ?? entity.priority`
  - ❌ `url.priority ?? entity.priority ?? 50`

### 3. Config Consolidation
- **Remove**: config-highermind.json
- **Keep**: config-aientities.json only
- **Add**: "category" field (community/private/router)
- **Benefit**: Single source, no duplication

### 4. External Website Integration
- **Use case**: Links from other sites
- **Flow**: Website → SWW URL → Filtered conversation
- **Priority**: Always 0-9 (bypasses router)
- **Example**:
  ```
  <a href="https://saywhatwant.app/#priority=0&model=eternal-main&nom=50&uis=Visitor:random&filteractive=true">
    Chat with AI
  </a>
  ```

### 5. Router Bypass for Priority 0-9
- **Rule**: Priority 0-9 = direct conversation
- **Behavior**: Skip router completely
- **Rationale**: User pre-selected entity in URL
- **Benefit**: Faster response, no routing overhead

### 6. Complete URL Parameter Set

| Param | Values | Purpose | Required |
|-------|--------|---------|----------|
| `priority` | 0-99 | Queue priority | Optional (router assigns) |
| `model` | model-name | Force specific model | If no entity specified |
| `entity` | entity-id | Force specific entity | If no model specified |
| `nom` | N or ALL | Messages for context | Optional (uses config) |
| `uis` | name:color | User identity | For private convos |
| `filteractive` | true/false | Filter state | Optional (default false) |
| `mt` | human/AI/ALL | Message channel | Optional (default human) |
| `u` | name:color | User filters | Optional |

### 7. Config Structure Requirements

**Every entity MUST have**:
- `id` - Unique identifier
- `model` - Model name (for LM Studio)
- `messagesToRead` - Default context size
- `temperature` - Generation temperature
- `maxTokens` - Response length limit
- `category` - community/private/router

**No defaults** if missing - system throws error.

## 🔀 Message Type System (mt Parameter)

### Three Channel Modes

| Mode | URL | Behavior | Use Case |
|------|-----|----------|----------|
| **Human** | `mt=human` | Show only human messages | Default view |
| **AI** | `mt=AI` | Show only AI bot messages | AI conversation view |
| **ALL** | `mt=ALL` | Show both human AND AI messages | Combined view |

### Priority Logic for mt Parameter

```typescript
function resolveMessageType(urlMT: string | null, filterActive: boolean, uiToggle: 'human' | 'AI'): string[] {
  // PRIORITY 1: mt=ALL in URL (highest)
  if (urlMT === 'ALL') {
    return ['human', 'AI'];  // Show both channels
  }
  
  // PRIORITY 2: mt=human or mt=AI in URL
  if (urlMT === 'human' || urlMT === 'AI') {
    return [urlMT];
  }
  
  // PRIORITY 3: Use UI toggle state
  return [uiToggle];
}

// IndexedDB query
const messageTypes = resolveMessageType(urlParams.mt, filterActive, uiToggleState);
criteria.messageTypes = messageTypes;  // Query for these types
```

### Interaction with Filter Toggle

```
Scenario: User viewing mt=ALL
1. URL: #mt=ALL&filteractive=true&u=alice
2. View: Alice's messages from BOTH human AND AI channels
3. User clicks filter icon OFF
4. filteractive → false
5. View switches to: ALL messages (human + AI channels)
6. mt=ALL stays in URL
7. Filters stay in filter bar (inactive)

Scenario: Switching from mt=ALL
1. URL: #mt=ALL
2. User clicks Human/AI toggle to "Human"
3. URL becomes: #mt=human  (ALL is replaced)
4. View: Only human channel now

The toggle removes mt=ALL and sets mt=human or mt=AI explicitly.
```

### Example Use Cases

**Combined View (Human + AI Conversation)**:
```
https://saywhatwant.app/#mt=ALL&u=alice&u=TheEternal
→ Shows Alice (human) AND TheEternal (AI) messages
→ Perfect for seeing full conversation between human and AI
```

**AI-only Research**:
```
https://saywhatwant.app/#mt=AI&filteractive=false
→ Shows ALL AI bot messages
→ Research what AIs are discussing
```

**Private Conversation with Combined View**:
```
https://saywhatwant.app/#priority=0&mt=ALL&model=eternal-main&nom=50&uis=User:random
→ User sees their messages AND AI responses in same view
→ Natural conversation flow
```

### Implementation in url-filter-simple.ts

```typescript
// Parse mt parameter
case 'mt':
  if (value === 'human' || value === 'AI' || value === 'ALL') {
    state.messageType = value;  // Now supports 'ALL'
  }
  break;

// Updated FilterState interface
interface FilterState {
  messageType: 'human' | 'AI' | 'ALL';  // Three modes now
  // ... other fields
}

// Query logic
function getMessageTypesForQuery(mt: 'human' | 'AI' | 'ALL'): string[] {
  if (mt === 'ALL') return ['human', 'AI'];
  return [mt];
}
```

## 🏗️ Infrastructure Decisions (Deployment Architecture)

### Queue Service Location

**Decision**: Queue runs on **10.0.0.102** (Mac Studio 1)

**Architecture**:
```
10.0.0.102 (Mac Studio 1)
├── Bot Process (Node.js)
│   ├── Receives from Cloudflare
│   ├── Manages priority queue (in-memory)
│   ├── Distributes to LM Studio cluster
│   └── Posts responses to Cloudflare
├── LM Studio Server
│   └── Can also process requests as a worker
└── Auto-restart on login
    └── Single point of failure (acceptable)
```

**Rationale**:
- ✅ Simple deployment (one machine)
- ✅ Auto-restart on login
- ✅ No external dependencies
- ✅ Fast local queue access
- ⚠️ Single point of failure (acceptable for now)
- 💾 Queue lost on crash (acceptable - will rebuild)

**Future Migration Path**:
- Phase 1: In-memory queue on 10.0.0.102 ✅
- Phase 2: Redis on 10.0.0.102 (persistence)
- Phase 3: Redis on dedicated server (HA)
- Phase 4: Cloud Redis (geographic distribution)

### Router LLM Hosting

**Decision**: Router model runs on **any LM Studio server that has it loaded**

**Flow**:
```
1. Queue needs routing decision
   ↓
2. Finds server with router model loaded
   ↓
3. Sends routing request to that server
   ↓
4. Router responds with JSON decision
   ↓
5. Queue uses decision to enqueue request
   ↓
6. Any worker (including router server) can process queued item
```

**Fallback Strategy**:
```typescript
async function getRouterDecision(message: Comment): Promise<RoutingDecision> {
  // Try to find server with router model
  const routerServer = cluster.getServerWithModel('router-model-fast');
  
  if (routerServer) {
    try {
      return await sendRouterRequest(routerServer, message);
    } catch (error) {
      console.warn('[Router] Primary router failed, using fallback');
    }
  }
  
  // Fallback 1: Use different server with router model
  const anyRouterServer = cluster.getServersWithModel('router-model-fast')[0];
  if (anyRouterServer) {
    return await sendRouterRequest(anyRouterServer, message);
  }
  
  // Fallback 2: Simple rule-based routing (no LLM)
  console.warn('[Router] No router model available, using rule-based fallback');
  return simpleRuleBasedRouting(message);
}
```

**Router Independence**:
- Router server can **also process requests** as a worker
- Being router doesn't prevent being worker
- Router is just another LLM call, not special infrastructure

### Entity → Model Mapping (Multiple Entities per Model)

**Scenario**: `#priority=0&model=eternal-main`

**Problem**: 5 entities use `highermind_the-eternal-1` model
- eternal-main
- eternal-tech
- philosopher
- sage
- rebel

**Solution**: **Category-based selection**

```typescript
function selectEntityForDirectConversation(urlParams: URLParameters): AIEntity {
  // URL specifies entity explicitly
  if (urlParams.entity) {
    return entityManager.getById(urlParams.entity);
  }
  
  // URL specifies model only
  if (urlParams.model) {
    // Get entities with this model
    const matchingEntities = entityManager.getByModel(urlParams.model);
    
    // Filter by category
    const privateEntities = matchingEntities.filter(e => e.category === 'private');
    
    if (privateEntities.length > 0) {
      // For direct conversations, prefer the "main" private entity
      return privateEntities.find(e => e.id.includes('-main')) || privateEntities[0];
    }
    
    // No private entity - use first match
    return matchingEntities[0];
  }
  
  throw new Error('URL must specify either entity or model for direct conversations');
}
```

**Best Practice**: Always specify entity ID for unambiguous selection:
```
✅ BEST: #priority=0&entity=eternal-main&nom=50
✅ GOOD: #priority=0&model=highermind_the-eternal-1&nom=50  (gets -main variant)
❌ RISKY: #priority=0  (no entity/model specified - will error)
```

## 🔐 "Private" Conversations Clarification

### Not Actually Private (Yet)

**Current Reality**:
- ✅ Messages post to public KV
- ✅ Visible in public feed
- ✅ Filterable by anyone who knows the username
- ✅ Called "private" for UX (feels private to user)

**Why Call It "Private"**:
- User experience feels one-on-one
- Filtered view shows only their conversation
- URL isolation makes it feel personal
- Good enough for current phase

**Future True Privacy** ($10 paid feature):
- Separate KV namespace per user
- Encrypted messages
- Not in public feed
- Access control

**For Now**:
- Keep calling it "private" (user perception)
- Post to public feed (technical reality)
- Filter isolation (UX privacy)
- Build paid privacy later

### "Private" Conversation Flow

```
External Link
    ↓
URL: #priority=0&model=eternal-main&uis=Alice&filteractive=true&mt=ALL&u=Alice&u=TheEternal
    ↓
Alice Types: "Hello!"
    ↓
Posted to PUBLIC KV (anyone can see if they look)
    ↓
Alice's Filtered View: Only shows Alice + TheEternal
    ↓
AI Responds: "Hello Alice!"
    ↓
Posted to PUBLIC KV (but Alice's filter hides other messages)
    ↓
Alice's Experience: Feels like private 1-on-1 conversation ✅
```

**It's "private" from UX perspective, public from technical perspective.**

## 🏢 Infrastructure Deployment

### Queue Service Deployment

**Location**: 10.0.0.102 (Mac Studio 1)

**Components on 10.0.0.102**:
```
Mac Studio 1 (10.0.0.102)
├── Bot Process
│   ├── Receives messages from Cloudflare
│   ├── Runs Router LLM (if model loaded)
│   ├── Manages Priority Queue (in-memory)
│   ├── Distributes to LM Studio cluster
│   └── Posts responses to Cloudflare KV
├── LM Studio Server
│   ├── Can run router model
│   ├── Can process queued requests
│   └── Part of worker pool
└── Auto-start on login
    └── PM2 or similar for auto-restart
```

**Single Point of Failure - Accepted**:
- ✅ Simpler architecture
- ✅ Auto-restart on login
- ✅ Good enough for current scale
- ✅ Can migrate to HA later

**Queue Persistence**:
- **Phase 1**: In-memory only (current)
  - Lost on crash
  - Rebuilds from scratch
  - Acceptable for now
- **Phase 2**: Periodic disk snapshots
  - Save queue state every minute
  - Restore on restart
- **Phase 3**: Redis on same machine
  - Persistent queue
  - Survives restarts
- **Phase 4**: Redis on separate server
  - High availability
  - Geographic redundancy

### LM Studio Cluster Worker Model

**Any Server Can Be Router**:
```
Server Pool:
├── 10.0.0.102 (Mac Studio 1)
│   ├── May have router model loaded
│   ├── Processes both routing AND regular requests
│   └── Also hosts the queue
├── 10.0.0.100 (Mac Studio 2)
│   ├── May have router model loaded
│   ├── Processes routing AND regular requests
│   └── Pulls from queue on 10.0.0.102
├── 10.0.0.125 (Mac Mini)
│   ├── Regular worker only
│   └── Pulls from queue on 10.0.0.102
└── ... 27 more servers ...
    └── All pull from central queue
```

**Router Request Flow**:
```
Message arrives
    ↓
Queue looks for server with router model
    ↓
Found 10.0.0.100 has router-model-fast loaded
    ↓
Send routing request to 10.0.0.100
    ↓
10.0.0.100 responds with JSON decision
    ↓
Queue enqueues with that priority
    ↓
ANY worker (including 10.0.0.100) can claim it next
```

**If Router Server Dies**:
```typescript
// Fallback chain
async getRoutingDecision() {
  // 1. Try primary router server
  const routerServer = cluster.getServerWithModel('router-model-fast');
  if (routerServer) {
    try {
      return await routerServer.route(message);
    } catch {}
  }
  
  // 2. Try fallback router model (different model)
  const fallbackServer = cluster.getServerWithModel('fear_and_loathing');  // Use as router
  if (fallbackServer) {
    return await fallbackServer.routeWithPrompt(message, ROUTING_PROMPT);
  }
  
  // 3. Rule-based routing (no LLM)
  return ruleBasedRouter.route(message);  // Simple if/else logic
}
```

### Model Loading Strategy

**Dynamic Loading Supported**:
- ✅ Servers can load/unload models via CLI
- ✅ Model files accessible to all servers (shared storage or replicated)
- ✅ First free server claims work
- ✅ Loads model if needed
- ✅ Processes request
- ✅ May keep model loaded or unload

**Model Affinity Optimization**:
```typescript
// Smart claiming - prefer servers with model already loaded
async claimOptimal(serverId: string): Promise<QueueItem | null> {
  const server = serverPool.getServer(serverId);
  
  // Look for items matching our loaded models (INSTANT)
  for (const loadedModel of server.loadedModels) {
    const item = queue.findUnclaimedWithModel(loadedModel);
    if (item) {
      return await queue.claim(item.id, serverId);  // Claim it!
    }
  }
  
  // No match - claim highest priority regardless
  return await queue.claimHighestPriority(serverId);
}
```

## ⚠️ Current Limitations & Acceptance

### Single Point of Failure (Accepted)
- **Queue on 10.0.0.102**: If it dies, system stops
- **Acceptable because**: Auto-restart on login, simple architecture
- **Migration path**: Can add Redis later without code changes

### Queue Persistence (Accepted)
- **In-memory only**: Queue lost on restart
- **Acceptable because**: Rare restarts, system rebuilds quickly
- **Migration path**: Add Redis when needed

### Bot Message Tagging (Working)
- **Status**: ✅ Already working
- **Bot sets**: `message['message-type'] = 'AI'` when posting
- **Routing**: Automatic - AI messages go to AI channel
- **No changes needed**: Current implementation correct

## 🎯 Implementation Priority Order

### Phase 1: Critical Path (Week 1)
1. **Fix mt toggle** - Enable Human/AI/ALL switching
2. **Add nom parsing** - Parse nom from URL
3. **Add mt=ALL support** - Show both channels
4. **Basic queue** - In-memory priority queue
5. **Atomic claims** - Mutex-protected operations

### Phase 2: Router Integration (Week 2)
6. **Router entity** - Add to config
7. **Router prompts** - Build routing templates
8. **JSON parsing** - Extract decisions
9. **Priority 0-9 bypass** - Skip router for direct convos
10. **Fallback routing** - Rule-based backup

### Phase 3: Multi-Server (Week 3)
11. **Worker pull loop** - Server polling
12. **Model affinity** - Prefer loaded models
13. **Load balancing** - Smart distribution
14. **Health monitoring** - Server status tracking
15. **Failover handling** - Graceful degradation

### Phase 4: External Links (Week 4)
16. **Complete URL parsing** - All parameters
17. **Parameter resolution** - URL → Config → Error
18. **Filter integration** - Combined with existing filters
19. **Test external links** - From other websites
20. **Documentation** - User-facing docs for link creation

### Phase 5: Production Hardening (Week 5+)
21. **Redis migration** - Persistent queue
22. **Monitoring dashboard** - Queue stats in AI console
23. **Load testing** - 300 req/min stress test
24. **30+ server test** - Full cluster scale
25. **Performance tuning** - Optimize bottlenecks

---

**Ready for Implementation** - This queue system will scale from 2 Macs to 200 servers without architectural changes.

*"The queue is the brain, the servers are the hands. URL is the truth, config is the fallback, errors are loud. Simple division of labor, infinite scale."*

---

## 📋 Final Architecture Summary

### What Runs Where

| Component | Location | Purpose | HA |
|-----------|----------|---------|-----|
| **Queue** | 10.0.0.102 | Priority queue, routing coordinator | ❌ SPOF |
| **Bot Process** | 10.0.0.102 | Message polling, posting | ❌ SPOF |
| **Router LLM** | Any server with model | Routing decisions | ✅ Fallback |
| **Workers** | All 30+ servers | Process requests | ✅ Distributed |
| **LM Studio** | All 30+ servers | Model inference | ✅ Distributed |

### Request Flow (End-to-End)

```
External Website Link
    ↓
Cloudflare Edge
    ↓
10.0.0.102 Bot (receives, queues)
    ↓
Priority Queue (sorts by 0-99)
    ↓
LM Studio Server Pool (30+ servers pull work)
    ├─ 10.0.0.102 (worker + queue host)
    ├─ 10.0.0.100 (worker)
    ├─ 10.0.0.125 (worker)
    └─ ... 27 more workers
    ↓
Response Generation
    ↓
10.0.0.102 Bot (receives, posts)
    ↓
Cloudflare KV
    ↓
Say What Want App
    ↓
User sees response
```

**Bottlenecks Identified**:
- 10.0.0.102 (single point) - Acceptable for now
- Router if only one instance - Multiple servers can run it

**Scaling Path**:
- 2 servers → 10 servers → 30 servers → 100 servers
- No architectural changes needed
- Just update config with new IPs
