# MCP Server Setup Guide for Cursor AI

## 🎯 What is MCP?

**Model Context Protocol (MCP)** is a standardized way for AI models (like Claude in Cursor) to interact with external tools and services. By setting up MCP servers, you enable Cursor to:

- Execute Playwright tests
- Control web browsers
- Read test results
- Analyze failures
- Propose and apply fixes automatically

## 📋 Available MCP Servers for Testing

### 1. Puppeteer MCP Server (Recommended)
**Best for**: Chrome browser automation, test execution, debugging

- **Package**: `@executeautomation/puppeteer-mcp-server`
- **Capabilities**: Navigate pages, click elements, fill forms, take screenshots
- **Pros**: Lightweight, fast, Chrome-focused
- **Cons**: Chrome-only (perfect for your use case!)

### 2. Browserbase MCP Server
**Best for**: Cloud-based testing, session recording, complex workflows

- **Package**: `@browserbasehq/mcp-server-browserbase`
- **Capabilities**: Cloud browsers, persistent sessions, debugging tools
- **Pros**: No local browser needed, powerful debugging
- **Cons**: Requires API key, paid service

### 3. Playwright MCP Server
**Best for**: Multi-browser testing, comprehensive automation

- **Note**: Not yet officially released as standalone MCP server
- **Alternative**: Use Puppeteer MCP + Playwright CLI

### 4. Filesystem MCP Server
**Best for**: Reading test results, logs, reports

- **Package**: Built-in to Cursor (or `@modelcontextprotocol/server-filesystem`)
- **Capabilities**: Read/write files, analyze test outputs
- **Pros**: Essential for reading test results
- **Cons**: None

## 🚀 Setup Instructions

### Step 1: Open Cursor MCP Configuration

1. Open Cursor IDE
2. Press `Cmd + Shift + P` (Mac) or `Ctrl + Shift + P` (Windows/Linux)
3. Type: "Preferences: Open User Settings (JSON)"
4. Or navigate to: `Cursor Settings` → `Features` → `Model Context Protocol`

Alternatively, edit the config file directly:
- **Mac**: `~/.cursor/mcp.json` or `~/Library/Application Support/Cursor/User/globalStorage/settings.json`
- **Windows**: `%APPDATA%\Cursor\User\globalStorage\settings.json`
- **Linux**: `~/.config/Cursor/User/globalStorage/settings.json`

### Step 2: Add MCP Server Configurations

Add this to your Cursor MCP configuration:

```json
{
  "mcpServers": {
    "puppeteer": {
      "command": "npx",
      "args": [
        "-y",
        "@executeautomation/puppeteer-mcp-server"
      ]
    },
    "filesystem": {
      "command": "npx",
      "args": [
        "-y",
        "@modelcontextprotocol/server-filesystem",
        "/Users/pbmacstudiomain/devrepo/SAYWHATWANTv1/saywhatwant"
      ]
    }
  }
}
```

**Important**: Replace the filesystem path with your actual project path!

### Step 3: Restart Cursor

1. Close Cursor completely
2. Reopen Cursor
3. Open your project
4. MCP servers will initialize automatically

### Step 4: Verify MCP Connection

In Cursor chat, ask:

```
Are the MCP servers connected?
```

You should see confirmation that the servers are active.

## 🎮 Using MCP Servers

### Basic Commands

Once MCP is configured, you can ask Cursor:

#### Test Execution
```
Use the puppeteer MCP to open my app at localhost:3000 and verify the homepage loads
```

#### Test Analysis
```
Read the test results from playwright-report/index.html and summarize the failures
```

#### Test Generation
```
Use puppeteer to record a user flow: toggle video, change color, submit comment
```

#### Debugging
```
Use puppeteer to navigate to localhost:3000, click the video button, and take a screenshot
```

### Advanced Workflows

#### 1. Full Test + Fix Cycle
```
1. Run the Playwright tests: npm run test
2. Read the test-results/results.json file
3. Analyze any failures
4. Propose code fixes
5. Apply the fixes
6. Run tests again to verify
```

#### 2. Visual Inspection
```
Use puppeteer to:
1. Navigate to localhost:3000
2. Take a screenshot of the homepage
3. Click the video toggle button
4. Wait 1 second
5. Take another screenshot
6. Compare the two screenshots and describe the differences
```

#### 3. Console Error Detection
```
Use puppeteer to:
1. Open localhost:3000
2. Listen for console errors
3. Report any errors found
4. Analyze the source of the errors
5. Propose fixes
```

## 🔧 Advanced Configuration

### Add Browserbase (Cloud Testing)

If you want cloud-based testing with advanced debugging:

1. Sign up at https://browserbase.com
2. Get your API key and Project ID
3. Add to MCP config:

```json
{
  "mcpServers": {
    "puppeteer": {
      "command": "npx",
      "args": ["-y", "@executeautomation/puppeteer-mcp-server"]
    },
    "browserbase": {
      "command": "npx",
      "args": ["-y", "@browserbasehq/mcp-server-browserbase"],
      "env": {
        "BROWSERBASE_API_KEY": "your_api_key_here",
        "BROWSERBASE_PROJECT_ID": "your_project_id_here"
      }
    },
    "filesystem": {
      "command": "npx",
      "args": [
        "-y",
        "@modelcontextprotocol/server-filesystem",
        "/Users/pbmacstudiomain/devrepo/SAYWHATWANTv1/saywhatwant"
      ]
    }
  }
}
```

### Add Custom Environment Variables

```json
{
  "mcpServers": {
    "puppeteer": {
      "command": "npx",
      "args": ["-y", "@executeautomation/puppeteer-mcp-server"],
      "env": {
        "HEADLESS": "true",
        "TIMEOUT": "60000",
        "VIEWPORT_WIDTH": "1920",
        "VIEWPORT_HEIGHT": "1080"
      }
    }
  }
}
```

## 🐛 Troubleshooting

### MCP Servers Not Connecting

**Issue**: Cursor shows "MCP servers offline" or no connection

**Solutions**:
1. Restart Cursor completely
2. Check JSON syntax in MCP config (use a JSON validator)
3. Ensure `npx` is available: Run `npx --version` in terminal
4. Check Cursor logs: `Help` → `Toggle Developer Tools` → `Console` tab

### Permission Errors

**Issue**: "EACCES: permission denied"

**Solution**:
```bash
# Fix npm permissions
sudo chown -R $USER /usr/local/lib/node_modules
```

### Package Not Found

**Issue**: "@executeautomation/puppeteer-mcp-server" not found

**Solution**:
```bash
# Pre-install the package
npm install -g @executeautomation/puppeteer-mcp-server
```

Then update MCP config to use global installation:
```json
{
  "command": "@executeautomation/puppeteer-mcp-server"
}
```

### Filesystem Path Issues

**Issue**: Filesystem MCP can't access files

**Solution**: Use absolute paths in the configuration:
```json
{
  "command": "npx",
  "args": [
    "-y",
    "@modelcontextprotocol/server-filesystem",
    "/Users/YOUR_USERNAME/path/to/project"
  ]
}
```

## 🎯 Alternative: Use Testers.ai

If MCP setup is too complex, **Testers.ai** offers a simpler all-in-one solution:

### Install Testers.ai

```bash
npm install -g testers-ai
```

### Initialize in Your Project

```bash
cd /Users/pbmacstudiomain/devrepo/SAYWHATWANTv1/saywhatwant
testers-ai init
```

### Use with Cursor

Ask Cursor:
```
@testers run all tests
@testers fix failing tests
@testers generate test for video player
@testers watch for changes
```

Testers.ai handles:
- Test execution
- Result analysis
- Auto-fixing
- Test generation
- Watch mode
- Integration with Cursor

**Pros**: 
- Simpler setup
- Purpose-built for Cursor
- Automatic test generation
- Auto-fix capabilities

**Cons**:
- May require subscription
- Less customizable than MCP

## 📊 Comparison Matrix

| Feature | MCP (Puppeteer) | MCP (Browserbase) | Testers.ai |
|---------|----------------|-------------------|------------|
| Setup Complexity | Medium | Medium | Easy |
| Cost | Free | Paid | Freemium |
| Browser Control | ✅ | ✅ | ✅ |
| Test Execution | ✅ | ✅ | ✅ |
| Auto-Fix | Via Cursor | Via Cursor | Built-in |
| Test Generation | Via Cursor | Via Cursor | Built-in |
| Cloud-Based | ❌ | ✅ | Optional |
| Session Recording | ❌ | ✅ | Optional |
| Watch Mode | Manual | Manual | Built-in |

## 🎓 Learning Path

### Week 1: Basic Setup
1. Configure Puppeteer MCP
2. Run simple browser commands via Cursor
3. Execute existing Playwright tests
4. Read test results

### Week 2: Test-Fix Cycle
1. Run tests via Cursor
2. Analyze failures automatically
3. Apply AI-generated fixes
4. Verify fixes with re-run

### Week 3: Advanced Automation
1. Add visual regression tests
2. Set up watch mode (Testers.ai)
3. Configure GitHub Actions
4. Integrate with CI/CD

### Week 4: Optimization
1. Optimize test speed
2. Add more test coverage
3. Configure cloud testing (optional)
4. Document custom workflows

## 💡 Pro Tips

1. **Start Simple**: Begin with Puppeteer MCP only
2. **Test Locally First**: Verify MCP works before complex automation
3. **Use Filesystem MCP**: Essential for reading test results
4. **Consider Testers.ai**: If MCP setup is overwhelming
5. **Combine Tools**: Use MCP for control + Playwright for tests
6. **Document Your Config**: Save working MCP configs for backup

## 🚀 Recommended Workflow

### For You (Chrome Desktop, React/TS, Cloudflare):

**Best Setup**:
1. **Playwright** for test execution (already installed ✅)
2. **Puppeteer MCP** for Cursor browser control
3. **Filesystem MCP** for reading results
4. **GitHub Actions** for CI/CD (already configured ✅)
5. **Optional**: Testers.ai for auto-fix if MCP is too complex

**Daily Workflow**:
1. Make code changes
2. Ask Cursor: "Run tests and report results"
3. If failures: "Analyze failures and fix the code"
4. Verify fixes: "Run tests again"
5. Push to GitHub (CI/CD runs automatically)

## 📞 Support

If you need help:

1. **Cursor Discord**: https://discord.gg/cursor
2. **Playwright Discord**: https://discord.gg/playwright
3. **GitHub Issues**: Your repository issues tab
4. **Ask Cursor**: "Help me debug my MCP configuration"

## ✅ Quick Checklist

- [ ] Cursor IDE installed and updated
- [ ] Node.js 20+ installed
- [ ] Playwright installed (`npm install` in saywhatwant/)
- [ ] MCP config file created/edited
- [ ] Puppeteer MCP server configured
- [ ] Filesystem MCP server configured (with correct path)
- [ ] Cursor restarted
- [ ] MCP connection verified
- [ ] Test run successful via Cursor

---

**You're now ready to automate your testing workflow! 🎉**

Ask Cursor: "Run the Playwright tests and let's get started!"

