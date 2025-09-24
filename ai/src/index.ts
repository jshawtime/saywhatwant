#!/usr/bin/env node
/**
 * Say What Want AI Bot
 * Powered by LM Studio
 */

import OpenAI from 'openai';
import fetch from 'node-fetch';
import chalk from 'chalk';
import { CONFIG } from './config.js';
import { Comment, CommentsResponse, BotState, ResponseDecision, ConversationContext } from './types.js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { logger } from './console-logger.js';

// Load AI entities configuration
const __dirname = dirname(fileURLToPath(import.meta.url));
const entitiesConfigPath = join(__dirname, '..', 'config-aientities.json');
let entitiesConfig: any;

try {
  const configData = readFileSync(entitiesConfigPath, 'utf-8');
  entitiesConfig = JSON.parse(configData);
  console.log(chalk.green('[CONFIG]'), `Loaded ${entitiesConfig.entities.length} AI entities`);
} catch (err) {
  console.error(chalk.red('[ERROR]'), 'Failed to load config-aientities.json:', err);
  process.exit(1);
}

// Initialize OpenAI client for LM Studio with timeout
const lmStudio = new OpenAI({
  baseURL: `${CONFIG.LM_STUDIO.baseURL}/v1`,
  apiKey: CONFIG.LM_STUDIO.apiKey,
  timeout: 30000, // 30 second timeout
  maxRetries: 2,   // Retry up to 2 times if busy
});

// Track if LM Studio is currently processing
let isLMStudioBusy = false;

// Track rate limits per entity
const entityRateLimits: { [entityId: string]: { 
  lastPostTime: number;
  postsThisMinute: number;
  postsThisHour: number;
  minuteResetTime: number;
  hourResetTime: number;
}} = {};

// Initialize rate limits for all entities
entitiesConfig.entities.forEach((entity: any) => {
  entityRateLimits[entity.id] = {
    lastPostTime: 0,
    postsThisMinute: 0,
    postsThisHour: 0,
    minuteResetTime: Date.now() + 60000,
    hourResetTime: Date.now() + 3600000
  };
});

// Select random entity for initialization (only enabled ones)
const selectRandomEntity = () => {
  const enabledEntities = entitiesConfig.entities.filter((e: any) => e.enabled !== false);
  if (enabledEntities.length === 0) {
    console.error(chalk.red('[ERROR]'), 'No enabled entities found!');
    process.exit(1);
  }
  return enabledEntities[Math.floor(Math.random() * enabledEntities.length)];
};

let currentEntity = selectRandomEntity();

// Bot state
const state: BotState = {
  lastMessageTimestamp: Date.now(),
  lastResponseTime: 0,
  messageHistory: [],
  currentUsername: currentEntity.username,
  currentColor: currentEntity.color,
  messagesThisMinute: 0,
  minuteResetTime: Date.now() + 60000,
  consecutiveSilence: 0,
};

// Logging utilities (delegate to console logger)
const log = {
  info: (msg: string, data?: any) => {
    logger.info(msg, data);
    console.log(chalk.blue('[INFO]'), msg);
  },
  success: (msg: string, data?: any) => {
    logger.success(msg, data);
    console.log(chalk.green('[SUCCESS]'), msg);
  },
  warn: (msg: string, data?: any) => {
    logger.warn(msg, data);
    console.log(chalk.yellow('[WARN]'), msg);
  },
  error: (msg: string, data?: any) => {
    logger.error(msg, data);
    console.log(chalk.red('[ERROR]'), msg);
  },
  debug: (msg: string, data?: any) => {
    if (CONFIG.LOGGING.level === 'debug') {
      logger.debug(msg, data);
      console.log(chalk.gray('[DEBUG]'), msg);
    }
  },
};

/**
 * Generate a unique ID for comments (matching app's format)
 */
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Fetch recent comments from Say What Want
 */
async function fetchRecentComments(): Promise<Comment[]> {
  try {
    const url = `${CONFIG.SWW_API.baseURL}${CONFIG.SWW_API.endpoints.getComments}?cursor=${state.lastMessageTimestamp}`;
    
    log.debug(`Fetching comments from: ${url}`);
    
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json() as CommentsResponse;
    
    // Update last timestamp if we got new messages
    if (data.comments.length > 0) {
      const latestTimestamp = Math.max(...data.comments.map(c => c.timestamp));
      state.lastMessageTimestamp = latestTimestamp;
      
      // Add to history (keep last N messages)
      state.messageHistory = [
        ...state.messageHistory,
        ...data.comments
      ].slice(-(currentEntity?.contextWindow || CONFIG.BOT.contextMessageCount));
      
      log.info(`Fetched ${data.comments.length} new messages`);
      
      // Log each message to monitoring console
      data.comments.forEach(comment => {
        logger.message(
          comment.username || 'Anonymous',
          comment.text,
          comment.color || undefined
        );
      });
    }
    
    return data.comments;
  } catch (error) {
    log.error(`Failed to fetch comments: ${error}`);
    return [];
  }
}

/**
 * Analyze conversation context
 */
function analyzeContext(messages: Comment[]): ConversationContext {
  // IMPORTANT: Sophisticated conversation filtering based on entity settings
  // Allows for: human-only bots, AI-only bots, and specific AI conversation groups
  
  // Get all bot usernames for classification
  const BOT_USERNAMES = entitiesConfig.entities.map((entity: any) => entity.username.toLowerCase());
  
  // Filter messages based on current entity's conversation settings
  const conversationMessages = messages.filter(m => {
    const username = m.username || '';
    const usernameLower = username.toLowerCase();
    
    // Always filter out THIS bot's own messages to prevent self-replies
    if (username === state.currentUsername) {
      return false;
    }
    
    // Check if it's a bot or human message
    const isBot = BOT_USERNAMES.includes(usernameLower);
    
    // Get current entity's conversation settings (with defaults)
    const settings = currentEntity?.conversationSettings || {
      respondsToHumanMessages: true,
      respondsToAllAiMessages: true,
      respondsToTheseAiOnly: []
    };
    
    // Apply conversation filters
    if (!isBot && !settings.respondsToHumanMessages) {
      return false; // Don't include humans if disabled
    }
    
    if (isBot) {
      if (settings.respondsToAllAiMessages) {
        return true; // Include all AI messages
      }
      // Check if this bot is in the specific response list
        const allowedBots = settings.respondsToTheseAiOnly.map((id: string) => {
          const bot = entitiesConfig.entities.find((e: any) => e.id === id);
          return bot?.username?.toLowerCase();
        }).filter(Boolean) as string[];
      
      return allowedBots.includes(usernameLower);
    }
    
    return true; // Default: include the message
  });
  
  // If no messages at all, use empty context
  if (conversationMessages.length === 0) {
    return {
      recentMessages: '',
      activeUsers: [],
      activityLevel: 'quiet' as const,
      hasQuestion: false,
      mentionsBot: false,
    };
  }
  
  const recentMessages = conversationMessages
    .map(m => `${m.username || 'anon'}: ${m.text}`)
    .join('\n');
  
  const activeUsers = [...new Set(conversationMessages.map(m => m.username).filter(Boolean))] as string[];
  
  // Activity level
  const messagesPerMinute = conversationMessages.length / 5; // Last 5 minutes
  const activityLevel = messagesPerMinute < 1 ? 'quiet' :
                        messagesPerMinute < 3 ? 'moderate' : 'busy';
  
  // Check for questions or mentions
  const lastFewMessages = conversationMessages.slice(-3);
  const hasQuestion = lastFewMessages.some(m => m.text.includes('?'));
  const mentionsBot = lastFewMessages.some(m => 
    m.text.toLowerCase().includes(state.currentUsername.toLowerCase())
  );
  
  return {
    recentMessages,
    activeUsers,
    activityLevel,
    hasQuestion,
    mentionsBot,
  };
}

/**
 * Decide whether to respond
 */
function shouldRespond(context: ConversationContext): ResponseDecision {
  // Allow bot-to-bot conversations! Infinite discussions are a feature, not a bug!
  if (!context.recentMessages || context.recentMessages.length === 0) {
    return { shouldRespond: false, reason: 'No messages to respond to', confidence: 0 };
  }
  
  // SPECIAL CASE: Always respond to ping immediately
  const recentText = context.recentMessages.toLowerCase();
  if (recentText.includes('ping')) {
    return { shouldRespond: true, reason: 'PING detected - immediate response', confidence: 1.0 };
  }
  
  // Skip rate limits for ping (already checked it's a ping above)
  if (!context.recentMessages.toLowerCase().includes('ping')) {
    // Check entity-specific rate limits
    const entityLimits = entityRateLimits[currentEntity.id];
    const now = Date.now();
    
    // Reset minute counter if needed
    if (now > entityLimits.minuteResetTime) {
      entityLimits.postsThisMinute = 0;
      entityLimits.minuteResetTime = now + 60000;
    }
    
    // Reset hour counter if needed
    if (now > entityLimits.hourResetTime) {
      entityLimits.postsThisHour = 0;
      entityLimits.hourResetTime = now + 3600000;
    }
    
    // Check per-minute limit for this entity
    if (entityLimits.postsThisMinute >= currentEntity.rateLimits.maxPostsPerMinute) {
      return { shouldRespond: false, reason: `${currentEntity.username} rate limit (minute) exceeded`, confidence: 0 };
    }
    
    // Check per-hour limit for this entity
    if (entityLimits.postsThisHour >= currentEntity.rateLimits.maxPostsPerHour) {
      return { shouldRespond: false, reason: `${currentEntity.username} rate limit (hour) exceeded`, confidence: 0 };
    }
    
    // Check minimum time between posts for this entity
    const timeSinceLastPost = now - entityLimits.lastPostTime;
    if (timeSinceLastPost < (currentEntity.rateLimits.minSecondsBetweenPosts * 1000)) {
      return { shouldRespond: false, reason: `${currentEntity.username} posted too recently`, confidence: 0 };
    }
  }
  
  // High priority: Direct mention
  if (context.mentionsBot && CONFIG.BOT.respondToMentions) {
    return { shouldRespond: true, reason: 'Bot was mentioned', confidence: 0.9 };
  }
  
  // Medium priority: Question in conversation
  if (context.hasQuestion && CONFIG.BOT.respondToQuestions) {
    const confidence = context.activityLevel === 'quiet' ? 0.8 : 0.6;
    return { shouldRespond: true, reason: 'Question detected', confidence };
  }
  
  // Low priority: Random engagement based on current entity's response chance
  const randomChance = Math.random();
  if (randomChance < currentEntity.responseChance) {
    // Less likely to respond if busy
    const adjustedChance = context.activityLevel === 'busy' ? 
      currentEntity.responseChance * 0.5 : currentEntity.responseChance;
    
    if (randomChance < adjustedChance) {
      return { shouldRespond: true, reason: `${currentEntity.username} wants to engage`, confidence: 0.3 };
    }
  }
  
  // Track consecutive silence to avoid being too quiet
  state.consecutiveSilence++;
  if (state.consecutiveSilence > 10 && context.activityLevel === 'moderate') {
    state.consecutiveSilence = 0;
    return { shouldRespond: true, reason: 'Breaking silence', confidence: 0.4 };
  }
  
  return { shouldRespond: false, reason: 'No trigger conditions met', confidence: 0 };
}

/**
 * Generate response using LM Studio
 */
async function generateResponse(context: ConversationContext): Promise<string | null> {
  // Check if LM Studio is busy
  if (isLMStudioBusy) {
    log.debug('LM Studio is busy, skipping this cycle');
    return null;
  }
  
  try {
    // Mark LM Studio as busy
    isLMStudioBusy = true;
    
    // Entity already selected in main loop before context analysis
    
    // Check if this is a ping request
    const isPing = context.recentMessages.toLowerCase().includes('ping');
    
    // Build the context-aware prompt
    const contextInfo = isPing 
      ? `\n\nSomeone just sent a ping! Respond briefly to acknowledge you're here and active. Context: ${context.recentMessages}`
      : `\n\nContext: ${context.recentMessages}\nActive users: ${context.activeUsers.join(', ')}`;
    const fullPrompt = currentEntity.systemPrompt + contextInfo;
    
    log.debug(`Generating response as ${currentEntity.username} (${currentEntity.id}) using model: ${currentEntity.model}`);
    
    const completion = await lmStudio.chat.completions.create({
      model: currentEntity.model || entitiesConfig.globalSettings.defaultModel || CONFIG.LM_STUDIO.model,
      messages: [
        { role: 'system', content: fullPrompt },
        { role: 'user', content: currentEntity.userPrompt || 'Generate a response based on the conversation context. Keep it natural and conversational.' }
      ],
      temperature: currentEntity.temperature,
      max_tokens: currentEntity.maxTokens,
      top_p: currentEntity.topP,
      frequency_penalty: 0.3,
      presence_penalty: 0.3,
      // Note: top_k, repeat_penalty, and min_p are LM Studio specific parameters
      // They may not work with standard OpenAI API but LM Studio may support them
      // as custom extensions
    } as any);
    
    const response = completion.choices[0]?.message?.content || null;
    
    // Check if bot chose to skip
    if (response?.includes('[SKIP]')) {
      log.debug('Bot chose not to respond');
      return null;
    }
    
    // Entity is now randomly selected for each response in generateResponse()
    // No need to change username/color here anymore
    
    isLMStudioBusy = false; // Mark as not busy
    return response;
  } catch (error: any) {
    isLMStudioBusy = false; // Mark as not busy even on error
    // Check if LM Studio is busy or timeout
    if (error.message?.includes('timeout') || error.message?.includes('ECONNREFUSED')) {
      log.warn(`LM Studio busy/timeout for ${currentEntity.username}, will retry next cycle`);
    } else if (error.status === 503 || error.status === 429) {
      log.warn(`LM Studio overloaded (${error.status}), backing off...`);
      // Add exponential backoff
      await new Promise(resolve => setTimeout(resolve, 5000));
    } else {
      log.error(`Failed to generate response: ${error}`);
    }
    return null;
  }
}

/**
 * Post comment to Say What Want
 */
async function postComment(text: string): Promise<boolean> {
  try {
    // Check for dry run mode
    if (CONFIG.DEV.dryRun) {
      log.info(`[DRY RUN] Would post: "${text}" as ${state.currentUsername} with color ${state.currentColor}`);
      return true;
    }
    
    const comment: Comment = {
      id: generateId(),
      text,
      username: state.currentUsername,
      color: state.currentColor,
      timestamp: Date.now(),
      domain: 'saywhatwant.app', // Set proper domain so messages appear
    };
    
    // Log the exact payload being sent
    console.log('=== SENDING TO KV ===');
    console.log('URL:', `${CONFIG.SWW_API.baseURL}${CONFIG.SWW_API.endpoints.postComment}`);
    console.log('Payload:', JSON.stringify(comment, null, 2));
    console.log('===================');
    
    const response = await fetch(
      `${CONFIG.SWW_API.baseURL}${CONFIG.SWW_API.endpoints.postComment}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(comment),
      }
    );
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    log.success(`Posted: "${text}" as ${state.currentUsername}`);
    
    // Log bot response to monitoring console
    logger.response(
      state.currentUsername,
      text,
      state.currentColor,
      undefined // We'll pass confidence later
    );
    
    // Update state
    state.lastResponseTime = Date.now();
    state.messagesThisMinute++;
    state.consecutiveSilence = 0;
    
    // Update entity-specific rate limits
    const entityLimits = entityRateLimits[currentEntity.id];
    entityLimits.lastPostTime = Date.now();
    entityLimits.postsThisMinute++;
    entityLimits.postsThisHour++;
    
    return true;
  } catch (error) {
    log.error(`Failed to post comment: ${error}`);
    return false;
  }
}

/**
 * Main polling loop
 */
async function runBot() {
  const entityNames = entitiesConfig.entities.map((e: any) => e.username).slice(0, 3).join(', ');
  log.info(chalk.bold.cyan(`
╔════════════════════════════════════════╗
║     Say What Want AI Entities          ║
╠════════════════════════════════════════╣
║ LM Studio: ${CONFIG.LM_STUDIO.baseURL.padEnd(28)}║
║ Model: ${entitiesConfig.globalSettings.defaultModel.padEnd(33)}║
║ API: ${CONFIG.SWW_API.baseURL.padEnd(35)}║
║ Mode: ${CONFIG.DEV.dryRun ? 'DRY RUN' : 'LIVE 🔴'.padEnd(34)}║
║ Entities: ${String(entitiesConfig.entities.length + ' loaded').padEnd(29)}║
║ Active: ${entityNames.padEnd(31)}║
╚════════════════════════════════════════╝
  `));
  
  // Test LM Studio connection
  try {
    log.info('Testing LM Studio connection...');
    const models = await lmStudio.models.list();
    log.success(`Connected to LM Studio! Available models: ${models.data.map(m => m.id).join(', ')}`);
  } catch (error) {
    log.error(`Failed to connect to LM Studio: ${error}`);
    log.error('Please ensure LM Studio is running and accessible at: ' + CONFIG.LM_STUDIO.baseURL);
    process.exit(1);
  }
  
  // Main loop
  while (true) {
    try {
      // Fetch recent comments
      const newComments = await fetchRecentComments();
      
      if (newComments.length > 0) {
        // Select entity FIRST so we know which conversation settings to use
        currentEntity = selectRandomEntity();
        state.currentUsername = currentEntity.username;
        state.currentColor = currentEntity.color;
        
        // Log conversation settings for debugging
        const settings = currentEntity.conversationSettings || {
          respondsToHumanMessages: true,
          respondsToAllAiMessages: true,
          respondsToTheseAiOnly: []
        };
        console.log(`[${currentEntity.username}] Conversation settings:`, {
          respondsToHumans: settings.respondsToHumanMessages,
          respondsToAllAI: settings.respondsToAllAiMessages,
          specificAIs: settings.respondsToTheseAiOnly
        });
        
        // Analyze context with current entity's settings
        const context = analyzeContext(state.messageHistory);
        console.log('=== CONTEXT ANALYSIS ===');
        console.log('Total messages in history:', state.messageHistory.length);
        console.log('Filtered messages for this entity:', context.activeUsers.length > 0 ? 'YES' : 'NO');
        console.log('Active users:', context.activeUsers);
        console.log('Has question?', context.hasQuestion);
        console.log('=======================');
        
        // Decide whether to respond
        const decision = shouldRespond(context);
        log.debug(`Response decision: ${decision.reason} (confidence: ${decision.confidence})`);
        
        if (decision.shouldRespond) {
          // Generate response (entity already selected above)
          const response = await generateResponse(context);
          
          if (response && response.trim()) {
            // Post the response
            await postComment(response.trim());
          }
        }
      }
      
      // Wait before next poll
      await new Promise(resolve => setTimeout(resolve, CONFIG.BOT.pollingInterval));
      
    } catch (error) {
      log.error(`Bot loop error: ${error}`);
      // Continue running despite errors
      await new Promise(resolve => setTimeout(resolve, CONFIG.BOT.pollingInterval));
    }
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  log.info('\nShutting down bot gracefully...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  log.info('\nShutting down bot gracefully...');
  process.exit(0);
});

// Start the bot
runBot().catch(error => {
  log.error(`Fatal error: ${error}`);
  process.exit(1);
});
