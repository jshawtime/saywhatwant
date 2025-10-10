#!/usr/bin/env node

/**
 * MCP Configuration Helper for Cursor AI
 * 
 * This script helps you set up MCP servers for automated testing in Cursor.
 * Run: node scripts/setup-mcp.js
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

// Determine Cursor config location based on OS
function getCursorConfigPath() {
  const platform = os.platform();
  const homeDir = os.homedir();
  
  switch (platform) {
    case 'darwin': // macOS
      return path.join(homeDir, 'Library', 'Application Support', 'Cursor', 'User', 'settings.json');
    case 'win32': // Windows
      return path.join(process.env.APPDATA || '', 'Cursor', 'User', 'settings.json');
    case 'linux':
      return path.join(homeDir, '.config', 'Cursor', 'User', 'settings.json');
    default:
      return null;
  }
}

// Get current project directory
const projectDir = path.resolve(__dirname, '..');

// MCP Configuration template
const mcpConfig = {
  mcpServers: {
    puppeteer: {
      command: "npx",
      args: [
        "-y",
        "@executeautomation/puppeteer-mcp-server"
      ]
    },
    filesystem: {
      command: "npx",
      args: [
        "-y",
        "@modelcontextprotocol/server-filesystem",
        projectDir
      ]
    }
  }
};

console.log('🚀 Cursor MCP Setup Helper\n');
console.log('This script will help you configure MCP servers for automated testing.\n');

// Step 1: Show detected project path
console.log('📁 Detected Project Path:');
console.log(`   ${projectDir}\n`);

// Step 2: Check for Cursor installation
const cursorConfigPath = getCursorConfigPath();

if (!cursorConfigPath) {
  console.log('❌ Could not detect Cursor installation path for your OS.');
  console.log('   Please configure MCP manually using the guide.\n');
} else {
  console.log('📍 Cursor Configuration Path:');
  console.log(`   ${cursorConfigPath}\n`);
}

// Step 3: Generate MCP configuration
console.log('📝 Generated MCP Configuration:\n');
console.log(JSON.stringify(mcpConfig, null, 2));
console.log('\n');

// Step 4: Save to local file
const localConfigPath = path.join(projectDir, '.cursor-mcp-config.json');
fs.writeFileSync(localConfigPath, JSON.stringify(mcpConfig, null, 2));
console.log(`✅ Configuration saved to: ${localConfigPath}\n`);

// Step 5: Instructions
console.log('📋 Next Steps:\n');
console.log('1. Open Cursor IDE');
console.log('2. Press Cmd+Shift+P (Mac) or Ctrl+Shift+P (Windows/Linux)');
console.log('3. Type: "Preferences: Open User Settings (JSON)"');
console.log('4. Add the MCP configuration from the generated file above');
console.log('5. Restart Cursor\n');

console.log('📖 Alternative Methods:\n');
console.log('Method 1: Manual Configuration');
console.log('  - Copy the JSON above');
console.log('  - Paste into Cursor Settings → Features → Model Context Protocol\n');

console.log('Method 2: Direct File Edit (Advanced)');
if (cursorConfigPath) {
  console.log(`  - Open: ${cursorConfigPath}`);
  console.log('  - Add the "mcpServers" section to your settings');
  console.log('  - Save and restart Cursor\n');
}

console.log('Method 3: Use Testers.ai (Simpler Alternative)');
console.log('  - Run: npm install -g testers-ai');
console.log('  - Run: testers-ai init');
console.log('  - Ask Cursor: @testers run tests\n');

// Step 6: Test commands
console.log('🧪 Test Your Setup:\n');
console.log('After configuring, ask Cursor:');
console.log('  "Are the MCP servers connected?"');
console.log('  "Use puppeteer to open localhost:3000"\n');

// Step 7: Quick start
console.log('⚡ Quick Start:\n');
console.log('1. Start dev server: npm run dev');
console.log('2. Ask Cursor: "Use puppeteer to test my app at localhost:3000"');
console.log('3. Ask Cursor: "Run the Playwright tests and analyze results"\n');

// Step 8: Troubleshooting
console.log('🐛 Troubleshooting:\n');
console.log('If MCP servers don\'t connect:');
console.log('  - Ensure Node.js 20+ is installed: node --version');
console.log('  - Restart Cursor completely');
console.log('  - Check JSON syntax in settings');
console.log('  - View logs: Help → Toggle Developer Tools → Console\n');

// Step 9: Documentation
console.log('📚 Documentation:\n');
console.log('  - Full Guide: MCP_SETUP_GUIDE.md');
console.log('  - Quick Reference: TESTING_QUICK_REFERENCE.md');
console.log('  - Complete Guide: TESTING_AUTOMATION_GUIDE.md\n');

console.log('✨ Setup complete! Happy testing!\n');

