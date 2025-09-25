/**
 * Cloud API Client Module
 * Handles all interactions with the Cloudflare Worker API
 * 
 * @module cloudApiClient
 * @version 1.0.0
 */

import { Comment, CommentsResponse } from '@/types';
import { COMMENTS_CONFIG } from '@/config/comments-source';

/**
 * Fetch comments from the cloud API
 * @param offset - Number of comments to skip
 * @param limit - Maximum number of comments to return
 * @returns Promise with comments data
 */
export async function fetchCommentsFromCloud(
  offset = 0, 
  limit = COMMENTS_CONFIG.initialLoadCount
): Promise<CommentsResponse> {
  try {
    const url = new URL(COMMENTS_CONFIG.apiUrl);
    url.searchParams.append('offset', offset.toString());
    url.searchParams.append('limit', limit.toString());
    
    const response = await fetch(url.toString());
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data: CommentsResponse = await response.json();
    
    if (COMMENTS_CONFIG.debugMode) {
      console.log('[Cloud API] Fetched comments:', {
        count: data.comments?.length || 0,
        total: data.total,
        hasMore: data.hasMore
      });
    }
    
    return data;
  } catch (err) {
    console.error('[Cloud API] Error fetching comments:', err);
    throw err;
  }
}

/**
 * Post a new comment to the cloud API
 * @param comment - Comment data to post
 * @returns Promise with the saved comment
 */
export async function postCommentToCloud(comment: {
  id: string;  // Client-generated ID
  timestamp: number;  // Client-generated timestamp
  text: string;
  username?: string;
  color?: string;
  domain: string;
  language?: string;
  'message-type'?: 'AI' | 'human' | string;
  misc?: string;
}): Promise<Comment> {
  try {
    const response = await fetch(COMMENTS_CONFIG.apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(comment),
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const savedComment = await response.json();
    
    if (COMMENTS_CONFIG.debugMode) {
      console.log('[Cloud API] Posted comment:', savedComment);
    }
    
    return savedComment;
  } catch (err) {
    console.error('[Cloud API] Error posting comment:', err);
    throw err;
  }
}

/**
 * Check if cloud API is enabled
 * @returns Whether cloud API is being used instead of localStorage
 */
export function isCloudAPIEnabled(): boolean {
  return !COMMENTS_CONFIG.useLocalStorage;
}

/**
 * Get the API URL
 * @returns The configured API URL
 */
export function getAPIUrl(): string {
  return COMMENTS_CONFIG.apiUrl;
}

/**
 * Delete a comment from the cloud API (future feature)
 * @param commentId - ID of the comment to delete
 * @returns Promise indicating success
 */
export async function deleteCommentFromCloud(commentId: string): Promise<void> {
  // Placeholder for future implementation
  throw new Error('Delete comment not yet implemented');
}

/**
 * Update a comment in the cloud API (future feature)
 * @param commentId - ID of the comment to update
 * @param updates - Partial comment data to update
 * @returns Promise with the updated comment
 */
export async function updateCommentInCloud(
  commentId: string, 
  updates: Partial<Comment>
): Promise<Comment> {
  // Placeholder for future implementation
  throw new Error('Update comment not yet implemented');
}

/**
 * Health check for the cloud API
 * @returns Promise indicating if the API is healthy
 */
export async function checkAPIHealth(): Promise<boolean> {
  try {
    const response = await fetch(COMMENTS_CONFIG.apiUrl + '/health', {
      method: 'GET',
    });
    return response.ok;
  } catch {
    return false;
  }
}
