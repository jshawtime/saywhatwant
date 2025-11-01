# 171: Frontend DO Migration Fix

## Status: ✅ COMPLETED

**Deployed:** 2025-11-01

### What Was Fixed
- Removed KV-era self-healing logic from frontend
- Removed `/api/admin/add-to-cache` endpoint calls (404 errors gone)
- Removed `pendingMessages` localStorage tracking
- Removed obsolete `processed` field from `botParams`

### Files Modified
1. `modules/commentSubmission.ts` - Removed pending message tracking (lines 200-209)
2. `components/CommentsStream.tsx` - Removed self-heal verification in polling loop (lines 970-1017)
3. `components/CommentsStream.tsx` - Removed `processed = false` assignment (lines 1092-1096)

### Result
Frontend now cleanly interacts with Durable Objects worker with no unnecessary self-healing or cache management logic.

---

## Problem Statement

After migrating backend to Durable Objects, the frontend is still using KV-era self-healing logic:

### Errors Observed
```
POST https://saywhatwant-do-worker.bootloaders.workers.dev/api/admin/add-to-cache 404 (Not Found)
[Self-Heal] ⚠️ Cache heal failed for: [message-id]
```

### Root Cause
The frontend's self-healing system was designed for KV eventual consistency issues. It attempts to:
1. Detect "missing" AI responses
2. POST to `/api/admin/add-to-cache` to force cache updates
3. Retry multiple times with exponential backoff

**This is completely unnecessary with Durable Objects** because:
- DOs provide strong consistency (no cache sync issues)
- All state is in-memory with automatic persistence
- No separate cache layer to "heal"

### Why Backend Works But Frontend Shows Issues

**PM2 logs show success:**
```
[CLAIMED] Human:42du2wbf84 | the-four-agreements | "Why is fire orange?"
[OLLAMA] ✓ 241 chars in 1.5s
[POSTED] AI:gw52d9v7d5 → Human:42du2wbf84
[COMPLETE] Human:42du2wbf84 | AI:gw52d9v7d5 (1.7s total)
```

**Frontend shows duplicates in debug export:**
```
Human [1762035476194-j4p39i41s]  ← Old KV ID format
Human [4nta9qjdh7]                ← New DO ID format
```

This suggests the frontend is BOTH:
1. Posting messages correctly (new DO format)
2. Still running old KV self-heal logic (old ID format)

## Solution: Remove KV Self-Healing from Frontend

### Files to Modify

1. **`hooks/usePresencePolling.ts`** (or similar polling hook)
   - Remove `/api/admin/add-to-cache` calls
   - Remove cache heal retry logic
   - Keep polling logic (still needed for getting new messages)

2. **`hooks/useSelfHeal.ts`** (if exists)
   - Delete entirely or gut the KV-specific logic
   - DOs don't need self-healing

3. **`lib/message-utils.ts`** or similar
   - Remove any cache verification logic
   - Remove duplicate message ID generation (old vs new format)

### What to Keep

- **Polling**: Frontend still needs to poll `/api/comments?after=[timestamp]`
- **Message posting**: Frontend posting to `/api/comments` works fine
- **Local IndexedDB**: Still useful for client-side caching

### What to Remove

- `/api/admin/add-to-cache` calls
- Cache heal retry logic
- Any "missing message" detection for AI responses
- Old KV ID format generation (`timestamp-randomstring`)

## Implementation Plan

### Step 1: Find Self-Heal Logic
Search for:
- `add-to-cache`
- `Self-Heal`
- `cache heal`
- `triggerHeal`

### Step 2: Audit Hook Dependencies
- `usePresencePolling.ts`
- `useSelfHeal.ts` (if exists)
- `useComments.ts`
- Any cache management utilities

### Step 3: Remove/Refactor
- Delete self-heal hooks entirely
- Remove cache heal calls from polling
- Simplify message posting (single ID format)

### Step 4: Test
- Post message from frontend
- Verify PM2 processes it
- Verify AI response appears in frontend
- Verify no 404 errors in console

## Expected Outcome

**Before (Current):**
```
[User posts] → DO stores message
[PM2 polls] → DO returns pending
[PM2 processes] → Ollama generates
[PM2 posts AI response] → DO stores AI message
[Frontend polls] → Gets AI response
[Frontend self-heal] → 404 on /api/admin/add-to-cache ❌
```

**After (Fixed):**
```
[User posts] → DO stores message
[PM2 polls] → DO returns pending
[PM2 processes] → Ollama generates
[PM2 posts AI response] → DO stores AI message
[Frontend polls] → Gets AI response ✅
(No self-heal needed)
```

## Why This Is Safe

1. **DOs are strongly consistent** - no race conditions
2. **PM2 polling works** - logs prove it
3. **Frontend polling works** - messages appear (eventually)
4. **Self-heal was KV-specific** - solving eventual consistency

The only reason messages aren't appearing instantly is normal polling delay (5-30s regressive). Once we remove the broken self-heal logic, the system will work cleanly.

## Notes

- The duplicate messages in debug export (`1762035476194-j4p39i41s` vs `4nta9qjdh7`) suggest the frontend might be generating TWO message objects on post - one with old format, one with new
- Need to ensure message posting only generates the new short ID format
- Old format: `timestamp-randomstring`
- New format: `randomstring` only

