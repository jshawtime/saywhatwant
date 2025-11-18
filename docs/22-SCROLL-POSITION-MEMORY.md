# Scroll Position Memory

## Overview
The application now remembers your scroll position when toggling filters and clearing search, providing a seamless user experience that maintains context.

## Features

### Filter Toggle Memory
- **When activating filters**: Saves your current scroll position
- **When deactivating filters**: Returns you to the exact position you were at before filtering
- **Purpose**: Maintains reading context when exploring filtered views

### Search Memory
- **When starting a search**: Saves your current scroll position
- **When clearing search**: Returns you to the exact position you were at before searching
- **Purpose**: Allows quick searches without losing your place in the message stream

## Technical Implementation

### State Management
```javascript
// Scroll position memory states
const [savedScrollPosition, setSavedScrollPosition] = useState<number | null>(null);
const [savedSearchScrollPosition, setSavedSearchScrollPosition] = useState<number | null>(null);
```

### Filter Toggle Logic
```javascript
if (isFilterEnabled) {
  // Save position when filters turn ON
  setSavedScrollPosition(streamRef.current.scrollTop);
} else if (savedScrollPosition !== null) {
  // Restore position when filters turn OFF
  streamRef.current.scrollTop = savedScrollPosition;
}
```

### Search Logic
```javascript
if (searchTerm && !savedSearchScrollPosition) {
  // Save position when search starts
  setSavedSearchScrollPosition(streamRef.current.scrollTop);
} else if (!searchTerm && savedSearchScrollPosition !== null) {
  // Restore position when search clears
  streamRef.current.scrollTop = savedSearchScrollPosition;
}
```

## User Experience Benefits

1. **Context Preservation**: Users never lose their reading position
2. **Smooth Workflow**: Quick filtering/searching without disruption
3. **Intuitive Behavior**: Returns you exactly where you left off
4. **Zero Learning Curve**: Works automatically, no user action required

## Console Logging
For debugging, the following logs are available:
- `[Scroll] Saved scroll position before filter activation: [position]`
- `[Scroll] Restored scroll position after filter deactivation: [position]`
- `[Scroll] Saved scroll position before search: [position]`
- `[Scroll] Restored scroll position after search cleared: [position]`

## Browser Compatibility
Uses standard DOM `scrollTop` property - compatible with all modern browsers.
