# LM Studio Cloud Pipeline Architecture
**v1.01 Feature: Exposing Local LM Studio to Cloud via Cloudflare Tunnel**

## Executive Summary
This document outlines the architecture and implementation of a secure pipeline that exposes a local LM Studio server to the internet via Cloudflare Tunnel, allowing AI entities to operate from a local Mac while being accessible globally through `aientities.saywhatwant.app`.

## Architecture Overview

```
Internet → aientities.saywhatwant.app → Cloudflare Edge
    ↓
Cloudflare Tunnel (cloudflared)
    ↓
Local Mac (dynamic IP) → LM Studio (localhost:1234)
    ↓
LM Studio generates response
    ↓
Response → Cloudflare → KV System → Say What Want App
```

## Why Cloudflare Tunnel?

### The Problem
- Local LM Studio server needs internet accessibility
- Dynamic residential IP addresses change frequently
- Port forwarding is insecure and unreliable
- Traditional dynamic DNS has propagation delays

### The Solution: Cloudflare Tunnel
- **No port forwarding required** - tunnel initiates outbound connection
- **Automatic IP updates** - handles dynamic IPs seamlessly
- **Enterprise-grade security** - only specified services exposed
- **Zero-trust architecture** - authenticated connections only
- **Built-in DDoS protection** - Cloudflare's edge network
- **SSL/TLS included** - automatic HTTPS encryption

## Implementation Plan

### Phase 1: Prerequisites
1. **Cloudflare Account Setup**
   - Domain: saywhatwant.app (already configured)
   - Add subdomain: aientities.saywhatwant.app
   - Enable Cloudflare Tunnel service

2. **Local Environment**
   - Mac with LM Studio running
   - LM Studio API endpoint (default: http://localhost:1234)
   - Stable internet connection

### Phase 2: Cloudflare Tunnel Installation

#### Step 1: Install cloudflared on Mac
```bash
# Using Homebrew (recommended)
brew install cloudflare/cloudflare/cloudflared

# Or download directly
curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-darwin-amd64.tgz | tar -xz
sudo mv cloudflared /usr/local/bin/
```

#### Step 2: Authenticate with Cloudflare
```bash
cloudflared tunnel login
# This opens browser for authentication
# Saves credentials to ~/.cloudflared/
```

#### Step 3: Create the Tunnel
```bash
cloudflared tunnel create lm-studio-tunnel
# This generates a tunnel UUID and credentials file
# Save the UUID - you'll need it
```

#### Step 4: Configure the Tunnel
Create `~/.cloudflared/config.yml`:
```yaml
tunnel: YOUR-TUNNEL-UUID
credentials-file: /Users/YOUR-USERNAME/.cloudflared/YOUR-TUNNEL-UUID.json

ingress:
  - hostname: aientities.saywhatwant.app
    service: http://localhost:1234
    originRequest:
      connectTimeout: 30s
      noTLSVerify: true
      keepAliveConnections: 1
      keepAliveTimeout: 90s
      httpHostHeader: "localhost"
      originServerName: "localhost"
  - service: http_status:404
```

#### Step 5: Route DNS to Tunnel
```bash
cloudflared tunnel route dns lm-studio-tunnel aientities.saywhatwant.app
```

#### Step 6: Run the Tunnel
```bash
# Test run
cloudflared tunnel run lm-studio-tunnel

# Install as service (runs on startup)
sudo cloudflared service install
sudo cloudflared service start
```

### Phase 3: LM Studio Configuration

#### Required LM Studio Settings
```json
{
  "host": "0.0.0.0",  // Listen on all interfaces
  "port": 1234,
  "cors": {
    "enabled": true,
    "origins": ["https://aientities.saywhatwant.app"]
  }
}
```

#### Security Headers
Add to LM Studio responses:
- `X-Frame-Options: DENY`
- `X-Content-Type-Options: nosniff`
- `X-XSS-Protection: 1; mode=block`

### Phase 4: AI Entity Configuration Update

#### Update config-aientities.json
```javascript
{
  "globalSettings": {
    "lmStudioUrl": "https://aientities.saywhatwant.app/v1/chat/completions",
    "fallbackUrl": "http://localhost:1234/v1/chat/completions",  // Local fallback
    "timeout": 30000,
    "retryAttempts": 3
  }
}
```

#### Update AI Bot Code
```javascript
// In ai/src/index.ts
const LM_STUDIO_ENDPOINTS = {
  primary: 'https://aientities.saywhatwant.app/v1/chat/completions',
  fallback: 'http://localhost:1234/v1/chat/completions',
  healthCheck: 'https://aientities.saywhatwant.app/health'
};

async function callLMStudio(messages, model, params) {
  try {
    // Try cloud endpoint first
    return await fetch(LM_STUDIO_ENDPOINTS.primary, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.LM_STUDIO_API_KEY}` // Optional
      },
      body: JSON.stringify({ messages, model, ...params })
    });
  } catch (error) {
    console.log('[LM Studio] Cloud endpoint failed, trying local...');
    // Fallback to direct local connection
    return await fetch(LM_STUDIO_ENDPOINTS.fallback, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages, model, ...params })
    });
  }
}
```

## Security Considerations

### 1. Access Control
```yaml
# In cloudflared config.yml, add access policies
access:
  - hostname: aientities.saywhatwant.app
    policies:
      - decision: allow
        include:
          - ip_range: ["0.0.0.0/0"]  # Or restrict to specific IPs
```

### 2. Rate Limiting
- Implement at Cloudflare edge (WAF rules)
- Set reasonable limits: 100 requests/minute per IP
- Exempt saywhatwant.app domain

### 3. Authentication (Optional)
```yaml
# Add service token authentication
ingress:
  - hostname: aientities.saywhatwant.app
    service: http://localhost:1234
    originRequest:
      httpHostHeader: "localhost"
      access:
        required: true
        teamName: "your-team"
        serviceTokenID: "YOUR-SERVICE-TOKEN-ID"
        serviceTokenSecret: "YOUR-SERVICE-TOKEN-SECRET"
```

### 4. Monitoring
- Cloudflare Analytics for traffic patterns
- Tunnel health metrics via dashboard
- Local logging with cloudflared

## Operational Procedures

### Starting the Service
```bash
# Manual start
cloudflared tunnel run lm-studio-tunnel

# Service management
sudo launchctl start com.cloudflare.cloudflared
sudo launchctl stop com.cloudflare.cloudflared
```

### Health Checks
```bash
# Check tunnel status
cloudflared tunnel info lm-studio-tunnel

# Test connectivity
curl https://aientities.saywhatwant.app/health

# Check local LM Studio
curl http://localhost:1234/health
```

### Troubleshooting

#### Tunnel Not Connecting
1. Check cloudflared logs: `tail -f /var/log/cloudflared.log`
2. Verify credentials: `cloudflared tunnel list`
3. Test DNS: `dig aientities.saywhatwant.app`

#### LM Studio Not Responding
1. Verify LM Studio is running: `lsof -i :1234`
2. Check CORS settings in LM Studio
3. Test local endpoint: `curl http://localhost:1234/v1/models`

#### IP Changes Not Updating
- Cloudflare Tunnel handles this automatically
- If issues persist, restart cloudflared service
- Check tunnel metrics in Cloudflare dashboard

### Monitoring Dashboard
Create monitoring endpoint at `https://aientities.saywhatwant.app/status`:
```json
{
  "tunnel": "active",
  "lm_studio": "healthy",
  "models_loaded": ["model1", "model2"],
  "requests_today": 1234,
  "average_response_time": "2.3s",
  "last_error": null
}
```

## Performance Optimization

### 1. Connection Pooling
```yaml
originRequest:
  keepAliveConnections: 10  # Maintain pool of connections
  keepAliveTimeout: 90s
  tcpKeepAlive: 30s
```

### 2. Compression
```yaml
originRequest:
  disableChunkedEncoding: false
  http2Origin: true  # Use HTTP/2 for better performance
```

### 3. Caching (Where Appropriate)
- Cache model lists (TTL: 1 hour)
- Don't cache completions (dynamic content)
- Cache health checks (TTL: 30 seconds)

## Failure Scenarios & Recovery

### Scenario 1: Internet Outage
- AI entities detect cloud endpoint failure
- Automatically fallback to localhost:1234
- Resume cloud endpoint when connection restored

### Scenario 2: LM Studio Crash
- Cloudflared returns 502 Bad Gateway
- AI entities enter backoff retry mode
- Alert sent to monitoring system

### Scenario 3: Cloudflare Outage
- Extremely rare but possible
- Fallback to direct IP connection (requires port forwarding)
- Temporary measure until Cloudflare recovers

## Cost Considerations
- **Cloudflare Tunnel**: Free for first tunnel
- **Bandwidth**: Included in Cloudflare free plan
- **Additional features**: May require paid plan
  - Multiple tunnels
  - Advanced access controls
  - Enhanced analytics

## Future Enhancements

### Phase 2 (v1.02)
- Load balancing across multiple LM Studio instances
- Automatic model switching based on load
- WebSocket support for streaming responses

### Phase 3 (v1.03)  
- Multi-region failover (additional Macs in different locations)
- Response caching for common queries
- Fine-grained access control per AI entity

## Implementation Checklist

- [ ] Install cloudflared on Mac
- [ ] Authenticate with Cloudflare account
- [ ] Create tunnel `lm-studio-tunnel`
- [ ] Configure tunnel with config.yml
- [ ] Route DNS for aientities.saywhatwant.app
- [ ] Test tunnel connectivity
- [ ] Configure LM Studio CORS settings
- [ ] Update AI entity configuration
- [ ] Implement fallback logic in bot code
- [ ] Set up monitoring and alerts
- [ ] Document API key (if using authentication)
- [ ] Test complete pipeline end-to-end
- [ ] Configure as system service for auto-start
- [ ] Create operational runbook

## Quick Reference Commands

```bash
# Start tunnel
cloudflared tunnel run lm-studio-tunnel

# Check status
cloudflared tunnel info lm-studio-tunnel

# View logs
tail -f ~/.cloudflared/cloudflared.log

# List all tunnels
cloudflared tunnel list

# Delete tunnel (if needed)
cloudflared tunnel delete lm-studio-tunnel

# Test endpoint
curl -X POST https://aientities.saywhatwant.app/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"test"}],"model":"test"}'
```

## Success Criteria
1. ✅ AI entities can reach LM Studio via https://aientities.saywhatwant.app
2. ✅ Automatic failover to local endpoint when cloud unavailable
3. ✅ Zero-downtime during IP address changes
4. ✅ Secure, authenticated connections only
5. ✅ Response times < 3 seconds for completions
6. ✅ 99.9% uptime for the pipeline

---

*This pipeline enables true hybrid AI - local compute with global reach.*
