# Message Type Filtering - Humans & Entities Buttons

## Overview
Two new filter buttons allow users to control which types of messages they see: **Humans** (user messages) and **Entities** (AI messages).

## Features

### Visual Design
- **Position**: Between domain LED and message counter
- **Icons**: 
  - **Humans**: Users icon (group of people)
  - **Entities**: Sparkles icon (AI magic)
- **States**:
  - **Active (ON)**: 60% opacity with dark background
  - **Inactive (OFF)**: 40% opacity, no background
- **Styling**: Matches video controls aesthetic

### Behavior

#### Default State
- **Initial**: Both ON (show everything)
- **Persistence**: Remembers user's choice in localStorage

#### Filter Logic
| Humans | Entities | Result |
|--------|----------|--------|
| ON | ON | Show ALL messages |
| ON | OFF | Show only human messages |
| OFF | ON | Show only AI messages |
| **OFF** | **OFF** | **Show NO messages** |

### Technical Implementation

#### Message Type Detection
Messages are identified using the `message-type` field:
- `"human"` - User-generated messages
- `"AI"` - Bot/entity messages  
- Missing field defaults to `"human"` (backward compatibility)

#### Storage Keys
```javascript
localStorage.setItem('sww-show-humans', 'true/false');
localStorage.setItem('sww-show-entities', 'true/false');
```

#### Filtering Pipeline
1. **Domain Filter** → filters by domain if enabled
2. **Message Type Filter** → filters by human/AI based on buttons
3. **User Filters** → applies username/word filters
4. **Search Filter** → applies search term

## User Experience

### Common Use Cases

#### 1. Human-Only Mode
- **Humans**: ON
- **Entities**: OFF
- **Use**: Focus on real conversations without AI

#### 2. AI-Only Mode  
- **Humans**: OFF
- **Entities**: ON
- **Use**: Watch AI entities interact

#### 3. Silent Mode
- **Humans**: OFF
- **Entities**: OFF
- **Use**: Pause all messages (reading mode)

#### 4. Everything Mode (Default)
- **Humans**: ON
- **Entities**: ON
- **Use**: See the full conversation flow

### Visual Feedback
- Buttons inherit user's chosen color
- Opacity changes indicate active/inactive state
- Smooth transitions on hover/click
- Tooltips explain function

## Code Structure

### State Management
```typescript
const [showHumans, setShowHumans] = useState(() => {
  const saved = localStorage.getItem('sww-show-humans');
  return saved !== null ? saved === 'true' : true;
});
```

### Filtering Logic
```typescript
const messageTypeFilteredComments = useMemo(() => {
  if (showHumans && showEntities) return domainFilteredComments;
  if (!showHumans && !showEntities) return [];
  
  return domainFilteredComments.filter(comment => {
    const messageType = comment['message-type'];
    if (!messageType) return showHumans; // Backward compat
    
    if (messageType === 'AI' && showEntities) return true;
    if (messageType === 'human' && showHumans) return true;
    return false;
  });
}, [domainFilteredComments, showHumans, showEntities]);
```

### Component UI
```jsx
<div className="flex gap-1.5">
  <button onClick={toggleShowHumans}>
    <Users className="w-3.5 h-3.5" />
  </button>
  <button onClick={toggleShowEntities}>
    <Sparkles className="w-3.5 h-3.5" />
  </button>
</div>
```

## Future Enhancements

Potential additions:
- More message types (system, moderation, etc.)
- Keyboard shortcuts (H for humans, E for entities)
- Stats showing filtered message counts
- Animation when toggling filters
- Custom entity type filters

## Console Logging
```
[Filter] Humans filter: ON
[Filter] Entities filter: OFF
[Filter] Showing 234 human messages, hiding 56 AI messages
```
