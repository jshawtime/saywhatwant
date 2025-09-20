# Complete Filtering System Reference
This document contains the comprehensive filtering system documentation from the main README.

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

## 🔗 Video Link Sharing

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