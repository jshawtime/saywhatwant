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
  const [filterUsernames, setFilterUsernames] = useState<UsernameFilter[]>([]);
  const [filterWords, setFilterWords] = useState<string[]>([]);
  const [negativeFilterWords, setNegativeFilterWords] = useState<string[]>([]);
  const [isFilterEnabled, setIsFilterEnabled] = useState(false); // Default: OFF
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
    setURLFromFilters
  } = useURLFilter();

  // Initialize IndexedDB and load filters on mount
  useEffect(() => {
    // Only run on client side
    if (typeof window === 'undefined') return;
    
    // Ham radio mode - no persistent storage initialization needed
    
    const savedFilters = localStorage.getItem('sww-filters');
    const savedWordFilters = localStorage.getItem('sww-word-filters');
    const savedNegativeFilters = localStorage.getItem('sww-negative-filters');
    const savedFilterEnabled = localStorage.getItem('sww-filter-enabled');
    
    if (savedFilters) {
      try {
        const filters = JSON.parse(savedFilters);
        if (Array.isArray(filters)) {
          // Handle both old format (strings) and new format (objects)
          const processedFilters = filters.map(f => 
            typeof f === 'string' ? {username: f, color: '#60A5FA'} : f
          );
          setFilterUsernames(processedFilters);
        }
      } catch (e) {
        console.error('Error loading saved filters:', e);
      }
    }
    
    if (savedWordFilters) {
      try {
        const words = JSON.parse(savedWordFilters);
        if (Array.isArray(words)) {
          setFilterWords(words);
        }
      } catch (e) {
        console.error('Error loading saved word filters:', e);
      }
    }
    
    if (savedNegativeFilters) {
      try {
        const words = JSON.parse(savedNegativeFilters);
        if (Array.isArray(words)) {
          setNegativeFilterWords(words);
        }
      } catch (e) {
        console.error('Error loading saved negative filters:', e);
      }
    }
    
    // Load filter enabled state with special cases:
    // Special Case 1: Base URL (no filters) → Filters OFF
    // Special Case 2: URL has filters + empty filter bar → Filters ON
    // Otherwise: User's saved preference
    
    if (!hasURLFilters) {
      // Special Case 1: Visiting with base URL → filters OFF
      setIsFilterEnabled(false);
    } else if (hasURLFilters && !savedFilters && !savedWordFilters && !savedNegativeFilters) {
      // Special Case 2: URL has filters but filter bar is empty → filters ON
      // This helps new users understand filters
      setIsFilterEnabled(true);
      localStorage.setItem('sww-filter-enabled', 'true');
    } else if (savedFilterEnabled !== null) {
      // Normal case: Use saved preference
      setIsFilterEnabled(savedFilterEnabled === 'true');
    } else {
      // Default: filters OFF
      setIsFilterEnabled(false);
    }
  }, []); // Only run once on mount - special cases apply to initial load only
  
  // Ham radio mode - no filter recording to IndexedDB
  // Filters are ephemeral - only active while tab is open
  
  // Merge URL filters with existing filters
  const mergedFilterWords = useMemo(() => {
    const merged = Array.from(new Set([...filterWords, ...urlState.words]));
    return merged;
  }, [filterWords, urlState.words]);
  
  const mergedNegativeWords = useMemo(() => {
    const merged = Array.from(new Set([...negativeFilterWords, ...urlState.negativeWords]));
    return merged;
  }, [negativeFilterWords, urlState.negativeWords]);
  
  const mergedUserFilters = useMemo(() => {
    // Merge URL users with existing filter usernames
    const existingUsernames = filterUsernames.map(f => f.username.toLowerCase());
    
    // URL users now come with colors
    const urlUserFilters = urlState.users.filter(u => 
      !existingUsernames.includes(u.username.toLowerCase())
    );
    
    // Server-side search users (from #uss=) also need to be in filter bar
    const serverUserFilters = urlState.serverSideUsers.filter(u =>
      !existingUsernames.includes(u.username.toLowerCase()) &&
      !urlUserFilters.some(uf => uf.username.toLowerCase() === u.username.toLowerCase())
    );
    
    return [...filterUsernames, ...urlUserFilters, ...serverUserFilters];
  }, [filterUsernames, urlState.users, urlState.serverSideUsers]);

  // Add username to filter
  const addToFilter = useCallback((username: string, color: string) => {
    // Check if this exact username/color combo already exists
    const exists = filterUsernames.some(f => 
      f.username === username && f.color === color
    );
    
    if (!exists) {
      const newFilters = [...filterUsernames, {username, color}];
      setFilterUsernames(newFilters);
      localStorage.setItem('sww-filters', JSON.stringify(newFilters));
      
      // Always sync URL with filter bar contents
      addUserToURL(username, color);
    }
  }, [filterUsernames, addUserToURL]);

  // Remove username from filter
  const removeFromFilter = useCallback((username: string, color: string) => {
    // Check if this is a URL user, server-side user, or local user
    const normalizedUsername = username.toLowerCase();
    const isUrlUser = urlState.users.some(u => u.username.toLowerCase() === normalizedUsername);
    const isServerSideUser = urlState.serverSideUsers.some(u => u.username.toLowerCase() === normalizedUsername);
    const isLocalUser = filterUsernames.some(f => f.username === username && f.color === color);
    
    if (isLocalUser) {
      const newFilters = filterUsernames.filter(f => 
        !(f.username === username && f.color === color)
      );
      setFilterUsernames(newFilters);
      localStorage.setItem('sww-filters', JSON.stringify(newFilters));
    }
    
    if (isUrlUser) {
      removeUserFromURL(username);
    }
    
    if (isServerSideUser) {
      // For server-side users, we need to remove them from the URL
      // This would require adding a removeServerSideUserFromURL function
      // For now, removing from filter bar won't remove from URL
      // TODO: Implement removeServerSideUserFromURL
    }
  }, [filterUsernames, urlState.users, urlState.serverSideUsers, removeUserFromURL]);

  // Add word to filter
  const addWordToFilter = useCallback((word: string) => {
    const cleanWord = word.trim().toLowerCase();
    if (cleanWord && !filterWords.includes(cleanWord)) {
      const newWords = [...filterWords, cleanWord];
      setFilterWords(newWords);
      localStorage.setItem('sww-word-filters', JSON.stringify(newWords));
      
      // Always sync URL with filter bar contents
      addWordToURL(cleanWord);
    }
  }, [filterWords, addWordToURL]);

  // Remove word from filter
  const removeWordFromFilter = useCallback((word: string) => {
    // Check if this is a URL word or a local word
    const isUrlWord = urlState.words.includes(word.toLowerCase());
    const isLocalWord = filterWords.includes(word);
    
    if (isLocalWord) {
      const newWords = filterWords.filter(w => w !== word);
      setFilterWords(newWords);
      localStorage.setItem('sww-word-filters', JSON.stringify(newWords));
    }
    
    if (isUrlWord) {
      removeWordFromURL(word);
    }
  }, [filterWords, urlState.words, removeWordFromURL]);

  // Add negative word filter
  const addNegativeWordFilter = useCallback((word: string) => {
    const cleanWord = word.trim().toLowerCase();
    if (cleanWord && !negativeFilterWords.includes(cleanWord)) {
      const newWords = [...negativeFilterWords, cleanWord];
      setNegativeFilterWords(newWords);
      localStorage.setItem('sww-negative-filters', JSON.stringify(newWords));
      
      // Also update URL
      addNegativeWordToURL(cleanWord);
    }
  }, [negativeFilterWords, addNegativeWordToURL]);

  // Remove negative word filter
  const removeNegativeWordFilter = useCallback((word: string) => {
    // Check if this is a URL negative word or a local negative word
    const isUrlNegativeWord = urlState.negativeWords.includes(word.toLowerCase());
    const isLocalNegativeWord = negativeFilterWords.includes(word);
    
    if (isLocalNegativeWord) {
      const newWords = negativeFilterWords.filter(w => w !== word);
      setNegativeFilterWords(newWords);
      localStorage.setItem('sww-negative-filters', JSON.stringify(newWords));
    }
    
    if (isUrlNegativeWord) {
      removeNegativeWordFromURL(word);
    }
  }, [negativeFilterWords, urlState.negativeWords, removeNegativeWordFromURL]);

  // Toggle filter enabled state - USER CONTROL ONLY
  // This ONLY changes active/inactive state, NOT the URL
  // URL always reflects filter bar contents regardless of active state
  const toggleFilter = useCallback(() => {
    const newState = !isFilterEnabled;
    setIsFilterEnabled(newState);
    localStorage.setItem('sww-filter-enabled', String(newState));
    // URL remains unchanged - it always shows filter bar contents
  }, [isFilterEnabled]);

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
