/**
 * MessageQueue Durable Object
 * 
 * Single-threaded message queue with in-memory state and automatic persistence.
 * Handles all message operations: POST, GET, claim, complete.
 */

export class MessageQueue {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    this.messages = null; // Lazy loaded from storage
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

      if (path === '/api/queue/pending' && request.method === 'GET') {
        return await this.getPending(url);
      }

      if (path === '/api/queue/claim' && request.method === 'POST') {
        return await this.claimMessage(request);
      }

      if (path === '/api/queue/complete' && request.method === 'POST') {
        return await this.completeMessage(request);
      }

      return this.jsonResponse({ error: 'Not found' }, 404);
    } catch (error) {
      console.error('[MessageQueue] Error:', error);
      return this.jsonResponse({ error: error.message }, 500);
    }
  }

  /**
   * Load messages from storage (lazy loaded, cached in memory)
   */
  async loadMessages() {
    if (this.messages === null) {
      this.messages = await this.state.storage.get('messages') || [];
      console.log('[MessageQueue] Loaded', this.messages.length, 'messages from storage');
    }
    return this.messages;
  }

  /**
   * Save messages to storage
   */
  async saveMessages() {
    await this.state.storage.put('messages', this.messages);
  }

  /**
   * POST /api/comments - Create new message
   */
  async postMessage(request) {
    const body = await request.json();
    const messages = await this.loadMessages();

    // Use frontend's ID if provided, otherwise generate new one
    // Frontend sends short ID format (no timestamp) for optimistic updates
    const id = body.id || this.generateId();
    const timestamp = Date.now();

    // Determine if this is a human or AI message
    const messageType = body['message-type'] || body.messageType || 'human';
    
    // Extract entity - prioritize botParams.entity over domain extraction
    let entity = 'default';
    if (body.botParams?.entity) {
      entity = body.botParams.entity;
    } else if (body.domain) {
      const match = body.domain.match(/^([^.]+)\./);
      if (match) entity = match[1];
    }

    // Create message object
    const message = {
      id,
      timestamp,
      text: body.text,
      username: body.username,
      color: body.color,
      domain: body.domain || 'saywhatwant.app',
      'message-type': messageType,  // Keep hyphenated format for frontend compatibility
      replyTo: body.replyTo || null,
      context: body.context || null,  // Pre-formatted conversation history from frontend
      botParams: {
        status: messageType === 'human' ? 'pending' : 'complete',
        priority: body.botParams?.priority || body.priority || 5,
        entity,
        ais: body.botParams?.ais || null,  // CRITICAL: Preserve ais (AI username:color override)
        claimedBy: null,
        claimedAt: null,
        completedAt: messageType === 'AI' ? timestamp : null
      }
    };

    // Add to front of array
    messages.unshift(message);

    // Keep only last 200 messages
    if (messages.length > 200) {
      messages.length = 200;
    }

    // Save to storage
    await this.saveMessages();

    console.log('[MessageQueue] Posted message:', id, messageType);

    return this.jsonResponse({ 
      id, 
      timestamp,
      status: 'success' 
    });
  }

  /**
   * GET /api/comments?after=timestamp&since=timestamp - Get messages after timestamp
   * Supports both 'after' (frontend) and 'since' (legacy) parameters
   */
  async getMessages(url) {
    const messages = await this.loadMessages();
    
    // Support both 'after' (new) and 'since' (legacy) parameters
    const after = parseInt(url.searchParams.get('after') || url.searchParams.get('since') || '0');
    
    // Filter messages newer than 'after'
    const filtered = messages.filter(m => m.timestamp > after);

    console.log('[MessageQueue] GET messages after', after, '→', filtered.length, 'results');

    return this.jsonResponse(filtered);
  }

  /**
   * GET /api/queue/pending - Get pending messages for bot
   */
  async getPending(url) {
    const messages = await this.loadMessages();
    const limit = parseInt(url.searchParams.get('limit') || '999999'); // No limit by default

    // Filter for pending human messages
    const pending = messages.filter(m => 
      m['message-type'] === 'human' && 
      m.botParams.status === 'pending'
    );

    // Sort by priority (desc) then timestamp (asc)
    pending.sort((a, b) => {
      const priorityDiff = (b.botParams.priority || 5) - (a.botParams.priority || 5);
      if (priorityDiff !== 0) return priorityDiff;
      return a.timestamp - b.timestamp;
    });

    // Return top N (or all if limit is huge)
    const result = pending.slice(0, limit);

    console.log('[MessageQueue] GET pending:', result.length, 'of', pending.length, 'total');

    return this.jsonResponse({
      pending: result,
      kvStats: {
        reads: 1,  // For compatibility with PM2 bot logs
        writes: 0
      }
    });
  }

  /**
   * POST /api/queue/claim - Claim a message for processing
   */
  async claimMessage(request) {
    const { messageId, workerId } = await request.json();
    const messages = await this.loadMessages();

    // Find message
    const message = messages.find(m => m.id === messageId);
    
    if (!message) {
      return this.jsonResponse({ 
        success: false, 
        error: 'Message not found' 
      }, 404);
    }

    // Verify it's pending
    if (message.botParams.status !== 'pending') {
      return this.jsonResponse({
        success: false,
        error: `Message status is ${message.botParams.status}, not pending`
      }, 409);
    }

    // Claim it
    message.botParams.status = 'processing';
    message.botParams.claimedBy = workerId;
    message.botParams.claimedAt = Date.now();

    await this.saveMessages();

    console.log('[MessageQueue] Claimed:', messageId, 'by', workerId);

    return this.jsonResponse({ 
      success: true, 
      message 
    });
  }

  /**
   * POST /api/queue/complete - Mark message as complete
   */
  async completeMessage(request) {
    const { messageId } = await request.json();
    const messages = await this.loadMessages();

    // Find message
    const message = messages.find(m => m.id === messageId);
    
    if (!message) {
      return this.jsonResponse({ 
        success: false, 
        error: 'Message not found' 
      }, 404);
    }

    // Verify it's processing
    if (message.botParams.status !== 'processing') {
      return this.jsonResponse({
        success: false,
        error: `Message status is ${message.botParams.status}, not processing`
      }, 409);
    }

    // Complete it
    message.botParams.status = 'complete';
    message.botParams.completedAt = Date.now();

    await this.saveMessages();

    console.log('[MessageQueue] Completed:', messageId);

    return this.jsonResponse({ 
      success: true 
    });
  }

  /**
   * Generate random ID (no timestamp prefix)
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
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
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
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Max-Age': '86400',
      }
    });
  }
}

