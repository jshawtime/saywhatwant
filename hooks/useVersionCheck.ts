import { useEffect, useRef } from 'react';

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
 * IMPORTANT: Skips reload when intro video is playing to avoid interrupting video playback.
 * The version check will occur naturally after the user interacts or on next session.
 * 
 * @param serverVersion - Version string from API response
 */
export function useVersionCheck(serverVersion: string | undefined) {
  const hasCheckedRef = useRef(false);
  
  useEffect(() => {
    if (!serverVersion) return;
    
    // Skip if we've already done a check this session
    // This prevents multiple reload attempts
    if (hasCheckedRef.current) return;
    
    // Check version mismatch
    if (serverVersion !== CURRENT_VERSION) {
      console.log(`[Version] Mismatch detected - current: ${CURRENT_VERSION}, server: ${serverVersion}`);
      
      // IMPORTANT: Skip version reload if intro video is present in URL
      // This prevents the video from restarting mid-playback
      const hash = window.location.hash;
      if (hash.includes('intro-video=true')) {
        console.log('[Version] Intro video detected in URL - skipping reload to avoid interrupting video');
        hasCheckedRef.current = true;
        return;
      }
      
      // Prevent reload loop - check if we already reloaded for this version
      const lastReloadVersion = localStorage.getItem('last_reload_version');
      const lastReloadTime = localStorage.getItem('last_reload_time');
      const now = Date.now();
      
      // If we reloaded in the last 60 seconds for this version, skip
      if (lastReloadVersion === serverVersion && lastReloadTime) {
        const elapsed = now - parseInt(lastReloadTime);
        if (elapsed < 60000) {
          console.log('[Version] Already reloaded for this version', elapsed, 'ms ago, skipping');
          hasCheckedRef.current = true;
          return;
        }
      }
      
      console.log('[Version] Force reloading page in 1 second...');
      hasCheckedRef.current = true;
      
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

