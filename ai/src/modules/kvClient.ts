/**
 * KV Client Module
 * Handles all interactions with the Cloudflare KV store
 */

import fetch from 'node-fetch';
import { Comment, CommentsResponse } from '../types.js';
import { logger } from '../console-logger.js';
import { CONFIG } from '../config.js';

export interface PostResult {
  success: boolean;
  error?: string;
}

/**
 * KV Client Class
 * Manages communication with Cloudflare Workers KV API
 */
export class KVClient {
  private apiUrl: string;
  private lastFetchTime: number = 0;
  private fetchCooldown: number = 5000; // 5 seconds between fetches
  
  constructor(apiUrl: string = CONFIG.SWW_API.baseURL + CONFIG.SWW_API.endpoints.postComment) {
    this.apiUrl = apiUrl;
  }
  
  /**
   * Fetch recent comments from KV
   */
  public async fetchRecentComments(limit: number = 50): Promise<Comment[]> {
    const now = Date.now();
    
    // Rate limit fetches
    if (now - this.lastFetchTime < this.fetchCooldown) {
      logger.debug('Skipping fetch - too soon since last fetch');
      return [];
    }
    
    try {
      const url = `${this.apiUrl}?limit=${limit}&domain=all&sort=timestamp&order=desc`;
      logger.debug(`Fetching from: ${url}`);
      
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json() as CommentsResponse;
      this.lastFetchTime = now;
      
      if (!data.comments || !Array.isArray(data.comments)) {
        logger.warn('Invalid response format from API');
        return [];
      }
      
      logger.debug(`Fetched ${data.comments.length} comments from KV`);
      return data.comments;
    } catch (error) {
      logger.error('Failed to fetch comments:', error);
      return [];
    }
  }
  
  /**
   * Post a comment to KV
   */
  public async postComment(comment: Comment, dryRun: boolean = false): Promise<PostResult> {
    if (dryRun) {
      logger.info(`[DRY RUN] Would post: "${comment.text}" as ${comment.username}`);
      console.log('=== DRY RUN - NOT SENDING ===');
      console.log('Would send:', JSON.stringify(comment, null, 2));
      console.log('=============================');
      return { success: true };
    }
    
    try {
      console.log('=== SENDING TO KV ===');
      console.log('URL:', this.apiUrl);
      console.log('Payload:', JSON.stringify(comment, null, 2));
      console.log('===================');
      
      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(comment),
      });
      
      console.log('=== API RESPONSE ===');
      console.log('Status:', response.status, response.statusText);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.log('❌ Error Response:', errorText);
        console.log('====================');
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }
      
      const responseText = await response.text();
      console.log('Response Text:', responseText);
      
      let result: any;
      try {
        result = JSON.parse(responseText);
        console.log('Parsed JSON:', result);
      } catch (e) {
        console.log('❌ JSON Parse Error:', e);
        console.log('====================');
        throw new Error(`Invalid JSON from API: ${responseText.substring(0, 200)}`);
      }
      
      console.log('====================');
      
      if (!result.success) {
        console.error('❌ API returned success:false');
        console.error('API Error:', result.error);
        console.error('Full Response:', result);
        throw new Error(`API Error: ${result.error || 'No error message provided'}`);
      }
      
      logger.success(`Posted: "${comment.text.substring(0, 50)}..." as ${comment.username}`);
      return { success: true };
      
    } catch (error: any) {
      logger.error(`Failed to post comment: ${error.message}`);
      console.error('💥 Full Error Object:', error);
      return { 
        success: false, 
        error: error.message 
      };
    }
  }
  
  /**
   * Generate a unique ID for comments
   */
  public generateId(): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 11);
    return `${timestamp}-${random}`;
  }
  
  /**
   * Check if API is reachable
   */
  public async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(`${this.apiUrl}/health`, {
        method: 'GET',
      });
      return response.ok;
    } catch {
      return false;
    }
  }
}

// Singleton instance
let kvClientInstance: KVClient | null = null;

export function getKVClient(): KVClient {
  if (!kvClientInstance) {
    kvClientInstance = new KVClient();
  }
  return kvClientInstance;
}
