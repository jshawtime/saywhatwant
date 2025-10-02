# CommentsStream.tsx Refactor Plan

## Executive Summary

**Problem**: `CommentsStream.tsx` is a 1,923-line monolithic component doing EVERYTHING:
- Message display and rendering
- Filter system integration (multiple filter hooks)
- Search functionality
- Username/color management
- Comment submission
- Context menus
- Scroll management and restoration
- Mobile keyboard handling
- Video sharing integration
- IndexedDB querying
- Cloud API polling
- Model URL integration
- Notification system
- Domain filtering

**Goal**: Break into focused, maintainable, testable components following the "Simple Strong Solid" philosophy.

**Status**: PLANNING PHASE

---

## Current State Analysis

### What CommentsStream.tsx Actually Does (Lines)

1. **State Management** (Lines 63-130)
   - 20+ useState declarations
   - initialMessages, displayedComments, inputText, username, userColor, etc.
   - Domain configuration, filter states, scroll positions, context menus

2. **Hook Integrations** (Lines 157-324)
   - useAutoScrollDetection
   - useVideoSharing
   - useFilters (legacy)
   - useIndexedDBFiltering (current)
   - useCommentsWithModels
   - useCommentSubmission
   - useCommentsPolling
   - useCommonShortcuts

3. **Data Fetching** (Lines 507-706)
   - fetchComments from cloud/localStorage
   - Initial load from IndexedDB + KV
   - Polling for new messages (presence-based)
   - Lazy loading from IndexedDB

4. **Event Handlers** (Lines 707-1162)
   - Context menus (message + title)
   - Copy/Save operations
   - Block user/word operations
   - Color picker
   - Username editing
   - Message type toggles (Humans/Entities)

5. **Scroll Management** (Lines 1165-1390)
   - Filter toggle scroll restoration
   - Search scroll restoration
   - Message type filter scroll restoration
   - Mobile keyboard adjustment
   - Auto-scroll logic

6. **Render/JSX** (Lines 1392-1922)
   - Header (title, domain filter, message type toggles, username, TV)
   - FilterBar
   - Search bar
   - Comments stream
   - Input form
   - Context menus

---

## Existing Components We Have

### Already Extracted (Good!):
1. **FilterBar** (`components/FilterBar.tsx`) - Filter chips display
2. **DomainFilter** (`components/DomainFilter.tsx`) - Domain toggle button
3. **ContextMenu** (`components/ContextMenu.tsx`) - Right-click menu for messages
4. **TitleContextMenu** (`components/TitleContextMenu.tsx`) - Right-click menu for title
5. **UIElements** (`components/UIElements.tsx`) - Styled input/icon components
6. **VideoPlayer** (`components/VideoPlayer.tsx`) - Video playback

### Hook Modules (Good!):
1. **useFilters** (`hooks/useFilters.ts`) - Legacy filter state management
2. **useIndexedDBFiltering** (`hooks/useIndexedDBFiltering.ts`) - DB querying
3. **useCommentsWithModels** (`hooks/useCommentsWithModels.ts`) - AI model integration
4. **useCommentSubmission** (`modules/commentSubmission.ts`) - Comment posting
5. **useCommentsPolling** (`modules/pollingSystem.ts`) - New message polling
6. **useAutoScrollDetection** (`modules/pollingSystem.ts`) - Scroll detection
7. **useVideoSharing** (`modules/videoSharingSystem.ts`) - Video link handling

### Utility Modules (Good!):
1. **simpleIndexedDB** (`modules/simpleIndexedDB.ts`) - Database management
2. **cloudApiClient** (`modules/cloudApiClient.ts`) - API calls
3. **filterSystem** (`modules/filterSystem.ts`) - Filter logic
4. **colorSystem** (`modules/colorSystem.ts`) - Color utilities
5. **notificationSystem** (`modules/notificationSystem.ts`) - Sound notifications
6. **timestampSystem** (`modules/timestampSystem.ts`) - Time formatting
7. **keyboardShortcuts** (`modules/keyboardShortcuts.ts`) - Keyboard handling

---

## Proposed Component Architecture

### New Components to Create:

#### 1. **MessageListContainer** (Lines 1623-1762)
**Purpose**: Manages the scrollable messages area
- Scroll ref management
- Lazy loading trigger
- "Load More" button
- Empty state display
- Loading state

**Props**:
```typescript
interface MessageListContainerProps {
  messages: Comment[];
  isLoading: boolean;
  hasMore: boolean;
  isLoadingMore: boolean;
  userColor: string;
  searchTerm: string;
  isFilterEnabled: boolean;
  onLoadMore: () => void;
  onMessageClick: (username: string, color: string) => void;
  onContextMenu: (e: React.MouseEvent, comment: Comment, isUsername: boolean) => void;
  toggleFilter: () => void;
}
```

**What stays in parent**: 
- streamRef (passed as ref)
- Scroll position management logic

#### 2. **MessageItem** (Lines 1706-1759)
**Purpose**: Renders a single message
- Username display
- Message text with parsing
- Timestamp
- Click/context menu handlers
- Color styling

**Props**:
```typescript
interface MessageItemProps {
  comment: Comment;
  onUsernameClick: (username: string, color: string) => void;
  onContextMenu: (e: React.MouseEvent, comment: Comment, isUsername: boolean) => void;
  onTouchStart: (e: React.TouchEvent, comment: Comment, isUsername: boolean) => void;
  onTouchEnd: () => void;
  parseText: (text: string) => React.ReactNode[];
  formatTimestamp: (timestamp: number) => string;
  getCommentColor: (comment: Comment) => string;
  getDarkerColor: (color: string, opacity: number) => string;
}
```

#### 3. **AppHeader** (Lines 1395-1620)
**Purpose**: Top navigation and controls
- Title and domain filter
- Message type toggles (Humans/Entities)
- Username input and color picker
- TV toggle
- Global message count
- FilterBar
- Search bar

**Props**:
```typescript
interface AppHeaderProps {
  // Title & Domain
  title: string;
  domainFilterEnabled: boolean;
  currentDomain: string;
  onToggleDomain: () => void;
  onTitleContextMenu: (e: React.MouseEvent) => void;
  
  // Message Type Toggles
  showHumans: boolean;
  showEntities: boolean;
  onToggleHumans: () => void;
  onToggleEntities: () => void;
  
  // Username & Color
  username: string;
  userColor: string;
  hasClickedUsername: boolean;
  showColorPicker: boolean;
  randomizedColors: string[];
  onUsernameChange: (username: string) => void;
  onToggleColorPicker: () => void;
  onSelectColor: (color: string) => void;
  onClearUsername: () => void;
  usernameRef: React.RefObject<HTMLInputElement>;
  colorPickerRef: React.RefObject<HTMLDivElement>;
  usernameFlash: boolean;
  
  // Counts
  messageCount: number;
  displayedCount: number;
  
  // TV
  showVideo?: boolean;
  toggleVideo?: () => void;
  
  // FilterBar
  filterUsernames: Array<{username: string, color: string}>;
  filterWords: string[];
  negativeFilterWords: string[];
  isFilterEnabled: boolean;
  hasActiveFilters: boolean;
  dateTimeFilter?: any;
  onToggleFilter: () => void;
  onRemoveUsernameFilter: (username: string, color: string) => void;
  onRemoveWordFilter: (word: string) => void;
  onRemoveNegativeFilter: (word: string) => void;
  onClearDateTimeFilter: () => void;
  
  // Search
  searchTerm: string;
  onSearchChange: (term: string) => void;
  onClearSearch: () => void;
  
  // Mounted
  mounted: boolean;
}
```

#### 4. **MessageInput** (Lines 1767-1891)
**Purpose**: Comment submission form
- Textarea with character counter
- Send button
- "New Messages" indicator
- Scroll to bottom button
- Video link handling
- Mobile keyboard management

**Props**:
```typescript
interface MessageInputProps {
  inputText: string;
  onInputChange: (text: string) => void;
  onSubmit: (e: React.FormEvent) => Promise<void>;
  isSubmitting: boolean;
  error: string | null;
  hasNewComments: boolean;
  onScrollToBottom: () => void;
  userColor: string;
  inputRef: React.RefObject<HTMLTextAreaElement>;
  usernameRef: React.RefObject<HTMLInputElement>;
  maxLength: number;
  getCursorStyle: (text: string) => React.CSSProperties;
  handleVideoInputChange: (text: string) => void;
  handleVideoLinkClick: (showVideo: boolean, toggleVideo?: () => void) => void;
  showVideo?: boolean;
  toggleVideo?: () => void;
}
```

#### 5. **ColorPickerDropdown** (Lines 1505-1518)
**Purpose**: Color selection UI
- Grid of color swatches
- Randomized colors
- Click to select

**Props**:
```typescript
interface ColorPickerDropdownProps {
  colors: string[];
  onSelectColor: (color: string) => void;
  userColor: string;
}
```

---

## Hooks to Extract

### 1. **useMessageCounts** (Lines 133-155)
**Purpose**: Fetch and manage global/local message counts
```typescript
export function useMessageCounts() {
  const [globalCount, setGlobalCount] = useState(0);
  const [localCount, setLocalCount] = useState(0);
  
  // Fetch global count from /api/stats
  // Fetch local count from IndexedDB
  
  return { globalCount, localCount };
}
```

### 2. **useScrollRestoration** (Lines 1165-1277)
**Purpose**: Remember and restore scroll positions for filters/search
```typescript
export function useScrollRestoration(
  streamRef: React.RefObject<HTMLDivElement>,
  isFilterEnabled: boolean,
  searchTerm: string,
  showHumans: boolean,
  showEntities: boolean
) {
  // All the scroll position saving/restoring logic
  
  return {
    saveScrollPosition,
    restoreScrollPosition
  };
}
```

### 3. **useColorPicker** (Lines 906-930 + state)
**Purpose**: Color selection logic
```typescript
export function useColorPicker(initialColor: string) {
  const [userColor, setUserColor] = useState(initialColor);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [randomizedColors, setRandomizedColors] = useState<string[]>([]);
  
  const shuffleColors = () => { /* ... */ };
  const toggleColorPicker = () => { /* ... */ };
  const selectColor = (color: string) => { /* ... */ };
  
  return {
    userColor,
    userColorRgb,
    showColorPicker,
    randomizedColors,
    toggleColorPicker,
    selectColor
  };
}
```

### 4. **useMessageTypeFilters** (Lines 89-102 + 933-955)
**Purpose**: Humans/Entities toggle logic
```typescript
export function useMessageTypeFilters() {
  const [showHumans, setShowHumans] = useState(true);
  const [showEntities, setShowEntities] = useState(true);
  
  const toggleShowHumans = () => { /* ... */ };
  const toggleShowEntities = () => { /* ... */ };
  
  return {
    showHumans,
    showEntities,
    toggleShowHumans,
    toggleShowEntities
  };
}
```

### 5. **useContextMenus** (Lines 119-128 + 957-1162)
**Purpose**: Context menu state and handlers
```typescript
export function useContextMenus() {
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [titleContextMenu, setTitleContextMenu] = useState<TitleMenuState | null>(null);
  
  const handleContextMenu = (e, comment, isUsername) => { /* ... */ };
  const handleCopy = () => { /* ... */ };
  const handleSave = () => { /* ... */ };
  const handleBlock = () => { /* ... */ };
  const handleCopyAll = () => { /* ... */ };
  const handleSaveAll = () => { /* ... */ };
  
  return {
    contextMenu,
    titleContextMenu,
    setContextMenu,
    setTitleContextMenu,
    handlers: { /* ... */ }
  };
}
```

---

## Refactor Phases

### **Phase 0: Preparation and Audit** ✅
- [x] Read entire CommentsStream.tsx
- [x] Map all state variables
- [x] Map all hooks
- [x] Map all functions
- [x] Identify existing extracted components
- [x] Identify candidates for extraction

### **Phase 1: Extract Simple Display Components**
**Why first?**: These are pure presentational components with no complex logic.

**Components**:
1. **MessageItem** 
   - Single message display
   - No state, just props
   - Easy to test
   
2. **ColorPickerDropdown**
   - Pure UI component
   - No side effects
   
**Files to create**:
- `saywhatwant/components/MessageItem.tsx`
- `saywhatwant/components/ColorPickerDropdown.tsx`

**Testing**:
- Visual regression
- Click handlers work
- Colors render correctly

### **Phase 2: Extract Custom Hooks (Business Logic)**
**Why second?**: Separates logic from UI, makes testing easier.

**Hooks to extract**:
1. **useMessageCounts** → `hooks/useMessageCounts.ts`
2. **useColorPicker** → `hooks/useColorPicker.ts`
3. **useMessageTypeFilters** → `hooks/useMessageTypeFilters.ts`
4. **useScrollRestoration** → `hooks/useScrollRestoration.ts`
5. **useContextMenus** → `hooks/useContextMenus.ts`

**Testing**:
- Each hook tested in isolation
- State updates work correctly
- localStorage integration works

### **Phase 3: Extract Container Components**
**Why third?**: These orchestrate multiple hooks and components.

**Components**:
1. **MessageListContainer**
   - Uses: MessageItem, scroll logic, lazy loading
   - File: `components/MessageList/MessageListContainer.tsx`
   
2. **MessageInput**
   - Uses: video handling, submit logic, character counter
   - File: `components/MessageInput/MessageInput.tsx`
   
3. **AppHeader**
   - Uses: All header elements, FilterBar, search
   - File: `components/AppHeader/AppHeader.tsx`

**Directory Structure**:
```
components/
├── MessageList/
│   ├── MessageListContainer.tsx
│   ├── MessageItem.tsx
│   └── EmptyState.tsx
├── MessageInput/
│   ├── MessageInput.tsx
│   ├── CharCounter.tsx (maybe extract from UIElements)
│   └── ScrollToBottomButton.tsx
├── AppHeader/
│   ├── AppHeader.tsx
│   ├── ColorPickerDropdown.tsx
│   ├── MessageTypeTog gles.tsx
│   └── UsernameInput.tsx
├── FilterBar.tsx (already exists)
├── DomainFilter.tsx (already exists)
├── ContextMenu.tsx (already exists)
└── TitleContextMenu.tsx (already exists)
```

### **Phase 4: Reduce CommentsStream to Orchestrator**
**What remains in CommentsStream**:
```typescript
export default function CommentsStream() {
  // Hook integrations (orchestration)
  const filters = useFilters();
  const indexedDBFiltering = useIndexedDBFiltering();
  const modelIntegration = useCommentsWithModels();
  const submission = useCommentSubmission();
  const polling = useCommentsPolling();
  const counts = useMessageCounts();
  const colorPicker = useColorPicker();
  const messageTypes = useMessageTypeFilters();
  const scrollRestoration = useScrollRestoration();
  const contextMenus = useContextMenus();
  
  // Render components
  return (
    <div>
      <AppHeader {...headerProps} />
      <MessageListContainer {...listProps} />
      <MessageInput {...inputProps} />
      <ContextMenu {...contextMenuProps} />
      <TitleContextMenu {...titleMenuProps} />
    </div>
  );
}
```

**Target**: Reduce from 1,923 lines to ~300 lines of pure orchestration.

---

## Critical Considerations

### 1. **Legacy Filter System**
**Problem**: We have TWO filter systems running:
- `useFilters` (legacy) → operates on `initialMessages`
- `useIndexedDBFiltering` (current) → queries full IndexedDB

**Decision needed**: 
- Option A: Remove `useFilters` entirely, migrate all functionality to `useIndexedDBFiltering`
- Option B: Keep `useFilters` ONLY for UI state (add/remove filters), `useIndexedDBFiltering` for querying
- Option C: Merge both into single `useFilterSystem` hook

**Recommendation**: Option B (keep separation of concerns)
- `useFilters`: Filter STATE management (add/remove, URL sync, toggle)
- `useIndexedDBFiltering`: Filter EXECUTION (query DB, apply filters)

### 2. **Props Explosion**
**Problem**: AppHeader would have 30+ props!

**Solution**: Props grouping
```typescript
interface AppHeaderProps {
  user: {
    username: string;
    color: string;
    colorRgb: string;
    onUsernameChange: (name: string) => void;
    onColorChange: (color: string) => void;
    // ... color picker props
  };
  filters: {
    usernames: Array<{username: string, color: string}>;
    words: string[];
    negativeWords: string[];
    isEnabled: boolean;
    hasActive: boolean;
    dateTime?: any;
    onToggle: () => void;
    onRemoveUsername: (username: string, color: string) => void;
    // ... other filter handlers
  };
  search: {
    term: string;
    onChange: (term: string) => void;
    onClear: () => void;
  };
  domain: {
    enabled: boolean;
    current: string;
    onToggle: () => void;
  };
  messageTypes: {
    showHumans: boolean;
    showEntities: boolean;
    onToggleHumans: () => void;
    onToggleEntities: () => void;
  };
  counts: {
    global: number;
    displayed: number;
  };
  video: {
    shown?: boolean;
    toggle?: () => void;
  };
  mounted: boolean;
}
```

### 3. **Scroll Management Complexity**
**Problem**: Scroll restoration logic is tightly coupled with filter state.

**Solution**: Extract to `useScrollRestoration` hook
- Hook monitors filter/search state changes
- Automatically saves/restores scroll positions
- CommentsStream just provides the ref

### 4. **Mobile Keyboard Handling**
**Problem**: Lines 1280-1390 are complex mobile-specific logic.

**Solution**: Extract to separate hook `useMobileKeyboard`
```typescript
export function useMobileKeyboard(
  streamRef: React.RefObject<HTMLDivElement>,
  isNearBottom: boolean
) {
  // All the mobile keyboard adjustment logic
  // Returns nothing - pure side effects
}
```

### 5. **State Initialization**
**Problem**: Many useState with complex initializers reading localStorage.

**Solution**: Custom initialization hook
```typescript
export function useInitialState() {
  const [mounted, setMounted] = useState(false);
  
  // Load all localStorage values AFTER mount
  useEffect(() => {
    setMounted(true);
    // ... load username, color, preferences
  }, []);
  
  return { mounted, username, userColor, preferences };
}
```

---

## Migration Strategy

### Step 1: Create New Components (No Breaking Changes)
- Create all new component files
- Keep CommentsStream.tsx as-is
- New components are unused initially

### Step 2: Extract One Component at a Time
- Start with MessageItem (simplest)
- Replace inline JSX with <MessageItem />
- Test thoroughly
- Commit
- Move to next component

### Step 3: Extract Hooks One at a Time
- Start with useColorPicker (isolated)
- Replace inline logic with hook
- Test thoroughly
- Commit
- Move to next hook

### Step 4: Final Integration
- All components extracted
- All hooks extracted
- CommentsStream is now pure orchestration
- Final testing pass

---

## Testing Strategy

### Unit Tests:
- Each hook in isolation
- Each component with mock props
- Edge cases for each function

### Integration Tests:
- Filter interactions
- Search functionality
- Message submission
- Scroll behavior

### Visual Regression:
- Screenshots before/after each phase
- Ensure UI looks identical

### Performance:
- Measure render time before/after
- Check for unnecessary re-renders
- Verify IndexedDB query performance

---

## Dependencies and Props Flow

### Current Flow (Monolithic):
```
CommentsStream
├── All state (20+ variables)
├── All hooks (10+ hooks)
├── All logic (30+ functions)
└── All rendering (500+ lines JSX)
```

### Target Flow (Modular):
```
CommentsStream (orchestrator)
├── useFilters → filters
├── useIndexedDBFiltering → dbFiltering
├── useMessageCounts → counts
├── useColorPicker → colorPicker
├── useMessageTypeFilters → messageTypes
├── useScrollRestoration → (side effects only)
├── useContextMenus → menus
├── useMobileKeyboard → (side effects only)
│
├── AppHeader
│   ├── Props: user, filters, search, domain, messageTypes, counts, video
│   ├── FilterBar (already extracted)
│   ├── DomainFilter (already extracted)
│   ├── ColorPickerDropdown (new)
│   ├── UsernameInput (from UIElements)
│   └── Search input (from UIElements)
│
├── MessageListContainer
│   ├── Props: messages, loading, hasMore, events
│   └── MessageItem (new)
│       └── Props: comment, events, formatters
│
├── MessageInput
│   ├── Props: input state, submission, events
│   └── ScrollToBottomButton (maybe extract)
│
├── ContextMenu (already extracted)
└── TitleContextMenu (already extracted)
```

---

## File Changes Required

### New Files to Create:
1. `components/MessageList/MessageListContainer.tsx`
2. `components/MessageList/MessageItem.tsx`
3. `components/MessageList/EmptyState.tsx`
4. `components/MessageInput/MessageInput.tsx`
5. `components/AppHeader/AppHeader.tsx`
6. `components/AppHeader/ColorPickerDropdown.tsx`
7. `hooks/useMessageCounts.ts`
8. `hooks/useColorPicker.ts`
9. `hooks/useMessageTypeFilters.ts`
10. `hooks/useScrollRestoration.ts`
11. `hooks/useContextMenus.ts`
12. `hooks/useMobileKeyboard.ts`

### Files to Modify:
1. `components/CommentsStream.tsx` - Reduce to orchestrator
2. Maybe extract from `components/UIElements.tsx` if needed

### Files to Review:
1. `hooks/useFilters.ts` - Clarify role vs useIndexedDBFiltering
2. `hooks/useIndexedDBFiltering.ts` - Ensure clean interface

---

## Potential Issues to Watch

### 1. **Ref Passing**
Components need refs (streamRef, inputRef, usernameRef, colorPickerRef).
- Solution: Pass refs as props or use forwardRef

### 2. **Event Handler Scope**
Handlers like `addToFilter` need access to multiple hooks.
- Solution: Pass as props or create facade functions

### 3. **Circular Dependencies**
Header needs counts, counts need header rendered.
- Solution: Careful prop planning, avoid circular refs

### 4. **Performance**
Too many components could slow rendering.
- Solution: Use React.memo on pure components
- Memoize complex calculations

### 5. **State Synchronization**
Multiple components updating same state.
- Solution: Single source of truth (lift state up)
- Use Context if prop drilling gets extreme (but avoid overuse)

---

## Definition of Done

### For Each Component:
- [ ] Component file created with TypeScript
- [ ] Props interface documented
- [ ] Pure presentation (no business logic) OR clear separation
- [ ] Used in CommentsStream.tsx
- [ ] No visual regressions
- [ ] No performance regressions

### For Each Hook:
- [ ] Hook file created
- [ ] Logic extracted from CommentsStream
- [ ] Dependencies minimized
- [ ] Used in CommentsStream or components
- [ ] No functionality lost

### For Overall Refactor:
- [ ] CommentsStream.tsx under 300 lines
- [ ] All tests passing
- [ ] No console errors
- [ ] Search/filter working identically
- [ ] Message submission working
- [ ] Scroll behavior unchanged
- [ ] Mobile experience unchanged
- [ ] Performance same or better

---

## Timeline Estimate

### Phase 1: Simple Components (1-2 hours)
- MessageItem
- ColorPickerDropdown
- EmptyState

### Phase 2: Custom Hooks (2-3 hours)
- useMessageCounts
- useColorPicker
- useMessageTypeFilters
- useScrollRestoration
- useContextMenus
- useMobileKeyboard

### Phase 3: Container Components (3-4 hours)
- MessageListContainer
- MessageInput
- AppHeader

### Phase 4: Integration and Testing (2-3 hours)
- Wire everything together
- Remove old code
- Test all functionality
- Fix any regressions

**Total**: 8-12 hours of focused development

---

## Success Metrics

### Code Quality:
- Lines per file < 300
- Cyclomatic complexity < 10 per function
- Props count < 10 per component (use grouping)

### Maintainability:
- Each component has single responsibility
- Easy to find where functionality lives
- Can modify one component without touching others

### Performance:
- Initial render time unchanged
- Re-render count same or fewer
- Memory usage unchanged

### User Experience:
- No visual changes (unless bugs fixed)
- No behavior changes (unless bugs fixed)
- All existing features work identically

---

## Notes for Implementation

### Remember:
1. **Think, Then Code** - Plan each extraction carefully
2. **One Component at a Time** - Don't try to do everything at once
3. **Test After Each Change** - Verify nothing broke
4. **Commit Frequently** - Each working component gets a commit
5. **Props Over Context** - Avoid Context API unless absolutely needed

### Avoid:
1. **Big Bang Rewrites** - Incremental changes only
2. **Over-Engineering** - Don't add unnecessary abstractions
3. **Breaking Working Code** - If it works, be careful
4. **Skipping Tests** - Verify each extraction works

### When in Doubt:
1. Look at existing extracted components (FilterBar, DomainFilter)
2. Keep it simple - pure components with clear props
3. Ask questions before making big changes
4. Document why you made decisions

---

## Current Issues to Address During Refactor

### 1. **React Errors #418 and #423**
These are happening during initial render. The refactor might help by:
- Separating initialization logic
- Clearer component lifecycle
- Better mount guards

### 2. **Double Filtering Legacy**
`useFilters` operates on `initialMessages`, `useIndexedDBFiltering` operates on full DB.
- Clean up this relationship
- Make it explicit which is for what

### 3. **initialMessages Confusion**
This state variable is poorly named and causes confusion.
- Rename to `browseMessages` or `recentMessages`
- Make purpose crystal clear

---

## Phase 0: COMPLETE ✅

I've completed the analysis. Ready to proceed when you approve.

**Key Findings**:
1. CommentsStream is doing too much (1,923 lines)
2. We have good hooks already (useIndexedDBFiltering, useCommentsWithModels)
3. Some components already extracted (FilterBar, ContextMenu)
4. Clear path to ~300 line orchestrator
5. Estimated 8-12 hours of careful, incremental work

**Recommendation**: Proceed with Phase 1 (MessageItem + ColorPickerDropdown) as proof of concept.

