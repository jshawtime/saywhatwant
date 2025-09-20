# Say What Want (SWW) v0.1 - AI Agent Reference

**NOTE: This README is for AI agents only. No humans read these files.**

## 🤖 Quick Context
- **Version**: 0.1.4
- **Branch**: SWW-v0.1  
- **Date**: September 20, 2025
- **Purpose**: Anonymous messaging platform with sophisticated color-based user differentiation

## 🏗️ Architecture Overview

### Storage System
```javascript
// config/comments-source.ts
useLocalStorage: false  // Cloud KV is source of truth
```
- **KV Structure**: `{id, text, timestamp, username, color, domain}`
- **No userAgent** - removed for pre-v1 development
- **Cache**: 5000 comments in-memory

### Color System (RGB-Based)
```javascript
// 77,106 unique colors via sophisticated algorithm
MAIN: 150-220 (71 values)
SECONDARY: 40-220 (181 values)  
THIRD: 40 (fixed)
// 6 permutations = 71 × 181 × 6 = 77,106 unique colors
```
- **Purpose**: Hidden user differentiation (same username, different color = different user)
- **Storage**: RGB format `rgb(185, 142, 40)` not hex

### UI Color Hierarchy
```javascript
userColor // 100% - All UI elements now inherit directly
getDarkerColor(userColor, 0.5) // 50% - Borders, inactive states
// No other opacity values used
```
**ALL these elements use userColor at 100%:**
- Message text
- Username input field
- Filter icon
- Search icon  
- Search placeholder
- Clear buttons (X)
- Character counter
- Active domain LED

### Multi-Domain System
```javascript
// config/domain-config.ts
DOMAIN_CONFIGS = {
  'saywhatwant.app': { title: 'Say What Want' },
  'shittosay.app': { title: 'Shit To Say' },
  // Add domains here
}
```
- **Domain captured** in every message
- **LED filter**: Show only current domain messages
- **State saved** in localStorage

### Filter System (Refactored)
```javascript
// modules/filterSystem.ts
applyWordFilters() // AND logic for includes (all words required)
applyUsernameFilters()
applyNegativeFilters()  
applyDateTimeFilter()
```
- **Left-click**: Add word to include filter
- **Right-click**: Add word to exclude filter
- **URL state**: Shareable filter links

## 🚀 Running The Project

### Frontend
```bash
cd saywhatwant
npm install
npm run dev  # Runs on localhost:3000
```

### Cloudflare Worker
```bash
cd saywhatwant/workers
npx wrangler dev --local --port 8787 comments-worker.js
```

### Environment Setup
```bash
# .env.local
NEXT_PUBLIC_COMMENTS_API=http://localhost:8787/api/comments
```

## 📁 Key Files

### Core Components
- `components/CommentsStream.tsx` - Main comment UI
- `components/FilterBar.tsx` - Filter management
- `components/DomainFilter.tsx` - LED domain toggle
- `components/ColorPicker.tsx` - Color selection UI

### Modules (Logic)
- `modules/colorSystem.ts` - RGB generation, brightness adjustment
- `modules/filterSystem.ts` - Filter algorithms
- `hooks/useFilterSystem.ts` - React integration

### Configuration
- `config/comments-source.ts` - Storage toggle
- `config/domain-config.ts` - Multi-domain setup
- `workers/comments-worker.js` - KV backend

## 🐛 Known Issues & Solutions

### Common Problems
1. **Worker not running**: Check port 8787
2. **Colors not saving**: RGB format required, not hex
3. **Filters not working**: AND logic for includes (all words required)
4. **Domain LED**: No white dot, just colored circle

### Debug Commands
```javascript
// Check KV contents (in worker console)
await env.COMMENTS_KV.list()

// Clear localStorage
localStorage.clear()

// Toggle storage mode
// Edit config/comments-source.ts -> useLocalStorage
```

## 📊 Data Flow

```
User Input → CommentsStream.tsx
    ↓
useLocalStorage check
    ↓
false: POST to Worker → KV Storage
true: Save to localStorage
    ↓
Polling (5s) → Update UI
```

## 🎨 Color System Details

### Why RGB Over Hex?
- 77,106 unique combinations
- Subtle differentiation (users can't see difference)
- System can track unique users
- No backwards compatibility needed (pre-v1)

### Color Assignment
```javascript
getRandomColor() // Generates from algorithm
saveUserColor() // Stores in localStorage  
// Each user gets persistent unique color
```

## 🔧 Recent Updates (v0.1.4)

### UI Simplification
- **All UI elements** now use `userColor` at 100%
- **No more opacity variations** except borders (50%)
- **Domain LED** simplified (no white highlight)
- **Character counter** uses full color

### Documentation
- **READMEs are AI-only** - noted in best practices
- **Concise format** - just what AI agents need
- **No human-readable fluff**

## 💡 For Next AI Agent

### Critical Understanding
1. **Color = Identity**: Same username + different color = different person
2. **KV is truth**: Cloud storage primary, localStorage secondary
3. **Domain matters**: Messages tagged with origin domain
4. **Filters are AND**: Include filters require ALL words

### Quick Checks
```bash
git status  # Should be on SWW-v0.1
npm run dev  # Frontend on :3000
npx wrangler dev  # Worker on :8787
```

### Architecture Philosophy
- **Simple > Complex**
- **Logic > Rules**
- **User experience > Technical elegance**
- **Scale to 10M+ users**

---

**Last AI Update**: Claude (Anthropic)
**Next Agent**: Think deeply, code carefully. The humans trust us when we deliver solid code.