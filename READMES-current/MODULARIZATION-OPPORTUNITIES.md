# CommentsStream.tsx Modularization Opportunities

## Features That Should Be Extracted into Modules

### 1. **Timestamp System** (`/modules/timestampSystem.ts`)
Currently lines 230-258 in CommentsStream.tsx
```typescript
// Functions to extract:
- formatTimestamp(timestamp: number): string
- getRelativeTime(date: Date): string
- formatDateRange(start: Date, end: Date): string
```
**Benefits**: Reusable across any component showing timestamps, consistent formatting

### 2. **Video Sharing System** (`/modules/videoSharingSystem.ts`)
Currently scattered across lines 136-161, 506-508, 945-976
```typescript
// State and functions to extract:
- usePendingVideo() hook
- handleVideoShare()
- insertVideoLink()
- validateVideoKey()
```
**Benefits**: Complex feature isolated, easier to test, reusable for other media types

### 3. **Storage Manager** (`/modules/storageManager.ts`)
Currently lines 261-289
```typescript
// Functions to extract:
- loadComments()
- saveComments()
- clearOldComments()
- migrateStorageFormat()
```
**Benefits**: Centralized storage logic, easier migration paths, consistent data handling

### 4. **Cloud API Client** (`/modules/cloudApiClient.ts`)
Currently lines 291-319, 518-541
```typescript
// Functions to extract:
- fetchComments()
- postComment()
- deleteComment()
- updateComment()
```
**Benefits**: Single source of truth for API calls, easier to mock for testing

### 5. **Polling System** (`/modules/pollingSystem.ts`)
Currently lines 383-482
```typescript
// Custom hook:
- usePolling(callback, interval, dependencies)
- useStorageListener(key, callback)
- useSmartPolling() // with exponential backoff
```
**Benefits**: Reusable polling logic, performance optimizations, easier debugging

### 6. **Comment Submission Handler** (`/modules/commentSubmission.ts`)
Currently lines 484-588
```typescript
// Functions to extract:
- validateComment()
- prepareCommentData()
- submitComment()
- handleSubmissionError()
```
**Benefits**: Validation logic separated, easier to add new submission rules

### 7. **Lazy Loading System** (`/modules/lazyLoadingSystem.ts`)
Currently lines 590-609, scroll handling
```typescript
// Custom hook:
- useLazyLoad(items, batchSize)
- useInfiniteScroll(loadMore)
- useVirtualScroll() // for future optimization
```
**Benefits**: Performance optimization, reusable for other lists

### 8. **Keyboard Shortcuts Manager** (`/modules/keyboardShortcuts.ts`)
Currently lines 181-213
```typescript
// Custom hook:
- useKeyboardShortcuts(shortcuts: ShortcutMap)
- registerGlobalShortcut()
- unregisterShortcut()
```
**Benefits**: Centralized keyboard handling, no conflicts, easy to document

### 9. **Auto-scroll Manager** (`/modules/autoScrollManager.ts`)
Currently scattered throughout
```typescript
// Functions:
- scrollToBottom()
- scrollToTop()
- isNearBottom()
- smoothScroll()
- useAutoScroll()
```
**Benefits**: Consistent scroll behavior, better UX

### 10. **Comment Parser** (`/modules/commentParser.ts`)
Currently using parseCommentText from utils
```typescript
// Enhanced parsing:
- parseLinks()
- parseMentions()
- parseEmojis()
- parseMarkdown()
- sanitizeInput()
```
**Benefits**: Extensible parsing, security improvements

## Priority Order for Extraction

1. **Cloud API Client** - Critical for maintainability
2. **Storage Manager** - Core functionality
3. **Keyboard Shortcuts** - Easy win, improves UX consistency
4. **Timestamp System** - Simple extraction, high reusability
5. **Polling System** - Performance critical
6. **Video Sharing** - Complex but isolated feature
7. **Comment Submission** - Tied to many parts
8. **Lazy Loading** - Performance optimization
9. **Auto-scroll** - Nice to have
10. **Comment Parser** - Future enhancement

## Implementation Strategy

### Phase 1: Core Infrastructure (v0.2)
- Cloud API Client
- Storage Manager
- Timestamp System

### Phase 2: UX Enhancements (v0.3)
- Keyboard Shortcuts
- Polling System
- Auto-scroll Manager

### Phase 3: Advanced Features (v0.4)
- Video Sharing System
- Comment Submission Handler
- Lazy Loading System

### Phase 4: Future Enhancements (v0.5+)
- Enhanced Comment Parser
- Virtual Scrolling
- Offline Support Module

## Benefits of Modularization

1. **Testability**: Each module can be unit tested independently
2. **Reusability**: Features can be used in other components
3. **Maintainability**: Bugs are easier to locate and fix
4. **Performance**: Lazy load modules only when needed
5. **Documentation**: Each module has clear responsibilities
6. **Team Collaboration**: Different developers can work on different modules

## Current File Size Issue

`CommentsStream.tsx` is currently **1012 lines** - way too large!
After modularization, target: **< 300 lines** for the main component.
