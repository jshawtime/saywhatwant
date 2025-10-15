# 81. Queue Monitor - Config Version Display Fix

## Date: October 14, 2025

## Issue
The Entity Config version (e.g., "ENTITY CONFIG: v0.1 - PHASE 1") was disappearing from the queue monitor header after messages were processed.

### Symptoms
1. On page load: Version displays correctly
2. After first message processed: Version disappears
3. Only "AI QUEUE MONITOR v1.0" remains visible

## Root Cause

The issue was in the WebSocket stats update handler in `dashboards/queue-monitor/src/hooks/useWebSocket.ts`:

```typescript
case 'stats':
  setStats(message.data);  // ❌ This completely replaced the stats object
  break;
```

### What Happened
1. **Initial Load**: WebSocket sends `snapshot` message with full stats including `configVersion`
2. **Message Processed**: WebSocket sends `stats` update with queue metrics
3. **Problem**: The stats update didn't include `configVersion`, so it was lost
4. **Result**: Config version disappeared from the header

## Solution

Modified the stats update handler to preserve the `configVersion` field:

```typescript
case 'stats':
  console.log('[Dashboard] Updating stats:', message.data);
  // Preserve configVersion when updating stats
  setStats(prev => ({
    ...message.data,
    configVersion: prev.configVersion || message.data.configVersion
  }));
  break;
```

### How This Works
1. Merge new stats with previous configVersion
2. Falls back to new configVersion if present in update
3. Ensures configVersion persists across all stats updates

## Files Changed

### 1. `/dashboards/queue-monitor/src/hooks/useWebSocket.ts` (line 79-86)
**Before:**
```typescript
case 'stats':
  console.log('[Dashboard] Updating stats:', message.data);
  setStats(message.data);
  break;
```

**After:**
```typescript
case 'stats':
  console.log('[Dashboard] Updating stats:', message.data);
  // Preserve configVersion when updating stats
  setStats(prev => ({
    ...message.data,
    configVersion: prev.configVersion || message.data.configVersion
  }));
  break;
```

## Testing

### Verify the Fix
1. Open queue monitor: `http://localhost:5173` (or your queue monitor URL)
2. Check header shows: `ENTITY CONFIG: v0.1 - PHASE 1`
3. Send a message and wait for processing
4. Verify config version still displays after processing

### Expected Behavior
- Config version should persist throughout the entire session
- Version should survive WebSocket reconnections (snapshot includes it)
- Version should update if config is hot-reloaded and sends new version

## Related Components

### Header Component
The header displays configVersion when available:

```typescript
// Header.tsx lines 17-26
{configVersion && (
  <div style={{ 
    fontSize: '28px', 
    color: '#00ff00',
    fontWeight: 'bold',
    letterSpacing: '3px',
    marginBottom: '4px'
  }}>
    ENTITY CONFIG: {configVersion}
  </div>
)}
```

### WebSocket Stats Updates
The bot sends stats updates from `src/modules/websocketServer.ts`:

```typescript
pushStats() {
  const stats = this.queueService.getStats();
  const now = Date.now();
  this.throughputTracker = this.throughputTracker.filter(t => now - t < 3600000);

  this.broadcast({
    type: 'stats',
    data: {
      ...stats,
      throughputHour: Math.round(this.throughputTracker.length / 60),
      lastSuccess: this.lastSuccessTime
      // Note: configVersion not included in regular stats updates
    },
    timestamp: Date.now()
  });
}
```

## Design Pattern

This fix demonstrates the **State Preservation Pattern** for WebSocket updates:

### Best Practice
```typescript
// ✅ GOOD: Merge updates, preserve important fields
setStats(prev => ({
  ...message.data,
  configVersion: prev.configVersion || message.data.configVersion
}));

// ❌ BAD: Replace entire object, lose important fields
setStats(message.data);
```

### When to Use
Use this pattern when:
1. WebSocket sends partial updates
2. Some fields should persist across updates
3. Initial snapshot has fields not in subsequent updates
4. Client-side state needs to be preserved

## Alternative Solutions Considered

### Option 1: Always Include configVersion in Stats Updates
**Pros:** Explicit, no client-side logic needed  
**Cons:** Redundant data in every stats update, backend complexity  
**Decision:** Not chosen - client-side preservation is cleaner

### Option 2: Separate State for configVersion
**Pros:** Clear separation of concerns  
**Cons:** More complex state management, two subscriptions needed  
**Decision:** Not chosen - keeps configVersion in stats where it belongs

### Option 3: Only Send configVersion on Snapshot
**Pros:** Minimal bandwidth, clear intent  
**Cons:** Client must preserve it (current solution)  
**Decision:** ✅ **CHOSEN** - Simple, efficient, clear

## Deployment

### Build Steps
```bash
cd /Users/pbmacstudiomain/devrepo/SAYWHATWANTv1/saywhatwant/dashboards/queue-monitor
npm run build
```

### Deploy to App
```bash
cp -r dist/* ../../app/queue-monitor/
```

### Git Commit
```bash
git add dashboards/queue-monitor/src/hooks/useWebSocket.ts app/queue-monitor/
git commit -m "fix: Preserve configVersion in queue monitor when stats update"
git push origin main
```

## Status
✅ **FIXED** - Config version now persists across all stats updates

## Key Learnings

1. **WebSocket Partial Updates**: Not all updates include all fields
2. **State Preservation**: Client must preserve important fields across updates
3. **Merge vs Replace**: Use spread operator to merge updates safely
4. **Testing Visual Components**: Always test across full user flow, not just initial load
5. **Build Pipeline**: Remember to rebuild and copy to app directory for deployment

## Related Issues
- None - this was a newly discovered visual regression

## Future Improvements
Consider adding:
1. Config version change detection (notify user if version changes)
2. Visual indicator when config is hot-reloaded
3. Timestamp showing when config was last loaded
4. Config hash/checksum for verification
