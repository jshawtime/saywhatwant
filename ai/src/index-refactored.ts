#!/usr/bin/env node
/**
 * Say What Want AI Bot - REFACTORED
 * Clean architecture with modular components
 */

import chalk from 'chalk';
import { CONFIG } from './config.js';
import { Comment, BotState } from './types.js';
import { logger } from './console-logger.js';

// Import our clean modules
import { LMStudioCluster } from './modules/lmStudioCluster-closed.js';
import { getEntityManager } from './modules/entityManager.js';
import { getConversationAnalyzer } from './modules/conversationAnalyzer.js';
import { getKVClient } from './modules/kvClient.js';

// Initialize modules
const entityManager = getEntityManager();
const analyzer = getConversationAnalyzer();
const kvClient = getKVClient();

// Load configuration
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const configPath = join(__dirname, '..', 'config-aientities.json');
const fullConfig = JSON.parse(readFileSync(configPath, 'utf-8'));

// Initialize LM Studio Cluster
console.log(chalk.blue('[STARTUP]'), 'Initializing AI Bot with clean architecture');

const clusterConfig = {
  servers: fullConfig.lmStudioServers || [],
  pollInterval: fullConfig.clusterSettings?.pollInterval || 5000,
  maxLoadAttempts: fullConfig.clusterSettings?.maxLoadAttempts || 60,
  loadBalancingStrategy: fullConfig.clusterSettings?.loadBalancingStrategy || 'model-affinity' as const,
  keepModelsLoaded: fullConfig.clusterSettings?.keepModelsLoaded !== false,
};

const lmStudioCluster = new LMStudioCluster(clusterConfig);
console.log(chalk.green('[CLUSTER]'), `Initialized with ${clusterConfig.servers.length} servers`);

// Bot state
const state: BotState = {
  lastMessageTimestamp: Date.now(),
  lastResponseTime: 0,
  messageHistory: [],
  currentUsername: '',
  currentColor: '',
  messagesThisMinute: 0,
  minuteResetTime: Date.now() + 60000,
  consecutiveSilence: 0,
};

// Update state with current entity
function updateStateFromEntity() {
  const entity = entityManager.getCurrentEntity();
  state.currentUsername = entity.username;
  state.currentColor = entity.color;
}

// Initialize state
updateStateFromEntity();

/**
 * Generate response using LM Studio Cluster
 */
async function generateResponse(context: any): Promise<string | null> {
  const entity = entityManager.getCurrentEntity();
  
  try {
    // Check if this is a ping request
    const isPing = context.recentMessages.toLowerCase().includes('ping');
    
    // Build the context-aware prompt
    const contextInfo = isPing 
      ? `\n\nSomeone just sent a ping! Respond briefly to acknowledge you're here and active. Context: ${context.recentMessages}`
      : `\n\nContext: ${context.recentMessages}\nActive users: ${context.activeUsers.join(', ')}`;
    const fullPrompt = entity.systemPrompt + contextInfo;
    
    logger.debug(`[Cluster] Generating response as ${entity.username} (${entity.id}) using model: ${entity.model}`);
    
    // Use the cluster to process the request
    const lmResponse = await new Promise<any>((resolve, reject) => {
      lmStudioCluster.processRequest({
        entityId: entity.id,
        modelName: entity.model,
        prompt: [
          { role: 'system', content: fullPrompt },
          { role: 'user', content: entity.userPrompt || 'Generate a response based on the conversation context.' }
        ],
        parameters: {
          temperature: entity.temperature,
          max_tokens: entity.maxTokens,
          top_p: entity.topP,
          frequency_penalty: 0.3,
          presence_penalty: 0.3,
          top_k: entity.topK,
          repeat_penalty: entity.repeatPenalty,
          min_p: entity.minP,
        },
        resolve,
        reject
      }).catch(reject);
    });
    
    const response = lmResponse.choices[0]?.message?.content || null;
    
    // Check if bot chose to skip
    if (response?.includes('[SKIP]')) {
      logger.debug('Bot chose not to respond');
      return null;
    }
    
    // Log cluster status
    const clusterStatus = lmStudioCluster.getClusterStatus();
    logger.debug(`[Cluster] Status: ${clusterStatus.healthyServers}/${clusterStatus.totalServers} servers, ${clusterStatus.availableMemory}GB free`);
    
    return response;
  } catch (error: any) {
    if (error.message?.includes('No healthy LM Studio servers')) {
      logger.warn(`[Cluster] All servers offline, will retry next cycle`);
    } else if (error.message?.includes('timeout')) {
      logger.warn(`[Cluster] Request timeout for ${entity.username}, servers may be overloaded`);
    } else {
      logger.error(`[Cluster] Failed to generate response: ${error.message}`);
    }
    return null;
  }
}

/**
 * Post comment to KV store
 */
async function postComment(text: string): Promise<boolean> {
  const entity = entityManager.getCurrentEntity();
  
  const comment: Comment = {
    id: kvClient.generateId(),
    text,
    username: entity.username,
    color: entity.color,
    timestamp: Date.now(),
    domain: 'saywhatwant.app',
    'message-type': 'AI',
  };
  
  const result = await kvClient.postComment(comment, CONFIG.DEV.dryRun);
  
  if (result.success) {
    // Record post for rate limiting
    entityManager.recordPost(entity.id);
    state.lastResponseTime = Date.now();
    
    logger.info(`[${entity.username}] Posted: "${text}"`);
    console.log(chalk.cyan(`[${entity.username}]`), '📤', `${entity.username}: ${text.substring(0, 50)}...`);
  }
  
  return result.success;
}

/**
 * Main bot loop
 */
async function runBot() {
  logger.info('AI Bot started with clean architecture');
  console.log(chalk.green('[READY]'), 'Bot is running with modular components');
  
  // Main polling loop
  while (true) {
    try {
      const startTime = Date.now();
      const botId = `bot-${startTime}`;
      
      // Fetch recent comments
      const messages = await kvClient.fetchRecentComments(50);
      
      if (messages.length > 0) {
        // Update message history
        state.messageHistory = messages;
        state.lastMessageTimestamp = Math.max(...messages.map(m => m.timestamp));
        
        // Select a new entity for this cycle
        const entity = entityManager.selectRandomEntity();
        updateStateFromEntity();
        
        // Log entity selection
        console.log(chalk.blue(`[${entity.username}]`), `Selected for this cycle`);
        
        // Analyze conversation context
        const context = analyzer.analyzeContext(messages, entity);
        
        // Check rate limits
        const rateLimitCheck = entityManager.checkRateLimits(entity.id);
        
        // Decide whether to respond
        const decision = analyzer.shouldRespond(context, entity, rateLimitCheck);
        
        if (decision.shouldRespond) {
          logger.debug(`[${botId}] Decided to respond: ${decision.reason}`);
          
          // Generate response
          const response = await generateResponse(context);
          
          if (response) {
            // Post the response
            await postComment(response);
          }
        } else {
          state.consecutiveSilence++;
          logger.debug(`[${botId}] Not responding: ${decision.reason}`);
        }
        
        // Check for ping trigger
        if (analyzer.hasPingTrigger(messages)) {
          console.log(chalk.yellow('[PING]'), 'Detected ping trigger - responding immediately');
          const response = await generateResponse(context);
          if (response) {
            await postComment(response);
          }
        }
      }
      
      // Calculate sleep time
      const elapsed = Date.now() - startTime;
      const sleepTime = Math.max(CONFIG.BOT.pollingInterval - elapsed, 1000);
      
      // Wait before next poll
      await new Promise(resolve => setTimeout(resolve, sleepTime));
      
    } catch (error) {
      logger.error('Bot cycle error:', error);
      console.error(chalk.red('[ERROR]'), 'Bot cycle failed:', error);
      
      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, CONFIG.BOT.pollingInterval));
    }
  }
}

// Handle shutdown
process.on('SIGINT', async () => {
  console.log(chalk.yellow('\n[SHUTDOWN]'), 'Shutting down gracefully...');
  await lmStudioCluster.shutdown();
  logger.info('Bot shutdown complete');
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await lmStudioCluster.shutdown();
  process.exit(0);
});

// Start the bot
runBot().catch(error => {
  console.error(chalk.red('[FATAL]'), 'Failed to start bot:', error);
  logger.error('Fatal error:', error);
  process.exit(1);
});
