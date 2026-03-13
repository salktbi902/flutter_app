#!/usr/bin/env node
/**
 * OpenClaw AI Guardian System v3.0
 * نظام ذكاء اصطناعي متكامل:
 * 🛡️ حماية قوية | 👁️ مراقبة | 🔧 تطوير ذاتي
 * 🌐 متصفح خاص | 📱 Termux كامل | 🔓 Root access
 * يعمل 24/7 على السيرفر
 */

const http = require('http');
const https = require('https');
const { exec, execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const os = require('os');
const { URL } = require('url');

// ==================== CONFIGURATION ====================
const CONFIG = {
  port: 3100,
  host: '0.0.0.0',
  baseDir: '/root/openclaw-system',
  logDir: '/root/openclaw-system/logs',
  securityDir: '/root/openclaw-system/security',
  monitorDir: '/root/openclaw-system/monitor',
  agentsDir: '/root/openclaw-system/agents',
  toolsDir: '/root/openclaw-system/tools',
  browserDir: '/root/openclaw-system/browser',
  termuxDir: '/root/openclaw-system/termux',
  encryptionKey: null,
  iv: null,
  blockedIPs: new Set(),
  rateLimitWindow: new Map(),
  rateLimit: 100,
  connectedPhones: new Map(),
  browserSessions: new Map(),
};

// Initialize encryption keys (persistent)
const keyFile = path.join(CONFIG.baseDir, '.encryption_key');
if (fs.existsSync(keyFile)) {
  const keys = JSON.parse(fs.readFileSync(keyFile, 'utf8'));
  CONFIG.encryptionKey = Buffer.from(keys.key, 'hex');
  CONFIG.iv = Buffer.from(keys.iv, 'hex');
} else {
  CONFIG.encryptionKey = crypto.randomBytes(32);
  CONFIG.iv = crypto.randomBytes(16);
  fs.mkdirSync(CONFIG.baseDir, { recursive: true });
  fs.writeFileSync(keyFile, JSON.stringify({
    key: CONFIG.encryptionKey.toString('hex'),
    iv: CONFIG.iv.toString('hex')
  }));
  fs.chmodSync(keyFile, 0o600);
}

// Ensure all dirs exist
[CONFIG.logDir, CONFIG.securityDir, CONFIG.monitorDir, CONFIG.agentsDir,
 CONFIG.toolsDir, CONFIG.browserDir, CONFIG.termuxDir].forEach(d => {
  fs.mkdirSync(d, { recursive: true });
});

// ==================== LOGGING ====================
class Logger {
  constructor() {
    this.logFile = path.join(CONFIG.logDir, `openclaw_${new Date().toISOString().split('T')[0]}.log`);
  }
  _log(level, module, message, data = {}) {
    const entry = JSON.stringify({ t: new Date().toISOString(), l: level, m: module, msg: message, d: data });
    fs.appendFileSync(this.logFile, entry + '\n');
    const icon = { INFO: '📋', WARN: '⚠️', ERROR: '❌', ALERT: '🚨' }[level] || '📋';
    console.log(`${icon} [${level}] [${module}] ${message}`);
  }
  info(m, msg, d) { this._log('INFO', m, msg, d); }
  warn(m, msg, d) { this._log('WARN', m, msg, d); }
  error(m, msg, d) { this._log('ERROR', m, msg, d); }
  alert(m, msg, d) { this._log('ALERT', m, msg, d); }
}
const logger = new Logger();

// ==================== ENCRYPTION ====================
class Encryption {
  static encrypt(text) {
    const cipher = crypto.createCipheriv('aes-256-cbc', CONFIG.encryptionKey, CONFIG.iv);
    return cipher.update(text, 'utf8', 'hex') + cipher.final('hex');
  }
  static decrypt(enc) {
    const decipher = crypto.createDecipheriv('aes-256-cbc', CONFIG.encryptionKey, CONFIG.iv);
    return decipher.update(enc, 'hex', 'utf8') + decipher.final('utf8');
  }
  static hash(text) { return crypto.createHash('sha256').update(text).digest('hex'); }
  static generateToken() { return crypto.randomBytes(48).toString('hex'); }
}

// ==================== BROWSER AGENT ====================
class BrowserAgent {
  constructor() {
    this.name = 'BrowserAgent';
    this.sessions = CONFIG.browserSessions;
    this.puppeteerAvailable = false;
    this.screenshotDir = path.join(CONFIG.browserDir, 'screenshots');
    fs.mkdirSync(this.screenshotDir, { recursive: true });
  }

  start() {
    logger.info(this.name, '🌐 Browser Agent started');
    this._checkPuppeteer();
  }

  _checkPuppeteer() {
    try {
      require.resolve('puppeteer-core');
      this.puppeteerAvailable = true;
      this.puppeteerModule = 'puppeteer-core';
      logger.info(this.name, '✅ Puppeteer-core available');
    } catch (e) {
      try {
        require.resolve('puppeteer');
        this.puppeteerAvailable = true;
        this.puppeteerModule = 'puppeteer';
        logger.info(this.name, '✅ Puppeteer available');
      } catch (e2) {
        this.puppeteerAvailable = false;
        this.puppeteerModule = null;
        logger.warn(this.name, '⚠️ Puppeteer not installed, using curl fallback');
      }
    }
  }

  // فتح صفحة ويب وأخذ لقطة شاشة
  async openPage(url, options = {}) {
    logger.info(this.name, `🌐 Opening: ${url}`);
    if (this.puppeteerAvailable) {
      return this._puppeteerOpen(url, options);
    }
    return this._curlFallback(url, options);
  }

  async _puppeteerOpen(url, options) {
    try {
      const puppeteer = require(this.puppeteerModule || 'puppeteer-core');
      const browser = await puppeteer.launch({
        headless: 'new',
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
          '--window-size=1920,1080'
        ],
        executablePath: '/usr/bin/chromium-browser'
      });

      const page = await browser.newPage();
      await page.setViewport({ width: 1920, height: 1080 });
      await page.setUserAgent('Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

      const response = await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });

      // أخذ لقطة شاشة
      const screenshotPath = path.join(this.screenshotDir, `page_${Date.now()}.png`);
      await page.screenshot({ path: screenshotPath, fullPage: options.fullPage || false });

      // استخراج المحتوى
      const title = await page.title();
      const content = await page.evaluate(() => document.body.innerText.substring(0, 5000));
      const links = await page.evaluate(() =>
        Array.from(document.querySelectorAll('a[href]')).slice(0, 50).map(a => ({
          text: a.innerText.trim().substring(0, 100),
          href: a.href
        }))
      );

      // تنفيذ JavaScript إذا طلب
      let jsResult = null;
      if (options.script) {
        jsResult = await page.evaluate(options.script);
      }

      const sessionId = Encryption.generateToken().substring(0, 16);
      this.sessions.set(sessionId, { browser, page, url, created: Date.now() });

      // إغلاق تلقائي بعد 5 دقائق
      setTimeout(() => this._closeSession(sessionId), 300000);

      return {
        sessionId,
        url,
        title,
        status: response.status(),
        content: content.substring(0, 3000),
        links: links.slice(0, 20),
        screenshot: screenshotPath,
        jsResult
      };
    } catch (e) {
      logger.error(this.name, `Puppeteer error: ${e.message}`);
      return this._curlFallback(url, options);
    }
  }

  async _curlFallback(url, options) {
    return new Promise((resolve) => {
      exec(`curl -sL -o /tmp/page.html -w "%{http_code}" --max-time 30 "${url}"`, (err, stdout) => {
        let content = '';
        try { content = fs.readFileSync('/tmp/page.html', 'utf8').substring(0, 5000); } catch (e) {}
        resolve({
          sessionId: null,
          url,
          title: content.match(/<title>(.*?)<\/title>/i)?.[1] || 'Unknown',
          status: parseInt(stdout) || 0,
          content: content.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').substring(0, 3000),
          links: [],
          screenshot: null,
          mode: 'curl-fallback'
        });
      });
    });
  }

  // التفاعل مع جلسة متصفح مفتوحة
  async interact(sessionId, action) {
    const session = this.sessions.get(sessionId);
    if (!session) return { error: 'Session not found' };

    const { page } = session;
    try {
      switch (action.type) {
        case 'click':
          await page.click(action.selector);
          break;
        case 'type':
          await page.type(action.selector, action.text);
          break;
        case 'navigate':
          await page.goto(action.url, { waitUntil: 'networkidle2' });
          break;
        case 'screenshot':
          const ssPath = path.join(this.screenshotDir, `ss_${Date.now()}.png`);
          await page.screenshot({ path: ssPath, fullPage: action.fullPage || false });
          return { screenshot: ssPath };
        case 'evaluate':
          const result = await page.evaluate(action.script);
          return { result };
        case 'scroll':
          await page.evaluate(`window.scrollBy(0, ${action.pixels || 500})`);
          break;
        case 'waitFor':
          await page.waitForSelector(action.selector, { timeout: action.timeout || 5000 });
          break;
      }
      const title = await page.title();
      const url = page.url();
      return { success: true, title, url };
    } catch (e) {
      return { error: e.message };
    }
  }

  // تحميل ملف من الإنترنت
  async downloadFile(url, savePath) {
    return new Promise((resolve) => {
      const dest = savePath || path.join(CONFIG.browserDir, `download_${Date.now()}`);
      exec(`curl -sL -o "${dest}" "${url}"`, (err) => {
        if (err) resolve({ error: err.message });
        else {
          const stats = fs.statSync(dest);
          resolve({ success: true, path: dest, size: stats.size });
        }
      });
    });
  }

  // بحث في الإنترنت
  async search(query) {
    logger.info(this.name, `🔍 Searching: ${query}`);
    const encoded = encodeURIComponent(query);
    return this.openPage(`https://html.duckduckgo.com/html/?q=${encoded}`);
  }

  async _closeSession(sessionId) {
    const session = this.sessions.get(sessionId);
    if (session) {
      try { await session.browser.close(); } catch (e) {}
      this.sessions.delete(sessionId);
    }
  }

  getStatus() {
    return {
      name: this.name,
      status: 'active',
      puppeteer: this.puppeteerAvailable,
      activeSessions: this.sessions.size,
      screenshotDir: this.screenshotDir
    };
  }
}

// ==================== TERMUX AGENT ====================
class TermuxAgent {
  constructor() {
    this.name = 'TermuxAgent';
    this.connectedDevices = CONFIG.connectedPhones;
    this.commandQueue = new Map();
  }

  start() {
    logger.info(this.name, '📱 Termux Agent started');
  }

  // تسجيل جهاز Termux جديد
  registerDevice(deviceInfo) {
    const deviceId = Encryption.hash(deviceInfo.model + deviceInfo.android + (deviceInfo.serial || ''));
    const token = Encryption.generateToken();

    this.connectedDevices.set(deviceId, {
      ...deviceInfo,
      token,
      registered: new Date().toISOString(),
      lastSeen: new Date().toISOString(),
      status: 'online'
    });

    logger.info(this.name, `📱 Device registered: ${deviceInfo.model}`, { deviceId });

    return {
      deviceId,
      token,
      message: 'Device registered successfully',
      endpoints: {
        heartbeat: '/termux/heartbeat',
        data: '/termux/data',
        command: '/termux/command',
        upload: '/termux/upload'
      }
    };
  }

  // نبضة قلب من الجهاز
  heartbeat(deviceId, data) {
    const device = this.connectedDevices.get(deviceId);
    if (!device) return { error: 'Device not registered' };

    device.lastSeen = new Date().toISOString();
    device.status = 'online';
    device.latestData = data;

    // تحقق من أوامر معلقة
    const pendingCommands = this.commandQueue.get(deviceId) || [];
    this.commandQueue.set(deviceId, []);

    return {
      status: 'ok',
      commands: pendingCommands,
      serverTime: new Date().toISOString()
    };
  }

  // إرسال أمر للتلفون
  sendCommand(deviceId, command) {
    const device = this.connectedDevices.get(deviceId);
    if (!device) return { error: 'Device not registered' };

    const cmd = {
      id: crypto.randomBytes(8).toString('hex'),
      command,
      timestamp: new Date().toISOString(),
      status: 'pending'
    };

    const queue = this.commandQueue.get(deviceId) || [];
    queue.push(cmd);
    this.commandQueue.set(deviceId, queue);

    logger.info(this.name, `📤 Command queued for ${deviceId}: ${command.type}`);
    return { queued: true, commandId: cmd.id };
  }

  // استقبال نتيجة أمر من التلفون
  commandResult(deviceId, commandId, result) {
    logger.info(this.name, `📥 Command result from ${deviceId}: ${commandId}`);
    return { received: true };
  }

  // استقبال بيانات من التلفون
  receiveData(deviceId, data) {
    const device = this.connectedDevices.get(deviceId);
    if (!device) return { error: 'Device not registered' };

    device.lastSeen = new Date().toISOString();
    device.latestData = { ...device.latestData, ...data };

    // فحص أمني
    if (data.security) {
      if (data.security.rootDetected) {
        logger.alert(this.name, `🚨 Root detected on device ${deviceId}!`);
      }
      if (data.security.unknownApps?.length > 0) {
        logger.warn(this.name, `⚠️ Unknown apps on ${deviceId}`, { apps: data.security.unknownApps });
      }
    }

    // فحص البطارية
    if (data.battery && data.battery < 10) {
      logger.warn(this.name, `🔋 Critical battery on ${deviceId}: ${data.battery}%`);
    }

    return { received: true, timestamp: new Date().toISOString() };
  }

  // قائمة الأجهزة المتصلة
  listDevices() {
    const devices = [];
    this.connectedDevices.forEach((device, id) => {
      const lastSeen = new Date(device.lastSeen);
      const isOnline = (Date.now() - lastSeen.getTime()) < 120000; // 2 min
      devices.push({
        deviceId: id,
        model: device.model,
        android: device.android,
        status: isOnline ? 'online' : 'offline',
        lastSeen: device.lastSeen,
        battery: device.latestData?.battery || 'unknown'
      });
    });
    return devices;
  }

  // إنشاء سكريبت Termux مخصص
  generateScript(type) {
    const scripts = {
      monitor: this._monitorScript(),
      security: this._securityScript(),
      full: this._fullScript(),
      boot: this._bootScript()
    };
    return scripts[type] || { error: 'Unknown script type' };
  }

  _monitorScript() {
    return {
      name: 'openclaw_monitor.sh',
      content: `#!/data/data/com.termux/files/usr/bin/bash
# OpenClaw Phone Monitor v3.0
SERVER="http://76.13.213.128:3100"
DEVICE_ID=""

# تسجيل الجهاز
register() {
  MODEL=$(getprop ro.product.model 2>/dev/null || echo "unknown")
  ANDROID=$(getprop ro.build.version.release 2>/dev/null || echo "unknown")
  SERIAL=$(getprop ro.serialno 2>/dev/null || echo "unknown")
  RESP=$(curl -s -X POST "$SERVER/termux/register" -H "Content-Type: application/json" \\
    -d "{\\"model\\":\\"$MODEL\\",\\"android\\":\\"$ANDROID\\",\\"serial\\":\\"$SERIAL\\"}")
  DEVICE_ID=$(echo "$RESP" | jq -r '.deviceId')
  TOKEN=$(echo "$RESP" | jq -r '.token')
  echo "$DEVICE_ID" > ~/.openclaw_device_id
  echo "$TOKEN" > ~/.openclaw_token
  echo "✅ Registered: $DEVICE_ID"
}

# تحميل ID محفوظ
if [ -f ~/.openclaw_device_id ]; then
  DEVICE_ID=$(cat ~/.openclaw_device_id)
else
  register
fi

# حلقة المراقبة
while true; do
  BATTERY=$(termux-battery-status 2>/dev/null || echo '{"percentage":-1,"status":"unknown","temperature":0}')
  WIFI=$(termux-wifi-connectioninfo 2>/dev/null || echo '{"ssid":"unknown","rssi":0}')
  STORAGE_FREE=$(df -h /data 2>/dev/null | tail -1 | awk '{print $4}')
  APPS=$(pm list packages 2>/dev/null | wc -l)
  LOCATION=$(termux-location -p network -r last 2>/dev/null || echo '{}')
  
  DATA="{\\"deviceId\\":\\"$DEVICE_ID\\",\\"battery\\":$(echo $BATTERY | jq '.percentage'),\\"batteryStatus\\":\\"$(echo $BATTERY | jq -r '.status')\\",\\"wifi\\":$WIFI,\\"storageFree\\":\\"$STORAGE_FREE\\",\\"apps\\":$APPS,\\"location\\":$LOCATION}"
  
  # إرسال heartbeat
  RESP=$(curl -s -X POST "$SERVER/termux/heartbeat" -H "Content-Type: application/json" -d "$DATA" --max-time 10)
  
  # تنفيذ أوامر من السيرفر
  CMDS=$(echo "$RESP" | jq -r '.commands[]?.command.cmd // empty' 2>/dev/null)
  if [ -n "$CMDS" ]; then
    while IFS= read -r cmd; do
      echo "⚡ Executing: $cmd"
      RESULT=$(eval "$cmd" 2>&1)
      curl -s -X POST "$SERVER/termux/result" -H "Content-Type: application/json" \\
        -d "{\\"deviceId\\":\\"$DEVICE_ID\\",\\"result\\":\\"$RESULT\\"}" > /dev/null
    done <<< "$CMDS"
  fi
  
  sleep 60
done`
    };
  }

  _securityScript() {
    return {
      name: 'openclaw_security.sh',
      content: `#!/data/data/com.termux/files/usr/bin/bash
# OpenClaw Security Scanner v3.0
SERVER="http://76.13.213.128:3100"
DEVICE_ID=$(cat ~/.openclaw_device_id 2>/dev/null)

echo "🛡️ OpenClaw Security Scanner"

# فحص Root
ROOT_CHECK="false"
if [ -f /system/app/Superuser.apk ] || [ -d /data/adb ]; then ROOT_CHECK="true"; fi
if command -v su &>/dev/null; then ROOT_CHECK="true"; fi

# فحص التطبيقات المشبوهة
SUSPICIOUS=""
for pkg in $(pm list packages -3 2>/dev/null | cut -d: -f2); do
  INFO=$(dumpsys package "$pkg" 2>/dev/null | grep -c "DANGEROUS")
  if [ "$INFO" -gt 5 ]; then
    SUSPICIOUS="$SUSPICIOUS,$pkg"
  fi
done

# فحص الشبكة
OPEN_PORTS=$(ss -tlnp 2>/dev/null | grep LISTEN | wc -l)
CONNECTIONS=$(ss -tn 2>/dev/null | wc -l)

# فحص التخزين
STORAGE=$(df -h /data 2>/dev/null | tail -1)

DATA="{\\"deviceId\\":\\"$DEVICE_ID\\",\\"security\\":{\\"rootDetected\\":$ROOT_CHECK,\\"suspiciousApps\\":\\"$SUSPICIOUS\\",\\"openPorts\\":$OPEN_PORTS,\\"connections\\":$CONNECTIONS},\\"storage\\":\\"$STORAGE\\"}"

curl -s -X POST "$SERVER/termux/data" -H "Content-Type: application/json" -d "$DATA"
echo "✅ Security scan sent to server"`
    };
  }

  _fullScript() {
    return {
      name: 'openclaw_full.sh',
      content: `#!/data/data/com.termux/files/usr/bin/bash
# OpenClaw Full Setup for Termux v3.0
echo "🚀 OpenClaw Full Setup"

# تثبيت المتطلبات
pkg update -y
pkg install -y termux-api curl jq openssh nmap python nodejs

# إنشاء المجلدات
mkdir -p ~/.openclaw/{logs,scripts,data}

# تحميل السكريبتات
SERVER="http://76.13.213.128:3100"
curl -s "$SERVER/termux/script/monitor" | jq -r '.content' > ~/openclaw_monitor.sh
curl -s "$SERVER/termux/script/security" | jq -r '.content' > ~/openclaw_security.sh
chmod +x ~/openclaw_*.sh

# إعداد التشغيل التلقائي
mkdir -p ~/.termux/boot
cat > ~/.termux/boot/openclaw.sh << 'BOOT'
#!/data/data/com.termux/files/usr/bin/bash
sleep 10
nohup bash ~/openclaw_monitor.sh > ~/.openclaw/logs/monitor.log 2>&1 &
BOOT
chmod +x ~/.termux/boot/openclaw.sh

# تسجيل الجهاز
bash ~/openclaw_monitor.sh &
echo "✅ OpenClaw installed! Monitor running in background."`
    };
  }

  _bootScript() {
    return {
      name: 'openclaw_boot.sh',
      content: `#!/data/data/com.termux/files/usr/bin/bash
# Auto-start on Termux:Boot
sleep 10
nohup bash ~/openclaw_monitor.sh > ~/.openclaw/logs/monitor.log 2>&1 &`
    };
  }

  getStatus() {
    return {
      name: this.name,
      status: 'active',
      connectedDevices: this.listDevices(),
      totalDevices: this.connectedDevices.size
    };
  }
}

// ==================== ROOT AGENT ====================
class RootAgent {
  constructor() {
    this.name = 'RootAgent';
    this.isRoot = process.getuid?.() === 0;
    this.auditLog = [];
  }

  start() {
    logger.info(this.name, `🔓 Root Agent started (root: ${this.isRoot})`);
  }

  // تنفيذ أمر بصلاحيات root
  async rootExec(command, options = {}) {
    // تسجيل في سجل التدقيق
    this.auditLog.push({
      command,
      timestamp: new Date().toISOString(),
      options
    });

    // حماية من الأوامر المدمرة
    const blocked = ['rm -rf /', 'mkfs', 'dd if=/dev/zero of=/dev/sd', ':(){:|:&};:', 'chmod -R 777 /'];
    if (blocked.some(b => command.includes(b))) {
      logger.alert(this.name, `🚫 BLOCKED destructive command: ${command}`);
      return { error: 'Command blocked: destructive operation', blocked: true };
    }

    return new Promise((resolve) => {
      const cmd = this.isRoot ? command : `sudo ${command}`;
      exec(cmd, {
        timeout: options.timeout || 60000,
        maxBuffer: 1024 * 1024 * 50,
        env: { ...process.env, ...options.env }
      }, (err, stdout, stderr) => {
        resolve({
          command,
          stdout: stdout?.substring(0, 50000) || '',
          stderr: stderr?.substring(0, 10000) || '',
          error: err?.message || null,
          exitCode: err?.code || 0
        });
      });
    });
  }

  // إدارة الخدمات
  async serviceControl(service, action) {
    const allowed = ['start', 'stop', 'restart', 'status', 'enable', 'disable'];
    if (!allowed.includes(action)) return { error: 'Invalid action' };
    return this.rootExec(`systemctl ${action} ${service}`);
  }

  // إدارة المستخدمين
  async userManagement(action, username, options = {}) {
    switch (action) {
      case 'list':
        return this.rootExec('cat /etc/passwd | grep -v nologin | grep -v false');
      case 'add':
        return this.rootExec(`useradd -m -s /bin/bash ${username}`);
      case 'delete':
        return this.rootExec(`userdel -r ${username}`);
      case 'lock':
        return this.rootExec(`usermod -L ${username}`);
      case 'unlock':
        return this.rootExec(`usermod -U ${username}`);
      default:
        return { error: 'Unknown action' };
    }
  }

  // إدارة الشبكة
  async networkControl(action, params = {}) {
    switch (action) {
      case 'interfaces':
        return this.rootExec('ip addr show');
      case 'routes':
        return this.rootExec('ip route show');
      case 'dns':
        return this.rootExec('cat /etc/resolv.conf');
      case 'firewall':
        return this.rootExec('iptables -L -n -v');
      case 'block_ip':
        return this.rootExec(`iptables -A INPUT -s ${params.ip} -j DROP`);
      case 'unblock_ip':
        return this.rootExec(`iptables -D INPUT -s ${params.ip} -j DROP`);
      case 'connections':
        return this.rootExec('ss -tunap');
      case 'bandwidth':
        return this.rootExec('cat /proc/net/dev');
      default:
        return { error: 'Unknown action' };
    }
  }

  // إدارة Docker
  async dockerControl(action, params = {}) {
    switch (action) {
      case 'ps':
        return this.rootExec('docker ps -a --format "table {{.Names}}\\t{{.Status}}\\t{{.Ports}}"');
      case 'images':
        return this.rootExec('docker images --format "table {{.Repository}}\\t{{.Tag}}\\t{{.Size}}"');
      case 'logs':
        return this.rootExec(`docker logs --tail 100 ${params.container}`);
      case 'restart':
        return this.rootExec(`docker restart ${params.container}`);
      case 'stop':
        return this.rootExec(`docker stop ${params.container}`);
      case 'start':
        return this.rootExec(`docker start ${params.container}`);
      case 'exec':
        return this.rootExec(`docker exec ${params.container} ${params.command}`);
      case 'stats':
        return this.rootExec('docker stats --no-stream --format "table {{.Name}}\\t{{.CPUPerc}}\\t{{.MemUsage}}"');
      case 'compose_up':
        return this.rootExec(`cd ${params.path || '/root'} && docker compose up -d`);
      case 'compose_down':
        return this.rootExec(`cd ${params.path || '/root'} && docker compose down`);
      case 'prune':
        return this.rootExec('docker system prune -f');
      default:
        return { error: 'Unknown action' };
    }
  }

  // إدارة الملفات بصلاحيات root
  async fileControl(action, params = {}) {
    switch (action) {
      case 'read':
        return this.rootExec(`cat "${params.path}"`);
      case 'write':
        fs.writeFileSync(params.path, params.content);
        return { success: true, path: params.path };
      case 'permissions':
        return this.rootExec(`chmod ${params.mode} "${params.path}"`);
      case 'owner':
        return this.rootExec(`chown ${params.owner} "${params.path}"`);
      case 'find':
        return this.rootExec(`find ${params.path || '/'} -name "${params.pattern}" -maxdepth ${params.depth || 3} 2>/dev/null`);
      case 'disk':
        return this.rootExec('df -h');
      case 'du':
        return this.rootExec(`du -sh ${params.path || '/root/*'} 2>/dev/null | sort -rh | head -20`);
      default:
        return { error: 'Unknown action' };
    }
  }

  // إدارة العمليات
  async processControl(action, params = {}) {
    switch (action) {
      case 'list':
        return this.rootExec('ps aux --sort=-%cpu | head -30');
      case 'kill':
        return this.rootExec(`kill -${params.signal || 9} ${params.pid}`);
      case 'top':
        return this.rootExec('top -bn1 | head -30');
      case 'memory':
        return this.rootExec('free -h');
      default:
        return { error: 'Unknown action' };
    }
  }

  // تحديث النظام
  async systemUpdate() {
    return this.rootExec('apt-get update -qq && apt-get upgrade -y -qq 2>&1 | tail -20', { timeout: 300000 });
  }

  // تثبيت حزم
  async installPackage(pkg) {
    return this.rootExec(`apt-get install -y -qq ${pkg} 2>&1 | tail -5`);
  }

  // سجل التدقيق
  getAuditLog(limit = 50) {
    return this.auditLog.slice(-limit);
  }

  getStatus() {
    return {
      name: this.name,
      status: 'active',
      isRoot: this.isRoot,
      auditLogSize: this.auditLog.length,
      hostname: os.hostname(),
      platform: `${os.platform()} ${os.arch()}`
    };
  }
}

// ==================== SECURITY AGENT ====================
class SecurityAgent {
  constructor() {
    this.name = 'SecurityAgent';
    this.threats = [];
    this.blockedIPs = CONFIG.blockedIPs;
    this.scanInterval = null;
  }

  start() {
    logger.info(this.name, '🛡️ Security Agent started');
    this.scanInterval = setInterval(() => this.fullScan(), 300000);
    this.fullScan();
    this.setupFirewall();
  }

  async fullScan() {
    logger.info(this.name, '🔍 Running full security scan...');
    const results = {
      timestamp: new Date().toISOString(),
      openPorts: await this._exec('ss -tlnp | grep LISTEN'),
      suspiciousProcesses: await this._checkHighCPU(),
      failedLogins: await this._getFailedIPs(),
      diskUsage: await this._exec('df -h / | tail -1'),
      dockerContainers: await this._exec('docker ps --format "{{.Names}}: {{.Status}}"'),
      activeConnections: await this._exec('ss -tn state established | wc -l')
    };

    // Auto-block
    if (results.failedLogins.length > 0) {
      results.failedLogins.forEach(ip => {
        if (!this.blockedIPs.has(ip)) {
          this.blockIP(ip);
        }
      });
    }

    fs.writeFileSync(path.join(CONFIG.securityDir, `scan_${Date.now()}.json`), JSON.stringify(results, null, 2));
    return results;
  }

  _exec(cmd) {
    return new Promise(r => exec(cmd, (e, o) => r(o?.trim() || '')));
  }

  async _checkHighCPU() {
    const out = await this._exec('ps aux --sort=-%cpu | head -10');
    return out.split('\n').filter(l => {
      const cpu = parseFloat(l.split(/\s+/)[2]);
      return cpu > 80;
    });
  }

  async _getFailedIPs() {
    const out = await this._exec('grep "Failed password" /var/log/auth.log 2>/dev/null | grep -oP "\\d+\\.\\d+\\.\\d+\\.\\d+" | sort | uniq -c | sort -rn | head -10');
    return out.split('\n').filter(l => {
      const parts = l.trim().split(/\s+/);
      return parts.length >= 2 && parseInt(parts[0]) > 5;
    }).map(l => l.trim().split(/\s+/)[1]);
  }

  setupFirewall() {
    ['iptables -A INPUT -p tcp --syn -m limit --limit 10/s --limit-burst 20 -j ACCEPT',
     'iptables -A INPUT -p tcp --dport 22 -m connlimit --connlimit-above 5 -j DROP',
     'iptables -A INPUT -p tcp --dport 3100 -m connlimit --connlimit-above 50 -j DROP'
    ].forEach(rule => exec(rule, () => {}));
  }

  blockIP(ip) {
    this.blockedIPs.add(ip);
    exec(`iptables -A INPUT -s ${ip} -j DROP`);
    logger.alert(this.name, `🚫 Blocked: ${ip}`);
  }

  getStatus() {
    return { name: this.name, status: 'active', blockedIPs: [...this.blockedIPs], threats: this.threats.length };
  }
}

// ==================== MONITOR AGENT ====================
class MonitorAgent {
  constructor() {
    this.name = 'MonitorAgent';
    this.metrics = [];
    this.interval = null;
  }

  start() {
    logger.info(this.name, '👁️ Monitor Agent started');
    this.interval = setInterval(() => this.collect(), 60000);
    this.collect();
  }

  async collect() {
    const m = {
      timestamp: new Date().toISOString(),
      cpu: os.loadavg(),
      memory: { total: os.totalmem(), free: os.freemem(), usedPercent: Math.round((1 - os.freemem() / os.totalmem()) * 100) },
      uptime: os.uptime()
    };
    this.metrics.push(m);
    if (this.metrics.length > 1440) this.metrics = this.metrics.slice(-1440);
    if (m.memory.usedPercent > 85) logger.alert(this.name, `🚨 High memory: ${m.memory.usedPercent}%`);
    return m;
  }

  getStatus() {
    return { name: this.name, status: 'active', dataPoints: this.metrics.length, latest: this.metrics[this.metrics.length - 1] };
  }
}

// ==================== AI GATEWAY ====================
class AIGateway {
  constructor() {
    this.models = {
      grok: { endpoint: 'https://api.x.ai/v1/chat/completions', model: 'grok-4', keyEnv: 'XAI_API_KEY' },
      openai: { endpoint: process.env.OPENAI_API_BASE ? `${process.env.OPENAI_API_BASE}/chat/completions` : 'https://api.openai.com/v1/chat/completions', model: 'gpt-5', keyEnv: 'OPENAI_API_KEY' },
      perplexity: { endpoint: 'https://api.perplexity.ai/chat/completions', model: 'sonar-pro', keyEnv: 'SONAR_API_KEY' }
    };
  }

  async chat(message, model = 'grok') {
    const cfg = this.models[model];
    if (!cfg) return { error: 'Unknown model' };
    const apiKey = process.env[cfg.keyEnv];
    if (!apiKey) return { error: `API key not set: ${cfg.keyEnv}` };

    try {
      return { model, response: await this._call(cfg, apiKey, message) };
    } catch (e) {
      // Fallback
      for (const [name, c] of Object.entries(this.models)) {
        if (name !== model && process.env[c.keyEnv]) {
          try { return { model: name, response: await this._call(c, process.env[c.keyEnv], message), fallback: true }; }
          catch (e2) { continue; }
        }
      }
      return { error: 'All models failed' };
    }
  }

  _call(cfg, apiKey, message) {
    return new Promise((resolve, reject) => {
      const url = new URL(cfg.endpoint);
      const data = JSON.stringify({
        model: cfg.model,
        messages: [
          { role: 'system', content: 'You are AI-Guardian, a powerful AI assistant. Respond in Arabic when user speaks Arabic.' },
          { role: 'user', content: message }
        ],
        max_tokens: 2000
      });
      const req = https.request({
        hostname: url.hostname, port: 443, path: url.pathname,
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}`, 'Content-Length': Buffer.byteLength(data) }
      }, (res) => {
        let body = '';
        res.on('data', c => body += c);
        res.on('end', () => {
          try { resolve(JSON.parse(body).choices[0].message.content); }
          catch (e) { reject(e); }
        });
      });
      req.on('error', reject);
      req.setTimeout(30000, () => { req.destroy(); reject(new Error('Timeout')); });
      req.write(data);
      req.end();
    });
  }
}

// ==================== MAIN SERVER ====================
class OpenClawServer {
  constructor() {
    this.security = new SecurityAgent();
    this.monitor = new MonitorAgent();
    this.browser = new BrowserAgent();
    this.termux = new TermuxAgent();
    this.root = new RootAgent();
    this.ai = new AIGateway();
    this.startTime = new Date();
  }

  start() {
    this.security.start();
    this.monitor.start();
    this.browser.start();
    this.termux.start();
    this.root.start();

    const server = http.createServer((req, res) => this.handle(req, res));
    server.listen(CONFIG.port, CONFIG.host, () => {
      console.log('');
      console.log('╔══════════════════════════════════════════════╗');
      console.log('║     🤖 OpenClaw AI Guardian v3.0             ║');
      console.log('║     🛡️  Security Agent: ACTIVE               ║');
      console.log('║     👁️  Monitor Agent: ACTIVE                ║');
      console.log('║     🌐 Browser Agent: ACTIVE                ║');
      console.log('║     📱 Termux Agent: ACTIVE                 ║');
      console.log('║     🔓 Root Agent: ACTIVE                   ║');
      console.log('║     🤖 AI Gateway: ACTIVE                   ║');
      console.log(`║     🔗 Port: ${CONFIG.port}                          ║`);
      console.log('╚══════════════════════════════════════════════╝');
      console.log('');
      logger.info('Server', `🚀 OpenClaw AI Guardian v3.0 running on port ${CONFIG.port}`);
    });

    process.on('SIGTERM', () => this.shutdown());
    process.on('SIGINT', () => this.shutdown());
  }

  async handle(req, res) {
    const ip = req.socket.remoteAddress;
    if (CONFIG.blockedIPs.has(ip)) { res.writeHead(403); res.end('Blocked'); return; }
    if (this._rateLimited(ip)) { res.writeHead(429); res.end('Rate limited'); return; }

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') { res.writeHead(200); res.end(); return; }

    const route = new URL(req.url, `http://${req.headers.host}`).pathname;
    let body = '';
    if (req.method === 'POST') {
      body = await new Promise(r => { let d = ''; req.on('data', c => d += c); req.on('end', () => r(d)); });
    }

    try {
      const result = await this.route(route, body, req.method);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(result, null, 2));
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: e.message }));
    }
  }

  async route(path, body, method) {
    const data = body ? JSON.parse(body) : {};
    const routes = {
      // === Core ===
      '/': () => this._apiDocs(),
      '/health': () => ({ status: 'healthy', version: '3.0.0', uptime: Math.round((Date.now() - this.startTime) / 1000) + 's' }),
      '/status': () => this._fullStatus(),

      // === AI ===
      '/chat': () => this.ai.chat(data.message, data.model),

      // === Security ===
      '/security/scan': () => this.security.fullScan(),
      '/security/status': () => this.security.getStatus(),
      '/security/block': () => { this.security.blockIP(data.ip); return { blocked: data.ip }; },

      // === Monitor ===
      '/monitor/status': () => this.monitor.getStatus(),
      '/monitor/metrics': () => this.monitor.collect(),

      // === Browser ===
      '/browser/open': () => this.browser.openPage(data.url, data.options || {}),
      '/browser/search': () => this.browser.search(data.query),
      '/browser/interact': () => this.browser.interact(data.sessionId, data.action),
      '/browser/download': () => this.browser.downloadFile(data.url, data.savePath),
      '/browser/status': () => this.browser.getStatus(),

      // === Termux ===
      '/termux/register': () => this.termux.registerDevice(data),
      '/termux/heartbeat': () => this.termux.heartbeat(data.deviceId, data),
      '/termux/data': () => this.termux.receiveData(data.deviceId, data),
      '/termux/command': () => this.termux.sendCommand(data.deviceId, data.command),
      '/termux/result': () => this.termux.commandResult(data.deviceId, data.commandId, data.result),
      '/termux/devices': () => this.termux.listDevices(),
      '/termux/script/monitor': () => this.termux.generateScript('monitor'),
      '/termux/script/security': () => this.termux.generateScript('security'),
      '/termux/script/full': () => this.termux.generateScript('full'),
      '/termux/script/boot': () => this.termux.generateScript('boot'),
      '/termux/status': () => this.termux.getStatus(),

      // === Root ===
      '/root/exec': () => this.root.rootExec(data.command, data.options),
      '/root/service': () => this.root.serviceControl(data.service, data.action),
      '/root/user': () => this.root.userManagement(data.action, data.username, data.options),
      '/root/network': () => this.root.networkControl(data.action, data),
      '/root/docker': () => this.root.dockerControl(data.action, data),
      '/root/file': () => this.root.fileControl(data.action, data),
      '/root/process': () => this.root.processControl(data.action, data),
      '/root/update': () => this.root.systemUpdate(),
      '/root/install': () => this.root.installPackage(data.package),
      '/root/audit': () => this.root.getAuditLog(data.limit),
      '/root/status': () => this.root.getStatus(),
    };

    const handler = routes[path];
    if (handler) return handler();
    return { error: 'Not found', available: Object.keys(routes) };
  }

  _apiDocs() {
    return {
      name: 'OpenClaw AI Guardian',
      version: '3.0.0',
      agents: ['🛡️ Security', '👁️ Monitor', '🌐 Browser', '📱 Termux', '🔓 Root', '🤖 AI'],
      endpoints: {
        core: ['GET /health', 'GET /status', 'POST /chat'],
        security: ['GET /security/scan', 'GET /security/status', 'POST /security/block'],
        monitor: ['GET /monitor/status', 'GET /monitor/metrics'],
        browser: ['POST /browser/open', 'POST /browser/search', 'POST /browser/interact', 'POST /browser/download', 'GET /browser/status'],
        termux: ['POST /termux/register', 'POST /termux/heartbeat', 'POST /termux/data', 'POST /termux/command', 'GET /termux/devices', 'GET /termux/script/{type}', 'GET /termux/status'],
        root: ['POST /root/exec', 'POST /root/service', 'POST /root/user', 'POST /root/network', 'POST /root/docker', 'POST /root/file', 'POST /root/process', 'POST /root/update', 'POST /root/install', 'GET /root/audit', 'GET /root/status']
      }
    };
  }

  _fullStatus() {
    return {
      server: { version: '3.0.0', uptime: Math.round((Date.now() - this.startTime) / 1000) + 's', port: CONFIG.port },
      agents: {
        security: this.security.getStatus(),
        monitor: this.monitor.getStatus(),
        browser: this.browser.getStatus(),
        termux: this.termux.getStatus(),
        root: this.root.getStatus()
      },
      system: {
        hostname: os.hostname(), platform: os.platform(), arch: os.arch(),
        cpus: os.cpus().length, totalMem: Math.round(os.totalmem() / 1024 / 1024 / 1024) + ' GB',
        freeMem: Math.round(os.freemem() / 1024 / 1024 / 1024) + ' GB'
      }
    };
  }

  _rateLimited(ip) {
    const now = Date.now();
    const w = CONFIG.rateLimitWindow.get(ip) || { count: 0, start: now };
    if (now - w.start > 60000) { w.count = 1; w.start = now; }
    else w.count++;
    CONFIG.rateLimitWindow.set(ip, w);
    return w.count > CONFIG.rateLimit;
  }

  shutdown() {
    logger.info('Server', '🛑 Shutting down...');
    clearInterval(this.security.scanInterval);
    clearInterval(this.monitor.interval);
    process.exit(0);
  }
}

new OpenClawServer().start();
