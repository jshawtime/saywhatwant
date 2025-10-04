/**
 * Queue Service - High-level queue management
 * Handles claim/release, stats, and monitoring
 */

import { PriorityQueue, QueueItem } from './priorityQueue.js';
import chalk from 'chalk';

export interface QueueStats {
  totalItems: number;
  unclaimedItems: number;
  claimedItems: number;
  priorityBands: {
    critical: number;    // 0-10
    high: number;        // 11-30
    medium: number;      // 31-60
    low: number;         // 61-90
    background: number;  // 91-99
  };
  averageWaitTime: number;
  throughput: number;
  oldestItemAge: number;
  staleClaims: number;
}

export class QueueService {
  private queue: PriorityQueue;
  private throughputTracker: number[] = [];  // Timestamps of completed items
  private staleClaimTimeout = 60000;  // 60 seconds

  constructor() {
    this.queue = new PriorityQueue();
    
    // Start stale claim cleanup
    this.startStaleClaimCleanup();
  }

  /**
   * Add item to queue
   */
  async enqueue(item: Omit<QueueItem, 'claimedBy' | 'claimedAt' | 'attempts'>): Promise<void> {
    const queueItem: QueueItem = {
      ...item,
      claimedBy: null,
      claimedAt: null,
      attempts: 0
    };
    
    await this.queue.enqueue(queueItem);
    
    console.log(chalk.cyan('[Queue]'), `Queued: ${item.id} (priority ${item.priority}, entity: ${item.entity.id})`);
  }

  /**
   * Claim next item for processing
   * Returns highest priority unclaimed item
   */
  async claim(serverId: string): Promise<QueueItem | null> {
    const item = await this.queue.claim(serverId);
    
    if (item) {
      console.log(chalk.green('[Queue]'), `Claimed: ${item.id} by ${serverId} (priority ${item.priority}, attempt ${item.attempts})`);
    }
    
    return item;
  }

  /**
   * Mark item as complete (success) or requeue (failure)
   */
  async complete(itemId: string, success: boolean): Promise<void> {
    await this.queue.release(itemId, success);
    
    if (success) {
      // Track for throughput calculation
      this.throughputTracker.push(Date.now());
      
      // Keep only last minute
      const oneMinuteAgo = Date.now() - 60000;
      this.throughputTracker = this.throughputTracker.filter(t => t > oneMinuteAgo);
      
      console.log(chalk.green('[Queue]'), `Completed: ${itemId}`);
    } else {
      console.log(chalk.yellow('[Queue]'), `Requeued: ${itemId} (will retry with lower priority)`);
    }
  }

  /**
   * Get queue statistics
   */
  getStats(): QueueStats {
    const items = this.queue.getAll();
    const now = Date.now();
    
    // Count unclaimed vs claimed
    const unclaimed = items.filter(i => i.claimedBy === null);
    const claimed = items.filter(i => i.claimedBy !== null);
    
    // Priority bands
    const priorityBands = {
      critical: items.filter(i => i.priority <= 10).length,
      high: items.filter(i => i.priority > 10 && i.priority <= 30).length,
      medium: items.filter(i => i.priority > 30 && i.priority <= 60).length,
      low: items.filter(i => i.priority > 60 && i.priority <= 90).length,
      background: items.filter(i => i.priority > 90).length,
    };
    
    // Average wait time (time in queue before claimed)
    const waitTimes = claimed
      .filter(i => i.claimedAt !== null)
      .map(i => i.claimedAt! - i.timestamp);
    const averageWaitTime = waitTimes.length > 0
      ? waitTimes.reduce((a, b) => a + b, 0) / waitTimes.length
      : 0;
    
    // Oldest item age
    const oldestItemAge = items.length > 0
      ? now - Math.min(...items.map(i => i.timestamp))
      : 0;
    
    // Stale claims (claimed over timeout period)
    const staleClaims = claimed.filter(i => 
      i.claimedAt !== null && (now - i.claimedAt > this.staleClaimTimeout)
    ).length;
    
    return {
      totalItems: items.length,
      unclaimedItems: unclaimed.length,
      claimedItems: claimed.length,
      priorityBands,
      averageWaitTime,
      throughput: this.throughputTracker.length,  // Items per minute
      oldestItemAge,
      staleClaims
    };
  }

  /**
   * Get current queue size
   */
  size(): number {
    return this.queue.size();
  }

  /**
   * Check if queue is empty
   */
  isEmpty(): boolean {
    return this.queue.isEmpty();
  }

  /**
   * Get all queue items (for monitoring)
   */
  getAllItems(): QueueItem[] {
    return this.queue.getAll();
  }

  /**
   * Remove item from queue
   */
  async remove(itemId: string): Promise<void> {
    await this.queue.remove(itemId);
    console.log(chalk.red('[Queue]'), `Removed: ${itemId}`);
  }

  /**
   * Update item priority
   */
  async updatePriority(itemId: string, newPriority: number): Promise<void> {
    await this.queue.updatePriority(itemId, newPriority);
    console.log(chalk.blue('[Queue]'), `Updated priority: ${itemId} → ${newPriority}`);
  }

  /**
   * Clear all stale claims
   */
  private async clearStaleClaims(): Promise<void> {
    const cleared = await this.queue.clearStale(this.staleClaimTimeout);
    if (cleared > 0) {
      console.log(chalk.yellow('[Queue]'), `Cleared ${cleared} stale claims`);
    }
  }

  /**
   * Start background task to clear stale claims
   */
  private startStaleClaimCleanup(): void {
    setInterval(() => {
      this.clearStaleClaims();
    }, 30000);  // Check every 30 seconds
  }

  /**
   * Purge items above a certain priority (congestion management)
   */
  async purgeAbovePriority(maxPriority: number): Promise<number> {
    const items = this.queue.getAll();
    let purged = 0;
    
    for (const item of items) {
      if (item.priority > maxPriority && item.claimedBy === null) {
        await this.queue.remove(item.id);
        purged++;
      }
    }
    
    if (purged > 0) {
      console.log(chalk.red('[Queue]'), `PURGED ${purged} low-priority items (priority > ${maxPriority})`);
    }
    
    return purged;
  }
}
