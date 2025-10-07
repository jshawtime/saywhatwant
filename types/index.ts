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
  contextUsers?: string[];        // NEW: Usernames for LLM context filtering (optional, for filtered conversations)
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
