# Ollama Server Installation Plan

**Date:** October 30, 2025  
**Purpose:** Standardized installation process for deploying Ollama servers on new Mac machines  
**Status:** ✅ IMPLEMENTED - Installation scripts created and ready for testing

---

## 🎯 Architecture Overview

### Key Decision: **Ollama-Only Server**

This installation plan is for machines that will **only run Ollama server**. These are **dedicated model inference machines**.

**What runs where:**
- **Dev Machine:** PM2 bot + Queue Monitor Dashboard
- **Ollama Server Machine:** Ollama server only (no PM2, no dashboard)

**Network Flow:**
```
PM2 Bot (dev machine) → Network → Ollama Server (10.0.0.100) → Models
Dashboard (dev machine) → Network → Ollama Server (future: operation logs)
```

### Why This Architecture?

1. **Separation of Concerns:** Inference server isolated from bot logic
2. **Scalability:** Can add more Ollama servers without changing bot
3. **Resource Management:** Dedicated GPU/RAM for model serving
4. **Network-Based:** Bot discovers servers via network (future: service discovery)

---

## 📋 Installation Requirements

### System Dependencies

**Required:**
1. **Homebrew** - Package manager (install if missing)
2. **Node.js** (LTS) - Via Homebrew (needed for npm, not for Ollama directly)
3. **Ollama** - Via Homebrew (`brew install ollama`)

**Not Required:**
- PM2 (runs on dev machine)
- TypeScript/Node build tools (runs on dev machine)
- Queue Monitor Dashboard (runs on dev machine)

### Project Structure

```
hm-server-deployment/
├── INSTALL/                    # NEW: Installation scripts
│   ├── requirements.txt       # System dependency list
│   ├── install.sh            # Main installation script
│   ├── configure-machine.sh   # IP/configuration setup
│   ├── verify-install.sh     # Self-test & verification
│   └── README.md             # Installation guide
├── ollama-HM/                 # Existing: Ollama server code
│   ├── start-ollama-hm.sh
│   ├── OLLAMA-kill-and-start.sh
│   ├── generate-modelfiles.sh
│   └── modelfiles/
└── README.md                   # Updated with installation steps
```

---

## 🔧 Configuration Points

### What Needs IP Address Configuration

1. **`config-aientities.json` (if present)**
   - Line 6: `"serverId": "10.0.0.100"` → **Update to machine IP**
   - Note: This file may not exist on Ollama-only server
   - May be optional if bot discovers servers via network

2. **Ollama Server Configuration**
   - `OLLAMA_HOST=0.0.0.0:11434` → Already configured in scripts
   - No IP hardcoding needed (listens on all interfaces)

3. **Models Path**
   - Current: `/Volumes/HM-models/ollama-models`
   - **Behavior:** Ask for path, allow Enter to use last used path
   - **Fallback:** `~/ollama-models` if external drive not available

### What Does NOT Need Configuration

- PM2 settings (not installed)
- Dashboard URLs (runs on dev machine)
- Bot source code (not present)
- TypeScript compilation (not needed)

---

## 📝 Installation Script Design

### `INSTALL/install.sh` - Main Installation Flow

```
1. Welcome & Prerequisites Check
   - Detect macOS version
   - Check if Homebrew installed (install if missing)
   - Check existing installations (Ollama, Node)

2. System Dependencies Installation
   - Install Homebrew (if needed)
   - Install Node.js via Homebrew
   - Install Ollama via Homebrew
   - Verify installations

3. Project Setup
   - Detect/confirm installation directory (~/Desktop/hm-server-deployment)
   - Check if ollama-HM folder exists
   - Verify required scripts present

4. Configuration
   - Call configure-machine.sh
     - Detect machine IP address (auto-detect with override)
     - Configure models path (prompt with last-used memory)
     - Update any IP references in config files

5. Verification
   - Call verify-install.sh
     - Test Ollama installation
     - Test Ollama API (curl test)
     - Verify models path accessible
     - Full integration test

6. Summary & Next Steps
   - Display configuration
   - Show how to start Ollama
   - Document network connectivity requirements
```

### `INSTALL/configure-machine.sh` - IP & Path Configuration

**Machine IP Detection:**
```bash
# Auto-detect primary network interface IP
PRIMARY_IP=$(ipconfig getifaddr en0 || ipconfig getifaddr en1)

# Prompt user to confirm or override
echo "Detected IP: $PRIMARY_IP"
read -p "Use this IP? (Y/n) or enter custom IP: " ip_choice

if [ "$ip_choice" = "n" ] || [ "$ip_choice" = "N" ]; then
    read -p "Enter machine IP address: " MACHINE_IP
else
    MACHINE_IP=$PRIMARY_IP
fi
```

**Models Path Configuration:**
```bash
# Check for last-used path in config file
LAST_PATH=$(grep "OLLAMA_MODELS" ~/.ollama-config 2>/dev/null | cut -d'=' -f2)

# Detect external drives
EXTERNAL_DRIVES=$(ls /Volumes/ | grep -v "Macintosh HD" | grep -v "^$")

echo "Available storage locations:"
echo "1. External drive (if available)"
echo "2. Home directory: ~/ollama-models"
[ -n "$LAST_PATH" ] && echo "3. Last used: $LAST_PATH"

read -p "Enter models path or press Enter for default: " models_path
```

**Configuration Updates:**
- Update `config-aientities.json` (if exists) with `serverId`
- Update `ollama-HM/start-ollama-hm.sh` models path (if needed)
- Save configuration to `~/.ollama-server-config` for future reference

### `INSTALL/verify-install.sh` - Self-Test & Verification

**Basic Checks:**
```bash
✓ Homebrew installed
✓ Node.js installed and in PATH
✓ Ollama installed and in PATH
✓ Models directory exists and writable
```

**Ollama API Tests:**
```bash
# 1. Start Ollama server (background)
export OLLAMA_HOST=0.0.0.0:11434
ollama serve &
sleep 3

# 2. Test API endpoint
curl -s http://localhost:11434/api/tags
# Expected: JSON response (may be empty if no models)

# 3. Test chat endpoint (if test model exists)
curl -X POST http://localhost:11434/api/chat \
  -H "Content-Type: application/json" \
  -d '{"model": "test", "messages": [{"role": "user", "content": "test"}]}'

# 4. Test network accessibility (from dev machine perspective)
# Check if port 11434 is listening on 0.0.0.0
lsof -i :11434 | grep LISTEN
# Expected: Shows ollama listening on *:11434

# 5. Stop test server
pkill ollama
```

**Network Connectivity Test:**
```bash
# Verify server is accessible from network
MACHINE_IP=$(cat ~/.ollama-server-config | grep MACHINE_IP | cut -d'=' -f2)
echo "Testing network accessibility on $MACHINE_IP:11434..."

# Test from localhost (should work)
curl -s --max-time 3 http://localhost:11434/api/tags > /dev/null
if [ $? -eq 0 ]; then
    echo "✅ Localhost connection: OK"
else
    echo "❌ Localhost connection: FAILED"
fi

# Note: Cannot test external connectivity from this machine
# User must verify from dev machine or network client
```

**Full Integration Test:**
```bash
# 1. Start Ollama with test configuration
# 2. Load a test model (if available)
# 3. Make API call
# 4. Verify response format
# 5. Cleanup

echo "✅ Ollama server is operational"
echo "📡 Server accessible at: http://$MACHINE_IP:11434"
echo "🔗 From dev machine, test with: curl http://$MACHINE_IP:11434/api/tags"
```

---

## 🗂️ Files to Create

### `INSTALL/requirements.txt`

```
# System Dependencies for Ollama Server Installation
# Install via: brew install <package>

# Package Manager
homebrew

# Runtime
nodejs@22          # LTS version via Homebrew

# Ollama
ollama

# Note: PM2 and TypeScript not required (run on dev machine)
```

### `INSTALL/README.md`

**Sections:**
1. Overview (Ollama-only server)
2. Prerequisites
3. Quick Start
4. Detailed Installation Steps
5. Configuration Options
6. Verification & Testing
7. Troubleshooting
8. Post-Installation

---

## 🔍 Decision Log

### Models Path
**Decision:** Ask for path or Enter to use last used path
- **Implementation:** Prompt user, store last-used in config file
- **Fallback:** `~/ollama-models` if external drive unavailable
- **Future:** Support multiple model locations (not in MVP)

### User Accounts
**Decision:** Single user, hardcode `~/Desktop`
- **Rationale:** Each server is single-purpose, single-user
- **Path:** `~/Desktop/hm-server-deployment`
- **No multi-user support needed**

### PM2 Auto-Start
**Decision:** Not required (PM2 runs on dev machine)
- **Rationale:** This is Ollama-only server
- **No PM2 installation needed**
- **Ollama startup handled by startup scripts**

### Verification
**Decision:** Full self-test with Ollama API calls
- **Basic:** Check installations, file permissions
- **API Test:** Actual curl requests to Ollama endpoints
- **Network Test:** Verify server listening on 0.0.0.0:11434
- **Integration:** Full end-to-end test if test model available

### Error Handling
**Decision:** Continue and report, no rollback
- **Rationale:** Installation failures are rare, rollback complexity not worth it
- **Behavior:** Continue through errors, collect all issues, report at end
- **User can fix issues and re-run installation**

### Documentation
**Decision:** Separate README, verbose console output
- **README:** Complete guide in `INSTALL/README.md`
- **Console:** Verbose progress messages, clear status indicators
- **Examples:** Show commands being run, results displayed

---

## 🚀 Installation Flow Diagram

```
┌─────────────────────────────────────┐
│  User runs: bash install.sh          │
└──────────────┬────────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│  1. Prerequisites Check             │
│     - macOS version                 │
│     - Homebrew installed?           │
│     - Existing installations?       │
└──────────────┬────────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│  2. System Dependencies              │
│     - Install Homebrew (if needed)  │
│     - Install Node.js               │
│     - Install Ollama                │
└──────────────┬────────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│  3. Configuration                   │
│     - Detect/prompt for IP          │
│     - Configure models path        │
│     - Update config files           │
└──────────────┬────────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│  4. Verification                    │
│     - Test Ollama installation      │
│     - Test API endpoints            │
│     - Verify network listening      │
└──────────────┬────────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│  5. Summary & Next Steps            │
│     - Display configuration         │
│     - Show startup commands         │
│     - Network test instructions     │
└─────────────────────────────────────┘
```

---

## 🔗 Integration with Dev Machine

### Network Requirements

**Ollama Server Must:**
1. ✅ Listen on `0.0.0.0:11434` (all network interfaces)
2. ✅ Be accessible from dev machine IP
3. ✅ Firewall allows incoming connections on port 11434
4. ✅ Network routing allows dev machine → Ollama server

**Dev Machine Must:**
1. ✅ Have network path to Ollama server
2. ✅ PM2 bot configured with Ollama server IP
3. ✅ Test connectivity before deploying

### Configuration Files on Dev Machine

**`AI-Bot-Deploy/config-aientities.json`:**
```json
{
  "botSettings": {
    "serverId": "10.0.0.66"  // Dev machine IP
  },
  "entities": [
    {
      "modelServer": "ollama-hm",
      // Bot will connect to Ollama server IP (configured separately)
    }
  ]
}
```

**Ollama Connection (in bot code):**
- Currently: Hardcoded `http://10.0.0.100:11434`
- Future: Dynamic discovery or environment variable
- Configuration: Set `OLLAMA_SERVER_IP` or similar

---

## 📊 Future Enhancements

### Phase 2: Advanced Features

1. **Service Discovery**
   - Ollama servers advertise themselves on network
   - PM2 bot discovers available servers
   - Load balancing across multiple Ollama servers

2. **Dashboard Integration**
   - Ollama server exposes operation logs endpoint
   - Dashboard pulls stats from Ollama servers
   - Real-time model loading/usage monitoring

3. **Multi-Model Location Support**
   - Support models on multiple external drives
   - Automatic failover if drive unmounts
   - Priority-based model location selection

4. **Automated Health Checks**
   - Periodic API health checks
   - Automatic restart on failure
   - Metrics collection for monitoring

---

## 🎯 Success Criteria

**Installation is successful when:**
1. ✅ All system dependencies installed
2. ✅ Ollama server starts successfully
3. ✅ API responds to curl requests
4. ✅ Server listening on network interface
5. ✅ Models path configured and accessible
6. ✅ Dev machine can connect to server

**Manual Verification:**
```bash
# On Ollama server
ollama list
curl http://localhost:11434/api/tags

# From dev machine
curl http://<OLLAMA_SERVER_IP>:11434/api/tags
```

---

## ✅ Final Decisions

**Date:** October 30, 2025

### Script Location
- **Decision:** `ollama-HM/INSTALL/` subdirectory (keeps install files organized)
- **Rationale:** Maintains clean root directory, all installation files in one place

### Configuration Storage
- **Decision:** `~/.ollama-server-config` (user home directory)
- **Rationale:** Standard location, survives folder moves, accessible from anywhere
- **Format:** Bash-compatible key=value pairs, sourced by scripts

### Models Path Handling
- **Decision:** Install script prompts for path, stores in config, existing scripts read from config
- **Method:** Modify `start-ollama-hm.sh` and `OLLAMA-kill-and-start.sh` to source `~/.ollama-server-config`
- **Fallback:** If config missing, use hardcoded default with warning

### IP Address Configuration
- **Decision:** Auto-detect with override option, store for documentation/future use
- **Purpose:** Documentation and future dashboard integration (not critical for current setup)
- **Storage:** Included in `~/.ollama-server-config`

### Verification Scope
- **Decision:** Full integration test - check installations, start Ollama, test API, then stop
- **Rationale:** Ensures complete end-to-end functionality verification

### Script Entry Point
- **Decision:** `install.sh` in `ollama-HM/` root (calls scripts in `INSTALL/`)
- **Rationale:** Simple command, clear purpose, helper scripts organized in subdirectory

### User Experience
- **Decision:** Fully interactive with clear prompts, support command-line args for automation
- **Format:** `./install.sh` (interactive) or `./install.sh --ip=10.0.0.100 --models-path=/path` (automated)

### Desktop Location
- **Decision:** Detect current location (can be copied anywhere)
- **Rationale:** Flexible deployment, works from any directory

---

## 📝 Next Steps

1. ✅ **Create `INSTALL/` directory structure**
2. ✅ **Implement `requirements.txt`**
3. ✅ **Write `install.sh` main script**
4. ✅ **Write `configure-machine.sh`**
5. ✅ **Write `verify-install.sh` with full API tests**
6. ✅ **Create `INSTALL/README.md` documentation**
7. ✅ **Update existing scripts to read from config**
8. ✅ **Update `ollama-HM/README.md` with installation instructions**
9. **Test on fresh Mac**
10. **Update main `README.md` with installation instructions**

---

## 🤔 Open Questions (Resolved)

1. **Configuration File Location**
   - Where to store `serverId` and models path?
   - Use `~/.ollama-server-config` or config file in repo?
   - Should it be version-controlled?

2. **IP Address Discovery**
   - What if machine has multiple network interfaces?
   - How to handle VPN interfaces?
   - Should we detect primary interface or let user choose?

3. **Models Path Validation**
   - Should we check available disk space?
   - Validate write permissions before accepting path?
   - Check if external drive is mounted?

4. **Network Firewall**
   - Should installation script configure firewall?
   - macOS firewall rules for port 11434?
   - Or just document manual steps?

5. **Startup Script Integration**
   - Should installation enable Ollama auto-start on boot?
   - Use launchd or keep as manual start?
   - Store startup configuration?

---

*Last Updated: October 30, 2025*  
*Status: Architecture Discussion - No Code Implementation Yet*

