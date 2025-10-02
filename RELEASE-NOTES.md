# Say What Want - Release Notes

## v2.1 - Search & Filter Perfected (Pre-Component-Refactor Snapshot)
**Released**: October 2, 2025
**Status**: STABLE - Pre-Refactor Baseline

### 🎯 Critical Bug Fixes
- **Full Database Search**: Search/filter now scans ENTIRE IndexedDB (6k+ messages), not just displayed messages
- **Message Order Fixed**: Filter/search results display oldest→newest (top→bottom), matching unfiltered view
- **Display Bug Fixed**: Corrected using wrong filter results variable (was showing 1-3 messages instead of 50)
- **Infinite Loop Fixed**: Stabilized useEffect dependencies to prevent 10k+ re-renders
- **Domain Filter Auto-Apply Removed**: Search no longer auto-filtered by domain

### 🔍 IndexedDB Query System
- Cursor-based querying for efficient large dataset filtering
- Scans up to entire database to find matches
- Returns newest n matches in correct display order
- Search debouncing (150ms) reduces redundant queries
- Query generation tracking prevents stale results

### 📊 Analytics Dashboard
- Real-time KV and IndexedDB metrics
- Search database feature (count exact matches)
- Raw JSON message display for debugging
- User-definable message limits (1-1000)
- Fixed KV count to show actual total (not cache size)

### 🛠️ Technical Improvements
- Removed legacy IndexedDB stores (messages_temp, messages_perm, etc.)
- Simplified to single `messages` store with exact KV structure
- Fixed message type indexing (removed hyphenated index)
- React hydration errors addressed (localStorage moved to useEffect)
- Global count now shows true KV total (~12.5k) not local IndexedDB count

### 📝 Documentation
- `35-INDEXEDDB-REFACTOR-PLAN.md`: Complete refactor documentation
- `36-COMMENTSSTREAM-REFACTOR.md`: Upcoming component extraction plan
- Documented all critical bugs and fixes

**This version marks the last stable state before major component refactoring begins.**

---

## v2.0 - Elegant Architecture
**Released**: September 29, 2025
**Status**: STABLE

### 🚀 Major Refactor
Complete architectural overhaul for elegance and simplicity:

- **70% Less Code**: Removed unnecessary abstraction layers
- **Pure Functions**: Simple, testable, side-effect-free functions
- **Single Hook**: One `useSimpleFilters` replaces complex multi-hook system
- **No Singleton**: Removed URLFilterManager class pattern
- **Direct URL Operations**: No intermediate state caches or merging
- **User Control**: Removed auto-activation - users maintain full control

### 🎯 Technical Details
- New `lib/url-filter-simple.ts`: Pure functions for URL operations
- New `hooks/useSimpleFilters.ts`: Single elegant hook for all filtering
- Backward compatible through wrapper in `useFilters.ts`
- Clean separation of concerns with no circular dependencies

### 🧹 What Was Removed
- URLFilterManager singleton class
- Complex merge logic
- Multiple layers of state synchronization  
- Auto-activation behavior
- All debugging console.log statements

---

## v1.2 - Filter System Perfection
**Released**: September 29, 2025
**Status**: STABLE

### 🎨 Improvements
- **React Hydration Fix**: Resolved timing issues between URLFilterManager and React hooks
- **Auto-Activation**: Filter automatically enables when adding first username (better UX)
- **Eager URL Initialization**: `filteractive` is always present in URL from initial load
- **Enhanced Debugging**: Added comprehensive logging throughout filter system
- **Lazy State Initialization**: React hooks now sync properly with URLFilterManager on mount

### 🔧 Technical Details
- Used React's lazy state initialization to sync with singleton URLFilterManager
- URLFilterManager eagerly adds `filteractive=false` to URL if not present
- Improved state synchronization prevents null filterActive during initial render
- Filter system now auto-activates when adding first user with filters off

### 📊 Debug Commands
Open browser console to see detailed filter system logs:
- `[URLFilterManager]` - URL state management
- `[useFilters]` - Filter application logic
- `[useURLFilter]` - Hook state synchronization

---

## v1.1 - URL Enhancement Fix
**Released**: September 29, 2025
**Status**: STABLE

### 🔧 Bug Fixes
- **Fixed `filteractive` URL parameter**: Now works correctly on initial page load (not just on refresh)
- **Fixed filter toggle button**: No longer freezes when URL override is present
- **Improved filter state priority**: URL parameters now have absolute priority over localStorage and special case logic

### Technical Details
- Modified `/hooks/useFilters.ts` to respect URL override as absolute priority
- Ensured `baseFilterEnabled` is properly initialized when URL override is present
- Eliminated race conditions between URL parsing and localStorage loading

### Test URLs
- `#filteractive=true` - Forces filter ON (LED lit)
- `#filteractive=false` - Forces filter OFF (LED dimmed)
- `#filteractive=true&u=alice:255000000` - Filter ON with alice in filter bar

---

## v1.0 - Robust Production Release
**Released**: September 25, 2025
**Status**: STABLE

### 🎉 Major Milestone
This marks the first stable production release of Say What Want - a decentralized, domain-agnostic communication platform with advanced filtering and AI integration capabilities.

### Core Features
- **Real-time global messaging** across all domains
- **Domain-based filtering** with visual LED indicator
- **Advanced filter system** with URL persistence and bookmarking
- **IndexedDB local storage** with 1GB limit and intelligent cleanup
- **Audio notifications** with per-filter customization
- **AI entity integration** supporting multiple LM Studio models

### UI/UX Excellence
- **Dynamic color system** with standardized opacity levels
- **Persistent user identity** (username and color)
- **Message type filtering** (Humans/Entities toggles)
- **Smart scroll management** with position memory
- **Context menus** for power user features
- **Global message counter** with automatic formatting
- **Advanced search** with real-time highlighting
- **Filter notifications** with visual unread indicators

### Technical Architecture
- Cloudflare Workers for API (10M operations/month)
- Cloudflare Pages for static hosting
- KV storage for persistent global messages
- IndexedDB for local message caching
- TypeScript with modular architecture
- Efficient cursor-based polling system
- Ham Radio Mode for bandwidth efficiency

### Recent Polish (Pre-v1.0)
- Fixed filter system to use complete message pool
- Perfected scroll position preservation
- Enhanced IndexedDB maintenance utilities
- Optimized UI element positioning
- Implemented audio notification queuing
- Added comprehensive context menus
- Completed message type filtering
- Resolved all major UX friction points

---

## Version History

### Versioning Convention
Starting from v1.0, we follow semantic versioning:
- **v1.0**: Major stable release
- **v1.01-v1.09**: Minor updates and features
- **v1.1**: Significant feature additions
- **v2.0**: Major architectural changes

### Future Development
Incremental updates (v1.01+) will focus on:
- Performance optimizations
- New AI entity personalities
- Extended filter capabilities
- Enhanced mobile experience
- Additional notification options
- Expanded video sharing features

---

## Links
- **Production**: https://saywhatwant.app
- **GitHub**: https://github.com/jshawtime/saywhatwant
- **Clear Utility**: https://saywhatwant.app/clear-indexeddb.html
- **AI Console**: https://saywhatwant.app/ai-console

---

*Say What Want - Where every domain has a voice*
