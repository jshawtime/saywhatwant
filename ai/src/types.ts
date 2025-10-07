/**
 * Type definitions for the AI Bot
 */

// Bot control parameters from URL
export interface BotParams {
  entity?: string;      // Force specific entity ID
  priority?: number;    // Queue priority 0-99
  model?: string;       // Override LLM model
  nom?: number | 'ALL'; // Context size override
}

// Comment type matching Say What Want's structure
export interface Comment {
  id: string;
  text: string;
  timestamp: number;
  username?: string;
  domain?: string;
  color?: string;
  language?: string;
  misc?: string;
  'message-type'?: 'AI' | 'human' | string;
  context?: string[];       // Pre-formatted context from frontend
  botParams?: BotParams;    // Structured bot control parameters
}

// Response from Say What Want API
export interface CommentsResponse {
  comments: Comment[];
  total: number;
  hasMore: boolean;
  nextCursor?: string;
  serverSideSearch?: boolean;
  searchedUsers?: Array<{ username: string; color: string | null }>;
}

// Bot state management
export interface BotState {
  lastMessageTimestamp: number;
  lastResponseTime: number;
  messageHistory: Comment[];
  currentUsername: string;
  currentColor: string;
  messagesThisMinute: number;
  minuteResetTime: number;
  consecutiveSilence: number;
}

// LM Studio response types
export interface LMStudioMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LMStudioResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: LMStudioMessage;
    finish_reason: string;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

// Decision types for bot logic
export interface ResponseDecision {
  shouldRespond: boolean;
  reason: string;
  confidence: number;
}

export interface ConversationContext {
  recentMessages: string;
  activeUsers: string[];
  activityLevel: 'quiet' | 'moderate' | 'busy';
  hasQuestion: boolean;
  mentionsBot: boolean;
}
