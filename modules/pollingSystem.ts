/**
 * Polling System Module
 * Handles automatic data polling with smart features
 * Part of Phase 2 modularization - extracted from CommentsStream.tsx
 * 
 * Note: By default, polling continues even when tab is hidden
 * to ensure no messages are missed. Set pauseOnHidden: true to change this.
 */

import { useEffect, useRef, useCallback, useState } from 'react';

// Types
export interface PollingConfig {
  interval: number;
  enabled?: boolean;
  onError?: (error: Error) => void;
  pauseOnHidden?: boolean;  // Default false - keeps polling when tab hidden
  exponentialBackoff?: boolean;
  maxRetries?: number;
  dependencies?: React.DependencyList;
}

export interface PollingState {
  isPolling: boolean;
  lastPollTime: number | null;
  errorCount: number;
  isPaused: boolean;
}

/**
 * Generic polling hook
 * @param pollFunction - The async function to call on each poll
 * @param config - Polling configuration
 */
export const usePolling = (
  pollFunction: () => Promise<void>,
  config: PollingConfig
) => {
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const retryCount = useRef(0);
  const [state, setState] = useState<PollingState>({
    isPolling: false,
    lastPollTime: null,
    errorCount: 0,
    isPaused: false
  });
  
  const { 
    interval, 
    enabled = true, 
    onError, 
    pauseOnHidden = false,  // Don't pause by default - keep polling when tab hidden
    exponentialBackoff = false,
    maxRetries = 3,
    dependencies = []
  } = config;
  
  // Calculate interval with exponential backoff if enabled
  const getInterval = useCallback(() => {
    if (!exponentialBackoff || retryCount.current === 0) {
      return interval;
    }
    // Exponential backoff: interval * 2^retryCount, max 5 minutes
    return Math.min(interval * Math.pow(2, retryCount.current), 300000);
  }, [interval, exponentialBackoff]);
  
  // The polling function wrapper
  const poll = useCallback(async () => {
    if (state.isPaused) return;
    
    setState(prev => ({ ...prev, isPolling: true }));
    
    try {
      await pollFunction();
      retryCount.current = 0; // Reset on success
      setState(prev => ({
        ...prev,
        isPolling: false,
        lastPollTime: Date.now(),
        errorCount: 0
      }));
    } catch (error) {
      retryCount.current++;
      setState(prev => ({
        ...prev,
        isPolling: false,
        errorCount: prev.errorCount + 1
      }));
      
      if (onError) {
        onError(error as Error);
      }
      
      // Stop polling if max retries exceeded
      if (maxRetries > 0 && retryCount.current >= maxRetries) {
        console.error('[PollingSystem] Max retries exceeded, stopping polling');
        stopPolling();
      }
    }
  }, [pollFunction, state.isPaused, onError, maxRetries]);
  
  // Start polling
  const startPolling = useCallback(() => {
    if (intervalRef.current) return;
    
    // Initial poll
    poll();
    
    // Set up interval
    intervalRef.current = setInterval(poll, getInterval());
  }, [poll, getInterval]);
  
  // Stop polling
  const stopPolling = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setState(prev => ({ ...prev, isPaused: true }));
  }, []);
  
  // Resume polling
  const resumePolling = useCallback(() => {
    setState(prev => ({ ...prev, isPaused: false }));
    startPolling();
  }, [startPolling]);
  
  // Handle page visibility changes
  useEffect(() => {
    if (!pauseOnHidden) return;
    
    const handleVisibilityChange = () => {
      if (document.hidden) {
        stopPolling();
      } else if (enabled) {
        resumePolling();
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [pauseOnHidden, enabled, stopPolling, resumePolling]);
  
  // Main polling effect
  useEffect(() => {
    if (enabled) {
      startPolling();
    }
    
    return () => {
      stopPolling();
    };
  }, [enabled, ...dependencies]);
  
  return {
    state,
    startPolling,
    stopPolling,
    resumePolling,
    poll, // Manual poll trigger
  };
};

/**
 * Hook for polling with comparison
 * Useful for checking for new items
 */
export const useComparisonPolling = <T>(
  fetchFunction: () => Promise<T[]>,
  currentItems: T[],
  compareBy: (item: T) => string | number,
  onNewItems: (newItems: T[]) => void,
  config: Omit<PollingConfig, 'dependencies'>
) => {
  const pollFunction = useCallback(async () => {
    const fetchedItems = await fetchFunction();
    
    // Create a set of current item IDs for efficient lookup
    const currentIds = new Set(currentItems.map(compareBy));
    
    // Find new items
    const newItems = fetchedItems.filter(item => !currentIds.has(compareBy(item)));
    
    if (newItems.length > 0) {
      onNewItems(newItems);
    }
  }, [fetchFunction, currentItems, compareBy, onNewItems]);
  
  return usePolling(pollFunction, {
    ...config,
    dependencies: [currentItems]
  });
};

/**
 * Hook for storage event listening (cross-tab sync)
 */
export const useStorageListener = (
  storageKey: string,
  callback: () => void,
  enabled = true
) => {
  useEffect(() => {
    if (!enabled) return;
    
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === storageKey) {
        console.log(`[StorageListener] Storage changed for key: ${storageKey}`);
        callback();
      }
    };
    
    window.addEventListener('storage', handleStorageChange);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [storageKey, callback, enabled]);
};

/**
 * Combined polling and storage listener for comments
 * This is specifically for the comments system
 */
export const useCommentsPolling = ({
  checkForNewComments,
  isLoading,
  currentPollingInterval,
  increasePollingInterval,
  useLocalStorage,
  storageKey
}: {
  checkForNewComments: () => Promise<void>;
  isLoading: boolean;
  currentPollingInterval: React.MutableRefObject<number>;
  increasePollingInterval: () => void;
  useLocalStorage: boolean;
  storageKey: string;
}) => {
  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const isMountedRef = useRef(false);
  
  // Use storage listener for localStorage mode
  useStorageListener(
    storageKey,
    checkForNewComments,
    useLocalStorage && !isLoading
  );
  
  // Regressive polling with recursive setTimeout (dynamic interval)
  useEffect(() => {
    // CRITICAL: Always clear any existing polling loop before starting new one
    // This prevents orphaned loops when component re-renders
    if (pollingRef.current) {
      clearTimeout(pollingRef.current);
      pollingRef.current = null;
    }
    
    if (isLoading || isMountedRef.current) {
      console.log('[CommentsPolling] Waiting for initial load to complete...', { isLoading, isMounted: isMountedRef.current });
      return; // Don't start if loading or already mounted
    }
    
    isMountedRef.current = true;
    console.log('[CommentsPolling] Starting polling loop with interval:', currentPollingInterval.current);
    
    const poll = async () => {
      await checkForNewComments();
      increasePollingInterval(); // Slow down for next poll
      
      // Schedule next poll with current interval
      pollingRef.current = setTimeout(poll, currentPollingInterval.current);
    };
    
    // Start first poll
    pollingRef.current = setTimeout(poll, currentPollingInterval.current);
    
    return () => {
      // Cleanup on unmount
      if (pollingRef.current) {
        clearTimeout(pollingRef.current);
        pollingRef.current = null;
      }
      isMountedRef.current = false;
    };
  }, [isLoading]); // CRITICAL FIX: Re-run when isLoading changes from true to false!
  
  return {
    stopPolling: () => {
      if (pollingRef.current) {
        clearTimeout(pollingRef.current);
        pollingRef.current = null;
      }
    }
  };
};

/**
 * Smart auto-scroll detection
 */
export const useAutoScrollDetection = (
  containerRef: React.RefObject<HTMLElement>,
  threshold = 100
) => {
  const [isNearBottom, setIsNearBottom] = useState(true);
  
  const checkIfNearBottom = useCallback(() => {
    if (!containerRef.current) return false;
    
    const { scrollHeight, scrollTop, clientHeight } = containerRef.current;
    const distanceFromBottom = scrollHeight - (scrollTop + clientHeight);
    const nearBottom = distanceFromBottom < threshold;
    
    setIsNearBottom(nearBottom);
    return nearBottom;
  }, [containerRef, threshold]);
  
  const scrollToBottom = useCallback((smooth = true) => {
    if (!containerRef.current) return;
    
    if (smooth) {
      containerRef.current.scrollTo({
        top: containerRef.current.scrollHeight,
        behavior: 'smooth'
      });
    } else {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [containerRef]);
  
  // Listen for scroll events
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    
    const handleScroll = () => {
      checkIfNearBottom();
    };
    
    container.addEventListener('scroll', handleScroll);
    
    return () => {
      container.removeEventListener('scroll', handleScroll);
    };
  }, [containerRef, checkIfNearBottom]);
  
  return {
    isNearBottom,
    checkIfNearBottom,
    scrollToBottom
  };
};

// Export all utilities
export const PollingSystem = {
  usePolling,
  useComparisonPolling,
  useStorageListener,
  useCommentsPolling,
  useAutoScrollDetection
};
