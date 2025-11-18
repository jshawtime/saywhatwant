# URL Filter Merge Behavior Documentation

## Core Principle: **ALWAYS MERGE, NEVER REPLACE**

All URL-based filtering in Say What Want follows a strict merge-only policy. This ensures users never lose their carefully curated filters.

## 🎯 URL Controls Filter State

### Filter State Logic
- **URL WITH filters** (`#u=alice:255000000`) → Filter is **ON** (active)
- **URL WITHOUT filters** (`https://saywhatwant.app`) → Filter is **OFF** (inactive)
- **Filters in bar** → **ALWAYS PRESERVED** (ready to reactivate)

### Bi-directional Sync
- **URL → Filter State**: URL controls whether filters are active
- **Toggle ON → URL**: Manually turning filters ON adds them to URL
- **Toggle OFF → URL**: Manually turning filters OFF clears the URL

This creates a complete sync:
- Visit plain URL = See full unfiltered feed
- Add URL filters = See filtered view
- Remove URL filters = Return to full feed (filters saved but inactive)
- Toggle filters ON = URL updates to show active filters
- Toggle filters OFF = URL clears (but filters stay in bar)

### Examples

```
1. Visit: https://saywhatwant.app/#u=alice:255000000
   - Filter bar: [alice] 
   - Filter state: ON ✅
   - View: Only alice's messages

2. Navigate to: https://saywhatwant.app
   - Filter bar: [alice] (still there!)
   - Filter state: OFF ❌
   - View: ALL messages (unfiltered)
   
3. Click LED button to toggle ON:
   - URL changes to: https://saywhatwant.app/#u=alice:255000000
   - Filter bar: [alice]
   - Filter state: ON ✅
   - View: Only alice's messages
   
4. Add another filter: https://saywhatwant.app/#u=bob:000255000
   - Filter bar: [alice, bob] (merged!)
   - Filter state: ON ✅
   - View: Only alice and bob's messages
   
5. Click LED button to toggle OFF:
   - URL changes to: https://saywhatwant.app
   - Filter bar: [alice, bob] (preserved!)
   - Filter state: OFF ❌
   - View: ALL messages
   
6. Click LED button to toggle ON again:
   - URL changes to: https://saywhatwant.app/#u=alice:255000000+bob:000255000
   - Filter bar: [alice, bob]
   - Filter state: ON ✅
   - View: Both users' messages
```

## 🔄 Filter Bar Merge Behavior

### Client-Side URL Filters (`#u=`, `#word=`, etc.)
- **Behavior**: MERGE with existing filter bar
- **Example**: 
  - Filter bar has: `alice`, `bob`
  - URL adds: `#u=charlie:255000000`
  - Result: Filter bar shows `alice`, `bob`, `charlie`
- **Never replaces** existing filters
- **Duplicates prevented** automatically

### Server-Side User Search (`#uss=`)
- **Behavior**: MERGE messages AND filter bar
- **Use Case**: Catch up on messages missed while tab was closed
- **Example**:
  - You have 100 messages displayed
  - URL has: `#uss=alice:255000000`
  - Server finds 20 messages from alice
  - Result: 120 messages total (merged), alice added to filter bar
- **Never replaces** existing messages or filters

## 📊 Merge Logic Details

### 1. **Filter Bar Merging**

```typescript
// All URL filters are additive
Current filters: [alice, bob]
URL adds: #u=charlie:255000000&word=javascript
Result: [alice, bob, charlie] + [javascript]
```

### 2. **Message Merging (Server-Side Search)**

```typescript
// Server results merge with existing messages
Current messages: [msg1, msg2, msg3, ...]  // 100 messages
Server search: #uss=alice:255000000        // Returns 20 messages
Result: [msg1, msg2, msg3, ..., alice_msg1, alice_msg2, ...]  // 120 messages
```

### 3. **Deduplication**
- Messages are deduplicated by `id`
- Filters are deduplicated by username/word
- Color changes are preserved (latest wins)

## 🎯 Use Cases

### Scenario 1: Resuming After Break
```
1. You close your tab at 2pm with filters: [alice, bob]
2. Alice and Bob send 30 messages while you're away
3. You reopen at 5pm with URL: #uss=alice:255000000+bob:000255000
4. Result: Those 30 missed messages are fetched and merged
5. Filter bar still shows: [alice, bob]
```

### Scenario 2: Sharing Filtered View
```
1. You have filters: [teacher, student]
2. You share URL: #u=assistant:200000000&word=homework
3. Recipient sees: [teacher, student, assistant] + [homework]
4. Original filters preserved, new ones added
```

### Scenario 3: Complex Filter Combinations
```
1. Current filters: [alice] + [javascript]
2. URL adds: #u=bob:000255000&word=react&-word=spam
3. Result filters: [alice, bob] + [javascript, react] + [-spam]
4. All filters work together (AND between types, OR within types)
```

## ⚙️ Technical Implementation

### URL Filter Manager (`lib/url-filter-manager.ts`)
```typescript
mergeURL(updates: Partial<SWWFilterState>): void {
  // Always merges with this.currentState
  const newState = { ...this.currentState };
  // Merge logic prevents duplicates
}
```

### Server-Side Search (`components/CommentsStream.tsx`)
```typescript
// Server results MERGE with existing
const existingIds = new Set(allComments.map(c => c.id));
const newMessages = data.comments.filter(c => !existingIds.has(c.id));
const mergedComments = [...allComments, ...newMessages];
```

## 🔑 Key Configuration

### In Production
- `useLocalStorage: false` - Uses Cloudflare KV
- Server-side search queries entire KV history
- Results merge with current view

### In Development  
- `useLocalStorage: true` - Uses browser storage
- Server-side search not available locally
- Same merge behavior for URL filters

## 📝 Important Notes

1. **Filter Persistence**: All filters persist in localStorage
2. **URL Priority**: URL filters are applied on page load
3. **No Replacement**: There is NO mechanism to clear filters via URL
4. **Manual Clear**: Users must manually remove filters from the filter bar
5. **Color Preservation**: User colors from URL are preserved in filters

## 🚫 What Never Happens

- ❌ URL never clears filters from the filter bar
- ❌ Server search never replaces current messages
- ❌ Filter bar never gets wiped by URL changes
- ❌ Duplicate filters never appear in filter bar
- ❌ Messages never get removed by new searches
- ❌ Filters are never lost when URL changes

## ✅ What Always Happens

- ✅ URL controls whether filters are active/inactive
- ✅ URL filters merge with existing filter bar
- ✅ Server messages merge with existing messages
- ✅ Filter bar preserves all filters (even when inactive)
- ✅ Plain URL (`https://saywhatwant.app`) shows full feed
- ✅ URL with filters shows filtered view
- ✅ Duplicates are automatically prevented
- ✅ User's curated filters are always preserved

---

**Remember**: This merge-only behavior ensures users never lose their carefully curated view of the conversation. The system is designed to be additive and helpful, never destructive.
