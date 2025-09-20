# Multi-Domain Deployment Strategy

## Overview
This system allows you to deploy Say What Want to 100+ domains with minimal configuration changes.

## 📦 What's Been Implemented

### 1. **Domain Configuration System** (`config/domain-config.ts`)
```typescript
export const DOMAIN_CONFIGS: Record<string, DomainConfig> = {
  'saywhatwant.app': {
    domain: 'saywhatwant.app',
    title: 'Say What Want',
  },
  'shittosay.app': {
    domain: 'shittosay.app', 
    title: 'Shit To Say',
  },
  // Add new domains here...
};
```

### 2. **Domain Filtering**
- LED-style indicator next to title
- Filters to show only messages from current domain
- State saved in localStorage
- Default: ON (shows only current domain)

### 3. **Domain Storage**
- Each comment now stores its origin domain
- Removed userAgent field (saved ~100 chars per message)
- Domain captured automatically from browser

### 4. **Dynamic Title**
- Title changes based on current domain
- Brightness changes with filter state

## 🚀 How to Deploy to New Domain

### Step 1: Add Domain to Configuration
```typescript
// In config/domain-config.ts
'yournewdomain.com': {
  domain: 'yournewdomain.com',
  title: 'Your Title Here',
  description: 'Optional description',
},
```

### Step 2: Deploy to Vercel (Easiest)
```bash
# 1. Add domain to Vercel project
vercel domains add yournewdomain.com

# 2. Deploy
vercel --prod
```

### Step 3: Update Cloudflare Worker CORS (if needed)
```javascript
// In workers/comments-worker.js
const corsHeaders = {
  'Access-Control-Allow-Origin': '*', // Already allows all domains
};
```

## 📋 Deployment Checklist

For each new domain:
- [ ] Add to `DOMAIN_CONFIGS` 
- [ ] Choose appropriate title
- [ ] Deploy to hosting
- [ ] Point DNS to hosting
- [ ] Test domain filter

## 🌐 Mass Deployment Script

Create `deploy-domains.sh`:
```bash
#!/bin/bash

DOMAINS=(
  "domain1.com"
  "domain2.com"
  "domain3.com"
  # Add all 100 domains...
)

for domain in "${DOMAINS[@]}"
do
  echo "Deploying to $domain"
  vercel alias set your-project.vercel.app $domain
done
```

## 💡 Advanced Features

### Per-Domain Themes (Future)
```typescript
'artsy.app': {
  domain: 'artsy.app',
  title: 'Artsy Says',
  theme: {
    primaryColor: '#FF6B6B',
    accentColor: '#4ECDC4',
  }
}
```

### Domain Analytics
```typescript
// Track messages per domain
const domainStats = comments.reduce((acc, comment) => {
  acc[comment.domain] = (acc[comment.domain] || 0) + 1;
  return acc;
}, {});
```

### Domain-Specific Filters
```typescript
// Auto-filter negative words per domain
'familyfriendly.app': {
  domain: 'familyfriendly.app',
  title: 'Family Chat',
  autoFilters: ['explicit', 'words', 'here'],
}
```

## 🔧 Technical Details

### Domain Capture
```javascript
// Automatic in worker
const domain = body.domain || 
  request.headers.get('Origin')?.replace(/^https?:\/\//, '') || 
  'unknown';
```

### LED Indicator States
- **ON**: Bright LED, shows only current domain
- **OFF**: Dim LED, shows all domains

### Storage Impact
- Old: ~400 chars per message (with userAgent)
- New: ~300 chars per message (with domain, no userAgent)
- **Savings**: 25% less storage per message

## 📊 Scaling Considerations

| Domains | Messages/Day | Storage/Month | Cost/Month |
|---------|-------------|---------------|------------|
| 10      | 10,000      | ~90MB         | ~$5        |
| 50      | 50,000      | ~450MB        | ~$25       |
| 100     | 100,000     | ~900MB        | ~$50       |
| 500     | 500,000     | ~4.5GB        | ~$250      |

## 🚨 Important Notes

1. **Single Worker**: All domains share the same Cloudflare Worker and KV store
2. **Domain Filter**: Users can toggle to see messages from all domains
3. **Migration**: Old messages without domain field still work
4. **Privacy**: Domains are visible to all users when filter is off

## 🎯 Quick Test

1. Add test domain to `/etc/hosts`:
```bash
127.0.0.1 testdomain.local
```

2. Add to config:
```typescript
'testdomain.local:3000': {
  domain: 'testdomain.local:3000',
  title: 'Test Domain',
},
```

3. Visit `http://testdomain.local:3000`

## ✅ Success Metrics

- Domain correctly captured: ✓
- Title changes per domain: ✓
- Filter works correctly: ✓
- Messages persist: ✓
- Cross-domain visibility (when filter OFF): ✓

---

**Status**: Ready for multi-domain deployment
**Version**: 1.0.0
**Last Updated**: September 20, 2025
