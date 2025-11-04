/**
 * MessageQueue Durable Object
 * 
 * Per-conversation storage model (like conversation-logs)
 * Each conversation stored in separate key with 300-message rolling window
 * 
 * Key format: conv:{humanUsername}:{humanColor}:{aiUsername}:{aiColor}
 * Example: conv:Human:080150227:TheEternal:080175220
 */

export class MessageQueue {
  constructor(state, env) {
    this.state = state;
    this.env = env;
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

      if (path === '/api/admin/purge' && request.method === 'POST') {
        return await this.purgeStorage();
      }

      if (path === '/api/conversation' && request.method === 'GET') {
        return await this.getConversation(url);
      }

      return this.jsonResponse({ error: 'Not found' }, 404);
    } catch (error) {
      console.error('[MessageQueue] Error:', error);
      return this.jsonResponse({ error: error.message }, 500);
    }
  }

  /**
   * Build conversation key from username:color pairs
   */
  getConversationKey(humanUsername, humanColor, aiUsername, aiColor) {
    return `conv:${humanUsername}:${humanColor}:${aiUsername}:${aiColor}`;
  }

  /**
   * POST /api/comments - Create new message
   */
  async postMessage(request) {
    const body = await request.json();

    const id = body.id || this.generateId();
    const timestamp = Date.now();
    const messageType = body['message-type'] || body.messageType || 'human';
    
    // Extract entity
    let entity = 'default';
    if (body.botParams?.entity) {
      entity = body.botParams.entity;
    } else if (body.domain) {
      const match = body.domain.match(/^([^.]+)\./);
      if (match) entity = match[1];
    }

    // Determine AI username/color from botParams.ais
    const ais = body.botParams?.ais;
    let aiUsername = entity;
    let aiColor = 'default';
    
    if (ais) {
      const [aisUser, aisCol] = ais.split(':');
      if (aisUser) aiUsername = aisUser;
      if (aisCol) aiColor = aisCol;
    }

    // Build conversation key
    const conversationKey = this.getConversationKey(
      body.username,
      body.color,
      aiUsername,
      aiColor
    );

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
      botParams: {
        status: messageType === 'human' ? 'pending' : 'complete',
        priority: body.botParams?.priority || body.priority || 5,
        entity,
        ais: body.botParams?.ais || null,
        claimedBy: null,
        claimedAt: null,
        completedAt: messageType === 'AI' ? timestamp : null
      }
    };

    // Get existing conversation
    const conversation = await this.state.storage.get(conversationKey) || [];

  // Add message to front (newest first)
  conversation.unshift(message);

  // Keep only last 150 messages (rolling window)
  // Supports nom=100 with 50% safety margin
  if (conversation.length > 150) {
    conversation.length = 150;
  }

    // Save conversation
    await this.state.storage.put(conversationKey, conversation);

    console.log('[MessageQueue] Posted to', conversationKey, '→', conversation.length, 'messages total');

    return this.jsonResponse({ id, timestamp, status: 'success' });
  }

  /**
   * GET /api/comments?after=timestamp - Get messages after timestamp
   * Returns messages from ALL conversations
   */
  async getMessages(url) {
    const after = parseInt(url.searchParams.get('after') || url.searchParams.get('since') || '0');
    
    // Get all conversation keys
    const keys = await this.state.storage.list({ prefix: 'conv:' });
    
    // Load all conversations in parallel
    const conversations = await Promise.all(
      Array.from(keys.keys()).map(key => this.state.storage.get(key))
    );
    
    // Flatten to all messages
    const allMessages = conversations.flat().filter(m => m !== null);
    
    // Filter messages newer than 'after'
    const filtered = allMessages.filter(m => m.timestamp > after);

    console.log('[MessageQueue] GET messages after', after, '→', filtered.length, 'results from', keys.keys().size, 'conversations');

    return this.jsonResponse(filtered);
  }

  /**
   * GET /api/queue/pending - Get pending messages for bot
   */
  async getPending(url) {
    const limit = parseInt(url.searchParams.get('limit') || '999999');
    
    // Get all conversation keys
    const keys = await this.state.storage.list({ prefix: 'conv:' });
    
    // Load all conversations in parallel
    const conversations = await Promise.all(
      Array.from(keys.keys()).map(key => this.state.storage.get(key))
    );
    
    // Flatten to all messages
    const allMessages = conversations.flat().filter(m => m !== null);
    
    // Filter for pending human messages
    const pending = allMessages.filter(m => 
      m['message-type'] === 'human' && 
      m.botParams.status === 'pending'
    );

    // Sort by priority (desc) then timestamp (asc)
    pending.sort((a, b) => {
      const priorityDiff = (b.botParams.priority || 5) - (a.botParams.priority || 5);
      if (priorityDiff !== 0) return priorityDiff;
      return a.timestamp - b.timestamp;
    });

    const result = pending.slice(0, limit);

    console.log('[MessageQueue] GET pending:', result.length, 'of', pending.length, 'total from', keys.keys().size, 'conversations');

    return this.jsonResponse({
      pending: result,
      kvStats: { reads: keys.keys().size, writes: 0 }
    });
  }

  /**
   * POST /api/queue/claim - Claim a message for processing
   */
  async claimMessage(request) {
    const { messageId, workerId } = await request.json();
    
    // Get all conversation keys
    const keys = await this.state.storage.list({ prefix: 'conv:' });
    
    // Find message in conversations
    for (const key of keys.keys()) {
      const conversation = await this.state.storage.get(key);
      if (!conversation) continue;
      
      const messageIndex = conversation.findIndex(m => m.id === messageId);
      
      if (messageIndex !== -1) {
        const message = conversation[messageIndex];
        
        if (message.botParams.status !== 'pending') {
          return this.jsonResponse({
            success: false,
            error: `Message status is ${message.botParams.status}, not pending`
          }, 409);
        }
        
        // Update message
        message.botParams.status = 'processing';
        message.botParams.claimedBy = workerId;
        message.botParams.claimedAt = Date.now();
        
        // Save conversation back
        await this.state.storage.put(key, conversation);
        
        console.log('[MessageQueue] Claimed:', messageId, 'from', key);
        
        return this.jsonResponse({ success: true, message });
      }
    }
    
    return this.jsonResponse({ success: false, error: 'Message not found' }, 404);
  }

  /**
   * POST /api/queue/complete - Mark message as complete
   */
  async completeMessage(request) {
    const { messageId } = await request.json();
    
    // Get all conversation keys
    const keys = await this.state.storage.list({ prefix: 'conv:' });
    
    // Find message in conversations
    for (const key of keys.keys()) {
      const conversation = await this.state.storage.get(key);
      if (!conversation) continue;
      
      const messageIndex = conversation.findIndex(m => m.id === messageId);
      
      if (messageIndex !== -1) {
        const message = conversation[messageIndex];
        
        if (message.botParams.status !== 'processing') {
          return this.jsonResponse({
            success: false,
            error: `Message status is ${message.botParams.status}, not processing`
          }, 409);
        }
        
        // Update message
        message.botParams.status = 'complete';
        message.botParams.completedAt = Date.now();
        
        // Save conversation back
        await this.state.storage.put(key, conversation);
        
        console.log('[MessageQueue] Completed:', messageId, 'in', key);
        
        return this.jsonResponse({ success: true });
      }
    }
    
    return this.jsonResponse({ success: false, error: 'Message not found' }, 404);
  }

  /**
   * GET /api/conversation - Get messages for a specific conversation
   * Query params: humanUsername, humanColor, aiUsername, aiColor, limit
   */
  async getConversation(url) {
    const humanUsername = url.searchParams.get('humanUsername');
    const humanColor = url.searchParams.get('humanColor');
    const aiUsername = url.searchParams.get('aiUsername');
    const aiColor = url.searchParams.get('aiColor');
    const limit = parseInt(url.searchParams.get('limit') || '100');
    
    // Build conversation key
    const conversationKey = this.getConversationKey(
      humanUsername,
      humanColor,
      aiUsername,
      aiColor
    );
    
    // Get conversation (1 read!)
    const conversation = await this.state.storage.get(conversationKey) || [];
    
    // Sort by timestamp (oldest first) - should already be sorted but ensure it
    conversation.sort((a, b) => a.timestamp - b.timestamp);
    
    // Return last N messages
    const result = conversation.slice(-limit);
    
    console.log('[MessageQueue] GET conversation', conversationKey, '→', result.length, 'of', conversation.length, 'total');
    
    return this.jsonResponse(result);
  }

  /**
   * POST /api/admin/purge - Emergency purge of all conversations
   */
  async purgeStorage() {
    const keys = await this.state.storage.list({ prefix: 'conv:' });
    
    // Delete all conversation keys
    const deletePromises = Array.from(keys.keys()).map(key => 
      this.state.storage.delete(key)
    );
    await Promise.all(deletePromises);
    
    const count = keys.keys().size;
    
    console.log('[MessageQueue] PURGED', count, 'conversations');
    
    return this.jsonResponse({ 
      success: true,
      message: `Purged ${count} conversations`
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

