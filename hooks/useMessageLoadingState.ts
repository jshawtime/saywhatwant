/**
 * useMessageLoadingState Hook
 * 
 * Consolidates all message loading state into a single hook
 * Manages initial loading, lazy loading, offsets, and dynamic limits
 */

import { useState, useCallback } from 'react';

interface MessageLoadingState {
  /**
   * Initial loading state (first page load)
   */
  isInitialLoading: boolean;
  
  /**
   * Loading more messages (lazy load)
   */
  isLoadingMore: boolean;
  
  /**
   * Whether more messages are available to load
   */
  hasMore: boolean;
  
  /**
   * Current offset in IndexedDB for lazy loading
   */
  offset: number;
  
  /**
   * Dynamic maximum messages (expands with lazy loading)
   */
  maxMessages: number;
  
  /**
   * Count of messages loaded via lazy loading
   */
  loadedCount: number;
  
  /**
   * Set initial loading state
   */
  setInitialLoading: (loading: boolean) => void;
  
  /**
   * Start loading more messages
   */
  startLoadingMore: () => void;
  
  /**
   * Finish loading more messages
   * @param newMessagesCount - Number of messages just loaded
   * @param hasMore - Whether more messages are available
   */
  finishLoadingMore: (newMessagesCount: number, hasMore: boolean) => void;
  
  /**
   * Set whether more messages are available
   */
  setHasMore: (hasMore: boolean) => void;
  
  /**
   * Set the IndexedDB offset
   */
  setOffset: (offset: number) => void;
  
  /**
   * Increase dynamic max messages
   * @param amount - Amount to increase by
   */
  increaseMaxMessages: (amount: number) => void;
  
  /**
   * Reset all loading state to initial values
   */
  reset: () => void;
}

/**
 * useMessageLoadingState Hook
 * 
 * Manages all loading-related state for messages:
 * - Initial page load state
 * - Lazy loading state and offset tracking
 * - Dynamic message limits that expand with lazy loading
 * - Validation to prevent invalid states
 * 
 * This hook consolidates 6 separate useState calls into a single,
 * cohesive loading state manager with clear operations.
 * 
 * @param initialMax - Initial maximum messages to display
 * @param lazyLoadChunkSize - Size of each lazy load batch
 * @returns Loading state and operations
 * 
 * @example
 * const {
 *   isInitialLoading,
 *   isLoadingMore,
 *   hasMore,
 *   offset,
 *   startLoadingMore,
 *   finishLoadingMore,
 *   setHasMore
 * } = useMessageLoadingState(50, 50);
 */
export function useMessageLoadingState(
  initialMax: number,
  lazyLoadChunkSize: number
): MessageLoadingState {
  // Initial loading state
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  
  // Lazy loading state
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [offset, setOffset] = useState(0);
  
  // Dynamic limits
  const [maxMessages, setMaxMessages] = useState(initialMax);
  const [loadedCount, setLoadedCount] = useState(0);
  
  /**
   * Start loading more messages
   * Sets isLoadingMore to true
   */
  const startLoadingMore = useCallback(() => {
    if (isLoadingMore) {
      console.warn('[LoadingState] Already loading more messages');
      return;
    }
    
    if (!hasMore) {
      console.warn('[LoadingState] No more messages to load');
      return;
    }
    
    setIsLoadingMore(true);
  }, [isLoadingMore, hasMore]);
  
  /**
   * Finish loading more messages
   * Updates counts, offset, and limits
   */
  const finishLoadingMore = useCallback((newMessagesCount: number, stillHasMore: boolean) => {
    if (!isLoadingMore) {
      console.warn('[LoadingState] finishLoadingMore called but not currently loading');
    }
    
    // Update loaded count
    const newLoadedCount = loadedCount + newMessagesCount;
    setLoadedCount(newLoadedCount);
    
    // Keep hard limit (don't grow beyond initialMax)
    // Rolling window: always trim to initialMax newest messages
    console.log(`[LoadingState] Maintaining hard limit at ${initialMax} messages (loaded ${newLoadedCount} via lazy load)`);
    // maxMessages stays at initialMax - true rolling window
    
    // Update state
    setIsLoadingMore(false);
    setHasMore(stillHasMore);
    
    console.log(
      `[LoadingState] Loaded ${newMessagesCount} messages. ` +
      `Total lazy loaded: ${newLoadedCount}. ` +
      `Dynamic max: ${newMax}. ` +
      `Has more: ${stillHasMore}`
    );
  }, [isLoadingMore, loadedCount, initialMax]);
  
  /**
   * Increase dynamic max messages by amount
   */
  const increaseMaxMessages = useCallback((amount: number) => {
    setMaxMessages(prev => prev + amount);
    console.log(`[LoadingState] Increased dynamic max by ${amount}`);
  }, []);
  
  /**
   * Reset all loading state
   */
  const reset = useCallback(() => {
    setIsInitialLoading(true);
    setIsLoadingMore(false);
    setHasMore(false);
    setOffset(0);
    setMaxMessages(initialMax);
    setLoadedCount(0);
    console.log('[LoadingState] Reset to initial state');
  }, [initialMax]);
  
  return {
    isInitialLoading,
    isLoadingMore,
    hasMore,
    offset,
    maxMessages,
    loadedCount,
    setInitialLoading: setIsInitialLoading,
    startLoadingMore,
    finishLoadingMore,
    setHasMore,
    setOffset,
    increaseMaxMessages,
    reset
  };
}

