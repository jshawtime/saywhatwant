# LM Studio Cluster Behavior Explained

## 📌 Date: September 27, 2025

## Load Balancing Logic

### Current Behavior: Efficiency First

The cluster uses this decision tree:

```javascript
1. Check all servers for the requested model
2. IF any server has it loaded:
   → Use that server (why load twice?)
3. IF no server has it:
   → Pick server with most free memory
   → Load model there via CLI
```

### Your Test Scenario

**Setup:**
- 10.0.0.102: Model UNLOADED (you did this manually)
- 10.0.0.100: Model LOADED

**Bot's Decision:**
```
"10.0.0.100 already has the model, use it!"
Result: 10.0.0.102 stays unloaded
```

### This is EFFICIENT but has side effects:

**Pros:**
- ✅ Avoids duplicate model loading (saves 29GB RAM)
- ✅ Faster response (no load delay)
- ✅ Less wear on SSDs

**Cons:**
- ❌ Unbalanced server usage
- ❌ Manual unloads don't trigger reloads
- ❌ One server may handle all traffic

## Alternative Strategies

### Option A: Force Distribution (Current: NO)
```javascript
// Even if one server has it, load on others
if (!server.loadedModels.has(modelName)) {
    loadModel(); // Always load for balance
}
```

### Option B: Minimum Replicas (Current: NO)
```javascript
// Ensure at least N servers have model
const minReplicas = 2;
if (serversWithModel.length < minReplicas) {
    loadOnMoreServers();
}
```

### Option C: Load on Demand per Server (Current: YES)
```javascript
// Only load if NO server has it
if (serversWithModel.length === 0) {
    loadOnBestServer();
}
```

## Testing Auto-Load

### When auto-load WILL trigger:
1. Unload from ALL servers
2. Send a request
3. Bot picks best server (most memory)
4. Loads model via CLI
5. Processes request

### When auto-load WON'T trigger:
1. Unload from SOME servers
2. At least ONE still has model
3. Bot uses the loaded one
4. Others stay unloaded

## Real-World Implications

### For 2 Servers:
- If one crashes → other auto-loads
- If you manually unload one → uses other
- If both unloaded → auto-loads on best

### For 10 Servers:
- As long as ONE has model → no new loads
- Efficient but potentially unbalanced
- Manual intervention needed for rebalance

## Cosmetic Fix for Logs

To make both servers show ALL models in logs:

**On 10.0.0.102:**
1. Open LM Studio GUI
2. Developer → Server
3. CHECK "Show unloaded models in API"
4. Restart server

This makes logs consistent but doesn't change behavior.
