/**
 * Async Mutex for Atomic Operations
 * Prevents race conditions in priority queue
 */

export class AsyncMutex {
  private locked = false;
  private waitQueue: Array<() => void> = [];

  /**
   * Acquire the lock (waits if already locked)
   * Returns a release function that MUST be called
   * 
   * Usage:
   *   const release = await mutex.acquire();
   *   try {
   *     // Critical section
   *   } finally {
   *     release();  // Always release!
   *   }
   */
  async acquire(): Promise<() => void> {
    // Wait until lock is available
    while (this.locked) {
      await new Promise<void>(resolve => {
        this.waitQueue.push(resolve);
      });
    }

    // Acquire the lock
    this.locked = true;

    // Return release function
    return () => {
      this.locked = false;
      
      // Wake up next waiting operation
      const next = this.waitQueue.shift();
      if (next) {
        next();
      }
    };
  }

  /**
   * Execute a function with exclusive access
   * Automatically handles acquire/release
   * 
   * Usage:
   *   const result = await mutex.runExclusive(async () => {
   *     // Critical section
   *     return someValue;
   *   });
   */
  async runExclusive<T>(fn: () => Promise<T> | T): Promise<T> {
    const release = await this.acquire();
    
    try {
      return await fn();
    } finally {
      release();
    }
  }

  /**
   * Check if currently locked
   */
  isLocked(): boolean {
    return this.locked;
  }

  /**
   * Get number of operations waiting
   */
  getWaitingCount(): number {
    return this.waitQueue.length;
  }
}
