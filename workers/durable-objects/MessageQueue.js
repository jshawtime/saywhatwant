/**
 * MessageQueue Durable Object
 * 
 * MEMORY-ONLY MODE (Doc 220)
 * - No persistent storage - real-time app philosophy
 * - Frontend sends context with each message (from IndexedDB)
 * - If tab is closed, you miss out (by design)
 * - Cost: $0 for storage operations
 */

export class MessageQueue {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    
    // IN-MEMORY STATE ONLY (Doc 220 - Memory-Only Migration)
    this.pendingQueue = [];           // For bot polling (pending messages only)
    this.recentMessages = [];         // For frontend polling (last 50K messages)
    this.MAX_CACHE_SIZE = 50000;      // 50K messages = ~100MB = 78% of 128MB limit
    this.initialized = true;          // Always initialized (no storage to load)
  }

  /**
   * Main fetch handler - routes requests to appropriate methods
   */
  async fetch(request) {
    const url = new URL(request.url);
    const path = url.pathname;

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return this.corsResponse();
    }

    try {
      // Route to handlers
      if (path === '/api/comments') {
        if (request.method === 'POST') {
          return await this.postMessage(request);
        }
        if (request.method === 'GET') {
          return await this.getMessages(url);
        }
      }
      
      // PATCH /api/comments/:id - Update message fields (e.g., eqScore)
      if (path.startsWith('/api/comments/') && request.method === 'PATCH') {
        return await this.patchMessage(request, path);
      }

      if (path === '/api/queue/pending' && request.method === 'GET') {
        return await this.getPending(url);
      }

      if (path === '/api/queue/claim' && request.method === 'POST') {
        return await this.claimMessage(request);
      }
      
      // Atomic claim-next endpoint (combines pending + claim)
      if (path === '/api/queue/claim-next' && request.method === 'POST') {
        return await this.claimNextMessage(request);
      }

      if (path === '/api/queue/complete' && request.method === 'POST') {
        return await this.completeMessage(request);
      }

      // Admin endpoints (for debugging)
      if (path === '/api/admin/stats' && request.method === 'GET') {
        return this.getStats();
      }

      if (path === '/api/admin/purge' && request.method === 'POST') {
        return this.purgeMemory();
      }

      return this.jsonResponse({ error: 'Not found' }, 404);
    } catch (error) {
      console.error('[MessageQueue] Error:', error);
      return this.jsonResponse({ error: error.message }, 500);
    }
  }

  /**
   * POST /api/comments - Create new message
   * MEMORY ONLY - no storage operations
   */
  async postMessage(request) {
    const body = await request.json();

    const id = body.id || this.generateId();
    
    // IDEMPOTENCY CHECK: Reject duplicate messages (same ID already exists)
    const existingMsg = this.recentMessages.find(m => m.id === id);
    if (existingMsg) {
      console.log('[MessageQueue] ⚠️ Duplicate message rejected:', id);
      return this.jsonResponse({ id, timestamp: existingMsg.timestamp, status: 'duplicate' });
    }
    
    const timestamp = body.timestamp || Date.now();
    const messageType = body['message-type'] || body.messageType || 'human';
    
    // Extract entity - ONLY if explicitly provided
    const entity = body.botParams?.entity || null;

    // Create message object
    const message = {
      id,
      timestamp,
      text: body.text,
      username: body.username,
      color: body.color,
      domain: body.domain || 'saywhatwant.app',
      'message-type': messageType,
      replyTo: body.replyTo || null,
      context: body.context || null,  // CRITICAL: Store context with message for bot
      eqScore: body.eqScore || 0,
      // Only include botParams if entity is explicitly provided
      ...(entity && {
        botParams: {
          status: messageType === 'human' ? 'pending' : 'complete',
          priority: body.botParams?.priority || body.priority || 5,
          entity,
          ais: body.botParams?.ais || null,
          sessionId: body.botParams?.sessionId || null,
          humanUsername: body.username,
          humanColor: body.color,
          claimedBy: null,
          claimedAt: null,
          completedAt: messageType === 'AI' ? timestamp : null
        }
      })
    };

    // ============================================================
    // MEMORY ONLY - No storage operations (Doc 220)
    // ============================================================
    
    // Add to recent messages cache (for frontend polling)
    this.recentMessages.unshift(message);
    if (this.recentMessages.length > this.MAX_CACHE_SIZE) {
      this.recentMessages.pop();
    }
    
    // If pending human message for bot, add to pending queue
    if (messageType === 'human' && entity && message.botParams?.status === 'pending') {
      this.pendingQueue.push(message);
      console.log('[MessageQueue] Added to pending queue:', message.id, '(pending:', this.pendingQueue.length, ')');
    }

    console.log('[MessageQueue] Posted:', message.id, '(memory only, recent:', this.recentMessages.length, ')');

    return this.jsonResponse({ id, timestamp, status: 'success' });
  }

  /**
   * GET /api/comments?after=timestamp - Get messages after timestamp
   * MEMORY ONLY - reads from in-memory cache
   */
  async getMessages(url) {
    const after = parseInt(url.searchParams.get('after') || url.searchParams.get('since') || '0');
    
    // Filter recent messages by timestamp (in memory, fast!)
    const filtered = this.recentMessages.filter(m => m.timestamp > after);
    
    console.log('[MessageQueue] GET messages (memory):', filtered.length, 'of', this.recentMessages.length);
    
    return this.jsonResponse({
      messages: filtered,
      version: "2.0.0"  // Memory-only version
    });
  }

  /**
   * GET /api/queue/pending - Get pending messages for bot
   * MEMORY ONLY - reads from in-memory pending queue
   */
  async getPending(url) {
    const limit = parseInt(url.searchParams.get('limit') || '999999');
    
    // Sort by priority (desc) then timestamp (asc) - in memory, fast!
    this.pendingQueue.sort((a, b) => {
      const priorityDiff = (b.botParams.priority || 5) - (a.botParams.priority || 5);
      if (priorityDiff !== 0) return priorityDiff;
      return a.timestamp - b.timestamp;
    });
    
    const pendingForBot = this.pendingQueue.slice(0, limit);
    
    console.log('[MessageQueue] GET pending (memory):', pendingForBot.length, 'messages');
    
    return this.jsonResponse({
      pending: pendingForBot,
      platformOnly: [],
      kvStats: { reads: 0, writes: 0 }  // ZERO storage operations
    });
  }

  /**
   * POST /api/queue/claim - Claim a message for processing
   * MEMORY ONLY - updates in-memory state
   */
  async claimMessage(request) {
    const { messageId, workerId } = await request.json();
    
    // Find in in-memory pending queue
    const queueIndex = this.pendingQueue.findIndex(m => m.id === messageId);
    
    if (queueIndex === -1) {
      return this.jsonResponse({ success: false, error: 'Message not found in pending queue' }, 404);
    }
    
    const message = this.pendingQueue[queueIndex];
    
    if (message.botParams.status !== 'pending') {
      return this.jsonResponse({
        success: false,
        error: `Message status is ${message.botParams.status}, not pending`
      }, 409);
    }
    
    // Update message status in memory
    message.botParams.status = 'processing';
    message.botParams.claimedBy = workerId;
    message.botParams.claimedAt = Date.now();
    
    // Remove from pending queue
    this.pendingQueue.splice(queueIndex, 1);
    
    // Update in recent messages cache
    const recentIndex = this.recentMessages.findIndex(m => m.id === messageId);
    if (recentIndex !== -1) {
      this.recentMessages[recentIndex] = message;
    }
    
    console.log('[MessageQueue] Claimed:', messageId, '(pending:', this.pendingQueue.length, ')');
    return this.jsonResponse({ success: true, message });
  }

  /**
   * POST /api/queue/claim-next - Atomic operation: Get next pending + claim it
   * MEMORY ONLY - updates in-memory state
   */
  async claimNextMessage(request) {
    const { workerId } = await request.json();
    
    if (!workerId) {
      return this.jsonResponse({
        success: false,
        message: null,
        error: 'workerId required'
      }, 400);
    }
    
    // Check in-memory queue
    if (this.pendingQueue.length === 0) {
      return this.jsonResponse({
        success: false,
        message: null,
        reason: 'no_pending_messages',
        totalPending: 0,
        remainingPending: 0
      });
    }
    
    // Sort by priority (desc) then timestamp (asc)
    this.pendingQueue.sort((a, b) => {
      const priorityDiff = (b.botParams.priority || 5) - (a.botParams.priority || 5);
      if (priorityDiff !== 0) return priorityDiff;
      return a.timestamp - b.timestamp;
    });
    
    // Take first message
    const message = this.pendingQueue[0];
    const totalPendingBefore = this.pendingQueue.length;
    
    // Double-check status (sanity check)
    if (message.botParams.status !== 'pending') {
      this.pendingQueue.shift();
      return this.claimNextMessage(request);
    }
    
    // Update message status in memory
    message.botParams.status = 'processing';
    message.botParams.claimedBy = workerId;
    message.botParams.claimedAt = Date.now();
    
    // Remove from pending queue
    this.pendingQueue.shift();
    
    // Update in recent messages cache
    const recentIndex = this.recentMessages.findIndex(m => m.id === message.id);
    if (recentIndex !== -1) {
      this.recentMessages[recentIndex] = message;
    }
    
    console.log('[MessageQueue] claim-next: Claimed', message.id, '(pending:', this.pendingQueue.length, ')');
    
    return this.jsonResponse({
      success: true,
      message: message,
      totalPending: totalPendingBefore,
      remainingPending: this.pendingQueue.length
    });
  }
  
  /**
   * POST /api/queue/complete - Mark message as complete
   * MEMORY ONLY - updates in-memory state
   */
  async completeMessage(request) {
    const { messageId } = await request.json();
    
    // Find in recent messages
    const recentMsg = this.recentMessages.find(m => m.id === messageId);
    
    if (!recentMsg) {
      console.error('[MessageQueue] Complete failed: Message not in memory:', messageId);
      return this.jsonResponse({ success: false, error: 'Message not found in memory' }, 404);
    }
    
    // Update in-memory
    const completedAt = Date.now();
    if (recentMsg.botParams) {
      recentMsg.botParams.status = 'complete';
      recentMsg.botParams.completedAt = completedAt;
    }
    
    console.log('[MessageQueue] Completed:', messageId);
    return this.jsonResponse({ success: true });
  }
  
  /**
   * PATCH /api/comments/:id - Update message fields (e.g., eqScore)
   * MEMORY ONLY - updates in-memory state
   */
  async patchMessage(request, path) {
    const messageId = path.split('/').pop();
    const body = await request.json();
    
    // Find in recent messages
    const recentMsg = this.recentMessages.find(m => m.id === messageId);
    
    if (!recentMsg) {
      console.error('[MessageQueue] PATCH failed: Message not in memory:', messageId);
      return this.jsonResponse({ success: false, error: 'Message not found in memory' }, 404);
    }
    
    // Update in-memory
    if (body.eqScore !== undefined) recentMsg.eqScore = body.eqScore;
    
    console.log('[MessageQueue] PATCH success:', messageId);
    return this.jsonResponse({ success: true, message: recentMsg });
  }

  /**
   * GET /api/admin/stats - Get memory stats
   */
  getStats() {
    return this.jsonResponse({
      mode: 'memory-only',
      recentMessages: this.recentMessages.length,
      pendingQueue: this.pendingQueue.length,
      maxCacheSize: this.MAX_CACHE_SIZE,
      storageReads: 0,
      storageWrites: 0
    });
  }

  /**
   * POST /api/admin/purge - Clear memory (for testing)
   */
  purgeMemory() {
    const count = this.recentMessages.length + this.pendingQueue.length;
    this.recentMessages = [];
    this.pendingQueue = [];
    
    console.log('[MessageQueue] PURGED memory:', count, 'messages');
    
    return this.jsonResponse({ 
      success: true,
      message: `Purged ${count} messages from memory`
    });
  }

  /**
   * Generate random ID
   */
  generateId() {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let id = '';
    for (let i = 0; i < 10; i++) {
      id += chars[Math.floor(Math.random() * chars.length)];
    }
    return id;
  }

  /**
   * Helper: JSON response with CORS
   */
  jsonResponse(data, status = 200) {
    return new Response(JSON.stringify(data), {
      status,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS, PATCH',
        'Access-Control-Allow-Headers': 'Content-Type',
      }
    });
  }

  /**
   * Helper: CORS preflight response
   */
  corsResponse() {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS, PATCH',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Max-Age': '86400',
      }
    });
  }
}
