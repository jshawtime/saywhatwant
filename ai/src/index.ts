#!/usr/bin/env node
/**
 * Say What Want AI Bot
 * Powered by LM Studio
 */

import OpenAI from 'openai';
import fetch from 'node-fetch';
import chalk from 'chalk';
import { CONFIG, SYSTEM_PROMPT, USERNAME_POOL, COLOR_POOL } from './config.js';
import { Comment, CommentsResponse, BotState, ResponseDecision, ConversationContext } from './types.js';

// Initialize OpenAI client for LM Studio
const lmStudio = new OpenAI({
  baseURL: `${CONFIG.LM_STUDIO.baseURL}/v1`,
  apiKey: CONFIG.LM_STUDIO.apiKey,
});

// Bot state
const state: BotState = {
  lastMessageTimestamp: Date.now(),
  lastResponseTime: 0,
  messageHistory: [],
  currentUsername: CONFIG.BOT.defaultUsername,
  currentColor: COLOR_POOL[0],
  messagesThisMinute: 0,
  minuteResetTime: Date.now() + 60000,
  consecutiveSilence: 0,
};

// Logging utilities
const log = {
  info: (msg: string) => console.log(chalk.blue('[INFO]'), msg),
  success: (msg: string) => console.log(chalk.green('[SUCCESS]'), msg),
  warn: (msg: string) => console.log(chalk.yellow('[WARN]'), msg),
  error: (msg: string) => console.log(chalk.red('[ERROR]'), msg),
  debug: (msg: string) => {
    if (CONFIG.LOGGING.level === 'debug') {
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
      ].slice(-CONFIG.BOT.contextMessageCount);
      
      log.info(`Fetched ${data.comments.length} new messages`);
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
  const recentMessages = messages
    .map(m => `${m.username || 'anon'}: ${m.text}`)
    .join('\n');
  
  const activeUsers = [...new Set(messages.map(m => m.username).filter(Boolean))] as string[];
  
  // Simple topic extraction (words that appear multiple times)
  const words = messages.map(m => m.text).join(' ').toLowerCase().split(/\s+/);
  const wordCounts = words.reduce((acc, word) => {
    if (word.length > 4) {
      acc[word] = (acc[word] || 0) + 1;
    }
    return acc;
  }, {} as Record<string, number>);
  
  const topics = Object.entries(wordCounts)
    .filter(([_, count]) => count > 2)
    .map(([word]) => word)
    .slice(0, 5);
  
  // Activity level
  const messagesPerMinute = messages.length / 5; // Last 5 minutes
  const activityLevel = messagesPerMinute < 1 ? 'quiet' :
                        messagesPerMinute < 3 ? 'moderate' : 'busy';
  
  // Check for questions or mentions
  const lastFewMessages = messages.slice(-3);
  const hasQuestion = lastFewMessages.some(m => m.text.includes('?'));
  const mentionsBot = lastFewMessages.some(m => 
    m.text.toLowerCase().includes(state.currentUsername.toLowerCase())
  );
  
  return {
    recentMessages,
    activeUsers,
    topics,
    activityLevel,
    hasQuestion,
    mentionsBot,
  };
}

/**
 * Decide whether to respond
 */
function shouldRespond(context: ConversationContext): ResponseDecision {
  // Check rate limiting (per minute)
  if (Date.now() > state.minuteResetTime) {
    state.messagesThisMinute = 0;
    state.minuteResetTime = Date.now() + 60000;
  }
  
  if (state.messagesThisMinute >= CONFIG.BOT.maxMessagesPerMinute) {
    return { shouldRespond: false, reason: 'Rate limit exceeded', confidence: 0 };
  }
  
  // Check minimum time between messages
  const timeSinceLastMessage = Date.now() - state.lastResponseTime;
  if (timeSinceLastMessage < CONFIG.BOT.minTimeBetweenMessages) {
    return { shouldRespond: false, reason: 'Too soon after last message', confidence: 0 };
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
  
  // Low priority: Random engagement
  const randomChance = Math.random();
  if (randomChance < CONFIG.BOT.respondToProbability) {
    // Less likely to respond if busy
    const adjustedChance = context.activityLevel === 'busy' ? 
      CONFIG.BOT.respondToProbability * 0.5 : CONFIG.BOT.respondToProbability;
    
    if (randomChance < adjustedChance) {
      return { shouldRespond: true, reason: 'Random engagement', confidence: 0.3 };
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
  try {
    // Build the system prompt with current context
    const systemPrompt = SYSTEM_PROMPT
      .replace('{username}', state.currentUsername)
      .replace('{color}', state.currentColor)
      .replace('{time}', new Date().toLocaleTimeString())
      .replace('{topics}', context.topics.join(', ') || 'general chat')
      .replace('{activeUsers}', context.activeUsers.join(', ') || 'various users')
      .replace('{activityLevel}', context.activityLevel)
      .replace('{recentMessages}', context.recentMessages);
    
    log.debug('Generating response with LM Studio...');
    
    const completion = await lmStudio.chat.completions.create({
      model: CONFIG.LM_STUDIO.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: 'Generate a response based on the conversation context. Reply with [SKIP] if you choose not to respond.' }
      ],
      temperature: CONFIG.LM_STUDIO.temperature,
      max_tokens: CONFIG.LM_STUDIO.maxTokens,
      top_p: CONFIG.LM_STUDIO.topP,
      frequency_penalty: CONFIG.LM_STUDIO.frequencyPenalty,
      presence_penalty: CONFIG.LM_STUDIO.presencePenalty,
    });
    
    const response = completion.choices[0]?.message?.content || null;
    
    // Check if bot chose to skip
    if (response?.includes('[SKIP]')) {
      log.debug('Bot chose not to respond');
      return null;
    }
    
    // Occasionally change username
    if (CONFIG.BOT.allowUsernameChange && Math.random() < CONFIG.BOT.usernameChangeFrequency) {
      const newUsername = USERNAME_POOL[Math.floor(Math.random() * USERNAME_POOL.length)];
      if (newUsername !== state.currentUsername) {
        log.info(`Changing username from ${state.currentUsername} to ${newUsername}`);
        state.currentUsername = newUsername;
      }
    }
    
    // Occasionally change color
    if (CONFIG.BOT.allowColorChange && Math.random() < CONFIG.BOT.colorChangeFrequency) {
      const newColor = COLOR_POOL[Math.floor(Math.random() * COLOR_POOL.length)];
      if (newColor !== state.currentColor) {
        log.info(`Changing color from ${state.currentColor} to ${newColor}`);
        state.currentColor = newColor;
      }
    }
    
    return response;
  } catch (error) {
    log.error(`Failed to generate response: ${error}`);
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
      domain: 'ai.saywhatwant.app',
    };
    
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
    
    // Update state
    state.lastResponseTime = Date.now();
    state.messagesThisMinute++;
    state.consecutiveSilence = 0;
    
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
  log.info(chalk.bold.cyan(`
╔════════════════════════════════════════╗
║     Say What Want AI Bot Starting      ║
╠════════════════════════════════════════╣
║ LM Studio: ${CONFIG.LM_STUDIO.baseURL.padEnd(28)}║
║ Model: ${CONFIG.LM_STUDIO.model.padEnd(33)}║
║ API: ${CONFIG.SWW_API.baseURL.padEnd(35)}║
║ Mode: ${CONFIG.DEV.dryRun ? 'DRY RUN' : 'LIVE 🔴'.padEnd(34)}║
║ Rate Limit: ${String(CONFIG.BOT.maxMessagesPerMinute + ' msgs/min').padEnd(28)}║
║ Response %: ${String(CONFIG.BOT.respondToProbability * 100 + '%').padEnd(28)}║
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
        // Analyze context
        const context = analyzeContext(state.messageHistory);
        
        // Decide whether to respond
        const decision = shouldRespond(context);
        log.debug(`Response decision: ${decision.reason} (confidence: ${decision.confidence})`);
        
        if (decision.shouldRespond) {
          // Generate response
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
