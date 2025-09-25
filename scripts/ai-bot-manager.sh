#!/bin/bash

# AI Bot Manager for Say What Want
# v1.01 - PM2 Management

case "$1" in
    start)
        echo "🤖 Starting AI Bot..."
        pm2 start ai-bot
        pm2 logs ai-bot --lines 10 --nostream
        ;;
    
    stop)
        echo "🛑 Stopping AI Bot..."
        pm2 stop ai-bot
        ;;
    
    restart)
        echo "🔄 Restarting AI Bot..."
        pm2 restart ai-bot
        pm2 logs ai-bot --lines 10 --nostream
        ;;
    
    status)
        echo "📊 AI Bot Status:"
        pm2 status ai-bot
        echo ""
        echo "Recent activity:"
        pm2 logs ai-bot --lines 5 --nostream | grep -E "📥|🤖|ping|response" || echo "No recent messages"
        ;;
    
    logs)
        echo "📜 AI Bot Logs (Ctrl+C to exit):"
        pm2 logs ai-bot
        ;;
    
    logs-error)
        echo "❌ Error Logs:"
        tail -50 ~/.pm2/logs/ai-bot-error.log
        ;;
    
    test)
        echo "🧪 Testing Bot Pipeline..."
        echo "1. Checking PM2 status..."
        pm2 list | grep ai-bot
        
        echo -e "\n2. Checking LM Studio connection..."
        curl -s http://localhost:1234/v1/models | jq -r '.data[0].id' 2>/dev/null && echo "✅ LM Studio is running" || echo "❌ LM Studio is not responding"
        
        echo -e "\n3. Checking Cloudflare tunnel..."
        curl -s https://aientities.saywhatwant.app/v1/models | jq -r '.data[0].id' 2>/dev/null && echo "✅ Tunnel is working" || echo "❌ Tunnel is not working"
        
        echo -e "\n4. Recent bot activity:"
        pm2 logs ai-bot --lines 20 --nostream | grep -E "Fetched|response|ping" | tail -5
        ;;
    
    enable-startup)
        echo "🚀 To enable auto-start on boot, run this command:"
        echo ""
        echo "sudo env PATH=\$PATH:/opt/homebrew/Cellar/node/24.4.0/bin /opt/homebrew/lib/node_modules/pm2/bin/pm2 startup launchd -u pbmacstudiomain --hp /Users/pbmacstudiomain"
        echo ""
        echo "This requires your admin password."
        ;;
    
    *)
        echo "AI Bot Manager - PM2 Control"
        echo ""
        echo "Usage: $0 {start|stop|restart|status|logs|logs-error|test|enable-startup}"
        echo ""
        echo "Commands:"
        echo "  start          - Start the AI bot"
        echo "  stop           - Stop the AI bot"
        echo "  restart        - Restart the AI bot (use after code changes)"
        echo "  status         - Check if bot is running and recent activity"
        echo "  logs           - Watch live logs (Ctrl+C to exit)"
        echo "  logs-error     - View error logs"
        echo "  test           - Test entire pipeline (PM2, LM Studio, Tunnel)"
        echo "  enable-startup - Show command to enable auto-start on boot"
        echo ""
        echo "Current Status:"
        pm2 list | grep -E "ai-bot|───" || echo "Bot not found in PM2"
        exit 1
        ;;
esac
