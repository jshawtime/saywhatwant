# Message Type Toggle Feature - Human OR AI Exclusive

**Date**: October 2, 2025  
**Status**: PLANNING → IMPLEMENTATION  
**Philosophy**: Ham Radio Concept - "If you're not there, you miss out"

---

## 🎯 Vision

Transform message type filtering from **inclusive** (show both) to **exclusive** (choose one channel).

**Ham Radio Concept**: Users tune into ONE channel at a time (Humans OR AI). If you want both, open two tabs. Each tab contributes to shared IndexedDB, creating complete archive.

---

## 📊 Current State Analysis

### Current Implementation (Inclusive)

**UI**: Two independent toggle buttons
```
[👤 Users] [✨ Sparkles]
```

**State**: 2 independent booleans
```typescript
showHumans: boolean   // Can be true
showEntities: boolean // Can be true simultaneously
```

**Possible Combinations**: 4 states
- Both ON: See all messages
- Humans only: See human messages
- AI only: See AI/entity messages
- Neither: See nothing (possible but useless)

**Polling**: Fetches ALL messages, filters client-side
```typescript
fetch(`${apiUrl}?after=${timestamp}`)
// Returns: humans + AI
// Filter: Client-side by showHumans/showEntities
```

**localStorage**: 2 separate keys
```
sww-show-humans: "true"
sww-show-entities: "true"
```

**URL State**: ❌ NOT in URL (only in localStorage)

---

### Problems with Current System

1. **No URL State**: Can't share "AI-only" view via URL
2. **Bandwidth Waste**: Fetches all types, filters client-side
3. **Unclear Intent**: "Neither" state is possible but useless
4. **Not Ham Radio**: Can watch both channels simultaneously

---

## 🎯 Proposed Implementation (Exclusive)

### New UI: Toggle Switch

**Design**:
```
[👤]—⚫—[✨]
     Human  AI
     
Slider position indicates active channel
```

**State**: Single enum
```typescript
type MessageChannel = 'human' | 'AI';
const activeChannel: MessageChannel = 'human'; // Default
```

**Possible Values**: 2 states ONLY
- `'human'`: Human channel active
- `'AI'`: AI/entity channel active

**Polling**: Fetches ONLY active type
```typescript
fetch(`${apiUrl}?after=${timestamp}&type=${activeChannel}`)
// Returns: ONLY humans OR ONLY AI (50% bandwidth)
```

**localStorage**: Single key
```
sww-message-channel: "human"
```

**URL State**: ✅ YES - New parameter
```
#mt=human  (message type = human)
#mt=AI     (message type = AI)
```

---

## 🏗️ Architecture

### URL as Source of Truth

Following **33-DYNAMIC-URL-ENHANCEMENTS.md** principle:

**URL drives everything**:
```
URL: #mt=human
  ↓
parseURL() extracts: messageType: 'human'
  ↓
Component state updates
  ↓
Polling uses: ?type=human
  ↓
IndexedDB filters: message-type === 'human'
```

**State Hierarchy**:
1. **URL** (highest priority - source of truth)
2. **localStorage** (fallback if URL has no mt parameter)
3. **Default** ('human' if nothing set)

---

## 📋 Implementation Plan

### Phase 1: Worker Update (Backend)

**File**: `workers/comments-worker.js`

**Changes**:

1. **GET handler** (lines 121-160 - cursor polling):
```javascript
// Add after line 122:
const messageType = params.get('type'); // 'human' or 'AI'

// Update filter at line 134-137:
newMessages = allComments
  .filter(c => c.timestamp > afterTimestamp)
  .filter(c => !messageType || c['message-type'] === messageType)  // NEW!
  .sort((a, b) => b.timestamp - a.timestamp)
  .slice(0, limit);
```

2. **Cache GET** (lines 167-198 - initial load):
```javascript
// Add after line 194 (after search filter):
const messageType = params.get('type');
if (messageType) {
  comments = comments.filter(c => c['message-type'] === messageType);
}
```

**Benefits**:
- 50% bandwidth savings (only fetch one type)
- Backwards compatible (type parameter optional)
- No breaking changes (existing clients work)

**Testing**:
- `?after=X&type=human` → returns only humans
- `?after=X&type=AI` → returns only AI
- `?after=X` (no type) → returns all (backwards compatible)

---

### Phase 2: URL System Update (State Management)

**File**: `lib/url-filter-simple.ts`

**Changes**:

1. **Add to FilterState interface**:
```typescript
export interface FilterState {
  users: FilterUser[];
  words: string[];
  negativeWords: string[];
  filterActive: boolean;
  messageType: 'human' | 'AI';  // NEW!
}
```

2. **Update parseURL()** (lines 21-73):
```typescript
const state: FilterState = {
  users: [],
  words: [],
  negativeWords: [],
  filterActive: false,
  messageType: 'human'  // Default
};

// Add case for 'mt' parameter:
case 'mt':
  if (value === 'human' || value === 'AI') {
    state.messageType = value;
  }
  break;
```

3. **Update buildURL()** (lines 78-103):
```typescript
// Add after filteractive:
params.push(`mt=${state.messageType}`);
```

4. **Update ensureFilterActive()** (lines 124-133):
```typescript
// Ensure mt parameter exists
if (!hash.includes('mt=')) {
  newHash += '&mt=human'; // Default to human
}
```

**Result**: URL always has `#filteractive=false&mt=human`

---

### Phase 3: Component Update (UI)

**Files to Change**:

1. **Create** `components/Header/MessageTypeToggle.tsx` (NEW - singular!)

**Replace**: `MessageTypeToggles.tsx` (plural - delete)

**Design**:
```typescript
interface MessageTypeToggleProps {
  activeChannel: 'human' | 'AI';
  onChannelChange: (channel: 'human' | 'AI') => void;
  userColorRgb: string;
}

// UI Structure:
<div className="flex items-center gap-2">
  <Users /> {/* Dims when AI active */}
  <div className="slider-track">
    <div className="slider-thumb" /> {/* Moves left/right */}
  </div>
  <Sparkles /> {/* Dims when Human active */}
</div>
```

**Behavior**:
- Click Users icon OR left side → switches to 'human'
- Click Sparkles icon OR right side → switches to 'AI'
- Slider animates between positions
- Inactive icon dims to 40% opacity
- Active icon bright at 100% opacity

2. **Update** `hooks/useMessageTypeFilters.ts`

**Replace**: 2 booleans with 1 enum
```typescript
// OLD:
const [showHumans, setShowHumans] = useState(true);
const [showEntities, setShowEntities] = useState(true);

// NEW:
const [activeChannel, setActiveChannel] = useState<'human' | 'AI'>(() => {
  // Load from localStorage as fallback
  const saved = localStorage.getItem('sww-message-channel');
  return (saved === 'AI' ? 'AI' : 'human');
});
```

**Sync with URL**:
```typescript
useEffect(() => {
  // URL is source of truth
  const urlChannel = parseURL().messageType;
  if (urlChannel !== activeChannel) {
    setActiveChannel(urlChannel);
  }
}, [window.location.hash]);
```

3. **Update** `components/Header/AppHeader.tsx`

**Props Change**:
```typescript
// OLD:
showHumans: boolean;
showEntities: boolean;
onToggleHumans: () => void;
onToggleEntities: () => void;

// NEW:
activeChannel: 'human' | 'AI';
onChannelChange: (channel: 'human' | 'AI') => void;
```

---

### Phase 4: Polling Integration

**File**: `components/CommentsStream.tsx`

**Changes to polling**:

1. **Pass type parameter to API**:
```typescript
// In checkForNewComments or polling hook
const url = `${apiUrl}?after=${lastFetchTime}&type=${activeChannel}`;
```

2. **Update useCommentsPolling** (modules/pollingSystem.ts):

Add parameter:
```typescript
useCommentsPolling({
  // ... existing params
  messageType: activeChannel,  // NEW!
});
```

3. **Initial load** also filters:
```typescript
// In loadInitialComments
const url = `${apiUrl}?limit=${limit}&type=${activeChannel}`;
```

---

### Phase 5: IndexedDB Filtering

**File**: `hooks/useIndexedDBFiltering.ts`

**Already Works!** ✅

Current code (lines 185-189):
```typescript
// Message type filters
if (!params.showHumans && message['message-type'] === 'human') return false;
if (!params.showEntities && message['message-type'] === 'AI') return false;
```

**Update to**:
```typescript
// Message type filter (exclusive channel)
if (params.activeChannel === 'human' && message['message-type'] !== 'human') return false;
if (params.activeChannel === 'AI' && message['message-type'] !== 'AI') return false;
```

---

## 🗂️ Two-Tab Scenario - IndexedDB Behavior

### Question 3: Will Both Tabs Share Same DB?

**Answer**: **YES! Absolutely!** ✅

**How IndexedDB Works**:
- Database is **per-origin** (saywhatwant.app)
- ALL tabs on same origin share SAME database
- Tab 1 and Tab 2 both read/write to `SayWhatWant` database
- Automatic concurrency handling

**Your Two-Tab Scenario**:
```
Tab 1: #mt=human
├── Polls: ?after=X&type=human
├── Receives: Only human messages
├── Saves to: IndexedDB.messages
└── Displays: Humans only

Tab 2: #mt=AI
├── Polls: ?after=X&type=AI
├── Receives: Only AI messages
├── Saves to: IndexedDB.messages (SAME DB!)
└── Displays: AI only

IndexedDB Result:
├── Messages from Tab 1 (humans)
├── Messages from Tab 2 (AI)
└── Complete archive of BOTH types!
```

**Benefits**:
- ✅ Each tab contributes to shared database
- ✅ User gets complete archive automatically
- ✅ Each tab only fetches 50% of data (bandwidth savings)
- ✅ Can switch tabs to see other channel's history
- ✅ Perfect for power users who want both

**Potential Issue**:
- If user closes Tab 2 (AI), they stop receiving AI messages
- AI messages created after Tab 2 closes won't be in their IndexedDB
- This is **by design** - ham radio concept! ✅

---

## 🎯 Success Criteria

### Functional Requirements

- ✅ Only 2 states: Human OR AI (never both, never neither)
- ✅ Toggle switch UI between icons
- ✅ URL parameter: `#mt=human` or `#mt=AI`
- ✅ URL is source of truth (drives component state)
- ✅ Polling fetches ONLY active type (`?type=human` or `?type=AI`)
- ✅ localStorage remembers last choice
- ✅ Default to 'human' on first visit
- ✅ Two tabs with different channels share same IndexedDB
- ✅ Each tab contributes its channel's messages to shared DB

### UX Requirements

- ✅ Smooth slider animation
- ✅ Clear visual indication of active channel
- ✅ Click either icon to switch
- ✅ Click slider to switch
- ✅ Inactive icon dims to 40% opacity
- ✅ Active icon at 100% opacity with background glow

### Technical Requirements

- ✅ No backwards compatibility (no users yet)
- ✅ Worker supports `?type=` parameter (optional, backwards compatible)
- ✅ URL system integration following established patterns
- ✅ localStorage as fallback only (URL is truth)
- ✅ Build succeeds
- ✅ All deployments successful

---

## ⚠️ Breaking Changes

**This is a breaking change** (OK - no users yet):

1. **State Structure Changes**:
   - `showHumans` + `showEntities` → `activeChannel`
   - 2 booleans → 1 enum
   - 4 possible states → 2 possible states

2. **localStorage Keys Changes**:
   - DELETE: `sww-show-humans`
   - DELETE: `sww-show-entities`
   - CREATE: `sww-message-channel`

3. **Component Props Changes**:
   - All components receiving showHumans/showEntities need updates
   - Hook interfaces change
   - Pass-through props change

4. **URL Parameter NEW**:
   - Add: `mt=human` or `mt=AI`
   - Always present in URL (via ensureFilterActive pattern)

---

## 🚀 Implementation Sequence

### Step 1: Update Cloudflare Worker ⚠️ DO FIRST
**Why First**: Backend must support before frontend uses it

1. Add `type` parameter support to GET handler
2. Filter polling results by message-type
3. Deploy worker
4. Test: `?after=X&type=human` returns only humans

---

### Step 2: Update URL System
**Why Second**: State management foundation

1. Add `messageType` to FilterState interface
2. Update parseURL() to handle `mt=` parameter
3. Update buildURL() to include `mt=`
4. Update ensureFilterActive() to include default `mt=human`

---

### Step 3: Update Hook
**Why Third**: State management before UI

1. Replace `useMessageTypeFilters.ts` logic
2. Change from 2 booleans to 1 enum
3. Add URL subscription
4. Update localStorage key

---

### Step 4: Create New Toggle Component
**Why Fourth**: UI reflects new state

1. Delete `MessageTypeToggles.tsx` (plural)
2. Create `MessageTypeToggle.tsx` (singular)
3. Design slider UI
4. Implement smooth animation

---

### Step 5: Update All Component Props
**Why Fifth**: Integration

1. Update `AppHeader.tsx` props interface
2. Update `CommentsStream.tsx` to pass activeChannel
3. Update `useIndexedDBFiltering.ts` to use activeChannel
4. Update all pass-through props

---

### Step 6: Update Polling
**Why Sixth**: Data fetching

1. Add `&type=${activeChannel}` to polling URLs
2. Update initial load URL
3. Test polling returns correct types

---

### Step 7: Testing
**Why Last**: Verification

1. Test Human mode
2. Test AI mode  
3. Test toggle switch
4. Test URL changes
5. Test localStorage persistence
6. Test TWO TABS scenario (Human + AI)
7. Verify IndexedDB has both types

---

## 📐 Technical Specifications

### URL Parameter Format

**Parameter**: `mt` (message type)  
**Values**: `human` | `AI`  
**Default**: `human`  
**Position**: After `filteractive`, before filters

**Examples**:
```
#filteractive=false&mt=human
#filteractive=true&mt=AI&u=SomeUser:255165000
#mt=human&word=exploring
```

### Worker API

**Polling Endpoint**:
```
GET /api/comments?after={timestamp}&type={human|AI}
```

**Response**: Same format, but filtered by type

**Initial Load Endpoint**:
```
GET /api/comments?limit={N}&type={human|AI}
```

---

## 🎨 UI Design Specification

### Toggle Switch Component

**Dimensions**:
- Total width: 120px
- Height: 36px
- Icon size: 18px
- Slider thumb: 24px diameter
- Track: 60px width

**Colors** (using user color):
```typescript
// Active icon
color: userColorRgb
opacity: 1.0
background: userColorRgb at 10% opacity

// Inactive icon  
color: getDarkerColor(userColorRgb, 0.4)
opacity: 0.4
background: transparent

// Slider track
background: userColorRgb at 5% opacity
border: userColorRgb at 20% opacity

// Slider thumb
background: userColorRgb at 60% opacity
border: userColorRgb at 80% opacity
```

**Animation**:
```css
transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1)
```

---

## 🧪 Testing Strategy

### Test Case 1: Single Tab - Toggle Behavior
```
1. Start on #mt=human
2. See only human messages
3. Click AI side of toggle
4. URL changes to #mt=AI
5. New messages: only AI
6. See only AI messages
7. IndexedDB: has humans (from before) + AI (from now)
```

### Test Case 2: Two Tabs - Shared IndexedDB
```
Tab 1:
1. Open #mt=human
2. Let run for 2 mins
3. Check IndexedDB → has human messages

Tab 2:
1. Open #mt=AI
2. Let run for 2 mins
3. Check IndexedDB → has humans (from Tab 1) + AI (from Tab 2)

Both tabs:
- Same IndexedDB database
- Each contributes different message types
- Complete archive of both!
```

### Test Case 3: URL Sharing
```
1. User on Human channel
2. Copies URL: saywhatwant.app/#mt=human
3. Shares with friend
4. Friend opens URL → starts on Human channel ✅
```

### Test Case 4: localStorage Fallback
```
1. User visits plain URL (no #mt parameter)
2. localStorage has: sww-message-channel: "AI"
3. App loads on AI channel
4. URL updates to: #mt=AI
```

---

## 📊 State Flow Diagram

```
Page Load
  ↓
Parse URL (#mt=?)
  ↓
Found in URL? → Use URL value (source of truth)
  ↓ (if not found)
Check localStorage (sww-message-channel)
  ↓ (if not found)
Use default ('human')
  ↓
Update URL to reflect state
  ↓
Set component state (activeChannel)
  ↓
Start polling with type parameter
  ↓
User clicks toggle
  ↓
updateURL({ messageType: newChannel })
  ↓
URL changes → hashchange event
  ↓
Parse new URL
  ↓
Update component state
  ↓
Restart polling with new type
  ↓
Display updates
```

---

## 🔧 Files to Modify

### Backend (1 file):
1. **workers/comments-worker.js**
   - Add type parameter support to GET handler
   - Filter by message-type in polling
   - Filter by message-type in cache retrieval

### State Management (2 files):
2. **lib/url-filter-simple.ts**
   - Add messageType to FilterState
   - Update parseURL() for mt parameter
   - Update buildURL() to include mt
   - Update ensureFilterActive()

3. **hooks/useMessageTypeFilters.ts** → **useMessageChannel.ts** (RENAME!)
   - Change from 2 booleans to 1 enum
   - Add URL subscription
   - Update localStorage key
   - Return activeChannel + toggle function

### Components (3 files):
4. **components/Header/MessageTypeToggle.tsx** (NEW - singular!)
   - Create slider toggle UI
   - Replace MessageTypeToggles.tsx

5. **components/Header/AppHeader.tsx**
   - Update props interface
   - Pass activeChannel instead of showHumans/showEntities

6. **components/CommentsStream.tsx**
   - Use activeChannel instead of 2 booleans
   - Pass type parameter to polling
   - Update useIndexedDBFiltering params

### Filtering (1 file):
7. **hooks/useIndexedDBFiltering.ts**
   - Update interface: replace showHumans/showEntities with activeChannel
   - Update filter logic to use activeChannel
   - Simpler filtering (one check instead of two)

### To Delete (1 file):
8. **components/Header/MessageTypeToggles.tsx** (DELETE)
   - Replaced by singular Toggle

---

## 💡 Design Philosophy

### Ham Radio Concept

**Traditional Radio**:
- Tune to ONE frequency at a time
- Can't listen to two stations simultaneously
- If you're not tuned in, you miss the broadcast

**Say What Want**:
- Tune to ONE channel at a time (Human OR AI)
- Can't see both simultaneously (in same tab)
- If you're not on that channel, you miss those messages
- **Power users**: Open 2 tabs to monitor both

**Benefits**:
- Forces focus and engagement
- Creates distinct "channels" culture
- Bandwidth efficient
- IndexedDB shared across tabs (power user benefit)

---

## 🎯 Why This is Better

### Current System Issues:
- ❌ Can see both (no channel culture)
- ❌ Fetches all, filters client-side (bandwidth waste)
- ❌ 4 possible states (confusing)
- ❌ Not in URL (can't share AI-only view)

### New System Benefits:
- ✅ Exclusive channels (ham radio culture)
- ✅ Fetch only what you need (50% bandwidth)
- ✅ 2 clear states (human or AI)
- ✅ In URL (shareable "AI-only" links)
- ✅ Two-tab power mode (complete archive)
- ✅ Simpler code (1 enum vs 2 booleans)

---

## 🚨 Risk Analysis

### Risk 1: Worker Deployment
**Likelihood**: Low  
**Impact**: Medium  
**Mitigation**: Worker change is backwards compatible (type parameter optional)

### Risk 2: Breaking Existing State
**Likelihood**: N/A (no users)  
**Impact**: N/A  
**Mitigation**: No backwards compatibility needed

### Risk 3: Two-Tab Confusion
**Likelihood**: Low  
**Impact**: Low  
**Mitigation**: Clear UI shows which channel is active

### Risk 4: IndexedDB Conflicts
**Likelihood**: Very Low  
**Impact**: Low  
**Mitigation**: IndexedDB designed for multi-tab access

---

## ✅ Ready to Implement

**I understand the complete picture**:

1. ✅ URL is source of truth
2. ✅ Worker needs update (simple, backwards compatible)
3. ✅ UI becomes simpler (toggle vs 2 buttons)
4. ✅ State becomes simpler (enum vs 2 booleans)
5. ✅ Two tabs share IndexedDB automatically
6. ✅ Ham radio concept enforces focus
7. ✅ No backwards compatibility needed

**Proceeding with implementation in sequence: Worker → URL → Hook → Component → Integration → Testing**


