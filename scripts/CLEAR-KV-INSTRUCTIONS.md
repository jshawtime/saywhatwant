# Clear KV Store - Instructions

## Current Situation
- **12,522 comments** stored with RGB format colors
- **1 cache entry** (recent:comments)
- **1 message counter**
- **1 rate limit entry**

## Fastest Method: Delete and Recreate KV Namespace

Since we have 12,500+ keys, the fastest approach is to delete the entire KV namespace and create a new one:

### Step 1: Delete Current Namespace
```bash
npx wrangler kv:namespace delete --namespace-id ddf6162d4c874d52bb6e41d1c3889a0f
```
Or use the binding name:
```bash
npx wrangler kv:namespace delete --binding COMMENTS_KV
```

### Step 2: Create New Namespace
```bash
npx wrangler kv:namespace create COMMENTS_KV
```

This will output something like:
```
🌀 Creating namespace with title "sww-comments-COMMENTS_KV"
✨ Success!
Add the following to your configuration file in your kv_namespaces array:
{ binding = "COMMENTS_KV", id = "NEW_ID_HERE" }
```

### Step 3: Update Both wrangler.toml Files

Update the namespace ID in both files:

**`/saywhatwant/wrangler.toml`**:
```toml
[[kv_namespaces]]
binding = "COMMENTS_KV"
id = "NEW_ID_HERE"  # <- Replace with new ID
```

**`/saywhatwant/workers/wrangler.toml`**:
```toml
[[kv_namespaces]]
binding = "COMMENTS_KV"
id = "NEW_ID_HERE"  # <- Same new ID here
```

### Step 4: Redeploy Both Workers
```bash
# Deploy main site
cd /Users/pbmacstudiomain/devrepo/SAYWHATWANTv1/saywhatwant
npm run cloudflare:deploy

# Deploy comments worker
cd workers
npx wrangler deploy
```

## Alternative: Clear Using Script (Slower)

If you want to keep the same namespace ID, you can run the clearing script:

```bash
cd /Users/pbmacstudiomain/devrepo/SAYWHATWANTv1/saywhatwant
./scripts/clear-kv-efficient.sh
```

⚠️ **Warning**: This will take 10-15 minutes for 12,500 keys!

## After Clearing

✅ All new comments will be stored in **9-digit color format**
✅ No more RGB strings in KV
✅ Consistent format throughout the system

### New Format Example:
- **Old**: `"color": "rgb(255, 20, 147)"`
- **New**: `"color": "255020147"`
