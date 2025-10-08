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
  activeChannel: 'human' | 'AI' | 'ALL';  // Channel type: human, AI, or both
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
  
  // Restore scroll STATE (smart: keeps at bottom if was anchored) AFTER filter state changes AND content renders
  useEffect(() => {
    if (!streamRef.current) return;
    
    // Only restore if we have a saved state AND filter actually changed
    if (prevFilterEnabled.current !== isFilterEnabled && scrollBeforeFilterToggle.current) {
      const savedState = scrollBeforeFilterToggle.current;
      
      console.log(`[Scroll] Filter toggled ${prevFilterEnabled.current} → ${isFilterEnabled}`);
      console.log(`[Scroll] filteredCommentsLength: ${filteredCommentsLength}`);
      console.log(`[Scroll] Content rendered, restoring scroll`);
      console.log(`[Scroll] scrollHeight: ${streamRef.current.scrollHeight}, wasAtBottom: ${savedState.wasAtBottom}`);
      
      // Content has rendered (this effect fires AFTER React renders)
      // Now restore scroll position
      if (streamRef.current.scrollHeight > 0) {
        restoreScrollState(streamRef.current, savedState);
        
        // Give React one more frame to settle, then double-check
        requestAnimationFrame(() => {
          if (streamRef.current && savedState.wasAtBottom) {
            const { scrollHeight, scrollTop, clientHeight } = streamRef.current;
            const atBottom = (scrollHeight - (scrollTop + clientHeight)) < 100;
            
            console.log(`[Scroll] Double-check filter: scrollHeight=${scrollHeight}, scrollTop=${scrollTop}, atBottom=${atBottom}`);
            
            if (!atBottom) {
              console.log('[Scroll] Re-anchoring to bottom (content settled)');
              streamRef.current.scrollTop = streamRef.current.scrollHeight;
              console.log(`[Scroll] Final scrollTop: ${streamRef.current.scrollTop}`);
            }
          }
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
  const channelSwitchPending = useRef(false);
  const prevFilteredLength = useRef(filteredCommentsLength);
  
  // SAVE scroll state BEFORE channel changes
  useEffect(() => {
    if (streamRef.current && prevChannel.current !== activeChannel) {
      scrollBeforeChannelSwitch.current = saveScrollState(streamRef.current, 100);
      channelSwitchPending.current = true;  // Mark that we're waiting for content
      console.log(`[Scroll] Saved scroll state before switching from ${prevChannel.current} to ${activeChannel}:`, scrollBeforeChannelSwitch.current);
      prevChannel.current = activeChannel;
    }
  }, [activeChannel, streamRef]);
  
  // RESTORE scroll AFTER new channel content has loaded and rendered
  useEffect(() => {
    if (!streamRef.current) return;
    
    // Check if we're waiting for content after a channel switch
    // AND filteredCommentsLength has changed (new content loaded)
    if (channelSwitchPending.current && 
        scrollBeforeChannelSwitch.current &&
        prevFilteredLength.current !== filteredCommentsLength) {
      
      const savedState = scrollBeforeChannelSwitch.current;
      
      console.log(`[Scroll] Channel content loaded: ${prevFilteredLength.current} → ${filteredCommentsLength}`);
      console.log(`[Scroll] scrollHeight: ${streamRef.current.scrollHeight}, wasAtBottom: ${savedState.wasAtBottom}`);
      
      // Content has NOW rendered (filteredCommentsLength changed = React rendered new content)
      if (streamRef.current.scrollHeight > 0) {
        restoreScrollState(streamRef.current, savedState);
        
        // Give React one more frame to settle, then double-check
        requestAnimationFrame(() => {
          if (streamRef.current && savedState.wasAtBottom) {
            const { scrollHeight, scrollTop, clientHeight } = streamRef.current;
            const atBottom = (scrollHeight - (scrollTop + clientHeight)) < 100;
            
            console.log(`[Scroll] Double-check: scrollHeight=${scrollHeight}, scrollTop=${scrollTop}, atBottom=${atBottom}`);
            
            if (!atBottom) {
              console.log(`[Scroll] Re-anchoring to bottom (content settled)`);
              streamRef.current.scrollTop = streamRef.current.scrollHeight;
              console.log(`[Scroll] Final scrollTop: ${streamRef.current.scrollTop}`);
            }
          }
        });
      }
      
      channelSwitchPending.current = false;
      scrollBeforeChannelSwitch.current = null;
    }
    
    prevFilteredLength.current = filteredCommentsLength;
  }, [filteredCommentsLength, streamRef]);
}

