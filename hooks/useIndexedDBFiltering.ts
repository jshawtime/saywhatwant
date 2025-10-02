/**
 * useIndexedDBFiltering Hook
 * 
 * Handles all IndexedDB querying and filter mode logic
 * Separates data querying from UI rendering
 * 
 * Two Modes:
 * - Browse Mode: Load newest messages from IndexedDB
 * - Filter Mode: Query IndexedDB with filter criteria
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { Comment } from '@/types';
import { simpleIndexedDB, FilterCriteria } from '@/modules/simpleIndexedDB';
import { MESSAGE_SYSTEM_CONFIG } from '@/config/message-system';

interface UseIndexedDBFilteringParams {
  // Filter criteria (from useFilters)
  isFilterEnabled: boolean;
  filterUsernames: Array<{username: string, color: string}>;
  filterWords: string[];
  negativeFilterWords: string[];
  searchTerm: string;
  dateTimeFilter?: any;
  domainFilterEnabled: boolean;
  currentDomain: string;
  showHumans: boolean;
  showEntities: boolean;
  
  // Configuration
  maxDisplayMessages: number;
  
  // Initial messages (from initial load in parent)
  initialMessages?: Comment[];
}

interface UseIndexedDBFilteringReturn {
  // Messages ready for display (filtered or browsed)
  messages: Comment[];
  
  // Loading state for filter queries
  isLoading: boolean;
  
  // Current mode
  isFilterMode: boolean;
  
  // Helper to test if message matches current filters
  matchesCurrentFilter: (message: Comment) => boolean;
  
  // Add new messages (from polling or submission)
  addMessages: (newMessages: Comment[]) => void;
  
  // Set messages directly (for initial load)
  setMessages: React.Dispatch<React.SetStateAction<Comment[]>>;
}

export function useIndexedDBFiltering(
  params: UseIndexedDBFilteringParams
): UseIndexedDBFilteringReturn {
  const [messages, setMessages] = useState<Comment[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const queryGeneration = useRef(0); // Track query generation to cancel stale queries
  const searchDebounceTimer = useRef<NodeJS.Timeout | null>(null);
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState(params.searchTerm);
  
  // Detect filter mode
  const isFilterMode = params.isFilterEnabled || params.searchTerm.length > 0;
  
  // Debounce search term to reduce queries while typing
  useEffect(() => {
    if (searchDebounceTimer.current) {
      clearTimeout(searchDebounceTimer.current);
    }
    
    searchDebounceTimer.current = setTimeout(() => {
      setDebouncedSearchTerm(params.searchTerm);
    }, 150); // 150ms debounce - fast enough to feel instant but reduces queries
    
    return () => {
      if (searchDebounceTimer.current) {
        clearTimeout(searchDebounceTimer.current);
      }
    };
  }, [params.searchTerm]);
  
  // Build filter criteria from all active filters
  const buildCriteria = useCallback((): FilterCriteria => {
    const criteria: FilterCriteria = {};
    
    if (params.filterUsernames.length > 0) {
      criteria.usernames = params.filterUsernames;
    }
    
    if (params.filterWords.length > 0) {
      criteria.includeWords = params.filterWords;
    }
    
    if (params.negativeFilterWords.length > 0) {
      criteria.excludeWords = params.negativeFilterWords;
    }
    
    if (debouncedSearchTerm.length > 0) {
      criteria.searchTerm = debouncedSearchTerm;
    }
    
    if (params.dateTimeFilter && typeof params.dateTimeFilter === 'object') {
      const dtFilter = params.dateTimeFilter as any;
      if (dtFilter.from) {
        criteria.afterTimestamp = new Date(dtFilter.from).getTime();
      }
      if (dtFilter.to) {
        criteria.beforeTimestamp = new Date(dtFilter.to).getTime();
      }
    }
    
    // Only add domain filter if explicitly enabled by user
    // Don't auto-filter by domain for searches - it might exclude valid results
    if (params.domainFilterEnabled && params.filterUsernames.length > 0) {
      // Only apply domain filter when filtering by users, not for plain search
      criteria.domain = params.currentDomain;
    }
    
    // Message type filters
    const messageTypes: string[] = [];
    if (params.showHumans) messageTypes.push('human');
    if (params.showEntities) messageTypes.push('AI');
    if (messageTypes.length > 0 && messageTypes.length < 2) {
      criteria.messageTypes = messageTypes;
    }
    
    return criteria;
  }, [
    params.filterUsernames,
    params.filterWords,
    params.negativeFilterWords,
    debouncedSearchTerm, // Use debounced version
    params.dateTimeFilter,
    params.domainFilterEnabled,
    params.currentDomain,
    params.showHumans,
    params.showEntities
  ]);
  
  // Test if a message matches current filter criteria
  const matchesCurrentFilter = useCallback((message: Comment): boolean => {
    if (!isFilterMode) return true; // No filters = all messages match
    
    // Username filter
    if (params.filterUsernames.length > 0) {
      const usernameMatch = params.filterUsernames.some(
        filter => message.username === filter.username && message.color === filter.color
      );
      if (!usernameMatch) return false;
    }
    
    // Include words
    if (params.filterWords.length > 0) {
      const textLower = message.text.toLowerCase();
      const hasAllWords = params.filterWords.every(word => textLower.includes(word.toLowerCase()));
      if (!hasAllWords) return false;
    }
    
    // Exclude words
    if (params.negativeFilterWords.length > 0) {
      const textLower = message.text.toLowerCase();
      const hasExcludedWord = params.negativeFilterWords.some(word => textLower.includes(word.toLowerCase()));
      if (hasExcludedWord) return false;
    }
    
    // Search term (use debounced for consistency)
    if (debouncedSearchTerm.length > 0) {
      const searchLower = debouncedSearchTerm.toLowerCase();
      const textLower = message.text.toLowerCase();
      const usernameLower = message.username?.toLowerCase() || '';
      if (!textLower.includes(searchLower) && !usernameLower.includes(searchLower)) {
        return false;
      }
    }
    
    // Domain filter
    if (params.domainFilterEnabled && message.domain !== params.currentDomain) {
      return false;
    }
    
    // Message type filters
    if (!params.showHumans && message['message-type'] === 'human') return false;
    if (!params.showEntities && message['message-type'] === 'AI') return false;
    
    return true;
  }, [
    isFilterMode,
    params.filterUsernames,
    params.filterWords,
    params.negativeFilterWords,
    debouncedSearchTerm, // Use debounced version
    params.domainFilterEnabled,
    params.currentDomain,
    params.showHumans,
    params.showEntities
  ]);
  
  // Re-query IndexedDB when filters change
  useEffect(() => {
    // Increment generation to cancel stale queries
    const currentGeneration = ++queryGeneration.current;
    
    const queryWithFilters = async () => {
      if (!isFilterMode) {
        // Browse mode - use initialMessages from parent
        if (params.initialMessages) {
          console.log('[FilterHook] Browse mode - using initial messages');
          setMessages(params.initialMessages);
        }
        return;
      }
      
      // Filter mode - query IndexedDB
      setIsLoading(true);
      
      try {
        await simpleIndexedDB.init();
        
        if (!simpleIndexedDB.isInit()) {
          console.warn('[FilterHook] IndexedDB not initialized');
          setIsLoading(false);
          return;
        }
        
        // Check if this query is still current
        if (queryGeneration.current !== currentGeneration) {
          console.log('[FilterHook] Query cancelled - newer query started');
          return;
        }
        
        const criteria = buildCriteria();
        console.log('[FilterHook] Querying IndexedDB with criteria:', criteria);
        
        // Query IndexedDB
        const filtered = await simpleIndexedDB.queryMessages(
          criteria,
          params.maxDisplayMessages
        );
        
        // Check again if this query is still current before setting results
        if (queryGeneration.current !== currentGeneration) {
          console.log('[FilterHook] Query results discarded - newer query completed');
          return;
        }
        
        console.log(`[FilterHook] Found ${filtered.length} matching messages`);
        setMessages(filtered);
      } catch (err) {
        console.error('[FilterHook] Error querying IndexedDB:', err);
      } finally {
        // Only clear loading if this is the current query
        if (queryGeneration.current === currentGeneration) {
          setIsLoading(false);
        }
      }
    };
    
    queryWithFilters();
  }, [
    isFilterMode,
    // Use JSON.stringify for array/object comparisons to avoid reference changes
    JSON.stringify(params.filterUsernames),
    JSON.stringify(params.filterWords),
    JSON.stringify(params.negativeFilterWords),
    debouncedSearchTerm, // Use debounced version instead of raw searchTerm
    JSON.stringify(params.dateTimeFilter),
    params.domainFilterEnabled,
    params.currentDomain,
    params.showHumans,
    params.showEntities,
    JSON.stringify(params.initialMessages),
    params.maxDisplayMessages
    // Removed buildCriteria - it's a function that changes every render
  ]);
  
  // Add new messages (from polling or submission)
  const addMessages = useCallback((newMessages: Comment[]) => {
    if (newMessages.length === 0) return;
    
    setMessages(prev => {
      // Avoid duplicates
      const existingIds = new Set(prev.map(m => m.id));
      let uniqueNew = newMessages.filter(m => !existingIds.has(m.id));
      
      // In filter mode: only add matching messages
      if (isFilterMode) {
        uniqueNew = uniqueNew.filter(matchesCurrentFilter);
        console.log(`[FilterHook] ${uniqueNew.length} of ${newMessages.length} new messages match filter`);
      }
      
      if (uniqueNew.length === 0) return prev;
      
      // Add and trim to max
      const combined = [...prev, ...uniqueNew];
      const trimmed = combined.slice(-params.maxDisplayMessages);
      
      return trimmed;
    });
  }, [isFilterMode, matchesCurrentFilter, params.maxDisplayMessages]);
  
  return {
    messages,
    isLoading,
    isFilterMode,
    matchesCurrentFilter,
    addMessages,
    setMessages
  };
}

