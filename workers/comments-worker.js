/**
 * Say What Want Comments Worker
 * A Cloudflare Worker for handling anonymous comments
 * Following SoundTrip engineering philosophy: Simple, Strong, Solid
 */

// CORS Configuration
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age': '86400',
};

// Rate Limiting Configuration
const RATE_LIMIT = 10;        // 10 comments per minute per IP
const RATE_WINDOW = 60;       // 60 second window

// Rate Limit Exemptions (no limits for these IPs/domains)
const EXEMPT_IPS = [
  '127.0.0.1',      // Localhost
  'localhost',      // Localhost
  '::1',            // IPv6 localhost
  '98.97.140.211',  // Testing IP (your current IP)
  '10.0.0.102',     // Mac Studio 1 (bot host + LM Studio)
  '10.0.0.100',     // Mac Studio 2 (LM Studio worker)
  // Add more LM Studio server IPs here as you scale
];

const EXEMPT_DOMAINS = [
  'ai.saywhatwant.app',  // AI bot domain (unlimited posting)
  'saywhatwant.app',     // Main app domain (users posting from browser)
  'www.saywhatwant.app', // With www subdomain
];
const MAX_COMMENT_LENGTH = 1000;
const MAX_USERNAME_LENGTH = 16;  // Match frontend limit
const CACHE_SIZE = 100;      // Keep last 100 comments in cache

/**
 * Generate a random RGB color using sophisticated range-based generation
 * Matches the client-side color generation logic
 */
function generateRandomRGB() {
  // Color ranges matching client-side
  const MAIN_MIN = 150, MAIN_MAX = 220;
  const SECONDARY_MIN = 40, SECONDARY_MAX = 220;
  const THIRD = 40;
  
  const mainValue = Math.floor(Math.random() * (MAIN_MAX - MAIN_MIN + 1)) + MAIN_MIN;
  const secondaryValue = Math.floor(Math.random() * (SECONDARY_MAX - SECONDARY_MIN + 1)) + SECONDARY_MIN;
  
  // 6 permutations for variety
  const permutation = Math.floor(Math.random() * 6);
  let r, g, b;
  
  switch (permutation) {
    case 0: r = mainValue; g = secondaryValue; b = THIRD; break;
    case 1: r = mainValue; g = THIRD; b = secondaryValue; break;
    case 2: r = secondaryValue; g = mainValue; b = THIRD; break;
    case 3: r = THIRD; g = mainValue; b = secondaryValue; break;
    case 4: r = secondaryValue; g = THIRD; b = mainValue; break;
    case 5: r = THIRD; g = secondaryValue; b = mainValue; break;
  }
  
  return `rgb(${r}, ${g}, ${b})`;
}

/**
 * Main request handler
 */
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    // Route handling
    if (path === '/api/comments' || path === '/') {
      switch (request.method) {
        case 'GET':
          return await handleGetComments(env, url);
        case 'POST':
          return await handlePostComment(request, env);
        default:
          return new Response('Method not allowed', { 
            status: 405, 
            headers: corsHeaders 
          });
      }
    }
    
    // PATCH /api/comments/:id - Update message processed status
    if (path.startsWith('/api/comments/') && request.method === 'PATCH') {
      const messageId = path.split('/').pop();
      return await handlePatchComment(request, env, messageId);
    }
    
    // Stats endpoint
    if (path === '/api/stats') {
      return await handleGetStats(env);
    }
    
    // NEW QUEUE SYSTEM ENDPOINTS
    // GET /api/queue/pending - Fetch pending messages
    if (path === '/api/queue/pending' && request.method === 'GET') {
      return await handleGetPending(env, url);
    }
    
    // POST /api/queue/claim - Atomic claim operation
    if (path === '/api/queue/claim' && request.method === 'POST') {
      return await handleClaimMessage(request, env);
    }
    
    // POST /api/queue/complete - Mark message complete
    if (path === '/api/queue/complete' && request.method === 'POST') {
      return await handleCompleteMessage(request, env);
    }
    
    // POST /api/queue/fail - Handle failure/retry
    if (path === '/api/queue/fail' && request.method === 'POST') {
      return await handleFailMessage(request, env);
    }

    return new Response('Not found', { 
      status: 404, 
      headers: corsHeaders 
    });
  },
};

/**
 * Handle GET /api/comments
 * Retrieve comments with pagination
 */
async function handleGetComments(env, url) {
  const params = url.searchParams;
  const offset = parseInt(params.get('offset') || '0');
  const limit = Math.min(parseInt(params.get('limit') || '50'), 1000);
  const search = params.get('search')?.toLowerCase();
  const uss = params.get('uss'); // Server-side user search
  const after = params.get('after'); // Cursor-based polling

  // Handle server-side user search
  if (uss) {
    return await handleServerSideUserSearch(uss, env);
  }

  // Handle cursor-based polling (efficient!)
  if (after) {
    const afterTimestamp = parseInt(after);
    const messageType = params.get('type'); // 'human' or 'AI' - for channel-exclusive polling
    const fresh = params.get('fresh'); // NEW: Fresh polling bypasses cache
    
    try {
      let allComments = [];
      
      // If fresh=true, bypass cache and read from individual KV keys (real-time)
      if (fresh === 'true') {
        console.log('[Comments] Fresh polling: reading from individual KV keys');
        
        // List ALL recent keys using cursor pagination
        let cursor = undefined;
        let keysToFetch = [];
        
        // Keep listing until we have enough keys or hit the end
        do {
          const list = await env.COMMENTS_KV.list({ 
            prefix: 'comment:', 
            limit: 1000,
            cursor: cursor
          });
          
          // Filter keys by timestamp (only fetch if timestamp > after)
          for (const key of list.keys) {
            const parts = key.name.split(':');
            if (parts.length >= 2) {
              const keyTimestamp = parseInt(parts[1]);
              if (keyTimestamp > afterTimestamp) {
                keysToFetch.push(key.name);
              }
            }
          }
          
          cursor = list.cursor;
          
          // Stop if we have enough keys or list is complete
          if (list.list_complete || keysToFetch.length >= 500) {
            break;
          }
        } while (cursor);
        
        // Fetch the filtered keys
        for (const keyName of keysToFetch) {
          const data = await env.COMMENTS_KV.get(keyName);
          if (data) {
            try {
              allComments.push(JSON.parse(data));
            } catch (parseError) {
              console.error('[Comments] Failed to parse:', keyName);
            }
          }
        }
        
        console.log(`[Comments] Fresh polling: found ${allComments.length} new messages`);
      } else {
        // Use cache (existing behavior for non-fresh requests)
        const cacheKey = 'recent:comments';
        const cachedData = await env.COMMENTS_KV.get(cacheKey);
        
        if (cachedData) {
          allComments = JSON.parse(cachedData);
          console.log(`[Comments] Cursor polling: using cache with ${allComments.length} comments`);
        } else {
          // Cache is empty (likely invalidated by PATCH) - rebuild from individual keys
          console.log('[Comments] Cursor polling: cache empty, rebuilding from KV...');
          const list = await env.COMMENTS_KV.list({ prefix: 'comment:', limit: 1000 });
          
          for (const key of list.keys) {
            const commentData = await env.COMMENTS_KV.get(key.name);
            if (commentData) {
              allComments.push(JSON.parse(commentData));
            }
          }
          
          // Sort by timestamp (ascending)
          allComments.sort((a, b) => a.timestamp - b.timestamp);
          
          // Update cache for future requests
          if (allComments.length > 0) {
            await updateCache(env, allComments);
            console.log(`[Comments] Rebuilt cache with ${allComments.length} comments`);
          }
        }
      }
      
      // Filter only messages after the timestamp
      const newMessages = allComments
        .filter(c => c.timestamp > afterTimestamp)
        .filter(c => !messageType || c['message-type'] === messageType) // Filter by type if specified
        .sort((a, b) => b.timestamp - a.timestamp) // Newest first
        .slice(0, limit);
      
      console.log(`[Comments] Cursor polling: ${newMessages.length} new messages after ${afterTimestamp}`);
      
      return new Response(JSON.stringify(newMessages), {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache',
        },
      });
    } catch (error) {
      console.error('[Comments] Cursor polling error:', error);
      return new Response(JSON.stringify([]), {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      });
    }
  }

  try {
    // Try to get from cache first
    const cacheKey = 'recent:comments';
    const cachedData = await env.COMMENTS_KV.get(cacheKey);

    let comments = [];
    
    if (cachedData) {
      comments = JSON.parse(cachedData);
      console.log(`[Comments] Retrieved ${comments.length} comments from cache`);
    } else {
      // Fallback: List all comment keys and fetch individually
      const list = await env.COMMENTS_KV.list({ prefix: 'comment:', limit: 1000 });
      
      for (const key of list.keys) {
        const commentData = await env.COMMENTS_KV.get(key.name);
        if (commentData) {
          comments.push(JSON.parse(commentData));
        }
      }
      
      // Sort by timestamp
      comments.sort((a, b) => a.timestamp - b.timestamp);
      
      // Update cache
      if (comments.length > 0) {
        await updateCache(env, comments);
      }
    }

    // Apply search filter if provided
    if (search) {
      comments = comments.filter(c => 
        c.text.toLowerCase().includes(search) ||
        (c.username && c.username.toLowerCase().includes(search))
      );
    }
    
    // Apply message type filter if provided (for channel-exclusive viewing)
    const messageType = params.get('type');
    if (messageType) {
      comments = comments.filter(c => c['message-type'] === messageType);
    }

    // Get ACTUAL total count from KV (not just cache size)
    let actualTotal = comments.length;
    try {
      let kvCount = 0;
      let cursor = undefined;
      do {
        const list = await env.COMMENTS_KV.list({ prefix: 'comment:', cursor, limit: 1000 });
        kvCount += list.keys.length;
        cursor = list.cursor;
        if (!list.list_complete) {
          // Keep counting if there are more keys
        } else {
          break;
        }
      } while (cursor);
      actualTotal = kvCount;
    } catch (countError) {
      console.error('[Comments] Failed to count KV keys:', countError);
      // Fallback to cache size
    }

    // Apply pagination
    const start = Math.max(0, comments.length - offset - limit);
    const end = comments.length - offset;
    const paginatedComments = comments.slice(start, end);

    const response = {
      comments: paginatedComments,
      total: actualTotal, // Use actual KV count, not cache size
      hasMore: start > 0,
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    });
  } catch (error) {
    console.error('[Comments] Error retrieving comments:', error);
    return new Response(JSON.stringify({ 
      error: 'Failed to retrieve comments',
      comments: [],
      total: 0,
      hasMore: false
    }), {
      status: 200, // Return 200 with empty results to avoid breaking frontend
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
      },
    });
  }
}

/**
 * Convert 9-digit format (RRRGGGBBB) to rgb(r, g, b) format
 */
function nineDigitToRgb(digits) {
  if (!digits || !/^\d{9}$/.test(digits)) {
    return 'rgb(255, 255, 255)'; // Default to white
  }
  
  const r = parseInt(digits.slice(0, 3), 10);
  const g = parseInt(digits.slice(3, 6), 10);
  const b = parseInt(digits.slice(6, 9), 10);
  
  return `rgb(${r}, ${g}, ${b})`;
}

/**
 * Handle server-side user search (#uss= parameter)
 * Searches entire KV for specific users with colors
 */
async function handleServerSideUserSearch(ussParam, env) {
  try {
    // Parse users from parameter
    // Format: "alice:255000000+bob:000255000"
    const requestedUsers = ussParam.split('+').map(userStr => {
      const [username, colorCode] = userStr.split(':');
      return {
        username: username.toLowerCase().replace(/[^a-z0-9]/g, ''),
        color: colorCode ? nineDigitToRgb(colorCode) : null
      };
    });
    
    console.log('[Comments] Server-side search for users:', requestedUsers);
    
    // Get all comments (try cache first for efficiency)
    let allComments = [];
    const cacheKey = 'recent:comments';
    const cachedData = await env.COMMENTS_KV.get(cacheKey);
    
    if (cachedData) {
      allComments = JSON.parse(cachedData);
      console.log(`[Comments] Using ${allComments.length} cached comments for search`);
    } else {
      // Fetch all comments from KV
      const list = await env.COMMENTS_KV.list({ prefix: 'comment:', limit: 1000 });
      
      for (const key of list.keys) {
        const commentData = await env.COMMENTS_KV.get(key.name);
        if (commentData) {
          allComments.push(JSON.parse(commentData));
        }
      }
      
      // Sort by timestamp (newest first for search results)
      allComments.sort((a, b) => b.timestamp - a.timestamp);
    }
    
    // Filter comments by requested users
    const results = allComments.filter(comment => {
      if (!comment.username) return false;
      
      // Normalize username for comparison
      const normalizedUsername = comment.username.toLowerCase().replace(/[^a-z0-9]/g, '');
      
      // Check if this comment matches any requested user
      return requestedUsers.some(requestedUser => {
        const usernameMatch = normalizedUsername === requestedUser.username;
        // Check color match - look for either 'color' or 'userColor' field
        const commentColor = comment.color || comment.userColor;
        const colorMatch = !requestedUser.color || commentColor === requestedUser.color;
        return usernameMatch && colorMatch;
      });
    });
    
    console.log(`[Comments] Server-side search found ${results.length} matching comments`);
    
    // Return results with server-side search flag
    return new Response(JSON.stringify({
      comments: results,
      total: results.length,
      hasMore: false,
      serverSideSearch: true,
      searchedUsers: requestedUsers
    }), {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    });
    
  } catch (error) {
    console.error('[Comments] Server-side search error:', error);
    return new Response(JSON.stringify({
      error: 'Server-side search failed',
      message: error.message,
      comments: [],
      total: 0,
      hasMore: false
    }), {
      status: 200, // Return 200 to avoid breaking frontend
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
      },
    });
  }
}

/**
 * Handle POST /api/comments
 * Create a new comment
 */
async function handlePostComment(request, env) {
  try {
    // Get client IP for rate limiting
    const ip = request.headers.get('CF-Connecting-IP') || 
               request.headers.get('X-Forwarded-For') || 
               'unknown';

    // Parse request body first (need domain for exemption check)
    const body = await request.json();

    // Check rate limit (pass body for domain checking)
    const canPost = await checkRateLimit(env, ip, request, body);
    if (!canPost) {
      return new Response(JSON.stringify({ 
        error: 'Rate limit exceeded. Please wait a moment before posting again.' 
      }), { 
        status: 429, 
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
          'Retry-After': '60',
        }
      });
    }
    const text = sanitizeText(body.text);
    const username = sanitizeUsername(body.username);
    const color = body.color || generateRandomRGB(); // Generate random color if not provided
    const domain = body.domain || request.headers.get('Origin')?.replace(/^https?:\/\//, '') || 'unknown';
    const language = body.language || 'en'; // Default to English
    const messageType = body['message-type'] || 'human'; // Default to human if not specified
    const misc = body.misc || ''; // Optional misc field
    const context = body.context; // Pre-formatted context messages from frontend
    const botParams = body.botParams; // Structured bot control parameters
    
    // DEBUG: Log what we received
    console.log('[Worker] Received from frontend:');
    console.log('[Worker]   body.botParams:', body.botParams);
    console.log('[Worker]   body.context:', body.context?.length || 'undefined');
    console.log('[Worker]   body.misc:', body.misc);

    // Validate input
    if (!text) {
      return new Response(JSON.stringify({ 
        error: 'Comment text is required' 
      }), { 
        status: 400, 
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        }
      });
    }

    // DEBUG: Log what we received from bot
    console.log('[Worker POST] === RECEIVED FROM BOT ===');
    console.log('[Worker POST] body.username:', body.username);
    console.log('[Worker POST] body.color:', body.color);
    console.log('[Worker POST] body.misc:', body.misc);
    console.log('[Worker POST] sanitized username:', username);
    console.log('[Worker POST] final color:', color);

    // Create comment object - use client ID/timestamp if provided
    const comment = {
      id: body.id || generateId(),  // Use client's ID if provided
      text: text,
      timestamp: body.timestamp || Date.now(),  // Use client's timestamp if provided
      username: username,
      color: color,  // Include the color field
      domain: domain,  // Store the domain
      language: language, // Store the language
      'message-type': messageType, // Store message type (AI, human, etc)
      misc: misc,  // Store misc data
      // Pre-formatted context messages from frontend (store even if empty)
      ...(context && Array.isArray(context) && {
        context: context
      }),
      // Bot control parameters (entity, priority, model, nom)
      ...(botParams && typeof botParams === 'object' && {
        botParams: {
          ...botParams,
          // NEW QUEUE SYSTEM: Add status field for state management
          ...(botParams.entity && {
            status: 'pending',
            claimedBy: null,
            claimedAt: null,
            attempts: 0
          })
        }
      }),
      // Reply-to field for AI messages (links to original human message)
      ...(body.replyTo && {
        replyTo: body.replyTo
      })
    };
    
    // DEBUG: Log what we're about to store
    console.log('[Worker POST] === STORING TO KV ===');
    console.log('[Worker POST] comment.username:', comment.username);
    console.log('[Worker POST] comment.color:', comment.color);
    console.log('[Worker POST] comment.id:', comment.id);

    // Store in KV - use ONLY message ID for key (timestamp stays in message data)
    const key = `comment:${comment.id}`;
    await env.COMMENTS_KV.put(key, JSON.stringify(comment));

    // Update recent comments cache
    await addToCache(env, comment);
    
    // Update message counter (batched for efficiency)
    await updateMessageCounter(env);

    // Log for monitoring
    console.log(`[Comments] New comment from ${ip}: "${text.substring(0, 50)}..."`);

    return new Response(JSON.stringify(comment), {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
      },
    });
  } catch (error) {
    console.error('[Comments] Error posting comment:', error);
    console.error('[Comments] Error details:', error.message, error.stack);
    
    // More specific error message
    let errorMessage = 'Failed to post comment';
    if (error.message?.includes('size') || error.message?.includes('limit')) {
      errorMessage = 'Comment cache too large, please try again';
    } else if (error.message?.includes('KV')) {
      errorMessage = 'Storage error, please try again';
    }
    
    return new Response(JSON.stringify({ 
      error: errorMessage,
      details: error.message 
    }), {
      status: 500,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
      },
    });
  }
}

/**
 * Update comment processed status
 * PATCH /api/comments/:id
 * 
 * Updates botParams.processed field to track if message has been processed by bot
 * This prevents reprocessing across PM2 restarts
 */
async function handlePatchComment(request, env, messageId) {
  try {
    console.log('[Comments] PATCH request for message:', messageId);
    
    const updates = await request.json();
    
    // Validate updates (only allow botParams.processed updates from bot)
    if (!updates.botParams || updates.botParams.processed === undefined) {
      return new Response(JSON.stringify({ 
        error: 'Invalid update - only botParams.processed can be updated' 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    // Direct key access using ONLY message ID (instant, no pagination!)
    const key = `comment:${messageId}`;
    console.log('[Comments] PATCH key:', key);
    
    // Get message directly
    const messageData = await env.COMMENTS_KV.get(key);
    
    if (!messageData) {
      console.error('[Comments] Message not found at key:', key);
      return new Response(JSON.stringify({ error: 'Message not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    // Parse the message
    const message = JSON.parse(messageData);
    
    // Initialize botParams if it doesn't exist
    if (!message.botParams) {
      message.botParams = {};
    }
    
    // Update processed field
    message.botParams.processed = updates.botParams.processed;
    
    // Save back to individual KV key
    await env.COMMENTS_KV.put(key, JSON.stringify(message));
    
    console.log('[Comments] ✅ Updated individual key:', messageId, '→', updates.botParams.processed);
    
    // Update cache in-place (best effort, non-blocking)
    // NOTE: We no longer delete the cache because:
    // 1. Bot has persistent `processed` flag in individual keys
    // 2. Deleting cache causes race condition where frontend gets 0 messages during rebuild
    // 3. Cache showing `processed: false` briefly is harmless - bot's deduplication works from individual keys
    // See: 130-CACHE-INVALIDATION-RETHINK.md
    try {
      await updateCacheProcessedStatus(env, messageId, updates.botParams.processed);
    } catch (error) {
      // Non-critical - cache update is best-effort
      console.log('[Comments] Cache update failed (non-critical):', error.message);
    }
    
    return new Response(JSON.stringify(message), {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
    
  } catch (error) {
    console.error('[Comments] Error updating message:', error);
    return new Response(JSON.stringify({ 
      error: 'Failed to update message',
      details: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Update cache with processed status (background, best effort)
 */
async function updateCacheProcessedStatus(env, messageId, processed) {
  const cacheKey = 'recent:comments';
  const cachedData = await env.COMMENTS_KV.get(cacheKey);
  
  if (cachedData) {
    const allComments = JSON.parse(cachedData);
    const messageIndex = allComments.findIndex(m => m.id === messageId);
    
    if (messageIndex !== -1) {
      if (!allComments[messageIndex].botParams) {
        allComments[messageIndex].botParams = {};
      }
      allComments[messageIndex].botParams.processed = processed;
      await env.COMMENTS_KV.put(cacheKey, JSON.stringify(allComments));
      console.log('[Comments] Cache also updated for:', messageId);
    }
  }
}

/**
 * Check rate limit for an IP
 */
async function checkRateLimit(env, ip, request, commentData = null) {
  // Check if IP is in exemption list
  if (EXEMPT_IPS.includes(ip)) {
    console.log(`[Comments] Skipping rate limit for exempt IP: ${ip}`);
    return true;
  }
  
  // Check if request is from an exempt domain (Origin header for browser requests)
  const origin = request?.headers.get('Origin');
  if (origin) {
    const domain = origin.replace(/^https?:\/\//, '').replace(/:[0-9]+$/, '');
    if (EXEMPT_DOMAINS.includes(domain)) {
      console.log(`[Comments] Skipping rate limit for exempt domain (Origin): ${domain}`);
      return true;
    }
  }
  
  // Check if comment domain field is exempt (for bot requests)
  if (commentData?.domain) {
    if (EXEMPT_DOMAINS.includes(commentData.domain)) {
      console.log(`[Comments] Skipping rate limit for exempt domain (payload): ${commentData.domain}`);
      return true;
    }
  }
  
  const key = `rate:${ip}`;
  const current = await env.COMMENTS_KV.get(key);
  
  if (current) {
    const count = parseInt(current);
    if (count >= RATE_LIMIT) {
      console.log(`[Comments] Rate limit hit for ${ip}: ${count}/${RATE_LIMIT}`);
      return false;
    }
    
    // Increment counter
    await env.COMMENTS_KV.put(key, (count + 1).toString(), {
      expirationTtl: RATE_WINDOW
    });
  } else {
    // First request from this IP
    await env.COMMENTS_KV.put(key, '1', {
      expirationTtl: RATE_WINDOW
    });
  }
  
  return true;
}

/**
 * Add a new comment to the cache
 */
async function addToCache(env, comment) {
  const cacheKey = 'recent:comments';
  
  try {
    const cachedData = await env.COMMENTS_KV.get(cacheKey);
    
    let comments = [];
    
    if (cachedData) {
      // Cache exists - use it
      try {
        comments = JSON.parse(cachedData);
      } catch (parseError) {
        console.error('[Comments] Failed to parse cache, rebuilding from KV');
        // Rebuild from KV instead of starting fresh (ensures no messages lost)
        comments = await rebuildCacheFromKV(env);
        // Don't return! Still need to add the NEW comment!
      }
    } else {
      // Cache expired/empty - rebuild from KV keys (never start fresh!)
      console.log('[Cache] Cache empty (TTL expired) - rebuilding from KV');
      comments = await rebuildCacheFromKV(env);
      // Don't return! We need to add the NEW comment too!
    }
    
    // Add new comment to cache (whether existing or just rebuilt)
    comments.push(comment);
    
    // Keep only the most recent comments
    if (comments.length > CACHE_SIZE) {
      comments = comments.slice(-CACHE_SIZE);
    }
    
    // Check size before writing (KV has 25MB limit per value)
    const cacheString = JSON.stringify(comments);
    if (cacheString.length > 20000000) { // 20MB safety limit
      console.warn('[Comments] Cache too large, reducing to last 100 comments');
      comments = comments.slice(-100);
    }
    
    // Update cache with 10-second TTL
    await env.COMMENTS_KV.put(cacheKey, JSON.stringify(comments), {
      expirationTtl: 10
    });
  } catch (error) {
    console.error('[Comments] Failed to update cache:', error);
    // Don't throw - let the comment still be saved to main KV
  }
}

/**
 * Rebuild cache from actual KV keys (when cache expired/empty)
 * This ensures we never "lose" messages between cache expirations
 */
async function rebuildCacheFromKV(env) {
  console.log('[Cache] Rebuilding from KV keys...');
  const messages = [];
  let cursor = null;
  
  // Scan comment:* keys to rebuild cache from source of truth
  do {
    const list = await env.COMMENTS_KV.list({ 
      prefix: 'comment:', 
      cursor,
      limit: 100
    });
    
    // Fetch each key
    for (const key of list.keys) {
      const data = await env.COMMENTS_KV.get(key.name);
      if (data) {
        try {
          messages.push(JSON.parse(data));
        } catch (e) {
          console.error('[Cache] Failed to parse:', key.name);
        }
      }
    }
    
    cursor = list.cursor;
    
    // Stop when we have enough or list is complete
    if (messages.length >= CACHE_SIZE || list.list_complete) {
      break;
    }
  } while (cursor);
  
  // Sort by timestamp (newest first), then keep latest CACHE_SIZE
  messages.sort((a, b) => b.timestamp - a.timestamp);
  const recentMessages = messages.slice(0, CACHE_SIZE);
  
  console.log(`[Cache] Rebuilt with ${recentMessages.length} messages from KV`);
  
  // Save rebuilt cache with TTL
  const cacheKey = 'recent:comments';
  await env.COMMENTS_KV.put(cacheKey, JSON.stringify(recentMessages), {
    expirationTtl: 10  // 10 seconds TTL for rebuilt cache
  });
  
  return recentMessages;
}

/**
 * Update the entire cache
 */
async function updateCache(env, comments) {
  const cacheKey = 'recent:comments';
  
  // Keep only the most recent comments
  const recentComments = comments.slice(-CACHE_SIZE);
  
  // 10-second TTL for auto-expiration
  await env.COMMENTS_KV.put(cacheKey, JSON.stringify(recentComments), {
    expirationTtl: 10
  });
}

/**
 * Generate a unique ID for comments
 */
function generateId() {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 9);
  return `${timestamp}-${random}`;
}

/**
 * Sanitize comment text
 */
function sanitizeText(text) {
  if (!text || typeof text !== 'string') return '';
  
  return text
    .trim()
    .replace(/\s+/g, ' ')
    .substring(0, MAX_COMMENT_LENGTH);
}

/**
 * Sanitize username
 */
function sanitizeUsername(username) {
  if (!username || typeof username !== 'string') return undefined;
  
  const cleaned = username.trim().substring(0, MAX_USERNAME_LENGTH);
  return cleaned.length > 0 ? cleaned : undefined;
}

/**
 * Update message counter (accurate per-message counting)
 */
async function updateMessageCounter(env) {
  try {
    // Read current count
    const currentCountStr = await env.COMMENTS_KV.get('message-count');
    const currentCount = currentCountStr ? parseInt(currentCountStr, 10) : 0;
    
    // Increment and write back
    const newCount = currentCount + 1;
    await env.COMMENTS_KV.put('message-count', newCount.toString());
    
    // Log milestone counts
    if (newCount % 1000 === 0) {
      console.log(`[Stats] Message count milestone: ${newCount.toLocaleString()}`);
    }
  } catch (error) {
    console.error('[Stats] Failed to update message counter:', error);
    // Don't throw - let the message still be posted
  }
}

/**
 * Get statistics including total message count
 */
async function handleGetStats(env) {
  try {
    // Use the same counting method as /api/comments (analytics uses this)
    // Count ACTUAL KV keys to get true total
    let totalMessages = 0;
    let cursor = undefined;
    
    do {
      const list = await env.COMMENTS_KV.list({ prefix: 'comment:', cursor, limit: 1000 });
      totalMessages += list.keys.length;
      cursor = list.cursor;
      
      if (!list.list_complete) {
        // Keep counting if there are more keys
      } else {
        break;
      }
    } while (cursor);
    
    console.log('[Stats] Counted total KV messages:', totalMessages);
    
    return new Response(JSON.stringify({
      totalMessages,
      // Can add more stats here in the future
    }), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=60' // Cache for 1 minute
      }
    });
  } catch (error) {
    console.error('[Stats] Failed to get stats:', error);
    return new Response(JSON.stringify({
      totalMessages: 0,
      error: 'Failed to retrieve stats'
    }), {
      status: 500,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  }
}

/**
 * NEW QUEUE SYSTEM HANDLERS
 * Simple, reliable, KV-based queue with atomic state transitions
 */

/**
 * GET /api/queue/pending
 * Fetch messages with status='pending', sorted by priority (desc) then timestamp (asc)
 */
async function handleGetPending(env, url) {
  try {
    const params = url.searchParams;
    const limit = parseInt(params.get('limit') || '10');
    
    console.log('[Queue] Fetching pending messages from cache, limit:', limit);
    
    // Use cache for speed (has recent 100 messages)
    const cacheKey = 'recent:comments';
    let cachedData = await env.COMMENTS_KV.get(cacheKey);
    
    // If cache empty (TTL expired), rebuild from KV
    if (!cachedData) {
      console.log('[Queue] Cache empty - rebuilding from KV');
      await rebuildCacheFromKV(env);
      cachedData = await env.COMMENTS_KV.get(cacheKey);
    }
    
    let allMessages = [];
    
    if (cachedData) {
      const cached = JSON.parse(cachedData);
      
      // IMPORTANT: Cache may be stale! Verify status from actual KV key
      for (const msg of cached) {
        if (msg.botParams?.entity && msg['message-type'] === 'human') {
          // Try NEW key format first
          let key = `comment:${msg.id}`;
          let actualData = await env.COMMENTS_KV.get(key);
          
          // If not found, try OLD key format (backwards compatibility)
          if (!actualData) {
            const timestamp = msg.id.split('-')[0];
            key = `comment:${timestamp}:${msg.id}`;
            actualData = await env.COMMENTS_KV.get(key);
          }
          
          if (actualData) {
            const actualMsg = JSON.parse(actualData);
            if (actualMsg.botParams?.status === 'pending') {
              allMessages.push(actualMsg); // Use actual data, not cache!
            }
          }
        }
      }
      console.log('[Queue] Scanned cache, verified', allMessages.length, 'actually pending');
    } else {
      console.log('[Queue] Cache empty!');
    }
    
    // Sort by priority (high first), then timestamp (old first)
    allMessages.sort((a, b) => {
      const priorityA = a.botParams.priority || 50;
      const priorityB = b.botParams.priority || 50;
      
      if (priorityA !== priorityB) {
        return priorityB - priorityA; // Higher priority first
      }
      return a.timestamp - b.timestamp; // Older first
    });
    
    // Return top N
    const pending = allMessages.slice(0, limit);
    
    console.log(`[Queue] Found ${allMessages.length} pending, returning top ${pending.length}`);
    
    return new Response(JSON.stringify(pending), {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
    
  } catch (error) {
    console.error('[Queue] Error fetching pending:', error);
    return new Response(JSON.stringify({ error: 'Failed to fetch pending messages' }), {
      status: 500,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  }
}

/**
 * POST /api/queue/claim
 * Atomic claim: status pending → processing (with worker ID and timestamp)
 */
async function handleClaimMessage(request, env) {
  try {
    const body = await request.json();
    const { messageId, workerId } = body;
    
    if (!messageId || !workerId) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'messageId and workerId required' 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    console.log('[Queue] Claim attempt:', messageId, 'by', workerId);
    
    // Get message
    const key = `comment:${messageId}`;
    const data = await env.COMMENTS_KV.get(key);
    
    if (!data) {
      console.log('[Queue] Message not found:', messageId);
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Message not found' 
      }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    const message = JSON.parse(data);
    
    // Check if already claimed/completed
    if (message.botParams?.status !== 'pending') {
      console.log('[Queue] Message not pending:', messageId, 'status:', message.botParams?.status);
      return new Response(JSON.stringify({ 
        success: false, 
        error: `Message status is ${message.botParams?.status}, not pending` 
      }), {
        status: 409, // Conflict
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    // Atomic claim (update status)
    message.botParams.status = 'processing';
    message.botParams.claimedBy = workerId;
    message.botParams.claimedAt = Date.now();
    
    await env.COMMENTS_KV.put(key, JSON.stringify(message));
    
    console.log('[Queue] ✅ Claimed:', messageId, 'by', workerId);
    
    return new Response(JSON.stringify({ 
      success: true, 
      message: message 
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    console.error('[Queue] Claim error:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

/**
 * POST /api/queue/complete
 * Mark message as complete (atomic update)
 */
async function handleCompleteMessage(request, env) {
  try {
    const body = await request.json();
    const { messageId } = body;
    
    if (!messageId) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'messageId required' 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    console.log('[Queue] Completing:', messageId);
    
    const key = `comment:${messageId}`;
    const data = await env.COMMENTS_KV.get(key);
    
    if (!data) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Message not found' 
      }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    const message = JSON.parse(data);
    message.botParams.status = 'complete';
    message.botParams.processed = true; // Backwards compatibility
    
    await env.COMMENTS_KV.put(key, JSON.stringify(message));
    
    console.log('[Queue] ✅ Completed:', messageId, '(status=complete, processed=true)');
    
    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    console.error('[Queue] Complete error:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

/**
 * POST /api/queue/fail
 * Handle failure: increment attempts, return to pending or mark failed
 */
async function handleFailMessage(request, env) {
  try {
    const body = await request.json();
    const { messageId, error } = body;
    
    if (!messageId) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'messageId required' 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    console.log('[Queue] Failing:', messageId, 'reason:', error);
    
    const key = `comment:${messageId}`;
    const data = await env.COMMENTS_KV.get(key);
    
    if (!data) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Message not found' 
      }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    const message = JSON.parse(data);
    message.botParams.attempts = (message.botParams.attempts || 0) + 1;
    
    const MAX_RETRIES = 3;
    
    if (message.botParams.attempts >= MAX_RETRIES) {
      // Give up - mark as failed
      message.botParams.status = 'failed';
      console.log('[Queue] ❌ Max retries reached, marked failed:', messageId);
    } else {
      // Retry - return to pending
      message.botParams.status = 'pending';
      message.botParams.claimedBy = null;
      message.botParams.claimedAt = null;
      console.log('[Queue] ⚠️  Retry:', messageId, `attempt ${message.botParams.attempts}/${MAX_RETRIES}`);
    }
    
    await env.COMMENTS_KV.put(key, JSON.stringify(message));
    
    return new Response(JSON.stringify({ 
      success: true,
      status: message.botParams.status,
      attempts: message.botParams.attempts
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    console.error('[Queue] Fail handler error:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}
