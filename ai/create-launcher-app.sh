#!/bin/bash

# This script creates a double-clickable macOS app bundle for the AI Bot
# Run this ON 10.0.0.100 after copying the files

echo "🎨 Creating AI Bot Launcher App..."

# Get the directory where this script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
APP_NAME="Start AI Bot"
APP_PATH="$HOME/Desktop/$APP_NAME.app"

# Create app structure
mkdir -p "$APP_PATH/Contents/MacOS"
mkdir -p "$APP_PATH/Contents/Resources"

# Create the launcher script
cat > "$APP_PATH/Contents/MacOS/launcher" << 'LAUNCHER_EOF'
#!/bin/bash

# Get the path to the AI directory
AI_DIR="$(dirname $(dirname $(dirname "$0")))/../../saywhatwant/ai"

# Open Terminal and run the start script
osascript <<EOF
tell application "Terminal"
    activate
    do script "cd '$AI_DIR' && bash start-ai-bot.sh"
end tell
EOF
LAUNCHER_EOF

# Make it executable
chmod +x "$APP_PATH/Contents/MacOS/launcher"

# Create Info.plist
cat > "$APP_PATH/Contents/Info.plist" << 'PLIST_EOF'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CFBundleExecutable</key>
    <string>launcher</string>
    <key>CFBundleName</key>
    <string>Start AI Bot</string>
    <key>CFBundleIdentifier</key>
    <string>com.saywhatwant.aibot</string>
    <key>CFBundleVersion</key>
    <string>1.0</string>
    <key>CFBundlePackageType</key>
    <string>APPL</string>
    <key>LSMinimumSystemVersion</key>
    <string>10.13</string>
</dict>
</plist>
PLIST_EOF

echo "✅ App bundle created at: $APP_PATH"
echo ""
echo "📱 You can now double-click 'Start AI Bot.app' on your Desktop!"
echo ""
echo "Note: If macOS says it can't open it because of security:"
echo "1. Right-click the app"
echo "2. Click 'Open'"
echo "3. Click 'Open' in the dialog"
echo "(You only need to do this once)"

