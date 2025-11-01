# Git-Based Deployment Guide (Cloudflare Pages)

## 🎯 How Your Deployment Works

You're using **Cloudflare Pages with GitHub integration**:

1. **Push to GitHub main branch**
2. **Cloudflare auto-detects push**
3. **Cloudflare runs build** (`npm run build`)
4. **New version deploys automatically**
5. **Users get latest version** (no hard refresh needed!)

---

## ✅ The Fix We Applied

### Problem:
- HTML files were cached in browsers for 24 hours
- Users saw old build numbers even after new deployments
- Hard refresh required on every tab

### Solution (3 Parts):

#### 1. **`public/_headers` File** ✅
Cloudflare Pages reads this file and applies cache rules:
- **HTML**: NO browser cache (`no-cache, no-store, must-revalidate`)
- **JS/CSS with hashes**: 1 year cache (immutable)
- **Other assets**: 1 week cache

#### 2. **Version Check Script** ✅
`public/version-check.js` monitors for new builds:
- Checks every 5 minutes
- Shows green notification when new version detected
- Users can click "Reload Now" or dismiss

#### 3. **Build Timestamp** ✅
`app/layout.tsx` includes build time in meta tag:
- Set by `NEXT_PUBLIC_BUILD_TIME` during build
- Displayed in EmptyState component
- Used by version-check script

---

## 🚀 Deployment Workflow

### Option 1: Automated Script (Recommended)

```bash
cd /Volumes/BOWIE/devrepo/SAYWHATWANTv1/saywhatwant
./scripts/deploy-with-cache-bust.sh
```

This script will:
1. Check git status
2. Commit changes (with your message or auto-generated)
3. Push to GitHub
4. Show deployment status instructions

### Option 2: Manual Commands

```bash
# 1. Commit your changes
git add -A
git commit -m "Your commit message"

# 2. Push to main (triggers auto-deployment)
git push origin main

# 3. Monitor deployment
# Go to: https://dash.cloudflare.com/
# Navigate to: Workers & Pages → say-what-want
# Watch build logs
```

---

## 📊 Cloudflare Pages Build Configuration

Verify these settings in Cloudflare Dashboard:

```
Project name: say-what-want
Production branch: main
Framework preset: Next.js (Static HTML Export)
Build command: npm run build
Build output directory: out
Root directory: /
Node.js version: 18
```

### Environment Variables (if needed):
```
NEXT_PUBLIC_BUILD_TIME: (Auto-generated during build)
COMMENTS_WORKER_URL: https://sww-comments.workers.dev
R2_BUCKET_URL: (Your R2 bucket URL)
```

---

## 🧪 Testing After Deployment

### Test 1: Verify Build Completed
```bash
# Check Cloudflare Dashboard
# Should show green checkmark and build time
```

### Test 2: Verify Cache Headers
```bash
# Run our test script
cd /Volumes/BOWIE/devrepo/SAYWHATWANTv1/saywhatwant
./scripts/test-cache-headers.sh
```

Expected results:
- ✅ HTML has `Cache-Control: no-cache`
- ✅ JS files accessible
- ✅ Build timestamp visible

### Test 3: Multi-Tab Test
```bash
1. Open 29 tabs with different model URLs
2. Check build number in each
3. Should all show SAME (latest) build
4. NO hard refresh needed! 🎉
```

### Test 4: Version Check Script
```bash
# In browser console
1. Open DevTools → Console
2. Look for: "[Version Check] Initialized with build: ..."
3. After 30 seconds: "[Version Check] Current build: ..."
4. After new deployment: "[Version Check] New build detected!"
```

---

## 🔧 Troubleshooting

### Issue: Old version still showing

**Check 1: Deployment completed?**
```bash
# Cloudflare Dashboard → Workers & Pages → say-what-want
# Look for green checkmark, not yellow "building" indicator
```

**Check 2: _headers file deployed?**
```bash
# Check build logs in Cloudflare Dashboard
# Should see: "Processing _headers file"
```

**Check 3: Cache headers correct?**
```bash
# Run test script
./scripts/test-cache-headers.sh

# Or manually check
curl -I https://saywhatwant.app/ | grep -i cache-control
# Should show: Cache-Control: no-cache, no-store, must-revalidate
```

**Check 4: Purge Cloudflare cache**
```bash
# Dashboard: saywhatwant.app → Caching → Purge Everything
# This clears the edge cache (5-minute TTL)
```

**Check 5: Clear browser cache**
```bash
# Cmd+Shift+Delete (Mac)
# Ctrl+Shift+Delete (Windows)
# Select "Cached images and files"
```

**Check 6: Hard refresh**
```bash
# Cmd+Shift+R (Mac)
# Ctrl+Shift+R (Windows)
# This should now be a ONE-TIME thing, not every tab!
```

### Issue: Build failing

**Check build logs:**
```bash
# Cloudflare Dashboard → Workers & Pages → say-what-want → Builds
# Click on failed build to see error
```

**Common issues:**
- `npm install` failed → Check package.json
- Build command failed → Check next.config.js syntax
- Out of memory → Simplify build or upgrade plan
- Missing env vars → Check dashboard settings

### Issue: _headers not working

**Verify file location:**
```bash
# Should be at: /Volumes/BOWIE/devrepo/SAYWHATWANTv1/saywhatwant/public/_headers
ls -la /Volumes/BOWIE/devrepo/SAYWHATWANTv1/saywhatwant/public/_headers
```

**Verify syntax:**
```bash
# Check for typos in _headers file
# Each path pattern should be on its own line
# Headers should be indented (2 spaces)
```

**Verify deployment:**
```bash
# In Cloudflare build logs, search for: "_headers"
# Should see: "Processing _headers file"
```

### Issue: Version check not working

**Check script loaded:**
```bash
# DevTools → Network → version-check.js
# Should return 200 OK
```

**Check console for errors:**
```bash
# DevTools → Console
# Look for "[Version Check]" messages
# If none, script didn't load or crashed
```

**Check build timestamp visible:**
```bash
# Visit: https://saywhatwant.app/#...
# Scroll to empty state
# Should see: "Build: 2025-..."
```

---

## 📈 Performance & Caching Strategy

### HTML Files (index.html, *.html)
```
Browser Cache: 0 seconds (always fresh)
Edge Cache: 5 minutes (for performance)
Result: Users get new builds within 5 minutes
```

### Next.js Static Assets (_next/static/*)
```
Browser Cache: 1 year (immutable)
Edge Cache: 1 year
Result: Perfect caching (hashed filenames)
```

### JavaScript & CSS (*.js, *.css)
```
Browser Cache: 1 week
Edge Cache: 1 week
Result: Good balance for non-hashed files
```

### Images & Fonts
```
Browser Cache: 1 month (images), 1 year (fonts)
Edge Cache: Same
Result: Efficient for rarely-changing assets
```

---

## 🎯 Success Criteria

After deploying this fix, you should achieve:

✅ **No hard refresh needed** for normal visits
✅ **Consistent build numbers** across all tabs
✅ **New builds visible** within 5 minutes
✅ **User notifications** when updates available
✅ **Fast performance** (static assets still cached)
✅ **Multi-tab stress test** works perfectly

---

## 💡 Pro Tips

### Tip 1: Preview Deployments
```bash
# Push to feature branch
git checkout -b feature/my-feature
git push origin feature/my-feature

# Cloudflare creates preview deployment
# URL: https://[commit-hash].say-what-want.pages.dev
# Test before merging to main!
```

### Tip 2: Rollback
```bash
# If new deployment breaks something
# Go to Cloudflare Dashboard → Deployments
# Click "Rollback" on previous working version
# Or: git revert and push
```

### Tip 3: Monitoring
```bash
# Set up Cloudflare notifications
# Dashboard → Notifications → Add Webhook
# Get alerts for build failures
```

### Tip 4: Build Time Optimization
```bash
# Cache node_modules between builds
# In Cloudflare Pages settings → Builds & deployments
# Enable "Preserve build cache"
```

### Tip 5: Custom Domains
```bash
# Already configured: saywhatwant.app
# To add more domains:
# Dashboard → Workers & Pages → say-what-want → Custom domains
```

---

## 🔄 Complete Deployment Checklist

- [ ] Code changes committed
- [ ] Pushed to main branch
- [ ] Cloudflare build started (check dashboard)
- [ ] Build succeeded (green checkmark)
- [ ] Test cache headers (run test script)
- [ ] Test with fresh browser tab
- [ ] Test with multiple tabs
- [ ] Verify build timestamp updated
- [ ] Check version-check script in console
- [ ] (Optional) Purge Cloudflare cache if needed
- [ ] Monitor for user issues

---

## 📚 Additional Resources

- [Cloudflare Pages Docs](https://developers.cloudflare.com/pages/)
- [_headers File Reference](https://developers.cloudflare.com/pages/platform/headers/)
- [Next.js Static Export](https://nextjs.org/docs/advanced-features/static-html-export)
- [Cache-Control Headers](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Cache-Control)

---

## 🎊 You're All Set!

Your deployment is now optimized for instant updates. Push to main, wait ~2 minutes, and users get the latest version automatically!

**No more 29-tab hard-refresh stress tests! 🚀**

