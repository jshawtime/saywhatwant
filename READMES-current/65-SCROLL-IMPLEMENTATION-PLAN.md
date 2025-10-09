# 🎯 Scroll System Implementation Plan

**Date**: October 9, 2025  
**Status**: READY TO IMPLEMENT  
**Approach**: Complete rewrite - no legacy code, clean slate

---

## 📊 Current System Analysis (Complete)

### Files Involved in Scroll

**1. CommentsStream.tsx** (lines 765-862)
- `hasScrolledRef` - one-time initial scroll flag
- Effect: Scrolls to bottom on initial load
- **STATUS**: REMOVE COMPLETELY

**2. useScrollRestoration.ts** (174 lines)
- Filter toggle restoration
- Search restoration  
- Channel toggle restoration
- 6 different state refs tracking scroll
- **STATUS**: DELETE ENTIRE FILE

**3. useMessageTypeFilters.ts** (lines 41-61)
- `savedHumansScrollPosition`
- `savedEntitiesScrollPosition`
- **STATUS**: REMOVE scroll-related code (lines 41-49, 56-61)

**4. scrollBehaviors.ts** (177 lines) ✅
- Good utilities we'll use
- **STATUS**: KEEP AS-IS (already has good functions)

**5. useMobileKeyboard.ts** ✅
- Works fine, uses `isNearBottom` and `smoothScrollToBottom`
- **STATUS**: KEEP AS-IS (no changes needed)

**6. pollingSystem.ts** - `useAutoScrollDetection` ✅
- Tracks `isNearBottom` with scroll listener
- Provides `scrollToBottom` function
- **STATUS**: KEEP AS-IS (perfect for our needs)

---

## 🏗️ New Architecture

### Single Source of Truth: useScrollPositionMemory

**New hook**: `hooks/useScrollPositionMemory.ts`

**Responsibilities:**
1. Store 4 independent scroll positions (one per view)
2. Detect which view is currently active
3. Save position when user scrolls up
4. Clear position when user reaches bottom
5. Restore position when switching views
6. Clear position when filter bar changes

**Does NOT handle:**
- Initial scroll to bottom (CommentsStream handles this once)
- Scroll event listening (pollingSystem's `useAutoScrollDetection` does this)
- Mobile keyboard (useMobileKeyboard handles this)

---

## 💾 Data Structure

### Storage (localStorage)

```typescript
interface ScrollPositions {
  'mt=human': number | null;
  'mt=AI': number | null;
  'mt=ALL': number | null;
  'filter-active': number | null;
}

// Stored in localStorage as: 'sww-scroll-positions'
// Example:
{
  'mt=human': null,        // At bottom
  'mt=AI': 1500,           // Scrolled up
  'mt=ALL': null,          // At bottom
  'filter-active': 2300    // Scrolled up
}
```

### View Key Calculation

```typescript
function getViewKey(
  messageType: 'human' | 'AI' | 'ALL',
  isFilterActive: boolean
): string {
  // Filter view takes precedence over channel
  if (isFilterActive) {
    return 'filter-active';
  }
  return `mt=${messageType}`;
}
```

---

## 🔧 Implementation: useScrollPositionMemory

### Hook Interface

```typescript
interface UseScrollPositionMemoryParams {
  streamRef: React.RefObject<HTMLDivElement>;
  activeChannel: 'human' | 'AI' | 'ALL';
  isFilterActive: boolean;
  isNearBottom: boolean;  // From useAutoScrollDetection
  filteredCommentsLength: number;  // Trigger for content changes
  filterState: FilterState;  // To detect filter bar changes
}

interface UseScrollPositionMemoryReturn {
  // No return needed - hook manages everything internally
}
```

### Hook Logic Flow

```typescript
export function useScrollPositionMemory(params: UseScrollPositionMemoryParams): void {
  const {
    streamRef,
    activeChannel,
    isFilterActive,
    isNearBottom,
    filteredCommentsLength,
    filterState
  } = params;
  
  // State
  const positions = useRef<ScrollPositions>(loadPositions());
  const prevView = useRef<string>(getViewKey(activeChannel, isFilterActive));
  const prevFilterHash = useRef<string>(getFilterHash(filterState));
  
  // Effect 1: Save position when scrolling (uses isNearBottom from parent)
  useEffect(() => {
    const currentView = getViewKey(activeChannel, isFilterActive);
    
    if (!streamRef.current) return;
    
    if (isNearBottom) {
      // User at bottom - clear position for this view
      if (positions.current[currentView] !== null) {
        console.log(`[ScrollMemory] At bottom - clearing ${currentView} position`);
        positions.current[currentView] = null;
        savePositions(positions.current);
      }
    } else {
      // User scrolled up - save position
      const newPosition = streamRef.current.scrollTop;
      if (positions.current[currentView] !== newPosition) {
        console.log(`[ScrollMemory] Saving ${currentView} position: ${newPosition}`);
        positions.current[currentView] = newPosition;
        savePositions(positions.current);
      }
    }
  }, [isNearBottom, activeChannel, isFilterActive]);
  
  // Effect 2: Restore position when view changes
  useEffect(() => {
    const currentView = getViewKey(activeChannel, isFilterActive);
    
    // View changed?
    if (prevView.current !== currentView) {
      console.log(`[ScrollMemory] View changed: ${prevView.current} → ${currentView}`);
      
      // Wait for content to render
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (!streamRef.current) return;
          
          const savedPosition = positions.current[currentView];
          
          if (savedPosition !== null) {
            // Restore saved position
            console.log(`[ScrollMemory] Restoring ${currentView} to ${savedPosition}`);
            streamRef.current.scrollTop = savedPosition;
          } else {
            // No saved position - go to bottom
            console.log(`[ScrollMemory] No saved position for ${currentView}, going to bottom`);
            streamRef.current.scrollTop = streamRef.current.scrollHeight;
          }
        });
      });
      
      prevView.current = currentView;
    }
  }, [activeChannel, isFilterActive, filteredCommentsLength]);
  
  // Effect 3: Clear filter position when filter bar changes
  useEffect(() => {
    const currentFilterHash = getFilterHash(filterState);
    
    // Filter bar changed?
    if (isFilterActive && prevFilterHash.current !== currentFilterHash) {
      console.log(`[ScrollMemory] Filter bar changed - clearing filter position`);
      positions.current['filter-active'] = null;
      savePositions(positions.current);
      
      // Scroll to bottom
      if (streamRef.current) {
        requestAnimationFrame(() => {
          if (streamRef.current) {
            streamRef.current.scrollTop = streamRef.current.scrollHeight;
          }
        });
      }
    }
    
    prevFilterHash.current = currentFilterHash;
  }, [filterState, isFilterActive]);
}
```

### Helper Functions

```typescript
function getViewKey(
  messageType: 'human' | 'AI' | 'ALL',
  isFilterActive: boolean
): string {
  if (isFilterActive) return 'filter-active';
  return `mt=${messageType}`;
}

function getFilterHash(filterState: FilterState): string {
  // Create hash of filter configuration
  const parts = [
    filterState.users.map(u => `${u.username}:${u.color}`).join(','),
    filterState.words.join(','),
    filterState.negativeWords.join(',')
  ];
  return parts.join('|');
}

function loadPositions(): ScrollPositions {
  if (typeof window === 'undefined') {
    return {
      'mt=human': null,
      'mt=AI': null,
      'mt=ALL': null,
      'filter-active': null
    };
  }
  
  const saved = localStorage.getItem('sww-scroll-positions');
  if (saved) {
    try {
      return JSON.parse(saved);
    } catch {
      // Invalid data, return defaults
    }
  }
  
  return {
    'mt=human': null,
    'mt=AI': null,
    'mt=ALL': null,
    'filter-active': null
  };
}

function savePositions(positions: ScrollPositions): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem('sww-scroll-positions', JSON.stringify(positions));
  }
}
```

---

## 🔨 Implementation Steps

### Step 1: Create the new hook
- [x] Analyzed current system
- [ ] Create `hooks/useScrollPositionMemory.ts`
- [ ] Implement with tests in console

### Step 2: Integrate into CommentsStream
- [ ] Import new hook
- [ ] Call with proper params
- [ ] Remove old initial scroll effect (lines 765-862)
- [ ] Add simple one-time initial scroll (just for first load)

### Step 3: Remove legacy code
- [ ] Delete `hooks/useScrollRestoration.ts` completely
- [ ] Remove scroll code from `hooks/useMessageTypeFilters.ts` (lines 41-61)
- [ ] Remove `useScrollRestoration` import from CommentsStream
- [ ] Remove all old scroll refs and state

### Step 4: Update CommentsStream initial scroll
Replace lines 765-862 with simple one-time scroll:
```typescript
// One-time initial scroll to bottom (happens once per page load)
const hasInitialScrolled = useRef(false);

useEffect(() => {
  if (!hasInitialScrolled.current && 
      filteredComments.length > 0 && 
      !isLoading && 
      streamRef.current) {
    
    streamRef.current.scrollTop = streamRef.current.scrollHeight;
    hasInitialScrolled.current = true;
    console.log('[Init] Initial scroll to bottom');
  }
}, [filteredComments.length, isLoading]);
```

### Step 5: Testing
- [ ] Test all 9 scenarios from spec
- [ ] Verify no race conditions
- [ ] Check console logs for clean decision tree

---

## ✅ Test Scenarios (From Spec)

1. [ ] Fresh page load → Bottom
2. [ ] Page refresh → Bottom
3. [ ] Switch mt=human → mt=AI (both at bottom first time)
4. [ ] Scroll up in mt=AI, switch to mt=human, switch back → Returns to position
5. [ ] At bottom in any view, new message → Auto-scroll
6. [ ] Scrolled up, new message → Don't interrupt
7. [ ] Filter toggle with no changes → Remember position
8. [ ] Filter bar changes → Go to bottom
9. [ ] Search activated → Go to bottom (counts as filter change)

---

## 📦 Files to Modify

### New Files
1. **hooks/useScrollPositionMemory.ts** (NEW - ~150 lines)

### Modified Files
2. **components/CommentsStream.tsx**
   - Remove: Lines 765-862 (old initial scroll)
   - Remove: Import `useScrollRestoration`
   - Remove: `hasScrolledRef` declaration
   - Add: Import `useScrollPositionMemory`
   - Add: Call `useScrollPositionMemory` hook
   - Add: Simple one-time initial scroll (5 lines)

3. **hooks/useMessageTypeFilters.ts**
   - Remove: Lines 41-49 (saves scroll before hiding humans)
   - Remove: Lines 56-61 (saves scroll before hiding entities)
   - Remove: Return values `savedHumansScrollPosition`, `savedEntitiesScrollPosition`

### Deleted Files
4. **hooks/useScrollRestoration.ts** (DELETE COMPLETELY)

### Unchanged Files (Keep Using)
5. **utils/scrollBehaviors.ts** ✅ (utilities we use)
6. **hooks/useMobileKeyboard.ts** ✅ (works fine)
7. **modules/pollingSystem.ts** ✅ (provides `useAutoScrollDetection`)

---

## 🎯 Success Criteria

1. ✅ All scroll logic in ONE file (`useScrollPositionMemory.ts`)
2. ✅ 4 independent position slots working
3. ✅ No race conditions
4. ✅ Clean console logs showing decision path
5. ✅ All 9 test scenarios pass
6. ✅ Can switch views 100 times without issues

---

## 🚀 Ready to Implement

All analysis complete. Clean architecture defined. Ready to write code.

**Estimated time**: 1-2 hours  
**Risk level**: Low (clean rewrite, well-defined spec)  
**Confidence**: High (simple logic, clear requirements)

