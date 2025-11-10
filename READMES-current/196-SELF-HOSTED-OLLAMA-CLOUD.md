# Self-Hosted Ollama Cloud with Tailscale

## Vision: Location-Agnostic Distributed AI

**Build it right from the start:**
- Multiple Macs running Ollama (anywhere in the world)
- PM2 orchestrator (local or cloud VPS)
- Tailscale VPN mesh network (zero configuration)
- **Move Macs anywhere, anytime - everything just works** 🚀

**Key principle:** Write code once, works everywhere.

---

## Architecture Overview

### The Network

```
┌─────────────────────────────────────────────────────────────┐
│                    Tailscale Mesh Network                    │
│                  (100.64.0.x Private Subnet)                 │
│                                                              │
│  Mac 1 (SF):        100.64.0.1:11434  [M3 Max, 64GB]       │
│  Mac 2 (NY):        100.64.0.2:11434  [M2 Ultra, 128GB]    │
│  Mac 3 (London):    100.64.0.3:11434  [M1 Max, 32GB]       │
│  PM2 Orchestrator:  100.64.0.10      [Polls & routes]      │
│                                                              │
└─────────────────────────────────────────────────────────────┘
         │
         └──→ Internet (encrypted, peer-to-peer when possible)
```

### The Components

**1. Ollama Servers (Your Macs)**
- Run Ollama locally
- Join Tailscale network
- Receive requests on stable private IPs
- Process AI requests in parallel

**2. PM2 Orchestrator**
- Polls Durable Objects queue
- Claims messages (prevents duplicates)
- Routes to best available Mac
- Handles failover automatically

**3. Cloudflare (Existing)**
- Durable Objects (message queue)
- Pages (frontend hosting)
- Workers (API endpoints)

**4. Tailscale VPN**
- Connects everything securely
- Stable private IPs (never change)
- Works across any network
- Zero configuration per location

---

## Why Tailscale from Day 1?

### The Problem with Local IPs

**BAD approach (location-dependent):**
```typescript
// This breaks when you move Macs!
const servers = [
  { id: 'mac-1', url: 'http://192.168.1.10:11434' },  // Only works on this WiFi
  { id: 'mac-2', url: 'http://10.0.0.120:11434' }     // Only works on this network
];
```

**Moving a Mac requires:**
- ❌ Find new local IP
- ❌ Update code
- ❌ Redeploy
- ❌ Test again

---

### The Tailscale Solution

**GOOD approach (location-agnostic):**
```typescript
// This works ANYWHERE, FOREVER
const servers = [
  { id: 'mac-1', url: 'http://100.64.0.1:11434' },  // Stable Tailscale IP
  { id: 'mac-2', url: 'http://100.64.0.2:11434' }   // Stable Tailscale IP
];
```

**Moving a Mac requires:**
- ✅ Unplug
- ✅ Move
- ✅ Plug in
- ✅ Works (Tailscale auto-reconnects)

**No code changes. No configuration. It just works.** 🎯

---

## Implementation Guide

### Phase 1: Local Multi-Mac Setup (Week 1)

**Objective:** Get 2+ Macs on same local network working together

#### Step 1.1: Install Tailscale

```bash
# On Mac 1 (your primary Mac)
brew install tailscale
sudo tailscale up
# Note the IP: 100.64.0.1

# On Mac 2 (your second Mac)
brew install tailscale
sudo tailscale up
# Note the IP: 100.64.0.2

# Verify they see each other
tailscale status
# Should show both Macs online
```

**Why now?** Even though they're on the same local network, you're building the production-ready version from day 1.

---

#### Step 1.2: Update PM2 to Use Tailscale IPs

**File:** `hm-server-deployment/AI-Bot-Deploy/src/index-do-simple.ts`

Add server registry:

```typescript
// Server Registry - Production-ready from day 1
interface OllamaServer {
  id: string;
  url: string;
  location: string;
  priority: number;
  maxConcurrent: number;
}

const OLLAMA_SERVERS: OllamaServer[] = [
  {
    id: 'mac-1',
    url: 'http://100.64.0.1:11434',
    location: 'san-francisco',
    priority: 1,
    maxConcurrent: 3
  },
  {
    id: 'mac-2',
    url: 'http://100.64.0.2:11434',
    location: 'san-francisco',  // Will change to 'new-york' later
    priority: 1,
    maxConcurrent: 6
  }
];

// Remove old single-server code:
// const OLLAMA_URL = 'http://10.0.0.110:11434';  ❌ DELETE THIS
```

---

#### Step 1.3: Implement Message Claiming

**Purpose:** Prevent multiple PM2 workers from processing the same message

**In Durable Objects:** `saywhatwant/workers/durable-objects/MessageQueue.js`

Add claiming logic:

```javascript
/**
 * POST /api/comments/:id/claim
 * Atomically claim a message for processing
 */
async claimMessage(request, path) {
  const messageId = path.split('/')[3];
  const body = await request.json();
  const { workerId, timestamp } = body;
  
  // Find message across all conversations
  const keys = await this.state.storage.list({ prefix: 'conv:' });
  
  for (const key of keys.keys()) {
    const conversation = await this.state.storage.get(key);
    if (!conversation) continue;
    
    const messageIndex = conversation.findIndex(m => m.id === messageId);
    if (messageIndex === -1) continue;
    
    const message = conversation[messageIndex];
    
    // Check if already claimed
    if (message.botParams?.claimedBy) {
      const claimAge = Date.now() - message.botParams.claimedAt;
      
      // If claimed >5 minutes ago, allow re-claim (timeout)
      if (claimAge < 300000) {
        return this.jsonResponse({
          success: false,
          claimedBy: message.botParams.claimedBy,
          claimedAt: message.botParams.claimedAt
        });
      }
    }
    
    // Claim it atomically
    message.botParams = message.botParams || {};
    message.botParams.claimedBy = workerId;
    message.botParams.claimedAt = timestamp;
    message.botParams.status = 'processing';
    
    await this.state.storage.put(key, conversation);
    
    console.log(`[MessageQueue] Message ${messageId} claimed by ${workerId}`);
    
    return this.jsonResponse({ success: true, message });
  }
  
  return this.jsonResponse({ success: false, error: 'Message not found' }, 404);
}

// Add route in fetch():
if (path.match(/^\/api\/comments\/[^/]+\/claim$/) && request.method === 'POST') {
  return await this.claimMessage(request, path);
}
```

---

#### Step 1.4: Implement Server Selection

**In PM2 worker:** `src/index-do-simple.ts`

```typescript
// Generate unique worker ID
const WORKER_ID = `worker-${process.pid}-${Date.now().toString(36)}`;

/**
 * Select optimal server for processing
 * Uses least-loaded algorithm
 */
function selectOptimalServer(servers: OllamaServer[]): OllamaServer {
  // Filter to online servers
  const available = servers.filter(s => isServerOnline(s));
  
  if (available.length === 0) {
    throw new Error('No Ollama servers available');
  }
  
  // For now: Simple round-robin
  // Later: Add load tracking, response time, etc.
  const index = Math.floor(Math.random() * available.length);
  return available[index];
}

/**
 * Check if server is reachable
 */
async function isServerOnline(server: OllamaServer): Promise<boolean> {
  try {
    const response = await fetch(`${server.url}/api/version`, {
      method: 'GET',
      signal: AbortSignal.timeout(5000) // 5 second timeout
    });
    return response.ok;
  } catch (error) {
    console.error(`[SERVER-CHECK] ${server.id} is offline:`, error.message);
    return false;
  }
}
```

---

#### Step 1.5: Update Main Processing Loop

```typescript
async function runWorker() {
  console.log(`[WORKER] Started: ${WORKER_ID}`);
  console.log(`[WORKER] Available servers:`, OLLAMA_SERVERS.map(s => `${s.id} (${s.url})`));
  
  while (true) {
    try {
      // Fetch pending messages
      const response = await fetch(`${API_URL}/api/comments?status=pending&limit=1`);
      const messages = await response.json();
      
      if (messages.length === 0) {
        await sleep(1000);
        continue;
      }
      
      const message = messages[0];
      
      // STEP 1: Claim the message
      const claimResponse = await fetch(`${API_URL}/api/comments/${message.id}/claim`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workerId: WORKER_ID,
          timestamp: Date.now()
        })
      });
      
      const claimResult = await claimResponse.json();
      
      if (!claimResult.success) {
        console.log(`[CLAIM] Message ${message.id} already claimed by ${claimResult.claimedBy}`);
        await sleep(100);
        continue;
      }
      
      console.log(`[CLAIM] Successfully claimed message ${message.id}`);
      
      // STEP 2: Score the message (EQ gamification)
      const eqScore = await scoreMessage(message.text);
      await fetch(`${API_URL}/api/comments/${message.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eqScore })
      });
      
      // STEP 3: Select optimal server
      const server = selectOptimalServer(OLLAMA_SERVERS);
      console.log(`[ROUTE] Routing message ${message.id} to ${server.id} (${server.url})`);
      
      // STEP 4: Get entity config
      const entity = getEntity(message.botParams.entity);
      if (!entity) {
        console.error(`[ERROR] Entity not found: ${message.botParams.entity}`);
        await completeMessage(message.id);
        continue;
      }
      
      // STEP 5: Build context and send to Ollama
      const context = await fetchContext(message);
      const ollamaPayload = buildOllamaPayload(entity, message, context);
      
      const startTime = Date.now();
      const ollamaResponse = await fetch(`${server.url}/v1/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(ollamaPayload)
      });
      
      if (!ollamaResponse.ok) {
        throw new Error(`Ollama error from ${server.id}: ${ollamaResponse.status}`);
      }
      
      const data = await ollamaResponse.json();
      const duration = Date.now() - startTime;
      
      console.log(`[SUCCESS] ${server.id} processed message in ${duration}ms`);
      
      // STEP 6: Post response
      await postResponse(data, message, entity);
      
      // STEP 7: Mark complete
      await completeMessage(message.id);
      
    } catch (error) {
      console.error('[ERROR]', error);
      await sleep(5000);
    }
  }
}
```

---

#### Step 1.6: Test Locally

**Start PM2 on your primary Mac:**
```bash
cd hm-server-deployment/AI-Bot-Deploy
pm2 restart ai-bot-worker
pm2 logs
```

**Post test messages from frontend:**
- Watch PM2 logs
- Should see messages distributed between Mac 1 and Mac 2
- Check claiming works (no duplicates)

**Verify in logs:**
```
[CLAIM] Successfully claimed message abc123
[ROUTE] Routing message abc123 to mac-2 (http://100.64.0.2:11434)
[SUCCESS] mac-2 processed message in 1234ms
```

---

### Phase 2: Move a Mac to Different Location (Week 2)

**Objective:** Prove location-independence

#### Step 2.1: Before Moving

**Verify current state:**
```bash
# On Mac 2
tailscale status
# Shows: 100.64.0.2   online

# Test Ollama
curl http://100.64.0.2:11434/api/version
# Should work
```

**Take note of current performance:**
```
Message processing time: ~1-2 seconds
Direct connection (local network)
```

---

#### Step 2.2: Move the Mac

**Physical steps:**
1. Shut down Mac 2 gracefully
2. Unplug from SF network
3. Transport to new location (NY, friend's house, etc.)
4. Plug into new network (different WiFi, different ISP)
5. Power on Mac 2

**What happens automatically:**
- Mac 2 connects to new WiFi
- Tailscale daemon auto-starts
- Reconnects to Tailscale mesh
- **Same IP: 100.64.0.2** (doesn't change!)
- PM2 code doesn't notice any difference

---

#### Step 2.3: Verify It Works

**Check Tailscale status:**
```bash
# On Mac 2 (now in NY)
tailscale status
# Should still show: 100.64.0.2   online
```

**Test from PM2:**
```bash
# On your primary Mac (SF)
curl http://100.64.0.2:11434/api/version
# Should still work (now going over internet!)
```

**Monitor PM2 logs:**
```
[ROUTE] Routing message xyz789 to mac-2 (http://100.64.0.2:11434)
[SUCCESS] mac-2 processed message in 1500ms
```

**Expected changes:**
- Processing time: Slightly higher (~200-500ms more for network latency)
- Connection: Now goes through Tailscale relay (encrypted)
- **Code: No changes needed!** ✅

---

#### Step 2.4: Update Location in Config (Optional)

```typescript
// Update for documentation purposes (doesn't affect functionality)
const OLLAMA_SERVERS: OllamaServer[] = [
  {
    id: 'mac-1',
    url: 'http://100.64.0.1:11434',
    location: 'san-francisco',
    priority: 1,
    maxConcurrent: 3
  },
  {
    id: 'mac-2',
    url: 'http://100.64.0.2:11434',
    location: 'new-york',  // ← Updated for clarity
    priority: 1,
    maxConcurrent: 6
  }
];
```

---

### Phase 3: Add More Macs (Week 3+)

**Objective:** Scale to 3, 4, 5+ Macs across multiple locations

#### Step 3.1: Add Mac 3

**On the new Mac:**
```bash
# Install Ollama
curl -fsSL https://ollama.com/install.sh | sh

# Install Tailscale
brew install tailscale
sudo tailscale up
# Gets IP: 100.64.0.3

# Pull your preferred models
ollama pull llama3.2:3b-q8_0
ollama pull qwen2.5:7b-q8_0
```

**Update server list:**
```typescript
const OLLAMA_SERVERS: OllamaServer[] = [
  {
    id: 'mac-1',
    url: 'http://100.64.0.1:11434',
    location: 'san-francisco',
    priority: 1,
    maxConcurrent: 3
  },
  {
    id: 'mac-2',
    url: 'http://100.64.0.2:11434',
    location: 'new-york',
    priority: 1,
    maxConcurrent: 6
  },
  {
    id: 'mac-3',
    url: 'http://100.64.0.3:11434',
    location: 'london',
    priority: 1,
    maxConcurrent: 4
  }
];
```

**Restart PM2:**
```bash
pm2 restart ai-bot-worker
```

**That's it!** Now load balancing across 3 locations. 🌍

---

#### Step 3.2: Keep Adding Macs

**Repeat for Mac 4, 5, 6...**
- Each gets unique Tailscale IP
- Add to server list
- Restart PM2
- Done!

**Real production scenario:**
```typescript
const OLLAMA_SERVERS: OllamaServer[] = [
  // SF House (2 Macs)
  { id: 'mac-1', url: 'http://100.64.0.1:11434', location: 'sf-house' },
  { id: 'mac-2', url: 'http://100.64.0.2:11434', location: 'sf-house' },
  
  // NY Office (2 Macs)
  { id: 'mac-3', url: 'http://100.64.0.3:11434', location: 'ny-office' },
  { id: 'mac-4', url: 'http://100.64.0.4:11434', location: 'ny-office' },
  
  // London Friend's House (1 Mac)
  { id: 'mac-5', url: 'http://100.64.0.5:11434', location: 'london-friend' },
  
  // Tokyo Co-working Space (1 Mac)
  { id: 'mac-6', url: 'http://100.64.0.6:11434', location: 'tokyo-coworking' }
];
```

**6 Macs, 4 locations, zero configuration.** 🚀

---

## Advanced Features (Future Enhancements)

### Auto-Discovery with Heartbeats

Instead of hardcoding server list, have Macs self-register:

**On each Mac (simple cron job):**
```bash
# ~/.scripts/ollama-heartbeat.sh
#!/bin/bash

TAILSCALE_IP=$(tailscale ip -4)
LOCATION="san-francisco"  # Set per Mac

curl -X POST https://your-do-worker.workers.dev/api/ollama/heartbeat \
  -H "Content-Type: application/json" \
  -d "{
    \"id\": \"$(hostname)\",
    \"url\": \"http://${TAILSCALE_IP}:11434\",
    \"location\": \"${LOCATION}\",
    \"timestamp\": $(date +%s),
    \"models\": $(curl -s http://localhost:11434/api/tags | jq -c '.models[].name')
  }"
```

**Run every 30 seconds:**
```bash
# Add to crontab
* * * * * ~/.scripts/ollama-heartbeat.sh
* * * * * sleep 30 && ~/.scripts/ollama-heartbeat.sh
```

**PM2 fetches live server list:**
```typescript
async function getAvailableServers(): Promise<OllamaServer[]> {
  const response = await fetch(`${API_URL}/api/ollama/servers`);
  const servers = await response.json();
  
  // Filter to servers with recent heartbeat (<60 seconds ago)
  const now = Date.now();
  return servers.filter(s => (now - s.lastHeartbeat) < 60000);
}

// Use in main loop:
const servers = await getAvailableServers();
const server = selectOptimalServer(servers);
```

**Benefits:**
- ✅ Add Mac → Auto-discovered
- ✅ Remove Mac → Auto-removed
- ✅ Mac goes offline → Stops receiving requests
- ✅ Mac comes back online → Resumes receiving requests
- ✅ Zero manual configuration

---

### Load-Aware Routing

Track active requests per server:

```typescript
// In-memory tracking (or store in Redis for multi-worker)
const serverLoad = new Map<string, number>();

async function selectOptimalServer(servers: OllamaServer[]): Promise<OllamaServer> {
  // Sort by: Online → Least loaded → Lowest response time
  const sorted = servers
    .filter(s => isServerOnline(s))
    .sort((a, b) => {
      const loadA = serverLoad.get(a.id) || 0;
      const loadB = serverLoad.get(b.id) || 0;
      
      // Prefer server with fewer active requests
      if (loadA !== loadB) return loadA - loadB;
      
      // Then by priority
      if (a.priority !== b.priority) return a.priority - b.priority;
      
      // Then by max concurrent capacity
      return b.maxConcurrent - a.maxConcurrent;
    });
  
  return sorted[0];
}

// Track when starting request
async function processMessage(message: Comment) {
  const server = await selectOptimalServer(OLLAMA_SERVERS);
  
  serverLoad.set(server.id, (serverLoad.get(server.id) || 0) + 1);
  
  try {
    await sendToOllama(server, message);
  } finally {
    serverLoad.set(server.id, (serverLoad.get(server.id) || 0) - 1);
  }
}
```

---

### Failover and Retry

```typescript
async function processMessageWithFailover(
  message: Comment,
  maxRetries: number = 3
): Promise<void> {
  const triedServers = new Set<string>();
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      // Get servers we haven't tried yet
      const servers = await getAvailableServers();
      const available = servers.filter(s => !triedServers.has(s.id));
      
      if (available.length === 0) {
        throw new Error('All servers exhausted');
      }
      
      const server = selectOptimalServer(available);
      triedServers.add(server.id);
      
      console.log(`[RETRY] Attempt ${attempt + 1}: Using ${server.id}`);
      
      // Try to process
      await sendToOllama(server, message);
      
      // Success!
      console.log(`[SUCCESS] Message processed by ${server.id}`);
      return;
      
    } catch (error) {
      console.error(`[RETRY] Attempt ${attempt + 1} failed:`, error.message);
      
      if (attempt < maxRetries - 1) {
        await sleep(Math.pow(2, attempt) * 1000); // Exponential backoff
      }
    }
  }
  
  // All retries failed
  console.error(`[FAILED] Message ${message.id} failed after ${maxRetries} attempts`);
  await failMessage(message.id, 'All servers unavailable');
}
```

---

### Geographic Routing (Optional)

Prefer closer servers for lower latency:

```typescript
interface OllamaServer {
  id: string;
  url: string;
  location: string;
  priority: number;
  maxConcurrent: number;
  region: 'us-west' | 'us-east' | 'eu' | 'asia';  // NEW
}

function selectOptimalServer(
  servers: OllamaServer[],
  preferredRegion?: string
): OllamaServer {
  const available = servers.filter(s => isServerOnline(s));
  
  if (preferredRegion) {
    // Try to find server in preferred region
    const regional = available.filter(s => s.region === preferredRegion);
    if (regional.length > 0) {
      return selectLeastLoaded(regional);
    }
  }
  
  // Fallback to any available server
  return selectLeastLoaded(available);
}
```

---

## Cost Analysis

### Current Single-Server Setup (Local)

| Component | Cost | Notes |
|-----------|------|-------|
| Mac (owned) | $0/month | Hardware already owned |
| Ollama | $0/month | Open source, runs locally |
| PM2 | $0/month | Runs on same Mac |
| Cloudflare | ~$0-5/month | DO + Pages usage |
| **Total** | **$0-5/month** | For unlimited requests |

---

### Distributed Multi-Mac Setup (Production)

| Component | Cost | Notes |
|-----------|------|-------|
| 6x Macs (owned) | $0/month | Hardware already owned |
| Tailscale VPN | $0/month | Free tier (up to 100 devices) |
| PM2 (local) | $0/month | Runs on one Mac |
| Cloudflare | ~$0-5/month | DO + Pages usage |
| **Total** | **$0-5/month** | 6 servers, unlimited requests! |

---

### Optional: PM2 on Cloud VPS

| Component | Cost | Notes |
|-----------|------|-------|
| 6x Macs (owned) | $0/month | Hardware already owned |
| Tailscale VPN | $0/month | Free tier |
| **DigitalOcean VPS** | **$6/month** | 1GB RAM, 25GB SSD |
| PM2 Plus (logs) | $0/month | Free tier (1 server) |
| Cloudflare | ~$0-5/month | DO + Pages usage |
| **Total** | **$6-11/month** | Cloud orchestrator + 6 Macs |

---

### Comparison to Cloud AI Services

**Your distributed setup (6 Macs):**
- **Cost:** $0-11/month
- **Capacity:** ~18-30 concurrent requests
- **Models:** Any Ollama model (7B, 70B, etc.)
- **Privacy:** 100% self-hosted

**OpenAI GPT-4:**
- **Cost:** ~$90/month for 100 conversations/day
- **Capacity:** Rate limited
- **Models:** Only OpenAI models
- **Privacy:** All data goes to OpenAI

**Anthropic Claude:**
- **Cost:** ~$75/month for similar usage
- **Capacity:** Rate limited
- **Models:** Only Claude models
- **Privacy:** All data goes to Anthropic

**Your savings: 93-100%** 💰

---

## Monitoring and Observability

### PM2 Plus (Free Tier)

**Setup:**
```bash
# On your PM2 host (local Mac or VPS)
pm2 link <secret-key> <public-key>
```

**Access:** https://app.pm2.io

**Features:**
- Real-time logs
- CPU/Memory metrics
- Process health
- Error tracking
- Alert on crashes

---

### Custom Dashboard (Future)

Add Ollama server status to Queue Monitor dashboard:

**Display for each server:**
- Online/offline indicator
- Current load (requests in flight)
- Average response time
- Models loaded
- Last heartbeat time
- Location

**Example UI:**
```
Ollama Servers:
┌─────────────────────────────────────────────────┐
│ ● mac-1 (SF)       Load: 2/3   Latency: 850ms  │
│ ● mac-2 (NY)       Load: 5/6   Latency: 1200ms │
│ ● mac-3 (London)   Load: 0/4   Latency: 1500ms │
│ ○ mac-4 (Tokyo)    OFFLINE     Last: 2m ago    │
└─────────────────────────────────────────────────┘
```

---

## Security Considerations

### Tailscale Security

**What Tailscale provides:**
- ✅ **WireGuard encryption** (end-to-end)
- ✅ **Zero-trust architecture** (per-device auth)
- ✅ **No open ports** (NAT traversal built-in)
- ✅ **ACL support** (control which devices can talk)
- ✅ **MagicDNS** (easy device naming)

**What you should do:**
- ✅ Enable two-factor auth on Tailscale account
- ✅ Use ACLs to restrict which devices can access Ollama ports
- ✅ Keep Macs updated (macOS security patches)
- ✅ Don't expose Ollama publicly (Tailscale only)

---

### Ollama API Security

**Current state:**
- Ollama has no built-in authentication
- Protected by Tailscale network isolation
- Only devices on your Tailscale network can access

**Future enhancement (optional):**
- Add nginx reverse proxy with API key auth
- Use Tailscale Funnel for selective public exposure
- Implement request signing

**For now:** Tailscale isolation is sufficient for private use.

---

## Troubleshooting

### Mac Not Showing Up in Tailscale

```bash
# Check Tailscale status
tailscale status

# Check if daemon is running
sudo launchctl list | grep tailscale

# Restart Tailscale
sudo launchctl stop com.tailscale.tailscaled
sudo launchctl start com.tailscale.tailscaled

# Re-authenticate
sudo tailscale up
```

---

### Can't Connect to Ollama on Tailscale IP

```bash
# Test local Ollama
curl http://localhost:11434/api/version

# Test Tailscale IP
TAILSCALE_IP=$(tailscale ip -4)
curl http://${TAILSCALE_IP}:11434/api/version

# Check Ollama is listening on all interfaces
lsof -i :11434
# Should show: *:11434 (not 127.0.0.1:11434)
```

**Fix if needed:**
```bash
# Make Ollama listen on all interfaces
export OLLAMA_HOST=0.0.0.0:11434
ollama serve
```

---

### PM2 Worker Not Claiming Messages

```bash
# Check PM2 logs
pm2 logs ai-bot-worker

# Look for claim errors
pm2 logs ai-bot-worker --lines 100 | grep CLAIM

# Verify DO is responding
curl https://your-do-worker.workers.dev/api/comments/test/claim \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"workerId": "test", "timestamp": 1234567890}'
```

---

### Server Selection Always Picking Same Mac

```bash
# Check if both Macs are reachable
curl http://100.64.0.1:11434/api/version
curl http://100.64.0.2:11434/api/version

# Check PM2 logs for routing decisions
pm2 logs ai-bot-worker | grep ROUTE

# Verify load balancing code is enabled
# (Check selectOptimalServer function)
```

---

## Implementation Checklist

### Phase 1: Local Multi-Mac (Week 1)

- [ ] Install Tailscale on Mac 1
- [ ] Install Tailscale on Mac 2
- [ ] Verify both Macs see each other
- [ ] Update PM2 to use Tailscale IPs
- [ ] Implement message claiming in DO
- [ ] Implement server selection in PM2
- [ ] Test with both Macs on same network
- [ ] Verify no duplicate processing
- [ ] Check load distribution

### Phase 2: Move Mac (Week 2)

- [ ] Note Mac 2's Tailscale IP
- [ ] Move Mac 2 to different location
- [ ] Plug into new network
- [ ] Verify Tailscale reconnects
- [ ] Test Ollama still reachable
- [ ] Post test messages
- [ ] Verify PM2 still routes to Mac 2
- [ ] Check latency increase (expected)

### Phase 3: Scale (Week 3+)

- [ ] Add Mac 3 (install Tailscale + Ollama)
- [ ] Update server list in PM2
- [ ] Test with 3 servers
- [ ] Add Mac 4, 5, 6... (repeat)
- [ ] Verify load balancing across all
- [ ] Monitor PM2 logs for routing

### Advanced (Future)

- [ ] Implement heartbeat system
- [ ] Add auto-discovery
- [ ] Implement load-aware routing
- [ ] Add failover and retry logic
- [ ] Create monitoring dashboard
- [ ] Implement geographic routing

---

## Key Principles

**1. Location-Agnostic from Day 1**
- Use Tailscale IPs, not local IPs
- Code works anywhere, no changes needed

**2. Claiming Prevents Duplicates**
- Atomic operations in Durable Objects
- First worker wins, others skip

**3. Graceful Failover**
- Retry with different server on failure
- Timeout and try next available

**4. Observable and Debuggable**
- Comprehensive logging
- PM2 Plus for metrics
- Custom dashboard for server status

**5. Zero Configuration Mobility**
- Move Macs anywhere
- Plug in and it works
- No manual updates needed

---

## Success Metrics

**You'll know it's working when:**
- ✅ Move Mac to different location → Still processes messages
- ✅ Add new Mac → Automatically gets requests
- ✅ Remove Mac → Others pick up the load
- ✅ Post message → Distributed randomly across servers
- ✅ No duplicate responses (claiming works)
- ✅ Failover works (if one Mac down, uses another)

**Performance targets:**
- Local network: <2 seconds end-to-end
- Remote network: <3 seconds end-to-end
- Failover time: <5 seconds (detect + retry)
- Zero duplicate responses

---

## Related Documentation

- `152-QUEUE-PM2-ARCHITECTURE-REDESIGN.md` - Current PM2 setup
- `169-DURABLE-OBJECTS-MIGRATION.md` - DO queue architecture
- `163-OLLAMA-SERVER-INSTALLATION-PLAN.md` - Ollama setup guide
- `193-EQ-SCORE-GAMIFICATION.md` - EQ scoring system (runs on all Macs)

---

## Conclusion

**You're building a production-grade distributed AI cloud with:**
- Zero configuration mobility
- Zero monthly costs (or $6 for cloud PM2)
- Unlimited request capacity
- 93-100% cost savings vs. cloud AI
- Full privacy (100% self-hosted)
- Location-independent architecture

**And it's simple to implement:**
1. Install Tailscale (2 minutes per Mac)
2. Update PM2 to use Tailscale IPs (1 hour)
3. Implement claiming system (2-3 hours)
4. Test and deploy (1-2 hours)

**Total: ~1 day of work for a production-ready distributed AI cloud.** 🚀

**The best part:** It scales effortlessly. Add Mac 3, 4, 5... just install Tailscale, update the server list, and it works. No complex configuration, no infrastructure management, no ongoing maintenance.

**This is the future of self-hosted AI.** ✨
