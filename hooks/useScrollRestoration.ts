/**
 * useScrollRestoration Hook
 * 
 * Manages scroll position saving and restoration for filters and search
 * Ensures user doesn't lose their place when toggling filters or searching
 */

import { useState, useEffect, useRef } from 'react';

interface UseScrollRestorationParams {
  streamRef: React.RefObject<HTMLDivElement>;
  isFilterEnabled: boolean;
  searchTerm: string;
  savedHumansScrollPosition: number | null;
  savedEntitiesScrollPosition: number | null;
  setSavedHumansScrollPosition: (pos: number | null) => void;
  setSavedEntitiesScrollPosition: (pos: number | null) => void;
  showHumans: boolean;
  showEntities: boolean;
  filteredCommentsLength: number;
}

export function useScrollRestoration(params: UseScrollRestorationParams): void {
  const {
    streamRef,
    isFilterEnabled,
    searchTerm,
    savedHumansScrollPosition,
    savedEntitiesScrollPosition,
    setSavedHumansScrollPosition,
    setSavedEntitiesScrollPosition,
    showHumans,
    showEntities,
    filteredCommentsLength,
  } = params;
  
  // Search scroll position memory
  const [savedSearchScrollPosition, setSavedSearchScrollPosition] = useState<number | null>(null);
  
  // Filter toggle scroll restoration
  const prevFilterEnabled = useRef(isFilterEnabled);
  const scrollBeforeFilterToggle = useRef<number | null>(null);
  
  // Save scroll position BEFORE filter state changes
  useEffect(() => {
    if (streamRef.current && prevFilterEnabled.current !== isFilterEnabled) {
      scrollBeforeFilterToggle.current = streamRef.current.scrollTop;
      console.log('[Scroll] Pre-save scroll position:', scrollBeforeFilterToggle.current);
    }
  }, [isFilterEnabled, streamRef]);
  
  // Restore scroll position AFTER filter state changes and content updates
  useEffect(() => {
    if (!streamRef.current) return;
    
    if (prevFilterEnabled.current !== isFilterEnabled) {
      const savedPos = scrollBeforeFilterToggle.current;
      
      if (!isFilterEnabled && savedPos !== null) {
        // Filters just turned OFF - restore position
        const restoreScroll = () => {
          if (streamRef.current && streamRef.current.scrollHeight > 0) {
            const targetScroll = Math.min(savedPos, streamRef.current.scrollHeight - streamRef.current.clientHeight);
            streamRef.current.scrollTop = targetScroll;
            console.log('[Scroll] Restored scroll after filter OFF:', targetScroll, 'from saved:', savedPos);
            
            // Double-check it worked
            setTimeout(() => {
              if (streamRef.current && Math.abs(streamRef.current.scrollTop - targetScroll) > 10) {
                console.log('[Scroll] Re-applying scroll restoration, current:', streamRef.current.scrollTop, 'target:', targetScroll);
                streamRef.current.scrollTop = targetScroll;
              }
            }, 50);
          }
        };
        
        requestAnimationFrame(() => {
          requestAnimationFrame(restoreScroll);
        });
      } else if (isFilterEnabled && savedPos !== null) {
        // Filters just turned ON - also restore to maintain position
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            if (streamRef.current && streamRef.current.scrollHeight > 0) {
              const targetScroll = Math.min(savedPos, streamRef.current.scrollHeight - streamRef.current.clientHeight);
              streamRef.current.scrollTop = targetScroll;
              console.log('[Scroll] Restored scroll after filter ON:', targetScroll);
            }
          });
        });
      }
      
      prevFilterEnabled.current = isFilterEnabled;
      scrollBeforeFilterToggle.current = null;
    }
  }, [isFilterEnabled, filteredCommentsLength, streamRef]);
  
  // Search scroll restoration
  useEffect(() => {
    if (!streamRef.current) return;
    
    if (searchTerm && !savedSearchScrollPosition) {
      // Search just started - save current scroll position
      setSavedSearchScrollPosition(streamRef.current.scrollTop);
      console.log('[Scroll] Saved scroll position before search:', streamRef.current.scrollTop);
    } else if (!searchTerm && savedSearchScrollPosition !== null) {
      // Search just cleared - restore saved scroll position
      requestAnimationFrame(() => {
        if (streamRef.current) {
          streamRef.current.scrollTop = savedSearchScrollPosition;
          console.log('[Scroll] Restored scroll position after search cleared:', savedSearchScrollPosition);
          setSavedSearchScrollPosition(null);
        }
      });
    }
  }, [searchTerm, savedSearchScrollPosition, streamRef]);
  
  // Humans filter scroll restoration
  useEffect(() => {
    if (!streamRef.current) return;
    
    if (showHumans && savedHumansScrollPosition !== null) {
      requestAnimationFrame(() => {
        if (streamRef.current) {
          streamRef.current.scrollTop = savedHumansScrollPosition;
          console.log('[Scroll] Restored scroll position after showing humans:', savedHumansScrollPosition);
          setSavedHumansScrollPosition(null);
        }
      });
    }
  }, [showHumans, savedHumansScrollPosition, setSavedHumansScrollPosition, streamRef]);
  
  // Entities filter scroll restoration
  useEffect(() => {
    if (!streamRef.current) return;
    
    if (showEntities && savedEntitiesScrollPosition !== null) {
      requestAnimationFrame(() => {
        if (streamRef.current) {
          streamRef.current.scrollTop = savedEntitiesScrollPosition;
          console.log('[Scroll] Restored scroll position after showing entities:', savedEntitiesScrollPosition);
          setSavedEntitiesScrollPosition(null);
        }
      });
    }
  }, [showEntities, savedEntitiesScrollPosition, setSavedEntitiesScrollPosition, streamRef]);
}

