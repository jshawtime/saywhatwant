# Say What Want

A modern web application with video playback and real-time anonymous comments featuring advanced filtering capabilities.

## 🚀 Quick Start

```bash
# Install dependencies
npm install

# Run development server
npm run dev:clean  # Kills any existing servers and starts fresh

# Or standard dev
npm run dev
```

Visit: http://localhost:3000

## ✨ Key Features

- **Video Playback**: Auto-playing video content with seamless transitions
- **Anonymous Comments**: Real-time comment stream with customizable usernames
- **Advanced Filtering**: Multi-level content filtering system
- **Color Customization**: Personalized color themes per user
- **Video Sharing**: Share video links directly in comments

## 🎯 Filtering System

### Interactive Filtering (Click-based)

1. **Include Filters (Left-click any word)**
   - Shows ONLY comments containing selected words
   - Appears in your chosen color in the filter bar

2. **Exclude Filters (Right-click any word)**  
   - Hides ALL comments containing selected words
   - Appears with "-" prefix in dark red (#8B0000)
   - No context menu - instant filtering

3. **Username Filters (Click any username)**
   - Shows ONLY comments from selected users
   - Preserves user's original color

### URL-Based Filtering (Shareable)

The app supports powerful URL-based filtering that makes filtered views shareable and bookmarkable. All filters merge with existing filters (not replace).

#### Core URL Parameters

| Parameter | Purpose | Example |
|-----------|---------|---------|
| `u=` | Filter by username | `#u=alice+bob` (alice OR bob) |
| `search=` | Populate search bar | `#search=hello+world` |
| `word=` | Include word filters | `#word=react+javascript` |
| `-word=` | Exclude word filters | `#-word=spam+inappropriate` |
| `wordremove=` | Silently hide words | `#wordremove=spoiler+leak` |
| `video=` | Control video playlist | `#video=sample1+sample2` |
| `from=` | Start date/time | `#from=T60` or `#from=2025-01-19` |
| `to=` | End date/time | `#to=now` or `#to=2025-01-20T14:30` |
| `timeFrom=` | Minutes ago (alt syntax) | `#timeFrom=60` |
| `timeTo=` | Minutes ago (alt syntax) | `#timeTo=0` |

#### URL Syntax Rules

- **`#`** - Starts the filter section
- **`&`** - Separates different filter types (AND logic)
- **`+`** - Joins multiple values within same type (OR logic)
- **`=`** - Assigns values to parameters

#### Date/Time Filtering

The system supports flexible date/time filtering with multiple formats:

**Relative Time** (T notation):
- `T60` = 60 minutes ago
- `T1440` = 24 hours ago 
- `T0` or `now` = Current time

**Absolute Dates**:
- `2025-01-19` = January 19, 2025
- `2025-01-19T14:30` = January 19, 2025 at 2:30 PM

**Keywords**:
- `now`, `today`, `yesterday`, `week`, `month`

#### URL Examples

```bash
# Simple search
http://localhost:3000/#search=hello

# Multiple filters
http://localhost:3000/#u=alice+bob&word=javascript

# Complex filtering
http://localhost:3000/#u=teacher&search=question&-word=spam&wordremove=inappropriate

# Study session
http://localhost:3000/#u=instructor+assistant&search=homework&video=lesson1

# Last hour of messages
http://localhost:3000/#from=T60&to=now

# Specific date range
http://localhost:3000/#from=2025-01-19&to=2025-01-20

# Yesterday's messages from Alice
http://localhost:3000/#from=yesterday&to=today&u=alice

# Complex with date/time
http://localhost:3000/#from=T1440&to=now&u=team&search=bug&word=critical
```

📚 See [Date & Time Filtering Guide](./README/DATE-TIME-FILTERING.md) for complete documentation.

#### Special Features

- **Search Bar Integration**: `search=` populates the search bar, not filter tags
- **Silent Removal**: `wordremove=` hides content without showing filter tags
- **Merge Behavior**: URL filters ADD to existing filters, not replace
- **Normalization**: Usernames are case-insensitive, alphanumeric only
- **Browser Navigation**: Back/forward buttons work with filter history

### Filter Controls
- **Toggle Switch**: Enable/disable all filters (filters appear dimmed when disabled)
- **Individual Remove**: Click X on any filter to remove it
- **Persistent**: All filters save to localStorage
- **Visual States**: Active filters are bright, inactive filters are 40% opacity

## 🔧 Technical Implementation: SSR & Hydration

### The Challenge: URL Filters with Server-Side Rendering

When implementing URL-based filtering in a Next.js app with SSR, we encountered hydration mismatches. Here's why and how we solved it:

#### The Problem
- **Server**: Cannot access `window.location.hash`, renders with empty filter state
- **Client**: Can access URL, initializes with parsed filters
- **Result**: Different initial renders = React hydration error ❌

#### The Solution: Deferred Initialization

1. **Consistent Initial State**
   ```javascript
   // ALWAYS start with empty state on both server and client
   const [urlState] = useState(emptyState);
   
   // Parse URL ONLY after mount
   useEffect(() => {
     if (typeof window === 'undefined') return;
     const manager = URLFilterManager.getInstance();
     setUrlState(manager.getCurrentState());
   }, []);
   ```

2. **Lazy URLFilterManager Initialization**
   ```javascript
   class URLFilterManager {
     private initialized = false;
     
     private initialize() {
       if (this.initialized || typeof window === 'undefined') return;
       // Only parse URL and set up listeners after explicit initialization
       this.handleHashChange();
     }
   }
   ```

3. **Time-Sensitive Content Handling**
   ```javascript
   // Timestamps that change between server/client renders
   const [mounted, setMounted] = useState(false);
   
   useEffect(() => setMounted(true), []);
   
   // Render placeholder during SSR
   <span>{mounted ? formatTimestamp(time) : '...'}</span>
   ```

#### Key Insights

- **Never parse URLs in constructors or initial state functions**
- **Always defer browser-specific code until after mount**
- **Use placeholder content for dynamic/time-based values**
- **Ensure both server and client start with identical state**

This approach ensures:
- ✅ No hydration errors
- ✅ URL filters work correctly
- ✅ SEO-friendly server rendering
- ✅ Clean separation of concerns

## 📁 Project Structure

```
say-what-want/
├── app/                     # Next.js app directory
│   └── page.tsx            # Main page
├── components/             # React components
│   ├── CommentsStream.tsx  # Main comments component
│   ├── FilterBar.tsx       # Filter UI component
│   └── VideoPlayer.tsx     # Video player component
├── hooks/                  # Custom React hooks
│   └── useFilters.ts       # Filter logic hook
├── utils/                  # Utility functions
│   └── textParsing.tsx     # Text parsing & word clicking
├── config/                 # Configuration files
│   └── video-source.ts     # Video source toggle (local/R2)
├── public/                
│   └── sww-videos/         # Local video storage
├── scripts/                # Utility scripts
└── workers/                # Cloudflare Workers (production)
```

## 🎬 Video System

### Development (Local Videos)

1. Add video files to `public/sww-videos/`
2. Generate manifest: `npm run manifest:local`
3. Videos are served from local folder

### Production (R2 Bucket)

To switch to R2 for production:

1. **Toggle Configuration** in `config/video-source.ts`:
```typescript
export const VIDEO_SOURCE_CONFIG = {
  useLocal: false,  // ← Change from true to false
  // ...
};
```

2. **Set R2 Environment Variable**:
```bash
# .env.production or .env.local
NEXT_PUBLIC_R2_BUCKET_URL=https://your-bucket.r2.dev
```

3. **Upload Videos to R2**:
   - Create R2 bucket named `sww-videos` (same as local folder)
   - Upload all video files to the bucket
   - Generate manifest: `npm run manifest:generate`

### Video Sharing in Comments

Users can share the currently playing video:
1. Click the "Share" button in the video player
2. Text `<-- video` appears in the input (hyperlinked)
3. Submit the comment
4. Other users can click the video link to play that video with loop enabled

## 💬 Comments System

### Development (Browser localStorage)

Comments are stored directly in the browser during development:
- **Storage**: Browser's localStorage (no server needed)
- **Persistence**: Comments persist across page refreshes
- **Username Required**: Must enter username before posting (16 chars max)
- **Storage Key**: `sww-comments-local`
- **Comment Length**: Maximum 201 characters per comment
- **Limit**: Maximum 1000 comments stored locally
- **Cross-Tab**: Updates sync between tabs automatically

### Production (Cloudflare Workers)

To switch to Cloudflare Workers for production:

1. **Update Environment Variable**:
```bash
# .env.production
NEXT_PUBLIC_COMMENTS_API=https://your-worker.workers.dev/api/comments
```

2. **Deploy Cloudflare Worker**:
```bash
cd workers
wrangler deploy comments-worker.js
```

3. **Configure KV Storage**:
```bash
# Create KV namespace
wrangler kv:namespace create "COMMENTS_KV"

# Update wrangler.toml with namespace ID
```

## 🎨 Color System

The app uses a dynamic color system where each user can select their personalized color. All colors are derived from a single user-selected base color.

### Color Selection
- Click the user icon next to username field to open color picker
- Press 'R' key for a random color
- Colors persist in localStorage

### Color Brightness Levels

| Brightness | Usage | Elements |
|------------|-------|----------|
| **100%** | Primary elements | • Person icon<br>• Message text<br>• Send button icon<br>• Typed text in input<br>• Word filters |
| **70%** | Time tag text | • Time tag labels |
| **60%** | Secondary text | • Username in comments<br>• Username input field<br>• "Say what you want..." placeholder<br>• Character counter<br>• Send button background<br>• Username clear button |
| **30%** | Borders | • Time tag border<br>• Filter bar scrollbar |
| **8%** | Subtle backgrounds | • Time tag background |
| **Dark Red** | Negative filters | • Excluded word filters (-word) |

### Implementation Architecture

The color system is modularized into utilities:
- `utils/textParsing.tsx`: Contains `getDarkerColor()` function
- Each component receives color as prop
- Colors calculated dynamically from user's base color

## 🛠️ Available Scripts

### Development
- `npm run dev` - Start development server
- `npm run dev:clean` - Kill existing servers and start fresh
- `npm run build` - Build for production
- `npm run start` - Start production server

### Video Management
- `npm run manifest:local` - Generate manifest for local videos
- `npm run manifest:generate` - Generate manifest for R2 bucket

### Comments Management (Browser Console)
Since comments are stored in localStorage, use browser console:
```javascript
// Clear all comments
localStorage.removeItem('sww-comments-local')

// View all comments
JSON.parse(localStorage.getItem('sww-comments-local'))

// Export comments
copy(localStorage.getItem('sww-comments-local'))

// Import comments (paste JSON string)
localStorage.setItem('sww-comments-local', 'YOUR_JSON_HERE')

// Clear filters
localStorage.removeItem('sww-filters')
localStorage.removeItem('sww-word-filters')
localStorage.removeItem('sww-negative-filters')
```

### Deployment
- `npm run deploy` - Deploy to Cloudflare Pages
- `npm run worker:deploy` - Deploy Cloudflare Worker

## 🔄 Development to Production Checklist

### Before Deploying:

- [ ] **Videos**: Switch `useLocal` to `false` in `config/video-source.ts`
- [ ] **Videos**: Set `NEXT_PUBLIC_R2_BUCKET_URL` environment variable
- [ ] **Videos**: Upload videos to R2 bucket named `sww-videos`
- [ ] **Comments**: Set `NEXT_PUBLIC_COMMENTS_API` to your Worker URL
- [ ] **Comments**: Deploy Cloudflare Worker with `npm run worker:deploy`
- [ ] **Comments**: Configure KV namespace for comments storage
- [ ] **Build**: Run `npm run build` to verify production build
- [ ] **Deploy**: Run `npm run deploy` to deploy to Cloudflare Pages

## 🌐 Environment Variables

### Development (.env.local)
```env
# No environment variables needed for development
# Comments use localStorage
# Videos use local folder based on config toggle
```

### Production (.env.production)
```env
# Comments - Cloudflare Worker
NEXT_PUBLIC_COMMENTS_API=https://your-worker.workers.dev/api/comments

# Videos - R2 Bucket
NEXT_PUBLIC_R2_BUCKET_URL=https://your-bucket.r2.dev
```

## 🚧 Planned Features & Roadmap

### Additional URL Parameters (Planned)
- **Message Length**: `length=short/medium/long` - Filter by comment length
- **Content Type**: `has=video/link/emoji` - Find specific content types
- **User Exclusion**: `-u=username` - Hide specific users (opposite of `u=`)
- **Sorting**: `sort=newest/oldest/popular` - Different viewing orders
- **Limits**: `limit=50` - Performance optimization for large datasets

See [Additional URL Features](./README/ADDITIONAL-URL-FEATURES.md) for the complete roadmap.

## 📝 Notes

- **Videos**: Local folder `public/sww-videos/` has the same name as the R2 bucket for consistency
- **Comments**: Development uses browser localStorage (persists in browser)
- **Toggle**: Single boolean switch for local vs production in `config/video-source.ts`
- **Username Required**: Comments require a username (16 chars max) before posting
- **Storage**: Comments are stored in browser's localStorage during development
- **Filtering**: Filters persist across sessions in localStorage

## 🚦 Testing

1. **Test Local Videos**: Add videos to `public/sww-videos/` and run `npm run manifest:local`
2. **Test Comments**: Post comments in the app - they're saved in browser's localStorage
3. **Test Filtering**: Left-click words to include, right-click to exclude
4. **Test Production**: Set environment variables and test with production config

### To Test Comments in Browser Console:
```javascript
// View stored comments
JSON.parse(localStorage.getItem('sww-comments-local'))

// Clear all comments
localStorage.removeItem('sww-comments-local')

// View active filters
JSON.parse(localStorage.getItem('sww-filters'))       // Username filters
JSON.parse(localStorage.getItem('sww-word-filters'))  // Word filters
JSON.parse(localStorage.getItem('sww-negative-filters')) // Exclude filters

// Add test comment programmatically
const comments = JSON.parse(localStorage.getItem('sww-comments-local') || '[]');
comments.push({
  id: Date.now() + '-test',
  text: 'Test comment',
  timestamp: Date.now(),
  username: 'Tester',
  color: '#60A5FA'
});
localStorage.setItem('sww-comments-local', JSON.stringify(comments));
```

## 🆘 Troubleshooting

### Videos not playing?
- Check if videos are in `public/sww-videos/`
- Run `npm run manifest:local` to regenerate manifest
- Verify `useLocal: true` in development

### Comments not saving?
- Make sure you've entered a username (field flashes cyan if empty)
- Check browser console for errors
- Try clearing localStorage: `localStorage.removeItem('sww-comments-local')`
- Verify localStorage is enabled in your browser

### Filters not working?
- Ensure filter toggle switch is ON (filters should be bright, not dimmed)
- Check if filters are saved: `JSON.parse(localStorage.getItem('sww-word-filters'))`
- Clear all filters: Run the localStorage.removeItem commands for filters

### Production issues?
- Verify environment variables are set
- Check Cloudflare Worker is deployed
- Ensure R2 bucket permissions are correct

## 📚 Documentation

For detailed implementation guides, see:
- [Comments System Guide](README/soundtrip-comments-system.md)
- [SoundTrip Best Practices](README/SoundTrip-Best-Practices.md)
- [Deployment Guide](README/DEPLOYMENT.md)

## 🏗️ Recent Updates

### Filtering System (Latest)
- Added word-level filtering with left-click (include) and right-click (exclude)
- Modularized filter logic into `useFilters` custom hook
- Created separate `FilterBar` component for better organization
- Added visual feedback for inactive filters (40% opacity when disabled)
- Implemented negative filters with dark red styling

### Code Refactoring
- Extracted text parsing utilities to `utils/textParsing.tsx`
- Reduced CommentsStream.tsx from 1100 to 849 lines (23% reduction)
- Improved separation of concerns with modular components
- Added TypeScript interfaces for better type safety

## 📄 License

Private project - All rights reserved
