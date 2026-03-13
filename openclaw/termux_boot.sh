#!/data/data/com.termux/files/usr/bin/bash
# ==========================================
# OpenClaw Auto-Start on Termux Boot
# ضعه في: ~/.termux/boot/openclaw-monitor.sh
# ==========================================

# انتظر حتى يتصل بالإنترنت
sleep 10

# شغل المراقب في الخلفية
nohup bash ~/openclaw_monitor.sh > ~/openclaw_monitor.log 2>&1 &

echo "✅ OpenClaw Monitor started in background"
