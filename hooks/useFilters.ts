import { useState, useEffect, useCallback, useMemo } from 'react';
import { Comment } from '@/types';
import { useURLFilter } from './useURLFilter';
import { URLFilterManager } from '@/lib/url-filter-manager';
import { parseDateTime, parseMinutesAgo, correctDateRange, isWithinDateRange } from '@/utils/dateTimeParser';
// Removed IndexedDB imports - ham radio mode: filters are ephemeral

export interface UsernameFilter {
  username: string;
  color: string;
}

interface UseFiltersProps {
  displayedComments: Comment[];
  searchTerm: string;
}

export const useFilters = ({ displayedComments, searchTerm }: UseFiltersProps) => {
  // No longer using local state - URL is the single source of truth
  const [filterByColorToo, setFilterByColorToo] = useState(true);
  
  // Get URL filter state and methods
  const { 
    urlState, 
    hasURLFilters,
    addUserToURL,
    removeUserFromURL,
    addWordToURL,
    removeWordFromURL,
    addNegativeWordToURL,
    removeNegativeWordFromURL,
    addSearchTermToURL,
    removeSearchTermFromURL,
    clearDateTimeFilter,
    clearURLFilters,
    setURLFromFilters,
    setFilterActive,
    filterActive
  } = useURLFilter();
  
  // Get filter enabled state from URL, with special cases as fallback
  const [localFilterDefault, setLocalFilterDefault] = useState(false);
  
  // Use URL filterActive if explicitly set, otherwise use local default
  const isFilterEnabled = filterActive !== null ? filterActive : localFilterDefault;

  // Initialize filter state preference only (not content)
  useEffect(() => {
    // Only run on client side
    if (typeof window === 'undefined') return;
    
    // Clear old filter content from localStorage to prevent interference
    // URL is now the ONLY source of truth for filter content
    localStorage.removeItem('sww-filters');
    localStorage.removeItem('sww-word-filters');
    localStorage.removeItem('sww-negative-filters');
    
    // URL is the single source of truth for filter CONTENT
    // Only use localStorage for filter enabled STATE when not in URL
    
    const savedFilterEnabled = localStorage.getItem('sww-filter-enabled');
    
    // Only set local default if filterActive is not in URL
    if (filterActive === null) {
      // Apply special cases for default filter state
      if (!hasURLFilters) {
        // Special Case 1: Base URL (no filters) → Filters OFF
        setLocalFilterDefault(false);
      } else if (hasURLFilters) {
        // Special Case 2: URL has filters → filters ON by default
        setLocalFilterDefault(true);
      } else if (savedFilterEnabled !== null) {
        // Normal case: Use saved preference from localStorage
        setLocalFilterDefault(savedFilterEnabled === 'true');
      } else {
        // Default: filters OFF
        setLocalFilterDefault(false);
      }
    }
  }, [filterActive, hasURLFilters]); // Include dependencies that affect filter state
  
  // Ham radio mode - no filter recording to IndexedDB
  // Filters are ephemeral - only active while tab is open
  
  // Use ONLY URL filters - no merging with localStorage
  const mergedFilterWords = useMemo(() => {
    return urlState.words;
  }, [urlState.words]);
  
  const mergedNegativeWords = useMemo(() => {
    return urlState.negativeWords;
  }, [urlState.negativeWords]);
  
  const mergedUserFilters = useMemo(() => {
    // ONLY use URL as source of truth - no merging with localStorage
    // This ensures the filter bar only shows what's actually in the URL
    return [...urlState.users, ...urlState.serverSideUsers];
  }, [urlState.users, urlState.serverSideUsers]);

  // Add username to filter - ONLY to URL
  const addToFilter = useCallback((username: string, color: string) => {
    // Check if this exact username/color combo already exists in URL
    const exists = urlState.users.some(u => 
      u.username === username && u.color === color
    );
    
    if (!exists) {
      // ONLY add to URL - this is the single source of truth
      addUserToURL(username, color);
    }
  }, [urlState.users, addUserToURL]);

  // Remove username from filter - ONLY from URL
  const removeFromFilter = useCallback((username: string, color: string) => {
    // Remove specific username+color combo from URL
    removeUserFromURL(username, color);
    // TODO: Add support for removing server-side users if needed
  }, [removeUserFromURL]);

  // Add word to filter - ONLY to URL
  const addWordToFilter = useCallback((word: string) => {
    const cleanWord = word.trim().toLowerCase();
    if (cleanWord && !urlState.words.includes(cleanWord)) {
      // ONLY add to URL - this is the single source of truth
      addWordToURL(cleanWord);
    }
  }, [urlState.words, addWordToURL]);

  // Remove word from filter - ONLY from URL
  const removeWordFromFilter = useCallback((word: string) => {
    // Simply remove from URL - it's the single source of truth
    removeWordFromURL(word);
  }, [removeWordFromURL]);

  // Add negative word filter - ONLY to URL
  const addNegativeWordFilter = useCallback((word: string) => {
    const cleanWord = word.trim().toLowerCase();
    if (cleanWord && !urlState.negativeWords.includes(cleanWord)) {
      // ONLY add to URL - this is the single source of truth
      addNegativeWordToURL(cleanWord);
    }
  }, [urlState.negativeWords, addNegativeWordToURL]);

  // Remove negative word filter - ONLY from URL
  const removeNegativeWordFilter = useCallback((word: string) => {
    // Simply remove from URL - it's the single source of truth
    removeNegativeWordFromURL(word);
  }, [removeNegativeWordFromURL]);

  // Toggle filter enabled state - Updates URL
  const toggleFilter = useCallback(() => {
    const newState = !isFilterEnabled;
    // Update URL with new filter state
    setFilterActive(newState);
    // Also save to localStorage for defaults
    localStorage.setItem('sww-filter-enabled', String(newState));
  }, [isFilterEnabled, setFilterActive]);

  // Apply filters to comments
  const filteredComments = useMemo(() => {
    let filtered = displayedComments;
    
    // Apply merged username filters AND color-only filters (if enabled)
    if (isFilterEnabled && (mergedUserFilters.length > 0 || urlState.colors.length > 0)) {
      filtered = filtered.filter(comment => {
        if (!comment.username) return false;
        
        // First check color-only filters
        if (urlState.colors.length > 0) {
          const commentColor = comment.color || '#60A5FA';
          if (urlState.colors.includes(commentColor)) {
            return true;
          }
        }
        
        // Then check username/color combination filters
        return mergedUserFilters.some(filter => {
          const usernameMatches = filter.username === comment.username;
          const colorMatches = filter.color === (comment.color || '#60A5FA');
          
          // Filter by both username AND color to differentiate users
          return filterByColorToo ? (usernameMatches && colorMatches) : usernameMatches;
        });
      });
    }
    
    // Apply merged word filters (if enabled and present)
    if (isFilterEnabled && mergedFilterWords.length > 0) {
      filtered = filtered.filter(comment => {
        const commentLower = comment.text.toLowerCase();
        // Check if ALL filter words are in the comment (AND logic)
        return mergedFilterWords.every(word => commentLower.includes(word.toLowerCase()));
      });
    }
    
    // Apply merged negative word filters (exclude comments with these words)
    if (isFilterEnabled && mergedNegativeWords.length > 0) {
      filtered = filtered.filter(comment => {
        const commentLower = comment.text.toLowerCase();
        // Exclude if ANY negative filter word is in the comment
        return !mergedNegativeWords.some(word => commentLower.includes(word.toLowerCase()));
      });
    }
    
    // Apply word remove filters (hide specific words from display)
    if (isFilterEnabled && urlState.wordRemove.length > 0) {
      filtered = filtered.filter(comment => {
        const commentLower = comment.text.toLowerCase();
        // Remove comments that contain any of the wordRemove terms
        return !urlState.wordRemove.some(word => commentLower.includes(word.toLowerCase()));
      });
    }
    
    // Apply date/time filters
    if (isFilterEnabled && (urlState.from || urlState.to || urlState.timeFrom !== null || urlState.timeTo !== null)) {
      // Parse date/time values
      let fromTimestamp: number | null = null;
      let toTimestamp: number | null = null;
      
      // Prefer from/to over timeFrom/timeTo
      if (urlState.from || urlState.to) {
        const fromParsed = parseDateTime(urlState.from);
        const toParsed = parseDateTime(urlState.to);
        
        fromTimestamp = fromParsed?.isValid ? fromParsed.timestamp : null;
        toTimestamp = toParsed?.isValid ? toParsed.timestamp : null;
      } else if (urlState.timeFrom !== null || urlState.timeTo !== null) {
        fromTimestamp = parseMinutesAgo(urlState.timeFrom);
        toTimestamp = parseMinutesAgo(urlState.timeTo);
      }
      
      // Auto-correct backwards ranges
      const corrected = correctDateRange(fromTimestamp, toTimestamp);
      
      // Filter comments by date range
      if (corrected.from !== null || corrected.to !== null) {
        filtered = filtered.filter(comment => {
          // Comment timestamp is already in milliseconds
          const commentTime = comment.timestamp || Date.now();
          return isWithinDateRange(commentTime, corrected.from, corrected.to);
        });
      }
    }
    
    // Apply search bar filter (from UI or URL)
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter(comment => 
        comment.text.toLowerCase().includes(searchLower) ||
        (comment.username && comment.username.toLowerCase().includes(searchLower))
      );
    }
    
    return filtered;
  }, [displayedComments, searchTerm, mergedUserFilters, mergedFilterWords, mergedNegativeWords, isFilterEnabled, filterByColorToo, urlState.colors, urlState.wordRemove, urlState.from, urlState.to, urlState.timeFrom, urlState.timeTo]);

  return {
    filterUsernames: mergedUserFilters,
    filterWords: mergedFilterWords,
    negativeFilterWords: mergedNegativeWords,
    isFilterEnabled,
    filteredComments,
    addToFilter,
    removeFromFilter,
    addWordToFilter,
    removeWordFromFilter,
    addNegativeWordFilter,
    removeNegativeWordFilter,
    toggleFilter,
    hasActiveFilters: mergedUserFilters.length > 0 || 
                      mergedFilterWords.length > 0 || 
                      mergedNegativeWords.length > 0 || 
                      urlState.colors.length > 0 ||
                      urlState.wordRemove.length > 0 || 
                      urlState.from !== null || 
                      urlState.to !== null ||
                      urlState.timeFrom !== null ||
                      urlState.timeTo !== null,
    // URL-specific exports
    urlSearchTerms: urlState.searchTerms,
    addSearchTermToURL,
    removeSearchTermFromURL,
    urlColors: urlState.colors,  // Color-only filters from URL
    serverSideUsers: urlState.serverSideUsers,  // Server-side user search from URL
    // Date/time filters
    dateTimeFilter: {
      from: urlState.from,
      to: urlState.to,
      timeFrom: urlState.timeFrom,
      timeTo: urlState.timeTo
    },
    clearDateTimeFilter
  };
};
