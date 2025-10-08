/**
 * Entity Manager Module
 * Handles AI entity selection, rotation, and state management
 */

import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
// import chalk from 'chalk'; // Unused - commented out
import { logger } from '../console-logger.js';

// Types
export interface AIEntity {
  id: string;
  enabled: boolean;
  username: string;
  model: string;
  systemPrompt: string;
  systemRole: 'system' | 'assistant' | 'user';  // LLM role for system prompt - REQUIRED
  userPrompt?: string;
  nom: number;  // Number of messages to send as context to LLM
  defaultPriority: number;  // Default queue priority for this entity
  temperature: number;
  maxTokens: number;
  topP: number;
  topK: number;
  repeatPenalty: number;
  minP: number;
  responseChance: number;
  color: string;
  rateLimits: {
    minSecondsBetweenPosts: number;
    maxPostsPerMinute: number;
    maxPostsPerHour: number;
  };
  conversationSettings: {
    respondsToHumanMessages: boolean;
    respondsToAllAiMessages: boolean;
    respondsToTheseAiOnly: string[];
  };
}

export interface EntityState {
  currentEntity: AIEntity;
  rateLimits: Map<string, EntityRateLimit>;
}

export interface EntityRateLimit {
  lastPostTime: number;
  postsThisMinute: number;
  postsThisHour: number;
  minuteResetTime: number;
  hourResetTime: number;
}

/**
 * Entity Manager Class
 * Manages AI entity selection and rate limiting
 */
export class EntityManager {
  private entities: AIEntity[] = [];
  private currentEntity: AIEntity | null = null;
  private rateLimits: Map<string, EntityRateLimit> = new Map();
  
  constructor() {
    this.loadEntities();
    this.initializeRateLimits();
    this.selectRandomEntity();
  }
  
  /**
   * Load entities from configuration file
   */
  private loadEntities(): void {
    try {
      const __dirname = dirname(fileURLToPath(import.meta.url));
      const configPath = join(__dirname, '../../config-aientities.json');
      const configData = readFileSync(configPath, 'utf-8');
      const config = JSON.parse(configData);
      
      this.entities = config.entities.filter((e: AIEntity) => e.enabled !== false);
      
      if (this.entities.length === 0) {
        logger.error('No enabled entities found in configuration');
        throw new Error('No enabled entities found');
      }
      
      logger.info(`Loaded ${this.entities.length} enabled AI entities`);
    } catch (error) {
      logger.error('Failed to load entities:', error);
      throw error;
    }
  }
  
  /**
   * Initialize rate limits for all entities
   */
  private initializeRateLimits(): void {
    const now = Date.now();
    
    for (const entity of this.entities) {
      this.rateLimits.set(entity.id, {
        lastPostTime: 0,
        postsThisMinute: 0,
        postsThisHour: 0,
        minuteResetTime: now + 60000,
        hourResetTime: now + 3600000,
      });
    }
  }
  
  /**
   * Select a random entity from enabled entities
   */
  public selectRandomEntity(): AIEntity {
    const enabledEntities = this.entities.filter(e => e.enabled);
    
    if (enabledEntities.length === 0) {
      throw new Error('No enabled entities available');
    }
    
    const selected = enabledEntities[Math.floor(Math.random() * enabledEntities.length)];
    this.currentEntity = selected;
    
    logger.debug(`Selected entity: ${selected.username} (${selected.id})`);
    return selected;
  }
  
  /**
   * Get the current entity
   */
  public getCurrentEntity(): AIEntity {
    if (!this.currentEntity) {
      return this.selectRandomEntity();
    }
    return this.currentEntity;
  }
  
  /**
   * Get entity by ID
   */
  public getEntityById(id: string): AIEntity | undefined {
    return this.entities.find(e => e.id === id);
  }
  
  /**
   * Check rate limits for current entity
   */
  public checkRateLimits(entityId: string): { allowed: boolean; reason?: string } {
    const now = Date.now();
    const limits = this.rateLimits.get(entityId);
    const entity = this.getEntityById(entityId);
    
    if (!limits || !entity) {
      return { allowed: false, reason: 'Entity not found' };
    }
    
    // Reset counters if needed
    if (now >= limits.minuteResetTime) {
      limits.postsThisMinute = 0;
      limits.minuteResetTime = now + 60000;
    }
    
    if (now >= limits.hourResetTime) {
      limits.postsThisHour = 0;
      limits.hourResetTime = now + 3600000;
    }
    
    // Check minute limit
    if (limits.postsThisMinute >= entity.rateLimits.maxPostsPerMinute) {
      return { allowed: false, reason: `Rate limit exceeded (${entity.rateLimits.maxPostsPerMinute}/min)` };
    }
    
    // Check hour limit
    if (limits.postsThisHour >= entity.rateLimits.maxPostsPerHour) {
      return { allowed: false, reason: `Rate limit exceeded (${entity.rateLimits.maxPostsPerHour}/hour)` };
    }
    
    // Check minimum time between posts
    const timeSinceLastPost = now - limits.lastPostTime;
    if (timeSinceLastPost < (entity.rateLimits.minSecondsBetweenPosts * 1000)) {
      const waitTime = Math.ceil((entity.rateLimits.minSecondsBetweenPosts * 1000 - timeSinceLastPost) / 1000);
      return { allowed: false, reason: `Must wait ${waitTime}s before posting` };
    }
    
    return { allowed: true };
  }
  
  /**
   * Record a post for rate limiting
   */
  public recordPost(entityId: string): void {
    const limits = this.rateLimits.get(entityId);
    if (!limits) return;
    
    limits.lastPostTime = Date.now();
    limits.postsThisMinute++;
    limits.postsThisHour++;
    
    logger.debug(`[${entityId}] Posts: ${limits.postsThisMinute}/min, ${limits.postsThisHour}/hour`);
  }
  
  /**
   * Get all enabled entities
   */
  public getEnabledEntities(): AIEntity[] {
    return this.entities.filter(e => e.enabled);
  }
  
  /**
   * Get entity usernames for a list of IDs
   */
  public getEntityUsernames(ids: string[]): string[] {
    return ids
      .map(id => this.getEntityById(id)?.username)
      .filter((username): username is string => username !== undefined);
  }
}

// Singleton instance
let entityManagerInstance: EntityManager | null = null;

export function getEntityManager(): EntityManager {
  if (!entityManagerInstance) {
    entityManagerInstance = new EntityManager();
  }
  return entityManagerInstance;
}
