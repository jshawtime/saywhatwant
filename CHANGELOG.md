# Changelog - Say What Want

## v1.4 - MAJOR UPDATE (October 4, 2025)

### 🎯 Major Features

#### Complete Filter System Rewrite
- **Switched to useSimpleFilters** - Replaced legacy filter system
- **URL as single source of truth** - No more localStorage filter state
- **filteractive parameter fully functional** - Explicit filter control via URL
- **Visual and data synchronization** - Filter icon state matches actual filtering
- **Elegant IndexedDB queries** - Criteria-based filtering with proper state handling

#### AI Bot Integration
- **LM Studio integration** - Full bot service in `ai/` directory
- **Model**: HigherMind_The-Eternal-1 (28.99 GB, F32 quantization)
- **Smart response system** - Context-aware with decision-making logic
- **Bot feedback loop prevention** - Filters out bot-to-bot conversations
- **Rate limiting** - 3 messages/minute with 10% response probability
- **Dynamic personality** - Can change username and colors
- **AI Monitoring Console** - Password-protected dashboard at `/ai-console`

#### Mobile Optimizations
- **Android keyboard handling** - Input stays visible above keyboard on all taps
- **iPhone zoom prevention** - 16px font prevents unwanted zoom
- **Dynamic viewport** - h-dvh for proper mobile browser chrome handling
- **Safe area support** - Handles notched devices (iPhone X+)
- **No horizontal scroll** - Input properly constrained
- **Sticky positioning** - Chat input always accessible

### 🔧 Technical Improvements

#### Architecture
- **Migrated to v4.0 URL system** - 70% less code, more maintainable
- **Deleted legacy useFilters.ts** - Clean codebase, no technical debt
- **Fixed useIndexedDBFiltering** - Respects filter state for queries
- **TypeScript target upgrade** - ES5 → ES2015 for Set iteration

#### Performance
- **Cursor-based polling** - 98.6% cost reduction ($875/day → $12/day)
- **Efficient DB queries** - IndexedDB filtering with proper indices
- **Debounced operations** - Search, resize, keyboard events
- **ResizeObserver** - Smart layout change detection

### 🐛 Critical Fixes

#### Filter System
- **Filter state vs application clash** - Resolved dual-control issue
- **useEffect dependency missing** - Added isFilterEnabled to trigger re-queries
- **buildCriteria early return** - Proper handling of inactive filters
- **Import errors** - Fixed UsernameFilter imports across components

#### UI/UX
- **Random/Loop video buttons** - Fixed color contrast (LIGHT vs DARK opacity)
- **getDarkerColor conflicts** - Resolved triple-function naming issue
- **TV toggle button** - Added to video area, synchronized with main toggle
- **Scroll position** - Maintains bottom scroll on video area open/close
- **Filter icon in empty state** - Added to "no messages" display

#### Mobile
- **Android keyboard (first tap)** - Fixed viewport adjustment
- **Android keyboard (subsequent)** - Fixed state tracking with height-based detection
- **Username field zoom** - Prevented on both iOS and Android
- **Input width expansion** - Fixed overflow and box-sizing

### 📚 Documentation

#### New Documentation Files
- **15-MOBILE-FIXES-COMPLETE.md** - Comprehensive mobile fix documentation
- **16-LM-STUDIO-INTEGRATION-PLAN.md** - AI bot architecture and setup
- **17-VIDEO-streaming.md** - Video system documentation
- **18-URL-FILTERACTIVE-BUG.md** - Filter bug analysis and fix
- **19-FILTER-STATE-VS-APPLICATION-CLASH.md** - Dual-control issue resolution

#### Updated Documentation
- **00-AGENT!-best-practices.md** - Renamed from IMPORTANT
- **12-EFFICIENT-POLLING-STRATEGY.md** - Cursor-based polling details
- **13-URL-FILTER-SYNC-ARCHITECTURE.md** - Updated for new system
- **14-FILTER-AUTO-ACTIVATION-FIX.md** - Historical context

### 🚀 Deployment

#### Cloudflare
- All builds succeeding
- No TypeScript errors
- Static generation working
- API routes functional

#### Testing
- ✅ Filter toggle works both directions
- ✅ URL parameter respect (filteractive)
- ✅ Mobile keyboards (iOS & Android)
- ✅ AI bot posting to live site
- ✅ Color randomization working
- ✅ Video controls functional

### 🎨 UI Polish

- **Color system** - Brightened random colors (150-230 range, 80 baseline)
- **Opacity levels** - Consistent use of OPACITY_LEVELS constants
- **Filter bar** - Proper inactive/active visual distinction
- **Scroll behavior** - Smart auto-scroll with user control
- **Empty states** - Helpful messages with actionable icons

### 🔐 Security

- **AI console password** - Protected with "saywhatwant" password
- **API authentication** - Password headers for bot communication
- **Rate limiting** - Prevents bot spam and abuse

### ⚡ Breaking Changes

- **Removed legacy useFilters.ts** - Apps using old hook must migrate
- **Changed filter state management** - No more localStorage for filter active state
- **URL format required** - filteractive must be in URL

### 📋 Migration Notes

For future developers:
- Use `useSimpleFilters` instead of `useFilters`
- Import `UsernameFilter` from `@/modules/filterSystem` not `@/hooks/useFilters`
- Filter state is NOW in URL only, not localStorage
- IndexedDB queries are criteria-based, not results-filtered

---

## Previous Versions

### v1.3 and earlier
- See git history for previous changes
- Major work on IndexedDB implementation
- Filter system foundations
- Video player integration

---

**v1.4 is a major milestone** - Clean architecture, working filters, mobile support, and AI integration all functional!
