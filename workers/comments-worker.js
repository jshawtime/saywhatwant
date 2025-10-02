/**
 * Say What Want Comments Worker
 * A Cloudflare Worker for handling anonymous comments
 * Following SoundTrip engineering philosophy: Simple, Strong, Solid
 */

// CORS Configuration
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
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
];

const EXEMPT_DOMAINS = [
  'ai.saywhatwant.app',  // AI bot domain
];
const MAX_COMMENT_LENGTH = 1000;
const MAX_USERNAME_LENGTH = 16;  // Match frontend limit
const CACHE_SIZE = 500;       // Keep last 500 comments in cache (reduced from 5000 to avoid KV size limits)

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
    
    // Stats endpoint
    if (path === '/api/stats') {
      return await handleGetStats(env);
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
    
    try {
      // Get from cache first
      const cacheKey = 'recent:comments';
      const cachedData = await env.COMMENTS_KV.get(cacheKey);
      
      let newMessages = [];
      
      if (cachedData) {
        const allComments = JSON.parse(cachedData);
        // Filter only messages after the timestamp
        newMessages = allComments
          .filter(c => c.timestamp > afterTimestamp)
          .sort((a, b) => b.timestamp - a.timestamp) // Newest first
          .slice(0, limit);
        
        console.log(`[Comments] Cursor polling: ${newMessages.length} new messages after ${afterTimestamp}`);
      }
      
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

    // Check rate limit (pass request for domain checking)
    const canPost = await checkRateLimit(env, ip, request);
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

    // Parse request body
    const body = await request.json();
    const text = sanitizeText(body.text);
    const username = sanitizeUsername(body.username);
    const color = body.color || generateRandomRGB(); // Generate random color if not provided
    const domain = body.domain || request.headers.get('Origin')?.replace(/^https?:\/\//, '') || 'unknown';
    const language = body.language || 'en'; // Default to English
    const messageType = body['message-type'] || 'human'; // Default to human if not specified
    const misc = body.misc || ''; // Optional misc field

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
      misc: misc  // Store misc data
      // Removed userAgent - not needed
    };

    // Store in KV
    const key = `comment:${comment.timestamp}:${comment.id}`;
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
 * Check rate limit for an IP
 */
async function checkRateLimit(env, ip, request) {
  // Check if IP is in exemption list
  if (EXEMPT_IPS.includes(ip)) {
    console.log(`[Comments] Skipping rate limit for exempt IP: ${ip}`);
    return true;
  }
  
  // Check if request is from an exempt domain
  const origin = request?.headers.get('Origin');
  if (origin) {
    const domain = origin.replace(/^https?:\/\//, '').replace(/:[0-9]+$/, '');
    if (EXEMPT_DOMAINS.includes(domain)) {
      console.log(`[Comments] Skipping rate limit for exempt domain: ${domain}`);
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
      try {
        comments = JSON.parse(cachedData);
      } catch (parseError) {
        console.error('[Comments] Failed to parse cache, resetting:', parseError);
        comments = []; // Reset if corrupt
      }
    }
    
    // Add new comment
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
    
    // Update cache
    await env.COMMENTS_KV.put(cacheKey, JSON.stringify(comments));
  } catch (error) {
    console.error('[Comments] Failed to update cache:', error);
    // Try to at least save the new comment
    try {
      await env.COMMENTS_KV.put(cacheKey, JSON.stringify([comment]));
    } catch (fallbackError) {
      console.error('[Comments] Failed to save even single comment:', fallbackError);
      // Don't throw - let the comment still be saved to main KV
    }
  }
}

/**
 * Update the entire cache
 */
async function updateCache(env, comments) {
  const cacheKey = 'recent:comments';
  
  // Keep only the most recent comments
  const recentComments = comments.slice(-CACHE_SIZE);
  
  await env.COMMENTS_KV.put(cacheKey, JSON.stringify(recentComments));
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
