/**
 * Entity Validator
 * Centralized entity validation with clear error messages
 * 
 * Philosophy: Single source of truth for entity validation
 * No fallbacks, explicit errors, consistent messaging
 * Hot-reload: Reads fresh config on every validation
 */

import { getConfig } from './configLoader.js';
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
  /**
   * Validate entity from botParams
   * Returns validation result with entity or error reason
   * 
   * Hot-reload: Reads fresh config on every validation
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

    // Get fresh config for hot-reload
    const config = getConfig();
    
    // Try to find entity in fresh config
    const entity = config.entities.find((e: any) => e.id === botParams.entity);
    
    if (!entity) {
      console.error(chalk.red('[VALIDATION]'), 
        `Entity "${botParams.entity}" not found - message ID: ${messageContext.id}`);
      
      // Show available entities for debugging
      const availableIds = config.entities
        .filter((e: any) => e.enabled)
        .map((e: any) => e.id);
      console.log(chalk.gray('[AVAILABLE]'), availableIds.join(', '));
      
      return { 
        valid: false, 
        reason: `Entity "${botParams.entity}" not found` 
      };
    }

    // Valid entity found (fresh from config)
    return { 
      valid: true, 
      entity 
    };
  }

  /**
   * Get a list of available entity IDs
   * Useful for error messages (fresh read)
   */
  getAvailableEntities(): string[] {
    const config = getConfig();
    return config.entities
      .filter((e: any) => e.enabled)
      .map((e: any) => e.id);
  }
}

