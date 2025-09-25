# Context Menu for Messages

## Overview
Right-click (desktop) or long-press (mobile) on any message to access a sleek contextual menu with quick actions.

## Features

### 📋 Copy
- Copies the username, timestamp, and message to clipboard
- Format: `Username (Date/Time):\nMessage text`
- Fallback for older browsers that don't support Clipboard API

### 💾 Save
- Downloads a text file containing the message
- Filename: `message_[username]_[timestamp].txt`
- Includes username, date/time, and full message text

### 🚫 Block (Context-Aware)
- **Right-click on username**: Blocks that username
- **Right-click on message text**: 
  - If text is selected: Blocks the selected word
  - If no selection: Blocks the username
- Message/word immediately disappears if filters are active
- Does NOT change the filter toggle state (as per current behavior)
- Tooltip shows what will be blocked: "Block user: X" or "Block word: Y"

## User Experience

### Desktop
- **Right-click** on any message or username
- Context menu appears at cursor position
- Click any icon to perform action
- Click outside or press ESC to dismiss
- **Tip**: Select specific text before right-clicking to block just that word

### Mobile
- **Long-press** (500ms) on any message or username
- Haptic feedback when menu appears (if supported)
- Tap any icon to perform action
- Tap outside to dismiss
- **Tip**: Select text first, then long-press to block specific words

## Visual Design

### Icons
- Uses lucide-react icons for consistency
- Minimalist design with 16px icons
- Copy (clipboard icon)
- Download (download icon)  
- Ban (prohibition icon)

### Styling
- Dark glass-morphism background (`bg-black/90 backdrop-blur-sm`)
- Subtle borders (`border-gray-800`)
- Smooth hover transitions
- Gray icons that turn white on hover
- Block icon turns red on hover

### Positioning
- Automatically adjusts to stay on screen
- Appears at cursor/touch position
- Z-index 50 to stay above all content

## Technical Implementation

### Event Handling
```javascript
// Right-click
onContextMenu={(e) => handleContextMenu(e, comment)}

// Long-press (mobile)
onTouchStart={(e) => handleTouchStart(e, comment)}
onTouchEnd={handleTouchEnd}
onTouchMove={handleTouchEnd} // Cancel on drag
```

### Long Press Detection
- 500ms timer for long press
- Cancelled if user moves finger
- Provides haptic feedback when triggered

### Clipboard Integration
```javascript
// Modern API with fallback
if (navigator.clipboard) {
  navigator.clipboard.writeText(text);
} else {
  // Fallback using textarea
}
```

### File Download
```javascript
const blob = new Blob([content], { type: 'text/plain' });
const url = URL.createObjectURL(blob);
// Create download link and trigger
```

## Console Logging
- `[Context Menu] Copied message to clipboard`
- `[Context Menu] Saved message as: [filename]`
- `[Context Menu] Blocked user: [username]`
- `[Context Menu] Blocked word: [word]`

## Accessibility
- All buttons have proper `aria-label` attributes
- Keyboard accessible (ESC to close)
- Clear visual feedback on hover/interaction

## Browser Compatibility
- Modern browsers: Full support
- Older browsers: Graceful fallback for clipboard
- Mobile browsers: Touch events fully supported
- Haptic feedback: Progressive enhancement
