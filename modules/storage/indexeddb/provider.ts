/**
 * IndexedDB Storage Provider
 * Implements the StorageProvider interface using IndexedDB
 */

import { 
  StorageProvider, 
  Message, 
  FilterState, 
  LifetimeFilters, 
  StorageInfo,
  FilterStats 
} from '../interface';

import { 
  DB_NAME, 
  DB_VERSION, 
  STORES, 
  INDEXES, 
  STORAGE_LIMIT,
  TEMP_MESSAGE_TTL,
  createSchema,
  handleMigration 
} from './schemas';

import {
  matchesLifetimeFilters,
  getMatchedFilters,
  mergeFilters,
  removeFilters,
  calculateFilterScore,
  normalize
} from './filters';

export class IndexedDBProvider implements StorageProvider {
  private db: IDBDatabase | null = null;
  private initialized = false;
  private lifetimeFilters: LifetimeFilters | null = null;
  
  async init(): Promise<void> {
    if (this.initialized) return;
    
    // CRITICAL: Check if we're in the browser
    if (typeof window === 'undefined' || !window.indexedDB) {
      console.warn('[IndexedDB] Not available (SSR/build context)');
      return Promise.resolve();
    }
    
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      
      request.onerror = () => {
        console.error('[IndexedDB] Failed to open database:', request.error);
        reject(request.error);
      };
      
      request.onsuccess = () => {
        this.db = request.result;
        this.initialized = true;
        console.log('[IndexedDB] Successfully initialized');
        
        // Load lifetime filters into memory
        this.loadLifetimeFilters().then(() => {
          resolve();
        });
      };
      
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        const transaction = (event.target as IDBOpenDBRequest).transaction!;
        const oldVersion = event.oldVersion;
        
        createSchema(db, oldVersion, transaction);
        
        if (oldVersion > 0) {
          handleMigration(db, oldVersion, DB_VERSION, transaction);
        }
      };
    });
  }
  
  isInitialized(): boolean {
    // During SSR/build, consider it initialized (but non-functional)
    if (typeof window === 'undefined') {
      return true;
    }
    return this.initialized && this.db !== null;
  }
  
  private async loadLifetimeFilters(): Promise<void> {
    if (!this.db) return;
    
    try {
      const transaction = this.db.transaction([STORES.LIFETIME_FILTERS], 'readonly');
      const store = transaction.objectStore(STORES.LIFETIME_FILTERS);
      const request = store.get('filters');
      
      const result = await this.promisifyRequest<any>(request);
      this.lifetimeFilters = result?.data || {
        users: [],
        words: [],
        searchTerms: [],
        metadata: {
          created: new Date().toISOString(),
          lastUpdated: new Date().toISOString(),
          messageCount: 0
        }
      };
    } catch (error) {
      console.error('[IndexedDB] Error loading lifetime filters:', error);
      this.lifetimeFilters = {
        users: [],
        words: [],
        searchTerms: []
      };
    }
  }
  
  async saveMessage(message: Message): Promise<void> {
    if (!this.db || !this.lifetimeFilters) {
      throw new Error('Database not initialized');
    }
    
    // Determine if message should be permanent
    const isPermanent = matchesLifetimeFilters(message, this.lifetimeFilters);
    
    // Add matched filters to message
    if (isPermanent) {
      message.matchedFilters = getMatchedFilters(message, this.lifetimeFilters);
    }
    
    // Save to appropriate store
    const storeName = isPermanent ? STORES.MESSAGES_PERM : STORES.MESSAGES_TEMP;
    const transaction = this.db.transaction([storeName], 'readwrite');
    const store = transaction.objectStore(storeName);
    
    // Remove id if it exists to let IndexedDB auto-generate
    const messageToSave = { ...message };
    delete messageToSave.id;
    
    await this.promisifyRequest(store.add(messageToSave));
    
    // Update filter statistics if permanent
    if (isPermanent && message.matchedFilters) {
      await this.updateFilterStatsForMatches(message.matchedFilters);
    }
  }
  
  async saveMessages(messages: Message[]): Promise<void> {
    // During SSR/build, silently return
    if (typeof window === 'undefined' || !this.db || !this.lifetimeFilters) {
      return;
    }
    
    // Separate messages into temporary and permanent
    const tempMessages: Message[] = [];
    const permMessages: Message[] = [];
    
    for (const message of messages) {
      const isPermanent = matchesLifetimeFilters(message, this.lifetimeFilters);
      
      const messageToSave = { ...message };
      delete messageToSave.id;
      
      if (isPermanent) {
        messageToSave.matchedFilters = getMatchedFilters(message, this.lifetimeFilters);
        permMessages.push(messageToSave);
      } else {
        tempMessages.push(messageToSave);
      }
    }
    
    // Save temporary messages
    if (tempMessages.length > 0) {
      const transaction = this.db.transaction([STORES.MESSAGES_TEMP], 'readwrite');
      const store = transaction.objectStore(STORES.MESSAGES_TEMP);
      
      for (const msg of tempMessages) {
        store.add(msg);
      }
      
      await this.promisifyTransaction(transaction);
    }
    
    // Save permanent messages
    if (permMessages.length > 0) {
      const transaction = this.db.transaction([STORES.MESSAGES_PERM], 'readwrite');
      const store = transaction.objectStore(STORES.MESSAGES_PERM);
      
      for (const msg of permMessages) {
        store.add(msg);
        
        // Update filter stats
        if (msg.matchedFilters) {
          await this.updateFilterStatsForMatches(msg.matchedFilters);
        }
      }
      
      await this.promisifyTransaction(transaction);
    }
  }
  
  async getMessages(options?: {
    store?: 'temporary' | 'permanent' | 'all';
    limit?: number;
    offset?: number;
    filter?: FilterState;
  }): Promise<Message[]> {
    // During SSR/build, return empty array
    if (typeof window === 'undefined' || !this.db) {
      return [];
    }
    
    const storeType = options?.store || 'all';
    const limit = options?.limit || 1000;
    const offset = options?.offset || 0;
    
    let messages: Message[] = [];
    
    // Determine which stores to query
    const storesToQuery = storeType === 'all' 
      ? [STORES.MESSAGES_TEMP, STORES.MESSAGES_PERM]
      : storeType === 'temporary' 
        ? [STORES.MESSAGES_TEMP]
        : [STORES.MESSAGES_PERM];
    
    // Query each store
    for (const storeName of storesToQuery) {
      const transaction = this.db.transaction([storeName], 'readonly');
      const store = transaction.objectStore(storeName);
      
      // Use index for better performance
      const index = store.index(INDEXES.MESSAGES.TIMESTAMP);
      const request = index.openCursor(null, 'prev'); // Sort by timestamp descending
      
      const storeMessages = await this.cursorToArray(request, limit, offset);
      
      // Mark which store each message came from
      storeMessages.forEach(msg => {
        msg._store = storeName === STORES.MESSAGES_TEMP ? 'temporary' : 'permanent';
      });
      
      messages = messages.concat(storeMessages);
    }
    
    // Sort combined results by timestamp
    messages.sort((a, b) => 
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
    
    // Apply limit to combined results
    return messages.slice(0, limit);
  }
  
  async getMessageCount(store?: 'temporary' | 'permanent' | 'all'): Promise<number> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }
    
    let count = 0;
    
    if (store === 'temporary' || store === 'all' || !store) {
      const transaction = this.db.transaction([STORES.MESSAGES_TEMP], 'readonly');
      const tempStore = transaction.objectStore(STORES.MESSAGES_TEMP);
      const tempCount = await this.promisifyRequest(tempStore.count());
      count += tempCount as number;
    }
    
    if (store === 'permanent' || store === 'all' || !store) {
      const transaction = this.db.transaction([STORES.MESSAGES_PERM], 'readonly');
      const permStore = transaction.objectStore(STORES.MESSAGES_PERM);
      const permCount = await this.promisifyRequest(permStore.count());
      count += permCount as number;
    }
    
    return count;
  }
  
  async clearOldMessages(): Promise<number> {
    // During SSR/build, return 0
    if (typeof window === 'undefined' || !this.db) {
      return 0;
    }
    
    const cutoffTime = new Date(Date.now() - TEMP_MESSAGE_TTL).toISOString();
    let deletedCount = 0;
    
    const transaction = this.db.transaction([STORES.MESSAGES_TEMP], 'readwrite');
    const store = transaction.objectStore(STORES.MESSAGES_TEMP);
    const index = store.index(INDEXES.MESSAGES.TIMESTAMP);
    
    // Create range for messages older than 24 hours
    const range = IDBKeyRange.upperBound(cutoffTime);
    const request = index.openCursor(range);
    
    return new Promise((resolve, reject) => {
      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result;
        if (cursor) {
          cursor.delete();
          deletedCount++;
          cursor.continue();
        } else {
          console.log(`[IndexedDB] Cleaned up ${deletedCount} old messages`);
          resolve(deletedCount);
        }
      };
      
      request.onerror = () => {
        reject(request.error);
      };
    });
  }
  
  async getStorageInfo(): Promise<StorageInfo> {
    // During SSR/build, return safe defaults
    if (typeof window === 'undefined' || !navigator?.storage?.estimate) {
      return { usage: 0, quota: STORAGE_LIMIT };
    }
    
    const estimate = await navigator.storage.estimate();
    
    const tempCount = await this.getMessageCount('temporary');
    const permCount = await this.getMessageCount('permanent');
    
    const filters = await this.getLifetimeFilters();
    const filterCount = 
      (filters.users?.length || 0) + 
      (filters.words?.length || 0) + 
      (filters.searchTerms?.length || 0);
    
    return {
      usage: estimate.usage || 0,
      quota: estimate.quota || 0,
      messageCount: {
        temporary: tempCount,
        permanent: permCount
      },
      filterCount
    };
  }
  
  async getLifetimeFilters(): Promise<LifetimeFilters> {
    // Return cached version if available
    if (this.lifetimeFilters) {
      return { ...this.lifetimeFilters };
    }
    
    // Otherwise load from database
    await this.loadLifetimeFilters();
    return { ...(this.lifetimeFilters || { users: [], words: [], searchTerms: [] }) };
  }
  
  async recordFilters(filters: Partial<FilterState>): Promise<void> {
    // During SSR/build, silently return
    if (typeof window === 'undefined' || !this.db) {
      return;
    }
    
    // Load current filters if not cached
    if (!this.lifetimeFilters) {
      await this.loadLifetimeFilters();
    }
    
    // Merge new filters
    this.lifetimeFilters = mergeFilters(
      this.lifetimeFilters || { users: [], words: [], searchTerms: [] },
      filters
    );
    
    // Save to database
    const transaction = this.db.transaction([STORES.LIFETIME_FILTERS], 'readwrite');
    const store = transaction.objectStore(STORES.LIFETIME_FILTERS);
    
    await this.promisifyRequest(store.put({
      id: 'filters',
      data: this.lifetimeFilters,
      updated: new Date().toISOString()
    }));
    
    console.log('[IndexedDB] Recorded new filters:', filters);
  }
  
  async removeFilters(filters: Partial<FilterState>): Promise<void> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }
    
    // Load current filters if not cached
    if (!this.lifetimeFilters) {
      await this.loadLifetimeFilters();
    }
    
    // Remove specified filters
    this.lifetimeFilters = removeFilters(
      this.lifetimeFilters || { users: [], words: [], searchTerms: [] },
      filters
    );
    
    // Save to database
    const transaction = this.db.transaction([STORES.LIFETIME_FILTERS], 'readwrite');
    const store = transaction.objectStore(STORES.LIFETIME_FILTERS);
    
    await this.promisifyRequest(store.put({
      id: 'filters',
      data: this.lifetimeFilters,
      updated: new Date().toISOString()
    }));
    
    console.log('[IndexedDB] Removed filters:', filters);
  }
  
  async clearLifetimeFilters(): Promise<void> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }
    
    this.lifetimeFilters = {
      users: [],
      words: [],
      searchTerms: [],
      metadata: {
        created: new Date().toISOString(),
        lastUpdated: new Date().toISOString(),
        messageCount: 0
      }
    };
    
    const transaction = this.db.transaction([STORES.LIFETIME_FILTERS, STORES.FILTER_STATS], 'readwrite');
    
    // Clear filters
    const filterStore = transaction.objectStore(STORES.LIFETIME_FILTERS);
    await this.promisifyRequest(filterStore.clear());
    
    // Clear stats
    const statsStore = transaction.objectStore(STORES.FILTER_STATS);
    await this.promisifyRequest(statsStore.clear());
    
    console.log('[IndexedDB] Cleared all lifetime filters');
  }
  
  async getFilterStats(): Promise<FilterStats[]> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }
    
    const transaction = this.db.transaction([STORES.FILTER_STATS], 'readonly');
    const store = transaction.objectStore(STORES.FILTER_STATS);
    const request = store.getAll();
    
    const stats = await this.promisifyRequest(request) as FilterStats[];
    return stats || [];
  }
  
  async updateFilterStats(filter: string, type: 'user' | 'word' | 'search'): Promise<void> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }
    
    const transaction = this.db.transaction([STORES.FILTER_STATS], 'readwrite');
    const store = transaction.objectStore(STORES.FILTER_STATS);
    
    // Get existing stats
    const existing = await this.promisifyRequest(store.get(filter)) as FilterStats | undefined;
    
    const stats: FilterStats = existing || {
      filter,
      type,
      matchCount: 0,
      lastMatch: new Date().toISOString(),
      created: new Date().toISOString()
    };
    
    stats.matchCount++;
    stats.lastMatch = new Date().toISOString();
    
    await this.promisifyRequest(store.put(stats));
  }
  
  async exportData(): Promise<any> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }
    
    const exportData = {
      version: DB_VERSION,
      timestamp: new Date().toISOString(),
      stores: {} as any
    };
    
    // Export all stores
    const storeNames = [
      STORES.MESSAGES_TEMP,
      STORES.MESSAGES_PERM,
      STORES.LIFETIME_FILTERS,
      STORES.FILTER_STATS
    ];
    
    for (const storeName of storeNames) {
      const transaction = this.db.transaction([storeName], 'readonly');
      const store = transaction.objectStore(storeName);
      const data = await this.promisifyRequest(store.getAll());
      exportData.stores[storeName] = data;
    }
    
    return exportData;
  }
  
  async importData(data: any): Promise<void> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }
    
    // Validate import data
    if (!data.stores || data.version > DB_VERSION) {
      throw new Error('Invalid or incompatible import data');
    }
    
    // Clear existing data
    await this.clearAll();
    
    // Import each store
    for (const [storeName, records] of Object.entries(data.stores)) {
      if (!Array.isArray(records)) continue;
      
      const transaction = this.db.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);
      
      for (const record of records) {
        await this.promisifyRequest(store.add(record));
      }
    }
    
    // Reload lifetime filters
    await this.loadLifetimeFilters();
    
    console.log('[IndexedDB] Data imported successfully');
  }
  
  async clearAll(): Promise<void> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }
    
    const storeNames = [
      STORES.MESSAGES_TEMP,
      STORES.MESSAGES_PERM,
      STORES.LIFETIME_FILTERS,
      STORES.FILTER_STATS
    ];
    
    for (const storeName of storeNames) {
      const transaction = this.db.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);
      await this.promisifyRequest(store.clear());
    }
    
    this.lifetimeFilters = null;
    console.log('[IndexedDB] All data cleared');
  }
  
  async migrateFromLocalStorage(): Promise<void> {
    if (typeof window === 'undefined') return;
    
    const localKey = 'sww-comments-local';
    const localData = localStorage.getItem(localKey);
    
    if (!localData) {
      console.log('[IndexedDB] No localStorage data to migrate');
      return;
    }
    
    try {
      const messages = JSON.parse(localData) as Message[];
      
      if (Array.isArray(messages) && messages.length > 0) {
        await this.saveMessages(messages);
        
        // Clear localStorage after successful migration
        localStorage.removeItem(localKey);
        console.log(`[IndexedDB] Migrated ${messages.length} messages from localStorage`);
      }
    } catch (error) {
      console.error('[IndexedDB] Failed to migrate from localStorage:', error);
    }
  }
  
  async performCleanup(): Promise<{ deletedMessages: number; removedFilters: number }> {
    // During SSR/build, return zeros
    if (typeof window === 'undefined' || !this.db) {
      return { deletedMessages: 0, removedFilters: 0 };
    }
    
    const storageInfo = await this.getStorageInfo();
    const usageBytes = storageInfo.usage;
    
    let deletedMessages = 0;
    let removedFilters = 0;
    
    // If over 1GB (STORAGE_LIMIT), start cleanup
    if (usageBytes > STORAGE_LIMIT) {
      console.log(`[IndexedDB] Storage at ${(usageBytes / 1024 / 1024).toFixed(2)}MB, starting cleanup...`);
      
      // Calculate how many messages to delete (~10MB worth)
      const TARGET_DELETE_BYTES = 10 * 1024 * 1024; // 10MB
      const avgMessageSize = 500; // Assume ~500 bytes per message
      const messagesToDelete = Math.ceil(TARGET_DELETE_BYTES / avgMessageSize);
      
      // Step 1: Delete oldest permanent messages
      if (this.db) {
        const transaction = this.db.transaction([STORES.MESSAGES_PERM], 'readwrite');
        const store = transaction.objectStore(STORES.MESSAGES_PERM);
        const index = store.index(INDEXES.MESSAGES.TIMESTAMP);
        
        // Delete oldest messages (approx 10MB worth)
        const request = index.openCursor();
        let count = 0;
        
        await new Promise((resolve, reject) => {
          request.onsuccess = (event) => {
            const cursor = (event.target as IDBRequest).result;
            if (cursor && count < messagesToDelete) {
              cursor.delete();
              count++;
              deletedMessages++;
              cursor.continue();
            } else {
              resolve(undefined);
            }
          };
          request.onerror = () => reject(request.error);
        });
      }
      
      // Step 2: If still over 1GB after deletion, remove least-matched filters
      const newStorageInfo = await this.getStorageInfo();
      
      if (newStorageInfo.usage > STORAGE_LIMIT) {
        const stats = await this.getFilterStats();
        
        // Sort by efficiency score
        stats.sort((a, b) => {
          const scoreA = calculateFilterScore(a.matchCount, a.created);
          const scoreB = calculateFilterScore(b.matchCount, b.created);
          return scoreA - scoreB;
        });
        
        // Remove 10 least efficient filters
        const toRemove = stats.slice(0, 10);
        
        const filtersToRemove: Partial<FilterState> = {
          users: [],
          words: [],
          searchTerms: []
        };
        
        for (const stat of toRemove) {
          const [type, value] = stat.filter.split(':');
          if (type === 'user') filtersToRemove.users!.push(value);
          else if (type === 'word') filtersToRemove.words!.push(value);
          else if (type === 'search') filtersToRemove.searchTerms!.push(value);
          removedFilters++;
        }
        
        await this.removeFilters(filtersToRemove);
      }
    }
    
    console.log(`[IndexedDB] Cleanup: Deleted ${deletedMessages} messages, removed ${removedFilters} filters`);
    return { deletedMessages, removedFilters };
  }
  
  // Helper methods
  
  private async updateFilterStatsForMatches(matchedFilters: string[]): Promise<void> {
    for (const filter of matchedFilters) {
      const [type, value] = filter.split(':');
      await this.updateFilterStats(filter, type as 'user' | 'word' | 'search');
    }
  }
  
  private promisifyRequest<T>(request: IDBRequest): Promise<T> {
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }
  
  private promisifyTransaction(transaction: IDBTransaction): Promise<void> {
    return new Promise((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  }
  
  private async cursorToArray(cursorRequest: IDBRequest, limit: number, offset: number): Promise<Message[]> {
    return new Promise((resolve, reject) => {
      const results: Message[] = [];
      let skipped = 0;
      
      cursorRequest.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result;
        
        if (cursor) {
          // Skip offset records
          if (skipped < offset) {
            skipped++;
            cursor.continue();
            return;
          }
          
          // Collect records up to limit
          if (results.length < limit) {
            results.push(cursor.value);
            cursor.continue();
          } else {
            resolve(results);
          }
        } else {
          // No more records
          resolve(results);
        }
      };
      
      cursorRequest.onerror = () => {
        reject(cursorRequest.error);
      };
    });
  }
}
