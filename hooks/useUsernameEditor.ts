/**
 * useUsernameEditor Hook
 * 
 * Consolidates username editing logic with localStorage persistence and validation
 * Manages editing state, interaction tracking, and cleanup
 */

import { useState, useEffect, useCallback } from 'react';

interface UsernameEditorState {
  /**
   * Current username value
   */
  username: string;
  
  /**
   * Whether user is currently editing the username field
   */
  isEditing: boolean;
  
  /**
   * Whether user has interacted with username field at all
   */
  hasInteracted: boolean;
  
  /**
   * Set the username value (also saves to localStorage)
   */
  setUsername: (username: string) => void;
  
  /**
   * Start editing mode
   */
  startEditing: () => void;
  
  /**
   * Stop editing mode
   */
  stopEditing: () => void;
  
  /**
   * Clear username (also removes from localStorage)
   */
  clearUsername: () => void;
  
  /**
   * Mark that user has interacted
   */
  markAsInteracted: () => void;
}

/**
 * useUsernameEditor Hook
 * 
 * Manages username editing with:
 * - localStorage persistence
 * - Editing state tracking
 * - Interaction state tracking  
 * - Validation (max length, no spaces)
 * - Clear operation
 * 
 * Consolidates 3 useState calls and multiple localStorage operations
 * into a single cohesive username management hook.
 * 
 * @param maxLength - Maximum username length (default: 16)
 * @param storageKey - localStorage key (default: 'sww-username')
 * @returns Username state and operations
 * 
 * @example
 * const {
 *   username,
 *   isEditing,
 *   hasInteracted,
 *   setUsername,
 *   startEditing,
 *   clearUsername
 * } = useUsernameEditor(16);
 */
export function useUsernameEditor(
  maxLength: number = 16,
  storageKey: string = 'sww-username',
  onUsernameSaved?: () => void
): UsernameEditorState {
  // Username value
  const [username, setUsernameState] = useState('');
  
  // Editing state
  const [isEditing, setIsEditing] = useState(false);
  
  // Interaction tracking
  const [hasInteracted, setHasInteracted] = useState(false);
  
  /**
   * Load username from localStorage on mount
   */
  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        setUsernameState(saved);
        console.log('[UsernameEditor] Loaded username from localStorage:', saved);
      }
    } catch (error) {
      console.error('[UsernameEditor] Failed to load from localStorage:', error);
    }
  }, [storageKey]);
  
  /**
   * Set username with validation and localStorage persistence
   */
  const setUsername = useCallback((newUsername: string) => {
    // Validate: remove spaces and enforce max length
    const validated = newUsername.replace(/\s/g, '').substring(0, maxLength);
    
    setUsernameState(validated);
    
    // Save to localStorage
    try {
      if (validated) {
        localStorage.setItem(storageKey, validated);
        console.log('[UsernameEditor] Saved username to localStorage:', validated);
      } else {
        localStorage.removeItem(storageKey);
        console.log('[UsernameEditor] Removed username from localStorage (empty)');
      }
    } catch (error) {
      console.error('[UsernameEditor] Failed to save to localStorage:', error);
    }
  }, [maxLength, storageKey]);
  
  /**
   * Start editing mode
   */
  const startEditing = useCallback(() => {
    setIsEditing(true);
    console.log('[UsernameEditor] Started editing');
  }, []);
  
  /**
   * Stop editing mode
   */
  const stopEditing = useCallback(() => {
    setIsEditing(false);
    console.log('[UsernameEditor] Stopped editing');
  }, []);
  
  /**
   * Clear username completely
   */
  const clearUsername = useCallback(() => {
    setUsernameState('');
    setHasInteracted(false);
    
    try {
      localStorage.removeItem(storageKey);
      console.log('[UsernameEditor] Cleared username');
    } catch (error) {
      console.error('[UsernameEditor] Failed to clear from localStorage:', error);
    }
  }, [storageKey]);
  
  /**
   * Mark that user has interacted with username field
   */
  const markAsInteracted = useCallback(() => {
    if (!hasInteracted) {
      setHasInteracted(true);
      console.log('[UsernameEditor] Marked as interacted');
    }
  }, [hasInteracted]);
  
  return {
    username,
    isEditing,
    hasInteracted,
    setUsername,
    startEditing,
    stopEditing,
    clearUsername,
    markAsInteracted
  };
}

