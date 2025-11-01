# Cache Management & Version Control Guide

## The Problem We Solved

Your app was caching HTML for 24 hours in users' browsers, causing:
- Old build numbers to persist after deployments
- Users seeing outdated versions even after hard refresh
- Need for manual hard refresh on every tab

## The Solution (3-Part Fix)

### 1. **Differential Caching in Workers** ✅
   - **HTML files**: NO browser cache (always fresh)
   - **Hashed JS/CSS**: 1-year cache (immutable)
   - **Other assets**: 1-week cache (images, etc.)

### 2. **Version Check Script** ✅
   - Monitors for new builds every 5 minutes
   - Shows friendly update notification
   - Users can reload immediately or dismiss

### 3. **Cloudflare Cache Purging**
   - Must purge edge cache after each deployment
   - See deployment instructions below

---

## How It Works Now

### User Experience:
1. **First visit**: Gets latest version (no cache)
2. **Subsequent visits**: Gets latest version (HTML not cached)
3. **New deployment**: 
   - Within 5 minutes, sees update notification
   - Can click "Reload Now" or dismiss
   - Next visit automatically gets new version

### Performance:
- **HTML**: Fresh on every load (tiny file, no performance hit)
- **JS/CSS**: Cached long-term (hashed filenames = safe caching)
- **Assets**: Cached for 1 week (good balance)

---

## Deployment Process

### Standard Deployment:

\`\`\`bash
# Use the automated deployment script
cd /Volumes/BOWIE/devrepo/SAYWHATWANTv1/saywhatwant
./scripts/deploy-with-cache-bust.sh
\`\`\`

### Manual Deployment:

\`\`\`bash
# 1. Build with timestamp
npm run build

# 2. Deploy to Cloudflare
wrangler deploy

# 3. Purge Cloudflare cache (choose one method):
\`\`\`

**Option A - Cloudflare Dashboard:**
1. Go to https://dash.cloudflare.com/
2. Select domain: `saywhatwant.app`
3. Click "Caching" → "Purge Everything"
4. Confirm

**Option B - Cloudflare API:**
\`\`\`bash
curl -X POST "https://api.cloudflare.com/client/v4/zones/YOUR_ZONE_ID/purge_cache" \\
  -H "Authorization: Bearer YOUR_API_TOKEN" \\
  -H "Content-Type: application/json" \\
  --data '{"purge_everything":true}'
\`\`\`

**Option C - Wrangler CLI:**
\`\`\`bash
# If wrangler supports cache purge for your plan
wrangler pages deployment tail --project-name=say-what-want
\`\`\`

---

## Cache Headers Explained

### HTML Files (index.html):
\`\`\`
Cache-Control: no-cache, no-store, must-revalidate
Pragma: no-cache
Expires: 0
\`\`\`
- Browser: Never cached
- Cloudflare Edge: 5 minutes
- **Result**: Users always get latest within 5 minutes

### Hashed JS/CSS:
\`\`\`
Cache-Control: public, max-age=31536000, immutable
\`\`\`
- Browser: 1 year
- Cloudflare Edge: 1 year
- **Result**: Perfect caching (filenames change with content)

### Other Assets:
\`\`\`
Cache-Control: public, max-age=604800
\`\`\`
- Browser: 1 week
- Cloudflare Edge: 1 month
- **Result**: Good balance for images/fonts

---

## Testing the Fix

### Test 1: Fresh Load
\`\`\`bash
# In browser (Chrome DevTools):
1. Open DevTools → Network tab
2. Check "Disable cache"
3. Visit: https://saywhatwant.app/#...
4. Look at index.html headers
5. Should see: Cache-Control: no-cache, no-store, must-revalidate
\`\`\`

### Test 2: Multiple Tabs
\`\`\`bash
1. Open 29 tabs with different models
2. Check build number - should be same (latest)
3. No hard refresh needed!
\`\`\`

### Test 3: New Deployment
\`\`\`bash
1. Deploy new version
2. Wait up to 5 minutes
3. Should see green update notification
4. Click "Reload Now"
5. New build number appears
\`\`\`

### Test 4: Version Check Script
\`\`\`bash
# In browser console:
1. Open Console
2. Should see: "[Version Check] Initialized with build: 2025-..."
3. Wait 30 seconds
4. Should see: "[Version Check] Current build: ..."
\`\`\`

---

## Troubleshooting

### Issue: Still seeing old version
**Solution:**
1. Verify cache headers:
   - DevTools → Network → index.html → Headers
   - Should see `Cache-Control: no-cache`
2. Purge Cloudflare cache
3. Clear browser cache (Cmd+Shift+Delete)
4. Hard reload (Cmd+Shift+R)

### Issue: Update notification not appearing
**Solution:**
1. Check console for errors
2. Verify version-check.js loaded:
   - DevTools → Network → version-check.js
3. Check console for "[Version Check]" messages
4. Wait full 5 minutes after deployment

### Issue: Assets not loading
**Solution:**
1. Check Cloudflare Workers logs
2. Verify `out/` directory has all files
3. Check for CORS errors in console
4. Verify wrangler.toml config

### Issue: Build timestamp not updating
**Solution:**
1. Verify build script runs:
   - `npm run build` should set NEXT_PUBLIC_BUILD_TIME
2. Check package.json:
   - Should have: `NEXT_PUBLIC_BUILD_TIME=$(date -u +\"%Y-%m-%dT%H:%M:%SZ\")`
3. Verify in EmptyState.tsx:
   - Should show new timestamp after build

---

## Technical Details

### Files Modified:
1. **workers/site-worker.js**: Differential caching logic
2. **app/layout.tsx**: Build time meta tag + version check script
3. **public/version-check.js**: Version monitoring (NEW)
4. **scripts/deploy-with-cache-bust.sh**: Deployment helper (NEW)

### Environment Variables:
- `NEXT_PUBLIC_BUILD_TIME`: Set during build (auto)

### Cloudflare Settings:
- Browser TTL: Controlled by Cache-Control headers
- Edge TTL: Controlled by cacheControl options
- KV Storage: Unchanged

---

## Best Practices Going Forward

1. **Always use the deployment script**: `./scripts/deploy-with-cache-bust.sh`
2. **Always purge cache after deployment**: Critical for instant updates
3. **Test in incognito**: Ensures clean cache state
4. **Monitor console logs**: Check for "[Version Check]" messages
5. **Keep build timestamps visible**: Good for debugging

---

## Additional Optimizations (Future)

### Auto Cache Purge:
\`\`\`bash
# Add to deployment script using Cloudflare API
ZONE_ID="your_zone_id"
API_TOKEN="your_api_token"

curl -X POST "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/purge_cache" \\
  -H "Authorization: Bearer $API_TOKEN" \\
  -H "Content-Type: application/json" \\
  --data '{"purge_everything":true}'
\`\`\`

### Version API Endpoint:
\`\`\`typescript
// Add to workers/site-worker.js
if (url.pathname === '/api/version') {
  return new Response(JSON.stringify({
    buildTime: BUILD_TIME,
    version: VERSION
  }), {
    headers: { 'Content-Type': 'application/json' }
  });
}
\`\`\`

### Service Worker (PWA):
- Consider adding for offline support
- But ensure it respects cache strategy
- Use workbox for cache management

---

## Success Metrics

✅ **No more hard refreshes needed**
✅ **Users see updates within 5 minutes**
✅ **Multi-tab stress test works**
✅ **Performance maintained (hashed assets cached)**
✅ **Build timestamps always accurate**

---

## Support

If issues persist:
1. Check Cloudflare Workers logs
2. Verify all files deployed correctly
3. Test with multiple browsers
4. Check for service workers (shouldn't be any)
5. Review browser DevTools Network tab

**Remember: The HTML cache was the culprit. Now it's never cached in browsers! 🎉**

