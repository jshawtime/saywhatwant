/**
 * Config Loader Module
 * Provides fresh config on every read for hot-reload capability
 * 
 * Philosophy: Read from disk every time = simple, no caching complexity
 * Performance: OS file caching makes this fast (~0.1ms per read)
 * 
 * Benefits:
 * - Edit config file → Save → Next message uses new config
 * - No PM2 restart needed
 * - No deployment needed
 * - Perfect for rapid testing and tuning
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CONFIG_PATH = join(__dirname, '../..', 'config-aientities.json');

export interface BotConfig {
  version?: string;
  botSettings: {
    pollingInterval: number;
    websocketPort: number;
    enableConsoleLogs: boolean;
  };
  queueSettings: {
    enabled: boolean;
    staleClaimTimeout: number;
    maxRetries: number;
    defaultPriority: number;
  };
  routerSettings: {
    enabled: boolean;
  };
  lmStudioServers: any[];
  clusterSettings: any;
  entities: any[];
  globalSettings: any;
  _configNotes?: any;
}

// Startup config (cached once for bot settings that don't need hot-reload)
let startupConfig: BotConfig | null = null;

/**
 * Get fresh config from disk
 * Called on every message for hot-reload capability
 * 
 * Performance: ~0.1ms per read (OS caches file in RAM)
 * 
 * @returns Fresh config object
 * @throws Error if file not found or invalid JSON
 */
export function getConfig(): BotConfig {
  try {
    const raw = readFileSync(CONFIG_PATH, 'utf-8');
    const config = JSON.parse(raw);
    
    // Basic validation
    if (!config.entities || !Array.isArray(config.entities)) {
      throw new Error('Config missing entities array');
    }
    
    return config;
  } catch (error: any) {
    console.error('[CONFIG] Failed to read config file:', error.message);
    console.error('[CONFIG] Path:', CONFIG_PATH);
    
    // Don't use fallbacks - explicit error
    if (error.code === 'ENOENT') {
      throw new Error(`Config file not found: ${CONFIG_PATH}`);
    } else if (error instanceof SyntaxError) {
      throw new Error(`Invalid JSON in config file: ${error.message}`);
    } else {
      throw error;
    }
  }
}

/**
 * Get config once at startup
 * Use for bot settings that don't need hot-reload
 * (polling interval, websocket port, server list)
 */
export function getConfigOnce(): BotConfig {
  if (!startupConfig) {
    console.log('[CONFIG] Loading config for startup settings');
    startupConfig = getConfig();
  }
  return startupConfig;
}

/**
 * Get specific entity by ID (fresh read)
 * 
 * @param entityId - Entity ID to find
 * @returns Entity object or null if not found
 */
export function getEntity(entityId: string): any | null {
  const config = getConfig();
  return config.entities.find((e: any) => e.id === entityId) || null;
}

/**
 * Get all enabled entities (fresh read)
 * 
 * @returns Array of enabled entities
 */
export function getEnabledEntities(): any[] {
  const config = getConfig();
  return config.entities.filter((e: any) => e.enabled);
}

/**
 * Get all entities (fresh read)
 * 
 * @returns Array of all entities
 */
export function getAllEntities(): any[] {
  const config = getConfig();
  return config.entities;
}

/**
 * Get config file path
 * Useful for logging and debugging
 */
export function getConfigPath(): string {
  return CONFIG_PATH;
}

/**
 * Validate config structure
 * Basic checks to prevent crashes
 */
export function validateConfig(config: any): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (!config) {
    errors.push('Config is null or undefined');
    return { valid: false, errors };
  }
  
  if (!config.entities || !Array.isArray(config.entities)) {
    errors.push('Missing or invalid entities array');
  }
  
  if (!config.botSettings) {
    errors.push('Missing botSettings section');
  }
  
  if (!config.lmStudioServers || !Array.isArray(config.lmStudioServers)) {
    errors.push('Missing or invalid lmStudioServers array');
  }
  
  // Check each entity has required fields
  if (config.entities) {
    config.entities.forEach((entity: any, index: number) => {
      if (!entity.id) errors.push(`Entity at index ${index} missing id`);
      if (!entity.username) errors.push(`Entity at index ${index} missing username`);
      if (!entity.baseModel) errors.push(`Entity at index ${index} missing baseModel`);
    });
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Test config loading
 * Useful for debugging
 */
export function testConfigLoad(): void {
  console.log('[CONFIG TEST] Reading config from:', CONFIG_PATH);
  
  try {
    const config = getConfig();
    const validation = validateConfig(config);
    
    console.log('[CONFIG TEST] ✅ Config loaded successfully');
    console.log('[CONFIG TEST] Entities:', config.entities.length);
    console.log('[CONFIG TEST] Servers:', config.lmStudioServers.length);
    console.log('[CONFIG TEST] Validation:', validation.valid ? '✅ VALID' : '❌ INVALID');
    
    if (!validation.valid) {
      console.error('[CONFIG TEST] Errors:', validation.errors);
    }
  } catch (error: any) {
    console.error('[CONFIG TEST] ❌ Failed to load config:', error.message);
  }
}

