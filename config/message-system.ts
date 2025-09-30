/**
 * Message System Configuration
 * Centralized configuration for all message loading, storage, and display
 */

export interface MessageSystemConfig {
  // Cloud/KV Settings
  cloudInitialLoad: number;      // ALWAYS 0 - no catch-up from KV
  cloudPollingInterval: number;  // How often to poll for new messages (ms)
  cloudPollBatch: number;        // Max messages per poll
  
  // Display Settings  
  maxDisplayMessages: number;    // Max messages in DOM (memory protection)
  
  // Storage Settings
  maxIndexedDBMessages: number;  // Max messages in IndexedDB (disk protection)
  indexedDBCleanupThreshold: number; // When to trigger cleanup
  
  // Absence Detection
  absenceThreshold: number;      // Seconds before showing "missed messages" indicator
  
  // Lazy Loading
  lazyLoadChunkSize: number;     // Messages per lazy load
  scrollThreshold: number;       // Pixels from top to trigger lazy load
}

export const MESSAGE_SYSTEM_CONFIG: MessageSystemConfig = {
  // Cloud/KV Settings
  cloudInitialLoad: 50,         // Get last 50 messages to ensure some content
  cloudPollingInterval: 5000,   // Poll every 5 seconds
  cloudPollBatch: 200,           // Max n per poll
  
  // Display Settings
  maxDisplayMessages: 200,     // Show max n in DOM
  
  // Storage Settings
  maxIndexedDBMessages: 100000,  // Store max nk messages
  indexedDBCleanupThreshold: 12000, // Cleanup at nk
  
  // Absence Detection
  absenceThreshold: 60,         // n seconds away = show indicator
  
  // Lazy Loading
  lazyLoadChunkSize: 200,       // Load n at a time
  scrollThreshold: 100,         // 'n'px from top
};
