/**
 * SimpleIndexedDB - The ONLY storage system for Say What Want
 * Stores Comment objects exactly as they come from KV
 * 
 * THIS IS THE ONLY INDEXEDDB SYSTEM IN USE
 * ALL OLD STORAGE SYSTEMS HAVE BEEN REMOVED
 */

import { Comment } from '@/types';
import { MESSAGE_SYSTEM_CONFIG } from '@/config/message-system';

const DB_NAME = 'SayWhatWant';
const DB_VERSION = 4; // Bumped to fix index creation error with 'message-type'
const STORE_NAME = 'messages';

// Use config values for limits
const MAX_MESSAGES = MESSAGE_SYSTEM_CONFIG.maxIndexedDBMessages;
const CLEANUP_THRESHOLD = MESSAGE_SYSTEM_CONFIG.indexedDBCleanupThreshold;

/**
 * SimpleIndexedDB - Direct storage for Comment objects
 * No transformation, no filters, just storage
 */
class SimpleIndexedDB {
  private db: IDBDatabase | null = null;
  private isInitialized = false;

  /**
   * Initialize the database
   * Creates or upgrades the database schema
   */
  async init(): Promise<void> {
    if (this.isInitialized) {
      console.log('[SimpleIndexedDB] Already initialized');
      return;
    }

    return new Promise((resolve, reject) => {
      console.log('[SimpleIndexedDB] Initializing database...');
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        console.error('[SimpleIndexedDB] Failed to open database:', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        this.isInitialized = true;
        console.log('[SimpleIndexedDB] Database initialized successfully');
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        console.log('[SimpleIndexedDB] Upgrading database from version', event.oldVersion, 'to', event.newVersion);

        // Delete ALL old stores - we only use 'messages' now
        const oldStores = ['messages_temp', 'messages_perm', 'lifetime_filters', 'filter_stats'];
        oldStores.forEach(storeName => {
          if (db.objectStoreNames.contains(storeName)) {
            console.log(`[SimpleIndexedDB] Removing old store: ${storeName}`);
            db.deleteObjectStore(storeName);
          }
        });

        // Create new simple store if it doesn't exist
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          console.log('[SimpleIndexedDB] Creating messages store');
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
          store.createIndex('timestamp', 'timestamp', { unique: false });
          store.createIndex('username', 'username', { unique: false });
          store.createIndex('color', 'color', { unique: false });
          // NOTE: We cannot create an index on 'message-type' because IndexedDB
          // doesn't support hyphens in keyPath names. The field still exists
          // in the stored data, we just can't index by it.
        }
      };
    });
  }

  /**
   * Check if database is initialized
   */
  isInit(): boolean {
    return this.isInitialized && this.db !== null;
  }

  /**
   * Save a single message
   * Stores Comment exactly as-is
   */
  async saveMessage(message: Comment): Promise<void> {
    if (!this.isInit()) {
      console.error('[SimpleIndexedDB] Cannot save - database not initialized');
      throw new Error('[SimpleIndexedDB] Database not initialized');
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.put(message);

      request.onsuccess = () => {
        console.log('[SimpleIndexedDB] Message saved:', message.id);
        this.performCleanupIfNeeded();
        resolve();
      };

      request.onerror = () => {
        console.error('[SimpleIndexedDB] Failed to save message:', request.error);
        reject(request.error);
      };
    });
  }

  /**
   * Save multiple messages in bulk
   * Checks for cleanup threshold
   */
  async saveMessages(messages: Comment[]): Promise<void> {
    if (!this.isInit()) {
      console.error('[SimpleIndexedDB] Cannot save - database not initialized');
      throw new Error('[SimpleIndexedDB] Database not initialized');
    }

    if (messages.length === 0) return;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      let savedCount = 0;

      // Save each message
      messages.forEach(message => {
        const request = store.put(message);
        request.onsuccess = () => {
          savedCount++;
          if (savedCount === messages.length) {
            console.log(`[SimpleIndexedDB] Saved ${savedCount} messages`);
            this.performCleanupIfNeeded();
            resolve();
          }
        };
      });

      transaction.onerror = () => {
        console.error('[SimpleIndexedDB] Failed to save messages:', transaction.error);
        reject(transaction.error);
      };
    });
  }

  /**
   * Get messages from the database
   * Returns newest messages first
   */
  async getMessages(limit: number = 200, offset: number = 0): Promise<Comment[]> {
    if (!this.isInit()) {
      console.warn('[SimpleIndexedDB] Cannot get messages - database not initialized');
      return [];
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const index = store.index('timestamp');
      
      const messages: Comment[] = [];
      let skipped = 0;
      
      // Open cursor in reverse order (newest first)
      const request = index.openCursor(null, 'prev');
      
      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result;
        
        if (cursor && messages.length < limit) {
          if (skipped < offset) {
            skipped++;
            cursor.continue();
          } else {
            messages.push(cursor.value);
            cursor.continue();
          }
        } else {
          console.log(`[SimpleIndexedDB] Retrieved ${messages.length} messages`);
          resolve(messages);
        }
      };

      request.onerror = () => {
        console.error('[SimpleIndexedDB] Failed to retrieve messages:', request.error);
        reject(request.error);
      };
    });
  }

  /**
   * Get total message count
   */
  async getMessageCount(): Promise<number> {
    if (!this.isInit()) {
      console.warn('[SimpleIndexedDB] Cannot get count - database not initialized');
      return 0;
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.count();

      request.onsuccess = () => {
        resolve(request.result);
      };

      request.onerror = () => {
        console.error('[SimpleIndexedDB] Failed to count messages:', request.error);
        reject(request.error);
      };
    });
  }

  /**
   * Clear all messages
   */
  async clear(): Promise<void> {
    if (!this.isInit()) {
      console.warn('[SimpleIndexedDB] Cannot clear - database not initialized');
      throw new Error('[SimpleIndexedDB] Database not initialized');
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.clear();

      request.onsuccess = () => {
        console.log('[SimpleIndexedDB] All messages cleared');
        resolve();
      };

      request.onerror = () => {
        console.error('[SimpleIndexedDB] Failed to clear messages:', request.error);
        reject(request.error);
      };
    });
  }

  /**
   * Perform cleanup if we exceed threshold
   * Deletes oldest messages to maintain MAX_MESSAGES
   */
  private async performCleanupIfNeeded(): Promise<void> {
    try {
      const count = await this.getMessageCount();
      
      if (count > CLEANUP_THRESHOLD) {
        console.log(`[SimpleIndexedDB] Cleanup triggered: ${count} messages (threshold: ${CLEANUP_THRESHOLD})`);
        
        const toDelete = count - MAX_MESSAGES;
        if (toDelete <= 0) return;
        
        // Delete oldest messages
        const transaction = this.db!.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const index = store.index('timestamp');
        
        let deleted = 0;
        const request = index.openCursor(null, 'next'); // Start from oldest
        
        request.onsuccess = (event) => {
          const cursor = (event.target as IDBRequest).result;
          
          if (cursor && deleted < toDelete) {
            store.delete(cursor.primaryKey);
            deleted++;
            cursor.continue();
          } else if (!cursor || deleted >= toDelete) {
            console.log(`[SimpleIndexedDB] Cleanup complete: deleted ${deleted} messages`);
          }
        };
      }
    } catch (error) {
      console.error('[SimpleIndexedDB] Cleanup error:', error);
    }
  }

  /**
   * Debug helper - logs database state
   */
  async debug(): Promise<void> {
    console.log('=== SimpleIndexedDB Debug ===');
    console.log('Database:', this.db?.name);
    console.log('Version:', this.db?.version);
    console.log('Stores:', this.db ? Array.from(this.db.objectStoreNames) : 'Not initialized');
    console.log('Initialized:', this.isInitialized);
    
    if (this.isInit()) {
      const count = await this.getMessageCount();
      console.log('Message Count:', count);
      
      const sample = await this.getMessages(1);
      if (sample.length > 0) {
        console.log('Sample Message:', sample[0]);
        console.log('Has all KV fields:', {
          id: 'id' in sample[0],
          text: 'text' in sample[0],
          timestamp: 'timestamp' in sample[0],
          username: 'username' in sample[0],
          color: 'color' in sample[0],
          domain: 'domain' in sample[0],
          language: 'language' in sample[0],
          'message-type': 'message-type' in sample[0],
          misc: 'misc' in sample[0]
        });
      }
    }
    
    console.log('=======================');
  }
}

// Export singleton instance
export const simpleIndexedDB = new SimpleIndexedDB();

// Expose globally for debugging and test page
if (typeof window !== 'undefined') {
  (window as any).simpleIndexedDB = simpleIndexedDB;
}
