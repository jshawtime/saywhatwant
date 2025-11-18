# 00-QUICK-START-FOR-AGENT.md

## Deployment Workflow

### Standard Deployment Process

**Our Setup**: Cloudflare Pages + GitHub Auto-Deploy

**Workflow**:
- Make changes locally in `/Volumes/BOWIE/devrepo/SAYWHATWANTv1/saywhatwant`
- Commit changes to git
- Push to `main` branch
- Cloudflare Pages auto-detects push and deploys
- Wait ~2 minutes for build to complete
- New version live at https://saywhatwant.app/

### Pre-Deployment: Check for Build Errors

**ALWAYS test build locally before deploying!**

```bash
cd /Volumes/BOWIE/devrepo/SAYWHATWANTv1/saywhatwant

# 1. Build locally to catch errors
npm run build

# 2. Check for TypeScript/lint errors
npm run lint

# 3. If build succeeds, check the output
ls -la out/  # Should see index.html and other files

# 4. Verify build timestamp was set
grep -r "Build:" out/index.html
# Should show: Build: 2025-...-...Z
```

**If build fails:**
- Read error messages carefully
- Check for TypeScript errors
- Check for missing dependencies
- Fix errors before deploying
- Run `npm run build` again until it succeeds

**If build succeeds:**
- ✅ Proceed to deployment
- ✅ out/ directory populated
- ✅ No error messages
- ✅ Build timestamp present

### Quick Deploy Commands

```bash
cd /Volumes/BOWIE/devrepo/SAYWHATWANTv1/saywhatwant

# Option 1: Use automated script (recommended)
./scripts/deploy-with-cache-bust.sh

# Option 2: Manual commands
git add -A
git commit -m "Your commit message"
git push origin main
```

### Monitor Deployment

**Cloudflare Dashboard**: https://dash.cloudflare.com/
- Navigate: Workers & Pages → say-what-want
- Check: Build status (green checkmark = success)
- View: Build logs for debugging

### Key Project Paths

**Main App**: `/Volumes/BOWIE/devrepo/SAYWHATWANTv1/saywhatwant`
- `app/` - Next.js app pages and layout
- `components/` - React components
- `public/` - Static assets (including `_headers` for cache control)
- `scripts/` - Deployment and utility scripts
- `workers/` - Cloudflare Workers (comments API)

**Server Deployment**: `/Volumes/BOWIE/devrepo/SAYWHATWANTv1/hm-server-deployment`
- `AI-Bot-Deploy/` - AI bot queue processor (runs on 10.0.0.100)
- `ollama-HM/` - Ollama model server setup
- `Queue-Monitor-Deploy/` - Queue dashboard

### Important Files

**Cache Control** (see README 165):
- `public/_headers` - Cloudflare Pages cache headers (CRITICAL - keeps HTML fresh)
- `public/version-check.js` - Auto-detects new builds for users
- `app/layout.tsx` - Includes build timestamp metadata

**Configuration**:
- `next.config.js` - Next.js build config
- `package.json` - Build scripts (includes `NEXT_PUBLIC_BUILD_TIME` injection)
- `wrangler.toml` - Cloudflare config (not used for Pages auto-deploy, but kept)

### Build Process (Automatic on Push)

1. **GitHub receives push** to main branch
2. **Cloudflare Pages detects** change via webhook
3. **Build runs**: `npm install && npm run build`
   - Sets `NEXT_PUBLIC_BUILD_TIME` environment variable
   - Generates static export in `out/` directory
   - Processes `public/_headers` file for cache control
4. **Deployment**: Distributes to Cloudflare edge network
5. **Live**: Users get new version immediately (no cache issues!)

### Testing After Deployment

```bash
# Test cache headers are correct
./scripts/test-cache-headers.sh

# Manual curl test
curl -I https://saywhatwant.app/ | grep -i cache-control
# Should show: Cache-Control: no-cache, no-store, must-revalidate

# Browser test
# Visit https://saywhatwant.app/#... (any entity URL)
# Check build timestamp in empty state
# Should show latest build time
```

### Critical Cache Fix (README 165)

**Problem Solved**: HTML was cached for 24 hours, users stuck on old builds
**Solution**: `public/_headers` file prevents HTML caching
**Result**: Users always get latest version, no hard refresh needed

### Common Tasks

**Deploy New Changes**:
```bash
./scripts/deploy-with-cache-bust.sh
```

**Check Deployment Status**:
- Dashboard: https://dash.cloudflare.com/
- Look for green checkmark on latest build

**Purge Cache (if needed)**:
- Dashboard → saywhatwant.app → Caching → Purge Everything
- Only needed if old version persists after deployment

**View Build Logs**:
- Dashboard → Workers & Pages → say-what-want → Builds
- Click on build to see full logs

**Test Multi-Tab**:
- Open multiple tabs with different entity URLs
- All should show same (latest) build number
- No hard refresh should be needed

### Environment Variables (Cloudflare)

Set in Dashboard → Workers & Pages → say-what-want → Settings:
- `NEXT_PUBLIC_BUILD_TIME` - Auto-generated during build (don't set manually)
- `COMMENTS_WORKER_URL` - https://sww-comments.workers.dev
- `R2_BUCKET_URL` - (Your R2 bucket URL for videos)

### Related Systems

**AI Bot Server** (10.0.0.100):
- Processes queue requests from Cloudflare KV
- Runs via PM2: `pm2 list`, `pm2 logs`, `pm2 restart all`
- Config: `/Volumes/BOWIE/devrepo/SAYWHATWANTv1/hm-server-deployment/AI-Bot-Deploy/config-aientities.json`

**Comments Worker**:
- Separate Cloudflare Worker for comments API
- Deploy: `cd workers && wrangler deploy`
- URL: https://sww-comments.workers.dev

**Queue Monitor Dashboard**:
- Real-time queue monitoring
- Deploy: `cd hm-server-deployment/Queue-Monitor-Deploy && ./rebuild-and-restart.sh`
- Runs on 10.0.0.100 with PM2

### Troubleshooting

**Build Failed**:
- Check Cloudflare build logs
- Common issues: syntax errors, missing dependencies, memory limits

**Old Version Showing**:
- Wait full 2 minutes after deployment
- Check cache headers with curl
- Purge Cloudflare cache if needed
- Hard refresh browser (Cmd+Shift+R) as last resort

**Version Check Not Working**:
- Verify `public/version-check.js` exists
- Check browser console for "[Version Check]" messages
- Ensure build timestamp visible in UI

### Documentation

**Key READMEs**:
- `165-CLOUDFLARE-PAGES-CACHE-FIX.md` - Cache control solution (IMPORTANT!)
- `GIT-DEPLOYMENT-GUIDE.md` - Detailed deployment guide
- `CACHE-FIX-DEPLOY-NOW.md` - Quick reference
- `00-SWW-ARCHITECTURE.md` - System architecture
- `000-READMES-SUMMARIES-ALL.md` - All README summaries

**Helpful Guides**:
- `10.0.0.100-OPERATIONS-GUIDE.md` - Server operations
- `112-PM2-COMMANDS.md` - PM2 management
- `00-SYSTEM-URLS.md` - All system URLs

### Quick Reference URLs

**Production**:
- Main App: https://saywhatwant.app/
- Comments API: https://sww-comments.workers.dev

**Development Server (10.0.0.100)**:
- Queue Monitor: http://10.0.0.100:5174/
- Ollama Server: http://10.0.0.100:11434/

**Dashboards**:
- Cloudflare: https://dash.cloudflare.com/
- GitHub: https://github.com/[your-repo]/saywhatwant

### Agent Handoff Tips

**For Next Agent**:
- Read this file first for deployment workflow
- Check `165-CLOUDFLARE-PAGES-CACHE-FIX.md` for cache architecture
- Review `000-READMES-SUMMARIES-ALL.md` for context on all previous work
- Test deployment workflow before making changes
- Always verify cache headers after deployment
- Monitor Cloudflare build logs for issues

**Current State** (as of README 165):
- ✅ Cache fix implemented (`public/_headers`)
- ✅ Version check system active (`public/version-check.js`)
- ✅ Build timestamps working
- ✅ Git auto-deploy to Cloudflare Pages working
- ✅ Multi-tab stress test passing
- ✅ No hard refresh required for users

### Success Indicators

**Deployment Working**:
- Green checkmark in Cloudflare Dashboard
- Build logs show "Processing _headers file"
- Latest build timestamp visible at https://saywhatwant.app/
- No errors in browser console

**Cache Fix Working**:
- `curl -I https://saywhatwant.app/` shows `Cache-Control: no-cache`
- Multiple tabs show same latest build
- No hard refresh needed
- Version check script logs in console

**System Healthy**:
- PM2 processes running on 10.0.0.100
- Queue monitor accessible
- Comments API responding
- No 404s or 500s in logs

---

## TL;DR

1. **Make changes** in `/Volumes/BOWIE/devrepo/SAYWHATWANTv1/saywhatwant`
2. **Test build**: `npm run build` (MUST succeed before deploying!)
3. **Check for errors**: `npm run lint` (fix any issues)
4. **Deploy**: `./scripts/deploy-with-cache-bust.sh`
5. **Wait**: ~2 minutes for Cloudflare build
6. **Verify**: Visit https://saywhatwant.app/ (no hard refresh needed!)
7. **Monitor**: https://dash.cloudflare.com/ for build status

**Critical**: 
- ALWAYS test build locally first - catch errors before they break production!
- Don't modify `public/_headers` - it prevents HTML caching (README 165)

