# 🤖 Say What Want AI Bot

An AI-powered chat bot for Say What Want, using LM Studio for local language model inference.

## ⚠️ TESTING MODE ACTIVE
The bot is currently configured for live testing with:
- **70% response probability** (high engagement)
- **100 messages/minute** rate limit
- **0.5 second** minimum between messages
- **LIVE posting** to Say What Want (not dry run)

## 🖥️ NEW: Monitoring Console

Monitor all bot activity in real-time:

```bash
# Terminal 1: Start monitoring console
npm run console
# Opens at http://localhost:4000

# Terminal 2: Start bot (it auto-connects to console)
npm run dev
```

The console shows:
- Live bot status and health
- Raw console logs (technical)
- Human-readable conversation view
- Message rates and statistics
- Support for multiple bot instances

## 🚀 Quick Start

### 1. Install Dependencies

```bash
cd saywhatwant/ai
npm install
```

### 2. Configure Environment

```bash
# Copy the example environment file
cp env.example .env

# Edit .env with your settings
# - Set LM_STUDIO_URL to your LM Studio server (default: http://10.0.0.102:1234)
# - Set DRY_RUN=true for testing (won't post real messages)
# - Set DRY_RUN=false when ready to go live
```

### 3. Test LM Studio Connection

```bash
npm test
```

This will verify:
- LM Studio is accessible
- Model is loaded
- Can generate responses

### 4. Run the Bot

**Test Mode (Dry Run):**
```bash
# With DRY_RUN=true in .env
npm run dev
```

**Production Mode:**
```bash
# With DRY_RUN=false in .env
npm run dev

# Or build and run compiled version
npm run build
npm start
```

## 📋 Features

### Smart Response System
- Responds to questions (messages with "?")
- Responds when mentioned by username
- Random engagement based on probability
- Rate limiting to prevent spam
- Context-aware responses

### Dynamic Personality
- Can change username occasionally
- Can change color to match conversation mood
- Adapts tone based on chat activity
- Maintains character as a regular user

### Configuration Options

Edit `src/config.ts` to adjust:

```typescript
BOT: {
  pollingInterval: 5000,           // How often to check for new messages
  minTimeBetweenMessages: 500,     // Minimum delay between bot messages (testing)
  maxMessagesPerMinute: 100,       // Rate limit per minute (testing mode)
  respondToProbability: 0.7,       // 70% chance to respond (testing mode)
  // ... more options
}
```

## 🔄 Switching Between Local and Production

The bot is designed for easy transition between local and production environments:

### Currently Using Local Network:
```typescript
// src/config.ts
baseURL: process.env.LM_STUDIO_URL || 'http://10.0.0.102:1234'
```

### Future Production (with Cloudflare Tunnel):
```typescript
// src/config.ts
baseURL: process.env.LM_STUDIO_URL || 'https://lm-api.yourdomain.com'
```

Just update the `LM_STUDIO_URL` in your `.env` file when ready!

## 🛠️ Development

### File Structure
```
ai/
├── src/
│   ├── config.ts    # Bot configuration
│   ├── types.ts     # TypeScript types
│   ├── index.ts     # Main bot logic
│   └── test.ts      # Connection test
├── package.json
├── tsconfig.json
└── README.md
```

### Available Scripts

- `npm run dev` - Run with hot reload
- `npm run build` - Compile TypeScript
- `npm start` - Run compiled version
- `npm test` - Test LM Studio connection
- `npm run clean` - Clean build files

## 🎯 Bot Behavior

### Response Triggers

The bot decides to respond based on:

1. **Direct Mention** (90% confidence)
   - Someone mentions the bot's username

2. **Questions** (60-80% confidence)
   - Messages containing "?"
   - Higher chance if chat is quiet

3. **Random Engagement** (30% confidence)
   - Configurable probability
   - Less likely when chat is busy

4. **Breaking Silence** (40% confidence)
   - If bot has been quiet too long

### Username Pool

The bot can rotate between these usernames:
- HigherMind
- EternalOne
- MindWave
- ThoughtStream
- Cognition
- ... and more

### Color Palette

Uses Say What Want's visual style:
- Green: `rgb(076, 194, 040)`
- Lime: `rgb(158, 220, 040)`
- Blue: `rgb(040, 150, 220)`
- Pink: `rgb(220, 040, 150)`
- ... and more

## 📊 Monitoring

The bot provides detailed logging:

```
[INFO] Fetched 3 new messages
[DEBUG] Response decision: Question detected (confidence: 0.6)
[SUCCESS] Posted: "Hey, I'm here! What's going on?" as HigherMind
```

Log levels:
- `debug` - All details (set LOG_LEVEL=debug)
- `info` - Normal operation (default)
- `warn` - Warnings only
- `error` - Errors only

## 🚨 Troubleshooting

### LM Studio Connection Failed

1. Ensure LM Studio is running
2. Check server is enabled in LM Studio
3. Verify URL is correct (http://10.0.0.102:1234)
4. Check firewall allows connection

### Bot Not Responding

1. Check `DRY_RUN` setting in `.env`
2. Verify Say What Want API is accessible
3. Check rate limits haven't been exceeded
4. Review logs for decision reasons

### Response Quality Issues

1. Adjust temperature in config (0.7 default)
2. Modify system prompt for better guidance
3. Check context window size
4. Ensure model is appropriate (HigherMind_The-Eternal-1)

## 🔐 Security Notes

- No API keys required for LM Studio
- Bot uses client-authoritative posting (like the app)
- Rate limiting prevents abuse
- Dry run mode for safe testing

## 📈 Future Enhancements

- [ ] Multiple personality modes
- [ ] Conversation thread tracking
- [ ] Mood detection
- [ ] Time-aware responses
- [ ] Multi-bot coordination
- [ ] Web dashboard for monitoring

## 🤝 Integration with Say What Want

The bot integrates seamlessly:
- Uses same comment structure
- Respects polling intervals
- Client-authoritative ID generation
- Matches app's visual style

---

**Ready to chat?** Start the bot and watch it engage naturally with the Say What Want community!
