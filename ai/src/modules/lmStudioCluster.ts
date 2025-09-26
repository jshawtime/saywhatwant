/**
 * LM Studio Cluster Module
 * Manages distributed LM Studio servers with multi-model support
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
  loadedModels: Set<string>;
  lastHealthCheck: number;
  requestsInFlight: number;
  capabilities: {
    maxMemory: number;        // Total RAM in GB
    availableMemory: number;  // Available RAM in GB
    supportedFormats: ('GGUF' | 'MLX')[];
    maxConcurrentModels: number;
  };
  lastUsedModel?: string;
  lastUsedTime?: number;
}

// Model request interface
export interface ModelRequest {
  model: string;
  prompt: string;
  parameters: {
    temperature?: number;
    maxTokens?: number;
    topP?: number;
    topK?: number;
    repeatPenalty?: number;
    minP?: number;
  };
  priority?: number;
}

// Health status interface
export interface HealthStatus {
  healthy: boolean;
  latency?: number;
  loadedModels?: string[];
  error?: string;
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
  modelLoadTimeout?: number;
  requestTimeout?: number;
  healthCheckInterval?: number;
  maxRetries?: number;
  loadBalancingStrategy?: 'least-loaded' | 'round-robin' | 'model-affinity';
  modelUnloadDelay?: number;
}

/**
 * LM Studio Cluster Manager
 * Handles distributed model serving across multiple LM Studio instances
 */
export class LMStudioCluster {
  private servers: Map<string, LMStudioServer> = new Map();
  private requestQueue: ModelRequest[] = [];
  private modelSizes: Map<string, number> = new Map();
  private healthCheckInterval?: NodeJS.Timeout;
  private config: ClusterConfig;
  private currentRoundRobinIndex = 0;

  constructor(config: ClusterConfig) {
    this.config = config;
    
    // Ensure config has required properties
    if (!this.config.servers) {
      this.config.servers = [];
      logger.warn('[Cluster] No servers configured, cluster will run in fallback mode');
    }
    
    this.initializeServers();
    this.initializeModelSizes();
    this.startHealthMonitoring();
  }

  /**
   * Initialize servers from configuration
   */
  private initializeServers() {
    if (!this.config.servers || this.config.servers.length === 0) {
      logger.warn('[Cluster] No servers to initialize');
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
        lastHealthCheck: 0,
        requestsInFlight: 0,
        capabilities: {
          maxMemory: serverConfig.capabilities.maxMemory,
          availableMemory: serverConfig.capabilities.maxMemory, // Start with full memory
          supportedFormats: serverConfig.capabilities.supportedFormats || ['GGUF', 'MLX'],
          maxConcurrentModels: Math.floor(serverConfig.capabilities.maxMemory / 20), // Estimate
        },
      };

      this.servers.set(serverId, server);
      logger.info(`[Cluster] Added server ${server.name} (${serverId}) with ${server.capabilities.maxMemory}GB RAM`);
    }
  }

  /**
   * Initialize known model sizes
   * TODO: This should be loaded from config or auto-detected
   */
  private initializeModelSizes() {
    // Your custom model
    this.modelSizes.set('highermind_the-eternal-1', 29);
    
    // Common models (examples)
    this.modelSizes.set('llama-70b', 40);
    this.modelSizes.set('llama-30b', 20);
    this.modelSizes.set('llama-7b', 4);
    this.modelSizes.set('mistral-7b', 4);
    this.modelSizes.set('google/gemma-3-27b', 17);
    this.modelSizes.set('mixtral-8x7b', 45);
    
    logger.debug(`[Cluster] Initialized model size database with ${this.modelSizes.size} models`);
  }

  /**
   * Start health monitoring for all servers
   */
  private startHealthMonitoring() {
    const interval = this.config.healthCheckInterval || 10000; // Default 10 seconds
    
    this.healthCheckInterval = setInterval(async () => {
      await this.pingAll();
    }, interval);

    // Do initial health check
    this.pingAll();
  }

  /**
   * Add a server to the cluster
   */
  public addServer(ip: string, port: number = 1234, config?: Partial<LMStudioServer['capabilities']>) {
    const serverId = `${ip}:${port}`;
    
    if (this.servers.has(serverId)) {
      logger.warn(`[Cluster] Server ${serverId} already exists`);
      return;
    }

    const server: LMStudioServer = {
      ip,
      port,
      name: `Server-${this.servers.size + 1}`,
      status: 'offline',
      loadedModels: new Set(),
      lastHealthCheck: 0,
      requestsInFlight: 0,
      capabilities: {
        maxMemory: config?.maxMemory || 32,
        availableMemory: config?.maxMemory || 32,
        supportedFormats: config?.supportedFormats || ['GGUF', 'MLX'],
        maxConcurrentModels: config?.maxConcurrentModels || 2,
      },
    };

    this.servers.set(serverId, server);
    logger.info(`[Cluster] Added server ${serverId} to cluster`);
    
    // Check health immediately
    this.healthCheck(server);
  }

  /**
   * Remove a server from the cluster
   */
  public removeServer(ip: string, port: number = 1234) {
    const serverId = `${ip}:${port}`;
    
    if (!this.servers.has(serverId)) {
      logger.warn(`[Cluster] Server ${serverId} not found`);
      return;
    }

    this.servers.delete(serverId);
    logger.info(`[Cluster] Removed server ${serverId} from cluster`);
  }

  /**
   * Get all healthy servers
   */
  public getHealthyServers(): LMStudioServer[] {
    return Array.from(this.servers.values()).filter(s => s.status !== 'offline');
  }

  /**
   * Get a specific server
   */
  public getServer(ip: string): LMStudioServer | undefined {
    // Try with default port first
    let server = this.servers.get(`${ip}:1234`);
    
    // If not found, search all servers
    if (!server) {
      for (const [id, s] of this.servers) {
        if (s.ip === ip) {
          server = s;
          break;
        }
      }
    }
    
    return server;
  }

  /**
   * Get servers that have a specific model loaded
   */
  private getServersWithModel(modelName: string): LMStudioServer[] {
    return Array.from(this.servers.values()).filter(
      server => server.status !== 'offline' && server.loadedModels.has(modelName)
    );
  }

  /**
   * Find the best available server for a model request
   */
  public async getAvailableServer(modelName?: string): Promise<LMStudioServer | null> {
    const strategy = this.config.loadBalancingStrategy || 'model-affinity';
    const healthyServers = this.getHealthyServers();

    if (healthyServers.length === 0) {
      logger.error('[Cluster] No healthy servers available');
      return null;
    }

    let selectedServer: LMStudioServer | null = null;

    switch (strategy) {
      case 'model-affinity':
        if (modelName) {
          // First, try servers that already have the model loaded
          const serversWithModel = healthyServers.filter(s => s.loadedModels.has(modelName));
          if (serversWithModel.length > 0) {
            // Pick the least loaded among them
            selectedServer = serversWithModel.sort((a, b) => a.requestsInFlight - b.requestsInFlight)[0];
            logger.debug(`[Cluster] Selected server ${selectedServer.name} (has model loaded)`);
          } else {
            // Pick server with most available memory
            selectedServer = healthyServers.sort((a, b) => 
              b.capabilities.availableMemory - a.capabilities.availableMemory
            )[0];
            logger.debug(`[Cluster] Selected server ${selectedServer.name} (most memory available)`);
          }
        }
        break;

      case 'least-loaded':
        selectedServer = healthyServers.sort((a, b) => a.requestsInFlight - b.requestsInFlight)[0];
        logger.debug(`[Cluster] Selected server ${selectedServer.name} (least loaded)`);
        break;

      case 'round-robin':
        this.currentRoundRobinIndex = (this.currentRoundRobinIndex + 1) % healthyServers.length;
        selectedServer = healthyServers[this.currentRoundRobinIndex];
        logger.debug(`[Cluster] Selected server ${selectedServer.name} (round robin)`);
        break;

      default:
        selectedServer = healthyServers[0];
    }

    return selectedServer;
  }

  /**
   * Queue a model request
   */
  public async queueRequest(request: ModelRequest): Promise<any> {
    logger.info(`[Cluster] Queuing request for model ${request.model}`);
    
    // Find best server for this request
    const server = await this.getAvailableServer(request.model);
    
    if (!server) {
      throw new Error('No available servers in cluster');
    }

    // Ensure model is loaded
    await this.ensureModelLoaded(server, request.model);

    // Send request to server
    return await this.sendRequest(server, request);
  }

  /**
   * Ensure a model is loaded on a server
   */
  public async ensureModelLoaded(server: LMStudioServer, modelName: string): Promise<void> {
    // Check if model already loaded
    if (server.loadedModels.has(modelName)) {
      logger.debug(`[Cluster] Model ${modelName} already loaded on ${server.name}`);
      server.lastUsedModel = modelName;
      server.lastUsedTime = Date.now();
      return;
    }

    // Estimate model size
    const modelSize = this.estimateModelSize(modelName);
    
    // Check if we have enough memory
    if (server.capabilities.availableMemory < modelSize) {
      logger.warn(`[Cluster] Need to free ${modelSize}GB for ${modelName} on ${server.name}`);
      
      // Find least recently used model to unload
      const lruModel = this.getLeastRecentlyUsedModel(server);
      if (lruModel) {
        await this.unloadSpecificModel(server, lruModel);
      }
    }

    // Load the model
    await this.loadModel(server, modelName);
  }

  /**
   * Load a model on a server
   */
  public async loadModel(server: LMStudioServer, modelName: string): Promise<void> {
    logger.info(`[Cluster] Loading ${modelName} on ${server.name}`);
    server.status = 'loading';

    try {
      const response = await fetch(`http://${server.ip}:${server.port}/v1/models/load`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          model: modelName,
          config: {
            keep_in_memory: true // Keep model in memory for fast switching
          }
        }),
        timeout: this.config.modelLoadTimeout || 120000, // 2 minutes default
      } as any);

      if (!response.ok) {
        throw new Error(`Failed to load model: ${response.statusText}`);
      }

      // Update server state
      server.loadedModels.add(modelName);
      const modelSize = this.estimateModelSize(modelName);
      server.capabilities.availableMemory -= modelSize;
      server.status = 'available';
      server.lastUsedModel = modelName;
      server.lastUsedTime = Date.now();

      logger.success(`[Cluster] Loaded ${modelName} on ${server.name} (${server.loadedModels.size} models now loaded)`);
    } catch (error) {
      logger.error(`[Cluster] Failed to load model on ${server.name}: ${error}`);
      server.status = 'available'; // Reset status
      throw error;
    }
  }

  /**
   * Unload a specific model from a server
   */
  public async unloadSpecificModel(server: LMStudioServer, modelName: string): Promise<void> {
    logger.info(`[Cluster] Unloading ${modelName} from ${server.name}`);

    try {
      const response = await fetch(`http://${server.ip}:${server.port}/v1/models/unload`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: modelName }),
      });

      if (!response.ok) {
        throw new Error(`Failed to unload model: ${response.statusText}`);
      }

      // Update server state
      server.loadedModels.delete(modelName);
      const modelSize = this.estimateModelSize(modelName);
      server.capabilities.availableMemory += modelSize;

      logger.info(`[Cluster] Unloaded ${modelName} from ${server.name}`);
    } catch (error) {
      logger.error(`[Cluster] Failed to unload model from ${server.name}: ${error}`);
      throw error;
    }
  }

  /**
   * Get currently loaded models on a server
   */
  public async getCurrentModels(server: LMStudioServer): Promise<string[]> {
    try {
      const response = await fetch(`http://${server.ip}:${server.port}/v1/models`);
      
      if (!response.ok) {
        throw new Error(`Failed to get models: ${response.statusText}`);
      }

      const data = await response.json() as { data: Array<{ id: string; loaded?: boolean }> };
      
      // Filter for loaded models
      const loadedModels = data.data
        .filter(m => m.loaded !== false) // Some APIs don't include 'loaded' field if true
        .map(m => m.id);

      return loadedModels;
    } catch (error) {
      logger.error(`[Cluster] Failed to get models from ${server.name}: ${error}`);
      return [];
    }
  }

  /**
   * Health check a single server
   */
  public async healthCheck(server: LMStudioServer): Promise<HealthStatus> {
    const startTime = Date.now();
    
    try {
      const response = await fetch(`http://${server.ip}:${server.port}/v1/models`, {
        timeout: 5000, // 5 second timeout for health checks
      } as any);

      if (!response.ok) {
        throw new Error(`Health check failed: ${response.statusText}`);
      }

      const latency = Date.now() - startTime;
      const models = await this.getCurrentModels(server);

      // Update server state
      server.status = 'available';
      server.lastHealthCheck = Date.now();
      server.loadedModels = new Set(models);

      // Update available memory based on loaded models
      let usedMemory = 0;
      for (const model of models) {
        usedMemory += this.estimateModelSize(model);
      }
      server.capabilities.availableMemory = server.capabilities.maxMemory - usedMemory;

      logger.debug(`[Cluster] ${server.name} healthy (${latency}ms, ${models.length} models loaded)`);

      return {
        healthy: true,
        latency,
        loadedModels: models,
      };
    } catch (error: any) {
      // Mark server as offline
      if (server.status !== 'offline') {
        logger.warn(`[Cluster] ${server.name} went offline: ${error.message}`);
        server.status = 'offline';
      }

      return {
        healthy: false,
        error: error.message,
      };
    }
  }

  /**
   * Ping all servers in the cluster
   */
  public async pingAll(): Promise<Map<string, HealthStatus>> {
    const results = new Map<string, HealthStatus>();
    
    const promises = Array.from(this.servers.entries()).map(async ([id, server]) => {
      const health = await this.healthCheck(server);
      results.set(id, health);
    });

    await Promise.all(promises);
    
    const healthyCount = Array.from(results.values()).filter(h => h.healthy).length;
    logger.info(`[Cluster] Health check complete: ${healthyCount}/${this.servers.size} servers healthy`);
    
    return results;
  }

  /**
   * Process a request with the cluster (main entry point for external callers)
   */
  public async processRequest(request: any): Promise<any> {
    const { entityId, modelName, prompt, parameters, resolve, reject } = request;
    
    try {
      // Get an available server
      const server = await this.getAvailableServer(modelName);
      if (!server) {
        throw new Error('No healthy LM Studio servers available');
      }
      
      // Ensure the model is loaded
      await this.ensureModelLoaded(server, modelName);
      
      // Send the actual request
      server.requestsInFlight++;
      
      const response = await fetch(`http://${server.ip}:${server.port}/v1/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: modelName,
          messages: prompt,
          ...parameters,
        }),
        timeout: this.config.requestTimeout || 30000,
      } as any);
      
      if (!response.ok) {
        throw new Error(`Request failed: ${response.statusText}`);
      }
      
      const data = await response.json();
      server.requestsInFlight--;
      
      // Update server's last used info
      server.lastUsedModel = modelName;
      server.lastUsedTime = Date.now();
      
      if (resolve) resolve(data);
      return data;
    } catch (error) {
      logger.error(`[Cluster] Error processing request for entity ${entityId}:`, error);
      if (reject) reject(error);
      throw error;
    }
  }
  
  /**
   * Get cluster status (for monitoring)
   */
  public getClusterStatus(): any {
    const healthyServers = this.getHealthyServers();
    const totalMemory = Array.from(this.servers.values()).reduce((sum, s) => 
      sum + s.capabilities.maxMemory, 0);
    const availableMemory = Array.from(this.servers.values()).reduce((sum, s) => 
      sum + s.capabilities.availableMemory, 0);
    const loadedModels = new Set<string>();
    
    this.servers.forEach(s => {
      s.loadedModels.forEach(m => loadedModels.add(m));
    });
    
    return {
      totalServers: this.servers.size,
      healthyServers: healthyServers.length,
      totalMemory,
      availableMemory,
      loadedModels: Array.from(loadedModels),
      serverDetails: Array.from(this.servers.values()).map(s => ({
        name: s.name,
        ip: s.ip,
        status: s.status,
        memoryUsed: s.capabilities.maxMemory - s.capabilities.availableMemory,
        maxMemory: s.capabilities.maxMemory,
        models: Array.from(s.loadedModels),
        requestsInFlight: s.requestsInFlight,
      })),
    };
  }
  
  /**
   * Send a request to a specific server
   */
  private async sendRequest(server: LMStudioServer, request: ModelRequest): Promise<any> {
    server.requestsInFlight++;
    
    try {
      const response = await fetch(`http://${server.ip}:${server.port}/v1/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: request.model,
          messages: [
            { role: 'user', content: request.prompt }
          ],
          ...request.parameters,
        }),
        timeout: this.config.requestTimeout || 30000, // 30 seconds default
      } as any);

      if (!response.ok) {
        throw new Error(`Request failed: ${response.statusText}`);
      }

      const data = await response.json();
      return data;
    } finally {
      server.requestsInFlight--;
    }
  }

  /**
   * Estimate model size in GB
   */
  private estimateModelSize(modelName: string): number {
    return this.modelSizes.get(modelName) || 8; // Default 8GB if unknown
  }

  /**
   * Get least recently used model on a server
   */
  private getLeastRecentlyUsedModel(server: LMStudioServer): string | null {
    // For now, return the first model (simple implementation)
    // TODO: Track actual usage times for better LRU
    if (server.loadedModels.size > 0) {
      return Array.from(server.loadedModels)[0];
    }
    return null;
  }

  /**
   * Shutdown the cluster
   */
  public shutdown() {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }
    logger.info('[Cluster] Shutdown complete');
  }

  /**
   * Get cluster status summary
   */
  public getStatus() {
    const servers = Array.from(this.servers.values());
    
    return {
      totalServers: servers.length,
      healthyServers: servers.filter(s => s.status !== 'offline').length,
      totalMemory: servers.reduce((sum, s) => sum + s.capabilities.maxMemory, 0),
      availableMemory: servers.reduce((sum, s) => sum + s.capabilities.availableMemory, 0),
      loadedModels: Array.from(new Set(servers.flatMap(s => Array.from(s.loadedModels)))),
      serverDetails: servers.map(s => ({
        name: s.name,
        ip: s.ip,
        status: s.status,
        loadedModels: Array.from(s.loadedModels),
        memoryUsage: `${s.capabilities.maxMemory - s.capabilities.availableMemory}/${s.capabilities.maxMemory}GB`,
        requestsInFlight: s.requestsInFlight,
      })),
    };
  }
}

// Export a singleton instance (optional)
let clusterInstance: LMStudioCluster | null = null;

export function initializeCluster(config: ClusterConfig): LMStudioCluster {
  if (clusterInstance) {
    clusterInstance.shutdown();
  }
  clusterInstance = new LMStudioCluster(config);
  return clusterInstance;
}

export function getCluster(): LMStudioCluster | null {
  return clusterInstance;
}
