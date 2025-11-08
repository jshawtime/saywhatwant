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

**Status:** Complete specification, ready for implementation
