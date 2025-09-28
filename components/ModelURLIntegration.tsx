/**
 * Model URL Integration Component
 * Handles model URL parameters and injects messages into the chat
 */

'use client';

import React, { useEffect, useRef } from 'react';
import { useModelURL } from '../hooks/useModelURL';
import { Comment } from '../types';

interface ModelURLIntegrationProps {
  onModelMessage?: (message: Comment) => void;
  onFilterActiveChange?: (isActive: boolean) => void;
  onUserStateChange?: (username: string, color: string) => void;
}

export function ModelURLIntegration({ 
  onModelMessage,
  onFilterActiveChange,
  onUserStateChange 
}: ModelURLIntegrationProps) {
  const {
    isFilterActive,
    currentDomain,
    modelMessages,
    isProcessingQueue,
    humanUsername,
    humanColor,
    aiUsername,
    aiColor,
    continueQueue,
    getFilteredMessages,
    addModelMessage
  } = useModelURL();
  
  const lastProcessedMessageId = useRef<string>('');
  
  // Handle model messages
  useEffect(() => {
    if (!onModelMessage || modelMessages.length === 0) return;
    
    // Find new messages since last check
    const lastIndex = modelMessages.findIndex(msg => msg.id === lastProcessedMessageId.current);
    const newMessages = lastIndex === -1 ? modelMessages : modelMessages.slice(lastIndex + 1);
    
    // Convert and emit new messages
    newMessages.forEach(modelMsg => {
      const comment: Comment = {
        id: modelMsg.id,
        timestamp: modelMsg.timestamp,
        username: modelMsg.username,
        text: modelMsg.text,
        userColor: modelMsg.userColor,
        domain: modelMsg.domain || currentDomain || 'saywhatwant.app',
        isAI: true, // Mark as AI message
        isGreeting: modelMsg.isGreeting,
        isModelResponse: modelMsg.isModelResponse
      };
      
      onModelMessage(comment);
      lastProcessedMessageId.current = modelMsg.id;
    });
  }, [modelMessages, onModelMessage, currentDomain]);
  
  // Handle filter active state
  useEffect(() => {
    if (isFilterActive !== null && onFilterActiveChange) {
      onFilterActiveChange(isFilterActive);
    }
  }, [isFilterActive, onFilterActiveChange]);
  
  // Handle user state changes
  useEffect(() => {
    if (humanUsername && humanColor && onUserStateChange) {
      onUserStateChange(humanUsername, humanColor);
    }
  }, [humanUsername, humanColor, onUserStateChange]);
  
  // Expose methods to parent via window (for AI bot integration)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      (window as any).__modelURLIntegration = {
        continueQueue,
        getFilteredMessages,
        addModelMessage,
        isProcessingQueue,
        currentDomain,
        aiUsername,
        aiColor
      };
    }
    
    return () => {
      if (typeof window !== 'undefined') {
        delete (window as any).__modelURLIntegration;
      }
    };
  }, [continueQueue, getFilteredMessages, addModelMessage, isProcessingQueue, currentDomain, aiUsername, aiColor]);
  
  // Handle domain display
  useEffect(() => {
    if (currentDomain && typeof document !== 'undefined') {
      // Update domain display in the UI (if there's a domain element)
      const domainElement = document.querySelector('.domain-display');
      if (domainElement) {
        domainElement.textContent = currentDomain;
      }
    }
  }, [currentDomain]);
  
  return null; // This is a logic-only component
}
