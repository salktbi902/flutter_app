#!/data/data/com.termux/files/usr/bin/bash
# ==========================================
# OpenClaw Phone Monitor - Termux Script
# يعمل على التلفون ويرسل البيانات للسيرفر
# ==========================================

SERVER="http://76.13.213.128:3100"
INTERVAL=60  # كل دقيقة

echo "📱 OpenClaw Phone Monitor Started"
echo "🔗 Server: $SERVER"
echo "⏱️  Interval: ${INTERVAL}s"
echo "================================"

# تثبيت الأدوات المطلوبة
pkg install -y termux-api curl jq 2>/dev/null

while true; do
    echo ""
    echo "$(date '+%Y-%m-%d %H:%M:%S') - 📡 Collecting data..."

    # معلومات البطارية
    BATTERY=$(termux-battery-status 2>/dev/null || echo '{"percentage": -1}')
    BATTERY_LEVEL=$(echo "$BATTERY" | jq -r '.percentage // -1')
    BATTERY_STATUS=$(echo "$BATTERY" | jq -r '.status // "unknown"')
    BATTERY_TEMP=$(echo "$BATTERY" | jq -r '.temperature // 0')

    # معلومات الشبكة
    WIFI=$(termux-wifi-connectioninfo 2>/dev/null || echo '{}')
    WIFI_SSID=$(echo "$WIFI" | jq -r '.ssid // "unknown"')
    WIFI_SIGNAL=$(echo "$WIFI" | jq -r '.rssi // 0')

    # معلومات التخزين
    STORAGE_TOTAL=$(df -h /data 2>/dev/null | tail -1 | awk '{print $2}')
    STORAGE_USED=$(df -h /data 2>/dev/null | tail -1 | awk '{print $3}')
    STORAGE_FREE=$(df -h /data 2>/dev/null | tail -1 | awk '{print $4}')

    # معلومات الجهاز
    DEVICE_MODEL=$(getprop ro.product.model 2>/dev/null || echo "unknown")
    ANDROID_VERSION=$(getprop ro.build.version.release 2>/dev/null || echo "unknown")

    # فحص أمني - التطبيقات المثبتة
    APPS_COUNT=$(pm list packages 2>/dev/null | wc -l || echo 0)

    # فحص الشبكة المفتوحة
    OPEN_PORTS=$(ss -tlnp 2>/dev/null | grep LISTEN | wc -l || echo 0)

    # معلومات الموقع (إذا مسموح)
    LOCATION=$(termux-location -p network -r last 2>/dev/null || echo '{}')

    # بناء JSON
    DATA=$(cat <<EOF
{
    "battery": $BATTERY_LEVEL,
    "batteryStatus": "$BATTERY_STATUS",
    "batteryTemp": $BATTERY_TEMP,
    "wifi": {
        "ssid": "$WIFI_SSID",
        "signal": $WIFI_SIGNAL
    },
    "storage": {
        "total": "$STORAGE_TOTAL",
        "used": "$STORAGE_USED",
        "free": "$STORAGE_FREE"
    },
    "device": {
        "model": "$DEVICE_MODEL",
        "android": "$ANDROID_VERSION"
    },
    "security": {
        "installedApps": $APPS_COUNT,
        "openPorts": $OPEN_PORTS
    },
    "location": $LOCATION,
    "timestamp": "$(date -Iseconds)"
}
EOF
)

    # إرسال البيانات للسيرفر
    RESPONSE=$(curl -s -X POST "$SERVER/monitor/phone" \
        -H "Content-Type: application/json" \
        -d "$DATA" \
        --connect-timeout 10 \
        --max-time 15 2>/dev/null)

    if [ $? -eq 0 ]; then
        echo "✅ Data sent | Battery: ${BATTERY_LEVEL}% | WiFi: ${WIFI_SSID}"
    else
        echo "❌ Failed to send data to server"
    fi

    sleep $INTERVAL
done
