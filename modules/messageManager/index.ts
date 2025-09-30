/**
 * MessageManager - Centralized message management system
 * Handles all message loading, storage, filtering, and display logic
 */

import { MESSAGE_SYSTEM_CONFIG, type MessageSystemConfig } from '@/config/message-system';
import * as storage from '@/modules/storage';
import * as cloudAPI from '@/modules/cloudApiClient';
import type { Comment } from '@/types';
import type { Message } from '@/modules/storage';
import { FilterState } from '@/lib/url-filter-simple';

export interface MessageWithAbsence extends Comment {
  showAbsenceIndicator?: boolean;
  absenceDuration?: number;
}

export interface QueryOptions {
  users?: Array<{ username: string; color: string }>;
  words?: string[];
  negativeWords?: string[];
  from?: string | null;
  to?: string | null;
  timeFrom?: number | null;
  timeTo?: number | null;
  limit?: number;
  offset?: number;
}

class MessageManager {
  private config: MessageSystemConfig;
  private lastPollTimestamp: number;
  private storageKey = 'sww-last-poll-timestamp';
  
  constructor(config: MessageSystemConfig = MESSAGE_SYSTEM_CONFIG) {
    this.config = config;
    this.lastPollTimestamp = this.loadLastPollTimestamp();
  }
  
  // Load last poll timestamp from localStorage
  private loadLastPollTimestamp(): number {
    const stored = localStorage.getItem(this.storageKey);
    return stored ? parseInt(stored, 10) : Date.now();
  }
  
  // Save last poll timestamp to localStorage
  private saveLastPollTimestamp(timestamp: number): void {
    localStorage.setItem(this.storageKey, timestamp.toString());
    this.lastPollTimestamp = timestamp;
  }
  
  /**
   * Convert storage Message to Comment format
   */
  private messageToComment(msg: Message): Comment {
    // Convert old Message format to new Comment format
    // Message uses userColor, Comment uses color
    return {
      id: msg.id?.toString() || '',
      text: msg.text || '',
      timestamp: typeof msg.timestamp === 'string' ? parseInt(msg.timestamp, 10) : msg.timestamp,
      username: msg.username || '',
      color: msg.userColor || '',  // Message has userColor, Comment needs color
      domain: 'saywhatwant.app',  // Message doesn't have domain
      language: 'en',  // Message doesn't have language
      'message-type': 'human',  // Message doesn't have message-type
      misc: ''  // Message doesn't have misc
    };
  }
  
  /**
   * Convert Comment to storage Message format
   */
  private commentToMessage(comment: Comment): Message {
    return {
      id: comment.id,
      text: comment.text,
      timestamp: comment.timestamp.toString(),
      username: comment.username || '',
      userColor: comment.color || '',
      videoRef: undefined,
      matchedFilters: [],
      _store: 'permanent'
    };
  }
  
  /**
   * Single entry point for initial message load
   * ONLY loads from IndexedDB - no cloud catch-up (be present or miss out)
   */
  async loadInitialMessages(): Promise<MessageWithAbsence[]> {
    console.log('[MessageManager] Loading initial messages (IndexedDB only)...');
    
    // 1. Load all available from IndexedDB
    const localStorageMessages = await storage.getMessages({
      limit: this.config.maxIndexedDBMessages,
      offset: 0
    });
    
    // Convert to Comment format
    const localMessages = localStorageMessages.map(msg => this.messageToComment(msg));
    console.log(`[MessageManager] Loaded ${localMessages.length} messages from IndexedDB`);
    
    // 2. Check if user was away
    const timeSinceLastPoll = Date.now() - this.lastPollTimestamp;
    const wasAway = timeSinceLastPoll > (this.config.absenceThreshold * 1000);
    
    // 3. Trim to display limit
    let trimmed: MessageWithAbsence[] = localMessages.slice(-this.config.maxDisplayMessages);
    
    // 4. Add absence indicator if user was away
    if (wasAway && trimmed.length > 0) {
      trimmed[0] = {
        ...trimmed[0],
        showAbsenceIndicator: true,
        absenceDuration: timeSinceLastPoll
      };
      console.log(`[MessageManager] User was away for ${Math.floor(timeSinceLastPoll / 1000)} seconds`);
    }
    
    // 5. Update poll timestamp
    this.saveLastPollTimestamp(Date.now());
    
    return trimmed;
  }
  
  /**
   * Poll for new messages from cloud
   */
  async pollNewMessages(): Promise<MessageWithAbsence[]> {
    try {
      // Update poll timestamp
      this.saveLastPollTimestamp(Date.now());
      
      const response = await cloudAPI.fetchCommentsFromCloud(
        0,
        this.config.cloudPollBatch
      );
      
      // Get all new messages since our last poll
      const newMessages = response.comments || [];
      
      if (newMessages.length > 0) {
        // Store in IndexedDB
        const messagesToStore = newMessages.map(msg => this.commentToMessage(msg));
        await storage.bulkAddMessages(messagesToStore);
        
        console.log(`[MessageManager] Polled ${newMessages.length} new messages`);
      }
      
      return newMessages;
    } catch (error) {
      console.error('[MessageManager] Polling error:', error);
      return [];
    }
  }
  
  /**
   * Filter searches IndexedDB directly
   */
  async getFilteredMessages(filters: FilterState): Promise<MessageWithAbsence[]> {
    console.log('[MessageManager] Applying filters to IndexedDB...', filters);
    
    // Get all messages from IndexedDB (up to max)
    const allStorageMessages = await storage.getMessages({
      limit: this.config.maxIndexedDBMessages,
      offset: 0
    });
    
    // Convert to Comment format
    const allMessages = allStorageMessages.map(msg => this.messageToComment(msg));
    
    // Apply filters manually for now (future: IndexedDB query optimization)
    let filtered = allMessages;
    
    // Filter by users
    if (filters.users && filters.users.length > 0) {
      filtered = filtered.filter(msg => {
        if (!msg.username || !msg.color) return false;
        
        const normalizedUsername = msg.username.toLowerCase().replace(/[^a-z0-9]/g, '');
        
        return filters.users!.some(user => {
          const userNormalized = user.username.toLowerCase().replace(/[^a-z0-9]/g, '');
          // Convert colors to same format for comparison (9-digit)
          const msgColor = this.normalizeColor(msg.color!);
          const filterColor = this.normalizeColor(user.color);
          
          return userNormalized === normalizedUsername && msgColor === filterColor;
        });
      });
    }
    
    // Filter by words
    if (filters.words && filters.words.length > 0) {
      filtered = filtered.filter(msg => {
        const text = msg.text?.toLowerCase() || '';
        return filters.words!.some(word => text.includes(word.toLowerCase()));
      });
    }
    
    // Filter by negative words
    if (filters.negativeWords && filters.negativeWords.length > 0) {
      filtered = filtered.filter(msg => {
        const text = msg.text?.toLowerCase() || '';
        return !filters.negativeWords!.some(word => text.includes(word.toLowerCase()));
      });
    }
    
    // Trim to display limit (no gap detection needed for filtered messages)
    return filtered.slice(-this.config.maxDisplayMessages);
  }
  
  /**
   * Merge messages and deduplicate by ID
   */
  mergeMessages(local: Comment[], cloud: Comment[]): Comment[] {
    const messageMap = new Map<string, Comment>();
    
    // Add local messages first
    local.forEach(msg => {
      if (msg.id) {
        messageMap.set(msg.id, msg);
      }
    });
    
    // Add/update with cloud messages
    cloud.forEach(msg => {
      if (msg.id) {
        messageMap.set(msg.id, msg);
      }
    });
    
    // Convert back to array and sort by timestamp
    return Array.from(messageMap.values()).sort((a, b) => a.timestamp - b.timestamp);
  }
  
  /**
   * Merge new messages with existing and trim to limit
   */
  mergeAndTrim(existing: MessageWithAbsence[], newMessages: MessageWithAbsence[]): MessageWithAbsence[] {
    const merged = this.mergeMessages(existing, newMessages);
    return merged.slice(-this.config.maxDisplayMessages);
  }
  
  /**
   * Clean up old messages from IndexedDB
   */
  async cleanupStorage(): Promise<void> {
    const count = await storage.getMessageCount();
    console.log(`[MessageManager] Storage check: ${count} messages in IndexedDB`);
    
    if (count > this.config.indexedDBCleanupThreshold) {
      const toDelete = count - this.config.maxIndexedDBMessages;
      console.log(`[MessageManager] Cleaning up ${toDelete} oldest messages...`);
      
      // Get oldest messages
      const oldestStorageMessages = await storage.getMessages({
        limit: toDelete,
        offset: 0
      });
      
      // Delete them
      for (const msg of oldestStorageMessages) {
        if (msg.id) {
          await storage.deleteMessage(msg.id);
        }
      }
      
      console.log(`[MessageManager] Cleanup complete`);
    }
  }
  
  /**
   * Normalize color to 9-digit format for comparison
   */
  private normalizeColor(color: string): string {
    // If already 9-digit, return as-is
    if (/^\d{9}$/.test(color)) return color;
    
    // Convert RGB to 9-digit
    if (color.startsWith('rgb(')) {
      const parts = color.match(/\d+/g);
      if (parts && parts.length === 3) {
        return parts.map(p => p.padStart(3, '0')).join('');
      }
    }
    
    // Default
    return '096165250';
  }
  
  /**
   * Get current configuration
   */
  getConfig(): MessageSystemConfig {
    return this.config;
  }
  
  /**
   * Update configuration
   */
  updateConfig(updates: Partial<MessageSystemConfig>): void {
    this.config = { ...this.config, ...updates };
  }
}

// Export singleton instance
export const messageManager = new MessageManager();

// Export class for testing
export { MessageManager };
