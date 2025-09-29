/**
 * useIntegratedMessageSystem Hook
 * Bridges the new Message System with existing filter hooks
 * This allows gradual migration without breaking existing code
 */

import { useEffect, useCallback, useRef } from 'react';
import { useMessageSystem } from './useMessageSystem';
import { useSimpleFilters } from './useSimpleFilters';
import type { Comment } from '@/types';

export function useIntegratedMessageSystem() {
  const messageSystem = useMessageSystem();
  const previousFilterState = useRef<any>(null);
  
  // Use the raw messages from message system (not filtered by useSimpleFilters)
  const messages = messageSystem.messages;
  
  // Create filter bridge with empty comments initially
  const filters = useSimpleFilters({ 
    comments: [], // Don't pass messages here - we handle filtering differently
    filterByColorToo: true 
  });
  
  // When filter state changes, apply to message system
  useEffect(() => {
    // Check if filter state actually changed
    const currentState = {
      filterActive: filters.filterState.filterActive,
      users: filters.filterState.users,
      words: filters.filterState.words,
      negativeWords: filters.filterState.negativeWords
    };
    
    if (JSON.stringify(currentState) !== JSON.stringify(previousFilterState.current)) {
      previousFilterState.current = currentState;
      
      // Apply filters through the message system
      messageSystem.applyFilters(filters.filterState);
    }
  }, [
    filters.filterState.filterActive,
    filters.filterState.users,
    filters.filterState.words,
    filters.filterState.negativeWords,
    messageSystem
  ]);
  
  // Handle scroll-based lazy loading
  const handleScroll = useCallback((scrollTop: number) => {
    const threshold = messageSystem.config.scrollThreshold;
    
    if (scrollTop < threshold && messageSystem.hasMoreMessages && !messageSystem.isLoading) {
      messageSystem.loadMore();
    }
  }, [messageSystem]);
  
  // Return combined interface
  return {
    // Message data
    messages,
    isLoading: messageSystem.isLoading,
    messageCount: messageSystem.messageCount,
    
    // Filter data and operations (from useSimpleFilters)
    filterState: filters.filterState,
    isFilterEnabled: filters.isFilterEnabled,
    hasFilters: filters.hasFilters,
    mergedUserFilters: filters.mergedUserFilters,
    mergedFilterWords: filters.mergedFilterWords,
    mergedNegativeWords: filters.mergedNegativeWords,
    
    // Filter actions (use compatibility names from useSimpleFilters)
    toggleFilter: filters.toggleFilter,
    addUserToFilter: filters.addToFilter,
    removeUserFromFilter: filters.removeFromFilter,
    addWordToFilter: filters.addWordToFilter,
    removeWordFromFilter: filters.removeWordFromFilter,
    addNegativeWordToFilter: filters.addNegativeWordFilter,
    removeNegativeWordFromFilter: filters.removeNegativeWordFilter,
    clearAllFilters: filters.clearAllFilters,
    
    // Backward compatibility aliases
    addToFilter: filters.addToFilter,
    removeFromFilter: filters.removeFromFilter,
    addNegativeWordFilter: filters.addNegativeWordFilter,
    removeNegativeWordFilter: filters.removeNegativeWordFilter,
    
    // Message system actions
    handleScroll,
    refresh: messageSystem.refresh,
    
    // For backward compatibility
    filteredComments: messages,
    displayedComments: messages,
    hasActiveFilters: filters.hasFilters,
    
    // Empty implementations for unused features
    clearDateTimeFilter: () => {},
    clearWordFilters: () => filters.filterState.words.forEach(w => filters.removeWordFromFilter(w)),
    clearNegativeWordFilters: () => filters.filterState.negativeWords.forEach(w => filters.removeNegativeWordFilter(w)),
    dateTimeFilter: undefined,
    serverSideUsers: [] as Array<{ username: string; color: string }>,
    urlSearchTerms: [],
    addSearchTermToURL: () => {},
    removeSearchTermFromURL: () => {},
    
    // Legacy compatibility
    filterByColorToo: true,
    setFilterByColorToo: () => {},
    filterUsernames: filters.mergedUserFilters,
    filterWords: filters.mergedFilterWords,
    negativeFilterWords: filters.mergedNegativeWords
  };
}
