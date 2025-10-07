/**
 * Comment Submission Handler Module
 * Manages the complete flow of submitting comments with optimistic updates
 * 
 * Features:
 * - Input validation
 * - Optimistic UI updates
 * - Server/storage persistence
 * - Error handling and recovery
 * - UI feedback (scroll, focus, clear)
 */

import { useState, useCallback, RefObject } from 'react';
import { Comment, BotParams } from '@/types';
import { postCommentToCloud, isCloudAPIEnabled } from '@/modules/cloudApiClient';

export interface SubmissionConfig {
  maxLength: number;
  domain: string;
  storageKey: string;
}

export interface SubmissionCallbacks {
  onOptimisticUpdate: (comment: Comment) => void;
  onOptimisticRemove: (commentId: string) => void;
  onInputClear: () => void;
  onScrollToBottom: () => void;
  onFocusInput: () => void;
  loadCommentsFromStorage: () => Comment[];
  saveCommentsToStorage: (comments: Comment[]) => void;
  processVideoInComment?: (text: string) => string;
  clearVideoState?: () => void;
}

export interface SubmissionState {
  isSubmitting: boolean;
  error: string | null;
  setError: (error: string | null) => void;
}

/**
 * Validate comment before submission
 */
export function validateComment(
  text: string,
  username: string | undefined,
  maxLength: number
): { isValid: boolean; error?: string } {
  if (!text.trim()) {
    return { isValid: false, error: 'Comment cannot be empty' };
  }
  
  if (text.length > maxLength) {
    return { isValid: false, error: `Comment exceeds ${maxLength} characters` };
  }
  
  if (!username) {
    return { isValid: false, error: 'Username is required' };
  }
  
  return { isValid: true };
}

/**
 * Generate unique comment ID
 */
export function generateCommentId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Prepare comment data for submission
 */
export function prepareCommentData(
  text: string,
  username: string,
  userColor: string,
  processVideo?: (text: string) => string,
  contextUsers?: string[],  // NEW: Filter usernames for LLM context
  ais?: string,  // NEW: AI initial state (username:color override for bot)
  botParams?: BotParams  // NEW: Bot control parameters (entity, priority, model, nom)
): Comment {
  const processedText = processVideo ? processVideo(text.trim()) : text.trim();
  
  // Store color as-is (9-digit format for new comments)
  // KV should store 9-digit format, not RGB
  let colorForStorage = userColor;
  
  return {
    id: generateCommentId(),
    text: processedText,
    timestamp: Date.now(),
    username: username,
    color: colorForStorage,
    domain: 'saywhatwant.app', // Always this domain
    language: 'en', // Default for now
    'message-type': 'human', // Human-generated message
    misc: ais || '', // Store ais in misc field for bot to read
    contextUsers,  // NEW: LLM should use only these users' messages as context
    botParams,  // NEW: Structured bot control (entity, priority, model, nom)
  };
}

/**
 * Hook for managing comment submission
 */
export function useCommentSubmission(
  config: SubmissionConfig,
  callbacks: SubmissionCallbacks
) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const handleSubmit = useCallback(async (
    inputText: string,
    username: string | undefined,
    userColor: string,
    onUsernameFlash?: () => void,
    contextUsers?: string[],  // NEW: Optional filter for LLM context
    ais?: string,  // NEW: AI initial state override
    botParams?: BotParams  // NEW: Bot control parameters
  ): Promise<boolean> => {
    // Validate input
    if (!inputText.trim()) return false;
    
    // Check username
    if (!username) {
      if (onUsernameFlash) {
        onUsernameFlash();
      }
      return false;
    }
    
    // Prevent double-submit
    if (isSubmitting) return false;
    
    setIsSubmitting(true);
    setError(null);
    
    // Prepare comment
    const newComment = prepareCommentData(
      inputText,
      username,
      userColor,
      callbacks.processVideoInComment,
      contextUsers,  // NEW: Pass through filter context
      ais,  // NEW: Pass through AI state override
      botParams  // NEW: Pass through bot control parameters
    );
    
    // Log if this is a filtered/controlled conversation
    if (contextUsers && contextUsers.length > 0) {
      console.log('[CommentSubmission] Filtered conversation - Context users:', contextUsers);
    }
    if (ais) {
      console.log('[CommentSubmission] AI identity override (ais):', ais);
    }
    if (botParams) {
      console.log('[CommentSubmission] Bot control parameters:', botParams);
    }
    
    // INSTANT UI FEEDBACK - Optimistic update
    callbacks.onOptimisticUpdate(newComment);
    
    // Clear input and UI feedback
    callbacks.onInputClear();
    if (callbacks.clearVideoState) {
      callbacks.clearVideoState();
    }
    callbacks.onFocusInput();
    
    // Scroll to bottom
    setTimeout(() => {
      callbacks.onScrollToBottom();
    }, 10);
    
    // Reset submitting flag for rapid messaging
    setIsSubmitting(false);
    
    // Handle persistence in background
    try {
      if (isCloudAPIEnabled()) {
        // Submit to cloud API
        postCommentToCloud({
          id: newComment.id,
          timestamp: newComment.timestamp,
          text: newComment.text,
          username: newComment.username,
          color: newComment.color,
          domain: config.domain,
          language: newComment.language,
          'message-type': 'human', // Mark as human-generated message
          misc: newComment.misc,
          contextUsers: newComment.contextUsers,  // NEW: Pass through
          botParams: newComment.botParams,  // NEW: Pass through
        }).then(savedComment => {
          // Server acknowledged - optimistic version is canonical
          console.log('[CommentSubmission] Server acknowledged:', savedComment.id);
        }).catch(err => {
          console.error('[CommentSubmission] Error posting to cloud:', err);
          // Remove optimistic comment on error
          callbacks.onOptimisticRemove(newComment.id);
          setError('Failed to post comment. Please try again.');
        });
      } else {
        // Save to localStorage
        const existingComments = callbacks.loadCommentsFromStorage();
        const updatedComments = [...existingComments, newComment];
        callbacks.saveCommentsToStorage(updatedComments);
        console.log('[CommentSubmission] Saved to localStorage:', newComment.id);
      }
    } catch (err) {
      console.error('[CommentSubmission] Error posting comment:', err);
      // Remove optimistic comment on error
      callbacks.onOptimisticRemove(newComment.id);
      setError('Failed to post comment. Please try again.');
    }
    
    return true;
  }, [isSubmitting, config, callbacks]);
  
  const clearError = useCallback(() => {
    setError(null);
  }, []);
  
  return {
    // State
    isSubmitting,
    error,
    
    // Actions
    handleSubmit,
    clearError,
    setError,
  };
}

/**
 * Character counter utility
 */
export function useCharacterCounter(
  text: string,
  maxLength: number
) {
  const remaining = maxLength - text.length;
  const percentage = (text.length / maxLength) * 100;
  const isNearLimit = remaining <= 20;
  const isOverLimit = remaining < 0;
  
  return {
    remaining,
    percentage,
    isNearLimit,
    isOverLimit,
    display: `${remaining}`,
  };
}

/**
 * Username validation hook
 */
export function useUsernameValidation(
  username: string | undefined,
  flashDuration: number = 1000
) {
  const [isFlashing, setIsFlashing] = useState(false);
  
  const flashUsername = useCallback(() => {
    setIsFlashing(true);
    setTimeout(() => setIsFlashing(false), flashDuration);
  }, [flashDuration]);
  
  const isValid = Boolean(username && username.trim());
  
  return {
    isValid,
    isFlashing,
    flashUsername,
  };
}

/**
 * Submission rate limiter
 */
export function useRateLimiter(
  limit: number = 5,
  windowMs: number = 10000
) {
  const [submissions, setSubmissions] = useState<number[]>([]);
  
  const canSubmit = useCallback((): boolean => {
    const now = Date.now();
    const recentSubmissions = submissions.filter(t => now - t < windowMs);
    return recentSubmissions.length < limit;
  }, [submissions, limit, windowMs]);
  
  const recordSubmission = useCallback(() => {
    setSubmissions(prev => [...prev, Date.now()]);
  }, []);
  
  const reset = useCallback(() => {
    setSubmissions([]);
  }, []);
  
  return {
    canSubmit,
    recordSubmission,
    reset,
  };
}
