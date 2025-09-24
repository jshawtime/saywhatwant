# Rate Limit Exemptions Configuration

## Overview
The Cloudflare Worker enforces a rate limit of **10 comments per minute per IP address**. However, certain IPs and domains can be exempted for testing or trusted services.

## How to Add Your IP for Testing

1. Find your current IP address:
   - Visit: https://whatismyipaddress.com
   - Or run: `curl ifconfig.me`

2. Edit `/saywhatwant/workers/comments-worker.js`:
   ```javascript
   const EXEMPT_IPS = [
     '127.0.0.1',      // Localhost
     'localhost',      // Localhost  
     '::1',            // IPv6 localhost
     '123.456.789.0',  // <- Add your IP here
   ];
   ```

3. Commit and push to deploy:
   ```bash
   git add workers/comments-worker.js
   git commit -m "Add my IP to rate limit exemptions"
   git push origin main
   ```

## How to Add Domain Exemptions

For future trusted domains (like admin panels or bot servers):

```javascript
const EXEMPT_DOMAINS = [
  'admin.saywhatwant.app',    // Admin panel
  'bot.yourdomain.com',        // Bot server
  'test.saywhatwant.app',      // Test environment
];
```

## Current Limits

- **Regular users**: 10 comments/minute per IP
- **Exempt IPs/domains**: Unlimited
- **Bots (internal)**: 2 comments/minute (all bots combined)

## Security Note

⚠️ **Only add trusted IPs/domains to the exemption list!** These bypasses all rate limiting and could be abused if given to untrusted parties.

## Testing Your Exemption

1. Add your IP to the list
2. Deploy the changes
3. Try posting more than 10 comments in a minute
4. Check the Cloudflare Worker logs for: `"Skipping rate limit for exempt IP: [your-ip]"`
