/**
 * LocalStorage Adapter for IndexedDB
 * Provides a localStorage-like API that uses IndexedDB underneath
 * This allows zero behavioral changes to the existing code
 */

import { getStorage, initStorage, recordUserFilters } from './index';
import { Message, FilterState } from './interface';
import { URLFilterManager } from '../../lib/url-filter-manager';

// Storage key used by the app
const COMMENTS_STORAGE_KEY = 'sww-comments-local';

// Cache for synchronous operations
let commentsCache: Message[] = [];
let cacheInitialized = false;

/**
 * Initialize the adapter and load initial data
 */
export async function initAdapter(): Promise<void> {
  // Initialize IndexedDB
  await initStorage();
  
  // DON'T load initial messages - we want a clean slate
  // await refreshCache();  // DISABLED
  commentsCache = []; // Start with empty cache
  
  cacheInitialized = true;
  console.log('[StorageAdapter] Initialized with empty cache - no message preloading');
}

/**
 * Refresh the cache from IndexedDB
 */
async function refreshCache(): Promise<void> {
  try {
    const storage = getStorage();
    
    // Get all messages (temp + perm) sorted by timestamp
    const messages = await storage.getMessages({
      store: 'all',
      limit: 1000 // Match the existing 1000 message limit
    });
    
    // Sort by timestamp descending (newest first)
    messages.sort((a, b) => 
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
    
    // Keep only the last 1000 messages for the cache
    commentsCache = messages.slice(0, 1000);
  } catch (error) {
    console.error('[StorageAdapter] Failed to refresh cache:', error);
    commentsCache = [];
  }
}

/**
 * Get comments from storage (mimics localStorage.getItem)
 * Returns JSON string to match localStorage behavior
 */
export function getComments(): string | null {
  if (!cacheInitialized) {
    // Fallback to actual localStorage during initialization
    if (typeof window !== 'undefined') {
      return localStorage.getItem(COMMENTS_STORAGE_KEY);
    }
    return null;
  }
  
  // Return cached comments as JSON string
  return commentsCache.length > 0 ? JSON.stringify(commentsCache) : null;
}

/**
 * Save comments to storage (mimics localStorage.setItem)
 * Accepts JSON string to match localStorage behavior
 */
export async function setComments(value: string): Promise<void> {
  try {
    const comments = JSON.parse(value) as Message[];
    
    if (!cacheInitialized) {
      // During initialization, fall back to localStorage
      if (typeof window !== 'undefined') {
        localStorage.setItem(COMMENTS_STORAGE_KEY, value);
      }
      return;
    }
    
    const storage = getStorage();
    
    // Find new comments (not in cache)
    const newComments = comments.filter(comment => 
      !commentsCache.some(cached => 
        cached.timestamp === comment.timestamp && 
        cached.username === comment.username &&
        cached.text === comment.text
      )
    );
    
    // Save new comments to IndexedDB
    if (newComments.length > 0) {
      await storage.saveMessages(newComments);
      
      // Check and record any active filters from URL
      await recordActiveFilters();
    }
    
    // Update cache
    commentsCache = comments.slice(-1000); // Keep last 1000
    
    // Trigger storage event for other tabs
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new StorageEvent('storage', {
        key: COMMENTS_STORAGE_KEY,
        newValue: value,
        oldValue: JSON.stringify(commentsCache),
        url: window.location.href,
        storageArea: window.localStorage
      }));
    }
  } catch (error) {
    console.error('[StorageAdapter] Failed to save comments:', error);
    
    // Fallback to localStorage on error
    if (typeof window !== 'undefined') {
      localStorage.setItem(COMMENTS_STORAGE_KEY, value);
    }
  }
}

/**
 * Record active filters from URL
 */
async function recordActiveFilters(): Promise<void> {
  try {
    // Get current URL filters
    const urlManager = URLFilterManager.getInstance();
    const urlState = urlManager.getCurrentState();
    
    // Build filter state from URL
    const filters: Partial<FilterState> = {};
    
    if (urlState.users.length > 0) {
      filters.users = urlState.users.map(u => u.username);
    }
    
    if (urlState.words.length > 0) {
      filters.words = urlState.words;
    }
    
    if (urlState.searchTerms.length > 0) {
      filters.searchTerms = urlState.searchTerms;
    }
    
    // Record filters if any exist
    if (Object.keys(filters).length > 0) {
      await recordUserFilters(filters);
    }
  } catch (error) {
    // Silently fail - filter recording is not critical
    console.debug('[StorageAdapter] Could not record filters:', error);
  }
}

/**
 * Remove comments from storage (mimics localStorage.removeItem)
 */
export async function removeComments(): Promise<void> {
  if (!cacheInitialized) {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(COMMENTS_STORAGE_KEY);
    }
    return;
  }
  
  try {
    const storage = getStorage();
    await storage.clearAll();
    commentsCache = [];
    
    // Trigger storage event
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new StorageEvent('storage', {
        key: COMMENTS_STORAGE_KEY,
        newValue: null,
        oldValue: JSON.stringify(commentsCache),
        url: window.location.href,
        storageArea: window.localStorage
      }));
    }
  } catch (error) {
    console.error('[StorageAdapter] Failed to remove comments:', error);
  }
}

/**
 * Listen for storage changes from IndexedDB
 * This simulates localStorage storage events
 */
export function addStorageListener(callback: (event: StorageEvent) => void): () => void {
  // Poll IndexedDB for changes every 500ms
  const interval = setInterval(async () => {
    if (!cacheInitialized) return;
    
    const oldCache = [...commentsCache];
    await refreshCache();
    
    // Check if cache changed
    if (JSON.stringify(oldCache) !== JSON.stringify(commentsCache)) {
      // Simulate storage event
      const event = new StorageEvent('storage', {
        key: COMMENTS_STORAGE_KEY,
        newValue: JSON.stringify(commentsCache),
        oldValue: JSON.stringify(oldCache),
        url: window.location.href,
        storageArea: window.localStorage
      });
      
      callback(event);
    }
  }, 500);
  
  // Return cleanup function
  return () => clearInterval(interval);
}

/**
 * Export/import functions for debugging
 */
export async function exportDatabase(): Promise<any> {
  const storage = getStorage();
  return storage.exportData();
}

export async function importDatabase(data: any): Promise<void> {
  const storage = getStorage();
  await storage.importData(data);
  await refreshCache();
}
