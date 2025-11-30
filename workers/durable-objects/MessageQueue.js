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
    
    // IN-MEMORY STATE (Cost optimization - Doc 215)
    this.pendingQueue = [];           // For bot polling (pending messages only)
    this.recentMessages = [];         // For frontend polling (last 50K messages)
    this.MAX_CACHE_SIZE = 50000;      // 50K messages = ~100MB = 78% of 128MB limit
    this.initialized = false;          // Track if state loaded from storage
  }
  
  // Storage methods with operation logging
  async storageGet(key) {
    console.log(`[STORAGE] GET: ${key}`);
    return await this.state.storage.get(key);
  }
  
  async storagePut(key, value) {
    console.log(`[STORAGE] PUT: ${key}`);
    return await this.state.storage.put(key, value);
  }
  
  async storageList(options) {
    console.log(`[STORAGE] LIST: ${JSON.stringify(options)}`);
    return await this.state.storage.list(options);
  }
  
  async storageDelete(key) {
    console.log(`[STORAGE] DELETE: ${key}`);
    return await this.state.storage.delete(key);
  }
  
  logStorageSummary(operation) {
    // No-op
  }

  // ============================================================
  // PER-MESSAGE STORAGE HELPERS (Doc 218 - Cost Optimization)
  // ============================================================
  
  /**
   * Generate conversation ID from participants
   * Format: {humanUsername}:{humanColor}:{aiUsername}:{aiColor}
   */
  getConversationId(humanUsername, humanColor, aiUsername, aiColor) {
    return `${humanUsername}:${humanColor}:${aiUsername}:${aiColor}`;
  }
  
  /**
   * Generate message storage key
   * Format: msg:{conversationId}:{messageId}
   */
  getMessageKey(conversationId, messageId) {
    return `msg:${conversationId}:${messageId}`;
  }
  
  /**
   * Generate conversation index key
   * Format: idx:{conversationId}
   */
  getIndexKey(conversationId) {
    return `idx:${conversationId}`;
  }
  
  /**
   * Store a single message (O(1) cost - ~600 bytes = 1 unit)
   */
  async storeMessage(conversationId, message) {
    const key = this.getMessageKey(conversationId, message.id);
    await this.storagePut(key, message);
  }
  
  /**
   * Get a single message by ID (O(1) cost - ~600 bytes = 1 unit)
   */
  async getMessage(conversationId, messageId) {
    const key = this.getMessageKey(conversationId, messageId);
    return await this.storageGet(key);
  }
  
  /**
   * Update a single message (O(1) cost - 1 read + 1 write)
   */
  async updateMessage(conversationId, messageId, updates) {
    const key = this.getMessageKey(conversationId, messageId);
    const message = await this.storageGet(key);
    if (!message) return null;
    
    // Deep merge for nested objects like botParams
    const updated = { ...message };
    for (const [k, v] of Object.entries(updates)) {
      if (v && typeof v === 'object' && !Array.isArray(v) && message[k] && typeof message[k] === 'object') {
        updated[k] = { ...message[k], ...v };
      } else {
        updated[k] = v;
      }
    }
    
    await this.storagePut(key, updated);
    return updated;
  }
  
  /**
   * Get conversation index (message IDs + metadata)
   */
  async getIndex(conversationId) {
    const key = this.getIndexKey(conversationId);
    return await this.storageGet(key) || { 
      messageIds: [], 
      metadata: {
        createdAt: null,
        lastMessageAt: null,
        messageCount: 0
      }
    };
  }
  
  /**
   * Update conversation index
   */
  async updateIndex(conversationId, index) {
    const key = this.getIndexKey(conversationId);
    await this.storagePut(key, index);
  }
  
  /**
   * Get multiple messages by IDs (batch read)
   */
  async getMessages_batch(conversationId, messageIds) {
    const keys = messageIds.map(id => this.getMessageKey(conversationId, id));
    console.log(`[STORAGE] GET_BATCH: ${keys.length} keys`);
    const messagesMap = await this.state.storage.get(keys);
    return Array.from(messagesMap.values()).filter(m => m !== null);
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
      
      // NEW: Atomic claim-next endpoint (combines pending + claim)
      if (path === '/api/queue/claim-next' && request.method === 'POST') {
        return await this.claimNextMessage(request);
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
   * Initialize in-memory state from storage (ONE TIME on DO startup)
   * PER-MESSAGE STORAGE (Doc 218): Load indexes, then batch-load messages
   */
  async initialize() {
    if (this.initialized) {
      return;  // Already initialized, no storage operations
    }
    
    console.log('[MessageQueue] 🔄 INITIALIZE RUNNING - this should only happen once per DO wake!');
    const startTime = Date.now();
    
    // ============================================================
    // PER-MESSAGE STORAGE: Load all indexes first (small, ~2KB each)
    // ============================================================
    
    const indexKeys = await this.storageList({ prefix: 'idx:' });
    const allIndexKeys = Array.from(indexKeys.keys());
    
    console.log('[MessageQueue] Found', allIndexKeys.length, 'conversation indexes');
    
    // Load all indexes in parallel
    const indexes = await Promise.all(
      allIndexKeys.map(key => this.storageGet(key))
    );
    
    // Collect all message IDs with their conversation IDs
    const messageRequests = [];
    for (let i = 0; i < indexes.length; i++) {
      const index = indexes[i];
      if (index && index.messageIds) {
        // Extract conversationId from index key (idx:{conversationId})
        const conversationId = allIndexKeys[i].substring(4); // Remove 'idx:' prefix
        
        for (const msgId of index.messageIds) {
          messageRequests.push({ conversationId, msgId });
        }
      }
    }
    
    console.log('[MessageQueue] Loading', messageRequests.length, 'messages...');
    
    // Batch load all messages (in chunks to avoid memory issues)
    const BATCH_SIZE = 1000;
    const allMessages = [];
    
    for (let i = 0; i < messageRequests.length; i += BATCH_SIZE) {
      const batch = messageRequests.slice(i, i + BATCH_SIZE);
      const keys = batch.map(({ conversationId, msgId }) => 
        this.getMessageKey(conversationId, msgId)
      );
      
      console.log(`[STORAGE] GET_BATCH: ${keys.length} messages (batch ${Math.floor(i/BATCH_SIZE) + 1})`);
      const messagesMap = await this.state.storage.get(keys);
      allMessages.push(...Array.from(messagesMap.values()).filter(m => m !== null));
    }
    
    // Sort by timestamp (newest first)
    allMessages.sort((a, b) => b.timestamp - a.timestamp);
    
    // Recent messages (last 50K for frontend) - uses ~100MB of 128MB limit
    this.recentMessages = allMessages.slice(0, this.MAX_CACHE_SIZE);
    
    // Pending messages (for bot)
    this.pendingQueue = allMessages.filter(m => 
      m['message-type'] === 'human' && 
      m.botParams?.status === 'pending' &&
      m.botParams?.entity
    );
    
    const elapsed = Date.now() - startTime;
    this.initialized = true;
    
    console.log('[MessageQueue] ✅ Initialized:', {
      indexes: allIndexKeys.length,
      messages: allMessages.length,
      pending: this.pendingQueue.length,
      recent: this.recentMessages.length,
      elapsed: `${elapsed}ms`
    });
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
    
    // IDEMPOTENCY CHECK: Reject duplicate messages (same ID already exists)
    // This prevents duplicate storage operations from duplicate requests
    await this.initialize();
    const existingMsg = this.recentMessages.find(m => m.id === id);
    if (existingMsg) {
      console.log('[MessageQueue] ⚠️ Duplicate message rejected:', id);
      return this.jsonResponse({ id, timestamp: existingMsg.timestamp, status: 'duplicate' });
    }
    
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
    
    // DEBUG: Log routing decision
    console.log('[MessageQueue] Routing check:', {
      hasSessionId: !!sessionId,
      sessionIdValue: sessionId,
      entity: body.botParams?.entity,
      isGodMode: body.botParams?.entity === 'god-mode',
      willUseGodModeKey: !!(sessionId && body.botParams?.entity === 'god-mode')
    });
    
    if (sessionId && body.botParams?.entity === 'god-mode') {
      // God Mode: Use session-specific key (one key per session)
      conversationKey = `godmode:${humanUsername}:${humanColor}:${aiUsername}:${aiColor}:${sessionId}`;
      console.log('[MessageQueue] ✅ Using God Mode session key:', conversationKey);
    } else {
      // Normal entity: Use standard conversation key (all messages in one key)
      conversationKey = this.getConversationKey(
        humanUsername,
        humanColor,
        aiUsername,
        aiColor
      );
      console.log('[MessageQueue] Using standard conv key:', conversationKey);
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
      // Store conversation context for easy lookup
      conversationId: this.getConversationId(humanUsername, humanColor, aiUsername, aiColor),
      // Only include botParams if entity is explicitly provided
      ...(entity && {
        botParams: {
          status: messageType === 'human' ? 'pending' : 'complete',
          priority: body.botParams?.priority || body.priority || 5,
          entity,
          ais: body.botParams?.ais || null,
          sessionId: body.botParams?.sessionId || null,  // God Mode session routing
          humanUsername,  // Store for easy key reconstruction
          humanColor,
          claimedBy: null,
          claimedAt: null,
          completedAt: messageType === 'AI' ? timestamp : null
        }
      })
    };

    // ============================================================
    // PER-MESSAGE STORAGE (Doc 218 - O(1) cost per operation)
    // ============================================================
    
    const conversationId = this.getConversationId(humanUsername, humanColor, aiUsername, aiColor);
    
    // 1. Store message individually (~600 bytes = 1 unit)
    await this.storeMessage(conversationId, message);
    
    // 2. Update conversation index
    const index = await this.getIndex(conversationId);
    index.messageIds.push(message.id);
    index.metadata.lastMessageAt = timestamp;
    index.metadata.messageCount = index.messageIds.length;
    if (!index.metadata.createdAt) {
      index.metadata.createdAt = timestamp;
    }
    
    // Rolling window: keep only last 150 message IDs in index
    // Old messages stay in storage until explicit cleanup
    if (index.messageIds.length > 150) {
      const toRemove = index.messageIds.slice(0, -150);
      index.messageIds = index.messageIds.slice(-150);
      
      // Delete old messages from storage to save storage cost
      for (const msgId of toRemove) {
        const key = this.getMessageKey(conversationId, msgId);
        await this.storageDelete(key);
      }
      console.log('[MessageQueue] Rolling window: deleted', toRemove.length, 'old messages');
    }
    
    await this.updateIndex(conversationId, index);
    
    // ============================================================
    // IN-MEMORY CACHE UPDATES (Doc 215)
    // ============================================================
    
    // Add to recent messages cache (for frontend polling)
    this.recentMessages.unshift(message);
    if (this.recentMessages.length > this.MAX_CACHE_SIZE) {
      this.recentMessages.pop();
    }
    
    // If pending human message for bot, add to pending queue
    if (messageType === 'human' && entity && message.botParams?.status === 'pending') {
      this.pendingQueue.push(message);
      console.log('[MessageQueue] Added to pending queue:', message.id);
    }

    console.log('[MessageQueue] Posted:', message.id, 'to', conversationId, '(index:', index.messageIds.length, 'msgs, pending:', this.pendingQueue.length, ')');

    return this.jsonResponse({ id, timestamp, status: 'success' });
  }

  /**
   * GET /api/comments?after=timestamp - Get messages after timestamp
   * OPTIMIZED: Uses in-memory recentMessages cache (0 storage reads!)
   */
  async getMessages(url) {
    await this.initialize();  // Ensure state is loaded
    
    const after = parseInt(url.searchParams.get('after') || url.searchParams.get('since') || '0');
    
    // Filter recent messages by timestamp (in memory, fast!)
    const filtered = this.recentMessages.filter(m => m.timestamp > after);
    
    console.log('[MessageQueue] GET messages (in-memory):', filtered.length, 'of', this.recentMessages.length, 'recent, reads: 0');
    
    // Return with version for force-refresh capability (Doc 216)
    return this.jsonResponse({
      messages: filtered,
      version: "1.0.1"  // Version for frontend force-refresh detection
    });
  }

  /**
   * GET /api/queue/pending - Get pending messages for bot
   * OPTIMIZED: Uses in-memory pendingQueue (0 storage reads!)
   */
  async getPending(url) {
    await this.initialize();  // Ensure state is loaded (no-op if already initialized)
    
    const limit = parseInt(url.searchParams.get('limit') || '999999');
    
    // Sort by priority (desc) then timestamp (asc) - in memory, fast!
    this.pendingQueue.sort((a, b) => {
      const priorityDiff = (b.botParams.priority || 5) - (a.botParams.priority || 5);
      if (priorityDiff !== 0) return priorityDiff;
      return a.timestamp - b.timestamp;
    });
    
    const pendingForBot = this.pendingQueue.slice(0, limit);
    
    console.log('[MessageQueue] GET pending (in-memory):', pendingForBot.length, 'messages, reads: 0');
    
    return this.jsonResponse({
      pending: pendingForBot,
      platformOnly: [],  // Platform posts not needed for bot polling
      kvStats: { reads: 0, writes: 0 }  // ZERO storage reads!
    });
  }

  /**
   * POST /api/queue/claim - Claim a message for processing
   * PER-MESSAGE STORAGE (Doc 218): O(1) cost - just 1 read + 1 write
   */
  async claimMessage(request) {
    await this.initialize();  // Ensure state is loaded
    
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
    
    // Get conversationId from message
    const conversationId = message.conversationId;
    
    if (!conversationId) {
      console.error('[MessageQueue] claim: No conversationId on message:', messageId);
      return this.jsonResponse({ success: false, error: 'Message missing conversationId' }, 500);
    }
    
    // Update in storage (1 read + 1 write, ~600 bytes = 1 unit each)
    const updated = await this.updateMessage(conversationId, messageId, {
      botParams: message.botParams
    });
    
    if (!updated) {
      console.error('[MessageQueue] claim: Failed to update message in storage:', messageId);
      return this.jsonResponse({ success: false, error: 'Message not found in storage' }, 500);
    }
    
    console.log('[MessageQueue] Claimed:', messageId, 'in', conversationId, '(pending:', this.pendingQueue.length, ')');
    return this.jsonResponse({ success: true, message });
  }

  /**
   * POST /api/queue/claim-next - Atomic operation: Get next pending + claim it
   * PER-MESSAGE STORAGE (Doc 218): O(1) cost - just 1 read + 1 write
   */
  async claimNextMessage(request) {
    await this.initialize();  // Ensure state is loaded
    
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
      console.log('[MessageQueue] claim-next: No pending messages (in-memory check)');
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
    
    // ============================================================
    // PER-MESSAGE STORAGE UPDATE (Doc 218 - O(1) cost)
    // ============================================================
    
    // Get conversationId from message (stored during postMessage)
    const conversationId = message.conversationId;
    
    if (!conversationId) {
      console.error('[MessageQueue] claim-next: No conversationId on message:', message.id);
      return this.jsonResponse({ success: false, error: 'Message missing conversationId' }, 500);
    }
    
    // Direct message update (1 read + 1 write, ~600 bytes = 1 unit each)
    const updated = await this.updateMessage(conversationId, message.id, {
      botParams: message.botParams
    });
    
    if (!updated) {
      console.error('[MessageQueue] claim-next: Failed to update message in storage:', message.id);
      return this.jsonResponse({ success: false, error: 'Message not found in storage' }, 500);
    }
    
    console.log('[MessageQueue] claim-next: Claimed', message.id, 'in', conversationId);
    
    return this.jsonResponse({
      success: true,
      message: message,
      totalPending: totalPendingBefore,
      remainingPending: this.pendingQueue.length
    });
  }
  
  /**
   * POST /api/queue/complete - Mark message as complete
   * PER-MESSAGE STORAGE (Doc 218): O(1) cost - just 1 read + 1 write
   */
  async completeMessage(request) {
    await this.initialize();  // Ensure state is loaded
    
    const { messageId } = await request.json();
    
    // 1. Find in recent messages to get conversationId
    const recentMsg = this.recentMessages.find(m => m.id === messageId);
    
    if (!recentMsg) {
      console.error('[MessageQueue] Complete failed: Message not in memory:', messageId);
      return this.jsonResponse({ success: false, error: 'Message not found in memory' }, 404);
    }
    
    const conversationId = recentMsg.conversationId;
    
    if (!conversationId) {
      console.error('[MessageQueue] Complete failed: No conversationId on message:', messageId);
      return this.jsonResponse({ success: false, error: 'Message missing conversationId' }, 500);
    }
    
    // 2. Update message in storage (1 read + 1 write, ~600 bytes = 1 unit each)
    const completedAt = Date.now();
    const updated = await this.updateMessage(conversationId, messageId, {
      botParams: {
        ...recentMsg.botParams,
        status: 'complete',
        completedAt
      }
    });
    
    if (!updated) {
      console.error('[MessageQueue] Complete failed: Message not found in storage:', messageId);
      return this.jsonResponse({ success: false, error: 'Message not found in storage' }, 404);
    }
    
    // 3. Update in-memory cache
    recentMsg.botParams.status = 'complete';
    recentMsg.botParams.completedAt = completedAt;
    
    console.log('[MessageQueue] Completed:', messageId, 'in', conversationId);
    return this.jsonResponse({ success: true });
  }
  
  /**
   * PATCH /api/comments/:id - Update message fields (e.g., eqScore)
   * PER-MESSAGE STORAGE (Doc 218): O(1) cost - just 1 read + 1 write
   */
  async patchMessage(request, path) {
    await this.initialize();  // Ensure state is loaded
    
    const messageId = path.split('/').pop();  // Extract ID from path
    const body = await request.json();
    
    // 1. Find in recent messages to get conversationId
    const recentMsg = this.recentMessages.find(m => m.id === messageId);
    
    if (!recentMsg) {
      console.error('[MessageQueue] PATCH failed: Message not in memory:', messageId);
      return this.jsonResponse({ success: false, error: 'Message not found in memory' }, 404);
    }
    
    const conversationId = recentMsg.conversationId;
    
    if (!conversationId) {
      console.error('[MessageQueue] PATCH failed: No conversationId on message:', messageId);
      return this.jsonResponse({ success: false, error: 'Message missing conversationId' }, 500);
    }
    
    // 2. Build updates object
    const updates = {};
    if (body.eqScore !== undefined) updates.eqScore = body.eqScore;
    
    // 3. Update message in storage (1 read + 1 write, ~600 bytes = 1 unit each)
    const updated = await this.updateMessage(conversationId, messageId, updates);
    
    if (!updated) {
      console.error('[MessageQueue] PATCH failed: Message not found in storage:', messageId);
      return this.jsonResponse({ success: false, error: 'Message not found in storage' }, 404);
    }
    
    // 4. Update in-memory cache
    if (body.eqScore !== undefined) recentMsg.eqScore = body.eqScore;
    
    console.log('[MessageQueue] PATCH success:', messageId, 'in', conversationId);
    return this.jsonResponse({ success: true, message: updated });
  }

  /**
   * GET /api/conversation for God Mode (query ALL session keys)
   * PER-MESSAGE STORAGE (Doc 218): Uses batch reads for efficiency
   */
  async getGodModeConversation(url) {
    const humanUsername = url.searchParams.get('humanUsername');
    const humanColor = url.searchParams.get('humanColor');
    const aiUsername = url.searchParams.get('aiUsername');
    const aiColor = url.searchParams.get('aiColor');
    const after = parseInt(url.searchParams.get('after') || '0');
    
    // List all session index keys for this Human:GodMode pair
    const prefix = `idx:${humanUsername}:${humanColor}:${aiUsername}:${aiColor}:`;
    const indexKeys = await this.storageList({ prefix: prefix });
    
    // Load all session indexes
    const allIndexes = await Promise.all(
      Array.from(indexKeys.keys()).map(key => this.storageGet(key))
    );
    
    // Collect all message IDs from all sessions
    const allMessageRequests = [];
    for (const index of allIndexes) {
      if (index && index.messageIds) {
        // Extract conversationId from index (stored in metadata or derive from key)
        const conversationId = index.metadata?.conversationId || 
          `${humanUsername}:${humanColor}:${aiUsername}:${aiColor}:${index.metadata?.sessionId || 'unknown'}`;
        
        for (const msgId of index.messageIds) {
          allMessageRequests.push({ conversationId, msgId });
        }
      }
    }
    
    // Batch fetch all messages
    const messageKeys = allMessageRequests.map(({ conversationId, msgId }) => 
      this.getMessageKey(conversationId, msgId)
    );
    
    let allMessages = [];
    if (messageKeys.length > 0) {
      console.log(`[STORAGE] GET_BATCH: ${messageKeys.length} God Mode messages`);
      const messagesMap = await this.state.storage.get(messageKeys);
      allMessages = Array.from(messagesMap.values()).filter(m => m !== null);
    }
    
    // Filter by timestamp
    const filtered = allMessages.filter(m => m.timestamp > after);
    
    // Sort by timestamp
    filtered.sort((a, b) => a.timestamp - b.timestamp);
    
    console.log('[MessageQueue] God Mode conversation:', filtered.length, 'messages from', Array.from(indexKeys.keys()).length, 'sessions');
    
    return this.jsonResponse(filtered);
  }
  
  /**
   * GET /api/conversation - Get messages for a specific conversation
   * PER-MESSAGE STORAGE (Doc 218): Uses batch reads for efficiency
   */
  async getConversation(url) {
    const humanUsername = url.searchParams.get('humanUsername');
    const humanColor = url.searchParams.get('humanColor');
    const aiUsername = url.searchParams.get('aiUsername');
    const aiColor = url.searchParams.get('aiColor');
    const limit = parseInt(url.searchParams.get('limit') || '100');
    
    // Build conversation ID
    const conversationId = this.getConversationId(
      humanUsername,
      humanColor,
      aiUsername,
      aiColor
    );
    
    // Get conversation index (1 read, ~2KB = 1 unit)
    const index = await this.getIndex(conversationId);
    
    if (!index.messageIds || index.messageIds.length === 0) {
      console.log('[MessageQueue] GET conversation', conversationId, '→ empty');
      return this.jsonResponse([]);
    }
    
    // Get last N message IDs
    const messageIds = index.messageIds.slice(-limit);
    
    // Batch fetch messages (N reads, ~600 bytes each = N units)
    const messages = await this.getMessages_batch(conversationId, messageIds);
    
    // Sort by timestamp (oldest first)
    messages.sort((a, b) => a.timestamp - b.timestamp);
    
    console.log('[MessageQueue] GET conversation', conversationId, '→', messages.length, 'of', index.messageIds.length, 'total');
    
    return this.jsonResponse(messages);
  }

  /**
   * GET /api/admin/list-keys - List all conversation index keys
   * PER-MESSAGE STORAGE (Doc 218): Lists idx: keys instead of conv: keys
   */
  async listKeys() {
    const indexKeys = await this.storageList({ prefix: 'idx:' });
    const msgKeys = await this.storageList({ prefix: 'msg:' });
    
    const indexList = Array.from(indexKeys.keys());
    const msgCount = Array.from(msgKeys.keys()).length;
    
    console.log('[MessageQueue] Listed', indexList.length, 'conversation indexes,', msgCount, 'messages');
    
    return this.jsonResponse({ 
      keys: indexList,
      count: indexList.length,
      messageCount: msgCount
    });
  }

  /**
   * POST /api/admin/purge - Emergency purge of all data
   * PER-MESSAGE STORAGE (Doc 218): Deletes idx: and msg: keys
   */
  async purgeStorage() {
    // Get all keys
    const indexKeys = await this.storageList({ prefix: 'idx:' });
    const msgKeys = await this.storageList({ prefix: 'msg:' });
    
    // Also purge old format keys if any remain
    const oldConvKeys = await this.storageList({ prefix: 'conv:' });
    const oldGodModeKeys = await this.storageList({ prefix: 'godmode:' });
    
    const allKeys = [
      ...Array.from(indexKeys.keys()),
      ...Array.from(msgKeys.keys()),
      ...Array.from(oldConvKeys.keys()),
      ...Array.from(oldGodModeKeys.keys())
    ];
    
    // Delete all keys
    const deletePromises = allKeys.map(key => this.storageDelete(key));
    await Promise.all(deletePromises);
    
    // Clear in-memory caches
    this.recentMessages = [];
    this.pendingQueue = [];
    this.initialized = false;
    
    console.log('[MessageQueue] PURGED', allKeys.length, 'keys (indexes + messages + old format)');
    
    return this.jsonResponse({ 
      success: true,
      message: `Purged ${allKeys.length} keys`
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
    await this.storagePut(sessionKey, sessionData);
    this.logStorageSummary('saveGodModeSession');
    
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
    const keys = await this.storageList({ prefix: 'godmode-session:' });
    
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
    
    const sessionData = await this.storageGet(sessionKey);
    
    if (!sessionData) {
      return this.jsonResponse({ error: 'Session not found' }, 404);
    }
    
    // Fetch all messages for this session
    // Messages are in messages:all key (global stream)
    const allMessages = await this.storageGet('messages:all') || [];
    this.logStorageSummary('getGodModeSession');
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

