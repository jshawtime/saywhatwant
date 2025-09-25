// Comment types
export interface Comment {
  id: string;
  text: string;
  timestamp: number;
  username?: string;
  domain?: string; // Domain where comment was posted
  color?: string; // User's chosen color
  language?: string; // Language of the comment (default: "en")
  'message-type'?: 'AI' | 'human' | string; // Message type: AI, human, or future types
  misc?: string; // Miscellaneous data field for future use
  // userAgent removed - not needed
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
