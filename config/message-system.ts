/**
 * Message System Configuration
 * Centralized configuration for all message loading, storage, and display
 */

export interface MessageSystemConfig {
  // Cloud/KV Settings
  cloudInitialLoad: number;      // ALWAYS 0 - no catch-up from KV
  cloudPollBatch: number;        // Max messages per poll
  
  // Simplified Polling (active/idle only)
  pollingIntervalActive: number;    // Active state interval (ms)
  pollingIntervalMin: number;       // Idle regressive start (ms)
  pollingIntervalMax: number;       // Maximum interval when inactive (ms)
  pollingIntervalIncrement: number; // Increase per poll (ms)
  activeWindow: number;             // Time window for active state (ms)
  
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
  cloudInitialLoad: 0,          // NO catch-up - pure presence-based system
  cloudPollBatch: 200,           // Max n per poll
  
  // Simplified Polling (active/idle only)
  pollingIntervalActive: 3000,   // 3s when active (user engaged)
  pollingIntervalMin: 5000,      // 5s idle start (regressive beginning)
  pollingIntervalMax: 1000000,   // Max 1000 seconds (~16.7 minutes) when inactive
  pollingIntervalIncrement: 5000, // Increase 5 seconds per poll (reaches max faster)
  activeWindow: 30000,           // 30s activity window
  
  // Display Settings
  maxDisplayMessages: 1000,     // Show max n in DOM
  
  // Storage Settings
  maxIndexedDBMessages: 100000,  // Store max nk messages
  indexedDBCleanupThreshold: 12000, // Cleanup at nk
  
  // Absence Detection
  absenceThreshold: 60,         // n seconds away = show indicator
  
  // Lazy Loading
  lazyLoadChunkSize: 200,       // Load n at a time
  scrollThreshold: 100,         // 'n'px from top
};
