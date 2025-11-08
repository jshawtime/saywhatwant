// Bot parameters - Complete URL control over bot behavior
export interface BotParams {
  entity?: string;      // Force specific entity ID (e.g., hm-st-1, philosopher)
  priority?: number;    // Queue priority 0-99 (0=highest)
  model?: string;       // Override LLM model selection
  nom?: number | 'ALL'; // Context size override (number of messages or ALL)
  ais?: string;         // AI identity override: "username:color" or "username:random"
  processed?: boolean;  // Track if message has been processed by bot (persistent in KV)
  status?: 'pending' | 'processing' | 'complete' | 'failed'; // Queue status (new queue system)
  claimedBy?: string;   // Worker ID that claimed this message
  claimedAt?: number;   // Timestamp when claimed
  attempts?: number;    // Retry count
}

// Comment types - MUST match KV structure exactly
export interface Comment {
  id: string;                    // e.g., "1759244943773-z4timztmx"
  text: string;                   // Message content
  timestamp: number;              // Unix timestamp as NUMBER (not string!)
  username: string;               // User's display name (required in KV)
  domain: string;                 // Always "saywhatwant.app" (required in KV)
  color: string;                  // 9-digit format like "220020060" (required in KV)
  language: string;               // Language code, e.g., "en" (required in KV)
  'message-type': string;         // "AI" or "human" - hyphenated key! (required in KV)
  misc: string;                   // Additional data, usually empty string (required in KV)
  context?: string[];             // Pre-formatted context messages from frontend
  botParams?: BotParams;          // Bot control parameters from URL (structured, type-safe)
  replyTo?: string;               // For AI messages: ID of human message being replied to
  eqScore?: number;               // Emotional Intelligence score 0-100 (for human messages)
}

export interface CommentsResponse {
  comments: Comment[];
  total: number;
  hasMore: boolean;
  nextCursor?: string;
  serverSideSearch?: boolean;  // Flag to indicate server-side search results
  searchedUsers?: Array<{username: string; color: string | null}>;  // Users that were searched for
}

// Video types
export interface VideoManifest {
  videos: VideoItem[];
  lastUpdated: string;
  total: number;
}

export interface VideoItem {
  key: string;
  url: string;
  size: number;
  lastModified: string;
  contentType: string;
}
