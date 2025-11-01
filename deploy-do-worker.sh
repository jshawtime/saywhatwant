#!/bin/bash

# Deploy SayWhatWant Durable Objects Worker
# This script deploys the new DO-based worker

echo "🚀 Deploying SayWhatWant Durable Objects Worker..."
echo ""

# Change to saywhatwant directory
cd "$(dirname "$0")"

# Deploy using the DO-specific wrangler config
wrangler deploy --config wrangler-do.toml

echo ""
echo "✅ Deployment complete!"
echo ""
echo "Worker URL: https://saywhatwant-do-worker.bootloaders.workers.dev"
echo ""
echo "Test it:"
echo "  curl https://saywhatwant-do-worker.bootloaders.workers.dev/api/comments?since=0"
echo ""

