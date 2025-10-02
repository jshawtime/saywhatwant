/**
 * useFilters Hook - Elegant Refactored Version
 * 
 * Direct wrapper around useSimpleFilters for backward compatibility
 * All complexity has been moved to simple, pure functions
 */

import { useSimpleFilters } from './useSimpleFilters';
import { Comment } from '@/types';

export interface UsernameFilter {
  username: string;
  color: string;
}

interface UseFiltersProps {
  displayedComments: Comment[];
  searchTerm: string;
}

export const useFilters = ({ displayedComments, searchTerm }: UseFiltersProps) => {
  // Use the elegant simple filters implementation
  const {
    filterState,
    isFilterEnabled,
    hasFilters,
    messageType,
    filteredComments: baseFiltered,
    addUser,
    removeUser,
    addWord,
    removeWord,
    addNegativeWord,
    removeNegativeWord,
    toggleFilter,
    clearAllFilters,
    setMessageType,
    mergedUserFilters,
    mergedFilterWords,
    mergedNegativeWords,
    addToFilter,
    removeFromFilter,
    addWordToFilter,
    removeWordFromFilter,
    addNegativeWordFilter,
    removeNegativeWordFilter,
  } = useSimpleFilters({ 
    comments: displayedComments, 
    filterByColorToo: true 
  });

  // Apply search term filter on top of other filters
  const filteredComments = searchTerm 
    ? baseFiltered.filter(comment => 
        comment.text?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        comment.username?.toLowerCase().includes(searchTerm.toLowerCase())
      )
    : baseFiltered;

  // Return compatible interface
  return {
    // State
    filteredComments,
    mergedUserFilters,
    mergedFilterWords,
    mergedNegativeWords,
    isFilterEnabled,
    hasFilters,
    messageType,  // NEW: Expose message type
    
    // User operations
    addToFilter,
    removeFromFilter,
    
    // Word operations
    addWordToFilter,
    removeWordFromFilter,
    addNegativeWordFilter,
    removeNegativeWordFilter, // Alias for compatibility
    
    // General operations
    toggleFilter,
    clearFilters: clearAllFilters,
    setMessageType,  // NEW: Set message type
    
    // For backward compatibility (not used in new implementation)
    filterByColorToo: true,
    setFilterByColorToo: () => {},
    // filterUsernames should be in 9-digit format for IndexedDB querying
    // Use filterState.users (9-digit) not mergedUserFilters (RGB format)
    filterUsernames: filterState.users,
    filterWords: mergedFilterWords,
    negativeFilterWords: mergedNegativeWords,
    clearDateTimeFilter: () => {},
    clearWordFilters: () => {
      filterState.words.forEach(word => removeWord(word));
    },
    clearNegativeWordFilters: () => {
      filterState.negativeWords.forEach(word => removeNegativeWord(word));
    },
    hasActiveFilters: hasFilters,
    urlSearchTerms: [], // Search terms not implemented in simple version yet
    addSearchTermToURL: () => {},
    removeSearchTermFromURL: () => {},
    dateTimeFilter: undefined,
    serverSideUsers: [] as Array<{ username: string; color: string }>, // Server-side users not implemented in simple version yet
  };
};