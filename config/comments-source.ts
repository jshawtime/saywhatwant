/**
 * Comments Source Configuration
 * Toggle between localStorage and cloud API for comments
 */

export const COMMENTS_CONFIG = {
  // PRODUCTION MODE - Using Cloudflare KV
  useLocalStorage: false, // KEEP THIS FALSE - Production mode
  
  // Cloud API endpoint (uses environment variable or fallback)
  // Production: https://sww-comments.bootloaders.workers.dev/api/comments
  apiUrl: process.env.NEXT_PUBLIC_COMMENTS_API || 'https://sww-comments.bootloaders.workers.dev/api/comments',
  
  // Polling interval in milliseconds
  pollingInterval: 5000,
  
  // Maximum comments to store locally (when using localStorage)
  maxLocalComments: 1000,
  
  // Initial load count (PRESENCE-BASED: only from IndexedDB)
  initialLoadCount: 0,  // NO catch-up from KV
  
  // Lazy load batch size  
  lazyLoadBatch: 200,
  
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
