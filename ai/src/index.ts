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
import { QueueWebSocketServer } from './modules/websocketServer.js';

// Initialize modules
const entityManager = getEntityManager();
const analyzer = getConversationAnalyzer();
const kvClient = getKVClient();

// Load configuration FIRST
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const configPath = join(__dirname, '..', 'config-aientities.json');
const fullConfig = JSON.parse(readFileSync(configPath, 'utf-8'));

// Read settings from config (NEW MASTER CONTROLLER)
const POLLING_INTERVAL = fullConfig.botSettings?.pollingInterval || 30000;
const WEBSOCKET_PORT = fullConfig.botSettings?.websocketPort || 4002;
const USE_QUEUE = fullConfig.queueSettings?.enabled !== false;  // Default: enabled
const USE_ROUTER = fullConfig.routerSettings?.enabled === true;  // Default: disabled
const QUEUE_MAX_RETRIES = fullConfig.queueSettings?.maxRetries || 3;

console.log(chalk.blue('[CONFIG]'), `Polling interval: ${POLLING_INTERVAL/1000}s (from config)`);
console.log(chalk.blue('[CONFIG]'), `WebSocket port: ${WEBSOCKET_PORT} (from config)`);

// Initialize queue service
const queueService = USE_QUEUE ? new QueueService() : null;
const queueWS = USE_QUEUE && queueService ? new QueueWebSocketServer(queueService, WEBSOCKET_PORT) : null;

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

// Track processed message IDs to prevent re-queueing
const processedMessageIds = new Set<string>();

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
 * @param text - The response text to post
 * @param ais - Optional AI identity override (username:color or username:random)
 */
async function postComment(text: string, ais?: string): Promise<boolean> {
  const entity = entityManager.getCurrentEntity();
  
  // Default to entity config
  let usernameToUse = entity.username;
  let colorToUse = entity.color;
  
  // NEW: Override with ais parameter if provided (for isolated conversations)
  if (ais) {
    const [aisUsername, aisColor] = ais.split(':');
    
    if (aisUsername) {
      usernameToUse = aisUsername;
      console.log(chalk.magenta('[AIS]'), `Username override: ${entity.username} → ${aisUsername}`);
      if (queueWS) queueWS.sendLog(`[AIS] Username: ${entity.username} → ${aisUsername}`);
    }
    
    if (aisColor) {
      if (aisColor.toLowerCase() === 'random') {
        // Generate random 9-digit color
        colorToUse = `${Math.floor(Math.random() * 256).toString().padStart(3, '0')}${Math.floor(Math.random() * 256).toString().padStart(3, '0')}${Math.floor(Math.random() * 256).toString().padStart(3, '0')}`;
        console.log(chalk.magenta('[AIS]'), `Random color generated: ${colorToUse}`);
        if (queueWS) queueWS.sendLog(`[AIS] Random color: ${colorToUse}`);
      } else {
        colorToUse = aisColor;
        console.log(chalk.magenta('[AIS]'), `Color override: ${entity.color} → ${aisColor}`);
        if (queueWS) queueWS.sendLog(`[AIS] Color: ${entity.color} → ${aisColor}`);
      }
    }
  }
  
  const comment: Comment = {
    id: kvClient.generateId(),
    text,
    username: usernameToUse,  // Use overridden username
    color: colorToUse,  // Use overridden color
    timestamp: Date.now(),
    domain: 'saywhatwant.app',  // Same domain as users
    'message-type': 'AI',
  };
  
  // DEBUG: Log exactly what we're posting
  console.log(chalk.yellow('[POST DEBUG]'), 'Comment object being sent:');
  console.log(chalk.yellow('[POST DEBUG]'), `  username: "${comment.username}"`);
  console.log(chalk.yellow('[POST DEBUG]'), `  color: "${comment.color}"`);
  console.log(chalk.yellow('[POST DEBUG]'), `  usernameToUse was: "${usernameToUse}"`);
  console.log(chalk.yellow('[POST DEBUG]'), `  colorToUse was: "${colorToUse}"`);
  if (queueWS) {
    queueWS.sendLog(`[POST DEBUG] Sending username: "${comment.username}", color: "${comment.color}"`);
  }
  
  const result = await kvClient.postComment(comment, CONFIG.DEV.dryRun);
  
  if (result.success) {
    // Record post for rate limiting (under original entity ID)
    entityManager.recordPost(entity.id);
    state.lastResponseTime = Date.now();
    
  logger.info(`[${usernameToUse}] Posted: "${text}"`);
  console.log(chalk.cyan(`[${usernameToUse}]`), '📤', `${usernameToUse}: ${text.substring(0, 50)}...`);
  
  // Send final posting confirmation to dashboard
  if (queueWS) {
    queueWS.sendLog(`[POST] ${usernameToUse}: ${text.substring(0, 60)}...`);
  }
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
      
      // Fetch recent comments - use the maximum nom from all entities
      const maxMessagesToRead = Math.max(...fullConfig.entities.map((e: any) => e.nom || 100));
      
      console.log(chalk.magenta('[POLLING]'), `Fetching from KV (interval: ${POLLING_INTERVAL/1000}s)`);
      const messages = await kvClient.fetchRecentComments(maxMessagesToRead);
      console.log(chalk.magenta('[POLLING]'), `Fetched ${messages.length} messages`);
      
      if (messages.length > 0) {
        // Update message history
        state.messageHistory = messages;
        state.lastMessageTimestamp = Math.max(...messages.map(m => m.timestamp));
        
        if (USE_QUEUE && queueService) {
          // QUEUE MODE: Process ALL HUMAN messages (not AI responses)
          console.log(chalk.blue('[QUEUE]'), `Analyzing ${messages.length} messages`);
          
          let queued = 0;
          let skipped = 0;
          
          for (const message of messages) {
            // Skip AI messages (don't queue bot responses)
            if (message['message-type'] === 'AI') {
              continue;
            }
            
            // Skip already processed
            if (processedMessageIds.has(message.id)) {
              skipped++;
              continue;
            }
            
            console.log(chalk.blue('[QUEUE]'), `Processing human message: ${message.username}`);
            
            const messageIndex = 1;  // Only one message per cycle
            
            // ====================
            // ROBUST PARAMETER HANDLING WITH FALLBACKS
            // ====================
            
            const botParams = message.botParams || {};
            
            // 1. SELECT ENTITY (with fallback chain)
            let entity;
            if (botParams.entity) {
              // URL specified entity - try to use it
              entity = fullConfig.entities.find((e: any) => e.id === botParams.entity);
              
              if (!entity) {
                console.warn(chalk.yellow('[BOT PARAMS]'), 
                  `Entity "${botParams.entity}" not found in config, using random`);
                entity = entityManager.selectRandomEntity();
              } else {
                console.log(chalk.green('[BOT PARAMS]'), 
                  `Using specified entity: ${botParams.entity}`);
              }
            } else {
              // No entity specified - select random
              entity = entityManager.selectRandomEntity();
            }
            
            // 2. DETERMINE PRIORITY (with fallback chain)
            let priority;
            if (botParams.priority !== undefined) {
              // URL specified priority - HIGHEST PRIORITY (clamped 0-99)
              priority = Math.max(0, Math.min(99, botParams.priority));
              console.log(chalk.green('[BOT PARAMS]'), 
                `Using URL priority: ${priority}`);
            } else {
              // Use entity's default priority from config
              priority = entity.defaultPriority || 50;  // Fallback to 50 if not in config
              console.log(chalk.gray('[PRIORITY]'), 
                `Using entity default: ${priority}`);
            }
            
            // Check rate limits before queuing
            const rateLimitCheck = entityManager.checkRateLimits(entity.id);
            if (!rateLimitCheck.allowed) {
              logger.debug(`[${botId}] Skipping queue: ${rateLimitCheck.reason}`);
              continue;  // Skip this message
            }
            
            // 3. SELECT MODEL (with fallback chain)
            const modelToUse = botParams.model || entity.model;
            if (botParams.model) {
              console.log(chalk.green('[BOT PARAMS]'), 
                `Model override: ${entity.model} → ${botParams.model}`);
            }
            
            // Use pre-formatted context from frontend (if present)
            const contextForLLM = message.context && message.context.length > 0
              ? message.context
              : messages.slice(-(entity.nom || 100)).map(m => `${m.username}: ${m.text}`);
            
            console.log(chalk.cyan('[QUEUE]'), 'Configuration:');
            console.log(chalk.cyan('  Entity:'), entity.id);
            console.log(chalk.cyan('  Model:'), modelToUse);
            console.log(chalk.cyan('  Priority:'), priority);
            console.log(chalk.cyan('  Context:'), contextForLLM.length, 'messages');
            
            // Queue the message with GUARANTEED unique ID
            const queueItem = {
              id: `req-${Date.now()}-${messageIndex}-${Math.random().toString(36).substr(2, 9)}`,
              priority,
              timestamp: Date.now(),
              message,
              context: contextForLLM,  // Use (filtered) context with (overridden) size
              entity,
              model: modelToUse,  // Use overridden model if specified
              routerReason: buildRouterReason(message, botParams, priority),
              maxRetries: QUEUE_MAX_RETRIES
            };
            
            function buildRouterReason(msg: any, params: any, pri: number): string {
              const reasons = [];
              if (params.entity) reasons.push(`Entity: ${params.entity}`);
              if (params.priority !== undefined) reasons.push(`Priority: ${params.priority}`);
              if (msg.context) reasons.push(`Context: ${msg.context.length} msgs`);
              if (params.nom) reasons.push(`nom: ${params.nom}`);
              
              return reasons.length > 0 
                ? reasons.join(', ') 
                : `Auto priority ${pri}`;
            }
            
            await queueService.enqueue(queueItem);
            
            // Mark as processed AFTER successful queue (not before!)
            processedMessageIds.add(message.id);
            
            // Limit Set size (keep last 10000 IDs)
            if (processedMessageIds.size > 10000) {
              const idsArray = Array.from(processedMessageIds);
              processedMessageIds.clear();
              idsArray.slice(-5000).forEach(id => processedMessageIds.add(id));
            }
            
            // Emit WebSocket event
            if (queueWS) {
              queueWS.onQueued(queueItem);
            }
            
            console.log(chalk.cyan('[QUEUE]'), `Queued: ${message.username} → ${entity.username} (priority ${priority})`);
            queued++;
          }
          
          console.log(chalk.blue('[QUEUE]'), `Queued ${queued} human messages, skipped ${skipped} duplicates`);
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
              // Extract ais from botParams (AI identity override)
              const latestMessage = messages[messages.length - 1];
              const aisOverride = latestMessage?.botParams?.ais || undefined;
              
              await postComment(response, aisOverride);
            }
          }
        }
        
        // Check for ping trigger (queue with highest priority)
        if (USE_QUEUE && queueService && analyzer.hasPingTrigger(messages)) {
          console.log(chalk.yellow('[PING]'), 'Detected ping trigger - queuing with priority 0');
          const entity = entityManager.selectRandomEntity();
          const pingMessage = messages[messages.length - 1];
          
          // Use context from message if present, otherwise use all messages
          const pingContext = pingMessage.context || messages.slice(-(entity.nom || 100)).map(m => `${m.username}: ${m.text}`);
          
          await queueService.enqueue({
            id: `ping-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            priority: 0,  // HIGHEST priority for pings
            timestamp: Date.now(),
            message: pingMessage,
            context: pingContext,
            entity,
            model: entity.model,
            routerReason: 'Ping trigger detected',
            maxRetries: QUEUE_MAX_RETRIES
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
      const sleepTime = Math.max(POLLING_INTERVAL - elapsed, 1000);
      
      console.log(chalk.gray('[POLLING]'), `Cycle took ${elapsed}ms, sleeping ${sleepTime}ms (${Math.round(sleepTime/1000)}s)`);
      console.log(chalk.gray('[POLLING]'), `Next poll in ${Math.round(sleepTime/1000)} seconds...`);
      
      // Wait before next poll
      await new Promise(resolve => setTimeout(resolve, sleepTime));
      
    } catch (error) {
      logger.error('Bot cycle error:', error);
      console.error(chalk.red('[ERROR]'), 'Bot cycle failed:', error);
      
      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, POLLING_INTERVAL));
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
      
      // Emit claim event
      if (queueWS) {
        queueWS.onClaimed(item.id, serverId);
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
          // Extract ais from botParams (AI identity override)
          const aisOverride = item.message.botParams?.ais || undefined;
          
          console.log(chalk.blue('[WORKER]'), `botParams.ais: "${aisOverride}"`);
          
          if (aisOverride) {
            console.log(chalk.magenta('[WORKER]'), `Using AI identity override: ${aisOverride}`);
            if (queueWS) queueWS.sendLog(`[WORKER] Using ais override: ${aisOverride}`);
          } else {
            console.log(chalk.gray('[WORKER]'), `No ais override, using entity defaults`);
            if (queueWS) queueWS.sendLog(`[WORKER] No ais, using entity defaults`);
          }
          
          // Post with ais override (if present)
          await postComment(response, aisOverride);
          
          // Mark as complete
          await queueService.complete(item.id, true);
          
          // Record success and emit event
          if (queueWS) {
            queueWS.recordSuccess();
            queueWS.onCompleted(item.id, true);
            queueWS.pushStats();  // Push updated stats
          }
          
          console.log(chalk.green('[WORKER]'), `Completed: ${item.id}`);
        } else {
          // No response generated - mark as complete anyway
          await queueService.complete(item.id, true);
          
          // Still emit completion event even if no response
          if (queueWS) {
            queueWS.onCompleted(item.id, false);
            queueWS.pushStats();
          }
        }
        
      } catch (error) {
        console.error(chalk.red('[WORKER]'), `Failed to process ${item.id}:`, error);
        
        // Check retry limit
        if (item.attempts < item.maxRetries) {
          // Requeue (complete with false = requeue)
          await queueService.complete(item.id, false);
          console.log(chalk.yellow('[WORKER]'), `Requeued: ${item.id} (attempt ${item.attempts}/${item.maxRetries})`);
          
          // Don't emit completion - item is still in queue (with lower priority)
        } else {
          // Max retries - give up, remove from queue
          await queueService.complete(item.id, true);
          
          // Emit completion event
          if (queueWS) {
            queueWS.onCompleted(item.id, false);
            queueWS.pushStats();
          }
          
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
  
  if (queueWS) {
    await queueWS.stop();
  }
  
  await lmStudioCluster.shutdown();
  logger.info('Bot shutdown complete');
  process.exit(0);
});

process.on('SIGTERM', async () => {
  if (queueWS) {
    await queueWS.stop();
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