/**
 * Hook to sync localStorage comments with IndexedDB
 * This ensures all comments get saved to IndexedDB for filter memory processing
 */

import { useEffect, useRef } from 'react';
import { initializeIndexedDBSystem } from '@/modules/storage/init';
import { getStorage } from '@/modules/storage';
import { Message } from '@/modules/storage/interface';

interface Comment {
  id: string;
  timestamp: number;
  username?: string;
  text: string;
  userColor?: string;
  videoRef?: string;
}

export function useIndexedDBSync(comments: Comment[]) {
  const lastSyncedCount = useRef(0);
  const initialized = useRef(false);
  
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const syncToIndexedDB = async () => {
      try {
        // Initialize IndexedDB if not already done
        if (!initialized.current) {
          await initializeIndexedDBSystem();
          initialized.current = true;
        }
        
        // Skip if no new comments
        if (comments.length === lastSyncedCount.current) {
          return;
        }
        
        // Get storage instance
        const storage = getStorage();
        
        // Get new comments (ones we haven't synced yet)
        const newComments = comments.slice(lastSyncedCount.current);
        
        if (newComments.length > 0) {
          // Transform comments to Message format
          const messages: Message[] = newComments.map(comment => ({
            id: comment.id,  // CRITICAL: Include the ID to prevent duplicates!
            timestamp: new Date(comment.timestamp).toISOString(),
            username: comment.username || 'anonymous',
            text: comment.text || '',
            userColor: comment.userColor || '#00ff00',
            videoRef: comment.videoRef
          }));
          
          // Save to IndexedDB (will check filters and save to appropriate store)
          await storage.saveMessages(messages);
          
          console.log(`[IndexedDBSync] Synced ${newComments.length} messages to IndexedDB`);
          
          // Update synced count
          lastSyncedCount.current = comments.length;
        }
      } catch (error) {
        console.error('[IndexedDBSync] Failed to sync comments:', error);
      }
    };
    
    // Run sync
    syncToIndexedDB();
  }, [comments]);
  
  // Also sync when we first get comments from localStorage
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (comments.length === 0) return;
    
    const initialSync = async () => {
      try {
        // Initialize if needed
        if (!initialized.current) {
          await initializeIndexedDBSystem();
          initialized.current = true;
        }
        
        const storage = getStorage();
        
        // Check if we need to do initial import
        const messageCount = await storage.getMessageCount();
        
        if (messageCount === 0 && comments.length > 0) {
          console.log(`[IndexedDBSync] Initial import of ${comments.length} messages from localStorage`);
          
          // Import all comments
          const messages: Message[] = comments.map(comment => ({
            id: comment.id,  // CRITICAL: Include the ID to prevent duplicates!
            timestamp: new Date(comment.timestamp).toISOString(),
            username: comment.username || 'anonymous',
            text: comment.text || '',
            userColor: comment.userColor || '#00ff00',
            videoRef: comment.videoRef
          }));
          
          await storage.saveMessages(messages);
          lastSyncedCount.current = comments.length;
          
          console.log('[IndexedDBSync] Initial import complete');
        }
      } catch (error) {
        console.error('[IndexedDBSync] Failed initial sync:', error);
      }
    };
    
    // Small delay to ensure IndexedDB is ready
    const timer = setTimeout(initialSync, 1000);
    
    return () => clearTimeout(timer);
  }, []); // Only run once on mount
}
