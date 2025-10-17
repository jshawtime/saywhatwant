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
import { getEntityManager, getModelName } from './modules/entityManager.js';
import { getConversationAnalyzer } from './modules/conversationAnalyzer.js';
import { getKVClient } from './modules/kvClient.js';
import { QueueService } from './modules/queueService.js';
import { QueueWebSocketServer } from './modules/websocketServer.js';
import { EntityValidator } from './modules/entityValidator.js';
import { getConfigOnce, getConfig } from './modules/configLoader.js';

// Load configuration FIRST for startup settings (polling, websocket, etc.)
// Entity configs will be hot-reloaded on every message
const startupConfig = getConfigOnce();

// Read settings from config (these don't need hot-reload)
const POLLING_INTERVAL = startupConfig.botSettings?.pollingInterval || 30000;

// Initialize modules (after config is loaded so we can pass polling interval)
const entityManager = getEntityManager();
const entityValidator = new EntityValidator(); // No EntityManager needed - reads fresh config
const analyzer = getConversationAnalyzer();
const kvClient = getKVClient(POLLING_INTERVAL); // Pass polling interval as fetch cooldown
const WEBSOCKET_PORT = startupConfig.botSettings?.websocketPort || 4002;
const USE_QUEUE = startupConfig.queueSettings?.enabled !== false;  // Default: enabled
const USE_ROUTER = startupConfig.routerSettings?.enabled === true;  // Default: disabled
const QUEUE_MAX_RETRIES = startupConfig.queueSettings?.maxRetries || 3;

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
  servers: startupConfig.lmStudioServers || [],
  pollInterval: startupConfig.clusterSettings?.pollInterval || 5000,
  maxLoadAttempts: startupConfig.clusterSettings?.maxLoadAttempts || 60,
  loadBalancingStrategy: startupConfig.clusterSettings?.loadBalancingStrategy || 'model-affinity' as const,
  keepModelsLoaded: startupConfig.clusterSettings?.keepModelsLoaded !== false,
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

// In-session deduplication to prevent queueing same message multiple times
// Map stores: message ID → timestamp when queued
// Rolling cleanup every poll removes entries older than 5 minutes
const queuedThisSession = new Map<string, number>();
const SESSION_WINDOW_MS = 5 * 60 * 1000;  // 5 minutes

// State no longer needs initialization - entity comes from botParams

/**
 * Generate response using LM Studio Cluster
 */
async function generateResponse(context: any, entity: any): Promise<string | null> {
  // Entity is now passed as parameter (from queue item)
  
  try {
    // Check if this is a ping request
    const isPing = context.recentMessages.toLowerCase().includes('ping');
    
    // Optionally add newline to context (per-entity config)
    let contextMessages = context.recentMessages;
    if (entity.addNewlineToContext === true) {
      contextMessages = contextMessages + '\n';
    }
    
    // Optionally add entity username as continuation prompt (per-entity config)
    if (entity.addEntityUsername === true) {
      contextMessages = contextMessages + entity.username + ': ';
    }
    
    // Build the full prompt with proper structure:
    // systemPrompt + userPrompt + context + [optional newline] + [optional "EntityName: "]
    const userPromptText = entity.userPrompt || 'Generate a response based on the conversation context.';
    const contextInfo = isPing 
      ? `\n\nSomeone just sent a ping! Respond briefly to acknowledge you're here and active. Context: ${contextMessages}`
      : `\n\nContext: ${contextMessages}`;
    
    const fullPrompt = entity.systemPrompt + userPromptText + contextInfo;
    
    const modelName = getModelName(entity);
    logger.debug(`[Cluster] Generating response as ${entity.username} (${entity.id}) using model: ${modelName}`);
    
    // Build the exact LLM request using entity's systemRole
    const llmRequest = {
      entityId: entity.id,
      modelName,
      prompt: [
        { role: entity.systemRole, content: fullPrompt }
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
      }
    };
    
    // Send to queue monitor for debugging
    if (queueWS) {
      queueWS.sendLLMRequest(llmRequest);
    }
    
    // Use the cluster to process the request
    const lmResponse = await new Promise<any>((resolve, reject) => {
      lmStudioCluster.processRequest({
        ...llmRequest,
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
async function postComment(text: string, entity: any, ais?: string): Promise<boolean> {
  // Entity is now passed as parameter
  
  // Filter out unwanted phrases (per-entity configuration)
  let filteredText = text;
  
  // Step 1: Remove unwanted phrases
  if (entity.filterOut && Array.isArray(entity.filterOut)) {
    entity.filterOut.forEach((phrase: string) => {
      // Remove all occurrences of this phrase (case-sensitive)
      filteredText = filteredText.split(phrase).join('');
    });
  }
  
  // Step 2: Trim after first occurrence of any specified phrase (prevents LLM role-playing)
  if (entity.trimAfter && Array.isArray(entity.trimAfter)) {
    let trimPosition = -1;
    let foundPhrase = '';
    
    // Find the earliest occurrence of any trimAfter phrase
    entity.trimAfter.forEach((phrase: string) => {
      const pos = filteredText.indexOf(phrase);
      if (pos !== -1 && (trimPosition === -1 || pos < trimPosition)) {
        trimPosition = pos;
        foundPhrase = phrase;
      }
    });
    
    // Trim at that position if found
    if (trimPosition !== -1) {
      filteredText = filteredText.substring(0, trimPosition);
      console.log(chalk.yellow('[TRIM]'), `Trimmed after "${foundPhrase}" for ${entity.id}`);
    }
  }
  
  // Step 3: Trim whitespace if entity has trimWhitespace enabled
  if (entity.trimWhitespace === true) {
    filteredText = filteredText.trim();
  }
  
  // Only log filtering if something changed (not logged above already)
  if (filteredText !== text && entity.filterOut) {
    console.log(chalk.yellow('[FILTER]'), `Cleaned response for ${entity.id}`);
  }
  
  // Default to entity config
  let usernameToUse = entity.username;
  let colorToUse = entity.color;
  
  // NEW: Override with ais parameter if provided (for isolated conversations)
  if (ais) {
    const [aisUsername, aisColor] = ais.split(':');
    
    if (aisUsername) {
      usernameToUse = aisUsername;
      // Silent
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
        // Silent
        if (queueWS) queueWS.sendLog(`[AIS] Color: ${entity.color} → ${aisColor}`);
      }
    }
  }
  
  const comment: Comment = {
    id: kvClient.generateId(),
    text: filteredText,  // Use filtered text (phrases removed)
    username: usernameToUse,  // Use overridden username
    color: colorToUse,  // Use overridden color
    timestamp: Date.now(),
    domain: 'saywhatwant.app',  // Same domain as users
    'message-type': 'AI',
  };
  
  // DEBUG: Log exactly what we're posting
  // Silent - debug logs removed for clean output
  
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
      // Get fresh config for hot-reload capability
      const config = getConfig();
      const maxMessagesToRead = Math.max(...config.entities.map((e: any) => e.nom || 100));
      
      // Silent fetch - only log errors or new messages
      const messages = await kvClient.fetchRecentComments(maxMessagesToRead);
      
      if (messages.length > 0) {
        // Update message history
        state.messageHistory = messages;
        state.lastMessageTimestamp = Math.max(...messages.map(m => m.timestamp));
        
        if (USE_QUEUE && queueService) {
          // QUEUE MODE: Process ALL HUMAN messages (not AI responses)
          // Silent analysis - only log when queuing new messages
          
          // Rolling cleanup: Remove session IDs older than 5 minutes
          // This runs every poll cycle (10s) - simple, continuous maintenance
          const now = Date.now();
          const cutoff = now - SESSION_WINDOW_MS;
          let cleanedCount = 0;
          
          for (const [id, timestamp] of queuedThisSession.entries()) {
            if (timestamp < cutoff) {
              queuedThisSession.delete(id);
              cleanedCount++;
            }
          }
          
          // Silent cleanup
          
          let queued = 0;
          let skipped = 0;
          
          
          for (const message of messages) {
            // Skip AI messages (not for bot) - SILENT
            if (message['message-type'] === 'AI') {
              skipped++;
              continue;
            }
            
            // Skip if no botParams (human-to-human message) - SILENT
            if (!message.botParams) {
              skipped++;
              continue;
            }
            
            // Only process messages explicitly marked as unprocessed - SILENT
            // This skips both processed messages (true) and old messages (undefined)
            if (message.botParams.processed !== false) {
              skipped++;
              continue;
            }
            
            // Check if already queued this session (prevents duplicate queueing) - SILENT
            if (queuedThisSession.has(message.id)) {
              skipped++;
              continue;
            }
            
            console.log(chalk.blue('[QUEUE]'), `New unprocessed message from ${message.username}: "${message.text.substring(0, 40)}..."`);
            
            const botParams = message.botParams;
            
            // Validate entity using EntityValidator
            const validation = entityValidator.validateEntity(botParams, {
              id: message.id,
              text: message.text
            });
            
            if (!validation.valid) {
              skipped++;
              continue; // Skip invalid message, process next
            }
            
            const entity = validation.entity;
            
            // 2. DETERMINE PRIORITY (with fallback chain)
            let priority;
            if (botParams.priority !== undefined) {
              priority = Math.max(0, Math.min(99, botParams.priority));
            } else {
              priority = entity.defaultPriority || 50;
            }
            
            // Check rate limits before queuing
            const rateLimitCheck = entityManager.checkRateLimits(entity.id);
            if (!rateLimitCheck.allowed) {
              logger.debug(`[${botId}] Skipping queue: ${rateLimitCheck.reason}`);
              continue;  // Skip this message
            }
            
            // 3. SELECT MODEL (with fallback chain)
            const entityModel = getModelName(entity);
            const modelToUse = botParams.model || entityModel;
            
            // Use pre-formatted context from frontend - NO FALLBACK
            const contextForLLM = message.context || [];
            
            // Queue the message with GUARANTEED unique ID
            const queueItem = {
              id: `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
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
            
            // Mark as queued this session with timestamp
            queuedThisSession.set(message.id, Date.now());
            
            // Emit WebSocket event
            if (queueWS) {
              queueWS.onQueued(queueItem);
            }
            
            // Color-code priority for visibility
            const priorityColor = priority <= 9 ? chalk.magenta : chalk.cyan;
            console.log(priorityColor('[QUEUE]'), `Queued: ${message.username} → ${entity.username} (priority ${priority})`);
            queued++;
          }
          
          // No state to update - we're stateless and that's good for scale
          
          // Silent summary - only logged new messages above
        } else {
          // DIRECT MODE: Disabled - queue system required
          console.error(chalk.red('[DIRECT]'), 'Direct mode disabled - use queue system with entity specified');
          continue; // Skip this cycle
        }
        
        // Check for ping trigger (queue with highest priority)
        if (USE_QUEUE && queueService && analyzer.hasPingTrigger(messages)) {
          // Silent - ping requires entity
          continue; // Skip - pings need entity specified too
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
      // Silent polling - no cycle timing logs
      
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
        // Build context object - include the triggering message at the end
        const triggeringMessage = `${item.message.username}: ${item.message.text}`;
        const fullContext = [...item.context, triggeringMessage];
        
        const context = {
          recentMessages: fullContext.join('\n'),
          activeUsers: [],
          topics: [],
          hasQuestion: fullContext.some(msg => msg.includes('?')),
          mentionsBot: false
        };
        
        // Generate response using existing function (pass entity from queue item)
        const response = await generateResponse(context, item.entity);
        
        if (response) {
          // LM Studio returned successfully! Mark message as processed immediately
          console.log(chalk.green('[WORKER]'), `Got response from LM Studio - marking message as processed`);
          const updateSuccess = await kvClient.updateProcessedStatus(item.message.id, true);
          
          if (!updateSuccess) {
            console.error(chalk.red('[CRITICAL]'), `❌ Failed to mark ${item.message.id} as processed - WILL REPROCESS!`);
            console.error(chalk.red('[CRITICAL]'), `This causes duplicate AI responses!`);
            // Continue anyway - we have a valid response to post
          } else {
            console.log(chalk.gray('[KV]'), `✅ Marked ${item.message.id} as processed`);
          }
          
          // Extract ais from botParams (AI identity override)
          const aisOverride = item.message.botParams?.ais || undefined;
          
          // Silent ais processing
          
          // Post with ais override (if present) - pass entity from queue item
          await postComment(response, item.entity, aisOverride);
          
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