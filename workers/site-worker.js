/**
 * Say What Want - Site Worker
 * Serves the static Next.js build from Workers Sites
 */

import { getAssetFromKV } from '@cloudflare/kv-asset-handler';

addEventListener('fetch', event => {
  event.respondWith(handleRequest(event));
});

async function handleRequest(event) {
  const url = new URL(event.request.url);
  const pathname = url.pathname;
  
  // Determine cache strategy based on file type
  let cacheControl;
  
  // HTML files: NO browser cache (always get latest)
  // This ensures users always see new builds
  if (pathname === '/' || pathname.endsWith('.html')) {
    cacheControl = {
      browserTTL: 0, // No browser cache for HTML
      edgeTTL: 60 * 5, // 5 minutes edge cache (for performance)
      bypassCache: false,
    };
  }
  // Hashed JS/CSS files (e.g., app-[hash].js): Long cache (immutable)
  else if (pathname.match(/\/_next\/static\/.+\.(js|css)$/) || 
           pathname.match(/\.(js|css)$/) && pathname.includes('-')) {
    cacheControl = {
      browserTTL: 60 * 60 * 24 * 365, // 1 year (immutable assets)
      edgeTTL: 60 * 60 * 24 * 365,
      bypassCache: false,
    };
  }
  // Other static assets (images, fonts, etc.): Moderate cache
  else {
    cacheControl = {
      browserTTL: 60 * 60 * 24 * 7, // 1 week
      edgeTTL: 60 * 60 * 24 * 30, // 1 month
      bypassCache: false,
    };
  }
  
  const options = {
    cacheControl: cacheControl,
  };

  try {
    // Serve static assets from KV
    const response = await getAssetFromKV(event, options);
    
    // Add CORS headers for API calls
    const headers = new Headers(response.headers);
    headers.set('Access-Control-Allow-Origin', '*');
    headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    headers.set('Access-Control-Allow-Headers', 'Content-Type');
    
    // Override Cache-Control for HTML to ensure no browser caching
    if (pathname === '/' || pathname.endsWith('.html')) {
      headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');
      headers.set('Pragma', 'no-cache');
      headers.set('Expires', '0');
    }
    
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: headers,
    });
  } catch (e) {
    // For 404s, try to serve index.html (for client-side routing)
    if (e.status === 404) {
      try {
        // Use no-cache options for index.html
        const indexOptions = {
          mapRequestToAsset: () => new Request(`${url.origin}/index.html`, event.request),
          cacheControl: {
            browserTTL: 0,
            edgeTTL: 60 * 5,
            bypassCache: false,
          },
        };
        
        const indexResponse = await getAssetFromKV(event, indexOptions);
        
        // Add no-cache headers
        const headers = new Headers(indexResponse.headers);
        headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');
        headers.set('Pragma', 'no-cache');
        headers.set('Expires', '0');
        
        return new Response(indexResponse.body, {
          status: 200,
          statusText: 'OK',
          headers: headers,
        });
      } catch {
        // If index.html doesn't exist either, return 404
        return new Response('Not found', { status: 404 });
      }
    }
    
    // Return the error for other cases
    return new Response(e.message || e.toString(), { status: e.status || 500 });
  }
}
