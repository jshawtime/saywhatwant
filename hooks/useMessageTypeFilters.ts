/**
 * useMessageTypeFilters Hook
 * 
 * Manages Human/Entity message type filtering
 * Handles localStorage persistence
 * 
 * Note: Scroll position management is now handled by useScrollPositionMemory hook
 */

import { useState, useCallback } from 'react';

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
  streamRef?: React.RefObject<HTMLDivElement>
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
  
  const toggleShowHumans = useCallback(() => {
    const newState = !showHumans;
    setShowHumans(newState);
    localStorage.setItem('sww-show-humans', String(newState));
  }, [showHumans]);
  
  const toggleShowEntities = useCallback(() => {
    const newState = !showEntities;
    setShowEntities(newState);
    localStorage.setItem('sww-show-entities', String(newState));
  }, [showEntities]);
  
  return {
    showHumans,
    showEntities,
    toggleShowHumans,
    toggleShowEntities,
    // Scroll position management now handled by useScrollPositionMemory
    savedHumansScrollPosition: null,
    savedEntitiesScrollPosition: null,
    setSavedHumansScrollPosition: () => {},
    setSavedEntitiesScrollPosition: () => {},
  };
}

