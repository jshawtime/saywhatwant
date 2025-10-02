/**
 * useMessageCounts Hook
 * 
 * Fetches and manages global KV count and local IndexedDB count
 * Polls /api/stats every 5 minutes for global total
 */

import { useState, useEffect } from 'react';
import { simpleIndexedDB } from '@/modules/simpleIndexedDB';

interface UseMessageCountsReturn {
  globalCount: number;   // Total messages in KV (platform-wide)
  localCount: number;    // Total messages in user's IndexedDB
}

export function useMessageCounts(): UseMessageCountsReturn {
  const [globalCount, setGlobalCount] = useState(0);
  const [localCount, setLocalCount] = useState(0);
  
  // Fetch global count from /api/stats every 5 minutes
  useEffect(() => {
    const fetchGlobalCount = async () => {
      try {
        const baseUrl = process.env.NEXT_PUBLIC_COMMENTS_API_URL || 'https://sww-comments.bootloaders.workers.dev';
        const response = await fetch(`${baseUrl}/api/stats`);
        if (response.ok) {
          const data = await response.json();
          setGlobalCount(data.totalMessages || 0);
        }
      } catch (error) {
        console.error('[MessageCounts] Failed to fetch global count:', error);
      }
    };
    
    // Fetch immediately
    fetchGlobalCount();
    
    // Then every 5 minutes
    const interval = setInterval(fetchGlobalCount, 5 * 60 * 1000);
    
    return () => clearInterval(interval);
  }, []);
  
  // Fetch local count from IndexedDB when it's initialized
  useEffect(() => {
    const fetchLocalCount = async () => {
      try {
        if (simpleIndexedDB.isInit()) {
          const count = await simpleIndexedDB.getMessageCount();
          setLocalCount(count);
        }
      } catch (error) {
        console.error('[MessageCounts] Failed to fetch local count:', error);
      }
    };
    
    // Check every 30 seconds (more frequent than global)
    fetchLocalCount();
    const interval = setInterval(fetchLocalCount, 30 * 1000);
    
    return () => clearInterval(interval);
  }, []);
  
  return {
    globalCount,
    localCount
  };
}

