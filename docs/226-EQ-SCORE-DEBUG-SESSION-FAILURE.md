# 226 - EQ Score Debug Session Failure → RESOLVED

**Date:** December 17, 2025  
**Status:** ✅ RESOLVED  
**Priority:** Was CRITICAL - Now fixed

---

## Original Issue

User reported EQ score showing 0 and not updating despite sending ~10 messages.

## Root Cause Analysis

### Issue 1: Frontend not reaching PM2
**Cause:** `.env.local` was pointing to old KV worker URL (`sww-comments.bootloaders.workers.dev`) instead of the current DO worker (`saywhatwant-do-worker.bootloaders.workers.dev`).

**Fix:** Updated `.env.local` with correct API endpoint.

### Issue 2: EQ Score not updating on conversation switch
**Cause:** When user clicks gallery image to switch conversations:
1. HigherMind generates NEW random color in URL: `uis=Me:NEW_COLOR`
2. iframe reloads, `useColorPicker` runs FIRST (useLayoutEffect), reads OLD color from localStorage
3. `checkForNewComments` callback is created with **OLD color** in closure (stale closure)
4. `uis` useEffect runs AFTER, updates state to NEW color
5. User sends message with NEW color
6. PM2 scores message with `color: NEW_COLOR`
7. Polling callback checks: `msg.color === userColor` using OLD color from stale closure
8. **NO MATCH** → score skipped

**Why it worked on first conversation but not after switching:**
- First conversation: color matches because callback was created with the same color
- After gallery click: callback has OLD color, but message has NEW color from URL

### Issue 3: initContext not being used
**Cause:** The `initContext` feature from `global.json` was never implemented in the PM2 bot code.

---

## Fixes Applied

### Fix 1: API Endpoint (saywhatwant/.env.local)
```bash
# Changed from:
NEXT_PUBLIC_COMMENTS_API=https://sww-comments.bootloaders.workers.dev/api/comments
# To:
NEXT_PUBLIC_COMMENTS_API=https://saywhatwant-do-worker.bootloaders.workers.dev/api/comments
```

### Fix 2: Stale Closure in Polling (saywhatwant/components/CommentsStream.tsx)

**Added refs to track current identity:**
```typescript
// Refs for current identity (used in polling callback to avoid stale closures)
const currentUsernameRef = useRef<string>('');
const currentUserColorRef = useRef<string>('');
```

**Added effect to keep refs in sync:**
```typescript
// Keep refs in sync with current identity (for polling callback to avoid stale closures)
useEffect(() => {
  currentUsernameRef.current = username;
  currentUserColorRef.current = userColor;
}, [username, userColor]);
```

**Changed EQ score check to use refs:**
```typescript
// Before (stale closure):
const isOurHuman = msg.username === username && msg.color === userColor;

// After (always current):
const isOurHuman = msg.username === currentUsernameRef.current && msg.color === currentUserColorRef.current;
```

### Fix 3: EQ Score Update for Duplicates (saywhatwant/hooks/useIndexedDBFiltering.ts)

Modified `addMessages` function to update existing messages when eqScore changes instead of treating them as duplicates:

```typescript
// Check each new message
for (const msg of newMessages) {
  const existing = existingMap.get(msg.id);
  
  if (existing) {
    // Message already exists - check if eqScore updated
    if (msg.eqScore !== undefined && msg.eqScore !== existing.eqScore) {
      // Update eqScore in-place
      const idx = updated.findIndex(m => m.id === msg.id);
      if (idx !== -1) {
        updated[idx] = { ...updated[idx], eqScore: msg.eqScore };
        hasUpdates = true;
      }
    }
  } else {
    uniqueNew.push(msg);
  }
}
```

### Fix 4: initContext Support (hm-server-deployment/AI-Bot-Deploy/src/index-do-simple.ts)

Added code to insert `initContext.messages` from `global.json` after system prompt for entities with `initContext: true`:

```typescript
// Add initContext messages if entity has initContext: true
if (entity.initContext === true) {
  const globalSettings = getGlobalSettings();
  if (globalSettings?.initContext?.messages) {
    const initMessages = globalSettings.initContext.messages;
    console.log(`[INIT-CONTEXT] Adding ${initMessages.length} init messages for entity ${entity.id}`);
    for (const msg of initMessages) {
      ollamaMessages.push({
        role: msg.role,
        content: msg.content
      });
    }
  }
}
```

---

## Key Commits

**saywhatwant:**
- `e459d0a` - Fix EQ score not updating on conversation switch - use refs to avoid stale closures in polling callback
- `8492b67` - Fix EQ score not updating - update existing messages instead of treating as duplicates

**hm-server-deployment:**
- `11ed70e` - Add initContext support - insert warmup messages for entities with initContext:true

---

## Lesson Learned

When using `useCallback` with polling functions, any state values used inside the callback must either:
1. Be included in the dependency array (causes callback to recreate on every change)
2. Be accessed via refs that are kept in sync with state (preferred for polling)

The `checkForNewComments` callback was memoized but didn't include `username` or `userColor` in its dependencies, causing stale closure issues when the URL changed.
