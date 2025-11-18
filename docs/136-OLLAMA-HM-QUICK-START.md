# Ollama-HM Quick Start Guide
**Created:** October 22, 2025  
**Status:** Production Ready  
**Purpose:** Complete guide for setting up Ollama-HM model server on any new Mac

---

## 📋 What Is This?

Ollama-HM is a packaged Ollama backend that:
- Serves HIGHERMIND models via OpenAI-compatible API
- Dynamically generates Modelfiles from your GGUF models
- Works with any model directory containing GGUF files
- Achieves 1.67x parallel processing speedup vs LM Studio
- Zero-code-change integration with PM2 bot

**Master scripts location:** `10.0.0.100:/Volumes/Macintosh HD-1/Users/ms1281/Desktop/hm-server-deployment/`

---

## 🚀 Quick Start (5 Minutes)

### Step 1: Copy Deployment Folder
```bash
# From source machine (10.0.0.100)
cd "/Volumes/Macintosh HD-1/Users/ms1281/Desktop"
tar -czf hm-server-deployment.tar.gz hm-server-deployment/

# To new machine
scp user@10.0.0.100:"/Volumes/Macintosh HD-1/Users/ms1281/Desktop/hm-server-deployment.tar.gz" ~/Desktop/
cd ~/Desktop
tar -xzf hm-server-deployment.tar.gz
```

**What you get:**
```
hm-server-deployment/
├── AI-Bot-Deploy/           # PM2 bot source & config
├── ollama-HM/               # Ollama server scripts
└── Queue-Monitor-Deploy/    # Queue monitoring dashboard
```

### Step 2: Run Universal Setup Script
```bash
cd ~/Desktop/hm-server-deployment/ollama-HM
bash start-ollama-hm.sh
```

### Step 3: Enter Models Path When Prompted
```
📂 Models Location
==================

Enter the path to the models you want to convert to Ollama Modelfiles.
This should be a folder containing model subdirectories, each with a .gguf file.

Example: /Volumes/External/models

Path: /Volumes/HM-models/HIGHERMIND
```

**Press Enter and wait ~60 minutes for all 96 models to be created.**

---

## 📁 What's In The Deployment Folder?

```
hm-server-deployment/
├── AI-Bot-Deploy/
│   ├── src/                        # PM2 bot source code
│   ├── dist/                       # Compiled JavaScript
│   ├── config-aientities.json      # Entity configuration
│   ├── package.json
│   └── tsconfig.json
├── ollama-HM/
│   ├── start-ollama-hm.sh          # ⭐ MAIN SCRIPT - Run this!
│   ├── generate-modelfiles.sh      # Auto-generates Modelfiles
│   ├── rename-model-directories.sh # Converts @ to - in directory names
│   ├── models-path.conf            # Saved path configuration
│   ├── modelfiles/                 # Generated Modelfiles (auto-created)
│   │   ├── alcohol-addiction-f16.Modelfile
│   │   ├── alcohol-addiction-f32.Modelfile
│   │   ├── alcohol-addiction-q8_0.Modelfile
│   │   └── ... (96 total)
│   └── README.md                   # Architecture documentation
└── Queue-Monitor-Deploy/
    ├── src/                        # Queue Monitor dashboard
    ├── dist/                       # Built static files
    └── package.json
```

---

## 🎯 The Setup Process (What Happens)

### Phase 1: Install Ollama (Automatic)
```bash
# On macOS, installs via Homebrew
brew install ollama

# Verifies installation
ollama --version
```

### Phase 2: Path Configuration (Interactive)
```
Current path: /Volumes/HM-models/HIGHERMIND

Press Enter to use this path, or type a new path:
Path: [press Enter or type new path]
```

**What it does:**
- Checks if `models-path.conf` exists
- Shows current path if configured
- Lets you confirm or enter new path
- Saves to `models-path.conf` for future runs
- Validates path exists

### Phase 3: Start Ollama Server (Automatic)
```bash
# Sets environment variables
export OLLAMA_HOST=0.0.0.0:11434
export OLLAMA_MAX_LOADED_MODELS=4
export OLLAMA_NUM_PARALLEL=8
export OLLAMA_MAX_QUEUE=512

# Starts server in background
ollama serve > /tmp/ollama-hm.log 2>&1 &
```

**Why these settings:**
- `OLLAMA_HOST=0.0.0.0:11434` - Allow network access
- `OLLAMA_MAX_LOADED_MODELS=4` - Prevent OOM errors
- `OLLAMA_NUM_PARALLEL=8` - Max concurrent requests per model
- `OLLAMA_MAX_QUEUE=512` - Large queue for high throughput

**LRU Caching:** Ollama uses Least-Recently-Used caching to manage memory. With `MAX_LOADED_MODELS=4`, it automatically loads/unloads models based on usage. The 4 most recently used models stay in RAM.

### Phase 4: Generate Modelfiles (Automatic)
```bash
# Scans your models directory
for model_dir in /Volumes/HM-models/HIGHERMIND/*; do
  # Generates minimal Modelfile for each
  # Example: alcohol-addiction-f16.Modelfile
done
```

**What it generates:**
```Modelfile
FROM /Volumes/HM-models/HIGHERMIND/alcohol-addiction-f16/alcohol-addiction-f16.gguf

TEMPLATE """{{ if .System }}{{ .System }}
{{ end }}{{ if .Prompt }}[INST] {{ .Prompt }} [/INST]{{ end }}"""
```

**Key insight:** Modelfiles are MINIMAL. All configuration (system prompts, parameters) comes from `config-aientities.json` at runtime via PM2 bot.

### Phase 5: Create Ollama Models (Automatic)
```bash
# For each generated Modelfile
ollama create alcohol-addiction-f16 -f modelfiles/alcohol-addiction-f16.Modelfile

# Creates model in Ollama's registry
# Takes ~40 seconds per model
# Total time: ~60 minutes for 96 models
```

**Status indicators:**
- `⏭️` Already exists (skipped)
- `⏳` Creating... (in progress)
- `✅` Created successfully
- `❌` Failed (shows error)

### Phase 6: Verification (Automatic)
```bash
# Lists all created models
ollama list

# Shows names, IDs, sizes, modified times
```

---

## 🔄 Directory Naming Convention

**IMPORTANT:** Model directories MUST use `-` (hyphen), not `@` (at symbol).

### Correct Format:
```
alcohol-addiction-f16/
alcohol-addiction-f32/
alcohol-addiction-q8_0/
```

### Wrong Format:
```
alcohol-addiction@f16/   ❌ Causes failures
alcohol-addiction@f32/   ❌ Don't use @
```

### If You Have @ Symbols:
```bash
# Run the rename script
cd ~/Desktop/ollama-HM
bash rename-model-directories.sh

# It will convert all @ to - automatically
```

---

## 📊 Model Quantization Types

Your models directory should contain 3 quantizations per entity:

| Quantization | Size | Speed | Quality | Use Case |
|--------------|------|-------|---------|----------|
| **f16** | ~14GB | Slow | Highest | Production quality |
| **f32** | ~28GB | Slowest | Perfect | Reference/testing |
| **q8_0** | ~7GB | Fast | Good | Development/testing |

**Total:** 32 entities × 3 quantizations = **96 models**

**Example directory structure:**
```
/Volumes/HM-models/HIGHERMIND/
├── alcohol-addiction-f16/
│   └── alcohol-addiction-f16.gguf
├── alcohol-addiction-f32/
│   └── alcohol-addiction-f32.gguf
├── alcohol-addiction-q8_0/
│   └── alcohol-addiction-q8_0.gguf
├── astrophysics-f16/
│   └── astrophysics-f16.gguf
... (96 total)
```

---

## ⚙️ Configuration Files

### 1. models-path.conf
```bash
# Models Path Configuration
# Set this to the path containing your model subdirectories (each with a .gguf file)
# Example: MODELS_PATH="/Volumes/External/models"

MODELS_PATH="/Volumes/HM-models/HIGHERMIND"
```

**When to edit:**
- Moving models to different drive
- Using different model collection
- Setting up new machine

### 2. config-aientities.json (PM2 Bot)
Located at: `/Volumes/Macintosh HD-1/Users/ms1281/Desktop/AI-Bot-Deploy/config-aientities.json`

```json
{
  "id": "alcohol-addiction",
  "username": "AlcoholAddiction",
  "modelServer": "ollama-hm",
  "defaultQuantization": "q8_0",
  "quantizations": {
    "f16": {
      "modelPath": "alcohol-addiction-f16"
    },
    "f32": {
      "modelPath": "alcohol-addiction-f32"
    },
    "q8_0": {
      "modelPath": "alcohol-addiction-q8_0"
    }
  }
}
```

**Key fields:**
- `modelServer`: `"ollama-hm"` or `"lmstudio"` (explicitly set per entity)
- `modelPath`: Model name without `@` or `-` (e.g., `alcohol-addiction-f16`)
- `defaultQuantization`: Which quant to use (`f16`, `f32`, `q8_0`)

---

## 🔁 Restarting After Setup

### If Server Already Running:
```bash
cd ~/Desktop/ollama-HM
bash start-ollama-hm.sh

# You'll see:
✅ Found 96 existing Ollama models

Do you want to:
  1) Just start the server (press Enter)
  2) Rebuild all models from scratch (type 'rebuild' or '2')

Choice: [press Enter]
```

**Most common:** Just press **Enter** to start server with existing models.

### When to Rebuild:
- Changed quantization in `config-aientities.json`
- Added new models to directory
- Modelfiles got corrupted
- Switching to different model collection

---

## 🔧 PM2 Bot Integration

### How PM2 Bot Routes Requests:

1. **Bot receives message from KV**
2. **Checks entity config:**
   ```javascript
   if (entity.modelServer === 'ollama-hm') {
     // Route to Ollama
     fetch('http://localhost:11434/v1/chat/completions', { ... })
   } else {
     // Route to LM Studio
     fetch('http://10.0.0.102:1234/v1/chat/completions', { ... })
   }
   ```
3. **Ollama serves request** (loads model if needed, returns response)
4. **Bot posts response to KV**

### Starting/Updating PM2 Bot:

**From deployment root:**
```bash
cd "/Volumes/Macintosh HD-1/Users/ms1281/Desktop/hm-server-deployment"

# Rebuild and restart
cd AI-Bot-Deploy
npm run build && pm2 restart ai-bot
cd ..
```

**Or if inside `hm-server-deployment/`:**
```bash
cd AI-Bot-Deploy
npm run build && pm2 restart ai-bot
```

**Why rebuild?**
- TypeScript source (`src/index.ts`) contains Ollama routing logic
- Must compile to JavaScript (`dist/index.js`) before PM2 can run it
- Always rebuild after any code changes

**Note:** PM2 bot doesn't need to know where Modelfiles are located. It only needs:
- Ollama server running on `localhost:11434` ✅
- Model names matching `config-aientities.json` ✅
- Ollama manages model locations internally ✅

---

## 📈 Performance Expectations

### Startup Time:
- **First run:** ~60 minutes (creates 96 models)
- **Subsequent runs:** ~5 seconds (server startup only)

### Response Time:
- **Model in memory:** 1-3 seconds
- **Model needs loading:** 5-10 seconds (first request only)
- **Concurrent requests:** 1.67x speedup vs serial

### Memory Usage:
- **Per model (f16):** ~14GB
- **Per model (q8_0):** ~7GB
- **System overhead:** ~2GB
- **Max loaded models:** 4 at a time (LRU caching)

### Throughput:
- **LM Studio (serial):** ~5 messages/minute
- **Ollama (parallel):** ~8-10 messages/minute
- **With 4 models loaded:** 1.67x average speedup confirmed

---

## 🚨 Troubleshooting

### Problem: "No GGUF file found"
```bash
# Check directory structure
ls -la /Volumes/HM-models/HIGHERMIND/alcohol-addiction-f16/

# Should show:
alcohol-addiction-f16.gguf
```

**Fix:** Ensure each model subdirectory contains a `.gguf` file.

---

### Problem: "Ollama command not found"
```bash
# Check if Ollama installed
which ollama

# If not found, install manually
brew install ollama
```

---

### Problem: "Failed to create model"
```bash
# Check Ollama logs
tail -f /tmp/ollama-hm.log

# Common causes:
# - @ symbol in directory name (run rename script)
# - Corrupted GGUF file (re-download)
# - Insufficient disk space (check with df -h)
```

---

### Problem: "Models not appearing in Queue Monitor"
```bash
# Check Ollama server is running
ps aux | grep ollama

# Check Ollama is accessible
curl http://localhost:11434/api/tags

# Restart if needed
pkill ollama
cd ~/Desktop/ollama-HM
bash start-ollama-hm.sh
```

---

### Problem: "Response times slower than expected"
```bash
# Check how many models loaded
ollama list

# If more than 4 models, Ollama is thrashing
# Solution: Reduce MAX_LOADED_MODELS or use lighter quantization
```

---

## 📝 File Locations Reference

| File/Directory | Location | Purpose |
|----------------|----------|---------|
| **Master Deployment** | `10.0.0.100:/Volumes/Macintosh HD-1/Users/ms1281/Desktop/hm-server-deployment/` | Source of truth for all scripts |
| **Ollama Scripts** | `hm-server-deployment/ollama-HM/` | Server startup and Modelfile generation |
| **PM2 Bot** | `hm-server-deployment/AI-Bot-Deploy/` | Routing logic and entity config |
| **Bot Config** | `AI-Bot-Deploy/config-aientities.json` | Entity configuration with modelServer field |
| **Queue Monitor** | `hm-server-deployment/Queue-Monitor-Deploy/` | Real-time monitoring dashboard |
| **Models** | `/Volumes/HM-models/HIGHERMIND/` | GGUF files (96 models) |
| **Modelfiles** | `ollama-HM/modelfiles/` | Generated configs (96 files) |
| **Server Logs** | `/tmp/ollama-hm.log` | Ollama server output |
| **PM2 Logs** | `pm2 logs ai-bot` | Bot processing logs |

---

## 🎓 Key Concepts

### 1. Modelfiles Are Minimal
- **Only specify:** GGUF path and template
- **No hardcoded:** System prompts, parameters, quantization
- **Why:** All config comes from `config-aientities.json` at runtime
- **Benefit:** Change bot behavior without recreating models

### 2. Model Names Use Hyphens
- **Format:** `entity-name-quantization` (e.g., `alcohol-addiction-f16`)
- **Why:** The `@` symbol causes issues with shell scripts and Ollama
- **Consistency:** Matches directory naming convention

### 3. LRU Caching Is Smart
- **Ollama manages:** Loading/unloading automatically
- **You set:** `MAX_LOADED_MODELS=4`
- **Ollama decides:** Which 4 to keep in RAM based on usage
- **Result:** Optimal memory usage without manual intervention

### 4. Parallel Processing Works
- **Test #4 results:** 1.22x speedup (2 models, q8_0)
- **Test #5 results:** 1.67x average speedup (4 runs, q8_0)
- **Why:** Ollama uses concurrent request handling
- **vs LM Studio:** Serial processing only (1.0x speedup)

### 5. Directory Scanning Is Automatic
- **Script scans:** All subdirectories in models path
- **Generates:** One Modelfile per subdirectory with GGUF
- **Skips:** Non-model directories (no `-f16`, `-f32`, `-q8_0` suffix)
- **Benefit:** Add new models → just run script again

---

## 📖 Related Documentation

- **Architecture:** `135-OLLAMA-HM-PACKAGED-APP.md`
- **Testing:** `00-HYPOTHESIS-TESTING.md` (Test #4 and #5)
- **Performance:** `107-LM-STUDIO-PARALLEL-PROCESSING.md`
- **PM2 Bot:** `85-AI-BOT-SYSTEM-REFACTOR.md`
- **Deployment:** `96-DEPLOYMENT-TO-10.0.0.100.md`

---

## ✅ Success Checklist

After setup, verify:

- [ ] Ollama server responding: `curl http://localhost:11434/api/tags`
- [ ] All 96 models listed: `ollama list | wc -l` (should show 96)
- [ ] PM2 bot routing correctly: `pm2 logs ai-bot | grep "Ollama"`
- [ ] Queue Monitor shows blue badges for Ollama requests
- [ ] Response times 1-3 seconds for loaded models
- [ ] Parallel requests show 1.5x+ speedup
- [ ] Models-path.conf saved for future runs
- [ ] No `@` symbols in model directory names

---

## 🚀 Next Steps After Setup

1. **Test with PM2 Bot**
   ```bash
   # Send a message from frontend
   # Watch PM2 logs
   pm2 logs ai-bot --lines 50
   
   # Should see: [Ollama] Routing to Ollama server...
   ```

2. **Monitor Queue Monitor**
   - Open `http://10.0.0.100:5173`
   - Look for **blue badges** (Ollama)
   - Orange badges are LM Studio

3. **Verify Parallel Processing**
   - Send 2 rapid messages to different entities
   - Both should process simultaneously
   - Check response times overlap

4. **Tune Performance**
   - If OOM errors: Reduce `MAX_LOADED_MODELS`
   - If slow responses: Use lighter quantization (q8_0)
   - If high latency: Increase `NUM_PARALLEL`

---

## 🎯 Summary

**Ollama-HM is production-ready and proven:**
- ✅ 1.67x parallel speedup confirmed (Test #5)
- ✅ Zero-code-change PM2 integration
- ✅ Automatic model management (LRU caching)
- ✅ Scalable to 96+ models
- ✅ Works with external drives
- ✅ Simple setup (one script)

**To set up a new machine:**
1. Copy `hm-server-deployment/` folder from 10.0.0.100
2. Run `cd hm-server-deployment/ollama-HM && bash start-ollama-hm.sh`
3. Enter models path when prompted
4. Wait ~60 minutes for model creation
5. Start PM2 bot: `cd ../AI-Bot-Deploy && npm run build && pm2 start dist/index.js --name ai-bot`
6. Done!

**Master deployment always at:** `10.0.0.100:/Volumes/Macintosh HD-1/Users/ms1281/Desktop/hm-server-deployment/`

**Quick commands from deployment root:**
```bash
# Ollama
cd ollama-HM && bash start-ollama-hm.sh && cd ..

# PM2 Bot
cd AI-Bot-Deploy && npm run build && pm2 restart ai-bot && cd ..

# Check status
pm2 list
ollama list
```

---

*Created October 22, 2025 | Ready for Production Deployment*

