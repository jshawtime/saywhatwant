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

export interface MessageWithGap extends Comment {
  hasGapBefore?: boolean;
  gapDuration?: number;
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
  private lastSeenTimestamp: number;
  private storageKey = 'sww-last-seen-timestamp';
  
  constructor(config: MessageSystemConfig = MESSAGE_SYSTEM_CONFIG) {
    this.config = config;
    this.lastSeenTimestamp = this.loadLastSeenTimestamp();
  }
  
  // Load last seen timestamp from localStorage
  private loadLastSeenTimestamp(): number {
    const stored = localStorage.getItem(this.storageKey);
    return stored ? parseInt(stored, 10) : Date.now();
  }
  
  // Save last seen timestamp to localStorage
  private saveLastSeenTimestamp(timestamp: number): void {
    localStorage.setItem(this.storageKey, timestamp.toString());
    this.lastSeenTimestamp = timestamp;
  }
  
  /**
   * Convert storage Message to Comment format
   */
  private messageToComment(msg: Message): Comment {
    return {
      id: msg.id?.toString() || '',
      text: msg.text || '',
      timestamp: typeof msg.timestamp === 'string' ? parseInt(msg.timestamp, 10) : msg.timestamp,
      username: msg.username,
      color: msg.userColor,  // Map userColor to color
      domain: 'saywhatwant.app',
      language: 'en',
      'message-type': 'human'
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
   * Loads from IndexedDB first, then catches up from cloud
   */
  async loadInitialMessages(): Promise<MessageWithGap[]> {
    console.log('[MessageManager] Loading initial messages...');
    
    // 1. Load all available from IndexedDB
    const localStorageMessages = await storage.getMessages({
      limit: this.config.maxIndexedDBMessages,
      offset: 0
    });
    
    // Convert to Comment format
    const localMessages = localStorageMessages.map(msg => this.messageToComment(msg));
    console.log(`[MessageManager] Loaded ${localMessages.length} messages from IndexedDB`);
    
    // 2. Get the timestamp of the most recent local message
    const mostRecentLocal = localMessages.length > 0 
      ? Math.max(...localMessages.map(m => m.timestamp))
      : 0;
    
    // 3. Fetch latest from cloud to catch up
    try {
      const cloudMessages = await cloudAPI.fetchCommentsFromCloud(
        0, 
        this.config.cloudInitialLoad
      );
      console.log(`[MessageManager] Fetched ${cloudMessages.comments?.length || 0} messages from cloud`);
      
      // 4. Merge and deduplicate
      const merged = this.mergeMessages(localMessages, cloudMessages.comments || []);
      
      // 5. Store new messages in IndexedDB
      const newMessages = cloudMessages.comments?.filter(
        msg => msg.timestamp > mostRecentLocal
      ) || [];
      
      if (newMessages.length > 0) {
        const messagesToStore = newMessages.map(msg => this.commentToMessage(msg));
        await storage.bulkAddMessages(messagesToStore);
        console.log(`[MessageManager] Stored ${newMessages.length} new messages in IndexedDB`);
      }
      
      // 6. Detect gaps and trim to display limit
      const withGaps = this.detectMessageGaps(merged);
      const trimmed = withGaps.slice(-this.config.maxDisplayMessages);
      
      // 7. Update last seen timestamp
      if (trimmed.length > 0) {
        this.saveLastSeenTimestamp(trimmed[trimmed.length - 1].timestamp);
      }
      
      return trimmed;
    } catch (error) {
      console.error('[MessageManager] Error fetching from cloud:', error);
      // Fall back to just local messages
      const withGaps = this.detectMessageGaps(localMessages);
      return withGaps.slice(-this.config.maxDisplayMessages);
    }
  }
  
  /**
   * Poll for new messages from cloud
   */
  async pollNewMessages(): Promise<MessageWithGap[]> {
    try {
      const response = await cloudAPI.fetchCommentsFromCloud(
        0,
        this.config.cloudPollBatch
      );
      
      const newMessages = response.comments?.filter(
        msg => msg.timestamp > this.lastSeenTimestamp
      ) || [];
      
      if (newMessages.length > 0) {
        // Store in IndexedDB
        const messagesToStore = newMessages.map(msg => this.commentToMessage(msg));
        await storage.bulkAddMessages(messagesToStore);
        
        // Update last seen
        const newest = Math.max(...newMessages.map(m => m.timestamp));
        this.saveLastSeenTimestamp(newest);
        
        console.log(`[MessageManager] Polled ${newMessages.length} new messages`);
      }
      
      return this.detectMessageGaps(newMessages);
    } catch (error) {
      console.error('[MessageManager] Polling error:', error);
      return [];
    }
  }
  
  /**
   * Filter searches IndexedDB directly
   */
  async getFilteredMessages(filters: FilterState): Promise<MessageWithGap[]> {
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
    
    // Add gap detection
    const withGaps = this.detectMessageGaps(filtered);
    
    // Trim to display limit
    return withGaps.slice(-this.config.maxDisplayMessages);
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
  mergeAndTrim(existing: MessageWithGap[], newMessages: MessageWithGap[]): MessageWithGap[] {
    const merged = this.mergeMessages(existing, newMessages);
    const withGaps = this.detectMessageGaps(merged);
    return withGaps.slice(-this.config.maxDisplayMessages);
  }
  
  /**
   * Detect and mark gaps in messages
   */
  detectMessageGaps(messages: Comment[]): MessageWithGap[] {
    if (messages.length === 0) return [];
    
    const sorted = [...messages].sort((a, b) => a.timestamp - b.timestamp);
    const threshold = this.config.messageGapThreshold * 1000; // Convert to ms
    
    return sorted.map((msg, idx): MessageWithGap => {
      if (idx === 0) {
        // Check gap from last seen timestamp
        const gapFromLastSeen = msg.timestamp - this.lastSeenTimestamp;
        if (gapFromLastSeen > threshold) {
          return {
            ...msg,
            hasGapBefore: true,
            gapDuration: gapFromLastSeen
          };
        }
        return msg;
      }
      
      const prevMsg = sorted[idx - 1];
      const gap = msg.timestamp - prevMsg.timestamp;
      
      if (gap > threshold) {
        return {
          ...msg,
          hasGapBefore: true,
          gapDuration: gap
        };
      }
      
      return msg;
    });
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
