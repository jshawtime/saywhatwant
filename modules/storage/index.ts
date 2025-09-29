/**
 * Storage Module Public API
 * Provides a singleton storage instance that can be easily swapped
 */

import { StorageProvider, Message, FilterState, LifetimeFilters, StorageInfo } from './interface';
import { IndexedDBProvider } from './indexeddb/provider';

// Singleton instance
let storageInstance: StorageProvider | null = null;

/**
 * Get the storage provider instance
 * Currently uses IndexedDB but can be easily swapped for another provider
 */
export function getStorage(): StorageProvider {
  if (!storageInstance) {
    // In the future, this could check for different providers:
    // if (USE_SQLITE) storageInstance = new SQLiteProvider();
    // if (USE_WEBSQL) storageInstance = new WebSQLProvider();
    
    storageInstance = new IndexedDBProvider();
  }
  
  return storageInstance;
}

/**
 * Initialize the storage system
 * Must be called before using any storage operations
 */
export async function initStorage(): Promise<void> {
  const storage = getStorage();
  
  if (!storage.isInitialized()) {
  await storage.init();
  
  // DISABLED: No migration - we want a clean start
  // await storage.migrateFromLocalStorage();
  
  // Clear any existing messages for a fresh start
  await storage.clearAll();
  console.log('[Storage] Cleared all existing messages for fresh start');
  
  // Start background cleanup task
  startCleanupTask();
  }
}

/**
 * Start the background cleanup task
 * Runs every hour to clean up old messages
 */
function startCleanupTask(): void {
  // CRITICAL: Only run cleanup in the browser, not during SSR/build
  if (typeof window === 'undefined') {
    return;
  }
  
  // Run cleanup every hour
  const CLEANUP_INTERVAL = 60 * 60 * 1000; // 1 hour
  
  const runCleanup = async () => {
    try {
      const storage = getStorage();
      const deletedCount = await storage.clearOldMessages();
      
      if (deletedCount > 0) {
        console.log(`[Storage] Automatic cleanup removed ${deletedCount} old messages`);
      }
      
      // Check if we need to perform storage cleanup
      const storageInfo = await storage.getStorageInfo();
      const usagePercent = (storageInfo.usage / storageInfo.quota) * 100;
      
      if (usagePercent > 80) {
        const result = await storage.performCleanup();
        console.log(`[Storage] Storage cleanup: ${result.deletedMessages} messages, ${result.removedFilters} filters removed`);
      }
    } catch (error) {
      console.error('[Storage] Cleanup task error:', error);
    }
  };
  
  // Run immediately, then every hour
  runCleanup();
  setInterval(runCleanup, CLEANUP_INTERVAL);
}

/**
 * Record filters when user applies any filter
 * This builds the lifetime filter memory
 */
export async function recordUserFilters(filters: Partial<FilterState>): Promise<void> {
  const storage = getStorage();
  
  // Only record positive filters (not negative/exclude filters)
  const positiveFilters: Partial<FilterState> = {
    users: filters.users,
    words: filters.words,
    searchTerms: filters.searchTerms
  };
  
  // Remove empty arrays
  Object.keys(positiveFilters).forEach(key => {
    const k = key as keyof FilterState;
    if (!positiveFilters[k]?.length) {
      delete positiveFilters[k];
    }
  });
  
  // Only record if there are actual filters
  if (Object.keys(positiveFilters).length > 0) {
    await storage.recordFilters(positiveFilters);
  }
}

// Re-export types and interfaces for convenience
export type { 
  StorageProvider, 
  Message, 
  FilterState, 
  LifetimeFilters, 
  StorageInfo 
} from './interface';

// Export the storage instance getter for direct access if needed
export { getStorage as storage };
