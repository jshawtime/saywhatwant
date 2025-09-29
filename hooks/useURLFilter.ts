/**
 * useURLFilter Hook
 * Integrates URLFilterManager with React components
 * Syncs URL state with existing filter system
 */

import { useEffect, useState, useCallback } from 'react';
import { URLFilterManager, SWWFilterState, UserWithColor } from '../lib/url-filter-manager';

export function useURLFilter() {
  // Initialize with the current state from URLFilterManager if available
  // This ensures we get the correct initial state including filterActive
  const [urlState, setUrlState] = useState<SWWFilterState>(() => {
    // Use lazy initialization to get the current state synchronously
    if (typeof window !== 'undefined') {
      const manager = URLFilterManager.getInstance();
      const currentState = manager.getCurrentState();
      // If filterActive is present in the URL, use it
      if (currentState.filterActive !== null) {
        return currentState;
      }
    }
    // Fall back to empty state with filterActive=false (not null)
    return {
      users: [],
      serverSideUsers: [],
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
      timeTo: null,
      filterActive: false  // Default to false, not null
    };
  });
  
  useEffect(() => {
    // Only access URLFilterManager on client side
    if (typeof window === 'undefined') return;
    
    const manager = URLFilterManager.getInstance();
    const currentState = manager.getCurrentState();
    console.log('[useURLFilter] useEffect - setting state from manager:', currentState);
    
    // Set initial state from URL (in case it changed since lazy init)
    setUrlState(currentState);
    
    // Subscribe to URL changes
    const unsubscribe = manager.subscribe((newState) => {
      console.log('[useURLFilter] Received update from URLFilterManager:', newState);
      setUrlState(newState);
    });
    
    return unsubscribe;
  }, []);
  
  // Add a user with color to filter - color is REQUIRED
  const addUserToURL = useCallback((username: string, color: string) => {
    if (!username || !color) {
      console.error('[useURLFilter] Username and color are both required');
      return;
    }
    
    const manager = URLFilterManager.getInstance();
    const currentState = manager.getCurrentState();
    const normalized = manager.normalize(username);
    
    // Ensure color is in 9-digit format (it might come as rgb() from comments)
    const colorDigits = manager.rgbToNineDigit(color);
    
    // Check if this exact username/color combo already exists
    // Same username with different color = different user
    const exists = currentState.users.some(u => 
      u.username === normalized && u.color === colorDigits
    );
    if (!exists) {
      manager.mergeURL({ 
        users: [...currentState.users, { username: normalized, color: colorDigits }] 
      });
    }
  }, []);
  
  // Remove a specific user+color combo from filter - color is REQUIRED
  const removeUserFromURL = useCallback((username: string, color: string) => {
    if (!username || !color) {
      console.error('[useURLFilter] Username and color are both required for removal');
      return;
    }
    const manager = URLFilterManager.getInstance();
    // Ensure color is in 9-digit format before removal
    const colorDigits = manager.rgbToNineDigit(color);
    // Pass both username and color to properly identify which user to remove
    manager.removeFromURL('users', username, colorDigits);
  }, []);
  
  // Add search term
  const addSearchTermToURL = useCallback((term: string) => {
    const manager = URLFilterManager.getInstance();
    const currentState = manager.getCurrentState();
    
    if (!currentState.searchTerms.includes(term)) {
      manager.mergeURL({ 
        searchTerms: [...currentState.searchTerms, term] 
      });
    }
  }, []);
  
  // Remove search term
  const removeSearchTermFromURL = useCallback((term: string) => {
    const manager = URLFilterManager.getInstance();
    const currentState = manager.getCurrentState();
    manager.updateURL({
      searchTerms: currentState.searchTerms.filter(t => t !== term)
    });
  }, []);
  
  // Add word filter
  const addWordToURL = useCallback((word: string) => {
    const manager = URLFilterManager.getInstance();
    const currentState = manager.getCurrentState();
    const normalized = word.toLowerCase();
    
    if (!currentState.words.includes(normalized)) {
      manager.mergeURL({ 
        words: [...currentState.words, normalized] 
      });
    }
  }, []);
  
  // Remove word filter
  const removeWordFromURL = useCallback((word: string) => {
    const manager = URLFilterManager.getInstance();
    manager.removeFromURL('words', word);
  }, []);
  
  // Add negative word filter
  const addNegativeWordToURL = useCallback((word: string) => {
    const manager = URLFilterManager.getInstance();
    const currentState = manager.getCurrentState();
    const normalized = word.toLowerCase();
    
    if (!currentState.negativeWords.includes(normalized)) {
      manager.mergeURL({ 
        negativeWords: [...currentState.negativeWords, normalized] 
      });
    }
  }, []);
  
  // Remove negative word filter
  const removeNegativeWordFromURL = useCallback((word: string) => {
    const manager = URLFilterManager.getInstance();
    manager.removeFromURL('negativeWords', word);
  }, []);
  
  // Update date/time filters
  const setDateTimeFilter = useCallback((from: string | null, to: string | null) => {
    const manager = URLFilterManager.getInstance();
    manager.mergeURL({ from, to });
  }, []);
  
  const setTimeFilter = useCallback((timeFrom: number | null, timeTo: number | null) => {
    const manager = URLFilterManager.getInstance();
    manager.mergeURL({ timeFrom, timeTo });
  }, []);
  
  // Clear date/time filter
  const clearDateTimeFilter = useCallback(() => {
    const manager = URLFilterManager.getInstance();
    manager.mergeURL({ 
      from: null, 
      to: null, 
      timeFrom: null, 
      timeTo: null 
    });
  }, []);
  
  // Clear all URL filters
  const clearURLFilters = useCallback(() => {
    const manager = URLFilterManager.getInstance();
    manager.clearAll();
  }, []);

  // Set URL from filter bar state (when toggling filters ON)
  const setURLFromFilters = useCallback((filters: {
    users?: Array<{username: string; color: string}>;
    words?: string[];
    negativeWords?: string[];
  }) => {
    const manager = URLFilterManager.getInstance();
    
    // Clear current state first, then set new filters
    manager.clearAll();
    
    // Build the new state from provided filters
    const newState: Partial<SWWFilterState> = {};
    
    if (filters.users && filters.users.length > 0) {
      newState.users = filters.users.map(u => ({
        username: manager.normalize(u.username),
        color: u.color
      }));
    }
    
    if (filters.words && filters.words.length > 0) {
      newState.words = filters.words;
    }
    
    if (filters.negativeWords && filters.negativeWords.length > 0) {
      newState.negativeWords = filters.negativeWords;
    }
    
    // Update URL with these filters
    if (Object.keys(newState).length > 0) {
      manager.updateURL(newState);
    }
  }, []);
  
  // Set filter active state in URL
  const setFilterActive = useCallback((active: boolean) => {
    const manager = URLFilterManager.getInstance();
    manager.mergeURL({ filterActive: active });
  }, []);
  
  // Check if URL has active filters
  const hasURLFilters = 
    urlState.users.length > 0 ||
    urlState.searchTerms.length > 0 ||
    urlState.words.length > 0 ||
    urlState.negativeWords.length > 0 ||
    urlState.wordRemove.length > 0 ||
    urlState.videoPlaylist.length > 0 ||
    urlState.from !== null ||
    urlState.to !== null ||
    urlState.timeFrom !== null ||
    urlState.timeTo !== null;
  
  return {
    urlState,
    hasURLFilters,
    
    // User filters
    addUserToURL,
    removeUserFromURL,
    
    // Search filters
    addSearchTermToURL,
    removeSearchTermFromURL,
    
    // Word filters
    addWordToURL,
    removeWordFromURL,
    
    // Negative word filters
    addNegativeWordToURL,
    removeNegativeWordFromURL,
    
    // Date/time filters
    setDateTimeFilter,
    setTimeFilter,
    clearDateTimeFilter,
    
    // Clear all
    clearURLFilters,
    
    // Set URL from filters (for toggle)
    setURLFromFilters,
    
    // Filter active state
    setFilterActive,
    filterActive: urlState.filterActive
  };
}
