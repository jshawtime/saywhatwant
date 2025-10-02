/**
 * useMessageTypeFilters Hook
 * 
 * Manages Human/Entity message type filtering
 * Handles localStorage persistence and scroll position saving
 */

import { useState, useCallback, useRef } from 'react';

interface UseMessageTypeFiltersReturn {
  showHumans: boolean;
  showEntities: boolean;
  toggleShowHumans: () => void;
  toggleShowEntities: () => void;
  savedHumansScrollPosition: number | null;
  savedEntitiesScrollPosition: number | null;
  setSavedHumansScrollPosition: (pos: number | null) => void;
  setSavedEntitiesScrollPosition: (pos: number | null) => void;
}

export function useMessageTypeFilters(
  streamRef: React.RefObject<HTMLDivElement>
): UseMessageTypeFiltersReturn {
  const [showHumans, setShowHumans] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('sww-show-humans');
      return saved !== null ? saved === 'true' : true; // Default to true
    }
    return true;
  });
  
  const [showEntities, setShowEntities] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('sww-show-entities');
      return saved !== null ? saved === 'true' : true; // Default to true
    }
    return true;
  });
  
  // Scroll position memory for message type filters
  const [savedHumansScrollPosition, setSavedHumansScrollPosition] = useState<number | null>(null);
  const [savedEntitiesScrollPosition, setSavedEntitiesScrollPosition] = useState<number | null>(null);
  
  const toggleShowHumans = useCallback(() => {
    // Save scroll position before toggling
    if (streamRef.current && showHumans) {
      setSavedHumansScrollPosition(streamRef.current.scrollTop);
      console.log('[Scroll] Saved scroll position before hiding humans:', streamRef.current.scrollTop);
    }
    
    const newState = !showHumans;
    setShowHumans(newState);
    localStorage.setItem('sww-show-humans', String(newState));
  }, [showHumans, streamRef]);
  
  const toggleShowEntities = useCallback(() => {
    // Save scroll position before toggling
    if (streamRef.current && showEntities) {
      setSavedEntitiesScrollPosition(streamRef.current.scrollTop);
      console.log('[Scroll] Saved scroll position before hiding entities:', streamRef.current.scrollTop);
    }
    
    const newState = !showEntities;
    setShowEntities(newState);
    localStorage.setItem('sww-show-entities', String(newState));
  }, [showEntities, streamRef]);
  
  return {
    showHumans,
    showEntities,
    toggleShowHumans,
    toggleShowEntities,
    savedHumansScrollPosition,
    savedEntitiesScrollPosition,
    setSavedHumansScrollPosition,
    setSavedEntitiesScrollPosition,
  };
}

