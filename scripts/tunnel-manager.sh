#!/bin/bash

# Cloudflare Tunnel Manager for LM Studio
# v1.01 - Say What Want

TUNNEL_NAME="lm-studio-tunnel"
TUNNEL_UUID="9d0ba451-0b6a-46b9-95c9-ea2866d04a6e"
PLIST_PATH="$HOME/Library/LaunchAgents/com.cloudflare.cloudflared.plist"

case "$1" in
    start)
        echo "Starting Cloudflare tunnel..."
        launchctl load -w "$PLIST_PATH"
        sleep 2
        if launchctl list | grep -q cloudflared; then
            echo "✅ Tunnel started successfully"
            echo "🌐 Endpoint: https://aientities.saywhatwant.app"
        else
            echo "❌ Failed to start tunnel"
            exit 1
        fi
        ;;
    
    stop)
        echo "Stopping Cloudflare tunnel..."
        launchctl unload "$PLIST_PATH"
        echo "✅ Tunnel stopped"
        ;;
    
    restart)
        $0 stop
        sleep 2
        $0 start
        ;;
    
    status)
        echo "Checking tunnel status..."
        if launchctl list | grep -q cloudflared; then
            echo "✅ Tunnel service is running"
            
            # Check if endpoint is accessible
            if curl -s -o /dev/null -w "%{http_code}" https://aientities.saywhatwant.app/v1/models | grep -q 200; then
                echo "✅ Cloud endpoint is accessible"
                
                # Get model info
                MODEL=$(curl -s https://aientities.saywhatwant.app/v1/models | jq -r '.data[0].id' 2>/dev/null)
                if [ -n "$MODEL" ]; then
                    echo "📊 Active model: $MODEL"
                fi
            else
                echo "⚠️  Cloud endpoint is not responding"
            fi
        else
            echo "❌ Tunnel service is not running"
        fi
        
        # Check tunnel info
        echo ""
        echo "Tunnel details:"
        cloudflared tunnel info "$TUNNEL_NAME" 2>/dev/null || echo "Could not get tunnel info"
        ;;
    
    logs)
        echo "Showing recent tunnel logs..."
        echo "--- STDOUT ---"
        tail -20 ~/Library/Logs/cloudflared.out.log
        echo ""
        echo "--- STDERR ---"
        tail -20 ~/Library/Logs/cloudflared.err.log
        ;;
    
    test)
        echo "Testing LM Studio via cloud endpoint..."
        echo "Sending test prompt..."
        
        RESPONSE=$(curl -s -X POST https://aientities.saywhatwant.app/v1/chat/completions \
          -H "Content-Type: application/json" \
          -d '{
            "messages": [{"role": "user", "content": "Say hello in exactly 3 words"}],
            "model": "highermind_the-eternal-1",
            "temperature": 0.7,
            "max_tokens": 20
          }' | jq -r '.choices[0].message.content' 2>/dev/null)
        
        if [ -n "$RESPONSE" ]; then
            echo "✅ Response received: $RESPONSE"
        else
            echo "❌ Failed to get response"
            exit 1
        fi
        ;;
    
    *)
        echo "Cloudflare Tunnel Manager for LM Studio"
        echo ""
        echo "Usage: $0 {start|stop|restart|status|logs|test}"
        echo ""
        echo "Commands:"
        echo "  start   - Start the tunnel service"
        echo "  stop    - Stop the tunnel service"
        echo "  restart - Restart the tunnel service"
        echo "  status  - Check tunnel and endpoint status"
        echo "  logs    - Show recent tunnel logs"
        echo "  test    - Test LM Studio through cloud endpoint"
        echo ""
        echo "Cloud endpoint: https://aientities.saywhatwant.app"
        echo "Local endpoint: http://localhost:1234"
        exit 1
        ;;
esac
