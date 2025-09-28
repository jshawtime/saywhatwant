/**
 * Model Configuration Loader
 * Handles loading and managing AI model configurations from separate config files
 */

export interface ModelEntity {
  id: string;
  enabled: boolean;
  username: string;
  model: string;
  greeting?: string;  // Programmatic greeting to show
  systemPrompt: string;
  userPrompt?: string;
  messagesToRead: number;
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
  traits?: {
    style: string;
    mood: string;
    interests: string[];
  };
  conversationSettings?: {
    respondsToHumanMessages: boolean;
    respondsToAllAiMessages: boolean;
    respondsToTheseAiOnly: string[];
  };
}

export interface ModelConfigFile {
  entities: ModelEntity[];
  globalSettings?: {
    minTimeBetweenMessages?: number;
    maxMessagesPerMinute?: number;
    requireHumanActivity?: boolean;
    defaultModel?: string;
  };
}

export class ModelConfigLoader {
  private static instance: ModelConfigLoader;
  private configCache: Map<string, ModelConfigFile> = new Map();
  private loadingPromises: Map<string, Promise<ModelConfigFile>> = new Map();
  
  private constructor() {}
  
  static getInstance(): ModelConfigLoader {
    if (!ModelConfigLoader.instance) {
      ModelConfigLoader.instance = new ModelConfigLoader();
    }
    return ModelConfigLoader.instance;
  }
  
  /**
   * Load model configuration from file
   */
  async loadModelConfig(modelName: string): Promise<ModelEntity | null> {
    try {
      // Check cache first
      let config = this.configCache.get(modelName);
      
      if (!config) {
        // Check if already loading
        let loadingPromise = this.loadingPromises.get(modelName);
        
        if (!loadingPromise) {
          // Start loading
          loadingPromise = this.fetchConfig(modelName);
          this.loadingPromises.set(modelName, loadingPromise);
        }
        
        config = await loadingPromise;
        this.configCache.set(modelName, config);
        this.loadingPromises.delete(modelName);
      }
      
      // Find the main entity (usually id: "main" or first entity)
      const entity = config.entities.find(e => e.id === 'main') || config.entities[0];
      
      // Add default greeting if not present
      if (entity && !entity.greeting) {
        entity.greeting = 'Hello!';
      }
      
      return entity || null;
      
    } catch (error) {
      console.error(`[ModelConfigLoader] Failed to load config for ${modelName}:`, error);
      
      // Try fallback to main config
      return this.loadFromMainConfig(modelName);
    }
  }
  
  /**
   * Fetch configuration file from server
   */
  private async fetchConfig(modelName: string): Promise<ModelConfigFile> {
    // Try specific model config file
    const configPath = `/ai/config-${modelName}.json`;
    
    try {
      const response = await fetch(configPath);
      
      if (!response.ok) {
        throw new Error(`Config not found: ${configPath}`);
      }
      
      const config: ModelConfigFile = await response.json();
      return config;
      
    } catch (error) {
      // If specific config doesn't exist, try to load from main entities config
      console.log(`[ModelConfigLoader] No specific config for ${modelName}, checking main config`);
      throw error;
    }
  }
  
  /**
   * Fallback: Load from main entities config
   */
  private async loadFromMainConfig(modelName: string): Promise<ModelEntity | null> {
    try {
      const response = await fetch('/ai/config-aientities.json');
      
      if (!response.ok) {
        throw new Error('Failed to load main entities config');
      }
      
      const config = await response.json();
      
      // Find entity by model name
      const entity = config.entities?.find(
        (e: ModelEntity) => e.model === modelName
      );
      
      if (entity) {
        // Add default greeting if not present
        if (!entity.greeting) {
          entity.greeting = 'Hello!';
        }
        return entity;
      }
      
      return null;
      
    } catch (error) {
      console.error('[ModelConfigLoader] Failed to load from main config:', error);
      return null;
    }
  }
  
  /**
   * Load multiple model configurations
   */
  async loadMultipleConfigs(modelNames: string[]): Promise<ModelEntity[]> {
    const configs = await Promise.all(
      modelNames.map(name => this.loadModelConfig(name))
    );
    
    return configs.filter((c): c is ModelEntity => c !== null);
  }
  
  /**
   * Clear cache for a specific model or all models
   */
  clearCache(modelName?: string): void {
    if (modelName) {
      this.configCache.delete(modelName);
      this.loadingPromises.delete(modelName);
    } else {
      this.configCache.clear();
      this.loadingPromises.clear();
    }
  }
  
  /**
   * Create default greeting message
   */
  createGreetingMessage(entity: ModelEntity): string {
    return entity.greeting || `Hello! I'm ${entity.username}.`;
  }
  
  /**
   * Get model parameters for LM Studio request
   */
  getModelParameters(entity: ModelEntity) {
    return {
      model: entity.model,
      temperature: entity.temperature || 0.7,
      max_tokens: entity.maxTokens || 150,
      top_p: entity.topP || 1,
      top_k: entity.topK || 40,
      repeat_penalty: entity.repeatPenalty || 1.1,
      min_p: entity.minP || 0,
      stream: false
    };
  }
  
  /**
   * Build system prompt for the model
   */
  buildSystemPrompt(entity: ModelEntity, context?: string): string {
    let prompt = entity.systemPrompt;
    
    if (entity.userPrompt) {
      prompt += `\n\n${entity.userPrompt}`;
    }
    
    if (context) {
      prompt += `\n\nContext: ${context}`;
    }
    
    return prompt;
  }
}
