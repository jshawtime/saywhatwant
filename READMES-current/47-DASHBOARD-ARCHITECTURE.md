# 🖥️ Professional Queue Dashboard Architecture

## 📌 Version
- **Date**: October 4, 2025
- **Version**: v1.0
- **Status**: Implementation Phase
- **Philosophy**: Build for scale, optimize for clarity, design for expansion

## 🎯 Executive Summary

A professional, real-time queue monitoring dashboard built with React + TypeScript + WebSocket. Designed for an 85" monitor with authentic 1980s green terminal aesthetic. Scalable architecture ready for expansion to comprehensive bot management system.

## 🏗️ Technology Stack

### Frontend
- **Framework**: React 18 (component-based, scalable)
- **Language**: TypeScript (type safety, better DX)
- **Build Tool**: Vite (instant HMR, fast builds)
- **Styling**: CSS Modules (scoped, maintainable)
- **Real-time**: WebSocket (ws library, instant updates)

### Backend (Bot Integration)
- **Protocol**: WebSocket Server (port 4002)
- **Library**: `ws` (battle-tested, production-ready)
- **Events**: Push-based (no polling waste)
- **Commands**: Bidirectional (dashboard controls bot)

### Why This Stack

| Decision | Rationale |
|----------|-----------|
| **React** | Complex state management, component reuse, scales infinitely |
| **TypeScript** | Catch errors at compile time, better refactoring, IntelliSense |
| **Vite** | 10x faster than Webpack, instant hot reload, modern |
| **WebSocket** | True real-time, efficient, scalable to 100+ clients |
| **CSS Modules** | Scoped styles, no conflicts, maintainable |

## 📐 Architecture Decisions

### WebSocket vs HTTP Polling

**HTTP Polling (Rejected)**:
```
Pros: Simple, works everywhere
Cons: 
  - 3-second lag (not real-time)
  - Wastes bandwidth (polls even when nothing changes)
  - Scales poorly (N clients = N × polling requests)
  - Can't push bot commands easily
```

**WebSocket (Selected)**:
```
Pros:
  - Instant updates (0ms lag)
  - Efficient (server pushes only changes)
  - Scales beautifully (1 change = 1 broadcast to all)
  - Bidirectional (dashboard can control bot)
  - Event-driven (perfect for queue events)
  
Cons:
  - Slightly more setup (worth it for benefits)
  - Requires persistent connection (fine for local dashboard)
```

**Decision**: WebSocket for professional, scalable solution.

### React vs Vanilla HTML

**Vanilla HTML (Old Dashboard)**:
```
Pros: Simple for basic display
Cons:
  - Manual DOM manipulation (error-prone)
  - No component reuse
  - No type safety
  - Gets messy with complex state
  - Hard to maintain as features grow
```

**React + TypeScript (Selected)**:
```
Pros:
  - Automatic re-renders
  - Component reuse (build once, use many times)
  - Type safety catches bugs
  - Clean data flow
  - Easy to add features
  - Industry standard
  
Cons:
  - Initial setup time (worth it long-term)
```

**Decision**: React + TS for maintainable, scalable dashboard.

## 🎨 Design Specifications

### 1980s Terminal Aesthetic (Crisp & Clean)

**Visual Style**:
- **Font**: VT323 (authentic terminal monospace)
- **Colors**:
  - Background: Pure black (#000000)
  - Text: Pure green (#00FF00)
  - Borders: Green (#00FF00)
  - Highlights: Bright green (#00FF00)
- **NO glow, NO blur, NO shadows** - Crisp pixels only
- **CRT effects**: Optional scanline overlay (subtle)
- **Cursor**: Blinking block █
- **Borders**: ASCII-style boxes ┌─┐

**Layout for 85" Monitor**:
```
┌────────────────────────────────────────────────────────────┐
│ HEADER: Title | Clock | Connection Status                   │
├──────────┬────────────────────────────────────┬────────────┤
│          │                                    │            │
│  LEFT    │         CENTER (MAIN)              │   RIGHT    │
│  PANEL   │                                    │   PANEL    │
│          │    QUEUE ITEMS LIST                │            │
│  System  │    (Scrollable)                    │  Live      │
│  Info    │                                    │  Stats     │
│          │    #1 P5  Entity  "msg..."  [DEL]  │            │
│  Priority│    #2 P10 Entity  "msg..."  [DEL]  │  Actions   │
│  Bands   │    #3 P25 Entity  "msg..."  [DEL]  │            │
│          │                                    │  Quick     │
│  Launch  │    [DANGER: CLEAR ALL]             │  Links     │
│  Cmd     │                                    │            │
│          │                                    │            │
│  400px   │         Flex-grow                  │   500px    │
├──────────┴────────────────────────────────────┴────────────┤
│ FOOTER: Status | Last Update | System Operational          │
└────────────────────────────────────────────────────────────┘
```

**Grid Layout**:
- 3-column: 400px | 1fr | 500px
- No vertical scroll (single screen)
- Center panel scrolls (queue items)
- Maximizes 85" screen real estate

## 📦 Directory Structure

```
dashboards/queue-monitor/
├── package.json
├── vite.config.ts
├── tsconfig.json
├── index.html
├── public/
│   └── (static assets)
├── src/
│   ├── main.tsx              ← Entry point
│   ├── App.tsx                ← Main app component
│   ├── App.module.css         ← Terminal theme styles
│   │
│   ├── components/
│   │   ├── Header.tsx         ← Title, clock, connection
│   │   ├── LeftPanel.tsx      ← System info, priority bands
│   │   ├── QueueList.tsx      ← Center: Queue items (MAIN)
│   │   ├── RightPanel.tsx     ← Stats, actions, links
│   │   ├── Footer.tsx         ← Status bar
│   │   ├── QueueItem.tsx      ← Single queue item row
│   │   └── StatsCard.tsx      ← Reusable stat display
│   │
│   ├── hooks/
│   │   ├── useWebSocket.ts    ← WebSocket connection
│   │   ├── useQueueData.ts    ← Queue state management
│   │   └── useClock.ts        ← Real-time clock
│   │
│   ├── lib/
│   │   ├── websocket.ts       ← WebSocket client utilities
│   │   ├── formatters.ts      ← Time ago, numbers, etc.
│   │   └── types.ts           ← TypeScript interfaces
│   │
│   └── styles/
│       ├── terminal.module.css  ← 1980s theme
│       └── layout.module.css    ← Grid layout
```

## 🔌 WebSocket Protocol Design

### Connection
```
Dashboard → ws://localhost:4002
Bot ← Accepts connection
Bot → Sends initial state snapshot
```

### Event Types (Bot → Dashboard)

```typescript
interface WebSocketMessage {
  type: 'snapshot' | 'queued' | 'claimed' | 'completed' | 'deleted' | 'stats';
  data: any;
  timestamp: number;
}

// Initial connection
{
  type: 'snapshot',
  data: {
    queue: QueueItem[],
    stats: QueueStats,
    servers: ServerStatus[]
  }
}

// Item queued
{
  type: 'queued',
  data: {
    item: QueueItem
  }
}

// Item claimed by worker
{
  type: 'claimed',
  data: {
    itemId: string,
    serverId: string
  }
}

// Item completed
{
  type: 'completed',
  data: {
    itemId: string,
    success: boolean
  }
}

// Stats update
{
  type: 'stats',
  data: QueueStats
}
```

### Commands (Dashboard → Bot)

```typescript
// Delete queue item
{
  action: 'delete',
  itemId: string
}

// Clear entire queue
{
  action: 'clear'
}

// Pause queue processing
{
  action: 'pause'
}

// Resume queue processing
{
  action: 'resume'
}
```

## 📊 Features Implementation

### Phase 1: Core Features (Current Session) ✅

**Queue Monitoring**:
- ✅ Queue items list (scrollable, ordered by priority)
- ✅ Each item shows: #, priority, entity, message preview
- ✅ Delete button per item
- ✅ Clear all button (DANGER)
- ✅ Real-time updates via WebSocket
- ✅ Processing status (waiting/processing)
- ✅ Color-coded priorities

**Live Statistics**:
- ✅ Total items
- ✅ Unclaimed count
- ✅ Processing count
- ✅ Throughput (messages/minute, rolling hour average)
- ✅ Last successful post (time ago: 45s, 3m, 2h)
- ✅ Average wait time
- ✅ Priority distribution (5 bands)

**System Information**:
- ✅ Bot location
- ✅ LM Studio servers
- ✅ API endpoint
- ✅ Queue/Router status
- ✅ Polling interval

### Phase 2: Metrics & Analytics (Placeholders)

**Entity Performance Metrics** 📊:
```typescript
interface EntityMetrics {
  entityId: string;
  messagesProcessed: number;
  averageResponseTime: number;
  successRate: number;
  lastActive: number;
  priorityDistribution: number[];
}

// Display:
- Table of all entities
- Response times
- Success rates
- Activity heatmap
```

**LM Studio Server Health** 🖥️:
```typescript
interface ServerHealth {
  ip: string;
  status: 'online' | 'offline' | 'degraded';
  loadedModels: string[];
  memoryUsed: number;
  memoryFree: number;
  requestsProcessed: number;
  averageLatency: number;
  errorRate: number;
}

// Display:
- Server grid with health indicators
- Memory usage bars
- Model lists per server
- Latency graphs
```

**Traffic Analytics**:
```typescript
interface TrafficStats {
  messagesReceived: {
    perHour: number;
    perDay: number;
    trend: 'up' | 'down' | 'stable';
  };
  messagesSent: {
    perHour: number;
    perDay: number;
    trend: 'up' | 'down' | 'stable';
  };
  humanMessages: {
    perHour: number;
  };
  aiMessages: {
    perHour: number;
  };
}

// Display:
- Traffic graphs (sparklines)
- Rolling averages
- Trend indicators
```

**Cost & Usage Tracking** 💰:
```typescript
interface CostTracking {
  llmCalls: number;
  tokensUsed: number;
  estimatedCost: number;
  costPerMessage: number;
  projectedMonthly: number;
}

// Display:
- Cost meters
- Token usage
- Projections
- Efficiency metrics
```

### Phase 3: Controls & Configuration (Placeholders)

**Alerts & Notifications** 🔔:
```typescript
interface Alert {
  id: string;
  severity: 'critical' | 'warning' | 'info';
  message: string;
  timestamp: number;
  acknowledged: boolean;
}

// Features:
- Alert feed
- Desktop notifications
- Sound alerts (optional)
- Acknowledge button
```

**Configuration Editor** ⚙️:
```typescript
// Live editing:
- Entity enable/disable
- Priority thresholds
- Rate limits
- Polling intervals
- Model assignments

// Save to config file
// Reload bot without restart
```

## 🔧 Implementation Plan

### Step 1: Project Setup (10 min)
- [x] Create dashboards/queue-monitor directory
- [x] Initialize package.json
- [x] Add Vite + React + TypeScript
- [ ] Install dependencies

### Step 2: WebSocket Backend (30 min)
- [ ] Replace queueHTTPServer with websocketServer.ts
- [ ] Implement event broadcasting
- [ ] Add command handling
- [ ] Test connection

### Step 3: React Components (60 min)
- [ ] Create main App component
- [ ] Build Header (title, clock, connection)
- [ ] Build LeftPanel (system info, bands)
- [ ] Build QueueList (main feature)
- [ ] Build RightPanel (stats, actions)
- [ ] Build Footer (status bar)
- [ ] Create QueueItem component
- [ ] Create StatsCard component

### Step 4: WebSocket Hook (20 min)
- [ ] useWebSocket hook
- [ ] Connection management
- [ ] Event handling
- [ ] Reconnection logic
- [ ] Command sending

### Step 5: Styling (30 min)
- [ ] 1980s terminal theme (CSS Modules)
- [ ] Grid layout
- [ ] Crisp text (no glow, no blur)
- [ ] Color-coded priorities
- [ ] Responsive to 85" monitor

### Step 6: Integration & Testing (20 min)
- [ ] Connect to bot WebSocket
- [ ] Test real-time updates
- [ ] Test delete functionality
- [ ] Test clear queue
- [ ] Verify all stats

### Step 7: Future Placeholders (20 min)
- [ ] Entity metrics section (placeholder)
- [ ] Server health section (placeholder)
- [ ] Traffic analytics (placeholder)
- [ ] Cost tracking (placeholder)
- [ ] Alerts section (placeholder)
- [ ] Config editor (placeholder)

**Total Time**: ~3 hours for complete professional dashboard

## 📋 Feature Specifications

### Queue Items List (Center Panel - Main Feature)

**Requirements**:
1. Scrollable vertical list
2. Items ordered by priority (highest at top = #1)
3. Each item shows:
   - Queue position (#1, #2, #3...)
   - Priority value (P5, P10, P25...)
   - Entity ID (philosopher, tech, sage...)
   - Message preview (truncated to ~60 chars)
   - Status ([WAIT] or [PROC])
   - Delete button [X]
4. Color-coded by priority:
   - 0-10: Red
   - 11-30: Yellow
   - 31-60: Cyan
   - 61-90: Green
   - 91-99: Gray
5. Real-time updates (items appear/disappear instantly)
6. Smooth animations
7. Click delete → Confirm → Remove from queue

**Data Flow**:
```
Bot queues item
    ↓
WebSocket: {type: 'queued', data: item}
    ↓
Dashboard: Adds to list, re-sorts
    ↓
Worker claims item
    ↓
WebSocket: {type: 'claimed', data: {itemId, serverId}}
    ↓
Dashboard: Updates item status to [PROC]
    ↓
Worker completes
    ↓
WebSocket: {type: 'completed', data: {itemId}}
    ↓
Dashboard: Removes from list with animation
```

### Live Statistics (Right Panel)

**Core Stats**:
```typescript
interface LiveStats {
  // Queue State
  totalItems: number;
  unclaimedItems: number;
  claimedItems: number;
  
  // Performance
  throughputHour: number;      // Rolling hour average
  averageWaitTime: number;     // ms
  lastSuccessTime: number;     // timestamp
  
  // Traffic (NEW)
  messagesReceivedPerHour: number;
  messagesSentPerHour: number;
  humanMessagesPerHour: number;
  
  // Priority Distribution
  priorityBands: {
    critical: number;
    high: number;
    medium: number;
    low: number;
    background: number;
  };
}
```

**Display Format**:
```
TOTAL_ITEMS:    50
UNCLAIMED:      35
PROCESSING:     15
THROUGHPUT:     12/min
LAST_POST:      45s
AVG_WAIT:       2.3s

MSG_RECV/HR:    120
MSG_SENT/HR:    45
HUMAN_MSG/HR:   75
```

### Actions (Right Panel)

**Quick Links**:
```
[ AI CONSOLE ]       → https://saywhatwant.app/ai-console
[ QUEUE MONITOR ]    → https://saywhatwant.app/queue-monitor  
[ MAIN APP ]         → https://saywhatwant.app/
```

**Queue Controls**:
```
[ PAUSE QUEUE ]      → Send WebSocket command
[ RESUME QUEUE ]     → Send WebSocket command
[ DANGER: CLEAR ]    → Clear all with confirmation
```

### System Information (Left Panel)

**Current Values**:
```
BOT_LOC:      ~/ai
LM_SRV_1:     10.0.0.102:1234
LM_SRV_2:     10.0.0.100:1234
API_HOST:     bootloaders.workers.dev
POLL_INT:     30s
QUEUE_SYS:    ENABLED
ROUTER:       DISABLED
```

**Priority Bands**:
```
█ CRITICAL (0-10):    5
█ HIGH (11-30):       12
█ MEDIUM (31-60):     25
█ LOW (61-90):        8
█ BG (91-99):         0
```

## 🔐 WebSocket Server Implementation

### Bot-Side (websocketServer.ts)

```typescript
import { WebSocketServer, WebSocket } from 'ws';

class QueueWebSocketServer {
  private wss: WebSocketServer;
  private clients: Set<WebSocket> = new Set();
  private queueService: QueueService;
  
  constructor(queueService: QueueService, port = 4002) {
    this.queueService = queueService;
    this.wss = new WebSocketServer({ port });
    this.setupHandlers();
  }
  
  private setupHandlers() {
    this.wss.on('connection', (ws) => {
      console.log('[WebSocket] Client connected');
      this.clients.add(ws);
      
      // Send initial snapshot
      this.sendSnapshot(ws);
      
      // Handle messages from client
      ws.on('message', (data) => {
        this.handleCommand(JSON.parse(data.toString()));
      });
      
      // Handle disconnect
      ws.on('close', () => {
        this.clients.delete(ws);
        console.log('[WebSocket] Client disconnected');
      });
    });
  }
  
  // Broadcast to all connected clients
  broadcast(event: WebSocketMessage) {
    const message = JSON.stringify(event);
    this.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  }
  
  // Event methods (called by bot)
  onQueued(item: QueueItem) {
    this.broadcast({
      type: 'queued',
      data: { item },
      timestamp: Date.now()
    });
  }
  
  onClaimed(itemId: string, serverId: string) {
    this.broadcast({
      type: 'claimed',
      data: { itemId, serverId },
      timestamp: Date.now()
    });
  }
  
  onCompleted(itemId: string, success: boolean) {
    this.broadcast({
      type: 'completed',
      data: { itemId, success },
      timestamp: Date.now()
    });
  }
}
```

### Dashboard-Side (useWebSocket.ts)

```typescript
function useWebSocket(url: string) {
  const [connected, setConnected] = useState(false);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [stats, setStats] = useState<QueueStats>(initialStats);
  const wsRef = useRef<WebSocket | null>(null);
  
  useEffect(() => {
    const ws = new WebSocket(url);
    
    ws.onopen = () => {
      console.log('Connected to bot');
      setConnected(true);
    };
    
    ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      handleMessage(message);
    };
    
    ws.onclose = () => {
      console.log('Disconnected');
      setConnected(false);
      // Auto-reconnect after 3 seconds
      setTimeout(() => {
        // Reconnect logic
      }, 3000);
    };
    
    wsRef.current = ws;
    return () => ws.close();
  }, [url]);
  
  const sendCommand = (action: string, data?: any) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ action, data }));
    }
  };
  
  return { connected, queue, stats, sendCommand };
}
```

## 🎨 CSS Modules (1980s Terminal Theme)

### terminal.module.css

```css
/* Crisp, clean - NO glow, NO blur */

.terminal {
  font-family: 'VT323', monospace;
  background: #000000;
  color: #00FF00;
  font-size: 20px;
  line-height: 1.2;
  /* NO text-shadow */
  /* NO blur */
  /* NO glow */
}

.border {
  border: 2px solid #00FF00;
}

.panel {
  background: #000000;
  border: 1px solid #00FF00;
}

.title {
  color: #00FF00;
  font-size: 32px;
  /* Optional: subtle flicker */
  animation: flicker 3s infinite;
}

.blink {
  animation: blink 1s step-end infinite;
}

@keyframes blink {
  0%, 50% { opacity: 1; }
  51%, 100% { opacity: 0; }
}

@keyframes flicker {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.97; }
}

/* Priority colors (crisp, no glow) */
.priorityCritical { color: #FF0000; border-color: #FF0000; }
.priorityHigh { color: #FFFF00; border-color: #FFFF00; }
.priorityMedium { color: #00FFFF; border-color: #00FFFF; }
.priorityLow { color: #00FF00; border-color: #00FF00; }
.priorityBg { color: #666666; border-color: #666666; }

/* Scrollbars */
::-webkit-scrollbar {
  width: 10px;
  background: #000000;
}

::-webkit-scrollbar-thumb {
  background: #00FF00;
  border: 1px solid #000000;
}
```

## 🔢 Data Calculations

### Rolling Hour Average

```typescript
// Track last hour of completions
const completions: number[] = [];  // timestamps

function recordCompletion() {
  completions.push(Date.now());
  
  // Keep only last hour
  const oneHourAgo = Date.now() - 3600000;
  completions = completions.filter(t => t > oneHourAgo);
}

function getHourlyRate(): number {
  // completions in last hour / 60 minutes
  return Math.round(completions.length / 60);
}
```

### Time Ago Formatting

```typescript
function timeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
  return `${Math.floor(seconds / 86400)}d`;
}
```

## 🚀 Deployment

### Development
```bash
# Terminal 1: Start bot (includes WebSocket server)
cd saywhatwant/ai
npm run dev

# Terminal 2: Start dashboard
cd dashboards/queue-monitor
npm run dev
```

Dashboard opens at: http://localhost:5173

### Production
```bash
# Build dashboard
cd dashboards/queue-monitor
npm run build

# Serve built files
npx serve dist -p 5173
```

Or host the built files anywhere (they're static HTML/JS/CSS).

## 🔮 Future Expansion Path

The dashboard is designed to grow. Future additions:

### Easy to Add (same pattern):
1. **New panels**: Just add components
2. **New stats**: Extend WebSocket messages
3. **New commands**: Add to command handler
4. **New views**: React Router for multi-page

### Examples of Future Features:
- **Conversation Visualizer**: See message flows
- **Entity Personality Editor**: Adjust on the fly
- **A/B Testing Dashboard**: Compare entity performance
- **Model Benchmark**: Test different models
- **Cost Optimizer**: Find most efficient configs
- **Multi-Bot Coordinator**: Manage 10+ bot instances

The React + TypeScript + WebSocket foundation supports ALL of this easily.

## 📊 Success Criteria

- ✅ Loads in < 1 second
- ✅ Real-time updates (< 100ms latency)
- ✅ Handles 1000+ queue items smoothly
- ✅ Clean 1980s terminal aesthetic
- ✅ Responsive to 85" monitor
- ✅ Delete/clear operations work instantly
- ✅ Auto-reconnects on disconnect
- ✅ Type-safe throughout (no runtime errors)

## 🎓 Why This Architecture Matters

### For You (Right Now):
- Professional queue monitoring
- Instant feedback on bot behavior
- Delete/clear queue capabilities
- Beautiful on your 85" monitor
- Crisp, clean, authentic terminal look

### For The Future:
- Easy to add features (component-based)
- Scales to complex dashboards
- Type-safe (catches bugs before runtime)
- Real-time (no polling lag)
- Maintainable (organized, modular)

### For The Platform:
- Foundation for comprehensive bot management
- Can expand to multi-bot coordination
- Supports advanced features (alerts, config editing)
- Professional appearance
- Production-ready architecture

---

**Status**: Ready for Implementation
**Next Step**: Follow this README to build the complete dashboard
**Estimated Time**: 3 hours
**Result**: Professional, scalable dashboard foundation

*"Build it right the first time. The dashboard will grow - make sure the foundation is solid."*
