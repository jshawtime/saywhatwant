# Opacity Module Guide

## Overview
The opacity module (`/modules/colorOpacity.ts`) provides exactly **6 standardized opacity levels** for UI consistency. Never use custom opacity values - always use these predefined levels.

## The 6 Opacity Levels

```typescript
OPACITY_LEVELS = {
  DARKEST: 0.2,   // 20% opacity - Most transparent
  DARKER: 0.3,    // 30% opacity - Very faint
  DARK: 0.4,      // 40% opacity - Faint
  MEDIUM: 0.5,    // 50% opacity - Half transparent
  LIGHT: 0.6,     // 60% opacity - Slightly transparent  
  FULL: 1.0,      // 100% opacity - Fully visible
}
```

### Understanding the Naming
**IMPORTANT**: The names describe transparency, not brightness!
- **DARKEST** = Most transparent (faintest, 20%)
- **FULL** = No transparency (brightest, 100%)

Think of it as: "darker" = "more see-through"

## How to Use

### 1. Import the Module
```typescript
import { OPACITY_LEVELS } from '@/modules/colorOpacity';
import { getDarkerColor } from '@/modules/colorSystem';
```

### 2. Apply Opacity to Colors
```typescript
// Method 1: Using getDarkerColor (recommended)
const fadedColor = getDarkerColor(userColor, OPACITY_LEVELS.LIGHT); // 60% opacity

// Method 2: Direct style opacity (for non-color properties)
style={{ opacity: OPACITY_LEVELS.DARK }} // 40% opacity
```

### 3. Common Patterns

#### Inactive/Active States
```typescript
// Active element
color: getDarkerColor(userColor, OPACITY_LEVELS.LIGHT)  // 60% - visible but not full

// Inactive element  
color: getDarkerColor(userColor, OPACITY_LEVELS.DARK)   // 40% - more faded
```

#### Placeholder Text
```typescript
// Always use DARKER (30%) for placeholders - one level lighter than DARK
['--placeholder-color']: getDarkerColor(userColor, OPACITY_LEVELS.DARKER)
```

#### Background Effects
```typescript
// Very subtle background
backgroundColor: getDarkerColor(userColor, OPACITY_LEVELS.DARKEST)  // 20%

// Hover states
backgroundColor: getDarkerColor(userColor, OPACITY_LEVELS.DARKER)   // 30%
```

## UI Element Standards

### Text Elements
- **Message text**: `FULL` (100%)
- **Username**: `LIGHT` (60%)
- **Placeholder**: `DARKER` (30%)
- **Disabled text**: `DARK` (40%)

### Interactive Elements
- **Active icons**: `LIGHT` (60%)
- **Inactive icons**: `DARK` (40%)
- **Disabled buttons**: `DARK` (40%)
- **Character counter**: `MEDIUM` (50%)

### Backgrounds & Borders
- **Active borders**: `MEDIUM` (50%)
- **Inactive borders**: `DARK` (40%)
- **Hover backgrounds**: `DARKEST` (20%)
- **Selected backgrounds**: `DARKER` (30%)

## Making Elements "One Level Lighter"

When the user asks to make something "one level lighter", move UP this scale:

```
DARKEST (20%) → DARKER (30%) → DARK (40%) → MEDIUM (50%) → LIGHT (60%) → FULL (100%)
     ↑             ↑             ↑             ↑             ↑
  lightest     lighter      standard      darker       darkest
```

**Example**: 
- Current: `DARK` (40%)
- One level lighter: `DARKER` (30%)
- Two levels lighter: `DARKEST` (20%)

## Real-World Examples

### Search Icon (Active State Detection)
```typescript
<StyledSearchIcon 
  userColor={userColor} 
  opacity={searchTerm ? OPACITY_LEVELS.FULL : OPACITY_LEVELS.LIGHT} 
/>
```

### Send Button (Disabled State)
```typescript
style={{ 
  color: userColor,
  opacity: (isSubmitting || !inputText.trim()) 
    ? OPACITY_LEVELS.DARK    // 40% when disabled
    : OPACITY_LEVELS.LIGHT   // 60% when enabled
}}
```

### Video Control Buttons
```typescript
// Active mode button
color: isLoopMode 
  ? getDarkerColor(userColor, OPACITY_LEVELS.LIGHT)  // 60% - active
  : getDarkerColor(userColor, OPACITY_LEVELS.DARK)   // 40% - inactive
```

## DO's and DON'Ts

### ✅ DO
- Always use the 6 predefined levels
- Use `getDarkerColor()` for color opacity
- Follow established patterns for similar elements
- Consider the visual hierarchy

### ❌ DON'T
- Create custom opacity values (e.g., 0.75, 0.15)
- Use `rgba()` with custom alpha values
- Mix opacity methods (stick to one approach)
- Use `FULL` for secondary elements

## Quick Reference Table

| User Says | You Use | Value | Visual Result |
|-----------|---------|--------|---------------|
| "Make it darkest/faintest" | `OPACITY_LEVELS.DARKEST` | 20% | Very transparent |
| "Make it darker/fainter" | `OPACITY_LEVELS.DARKER` | 30% | Quite transparent |
| "Make it dark/faint" | `OPACITY_LEVELS.DARK` | 40% | Noticeably transparent |
| "Make it medium" | `OPACITY_LEVELS.MEDIUM` | 50% | Half transparent |
| "Make it light/visible" | `OPACITY_LEVELS.LIGHT` | 60% | Slightly transparent |
| "Make it full/bright" | `OPACITY_LEVELS.FULL` | 100% | No transparency |

## Integration Checklist

When adding a new UI element:
1. ✓ Import opacity module
2. ✓ Choose appropriate level from the 6 options
3. ✓ Use `getDarkerColor()` for colors
4. ✓ Match similar elements' opacity
5. ✓ Test in both light and dark contexts
6. ✓ Document if creating new pattern

## Common Mistakes to Avoid

1. **Using percentage directly**: 
   ```typescript
   // ❌ Wrong
   opacity: 0.45
   
   // ✅ Correct  
   opacity: OPACITY_LEVELS.MEDIUM
   ```

2. **Creating inline rgba**:
   ```typescript
   // ❌ Wrong
   color: 'rgba(255, 255, 255, 0.35)'
   
   // ✅ Correct
   color: getDarkerColor(userColor, OPACITY_LEVELS.DARKER)
   ```

3. **Misunderstanding the scale**:
   - Remember: LOWER percentage = MORE transparent
   - DARKEST (20%) is the MOST see-through
   - FULL (100%) is NOT transparent at all
