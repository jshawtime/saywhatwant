# URL Filtering System for Say What Want

## 📋 Overview

A comprehensive hash-based URL filtering system for Say What Want, inspired by the app-scaled reference project. This system enables dynamic content filtering through URL parameters, making filter states shareable, bookmarkable, and integrated with browser navigation.

## 🎯 Core Philosophy

1. **URL as Single Source of Truth** - The URL completely defines the application state
2. **Shareable & Bookmarkable** - Any filtered state can be shared via URL
3. **Browser Navigation Works** - Back/forward buttons navigate through filter history
4. **First Parameter Wins** - For boolean flags, the first occurrence takes precedence
5. **Composable Filters** - Multiple filters work together seamlessly
6. **Merge Strategy** - UI clicks merge with existing URL state (not replace)

## 📐 URL Structure

### Base Format
```
https://saywhatwant.com/#u=alice+bob&search=hello&word=awesome&video=sample1
```

### 🔑 Critical Syntax Rules

#### **`&` = AND (Separates Different Filter Types)**
```
#search=hello&u=pinecone&word=awesome
       ↑         ↑           ↑
   search     AND user    AND word
```
This means: Show comments that contain "hello" AND are from user "pinecone" AND contain "awesome"

#### **`+` = OR (Joins Multiple Values Within Same Type)**
```
#search=hello+world&u=alice+bob
         ↑    ↑        ↑    ↑
    hello OR world   alice OR bob
```
This means: Show comments containing ("hello" OR "world") AND from ("alice" OR "bob")

### ⚠️ Common Syntax Mistakes

❌ **WRONG**: `#search=hello+world#u=pinecone`
- Don't use `#` to separate filter types

❌ **WRONG**: `#search=hello+world+u=pinecone`
- Don't mix filter types with `+`

✅ **CORRECT**: `#search=hello+world&u=pinecone`
- Use `&` between different filter types
- Use `+` only within the same filter type

### 📚 Comprehensive URL Examples

#### Simple Single Filter
```
#u=alice
→ Show only alice's comments

#search=javascript
→ Show comments containing "javascript"

#word=amazing
→ Show comments with the word "amazing"
```

#### Multiple Values (OR Logic)
```
#u=alice+bob+charlie
→ Show comments from alice OR bob OR charlie

#search=react+vue+angular
→ Show comments containing "react" OR "vue" OR "angular"

#video=sample1+sample2+sample3
→ Play sample1, sample2, OR sample3 videos in rotation
```

#### Multiple Filter Types (AND Logic)
```
#u=alice&word=hello
→ Show alice's comments that contain "hello"

#search=tutorial&u=instructor&video=lesson1
→ Show instructor's comments containing "tutorial" while playing lesson1

#word=question&u=alice+bob&-word=spam
→ Show comments from alice OR bob containing "question" but NOT "spam"
```

#### Complex Combined Filters
```
#u=alice+bob&search=react+javascript&word=help+question&video=tutorial
```
This means:
- From users: alice OR bob
- AND containing: "react" OR "javascript"
- AND having words: "help" OR "question"
- AND playing: tutorial video

```
#search=party+music&u=dj1+dj2+dj3&-word=boring+slow&video=party1+party2
```
This means:
- Comments containing: "party" OR "music"
- AND from users: dj1 OR dj2 OR dj3
- AND NOT containing: "boring" OR "slow"
- AND playing: party1 OR party2 videos

### 🎯 URL Building Logic

When building URLs programmatically:

```javascript
// Start with base
let url = '#';

// Add users (OR logic with +)
if (users.length > 0) {
  url += 'u=' + users.join('+');
}

// Add search terms (AND logic with &, OR logic with +)
if (searchTerms.length > 0) {
  if (url.length > 1) url += '&';
  url += 'search=' + searchTerms.join('+');
}

// Add word filters
if (words.length > 0) {
  if (url.length > 1) url += '&';
  url += 'word=' + words.join('+');
}

// Result: #u=alice+bob&search=hello+world&word=awesome+amazing
```

### Summary
- **Hash-based routing** (`#`) - Starts the filter section
- **Parameter separator** (`&`) - Separates different filter types (AND logic)
- **Value joiner** (`+`) - Joins multiple values within same type (OR logic)
- **Assignment** (`=`) - Assigns values to parameters

### 📊 Quick Syntax Reference Table

| Symbol | Purpose | Example | Meaning |
|--------|---------|---------|---------|
| `#` | Start filters | `#u=alice` | Begin filter section |
| `&` | AND (between types) | `u=alice&word=hello` | Alice's comments AND containing "hello" |
| `+` | OR (within type) | `u=alice+bob` | Alice OR bob |
| `=` | Assign value | `search=term` | Set search to "term" |
| `-` | Negative filter | `-word=spam` | NOT containing "spam" |

### 📝 Filter Combination Rules

| Pattern | Meaning | Example |
|---------|---------|---------|
| `type1=a&type2=b` | Type1 AND Type2 | `u=alice&word=hello` → Alice AND "hello" |
| `type=a+b` | a OR b (same type) | `u=alice+bob` → Alice OR Bob |
| `type=a+b&type2=c` | (a OR b) AND c | `u=alice+bob&word=hi` → (Alice OR Bob) AND "hi" |
| `type=a&type=b` | First wins (a only) | `u=alice&u=bob` → Only Alice |

## 🔧 Normalization Rules

**CRITICAL**: All matching uses aggressive normalization:
- **Case insensitive** - `Alice` = `alice` = `ALICE`
- **Alphanumeric only** - Strips ALL spaces, punctuation, special characters
- **Only letters & numbers** - `@alice_123!` becomes `alice123`

```javascript
function normalize(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')  // Remove ALL non-alphanumeric
    .trim();
}

// Examples:
normalize("@Alice_123!")  // → "alice123"
normalize("Bob's Place")  // → "bobsplace"
normalize("hey-there")    // → "heythere"
```

## 📋 Filter Parameters

### 1. **User Filtering** (`u=`)
Shows only comments from specified users.

```
#u=alice
→ Show only comments from alice

#u=alice+bob+charlie
→ Show comments from alice, bob, OR charlie

#u=alice&u=bob
→ First wins principle: only alice (prevents duplicates)
```

**Visual**: User tags appear with their associated color from the chat

### 2. **Search Filtering** (`search=`)
Shows comments containing search terms.

```
#search=hello
→ Show comments containing "hello"

#search=hello+world+awesome
→ Show comments containing "hello" OR "world" OR "awesome"

#search=hello%20world
→ URL encoded: searches for "hello world" as exact phrase
```

**Visual**: Yellow tags with 🔍 icon

### 3. **Word Filtering** (`word=`)
Shows comments containing specific words.

```
#word=amazing
→ Show comments containing the word "amazing"

#word=amazing+incredible+awesome
→ Show comments with ANY of these words

#word=hello&search=world
→ Combined: comments with "hello" AND containing "world"
```

**Visual**: Green tags (existing word filter style)

### 4. **Negative Word Filtering** (`-word=`)
Hides comments containing specified words.

```
#-word=spam
→ Hide comments containing "spam"

#-word=spam+inappropriate+rude
→ Hide comments with ANY of these words

#word=good&-word=bad
→ Show "good" comments but hide if they contain "bad"
```

**Visual**: Dark red tags with `-` prefix

### 5. **Video Playlist Control** (`video=`)
Controls which videos play and in what order.

```
#video=sample1
→ Play only sample1.mp4 in loop (uses video key)

#video=sample1+sample2+nature
→ Create playlist with these 3 videos, loop through them

#video=random
→ Special keyword: random video selection

#video=none
→ Special keyword: no video playing
```

**Visual**: Purple tags with 🎬 icon

### 6. **Video Panel Visibility** (`video=true/false`)
Controls video panel display state.

```
#video=true
→ Open video panel (if not already open)

#video=false
→ Close video panel

#video=true&video=false
→ First wins: panel opens

#video=sample1
→ Implicitly opens panel (smart behavior when video specified)
```

## 🔄 Real-World URL Examples

### Understanding the Syntax in Action

#### ✅ Example: Teacher Monitoring Discussion
```
#u=teacher&search=question+help+confused
```
**Breakdown:**
- `u=teacher` → Show ONLY teacher's comments
- `&` → AND
- `search=question+help+confused` → comments containing "question" OR "help" OR "confused"
- **Result**: Teacher's comments that contain any help-related terms

#### ✅ Example: Multi-User Conversation
```
#u=alice+bob+charlie&word=meeting
```
**Breakdown:**
- `u=alice+bob+charlie` → Show comments from alice OR bob OR charlie
- `&` → AND
- `word=meeting` → comments containing "meeting"
- **Result**: Meeting-related comments from any of the three users

#### ✅ Example: Filtered Learning Session
```
#video=lesson1&u=instructor+assistant&search=explain+clarify&-word=offtopic+spam
```
**Breakdown:**
- `video=lesson1` → Play lesson1 video
- `&` → AND
- `u=instructor+assistant` → Show comments from instructor OR assistant
- `&` → AND
- `search=explain+clarify` → containing "explain" OR "clarify"
- `&` → AND
- `-word=offtopic+spam` → but NOT containing "offtopic" OR "spam"
- **Result**: Focused educational content from instructors without distractions

### Common Use Cases

#### 📚 Study Group
```
#u=prof+ta1+ta2&search=homework+assignment+due&video=lecture5
```
- Shows professor and TAs' comments
- About homework or assignments
- While watching lecture 5

#### 🎉 Party Stream
```
#search=music+dance+party&-word=boring+slow&video=party1+party2+party3
```
- Shows party-related comments
- Excludes boring/slow mentions
- Cycles through party videos

#### 🛡️ Moderated View
```
#u=mod1+mod2+admin&search=announcement+update+important
```
- Shows only moderator/admin messages
- Focused on announcements and updates

#### 🎮 Gaming Session
```
#u=streamer&word=gg+clutch+epic&video=gameplay1
```
- Shows streamer's comments
- Highlighting game moments
- With gameplay video

#### 🔍 Debugging Discussion
```
#search=error+bug+issue&u=dev1+dev2+dev3&-word=fixed+resolved
```
- Shows error/bug discussions
- From specific developers
- Excluding already resolved issues

## 🏗️ System Architecture

### Core Components

#### 1. **URLFilterManager (Singleton)**
```typescript
class URLFilterManager {
  private static instance: URLFilterManager;
  private subscribers: Set<(state: SWWFilterState) => void>;
  
  // Core methods
  parseHash(): SWWFilterState
  buildURL(state: SWWFilterState): string
  updateURL(updates: Partial<SWWFilterState>): void
  subscribe(callback: (state) => void): () => void
  
  // Normalization
  normalize(text: string): string
  
  // History management
  pushState(state: SWWFilterState): void
  replaceState(state: SWWFilterState): void
}
```

#### 2. **Filter State Interface**
```typescript
interface SWWFilterState {
  users: string[];           // Usernames to show
  searchTerms: string[];     // Search terms (OR)
  words: string[];          // Positive word filters (OR)
  negativeWords: string[];  // Negative word filters (OR)
  videoPlaylist: string[];  // Video keys to play
  videoPanel: boolean | null; // Panel visibility
  
  // Future additions
  dateRange?: [string, string];
  messageTypes?: string[];
  replyChains?: boolean;
}
```

#### 3. **useURLFilter Hook**
```typescript
function useURLFilter() {
  const [urlState, setUrlState] = useState<SWWFilterState>();
  
  // Subscribe to URL changes
  useEffect(() => {
    const unsubscribe = URLFilterManager.subscribe(setUrlState);
    return unsubscribe;
  }, []);
  
  // Merge with existing filters
  const mergedFilters = useMemo(() => {
    // Combine URL filters with UI filters
    // URL filters have priority
  }, [urlState, uiFilters]);
  
  return {
    filters: mergedFilters,
    addUserFilter,
    removeUserFilter,
    addSearchTerm,
    removeSearchTerm,
    // ... etc
  };
}
```

## 🔄 State Synchronization

### Two-Way Binding
1. **URL → UI**: When URL changes, update filter bar and apply filters
2. **UI → URL**: When user clicks/types filter, update URL

### Merge Behavior
When user clicks a filter in the UI:
```javascript
// Current URL: #u=alice&word=hello
// User clicks to add bob
// Result: #u=alice+bob&word=hello (MERGED, not replaced)
```

### Priority Order
```
1. URL parameters (highest priority on initial load)
2. User interactions (merge with URL)
3. localStorage (fallback when no URL params)
```

## 📊 Data Flow

```
User enters URL with filters
    ↓
URLFilterManager.parseHash()
    ↓
Creates SWWFilterState object
    ↓
useURLFilter hook receives state
    ↓
Updates three systems in parallel:
    ├→ FilterBar (visual tags with colors)
    ├→ Comments filtering (apply to stream)
    └→ Video playlist (update player)
    ↓
User clicks filter tag to remove
    ↓
URLFilterManager.updateURL() merges change
    ↓
Browser URL changes (no reload)
    ↓
Cycle repeats
```

## 🎨 Visual Integration

### Filter Tag Styling
- **User filters**: User's chat color with @ prefix
- **Search terms**: Yellow tags with 🔍 icon  
- **Word filters**: Green tags (existing style)
- **Negative filters**: Dark red tags with - prefix
- **Video playlist**: Purple tags with 🎬 icon

### User Color Integration
```javascript
// When rendering user filter tags
function UserFilterTag({ username }) {
  const userColor = getUserColor(username); // Get from chat system
  
  return (
    <span 
      className="filter-tag filter-tag-user"
      style={{ 
        borderColor: `${userColor}40`,  // 40 = opacity
        color: userColor 
      }}
    >
      @{username}
    </span>
  );
}
```

## ❓ Clear Behavior Clarification

### Different Clear Actions

1. **Clear All Button**
   - Removes ALL filters
   - Updates URL to base URL (no hash)
   - Clears localStorage filters
   - Returns to default unfiltered state
   ```
   Before: #u=alice&word=hello&video=sample1
   After: # (or no hash at all)
   ```

2. **Individual X Button**
   - Removes only that specific filter
   - Updates URL to exclude that filter
   - Other filters remain active
   ```
   Before: #u=alice+bob&word=hello
   Click X on alice
   After: #u=bob&word=hello
   ```

3. **Filter Toggle Switch**
   - Temporarily disables filtering
   - URL remains unchanged
   - Visual indication (filters appear dimmed)
   - Re-enabling restores previous filters
   ```
   URL stays: #u=alice&word=hello
   Visual: Filter tags become 40% opacity
   Filtering: Temporarily shows all comments
   ```

## 🚀 Default State Behavior

When no URL parameters are present:
1. Show all comments (no filtering)
2. Play default/random videos
3. Video panel in default state (open/closed per user preference)
4. Filter bar shows placeholder text
5. localStorage preferences still apply (username, color, etc.)

## 📈 Performance Considerations

### Optimization Strategies
1. **Debounce URL Updates** - 300ms delay to batch rapid changes
2. **Memoize Filter Results** - Cache filtered comments
3. **Normalize Once** - Cache normalized versions
4. **Lazy Video Loading** - Load videos only when needed

### URL Length Management
- Browser limit: ~2000 characters
- If approaching limit:
  - Use shortened video keys
  - Implement URL shortening service
  - Store complex filters server-side with ID reference

## 🔧 Extensibility

### Adding New Filter Types
Simply extend the `SWWFilterState` interface:
```typescript
interface SWWFilterState {
  // Existing...
  users: string[];
  
  // New additions (examples)
  messageLength?: 'short' | 'medium' | 'long';
  hasVideo?: boolean;
  language?: string[];
  sentiment?: 'positive' | 'negative' | 'neutral';
}
```

Then add parsing/building logic:
```javascript
// In parseHash()
if (key === 'length') {
  state.messageLength = value;
}

// In buildURL()
if (state.messageLength) {
  params.push(`length=${state.messageLength}`);
}
```

## 🚦 Implementation Roadmap

### Phase 1: Core Infrastructure
- [ ] Create URLFilterManager singleton
- [ ] Implement normalize() function
- [ ] Set up hash parsing/building
- [ ] Add browser event listeners

### Phase 2: Basic Integration
- [ ] Create useURLFilter hook
- [ ] Merge with existing useFilters
- [ ] Update FilterBar for URL filters
- [ ] Implement two-way binding

### Phase 3: Filter Types
- [ ] User filtering with colors
- [ ] Search terms
- [ ] Word filters (positive)
- [ ] Negative word filters
- [ ] Video playlist control

### Phase 4: Enhanced Features
- [ ] Video panel control
- [ ] Date range filtering
- [ ] Message type filtering
- [ ] Reply chain filtering

### Phase 5: Polish
- [ ] Performance optimizations
- [ ] URL shortening
- [ ] Export/import filter sets
- [ ] Filter presets/templates

## 🎯 Success Criteria

- ✅ URLs are shareable and work instantly
- ✅ Browser back/forward navigation works
- ✅ Filters merge (not replace) on UI interaction
- ✅ Visual feedback with user colors
- ✅ Normalized matching (case/punctuation insensitive)
- ✅ Video keys (not full paths) in URLs
- ✅ Clear behavior is intuitive
- ✅ Default state shows unfiltered content
- ✅ System is easily extensible

## 📚 Implementation Examples

### Example: Adding a User Filter
```javascript
// User clicks on username "Alice"
URLFilterManager.updateURL({
  users: [...currentUsers, 'alice']  // Merge with existing
});

// URL changes from:
#word=hello
// To:
#word=hello&u=alice
```

### Example: Removing a Filter
```javascript
// User clicks X on "bob" filter tag
URLFilterManager.updateURL({
  users: currentUsers.filter(u => u !== 'bob')
});

// URL changes from:
#u=alice+bob+charlie
// To:
#u=alice+charlie
```

### Example: Clear All Filters
```javascript
// User clicks "Clear All"
URLFilterManager.clearAll();

// URL changes from:
#u=alice&word=hello&video=sample1
// To:
(no hash)
```

## 🎬 Conclusion

This URL Filtering System will transform Say What Want into a highly shareable, bookmarkable experience where users can easily share specific filtered views of the chat and video content. By following the proven patterns from the app-scaled project while adapting them for Say What Want's specific needs, we create a powerful yet intuitive filtering system that enhances user engagement and content discovery.

The system is designed to be:
- **User-friendly**: Intuitive URL structure that users can manually edit
- **Developer-friendly**: Easy to extend with new filter types
- **Performance-conscious**: Optimized for real-time filtering
- **Future-proof**: Extensible architecture for new features
