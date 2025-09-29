/**
 * IndexedDB Storage System Initialization
 * Import this in your main app component to enable IndexedDB storage
 */

import { initAdapter } from './localStorage-adapter';
import { getStorage } from './index';

// Flag to prevent multiple initializations
let initialized = false;

/**
 * Initialize the IndexedDB storage system
 * Call this once when the app starts
 */
export async function initializeIndexedDBSystem(): Promise<void> {
  if (initialized) {
    console.log('[Storage] IndexedDB system already initialized');
    return;
  }
  
  if (typeof window === 'undefined') {
    console.log('[Storage] Skipping initialization on server side');
    return;
  }
  
  try {
    console.log('[Storage] Initializing IndexedDB system...');
    
    // Initialize the adapter (this also initializes IndexedDB)
    await initAdapter();
    
    // Verify the system is working
    const storage = getStorage();
    const info = await storage.getStorageInfo();
    
    console.log('[Storage] IndexedDB system initialized successfully');
    console.log(`[Storage] Current usage: ${(info.usage / (1024 * 1024)).toFixed(2)} MB`);
    console.log(`[Storage] Messages: ${info.messageCount.temporary + info.messageCount.permanent} total`);
    console.log(`[Storage] Lifetime filters: ${info.filterCount}`);
    
    initialized = true;
    
    // DISABLED: No migration from localStorage - we don't want old messages
    // Clean up any old localStorage message data
    const messageCacheKeys = ['sww-comments', 'sww-comments-local'];
    messageCacheKeys.forEach(key => {
      if (localStorage.getItem(key)) {
        localStorage.removeItem(key);
        console.log(`[Storage] Removed old message cache: ${key}`);
      }
    });
  } catch (error) {
    console.error('[Storage] Failed to initialize IndexedDB system:', error);
    console.log('[Storage] Falling back to localStorage');
  }
}

/**
 * Check if the system is initialized
 */
export function isIndexedDBReady(): boolean {
  return initialized;
}
