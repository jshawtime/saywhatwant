# Ham Radio Mode Implementation 📻

## Overview
Converted the app to "Ham Radio Mode" - a simpler, ephemeral filter system where filters only exist while the tab is open. If you're not tuned in, you miss it!

## Changes Made

### 1. **Removed IndexedDB Filter Recording**
- ❌ Removed all `recordUserFilters()` calls
- ❌ Removed `initializeIndexedDBSystem()` 
- ❌ Removed lifetime filter memory
- ❌ Removed filter statistics tracking
- ✅ Filters now use localStorage only for current session

### 2. **Simplified Data Loading**
```javascript
// Development mode automatically loads from /public/kv-data-export.json
if (COMMENTS_CONFIG.useLocalStorage) {
  const response = await fetch('/kv-data-export.json');
  // Load and display data
}
```

### 3. **Updated Configuration**
- Initial load: **500 messages**
- Lazy load batch: **100 messages** (was 50)
- IndexedDB limit: **100MB** with oldest message deletion

### 4. **Easy Production Switch**
To switch back to Cloudflare KV for production:
```javascript
// config/comments-source.ts
export const COMMENTS_CONFIG = {
  useLocalStorage: false, // ← Change to false for production
  apiUrl: 'https://sww-comments.bootloaders.workers.dev/api/comments',
  // ...
};
```

## How It Works Now

### Development Mode
1. App loads `/public/kv-data-export.json` directly
2. Displays messages in UI
3. Filters are applied in-memory only
4. No permanent storage of filter choices

### Production Mode
1. App fetches from Cloudflare KV API
2. Same ephemeral filter behavior
3. No user data persistence

## Filter Behavior
- **Ephemeral**: Close the tab, lose your filters
- **Shareable**: URL parameters still work for sharing filtered views
- **Simple**: No complex lifetime memory or statistics

## Testing
1. Start dev server: `npm run dev`
2. Go to http://localhost:3000
3. Data loads automatically from `kv-data-export.json`
4. Click usernames/words to filter
5. Close tab = filters gone (ham radio style!)

## Files Modified
- `components/CommentsStream.tsx` - Direct JSON loading in dev mode
- `hooks/useFilters.ts` - Removed all IndexedDB integration
- `public/populate-data.html` - Fixed timestamp format

## Status
✅ Ham Radio Mode fully implemented
✅ Data loading from static JSON in dev
✅ Easy switch to production mode
✅ All IndexedDB filter complexity removed
