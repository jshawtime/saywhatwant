import { useState, useEffect, useRef, useCallback } from 'react';
import type { QueueItem, QueueStats, WebSocketMessage } from '../lib/types';

const initialStats: QueueStats = {
  totalItems: 0,
  unclaimedItems: 0,
  claimedItems: 0,
  throughputHour: 0,
  avgWait: 0,
  lastSuccess: null,
  priorityBands: {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
    background: 0
  }
};

export function useWebSocket(url: string) {
  const [connected, setConnected] = useState(false);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [stats, setStats] = useState<QueueStats>(initialStats);
  const [logs, setLogs] = useState<string[]>([]);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();
  const MAX_LOGS = 100;  // Configurable: Keep last N log lines (shows ~20 message processing cycles)

  const handleMessage = useCallback((message: WebSocketMessage) => {
    console.log('[Dashboard] ===== RECEIVED MESSAGE =====');
    console.log('[Dashboard] Type:', message.type);
    console.log('[Dashboard] Data:', message.data);
    console.log('[Dashboard] =============================');
    
    switch (message.type) {
      case 'snapshot':
        const itemsCount = message.data.items?.length || 0;
        console.log('[Dashboard] 🔄 SNAPSHOT: Setting queue to', itemsCount, 'items');
        console.log('[Dashboard] Items:', message.data.items);
        setQueue(message.data.items ? [...message.data.items] : []);  // Force new array reference
        setStats(message.data.stats ? {...message.data.stats} : initialStats);  // Force new object
        console.log('[Dashboard] ✅ State updated');
        break;
        
      case 'queued':
        console.log('[Dashboard] 📥 QUEUED event for:', message.data.item?.id);
        setQueue(prev => {
          // Check if item already exists
          if (prev.some(item => item.id === message.data.item.id)) {
            console.log('[Dashboard] ⚠️ Item already in queue, skipping');
            return prev;
          }
          // Add and sort
          const newQueue = [...prev, message.data.item].sort((a, b) => a.priority - b.priority);
          console.log('[Dashboard] ✅ Added to queue, new length:', newQueue.length);
          return newQueue;
        });
        break;
        
      case 'claimed':
        setQueue(prev => prev.map(item => 
          item.id === message.data.itemId 
            ? { ...item, claimedBy: message.data.serverId }
            : item
        ));
        break;
        
      case 'completed':
        setQueue(prev => prev.filter(item => item.id !== message.data.itemId));
        break;
        
      case 'deleted':
        setQueue(prev => prev.filter(item => item.id !== message.data.itemId));
        break;
        
      case 'stats':
        console.log('[Dashboard] Updating stats:', message.data);
        setStats(message.data);
        break;
        
      case 'log':
        // Add log message (keep last MAX_LOGS)
        console.log('[Dashboard] Received log:', message.data.message);
        setLogs(prev => {
          const newLogs = [...prev, message.data.message];
          const trimmed = newLogs.slice(-MAX_LOGS);
          console.log('[Dashboard] Logs in state:', trimmed.length);
          return trimmed;
        });
        break;
    }
  }, []);

  const connect = useCallback(() => {
    try {
      const ws = new WebSocket(url);
      
      ws.onopen = () => {
        console.log('[WebSocket] Connected to bot');
        setConnected(true);
      };
      
      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data) as WebSocketMessage;
          handleMessage(message);
        } catch (error) {
          console.error('[WebSocket] Failed to parse message:', error);
        }
      };
      
      ws.onclose = () => {
        console.log('[WebSocket] Disconnected');
        setConnected(false);
        wsRef.current = null;
        
        // Auto-reconnect after 3 seconds
        reconnectTimeoutRef.current = setTimeout(() => {
          console.log('[WebSocket] Attempting reconnection...');
          connect();
        }, 3000);
      };
      
      ws.onerror = (error) => {
        console.error('[WebSocket] Error:', error);
      };
      
      wsRef.current = ws;
    } catch (error) {
      console.error('[WebSocket] Failed to connect:', error);
      setConnected(false);
    }
  }, [url, handleMessage]);

  useEffect(() => {
    connect();
    
    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [connect]);

  const sendCommand = useCallback((action: string, data?: any) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ action, ...data }));
    } else {
      console.warn('[WebSocket] Cannot send - not connected');
    }
  }, []);

  const deleteItem = useCallback((itemId: string) => {
    sendCommand('delete', { itemId });
  }, [sendCommand]);

  const clearQueue = useCallback(() => {
    console.log('[Dashboard] Sending clear command');
    sendCommand('clear');
  }, [sendCommand]);

  return {
    connected,
    queue,
    stats,
    logs,
    deleteItem,
    clearQueue
  };
}
