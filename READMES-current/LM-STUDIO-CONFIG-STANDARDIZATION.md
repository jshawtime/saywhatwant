# LM Studio Server Configuration Standardization

## 📌 Issue Discovered
**Date**: September 27, 2025

### The Problem
Two LM Studio servers returning different data from `/api/v0/models`:

**10.0.0.102 (Mac Studio 1):**
- Returns: Only LOADED models (1 model)
- Clean, efficient API response
- Can't see unloaded models via API

**10.0.0.100 (Mac Studio 2):**
- Returns: ALL models (11 total - loaded + not-loaded)
- Shows everything on disk
- Creates verbose logs

## ✅ Current Impact
**MINIMAL** - Our cluster code handles both correctly by:
- Using `loadedModels` for routing (works on both)
- Not depending on `availableModels` for core logic
- Load balancing based on what's actually loaded

## 🔧 How to Standardize

### Option A: Make 10.0.0.100 Match 10.0.0.102 (Recommended)
**On Mac Studio 2 (10.0.0.100):**
1. Open LM Studio GUI
2. Go to **Developer** → **Server**
3. Find setting: **"Include unloaded models in API"** or similar
4. **UNCHECK** this option
5. Restart the server
6. Result: Only loaded models shown (cleaner logs)

### Option B: Make 10.0.0.102 Match 10.0.0.100
**On Mac Studio 1 (10.0.0.102):**
1. Open LM Studio GUI
2. Go to **Developer** → **Server**
3. Find setting: **"Include unloaded models in API"** or similar
4. **CHECK** this option
5. Restart the server
6. Result: All models shown (verbose but complete)

## 🎯 Recommendation: Option A

**Why only show loaded models?**
- ✅ Cleaner logs
- ✅ Faster API responses
- ✅ Less network traffic
- ✅ We use CLI to load models anyway

**The CLI (`lms ls --host`) shows all models when needed.**

## 📊 Verification

After standardization, both servers should return the same count:

```bash
# Should return same number on both:
curl -s http://10.0.0.102:1234/api/v0/models | jq '.data | length'
curl -s http://10.0.0.100:1234/api/v0/models | jq '.data | length'
```

## 🔍 Why This Happened

LM Studio added this setting in recent versions to let users choose between:
- **Performance** (only show loaded)
- **Transparency** (show everything)

When you updated both machines to the latest version, they may have retained different settings from their previous configs.

## 📝 Note for Future

When adding new LM Studio servers:
1. Check this setting first
2. Match existing servers' configuration
3. Document in `config-aientities.json` comments

## 🚀 No Code Changes Needed

Our cluster code is already robust enough to handle both configurations. This standardization is just for:
- Cleaner logs
- Consistent behavior
- Easier debugging