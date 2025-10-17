#!/bin/bash
# Bot Health Monitor - Continuous logging to detect crash causes

# Setup
LOG_DIR="/Users/pbmacstudiomain/devrepo/SAYWHATWANTv1/saywhatwant/logs"
mkdir -p "$LOG_DIR"
LOG_FILE="$LOG_DIR/bot-health-$(date +%Y%m%d-%H%M%S).log"
WARN_FILE="$LOG_DIR/warnings.log"

echo "🔍 PM2 Bot Health Monitor"
echo "=================================================="
echo "Log: $LOG_FILE"
echo "Warnings: $WARN_FILE"
echo "Press Ctrl+C to stop"
echo "=================================================="
echo ""

# Initialize log file
{
  echo "🔍 HEALTH MONITOR STARTED: $(date)"
  echo "=================================================="
  echo "Config: 10s polling interval"
  echo "Tracking: Memory, File Descriptors, Network Connections"
  echo "=================================================="
  echo ""
} > "$LOG_FILE"

# Cleanup on exit
start_time=$(date +%s)
iteration=0

cleanup() {
  duration=$(($(date +%s) - start_time))
  echo ""
  echo "🛑 Monitoring stopped after ${duration}s ($iteration checks)"
  {
    echo ""
    echo "=================================================="
    echo "🛑 SESSION ENDED: $(date)"
    echo "Duration: ${duration} seconds"
    echo "Total Checks: $iteration"
    echo "=================================================="
  } >> "$LOG_FILE"
  exit 0
}
trap cleanup INT TERM

echo "Time(s) | PID    | Memory(MB) | FDs  | Conns | Status"
echo "--------|--------|------------|------|-------|--------"

while true; do
  iteration=$((iteration + 1))
  elapsed=$(($(date +%s) - start_time))
  
  # Get PID
  PID=$(pm2 jlist 2>/dev/null | python3 -c "import sys, json; data = json.load(sys.stdin); pids = [p['pid'] for p in data if p.get('name') == 'ai-bot']; print(pids[0] if pids else '')" 2>/dev/null)
  
  if [ -z "$PID" ]; then
    MSG="❌ BOT CRASHED OR STOPPED"
    echo "$elapsed | N/A    | N/A        | N/A  | N/A   | $MSG"
    {
      echo "[$(date)] $MSG at ${elapsed}s"
      echo "=================================================="
    } >> "$LOG_FILE"
    exit 1
  fi
  
  # Get metrics
  MEM=$(ps -p $PID -o rss= 2>/dev/null | awk '{print int($1/1024)}')
  FD_COUNT=$(lsof -p $PID 2>/dev/null | wc -l | tr -d ' ')
  NET_CONN=$(lsof -p $PID -i 2>/dev/null | grep ESTABLISHED | wc -l | tr -d ' ')
  
  # Status check
  STATUS="✅"
  if [ "$MEM" -gt 500 ]; then STATUS="⚠️MEM"; fi
  if [ "$FD_COUNT" -gt 500 ]; then STATUS="⚠️FD"; fi
  if [ "$NET_CONN" -gt 50 ]; then STATUS="⚠️NET"; fi
  
  # Display
  printf "%7d | %6d | %10d | %4d | %5d | %s\n" "$elapsed" "$PID" "$MEM" "$FD_COUNT" "$NET_CONN" "$STATUS"
  
  # Log to file
  echo "[$(date '+%H:%M:%S')] ${elapsed}s | PID:$PID | Mem:${MEM}MB | FD:$FD_COUNT | Conn:$NET_CONN | $STATUS" >> "$LOG_FILE"
  
  # Warning file (if issues detected)
  if [[ "$STATUS" != "✅" ]]; then
    {
      echo "[$(date)] ⚠️ $STATUS at ${elapsed}s - PID:$PID Mem:${MEM}MB FD:$FD_COUNT Conn:$NET_CONN"
    } >> "$WARN_FILE"
  fi
  
  sleep 10
done