import { useEffect } from 'react';

const CURRENT_VERSION = process.env.NEXT_PUBLIC_APP_VERSION || '1.0.0';

/**
 * useVersionCheck Hook
 * 
 * Silently checks version from API responses and force-reloads if mismatch detected.
 * No notification, no user interaction - just immediate silent reload.
 * 
 * Piggybacks on existing message polling (no additional requests).
 * Prevents reload loops by tracking last reload version in localStorage.
 * 
 * @param serverVersion - Version string from API response
 */
export function useVersionCheck(serverVersion: string | undefined) {
  useEffect(() => {
    if (!serverVersion) return;
    
    // Check version mismatch
    if (serverVersion !== CURRENT_VERSION) {
      console.log(`[Version] Mismatch detected - current: ${CURRENT_VERSION}, server: ${serverVersion}`);
      
      // Prevent reload loop - check if we already reloaded for this version
      const lastReloadVersion = localStorage.getItem('last_reload_version');
      const lastReloadTime = localStorage.getItem('last_reload_time');
      const now = Date.now();
      
      // If we reloaded in the last 60 seconds for this version, skip
      if (lastReloadVersion === serverVersion && lastReloadTime) {
        const elapsed = now - parseInt(lastReloadTime);
        if (elapsed < 60000) {
          console.log('[Version] Already reloaded for this version', elapsed, 'ms ago, skipping');
          return;
        }
      }
      
      console.log('[Version] Force reloading page in 1 second...');
      
      // Store reload info BEFORE reload
      localStorage.setItem('last_reload_version', serverVersion);
      localStorage.setItem('last_reload_time', now.toString());
      
      // Silent force reload (no notification)
      setTimeout(() => {
        window.location.reload();
      }, 1000); // 1 second grace period for logging
    }
  }, [serverVersion]);
}

