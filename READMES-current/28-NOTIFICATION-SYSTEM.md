# Audio Notification System for Filters

## Overview
A sophisticated notification system that plays sounds when new messages match your filters, with visual feedback via bold filter items.

## Features

### 🔊 Sound Options
Each filter can have its own notification sound:
- **Silent** (Ban icon) - Default, no sound
- **Delightful** (Sparkles icon) - Pleasant chime
- **Gamer** (Gamepad icon) - Gaming-style alert
- **Hello** (Hand icon) - Friendly greeting sound
- **Horn** (Volume icon) - Attention-grabbing horn
- **Subtle** (Music icon) - Soft notification

### 📌 How It Works

#### Setting Up Notifications
1. Add filters to the filter bar (usernames or words)
2. Enable the filter bar (must be active for notifications)
3. Right-click on any filter item
4. Select a sound from the context menu
5. The selected sound icon appears next to the filter

#### When Messages Arrive
1. New messages are checked against active filters
2. If a match is found and sound is enabled:
   - The notification sound plays
   - The filter becomes **bold** in the filter bar
3. Multiple matches play sounds in order with 1-second cooldown
4. Hovering over a bold filter marks it as "read" (unbold)

### 🎯 Important Notes
- **Filter bar must be active** for notifications to work
- **Negative filters** (-word) do NOT have notifications
- Only positive filters can trigger sounds
- Respects device volume and mute settings

## Technical Implementation

### Architecture
Following the "Think, Then Code" philosophy:

```
notification-system.ts     → Core sound management
FilterNotificationMenu.tsx → Context menu UI
FilterBar.tsx             → Visual feedback (bold/unbold)
CommentsStream.tsx        → Match detection logic
```

### Sound Management
```typescript
class NotificationSystem {
  // Singleton pattern for global sound control
  // Preloads all audio files for instant playback
  // Manages cooldown between sounds
  // Handles sound queue for multiple matches
}
```

### Cooldown System
- **1 second minimum** between any sounds
- Prevents audio spam from rapid messages
- Queues sounds if multiple arrive quickly
- Plays them in order with proper spacing

### Storage
All preferences saved to localStorage:
```javascript
localStorage['sww-filter-notifications'] = {
  "username:rgb(255,0,0)": {
    sound: "delightful",
    isUnread: false
  },
  "keyword:rgb(0,255,0)": {
    sound: "horn",
    isUnread: true  // Bold in UI
  }
}
```

## User Experience

### Visual Feedback
- **Sound Icon**: Shows next to filter when enabled
- **Bold Filter**: Indicates unread notification
- **Box Shadow**: Colored outline when unread
- **Hover Effect**: Returns to normal on mouseover

### Interaction Flow
```
1. User adds filter → Default silent (no icon)
2. Right-click filter → Context menu appears
3. Select sound → Icon appears, sound enabled
4. New match arrives → Sound plays, filter bolds
5. User hovers filter → Returns to normal
```

### Multiple Matches
When a message matches multiple filters:
1. Collect all matching filter sounds
2. Remove duplicates and 'none' sounds
3. Play in alphabetical order
4. 1-second gap between each sound

## Console Logging
```
[Notification] Played sound: delightful
[Notification] Updated DeepThought:rgb(128,0,255) to use sound: horn
[Notification] Failed to play sound gamer: DOMException
[Filter] Marked as unread: keyword:rgb(255,255,255)
```

## Browser Compatibility
- Uses standard HTML5 Audio API
- Fallback for browsers without audio support
- Handles autoplay restrictions gracefully
- Works on desktop and mobile devices

## Performance Considerations
- Audio files preloaded on initialization
- Only checks messages when filters active
- Event delegation for efficient re-renders
- Minimal localStorage reads/writes

## Future Enhancements
Potential additions:
- Volume control per sound
- Custom sound uploads
- Sound preview on hover
- Notification history log
- Sound categories/themes
- Keyboard shortcuts for sound selection
- Visual notification badges with count
- Different sounds for different filter types

## Philosophy Notes
This feature exemplifies the core principles:
- **Simple**: Right-click to set sound
- **Strong**: Handles edge cases gracefully  
- **Solid**: Scales to many filters/messages
- **User First**: Non-intrusive, fully optional
- **Logic Over Rules**: Smart cooldown management

## Files Modified
- `modules/notificationSystem.ts` - Core module
- `components/FilterNotificationMenu.tsx` - Menu UI
- `components/FilterBar.tsx` - Filter UI updates
- `components/CommentsStream.tsx` - Match detection
- `public/sww-sfx/` - Sound files directory

---

*"We shape our tools, and thereafter they shape us. Make notifications that enhance, not annoy."*
