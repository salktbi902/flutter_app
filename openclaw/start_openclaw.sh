#!/bin/bash
# Start OpenClaw AI Guardian v3.0
cd /root/openclaw-system
export NODE_PATH=/root/node_modules
nohup node server.js > /root/openclaw-system/logs/server.log 2>&1 &
echo $! > /root/openclaw-system/openclaw.pid
sleep 3
if curl -s http://localhost:3100/health | grep -q "healthy"; then
  echo "✅ OpenClaw v3.0 started successfully on port 3100"
  echo "PID: $(cat /root/openclaw-system/openclaw.pid)"
else
  echo "❌ Failed to start"
  cat /root/openclaw-system/logs/server.log | tail -20
fi
