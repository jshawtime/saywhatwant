/**
 * Priority Queue using Min-Heap
 * O(log n) insert and remove operations
 * Thread-safe with AsyncMutex
 */

import { AsyncMutex } from './asyncMutex.js';

export interface QueueItem {
  id: string;
  priority: number;              // 0-99 (0 = highest priority)
  timestamp: number;
  message: any;                  // The message to respond to
  context: string[];             // Conversation context
  entity: any;                   // Selected entity
  model: string;
  routerReason: string;
  attempts: number;
  claimedBy: string | null;
  claimedAt: number | null;
  maxRetries: number;
}

export class PriorityQueue {
  private heap: QueueItem[] = [];
  private itemMap: Map<string, number> = new Map();  // id → heap index
  private mutex = new AsyncMutex();

  /**
   * Add item to queue (O(log n))
   */
  async enqueue(item: QueueItem): Promise<void> {
    return await this.mutex.runExclusive(async () => {
      this.heap.push(item);
      const index = this.heap.length - 1;
      this.itemMap.set(item.id, index);
      this.bubbleUp(index);
    });
  }

  /**
   * Remove and return highest priority item (O(log n))
   */
  async dequeue(): Promise<QueueItem | null> {
    return await this.mutex.runExclusive(async () => {
      if (this.heap.length === 0) return null;
      if (this.heap.length === 1) {
        const item = this.heap.pop()!;
        this.itemMap.delete(item.id);
        return item;
      }

      const top = this.heap[0];
      const bottom = this.heap.pop()!;
      
      this.heap[0] = bottom;
      this.itemMap.set(bottom.id, 0);
      this.itemMap.delete(top.id);
      
      this.bubbleDown(0);
      return top;
    });
  }

  /**
   * Peek at highest priority item without removing (O(1))
   */
  async peek(): Promise<QueueItem | null> {
    return this.heap[0] || null;
  }

  /**
   * Claim highest priority unclaimed item
   * Marks it as claimed by serverId
   */
  async claim(serverId: string): Promise<QueueItem | null> {
    return await this.mutex.runExclusive(async () => {
      // Find first unclaimed item
      for (let i = 0; i < this.heap.length; i++) {
        const item = this.heap[i];
        if (item.claimedBy === null) {
          // Claim it
          item.claimedBy = serverId;
          item.claimedAt = Date.now();
          item.attempts++;
          return item;
        }
      }
      return null;  // No unclaimed items
    });
  }

  /**
   * Release a claimed item (mark as complete or requeue)
   */
  async release(itemId: string, success: boolean): Promise<void> {
    return await this.mutex.runExclusive(async () => {
      const index = this.itemMap.get(itemId);
      if (index === undefined) return;
      
      if (success) {
        // Remove from queue
        await this.removeAt(index);
      } else {
        // Requeue with lower priority (add 10 points = lower priority)
        const item = this.heap[index];
        item.priority = Math.min(99, item.priority + 10);
        item.claimedBy = null;
        item.claimedAt = null;
        
        // Re-sort
        this.bubbleDown(index);
        this.bubbleUp(index);
      }
    });
  }

  /**
   * Update priority of an item
   */
  async updatePriority(itemId: string, newPriority: number): Promise<void> {
    return await this.mutex.runExclusive(async () => {
      const index = this.itemMap.get(itemId);
      if (index === undefined) return;
      
      const oldPriority = this.heap[index].priority;
      this.heap[index].priority = newPriority;
      
      if (newPriority < oldPriority) {
        this.bubbleUp(index);
      } else {
        this.bubbleDown(index);
      }
    });
  }

  /**
   * Remove item by ID
   */
  async remove(itemId: string): Promise<void> {
    return await this.mutex.runExclusive(async () => {
      const index = this.itemMap.get(itemId);
      if (index !== undefined) {
        await this.removeAt(index);
      }
    });
  }

  /**
   * Get queue size
   */
  size(): number {
    return this.heap.length;
  }

  /**
   * Check if empty
   */
  isEmpty(): boolean {
    return this.heap.length === 0;
  }

  /**
   * Get all items (for monitoring)
   */
  getAll(): QueueItem[] {
    return [...this.heap];  // Return copy
  }

  /**
   * Clear stale claims (items claimed too long ago)
   */
  async clearStale(maxAge: number): Promise<number> {
    return await this.mutex.runExclusive(async () => {
      const now = Date.now();
      let cleared = 0;
      
      for (const item of this.heap) {
        if (item.claimedBy !== null && item.claimedAt !== null) {
          if (now - item.claimedAt > maxAge) {
            // Release stale claim
            item.claimedBy = null;
            item.claimedAt = null;
            cleared++;
          }
        }
      }
      
      return cleared;
    });
  }

  // ==========================================
  // PRIVATE HEAP OPERATIONS
  // ==========================================

  private bubbleUp(index: number): void {
    while (index > 0) {
      const parentIndex = Math.floor((index - 1) / 2);
      
      // Min-heap: parent should be <= child
      if (this.heap[parentIndex].priority <= this.heap[index].priority) {
        break;
      }
      
      // Swap
      this.swap(index, parentIndex);
      index = parentIndex;
    }
  }

  private bubbleDown(index: number): void {
    while (true) {
      const leftChild = 2 * index + 1;
      const rightChild = 2 * index + 2;
      let smallest = index;
      
      // Check left child
      if (leftChild < this.heap.length && 
          this.heap[leftChild].priority < this.heap[smallest].priority) {
        smallest = leftChild;
      }
      
      // Check right child
      if (rightChild < this.heap.length && 
          this.heap[rightChild].priority < this.heap[smallest].priority) {
        smallest = rightChild;
      }
      
      // If no swap needed, we're done
      if (smallest === index) {
        break;
      }
      
      // Swap with smallest child
      this.swap(index, smallest);
      index = smallest;
    }
  }

  private swap(i: number, j: number): void {
    // Update map
    this.itemMap.set(this.heap[i].id, j);
    this.itemMap.set(this.heap[j].id, i);
    
    // Swap in heap
    [this.heap[i], this.heap[j]] = [this.heap[j], this.heap[i]];
  }

  private async removeAt(index: number): Promise<void> {
    if (index >= this.heap.length) return;
    
    const item = this.heap[index];
    this.itemMap.delete(item.id);
    
    if (index === this.heap.length - 1) {
      this.heap.pop();
      return;
    }
    
    const lastItem = this.heap.pop()!;
    this.heap[index] = lastItem;
    this.itemMap.set(lastItem.id, index);
    
    // Re-sort from this position
    this.bubbleDown(index);
    this.bubbleUp(index);
  }
}
