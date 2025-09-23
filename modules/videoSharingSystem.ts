/**
 * Video Sharing System Module
 * Handles video sharing functionality for the comments system
 * 
 * Features:
 * - Listen for video share events from video player
 * - Manage pending video state
 * - Insert video links into comments
 * - Handle video link clicks
 */

import { useState, useEffect, useRef, useCallback } from 'react';

export interface VideoShareEvent extends CustomEvent {
  detail: {
    videoKey: string;
  };
}

export interface VideoPendingState {
  pendingVideoKey: string | null;
  setPendingVideoKey: (key: string | null) => void;
}

/**
 * Hook for managing video sharing functionality
 * @param inputRef Reference to the comment input element
 * @param setInputText Optional setter for input text state
 * @returns Video sharing state and handlers
 */
export function useVideoSharing(
  inputRef: React.RefObject<HTMLTextAreaElement>,
  setInputText?: (text: string) => void
) {
  const [pendingVideoKey, setPendingVideoKey] = useState<string | null>(null);

  // Listen for video share events
  useEffect(() => {
    const handleShareVideo = (event: VideoShareEvent) => {
      const videoKey = event.detail?.videoKey;
      
      if (!videoKey) {
        console.warn('[VideoSharing] No video key received');
        return;
      }
      
      // Store the video key internally
      setPendingVideoKey(videoKey);
      
      // Update input text
      if (setInputText) {
        setInputText('<-- video');
      } else if (inputRef.current) {
        inputRef.current.value = '<-- video';
      }
      
      // Focus the input
      if (inputRef.current) {
        inputRef.current.focus();
      }
    };

    // Add event listener
    window.addEventListener('shareVideo' as any, handleShareVideo);
    
    // Cleanup
    return () => {
      window.removeEventListener('shareVideo' as any, handleShareVideo);
    };
  }, [inputRef, setInputText]);

  /**
   * Process comment text to include video reference if pending
   */
  const processVideoInComment = useCallback((commentText: string): string => {
    if (pendingVideoKey && commentText.includes('<-- video')) {
      return commentText.replace('<-- video', `[video:${pendingVideoKey}] <-- video`);
    }
    return commentText;
  }, [pendingVideoKey]);

  /**
   * Clear pending video if user removes the placeholder text
   */
  const handleInputChange = useCallback((newText: string) => {
    if (pendingVideoKey && !newText.includes('<-- video')) {
      setPendingVideoKey(null);
    }
  }, [pendingVideoKey]);

  /**
   * Handle clicking on video link in input to play it
   */
  const handleVideoLinkClick = useCallback((showVideo: boolean, toggleVideo?: () => void) => {
    if (!pendingVideoKey) return false;
    
    // Open video area if it's closed
    if (!showVideo && toggleVideo) {
      toggleVideo();
    }
    
    // Play the video
    const playEvent = new CustomEvent('playSharedVideo', {
      detail: { videoKey: pendingVideoKey }
    });
    window.dispatchEvent(playEvent);
    
    return true;
  }, [pendingVideoKey]);

  /**
   * Get cursor style for input when video is pending
   */
  const getInputCursorStyle = useCallback((inputText: string): React.CSSProperties => {
    const hasVideoPlaceholder = pendingVideoKey && inputText.includes('<-- video');
    return {
      cursor: hasVideoPlaceholder ? 'pointer' : 'text',
      textDecoration: hasVideoPlaceholder ? 'underline' : 'none',
    };
  }, [pendingVideoKey]);

  /**
   * Insert video placeholder into input
   */
  const insertVideoPlaceholder = useCallback(() => {
    if (inputRef.current) {
      inputRef.current.value = '<-- video';
      inputRef.current.focus();
    }
  }, [inputRef]);

  /**
   * Clear video state after submission
   */
  const clearVideoState = useCallback(() => {
    setPendingVideoKey(null);
  }, []);

  return {
    // State
    pendingVideoKey,
    setPendingVideoKey,
    
    // Handlers
    processVideoInComment,
    handleInputChange,
    handleVideoLinkClick,
    getInputCursorStyle,
    insertVideoPlaceholder,
    clearVideoState,
    
    // Computed values
    hasVideo: Boolean(pendingVideoKey),
  };
}

/**
 * Utility to validate video key format
 */
export function validateVideoKey(videoKey: string): boolean {
  // Video keys should be alphanumeric with possible dashes/underscores
  return /^[a-zA-Z0-9_-]+$/.test(videoKey);
}

/**
 * Parse video references from comment text
 */
export function parseVideoReferences(text: string): string[] {
  const videoRegex = /\[video:([^\]]+)\]/g;
  const matches = [];
  let match;
  
  while ((match = videoRegex.exec(text)) !== null) {
    matches.push(match[1]);
  }
  
  return matches;
}

/**
 * Format video reference for display
 */
export function formatVideoReference(videoKey: string): string {
  return `[video:${videoKey}] <-- video`;
}

/**
 * Remove video references from text
 */
export function stripVideoReferences(text: string): string {
  return text.replace(/\[video:[^\]]+\]\s*<--\s*video/g, '').trim();
}
