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
  // Parse URL immediately to get initial state
  const getInitialState = () => {
    const state = {
      filterActive: null as boolean | null,
      humanUsername: null as string | null,
      humanColor: null as string | null,
      aiUsername: null as string | null,
      aiColor: null as string | null,
    };
    
    if (typeof window === 'undefined') return state;
    const hash = window.location.hash.slice(1);
    if (!hash) return state;
    
    const params = hash.split('&');
    for (const param of params) {
      const [key, value] = param.split('=');
      
      switch (key) {
        case 'filteractive':
          console.log('[useModelURL] Initial filteractive found:', value);
          state.filterActive = value === 'true';
          break;
          
        case 'uis':
          const uisParts = value?.split(':');
          if (uisParts?.length === 2) {
            state.humanUsername = decodeURIComponent(uisParts[0]);
            state.humanColor = uisParts[1];
            console.log('[useModelURL] Initial uis found:', state.humanUsername, state.humanColor);
          }
          break;
          
        case 'ais':
          const aisParts = value?.split(':');
          if (aisParts?.length === 2) {
            state.aiUsername = decodeURIComponent(aisParts[0]);
            state.aiColor = aisParts[1];
            console.log('[useModelURL] Initial ais found:', state.aiUsername, state.aiColor);
          }
          break;
      }
    }
    
    return state;
  };
  
  // Get initial state from URL
  const initialState = getInitialState();
  
  // Apply initial username/color to localStorage if present
  if (typeof window !== 'undefined') {
    if (initialState.humanUsername) {
      localStorage.setItem('sww-username', initialState.humanUsername);
    }
    if (initialState.humanColor) {
      localStorage.setItem('sww-usercolor', initialState.humanColor);
    }
  }
  
  // State - Initialize with URL values if present
  const [isFilterActive, setIsFilterActive] = useState<boolean | null>(initialState.filterActive);
  const [currentDomain, setCurrentDomain] = useState<string | null>(null);
  const [modelMessages, setModelMessages] = useState<ModelMessage[]>([]);
  const [isProcessingQueue, setIsProcessingQueue] = useState(false);
  const [humanUsername, setHumanUsername] = useState<string | null>(initialState.humanUsername);
  const [humanColor, setHumanColor] = useState<string | null>(initialState.humanColor);
  const [aiUsername, setAiUsername] = useState<string | null>(initialState.aiUsername);
  const [aiColor, setAiColor] = useState<string | null>(initialState.aiColor);
  
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
