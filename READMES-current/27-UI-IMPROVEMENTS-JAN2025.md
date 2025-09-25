# UI Improvements - January 2025

## Dynamic Tooltips for Humans/Entities Buttons

### Behavior
- **When ON**: Tooltip shows "Hide human messages" / "Hide entity messages"
- **When OFF**: Tooltip shows "Show human messages" / "Show entity messages"

### Implementation
```jsx
title={showHumans ? "Hide human messages" : "Show human messages"}
title={showEntities ? "Hide entity messages" : "Show entity messages"}
```

## Scroll Position Memory

### Consistent Behavior Across All Filters
All filter toggles now remember and restore scroll position:

1. **Domain Filter** ✅
2. **Username/Word Filters** ✅  
3. **Search Bar** ✅
4. **Humans Filter** ✅ (NEW)
5. **Entities Filter** ✅ (NEW)

### How It Works
1. When hiding messages → saves current scroll position
2. When showing messages again → restores saved position
3. User stays exactly where they were in the conversation

### Console Logging
```
[Scroll] Saved scroll position before hiding humans: 2450
[Scroll] Restored scroll position after showing humans: 2450
```

## Scroll to Bottom Button

### Location
- Positioned **left of the send button** in the message input area
- Always visible for quick access

### Visual Design
- **Icon**: ChevronDown (↓)
- **Color**: Inherits user color at 50% opacity
- **Hover**: 80% opacity on hover
- **Tooltip**: "Jump to latest messages"

### Functionality
```javascript
onClick={() => {
  smoothScrollToBottom(false); // Instant scroll
  setHasNewComments(false);    // Clear notification
}}
```

## Send Button Positioning Fix

### Before
- Position: `top-6` (measured from top of input area)
- Problem: Too high, not vertically centered

### After  
- Position: `bottom-2` (measured from bottom of input area)
- Result: Properly centered between character counter and input bottom
- Matches the new scroll-to-bottom button alignment

## Button Layout in Input Area

```
[Character Counter]
                    [Input Text Area]
                              [↓] [→]
                              ^    ^
                              |    |
                    Scroll to Bottom  Send
```

## CSS Classes Applied

### Scroll to Bottom Button
```css
absolute bottom-2 right-10 p-1 rounded 
transition-all z-10 hover:opacity-80 cursor-pointer
```

### Send Button (Updated)
```css
absolute bottom-2 right-2 p-1 rounded 
transition-all z-10
```

## User Experience Improvements

1. **Clear Visual Feedback**: Tooltips change based on state
2. **Context Preservation**: Never lose your place when toggling filters  
3. **Quick Navigation**: Jump to latest messages with one click
4. **Better Alignment**: Send button properly centered
5. **Consistent Behavior**: All filters work the same way

## Technical Notes

- Scroll positions stored in React state (not localStorage)
- Uses `requestAnimationFrame` for smooth scroll restoration
- Positions cleared after restoration to prevent stale data
- All buttons respect user's chosen color scheme
