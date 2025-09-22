/**
 * Comments Source Configuration
 * Toggle between localStorage and cloud API for comments
 */

export const COMMENTS_CONFIG = {
  // Set to true for local development, false for cloud API
  useLocalStorage: true, // Set to true for local development with IndexedDB
  
  // Cloud API endpoint (uses environment variable or fallback)
  // Production: https://sww-comments.bootloaders.workers.dev/api/comments
  apiUrl: process.env.NEXT_PUBLIC_COMMENTS_API || 'https://sww-comments.bootloaders.workers.dev/api/comments',
  
  // Polling interval in milliseconds
  pollingInterval: 5000,
  
  // Maximum comments to store locally (when using localStorage)
  maxLocalComments: 1000,
  
  // Initial load count
  initialLoadCount: 500,
  
  // Lazy load batch size
  lazyLoadBatch: 50,
  
  // Enable console logging for debugging
  debugMode: false,
};

export const getCommentsConfig = () => {
  if (COMMENTS_CONFIG.debugMode) {
    console.log('[Comments Config]', {
      mode: COMMENTS_CONFIG.useLocalStorage ? 'localStorage' : 'cloud API',
      apiUrl: COMMENTS_CONFIG.useLocalStorage ? 'N/A' : COMMENTS_CONFIG.apiUrl,
      pollingInterval: COMMENTS_CONFIG.pollingInterval,
    });
  }
  return COMMENTS_CONFIG;
};
