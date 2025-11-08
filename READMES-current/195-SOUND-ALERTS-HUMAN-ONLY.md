# Sound Alerts for Human Messages Only

## Current State (BROKEN)

### What Exists
- ✅ Right-click context menu on filter bar username filters
- ✅ Sound options: Silent, Delightful, Gamer, Hello, Horn, Subtle
- ✅ Visual feedback (sound icon + bold on new match)
- ✅ Sound notification system with cooldown
- ❌ **BUG: Not playing sounds when messages arrive**
- ❌ **ISSUE: Available for BOTH human and AI usernames**

### Current Code Location
**File:** `saywhatwant/components/CommentsStream.tsx`  
**Function:** `checkNotificationMatches` (lines 854-905)

```typescript
const checkNotificationMatches = useCallback((newComments: Comment[]) => {
  // Check each new comment
  newComments.forEach(comment => {
    // Check username filters (username+color combo)
    filterUsernames.forEach(filter => {
      // Match both username AND color (username+color = unique identity)
      if (comment.username === filter.username && comment.color === filter.color) {
        const filterKey = getFilterKey(filter.username, filter.color);
        const setting = getFilterNotificationSetting(filterKey);
        
        if (setting.sound !== 'none' && !filtersToMark.includes(filterKey)) {
          soundsToPlay.push(setting.sound);
          filtersToMark.push(filterKey);
        }
      }
    });
    
    // Check word filters...
  });
}, [filterUsernames, filterWords, userColor]);
```

### Problem
1. **Context menu shows for AI usernames** (should only show for human)
2. **Sound alerts don't trigger** when matching messages arrive
3. No check for `message-type === 'human'` in notification logic

---

## What We Want

### Requirements
1. **Context menu ONLY on human usernames**
   - Right-click on AI username → No context menu
   - Right-click on human username → Show sound alert menu
   
2. **Sound alerts ONLY for human messages**
   - AI message from tracked username → No sound
   - Human message from tracked username → Play sound ✅
   
3. **Fix broken sound playback**
   - Currently not working at all
   - Should play when human message matches filter

### User Experience
**Scenario 1: Human Username Alert**
```
Filter bar: [Alice], [Bob], [ChatGPT]
Sound set: Alice → Delightful 🌟

New message arrives:
- From: Alice (human) → Play "Delightful" sound ✅
- Bold "Alice" in filter bar
```

**Scenario 2: AI Username (No Alert)**
```
Filter bar: [Alice], [Bob], [ChatGPT]
Sound set: ChatGPT → Hello 👋

New message arrives:
- From: ChatGPT (AI) → No sound ❌
- Context menu shouldn't exist for ChatGPT
```

**Scenario 3: Right-Click Menu**
```
Filter bar: [Alice (human)], [ChatGPT (AI)]

Right-click Alice → Show sound menu ✅
Right-click ChatGPT → No menu (or disabled) ❌
```

---

## How to Implement

### Step 1: Hide Context Menu for AI Usernames

**File:** `saywhatwant/components/FilterBar.tsx` (line 203)

**Current code:**
```tsx
<span
  key={`user-${filter.username}-${idx}`}
  className="..."
  onContextMenu={(e) => handleFilterContextMenu(e, filterKey)}
  title="Right click to set alert. Filter must be on."
>
```

**Change to:**
```tsx
<span
  key={`user-${filter.username}-${idx}`}
  className="..."
  onContextMenu={(e) => {
    // Only show context menu for HUMAN usernames
    // Check if this filter corresponds to a human message type
    const isHumanFilter = filterUsernames.some(f => 
      f.username === filter.username && 
      f.color === filter.color &&
      // We need to track message-type on the filter somehow
      // OR: Check if any human message in current view has this username+color
    );
    
    if (isHumanFilter) {
      handleFilterContextMenu(e, filterKey);
    } else {
      e.preventDefault(); // Block context menu for AI
    }
  }}
  title={isHumanFilter ? "Right click to set alert. Filter must be on." : filter.username}
>
```

**Problem:** Filter object doesn't store `message-type`!

**Better approach:** Track message-type when adding filter

### Step 2: Add Message Type to Filter Object

**File:** `saywhatwant/types/index.ts`

**Current:**
```typescript
export interface UsernameFilter {
  username: string;
  color: string;
}
```

**Change to:**
```typescript
export interface UsernameFilter {
  username: string;
  color: string;
  messageType?: 'human' | 'AI';  // Track if this is human or AI username
}
```

### Step 3: Set Message Type When Adding Filter

**File:** `saywhatwant/components/CommentsStream.tsx`

**Find:** `handleUsernameClick` or wherever filters are added

**Add logic:**
```typescript
const handleUsernameClick = useCallback((username: string, color: string) => {
  // Find a message with this username+color to determine type
  const message = filteredComments.find(
    m => m.username === username && m.color === color
  );
  
  const messageType = message?.['message-type'] || 'human';
  
  // Add filter with message type
  addUsernameFilter(username, color, messageType);
}, [filteredComments, addUsernameFilter]);
```

### Step 4: Update Filter Bar to Check Message Type

**File:** `saywhatwant/components/FilterBar.tsx`

```tsx
{filterUsernames.map((filter, idx) => {
  const isHuman = filter.messageType === 'human';
  
  return (
    <span
      key={`user-${filter.username}-${idx}`}
      onContextMenu={(e) => {
        if (isHuman) {
          handleFilterContextMenu(e, filterKey);
        } else {
          e.preventDefault(); // No menu for AI
        }
      }}
      title={isHuman ? "Right click to set alert. Filter must be on." : filter.username}
    >
      {/* ... render filter ... */}
    </span>
  );
})}
```

### Step 5: Filter Sound Alerts to Human Messages Only

**File:** `saywhatwant/components/CommentsStream.tsx` (line 860)

**Current code:**
```typescript
newComments.forEach(comment => {
  // Check username filters (username+color combo)
  filterUsernames.forEach(filter => {
    // Match both username AND color (username+color = unique identity)
    if (comment.username === filter.username && comment.color === filter.color) {
      const filterKey = getFilterKey(filter.username, filter.color);
      const setting = getFilterNotificationSetting(filterKey);
      
      if (setting.sound !== 'none' && !filtersToMark.includes(filterKey)) {
        soundsToPlay.push(setting.sound);
        filtersToMark.push(filterKey);
      }
    }
  });
});
```

**Change to:**
```typescript
newComments.forEach(comment => {
  // ONLY check HUMAN messages for sound alerts
  if (comment['message-type'] !== 'human') {
    return; // Skip AI messages
  }
  
  // Check username filters (username+color combo)
  filterUsernames.forEach(filter => {
    // ONLY alert for HUMAN filters
    if (filter.messageType !== 'human') {
      return; // Skip AI filters
    }
    
    // Match both username AND color (username+color = unique identity)
    if (comment.username === filter.username && comment.color === filter.color) {
      const filterKey = getFilterKey(filter.username, filter.color);
      const setting = getFilterNotificationSetting(filterKey);
      
      if (setting.sound !== 'none' && !filtersToMark.includes(filterKey)) {
        soundsToPlay.push(setting.sound);
        filtersToMark.push(filterKey);
      }
    }
  });
});
```

### Step 6: Debug Why Sounds Don't Play

**Check:**
1. Is `checkNotificationMatches` being called?
2. Are sounds being added to `soundsToPlay` array?
3. Is `notificationSystem.playSoundsInOrder` working?
4. Are audio files loaded?
5. Is browser blocking autoplay?

**Add logging:**
```typescript
const checkNotificationMatches = useCallback((newComments: Comment[]) => {
  console.log('[SOUND-ALERT] Checking', newComments.length, 'new messages');
  
  const soundsToPlay: NotificationSound[] = [];
  const filtersToMark: string[] = [];
  
  newComments.forEach(comment => {
    console.log('[SOUND-ALERT] Comment:', comment.username, comment['message-type']);
    
    if (comment['message-type'] !== 'human') {
      console.log('[SOUND-ALERT] Skipping AI message');
      return;
    }
    
    filterUsernames.forEach(filter => {
      if (filter.messageType !== 'human') return;
      
      if (comment.username === filter.username && comment.color === filter.color) {
        console.log('[SOUND-ALERT] Match found!', filter.username);
        // ... rest of logic
      }
    });
  });
  
  console.log('[SOUND-ALERT] Sounds to play:', soundsToPlay);
  // ... play sounds
}, [filterUsernames, filterWords]);
```

---

## Files to Modify

1. **`saywhatwant/types/index.ts`**
   - Add `messageType` to `UsernameFilter` interface

2. **`saywhatwant/components/CommentsStream.tsx`**
   - Update `handleUsernameClick` to include message type
   - Update `checkNotificationMatches` to filter by human messages only
   - Add debug logging

3. **`saywhatwant/components/FilterBar.tsx`**
   - Conditionally show context menu based on `filter.messageType`
   - Update tooltip text

4. **`saywhatwant/hooks/useUsernameFilters.ts`** (if exists)
   - Update filter add/remove logic to handle message type

---

## Testing Checklist

### Context Menu
- [ ] Right-click human username in filter bar → Shows sound menu ✅
- [ ] Right-click AI username in filter bar → No menu / Disabled ❌
- [ ] Tooltip shows correct text for each type

### Sound Alerts
- [ ] Add human username to filter, set sound
- [ ] Human posts message → Sound plays ✅
- [ ] AI posts message → No sound ❌
- [ ] Check browser console for sound logs

### Visual Feedback
- [ ] Human message matches → Filter becomes bold ✅
- [ ] AI message matches → Filter stays normal ❌
- [ ] Hover over bold filter → Unbolds (marks as read)

---

## Current Bug Investigation

**Why sounds aren't playing:**
1. Check if `checkNotificationMatches` is called in polling flow
2. Check if `notificationSystem` is initialized
3. Check browser autoplay policy (might need user interaction first)
4. Verify audio files are accessible
5. Check if `playSoundsInOrder` function works

**Location to add call:**
- After `addFilteredMessages(newComments)` in polling logic
- Currently might not be calling `checkNotificationMatches` at all!

---

## Summary

**Goal:** Sound alerts ONLY for human messages, context menu ONLY for human username filters.

**Key Changes:**
1. Add `messageType` to filter tracking
2. Hide context menu for AI filters
3. Skip AI messages in notification check
4. Fix/debug why sounds don't play currently

**Philosophy:** AI messages are for reading, human messages are for alerting.

