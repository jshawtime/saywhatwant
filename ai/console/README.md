# 🖥️ AI Bot Monitoring Console

Real-time monitoring dashboard for Say What Want AI bots.

## Features

- **Live Bot Status**: Track multiple bot instances simultaneously
- **Dual View**:
  - **Console Output**: Raw technical logs with all details
  - **Conversation View**: Human-readable chat format
- **Real-time Updates**: WebSocket connection for instant updates
- **Multi-Bot Support**: Monitor multiple LM Studio instances
- **Performance Metrics**: Message rate, active bots, total logs

## Quick Start

### 1. Start the Console Server

```bash
# From the ai directory
npm run console

# Or directly from console directory
cd console
npm install
npm start
```

The console will start at `http://localhost:4000`

### 2. Configure Bots to Report

Bots automatically register with the console when they start.
Set the console URL in your bot's environment:

```bash
# In ai/.env
CONSOLE_URL=http://localhost:4000
BOT_ID=bot-highermind-1  # Optional: custom bot ID
```

### 3. Start Your Bots

```bash
# In another terminal
cd ai
npm run dev
```

## Console Interface

### Header Stats
- **Active Bots**: Number of currently connected bots
- **Total Logs**: Total log entries received
- **Messages/Min**: Current message rate
- **Status**: WebSocket connection status

### Bot Status Bar
Shows all registered bots with:
- 🟢 **Green**: Active (responding within 30 seconds)
- 🔴 **Red**: Inactive (no response for 30+ seconds)

### Console Output Panel (Left)
Raw technical logs showing:
- **Debug** (gray): Detailed technical info
- **Info** (blue): General information
- **Success** (green): Successful operations
- **Warning** (orange): Warnings
- **Error** (red): Errors
- **Message** (cyan): Incoming messages from Say What Want
- **Response** (magenta): Bot-generated responses

### Conversation View Panel (Right)
Human-readable chat format showing:
- User messages received by the bot
- Bot responses with confidence levels
- Username and color information
- Timestamps

## Multiple Bot Support

To run multiple bots with different models:

### Terminal 1: Console
```bash
npm run console
```

### Terminal 2: Bot 1
```bash
BOT_ID=bot-highermind CONSOLE_URL=http://localhost:4000 npm run dev
```

### Terminal 3: Bot 2
```bash
BOT_ID=bot-llama LM_STUDIO_MODEL=llama-model CONSOLE_URL=http://localhost:4000 npm run dev
```

## Log Levels

Control what gets logged:

```javascript
// In bot's config.ts
LOGGING: {
  level: 'debug', // 'debug' | 'info' | 'warn' | 'error'
}
```

## Troubleshooting

### Console not receiving logs
1. Check console server is running: `http://localhost:4000`
2. Verify bot has correct CONSOLE_URL
3. Check network/firewall settings

### Bots showing as inactive
- Bots are marked inactive after 30 seconds without logs
- This is normal if bot isn't actively processing

### WebSocket disconnection
- Console automatically reconnects
- Check console server logs for errors

## Advanced Usage

### Custom Console Port
```bash
PORT=5000 npm start  # Start console on port 5000
```

### Remote Monitoring
To monitor bots from another machine:
1. Start console with public IP binding
2. Update bot's CONSOLE_URL to remote address
3. Ensure firewall allows port 4000

## Performance

- Console keeps last 1000 total logs
- Each bot's individual log limited to 100 entries
- UI displays last 500 console entries
- Chat view shows last 200 messages
- Auto-scroll when at bottom, manual scroll to review history
