#!/bin/bash

# AI Bot Launcher for 10.0.0.100
# Double-click this to start the AI bot with PM2

# Get the directory where this script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
AI_DIR="$SCRIPT_DIR"

echo "🤖 Starting AI Bot on 10.0.0.100..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Navigate to AI directory
cd "$AI_DIR"

# Check if already running
if pm2 list | grep -q "ai-bot.*online"; then
    echo "⚠️  AI Bot is already running!"
    echo ""
    echo "What would you like to do?"
    echo "  1) Restart the bot"
    echo "  2) Stop the bot"
    echo "  3) View logs"
    echo "  4) Exit"
    echo ""
    read -p "Enter choice (1-4): " choice
    
    case $choice in
        1)
            echo "🔄 Restarting AI bot..."
            pm2 restart ai-bot
            echo "✅ Bot restarted!"
            ;;
        2)
            echo "🛑 Stopping AI bot..."
            pm2 stop ai-bot
            echo "✅ Bot stopped!"
            ;;
        3)
            echo "📋 Showing logs (Ctrl+C to exit)..."
            pm2 logs ai-bot
            ;;
        4)
            echo "👋 Exiting..."
            exit 0
            ;;
        *)
            echo "❌ Invalid choice"
            exit 1
            ;;
    esac
else
    echo "📦 Building AI bot..."
    npm run build
    
    if [ $? -ne 0 ]; then
        echo "❌ Build failed! Check the errors above."
        echo ""
        read -p "Press Enter to exit..."
        exit 1
    fi
    
    echo "✅ Build successful!"
    echo ""
    echo "🚀 Starting AI bot with PM2..."
    pm2 start dist/index.js --name ai-bot
    
    if [ $? -ne 0 ]; then
        echo "❌ Failed to start bot!"
        echo ""
        read -p "Press Enter to exit..."
        exit 1
    fi
    
    echo "✅ AI Bot started!"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 Status:"
pm2 list | grep ai-bot
echo ""
echo "📋 Recent logs:"
pm2 logs ai-bot --lines 10 --nostream
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "✅ DONE!"
echo ""
echo "📱 Access Queue Monitor from any computer:"
echo "   http://10.0.0.100:5173"
echo ""
echo "💡 Useful commands:"
echo "   pm2 list          - Show all processes"
echo "   pm2 logs ai-bot   - View live logs"
echo "   pm2 restart ai-bot - Restart the bot"
echo "   pm2 stop ai-bot   - Stop the bot"
echo ""
read -p "Press Enter to exit..."

