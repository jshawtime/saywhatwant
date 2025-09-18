#!/bin/bash

# Kill processes on ports 3000 and 3001
echo "🧹 Cleaning up ports 3000 and 3001..."
lsof -ti:3000,3001 | xargs kill -9 2>/dev/null || true

# Optional: Kill any node processes (uncomment if needed)
# pkill -f "node.*next" 2>/dev/null || true

# Start the dev server on port 3000
echo "🚀 Starting Say What Want on port 3000..."
PORT=3000 npm run dev
