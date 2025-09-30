/**
 * Simple IndexedDB Manager
 * Stores Comment data exactly as received from KV - no transformation
 */

import type { Comment } from '@/types';
import { MESSAGE_SYSTEM_CONFIG } from '@/config/message-system';

const DB_NAME = 'SayWhatWant';
const DB_VERSION = 3; // New version for migration
const STORE_NAME = 'messages';

// Use config from message-system.ts
const MAX_MESSAGES = MESSAGE_SYSTEM_CONFIG.maxIndexedDBMessages; // 100000
const CLEANUP_THRESHOLD = MESSAGE_SYSTEM_CONFIG.indexedDBCleanupThreshold; // 120000

class SimpleIndexedDB {
  private db: IDBDatabase | null = null;
  private isInitialized = false;
  
  /**
   * Initialize the database
   */
  async init(): Promise<void> {
    if (this.isInitialized) return;
    
    return new Promise((resolve, reject) => {
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
        const transaction = (event.target as IDBOpenDBRequest).transaction!;
        
        console.log('[SimpleIndexedDB] Upgrading database from version', event.oldVersion, 'to', event.newVersion);
        
        // Delete old stores if they exist (migration from old structure)
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
          
          // Add indexes for efficient queries
          store.createIndex('timestamp', 'timestamp', { unique: false });
          store.createIndex('username', 'username', { unique: false });
          store.createIndex('color', 'color', { unique: false });
          store.createIndex('message-type', 'message-type', { unique: false });
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
   * Stores EXACTLY as received from KV - no transformation!
   */
  async saveMessage(message: Comment): Promise<void> {
    if (!this.isInit()) {
      throw new Error('[SimpleIndexedDB] Database not initialized');
    }
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      
      // Store message EXACTLY as-is - all fields preserved
      const request = store.put(message);
      
      request.onsuccess = () => {
        console.log('[SimpleIndexedDB] Message saved:', message.id);
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
      throw new Error('[SimpleIndexedDB] Database not initialized');
    }
    
    // Check if we need to cleanup
    const count = await this.getMessageCount();
    if (count > CLEANUP_THRESHOLD) {
      console.log(`[SimpleIndexedDB] Message count (${count}) exceeds threshold (${CLEANUP_THRESHOLD}), triggering cleanup`);
      await this.cleanup(MAX_MESSAGES);
    }
    
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
            console.log(`[SimpleIndexedDB] Bulk saved ${savedCount} messages`);
            resolve();
          }
        };
        
        request.onerror = () => {
          console.error('[SimpleIndexedDB] Failed to save message in bulk:', request.error);
          reject(request.error);
        };
      });
      
      // Handle empty array case
      if (messages.length === 0) {
        resolve();
      }
    });
  }
  
  /**
   * Get messages with pagination
   * Returns messages in exact KV format
   */
  async getMessages(limit = 200, offset = 0): Promise<Comment[]> {
    if (!this.isInit()) {
      throw new Error('[SimpleIndexedDB] Database not initialized');
    }
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const index = store.index('timestamp');
      
      const messages: Comment[] = [];
      let skipped = 0;
      
      // Open cursor to iterate through messages (newest first)
      const request = index.openCursor(null, 'prev');
      
      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result;
        
        if (cursor && messages.length < limit) {
          if (skipped < offset) {
            skipped++;
            cursor.continue();
          } else {
            // Return message exactly as stored - no transformation
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
      throw new Error('[SimpleIndexedDB] Database not initialized');
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
   * FIFO cleanup when over threshold
   * Keeps most recent `keepCount` messages
   */
  async cleanup(keepCount: number): Promise<void> {
    if (!this.isInit()) {
      throw new Error('[SimpleIndexedDB] Database not initialized');
    }
    
    const totalCount = await this.getMessageCount();
    
    if (totalCount <= keepCount) {
      console.log(`[SimpleIndexedDB] No cleanup needed (${totalCount} <= ${keepCount})`);
      return;
    }
    
    const deleteCount = totalCount - keepCount;
    console.log(`[SimpleIndexedDB] Cleaning up ${deleteCount} old messages (keeping ${keepCount} newest)`);
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const index = store.index('timestamp');
      
      let deletedCount = 0;
      
      // Open cursor to iterate through oldest messages first
      const request = index.openCursor(null, 'next');
      
      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result;
        
        if (cursor && deletedCount < deleteCount) {
          cursor.delete();
          deletedCount++;
          cursor.continue();
        } else {
          console.log(`[SimpleIndexedDB] Cleanup complete: deleted ${deletedCount} messages`);
          resolve();
        }
      };
      
      request.onerror = () => {
        console.error('[SimpleIndexedDB] Cleanup failed:', request.error);
        reject(request.error);
      };
    });
  }
  
  /**
   * Clear all messages
   */
  async clear(): Promise<void> {
    if (!this.isInit()) {
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
   * Debug helper
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
    
    console.log('Config:', {
      MAX_MESSAGES,
      CLEANUP_THRESHOLD
    });
    console.log('=======================');
  }
}

// Export singleton instance
export const simpleIndexedDB = new SimpleIndexedDB();

// Make available for debugging in browser console
if (typeof window !== 'undefined') {
  (window as any).simpleIndexedDB = simpleIndexedDB;
}
