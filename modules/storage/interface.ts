/**
 * Storage Provider Interface
 * Abstract interface for storage implementations
 * Allows easy swapping between IndexedDB, SQLite, or other storage systems
 */

export interface Message {
  id?: string | number;
  timestamp: string;
  username: string;
  text: string;
  userColor: string;
  videoRef?: string;
  matchedFilters?: string[];
  _store?: 'temporary' | 'permanent';
}

export interface FilterState {
  users: string[];
  words: string[];
  searchTerms: string[];
  negativeWords: string[];
}

export interface LifetimeFilters {
  users: string[];
  words: string[];
  searchTerms: string[];
  metadata?: {
    created: string;
    lastUpdated: string;
    messageCount: number;
  };
}

export interface StorageInfo {
  usage: number;        // Bytes used
  quota: number;        // Bytes available
  messageCount: {
    temporary: number;
    permanent: number;
  };
  filterCount: number;
}

export interface FilterStats {
  filter: string;
  type: 'user' | 'word' | 'search';
  matchCount: number;
  lastMatch: string;
  created: string;
}

export interface StorageProvider {
  /**
   * Initialize the storage provider
   */
  init(): Promise<void>;
  
  /**
   * Check if provider is initialized
   */
  isInitialized(): boolean;
  
  /**
   * Save a message (determines temp vs perm based on filters)
   */
  saveMessage(message: Message): Promise<void>;
  
  /**
   * Save multiple messages in a batch
   */
  saveMessages(messages: Message[]): Promise<void>;
  
  /**
   * Get messages with optional filtering
   */
  getMessages(options?: {
    store?: 'temporary' | 'permanent' | 'all';
    limit?: number;
    offset?: number;
    filter?: FilterState;
  }): Promise<Message[]>;
  
  /**
   * Get message count
   */
  getMessageCount(store?: 'temporary' | 'permanent' | 'all'): Promise<number>;
  
  /**
   * Clear old messages (24-hour cleanup for temp store)
   */
  clearOldMessages(): Promise<number>;
  
  /**
   * Get storage information
   */
  getStorageInfo(): Promise<StorageInfo>;
  
  /**
   * Get lifetime filters
   */
  getLifetimeFilters(): Promise<LifetimeFilters>;
  
  /**
   * Update lifetime filters (adds new filters, never removes)
   */
  recordFilters(filters: Partial<FilterState>): Promise<void>;
  
  /**
   * Remove specific filters from lifetime memory
   */
  removeFilters(filters: Partial<FilterState>): Promise<void>;
  
  /**
   * Clear all lifetime filters
   */
  clearLifetimeFilters(): Promise<void>;
  
  /**
   * Get filter statistics
   */
  getFilterStats(): Promise<FilterStats[]>;
  
  /**
   * Update filter statistics when a match occurs
   */
  updateFilterStats(filter: string, type: 'user' | 'word' | 'search'): Promise<void>;
  
  /**
   * Export all data for backup
   */
  exportData(): Promise<any>;
  
  /**
   * Import data from backup
   */
  importData(data: any): Promise<void>;
  
  /**
   * Clear all data (reset)
   */
  clearAll(): Promise<void>;
  
  /**
   * Migrate from localStorage (one-time operation)
   */
  migrateFromLocalStorage(): Promise<void>;
  
  /**
   * Storage cleanup when approaching limits
   */
  performCleanup(): Promise<{
    deletedMessages: number;
    removedFilters: number;
  }>;
}

// Export a type for the storage instance
export type StorageInstance = StorageProvider;
