# PM2 Commands - Quick Reference

## Essential Commands

**Always navigate to bot directory first:**
```bash
cd /Users/pbmacstudiomain/devrepo/SAYWHATWANTv1/saywhatwant/ai
```

### Process Control
```bash
# View all processes
pm2 list

# Restart bot (most common)
pm2 restart ai-bot

# Stop bot
pm2 stop ai-bot

# Start bot (if stopped)
pm2 start dist/index.js --name ai-bot

# Delete and recreate (clean slate)
pm2 delete ai-bot && pm2 start dist/index.js --name ai-bot
```

### After Code Changes
```bash
# Rebuild TypeScript and restart
npm run build && pm2 restart ai-bot

# If build fails, check errors
npm run build
```

### Monitoring & Logs
```bash
# View logs (live, follows new entries)
pm2 logs ai-bot

# View last 100 log lines (static)
pm2 logs ai-bot --lines 100 --nostream

# View only errors
pm2 logs ai-bot --err

# View process details
pm2 show ai-bot

# Monitor CPU/memory
pm2 monit
```

### Debugging Specific Issues
```bash
# Check if bot is running
pm2 list | grep ai-bot

# View startup logs
pm2 logs ai-bot --lines 50 --nostream | head -20

# Search logs for specific terms
pm2 logs ai-bot --lines 500 --nostream | grep "ERROR\|Failed\|entity"

# Clear PM2 logs (if too large)
pm2 flush ai-bot
```

### Common Workflow
```bash
# 1. Make code changes
# 2. Test build
npm run build

# 3. If build succeeds, restart
pm2 restart ai-bot

# 4. Watch logs
pm2 logs ai-bot --lines 20

# 5. Test by posting message to app
```

---

## PM2 Technical Overview

**What is PM2:**
- **Process Manager 2** - Production Node.js process manager
- Written in **JavaScript/Node.js**
- Keeps applications running 24/7
- Auto-restarts crashed processes

**Architecture:**
- **Daemon Process**: Background PM2 service
- **God Process**: Master controller
- **Worker Processes**: Your applications (ai-bot)
- **CLI Interface**: `pm2` command-line tool

**Key Features:**
- Process management (start/stop/restart)
- Auto-restart on crashes
- Centralized logging
- Memory/CPU monitoring
- Zero-downtime reloads
- Load balancing (cluster mode)

**File Locations:**
- **Process Registry**: `~/.pm2/`
- **Logs**: `~/.pm2/logs/ai-bot-out.log`, `~/.pm2/logs/ai-bot-error.log`
- **Our Bot**: `/Users/pbmacstudiomain/devrepo/SAYWHATWANTv1/saywhatwant/ai/dist/index.js`

**Why We Use PM2:**
- Production reliability (auto-restart)
- Easy log access and management
- Simple deployment workflow
- Process monitoring
- Service keeps running even if terminal closed

---

## Quick Troubleshooting

**Bot not responding to messages:**
```bash
# Check if running
pm2 list

# Restart if stuck  
pm2 restart ai-bot

# Check recent logs
pm2 logs ai-bot --lines 50 --nostream
```

**After config changes:**
```bash
# Always restart after config-aientities.json changes
pm2 restart ai-bot
```

**Memory issues:**
```bash
# Check memory usage
pm2 show ai-bot

# Fresh restart if memory high
pm2 delete ai-bot && pm2 start dist/index.js --name ai-bot
```

---

*Last Updated: October 13, 2025*
