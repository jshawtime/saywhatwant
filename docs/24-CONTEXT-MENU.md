# Context Menus for Messages and Title

## Overview
Right-click on messages or the app title to access contextual menus with quick actions.

## Message Context Menu

Right-click (desktop) or long-press (mobile) on any message for individual message actions.

### Features

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

## Title Context Menu

Right-click on the app title (e.g., "Say What Want") to access bulk actions for all visible messages.

### Features

### Copy ALL
- Copies ALL visible messages in the window to clipboard
- Includes header with title, export time, and message count
- Each message formatted with username, timestamp, and text
- Preserves chronological order

### Save ALL
- Downloads ALL visible messages as a text file
- Filename: `saywhatwant_[domain]_[timestamp].txt`
- Includes formatted header with metadata
- Perfect for archiving conversations or sharing

### Visual Design
- Text-only menu (no icons)
- Clean, minimal design
- Consistent with app styling

### Format Example
```
Say What Want - [Domain Title]
Exported: 12/25/2024, 3:45:23 PM
Total Messages: 127
==================================================

JohnDoe (12/25/2024, 3:30:15 PM):
Hello everyone!

Jane123 (12/25/2024, 3:31:42 PM):
Hey there!

[... continues for all messages ...]
```

## Visual Design (Message Menu)

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

### Message Context Menu
- `[Context Menu] Copied message to clipboard`
- `[Context Menu] Saved message as: [filename]`
- `[Context Menu] Blocked user: [username]`
- `[Context Menu] Blocked word: [word]`

### Title Context Menu
- `[Title Context Menu] Copied 127 messages to clipboard`
- `[Title Context Menu] Saved 127 messages as: saywhatwant_domain_2024-12-25T15-45.txt`

## Accessibility
- All buttons have proper `aria-label` attributes
- Keyboard accessible (ESC to close)
- Clear visual feedback on hover/interaction

## Browser Compatibility
- Modern browsers: Full support
- Older browsers: Graceful fallback for clipboard
- Mobile browsers: Touch events fully supported
- Haptic feedback: Progressive enhancement
