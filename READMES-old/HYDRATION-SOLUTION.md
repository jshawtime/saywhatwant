# React Hydration Solution for URL-Based Filtering

## Problem Statement

When implementing URL-based filtering in a Next.js application with Server-Side Rendering (SSR), we encountered React hydration errors. These errors occurred when URL parameters were present (e.g., `#from=T60&to=now`) but not when the URL was clean.

### Root Cause Analysis

The hydration mismatch occurred due to different initial states between server and client rendering:

1. **Server-Side Rendering (SSR)**
   - Cannot access `window.location.hash`
   - Renders with empty filter state
   - No URL parsing possible

2. **Client-Side Hydration**
   - Can access `window.location.hash`
   - Attempts to initialize with parsed URL filters
   - Different state than server = hydration mismatch

## Solution Architecture

### 1. Deferred State Initialization

```javascript
// hooks/useURLFilter.ts

export function useURLFilter() {
  // ALWAYS start with empty state - identical on server and client
  const [urlState, setUrlState] = useState<SWWFilterState>({
    users: [],
    searchTerms: [],
    words: [],
    negativeWords: [],
    wordRemove: [],
    videoPlaylist: [],
    videoPanel: null,
    from: null,
    to: null,
    timeFrom: null,
    timeTo: null
  });
  
  useEffect(() => {
    // Only access URLFilterManager on client side, after mount
    if (typeof window === 'undefined') return;
    
    const manager = URLFilterManager.getInstance();
    
    // NOW we can safely parse the URL
    setUrlState(manager.getCurrentState());
    
    // Subscribe to future URL changes
    const unsubscribe = manager.subscribe((newState) => {
      setUrlState(newState);
    });
    
    return unsubscribe;
  }, []);
  
  // ... rest of hook
}
```

### 2. Lazy Singleton Initialization

```javascript
// lib/url-filter-manager.ts

export class URLFilterManager {
  private static instance: URLFilterManager;
  private subscribers: Set<(state: SWWFilterState) => void> = new Set();
  private currentState: SWWFilterState = this.getEmptyState();
  private initialized = false;
  
  private constructor() {
    // Do NOT parse URL in constructor
    // Wait for explicit initialization
  }
  
  private initialize() {
    if (this.initialized || typeof window === 'undefined') return;
    
    this.initialized = true;
    
    // NOW safe to access window
    window.addEventListener('hashchange', () => this.handleHashChange());
    window.addEventListener('popstate', () => this.handleHashChange());
    
    // Parse initial URL
    this.handleHashChange();
  }
  
  // All public methods ensure initialization
  getCurrentState(): SWWFilterState {
    this.initialize();
    return { ...this.currentState };
  }
  
  subscribe(callback: (state: SWWFilterState) => void): () => void {
    this.initialize();
    // ... subscription logic
  }
  
  // ... other methods
}
```

### 3. Time-Sensitive Content Handling

For content that changes based on time (timestamps, relative dates):

```javascript
// components/CommentsStream.tsx

const CommentsStream = () => {
  const [mounted, setMounted] = useState(false);
  
  useEffect(() => {
    setMounted(true);
  }, []);
  
  const formatTimestamp = (timestamp: number): string => {
    // This calculates "2 minutes ago" etc.
    // Different on server vs client due to time passing
    // ...
  };
  
  return (
    <div>
      {comments.map(comment => (
        <div>
          <span>{comment.text}</span>
          {/* Show placeholder during SSR, real time after mount */}
          <span>{mounted ? formatTimestamp(comment.timestamp) : '...'}</span>
        </div>
      ))}
    </div>
  );
};
```

## Implementation Checklist

When implementing URL-based state in an SSR application:

### ✅ DO:
1. **Start with identical state** on both server and client
2. **Defer URL parsing** until after component mount
3. **Use `useEffect`** for browser-specific initialization
4. **Check `typeof window`** before accessing browser APIs
5. **Use placeholders** for time-sensitive content
6. **Initialize singletons lazily** rather than in constructors

### ❌ DON'T:
1. **Parse URLs in `useState` initializers** - they run on both server and client
2. **Access `window` in component body** - causes SSR errors
3. **Initialize different states** based on `typeof window` checks in initial render
4. **Use time-sensitive calculations** without mounted checks
5. **Assume browser APIs exist** during SSR

## Testing for Hydration Issues

### How to Test

1. **Clear browser cache** and hard refresh
2. **Test with URL parameters**: `http://localhost:3000/#from=T60&word=test`
3. **Check browser console** for hydration errors
4. **View page source** to see server-rendered HTML
5. **Use React DevTools** to inspect initial vs hydrated state

### Common Error Messages

```
Error: Hydration failed because the initial UI does not match what was rendered on the server.
Expected server HTML to contain a matching <span> in <span>.
```

This indicates that the server rendered different content than the client during hydration.

## Performance Considerations

### Impact of Deferred Initialization

- **Pros:**
  - Eliminates hydration errors
  - Clean separation of SSR and client logic
  - Predictable behavior

- **Cons:**
  - Filters appear after initial render (minimal delay)
  - Extra re-render after mount
  
### Optimization Strategies

1. **Use `React.memo`** for filter components to prevent unnecessary re-renders
2. **Batch filter updates** in a single state update
3. **Debounce URL updates** to prevent excessive history entries

## Alternative Approaches Considered

### 1. Disable SSR for Filtered Pages
```javascript
// Not recommended - loses SEO benefits
const CommentsStream = dynamic(() => import('./CommentsStream'), {
  ssr: false
});
```

### 2. Parse URL on Server
Would require:
- Passing URL from server
- Complex Next.js middleware
- Not worth the complexity for this use case

### 3. Store Filters in Cookies
- Would sync server/client
- But adds complexity for shareable URLs
- Cookie size limitations

## Conclusion

The deferred initialization pattern provides a clean, maintainable solution for URL-based state in SSR applications. By ensuring both server and client start with identical state and deferring browser-specific code until after mount, we eliminate hydration errors while maintaining full SSR benefits.

### Key Takeaways

1. **Hydration requires identical initial renders** - any difference causes errors
2. **URL state is inherently client-side** - defer its initialization
3. **Time-sensitive content needs special handling** - use mounted checks
4. **Singleton patterns need lazy initialization** in SSR environments

This pattern can be applied to any browser-specific state that needs to work with SSR:
- Local storage access
- Geolocation
- Media queries
- WebSocket connections
- And more...
