/**
 * Hook to integrate model messages with comments stream
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { Comment } from '../types';
import { useModelURL } from './useModelURL';

interface UseCommentsWithModelsProps {
  comments: Comment[];
  setComments: React.Dispatch<React.SetStateAction<Comment[]>>;
  addToFilter?: (username: string, color: string) => void;
}

export function useCommentsWithModels({ 
  comments, 
  setComments,
  addToFilter 
}: UseCommentsWithModelsProps) {
  const modelURLHook = useModelURL();
  const hasInjectedGreetings = useRef(false);
  const [filterActiveOverride, setFilterActiveOverride] = useState<boolean | null>(null);
  
  // Inject model messages (greetings)
  useEffect(() => {
    if (!hasInjectedGreetings.current && modelURLHook.modelMessages.length > 0) {
      hasInjectedGreetings.current = true;
      
      // Convert model messages to comments and prepend to list
      const modelComments: Comment[] = modelURLHook.modelMessages.map(modelMsg => ({
        id: modelMsg.id,
        timestamp: modelMsg.timestamp,
        username: modelMsg.username,
        text: modelMsg.text,
        color: modelMsg.userColor, // Use 'color' field name
        domain: modelMsg.domain || modelURLHook.currentDomain || 'saywhatwant.app',
        'message-type': 'AI' // Mark as AI message using correct field
      }));
      
      // Add to beginning of comments
      setComments(prev => [...modelComments, ...prev]);
    }
  }, [modelURLHook.modelMessages, modelURLHook.currentDomain, setComments]);
  
  // Handle filter active state
  useEffect(() => {
    if (modelURLHook.isFilterActive !== null) {
      console.log('[CommentsWithModels] Setting filter active override to:', modelURLHook.isFilterActive);
      setFilterActiveOverride(modelURLHook.isFilterActive);
    }
  }, [modelURLHook.isFilterActive]);
  
  // Handle username/color from URL
  useEffect(() => {
    if (modelURLHook.humanUsername && modelURLHook.humanColor) {
      // Update localStorage for UI components
      localStorage.setItem('sww-username', modelURLHook.humanUsername);
      localStorage.setItem('sww-usercolor', modelURLHook.humanColor);
      
      // Trigger storage event for other components
      window.dispatchEvent(new StorageEvent('storage', {
        key: 'sww-username',
        newValue: modelURLHook.humanUsername,
        oldValue: null,
        storageArea: localStorage
      }));
      
      window.dispatchEvent(new StorageEvent('storage', {
        key: 'sww-usercolor',
        newValue: modelURLHook.humanColor,
        oldValue: null,
        storageArea: localStorage
      }));
    }
  }, [modelURLHook.humanUsername, modelURLHook.humanColor]);
  
  // Handle AI username/color from URL  
  useEffect(() => {
    if (modelURLHook.aiUsername && modelURLHook.aiColor) {
      // Add AI to filter bar
      if (addToFilter) {
        addToFilter(modelURLHook.aiUsername, modelURLHook.aiColor);
      }
    }
  }, [modelURLHook.aiUsername, modelURLHook.aiColor, addToFilter]);
  
  // Add a model response to comments
  const addModelResponse = useCallback((response: Comment) => {
    setComments(prev => [response, ...prev]);
  }, [setComments]);
  
  // Get filtered messages for model context
  const getFilteredMessagesForModel = useCallback(() => {
    return modelURLHook.getFilteredMessages(comments);
  }, [modelURLHook, comments]);
  
  // Continue model queue after response
  const handleModelResponseComplete = useCallback(async () => {
    if (modelURLHook.isProcessingQueue) {
      await modelURLHook.continueQueue();
    }
  }, [modelURLHook]);
  
  // Expose integration points
  useEffect(() => {
    if (typeof window !== 'undefined') {
      (window as any).__commentsModelIntegration = {
        addModelResponse,
        getFilteredMessagesForModel,
        handleModelResponseComplete,
        isProcessingQueue: modelURLHook.isProcessingQueue,
        currentDomain: modelURLHook.currentDomain
      };
    }
    
    return () => {
      if (typeof window !== 'undefined') {
        delete (window as any).__commentsModelIntegration;
      }
    };
  }, [addModelResponse, getFilteredMessagesForModel, handleModelResponseComplete, modelURLHook.isProcessingQueue, modelURLHook.currentDomain]);
  
  return {
    filterActiveOverride,
    currentDomain: modelURLHook.currentDomain,
    isProcessingQueue: modelURLHook.isProcessingQueue,
    addModelResponse,
    getFilteredMessagesForModel,
    handleModelResponseComplete
  };
}
