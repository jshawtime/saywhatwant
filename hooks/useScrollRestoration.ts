/**
 * useScrollRestoration Hook
 * 
 * Manages scroll position saving and restoration for filters and search
 * Ensures user doesn't lose their place when toggling filters or searching
 * 
 * **Smart Behavior**: If user was "anchored to bottom" (viewing newest messages),
 * keeps them at bottom after filter toggle. Otherwise restores pixel position.
 */

import { useState, useEffect, useRef } from 'react';
import { saveScrollState, restoreScrollState, ScrollState } from '@/utils/scrollBehaviors';

interface UseScrollRestorationParams {
  streamRef: React.RefObject<HTMLDivElement>;
  isFilterEnabled: boolean;
  searchTerm: string;
  savedHumansScrollPosition: number | null;
  savedEntitiesScrollPosition: number | null;
  setSavedHumansScrollPosition: (pos: number | null) => void;
  setSavedEntitiesScrollPosition: (pos: number | null) => void;
  activeChannel: 'human' | 'AI';  // NEW: Use exclusive channel
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
    activeChannel,
    filteredCommentsLength,
  } = params;
  
  // Search scroll position memory
  const [savedSearchScrollPosition, setSavedSearchScrollPosition] = useState<number | null>(null);
  
  // Filter toggle scroll restoration (with smart "anchored to bottom" tracking)
  const prevFilterEnabled = useRef(isFilterEnabled);
  const scrollBeforeFilterToggle = useRef<ScrollState | null>(null);
  
  // Save scroll STATE (position + anchor status) BEFORE filter state changes
  useEffect(() => {
    if (streamRef.current && prevFilterEnabled.current !== isFilterEnabled) {
      scrollBeforeFilterToggle.current = saveScrollState(streamRef.current, 100);
      console.log('[Scroll] Pre-save scroll state:', scrollBeforeFilterToggle.current);
    }
  }, [isFilterEnabled, streamRef]);
  
  // Restore scroll STATE (smart: keeps at bottom if was anchored) AFTER filter state changes
  useEffect(() => {
    if (!streamRef.current) return;
    
    if (prevFilterEnabled.current !== isFilterEnabled) {
      const savedState = scrollBeforeFilterToggle.current;
      
      if (savedState) {
        const restoreScroll = () => {
          if (streamRef.current && streamRef.current.scrollHeight > 0) {
            // Smart restoration: if was at bottom, stay at bottom
            restoreScrollState(streamRef.current, savedState);
            
            // Double-check it worked
            setTimeout(() => {
              if (streamRef.current && savedState.wasAtBottom) {
                // Ensure still at bottom after content settles
                const { scrollHeight, scrollTop, clientHeight } = streamRef.current;
                const atBottom = (scrollHeight - (scrollTop + clientHeight)) < 100;
                
                if (!atBottom) {
                  console.log('[Scroll] Re-anchoring to bottom after filter toggle');
                  streamRef.current.scrollTop = streamRef.current.scrollHeight;
                }
              }
            }, 50);
          }
        };
        
        requestAnimationFrame(() => {
          requestAnimationFrame(restoreScroll);
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
  
  // Channel switch scroll restoration (when switching human ⟷ AI)
  const prevChannel = useRef(activeChannel);
  const scrollBeforeChannelSwitch = useRef<ScrollState | null>(null);
  
  // SAVE scroll state BEFORE channel changes
  useEffect(() => {
    if (streamRef.current && prevChannel.current !== activeChannel) {
      scrollBeforeChannelSwitch.current = saveScrollState(streamRef.current, 100);
      console.log(`[Scroll] Saved scroll state before switching from ${prevChannel.current} to ${activeChannel}:`, scrollBeforeChannelSwitch.current);
    }
  }, [activeChannel, streamRef]);
  
  // RESTORE scroll state AFTER channel switch completes
  useEffect(() => {
    if (!streamRef.current) return;
    
    if (prevChannel.current !== activeChannel) {
      const savedState = scrollBeforeChannelSwitch.current;
      
      if (savedState) {
        const restoreScroll = () => {
          if (streamRef.current && streamRef.current.scrollHeight > 0) {
            // Smart restoration: if was at bottom, stay at bottom
            restoreScrollState(streamRef.current, savedState);
            
            // Double-check it worked for anchored users
            setTimeout(() => {
              if (streamRef.current && savedState.wasAtBottom) {
                const { scrollHeight, scrollTop, clientHeight } = streamRef.current;
                const atBottom = (scrollHeight - (scrollTop + clientHeight)) < 100;
                
                if (!atBottom) {
                  console.log(`[Scroll] Re-anchoring to bottom after channel switch to ${activeChannel}`);
                  streamRef.current.scrollTop = streamRef.current.scrollHeight;
                }
              }
            }, 50);
          }
        };
        
        requestAnimationFrame(() => {
          requestAnimationFrame(restoreScroll);
        });
      }
      
      prevChannel.current = activeChannel;
      scrollBeforeChannelSwitch.current = null;
    }
  }, [activeChannel, filteredCommentsLength, streamRef]);
}

