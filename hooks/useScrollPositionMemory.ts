/**
 * useScrollPositionMemory Hook
 * 
 * Manages scroll position memory for 4 independent views:
 * - mt=human
 * - mt=AI  
 * - mt=ALL
 * - filter-active (any filter combination)
 * 
 * Simple logic:
 * 1. User at bottom → Clear position for current view
 * 2. User scrolls up → Save position for current view
 * 3. View switches → Restore saved position (or go to bottom if none)
 * 4. Filter bar changes → Clear filter position, go to bottom
 */

import { useEffect, useRef } from 'react';
import type { FilterState } from '@/lib/url-filter-simple';

interface ScrollPositions {
  'mt=human': number | null;
  'mt=AI': number | null;
  'mt=ALL': number | null;
  'filter-active': number | null;
}

interface UseScrollPositionMemoryParams {
  streamRef: React.RefObject<HTMLDivElement>;
  activeChannel: 'human' | 'AI' | 'ALL';
  isFilterActive: boolean;
  isNearBottom: boolean;
  filteredCommentsLength: number;
  filterState: FilterState;
}

/**
 * Get view key for current state
 */
function getViewKey(
  messageType: 'human' | 'AI' | 'ALL',
  isFilterActive: boolean
): keyof ScrollPositions {
  if (isFilterActive) {
    return 'filter-active';
  }
  return `mt=${messageType}` as keyof ScrollPositions;
}

/**
 * Create hash of filter configuration to detect changes
 */
function getFilterHash(filterState: FilterState): string {
  const parts = [
    filterState.users.map(u => `${u.username}:${u.color}`).sort().join(','),
    filterState.words.sort().join(','),
    filterState.negativeWords.sort().join(',')
  ];
  return parts.join('|');
}

/**
 * Load positions from localStorage
 */
function loadPositions(): ScrollPositions {
  if (typeof window === 'undefined') {
    return {
      'mt=human': null,
      'mt=AI': null,
      'mt=ALL': null,
      'filter-active': null
    };
  }
  
  const saved = localStorage.getItem('sww-scroll-positions');
  if (saved) {
    try {
      return JSON.parse(saved);
    } catch (err) {
      console.warn('[ScrollMemory] Failed to parse saved positions:', err);
    }
  }
  
  return {
    'mt=human': null,
    'mt=AI': null,
    'mt=ALL': null,
    'filter-active': null
  };
}

/**
 * Save positions to localStorage
 */
function savePositions(positions: ScrollPositions): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem('sww-scroll-positions', JSON.stringify(positions));
  }
}

/**
 * Main hook
 */
export function useScrollPositionMemory(params: UseScrollPositionMemoryParams): void {
  const {
    streamRef,
    activeChannel,
    isFilterActive,
    isNearBottom,
    filteredCommentsLength,
    filterState
  } = params;
  
  // Position storage
  const positions = useRef<ScrollPositions>(loadPositions());
  
  // Previous state tracking
  const prevView = useRef<string>(getViewKey(activeChannel, isFilterActive));
  const prevFilterHash = useRef<string>(getFilterHash(filterState));
  const prevContentLength = useRef<number>(filteredCommentsLength);
  const pendingRestoration = useRef<number | null>(null);
  
  // Restoration flag (prevent clearing during restoration)
  const isRestoring = useRef(false);
  
  // Effect 1: Listen to scroll events and save/clear position continuously
  useEffect(() => {
    const element = streamRef.current;
    if (!element) return;
    
    const currentView = getViewKey(activeChannel, isFilterActive);
    
    const handleScroll = () => {
      // Don't update position if we're in the middle of restoring
      if (isRestoring.current) return;
      
      const scrollTop = element.scrollTop;
      const scrollHeight = element.scrollHeight;
      const clientHeight = element.clientHeight;
      const distanceFromBottom = scrollHeight - (scrollTop + clientHeight);
      const atBottom = distanceFromBottom < 100;
      
      if (atBottom) {
        // User at bottom - clear position for this view (if exists)
        if (positions.current[currentView] !== null) {
          console.log(`[ScrollMemory] At bottom - clearing ${currentView} position`);
          positions.current[currentView] = null;
          savePositions(positions.current);
        }
      } else {
        // User scrolled up - save current position
        const roundedPosition = Math.round(scrollTop);
        if (positions.current[currentView] !== roundedPosition) {
          console.log(`[ScrollMemory] Saving ${currentView} position: ${roundedPosition} (scrollHeight: ${scrollHeight}, distFromBottom: ${distanceFromBottom})`);
          positions.current[currentView] = roundedPosition;
          savePositions(positions.current);
        }
      }
    };
    
    // Attach scroll listener
    element.addEventListener('scroll', handleScroll);
    
    return () => {
      element.removeEventListener('scroll', handleScroll);
    };
  }, [activeChannel, isFilterActive, streamRef]);
  
  // Effect 2: Restore position when view changes
  useEffect(() => {
    const currentView = getViewKey(activeChannel, isFilterActive);
    
    // View changed?
    if (prevView.current !== currentView) {
      console.log(`[ScrollMemory] View changed: ${prevView.current} → ${currentView}`);
      
      // Set restoration flag to prevent scroll listener from interfering
      isRestoring.current = true;
      
      // Wait for content to render (double RAF ensures DOM paint)
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (!streamRef.current) {
            isRestoring.current = false;
            return;
          }
          
          const savedPosition = positions.current[currentView];
          const scrollHeight = streamRef.current.scrollHeight;
          const clientHeight = streamRef.current.clientHeight;
          
          if (savedPosition !== null) {
            // Restore saved position
            console.log(`[ScrollMemory] BEFORE restore - scrollHeight: ${scrollHeight}, clientHeight: ${clientHeight}, savedPosition: ${savedPosition}`);
            streamRef.current.scrollTop = savedPosition;
            console.log(`[ScrollMemory] AFTER restore - actual scrollTop: ${streamRef.current.scrollTop}`);
          } else {
            // No saved position - go to bottom
            console.log(`[ScrollMemory] No saved position for ${currentView}, going to bottom (scrollHeight: ${scrollHeight})`);
            streamRef.current.scrollTop = streamRef.current.scrollHeight;
            console.log(`[ScrollMemory] After bottom scroll - actual scrollTop: ${streamRef.current.scrollTop}`);
          }
          
          // Clear restoration flag after a short delay
          setTimeout(() => {
            isRestoring.current = false;
          }, 100);
        });
      });
      
      prevView.current = currentView;
    }
  }, [activeChannel, isFilterActive, filteredCommentsLength, streamRef]);
  
  // Effect 3: Clear filter position when filter bar changes
  useEffect(() => {
    const currentFilterHash = getFilterHash(filterState);
    
    // Filter bar changed while filter is active?
    if (isFilterActive && prevFilterHash.current !== currentFilterHash) {
      console.log(`[ScrollMemory] Filter bar changed - clearing filter position`);
      console.log(`[ScrollMemory] Previous hash: ${prevFilterHash.current}`);
      console.log(`[ScrollMemory] Current hash: ${currentFilterHash}`);
      
      positions.current['filter-active'] = null;
      savePositions(positions.current);
      
      // Set restoration flag to prevent scroll listener from saving this scroll
      isRestoring.current = true;
      
      // Scroll to bottom
      requestAnimationFrame(() => {
        if (streamRef.current) {
          console.log(`[ScrollMemory] Scrolling to bottom after filter change`);
          streamRef.current.scrollTop = streamRef.current.scrollHeight;
          
          // Clear restoration flag after scroll completes
          setTimeout(() => {
            isRestoring.current = false;
          }, 100);
        }
      });
    }
    
    prevFilterHash.current = currentFilterHash;
  }, [filterState, isFilterActive, streamRef]);
}

