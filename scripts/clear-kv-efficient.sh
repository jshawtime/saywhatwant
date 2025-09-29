#!/bin/bash

# Script to efficiently clear KV store using wrangler bulk delete
# This approach deletes keys by prefix which is much faster

echo "🗑️  Starting efficient KV store cleanup..."
echo ""

# Function to delete keys by prefix
delete_by_prefix() {
    local prefix=$1
    local description=$2
    
    echo "Deleting $description (prefix: $prefix)..."
    
    # Get all keys with this prefix
    keys=$(npx wrangler kv:key list --binding COMMENTS_KV --prefix "$prefix" 2>/dev/null | jq -r '.[].name' 2>/dev/null)
    
    if [ -z "$keys" ]; then
        echo "  No keys found with prefix: $prefix"
        return
    fi
    
    # Count keys
    count=$(echo "$keys" | wc -l | tr -d ' ')
    echo "  Found $count keys to delete"
    
    # Delete each key
    echo "$keys" | while read -r key; do
        if [ ! -z "$key" ]; then
            npx wrangler kv:key delete --binding COMMENTS_KV "$key" --force 2>/dev/null
        fi
    done
    
    echo "  ✅ Deleted $description"
}

# Check if jq is installed
if ! command -v jq &> /dev/null; then
    echo "❌ Error: jq is not installed. Installing with homebrew..."
    brew install jq
fi

echo "📊 Starting deletion by category..."
echo ""

# Delete all comments
delete_by_prefix "comment:" "all comments"

# Delete cache
delete_by_prefix "recent:" "cache entries"

# Delete rate limit entries  
delete_by_prefix "rate:" "rate limit entries"

# Delete message counter
echo "Deleting message counter..."
npx wrangler kv:key delete --binding COMMENTS_KV "message-count" --force 2>/dev/null
echo "  ✅ Deleted message counter"

echo ""
echo "✅ KV cleanup complete!"
echo ""
echo "💡 The KV store has been cleared."
echo "   New comments will use 9-digit color format:"
echo "   • Old format: rgb(255, 20, 147)"
echo "   • New format: 255020147"
