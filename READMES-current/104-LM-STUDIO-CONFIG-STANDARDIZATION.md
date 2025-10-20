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

## 🔧 Unable to Find Standardization Setting

### UPDATE: No such setting exists!
After thorough investigation:
- ❌ No "Include unloaded models" checkbox found
- ❌ JIT loading setting doesn't control this
- ❌ Both servers have JIT disabled

### Possible Causes of Difference:
1. **Different installation paths** for models
2. **Different LM Studio internal configurations**
3. **Models added via different methods** (download vs import)
4. **Possible version differences** despite both being updated

### Current Status:
- **Difference is cosmetic only**
- **Both servers work correctly**
- **Cluster handles both behaviors**

## 🎯 Recommendation: Accept the Difference

Since we can't find a setting to change this:
- ✅ The difference is cosmetic only
- ✅ Both servers function correctly
- ✅ Our code handles both behaviors
- ✅ No operational impact

**For model visibility:**
- Use `lms ls --host 10.0.0.102` to see all models on that server
- The API differences don't affect functionality

## 📊 Current Behavior

The servers will continue to return different counts:

```bash
# 10.0.0.102 returns only loaded models:
curl -s http://10.0.0.102:1234/api/v0/models | jq '.data | length'
# Result: 1 (when model loaded) or 0 (when unloaded)

# 10.0.0.100 returns all models:
curl -s http://10.0.0.100:1234/api/v0/models | jq '.data | length'
# Result: 11 (all models with state field)
```

**This is fine - our cluster code handles both!**

## 🔍 Why This Happened

Unknown - despite both servers running the same LM Studio version, they exhibit different API behaviors. Possible causes:
- Internal configuration differences
- Model storage path differences  
- Installation method variations

**The important point:** Both work correctly despite the difference.

## 📝 Note for Future

When adding new LM Studio servers:
1. Test API behavior: `curl http://NEW_IP:1234/api/v0/models`
2. Note if it shows all models or only loaded ones
3. Our cluster code will handle either behavior automatically

## 🚀 No Code Changes Needed

Our cluster code is already robust enough to handle both configurations. The difference is:
- **Cosmetic only** (log verbosity)
- **No functional impact**
- **Both servers work perfectly**