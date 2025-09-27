# LM Studio Configuration Standardization

## Problem Statement
The two LM Studio servers are reporting models differently via `/v1/models`:
- **Mac Studio 1 (10.0.0.102)**: Shows only LOADED models (in memory)
- **Mac Studio 2 (10.0.0.100)**: Shows ALL AVAILABLE models (on disk)

This inconsistency breaks our assumptions about model state.

## Critical Distinction
- **AVAILABLE models**: Models downloaded/stored on disk that CAN be loaded
- **LOADED models**: Models currently in GPU/RAM memory, ready for inference

## Current Code Issue
Our cluster code incorrectly assumes `/v1/models` always shows loaded models:
```typescript
server.loadedModels = new Set(data.data?.map((m: any) => m.id) || []);
```

## Solutions

### Option 1: Standardize LM Studio Settings (RECOMMENDED)
Configure both LM Studio instances identically:
1. Check LM Studio settings on both machines
2. Look for options like:
   - "Show all models in API" vs "Show only loaded models"
   - "API model visibility"
   - "Model listing behavior"
3. Set both to the same behavior

### Option 2: Detect and Adapt
Make our code smart enough to handle both behaviors:
```typescript
// Detect behavior by model count or memory usage
const modelCount = data.data?.length || 0;
const isShowingAvailable = modelCount > 3; // Heuristic

if (isShowingAvailable) {
  server.availableModels = new Set(data.data?.map((m: any) => m.id));
  // Try to detect which are actually loaded via other means
} else {
  server.loadedModels = new Set(data.data?.map((m: any) => m.id));
}
```

### Option 3: Use Additional Endpoints
Try to find LM Studio endpoints that clearly distinguish:
- `/v1/models` - All available
- `/v1/models/loaded` - Only loaded (if exists)
- Memory usage metrics to infer loaded models

## Extensibility Requirements

For true extensibility, each server must:
1. **Report consistently** - Same API behavior
2. **Be predictable** - Known model states
3. **Be manageable** - Can load/unload on demand
4. **Be monitorable** - Clear status/health

## Action Items

1. [ ] Check LM Studio settings on Mac Studio 1 (when back online)
2. [ ] Check LM Studio settings on Mac Studio 2  
3. [ ] Find setting that controls model listing behavior
4. [ ] Standardize both servers to same setting
5. [ ] Update cluster code to handle the chosen behavior
6. [ ] Document the required LM Studio configuration

## Configuration Checklist

When adding a new LM Studio server:
- [ ] Set model listing behavior to: [CHOSEN STANDARD]
- [ ] Enable CORS for all origins
- [ ] Set to listen on 0.0.0.0:1234
- [ ] Configure model directory paths
- [ ] Set memory limits appropriately
- [ ] Test `/v1/models` endpoint behavior
