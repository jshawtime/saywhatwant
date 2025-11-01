/**
 * Version Check - Auto-reload when new build is deployed
 * This script checks for new builds and prompts user to reload
 */

(function() {
  'use strict';
  
  // Check for new version every 5 minutes
  const CHECK_INTERVAL = 5 * 60 * 1000;
  
  // Store current build time from the page
  let currentBuildTime = null;
  
  // Extract build time from environment or DOM
  function getCurrentBuildTime() {
    // Try to get from meta tag (we'll add this)
    const metaTag = document.querySelector('meta[name="build-time"]');
    if (metaTag) {
      return metaTag.getAttribute('content');
    }
    
    // Fallback: extract from DOM if visible
    const buildElements = document.querySelectorAll('[class*="build"], [id*="build"]');
    for (const el of buildElements) {
      const text = el.textContent;
      const match = text.match(/Build:\s*(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z)/);
      if (match) {
        return match[1];
      }
    }
    
    return null;
  }
  
  // Check if a new version is available
  async function checkForNewVersion() {
    try {
      // Fetch index.html with cache-busting
      const response = await fetch(`/?_=${Date.now()}`, {
        cache: 'no-cache',
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });
      
      if (!response.ok) return;
      
      const html = await response.text();
      
      // Extract build time from fetched HTML
      const match = html.match(/Build:\s*(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z)/);
      if (!match) return;
      
      const latestBuildTime = match[1];
      
      // First check - store current version
      if (!currentBuildTime) {
        currentBuildTime = latestBuildTime;
        console.log('[Version Check] Current build:', currentBuildTime);
        return;
      }
      
      // Compare versions
      if (latestBuildTime !== currentBuildTime) {
        console.log('[Version Check] New build detected!');
        console.log('  Current:', currentBuildTime);
        console.log('  Latest:', latestBuildTime);
        
        // Show update notification
        showUpdateNotification(latestBuildTime);
      }
    } catch (error) {
      console.error('[Version Check] Error:', error);
    }
  }
  
  // Show update notification
  function showUpdateNotification(newVersion) {
    // Create notification element
    const notification = document.createElement('div');
    notification.id = 'version-update-notification';
    notification.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      background: rgba(0, 255, 0, 0.1);
      border: 2px solid #00ff00;
      color: #00ff00;
      padding: 15px 20px;
      border-radius: 8px;
      font-family: monospace;
      font-size: 13px;
      z-index: 10000;
      box-shadow: 0 4px 12px rgba(0, 255, 0, 0.3);
      max-width: 300px;
    `;
    
    notification.innerHTML = `
      <div style="margin-bottom: 10px;">
        <strong>🎉 New Update Available!</strong>
      </div>
      <div style="margin-bottom: 10px; font-size: 11px; opacity: 0.8;">
        Build: ${newVersion}
      </div>
      <div style="display: flex; gap: 10px;">
        <button id="reload-now" style="
          background: #00ff00;
          color: #000;
          border: none;
          padding: 5px 15px;
          border-radius: 4px;
          cursor: pointer;
          font-family: monospace;
          font-weight: bold;
        ">Reload Now</button>
        <button id="reload-later" style="
          background: transparent;
          color: #00ff00;
          border: 1px solid #00ff00;
          padding: 5px 15px;
          border-radius: 4px;
          cursor: pointer;
          font-family: monospace;
        ">Later</button>
      </div>
    `;
    
    document.body.appendChild(notification);
    
    // Handle reload button
    document.getElementById('reload-now').addEventListener('click', () => {
      window.location.reload(true);
    });
    
    // Handle dismiss button
    document.getElementById('reload-later').addEventListener('click', () => {
      notification.remove();
    });
  }
  
  // Initialize
  function init() {
    // Get initial build time
    currentBuildTime = getCurrentBuildTime();
    
    if (!currentBuildTime) {
      console.warn('[Version Check] Could not determine current build time');
    } else {
      console.log('[Version Check] Initialized with build:', currentBuildTime);
    }
    
    // Start periodic checks
    setInterval(checkForNewVersion, CHECK_INTERVAL);
    
    // Check immediately after 30 seconds (to catch quick updates)
    setTimeout(checkForNewVersion, 30000);
  }
  
  // Start when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

