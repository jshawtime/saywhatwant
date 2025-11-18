# Message Display Limit & Dynamic Expansion

## Overview
The application starts with 500 messages displayed, but intelligently expands this limit as users explore message history via lazy loading, ensuring they never lose context.

## Configuration

```javascript
const MAX_DISPLAY_MESSAGES = 500;      // Base messages shown at once
const INDEXEDDB_INITIAL_LOAD = 500;    // Initial load from IndexedDB
const INDEXEDDB_LAZY_LOAD_CHUNK = 100; // Load 100 more when scrolling up
const HEADROOM = 50;                    // Extra buffer for smooth operation
```

## Dynamic Limit Formula

```javascript
dynamicMax = 500 + (lazyLoadedMessages) + 50
```

## Features

### 1. Dynamic Message Limit
- **Initial load/refresh**: 500 messages (newest)
- **First lazy load**: Expands to 650 messages (500 + 100 + 50)
- **Second lazy load**: Expands to 750 messages (500 + 200 + 50)
- **Continues expanding**: As user scrolls through history
- **Reset on refresh**: Back to 500 newest messages

### 2. Smart Expansion Algorithm

```javascript
// When lazy loading:
const newLazyLoadedCount = lazyLoadedCount + loadCount;
const newDynamicMax = MAX_DISPLAY_MESSAGES + newLazyLoadedCount + 50;
setDynamicMaxMessages(newDynamicMax);

// Messages are ADDED, not replaced!
```

### 3. Trimming Behavior
- Only trims when exceeding the CURRENT dynamic limit
- When new messages arrive, respects expanded limit
- Never loses messages you've scrolled to see
- Maintains full context during browsing session

## User Experience

### For New Messages
1. New messages arrive via polling
2. Added to the message list
3. If total exceeds current dynamic limit, oldest messages are removed
4. User sees the most recent conversation + their explored history

### For Scrolling History
1. User scrolls to top of message list
2. "Load more messages" button appears
3. Click or scroll loads 100 older messages
4. **Messages are ADDED** - nothing is removed!
5. Dynamic limit increases to accommodate all messages
6. User never loses context or messages they've seen

## Performance Benefits

### Memory Management
- **Before**: Unlimited messages could consume excessive memory
- **After**: Fixed 500 message limit keeps memory usage predictable

### Rendering Performance
- **Before**: Thousands of DOM nodes could slow scrolling
- **After**: Maximum 500 DOM nodes ensures smooth scrolling

### Load Time
- **Before**: Initial load could be slow with many messages
- **After**: Fast initial load with lazy loading for history

## Technical Implementation

### Where Trimming Occurs
1. **Initial load**: From IndexedDB and cloud API
2. **New messages**: During polling updates
3. **User posts**: When adding optimistic updates
4. **Server searches**: When loading filtered results
5. **Lazy loading**: When loading older messages

### Console Logging
```
[Init] Reset message limit to default: 500
[Lazy Load] Expanding message limit: 500 → 650 (loaded 100 extra messages)
[Lazy Load] Expanding message limit: 500 → 750 (loaded 200 extra messages)
[IndexedDB] Added 100 older messages (1850 remaining in storage)
[Trim] Kept newest 750 messages (dynamic limit), removed 23 older ones
```

## IndexedDB Storage
- IndexedDB still stores ALL messages (up to 1GB)
- Display starts at 500, expands as needed
- Full history is preserved locally
- Lazy loading accesses the complete history
- Session state: expanded limit persists until refresh

## Configuration Options

To change the limits, modify these constants in `CommentsStream.tsx`:
```javascript
const MAX_DISPLAY_MESSAGES = 500;      // Change display limit
const INDEXEDDB_LAZY_LOAD_CHUNK = 100; // Change lazy load size
```

## Edge Cases Handled

1. **Rapid message influx**: Respects current dynamic limit
2. **Duplicate prevention**: Message IDs ensure no duplicates
3. **Scroll position**: Preserved during all operations
4. **Filter/search**: Dynamic limit persists through filtering
5. **Mixed sources**: Handles IndexedDB + cloud messages properly
6. **Context preservation**: Never loses messages you've scrolled to see
7. **Session persistence**: Expanded limit maintained until refresh

## Future Enhancements

Potential improvements:
- Make limits configurable via settings
- Virtual scrolling for even better performance
- Progressive loading based on scroll speed
- Message compression for IndexedDB storage
