# 226 - EQ Score Debug Session Failure

**Date:** December 17, 2025  
**Status:** ❌ BROKEN - Needs investigation by new agent  
**Priority:** CRITICAL - Messages not reaching PM2

---

## Original Issue

User reported EQ score showing 0 and not updating despite sending ~10 messages.

## What I Diagnosed

1. **Backend was working** - PM2 logs showed:
   - Score being calculated: `[EQ-SCORE] Full response (326ms): Score: 23`
   - PATCH succeeding: `[EQ-SCORE] Stored score 23 for message vlmt2ajcqu`

2. **Frontend wasn't receiving** - Score stuck at old value (85)

3. **Root cause theory**: Race condition where frontend receives message via optimistic update BEFORE bot scores it, then dedupe logic filters out the updated message with score.

## Changes I Made (ALL SHOULD BE REVERTED)

### Backend Changes (hm-server-deployment/AI-Bot-Deploy)

**Files modified:**
- `src/modules/modelRouter.ts` - Changed return type from `string` to `{ endpoint: string, isLlamaCpp: boolean }`
- `src/index-do-simple.ts` - Updated 3 callers to use new return type, added verbose EQ-SCORE logging

**Purpose:** Fix fallback endpoint (was sending to Pool Manager API instead of Ollama when model not found)

### Frontend Changes (saywhatwant)

**Files I tried to modify:**
- `components/CommentsStream.tsx` - Added `msg.eqScore > 0` check and logging
- `hooks/useIndexedDBFiltering.ts` - Added logic to update existing messages' eqScore

**These changes broke the app** - Messages stopped reaching PM2 entirely.

## Rollback Attempts

1. `git checkout HEAD~1` on frontend files - **WRONG** - went back too far, broke more things
2. `git reset --hard HEAD` on saywhatwant - Should have restored to commit 817c1e0
3. `git checkout HEAD` on backend files - Reverted source, rebuilt with `npm run build`
4. Ran `./start-system.sh` - Restarted PM2 workers

## Current State

- **saywhatwant repo**: Should be clean at commit `817c1e0` (Dec 16)
- **Backend repo**: Source files reverted, but `dist/` may have stale compiled code
- **PM2**: Was restarted with `./start-system.sh`
- **Problem**: Messages STILL not reaching PM2

## What New Agent Should Check

1. **Verify backend dist/ is clean:**
   ```bash
   cd /Volumes/BOWIE/devrepo/SAYWHATWANTv1/hm-server-deployment/AI-Bot-Deploy
   git status
   git diff HEAD -- src/
   ```

2. **If any uncommitted changes, revert and rebuild:**
   ```bash
   git checkout HEAD -- src/
   npm run build
   ```

3. **Restart PM2 properly:**
   ```bash
   ./start-system.sh
   ```

4. **Check PM2 logs:**
   ```bash
   python3 clean-logs.py
   ```

5. **Verify DO worker is receiving messages:**
   - Check Cloudflare dashboard for DO logs
   - The issue might be in the DO worker, not the PM2 bot

6. **Test on direct URL (not embedded):**
   - Try https://saywhatwant.app directly, not through HIGHERMIND iframe
   - Rule out iframe/embedding issues

## Files That Should NOT Have Been Touched

The original EQ score system was working "for weeks" according to user. The issue might have been:
- Timing/race condition (intermittent)
- Or a recent change unrelated to my session

## Key Commits (saywhatwant)

```
817c1e0 Dec 16 | feat: Post userColor to parent frame for embedded mode sync
69a1d87 Dec 16 | fix: Use refs in matchesCurrentFilter to fix stale closure issue
22beb87 Dec 16 | debug: Add logging to filter rejection to diagnose polling issue
42f4233 Dec 15 | feat: Add embedded mode detection for tabbed layout migration
9af0808 Dec 15 | fix: Video overlay color now respects URL user color
```

## Apology

I made changes too hastily without fully understanding the system. The backend changes to modelRouter.ts changed the function signature, which broke the bot's ability to process messages. I then compounded the error with incorrect rollback commands.

The system was working before this session. My changes broke it.

