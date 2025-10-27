# 157-QUEUE-MONITOR-DASHBOARD-WORKING.md

**Tags:** #queue-monitor #dashboard #websocket #pm2-logs #auto-refresh #final  
**Created:** October 27, 2025  
**Status:** ✅ WORKING - Auto-refresh every 3s, logs persist

---

## Summary

Queue Monitor dashboard for dev machine with WebSocket connection to PM2 bot, auto-refreshing PM2 logs every 3 seconds, displaying last ~100 Claimed/Completed messages with verbose details matching COPY ALL - verbose format. Messages persist until CLEAR button clicked or PM2 recected.

---

## What Works

### WebSocket Connection
- PM2 bot runs WebSocket server on port 4002
- Dashboard connects to `ws://localhost:4002` (configured in `.env`)
- Auto-reconnects if disconnected
- No command spam (fixed infinite loop issues)

### PM2 Logs Section
- **Auto-refresh:** Every 3 seconds via WebSocket
- **Display:** Last ~100 Claimed/Completed messages
- **Format:** `✅ 2025-10-27 08:16:24 - [messageId] astrophysics → human`
- **Expandable:** Click to see full verbose details
- **Copy button:** Each item has COPY button
- **Persist:** Items stay until CLEAR or PM2 restart
- **Newest first:** Most recent at top
- **Poll counter:** Shows "POLLS between messages: N [~X mins]"

### Data Flow
```
PM2 bot → WebSocket (500 lines every 3s) → Dashboard state → Parser → Display
```

**500 lines** = enough to capture ~100 Claimed/Completed messages (each message ~5 lines)

---

## Implementation

### File: `AI-Bot-Deploy/src/websocketServer.ts`

**WebSocket server in PM2 bot:**
- Listens on port 4002
- Auto-refresh sends 500 lines every 3s
- Handles commands: `get_pm2_logs`, `clear_pm2_logs`, `get_loaded_models`

```typescript
private startAutoRefresh() {
  // Send latest 500 lines to capture ~100 messages
  this.autoRefreshInterval = setInterval(async () => {
    if (this.clients.size === 0) return;
    
    const { stdout } = await execAsync(
      'npx pm2 logs ai-bot-simple --lines 500 --nostream 2>&1 || echo ""'
    );
    
    this.broadcast({
      type: 'pm2_logs_update',
      data: stdout || ''
    });
  }, 3000);
}
```

### File: `Queue-Monitor-Deploy/src/hooks/useWebSocket.ts`

**State handling:**
- `pm2_logs`: Full fetch on mount (1000 lines)
- `pm2_logs_update`: Auto-refresh every 3s (500 lines) - REPLACES state
- Parser extracts Claimed/Completed items from entire string

```typescript
case 'pm2_logs':
  setPm2Logs(message.data || ''); // Initial fetch
  break;

case 'pm2_logs_update':
  setPm2Logs(message.data || ''); // Replace with latest 500 lines
  break;
```

### File: `Queue-Monitor-Deploy/src/App.tsx`

**Parser extracts items:**
- Filters out POLL lines (don't display)
- Groups Claimed/Completed messages
- Extracts messageId: `\[(\d{13}-[a-z0-9]+)\]` pattern
- Returns ALL items (no limit!)

```typescript
const parsedPm2Items = React.useMemo(() => {
  // Strip ANSI codes
  const cleanLogs = stripAnsi(pm2Logs);
  
  // Parse into Claimed/Completed items
  // Skip POLL lines
  // Extract messageId, entity, text
  
  return items.reverse(); // Newest first
}, [pm2Logs]);
```

**Key for forced re-render:**
```typescript
const [pm2LogsKey, setPm2LogsKey] = React.useState(0);
React.useEffect(() => {
  setPm2LogsKey(prev => prev + 1);
}, [pm2Logs]);

<div className="pm2-content" key={pm2LogsKey}>
```

---

## What Doesn't Work (Lessons Learned)

### ❌ Accumulating logs forever
- **Tried:** Append every update to growing string
- **Failed:** String grows infinitely, parsing slows down, memory issues
- **Solution:** Replace with latest 500 lines (rolling window)

### ❌ TTL-based cache expiration
- **Tried:** 3s, 10s, 60s TTL to rebuild cache
- **Failed:** Race conditions during concurrent POSTs, messages lost between expirations
- **Solution:** NO TTL - cache never expires, updated on every POST only

### ❌ Incremental updates with duplicate detection
- **Tried:** Check if new data already in prev state
- **Failed:** Check too aggressive, blocked all updates
- **Solution:** Just replace state with latest data every 3s

### ❌ Parsing messageId from first `[]` match
- **Tried:** `message.match(/\[([^\]]+)\]/)`
- **Failed:** Matched timestamp instead of messageId
- **Solution:** Specific pattern `\[(\d{13}-[a-z0-9]+)\]`

---

## Running the Dashboard

### Dev Machine Setup

**1. Create `.env` file:**
```
VITE_WS_URL=ws://localhost:4002
```

**2. Start PM2 bot:**
```bash
cd /Volumes/BOWIE/devrepo/SAYWHATWANTv1/hm-server-deployment/AI-Bot-Deploy
bash start-simple-worker.sh
```

**3. Start dashboard:**
```bash
cd /Volumes/BOWIE/devrepo/SAYWHATWANTv1/hm-server-deployment/Queue-Monitor-Deploy
bash DASHBOARD-kill-and-start.sh
```

**4. Access:** `http://localhost:5174`

---

## Architecture

**Simple and reliable:**
1. PM2 bot has WebSocket server (100 lines added to simple worker)
2. Dashboard connects on mount
3. Fetches 1000 lines once
4. Auto-refresh sends 500 lines every 3s
5. Parser extracts Claimed/Completed items
6. Key forces re-render
7. Display updates automatically

**No complexity, just works!**

---

## Status

**Date:** October 27, 2025  
**Working:** Auto-refresh, persistence, clean logs, no spam  
**Not working:** Nothing - system is solid!

---

**Files modified:**
- `AI-Bot-Deploy/src/websocketServer.ts` (WebSocket server)
- `AI-Bot-Deploy/src/index-simple.ts` (integrate WebSocket)
- `Queue-Monitor-Deploy/src/hooks/useWebSocket.ts` (state handling)
- `Queue-Monitor-Deploy/src/App.tsx` (parsing and display)
- `Queue-Monitor-Deploy/vite.config.ts` (port 5174, localhost)
- `Queue-Monitor-Deploy/.env` (WebSocket URL)

**Total:** ~200 lines added for complete working dashboard

