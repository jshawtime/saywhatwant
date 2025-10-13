/**
 * Entity Validator
 * Centralized entity validation with clear error messages
 * 
 * Philosophy: Single source of truth for entity validation
 * No fallbacks, explicit errors, consistent messaging
 */

import { EntityManager } from './entityManager.js';
import chalk from 'chalk';

export interface ValidationResult {
  valid: boolean;
  entity?: any;
  reason?: string;
}

export interface MessageContext {
  id: string;
  text: string;
}

export class EntityValidator {
  constructor(private entityManager: EntityManager) {}

  /**
   * Validate entity from botParams
   * Returns validation result with entity or error reason
   * 
   * @param botParams - Bot parameters from message
   * @param messageContext - Message ID and text for logging
   * @returns ValidationResult with entity if valid, reason if invalid
   */
  validateEntity(
    botParams: any, 
    messageContext: MessageContext
  ): ValidationResult {
    const textPreview = messageContext.text.substring(0, 30);
    
    // No botParams at all
    if (!botParams) {
      console.log(chalk.yellow('[VALIDATION]'), 
        `No botParams in message "${textPreview}..."`);
      return { 
        valid: false, 
        reason: 'No botParams' 
      };
    }

    // No entity specified in botParams
    if (!botParams.entity) {
      console.log(chalk.yellow('[VALIDATION]'), 
        `No entity specified in message "${textPreview}..."`);
      return { 
        valid: false, 
        reason: 'No entity in botParams' 
      };
    }

    // Try to find entity in config
    const entity = this.entityManager.getEntityById(botParams.entity);
    
    if (!entity) {
      console.error(chalk.red('[VALIDATION]'), 
        `Entity "${botParams.entity}" not found - message ID: ${messageContext.id}`);
      
      // Show available entities for debugging
      const availableIds = this.entityManager.getEnabledEntities().map(e => e.id);
      console.log(chalk.gray('[AVAILABLE]'), availableIds.join(', '));
      
      return { 
        valid: false, 
        reason: `Entity "${botParams.entity}" not found` 
      };
    }

    // Valid entity found
    return { 
      valid: true, 
      entity 
    };
  }

  /**
   * Get a list of available entity IDs
   * Useful for error messages
   */
  getAvailableEntities(): string[] {
    return this.entityManager.getEnabledEntities().map(e => e.id);
  }
}

