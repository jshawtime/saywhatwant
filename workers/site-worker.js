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
  
  // Options for serving static assets
  const options = {
    cacheControl: {
      browserTTL: 60 * 60 * 24, // 1 day
      edgeTTL: 60 * 60 * 24 * 365, // 1 year
      bypassCache: false,
    },
  };

  try {
    // Serve static assets from KV
    const response = await getAssetFromKV(event, options);
    
    // Add CORS headers for API calls
    const headers = new Headers(response.headers);
    headers.set('Access-Control-Allow-Origin', '*');
    headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    headers.set('Access-Control-Allow-Headers', 'Content-Type');
    
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: headers,
    });
  } catch (e) {
    // For 404s, try to serve index.html (for client-side routing)
    if (e.status === 404) {
      try {
        const indexResponse = await getAssetFromKV(event, {
          mapRequestToAsset: () => new Request(`${url.origin}/index.html`, event.request),
        });
        
        return new Response(indexResponse.body, {
          status: 200,
          statusText: 'OK',
          headers: indexResponse.headers,
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
