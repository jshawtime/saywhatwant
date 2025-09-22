/**
 * Hook for IndexedDB Storage Integration
 * Provides seamless integration with existing localStorage-based code
 */

import { useState, useEffect, useCallback } from 'react';
import { 
  initAdapter, 
  getComments, 
  setComments, 
  removeComments,
  addStorageListener 
} from '../modules/storage/localStorage-adapter';
import { recordUserFilters } from '../modules/storage';
import { FilterState } from '../modules/storage/interface';

interface Comment {
  id: string;
  timestamp: string;
  username: string;
  text: string;
  userColor: string;
  videoRef?: string;
}

interface UseIndexedDBStorageReturn {
  isReady: boolean;
  saveComments: (comments: Comment[]) => Promise<void>;
  loadComments: () => Comment[];
  clearComments: () => Promise<void>;
  recordFilters: (filters: Partial<FilterState>) => Promise<void>;
}

/**
 * Hook to use IndexedDB storage with localStorage compatibility
 */
export function useIndexedDBStorage(): UseIndexedDBStorageReturn {
  const [isReady, setIsReady] = useState(false);
  
  // Initialize the storage adapter
  useEffect(() => {
    const init = async () => {
      try {
        await initAdapter();
        setIsReady(true);
        console.log('[useIndexedDBStorage] Storage system ready');
      } catch (error) {
        console.error('[useIndexedDBStorage] Failed to initialize:', error);
        // Fall back to localStorage
        setIsReady(true);
      }
    };
    
    init();
  }, []);
  
  // Save comments to storage
  const saveComments = useCallback(async (comments: Comment[]) => {
    if (!isReady) {
      // During initialization, use localStorage directly
      if (typeof window !== 'undefined') {
        localStorage.setItem('sww-comments-local', JSON.stringify(comments.slice(-1000)));
      }
      return;
    }
    
    try {
      await setComments(JSON.stringify(comments));
    } catch (error) {
      console.error('[useIndexedDBStorage] Failed to save comments:', error);
      // Fallback to localStorage
      if (typeof window !== 'undefined') {
        localStorage.setItem('sww-comments-local', JSON.stringify(comments.slice(-1000)));
      }
    }
  }, [isReady]);
  
  // Load comments from storage
  const loadComments = useCallback((): Comment[] => {
    if (!isReady) {
      // During initialization, use localStorage directly
      if (typeof window !== 'undefined') {
        const stored = localStorage.getItem('sww-comments-local');
        if (stored) {
          try {
            return JSON.parse(stored);
          } catch (error) {
            console.error('[useIndexedDBStorage] Failed to parse localStorage:', error);
          }
        }
      }
      return [];
    }
    
    try {
      const stored = getComments();
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (error) {
      console.error('[useIndexedDBStorage] Failed to load comments:', error);
      // Fallback to localStorage
      if (typeof window !== 'undefined') {
        const stored = localStorage.getItem('sww-comments-local');
        if (stored) {
          try {
            return JSON.parse(stored);
          } catch (error) {
            console.error('[useIndexedDBStorage] Failed to parse localStorage:', error);
          }
        }
      }
    }
    
    return [];
  }, [isReady]);
  
  // Clear all comments
  const clearComments = useCallback(async () => {
    if (!isReady) {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('sww-comments-local');
      }
      return;
    }
    
    try {
      await removeComments();
    } catch (error) {
      console.error('[useIndexedDBStorage] Failed to clear comments:', error);
      // Fallback to localStorage
      if (typeof window !== 'undefined') {
        localStorage.removeItem('sww-comments-local');
      }
    }
  }, [isReady]);
  
  // Record filters for lifetime memory
  const recordFilters = useCallback(async (filters: Partial<FilterState>) => {
    if (!isReady) return;
    
    try {
      await recordUserFilters(filters);
    } catch (error) {
      console.error('[useIndexedDBStorage] Failed to record filters:', error);
    }
  }, [isReady]);
  
  return {
    isReady,
    saveComments,
    loadComments,
    clearComments,
    recordFilters
  };
}

/**
 * Hook to listen for storage changes across tabs
 */
export function useStorageListener(
  callback: (newComments: Comment[]) => void,
  enabled = true
): void {
  useEffect(() => {
    if (!enabled) return;
    
    // Listen for both localStorage and IndexedDB changes
    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === 'sww-comments-local' && event.newValue) {
        try {
          const newComments = JSON.parse(event.newValue);
          callback(newComments);
        } catch (error) {
          console.error('[useStorageListener] Failed to parse storage event:', error);
        }
      }
    };
    
    // Add native storage listener
    window.addEventListener('storage', handleStorageChange);
    
    // Add IndexedDB polling listener
    const removeIndexedDBListener = addStorageListener(handleStorageChange);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      removeIndexedDBListener();
    };
  }, [callback, enabled]);
}
