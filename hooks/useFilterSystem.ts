// hooks/useFilterSystem.ts
/**
 * React Hook for Filter System Integration
 * Provides a React-friendly interface to the filter system module
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  FilterManager, 
  FilterState, 
  Comment, 
  FilterConfig,
  UsernameFilter,
  DateTimeFilter 
} from '@/modules/filterSystem';
import { URLFilterManager } from '@/lib/url-filter-manager';

interface UseFilterSystemProps {
  comments: Comment[];
  searchTerm?: string;
  config?: FilterConfig;
}

interface UseFilterSystemReturn {
  // Filtered results
  filteredComments: Comment[];
  
  // Filter state
  filterUsernames: UsernameFilter[];
  filterWords: string[];
  negativeFilterWords: string[];
  isFilterEnabled: boolean;
  hasActiveFilters: boolean;
  dateTimeFilter: DateTimeFilter;
  
  // Filter actions
  addToFilter: (username: string, color: string) => void;
  removeFromFilter: (username: string, color: string) => void;
  addWordToFilter: (word: string) => void;
  removeWordFromFilter: (word: string) => void;
  addNegativeWordFilter: (word: string) => void;
  removeNegativeWordFilter: (word: string) => void;
  toggleFilter: () => void;
  clearDateTimeFilter: () => void;
  clearAllFilters: () => void;
  
  // URL integration
  urlSearchTerms: string[];
  addSearchTermToURL: (term: string) => void;
  removeSearchTermFromURL: (term: string) => void;
}

export function useFilterSystem({ 
  comments, 
  searchTerm = '', 
  config = {} 
}: UseFilterSystemProps): UseFilterSystemReturn {
  // Create filter manager instance
  const [filterManager] = useState(() => new FilterManager(config));
  const [filterState, setFilterState] = useState<FilterState>(filterManager.getState());
  const [urlSearchTerms, setUrlSearchTerms] = useState<string[]>([]);

  // Update filter state when manager changes
  const updateFilterState = useCallback(() => {
    setFilterState(filterManager.getState());
  }, [filterManager]);

  // Initialize URL integration
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const urlManager = URLFilterManager.getInstance();
    const urlState = urlManager.getCurrentState();
    setUrlSearchTerms(urlState.searchTerms);

    // Subscribe to URL changes
    const unsubscribe = urlManager.subscribe((newState) => {
      setUrlSearchTerms(newState.searchTerms);
      
      // Update filter manager with URL state
      if (newState.from || newState.to || newState.timeFrom !== null || newState.timeTo !== null) {
        filterManager.updateDateTimeFilter({
          from: newState.from,
          to: newState.to,
          timeFrom: newState.timeFrom,
          timeTo: newState.timeTo,
        });
        updateFilterState();
      }
    });

    return unsubscribe;
  }, [filterManager, updateFilterState]);

  // Apply search term filter
  const searchFilteredComments = useMemo(() => {
    if (!searchTerm || searchTerm.trim() === '') {
      return comments;
    }

    const searchLower = searchTerm.toLowerCase();
    return comments.filter(comment => {
      const textMatch = comment.text.toLowerCase().includes(searchLower);
      const usernameMatch = comment.username?.toLowerCase().includes(searchLower);
      return textMatch || usernameMatch;
    });
  }, [comments, searchTerm]);

  // Apply all filters
  const filteredComments = useMemo(() => {
    return filterManager.applyFilters(searchFilteredComments);
  }, [filterManager, searchFilteredComments, filterState]);

  // Filter actions
  const addToFilter = useCallback((username: string, color: string) => {
    filterManager.addUsernameFilter(username, color);
    updateFilterState();
  }, [filterManager, updateFilterState]);

  const removeFromFilter = useCallback((username: string, color: string) => {
    filterManager.removeUsernameFilter(username, color);
    updateFilterState();
  }, [filterManager, updateFilterState]);

  const addWordToFilter = useCallback((word: string) => {
    filterManager.addWordFilter(word);
    updateFilterState();
  }, [filterManager, updateFilterState]);

  const removeWordFromFilter = useCallback((word: string) => {
    filterManager.removeWordFilter(word);
    updateFilterState();
  }, [filterManager, updateFilterState]);

  const addNegativeWordFilter = useCallback((word: string) => {
    filterManager.addNegativeWordFilter(word);
    updateFilterState();
  }, [filterManager, updateFilterState]);

  const removeNegativeWordFilter = useCallback((word: string) => {
    filterManager.removeNegativeWordFilter(word);
    updateFilterState();
  }, [filterManager, updateFilterState]);

  const toggleFilter = useCallback(() => {
    filterManager.toggleEnabled();
    updateFilterState();
  }, [filterManager, updateFilterState]);

  const clearDateTimeFilter = useCallback(() => {
    filterManager.clearDateTimeFilter();
    updateFilterState();
  }, [filterManager, updateFilterState]);

  const clearAllFilters = useCallback(() => {
    filterManager.clearAllFilters();
    updateFilterState();
  }, [filterManager, updateFilterState]);

  // URL actions
  const addSearchTermToURL = useCallback((term: string) => {
    const urlManager = URLFilterManager.getInstance();
    const currentState = urlManager.getCurrentState();
    const normalized = urlManager.normalize(term);
    
    if (!currentState.searchTerms.includes(normalized)) {
      urlManager.mergeURL({ 
        searchTerms: [...currentState.searchTerms, normalized] 
      });
    }
  }, []);

  const removeSearchTermFromURL = useCallback((term: string) => {
    const urlManager = URLFilterManager.getInstance();
    urlManager.removeFromURL('searchTerms', term);
  }, []);

  return {
    // Filtered results
    filteredComments,
    
    // Filter state
    filterUsernames: filterState.usernames,
    filterWords: filterState.words,
    negativeFilterWords: filterState.negativeWords,
    isFilterEnabled: filterState.isEnabled,
    hasActiveFilters: filterManager.hasActiveFilters(),
    dateTimeFilter: filterState.dateTime,
    
    // Filter actions
    addToFilter,
    removeFromFilter,
    addWordToFilter,
    removeWordFromFilter,
    addNegativeWordFilter,
    removeNegativeWordFilter,
    toggleFilter,
    clearDateTimeFilter,
    clearAllFilters,
    
    // URL integration
    urlSearchTerms,
    addSearchTermToURL,
    removeSearchTermFromURL,
  };
}

export default useFilterSystem;
