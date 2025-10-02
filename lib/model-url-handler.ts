/**
 * Model URL Handler
 * Handles model parameter from URL and integrates with the chat system
 */

import { URLEnhancementsManager, EnhancedFilterState, ModelConfig } from './url-enhancements';
import { ModelConfigLoader, ModelEntity } from './model-config-loader';
import { URLFilterManager } from './url-filter-manager';

export interface ModelMessage {
  id: string;
  timestamp: number;
  username: string;
  text: string;
  userColor: string;
  isGreeting?: boolean;
  isModelResponse?: boolean;
  domain?: string;
}

export interface ModelResponseQueue {
  models: ModelEntity[];
  currentIndex: number;
  isProcessing: boolean;
}

export class ModelURLHandler {
  private static instance: ModelURLHandler;
  private urlEnhancementsManager: URLEnhancementsManager;
  private modelConfigLoader: ModelConfigLoader;
  private urlFilterManager: URLFilterManager;
  private responseQueue: ModelResponseQueue = {
    models: [],
    currentIndex: 0,
    isProcessing: false
  };
  private subscribers = new Set<(event: ModelHandlerEvent) => void>();
  private hasProcessedInitialURL = false;
  
  private constructor() {
    this.urlEnhancementsManager = URLEnhancementsManager.getInstance();
    this.modelConfigLoader = ModelConfigLoader.getInstance();
    this.urlFilterManager = URLFilterManager.getInstance();
    
    // Listen for hash changes
    if (typeof window !== 'undefined') {
      window.addEventListener('hashchange', () => {
        console.log('[ModelURLHandler] Hash changed, processing new URL');
        this.processURLChange();
      });
    }
  }
  
  static getInstance(): ModelURLHandler {
    if (!ModelURLHandler.instance) {
      ModelURLHandler.instance = new ModelURLHandler();
    }
    return ModelURLHandler.instance;
  }
  
  /**
   * Initialize and process URL parameters on page load
   */
  async initialize(): Promise<void> {
    if (this.hasProcessedInitialURL) {
      return;
    }
    
    this.hasProcessedInitialURL = true;
    
    // Parse enhanced URL
    const state = this.urlEnhancementsManager.parseEnhancedHash();
    console.log('[ModelURLHandler] Initial parsed state:', state);
    
    // Process random colors first
    if (this.urlEnhancementsManager.hasRandomColors(state)) {
      const updatedState = await this.urlEnhancementsManager.processRandomColors(state);
      await this.applyState(updatedState);
    } else {
      await this.applyState(state);
    }
  }
  
  /**
   * Process URL changes (hashchange event)
   */
  async processURLChange(): Promise<void> {
    console.log('[ModelURLHandler] Processing URL change');
    
    // Parse enhanced URL
    const state = this.urlEnhancementsManager.parseEnhancedHash();
    console.log('[ModelURLHandler] New parsed state:', state);
    
    // Clear previous state
    this.responseQueue = {
      models: [],
      currentIndex: 0,
      isProcessing: false
    };
    
    // Process random colors first
    if (this.urlEnhancementsManager.hasRandomColors(state)) {
      const updatedState = await this.urlEnhancementsManager.processRandomColors(state);
      await this.applyState(updatedState);
    } else {
      await this.applyState(state);
    }
  }
  
  /**
   * Apply state from URL parameters
   * DEFER all event emissions to avoid React #418 error (updating component during render)
   */
  private async applyState(state: EnhancedFilterState): Promise<void> {
    // Defer all emissions until after current render completes
    // This prevents "Cannot update a component while rendering a different component" error
    queueMicrotask(() => {
      // Handle filter active state
      if (state.filterActive !== null && state.filterActive !== undefined) {
        console.log('[ModelURLHandler] Emitting filter-active-changed:', state.filterActive);
        this.emit({
          type: 'filter-active-changed',
          isActive: state.filterActive
        });
      }
      
      // Handle user initial state
      if (state.userInitialState) {
        this.emit({
          type: 'user-state-changed',
          username: state.userInitialState.username,
          color: state.userInitialState.color
        });
        
        // Update localStorage for current tab
        this.updateUserLocalStorage(state.userInitialState.username, state.userInitialState.color);
      }
      
      // Handle AI initial state
      if (state.aiInitialState) {
        this.emit({
          type: 'ai-state-changed',
          username: state.aiInitialState.username,
          color: state.aiInitialState.color
        });
      }
    });
    
    // Handle model configurations
    if (state.modelConfigs && state.modelConfigs.length > 0) {
      await this.processModelConfigs(state.modelConfigs);
    }
  }
  
  /**
   * Process model configurations from URL
   */
  private async processModelConfigs(modelConfigs: ModelConfig[]): Promise<void> {
    // Load all model entities
    const models: ModelEntity[] = [];
    
    for (const config of modelConfigs) {
      const entity = await this.modelConfigLoader.loadModelConfig(config.modelName);
      if (entity) {
        // Apply color from URL if specified
        if (config.color && config.color !== 'pending') {
          entity.color = config.color;
        }
        models.push(entity);
      } else {
        console.warn(`[ModelURLHandler] Could not load model: ${config.modelName}`);
      }
    }
    
    if (models.length === 0) {
      console.warn('[ModelURLHandler] No valid models found to process');
      return;
    }
    
    // Update domain/title to first model
    const firstModel = models[0];
    this.updateDomainAndTitle(firstModel);
    
    // Setup response queue
    this.responseQueue = {
      models,
      currentIndex: 0,
      isProcessing: true
    };
    
    // Start processing greetings and responses
    await this.processQueue();
  }
  
  /**
   * Process the model response queue
   */
  private async processQueue(): Promise<void> {
    if (!this.responseQueue.isProcessing || this.responseQueue.currentIndex >= this.responseQueue.models.length) {
      this.responseQueue.isProcessing = false;
      this.emit({
        type: 'queue-complete'
      });
      return;
    }
    
    const currentModel = this.responseQueue.models[this.responseQueue.currentIndex];
    
    // First, show the greeting
    await this.showGreeting(currentModel);
    
    // Then trigger the model response (this will be handled by the AI bot system)
    this.emit({
      type: 'trigger-model-response',
      model: currentModel,
      isLastInQueue: this.responseQueue.currentIndex === this.responseQueue.models.length - 1
    });
    
    // Move to next model
    this.responseQueue.currentIndex++;
  }
  
  /**
   * Show programmatic greeting for a model
   */
  private async showGreeting(model: ModelEntity): Promise<void> {
    const greeting = this.modelConfigLoader.createGreetingMessage(model);
    
    const message: ModelMessage = {
      id: `greeting-${model.id}-${Date.now()}`,
      timestamp: Date.now(),
      username: model.username,
      text: greeting,
      userColor: model.color,
      isGreeting: true,
      domain: model.model
    };
    
    this.emit({
      type: 'greeting-message',
      message
    });
    
    // Small delay to make it feel more natural
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  /**
   * Continue to next model in queue (called after AI response completes)
   */
  async continueQueue(): Promise<void> {
    if (this.responseQueue.isProcessing) {
      await this.processQueue();
    }
  }
  
  /**
   * Update domain and title for model conversation
   */
  private updateDomainAndTitle(model: ModelEntity): void {
    if (typeof document !== 'undefined') {
      // Update page title
      const originalTitle = document.title;
      document.title = `${model.username} - Say What Want`;
      
      // Store original title for restoration
      (window as any).__originalPageTitle = originalTitle;
    }
    
    this.emit({
      type: 'domain-changed',
      domain: model.model,
      username: model.username
    });
  }
  
  /**
   * Update user localStorage for current tab
   */
  private updateUserLocalStorage(username: string, color: string): void {
    if (typeof localStorage !== 'undefined') {
      // Store in a tab-specific key (could use sessionStorage too)
      const userState = {
        username,
        color,
        timestamp: Date.now()
      };
      localStorage.setItem('sww-user-state', JSON.stringify(userState));
    }
  }
  
  /**
   * Subscribe to handler events
   */
  subscribe(callback: (event: ModelHandlerEvent) => void): () => void {
    this.subscribers.add(callback);
    return () => this.subscribers.delete(callback);
  }
  
  /**
   * Emit event to subscribers
   */
  private emit(event: ModelHandlerEvent): void {
    this.subscribers.forEach(callback => {
      try {
        callback(event);
      } catch (error) {
        console.error('[ModelURLHandler] Subscriber error:', error);
      }
    });
  }
  
  /**
   * Get current queue status
   */
  getQueueStatus(): ModelResponseQueue {
    return { ...this.responseQueue };
  }
  
  /**
   * Check if models are currently processing
   */
  isProcessing(): boolean {
    return this.responseQueue.isProcessing;
  }
  
  /**
   * Get filtered context for model (only messages from conversation participants)
   */
  getFilteredContext(messages: any[], model: ModelEntity): any[] {
    const state = this.urlEnhancementsManager.parseEnhancedHash();
    
    // Get participants
    const participants = new Set<string>();
    
    // Add human user if specified
    if (state.userInitialState) {
      participants.add(state.userInitialState.username.toLowerCase());
    }
    
    // Add AI participants
    if (state.aiInitialState) {
      participants.add(state.aiInitialState.username.toLowerCase());
    }
    
    // Add all models in conversation
    state.modelConfigs?.forEach(config => {
      const entity = this.responseQueue.models.find(m => 
        m.model === config.modelName || m.id === config.modelName
      );
      if (entity) {
        participants.add(entity.username.toLowerCase());
      }
    });
    
    // If no participants specified, include all messages
    if (participants.size === 0) {
      return messages;
    }
    
    // Filter messages to only include participants
    return messages.filter(msg => {
      const username = (msg.username || '').toLowerCase();
      return participants.has(username);
    });
  }
}

// Event types
export type ModelHandlerEvent = 
  | { type: 'filter-active-changed'; isActive: boolean }
  | { type: 'user-state-changed'; username: string; color: string }
  | { type: 'ai-state-changed'; username: string; color: string }
  | { type: 'greeting-message'; message: ModelMessage }
  | { type: 'trigger-model-response'; model: ModelEntity; isLastInQueue: boolean }
  | { type: 'domain-changed'; domain: string; username: string }
  | { type: 'queue-complete' };
