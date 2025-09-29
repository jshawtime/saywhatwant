/**
 * useMessageSystem Hook
 * Provides React interface for the Message Management System
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { messageManager, type MessageWithGap } from '@/modules/messageManager';
import { FilterState } from '@/lib/url-filter-simple';
import { MESSAGE_SYSTEM_CONFIG } from '@/config/message-system';

interface UseMessageSystemReturn {
  messages: MessageWithGap[];
  isLoading: boolean;
  isFiltered: boolean;
  hasMoreMessages: boolean;
  messageCount: number;
  
  // Actions
  applyFilters: (filters: FilterState) => Promise<void>;
  clearFilters: () => Promise<void>;
  loadMore: () => Promise<void>;
  refresh: () => Promise<void>;
  
  // Config
  config: typeof MESSAGE_SYSTEM_CONFIG;
}

export function useMessageSystem(): UseMessageSystemReturn {
  const [messages, setMessages] = useState<MessageWithGap[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFiltered, setIsFiltered] = useState(false);
  const [hasMoreMessages, setHasMoreMessages] = useState(false);
  const [messageCount, setMessageCount] = useState(0);
  
  const currentFilters = useRef<FilterState | null>(null);
  const pollingInterval = useRef<NodeJS.Timeout | null>(null);
  const isLoadingMore = useRef(false);
  const cleanupInterval = useRef<NodeJS.Timeout | null>(null);
  
  // Initial load
  useEffect(() => {
    const loadInitial = async () => {
      setIsLoading(true);
      try {
        const initialMessages = await messageManager.loadInitialMessages();
        setMessages(initialMessages);
        setMessageCount(initialMessages.length);
        setHasMoreMessages(initialMessages.length >= MESSAGE_SYSTEM_CONFIG.maxDisplayMessages);
      } catch (error) {
        console.error('[useMessageSystem] Error loading initial messages:', error);
      } finally {
        setIsLoading(false);
      }
    };
    
    loadInitial();
  }, []);
  
  // Polling for new messages (only when not filtered)
  useEffect(() => {
    if (isFiltered) {
      // Stop polling when filtered
      if (pollingInterval.current) {
        clearInterval(pollingInterval.current);
        pollingInterval.current = null;
      }
      return;
    }
    
    // Start polling
    pollingInterval.current = setInterval(async () => {
      try {
        const newMessages = await messageManager.pollNewMessages();
        if (newMessages.length > 0) {
          setMessages(prev => {
            const merged = messageManager.mergeAndTrim(prev, newMessages);
            setMessageCount(merged.length);
            return merged;
          });
        }
      } catch (error) {
        console.error('[useMessageSystem] Polling error:', error);
      }
    }, MESSAGE_SYSTEM_CONFIG.cloudPollingInterval);
    
    return () => {
      if (pollingInterval.current) {
        clearInterval(pollingInterval.current);
        pollingInterval.current = null;
      }
    };
  }, [isFiltered]);
  
  // Storage cleanup task
  useEffect(() => {
    // Run cleanup every hour
    cleanupInterval.current = setInterval(async () => {
      try {
        await messageManager.cleanupStorage();
      } catch (error) {
        console.error('[useMessageSystem] Cleanup error:', error);
      }
    }, 60 * 60 * 1000); // 1 hour
    
    // Initial cleanup check
    messageManager.cleanupStorage().catch(console.error);
    
    return () => {
      if (cleanupInterval.current) {
        clearInterval(cleanupInterval.current);
        cleanupInterval.current = null;
      }
    };
  }, []);
  
  // Apply filters
  const applyFilters = useCallback(async (filters: FilterState) => {
    if (!filters.filterActive) {
      // If filter is not active, just return to normal view
      return clearFilters();
    }
    
    setIsLoading(true);
    try {
      currentFilters.current = filters;
      const filtered = await messageManager.getFilteredMessages(filters);
      setMessages(filtered);
      setMessageCount(filtered.length);
      setIsFiltered(true);
      setHasMoreMessages(false); // No lazy loading when filtered
    } catch (error) {
      console.error('[useMessageSystem] Error applying filters:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);
  
  // Clear filters and return to normal view
  const clearFilters = useCallback(async () => {
    setIsLoading(true);
    try {
      currentFilters.current = null;
      const allMessages = await messageManager.loadInitialMessages();
      setMessages(allMessages);
      setMessageCount(allMessages.length);
      setIsFiltered(false);
      setHasMoreMessages(allMessages.length >= MESSAGE_SYSTEM_CONFIG.maxDisplayMessages);
    } catch (error) {
      console.error('[useMessageSystem] Error clearing filters:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);
  
  // Load more messages (lazy loading)
  const loadMore = useCallback(async () => {
    if (isLoadingMore.current || isFiltered || !hasMoreMessages) {
      return;
    }
    
    isLoadingMore.current = true;
    try {
      // In a full implementation, this would load more from IndexedDB
      // For now, we'll just log
      console.log('[useMessageSystem] Load more requested - implement IndexedDB pagination');
      // TODO: Implement pagination from IndexedDB
    } catch (error) {
      console.error('[useMessageSystem] Error loading more:', error);
    } finally {
      isLoadingMore.current = false;
    }
  }, [isFiltered, hasMoreMessages]);
  
  // Refresh messages
  const refresh = useCallback(async () => {
    if (isFiltered && currentFilters.current) {
      await applyFilters(currentFilters.current);
    } else {
      await clearFilters();
    }
  }, [isFiltered, applyFilters, clearFilters]);
  
  return {
    messages,
    isLoading,
    isFiltered,
    hasMoreMessages,
    messageCount,
    applyFilters,
    clearFilters,
    loadMore,
    refresh,
    config: MESSAGE_SYSTEM_CONFIG
  };
}
