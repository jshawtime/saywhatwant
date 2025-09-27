/**
 * LM Studio Cluster Module - CLOSED SYSTEM VERSION
 * No background processes, pure on-demand operation
 */

import fetch from 'node-fetch';
import { logger } from '../console-logger.js';

// Server status types
export type ServerStatus = 'available' | 'busy' | 'loading' | 'offline';

// LM Studio server interface
export interface LMStudioServer {
  ip: string;
  port: number;
  name: string;
  status: ServerStatus;
  loadedModels: Set<string>;      // Models currently in memory (state: loaded)
  availableModels: Set<string>;    // All models on disk (loaded + not-loaded)
  lastHealthCheck: number;
  requestsInFlight: number;
  capabilities: {
    maxMemory: number;
    availableMemory: number;
    supportedFormats: ('GGUF' | 'MLX')[];
    maxConcurrentModels: number;
  };
  lastUsedModel?: string;
  lastUsedTime?: number;
}

// Cluster configuration
export interface ClusterConfig {
  servers: Array<{
    ip: string;
    port: number;
    name: string;
    enabled: boolean;
    capabilities: {
      maxMemory: number;
      preferredModels?: string[];
      supportedFormats?: ('GGUF' | 'MLX')[];
    };
  }>;
  pollInterval?: number;
  maxLoadAttempts?: number;
  loadBalancingStrategy?: 'least-loaded' | 'round-robin' | 'model-affinity';
  keepModelsLoaded?: boolean;
}

/**
 * Closed System LM Studio Cluster
 * Each request is self-contained - no background processes
 */
export class LMStudioCluster {
  private servers: Map<string, LMStudioServer> = new Map();
  private modelSizes: Map<string, number> = new Map();
  private config: ClusterConfig;

  constructor(config: ClusterConfig) {
    this.config = config;
    
    // Set defaults
    this.config.pollInterval = this.config.pollInterval || 5000;
    this.config.maxLoadAttempts = this.config.maxLoadAttempts || 60;
    this.config.keepModelsLoaded = this.config.keepModelsLoaded !== false;
    
    this.initializeServers();
    this.initializeModelSizes();
    
    logger.info('[Cluster] Closed system initialized - no background processes');
  }

  /**
   * Initialize servers from configuration
   */
  private initializeServers() {
    if (!this.config.servers || this.config.servers.length === 0) {
      logger.warn('[Cluster] No servers configured');
      return;
    }
    
    for (const serverConfig of this.config.servers) {
      if (!serverConfig.enabled) continue;

      const serverId = `${serverConfig.ip}:${serverConfig.port}`;
      const server: LMStudioServer = {
        ip: serverConfig.ip,
        port: serverConfig.port,
        name: serverConfig.name,
        status: 'offline',
        loadedModels: new Set(),
        availableModels: new Set(),
        lastHealthCheck: 0,
        requestsInFlight: 0,
        capabilities: {
          maxMemory: serverConfig.capabilities.maxMemory,
          availableMemory: serverConfig.capabilities.maxMemory,
          supportedFormats: serverConfig.capabilities.supportedFormats || ['GGUF', 'MLX'],
          maxConcurrentModels: 5,
        },
      };

      this.servers.set(serverId, server);
      logger.info(`[Cluster] Server ${server.name} (${serverId}) registered`);
    }
  }

  /**
   * Initialize model size estimates
   */
  private initializeModelSizes() {
    this.modelSizes.set('highermind_the-eternal-1', 29);
    this.modelSizes.set('google/gemma-3-27b', 17);
    this.modelSizes.set('llama-70b', 40);
    this.modelSizes.set('llama-30b', 20);
    this.modelSizes.set('llama-7b', 4);
    this.modelSizes.set('mistral-7b', 4);
    this.modelSizes.set('mixtral-8x7b', 45);
    this.modelSizes.set('qwen/qwen2.5-vl-7b', 10);
    this.modelSizes.set('text-embedding-nomic-embed-text-v1.5', 2);
  }

  /**
   * Check server status RIGHT NOW (closed system)
   * Uses the NEW LM Studio REST API for accurate model state
   */
  private async checkServerNow(server: LMStudioServer): Promise<boolean> {
    try {
      // Use the LM Studio REST API that shows state field
      const response = await fetch(`http://${server.ip}:${server.port}/api/v0/models`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });
      
      if (response.ok) {
        const data = await response.json() as any;
        
        // Update server state
        server.status = 'available';
        server.lastHealthCheck = Date.now();
        
        // Accurately track loaded vs available models using state field
        const loadedModels = new Set<string>();
        const availableModels = new Set<string>();
        
        for (const model of (data.data || [])) {
          availableModels.add(model.id);
          if (model.state === 'loaded') {
            loadedModels.add(model.id);
          }
        }
        
        server.loadedModels = loadedModels;
        server.availableModels = availableModels;
        
        // Calculate memory usage based on ACTUALLY loaded models
        let usedMemory = 0;
        for (const modelId of loadedModels) {
          usedMemory += this.estimateModelSize(modelId);
        }
        server.capabilities.availableMemory = server.capabilities.maxMemory - usedMemory;
        
        logger.debug(`[Cluster] ${server.name}: ${loadedModels.size} loaded, ${availableModels.size - loadedModels.size} available`);
        
        return true;
      }
      
      // Fallback to OpenAI endpoint if v0 API not available (older LM Studio)
      const fallbackResponse = await fetch(`http://${server.ip}:${server.port}/v1/models`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });
      
      if (fallbackResponse.ok) {
        const data = await fallbackResponse.json() as any;
        server.status = 'available';
        server.lastHealthCheck = Date.now();
        // With v1 API, we can't distinguish loaded vs available
        server.loadedModels = new Set(data.data?.map((m: any) => m.id) || []);
        server.availableModels = server.loadedModels; // Assume all shown are available
        logger.warn(`[Cluster] ${server.name}: Using legacy API, can't distinguish loaded vs available`);
        return true;
      }
    } catch (error) {
      server.status = 'offline';
    }
    
    return false;
  }

  /**
   * Find available server RIGHT NOW (closed system)
   */
  private async findAvailableServerNow(modelName: string): Promise<LMStudioServer | null> {
    const availableServers: LMStudioServer[] = [];
    const serversWithModel: LMStudioServer[] = [];
    
    // Check ALL servers first to get complete picture
    for (const server of this.servers.values()) {
      logger.debug(`[Cluster] Checking ${server.name} (${server.ip}:${server.port})...`);
      if (await this.checkServerNow(server)) {
        availableServers.push(server);
        
        // Track which servers have the model loaded
        if (server.loadedModels.has(modelName)) {
          serversWithModel.push(server);
          logger.info(`[Cluster] ${server.name} has ${modelName} loaded (${server.capabilities.availableMemory}GB free)`);
        }
      } else {
        logger.warn(`[Cluster] ${server.name} is offline or unreachable`);
      }
    }
    
    // If multiple servers have the model, choose based on memory/load
    if (serversWithModel.length > 0) {
      // Round-robin between servers with the model
      // Use timestamp to distribute load
      const index = Math.floor(Date.now() / 1000) % serversWithModel.length;
      const selected = serversWithModel[index];
      logger.success(`[Cluster] Load balanced to ${selected.name} (${index + 1}/${serversWithModel.length} with model)`);
      return selected;
    }
    
    // No server has the model, return one with most free memory
    if (availableServers.length > 0) {
      const bestServer = availableServers.sort((a, b) => 
        b.capabilities.availableMemory - a.capabilities.availableMemory
      )[0];
      logger.info(`[Cluster] No server has ${modelName}, selected ${bestServer.name} (${bestServer.capabilities.availableMemory}GB free)`);
      return bestServer;
    }
    
    logger.error('[Cluster] No available servers found');
    return null;
  }

  /**
   * Load model and poll until ready
   */
  private async loadModelAndWait(server: LMStudioServer, modelName: string): Promise<void> {
    // Request model load
    try {
      const response = await fetch(`http://${server.ip}:${server.port}/v1/models/load`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          model: modelName,
          config: {
            keep_in_memory: this.config.keepModelsLoaded
          }
        }),
      });
      
      if (!response.ok) {
        logger.warn(`[Cluster] Load request returned ${response.status}`);
      }
    } catch (error) {
      logger.error(`[Cluster] Failed to request model load: ${error}`);
      throw error;
    }
    
    // Poll until loaded
    let attempts = 0;
    const maxAttempts = this.config.maxLoadAttempts || 60;
    const pollInterval = this.config.pollInterval || 5000;
    
    while (attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, pollInterval));
      attempts++;
      
      // Check if model is loaded
      if (await this.checkServerNow(server)) {
        if (server.loadedModels.has(modelName)) {
          logger.success(`[Cluster] Model ${modelName} loaded on ${server.name} after ${attempts * 5}s`);
          return;
        }
      }
      
      // Progress update every 30 seconds
      if (attempts % 6 === 0) {
        logger.info(`[Cluster] Still loading ${modelName}... (${attempts * 5}s elapsed)`);
      }
    }
    
    throw new Error(`Model ${modelName} failed to load after ${maxAttempts * 5} seconds`);
  }

  /**
   * Process request - CLOSED SYSTEM
   * Everything happens on-demand for this specific request
   */
  public async processRequest(request: any): Promise<any> {
    const { entityId, modelName, prompt, parameters, resolve, reject } = request;
    
    try {
      // Step 1: Find available server (checks status NOW)
      const server = await this.findAvailableServerNow(modelName);
      if (!server) {
        throw new Error('No healthy LM Studio servers available');
      }
      
      // Step 2: Load model if needed
      if (!server.loadedModels.has(modelName)) {
        logger.info(`[Cluster] Loading ${modelName} on ${server.name}`);
        await this.loadModelAndWait(server, modelName);
      }
      
      // Step 3: Send request
      server.requestsInFlight++;
      logger.success(`[Cluster] 🚀 Sending to ${server.name} (${server.ip}:${server.port}) - Entity: ${entityId}`);
      
      const response = await fetch(`http://${server.ip}:${server.port}/v1/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: modelName,
          messages: prompt,
          ...parameters,
        }),
      });
      
      if (!response.ok) {
        throw new Error(`Request failed: ${response.statusText}`);
      }
      
      const data = await response.json();
      server.requestsInFlight--;
      logger.success(`[Cluster] ✅ ${server.name} completed request for ${entityId}`);
      
      // Track usage
      server.lastUsedModel = modelName;
      server.lastUsedTime = Date.now();
      
      if (resolve) resolve(data);
      return data;
      
    } catch (error) {
      logger.error(`[Cluster] Error processing request: ${error}`);
      if (reject) reject(error);
      throw error;
    }
  }

  /**
   * Get cluster status (for monitoring)
   */
  public getClusterStatus(): any {
    const servers = Array.from(this.servers.values());
    const totalMemory = servers.reduce((sum, s) => sum + s.capabilities.maxMemory, 0);
    const availableMemory = servers.reduce((sum, s) => sum + s.capabilities.availableMemory, 0);
    
    return {
      totalServers: this.servers.size,
      healthyServers: servers.filter(s => s.status === 'available').length,
      totalMemory,
      availableMemory,
      loadedModels: Array.from(new Set(servers.flatMap(s => Array.from(s.loadedModels)))),
    };
  }

  /**
   * Estimate model size in GB
   */
  private estimateModelSize(modelName: string): number {
    return this.modelSizes.get(modelName) || 8;
  }

  /**
   * Shutdown (nothing to clean up in closed system!)
   */
  public async shutdown() {
    logger.info('[Cluster] Shutdown complete (closed system - no cleanup needed)');
  }
}
