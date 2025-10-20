# Cloud API Client Module

## 🤖 Quick Context
This module centralizes all interactions with the Cloudflare Worker API.

## Location
`/modules/cloudApiClient.ts`

## Functions Exported

### Core Functions
- `fetchCommentsFromCloud(offset, limit)` - Fetch paginated comments
- `postCommentToCloud(comment)` - Submit new comment  
- `isCloudAPIEnabled()` - Check if using cloud vs localStorage
- `getAPIUrl()` - Get configured API endpoint

### Future Functions (Stubbed)
- `deleteCommentFromCloud(commentId)` - Delete comment
- `updateCommentInCloud(commentId, updates)` - Edit comment
- `checkAPIHealth()` - Health check endpoint

## Usage in CommentsStream

### Before (inline in CommentsStream.tsx):
```typescript
// 30+ lines of fetch logic repeated
const response = await fetch(COMMENTS_CONFIG.apiUrl, {
  method: 'POST',
  // ... lots of config
});
```

### After (using module):
```typescript
import { postCommentToCloud } from '@/modules/cloudApiClient';

const savedComment = await postCommentToCloud(commentData);
```

## Benefits
1. **Single Responsibility** - API logic separated from UI
2. **Reusability** - Can be used by any component
3. **Testability** - Easy to mock for unit tests
4. **Maintainability** - API changes in one place
5. **Type Safety** - Proper TypeScript interfaces

## Configuration
Uses `COMMENTS_CONFIG` from `/config/comments-source.ts`:
- `apiUrl` - Endpoint URL
- `useLocalStorage` - Toggle cloud vs local
- `debugMode` - Console logging
- `initialLoadCount` - Default page size

## Error Handling
- Throws errors for failed requests
- Logs to console in debug mode
- Preserves HTTP status codes

## Future Enhancements
- Retry logic with exponential backoff
- Request caching
- Optimistic updates
- WebSocket support for real-time
- Batch operations
