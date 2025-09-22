/**
 * URLFilterManager - Singleton class for managing URL-based filtering
 * Handles parsing, building, and syncing filter state with URL hash
 */

export interface UserWithColor {
  username: string;
  color: string;
}

export interface SWWFilterState {
  users: UserWithColor[];      // Usernames with colors to filter
  colors: string[];            // Colors to filter (any user with these colors)
  searchTerms: string[];        // Search terms for search bar
  words: string[];             // Positive word filters
  negativeWords: string[];    // Negative word filters  
  wordRemove: string[];        // Words to remove/hide from display
  videoPlaylist: string[];     // Video keys to play
  videoPanel: boolean | null;  // Panel visibility state
  from: string | null;         // Start time (YYYY-MM-DD, YYYY-MM-DDTHH:MM, T[minutes], keywords)
  to: string | null;           // End time (YYYY-MM-DD, YYYY-MM-DDTHH:MM, T[minutes], keywords)
  timeFrom: number | null;     // Alternative: minutes ago (number only)
  timeTo: number | null;       // Alternative: minutes ago (number only)
}

export class URLFilterManager {
  private static instance: URLFilterManager;
  private subscribers: Set<(state: SWWFilterState) => void> = new Set();
  private currentState: SWWFilterState = this.getEmptyState();
  private initialized = false;
  
  private constructor() {
    // Don't do anything in constructor - wait for explicit initialization
  }
  
  private initialize() {
    if (this.initialized || typeof window === 'undefined') return;
    
    this.initialized = true;
    
    // Listen for URL changes
    window.addEventListener('hashchange', () => this.handleHashChange());
    window.addEventListener('popstate', () => this.handleHashChange());
    
    // Parse initial URL
    this.handleHashChange();
  }
  
  /**
   * Convert rgb(r, g, b) format to 9-digit format (RRRGGGBBB)
   * Example: "rgb(76, 194, 40)" -> "076194040"
   */
  private rgbToNineDigit(color: string): string {
    // Handle rgb() format
    const rgbMatch = color.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
    if (rgbMatch) {
      const r = rgbMatch[1].padStart(3, '0');
      const g = rgbMatch[2].padStart(3, '0');
      const b = rgbMatch[3].padStart(3, '0');
      return `${r}${g}${b}`;
    }
    
    // Handle hex format (#RRGGBB)
    if (color.startsWith('#')) {
      const hex = color.slice(1);
      if (hex.length === 6) {
        const r = parseInt(hex.slice(0, 2), 16).toString().padStart(3, '0');
        const g = parseInt(hex.slice(2, 4), 16).toString().padStart(3, '0');
        const b = parseInt(hex.slice(4, 6), 16).toString().padStart(3, '0');
        return `${r}${g}${b}`;
      }
    }
    
    // If already 9 digits, return as-is
    if (/^\d{9}$/.test(color)) {
      return color;
    }
    
    // Default fallback - white
    return '255255255';
  }
  
  /**
   * Convert 9-digit format (RRRGGGBBB) to rgb(r, g, b) format
   * Example: "076194040" -> "rgb(76, 194, 40)"
   */
  private nineDigitToRgb(digits: string): string {
    if (!/^\d{9}$/.test(digits)) {
      return 'rgb(255, 255, 255)'; // Default to white
    }
    
    const r = parseInt(digits.slice(0, 3), 10);
    const g = parseInt(digits.slice(3, 6), 10);
    const b = parseInt(digits.slice(6, 9), 10);
    
    return `rgb(${r}, ${g}, ${b})`;
  }
  
  static getInstance(): URLFilterManager {
    if (!URLFilterManager.instance) {
      URLFilterManager.instance = new URLFilterManager();
    }
    return URLFilterManager.instance;
  }
  
  /**
   * Normalize text for matching (remove all non-alphanumeric, lowercase)
   */
  normalize(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '')
      .trim();
  }
  
  /**
   * Get empty filter state
   */
  private getEmptyState(): SWWFilterState {
    return {
      users: [],
      colors: [],
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
    };
  }
  
  /**
   * Parse URL hash into filter state
   */
  parseHash(): SWWFilterState {
    // Check if window is available (browser environment)
    if (typeof window === 'undefined') {
      return this.getEmptyState();
    }
    
    const hash = window.location.hash.slice(1); // Remove #
    if (!hash) return this.getEmptyState();
    
    const state = this.getEmptyState();
    const params = hash.split('&');
    
    // Track which parameters we've seen (for first-wins rule)
    const seenParams = new Set<string>();
    
    for (const param of params) {
      const [key, value] = param.split('=');
      if (!key || !value) continue;
      
      // Handle boolean video panel state (first wins)
      if (key === 'video' && (value === 'true' || value === 'false')) {
        if (!seenParams.has('videoPanel')) {
          state.videoPanel = value === 'true';
          seenParams.add('videoPanel');
        }
        continue;
      }
      
      // Skip duplicate parameter types (first wins)
      if (seenParams.has(key)) continue;
      seenParams.add(key);
      
      // Parse multiple values separated by +
      const values = value.split('+').map(v => decodeURIComponent(v));
      
      switch (key) {
        case 'u':
          // Parse users with colors (format: username:RRRGGGBBB or just username)
          state.users = values.map(v => {
            const parts = v.split(':');
            if (parts.length === 2) {
              return {
                username: this.normalize(parts[0]),
                color: this.nineDigitToRgb(parts[1])
              };
            }
            // Fallback for old format without color
            return {
              username: this.normalize(v),
              color: 'rgb(255, 255, 255)'  // Default white color
            };
          });
          break;
          
        case 'c':
          // Parse color-only filters (format: RRRGGGBBB)
          state.colors = values.map(v => this.nineDigitToRgb(v));
          break;
          
        case 'search':
          state.searchTerms = values;
          break;
          
        case 'word':
          state.words = values.map(v => v.toLowerCase());
          break;
          
        case '-word':
          state.negativeWords = values.map(v => v.toLowerCase());
          break;
          
        case 'wordremove':
          state.wordRemove = values.map(v => v.toLowerCase());
          break;
          
        case 'video':
          // Handle special keywords
          if (values[0] === 'random' || values[0] === 'none') {
            state.videoPlaylist = [values[0]];
          } else {
            state.videoPlaylist = values;
          }
          // If video specified, implicitly open panel (unless explicitly set)
          if (state.videoPanel === null && values[0] !== 'none') {
            state.videoPanel = true;
          }
          break;
          
        case 'from':
          // Store raw value - will be parsed when filtering
          state.from = values[0];
          break;
          
        case 'to':
          // Store raw value - will be parsed when filtering
          state.to = values[0];
          break;
          
        case 'timeFrom':
          // Parse as number (minutes)
          const timeFromNum = parseInt(values[0], 10);
          if (!isNaN(timeFromNum)) {
            state.timeFrom = timeFromNum;
          }
          break;
          
        case 'timeTo':
          // Parse as number (minutes)
          const timeToNum = parseInt(values[0], 10);
          if (!isNaN(timeToNum)) {
            state.timeTo = timeToNum;
          }
          break;
      }
    }
    
    return state;
  }
  
  /**
   * Build URL hash from filter state
   */
  buildHash(state: SWWFilterState): string {
    const params: string[] = [];
    
    // Add user filters with colors (converted to 9-digit format)
    if (state.users.length > 0) {
      const userStrings = state.users.map(u => 
        `${u.username}:${this.rgbToNineDigit(u.color)}`
      );
      params.push(`u=${userStrings.join('+')}`);
    }
    
    // Add color-only filters (converted to 9-digit format)
    if (state.colors.length > 0) {
      const colorStrings = state.colors.map(c => this.rgbToNineDigit(c));
      params.push(`c=${colorStrings.join('+')}`);
    }
    
    // Add search filters
    if (state.searchTerms.length > 0) {
      params.push(`search=${state.searchTerms.map(t => encodeURIComponent(t)).join('+')}`);
    }
    
    // Add word filters
    if (state.words.length > 0) {
      params.push(`word=${state.words.join('+')}`);
    }
    
    // Add negative word filters
    if (state.negativeWords.length > 0) {
      params.push(`-word=${state.negativeWords.join('+')}`);
    }
    
    // Add word remove filters
    if (state.wordRemove.length > 0) {
      params.push(`wordremove=${state.wordRemove.join('+')}`);
    }
    
    // Add video playlist
    if (state.videoPlaylist.length > 0) {
      params.push(`video=${state.videoPlaylist.join('+')}`);
    }
    
    // Add video panel state (only if explicitly set)
    if (state.videoPanel !== null) {
      params.push(`video=${state.videoPanel}`);
    }
    
    // Add date/time filters
    if (state.from) {
      params.push(`from=${encodeURIComponent(state.from)}`);
    }
    if (state.to) {
      params.push(`to=${encodeURIComponent(state.to)}`);
    }
    if (state.timeFrom !== null) {
      params.push(`timeFrom=${state.timeFrom}`);
    }
    if (state.timeTo !== null) {
      params.push(`timeTo=${state.timeTo}`);
    }
    
    return params.length > 0 ? `#${params.join('&')}` : '';
  }
  
  /**
   * Handle hash change events
   */
  private handleHashChange(): void {
    const newState = this.parseHash();
    this.currentState = newState;
    this.notifySubscribers();
  }
  
  /**
   * Notify all subscribers of state change
   */
  private notifySubscribers(): void {
    this.subscribers.forEach(callback => callback(this.currentState));
  }
  
  /**
   * Subscribe to state changes
   */
  subscribe(callback: (state: SWWFilterState) => void): () => void {
    this.initialize(); // Ensure initialized before subscribing
    this.subscribers.add(callback);
    // Immediately call with current state
    callback(this.currentState);
    
    // Return unsubscribe function
    return () => {
      this.subscribers.delete(callback);
    };
  }
  
  /**
   * Update URL with new state (merges with existing)
   */
  updateURL(updates: Partial<SWWFilterState>): void {
    if (typeof window === 'undefined') return;
    this.initialize(); // Ensure initialized
    
    const newState = { ...this.currentState, ...updates };
    const hash = this.buildHash(newState);
    
    // Update URL without triggering hashchange if it's the same
    if (window.location.hash !== hash) {
      window.history.pushState(null, '', hash || '#');
      this.currentState = newState;
      this.notifySubscribers();
    }
  }
  
  /**
   * Merge updates with current state
   */
  mergeURL(updates: Partial<SWWFilterState>): void {
    if (typeof window === 'undefined') return;
    this.initialize(); // Ensure initialized
    
    const newState = { ...this.currentState };
    
    // Merge users array (handle UserWithColor objects)
    if (updates.users) {
      const existingUsers = newState.users || [];
      const newUsers = updates.users;
      
      // Merge by checking usernames to avoid duplicates
      const merged = [...existingUsers];
      for (const newUser of newUsers) {
        if (!merged.some(u => u.username === newUser.username)) {
          merged.push(newUser);
        }
      }
      newState.users = merged;
    }
    if (updates.colors) {
      newState.colors = Array.from(new Set([...newState.colors, ...updates.colors]));
    }
    if (updates.searchTerms) {
      newState.searchTerms = Array.from(new Set([...newState.searchTerms, ...updates.searchTerms]));
    }
    if (updates.words) {
      newState.words = Array.from(new Set([...newState.words, ...updates.words]));
    }
    if (updates.negativeWords) {
      newState.negativeWords = Array.from(new Set([...newState.negativeWords, ...updates.negativeWords]));
    }
    if (updates.wordRemove) {
      newState.wordRemove = Array.from(new Set([...newState.wordRemove, ...updates.wordRemove]));
    }
    if (updates.videoPlaylist) {
      newState.videoPlaylist = Array.from(new Set([...newState.videoPlaylist, ...updates.videoPlaylist]));
    }
    if (updates.videoPanel !== undefined) {
      newState.videoPanel = updates.videoPanel;
    }
    if (updates.from !== undefined) {
      newState.from = updates.from;
    }
    if (updates.to !== undefined) {
      newState.to = updates.to;
    }
    if (updates.timeFrom !== undefined) {
      newState.timeFrom = updates.timeFrom;
    }
    if (updates.timeTo !== undefined) {
      newState.timeTo = updates.timeTo;
    }
    
    const hash = this.buildHash(newState);
    
    if (window.location.hash !== hash) {
      window.history.pushState(null, '', hash || '#');
      this.currentState = newState;
      this.notifySubscribers();
    }
  }
  
  /**
   * Remove specific filter value
   */
  removeFromURL(filterType: keyof SWWFilterState, value?: string): void {
    if (typeof window === 'undefined') return;
    this.initialize(); // Ensure initialized
    
    const newState = { ...this.currentState };
    
    if (filterType === 'videoPanel') {
      newState.videoPanel = null;
    } else if (filterType === 'users' && Array.isArray(newState.users)) {
      if (value) {
        // Remove specific user by username
        const normalized = this.normalize(value);
        newState.users = newState.users.filter(u => u.username !== normalized);
      } else {
        // Clear all users
        newState.users = [];
      }
    } else if (filterType === 'colors' && Array.isArray(newState.colors)) {
      if (value) {
        // Remove specific color
        newState.colors = newState.colors.filter(c => c !== value);
      } else {
        // Clear all colors
        newState.colors = [];
      }
    } else if (Array.isArray(newState[filterType])) {
      if (value) {
        // Remove specific value
        const normalized = value.toLowerCase();
        (newState[filterType] as string[]) = (newState[filterType] as string[])
          .filter(v => v !== normalized);
      } else {
        // Clear entire filter type
        (newState[filterType] as string[]) = [];
      }
    }
    
    const hash = this.buildHash(newState);
    window.history.pushState(null, '', hash || '#');
    this.currentState = newState;
    this.notifySubscribers();
  }
  
  /**
   * Clear all filters
   */
  clearAll(): void {
    if (typeof window === 'undefined') return;
    this.initialize(); // Ensure initialized
    
    window.history.pushState(null, '', '#');
    this.currentState = this.getEmptyState();
    this.notifySubscribers();
  }
  
  /**
   * Get current state
   */
  getCurrentState(): SWWFilterState {
    this.initialize(); // Ensure initialized before getting state
    return { ...this.currentState };
  }
}
