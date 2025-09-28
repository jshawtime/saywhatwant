/**
 * Model URL Bridge
 * Connects the AI bot system to URL-triggered model conversations
 * This allows the bot to check if it should respond based on URL parameters
 */

export interface ModelURLContext {
  isProcessingQueue: boolean;
  currentDomain: string | null;
  currentModelEntity: any;
  filteredMessages: any[];
}

/**
 * Check if the bot should respond based on URL model triggers
 */
export function checkModelURLContext(): ModelURLContext | null {
  // This would be called from a browser context where the window APIs are available
  // In the bot context (Node.js), this will return null
  if (typeof window === 'undefined') {
    return null;
  }
  
  // Check for model URL integration
  const integration = (window as any).__commentsModelIntegration;
  if (!integration) {
    return null;
  }
  
  // Check if a model entity is currently active
  const currentEntity = (window as any).__currentModelEntity;
  if (!currentEntity) {
    return null;
  }
  
  return {
    isProcessingQueue: integration.isProcessingQueue,
    currentDomain: integration.currentDomain,
    currentModelEntity: currentEntity,
    filteredMessages: []
  };
}

/**
 * Get filtered messages for the current model conversation
 */
export function getFilteredMessagesForModel(messages: any[]): any[] {
  if (typeof window === 'undefined') {
    return messages;
  }
  
  const integration = (window as any).__commentsModelIntegration;
  if (!integration || !integration.getFilteredMessagesForModel) {
    return messages;
  }
  
  return integration.getFilteredMessagesForModel(messages);
}

/**
 * Signal that a model response has been completed
 */
export async function signalModelResponseComplete(): Promise<void> {
  if (typeof window === 'undefined') {
    return;
  }
  
  const integration = (window as any).__commentsModelIntegration;
  if (!integration || !integration.handleModelResponseComplete) {
    return;
  }
  
  await integration.handleModelResponseComplete();
}

/**
 * Check if URL-triggered models are active
 */
export function isModelURLActive(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }
  
  return !!(window as any).__currentModelEntity;
}
