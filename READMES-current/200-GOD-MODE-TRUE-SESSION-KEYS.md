# 200: God Mode - True Session-Based Storage Keys

**Status:** 📋 PLANNING - Separate DO keys per session  
**Created:** 2025-11-12  
**Priority:** CRITICAL - Fixes 128KB limit  
**Problem:** All God Mode sessions share ONE conversation key → hits 128KB limit

---

## 🎯 The Problem (Current State)

### What We Have (BROKEN):

**DO Storage:**
```
conv:Human:231080164:GodMode:171181104 (ONE key for ALL sessions)

Contains:
Session 1 (31 entities):
  - Human: Question 1
  - GodMode: Status
  - GodMode: (Entity1) response
  - GodMode: (Entity2) response
  - ... (29 more entities)
  - GodMode: Processing
  - GodMode: Synthesis
  Total: ~38KB

Session 2 (25 entities):
  - Human: Question 2
  - GodMode: Status
  - GodMode: (Entity1) response
  - ... (23 more entities)
  - GodMode: Synthesis
  Total: ~35KB

Session 3 (18 entities):
  - Human: Question 3
  - ... (~20KB)

Session 4 (31 entities):
  - Human: Question 4
  - ... (~38KB)

TOTAL: ~131KB → EXCEEDS 128KB LIMIT!
Next message: 500 error ❌
```

**Evidence:**
- New conversation works ✅
- After 3-4 sessions: 500 errors ❌
- Change color pair: Works again ✅
- Same color pair: Fails ❌

### The Math:
```
Session with 31 entities + large synthesis: ~38KB
Session with 6 entities + small synthesis: ~8KB
Average per session: ~20KB

128KB / 20KB = 6.4 sessions max
After 7th session: BROKEN
```

**Current behavior matches this perfectly!**

---

## 🎯 What We Want (TRUE SESSION STORAGE)

### Separate DO Key Per Session:

**DO Storage:**
```
godmode:Human:231080164:GodMode:171181104:1762985133459-fswhr02

Contains ONLY Session 1:
  - Human: Question 1
  - GodMode: Status
  - GodMode: (Entity1) response
  - ... (all entities)
  - GodMode: Synthesis
  Total: ~38KB (isolated)

godmode:Human:231080164:GodMode:171181104:1762985434567-abc123x

Contains ONLY Session 2:
  - Human: Question 2
  - GodMode: Status
  - ... (all entities)
  - GodMode: Synthesis
  Total: ~35KB (isolated)

godmode:Human:231080164:GodMode:171181104:1762985999888-xyz789p

Contains ONLY Session 3:
  - Human: Question 3
  - ... (~20KB, isolated)
```

**Each session in its own key = Never exceeds 128KB!**

---

## 🏗️ Implementation Plan

### Phase 1: Update PM2 to Use Session Keys

**File:** `hm-server-deployment/AI-Bot-Deploy/src/index-do-simple.ts`

**Current (line 1067-1072):**
```typescript
botParams: {
  humanUsername: originalMessage.username,
  humanColor: originalMessage.color,
  entity: 'god-mode',
  ais: originalMessage.botParams?.ais
}
```

**New:**
```typescript
botParams: {
  humanUsername: originalMessage.username,
  humanColor: originalMessage.color,
  entity: 'god-mode',
  ais: originalMessage.botParams?.ais,
  sessionId: sessionId  // ← ADD THIS!
}
```

**Purpose:** Tell DO worker this message belongs to a specific session.

---

### Phase 2: Update DO Worker to Route by Session

**File:** `saywhatwant/workers/durable-objects/MessageQueue.js`

**Current (line 143):**
```javascript
const conversationKey = this.getConversationKey(
  humanUsername,
  humanColor,
  aiUsername,
  aiColor
);
// Result: conv:Human:231080164:GodMode:171181104
```

**New:**
```javascript
// Check if this is a God Mode session message
const sessionId = body.botParams?.sessionId;

let conversationKey;
if (sessionId && body.botParams?.entity === 'god-mode') {
  // God Mode: Use session-specific key
  conversationKey = `godmode:${humanUsername}:${humanColor}:${aiUsername}:${aiColor}:${sessionId}`;
  // Result: godmode:Human:231080164:GodMode:171181104:1762985133459-fswhr02
} else {
  // Normal entity: Use standard conversation key
  conversationKey = this.getConversationKey(
    humanUsername,
    humanColor,
    aiUsername,
    aiColor
  );
  // Result: conv:Human:231080164:TheEternal:080175220
}
```

**Purpose:** Route God Mode messages to session-specific keys.

---

### Phase 3: Update Frontend Polling (CRITICAL)

**Problem:** Frontend polls:
```
/api/conversation?humanUsername=Human&humanColor=X&aiUsername=GodMode&aiColor=Y
```

This would only return messages from the OLD `conv:` key format!

**Solution:** God Mode polling needs to query ALL session keys:

**File:** `saywhatwant/workers/durable-objects/MessageQueue.js`

**New method:**
```javascript
async getGodModeConversation(url) {
  const humanUsername = url.searchParams.get('humanUsername');
  const humanColor = url.searchParams.get('humanColor');
  const aiUsername = url.searchParams.get('aiUsername');
  const aiColor = url.searchParams.get('aiColor');
  const after = parseInt(url.searchParams.get('after') || '0');
  
  // List all session keys for this Human:GodMode pair
  const prefix = `godmode:${humanUsername}:${humanColor}:${aiUsername}:${aiColor}:`;
  const sessionKeys = await this.state.storage.list({ prefix: prefix });
  
  // Load all sessions
  const allSessions = await Promise.all(
    Array.from(sessionKeys.keys()).map(key => this.state.storage.get(key))
  );
  
  // Flatten to all messages
  const allMessages = allSessions.flat().filter(m => m !== null);
  
  // Filter by timestamp
  const filtered = allMessages.filter(m => m.timestamp > after);
  
  // Sort by timestamp
  filtered.sort((a, b) => a.timestamp - b.timestamp);
  
  console.log('[MessageQueue] God Mode conversation:', filtered.length, 'messages from', sessionKeys.size, 'sessions');
  
  return this.jsonResponse(filtered);
}
```

**Update router (line 65-67):**
```javascript
if (path === '/api/conversation' && request.method === 'GET') {
  // Check if this is a God Mode conversation
  const aiUsername = url.searchParams.get('aiUsername');
  const entity = url.searchParams.get('entity');
  
  if (aiUsername && aiUsername.toLowerCase() === 'godmode') {
    return await this.getGodModeConversation(url);
  }
  
  return await this.getConversation(url);
}
```

---

### Phase 4: Update Global Polling

**Problem:** Frontend also polls `/api/comments?after=timestamp` which calls `getMessages()`.

**Current (line 217-232):**
```javascript
// Get all conversation keys
const keys = await this.state.storage.list({ prefix: 'conv:' });
```

**New:**
```javascript
// Get all conversation keys (normal entities)
const convKeys = await this.state.storage.list({ prefix: 'conv:' });

// Get all God Mode session keys
const godModeKeys = await this.state.storage.list({ prefix: 'godmode:' });

// Combine both
const allKeys = [...convKeys.keys(), ...godModeKeys.keys()];
```

**Purpose:** Make sure God Mode messages appear in global polling.

---

## 📊 Benefits

### Scalability
✅ **Unlimited sessions** - Each session isolated (~38KB max)  
✅ **No 128KB limit** - Each key independent  
✅ **Clean separation** - Sessions don't interfere  

### Performance
✅ **Faster queries** - Query specific session, not all sessions  
✅ **Efficient storage** - Only load what's needed  
✅ **Better caching** - Cloudflare can cache individual sessions  

### User Experience
✅ **Never breaks** - No 500 errors after N sessions  
✅ **Queryable history** - List all sessions for a user  
✅ **Load specific session** - Retrieve by session ID  

---

## 🔧 Key Format Comparison

### Normal Entity (Unchanged):
```
conv:Human:231080164:TheEternal:080175220
```
- All messages for this Human↔TheEternal conversation
- Rolling window (300 messages)
- Standard behavior

### God Mode Session (NEW):
```
godmode:Human:231080164:GodMode:171181104:1762985133459-fswhr02
          └────┬────┘ └────┬────┘ └────┬────┘ └────┬────┘ └─────┬──────┘
           Human      Human Color    GodMode    GodMode      Session ID
                                                  Color
```

**Components:**
- `godmode:` prefix (identifies God Mode sessions)
- Human identity (username:color)
- GodMode identity (username:color)  
- Session ID (timestamp-random)

**Properties:**
- ✅ Unique per session
- ✅ Queryable by Human:GodMode pair
- ✅ Sortable by timestamp
- ✅ Self-contained (one session per key)

---

## 🧪 Testing Plan

### Test 1: Session Isolation
1. Post God Mode question (Session 1)
2. Verify messages in `godmode:...:session1` key
3. Post another question (Session 2)
4. Verify messages in `godmode:...:session2` key
5. Confirm Session 1 unchanged

### Test 2: Frontend Polling
1. Open tab with God Mode filter
2. Post question
3. Verify all messages appear (status, entities, synthesis)
4. Post another question
5. Verify both sessions visible

### Test 3: Unlimited Sessions
1. Post 20+ God Mode questions
2. Verify no 500 errors
3. Check all sessions stored separately
4. Confirm each key under 128KB

### Test 4: Global Polling
1. Open tab with no filters
2. Post God Mode question
3. Verify God Mode messages appear in global stream
4. Confirm mixed with normal entity messages

### Test 5: Backward Compatibility
1. Post normal entity message (TheEternal)
2. Verify uses `conv:` key (not `godmode:`)
3. Confirm rolling window still works
4. No interference with God Mode

---

## 🚀 Rollout Strategy

### Step 1: Backend (PM2)
- Add `sessionId` to botParams in postToAPI calls
- Deploy and test (messages will have sessionId but still use old keys)
- No breakage (backward compatible)

### Step 2: DO Worker
- Add session key routing logic
- Add God Mode conversation query method
- Update global polling to include godmode: keys
- Deploy and test

### Step 3: Verify
- New God Mode sessions use new keys ✅
- Old conv: keys still work (legacy data)
- Frontend sees all messages
- No 500 errors

### Step 4: Migration (Optional)
- Old `conv:...:GodMode:...` keys can stay
- Or migrate to session keys
- Not urgent (new sessions work)

---

## ⚠️ Critical Implementation Details

### Session ID Must Be Consistent

**ALL messages in a session must have SAME sessionId:**

```typescript
// At start of handleGodMode
const sessionId = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

// Pass to ALL postToAPI calls
botParams: {
  ...
  sessionId: sessionId  // Same for status, entities, processing, synthesis
}
```

**If sessionId differs:** Messages go to different keys → session fragmented!

### Frontend Needs to Know sessionId (Eventually)

**For querying specific session:**
```
/api/godmode-conversation?humanUsername=X&humanColor=Y&sessionId=1762985133459-fswhr02
```

**But for real-time (current session):**
- Frontend doesn't need sessionId
- Polls ALL session keys for this Human:GodMode pair
- Gets latest messages across all sessions

### DO Worker Must Handle Both Formats

**During transition:**
- Old messages: `conv:Human:X:GodMode:Y` (legacy)
- New messages: `godmode:Human:X:GodMode:Y:sessionId` (current)

**Polling must check BOTH:**
```javascript
const oldKey = `conv:${humanUsername}:${humanColor}:GodMode:${godModeColor}`;
const newKeys = await this.state.storage.list({ 
  prefix: `godmode:${humanUsername}:${humanColor}:GodMode:${godModeColor}:` 
});

// Combine messages from both
```

---

## 📈 Scalability Impact

### Before (Current - BROKEN):
```
1 conversation key per Human:GodMode pair
Limit: 128KB = ~6 sessions
After 7 sessions: 500 errors
```

### After (Proposed - UNLIMITED):
```
1 key per session
Each key: ~38KB max (one session)
1000 sessions = 1000 keys (38MB total, but spread across keys)
No individual key ever exceeds 128KB
Unlimited sessions! ✅
```

---

## 🎨 User Experience

### Real-Time (Unchanged):
```
User posts God Mode question
→ Messages stream in real-time
→ Status → Entities → Processing → Synthesis
→ All visible immediately
→ No changes to UX
```

### Historical Querying (NEW):
```
Query: "Show me all my God Mode sessions"
→ Returns list of all godmode:Human:X:GodMode:Y:* keys
→ Each key is one session
→ Can load specific session
→ Can compare sessions
```

---

## 🔍 Key Differences from README-199

### What README-199 Said (Not Implemented):
```
Messages → messages:all (global stream)
Sessions → godmode-session:{id} (metadata only)
```

**Reality:** There is no `messages:all` key!

### What We Actually Need:
```
Messages → godmode:Human:X:GodMode:Y:{sessionId} (one key per session)
Metadata → godmode-session:{sessionId} (optional, for querying)
```

**Simpler!** Just use session-based conversation keys.

---

## 💡 Implementation Complexity

### Low Complexity (Elegant Solution):

**PM2 Changes:**
- ✅ Already generating sessionId
- ✅ Already tracking message IDs
- ✅ Just add sessionId to botParams

**DO Worker Changes:**
- ✅ Check for sessionId in botParams
- ✅ Build different key format if present
- ✅ Update polling to include godmode: prefix
- ✅ ~30 lines of code

**Frontend Changes:**
- ✅ NONE! (backward compatible)
- ✅ Polling already queries by username:color
- ✅ Will see messages from all session keys

**Total effort:** 1-2 hours, low risk

---

## 🚀 Success Criteria

### After Implementation:

1. ✅ **Unlimited sessions** - Post 100+ God Mode questions, no errors
2. ✅ **Each session isolated** - Check DO keys, one per session
3. ✅ **Real-time unchanged** - Messages stream as before
4. ✅ **Frontend works** - No code changes, still sees all messages
5. ✅ **Queryable** - Can list all sessions for a user
6. ✅ **Backward compatible** - Old conv: keys still readable

---

## 📋 Implementation Steps

### Step 1: PM2 - Add sessionId to botParams
```typescript
// In all postToAPI calls within handleGodMode
botParams: {
  humanUsername: message.username,
  humanColor: message.color,
  entity: 'god-mode',
  ais: message.botParams?.ais,
  sessionId: sessionId  // ← ADD THIS
}
```

**Test:** PM2 logs show sessionId in payload

### Step 2: DO Worker - Route by Session
```javascript
// In postMessage(), line ~143
if (body.botParams?.sessionId && body.botParams?.entity === 'god-mode') {
  conversationKey = `godmode:${humanUsername}:${humanColor}:${aiUsername}:${aiColor}:${body.botParams.sessionId}`;
} else {
  conversationKey = this.getConversationKey(humanUsername, humanColor, aiUsername, aiColor);
}
```

**Test:** New God Mode messages create `godmode:` keys

### Step 3: DO Worker - Update Polling
```javascript
// In getMessages(), update to include godmode: keys
const convKeys = await this.state.storage.list({ prefix: 'conv:' });
const godModeKeys = await this.state.storage.list({ prefix: 'godmode:' });
const allKeys = [...convKeys.keys(), ...godModeKeys.keys()];
```

**Test:** Frontend sees God Mode messages in polling

### Step 4: DO Worker - God Mode Conversation Query
```javascript
// In getConversation(), check if GodMode
if (aiUsername && aiUsername.toLowerCase() === 'godmode') {
  // Query all session keys for this pair
  const prefix = `godmode:${humanUsername}:${humanColor}:${aiUsername}:${aiColor}:`;
  const sessionKeys = await this.state.storage.list({ prefix: prefix });
  
  // Load and flatten all sessions
  const allSessions = await Promise.all(
    Array.from(sessionKeys.keys()).map(key => this.state.storage.get(key))
  );
  
  const allMessages = allSessions.flat().filter(m => m !== null);
  const filtered = allMessages.filter(m => m.timestamp > after);
  
  return this.jsonResponse(filtered);
}
```

**Test:** God Mode filter view shows all sessions combined

### Step 5: Deploy & Test
1. Deploy PM2 (add sessionId)
2. Deploy DO worker (session routing)
3. Test new session creates new key
4. Test frontend still works
5. Test 10+ sessions, no errors

---

## 🎯 Why This is The Right Solution

### Simple, Strong, Solid:

**Simple:**
- One key per session (easy to understand)
- Clear naming convention
- No complex querying

**Strong:**
- Never hits 128KB limit (each session isolated)
- Backward compatible (old keys still work)
- Scales infinitely

**Solid:**
- Each session is atomic (no cross-session issues)
- Natural archival (old sessions self-contained)
- Easy to debug (one session = one key)

### Logic Over Rules:

**The problem:** Treating God Mode like normal conversations (one key per pair)

**The logic:** God Mode sessions are independent oracles, not ongoing dialogues

**The solution:** Store them independently (one key per session)

**Matches the conceptual model!**

---

## 🔄 Migration Strategy

### Existing Data:
```
conv:Human:231080164:GodMode:171181104 (old format, ~114KB)
```

**Options:**

**Option A: Leave it (Recommended)**
- Old key continues to work
- Frontend can still read it
- Just can't add MORE sessions to it
- New sessions use new format

**Option B: Migrate it**
- Split into individual session keys
- Requires parsing messages by session
- Complex, risky
- Not necessary

**Recommendation:** Option A - leave old data, use new format going forward.

---

## ✅ Expected Outcome

### After Implementation:

**User posts 100 God Mode questions:**
```
godmode:Human:X:GodMode:Y:session-001
godmode:Human:X:GodMode:Y:session-002
godmode:Human:X:GodMode:Y:session-003
...
godmode:Human:X:GodMode:Y:session-100
```

**Each key:** 8-50KB (depending on entity count and synthesis length)

**Total storage:** 100 keys, ~2-5MB total (spread across many keys)

**Individual key limits:** Never exceeded! ✅

**User experience:** Seamless, unlimited God Mode sessions! 🚀

---

**Status:** Ready for implementation  
**Estimated time:** 1-2 hours  
**Risk:** Low (backward compatible)  
**Impact:** Fixes critical 128KB limitation  


