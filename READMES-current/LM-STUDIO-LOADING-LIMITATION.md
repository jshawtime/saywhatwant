# LM Studio Model Loading Limitation

## THE PROBLEM
LM Studio does NOT provide a REST API endpoint for loading/unloading models!

### What We Need:
- Load models on demand when needed
- Unload models when memory is full
- Switch between models dynamically

### What LM Studio Provides:
- REST API can only VIEW models (loaded/not-loaded)
- REST API can only USE already-loaded models
- NO REST endpoint to load/unload

## SOLUTIONS

### Option 1: Use LM Studio SDK (BEST)
Instead of REST API, use the official SDK:
```typescript
import { LMStudioClient } from "@lmstudio/sdk";
const client = new LMStudioClient();

// Load a model
const model = await client.llm.load("highermind_the-eternal-1");

// Use it
const response = await model.complete(prompt);

// Unload when done
await model.unload();
```

### Option 2: CLI Wrapper (HACKY)
Execute CLI commands from Node:
```typescript
import { exec } from 'child_process';

function loadModel(modelName: string): Promise<void> {
  return new Promise((resolve, reject) => {
    exec(`lms load ${modelName}`, (error, stdout) => {
      if (error) reject(error);
      else resolve();
    });
  });
}
```

### Option 3: Pre-Load Strategy (CURRENT WORKAROUND)
1. Manually load required models before starting
2. Keep them loaded permanently
3. Accept the memory cost

### Option 4: Hybrid Approach
1. Use SDK for model management
2. Use REST for inference (faster)
3. Best of both worlds

## IMMEDIATE FIX NEEDED

Our current code tries to load via non-existent endpoint:
```typescript
// WRONG - This endpoint doesn't exist!
fetch(`http://${server.ip}:${server.port}/v1/models/load`)
```

We need to either:
1. Switch to SDK
2. Remove auto-loading (require manual pre-loading)
3. Implement CLI wrapper

## RECOMMENDATION

For true dynamic model management, we MUST switch from REST to SDK.
The REST API is read-only for model state!

## ARCHITECTURE CLARIFICATION

### Where the Bot Can Run
The bot can run on ANY machine that has:
- Node.js + PM2 installed
- LM Studio CLI (`lms` command) installed
- Network access to ALL LM Studio servers

### Common Misconceptions
❌ **WRONG**: Bot must run on 10.0.0.102 to route to other servers
✅ **RIGHT**: Bot can run ANYWHERE on local network

❌ **WRONG**: 10.0.0.102 is a router/gateway to other servers
✅ **RIGHT**: Each LM Studio server is independent

❌ **WRONG**: If one server dies, whole system fails
✅ **RIGHT**: Other servers continue working independently

### Network Architecture
```
Bot Machine (can be ANY local machine)
├── Direct HTTP → 10.0.0.102:1234 (Mac Studio 1)
├── Direct HTTP → 10.0.0.100:1234 (Mac Studio 2)
├── Direct CLI  → lms load --host 10.0.0.102
└── Direct CLI  → lms load --host 10.0.0.100
```

### Why "Local" Not "Cloud"
- **Cloudflare Workers** = Serverless, no CLI access
- **Local Network** = Full CLI + filesystem access
- The bot needs shell access to run `lms` commands
