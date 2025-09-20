# Color Fallback Rules

## 🤖 Quick Reference for AI Agents

### The Problem
Comments from the API sometimes come without colors (old comments, TestUser, etc.)

### The Solution - Two Different Contexts:

## 1. UI Elements (Header, Inputs, etc.)
**Use current `userColor` with mounted check:**
```typescript
// For UI elements that belong to current user
color: mounted ? userColor : 'rgb(96, 165, 250)'
```
These are temporary fallbacks during mount only.

## 2. Comments Display
**Use neutral gray fallback, NOT userColor:**
```typescript
// For displaying OTHER users' comments
color: comment.color || 'rgb(156, 163, 175)' // Gray-400
```

### Why Different?
- **UI Elements**: Should reflect current user's chosen color
- **Comments**: Should NOT inherit current user's color when comment has no color
- **TestUser Issue**: Was showing current user's color instead of neutral

### The Rule:
```typescript
// WRONG - Don't do this for comments:
comment.color || userColor  // ❌ Makes other users' comments use your color

// RIGHT - Use neutral fallback:
comment.color || 'rgb(156, 163, 175)'  // ✅ Gray for missing colors
```

### Gray Fallback Color
`rgb(156, 163, 175)` = Tailwind gray-400
- Neutral
- Visible on black background
- Clearly indicates "no color data"

### Where This Applies:
1. Username display in comments
2. Message text in comments  
3. Timestamp in comments
4. Any comment-specific styling

### Where This Does NOT Apply:
1. Input fields (use userColor)
2. Icons in header (use userColor)
3. Send button (use userColor)
4. Any UI that belongs to current user

## Summary
- **Comment data missing color?** → Gray fallback
- **UI element for current user?** → userColor
- **Never** make other users' content use current user's color
