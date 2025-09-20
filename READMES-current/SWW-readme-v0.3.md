# Say What Want (SWW) v0.3 - AI Agent Reference

**NOTE: This README is for AI agents only. No humans read these files.**

## 🎯 Project Status
- **Branch**: SWW-v0.3  
- **Environment**: Next.js 14.2.5 + Cloudflare Workers
- **Storage**: Cloudflare KV (cloud) with local storage disabled
- **Current State**: Fully functional with modular architecture

## 🏗️ Architecture Overview

### Frontend (Next.js)
```
saywhatwant/
├── components/         # React components
│   ├── CommentsStream.tsx  # Main comment display/interaction
│   ├── FilterBar.tsx       # Filter management UI
│   ├── DomainFilter.tsx    # LED domain filter button
│   └── UIElements.tsx      # Styled UI components
├── modules/           # Core business logic
│   ├── colorSystem.ts      # RGB color generation & manipulation
│   ├── colorOpacity.ts     # 6 standard opacity levels
│   ├── filterSystem.ts     # Filter logic (word, user, negative)
│   ├── cloudApiClient.ts   # Cloudflare API interactions
│   └── usernameColorGenerator.ts  # Deterministic color generation
├── hooks/             # React hooks
│   └── useFilters.ts       # Filter system integration
└── config/            # Configuration
    ├── comments-source.ts  # Cloud/local toggle config
    └── domain-config.ts    # Multi-domain support
```

### Backend (Cloudflare Worker)
```
workers/
└── comments-worker.js  # API endpoints for comment CRUD
```

## 🎨 Color System

### RGB-Based Generation
- **Algorithm**: 77,106 unique color combinations
- **Ranges**: MAIN: 150-220, SECONDARY: 40-220, THIRD: 40
- **No hardcoded colors**: Everything is dynamic
- **Fallback strategy**: Username-based deterministic colors

### Opacity Levels (ONLY use these 6)
```typescript
DARKEST: 0.2  // 20% - Most transparent
DARKER: 0.3   // 30% - Faint backgrounds
DARK: 0.4     // 40% - Placeholder text
MEDIUM: 0.5   // 50% - Borders, inactive filters
LIGHT: 0.6    // 60% - Icons, usernames
FULL: 1.0     // 100% - Primary text
```

## 🔧 Key Features

### 1. Cloud Comments System
- Cloudflare KV storage (5000 comment cache)
- Rate limiting: 10 messages/minute per IP
- Real-time polling for updates
- Multi-domain support

### 2. Filter System
- **Word filters**: Include/exclude/remove modes (AND logic)
- **Username filters**: Click usernames to filter
- **Negative filters**: Right-click words to exclude
- **Domain filter**: LED button to filter by domain
- **URL-based filters**: Share filter states via URL

### 3. Keyboard Shortcuts
- `r`: Random color (no modifiers needed)
- `Tab`: Navigate between message/username fields
- Standard browser shortcuts work (Cmd+R refreshes)

### 4. Message Structure (KV)
```javascript
{
  id: "unique-id",
  text: "Message content",
  timestamp: 1726800000000,
  username: "god",
  color: "rgb(185, 142, 40)",  // RGB format
  domain: "saywhatwant.app",
  language: "en",
  misc: ""  // Future use
}
```

## 🚀 Recent Accomplishments (from v0.1 → v0.3)

### Major Fixes
- ✅ Fixed color system disconnection from worker
- ✅ Removed ALL hardcoded color fallbacks
- ✅ Fixed import bug (wrong getDarkerColor function)
- ✅ Implemented deterministic username colors
- ✅ Fixed keyboard shortcuts interfering with browser

### Modularization Progress
- ✅ Phase 1.1: Cloud API Client module
- ⏳ Phase 1.2: Storage Manager (next)
- ⏳ Phase 1.3: Timestamp System
- ⏳ Phase 2: UI Component extraction

## 🔄 Current Workflow

### Development
```bash
# Frontend
cd saywhatwant
npm run dev  # Runs on localhost:3001

# Worker (separate terminal)
cd workers
npx wrangler dev  # Runs on localhost:8787
```

### Git
```bash
git status  # Should be on SWW-v0.3
git add .
git commit -m "Your message"
git push origin SWW-v0.3
```

## ⚡ Environment Setup

### `.env.local` (Frontend)
```env
NEXT_PUBLIC_COMMENTS_API=http://localhost:8787/api/comments
```

### `wrangler.toml` (Worker)
```toml
name = "comments-worker"
main = "comments-worker.js"
compatibility_date = "2024-09-14"

[[kv_namespaces]]
binding = "COMMENTS_KV"
id = "YOUR_KV_ID"
preview_id = "YOUR_PREVIEW_ID"
```

## 📋 Testing Checklist

- [ ] Comments display with correct colors
- [ ] Usernames clickable for filtering
- [ ] Domain filter LED works
- [ ] Filter states persist in localStorage
- [ ] URL filters work when shared
- [ ] Keyboard shortcuts don't interfere
- [ ] Rate limiting works (10/min)
- [ ] Multi-domain detection works

## 🎯 Next Steps for v0.3

1. Continue modularization (Phase 1.2: Storage Manager)
2. Implement any new features requested
3. Performance optimizations
4. Bug fixes as discovered

## 📝 Important Notes

- **No hardcoded colors**: System is 100% dynamic
- **Import carefully**: Check which function you're importing
- **Test with actual data**: Don't assume, verify
- **Modular approach**: Extract logic into modules/hooks
- **User controls versioning**: Don't auto-version

## 🤖 AI Agent Guidelines

1. **Read existing code before modifying**
2. **Use the modular architecture**
3. **Test changes thoroughly**
4. **Commit with clear messages**
5. **Update documentation when changing functionality**
6. **Don't add version numbers** - user handles this manually

---

*Last Updated: Start of v0.3 branch*  
*Previous Version: v0.1 (SWW-v0.1 branch)*
