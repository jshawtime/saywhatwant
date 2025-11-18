# 208: Llama.cpp Remote Deployment to 10.0.0.110

**Target:** Mac Studio M3 Ultra (512GB RAM)  
**Goal:** Deploy 19-model Llama.cpp system remotely via SSH  
**Status:** 🔄 IN PROGRESS

---

## What We Have

**Dev Machine (10.0.0.99):**
- ✅ Llama.cpp built and tested
- ✅ 3 models running locally (8080-8082)
- ✅ PM2 bot with routing working
- ✅ SSH access to 10.0.0.110 configured

**Target Machine (10.0.0.110):**
- ✅ SSH enabled and working
- ✅ 512GB RAM available
- ❌ cmake not installed
- ❌ llama.cpp not built

---

## What We Want

**Production System on 10.0.0.110:**
- [ ] cmake installed
- [ ] llama.cpp cloned and built
- [ ] 19 model servers running (ports 8080-8098)
- [ ] ~342GB RAM usage
- [ ] PM2 managing all servers
- [ ] Accessible from dev machine

---

## Implementation Checklist

### Phase 1: Install Dependencies
- [ ] Install Homebrew (if needed)
- [ ] Install cmake
- [ ] Install git (likely already installed)
- [ ] Verify Xcode Command Line Tools

### Phase 2: Build Llama.cpp
- [ ] Clone llama.cpp repository
- [ ] Configure with cmake
- [ ] Build with Metal support (-j 8)
- [ ] Verify binary exists

### Phase 3: Test Single Model
- [ ] Start one model server
- [ ] Test with curl
- [ ] Verify response
- [ ] Check memory usage

### Phase 4: Deploy 19 Models
- [ ] Transfer start script to server
- [ ] Create logs directory
- [ ] Start all 19 model servers
- [ ] Verify all ports respond
- [ ] Monitor memory usage (~342GB)

### Phase 5: Update PM2 Bot
- [ ] Update worker-config.json endpoint to 10.0.0.110
- [ ] Restart PM2 bot on dev machine
- [ ] Test routing to remote servers
- [ ] Verify responses work

---

## Commands (To Be Executed)

Will be filled in as we proceed...

---

## Progress Log

**Started:** 2025-11-15  
**SSH Verified:** ✅ 2025-11-15  
**Current Phase:** Dependencies


