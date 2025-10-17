/**
 * KV Client Module
 * Handles all interactions with the Cloudflare KV store
 */

import fetch from 'node-fetch';
import chalk from 'chalk';
import { Comment } from '../types.js';
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
  private fetchCooldown: number; // Will be set from config
  
  constructor(apiUrl: string = CONFIG.SWW_API.baseURL + CONFIG.SWW_API.endpoints.postComment, fetchCooldown?: number) {
    this.apiUrl = apiUrl;
    // Use provided cooldown or default to 5000ms
    this.fetchCooldown = fetchCooldown || 5000;
  }
  
  /**
   * Fetch recent comments from KV
   * @param limit - Maximum number of comments to fetch
   * @param after - Only fetch messages with timestamp > this value (for cursor-based polling)
   */
  public async fetchRecentComments(limit: number = 50, after?: number): Promise<Comment[]> {
    const now = Date.now();
    
    // Rate limit fetches
    if (now - this.lastFetchTime < this.fetchCooldown) {
      logger.debug('Skipping fetch - too soon since last fetch');
      return [];
    }
    
    try {
      // Build URL with optional after parameter for cursor-based polling
      let url = `${this.apiUrl}?limit=${limit}&domain=all&sort=timestamp&order=desc`;
      if (after) {
        url += `&after=${after}`;
        logger.debug(`Using cursor-based polling: after=${after}`);
      }
      logger.debug(`Fetching from: ${url}`);
      
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const rawData = await response.json() as any;
      this.lastFetchTime = now;
      
      // Handle both response formats:
      // - Without after: {comments: [...]}
      // - With after: [...] (array directly)
      let comments: Comment[];
      if (Array.isArray(rawData)) {
        // Direct array format (when using after parameter)
        comments = rawData as Comment[];
      } else if (rawData && rawData.comments && Array.isArray(rawData.comments)) {
        // Wrapped format (normal fetch)
        comments = rawData.comments as Comment[];
      } else {
        logger.warn('Invalid response format from API');
        return [];
      }
      
      logger.debug(`Fetched ${comments.length} comments from KV`);
      return comments;
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
      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(comment),
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.log('❌ KV Error:', response.status, errorText);
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }
      
      const responseText = await response.text();
      let result: any;
      try {
        result = JSON.parse(responseText);
      } catch (e) {
        console.log('❌ JSON Parse Error:', e);
        throw new Error(`Invalid JSON from API: ${responseText.substring(0, 200)}`);
      }
      
      // Check if it's an error response
      if (result.error) {
        console.error('❌ API returned error');
        console.error('API Error:', result.error);
        throw new Error(`API Error: ${result.error}`);
      }
      
      // API returns comment object directly (not wrapped in {success:true})
      // If we got here with 200 OK and have an id, it succeeded
      if (result.id || result.success === true) {
        logger.success(`Posted: "${comment.text.substring(0, 50)}..." as ${comment.username}`);
        return { success: true };
      }
      
      // Unexpected format
      console.error('⚠️ Unexpected API response format');
      console.error('Expected: {id: ...} or {success: true}');
      console.error('Got:', result);
      throw new Error('Unexpected API response format');
      
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
   * Update processed status of a message
   * Marks a message as processed in KV to prevent reprocessing
   * 
   * @param messageId - The message ID to update
   * @param processed - true = processed, false = unprocessed
   */
  public async updateProcessedStatus(messageId: string, processed: boolean): Promise<boolean> {
    try {
      const url = `${this.apiUrl}/${messageId}`;
      const payload = {
        botParams: {
          processed: processed
        }
      };
      
      const ts = new Date().toISOString().replace('T', ' ').substring(0, 19);
      console.log(chalk.cyan(`[${ts}] [KV PATCH]`), `Updating ${messageId}`);
      console.log(chalk.cyan(`[${ts}] [KV PATCH]`), `URL: ${url}`);
      console.log(chalk.cyan(`[${ts}] [KV PATCH]`), `Payload:`, JSON.stringify(payload));
      
      const response = await fetch(url, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      const ts2 = new Date().toISOString().replace('T', ' ').substring(0, 19);
      console.log(chalk.cyan(`[${ts2}] [KV PATCH]`), `Response: ${response.status} ${response.statusText}`);
      
      if (response.ok) {
        const responseData = await response.text();
        console.log(chalk.green(`[${ts2}] [KV PATCH]`), `✅ Success:`, responseData.substring(0, 100));
        return true;
      } else {
        const errorText = await response.text();
        console.error(chalk.red(`[${ts2}] [KV PATCH]`), `❌ Failed:`, response.status, errorText);
        return false;
      }
    } catch (error: any) {
      const ts3 = new Date().toISOString().replace('T', ' ').substring(0, 19);
      console.error(chalk.red(`[${ts3}] [KV PATCH]`), `❌ Exception:`, error.message);
      return false;
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

export function getKVClient(fetchCooldown?: number): KVClient {
  if (!kvClientInstance) {
    kvClientInstance = new KVClient(undefined, fetchCooldown);
  }
  return kvClientInstance;
}
