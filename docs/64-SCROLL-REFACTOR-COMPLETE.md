# 🔄 SCROLL SYSTEM - Final Specification

**Date**: October 9, 2025  
**Status**: SPECIFICATION COMPLETE - READY FOR IMPLEMENTATION  
**Priority**: CRITICAL - Scroll behavior must be predictable and reliable

---

## 📋 USER REQUIREMENTS (Confirmed with User #1)

### What User Actually Asked

**User's question:** "Does React have a native way to remember scroll position when switching between views (mt=human vs mt=AI)?"

**Simple answer:** No, React doesn't automatically save/restore scroll position when component content changes. You need to manually save `element.scrollTop` before content changes and restore it after.

### What User Actually Wants

**A simple, predictable scroll system with independent position memory for each view.**

---

## 🎯 THE SPECIFICATION

### Core Concept: Independent View Memory

**4 Independent Views (each has its own saved scroll position):**
1. `mt=human` view
2. `mt=AI` view  
3. `mt=ALL` view
4. **Filter active** view (any filter combination = single view)

### The 5 Rules (Simple & Complete)

#### Rule 1: Default is Always Bottom
- No saved position for current view? → **Bottom (newest messages)**
- Fresh page load or refresh? → **Bottom**
- Initial load with URL filters already active? → **Bottom**

#### Rule 2: Reaching Bottom Clears THAT View's Position
- User **manually scrolls** to bottom → Clear current view's position (if exists)
- **Auto-scroll** happens (new message arrives) → Clear current view's position (if exists)
- **Optimization:** If position already null → Don't trigger clear (avoid unnecessary operations)
- **Other views remain untouched** (independent memory)

#### Rule 3: Filter Behavior
- **Filter toggle ON, no filter bar change** → Use saved filter position (if exists), else bottom
- **Filter toggle ON, filter bar changes** → Clear filter position → Bottom
- **Filter toggle OFF** → Return to base view (mt=human/AI/ALL) with its saved position (if exists)

#### Rule 4: Search = Filter Bar Change
- Search activation → Counts as filter bar modification
- Clears filter view position → Bottom

#### Rule 5: New Messages (Polling)
- **User at bottom** → Auto-scroll to show new message → Clears that view's position (if exists)
- **User scrolled up** (saved position exists) → Stay put, don't interrupt

---

## 🧠 The Logic (How It Works)

### View Independence
Each view maintains its own position completely independently:
- Switch from `mt=AI` (scrolled up, position saved) → `mt=human` (no position) → Goes to bottom
- Auto-scroll in `mt=human` clears `mt=human` position, **but `mt=AI` still remembers** where user was
- Switch back to `mt=AI` → Returns to saved scroll position
- Clean, predictable, no cross-view interference

### Position Lifecycle
```
View loads → Check for saved position
  ├─ Has saved position? → Restore to that position
  └─ No saved position? → Go to bottom

User scrolls → Monitor position
  ├─ Scrolled up? → Save position for this view
  └─ At bottom? → Clear position for this view (if exists)

View switches → Independent memory
  └─ Each view remembers its own position (or defaults to bottom)
```

---

## 📝 Current State of Scroll System

**Status:** Broken and unreliable  
**Symptoms:**
- Initial page load sometimes scrolls to top instead of bottom
- Channel toggles (human ⟷ AI) randomly end up at 6% from top
- Behavior is non-deterministic (works sometimes, breaks other times)

**Root cause:** 9 different state variables tracking scroll across 4 different files. Multiple useEffect hooks firing in unpredictable order causing race conditions.

### Files Currently Involved in Scroll (The Mess)

1. `components/CommentsStream.tsx` - Initial scroll effect (lines 829-862)
2. `hooks/useScrollRestoration.ts` - Channel/filter toggle restoration (174 lines, 3 separate effects)
3. `utils/scrollBehaviors.ts` - Utility functions (good utilities, keep these)
4. `hooks/useMobileKeyboard.ts` - Mobile keyboard handling (works fine)
5. `hooks/useMessageTypeFilters.ts` - Duplicate scroll saving

**Problem:** 9 different state variables across these files trying to coordinate scroll behavior.

---

## 💾 Implementation Data Structure

### Storage Model

**Simple key-value storage (localStorage or React state):**
```typescript
interface ScrollPositions {
  'mt=human': number | null;
  'mt=AI': number | null;
  'mt=ALL': number | null;
  'filter-active': number | null;
}

// Example state:
{
  'mt=human': null,        // At bottom (or never scrolled up)
  'mt=AI': 1500,           // Scrolled up, position saved
  'mt=ALL': null,          // At bottom
  'filter-active': 2300    // Scrolled up in filter view
}
```

### View Key Logic
```typescript
function getCurrentViewKey(activeChannel: string, isFilterActive: boolean): string {
  if (isFilterActive) {
    return 'filter-active';
  }
  return `mt=${activeChannel}`; // 'mt=human', 'mt=AI', 'mt=ALL'
}
```

---

## 🔧 Implementation Approach Options

### Option A: Centralized Hook (Recommended)
Create single `useScrollPositionManager` hook that:
- Stores 4 view positions
- Monitors scroll events
- Handles view switches
- Clears positions when at bottom

**Pros:** Clean, testable, single source of truth  
**Cons:** Need to refactor existing code

### Option B: Fix Current Architecture
Keep existing hooks but:
- Simplify to 4-position model
- Fix race conditions
- Remove duplicate logic

**Pros:** Less refactoring  
**Cons:** Still distributed, harder to maintain

### Option C: Hybrid
Keep utilities, create lightweight position manager, hook into existing flow

**Pros:** Minimal changes  
**Cons:** Still some distributed logic

---

## 🎬 Next Steps

### Step 1: Choose Implementation Approach
**Decision needed:** Which option (A, B, or C)?

**Recommendation:** Start with Option C (Hybrid)
- Create simple position manager
- Hook into existing scroll events
- Minimal disruption
- Can evolve to Option A later if needed

### Step 2: Understand Current Code
Before implementing, need to:
1. Read `components/CommentsStream.tsx` scroll logic
2. Read `hooks/useScrollRestoration.ts` 
3. Understand how `activeChannel` and `isFilterEnabled` work
4. Find where scroll events are currently monitored

### Step 3: Implementation Plan
Will be created after understanding current code

### Step 4: Testing Checklist
- [ ] Fresh page load → Bottom
- [ ] Page refresh → Bottom  
- [ ] Switch mt=human → mt=AI → Both at bottom first time
- [ ] Scroll up in mt=AI, switch to mt=human, switch back → Returns to position
- [ ] At bottom in any view, new message → Auto-scroll
- [ ] Scrolled up, new message → Don't interrupt
- [ ] Filter toggle with no changes → Remember position
- [ ] Filter bar changes → Go to bottom
- [ ] Search activated → Go to bottom

---

## 📊 Summary

### What We've Defined

**Scroll System Requirements:**
- 4 independent views with position memory
- Simple rules: default to bottom, save positions when scrolled up
- Clear triggers for position clearing
- No cross-view interference

**Current Problems:**
- 9 state variables across 4 files
- Race conditions between multiple effects
- Non-deterministic behavior

**Solution Path:**
- Choose implementation approach (A, B, or C)
- Understand current code
- Implement position manager
- Test thoroughly

### Ready to Begin Implementation

Next: Choose approach and start reading current code to understand integration points.

---

**Document updated by:** New Agent  
**Date:** October 9, 2025  
**Status:** Specification complete, awaiting implementation decision