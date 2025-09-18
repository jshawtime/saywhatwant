// Comment types
export interface Comment {
  id: string;
  text: string;
  timestamp: number;
  username?: string;
  userAgent?: string;
  color?: string; // User's chosen color
}

export interface CommentsResponse {
  comments: Comment[];
  total: number;
  hasMore: boolean;
  nextCursor?: string;
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
