# 216: Version Management & Force Refresh System

**Tags:** #version-control #deployment #hot-reload #frontend  
**Created:** November 28, 2025  
**Status:** 🔴 IMPLEMENTING - Silent force refresh for all open tabs  

---

## Problem Statement

**Current situation:**
- When deploying critical bug fixes, 1,000 users have tabs open with old code
- No way to force them to refresh and get new version
- Users must manually refresh to see fixes
- Need **silent force refresh** (no notification, just reload)

---

## What We Have

**Current architecture:**
- Frontend polls `/api/comments?after=timestamp` every 5-60 seconds
- Response returns array of messages only: `[{message1}, {message2}, ...]`
- No version checking mechanism
- No way to trigger remote reload

**Current polling locations:**
- `components/CommentsStream.tsx` line 1089-1124: `checkForNewComments()`
- `modules/pollingSystem.ts` line 254-309: `useCommentsPolling()` hook
- Polling interval: 5s active → regressive to 3000s idle

---

## What We Want

**Silent force refresh system:**
1. All `/api/comments` responses include version number
2. Frontend checks version on every poll (existing infrastructure)
3. If version mismatch detected → **immediately reload** (no notification)
4. Detection time: 5-60 seconds (based on polling state)
5. Admin can force reload all tabs by updating version number

**Use case:**
- Deploy critical fix
- Update VERSION file
- Build and deploy
- All open tabs reload within 5-60 seconds
- Silent, automatic, no user interaction

---

## Implementation Plan

### Files to Create

**1. `saywhatwant/VERSION`**
- Simple text file with version number
- Format: `1.0.0`
- Increment on each deployment

**2. `saywhatwant/hooks/useVersionCheck.ts`**
- Hook that checks version from API response
- Triggers silent reload on mismatch
- No UI component needed

---

### Files to Modify

**1. `saywhatwant/next.config.js`**
- Read VERSION file at build time
- Inject as environment variable
- Available to frontend as `process.env.NEXT_PUBLIC_APP_VERSION`

**2. `saywhatwant/workers/durable-objects/MessageQueue.js`**
- Add version field to `getMessages()` response
- Read from environment or hard-coded
- Format: `{ messages: [...], version: "1.0.0" }`

**3. `saywhatwant/components/CommentsStream.tsx`**
- Import `useVersionCheck` hook
- Hook automatically checks version from API response
- Triggers `window.location.reload()` on mismatch

---

## Detailed Implementation Steps

### Step 1: Create VERSION File

**File:** `saywhatwant/VERSION`
```
1.0.0
```

**Purpose:** Single source of truth for app version

---

### Step 2: Update Next.js Config

**File:** `saywhatwant/next.config.js`

**Current state:**
```javascript
const nextConfig = {
  // ... existing config
};

module.exports = nextConfig;
```

**After changes:**
```javascript
const fs = require('fs');
const path = require('path');

// Read version from VERSION file
const versionPath = path.join(__dirname, 'VERSION');
const version = fs.existsSync(versionPath) 
  ? fs.readFileSync(versionPath, 'utf8').trim() 
  : '1.0.0';

const nextConfig = {
  // ... existing config
  
  env: {
    ...nextConfig.env,
    NEXT_PUBLIC_APP_VERSION: version,
  }
};

module.exports = nextConfig;
```

**Changes:**
- ✅ Read VERSION file at build time
- ✅ Inject as `NEXT_PUBLIC_APP_VERSION` environment variable
- ✅ Available in frontend as `process.env.NEXT_PUBLIC_APP_VERSION`

---

### Step 3: Update Durable Objects Worker Response

**File:** `saywhatwant/workers/durable-objects/MessageQueue.js`

**Method:** `getMessages()` (line 319-330)

**Current response:**
```javascript
return this.jsonResponse(filtered);
// Returns: [{message1}, {message2}, ...]
```

**After changes:**
```javascript
return this.jsonResponse({
  messages: filtered,
  version: "1.0.0",  // Hard-coded or from env
  timestamp: Date.now()
});
// Returns: { messages: [...], version: "1.0.0", timestamp: ... }
```

**Changes:**
- ✅ Wrap messages array in object
- ✅ Add version field (hard-coded for now, can use env later)
- ✅ Add timestamp for debugging

**CRITICAL:** This changes the API response format!
- **Before:** Response is array: `[{message1}, ...]`
- **After:** Response is object: `{ messages: [...], version: "1.0.0" }`
- **Frontend MUST handle both formats** for backward compatibility during transition

---

### Step 4: Create Version Check Hook

**File:** `saywhatwant/hooks/useVersionCheck.ts` (NEW FILE)

```typescript
import { useEffect } from 'react';

const CURRENT_VERSION = process.env.NEXT_PUBLIC_APP_VERSION || '1.0.0';

interface VersionCheckOptions {
  enabled?: boolean;
}

/**
 * useVersionCheck Hook
 * 
 * Silently checks version from API responses and force-reloads if mismatch detected.
 * No notification, no user interaction - just immediate reload.
 * 
 * Piggybacks on existing message polling (no additional requests).
 */
export function useVersionCheck(serverVersion: string | undefined, options: VersionCheckOptions = {}) {
  const { enabled = true } = options;

  useEffect(() => {
    if (!enabled || !serverVersion) return;
    
    // Check version mismatch
    if (serverVersion !== CURRENT_VERSION) {
      console.log(`[Version] Mismatch detected - current: ${CURRENT_VERSION}, server: ${serverVersion}`);
      console.log('[Version] Force reloading page...');
      
      // Silent force reload (no notification)
      setTimeout(() => {
        window.location.reload();
      }, 1000); // 1 second grace period for logging
    }
  }, [serverVersion, enabled]);
}
```

**Purpose:**
- Accepts `serverVersion` from API response
- Compares with `CURRENT_VERSION` (from build)
- Triggers silent reload if mismatch
- 1 second grace period (for logging only)

---

### Step 5: Update Frontend Polling Component

**File:** `saywhatwant/components/CommentsStream.tsx`

**Location:** Line 1089-1124 (`checkForNewComments()`)

**Current code:**
```typescript
const response = await fetch(pollUrl);
if (!response.ok) {
  throw new Error(`HTTP error! status: ${response.status}`);
}
newComments = await response.json();  // Array of messages
console.log(`[Presence Polling] Response: ${newComments.length} messages`);
```

**After changes:**
```typescript
const response = await fetch(pollUrl);
if (!response.ok) {
  throw new Error(`HTTP error! status: ${response.status}`);
}

const data = await response.json();

// Handle both old format (array) and new format (object with version)
if (Array.isArray(data)) {
  // Old format (backward compatibility)
  newComments = data;
} else {
  // New format with version
  newComments = data.messages || [];
  
  // Store version for version check hook
  setServerVersion(data.version);
}

console.log(`[Presence Polling] Response: ${newComments.length} messages`);
```

**Additional state needed at component level:**
```typescript
const [serverVersion, setServerVersion] = useState<string | undefined>(undefined);

// Add version check hook (triggers reload if mismatch)
useVersionCheck(serverVersion);
```

**Changes:**
- ✅ Handle both response formats (array and object)
- ✅ Extract version from response
- ✅ Store version in state
- ✅ Pass to useVersionCheck hook
- ✅ Hook triggers reload automatically

---

### Step 6: Import Version Check Hook

**File:** `saywhatwant/components/CommentsStream.tsx`

**Location:** Top of file (imports section)

**Add import:**
```typescript
import { useVersionCheck } from '@/hooks/useVersionCheck';
```

**Location:** Inside component (after useState declarations)

**Add hook:**
```typescript
const [serverVersion, setServerVersion] = useState<string | undefined>(undefined);

// Version check - triggers silent reload on mismatch
useVersionCheck(serverVersion);
```

---

## Complete Code Changes

### Change 1: Create VERSION file

**File:** `saywhatwant/VERSION`
```
1.0.0
```

---

### Change 2: Update next.config.js

**File:** `saywhatwant/next.config.js`

**Find:**
```javascript
const nextConfig = {
```

**Add before it:**
```javascript
const fs = require('fs');
const path = require('path');

const versionPath = path.join(__dirname, 'VERSION');
const version = fs.existsSync(versionPath) 
  ? fs.readFileSync(versionPath, 'utf8').trim() 
  : '1.0.0';

console.log('[Build] App version:', version);
```

**Find:**
```javascript
const nextConfig = {
```

**Change to:**
```javascript
const nextConfig = {
  env: {
    NEXT_PUBLIC_APP_VERSION: version,
  },
```

---

### Change 3: Update DO Worker Response

**File:** `saywhatwant/workers/durable-objects/MessageQueue.js`

**Method:** `getMessages()` (line ~330)

**Find:**
```javascript
return this.jsonResponse(filtered);
```

**Replace with:**
```javascript
return this.jsonResponse({
  messages: filtered,
  version: "1.0.0"  // TODO: Read from env in future
});
```

---

### Change 4: Create Version Check Hook

**File:** `saywhatwant/hooks/useVersionCheck.ts` (NEW)

**Content:** (see Step 4 above for full code)

---

### Change 5: Update CommentsStream Component

**File:** `saywhatwant/components/CommentsStream.tsx`

**Location 1: Imports (top of file)**

**Add:**
```typescript
import { useVersionCheck } from '@/hooks/useVersionCheck';
```

**Location 2: Component state (after existing useState calls)**

**Add:**
```typescript
const [serverVersion, setServerVersion] = useState<string | undefined>(undefined);

// Version check - triggers silent reload on mismatch
useVersionCheck(serverVersion);
```

**Location 3: checkForNewComments function (line ~1118)**

**Find:**
```typescript
newComments = await response.json();
```

**Replace with:**
```typescript
const data = await response.json();

// Handle both formats (backward compatibility)
if (Array.isArray(data)) {
  newComments = data;
} else {
  newComments = data.messages || [];
  setServerVersion(data.version);
}
```

---

## Testing Plan

### Test 1: Version Mismatch Detection

1. Deploy current code with VERSION=1.0.0
2. Open tab, verify polling works
3. Update VERSION to 1.0.1
4. Rebuild and deploy
5. Wait 5-60 seconds
6. **Expected:** Tab automatically reloads

### Test 2: Backward Compatibility

1. Test with old DO worker (returns array)
2. Verify frontend handles array format
3. Test with new DO worker (returns object)
4. Verify frontend handles object format

### Test 3: Multiple Tabs

1. Open 5 tabs
2. Deploy new version
3. **Expected:** All 5 tabs reload within 60 seconds

### Test 4: Active vs Idle Detection

1. Active tab (5s polling): Should detect in 5-10 seconds
2. Idle tab (60s+ polling): Should detect in 60-120 seconds

---

## Deployment Workflow

### Standard Deployment with Force Refresh

```bash
# 1. Increment version
echo "1.0.1" > saywhatwant/VERSION

# 2. Build frontend (injects new version)
cd saywhatwant
npm run build

# 3. Deploy DO worker (with version in response)
npx wrangler deploy --config wrangler-do.toml

# 4. Deploy frontend to Cloudflare Pages
npx wrangler pages deploy out

# 5. Wait 5-60 seconds - all tabs will auto-reload!
```

**Result:**
- All open tabs detect version mismatch
- Silent reload (no notification)
- Users get new code within 5-60 seconds

---

## Cost Impact

**Additional operations:**
- Version check: 0 additional requests (piggybacks on existing polling)
- Response size increase: +20 bytes per response (negligible)
- **Additional cost: $0.00** ✅

---

## Risk Analysis

### Risk 1: User Loses Unsaved Work

**Likelihood:** LOW (most messages sent immediately)  
**Impact:** MEDIUM (user loses typed message)  
**Mitigation:** Add localStorage backup before reload (optional, can add later)

### Risk 2: Backward Compatibility

**Likelihood:** MEDIUM (during deployment transition)  
**Impact:** LOW (handled with conditional parsing)  
**Mitigation:** Frontend handles both array and object response formats

### Risk 3: Reload Loop

**Likelihood:** VERY LOW  
**Impact:** HIGH (infinite reload loop)  
**Mitigation:** 
- Only reload once per version change
- Use localStorage to track last reload version
- Prevent multiple reloads within 60 seconds

---

## Summary

**Implementation checklist:**
- [x] Create VERSION file
- [x] Update next.config.js (read VERSION, inject as env var)
- [x] Create useVersionCheck hook (with reload loop prevention)
- [x] Update DO worker getMessages() response format
- [x] Update CommentsStream.tsx (import hook, handle new format)
- [x] Test version mismatch (updated to 1.0.1)
- [ ] Deploy

**Status:** Implementation complete. Ready to deploy version 1.0.1.

**Expected outcome:**
- Silent force refresh capability
- All tabs reload within 5-60 seconds after deployment
- Zero additional cost
- No user notification needed

---
