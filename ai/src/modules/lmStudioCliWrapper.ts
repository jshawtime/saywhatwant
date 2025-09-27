/**
 * LM Studio CLI Wrapper
 * Executes lms commands from the LOCAL bot (not Cloudflare!)
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import { logger } from '../console-logger.js';

const execAsync = promisify(exec);

export class LMStudioCLI {
  
  /**
   * Load a model on a specific host
   */
  async loadModel(modelName: string, host?: string): Promise<boolean> {
    try {
      const hostFlag = host ? `--host ${host}` : '';
      // For highermind model, use full path to avoid interactive selection
      // TODO: Make this configurable per model in config-aientities.json
      let modelPath = modelName;
      if (modelName === 'highermind_the-eternal-1') {
        modelPath = 'HigherMind/HigherMind_The-Eternal-1_f32/HigherMind_The-Eternal-1_f32.gguf';
      }
      const command = `lms load "${modelPath}" ${hostFlag}`;
      
      logger.info(`[CLI] Executing: ${command}`);
      const { stdout, stderr } = await execAsync(command);
      
      if (stderr && !stderr.includes('warning')) {
        logger.error(`[CLI] Error loading model: ${stderr}`);
        return false;
      }
      
      logger.success(`[CLI] Model loaded: ${stdout}`);
      return true;
    } catch (error: any) {
      logger.error(`[CLI] Failed to load model: ${error.message}`);
      return false;
    }
  }
  
  /**
   * Unload a model on a specific host
   */
  async unloadModel(modelName: string, host?: string): Promise<boolean> {
    try {
      const hostFlag = host ? `--host ${host}` : '';
      const command = `lms unload ${modelName} ${hostFlag}`;
      
      logger.info(`[CLI] Executing: ${command}`);
      const { stdout, stderr } = await execAsync(command);
      
      if (stderr && !stderr.includes('warning')) {
        logger.error(`[CLI] Error unloading model: ${stderr}`);
        return false;
      }
      
      logger.success(`[CLI] Model unloaded: ${stdout}`);
      return true;
    } catch (error: any) {
      logger.error(`[CLI] Failed to unload model: ${error.message}`);
      return false;
    }
  }
  
  /**
   * Unload ALL models on a host
   */
  async unloadAll(host?: string): Promise<boolean> {
    try {
      const hostFlag = host ? `--host ${host}` : '';
      const command = `lms unload --all ${hostFlag}`;
      
      logger.info(`[CLI] Executing: ${command}`);
      const { stdout, stderr } = await execAsync(command);
      
      if (stderr && !stderr.includes('warning')) {
        logger.error(`[CLI] Error unloading all: ${stderr}`);
        return false;
      }
      
      logger.success(`[CLI] All models unloaded: ${stdout}`);
      return true;
    } catch (error: any) {
      logger.error(`[CLI] Failed to unload all: ${error.message}`);
      return false;
    }
  }
  
  /**
   * List loaded models
   */
  async listLoaded(host?: string): Promise<string[]> {
    try {
      const hostFlag = host ? `--host ${host}` : '';
      const command = `lms ls ${hostFlag}`;
      
      const { stdout } = await execAsync(command);
      // Parse the output to get model names
      const models = stdout.split('\n')
        .filter(line => line.trim())
        .map(line => line.trim());
      
      return models;
    } catch (error: any) {
      logger.error(`[CLI] Failed to list models: ${error.message}`);
      return [];
    }
  }
}

/**
 * IMPORTANT: This only works when the bot runs LOCALLY
 * Cloudflare Workers cannot execute CLI commands!
 * 
 * Usage in local bot:
 * const cli = new LMStudioCLI();
 * await cli.loadModel('highermind_the-eternal-1', '10.0.0.102');
 * await cli.unloadModel('old-model', '10.0.0.100');
 */
