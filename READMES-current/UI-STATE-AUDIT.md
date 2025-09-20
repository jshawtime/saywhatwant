# UI Element State Audit - v0.1.7

## State Management Overview

| UI Element | Initial State | localStorage Key | Priority Order | Issues Found |
|------------|--------------|------------------|----------------|--------------|
| **Video Toggle** | `false` | `sww-show-video` | 1. localStorage<br>2. default (`false`) | ✅ Correct |
| **Username Field** | `''` (empty) | `sww-username` | 1. localStorage<br>2. default (empty) | ✅ Correct |
| **User Color** | `rgb(96, 165, 250)` | `sww-color` | 1. localStorage<br>2. default (blue) | ✅ Correct - Also converts old hex to RGB |
| **Filter Switch** | `false` | `sww-filter-enabled` | 1. localStorage<br>2. URL filters present<br>3. default (`false`) | ⚠️ **FIXED** - Was incorrectly enabling on refresh |
| **Filter Usernames** | `[]` (empty) | `sww-filter-usernames` | 1. localStorage<br>2. URL params<br>3. default (empty) | ✅ Correct |
| **Filter Words** | `[]` (empty) | `sww-word-filters` | 1. localStorage<br>2. URL params<br>3. default (empty) | ✅ Correct |
| **Negative Filters** | `[]` (empty) | `sww-negative-filters` | 1. localStorage<br>2. URL params<br>3. default (empty) | ✅ Correct |
| **Domain Filter** | `false` | `sww-domain-filter` | 1. localStorage<br>2. default (`false`) | ✅ Correct |
| **Search Term** | `''` (empty) | N/A (URL only) | 1. URL params<br>2. default (empty) | ✅ Correct |
| **Color Picker** | `false` (hidden) | N/A | Always starts hidden | ✅ Correct |

## Hardcoded Values Found

### Filter Switch Colors (FilterBar.tsx)
- **Line 189-191**: Background color when active uses `OPACITY_LEVELS.DARK * 0.875` (35%)
- **Line 191**: ⚠️ **FIXED** - Background when inactive was using opacity level, now using `rgba(0, 0, 0, 0.8)`
- **Line 192**: Border color uses `OPACITY_LEVELS.DARK` (40%)
- **Line 200**: Circle color when disabled uses `OPACITY_LEVELS.DARKER` (20%)

### Title Text (CommentsStream.tsx)
- **Line 697**: ⚠️ **FIXED** - Was using `OPACITY_LEVELS.DARK`, now using direct `0.4` for active, `0.25` for inactive
- No glow effect - only opacity changes

### Domain LED (DomainFilter.tsx)
- **Line 36**: Glow effect uses `OPACITY_LEVELS.LIGHT` (60%)
- **Line 48**: LED core when active uses `OPACITY_LEVELS.LIGHT` (60%)
- **Line 49**: LED when inactive uses hardcoded `rgba(255,255,255,0.2)`

### TV Toggle (CommentsStream.tsx)
- **Line 789**: Active color uses `OPACITY_LEVELS.LIGHT` (60%)
- **Line 791**: Inactive opacity uses `OPACITY_LEVELS.MEDIUM` (50%)

### Send Button (CommentsStream.tsx)
- **Line 945**: Disabled opacity uses hardcoded `0.30` (should use OPACITY_LEVELS)
- **Line 949**: Color uses direct `userColor`

## Recommendations

1. **Filter Switch Background**: Now using nearly black (`rgba(0, 0, 0, 0.8)`) when inactive for better visibility
2. **Filter Switch Border**: Added border with 40% opacity for visibility
3. **Title Text**: Removed reference to OPACITY_LEVELS to prevent any visual artifacts
4. **Send Button**: Consider using `OPACITY_LEVELS.DARK` instead of hardcoded `0.30`

## localStorage Keys Summary

```javascript
// All localStorage keys used in the app
const STORAGE_KEYS = {
  // User preferences
  'sww-username': 'string',           // Username
  'sww-color': 'string (rgb)',        // User color in RGB format
  'sww-show-video': 'string (boolean)', // Video player visibility
  
  // Filter states
  'sww-filter-enabled': 'string (boolean)',     // Filter switch state
  'sww-filter-usernames': 'JSON array',         // Username filters with colors
  'sww-word-filters': 'JSON array',             // Word filters
  'sww-negative-filters': 'JSON array',         // Negative word filters
  'sww-domain-filter': 'string (boolean)',      // Domain filter state
  
  // Comments (when using local storage mode)
  'sww-comments-local': 'JSON array',           // Stored comments
};
```

## Issues Fixed in This Audit

1. ✅ **Filter Switch Inactive State**: Changed from 10% opacity to nearly black (80% opacity black)
2. ✅ **Filter Switch Border**: Added visible border at 40% opacity
3. ✅ **Title Text**: Removed OPACITY_LEVELS reference that might cause visual artifacts
4. ✅ **Filter Initial State**: Fixed logic to properly respect localStorage over URL filters

## Remaining Hardcoded Values to Consider

- Send button disabled opacity (`0.30`) - should use `OPACITY_LEVELS.DARK`
- Domain LED inactive color (`rgba(255,255,255,0.2)`) - consider using opacity module
