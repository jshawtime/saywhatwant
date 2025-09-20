# Cloud Comments vs Local Storage Configuration

## Current Status
The application now supports toggling between **localStorage** and **cloud API** for comments storage.

## Configuration File
`config/comments-source.ts`

## How to Switch Modes

### To Use Cloud API (Current Setting)
```typescript
// In config/comments-source.ts
export const COMMENTS_CONFIG = {
  useLocalStorage: false,  // ← Set to false for cloud
  apiUrl: process.env.NEXT_PUBLIC_COMMENTS_API || 'http://localhost:8787/api/comments',
  // ...
};
```

### To Use Local Storage
```typescript
// In config/comments-source.ts
export const COMMENTS_CONFIG = {
  useLocalStorage: true,  // ← Set to true for localStorage
  // ...
};
```

## Features Supported in Both Modes

| Feature | localStorage | Cloud API |
|---------|-------------|-----------|
| Post Comments | ✅ | ✅ |
| View Comments | ✅ | ✅ |
| Real-time Updates | ✅ (via storage events) | ✅ (via polling) |
| Cross-tab Sync | ✅ | ✅ |
| Persistence | Browser only | Server-side |
| Multi-user | No | Yes |
| Rate Limiting | No | Yes (API dependent) |

## Implementation Details

### localStorage Mode
- Comments stored in browser's localStorage
- Key: `sww-comments-local`
- Maximum 1000 comments stored
- Cross-tab synchronization via storage events
- No server required

### Cloud API Mode
- Comments stored on server (Cloudflare Workers/KV)
- Endpoint: Configured via `NEXT_PUBLIC_COMMENTS_API` env variable
- Polling interval: 5 seconds (configurable)
- Supports unlimited comments
- Multi-user real-time collaboration

## Debug Mode
When `debugMode: true` in the config, you'll see console logs:
- `[Cloud API]` - Cloud operations
- `[LocalStorage]` - Local storage operations
- `[Comments Config]` - Configuration info on load

## Testing Cloud Mode Locally

### Option 1: Use Local Worker
```bash
# Terminal 1: Start the worker
cd workers
wrangler dev

# Terminal 2: Start Next.js with API pointing to local worker
NEXT_PUBLIC_COMMENTS_API=http://localhost:8787/api/comments npm run dev
```

### Option 2: Use Production Worker
```bash
# Set your production worker URL
NEXT_PUBLIC_COMMENTS_API=https://sww-comments.workers.dev/api/comments npm run dev
```

## Current Configuration (Testing Cloud)
- `useLocalStorage: false` - Using cloud API
- `apiUrl: http://localhost:8787/api/comments` - Pointing to local worker
- `debugMode: true` - Console logging enabled

## Switching Back to localStorage
1. Edit `config/comments-source.ts`
2. Set `useLocalStorage: true`
3. Save the file
4. Refresh the browser

## API Requirements
The cloud API must support:
- `GET /api/comments?offset=0&limit=500` - Fetch comments
- `POST /api/comments` - Post new comment
  - Body: `{ text: string, username: string, color: string }`

## Troubleshooting

### Comments Not Loading (Cloud Mode)
1. Check if worker is running: `curl http://localhost:8787/api/comments`
2. Check browser console for errors
3. Verify `NEXT_PUBLIC_COMMENTS_API` is set correctly

### Comments Not Persisting (Local Mode)
1. Check localStorage: `localStorage.getItem('sww-comments-local')`
2. Verify localStorage is not disabled in browser
3. Check browser storage quota

## Next Steps
1. Deploy Cloudflare Worker if not already done
2. Set production `NEXT_PUBLIC_COMMENTS_API` in `.env.production`
3. Test with multiple users/browsers
4. Monitor performance and adjust polling interval if needed
