/**
 * IndexedDB Schema Definitions
 * Defines the database structure and indexes
 */

export const DB_NAME = 'SayWhatWant';
export const DB_VERSION = 1;

// Storage limit: 1 GB
export const STORAGE_LIMIT = 1024 * 1024 * 1024; // 1 GB in bytes

// Time constants
export const TEMP_MESSAGE_TTL = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

// Object store names
export const STORES = {
  MESSAGES_TEMP: 'messages_temp',
  MESSAGES_PERM: 'messages_perm',
  LIFETIME_FILTERS: 'lifetime_filters',
  FILTER_STATS: 'filter_stats'
} as const;

// Index definitions for each store
export const INDEXES = {
  MESSAGES: {
    TIMESTAMP: 'timestamp',
    USERNAME: 'username',
    USERNAME_TIMESTAMP: 'username-timestamp'
  },
  FILTER_STATS: {
    MATCH_COUNT: 'matchCount',
    LAST_MATCH: 'lastMatch',
    TYPE: 'type'
  }
} as const;

/**
 * Create database schema
 * Called during database upgrade
 */
export function createSchema(db: IDBDatabase, oldVersion: number, transaction: IDBTransaction) {
  // Create messages_temp store
  if (!db.objectStoreNames.contains(STORES.MESSAGES_TEMP)) {
    const tempStore = db.createObjectStore(STORES.MESSAGES_TEMP, { 
      keyPath: 'id', 
      autoIncrement: true 
    });
    tempStore.createIndex(INDEXES.MESSAGES.TIMESTAMP, 'timestamp', { unique: false });
    tempStore.createIndex(INDEXES.MESSAGES.USERNAME, 'username', { unique: false });
    tempStore.createIndex(INDEXES.MESSAGES.USERNAME_TIMESTAMP, ['username', 'timestamp'], { unique: false });
  }
  
  // Create messages_perm store
  if (!db.objectStoreNames.contains(STORES.MESSAGES_PERM)) {
    const permStore = db.createObjectStore(STORES.MESSAGES_PERM, { 
      keyPath: 'id', 
      autoIncrement: true 
    });
    permStore.createIndex(INDEXES.MESSAGES.TIMESTAMP, 'timestamp', { unique: false });
    permStore.createIndex(INDEXES.MESSAGES.USERNAME, 'username', { unique: false });
    permStore.createIndex(INDEXES.MESSAGES.USERNAME_TIMESTAMP, ['username', 'timestamp'], { unique: false });
  }
  
  // Create lifetime_filters store
  if (!db.objectStoreNames.contains(STORES.LIFETIME_FILTERS)) {
    db.createObjectStore(STORES.LIFETIME_FILTERS, { keyPath: 'id' });
  }
  
  // Create filter_stats store
  if (!db.objectStoreNames.contains(STORES.FILTER_STATS)) {
    const statsStore = db.createObjectStore(STORES.FILTER_STATS, { keyPath: 'filter' });
    statsStore.createIndex(INDEXES.FILTER_STATS.MATCH_COUNT, 'matchCount', { unique: false });
    statsStore.createIndex(INDEXES.FILTER_STATS.LAST_MATCH, 'lastMatch', { unique: false });
    statsStore.createIndex(INDEXES.FILTER_STATS.TYPE, 'type', { unique: false });
  }
}

/**
 * Handle database migrations
 * Called during version upgrades
 */
export function handleMigration(db: IDBDatabase, oldVersion: number, newVersion: number, transaction: IDBTransaction) {
  // Future migrations will be handled here
  // Example:
  // if (oldVersion < 2) {
  //   // Migrate from v1 to v2
  // }
  // if (oldVersion < 3) {
  //   // Migrate from v2 to v3
  // }
  
  console.log(`[IndexedDB] Migrated from version ${oldVersion} to ${newVersion}`);
}
