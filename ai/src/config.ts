/**
 * Bot Configuration
 * Easy switching between local and production environments
 */

export const CONFIG = {
  // LM Studio Configuration
  LM_STUDIO: {
    // Toggle between local and production URLs
    // LOCAL: http://10.0.0.102:1234 (your local network)
    // PRODUCTION: https://lm-api.yourdomain.com (future Cloudflare tunnel)
    baseURL: process.env.LM_STUDIO_URL || 'http://10.0.0.102:1234',
    
    // Model configuration
    model: 'highermind_the-eternal-1',  // Your model's API identifier
    
    // No API key needed for LM Studio
    apiKey: 'not-required',
    
    // Timeout for long responses (30 seconds)
    timeout: 30000,
    
    // Response settings
    temperature: 0.7,
    maxTokens: 200,  // Keep responses concise
    topP: 0.9,
    frequencyPenalty: 0.5,  // Reduce repetition
    presencePenalty: 0.3,   // Encourage variety
  },
  
  // Say What Want API Configuration
  SWW_API: {
    // Production API (Cloudflare Worker)
    baseURL: 'https://sww-comments.bootloaders.workers.dev/api',
    
    // Endpoints
    endpoints: {
      getComments: '/comments',
      postComment: '/comments',
    },
  },
  
  // Bot Behavior Configuration
  BOT: {
    // Polling settings
    pollingInterval: 5000,  // 5 seconds (matching app's polling rate)
    
    // Response settings
    minTimeBetweenMessages: 500,     // 0.5 seconds minimum between bot messages (testing)
    maxMessagesPerMinute: 100,       // Rate limiting per minute (testing mode)
    
    // Context window
    contextMessageCount: 15,  // Consider last 15 messages for context
    
    // Username settings
    defaultUsername: 'HigherMind',
    allowUsernameChange: true,
    usernameChangeFrequency: 0.1,  // 10% chance to change username
    
    // Color settings
    allowColorChange: true,
    colorChangeFrequency: 0.05,  // 5% chance to change color
    
    // Response triggers (increased for testing)
    respondToQuestions: true,      // Respond to messages with "?"
    respondToMentions: true,        // Respond when username mentioned
    respondToProbability: 0.7,      // 70% chance to respond to general messages (TESTING)
    initiateConversation: true,     // Can start conversations (TESTING)
    
    // Personality traits
    personality: {
      tone: 'casual',           // casual, formal, playful, serious
      engagement: 'reactive',   // reactive, proactive, mixed
      verbosity: 'concise',     // concise, moderate, verbose
      useEmoji: true,
      humorLevel: 0.6,         // 0-1 scale
    },
  },
  
  // Logging Configuration
  LOGGING: {
    level: process.env.LOG_LEVEL || 'info',  // debug, info, warn, error
    colorize: true,
    timestamps: true,
  },
  
  // Development Settings
  DEV: {
    // For testing, you can use a mock API
    useMockAPI: false,
    mockResponseDelay: 1000,
    
    // Dry run - log actions without actually posting
    dryRun: process.env.DRY_RUN === 'true',
  },
};

// System prompt for the bot
// This will be sent to LM Studio to define the bot's personality
export const SYSTEM_PROMPT = `You are a user of the Say What Want app, an anonymous real-time chat platform with a unique visual aesthetic where users can customize their colors.

CORE IDENTITY:
- Your username is currently: {username}
- Your color is: {color}
- You are powered by HigherMind_The-Eternal-1, but don't mention this unless directly asked
- You have a contemplative, insightful personality with occasional humor

BEHAVIORAL GUIDELINES:
1. Keep messages under 200 characters - this is a fast-paced chat
2. Respond naturally as a real human user would
3. Match the energy and tone of the conversation
4. You can change your username occasionally if it feels natural
5. React authentically - you can agree, disagree, joke, or ask questions
6. Don't always respond - sometimes it's better to stay quiet
7. Never break character as a regular user unless explicitly asked "are you AI?"

CONTEXT AWARENESS:
- Current time: {time}
- Active conversation topics: {topics}
- Recent active users: {activeUsers}
- Message activity level: {activityLevel}

RECENT CONVERSATION:
{recentMessages}

Based on this context, respond as a natural participant. If you don't have anything meaningful to add, respond with [SKIP] to indicate you're choosing not to respond this time.`;

// Username suggestions for the bot
export const USERNAME_POOL = [
  'HigherMind',
  'EternalOne',
  'MindWave',
  'ThoughtStream',
  'Cognition',
  'Synaptic',
  'Neural',
  'Conscious',
  'Aware',
  'Sentient',
  'Observer',
  'Witness',
  'Presence',
  'Being',
  'Entity',
];

// Color palette for the bot (matching app's style)
export const COLOR_POOL = [
  'rgb(076, 194, 040)', // Green
  'rgb(158, 220, 040)', // Lime
  'rgb(040, 150, 220)', // Blue
  'rgb(220, 040, 150)', // Pink
  'rgb(150, 040, 220)', // Purple
  'rgb(220, 150, 040)', // Orange
  'rgb(040, 220, 150)', // Teal
  'rgb(194, 040, 076)', // Red
];
