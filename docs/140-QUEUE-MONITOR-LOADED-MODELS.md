# Queue Monitor: Loaded Models Section

**Date:** October 23, 2025  
**Status:** ✅ IMPLEMENTED  
**Related:** 138-QUEUE-MONITOR-VERTICAL-LAYOUT.md, 136-OLLAMA-HM-QUICK-START.md

---

## What We Had

Queue Monitor with 6 sections:
1. SYSTEM STATUS
2. QUEUE ITEMS
3. KV STORE
4. LLM SERVER REQUESTS
5. PM2 LOGS
6. DEBUG LOGS

**Problem:** No visibility into which Ollama models are currently loaded in RAM.

---

## What We Added

New section: **LOADED MODELS IN MEMORY**

**Position:** Between QUEUE ITEMS and KV STORE (section 3 of 7)

**Display:**
- Model name (e.g., "conflict-management-f16")
- Model size in GB (e.g., "13.24 GB")
- Count in header: "LOADED MODELS IN MEMORY (4/7)"

**Styling:**
- Blue color scheme (#00AAFF)
- Matches LLM SERVER layout pattern
- Collapsible and resizable

---

## How It Works

### Event-Driven Updates (Elegant, No Polling)

**Trigger:** Fetches Ollama models when `llmRequests` array changes

**Why this works:**
1. User sends message requiring a model
2. Bot routes to Ollama
3. Ollama loads model into memory (if not already loaded)
4. Bot sends `llm_request` WebSocket message to dashboard
5. Dashboard receives message, updates `llmRequests` state
6. `useEffect` watching `llmRequests` fires
7. Calls `fetchLoadedModels()`
8. Queries Ollama API: `http://10.0.0.100:11434/api/tags`
9. Updates `loadedModels` state
10. MODELS section re-renders showing current models

**Also fetches:**
- On dashboard mount (initial load)
- Shows real-time model loading/unloading

**Does NOT:**
- Poll on a timer (wasteful)
- Fetch constantly (elegant solution)

---

## Implementation Details

### Files Modified

**1. App.tsx**
- Added `loadedModels` state
- Added `fetchLoadedModels()` function
- Added event-driven useEffect on llmRequests
- Added MODELS ResizableSection (section 3)
- Renumbered sections 3-6 to 4-7

**2. global.css**
- Added LOADED MODELS SECTION
- Blue color scheme (#00AAFF, #0088DD, #003366)
- Consistent with other sections

### Ollama API

**Endpoint:** `GET http://10.0.0.100:11434/api/tags`

**Response:**
```json
{
  "models": [
    {
      "name": "conflict-management-f16",
      "size": 14175842304,
      "digest": "sha256:...",
      "modified_at": "2025-10-22T..."
    }
  ]
}
```

**Conversion:**
- `size` is in bytes
- Displayed as: `(size / 1024 / 1024 / 1024).toFixed(2)` = GB with 2 decimals

---

## CSS Classes

All styling controlled via `global.css`:

```css
.loaded-models-content       /* Container padding */
.loaded-model-item           /* Each model row */
.loaded-model-name           /* Model name (blue, 20px) */
.loaded-model-size           /* Size in GB (light blue, 18px) */
.loading-state.models-loading /* Empty state */
```

**To adjust styling:** Edit `/Queue-Monitor-Deploy/src/global.css` lines 255-285

---

## Usage

### Viewing Loaded Models

1. Open Queue Monitor: http://10.0.0.100:5174
2. Look for "LOADED MODELS IN MEMORY (X/7)" section
3. Shows models currently in Ollama's RAM
4. Click header to collapse/expand
5. Drag bottom edge to resize

### Monitoring Model Loading

1. Send message using a new entity
2. Watch the MODELS section
3. Within 1-2 seconds, new model appears in the list
4. Count updates: "(4/7)" → "(5/7)"

### Understanding the Display

**Example:**
```
conflict-management-f16          13.24 GB
the-eternal-f16                  13.18 GB
fear-and-loathing-f16            13.31 GB
ulysses-by-james-joyce-q8_0       7.02 GB
```

**Interpretation:**
- 4 models currently in RAM
- Total: ~46.75 GB used
- Capacity: 7 models max (Ollama LRU caching)
- Mix of f16 (14GB) and q8_0 (7GB) quantizations

---

## LRU Caching

Ollama uses Least-Recently-Used (LRU) caching:
- Max 7 models in RAM (set in `start-ollama-hm.sh`)
- When 8th model needed, least-used is unloaded
- Automatic, intelligent memory management
- Models section shows current state

**Memory math:**
- 7 × f16 models = 7 × 14GB = ~98GB
- 7 × q8_0 models = 7 × 7GB = ~49GB
- Mixed (common): ~70GB average
- System has 128GB total, leaves ~30GB+ for OS

---

## Troubleshooting

### Section Shows "No models loaded"

**Check Ollama status:**
```bash
ollama list
curl http://10.0.0.100:11434/api/tags
```

If Ollama isn't running:
```bash
cd ~/Desktop/hm-server-deployment/ollama-HM
bash start-ollama-hm.sh
```

### Section Doesn't Update

**Check browser console:**
- Look for `[App] Loaded models updated: X`
- Look for `Failed to fetch loaded models` errors

**Verify LLM requests are arriving:**
- Check LLM SERVER REQUESTS section has entries
- LLM requests trigger model fetches

### API Fetch Fails

**Verify Ollama API accessible:**
```bash
curl http://10.0.0.100:11434/api/tags
```

Should return JSON with models array.

---

## Benefits

✅ **Real-time visibility** - See exactly what's in RAM  
✅ **Memory monitoring** - Track model sizes and total usage  
✅ **Event-driven** - Efficient, no unnecessary polling  
✅ **Consistent UI** - Matches dashboard design  
✅ **Blue color scheme** - Distinct from other sections  
✅ **Fully interactive** - Collapse, resize, persist state  

---

## Future Enhancements

1. **Add "Last Used" timestamp** for each model
2. **Show total RAM usage** in section header
3. **Manual UNLOAD button** to free memory
4. **Model health indicators** (green/yellow/red based on usage)
5. **Sorting options** (by name, size, last used)

---

**Status:** Production Ready  
**Queue Monitor URL:** http://10.0.0.100:5174  
**Ollama API:** http://10.0.0.100:11434/api/tags

