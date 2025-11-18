# Cloud Deployment Guide - PM2 Bot with Local AI

## Architecture Overview

```
Users → Cloudflare Workers → KV Store
                                ↓
                       Cloud PM2 Bot (polls KV)
                                ↓
                    Cloudflare Tunnel (secure)
                                ↓
            Your Mac Studios (LM Studio with models)
                                ↓
                        Back to KV Store
```

## Why This Architecture?

- **Cloud PM2 Bot**: Reliable queue processing, no home internet dependencies
- **Local AI Models**: Free GPU compute on your own hardware
- **Cloudflare Tunnel**: Secure connection without exposing ports
- **Cost**: $10-20/month vs $2,000+/month for cloud GPUs

## Cloud Service Options

### Option 1: Railway.app (Recommended)
**Cost**: $10-20/month
**Pros**:
- Dead simple deployment
- Auto-restarts and monitoring
- Built-in logging
- WebSocket support
**Cons**: 
- None for this use case

### Option 2: Render.com
**Cost**: $7-15/month
**Pros**:
- Similar to Railway
- Good reliability
- Simple interface
**Cons**:
- Slightly slower deploys

### Option 3: Digital Ocean Droplet
**Cost**: $6-12/month
**Pros**:
- Full VM control
- Very reliable
- Predictable pricing
**Cons**:
- You manage the server
- Need to handle PM2 setup

### Option 4: Linode/Vultr
**Cost**: $5-12/month
**Pros/Cons**: Similar to Digital Ocean

## Security: Cloudflare Tunnel Setup

### Why Cloudflare Tunnel?
- ✅ No port forwarding needed
- ✅ Free
- ✅ Encrypted connection
- ✅ Hides your home IP
- ✅ DDoS protection

### Setup Steps

#### 1. Install on Each Mac Studio
```bash
# Install cloudflared
brew install cloudflare/cloudflare/cloudflared

# Authenticate
cloudflared tunnel login
```

#### 2. Create Tunnel for Each LM Studio Instance
```bash
# Mac Studio 1
cloudflared tunnel create lm-studio-1

# Mac Studio 2  
cloudflared tunnel create lm-studio-2
```

#### 3. Configure DNS
```bash
# Point subdomain to tunnel
cloudflared tunnel route dns lm-studio-1 lm1.yourdomain.com
cloudflared tunnel route dns lm-studio-2 lm2.yourdomain.com
```

#### 4. Create Config File
```yaml
# ~/.cloudflared/config.yml
tunnel: lm-studio-1
credentials-file: /Users/[your-user]/.cloudflared/[tunnel-id].json

ingress:
  - hostname: lm1.yourdomain.com
    service: http://localhost:1234
  - service: http_status:404
```

#### 5. Run Tunnel (Auto-start on Boot)
```bash
# Install as service
sudo cloudflared service install

# Start tunnel
cloudflared tunnel run lm-studio-1

# Or run manually
cloudflared tunnel --url http://localhost:1234 lm-studio-1
```

## Railway Deployment

### 1. Prepare Repository
```bash
cd /Users/pbmacstudiomain/devrepo/SAYWHATWANTv1/saywhatwant/ai
```

### 2. Create Dockerfile
```dockerfile
# Dockerfile
FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source
COPY . .

# Build TypeScript
RUN npm run build

# Expose WebSocket port
EXPOSE 4002

# Start bot
CMD ["node", "dist/index.js"]
```

### 3. Create railway.json
```json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "DOCKERFILE",
    "dockerfilePath": "Dockerfile"
  },
  "deploy": {
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 10
  }
}
```

### 4. Environment Variables (Set in Railway Dashboard)
```env
# LM Studio tunnel URLs
LM_STUDIO_1=https://lm1.yourdomain.com
LM_STUDIO_2=https://lm2.yourdomain.com

# Cloudflare KV
CLOUDFLARE_KV_POST_URL=https://sww-comments.bootloaders.workers.dev/api/comments

# Node environment
NODE_ENV=production
```

### 5. Update config-aientities.json
```json
{
  "lmStudioServers": [
    {
      "ip": "lm1.yourdomain.com",
      "port": 443,
      "protocol": "https",
      "enabled": true,
      "name": "Mac Studio 1"
    },
    {
      "ip": "lm2.yourdomain.com", 
      "port": 443,
      "protocol": "https",
      "enabled": true,
      "name": "Mac Studio 2"
    }
  ]
}
```

### 6. Deploy
```bash
# Install Railway CLI
npm install -g @railway/cli

# Login
railway login

# Link project
railway link

# Deploy
railway up
```

## Digital Ocean Deployment (Alternative)

### 1. Create Droplet
- Size: Basic ($12/month, 2GB RAM)
- Image: Ubuntu 22.04
- Region: Closest to you

### 2. Setup Script
```bash
# SSH into droplet
ssh root@your-droplet-ip

# Update system
apt update && apt upgrade -y

# Install Node.js 18
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt install -y nodejs

# Install PM2
npm install -g pm2

# Clone your repo
git clone https://github.com/yourusername/yourrepo.git
cd yourrepo/saywhatwant/ai

# Install dependencies
npm ci --only=production

# Build
npm run build

# Start with PM2
pm2 start dist/index.js --name ai-bot

# Save PM2 config
pm2 save

# Setup PM2 startup
pm2 startup
```

### 3. Configure Firewall
```bash
# Allow SSH and WebSocket
ufw allow 22
ufw allow 4002
ufw enable
```

## Monitoring & Maintenance

### Railway Dashboard
- View logs in real-time
- See resource usage
- Restart with one click
- Set up alerts

### PM2 Commands (If using VPS)
```bash
# View logs
pm2 logs ai-bot

# Restart
pm2 restart ai-bot

# Monitor resources
pm2 monit

# View status
pm2 status
```

### Health Checks
Add to your bot:
```javascript
// Simple HTTP health endpoint
import express from 'express';
const healthServer = express();

healthServer.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    uptime: process.uptime(),
    queue: queueService.size()
  });
});

healthServer.listen(3000);
```

## Cost Breakdown for 10M Messages/Day

| Service | Monthly Cost | Purpose |
|---------|-------------|---------|
| Railway/Render | $10-20 | PM2 bot hosting |
| Cloudflare Tunnel | Free | Secure connection |
| Cloudflare Workers | $5-10 | API calls |
| Cloudflare KV | $5-10 | Storage |
| Your Mac Studios | Electricity | AI inference |
| **Total** | **$20-40** | Full system |

Compare to cloud GPUs: $2,000-4,000/month

## Scaling Considerations

### Current (< 1M messages/day)
- Single Railway instance
- 2 Mac Studios
- Works perfectly

### Medium (1-5M messages/day)
- 2-3 Railway instances (load balanced)
- 4-6 Mac Studios
- Still under $100/month

### Large (5-10M+ messages/day)
- Multiple Railway instances
- 10-20 Mac Studios
- Consider Cloudflare Queues instead of polling
- Still cheaper than cloud GPUs

## Migration Steps

### Phase 1: Test (This Week)
1. Set up Cloudflare Tunnel on one Mac
2. Deploy to Railway staging
3. Test with low traffic

### Phase 2: Parallel (Next Week)
1. Run both local PM2 and Railway
2. Monitor for issues
3. Compare reliability

### Phase 3: Cutover (When Ready)
1. Stop local PM2
2. Full traffic to Railway
3. Keep local as backup

### Phase 4: Optimize (Ongoing)
1. Add health monitoring
2. Set up alerts
3. Optimize polling intervals

## Troubleshooting

### Bot Can't Reach LM Studio
```bash
# Test tunnel from cloud
curl https://lm1.yourdomain.com/v1/models

# Check tunnel status
cloudflared tunnel info lm-studio-1

# Restart tunnel
cloudflared tunnel run lm-studio-1
```

### High Latency
- Ensure tunnels are in same region as Railway
- Consider multiple Railway regions
- Check home internet speed

### Memory Issues on Railway
- Upgrade to $20 plan (4GB RAM)
- Add swap space
- Optimize queue size

## Next Steps

1. Choose cloud provider (Railway recommended)
2. Set up Cloudflare Tunnel on Mac Studios
3. Deploy bot to cloud
4. Monitor and iterate

## Files to Update

- `config-aientities.json` - Add tunnel URLs
- `.env` - Add environment variables  
- `Dockerfile` - Create for deployment
- `railway.json` - Configure Railway

---

**Key Principle**: Keep expensive GPU compute free on your hardware, pay only $10-20/month for reliable queue processing.

Last Updated: October 13, 2025
