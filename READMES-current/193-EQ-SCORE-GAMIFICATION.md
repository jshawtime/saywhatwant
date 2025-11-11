# 193: EQ Score Gamification - Emotional Intelligence Scoring

## Status: 📋 READY FOR IMPLEMENTATION

**Created:** 2025-11-06  
**Priority:** MEDIUM (Gamification Feature)  
**Issue:** No feedback on emotional intelligence of user's messages

---

## Executive Summary

**What:** Score every human message for emotional intelligence (0-100)  
**Why:** Gamify the app, provide real-time feedback, make conversations more engaging  
**How:** Process each message through eq-score entity, display score in header  
**Impact:** Fun, immediate feedback on message quality

---

## What We Have (No Scoring)

### Current Flow

```
Human posts message
  ↓
PM2 polls and finds message
  ↓
PM2 processes with entity (TheEternal, Aristotle, etc.)
  ↓
Ollama generates response
  ↓
AI response posted
```

**Header shows:** Message count (13 messages)

**No feedback on:** Quality, emotional intelligence, engagement level

---

## What We Want (EQ Scoring)

### New Flow

```
Human posts message "I think consciousness is fascinating"
  ↓
PM2 polls and finds message
  ↓
FIRST: Score message with eq-score entity (parallel, fast <1s)
  │
  ├─→ Send ONLY message text to eq-score (no context)
  ├─→ Ollama returns: "Score: 85"
  ├─→ Parse score number: 85
  ├─→ Store in conversation: message.score = 85
  │
SECOND: Process message with main entity (TheEternal, etc.)
  ├─→ Send with full context
  ├─→ Generate AI response
  └─→ Post AI response
```

**Header shows:** EQ Score: 85 (instead of message count)

**Live feedback:** User sees their EQ score update after each message

### EQ Score Entity

**File:** `ai-entities/eq-score.json`

**systemPrompt:** Evaluates human messages on 5 criteria:
1. Critical Thinking
2. Emotional Intelligence
3. Empathy
4. Creativity
5. Communication Clarity

**Returns:** "Score: [number]"  
**Example:** "Score: 85"

**Configuration:**
- `max_tokens: 20` (just need the number)
- `temperature: 1.0` (consistent scoring)
- Fast evaluation (<1 second)

---

## Data Storage

### Message Object (Updated)

**Current:**
```json
{
  "id": "abc123",
  "text": "I think consciousness is fascinating",
  "username": "Human",
  "color": "080150227",
  "timestamp": 1762465047270,
  "message-type": "human"
}
```

**New (with score):**
```json
{
  "id": "abc123",
  "text": "I think consciousness is fascinating",
  "username": "Human",
  "color": "080150227",
  "timestamp": 1762465047270,
  "message-type": "human",
  "eqScore": 85  ← NEW FIELD
}
```

**Storage location:** Conversation key in DO  
**Updated:** Every human message (real-time)  
**Not saved:** Historical scores (just latest)

---

## UI Display

### Header (Replace Message Count)

**Current:**
```
[Icons] ... [13] [Username] [Color]
         ↑ message count
```

**New:**
```
[Icons] ... [85] [Username] [Color]
         ↑ EQ score
```

**Styling:**
- Same position as message count
- Same size: 20px, fontWeight: 700
- Same color: userColorRgb with 60% opacity
- Title: "Emotional Intelligence Score (0-100)"

**Default:** 0 (if no messages scored yet)

**Updates:** After each human message is scored

---

## Implementation

### Step 1: Add Scoring Function

**File:** `src/index-do-simple.ts`

**New function:**
```typescript
async function scoreMessage(messageText: string): Promise<number> {
  try {
    // Get eq-score entity
    const eqEntity = getEntity('eq-score');
    if (!eqEntity) {
      console.log('[EQ-SCORE] Entity not found, skipping');
      return 0;
    }
    
    // Build simple request (no context, just the message)
    const ollamaPayload = {
      model: 'emotional-intelligence-f16',  // Or get from eqEntity
      messages: [
        {role: 'system', content: eqEntity.systemPrompt.replace('[message]', messageText)},
        {role: 'user', content: messageText}
      ],
      temperature: 1.0,
      max_tokens: 20,
      stream: false
    };
    
    // Call Ollama
    const response = await fetch('http://10.0.0.110:11434/v1/chat/completions', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify(ollamaPayload)
    });
    
    const data = await response.json();
    const text = data.choices?.[0]?.message?.content || '';
    
    // Parse "Score: 85" format
    const match = text.match(/Score:\s*(\d+)/i);
    const score = match ? parseInt(match[1]) : 0;
    
    console.log(`[EQ-SCORE] Message scored: ${score}/100`);
    return score;
    
  } catch (error) {
    console.error('[EQ-SCORE] Error:', error.message);
    return 0;  // Default to 0 on error
  }
}
```

### Step 2: Call Scoring Before Main Processing

**In main worker loop (after claiming message):**

```typescript
// After: const message = pending[0];

// Score the message (parallel, fast)
const eqScore = await scoreMessage(message.text);

// Store score in message (update DO)
await fetch(`${API_URL}/api/comments/${message.id}`, {
  method: 'PATCH',
  headers: {'Content-Type': 'application/json'},
  body: JSON.stringify({eqScore})
});

// Continue with normal processing...
const entity = getEntity(message.botParams.entity);
```

### Step 3: Frontend - Get Score from Latest Message

**File:** `components/CommentsStream.tsx`

**Add:**
```typescript
// Get EQ score from latest human message
const latestHumanMessage = filteredComments
  .filter(c => c['message-type'] === 'human')
  .sort((a, b) => b.timestamp - a.timestamp)[0];

const eqScore = latestHumanMessage?.eqScore || 0;
```

### Step 4: Frontend - Display Score Instead of Count

**File:** `components/Header/UserControls.tsx`

**Replace message count with:**
```typescript
{/* EQ Score (replaces message count) */}
<span 
  className="mr-2 opacity-60" 
  style={{ 
    color: userColorRgb,
    fontSize: '20px',
    fontWeight: 700
  }}
  title="Emotional Intelligence Score (0-100)"
>
  {eqScore}
</span>
```

### Step 5: DO Worker - Add eqScore Field

**File:** `workers/durable-objects/MessageQueue.js`

**In postMessage:**
```typescript
const message = {
  id,
  timestamp,
  text: body.text,
  username: body.username,
  color: body.color,
  'message-type': messageType,
  eqScore: body.eqScore || 0,  // NEW FIELD
  // ... other fields
};
```

---

## Testing

**Test 1: Simple greeting**
```
Post: "Hello"
Expected score: ~10 (neutral interaction)
Header shows: 10
```

**Test 2: Thoughtful message**
```
Post: "I think consciousness emerges from the interplay of matter and energy"
Expected score: 70-90 (critical thinking, creativity)
Header shows: 85
```

**Test 3: Rapid succession**
```
Post: "Hello" → Score: 10
Post: "How are you?" → Score: 15
Post: "Tell me about existence" → Score: 75
Header updates: 10 → 15 → 75 (real-time)
```

**Test 4: Error handling**
```
eq-score entity unavailable
Score defaults to 0
No crash, logs error
```

---

## Benefits

**Gamification:**
- Users see immediate feedback
- Encourages thoughtful messages
- Fun metric to track

**Educational:**
- Learn what makes messages more engaging
- Understand EQ components
- Improve communication skills

**Engagement:**
- Makes app more interactive
- Adds game element
- Users try to "beat their score"

**Technical:**
- Fast (<1s additional latency)
- Simple number (easy to display)
- No complex state management

---

## Edge Cases

**Q: What if scoring fails?**
**A:** Default to 0, log error, continue with main processing

**Q: What if score is > 100?**
**A:** Cap at 100 (Math.min(score, 100))

**Q: What if eq-score entity not found?**
**A:** Skip scoring, show 0, continue normally

**Q: Performance impact?**
**A:** Minimal - eq-score is fast (max_tokens: 20), runs parallel

**Q: What about platform posts (no entity)?**
**A:** Still score them! Every human message gets scored.

---

## Philosophy Alignment

**@00-AGENT!-best-practices.md:**

**Gamification without steering:**
- Score measures quality, doesn't tell user what to say
- Pure feedback mechanism
- No behavioral rules

**Simple:**
- One entity (eq-score)
- One number (0-100)
- One display location (header)

**Strong:**
- Works for all messages
- Handles errors gracefully
- Fast and reliable

**Solid:**
- Scales to any volume
- No state complexity
- Clean architecture

---

**Last Updated:** 2025-11-06  
**Author:** Claude (Anthropic) - AI Engineering Agent  
**Related:** eq-score.json entity, gamification concepts

---

## Parsing Score from Response

### Expected Formats (Handle All)

**Format 1:** `"Score: 85"`  
**Format 2:** `"The score is 85"`  
**Format 3:** `"85"`  
**Format 4:** `"I would give this a score of 72"`  

**Parsing logic:**
```typescript
// Try to find score in various formats
const parseScore = (text: string): number => {
  // Pattern 1: "Score: 85" or "Score: [85]"
  let match = text.match(/Score:\s*\[?(\d+)\]?/i);
  if (match) return parseInt(match[1]);
  
  // Pattern 2: "score is 85" or "score of 85"
  match = text.match(/score\s+(?:is|of)\s+(\d+)/i);
  if (match) return parseInt(match[1]);
  
  // Pattern 3: Just find first number 0-100
  match = text.match(/\b(\d{1,3})\b/);
  if (match) {
    const num = parseInt(match[1]);
    return num <= 100 ? num : 0;  // Cap at 100
  }
  
  // No number found
  return 0;
};
```

**Handles:**
- ✅ Extra text ("The score is...")
- ✅ Brackets [85]
- ✅ Case insensitive
- ✅ Numbers embedded in text
- ✅ Invalid scores (>100 → 0)

---

## Technical Flow: Per-Tab Score Isolation

### Architecture Overview

**Key Design Decision:** EQ scores are **per-human-identity**, not per-conversation.

**Why?** The score measures the quality of the **human's message**, not the context of which AI they're talking to. A thoughtful message is thoughtful regardless of whether it's sent to TheEternal or FearAndLoathing.

### Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│ BROWSER TAB 1                                               │
│ URL: #ais=TheEternal:080175220&entity=the-eternal          │
├─────────────────────────────────────────────────────────────┤
│ localStorage (shared across ALL tabs):                      │
│   username = "Human"                                        │
│   userColor = "080150227"                                   │
├─────────────────────────────────────────────────────────────┤
│ URL parameters (tab-specific):                              │
│   ais = "TheEternal:080175220"  ← From URL hash            │
│   entity = "the-eternal"                                    │
├─────────────────────────────────────────────────────────────┤
│ sessionStorage (tab-specific):                              │
│   sww-eq-score = 75                                         │
└─────────────────────────────────────────────────────────────┘
                          ↕ POLL
┌─────────────────────────────────────────────────────────────┐
│ DURABLE OBJECTS (Cloudflare)                               │
│                                                             │
│ conv:Human:080150227:TheEternal:080175220                  │
│   ├─ Message 1: {text: "Hello", eqScore: 10}              │
│   ├─ Message 2: {text: "How are you?", eqScore: 15}       │
│   └─ Message 3: {text: "Tell me about life", eqScore: 75} │
│                                                             │
│ conv:Human:080150227:FearAndLoathing:196080172             │
│   ├─ Message 1: {text: "Hi", eqScore: 10}                 │
│   └─ Message 2: {text: "What is reality?", eqScore: 88}   │
└─────────────────────────────────────────────────────────────┘
                          ↕ POLL
┌─────────────────────────────────────────────────────────────┐
│ BROWSER TAB 2                                               │
│ URL: #ais=FearAndLoathing:196080172&entity=fear-loathing  │
├─────────────────────────────────────────────────────────────┤
│ localStorage (shared across ALL tabs):                      │
│   username = "Human"                                        │
│   userColor = "080150227"                                   │
├─────────────────────────────────────────────────────────────┤
│ URL parameters (tab-specific):                              │
│   ais = "FearAndLoathing:196080172"  ← Different AI!       │
│   entity = "fear-and-loathing"                              │
├─────────────────────────────────────────────────────────────┤
│ sessionStorage (tab-specific):                              │
│   sww-eq-score = 88                                         │
└─────────────────────────────────────────────────────────────┘
```

### When New Message Arrives (Polling)

Every 3-20 seconds, all tabs poll for new messages. When a human message with an `eqScore` arrives:

```typescript
// CommentsStream.tsx (lines 996-1026)
newComments.forEach(msg => {
  if (msg['message-type'] === 'human' && msg.eqScore !== undefined) {
    // STEP 1: Is this our human identity?
    const isOurHuman = msg.username === username && msg.color === userColor;
    
    if (!isOurHuman) {
      console.log(`[EQ-SCORE] Skipping score from ${msg.username}:${msg.color} (different human)`);
      return;
    }
    
    // STEP 2: Do we have an AI defined? (conversation context)
    if (ais) {
      // We're in a specific conversation
      const [aiUsername, aiColor] = ais.split(':');
      
      // Update our sessionStorage (tab-specific)
      sessionStorage.setItem('sww-eq-score', msg.eqScore.toString());
      setEqScore(msg.eqScore);
      
      console.log(`[EQ-SCORE] Updated: ${msg.eqScore} (${username}:${userColor} + ${aiUsername}:${aiColor})`);
    } else {
      // No specific AI - global conversation
      sessionStorage.setItem('sww-eq-score', msg.eqScore.toString());
      setEqScore(msg.eqScore);
      
      console.log(`[EQ-SCORE] Updated: ${msg.eqScore} (global: ${username}:${userColor})`);
    }
  }
});
```

### Decision Tree

```
NEW MESSAGE ARRIVES: {username: "Human", color: "080150227", eqScore: 85}
                          ↓
┌────────────────────────────────────────────────────────────┐
│ Q1: Is this a human message with a score?                 │
│ ✓ msg['message-type'] === 'human'                         │
│ ✓ msg.eqScore !== undefined                               │
└────────────────────────────────────────────────────────────┘
                          ↓
┌────────────────────────────────────────────────────────────┐
│ Q2: Does this match OUR human identity?                   │
│                                                            │
│ Tab 1 checks:                                              │
│   msg.username === "Human"  ✓ (matches our username)      │
│   msg.color === "080150227" ✓ (matches our color)         │
│                                                            │
│ Tab 2 checks (SAME human):                                │
│   msg.username === "Human"  ✓ (matches our username)      │
│   msg.color === "080150227" ✓ (matches our color)         │
│                                                            │
│ Tab 3 checks (DIFFERENT human):                           │
│   msg.username === "Alice"  ✗ (different username)        │
│   msg.color === "200100080" ✗ (different color)           │
│   → SKIP (not our message)                                │
└────────────────────────────────────────────────────────────┘
                          ↓
┌────────────────────────────────────────────────────────────┐
│ Q3: Do we have a specific AI conversation?                │
│                                                            │
│ Tab 1:                                                     │
│   ais = "TheEternal:080175220" ✓                          │
│   → UPDATE sessionStorage (this tab only)                 │
│   → Log: "Updated: 85 (Human:080 + TheEternal:080)"      │
│                                                            │
│ Tab 2:                                                     │
│   ais = "FearAndLoathing:196080172" ✓                     │
│   → UPDATE sessionStorage (this tab only)                 │
│   → Log: "Updated: 85 (Human:080 + FearAndLoathing:196)" │
│                                                            │
│ Both tabs updated because:                                │
│   - Same human identity                                   │
│   - Both have AI conversations defined                    │
│   - Each writes to own sessionStorage (isolated)          │
└────────────────────────────────────────────────────────────┘
                          ↓
┌────────────────────────────────────────────────────────────┐
│ RESULT: Both tabs show score 85                           │
│                                                            │
│ Tab 1 header: "SCORE 85" (for this human)                │
│ Tab 2 header: "SCORE 85" (for same human)                │
│                                                            │
│ This is CORRECT because:                                  │
│   - Score measures human's message quality                │
│   - Not tied to which AI they're talking to              │
│   - Same human = same score                               │
└────────────────────────────────────────────────────────────┘
```

### Why Per-Human-Identity (Not Per-Conversation)?

**Design Philosophy:**

1. **EQ Score measures the human's communication quality**
   - A thoughtful message is thoughtful regardless of recipient
   - "Tell me about consciousness" scores 85 whether sent to TheEternal or FearAndLoathing
   - The human's emotional intelligence doesn't change based on who they're talking to

2. **Conversations are stored separately in DO**
   - Backend: `conv:Human:080:TheEternal:080` stores one conversation
   - Backend: `conv:Human:080:FearAndLoathing:196` stores another conversation
   - Each has its own messages with their own scores

3. **Frontend shows per-human score**
   - Tab 1 (Human + TheEternal): Shows Human's latest score from any conversation
   - Tab 2 (Human + FearAndLoathing): Shows same score (same human)
   - Tab 3 (Alice + TheEternal): Shows different score (different human)

### Storage Architecture

```
┌─────────────────────────────────────────────────────────────┐
│ localStorage (cross-tab, persistent)                        │
├─────────────────────────────────────────────────────────────┤
│ Purpose: User identity                                      │
│ Keys:                                                       │
│   - sww-username: "Human"                                   │
│   - sww-user-color: "080150227"                            │
│                                                             │
│ Shared by: ALL tabs in same browser                        │
│ Persists: Until cleared                                     │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ sessionStorage (per-tab, temporary)                         │
├─────────────────────────────────────────────────────────────┤
│ Purpose: Current EQ score for this tab's human             │
│ Keys:                                                       │
│   - sww-eq-score: "85"                                      │
│                                                             │
│ Shared by: Only this tab                                   │
│ Persists: Until tab closes                                  │
│ Resets: Opens new tab → score = 0                          │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ URL hash (per-tab, addressable)                            │
├─────────────────────────────────────────────────────────────┤
│ Purpose: Conversation context                              │
│ Format: #ais=AIName:color&entity=name                      │
│ Example: #ais=TheEternal:080175220&entity=the-eternal     │
│                                                             │
│ Determines: Which AI this tab is talking to                │
│ Used for: Logging, context (not score filtering)           │
└─────────────────────────────────────────────────────────────┘
```

### Current Behavior (Correct)

**Scenario:** Same human, two tabs, different AIs

```
Tab 1: Human:080150227 talking to TheEternal:080175220
  └─ Posts: "I think consciousness is fascinating"
     └─ Backend scores: 85
        └─ Tab 1 polls, sees msg from Human:080150227 with eqScore: 85
           └─ Checks: isOurHuman = TRUE (username + color match)
              └─ Checks: ais exists = TRUE (TheEternal defined)
                 └─ Updates: sessionStorage → 85
                    └─ Displays: "SCORE 85"

Tab 2: Human:080150227 talking to FearAndLoathing:196080172
  └─ (Same human, different AI conversation)
     └─ Tab 2 polls, sees SAME msg from Human:080150227 with eqScore: 85
        └─ Checks: isOurHuman = TRUE (username + color match)
           └─ Checks: ais exists = TRUE (FearAndLoathing defined)
              └─ Updates: sessionStorage → 85
                 └─ Displays: "SCORE 85"
```

**Result:** Both tabs show 85 ✓ **CORRECT**

**Why?** Both tabs represent the same human's communication quality. The score measures the human, not the conversation.

### Alternative Scenario: Different Humans

```
Tab 1: Human:080150227 talking to TheEternal:080175220
  └─ Shows score: 85

Tab 2: Alice:200100080 talking to TheEternal:080175220  
  └─ Shows score: 92 (different human, different score)

When Human posts message with score 85:
  ✓ Tab 1 updates (Human:080 = match)
  ✗ Tab 2 ignores (Alice:200 ≠ Human:080)
```

### Messages Don't Store Conversation ID

**Important:** Human messages do **NOT** have a field indicating which AI conversation they belong to.

**Message structure:**
```json
{
  "id": "abc123",
  "username": "Human",
  "color": "080150227",
  "text": "I think consciousness is fascinating",
  "message-type": "human",
  "eqScore": 85
  // ❌ NO "aiUsername" field
  // ❌ NO "aiColor" field
  // ❌ NO "conversationId" field
}
```

**Why?** 
- Messages are stored in conversation-specific DO keys on the backend
- Frontend polls ALL messages globally
- Each tab filters to show only messages from its conversation
- The `ais` parameter in the URL determines which conversation a tab represents

**How conversations work:**
1. Backend stores messages in DO keys: `conv:Human:080:TheEternal:080`
2. Frontend polls: `GET /api/comments` (returns ALL new messages)
3. Frontend filters: Based on username filters and active channel
4. EQ score: Identified by human's username:color only

### State Variables Reference

**From hooks (lines 170-191, 280-306):**

```typescript
// Username and color (from localStorage - shared across tabs)
const { username } = useUsernameEditor();     // e.g., "Human"
const { userColor } = useColorPicker();       // e.g., "080150227"

// URL parameters (from URL hash - tab-specific)
const { ais } = useSimpleFilters();           // e.g., "TheEternal:080175220"

// EQ score (from sessionStorage - tab-specific)
const [eqScore, setEqScore] = useState(() => {
  return parseInt(sessionStorage.getItem('sww-eq-score') || '0');
});
```

### React Re-render Flow

```
sessionStorage.setItem('sww-eq-score', '85')
  ↓
setEqScore(85)  // Triggers React state update
  ↓
CommentsStream re-renders
  ↓
AppHeader receives new eqScore prop
  ↓
UserControls receives new eqScore prop
  ↓
CountUp component animates: prevScore → 85 (over 1 second)
  ↓
setTimeout(1000) after animation completes
  ↓
setPrevScore(85)  // Ready for next animation
```

### Edge Cases Handled

**Case 1: No AI defined (global conversation)**
```typescript
if (ais) {
  // Specific conversation
} else {
  // Global conversation - still update score
  sessionStorage.setItem('sww-eq-score', msg.eqScore.toString());
}
```

**Case 2: Multiple tabs with same human, same AI**
```
Tab 1: Human:080 + TheEternal:080 → Shows score 85
Tab 2: Human:080 + TheEternal:080 → Shows score 85
(Both update when Human posts, both show same score)
```

**Case 3: New tab opened**
```typescript
const [eqScore, setEqScore] = useState(() => {
  return parseInt(sessionStorage.getItem('sww-eq-score') || '0');
});
// sessionStorage is empty in new tab → score = 0
```

**Case 4: Different user in same browser**
```
localStorage.setItem('sww-username', 'Bob');
localStorage.setItem('sww-user-color', '100200150');
// New identity → different score
```

---

## Alignment with Codebase Architecture

### Conversation Keys (DO Storage)

**Format:** `conv:humanUsername:humanColor:aiUsername:aiColor`

**Example:** `conv:Human:080150227:TheEternal:080175220`

**Order:** Human FIRST, then AI

**Used by:**
- `MessageQueue.js` (Durable Objects worker)
- Backend message storage
- Not directly used by frontend

### Download Filenames

**Format:** `${aiName}${aiColor}${humanName}${humanColor}_${timestamp}.txt`

**Example:** `TheEternal080175220Human080150227_2025-11-08T10-30-45.txt`

**Order:** AI FIRST, then human

**Used by:**
- `useContextMenus.ts` (Save ALL feature)
- Detected from actual messages in conversation
- Not related to eqScore

### EQ Score Logic

**Format:** Human identity only (username:color)

**Example:** `Human:080150227`

**Order:** Not tied to AI at all

**Used by:**
- `CommentsStream.tsx` (polling logic)
- Per-human score, not per-conversation
- Aligned with gamification philosophy

---

**Status:** Complete specification with technical architecture documentation
