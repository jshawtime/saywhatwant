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
import { mergeAndSortMessages } from '@/utils/messageUtils';

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
  activeChannel: 'human' | 'AI' | 'ALL' | null;  // Channel type: human, AI, or both
  
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
  
  // Use refs to avoid stale closure issues in callbacks
  const filterUsernamesRef = useRef(params.filterUsernames);
  const isFilterEnabledRef = useRef(params.isFilterEnabled);
  const activeChannelRef = useRef(params.activeChannel);
  const filterWordsRef = useRef(params.filterWords);
  const negativeFilterWordsRef = useRef(params.negativeFilterWords);
  const domainFilterEnabledRef = useRef(params.domainFilterEnabled);
  const currentDomainRef = useRef(params.currentDomain);
  const debouncedSearchTermRef = useRef(debouncedSearchTerm);
  
  // Keep refs in sync with props
  useEffect(() => {
    filterUsernamesRef.current = params.filterUsernames;
    isFilterEnabledRef.current = params.isFilterEnabled;
    activeChannelRef.current = params.activeChannel;
    filterWordsRef.current = params.filterWords;
    negativeFilterWordsRef.current = params.negativeFilterWords;
    domainFilterEnabledRef.current = params.domainFilterEnabled;
    currentDomainRef.current = params.currentDomain;
  }, [params.filterUsernames, params.isFilterEnabled, params.activeChannel, 
      params.filterWords, params.negativeFilterWords, params.domainFilterEnabled, params.currentDomain]);
  
  // Keep debounced search term ref in sync
  useEffect(() => {
    debouncedSearchTermRef.current = debouncedSearchTerm;
  }, [debouncedSearchTerm]);
  
  // User is ALWAYS filtering (at minimum by channel)
  // Channel is mandatory, username/word filters are optional additions
  const isFilterMode = true; // Always query IndexedDB with at least channel criteria
  
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
    
    // ✅ CHECK IF FILTERS ARE ENABLED FIRST
    if (!params.isFilterEnabled) {
      // Filters are OFF - only apply channel filter (always required)
      // Handle different channel states
      if (params.activeChannel === null) {
        // Both OFF - return empty criteria (show nothing, triggers EmptyState)
        return {};
      } else if (params.activeChannel === 'ALL') {
        criteria.messageTypes = ['human', 'AI'];
      } else {
        criteria.messageTypes = [params.activeChannel];
      }
      console.log('[FilterHook] Filters INACTIVE - skipping user/word filters, messageTypes:', criteria.messageTypes);
      return criteria;
    }
    
    // Filters are ON - apply all filter criteria
    console.log('[FilterHook] Filters ACTIVE - applying all criteria');
    
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
    
    // Message type filter (channel selection)
    // Handle different channel states
    if (params.activeChannel === null) {
      // Both OFF - don't set messageTypes (show nothing)
      // Will trigger EmptyState
    } else if (params.activeChannel === 'ALL') {
      criteria.messageTypes = ['human', 'AI'];  // Show both channels
    } else {
      criteria.messageTypes = [params.activeChannel];  // Show single channel
    }
    
    return criteria;
  }, [
    params.isFilterEnabled,  // ✅ CRITICAL: Re-query when filter state changes
    params.filterUsernames,
    params.filterWords,
    params.negativeFilterWords,
    debouncedSearchTerm, // Use debounced version
    params.dateTimeFilter,
    params.domainFilterEnabled,
    params.currentDomain,
    params.activeChannel  // NEW: Use exclusive channel
  ]);
  
  // Test if a message matches current filter criteria
  // Uses refs to avoid stale closure issues when called from async contexts (polling)
  const matchesCurrentFilter = useCallback((message: Comment): boolean => {
    // Use refs for latest values (avoids stale closure)
    const filterUsernames = filterUsernamesRef.current;
    const isFilterEnabled = isFilterEnabledRef.current;
    const activeChannel = activeChannelRef.current;
    
    // CHANNEL CHECK FIRST (Top-level: Human, AI, or ALL)
    // Handle 'ALL' to allow both human and AI messages
    if (activeChannel !== 'ALL') {
      // Specific channel - must match
      if (message['message-type'] !== activeChannel) return false;
    }
    // If activeChannel === 'ALL', skip this check (allow both types)
    
    // If filter is NOT active, only channel filtering applies
    if (!isFilterEnabled) {
      return true; // Channel matched, no other filters
    }
    
    // Filter IS active - now apply username/word filters WITHIN the active channel:
    
    // Username filter - EXACT case match for both username and color
    if (filterUsernames.length > 0) {
      const usernameMatch = filterUsernames.some(
        filter => 
          message.username === filter.username && 
          message.color === filter.color
      );
      if (!usernameMatch) {
        // Debug: Log why message didn't match (stringify arrays for visibility)
        console.log('[FilterHook] Message rejected - username/color mismatch:', 
          `message=${message.username}:${message.color}`,
          `filters=${JSON.stringify(filterUsernames.map(f => `${f.username}:${f.color}`))}`
        );
        return false;
      }
    }
    
    // Include words (use ref)
    const filterWords = filterWordsRef.current;
    if (filterWords.length > 0) {
      const textLower = message.text.toLowerCase();
      const hasAllWords = filterWords.every(word => textLower.includes(word.toLowerCase()));
      if (!hasAllWords) return false;
    }
    
    // Exclude words (use ref)
    const negativeFilterWords = negativeFilterWordsRef.current;
    if (negativeFilterWords.length > 0) {
      const textLower = message.text.toLowerCase();
      const hasExcludedWord = negativeFilterWords.some(word => textLower.includes(word.toLowerCase()));
      if (hasExcludedWord) return false;
    }
    
    // Search term (use ref for consistency)
    const searchTerm = debouncedSearchTermRef.current;
    if (searchTerm.length > 0) {
      const searchLower = searchTerm.toLowerCase();
      const textLower = message.text.toLowerCase();
      const usernameLower = message.username?.toLowerCase() || '';
      if (!textLower.includes(searchLower) && !usernameLower.includes(searchLower)) {
        return false;
      }
    }
    
    // Domain filter (use refs)
    const domainFilterEnabled = domainFilterEnabledRef.current;
    const currentDomain = currentDomainRef.current;
    if (domainFilterEnabled && message.domain !== currentDomain) {
      return false;
    }
    
    return true;
  }, []); // Empty deps - uses refs for latest values
  
  // Re-query IndexedDB when filters change
  useEffect(() => {
    // Increment generation to cancel stale queries
    const currentGeneration = ++queryGeneration.current;
    
    const queryWithFilters = async () => {
      // ALWAYS query IndexedDB (at minimum by channel)
      // Channel filtering is mandatory - there is no "browse all" mode
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
    params.isFilterEnabled,  // ✅ CRITICAL: Re-query when filter toggles ON/OFF
    isFilterMode,
    // Use JSON.stringify for array/object comparisons to avoid reference changes
    JSON.stringify(params.filterUsernames),
    JSON.stringify(params.filterWords),
    JSON.stringify(params.negativeFilterWords),
    debouncedSearchTerm, // Use debounced version instead of raw searchTerm
    JSON.stringify(params.dateTimeFilter),
    params.domainFilterEnabled,
    params.currentDomain,
    params.activeChannel,  // NEW: Use exclusive channel
    // REMOVED: JSON.stringify(params.initialMessages) - causes re-queries when new messages arrive!
    params.maxDisplayMessages
    // Removed buildCriteria - it's a function that changes every render
  ]);
  
  // NOTE: Browse mode removed - ALWAYS query IndexedDB
  // Channel filtering is mandatory, so there's no "browse all" mode
  // Even with no username/word filters, we filter by channel
  
  // Add new messages (from polling or submission)
  // Also updates existing messages if eqScore changes (Doc 193 - EQ Score update fix)
  const addMessages = useCallback((newMessages: Comment[]) => {
    if (newMessages.length === 0) return;
    
    setMessages(prev => {
      // Build map of existing messages for quick lookup and update
      const existingMap = new Map(prev.map(m => [m.id, m]));
      let updated = [...prev];
      let hasUpdates = false;
      
      // Check each new message
      let uniqueNew: Comment[] = [];
      for (const msg of newMessages) {
        const existing = existingMap.get(msg.id);
        
        if (existing) {
          // Message already exists - check if eqScore updated (Doc 193)
          if (msg.eqScore !== undefined && msg.eqScore !== existing.eqScore) {
            // Update eqScore in-place
            const idx = updated.findIndex(m => m.id === msg.id);
            if (idx !== -1) {
              updated[idx] = { ...updated[idx], eqScore: msg.eqScore };
              hasUpdates = true;
              console.log(`[FilterHook] Updated eqScore for ${msg.id}: ${existing.eqScore} → ${msg.eqScore}`);
            }
          }
          // Skip adding as duplicate (already exists)
        } else {
          // Truly new message
          uniqueNew.push(msg);
        }
      }
      
      // In filter mode: only add matching messages
      if (isFilterMode) {
        uniqueNew = uniqueNew.filter(matchesCurrentFilter);
        console.log(`[FilterHook] ${uniqueNew.length} of ${newMessages.length} new messages match filter`);
      }
      
      // If we only had updates (no new messages), return the updated array
      if (uniqueNew.length === 0) {
        return hasUpdates ? updated : prev;
      }
      
      // Merge and sort (ensures oldest→newest order is maintained)
      const combined = mergeAndSortMessages(updated, uniqueNew);
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

