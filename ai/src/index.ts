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
import { QueueService } from './modules/queueService.js';
import { QueueHTTPServer } from './modules/queueHTTPServer.js';

// Initialize modules
const entityManager = getEntityManager();
const analyzer = getConversationAnalyzer();
const kvClient = getKVClient();

// Initialize queue service (new!)
const USE_QUEUE = process.env.USE_QUEUE !== 'false';  // Default: enabled
const USE_ROUTER = process.env.USE_ROUTER === 'true';  // Default: disabled (future phase)
const queueService = USE_QUEUE ? new QueueService() : null;
const queueHTTP = USE_QUEUE && queueService ? new QueueHTTPServer(queueService) : null;

if (USE_QUEUE) {
  console.log(chalk.green('[QUEUE]'), 'Priority queue system enabled');
} else {
  console.log(chalk.yellow('[QUEUE]'), 'Queue disabled - using direct processing');
}

if (USE_ROUTER) {
  console.log(chalk.green('[ROUTER]'), 'Router LLM enabled');
} else {
  console.log(chalk.gray('[ROUTER]'), 'Router disabled - using default priority (future phase)');
}

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
  
  // Store color as-is (9-digit format)
  // KV should store 9-digit format, not RGB
  let colorForStorage = entity.color;
  
  const comment: Comment = {
    id: kvClient.generateId(),
    text,
    username: entity.username,
    color: colorForStorage,
    timestamp: Date.now(),
    domain: 'ai.saywhatwant.app',  // Exempt domain - no rate limits
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
  // Start HTTP server for dashboard
  if (queueHTTP) {
    await queueHTTP.start();
  }
  
  logger.info('AI Bot started with clean architecture');
  console.log(chalk.green('[READY]'), 'Bot is running with modular components');
  
  // Main polling loop
  while (true) {
    try {
      const startTime = Date.now();
      const botId = `bot-${startTime}`;
      
      // Fetch recent comments - use the maximum messagesToRead from all entities
      const maxMessagesToRead = Math.max(...fullConfig.entities.map((e: any) => e.messagesToRead || 50));
      const messages = await kvClient.fetchRecentComments(maxMessagesToRead);
      
      if (messages.length > 0) {
        // Update message history
        state.messageHistory = messages;
        state.lastMessageTimestamp = Math.max(...messages.map(m => m.timestamp));
        
        if (USE_QUEUE && queueService) {
          // QUEUE MODE: Queue ALL messages with simple priority assignment
          console.log(chalk.blue('[QUEUE]'), `Analyzing ${messages.length} messages for queueing`);
          
          for (const message of messages) {
            // Select entity for this message
            const entity = entityManager.selectRandomEntity();
            
            // Assign simple priority based on content
            let priority = 50;  // Default medium
            const text = message.text?.toLowerCase() || '';
            const username = message.username?.toLowerCase() || '';
            const entityNameLower = entity.username.toLowerCase();
            
            // HIGHEST: Direct mention (username + color match)
            if (username === entityNameLower && message.color === entity.color) {
              priority = 5;  // Very high priority
            }
            // HIGH: Direct address (name mentioned in text)
            else if (text.includes(entityNameLower)) {
              priority = 10;  // High priority
            }
            // MEDIUM-HIGH: Has question
            else if (text.includes('?')) {
              priority = 25;  // Medium-high priority
            }
            // MEDIUM: Entity's response chance (0.0-1.0 → 30-70 priority)
            else {
              // Convert responseChance to priority (inverse)
              // responseChance 1.0 → priority 30 (high)
              // responseChance 0.1 → priority 70 (low)
              priority = Math.round(70 - (entity.responseChance * 40));
            }
            
            // Check rate limits before queuing
            const rateLimitCheck = entityManager.checkRateLimits(entity.id);
            if (!rateLimitCheck.allowed) {
              logger.debug(`[${botId}] Skipping queue: ${rateLimitCheck.reason}`);
              continue;  // Skip this message
            }
            
            // Queue the message
            await queueService.enqueue({
              id: `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
              priority,
              timestamp: Date.now(),
              message,
              context: messages.slice(-entity.messagesToRead).map(m => `${m.username}: ${m.text}`),
              entity,
              model: entity.model,
              routerReason: `Priority ${priority} based on content analysis`,
              maxRetries: 3
            });
            
            console.log(chalk.cyan('[QUEUE]'), `Queued: ${message.username} → ${entity.username} (priority ${priority})`);
          }
        } else {
          // DIRECT MODE: Old behavior (one response per cycle)
          const entity = entityManager.selectRandomEntity();
          updateStateFromEntity();
          
          const context = analyzer.analyzeContext(messages, entity);
          const rateLimitCheck = entityManager.checkRateLimits(entity.id);
          const decision = analyzer.shouldRespond(context, entity, rateLimitCheck);
          
          if (decision.shouldRespond) {
            const response = await generateResponse(context);
            if (response) {
              await postComment(response);
            }
          }
        }
        
        // Check for ping trigger (queue with highest priority)
        if (USE_QUEUE && queueService && analyzer.hasPingTrigger(messages)) {
          console.log(chalk.yellow('[PING]'), 'Detected ping trigger - queuing with priority 0');
          const entity = entityManager.selectRandomEntity();
          
          await queueService.enqueue({
            id: `ping-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            priority: 0,  // HIGHEST priority for pings
            timestamp: Date.now(),
            message: messages[messages.length - 1],
            context: messages.slice(-entity.messagesToRead).map(m => `${m.username}: ${m.text}`),
            entity,
            model: entity.model,
            routerReason: 'Ping trigger detected',
            maxRetries: 3
          });
        }
      }
      
      // Log queue stats periodically (every 10 cycles)
      if (USE_QUEUE && queueService && Math.random() < 0.1) {
        const stats = queueService.getStats();
        console.log(chalk.cyan('[QUEUE STATS]'), 
          `Total: ${stats.totalItems}, ` +
          `Unclaimed: ${stats.unclaimedItems}, ` +
          `Processing: ${stats.claimedItems}, ` +
          `Throughput: ${stats.throughput}/min`
        );
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

/**
 * Worker loop - processes items from queue
 * Runs in parallel with main polling loop
 */
async function runWorker() {
  if (!USE_QUEUE || !queueService) {
    console.log(chalk.gray('[WORKER]'), 'Worker disabled - queue not in use');
    return;
  }
  
  console.log(chalk.green('[WORKER]'), 'Worker started - processing queue');
  const serverId = '10.0.0.102';  // TODO: Get from config/env
  
  while (true) {
    try {
      // Claim next item from queue (atomic operation)
      const item = await queueService.claim(serverId);
      
      if (!item) {
        // Queue empty - wait before checking again
        await new Promise(resolve => setTimeout(resolve, 1000));
        continue;
      }
      
      console.log(chalk.blue('[WORKER]'), `Processing: ${item.id} (priority ${item.priority})`);
      
      try {
        // Build context object
        const context = {
          recentMessages: item.context.join('\n'),
          activeUsers: [],
          topics: [],
          hasQuestion: item.context.some(msg => msg.includes('?')),
          mentionsBot: false
        };
        
        // Generate response using existing function
        const response = await generateResponse(context);
        
        if (response) {
          // Post using existing function
          await postComment(response);
          
          // Mark as complete
          await queueService.complete(item.id, true);
          
          // Record success for dashboard
          if (queueHTTP) {
            queueHTTP.recordSuccess();
          }
          
          console.log(chalk.green('[WORKER]'), `Completed: ${item.id}`);
        } else {
          // No response generated - mark as complete anyway
          await queueService.complete(item.id, true);
        }
        
      } catch (error) {
        console.error(chalk.red('[WORKER]'), `Failed to process ${item.id}:`, error);
        
        // Check retry limit
        if (item.attempts < item.maxRetries) {
          // Requeue (complete with false = requeue)
          await queueService.complete(item.id, false);
          console.log(chalk.yellow('[WORKER]'), `Requeued: ${item.id} (attempt ${item.attempts}/${item.maxRetries})`);
        } else {
          // Max retries - give up
          await queueService.complete(item.id, true);
          console.log(chalk.red('[WORKER]'), `Max retries reached: ${item.id} - discarding`);
        }
      }
      
    } catch (error) {
      console.error(chalk.red('[WORKER]'), 'Worker error:', error);
      await new Promise(resolve => setTimeout(resolve, 5000));  // Back off on error
    }
  }
}

// Handle shutdown
process.on('SIGINT', async () => {
  console.log(chalk.yellow('\n[SHUTDOWN]'), 'Shutting down gracefully...');
  
  if (USE_QUEUE && queueService) {
    const stats = queueService.getStats();
    console.log(chalk.blue('[QUEUE]'), `Final stats: ${stats.totalItems} items, ${stats.unclaimedItems} unclaimed`);
  }
  
  if (queueHTTP) {
    await queueHTTP.stop();
  }
  
  await lmStudioCluster.shutdown();
  logger.info('Bot shutdown complete');
  process.exit(0);
});

process.on('SIGTERM', async () => {
  if (queueHTTP) {
    await queueHTTP.stop();
  }
  await lmStudioCluster.shutdown();
  process.exit(0);
});

// Start the bot (both loops in parallel)
Promise.all([
  runBot().catch(error => {
    console.error(chalk.red('[FATAL]'), 'Bot loop failed:', error);
    logger.error('Fatal error:', error);
    process.exit(1);
  }),
  runWorker().catch(error => {
    console.error(chalk.red('[FATAL]'), 'Worker loop failed:', error);
    logger.error('Fatal error:', error);
    process.exit(1);
  })
]);