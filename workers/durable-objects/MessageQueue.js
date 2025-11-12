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

      if (path === '/api/queue/complete' && request.method === 'POST') {
        return await this.completeMessage(request);
      }

      if (path === '/api/admin/purge' && request.method === 'POST') {
        return await this.purgeStorage();
      }

      if (path === '/api/admin/list-keys' && request.method === 'GET') {
        return await this.listKeys();
      }

      if (path === '/api/conversation' && request.method === 'GET') {
        // Check if this is a God Mode conversation
        const aiUsername = url.searchParams.get('aiUsername');
        if (aiUsername && aiUsername.toLowerCase() === 'godmode') {
          return await this.getGodModeConversation(url);
        }
        return await this.getConversation(url);
      }
      
      // God Mode session endpoints
      if (path === '/api/godmode-session' && request.method === 'POST') {
        return await this.saveGodModeSession(request);
      }
      
      if (path === '/api/godmode-sessions' && request.method === 'GET') {
        return await this.listGodModeSessions(url);
      }
      
      if (path.startsWith('/api/godmode-session/') && request.method === 'GET') {
        return await this.getGodModeSession(request, path);
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
    
    // Extract entity - ONLY if explicitly provided in URL
    // Don't default to domain name - that causes human posts to get queued for bots
    const entity = body.botParams?.entity || null;

    // Determine conversation participants
    let humanUsername, humanColor, aiUsername, aiColor;
    
    if (messageType === 'human') {
      // Human message: use body username/color
      humanUsername = body.username;
      humanColor = body.color;
      
      if (entity) {
        // Message for AI entity
        const ais = body.botParams?.ais;
        aiUsername = entity;
        aiColor = 'default';
        
        if (ais) {
          const [aisUser, aisCol] = ais.split(':');
          if (aisUser) aiUsername = aisUser;
          if (aisCol) aiColor = aisCol;
        }
      } else {
        // Platform post (no entity) - use special identifier
        aiUsername = 'platform';
        aiColor = 'platform';
      }
    } else {
      // AI message: use botParams.humanUsername/humanColor
      humanUsername = body.botParams?.humanUsername || 'unknown';
      humanColor = body.botParams?.humanColor || 'unknown';
      aiUsername = body.username;
      aiColor = body.color;
    }

    // Build conversation key
    // Special routing for God Mode sessions
    const sessionId = body.botParams?.sessionId;
    let conversationKey;
    
    if (sessionId && body.botParams?.entity === 'god-mode') {
      // God Mode: Use session-specific key (one key per session)
      conversationKey = `godmode:${humanUsername}:${humanColor}:${aiUsername}:${aiColor}:${sessionId}`;
      console.log('[MessageQueue] God Mode session key:', conversationKey);
    } else {
      // Normal entity: Use standard conversation key (all messages in one key)
      conversationKey = this.getConversationKey(
        humanUsername,
        humanColor,
        aiUsername,
        aiColor
      );
    }

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
      // Only include botParams if entity is explicitly provided
      ...(entity && {
        botParams: {
          status: messageType === 'human' ? 'pending' : 'complete',
          priority: body.botParams?.priority || body.priority || 5,
          entity,
          ais: body.botParams?.ais || null,
          claimedBy: null,
          claimedAt: null,
          completedAt: messageType === 'AI' ? timestamp : null
        }
      })
    };

    // Get existing conversation
    let conversation = await this.state.storage.get(conversationKey) || [];

  // Add message to front (newest first)
  conversation.unshift(message);

  // Keep only last 150 COMPLETED messages (rolling window)
  // CRITICAL: Never delete pending or processing messages (they're still active)
  // Result: Conversation can temporarily exceed 150 if many messages are pending/processing
  if (conversation.length > 150) {
    // Separate by status (messages without botParams are considered complete)
    const activeMessages = conversation.filter(m => 
      m.botParams && (m.botParams.status === 'pending' || m.botParams.status === 'processing')
    );
    const completedMessages = conversation.filter(m => 
      !m.botParams || m.botParams.status === 'complete'
    );
    
    // Keep ALL active messages (protected) + last 150 completed messages
    if (completedMessages.length > 150) {
      completedMessages.length = 150;
    }
    
    // Combine: active first (protected), then completed (rolling window)
    conversation = [...activeMessages, ...completedMessages];
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
    
    // Get all conversation keys (normal entities)
    const convKeys = await this.state.storage.list({ prefix: 'conv:' });
    
    // Get all God Mode session keys
    const godModeKeys = await this.state.storage.list({ prefix: 'godmode:' });
    
    // Load all conversations and sessions in parallel
    const allKeys = [...Array.from(convKeys.keys()), ...Array.from(godModeKeys.keys())];
    const conversations = await Promise.all(
      allKeys.map(key => this.state.storage.get(key))
    );
    
    // Flatten to all messages
    const allMessages = conversations.flat().filter(m => m !== null);
    
    // Filter messages newer than 'after'
    const filtered = allMessages.filter(m => m.timestamp > after);

    console.log('[MessageQueue] GET messages after', after, '→', filtered.length, 'results from', Array.from(convKeys.keys()).length, 'conversations +', Array.from(godModeKeys.keys()).length, 'God Mode sessions');

    return this.jsonResponse(filtered);
  }

  /**
   * GET /api/queue/pending - Get pending messages for bot
   */
  async getPending(url) {
    const limit = parseInt(url.searchParams.get('limit') || '999999');
    
    // Get all conversation keys (normal entities)
    const convKeys = await this.state.storage.list({ prefix: 'conv:' });
    
    // Get all God Mode session keys
    const godModeKeys = await this.state.storage.list({ prefix: 'godmode:' });
    
    // Load all conversations and sessions in parallel
    const allKeys = [...Array.from(convKeys.keys()), ...Array.from(godModeKeys.keys())];
    const conversations = await Promise.all(
      allKeys.map(key => this.state.storage.get(key))
    );
    
    // Flatten to all messages
    const allMessages = conversations.flat().filter(m => m !== null);
    
    // Separate into two categories:
    // 1. Messages WITH entity (for bot processing)
    const forBot = allMessages.filter(m => 
      m['message-type'] === 'human' && 
      m.botParams?.status === 'pending' &&
      m.botParams?.entity  // Must have entity
    );
    
    // 2. Messages WITHOUT entity (for logging only)
    const platformOnly = allMessages.filter(m =>
      m['message-type'] === 'human' &&
      !m.botParams?.entity  // No entity = just human posting to platform
    );

    // Sort bot messages by priority (desc) then timestamp (asc)
    forBot.sort((a, b) => {
      const priorityDiff = (b.botParams.priority || 5) - (a.botParams.priority || 5);
      if (priorityDiff !== 0) return priorityDiff;
      return a.timestamp - b.timestamp;
    });
    
    // Sort platform-only by timestamp (newest first for logging)
    platformOnly.sort((a, b) => b.timestamp - a.timestamp);

    const pendingForBot = forBot.slice(0, limit);
    const platformMessages = platformOnly.slice(0, 10); // Last 10 platform posts
    
    const totalKeys = Array.from(convKeys.keys()).length + Array.from(godModeKeys.keys()).length;

    console.log('[MessageQueue] GET pending:', pendingForBot.length, 'bot +', platformMessages.length, 'platform from', Array.from(convKeys.keys()).length, 'conversations +', Array.from(godModeKeys.keys()).length, 'God Mode sessions');

    return this.jsonResponse({
      pending: pendingForBot,
      platformOnly: platformMessages,
      kvStats: { reads: totalKeys, writes: 0 }
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
   * PATCH /api/comments/:id - Update message fields (e.g., eqScore)
   */
  async patchMessage(request, path) {
    const messageId = path.split('/').pop();  // Extract ID from path
    const body = await request.json();
    
    // Get all conversation keys
    const keys = await this.state.storage.list({ prefix: 'conv:' });
    
    // Find message in conversations
    for (const key of keys.keys()) {
      const conversation = await this.state.storage.get(key);
      if (!conversation) continue;
      
      const messageIndex = conversation.findIndex(m => m.id === messageId);
      
      if (messageIndex !== -1) {
        // Update message fields
        const message = conversation[messageIndex];
        
        // Update eqScore if provided
        if (body.eqScore !== undefined) {
          message.eqScore = body.eqScore;
          console.log('[MessageQueue] Updated eqScore:', messageId, '→', body.eqScore);
        }
        
        // Save conversation back
        await this.state.storage.put(key, conversation);
        
        return this.jsonResponse({ success: true, message });
      }
    }
    
    return this.jsonResponse({ success: false, error: 'Message not found' }, 404);
  }

  /**
   * GET /api/conversation for God Mode (query ALL session keys)
   */
  async getGodModeConversation(url) {
    const humanUsername = url.searchParams.get('humanUsername');
    const humanColor = url.searchParams.get('humanColor');
    const aiUsername = url.searchParams.get('aiUsername');
    const aiColor = url.searchParams.get('aiColor');
    const after = parseInt(url.searchParams.get('after') || '0');
    
    // List all session keys for this Human:GodMode pair
    const prefix = `godmode:${humanUsername}:${humanColor}:${aiUsername}:${aiColor}:`;
    const sessionKeys = await this.state.storage.list({ prefix: prefix });
    
    // Load all sessions in parallel
    const allSessions = await Promise.all(
      Array.from(sessionKeys.keys()).map(key => this.state.storage.get(key))
    );
    
    // Flatten to all messages
    const allMessages = allSessions.flat().filter(m => m !== null);
    
    // Filter by timestamp
    const filtered = allMessages.filter(m => m.timestamp > after);
    
    // Sort by timestamp
    filtered.sort((a, b) => a.timestamp - b.timestamp);
    
    console.log('[MessageQueue] God Mode conversation:', filtered.length, 'messages from', Array.from(sessionKeys.keys()).length, 'sessions');
    
    return this.jsonResponse(filtered);
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
   * GET /api/admin/list-keys - List all conversation keys
   */
  async listKeys() {
    const keys = await this.state.storage.list({ prefix: 'conv:' });
    
    const keyList = Array.from(keys.keys());
    
    console.log('[MessageQueue] Listed', keyList.length, 'conversation keys');
    
    return this.jsonResponse({ 
      keys: keyList,
      count: keyList.length
    });
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
  
  /**
   * POST /api/godmode-session - Save God Mode session metadata
   */
  async saveGodModeSession(request) {
    const { sessionKey, sessionData } = await request.json();
    
    // Store in Durable Objects
    await this.state.storage.put(sessionKey, sessionData);
    
    console.log('[MessageQueue] Saved God Mode session:', sessionKey, 'with', sessionData.messageIds.length, 'messages');
    
    return this.jsonResponse({ 
      success: true, 
      sessionKey: sessionKey,
      messageCount: sessionData.messageIds.length
    });
  }
  
  /**
   * GET /api/godmode-sessions?humanUsername=X&humanColor=Y&godModeColor=Z
   * List God Mode sessions with optional filtering
   */
  async listGodModeSessions(url) {
    const humanUsername = url.searchParams.get('humanUsername');
    const humanColor = url.searchParams.get('humanColor');
    const godModeColor = url.searchParams.get('godModeColor');
    
    // List all godmode-session keys
    const keys = await this.state.storage.list({ prefix: 'godmode-session:' });
    
    const sessions = [];
    for (const [key, data] of keys) {
      // Filter by human and god mode if specified
      if (humanUsername && data.humanUsername !== humanUsername) continue;
      if (humanColor && data.humanColor !== humanColor) continue;
      if (godModeColor && data.godModeColor !== godModeColor) continue;
      
      sessions.push(data);
    }
    
    // Sort by timestamp (newest first)
    sessions.sort((a, b) => b.timestamp - a.timestamp);
    
    console.log('[MessageQueue] Listed', sessions.length, 'God Mode sessions');
    
    return this.jsonResponse({ 
      sessions: sessions,
      total: sessions.length
    });
  }
  
  /**
   * GET /api/godmode-session/:sessionId
   * Get specific God Mode session with all messages
   */
  async getGodModeSession(request, path) {
    const sessionId = path.split('/').pop();
    const sessionKey = `godmode-session:${sessionId}`;
    
    const sessionData = await this.state.storage.get(sessionKey);
    
    if (!sessionData) {
      return this.jsonResponse({ error: 'Session not found' }, 404);
    }
    
    // Fetch all messages for this session
    // Messages are in messages:all key (global stream)
    const allMessages = await this.state.storage.get('messages:all') || [];
    const sessionMessages = [];
    
    for (const msgId of sessionData.messageIds) {
      const msg = allMessages.find(m => m.id === msgId);
      if (msg) {
        sessionMessages.push(msg);
      }
    }
    
    console.log('[MessageQueue] Retrieved God Mode session:', sessionId, 'with', sessionMessages.length, 'messages');
    
    return this.jsonResponse({
      session: sessionData,
      messages: sessionMessages,
      messageCount: sessionMessages.length
    });
  }
}

