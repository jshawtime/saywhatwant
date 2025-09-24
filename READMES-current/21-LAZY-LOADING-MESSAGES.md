# Lazy Loading for IndexedDB Messages

## Overview
The application now implements lazy loading for messages stored in IndexedDB to improve performance when dealing with large message histories.

## Key Features

### Initial Load
- **500 messages** loaded from IndexedDB on page refresh
- Plus the **latest 50 messages** from cloud API
- Intelligently merged to avoid duplicates

### Lazy Loading
- **100 messages** loaded per chunk when scrolling up
- Auto-triggers when scrolling within 100px of the top
- Manual "Load More" button also available
- Visual loading indicator during fetch

## Implementation Details

### Configuration
```javascript
const INDEXEDDB_INITIAL_LOAD = 500;    // Initial messages from IndexedDB
const INDEXEDDB_LAZY_LOAD_CHUNK = 100; // Messages per lazy load
```

### How It Works

1. **On Page Load**:
   - Load ALL messages from IndexedDB into memory
   - Display only the most recent 500
   - Track offset for lazy loading

2. **When Scrolling Up**:
   - Detect when user is near top (< 100px)
   - Load next 100 older messages
   - Prepend to message list maintaining order
   - Update offset tracker

3. **Visual Feedback**:
   - "Load X more messages" button at top
   - "Loading more messages..." indicator
   - Button shows remaining count

### State Management
```javascript
// Tracks position in IndexedDB message array
const [indexedDbOffset, setIndexedDbOffset] = useState(0);

// Whether more messages are available
const [hasMoreInIndexedDb, setHasMoreInIndexedDb] = useState(false);

// Loading state for UI feedback
const [isLoadingMoreFromIndexedDb, setIsLoadingMoreFromIndexedDb] = useState(false);

// All messages stored in memory for lazy loading
const allIndexedDbMessages = useRef<Comment[]>([]);
```

## Fixed Issues

### 1. Polling Reset Bug
**Problem**: When new messages arrived, the view would reset to only show 50 messages
**Solution**: Changed polling to append new messages instead of replacing the entire list

### 2. Performance Issue
**Problem**: Loading all IndexedDB messages at once (potentially thousands) caused lag
**Solution**: Implemented lazy loading with configurable chunk sizes

## User Experience

### Before:
- All messages loaded at once (slow)
- Polling would reset view to 50 messages
- Poor performance with large histories

### After:
- Fast initial load (500 messages)
- Smooth lazy loading on scroll
- Messages persist when new ones arrive
- Better performance with large histories

## Console Output
```
[IndexedDB] Loaded 500 of 2847 messages (more available)
[IndexedDB] Loaded 100 more messages (2247 remaining)
[IndexedDB] Loaded 100 more messages (2147 remaining)
```

## Future Improvements

Potential enhancements:
1. **Virtual Scrolling**: Only render visible messages
2. **Infinite Scroll Both Ways**: Load newer messages when scrolling down
3. **Jump to Date**: Quick navigation to specific time periods
4. **Configurable Chunk Size**: Let users choose how many to load
