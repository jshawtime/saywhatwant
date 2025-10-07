/**
 * Conversation Analyzer Module
 * Analyzes message context and determines conversation dynamics
 */

import { Comment } from '../types.js';
import { AIEntity } from './entityManager.js';
// import { logger } from '../console-logger.js'; // Unused - commented out

export interface ConversationContext {
  recentMessages: string;
  activeUsers: string[];
  activityLevel: 'quiet' | 'moderate' | 'busy';
  hasQuestion: boolean;
  mentionsBot: boolean;
  totalMessages: number;
  filteredMessages: Comment[];
}

export interface ResponseDecision {
  shouldRespond: boolean;
  reason: string;
  confidence: number;
}

/**
 * Conversation Analyzer Class
 * Provides context analysis and response decision making
 */
export class ConversationAnalyzer {
  
  /**
   * Analyze conversation context from recent messages
   */
  public analyzeContext(messages: Comment[], entity: AIEntity): ConversationContext {
    console.log('=== CONTEXT ANALYSIS ===');
    console.log('Total messages in history:', messages.length);
    
    // Filter messages based on entity's conversation settings
    let filteredMessages = this.filterMessagesForEntity(messages, entity);
    
    // Limit to entity's nom (take the most recent ones)
    const nom = entity.nom || 100;
    if (filteredMessages.length > nom) {
      filteredMessages = filteredMessages.slice(-nom);
      console.log(`Trimmed to last ${nom} messages for entity's message limit`);
    }
    
    console.log('Filtered messages for this entity:', filteredMessages.length > 0 ? 'YES' : 'NO');
    
    // If no messages at all, use empty context
    if (filteredMessages.length === 0) {
      return {
        recentMessages: '',
        activeUsers: [],
        activityLevel: 'quiet',
        hasQuestion: false,
        mentionsBot: false,
        totalMessages: 0,
        filteredMessages: [],
      };
    }
    
    // Build context from filtered messages
    const recentMessages = filteredMessages
      .map(m => `${m.username || 'anon'}: ${m.text}`)
      .join('\n');
    
    const activeUsers = [...new Set(filteredMessages.map(m => m.username).filter(Boolean))] as string[];
    console.log('Active users:', activeUsers);
    
    // Calculate activity level
    const messagesPerMinute = filteredMessages.length / 5; // Last 5 minutes
    const activityLevel = messagesPerMinute < 1 ? 'quiet' :
                          messagesPerMinute < 3 ? 'moderate' : 'busy';
    
    // Check for questions or mentions
    const lastFewMessages = filteredMessages.slice(-3);
    const hasQuestion = lastFewMessages.some(m => m.text.includes('?'));
    console.log('Has question?', hasQuestion);
    
    const mentionsBot = lastFewMessages.some(m => 
      m.text.toLowerCase().includes(entity.username.toLowerCase())
    );
    
    console.log('=======================');
    
    return {
      recentMessages,
      activeUsers,
      activityLevel,
      hasQuestion,
      mentionsBot,
      totalMessages: filteredMessages.length,
      filteredMessages,
    };
  }
  
  /**
   * Filter messages based on entity's conversation settings
   */
  private filterMessagesForEntity(messages: Comment[], entity: AIEntity): Comment[] {
    const settings = entity.conversationSettings || {
      respondsToHumanMessages: true,
      respondsToAllAiMessages: true,
      respondsToTheseAiOnly: []
    };
    
    return messages.filter(msg => {
      const isBot = msg['message-type'] === 'AI';
      const usernameLower = msg.username?.toLowerCase() || '';
      
      // Check if this is a human message
      if (!isBot) {
        return settings.respondsToHumanMessages;
      }
      
      // Check AI message settings
      if (isBot) {
        if (settings.respondsToAllAiMessages) {
          return true; // Include all AI messages
        }
        
        // Check if this bot is in the specific response list
        const allowedBots = this.getAllowedBotUsernames(settings.respondsToTheseAiOnly);
        return allowedBots.includes(usernameLower);
      }
      
      return true; // Default: include the message
    });
  }
  
  /**
   * Get usernames for allowed bot IDs
   */
  private getAllowedBotUsernames(_botIds: string[]): string[] {
    // For now, return empty array - this needs to be injected from main
    // TODO: Pass entity manager as dependency
    return [];
  }
  
  /**
   * Determine if bot should respond based on context
   */
  public shouldRespond(
    context: ConversationContext, 
    entity: AIEntity,
    rateLimitCheck: { allowed: boolean; reason?: string }
  ): ResponseDecision {
    
    // Check rate limits first
    if (!rateLimitCheck.allowed) {
      return { 
        shouldRespond: false, 
        reason: rateLimitCheck.reason || 'Rate limited', 
        confidence: 0 
      };
    }
    
    // Always respond to direct mentions
    if (context.mentionsBot) {
      return { 
        shouldRespond: true, 
        reason: 'Direct mention', 
        confidence: 0.9 
      };
    }
    
    // Higher chance to respond to questions
    if (context.hasQuestion) {
      const chance = Math.random();
      if (chance < entity.responseChance * 2) { // Double chance for questions
        return { 
          shouldRespond: true, 
          reason: 'Answering question', 
          confidence: 0.7 
        };
      }
    }
    
    // Check response probability
    const randomChance = Math.random();
    if (randomChance < entity.responseChance) {
      // Additional context-based confidence
      const confidence = context.activityLevel === 'busy' ? 
        entity.responseChance * 0.5 : entity.responseChance;
      
      return { 
        shouldRespond: true, 
        reason: `${entity.username} wants to engage`, 
        confidence 
      };
    }
    
    return { 
      shouldRespond: false, 
      reason: 'Random chance not met', 
      confidence: 0 
    };
  }
  
  /**
   * Check if message contains ping trigger
   */
  public hasPingTrigger(messages: Comment[]): boolean {
    return messages.some(msg => 
      msg.text.toLowerCase().includes('ping')
    );
  }
}

// Singleton instance
let analyzerInstance: ConversationAnalyzer | null = null;

export function getConversationAnalyzer(): ConversationAnalyzer {
  if (!analyzerInstance) {
    analyzerInstance = new ConversationAnalyzer();
  }
  return analyzerInstance;
}
