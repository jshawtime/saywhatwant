# 🍴 Fork & Deploy Guide

## Quick Steps

### 1. Fork on GitHub (Done?)
✅ Go to https://github.com/pbosh/saywhatwant
✅ Click **Fork** button (top-right)
✅ Select your account
✅ Create fork

### 2. Update Your Local Repo
Run this script:
```bash
./scripts/setup-fork.sh
```

Or manually:
```bash
# Replace YOUR_USERNAME with your GitHub username
git remote rename origin upstream
git remote add origin https://github.com/YOUR_USERNAME/saywhatwant.git
git push -u origin main
```

### 3. Connect to Cloudflare
1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. **Workers & Pages** → **Create application** → **Pages** → **Connect to Git**
3. Now you'll see **YOUR_USERNAME/saywhatwant** in the list!
4. Select it and continue

### 4. Configure & Deploy
Run our setup wizard:
```bash
npm run cloudflare:git-setup
```

## Keeping Your Fork Updated

To sync with your partner's changes:
```bash
# Get latest changes from original
git fetch upstream
git checkout main
git merge upstream/main

# Push to your fork (triggers Cloudflare deploy)
git push origin main
```

## Your Git Remotes Will Be:
- **origin**: Your fork (you push here)
- **upstream**: Original repo (you pull updates from here)

---

Ready? Once you've forked on GitHub, run `./scripts/setup-fork.sh` and let's deploy! 🚀
