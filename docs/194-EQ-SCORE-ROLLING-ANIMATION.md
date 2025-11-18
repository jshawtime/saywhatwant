# 194: EQ Score Rolling Animation - Odometer Effect

## Status: 📋 INVESTIGATION + PLANNING

**Created:** 2025-11-06  
**Priority:** MEDIUM (Polish Feature)  
**Issue:** Score updates instantly without visual feedback

---

## Executive Summary

**Current:** Score jumps from 31 → 56 (instant)  
**Want:** Score rolls from 31 → 56 (animated, 0.6s)  
**How:** Digit-by-digit rolling animation (odometer effect)  
**Impact:** Satisfying visual feedback, engagement, YouTube-style polish

---

## What We Have (Instant Update)

### Current Behavior

**Score changes:**
```
Before: 31
After:  56  (instant jump)
```

**Issues:**
- No visual indication score changed
- Feels abrupt
- Miss the satisfaction of seeing it roll
- No sense of "how much" it changed

### Current Display

**Score shows after refresh but not after poll:**
- Score stored in DO ✅
- Frontend polls and gets message with score ✅
- But display doesn't update until refresh ❌

**First bug to fix:** Make score reactive to polling updates

---

## What We Want (Rolling Animation)

### YouTube-Style Rolling

**Example: 31 → 56**

**Tens digit rolls:**
```
3 → 4 → 5 (stops)
```

**Ones digit rolls:**
```
1 → 2 → 3 → 4 → 5 → 6 (stops)
```

**Both roll simultaneously over 0.6 seconds**

### Animation Characteristics

**Duration:** 0.6 seconds total  
**Easing:** Ease-out (fast start, slow end)  
**Independence:** Each digit rolls separately  
**Direction:** Rolls up (3→5) or down (5→3) as needed  
**Visual:** Smooth, satisfying, professional

### Why This Works

**Engagement:**
- Satisfying to watch
- Visual reward for thoughtful messages
- Makes score feel "earned"

**Information:**
- Animation duration shows magnitude of change
- Big change = more rolling = more noticeable
- Small change = quick roll

**Polish:**
- Professional feel (YouTube, Twitter use this)
- Modern UI pattern
- Expected behavior for dynamic numbers

---

## Bug Fix: Score Not Updating on Poll

### Current Issue

**What happens:**
1. User posts: "Hello"
2. Backend scores: 10
3. Backend stores in DO
4. Frontend polls
5. **Score still shows 0** ❌
6. User refreshes
7. Score shows 10 ✅

### Root Cause

**Score calculation in CommentsStream.tsx (line 1150-1158):**
```typescript
eqScore={
  (() => {
    const latestHuman = filteredComments
      .filter(c => c['message-type'] === 'human')
      .sort((a, b) => b.timestamp - a.timestamp)[0];
    return latestHuman?.eqScore || 0;
  })()
}
```

**Problem:** This runs once at render. When new messages arrive via polling, filteredComments updates, but this IIFE doesn't recalculate!

**Fix:** Use useMemo with dependency:
```typescript
const eqScore = useMemo(() => {
  const latestHuman = filteredComments
    .filter(c => c['message-type'] === 'human')
    .sort((a, b) => b.timestamp - a.timestamp)[0];
  return latestHuman?.eqScore || 0;
}, [filteredComments]);  // Recalculate when messages change
```

### Also Fix: Score Resets to 0

**Issue:** "when I send a new message it goes back to 0"

**Cause:** New message has no score yet (scoring happens after ~1s)

**Solution:** Keep showing previous score until new score arrives
```typescript
const [displayedScore, setDisplayedScore] = useState(0);

useEffect(() => {
  const newScore = /* calculate from latest message */;
  if (newScore > 0) {  // Only update if we have a real score
    setDisplayedScore(newScore);
  }
}, [filteredComments]);
```

---

## Implementation Options

### Option A: react-countup Library

**Package:** `react-countup`  
**Install:** `npm install react-countup`

**Pros:**
- Battle-tested (7M+ downloads/month)
- Simple API
- Handles digit rolling automatically
- Configurable duration/easing

**Usage:**
```tsx
import CountUp from 'react-countup';

<CountUp 
  start={31} 
  end={56} 
  duration={0.6}
  useEasing={true}
  easingFn={(t) => t * (2 - t)}  // Ease-out
/>
```

**Cons:**
- Adds dependency (but small, 15KB)

### Option 2: react-spring Library

**Package:** `react-spring`  
**Install:** `npm install react-spring`

**Pros:**
- Powerful animation library
- Handles all kinds of animations
- Smooth spring physics

**Usage:**
```tsx
import { useSpring, animated } from 'react-spring';

const { number } = useSpring({
  from: { number: 31 },
  to: { number: 56 },
  config: { duration: 600 }
});

<animated.span>
  {number.to(n => n.toFixed(0))}
</animated.span>
```

**Cons:**
- Larger dependency (48KB)
- More complex API

### Option 3: CSS + React (Custom, Lightweight)

**No dependencies, pure CSS + useState**

**Approach:**
- Break number into digits [3, 1]
- Animate each digit with CSS transform
- Use setTimeout for sequencing

**Pros:**
- No dependencies
- Full control
- Lightweight

**Cons:**
- More code to write
- Need to handle edge cases
- Reinventing the wheel

### Recommendation: Option A (react-countup)

**Why:**
- Simple, proven solution
- Exactly what we need (number counting)
- Small size (15KB)
- Minimal code (3 lines)
- Focus on features, not animation plumbing

---

## Implementation Plan

### Step 1: Fix Score Reactivity (First!)

**File:** `components/CommentsStream.tsx`

**Current (broken):**
```typescript
eqScore={(() => { /* IIFE */ })()}
```

**Fix:**
```typescript
const eqScore = useMemo(() => {
  const latestHuman = filteredComments
    .filter(c => c['message-type'] === 'human')
    .sort((a, b) => b.timestamp - a.timestamp)[0];
  return latestHuman?.eqScore || 0;
}, [filteredComments]);
```

**And preserve score:**
```typescript
const [lastKnownScore, setLastKnownScore] = useState(0);

useEffect(() => {
  if (eqScore > 0) {
    setLastKnownScore(eqScore);
  }
}, [eqScore]);

// Pass lastKnownScore to header (not eqScore directly)
```

### Step 2: Install react-countup

```bash
cd saywhatwant
npm install react-countup
```

### Step 3: Update UserControls to Use CountUp

**File:** `components/Header/UserControls.tsx`

**Current:**
```tsx
<span style={{...}}>
  {eqScore}
</span>
```

**New:**
```tsx
import CountUp from 'react-countup';

<span style={{...}}>
  <CountUp 
    start={0}
    end={eqScore}
    duration={0.6}
    preserveValue={true}  // Don't reset to 0
    useEasing={true}
  />
</span>
```

### Step 4: Handle Edge Cases

**Case 1: First load (0 → actual score)**
```tsx
<CountUp start={0} end={eqScore} duration={0.6} />
```

**Case 2: Score decreases (56 → 31)**
```tsx
// CountUp handles this automatically!
<CountUp start={56} end={31} duration={0.6} />
```

**Case 3: New message (score unknown)**
```tsx
// Show previous score until new one arrives
preserveValue={true}
```

---

## Testing

**Test 1: First message**
```
Post: "Hello"
Expected: 0 → 10 (rolls over 0.6s)
```

**Test 2: Score increase**
```
Current: 10
Post: "I think consciousness is fascinating"
Expected: 10 → 85 (both digits roll)
```

**Test 3: Score decrease**
```
Current: 85
Post: "hi"
Expected: 85 → 10 (rolls down)
```

**Test 4: New message before score arrives**
```
Post message
Score still 0 (processing)
After 1s: 0 → 75 (rolls)
```

---

## Alternative: Pure CSS Solution

If we want zero dependencies:

```tsx
const [displayDigits, setDisplayDigits] = useState(['0', '0']);

useEffect(() => {
  const digits = eqScore.toString().padStart(2, '0').split('');
  // Animate each digit with CSS transform
  // Use position: relative with transform: translateY
  // Each digit is a column that scrolls vertically
}, [eqScore]);
```

**More complex but doable.** Would need ~50 lines of code vs 3 lines with react-countup.

---

**Last Updated:** 2025-11-06  
**Author:** Claude (Anthropic) - AI Engineering Agent  
**Recommendation:** Use react-countup for simplicity and reliability
