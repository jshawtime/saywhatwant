/**
 * Simple, elegant filter hook
 * Direct URL manipulation, no complex state management
 */

import { useEffect, useState, useCallback, useMemo } from 'react';
import { 
  parseURL, 
  updateURL, 
  normalizeUsername,
  rgbToNineDigit,
  nineDigitToRgb,
  type FilterState,
  type FilterUser 
} from '@/lib/url-filter-simple';
import type { Comment } from '@/types';

interface UseSimpleFiltersProps {
  comments: Comment[];
  filterByColorToo?: boolean;
}

export function useSimpleFilters({ 
  comments, 
  filterByColorToo = true 
}: UseSimpleFiltersProps) {
  // Single state derived from URL
  const [filterState, setFilterState] = useState<FilterState>(() => parseURL());

  // Parse URL state on mount (no auto-adding defaults)
  useEffect(() => {
    setFilterState(parseURL());
  }, []);

  // Listen for URL changes
  useEffect(() => {
    const handleHashChange = () => {
      setFilterState(parseURL());
    };

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  // Simple operations - no merging, just direct manipulation
  const addUser = useCallback((username: string, color: string) => {
    const normalized = normalizeUsername(username);
    const colorDigits = rgbToNineDigit(color);
    
    // Check if already exists
    const exists = filterState.users.some(u => 
      u.username === normalized && 
      u.color === colorDigits  // No conversion needed - colors are stored as 9-digit
    );
    
    if (!exists) {
      const newState: FilterState = {
        ...filterState,
        users: [...filterState.users, { username: normalized, color: colorDigits }]  // Store as 9-digit
      };
      updateURL(newState);
    }
  }, [filterState]);

  const removeUser = useCallback((username: string, color: string) => {
    const normalized = normalizeUsername(username);
    const colorDigits = rgbToNineDigit(color);
    
    const newState: FilterState = {
      ...filterState,
      users: filterState.users.filter(u => 
        !(u.username === normalized && u.color === colorDigits)  // No conversion needed
      )
    };
    updateURL(newState);
  }, [filterState]);

  const addWord = useCallback((word: string) => {
    const normalized = word.toLowerCase();
    if (!filterState.words.includes(normalized)) {
      const newState: FilterState = {
        ...filterState,
        words: [...filterState.words, normalized]
      };
      updateURL(newState);
    }
  }, [filterState]);

  const removeWord = useCallback((word: string) => {
    const newState: FilterState = {
      ...filterState,
      words: filterState.words.filter(w => w !== word.toLowerCase())
    };
    updateURL(newState);
  }, [filterState]);

  const addNegativeWord = useCallback((word: string) => {
    const normalized = word.toLowerCase();
    if (!filterState.negativeWords.includes(normalized)) {
      const newState: FilterState = {
        ...filterState,
        negativeWords: [...filterState.negativeWords, normalized]
      };
      updateURL(newState);
    }
  }, [filterState]);

  const removeNegativeWord = useCallback((word: string) => {
    console.log('[Filter] Removing negative word:', word);
    console.log('[Filter] Current negative words:', filterState.negativeWords);
    console.log('[Filter] Word lowercase:', word.toLowerCase());
    
    const newState: FilterState = {
      ...filterState,
      negativeWords: filterState.negativeWords.filter(w => {
        const matches = w !== word.toLowerCase();
        console.log(`[Filter] Comparing "${w}" !== "${word.toLowerCase()}" = ${matches}`);
        return matches;
      })
    };
    
    console.log('[Filter] New negative words:', newState.negativeWords);
    updateURL(newState);
  }, [filterState]);

  const toggleFilter = useCallback(() => {
    const newState: FilterState = {
      ...filterState,
      filterActive: !filterState.filterActive
    };
    updateURL(newState);
  }, [filterState]);

  const clearAllFilters = useCallback(() => {
    const newState: FilterState = {
      users: [],
      words: [],
      negativeWords: [],
      filterActive: false,
      messageType: filterState.messageType  // Preserve channel when clearing filters
    };
    updateURL(newState);
  }, [filterState.messageType]);
  
  const setMessageType = useCallback((type: 'human' | 'AI' | 'ALL' | null) => {
    console.log('[useSimpleFilters] setMessageType called with:', type);
    console.log('[useSimpleFilters] Current filterState:', filterState);
    
    const newState: FilterState = {
      ...filterState,
      messageType: type
    };
    
    console.log('[useSimpleFilters] New state:', newState);
    updateURL(newState);
    
    // Also save to localStorage as fallback (only if not null)
    if (type !== null) {
      localStorage.setItem('sww-message-channel', type);
    }
  }, [filterState]);

  // Apply filters to comments
  const filteredComments = useMemo(() => {
    if (!filterState.filterActive) {
      return comments;
    }

    let filtered = comments;

    // Filter by users
    if (filterState.users.length > 0) {
      filtered = filtered.filter(comment => {
        if (!comment.username) return false;
        
        const normalizedComment = normalizeUsername(comment.username);
        return filterState.users.some(filter => {
          const usernameMatches = filter.username === normalizedComment;
          if (!filterByColorToo) return usernameMatches;
          
          // Both filter.color and comment.color should be in 9-digit format
          // Convert comment.color to 9-digit if it's in RGB format
          const commentColorDigits = comment.color ? rgbToNineDigit(comment.color) : '096165250';
          const colorMatches = filter.color === commentColorDigits;
          return usernameMatches && colorMatches;
        });
      });
    }

    // Filter by words
    if (filterState.words.length > 0) {
      filtered = filtered.filter(comment => {
        const text = comment.text?.toLowerCase() || '';
        return filterState.words.some(word => text.includes(word));
      });
    }

    // Filter by negative words
    if (filterState.negativeWords.length > 0) {
      filtered = filtered.filter(comment => {
        const text = comment.text?.toLowerCase() || '';
        return !filterState.negativeWords.some(word => text.includes(word));
      });
    }

    return filtered;
  }, [comments, filterState, filterByColorToo]);

  return {
    // State
    filterState,
    isFilterEnabled: filterState.filterActive,
    hasFilters: filterState.users.length > 0 || 
                filterState.words.length > 0 || 
                filterState.negativeWords.length > 0,
    messageType: filterState.messageType,  // NEW: Expose message type
    
    // Filtered results
    filteredComments,
    
    // Operations
    addUser,
    removeUser,
    addWord,
    removeWord,
    addNegativeWord,
    removeNegativeWord,
    toggleFilter,
    clearAllFilters,
    setMessageType,  // NEW: Set message type
    
    // For compatibility during transition
    // Convert colors to RGB for display in FilterBar
    mergedUserFilters: filterState.users.map(user => ({
      ...user,
      color: nineDigitToRgb(user.color)
    })),
    mergedFilterWords: filterState.words,
    mergedNegativeWords: filterState.negativeWords,
    addToFilter: addUser,
    removeFromFilter: removeUser,
    addWordToFilter: addWord,
    removeWordFromFilter: removeWord,
    addNegativeWordFilter: addNegativeWord,
    removeNegativeWordFilter: removeNegativeWord,
    
    // NEW: User initial state from URL
    uis: filterState.uis,
    
    // NEW: AI initial state from URL (overrides entity username/color)
    ais: filterState.ais,
    
    // NEW: Bot control parameters from URL
    entity: filterState.entity,
    priority: filterState.priority,
    model: filterState.model,
    nom: filterState.nom,
  };
}
