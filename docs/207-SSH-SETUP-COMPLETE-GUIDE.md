# 207: SSH Setup Complete Guide - Dev Machine to Remote Server

**Purpose:** Enable passwordless SSH from dev machine to any new Mac on local network  
**Result:** Full remote access for deployment, monitoring, maintenance  
**Critical:** Required for multi-location deployments

---

## The Problem

SSH key authentication fails on macOS when:
- Home directory is world-writable (`drwxrwxrwx+`)
- OpenSSH security policy: Ignores authorized_keys if $HOME is writable by others
- Documented in: `man sshd` (AUTHORIZATION section)

**Symptom:**
- SSH offers key
- Server rejects key
- Falls back to password
- `ssh -v` shows: "Offering public key... Authentications that can continue"

---

## The Solution (One Command!)

**On the TARGET machine:**
```bash
chmod 755 ~
```

**That's it!** The home directory MUST NOT be world-writable for SSH keys to work.

---

## Complete Setup Process (New Mac)

### Step 1: Enable Remote Login on Target

**On the NEW Mac you want to access:**

System Settings → General → Sharing → **Remote Login** → **ON**

**Allow access for:** All users (or add specific users)

**Verify:**
```bash
sudo systemsetup -getremotelogin
# Should show: Remote Login: On
```

---

### Step 2: Get Target Machine Info

**On the target Mac:**
```bash
# Get username
whoami

# Get IP address
ipconfig getifaddr en0
# (or en1 for WiFi)
```

**Example:**
- Username: `ms512-1`
- IP: `10.0.0.110`

---

### Step 3: Generate SSH Key on Dev Machine (One Time)

**On your DEV machine (if you don't have a key):**
```bash
ssh-keygen -t ed25519 -C "dev-automation-key"
# Press Enter for all prompts (use defaults, no passphrase)
```

**This creates:**
- Private key: `~/.ssh/id_ed25519`
- Public key: `~/.ssh/id_ed25519.pub`

---

### Step 4: Copy Public Key to Target

**From DEV machine:**
```bash
ssh-copy-id username@TARGET_IP
# Example: ssh-copy-id ms512-1@10.0.0.110

# Enter the target machine's password when prompted
```

**This adds your public key to:** `~/.ssh/authorized_keys` on the target

---

### Step 5: Fix Permissions on Target (CRITICAL!)

**On the TARGET machine:**
```bash
# Fix home directory (MUST be 755, not 777!)
chmod 755 ~

# Fix .ssh directory
chmod 700 ~/.ssh

# Fix authorized_keys file
chmod 600 ~/.ssh/authorized_keys

# Verify home directory permissions
ls -ld ~
# Should show: drwxr-xr-x (NOT drwxrwxrwx!)
```

**Why this matters:**
- `drwxrwxrwx` = World-writable → SSH rejects keys
- `drwxr-xr-x` = Proper permissions → SSH accepts keys

---

### Step 6: Configure Passwordless Sudo (For Remote Operations)

**Why needed:**
- Remote software installation requires sudo
- SSH cannot enter passwords interactively
- Future machines 200+ miles away need unattended operations

**On the TARGET machine, run:**
```bash
sudo visudo
```

**Add this line at the bottom:**
```
username ALL=(ALL) NOPASSWD: ALL
```
Then when visudo opens:
Press Shift+G to go to the end of the file
Press o to create a new line
if username is ms512-1 Type: ms512-1 ALL=(ALL) NOPASSWD: ALL
Press Esc
Type: :wq and press Enter
That will save the file properly.


**Replace `username` with actual username** (e.g., `ms512-1`)

**Example:**
```
ms512-1 ALL=(ALL) NOPASSWD: ALL
```

**What this does:**
- Full sudo access without password for this user
- Required for remote automation and deployments
- Install software, manage services, configure system

**Security:**
- Only works via SSH (which requires key authentication)
- Only for your user account
- On private network (10.0.0.x)
- Same access as if physically at machine
- Standard approach for DevOps/automation

**Save:** Ctrl+X, Y, Enter (nano) or `:wq` (vim)

**If you see swap file warning:**
```
Found a swap file by the name "/etc/.sudoers.tmp.swp"
[O]pen Read-Only, (E)dit anyway, (R)ecover, (D)elete it, (Q)uit, (A)bort:
```

**Press: `D`** (delete the old swap file)

Then the editor will open normally.

---

### Step 6: Configure SSH on Dev Machine

**On DEV machine, create/edit `~/.ssh/config`:**
```bash
cat >> ~/.ssh/config << EOF
Host TARGET_IP
    HostName TARGET_IP
    User username
    IdentityFile ~/.ssh/id_ed25519
    IdentitiesOnly yes
EOF
```

**Example:**
```bash
cat >> ~/.ssh/config << EOF
Host 10.0.0.110
    HostName 10.0.0.110
    User ms512-1
    IdentityFile ~/.ssh/id_ed25519_server
    IdentitiesOnly yes
EOF
```

**Why:** Ensures SSH uses the correct key (useful if you have multiple keys)

---

### Step 7: Test Passwordless SSH

**From DEV machine:**
```bash
ssh TARGET_IP "echo 'SUCCESS! Passwordless SSH working!'"
# Should connect instantly without password!
```

**If it works:** ✅ Done! Full remote access enabled

**If it still asks for password:** Check Step 5 permissions on target

---

## Troubleshooting

### Still Asks for Password After Setup

**Check 1: Home directory permissions on target**
```bash
# On target machine
ls -ld ~
# Must show: drwxr-xr-x (755)
# NOT: drwxrwxrwx (777)

# Fix if wrong:
chmod 755 ~
```

**Check 2: Verify key is on server**
```bash
# From dev machine
ssh username@TARGET_IP "cat ~/.ssh/authorized_keys"
# Should show your public key (starts with ssh-ed25519...)
```

**Check 3: Check SSH logs on target**
```bash
# On target machine
log show --predicate 'process == "sshd"' --last 5m | grep -i auth
```

**Check 4: Verify SSH is offering the right key**
```bash
# From dev machine
ssh -v TARGET_IP "echo test" 2>&1 | grep "Offering public key"
# Should show your key file
```

---

## What You Can Do With SSH Access

### Remote Commands (One-liners):
```bash
ssh 10.0.0.110 "ls -la"
ssh 10.0.0.110 "brew install cmake"
ssh 10.0.0.110 "pm2 list"
```

### Interactive Session:
```bash
ssh 10.0.0.110
# Now you're ON that machine
# Run any commands as if you were there
# Type 'exit' to disconnect
```

### File Transfer:
```bash
# Copy TO remote
scp localfile.txt ms512-1@10.0.0.110:~/

# Copy FROM remote
scp ms512-1@10.0.0.110:~/remotefile.txt ./

# Copy entire directory
scp -r local-dir/ ms512-1@10.0.0.110:~/
```

### Run Scripts:
```bash
# Execute local script on remote machine
ssh 10.0.0.110 'bash -s' < local-script.sh
```

---

## Security Notes

### Why This is Secure:

**SSH Keys > Passwords:**
- Key-based: Cryptographically secure, can't be brute-forced
- Password-based: Can be guessed, phished, leaked

**Local Network:**
- Both machines on 10.0.0.x private network
- Not exposed to internet
- Additional security layer

**Best Practices:**
- ✅ Use ed25519 keys (modern, secure)
- ✅ Proper file permissions (700/.ssh, 600/keys, 755/home)
- ✅ Document the setup (this file!)
- ✅ Keep private key on dev machine only

---

## For Future Remote Servers

**When adding a NEW server (from different location):**

1. **On new server:** Enable Remote Login
2. **From anywhere:** `ssh-copy-id user@server-ip`
3. **On server:** `chmod 755 ~` (fix permissions)
4. **Test:** `ssh server-ip "echo test"`

**Works from:**
- Same building
- Different office
- Different city
- Anywhere with internet!

**Just need:**
- Server IP or hostname
- Username
- Password (one time for ssh-copy-id)

---

## Common Mistakes (Don't Do These!)

❌ **Creating new user account on target** - Not needed!  
❌ **Copying wrong key** - Use `id_ed25519.pub` not `id_ed25519`  
❌ **Ignoring permissions** - chmod 755/700/600 are REQUIRED  
❌ **World-writable home** - chmod 777 breaks SSH keys completely  

✅ **Do this:** Follow steps 1-7 exactly as written

---

## Quick Reference Card

```bash
# On target: Enable SSH
sudo systemsetup -setremotelogin on

# From dev: Copy key
ssh-copy-id user@target-ip

# On target: Fix permissions  
chmod 755 ~
chmod 700 ~/.ssh
chmod 600 ~/.ssh/authorized_keys

# From dev: Test
ssh target-ip "echo success"
```

**Total time:** 5 minutes  
**Works for:** Any macOS machine on network  
**Future-proof:** Same process for remote locations

---

**Status:** ✅ Working on 10.0.0.99 → 10.0.0.110  
**Verified:** 2025-11-15  
**Critical Fix:** `chmod 755 ~` on target machine


