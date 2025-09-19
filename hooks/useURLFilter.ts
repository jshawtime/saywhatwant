/**
 * useURLFilter Hook
 * Integrates URLFilterManager with React components
 * Syncs URL state with existing filter system
 */

import { useEffect, useState, useCallback } from 'react';
import { URLFilterManager, SWWFilterState } from '../lib/url-filter-manager';

export function useURLFilter() {
  const [urlState, setUrlState] = useState<SWWFilterState>(() => {
    // Initialize with empty state during SSR
    if (typeof window === 'undefined') {
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
    // Initialize with current URL state on client
    const manager = URLFilterManager.getInstance();
    return manager.getCurrentState();
  });
  
  useEffect(() => {
    const manager = URLFilterManager.getInstance();
    
    // Subscribe to URL changes
    const unsubscribe = manager.subscribe((newState) => {
      setUrlState(newState);
    });
    
    return unsubscribe;
  }, []);
  
  // Add a user to filter
  const addUserToURL = useCallback((username: string) => {
    const manager = URLFilterManager.getInstance();
    const currentState = manager.getCurrentState();
    const normalized = manager.normalize(username);
    
    if (!currentState.users.includes(normalized)) {
      manager.mergeURL({ 
        users: [...currentState.users, normalized] 
      });
    }
  }, []);
  
  // Remove a user from filter
  const removeUserFromURL = useCallback((username: string) => {
    const manager = URLFilterManager.getInstance();
    manager.removeFromURL('users', username);
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
    clearURLFilters
  };
}
