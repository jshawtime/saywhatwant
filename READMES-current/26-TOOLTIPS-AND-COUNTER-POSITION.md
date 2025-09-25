# Tooltips and Message Counter Position Updates

## Overview
This document details the message counter positioning fix and comprehensive tooltip updates across the application interface.

## Message Counter Position Fix

### Problem
The message counter was cramped between the user icon and username input, making it feel squeezed.

### Solution
Moved the counter to the far left of the username section for better visual hierarchy.

### Layout Order (Left to Right)
1. **Message counter** (far left with proper spacing)
2. **Username input** (with color icon unchanged)  
3. **TV toggle button**

### Styling
```jsx
<span className="text-xs mr-2 opacity-60" style={{ color: userColor }}>
  {formatNumber(messageCount)}
</span>
```

## Native Tooltips

### 1. Words in Message Window
**Element**: Message text content  
**Tooltip**: `"Click to filter by word | Right click more options"`

**Behavior**:
- Click on word → Adds word to filter
- Right-click → Opens context menu with Copy/Save/Block options

### 2. Username Buttons
**Element**: Username in each message  
**Tooltip**: `"Click to filter by [username] | Right click more options"`

**Behavior**:
- Click → Adds username to filter with their color
- Right-click → Opens context menu with Copy/Save/Block options
- Dynamic tooltip shows actual username

### 3. Domain Title (App Title)
**Element**: Main title at top of page  
**Tooltip**: 
- When domain filter ON: `"Messages from this website | Right click more options"`
- When domain filter OFF: `"Global message stream | Right click more options"`

**Behavior**:
- Shows current filtering state
- Right-click → Opens menu with "Copy ALL" and "Save ALL" options

### 4. Message Counter
**Element**: Small counter next to username input  
**Tooltip**: `"Total global messages"`

**Behavior**:
- Shows simplified tooltip (no number in tooltip)
- Number visible in the counter itself
- Updates every 5 minutes

## Visual Design Principles

### Tooltip Consistency
All interactive elements now have clear tooltips that:
1. Explain the primary click action
2. Indicate right-click availability
3. Use consistent pipe separator format

### Information Hierarchy
```
Primary Action | Secondary Options
```

### Dynamic Context
Tooltips adapt based on:
- Current filter state (domain title)
- Actual content (username)
- User interaction patterns

## Implementation Details

### Code Locations
- **Message text**: Line ~1443 in CommentsStream.tsx
- **Username button**: Line ~1426 in CommentsStream.tsx  
- **Domain title**: Line ~1169 in CommentsStream.tsx
- **Message counter**: Line ~1198 in CommentsStream.tsx

### Tooltip Attributes
```jsx
// Word in message
title="Click to filter by word | Right click more options"

// Username button (dynamic)
title={`Click to filter by ${comment.username || 'Anonymous'} | Right click more options`}

// Domain title (conditional)
title={domainFilterEnabled 
  ? "Messages from this website | Right click more options" 
  : "Global message stream | Right click more options"}

// Message counter
title="Total global messages"
```

## User Experience Benefits

### Discoverability
- Users can hover to understand functionality
- Clear indication of right-click features
- Consistent interaction patterns

### Context Awareness
- Tooltips provide immediate context
- Dynamic content shows current state
- Reduces need for documentation

### Accessibility
- Native tooltips work with screen readers
- Clear, concise language
- Standard keyboard navigation support

## Console Logging
No new console logs added for tooltips (native browser feature).

## Testing
To verify tooltips:
1. Hover over any username → See filtering hint
2. Hover over message text → See word filtering hint
3. Hover over app title → See current stream state
4. Hover over counter → See "Total global messages"

## Future Enhancements
Potential improvements:
- Add keyboard shortcut hints to tooltips
- Include timestamp tooltips with relative time
- Add filter state indicators in tooltips
- Consider tooltip delay customization
