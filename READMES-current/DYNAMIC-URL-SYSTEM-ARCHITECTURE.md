# Dynamic URL System Architecture

**Version**: 1.0  
**Date**: October 11, 2025  
**Purpose**: Architectural reference for URL-based state management and filtered view systems

---

## 🎯 Core Concept

**URL as Single Source of Truth**

All application state is encoded in the URL hash. No localStorage, no separate state management - the URL IS the state.

**Benefits:**
- Shareable - Send URL, share exact state
- Bookmarkable - Save URL, return to exact state
- Stateless - No server-side sessions needed
- Client-side - 100% browser-based
- Scalable - No state storage costs

---

## 🏗️ Architecture Principles

### 1. Hash-Based Parameters

**Why Hash (#) Not Query (?):**
- Hash doesn't trigger server requests
- Changes don't reload page
- Client-side routing
- No server involvement
- Static site friendly

**Format:**
```
https://example.com/#param1=value1&param2=value2
```

### 2. URL-Safe Encoding System

**Challenge**: Traditional color formats aren't URL-safe
- `rgb(255, 128, 64)` - Contains spaces, commas, parentheses
- `#FF8040` - Contains # symbol (conflicts with hash)

**Solution**: 9-Digit Color Format

**Format**: `RRRGGGBBB` (each RGB component as 3 digits, zero-padded)

**Examples:**
```
RGB(255, 128, 64) → 255128064
RGB(80, 225, 178) → 080225178
RGB(0, 0, 255) → 000000255
```

**Conversion Functions:**
```javascript
// RGB to 9-Digit
function rgbTo9Digit(r, g, b) {
  return String(r).padStart(3, '0') + 
         String(g).padStart(3, '0') + 
         String(b).padStart(3, '0');
}

// 9-Digit to RGB
function nineDigitToRgb(digits) {
  return {
    r: parseInt(digits.substring(0, 3)),
    g: parseInt(digits.substring(3, 6)),
    b: parseInt(digits.substring(6, 9))
  };
}
```

**Why This Matters:**
- No URL encoding needed
- No special characters
- Consistent format across system
- Easy parsing
- Human-readable (somewhat)

### 3. Atomic Identity Pattern

**Concept**: Username + Color = Unique Identity

**Key Rule**: Never separate username from color

**Why:**
- Same username with different colors = Different users
- Color is part of visual identity
- Prevents username collisions
- Enables visual distinction

**Format:**
```
username:color
alice:255000000  (Red Alice)
alice:000255000  (Green Alice)  ← Different user!
```

**In URLs:**
```
#u=alice:255000000
```

Multiple identities:
```
#u=alice:255000000+bob:000255000+charlie:000000255
```

### 4. Parameter Separation Conventions

**Between Parameters**: `&`
```
#param1=value1&param2=value2
```

**Within Parameter Values**: `+`
```
#u=alice:255000000+bob:000255000
#word=hello+world
```

**This allows:**
- Multiple values for same parameter type
- Clear parsing logic
- No ambiguity

---

## 📐 URL Structure Specification

### General Format

```
https://domain.com/#key1=value1&key2=value2&key3=value3
```

### Parameter Types

**Boolean Parameters:**
```
#filteractive=true
#filteractive=false
```

**String Parameters:**
```
#entity=philosopher
#model=gpt-4
```

**Numeric Parameters:**
```
#priority=5
#nom=50
```

**Identity Parameters (Username:Color):**
```
#uis=Alice:255128064
#ais=Bot:random
```

**List Parameters (Multiple Values):**
```
#u=alice:255000000+bob:000255000
#word=hello+world
```

---

## 🔄 State Management Flow

### Initialization

```
1. Page loads
2. Parse URL hash
3. Extract all parameters
4. Set application state from URL
5. Render UI with that state
```

### State Updates

```
1. User action (click, type, etc.)
2. Update application state
3. Build new URL hash from state
4. Update window.location.hash
5. URL change triggers re-parse (optional)
6. State stays synchronized
```

### URL Parsing Function (Pseudocode)

```javascript
function parseURL() {
  const hash = window.location.hash.substring(1); // Remove #
  const params = new URLSearchParams(hash);
  
  return {
    filterActive: params.get('filteractive') === 'true',
    users: parseUsers(params.get('u')),
    words: parseList(params.get('word')),
    messageType: params.get('mt') || 'ALL',
    userIdentity: parseIdentity(params.get('uis')),
    // ... more parameters
  };
}
```

### URL Building Function (Pseudocode)

```javascript
function buildURL(state) {
  const params = [];
  
  if (state.filterActive) {
    params.push(`filteractive=${state.filterActive}`);
  }
  
  if (state.users.length > 0) {
    const userStr = state.users.map(u => `${u.name}:${u.color}`).join('+');
    params.push(`u=${userStr}`);
  }
  
  if (state.messageType) {
    params.push(`mt=${state.messageType}`);
  }
  
  return `#${params.join('&')}`;
}
```

---

## 🎨 Random Color Generation Pattern

**Use Case**: Let system assign colors dynamically

**URL Format:**
```
#uis=Alice:random
```

**Two-Phase Process:**

**Phase 1 - Initial Load:**
```
URL: #uis=Alice:random
State: { username: "Alice", color: "pending" }
Action: Generate random color (e.g., 255128064)
```

**Phase 2 - URL Update:**
```
State: { username: "Alice", color: "255128064" }
Action: Update URL with actual color
URL: #uis=Alice:255128064
```

**Result**: Bookmarking preserves the generated color

**Implementation:**
```javascript
function processRandomColors(state) {
  // Find parameters with :random
  if (state.userColor === 'random') {
    const generated = generateRandomColor(); // Returns 9-digit
    state.userColor = generated;
    updateURL(state); // Persist to URL
  }
  return state;
}

function generateRandomColor() {
  const r = Math.floor(Math.random() * 256);
  const g = Math.floor(Math.random() * 256);
  const b = Math.floor(Math.random() * 256);
  return rgbTo9Digit(r, g, b);
}
```

---

## 🔐 Context Isolation Architecture

**Concept**: Filtered views create isolated contexts

**How It Works:**

```
1. URL defines participants
   #u=alice:255000000+bot:138043226

2. System filters ALL data to only show these participants
   → Only alice and bot messages visible
   
3. When sending data to external services (APIs, AI, etc):
   → Only send filtered messages
   → Service sees ONLY this conversation
   → Complete context isolation
```

**Why This Matters:**
- Private conversations stay private
- AI doesn't see unrelated context
- Bookmarkable conversation spaces
- Shareable isolated views

---

## 📊 State Synchronization Patterns

### Pattern 1: Direct State Sync

```
User Action → Update State → Build URL → Replace URL
```

Simple, unidirectional flow.

### Pattern 2: Bidirectional Sync

```
User Action → Update State → Build URL → Replace URL
                ↓
            hashchange event
                ↓
         Parse URL → Update State (verification)
```

Ensures state and URL stay synchronized.

### Pattern 3: External Navigation

```
External Link → Load Page → Parse URL → Set State → Render
```

Enables "deep linking" to specific states.

---

## 🎯 Implementation Requirements

### Core Functions Needed

**1. URL Parser**
```javascript
parseURL(hash: string): State
// Converts URL hash to application state object
```

**2. URL Builder**
```javascript
buildURL(state: State): string
// Converts application state to URL hash string
```

**3. URL Updater**
```javascript
updateURL(state: State): void
// Updates browser URL without reload
// Uses window.history.pushState or replaceState
```

**4. Identity Parser**
```javascript
parseIdentity(param: string): {username: string, color: string}
// Parses "username:color" format
// Handles "username:random" special case
```

**5. List Parser**
```javascript
parseList(param: string): Array
// Splits on + separator
// Returns array of values
```

**6. Color Converter**
```javascript
rgbTo9Digit(r, g, b): string
nineDigitToRgb(digits): {r, g, b}
// Bidirectional color conversion
```

### State Interface (Example)

```typescript
interface AppState {
  filterActive: boolean;
  users: Array<{username: string, color: string}>;
  words: string[];
  negativeWords: string[];
  messageType: 'typeA' | 'typeB' | 'ALL';
  userIdentity: {username: string, color: string} | null;
  priority: number | null;
  contextSize: number | 'ALL';
}
```

---

## 🧩 Architectural Patterns

### Pattern 1: Filter State in URL

**Before (Traditional):**
```javascript
const [filters, setFilters] = useState({ users: [], words: [] });
localStorage.setItem('filters', JSON.stringify(filters));
```

**Problems:**
- Not shareable
- Not bookmarkable
- State hidden from user

**After (URL-Based):**
```javascript
const state = parseURL(window.location.hash);
const [filters, setFilters] = useState(state.filters);

// On change:
updateURL(buildURL({ ...state, filters: newFilters }));
```

**Benefits:**
- URL shows complete state
- Shareable
- Bookmarkable
- Transparent

### Pattern 2: Identity Encoding

**Challenge**: Encode user identity (name + color) in URL

**Solution**: Colon separator
```
username:colorcode
```

**Why Colon:**
- URL-safe
- Not commonly in usernames
- Easy to split
- Readable

**Handling Edge Cases:**
```javascript
function encodeIdentity(username, color) {
  // Sanitize username (remove special chars)
  const clean = username.replace(/[^a-zA-Z0-9]/g, '');
  // Combine with color
  return `${clean}:${color}`;
}

function decodeIdentity(encoded) {
  const [username, color] = encoded.split(':');
  return { username, color };
}
```

### Pattern 3: Multi-Value Parameters

**Challenge**: Multiple items of same type in URL

**Solution**: Plus (+) separator within parameter

**Format:**
```
#users=alice:255000000+bob:000255000+charlie:000000255
```

**Parsing:**
```javascript
function parseMultiValue(param) {
  if (!param) return [];
  return param.split('+').map(item => {
    const [name, color] = item.split(':');
    return { name, color };
  });
}
```

---

## 🔧 Client-Side Implementation

### Lifecycle Hooks

**1. Initialization (Page Load)**
```javascript
useEffect(() => {
  const initialState = parseURL(window.location.hash);
  setState(initialState);
}, []);
```

**2. URL Monitoring**
```javascript
useEffect(() => {
  const handleHashChange = () => {
    const newState = parseURL(window.location.hash);
    setState(newState);
  };
  
  window.addEventListener('hashchange', handleHashChange);
  return () => window.removeEventListener('hashchange', handleHashChange);
}, []);
```

**3. State Updates**
```javascript
const updateState = useCallback((newState) => {
  setState(newState);
  const newHash = buildURL(newState);
  window.history.pushState(null, '', newHash);
}, []);
```

### Timing Considerations

**useLayoutEffect for Pre-Paint Operations:**

When state must be set BEFORE first render:
```javascript
useLayoutEffect(() => {
  const state = parseURL(window.location.hash);
  setState(state);
  // Runs synchronously before browser paint
  // No flash of wrong state
}, []);
```

**Why This Matters:**
- Prevents flash of default state
- Smooth user experience
- State appears instantly

---

## 📏 URL Parameter Design Guidelines

### 1. Keep Names Short

**Good:**
```
#u=alice:255000000
#mt=AI
#fa=true
```

**Bad:**
```
#filteredUsers=alice:255000000
#messageType=AI
#filterActiveState=true
```

**Why:** Shorter URLs, easier to read/type

### 2. Use Consistent Separators

**Parameters:** `&`  
**Multiple Values:** `+`  
**Identity Pairing:** `:`

**Don't Mix:**
- ❌ `#users=alice,bob` (comma)
- ❌ `#u=alice&bob` (& within param)
- ✅ `#u=alice+bob` (+ for multiples)

### 3. Boolean Values

**Use strings:**
```
#active=true
#active=false
```

**Not:**
- ❌ `#active=1` (ambiguous)
- ❌ `#active=yes` (non-standard)

### 4. Optional vs Required

**Optional parameters**: Omit if not set
```
#u=alice:255000000
(no word filter = show all words)
```

**Required parameters**: Always include
```
#filteractive=true
(explicitly state filter state)
```

---

## 🎨 9-Digit Color System

### Why Custom Color Format?

**Traditional Formats:**
- HEX: `#FF8040` - Contains # (URL conflict)
- RGB: `rgb(255,128,64)` - Spaces, commas, parentheses (encoding needed)
- Named: `red` - Limited palette

**9-Digit Format:**
- `255128064` - No special characters
- URL-safe without encoding
- Preserves full RGB range (0-255 per channel)
- Fixed width for parsing

### Architecture

**Storage:** 9-digit string  
**Display:** Convert to RGB for CSS  
**URL:** 9-digit string  
**Comparison:** 9-digit string (no conversion needed)

**Benefits:**
- Single format throughout system
- No conversion overhead for comparisons
- URL-safe by design
- Consistent data type (string)

### Conversion Architecture

```javascript
// Core conversion utilities
class ColorSystem {
  // RGB → 9-Digit
  static encode(r, g, b) {
    return [r, g, b]
      .map(n => String(n).padStart(3, '0'))
      .join('');
  }
  
  // 9-Digit → RGB object
  static decode(digits) {
    if (!/^\d{9}$/.test(digits)) {
      return null; // Invalid format
    }
    return {
      r: parseInt(digits.slice(0, 3)),
      g: parseInt(digits.slice(3, 6)),
      b: parseInt(digits.slice(6, 9))
    };
  }
  
  // 9-Digit → CSS string
  static toCSS(digits) {
    const {r, g, b} = this.decode(digits);
    return `rgb(${r}, ${g}, ${b})`;
  }
  
  // CSS → 9-Digit
  static fromCSS(css) {
    const match = css.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
    if (!match) return null;
    return this.encode(
      parseInt(match[1]),
      parseInt(match[2]),
      parseInt(match[3])
    );
  }
}
```

---

## 🔗 URL Parameter Architecture

### Parameter Categories

**1. Boolean Toggles**
- Control on/off states
- Format: `name=true|false`
- Example: `filteractive=true`

**2. String Identifiers**
- Select specific items
- Format: `name=value`
- Example: `entity=philosopher`

**3. Numeric Values**
- Quantities, priorities, sizes
- Format: `name=number`
- Example: `priority=5`

**4. Identity Pairs**
- User identification with visual marker
- Format: `name=username:color`
- Example: `uis=Alice:255128064`

**5. Multi-Value Lists**
- Multiple items of same type
- Format: `name=value1+value2+value3`
- Example: `u=alice:255000000+bob:000255000`

### Parameter Parsing Priority

**Order of evaluation:**
1. **Explicit Parameters** - URL values
2. **Default Values** - Fallbacks when missing
3. **Computed Values** - Derived from other params

**Example:**
```javascript
function getFilterState(params) {
  // 1. Explicit
  if (params.has('filteractive')) {
    return params.get('filteractive') === 'true';
  }
  
  // 2. Computed (has filters = active by default)
  if (params.has('u') || params.has('word')) {
    return true;
  }
  
  // 3. Default
  return false;
}
```

---

## 🎯 Reference Examples

*Note: These are reference examples only - adapt to your use case*

### Example A: Simple Filter

```
#filteractive=true&u=alice:255000000
```

**Architecture:**
- Boolean toggle: `filteractive=true`
- Single user: `alice:255000000`
- Result: Shows only alice's content

### Example B: Multiple Filters

```
#filteractive=true&u=alice:255000000+bob:000255000&word=hello+world
```

**Architecture:**
- Multiple users: `+` separator
- Multiple words: `+` separator
- Combined: `&` separator
- Result: Alice OR Bob messages containing "hello" AND "world"

### Example C: Identity Setup

```
#uis=Visitor:random&priority=0
```

**Architecture:**
- User identity with random color
- Priority value
- Result: User named "Visitor", color assigned on load

### Example D: Complex State

```
#filteractive=true&mt=ALL&u=alice:255000000+bot:138043226&uis=Visitor:random&priority=0&nom=50
```

**Architecture:**
- 6 parameters combined
- Boolean, string, identity, numeric types
- Multiple users in filter
- User identity separate from filter
- Result: Complete conversation state in URL

---

## 🏛️ Architecture Best Practices

### 1. URL is Read-Only Source of Truth

**Don't:**
```javascript
// Maintaining separate state
const [filters, setFilters] = useState([]);
const urlFilters = parseURL();
// Now have two sources of truth!
```

**Do:**
```javascript
// URL is the only source
const filters = parseURL().filters;
// Want to update? Update URL
updateURL({ filters: newFilters });
```

### 2. No State Caching

**Don't:**
```javascript
// Caching URL state
const cachedState = parseURL();
localStorage.setItem('state', JSON.stringify(cachedState));
```

**Do:**
```javascript
// Parse URL every time
const state = parseURL(window.location.hash);
// URL is always current, no cache needed
```

### 3. Atomic Updates

**Don't:**
```javascript
// Multiple URL updates
updateURL({ users: newUsers });
updateURL({ words: newWords });
// Two updates, two history entries
```

**Do:**
```javascript
// Single atomic update
updateURL({ 
  users: newUsers,
  words: newWords
});
// One update, one history entry
```

### 4. Client-Side Only

**Don't:**
```javascript
// Server-side URL manipulation
// Makes no sense for static sites
```

**Do:**
```javascript
// All URL operations in browser
if (typeof window !== 'undefined') {
  updateURL(newState);
}
```

---

## 🔄 State Sync Patterns

### Pattern A: Controlled Component

```javascript
function FilteredView() {
  const urlState = parseURL();
  
  return (
    <div>
      <FilterBar 
        active={urlState.filterActive}
        users={urlState.users}
        onToggle={() => updateURL({ 
          ...urlState, 
          filterActive: !urlState.filterActive 
        })}
      />
      <MessageList 
        messages={filterMessages(allMessages, urlState)}
      />
    </div>
  );
}
```

### Pattern B: Hook-Based

```javascript
function useURLState() {
  const [state, setState] = useState(() => parseURL());
  
  useEffect(() => {
    const handleChange = () => setState(parseURL());
    window.addEventListener('hashchange', handleChange);
    return () => window.removeEventListener('hashchange', handleChange);
  }, []);
  
  const updateState = useCallback((updates) => {
    const newState = { ...state, ...updates };
    updateURL(newState);
  }, [state]);
  
  return [state, updateState];
}
```

---

## 📐 Scaling Considerations

### URL Length Limits

**Browser limits:** ~2000-8000 characters (varies)

**Design for limits:**
- Keep parameter names short
- Use efficient encoding (9-digit, not verbose)
- Limit number of multi-value items
- Consider compression for extreme cases

**Example:**
```javascript
// Good - compact
#u=a:255000000+b:000255000

// Bad - verbose
#filteredUsers=alice:rgb(255,0,0)+bob:rgb(0,255,0)
```

### Performance

**Parsing on every hashchange:**
```javascript
// Efficient - minimal work
function parseURL() {
  const params = new URLSearchParams(window.location.hash.substring(1));
  // O(n) where n = number of params
  return extractState(params);
}
```

**Avoid:**
- Complex regex parsing
- Nested loops
- Heavy computation in parser

---

## 🎯 Key Architectural Decisions Summary

1. **Hash not Query** - Client-side routing
2. **9-Digit Colors** - URL-safe encoding
3. **Username:Color Atomic** - Identity system
4. **URL as Truth** - No dual sources
5. **+ and & Separators** - Clear conventions
6. **Client-Side Only** - No server dependency
7. **Random Pattern** - Two-phase color generation
8. **Context Isolation** - Filtered views
9. **useLayoutEffect** - Pre-paint state setting
10. **No Caching** - Always parse fresh

---

## 🚀 Implementation Checklist

### Phase 1: Core Functions
- [ ] Implement URL parser
- [ ] Implement URL builder
- [ ] Implement color converter (9-digit ↔ RGB)
- [ ] Implement identity parser (username:color)
- [ ] Implement list parser (+, separator)

### Phase 2: State Management
- [ ] Create state interface
- [ ] Implement state initialization from URL
- [ ] Implement state update → URL sync
- [ ] Add hashchange listener

### Phase 3: Random Colors
- [ ] Detect `:random` in URLs
- [ ] Generate random 9-digit colors
- [ ] Update URL after generation
- [ ] Test bookmark preservation

### Phase 4: Context Isolation
- [ ] Implement filtering based on URL state
- [ ] Ensure external services receive filtered data only
- [ ] Test isolation with multiple tabs

### Phase 5: Testing
- [ ] Test all parameter types
- [ ] Test parameter combinations
- [ ] Test URL length limits
- [ ] Test bookmark/share functionality
- [ ] Test random color generation

---

## 📖 Further Reading

**Concepts Used:**
- Hash-based routing (SPA pattern)
- URL as state container
- Client-side state management
- Context isolation patterns
- Color encoding for URLs

**Related Patterns:**
- Deep linking
- Shareable application states
- Bookmarkable filters
- URL-driven UIs

---

**This architecture enables building rich, stateful applications with zero server-side state management. Every state is a URL, every URL is a complete application state.**

*Architecture designed for: Static sites, client-side apps, Cloudflare Pages, serverless deployments*

