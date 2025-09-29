#!/bin/bash

# Fast KV clear using wrangler bulk operations
echo "🚀 Fast KV Clear Script"
echo "======================="
echo ""

# First, get all keys and save to a file
echo "📋 Fetching all keys from KV..."
npx wrangler kv:key list --binding COMMENTS_KV > /tmp/kv-keys.json

# Count the keys
KEY_COUNT=$(cat /tmp/kv-keys.json | jq '. | length')
echo "Found $KEY_COUNT keys to delete"

if [ "$KEY_COUNT" -eq "0" ]; then
    echo "✅ KV store is already empty!"
    exit 0
fi

# Extract just the key names
echo "📝 Preparing bulk delete list..."
cat /tmp/kv-keys.json | jq -r '.[].name' > /tmp/kv-key-names.txt

# Convert to JSON array format for bulk delete
cat /tmp/kv-key-names.txt | jq -R -s 'split("\n")[:-1]' > /tmp/kv-bulk-delete.json

echo "🔥 Performing BULK DELETE..."
echo ""

# Use wrangler bulk delete (MUCH faster than individual deletes)
npx wrangler kv:bulk delete --binding COMMENTS_KV --json /tmp/kv-bulk-delete.json

# Clean up temp files
rm -f /tmp/kv-keys.json /tmp/kv-key-names.txt /tmp/kv-bulk-delete.json

echo ""
echo "✅ KV store cleared successfully!"
echo "💡 New comments will now use 9-digit color format"
echo "   Old: rgb(255, 20, 147)"
echo "   New: 255020147"
