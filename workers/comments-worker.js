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
const MAX_COMMENT_LENGTH = 1000;
const MAX_USERNAME_LENGTH = 12;
const CACHE_SIZE = 5000;      // Keep last 5000 comments in cache

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
  const limit = Math.min(parseInt(params.get('limit') || '500'), 1000);
  const search = params.get('search')?.toLowerCase();

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

    // Apply pagination
    const start = Math.max(0, comments.length - offset - limit);
    const end = comments.length - offset;
    const paginatedComments = comments.slice(start, end);

    const response = {
      comments: paginatedComments,
      total: comments.length,
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
 * Handle POST /api/comments
 * Create a new comment
 */
async function handlePostComment(request, env) {
  try {
    // Get client IP for rate limiting
    const ip = request.headers.get('CF-Connecting-IP') || 
               request.headers.get('X-Forwarded-For') || 
               'unknown';

    // Check rate limit
    const canPost = await checkRateLimit(env, ip);
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
    const color = body.color || '#60A5FA'; // Default to blue if not provided

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

    // Create comment object
    const comment = {
      id: generateId(),
      text: text,
      timestamp: Date.now(),
      username: username,
      color: color,  // Include the color field
      userAgent: request.headers.get('User-Agent')?.substring(0, 100) || 'unknown'
    };

    // Store in KV
    const key = `comment:${comment.timestamp}:${comment.id}`;
    await env.COMMENTS_KV.put(key, JSON.stringify(comment));

    // Update recent comments cache
    await addToCache(env, comment);

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
    return new Response(JSON.stringify({ 
      error: 'Failed to post comment' 
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
async function checkRateLimit(env, ip) {
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
  const cachedData = await env.COMMENTS_KV.get(cacheKey);
  
  let comments = [];
  if (cachedData) {
    comments = JSON.parse(cachedData);
  }
  
  // Add new comment
  comments.push(comment);
  
  // Keep only the most recent comments
  if (comments.length > CACHE_SIZE) {
    comments = comments.slice(-CACHE_SIZE);
  }
  
  // Update cache
  await env.COMMENTS_KV.put(cacheKey, JSON.stringify(comments));
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
