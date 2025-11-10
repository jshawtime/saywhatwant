# Cloud Hosting and Distributed Ollama Architecture

## Current Status: Local PM2 + Ollama

**Current Setup:**
- PM2 bot worker: Local machine (your Mac)
- Ollama server: `10.0.0.110:11434` (local network)
- Cloudflare: Durable Objects (queue) + Pages (frontend)

**Works fine but:**
- ❌ Dependent on local machine being online
- ❌ Single point of failure
- ❌ Can't scale across multiple locations

---

## Part 1: Cloud Hosting Options for PM2 Bot

### Does Cloudflare Provide This?

**No, not really.** Cloudflare Workers are:
- ❌ **Stateless** (can't run persistent processes like PM2)
- ❌ **Request-based** (wake up on HTTP requests, not continuous polling)
- ❌ **Limited execution time** (max 30 seconds for paid, 10ms for free)
- ❌ **No file system** (can't write logs to disk)

**What Cloudflare CAN do:**
- ✅ Durable Objects (message queue - already using)
- ✅ Workers (stateless request handlers)
- ✅ Pages (static hosting - already using)

**For PM2 bot worker, you need:**
- Long-running process (polls queue continuously)
- Access to Ollama (local or remote)
- File system access (conversation logs)
- PM2 process management

---

### Industry Standard Solutions

#### **1. VPS (Virtual Private Server) - MOST COMMON** ⭐

**Providers:**
- **DigitalOcean Droplets** ($6-12/month)
- **Linode** ($5-10/month)
- **Vultr** ($6/month)
- **Hetzner Cloud** (€4-8/month, Europe)
- **AWS EC2 t3.micro** (~$8/month)

**Why VPS is standard:**
- ✅ Full control (install PM2, Node.js, anything)
- ✅ SSH access for deployment
- ✅ Can run 24/7 background processes
- ✅ Easy to scale up (more RAM/CPU)
- ✅ Static IP for stable Ollama connection

**Log Access:**
- SSH in and run `pm2 logs`
- Use **PM2 Plus** (free for 1 server, web dashboard)
- Install log aggregation tool

---

#### **2. Serverless with Queues (Modern Alternative)**

**Option A: AWS Lambda + SQS**
- Lambda function wakes up when message in SQS queue
- Calls Ollama, posts response
- Pay per invocation (~$0.20 per 1M requests)

**Option B: Google Cloud Run + Pub/Sub**
- Similar to Lambda but with Cloud Run
- Better for longer-running tasks (up to 60 min)

**Challenges for your use case:**
- ❌ Ollama is on your local network (`10.0.0.110`)
- ❌ Would need VPN or expose Ollama publicly (security risk)
- ❌ More complex than simple VPS

---

#### **3. Container Platforms (Docker-based)**

**Providers:**
- **Fly.io** ($1.94/month for small instance)
- **Railway** ($5/month)
- **Render** (free tier available, $7/month paid)
- **Google Cloud Run** (pay per use)

**Benefits:**
- ✅ Dockerize your app (portable)
- ✅ Easy deployments (git push)
- ✅ Auto-scaling
- ✅ Built-in logging dashboards

**For your use case:**
- Would need VPN to access Ollama on `10.0.0.110`
- OR: Host Ollama publicly (not recommended)
- OR: Run everything on same network (colocate)

---

### Best Option for Current Single-Server Setup: VPS ⭐

**Why VPS makes most sense:**

1. **Ollama Access**
   - Ollama is on `10.0.0.110` (local network)
   - VPS on same network = direct access ✅
   - OR: VPS + Tailscale/WireGuard VPN for secure access

2. **Simple Deployment**
   ```bash
   # One-time setup on VPS
   ssh root@your-vps-ip
   apt update && apt install -y nodejs npm
   npm install -g pm2
   git clone <your-repo>
   cd AI-Bot-Deploy
   npm install
   pm2 start src/index-do-simple.ts --name ai-bot-worker
   pm2 save
   pm2 startup  # Auto-start on reboot
   ```

3. **Future Deployments**
   ```bash
   ssh root@your-vps-ip
   cd AI-Bot-Deploy
   git pull
   pm2 restart ai-bot-worker
   ```

---

### Log Access Solutions

#### **Option 1: PM2 Plus (Free for 1 server)** ⭐ RECOMMENDED

**Website:** https://pm2.io

**Features:**
- ✅ Real-time log streaming in web dashboard
- ✅ Process monitoring (CPU, memory, restarts)
- ✅ Alert on crashes
- ✅ Simple setup: `pm2 link <key>`
- ✅ Free for 1 server
- ✅ Access from anywhere (username/password)

**Setup:**
```bash
# On your VPS
pm2 install pm2-logrotate  # Prevent logs from filling disk
pm2 link <secret-key> <public-key>  # Get keys from pm2.io dashboard
```

**Dashboard:** Login to pm2.io → See logs, metrics, errors in real-time

---

#### **Option 2: Grafana Loki + Grafana** (Free, Self-hosted)

**What it is:**
- Log aggregation system (like Elasticsearch but lighter)
- Beautiful Grafana dashboards
- Query logs with filters

**Setup complexity:** Medium
**Cost:** Free (self-hosted on same VPS)

---

#### **Option 3: Better Stack (Logtail)** (Paid)

**Website:** https://betterstack.com/logtail

**Features:**
- ✅ Real-time log streaming
- ✅ Search, filter, alerts
- ✅ SQL-like queries
- ✅ Web dashboard with auth

**Cost:** $10-20/month for basic tier

---

### Cost Comparison

| Solution | Monthly Cost | Effort | Log Access |
|----------|--------------|--------|------------|
| **DigitalOcean VPS + PM2 Plus** | **$6** | **Low** | **Web dashboard** ⭐ |
| AWS EC2 t3.micro | $8 | Low | CloudWatch ($) |
| Fly.io | $2-5 | Medium | Web dashboard |
| Railway | $5 | Low | Web dashboard |
| Render | $7 | Low | Web dashboard |

---

## Part 2: Distributed Ollama Architecture 🌐

### Vision: Self-Hosted Distributed AI Cloud

**Goal:**
- Multiple Ollama servers on different Macs in different locations
- PM2 bot worker(s) in cloud (VPS)
- Intelligent load balancing and failover
- No duplicate processing (one message = one response)

**Example setup:**
```
Mac 1 (San Francisco):  10.0.0.110:11434  [M3 Max, 64GB RAM]
Mac 2 (New York):       45.67.89.10:11434 [M2 Ultra, 128GB RAM]
Mac 3 (London):         78.90.12.34:11434 [M1 Max, 32GB RAM]

VPS (DigitalOcean NYC): PM2 bot worker (orchestrator)
```

---

### Architecture: Centralized Orchestrator Pattern

#### **How It Works**

**1. Server Registry (Durable Objects or Redis)**

Store active Ollama servers with metadata:

```typescript
interface OllamaServer {
  id: string;                    // 'sf-mac-1', 'ny-mac-2', 'london-mac-3'
  url: string;                   // 'http://45.67.89.10:11434'
  location: string;              // 'San Francisco', 'New York', 'London'
  capabilities: {
    maxConcurrent: number;       // 3 (for M3 Max), 6 (for M2 Ultra)
    models: string[];            // ['llama3.2:3b-q8', 'qwen2.5:7b-q8']
    ram: number;                 // 64 (GB)
  };
  status: {
    online: boolean;
    lastHeartbeat: number;       // Unix timestamp
    currentLoad: number;         // 0-100%
    activeRequests: number;      // Currently processing
    queuedRequests: number;      // In server's queue
    averageResponseTime: number; // ms
  };
  priority: number;              // 1-10 (1=highest priority)
}
```

**2. Heartbeat System**

Each Ollama server sends heartbeat every 30 seconds:

```typescript
// On each Mac (simple cron job or PM2 process)
setInterval(async () => {
  const heartbeat = {
    serverId: 'sf-mac-1',
    timestamp: Date.now(),
    status: {
      online: true,
      currentLoad: getCPULoad(),
      activeRequests: getActiveRequestCount(),
      models: await getLoadedModels(), // From Ollama API
      ram: getRAMUsage()
    }
  };
  
  await fetch('https://your-do-worker.workers.dev/api/ollama/heartbeat', {
    method: 'POST',
    body: JSON.stringify(heartbeat)
  });
}, 30000);
```

**3. Message Claiming System (Prevents Duplicates)**

When PM2 worker picks up a message from DO queue:

```typescript
async function processMessage(message: Comment) {
  // STEP 1: Claim the message (atomic operation in DO)
  const claimResult = await fetch(`${API_URL}/api/comments/${message.id}/claim`, {
    method: 'POST',
    body: JSON.stringify({
      workerId: WORKER_ID,        // Unique worker identifier
      timestamp: Date.now()
    })
  });
  
  if (!claimResult.ok) {
    // Another worker already claimed it - skip!
    console.log('[QUEUE] Message already claimed by another worker');
    return;
  }
  
  // STEP 2: Select best Ollama server
  const server = await selectOptimalServer(message.botParams);
  
  // STEP 3: Send request to selected server
  const response = await sendToOllama(server, message);
  
  // STEP 4: Post response and mark complete
  await postResponse(response);
  await completeMessage(message.id);
}
```

---

### Server Selection Algorithms

#### **Algorithm 1: Round Robin (Simple)**

```typescript
let currentServerIndex = 0;

function selectOptimalServer(servers: OllamaServer[]): OllamaServer {
  const onlineServers = servers.filter(s => s.status.online);
  if (onlineServers.length === 0) throw new Error('No servers online');
  
  const selected = onlineServers[currentServerIndex % onlineServers.length];
  currentServerIndex++;
  
  return selected;
}
```

**Pros:** Simple, fair distribution
**Cons:** Doesn't consider load or capabilities

---

#### **Algorithm 2: Least Loaded (Better)**

```typescript
function selectOptimalServer(
  servers: OllamaServer[], 
  requiredModel: string
): OllamaServer {
  // Filter: Online + Has model + Not overloaded
  const available = servers.filter(s => 
    s.status.online &&
    s.capabilities.models.includes(requiredModel) &&
    s.status.activeRequests < s.capabilities.maxConcurrent
  );
  
  if (available.length === 0) {
    // Fallback: Just find any online server with model
    const fallback = servers.find(s => 
      s.status.online && 
      s.capabilities.models.includes(requiredModel)
    );
    if (!fallback) throw new Error('No servers available for model: ' + requiredModel);
    return fallback;
  }
  
  // Sort by: Priority (asc) → Active requests (asc) → Response time (asc)
  available.sort((a, b) => {
    if (a.priority !== b.priority) return a.priority - b.priority;
    if (a.status.activeRequests !== b.status.activeRequests) {
      return a.status.activeRequests - b.status.activeRequests;
    }
    return a.status.averageResponseTime - b.status.averageResponseTime;
  });
  
  return available[0];
}
```

**Pros:** Load-aware, considers capabilities
**Cons:** More complex

---

#### **Algorithm 3: Weighted Round Robin (Advanced)**

```typescript
function selectOptimalServer(
  servers: OllamaServer[],
  requiredModel: string
): OllamaServer {
  const available = servers.filter(s => 
    s.status.online &&
    s.capabilities.models.includes(requiredModel)
  );
  
  // Calculate weight for each server
  const weights = available.map(server => {
    const loadFactor = 1 - (server.status.currentLoad / 100);
    const capacityFactor = server.capabilities.maxConcurrent / 10;
    const availabilityFactor = (
      (server.capabilities.maxConcurrent - server.status.activeRequests) /
      server.capabilities.maxConcurrent
    );
    const speedFactor = 1000 / Math.max(server.status.averageResponseTime, 100);
    
    // Combined score (higher is better)
    return (
      loadFactor * 0.3 +
      capacityFactor * 0.2 +
      availabilityFactor * 0.3 +
      speedFactor * 0.2
    );
  });
  
  // Weighted random selection
  const totalWeight = weights.reduce((sum, w) => sum + w, 0);
  let random = Math.random() * totalWeight;
  
  for (let i = 0; i < available.length; i++) {
    random -= weights[i];
    if (random <= 0) return available[i];
  }
  
  return available[0]; // Fallback
}
```

**Pros:** Smart balancing, considers multiple factors
**Cons:** Most complex

---

### Message Claiming (Prevents Duplicates)

#### **Durable Objects Implementation**

Update `MessageQueue.js` to support claiming:

```javascript
// In MessageQueue class
async claimMessage(messageId, workerId) {
  // Find message in any conversation
  const keys = await this.state.storage.list({ prefix: 'conv:' });
  
  for (const key of keys.keys()) {
    const conversation = await this.state.storage.get(key);
    if (!conversation) continue;
    
    const messageIndex = conversation.findIndex(m => m.id === messageId);
    if (messageIndex === -1) continue;
    
    const message = conversation[messageIndex];
    
    // Check if already claimed
    if (message.botParams?.claimedBy) {
      return {
        success: false,
        claimedBy: message.botParams.claimedBy,
        claimedAt: message.botParams.claimedAt
      };
    }
    
    // Claim it atomically
    message.botParams = message.botParams || {};
    message.botParams.claimedBy = workerId;
    message.botParams.claimedAt = Date.now();
    message.botParams.status = 'processing';
    
    await this.state.storage.put(key, conversation);
    
    return { success: true, message };
  }
  
  return { success: false, error: 'Message not found' };
}
```

**API Endpoint:**
```javascript
// POST /api/comments/:id/claim
if (path.match(/^\/api\/comments\/[^/]+\/claim$/) && request.method === 'POST') {
  const messageId = path.split('/')[3];
  const body = await request.json();
  const result = await this.claimMessage(messageId, body.workerId);
  return this.jsonResponse(result);
}
```

---

### Failover and Retry Logic

#### **Timeout Handling**

```typescript
async function sendToOllamaWithTimeout(
  server: OllamaServer,
  payload: any,
  timeoutMs: number = 120000 // 2 minutes
): Promise<any> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  
  try {
    const response = await fetch(`${server.url}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal
    });
    
    clearTimeout(timeout);
    
    if (!response.ok) {
      throw new Error(`Ollama error: ${response.status}`);
    }
    
    return await response.json();
  } catch (error: any) {
    clearTimeout(timeout);
    
    if (error.name === 'AbortError') {
      // Timeout - mark server as slow
      await updateServerStatus(server.id, { slowResponse: true });
    }
    
    throw error;
  }
}
```

#### **Retry with Different Server**

```typescript
async function processMessageWithRetry(
  message: Comment,
  maxRetries: number = 3
): Promise<void> {
  let lastError: Error | null = null;
  const triedServers = new Set<string>();
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      // Get servers we haven't tried yet
      const allServers = await getOnlineServers();
      const availableServers = allServers.filter(s => !triedServers.has(s.id));
      
      if (availableServers.length === 0) {
        throw new Error('All servers exhausted');
      }
      
      const server = selectOptimalServer(availableServers, message.botParams.entity);
      triedServers.add(server.id);
      
      console.log(`[RETRY] Attempt ${attempt + 1}: Using server ${server.id}`);
      
      const response = await sendToOllamaWithTimeout(server, buildPayload(message));
      
      // Success! Post response
      await postResponse(response, message);
      await completeMessage(message.id);
      
      console.log(`[SUCCESS] Message ${message.id} processed by ${server.id}`);
      return;
      
    } catch (error: any) {
      lastError = error;
      console.error(`[RETRY] Attempt ${attempt + 1} failed:`, error.message);
      
      // Wait before retry (exponential backoff)
      if (attempt < maxRetries - 1) {
        await sleep(Math.pow(2, attempt) * 1000); // 1s, 2s, 4s
      }
    }
  }
  
  // All retries failed - mark message as failed
  console.error(`[FAILED] Message ${message.id} failed after ${maxRetries} attempts`);
  await failMessage(message.id, lastError?.message || 'Unknown error');
}
```

---

### Multiple PM2 Workers (Optional Advanced Setup)

You can run multiple PM2 workers in the cloud for redundancy:

```bash
# On VPS
pm2 start src/index-do-simple.ts --name ai-bot-worker-1
pm2 start src/index-do-simple.ts --name ai-bot-worker-2
pm2 start src/index-do-simple.ts --name ai-bot-worker-3
```

**Each worker:**
- Has unique `WORKER_ID` (e.g., `worker-1-abc123`)
- Polls the same DO queue
- Claims messages atomically (first one wins)
- Prevents duplicate processing via claiming system

**Benefits:**
- ✅ Redundancy (if one crashes, others continue)
- ✅ Higher throughput (3x processing capacity)
- ✅ No coordination needed (DO handles atomicity)

---

### Network Topology

#### **Option 1: All Macs on Tailscale VPN** ⭐ RECOMMENDED

```
Internet
    │
    ├─ Cloudflare (Frontend + DO Queue)
    │
    └─ VPS (PM2 Workers)
           │
           └─ Tailscale VPN Network
                  ├─ Mac 1 (SF):     100.64.0.1:11434
                  ├─ Mac 2 (NY):     100.64.0.2:11434
                  └─ Mac 3 (London): 100.64.0.3:11434
```

**Setup:**
```bash
# On each Mac
brew install tailscale
sudo tailscale up

# On VPS
curl -fsSL https://tailscale.com/install.sh | sh
sudo tailscale up

# Now all machines see each other on 100.64.x.x subnet
```

**Benefits:**
- ✅ Secure (encrypted mesh VPN)
- ✅ Simple (no firewall rules, no port forwarding)
- ✅ Works across NATs and firewalls
- ✅ Free for personal use (up to 100 devices)

---

#### **Option 2: Public IPs with HTTPS + Auth**

```
Internet
    │
    ├─ Cloudflare (Frontend + DO Queue)
    │
    └─ VPS (PM2 Workers)
           │
           └─ Internet (HTTPS)
                  ├─ Mac 1: https://ollama-sf.yourdomain.com (with API key)
                  ├─ Mac 2: https://ollama-ny.yourdomain.com (with API key)
                  └─ Mac 3: https://ollama-uk.yourdomain.com (with API key)
```

**Setup on each Mac:**
- Expose Ollama publicly (nginx reverse proxy)
- Add HTTPS with Let's Encrypt
- Add API key authentication
- Configure firewall rules

**Pros:** No VPN needed
**Cons:** More complex, security concerns, costs (domains, certs)

---

### Monitoring Dashboard

Add to Queue Monitor dashboard:

```typescript
// New section: Ollama Servers
interface ServerStatus {
  id: string;
  location: string;
  online: boolean;
  load: number;
  activeRequests: number;
  models: string[];
  lastHeartbeat: number;
}

// Display each server with:
// - Status indicator (green/red)
// - Current load bar
// - Active requests count
// - Models loaded
// - Last seen time
```

---

### Cost Analysis: Distributed Setup

| Component | Cost | Notes |
|-----------|------|-------|
| **3x Macs (you own)** | $0/month | Hardware already owned |
| **Tailscale VPN** | $0/month | Free tier (up to 100 devices) |
| **VPS (PM2 orchestrator)** | $6/month | DigitalOcean Droplet |
| **PM2 Plus (monitoring)** | $0/month | Free for 1 server |
| **Cloudflare (DO + Pages)** | ~$0-5/month | Pay-as-you-go |
| **Total** | **$6-11/month** | Scales to hundreds of requests/day |

**Compare to OpenAI:**
- GPT-4: $0.03 per 1K tokens (~$30 for 1M tokens)
- 100 conversations/day × 30 days × ~10K tokens = ~$90/month

**Your distributed setup:** ~$6/month for unlimited requests! 🎉

---

## Implementation Phases

### Phase 1: Current (Stay as is for now) ✅
- PM2 on local Mac
- Ollama on `10.0.0.110`
- Works fine for development

### Phase 2: Single Cloud VPS (Next step)
- Move PM2 to DigitalOcean VPS
- Connect to Ollama via Tailscale
- PM2 Plus for monitoring
- **Effort:** 2-3 hours
- **Cost:** $6/month

### Phase 3: Add Second Ollama Server (Future)
- Add second Mac with Ollama
- Update PM2 to poll from server list
- Add claiming system to DO
- Implement basic load balancing (round robin)
- **Effort:** 4-6 hours
- **Cost:** Still $6/month

### Phase 4: Distributed Cloud (Advanced)
- Add 3+ Ollama servers in different locations
- Implement heartbeat system
- Advanced load balancing (weighted, least loaded)
- Multiple PM2 workers for redundancy
- Full monitoring dashboard
- **Effort:** 1-2 days
- **Cost:** $6-11/month

---

## Key Takeaways

### For Now (Phase 1)
- ✅ Current setup works fine
- ✅ No cloud costs
- ✅ Keep developing and testing

### When Ready (Phase 2)
- 🎯 Move to VPS ($6/month)
- 🎯 PM2 Plus for logs
- 🎯 Tailscale for secure Ollama access
- 🎯 2-3 hours setup time

### Future Vision (Phase 3-4)
- 🚀 Distributed Ollama cloud
- 🚀 Multiple Macs in different locations
- 🚀 Automatic load balancing
- 🚀 Failover and redundancy
- 🚀 Still only ~$6-11/month!

**The beauty:** Your architecture already supports this! Just need:
1. Server registry (DO or Redis)
2. Claiming system (prevent duplicates)
3. Selection algorithm (route to best server)

All the hard work (queue, polling, context, etc.) is already done! 🎉

---

## Related Documentation
- `152-QUEUE-PM2-ARCHITECTURE-REDESIGN.md` - Current PM2 setup
- `169-DURABLE-OBJECTS-MIGRATION.md` - DO queue architecture
- `163-OLLAMA-SERVER-INSTALLATION-PLAN.md` - Ollama setup guide
- `153-CLOUDFLARE-COST-ANALYSIS.md` - Cloudflare pricing details

