# Message Length Parameters from Reference Project (app-scaled)

## Summary Table

| Parameter | Value | Location | Description |
|-----------|-------|----------|-------------|
| **MAX_COMMENT_LENGTH** | 1000 chars | Frontend & Backend | Maximum total characters per comment message |
| **MAX_USERNAME_LENGTH** | 12 chars | Frontend & Backend | Maximum characters for username |
| **INITIAL_LOAD_COUNT** | 500 comments | Frontend | Number of comments loaded on initial page load |
| **LAZY_LOAD_BATCH** | 50 comments | Frontend | Number of additional comments loaded when scrolling |
| **RECENT_CACHE_SIZE** | 5000 comments | Backend (Worker) | Maximum comments kept in recent cache |
| **RATE_LIMIT** | 10 comments/minute | Backend (Worker) | Maximum comments per IP per minute |
| **RATE_WINDOW** | 60 seconds | Backend (Worker) | Time window for rate limiting |
| **USER_AGENT_MAX** | 100 chars | Backend (Worker) | Maximum user agent string stored |
| **POLLING_INTERVAL** | 5000ms (5 seconds) | Frontend | How often to check for new comments |
| **API_LIMIT_MAX** | 1000 comments | Backend (Worker) | Maximum comments returned in single API call |
| **LOCAL_STORAGE_WARNING** | 1000 comments | Frontend | Warning threshold for local storage |

## Implementation Details

### Frontend (CommentsStream.tsx)
```javascript
// Line 10-11
const INITIAL_LOAD_COUNT = 500;
const LAZY_LOAD_BATCH = 50;

// Line 324-325
if (totalCount > 1000) {
  setError('Total comment length cannot exceed 1000 characters');
}

// Line 338, 359
username.trim().substring(0, 12) || undefined

// Line 614
maxLength={12}  // Username input

// Line 730
maxLength={1000}  // Comment textarea
```

### Backend (comments-worker.js)
```javascript
// Line 15-16
const RATE_LIMIT = 10;
const RATE_WINDOW = 60; // seconds

// Line 35
.substring(0, 1000); // Max 1000 chars per comment

// Line 44
const cleaned = username.trim().substring(0, 12);

// Line 91
userAgent: request.headers.get('User-Agent')?.substring(0, 100) || 'unknown'

// Line 114
recent = recent.slice(-5000); // Keep last 5000 for better scroll performance

// Line 129
const limit = Math.min(parseInt(params.get('limit') || '500'), 1000);
```

## Key Differences from Our Implementation

| Feature | Reference Project | Our Project | Action Needed |
|---------|------------------|-------------|---------------|
| Comment Length | 1000 chars | 1000 chars | ✅ Same |
| Username Length | 12 chars | 12 chars | ✅ Same |
| Initial Load | 500 comments | 500 comments | ✅ Same |
| Lazy Load Batch | 50 comments | 50 comments | ✅ Same |
| Polling Interval | 5 seconds | 5 seconds | ✅ Same |
| Rate Limiting | 10/minute | Not implemented | ⚠️ Add for production |
| Recent Cache | 5000 comments | 1000 (localStorage) | ℹ️ Different due to storage type |

## Notes

1. **Comment Text**: Maximum 1000 characters, enforced both client and server side
2. **Username**: Maximum 12 characters, optional, trimmed and sanitized
3. **Performance**: Reference project keeps 5000 comments in cache but only displays 500 initially
4. **Rate Limiting**: 10 comments per minute per IP address
5. **Polling**: Checks for new comments every 5 seconds
6. **Storage Limits**: Local storage version limited to 1000 comments to avoid browser storage issues
