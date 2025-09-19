/**
 * URLFilterManager - Singleton class for managing URL-based filtering
 * Handles parsing, building, and syncing filter state with URL hash
 */

export interface SWWFilterState {
  users: string[];              // Usernames to filter
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
  
  private constructor() {
    // Only run in browser environment
    if (typeof window !== 'undefined') {
      // Listen for URL changes
      window.addEventListener('hashchange', () => this.handleHashChange());
      window.addEventListener('popstate', () => this.handleHashChange());
      
      // Parse initial URL
      this.handleHashChange();
    }
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
          state.users = values.map(v => this.normalize(v));
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
    
    // Add user filters
    if (state.users.length > 0) {
      params.push(`u=${state.users.join('+')}`);
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
    
    const newState = { ...this.currentState };
    
    // Merge arrays (don't replace)
    if (updates.users) {
      newState.users = Array.from(new Set([...newState.users, ...updates.users]));
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
    
    const newState = { ...this.currentState };
    
    if (filterType === 'videoPanel') {
      newState.videoPanel = null;
    } else if (Array.isArray(newState[filterType])) {
      if (value) {
        // Remove specific value
        const normalized = filterType === 'users' ? this.normalize(value) : value.toLowerCase();
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
    
    window.history.pushState(null, '', '#');
    this.currentState = this.getEmptyState();
    this.notifySubscribers();
  }
  
  /**
   * Get current state
   */
  getCurrentState(): SWWFilterState {
    return { ...this.currentState };
  }
}
