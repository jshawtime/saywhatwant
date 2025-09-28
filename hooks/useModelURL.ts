/**
 * useModelURL Hook
 * Integrates model URL parameters with React components
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import { ModelURLHandler, ModelHandlerEvent, ModelMessage } from '../lib/model-url-handler';

export interface UseModelURLReturn {
  // State
  isFilterActive: boolean | null;
  currentDomain: string | null;
  modelMessages: ModelMessage[];
  isProcessingQueue: boolean;
  humanUsername: string | null;
  humanColor: string | null;
  aiUsername: string | null;
  aiColor: string | null;
  
  // Actions
  continueQueue: () => Promise<void>;
  getFilteredMessages: (messages: any[]) => any[];
  addModelMessage: (message: ModelMessage) => void;
}

export function useModelURL(): UseModelURLReturn {
  // State
  const [isFilterActive, setIsFilterActive] = useState<boolean | null>(null);
  const [currentDomain, setCurrentDomain] = useState<string | null>(null);
  const [modelMessages, setModelMessages] = useState<ModelMessage[]>([]);
  const [isProcessingQueue, setIsProcessingQueue] = useState(false);
  const [humanUsername, setHumanUsername] = useState<string | null>(null);
  const [humanColor, setHumanColor] = useState<string | null>(null);
  const [aiUsername, setAiUsername] = useState<string | null>(null);
  const [aiColor, setAiColor] = useState<string | null>(null);
  
  const handlerRef = useRef<ModelURLHandler | null>(null);
  const initializedRef = useRef(false);
  
  // Initialize handler and process URL on mount
  useEffect(() => {
    // Only run on client side
    if (typeof window === 'undefined') return;
    
    // Prevent double initialization in development
    if (initializedRef.current) return;
    initializedRef.current = true;
    
    console.log('[ModelURL] Initializing model URL handler');
    const handler = ModelURLHandler.getInstance();
    handlerRef.current = handler;
    
    // Subscribe to events
    const unsubscribe = handler.subscribe((event: ModelHandlerEvent) => {
      console.log('[useModelURL] Received event:', event.type, event);
      switch (event.type) {
        case 'filter-active-changed':
          console.log('[useModelURL] Setting isFilterActive to:', event.isActive);
          setIsFilterActive(event.isActive);
          // Also update the filter bar if needed
          const filterButton = document.querySelector('.filter-button');
          if (filterButton) {
            filterButton.classList.toggle('active', event.isActive);
          }
          break;
          
        case 'user-state-changed':
          setHumanUsername(event.username);
          setHumanColor(event.color);
          // Update localStorage for the UI components
          localStorage.setItem('sww-username', event.username);
          localStorage.setItem('sww-usercolor', event.color);
          break;
          
        case 'ai-state-changed':
          setAiUsername(event.username);
          setAiColor(event.color);
          break;
          
        case 'greeting-message':
          setModelMessages(prev => [...prev, event.message]);
          break;
          
        case 'trigger-model-response':
          // This event can be used by the AI bot system
          // Store model info for context
          (window as any).__currentModelEntity = event.model;
          (window as any).__isLastInQueue = event.isLastInQueue;
          setIsProcessingQueue(true);
          break;
          
        case 'domain-changed':
          setCurrentDomain(event.domain);
          break;
          
        case 'queue-complete':
          setIsProcessingQueue(false);
          (window as any).__currentModelEntity = null;
          break;
      }
    });
    
    // Initialize the handler (process URL parameters)
    handler.initialize().catch(error => {
      console.error('[useModelURL] Failed to initialize:', error);
    });
    
    return () => {
      unsubscribe();
      initializedRef.current = false;
    };
  }, []);
  
  // Continue processing the queue
  const continueQueue = useCallback(async () => {
    if (handlerRef.current) {
      await handlerRef.current.continueQueue();
    }
  }, []);
  
  // Get filtered messages for model context
  const getFilteredMessages = useCallback((messages: any[]) => {
    if (!handlerRef.current) return messages;
    
    const modelEntity = (window as any).__currentModelEntity;
    if (!modelEntity) return messages;
    
    return handlerRef.current.getFilteredContext(messages, modelEntity);
  }, []);
  
  // Add a model message (for programmatic messages)
  const addModelMessage = useCallback((message: ModelMessage) => {
    setModelMessages(prev => [...prev, message]);
  }, []);
  
  // Apply filter active state to LED button on mount
  useEffect(() => {
    if (isFilterActive === null) return;
    
    // Wait for DOM to be ready
    const applyFilterState = () => {
      const filterBar = document.querySelector('.filter-bar');
      const ledButton = document.querySelector('.led-button');
      
      if (filterBar && ledButton) {
        if (isFilterActive) {
          filterBar.classList.add('active');
          ledButton.classList.add('active');
        } else {
          filterBar.classList.remove('active');
          ledButton.classList.remove('active');
        }
      }
    };
    
    // Try immediately and after a delay (in case DOM is still loading)
    applyFilterState();
    const timer = setTimeout(applyFilterState, 100);
    
    return () => clearTimeout(timer);
  }, [isFilterActive]);
  
  return {
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
  };
}
