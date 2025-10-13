/**
 * Sliding Window Tracker
 * 
 * Simple, stateless approach that scales to 10M+ users
 * No file I/O, no distributed state, just time-based filtering
 * 
 * Philosophy: "Simple Strong Solid"
 * - Simple: Just compare timestamps
 * - Strong: No state to corrupt
 * - Solid: Works at any scale
 */

export class SlidingWindowTracker {
  private windowSizeMs: number;
  private startupTime: number;
  private lastPolledAt: number;

  constructor(windowMinutes: number = 5) {
    // Only look at messages from the last N minutes
    this.windowSizeMs = windowMinutes * 60 * 1000;
    this.startupTime = Date.now();
    this.lastPolledAt = 0;
    
    console.log(`[SLIDING_WINDOW] Processing messages from last ${windowMinutes} minutes`);
    console.log(`[SLIDING_WINDOW] Startup time: ${new Date(this.startupTime).toISOString()}`);
  }

  /**
   * Get the timestamp for the start of our window
   * This is the earliest message we'll consider
   */
  getWindowStart(): number {
    const now = Date.now();
    const windowStart = now - this.windowSizeMs;
    
    // On first run after startup, only look at messages since startup
    // This prevents processing old messages on restart
    if (this.lastPolledAt === 0) {
      this.lastPolledAt = now;
      return Math.max(windowStart, this.startupTime);
    }
    
    this.lastPolledAt = now;
    return windowStart;
  }

  /**
   * Check if a message is within our processing window
   */
  shouldProcess(messageTimestamp: number): boolean {
    const windowStart = Date.now() - this.windowSizeMs;
    
    // Message must be:
    // 1. Within our time window
    // 2. After bot startup (don't process old messages on restart)
    return messageTimestamp > windowStart && messageTimestamp > this.startupTime;
  }

  /**
   * Get info for logging
   */
  getInfo(): { windowMinutes: number, startupTime: string } {
    return {
      windowMinutes: this.windowSizeMs / 60000,
      startupTime: new Date(this.startupTime).toISOString()
    };
  }
}

/**
 * Message Deduplication using the existing queue
 * 
 * The queue already tracks message IDs, we just need to check them
 * This is much simpler than distributed state tracking
 */
export class MessageDeduplicator {
  // Simple in-memory cache for the current session
  // This is fine because the queue itself is the source of truth
  private recentIds = new Set<string>();
  private maxSize = 10000;

  /**
   * Check if we've seen this message ID recently
   * This is just a fast-path optimization
   */
  hasSeenRecently(messageId: string): boolean {
    return this.recentIds.has(messageId);
  }

  /**
   * Mark a message as seen
   */
  markSeen(messageId: string): void {
    this.recentIds.add(messageId);
    
    // Prevent unbounded growth
    if (this.recentIds.size > this.maxSize) {
      // Remove oldest entries (convert to array, slice, rebuild)
      const ids = Array.from(this.recentIds);
      this.recentIds = new Set(ids.slice(-5000));
    }
  }

  /**
   * Clear the cache (useful for testing)
   */
  clear(): void {
    this.recentIds.clear();
  }
}
