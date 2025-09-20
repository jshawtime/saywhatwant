# Say What Want (SWW) - Version 0.1

## 📌 Version Information
- **Version**: 0.1
- **Date**: September 20, 2025
- **Branch**: SWW-v0.1
- **Status**: Development Release

## 🎯 What's Working in v0.1

### Core Features
✅ **Video Player System**
- Auto-playing video content with seamless transitions
- Loop/Random playback modes
- Video sharing in comments via `[video:key]` links
- R2 bucket integration for cloud video storage
- Local video fallback support

✅ **Comments System with Dual Storage Modes**
- **NEW**: Toggle between localStorage and Cloud API
- Real-time comment streaming
- Anonymous posting with customizable usernames (16 char max)
- Color personalization for each user
- Cross-tab synchronization (localStorage mode)
- Multi-user support (Cloud API mode)

✅ **Advanced Filtering System**
- Interactive click-based filtering (left-click include, right-click exclude)
- URL-based shareable filters
- Username filtering
- Word include/exclude filters
- Date/time range filtering
- Search bar integration
- Persistent filter states

✅ **Cloud Worker Integration**
- Cloudflare Worker running locally at `http://localhost:8787`
- KV storage for comments persistence
- REST API endpoints (GET/POST)
- Rate limiting ready (10 comments/min per IP)
- 5000-comment cache for performance

### Configuration System
✅ **New Toggle Configuration** (`config/comments-source.ts`)
```javascript
export const COMMENTS_CONFIG = {
  useLocalStorage: false,  // false = Cloud API, true = localStorage
  apiUrl: 'http://localhost:8787/api/comments',
  pollingInterval: 5000,
  debugMode: true,
};
```

## 📁 Project Structure

```
saywhatwant/
├── app/                    # Next.js app directory
├── components/            
│   ├── CommentsStream.tsx  # Main comments (NOW SUPPORTS CLOUD/LOCAL)
│   ├── FilterBar.tsx       # Filter UI
│   └── VideoPlayer.tsx     # Video player
├── config/
│   ├── comments-source.ts  # NEW: Toggle cloud/local storage
│   └── video-source.ts     # Toggle R2/local videos
├── hooks/                  # Custom React hooks
├── workers/               
│   └── comments-worker.js  # Cloudflare Worker (RUNNING)
├── READMES-current/       # Current documentation
└── READMES-old/          # Archived docs
```

## 🚀 Quick Start

### 1. Development Server
```bash
cd saywhatwant
npm run dev:clean  # Kills existing servers and starts fresh
```
Visit: http://localhost:3000

### 2. Cloudflare Worker (for Cloud Comments)
```bash
# In a separate terminal
cd workers
npx wrangler dev --local --port 8787 comments-worker.js
```
Worker API: http://localhost:8787/api/comments

## 🔄 Storage Modes

### Cloud API Mode (Current Setting)
- Comments stored in Cloudflare KV
- Multi-user real-time updates
- Polling every 5 seconds
- Persistent across all users
- Console shows: `[Cloud API]` logs

### localStorage Mode
- Comments stored in browser
- Single browser only
- Instant cross-tab sync
- Max 1000 comments
- Console shows: `[LocalStorage]` logs

### How to Switch
Edit `config/comments-source.ts`:
```javascript
useLocalStorage: true   // for localStorage
useLocalStorage: false  // for Cloud API
```

## 📊 Current Status

| Component | Status | Mode |
|-----------|--------|------|
| Frontend | ✅ Running | Next.js Dev Server |
| Comments Storage | ✅ Active | Cloud API |
| Worker | ✅ Running | Local Wrangler |
| Video Source | ✅ Working | Local/R2 |
| Filtering | ✅ Functional | All modes |

## 🧪 Testing Cloud Comments

1. **Verify Worker is Running**: Check terminal for `[wrangler:info] Ready on http://localhost:8787`
2. **Open Multiple Browsers**: Test multi-user functionality
3. **Check Console**: Look for `[Cloud API]` messages
4. **Post Comments**: Should appear in all browsers within 5 seconds

## 📝 Environment Variables

### Current `.env.local`
```bash
# Comments API (for cloud mode)
NEXT_PUBLIC_COMMENTS_API=http://localhost:8787/api/comments

# R2 Bucket Configuration
NEXT_PUBLIC_R2_BUCKET_URL=https://pub-56b43531787b4783b546dd45f31651a7.r2.dev
R2_ACCOUNT_ID=85eadfbdf07c02e77aa5dc3b46beb0f9
R2_BUCKET_NAME=sww-videos
```

## 🐛 Known Issues in v0.1

1. **Worker Must Be Started Manually**: Need to run wrangler separately
2. **No Production Deployment**: Currently local development only
3. **Limited Error Handling**: Cloud API errors need better UX
4. **No User Authentication**: All posts are anonymous

## 📚 Documentation Structure

### Consolidated Docs (READMES-current/)
1. `00-IMPORTANT!-best-practices.md` - Sacred best practices doc
2. `01-PROJECT-OVERVIEW.md` - Project overview and quick start
3. `02-DEPLOYMENT-GUIDE.md` - All deployment documentation
4. `03-FEATURES-DOCUMENTATION.md` - Feature details
5. `04-TECHNICAL-ARCHITECTURE.md` - Technical implementation
6. `05-FILTER-SYSTEM-REFERENCE.md` - Complete filter system docs
7. `SWW-readme-v0.1.md` - This version documentation

## 🔮 Next Steps for v0.2

- [ ] Auto-start worker with dev server
- [ ] Production deployment to Cloudflare
- [ ] User authentication/profiles
- [ ] Message persistence beyond 1000 items
- [ ] Enhanced error handling
- [ ] WebSocket support for instant updates
- [ ] Mobile responsive improvements

## 🛠️ Development Commands

```bash
# Development
npm run dev              # Standard dev server
npm run dev:clean        # Clean start (recommended)

# Worker Commands
cd workers
wrangler dev            # Start worker
wrangler deploy         # Deploy to Cloudflare

# Utilities
npm run manifest:local   # Generate local video manifest
npm run manifest:generate # Generate R2 manifest
```

## 💡 Tips

1. **Always use `dev:clean`** to avoid port conflicts
2. **Check console logs** with debugMode enabled
3. **Worker must be running** for cloud comments to work
4. **Use Chrome DevTools** to inspect localStorage
5. **Test with incognito** for multi-user simulation

## 📄 Version History

### v0.1 - September 20, 2025
- Initial working version
- Dual storage mode implementation
- Cloud Worker integration
- Complete filtering system
- Documentation consolidation

---

**Branch**: `SWW-v0.1`  
**Commit**: Version 0.1 - Cloud/Local storage toggle implementation
