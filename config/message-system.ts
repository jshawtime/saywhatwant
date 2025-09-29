/**
 * Message System Configuration
 * Centralized configuration for all message loading, storage, and display
 */

export interface MessageSystemConfig {
  // Cloud/KV Settings
  cloudInitialLoad: number;      // How many to fetch from KV on startup
  cloudPollingInterval: number;  // How often to poll for new messages (ms)
  cloudPollBatch: number;        // Max messages per poll
  
  // Display Settings  
  maxDisplayMessages: number;    // Max messages in DOM (memory protection)
  
  // Storage Settings
  maxIndexedDBMessages: number;  // Max messages in IndexedDB (disk protection)
  indexedDBCleanupThreshold: number; // When to trigger cleanup
  
  // Gap Detection
  messageGapThreshold: number;   // Seconds before showing "gap" indicator
  
  // Lazy Loading
  lazyLoadChunkSize: number;     // Messages per lazy load
  scrollThreshold: number;       // Pixels from top to trigger lazy load
}

export const MESSAGE_SYSTEM_CONFIG: MessageSystemConfig = {
  // Cloud/KV Settings
  cloudInitialLoad: 100,        // Fetch last 100 from KV on startup
  cloudPollingInterval: 5000,   // Poll every 5 seconds
  cloudPollBatch: 50,           // Max 50 per poll
  
  // Display Settings
  maxDisplayMessages: 2000,     // Show max 2000 in DOM
  
  // Storage Settings
  maxIndexedDBMessages: 10000,  // Store max 10k messages
  indexedDBCleanupThreshold: 12000, // Cleanup at 12k
  
  // Gap Detection
  messageGapThreshold: 300,     // 5 minutes = gap
  
  // Lazy Loading
  lazyLoadChunkSize: 200,       // Load 200 at a time
  scrollThreshold: 100,         // 100px from top
};
