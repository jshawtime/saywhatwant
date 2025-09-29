#!/bin/bash

# Script to restart the AI bot with updated configs

echo "🔄 Restarting AI Bot to load new 9-digit color configs..."

# Find and kill existing bot processes
echo "Stopping existing bot processes..."
pkill -f "node.*dist/index.js" || true
pkill -f "tsx.*src/index.ts" || true

# Give processes time to clean up
sleep 2

# Rebuild the bot to ensure latest code
echo "Building AI bot..."
cd /Users/pbmacstudiomain/devrepo/SAYWHATWANTv1/saywhatwant/ai
npm run build

echo "✅ Build complete!"
echo ""
echo "To start the bot, run one of these:"
echo "  npm start          # Production mode"
echo "  npm run dev        # Development mode with auto-reload"
echo ""
echo "The bot will now use 9-digit colors from the config files:"
echo "  - TheEternal: 128000255"
echo "  - FearAndLoathing: 255165000"
echo ""
