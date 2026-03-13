# OpenClaw AI Guardian v3.0 - الدليل الشامل

## نظرة عامة

**OpenClaw AI Guardian** هو نظام ذكاء اصطناعي متكامل يعمل 24/7 على سيرفرك، يوفر حماية قوية، مراقبة شاملة، متصفح خاص، تحكم بالتلفون عبر Termux، وصلاحيات Root كاملة.

## معلومات السيرفر

| البند | القيمة |
|---|---|
| **العنوان** | `http://76.13.213.128:3100` |
| **الإصدار** | 3.0.0 |
| **التشغيل التلقائي** | مفعّل (systemd) |
| **التشفير** | AES-256-CBC |

---

## الوكلاء (Agents)

### 1. وكيل الحماية (Security Agent)

فحص أمني كل 5 دقائق + حظر تلقائي للـ IPs المشبوهة + جدار ناري.

```bash
# فحص أمني كامل
curl http://76.13.213.128:3100/security/scan

# حالة الحماية
curl http://76.13.213.128:3100/security/status

# حظر IP
curl -X POST http://76.13.213.128:3100/security/block \
  -H "Content-Type: application/json" \
  -d '{"ip": "1.2.3.4"}'
```

### 2. وكيل المراقبة (Monitor Agent)

مراقبة CPU, RAM, Docker كل دقيقة + كشف الشذوذ التلقائي.

```bash
# حالة المراقبة
curl http://76.13.213.128:3100/monitor/status

# مقاييس النظام
curl http://76.13.213.128:3100/monitor/metrics
```

### 3. وكيل المتصفح (Browser Agent)

متصفح Chromium خاص مع Puppeteer - يفتح صفحات، يأخذ لقطات شاشة، ينفذ JavaScript.

```bash
# فتح صفحة
curl -X POST http://76.13.213.128:3100/browser/open \
  -H "Content-Type: application/json" \
  -d '{"url": "https://google.com"}'

# بحث في الإنترنت
curl -X POST http://76.13.213.128:3100/browser/search \
  -H "Content-Type: application/json" \
  -d '{"query": "OpenClaw AI"}'

# التفاعل مع جلسة مفتوحة
curl -X POST http://76.13.213.128:3100/browser/interact \
  -H "Content-Type: application/json" \
  -d '{"sessionId": "xxx", "action": {"type": "screenshot"}}'

# تحميل ملف
curl -X POST http://76.13.213.128:3100/browser/download \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com/file.zip"}'
```

### 4. وكيل Termux (Termux Agent)

تحكم كامل بالتلفون عبر Termux - مراقبة البطارية، الشبكة، التطبيقات، الموقع.

```bash
# تسجيل جهاز جديد
curl -X POST http://76.13.213.128:3100/termux/register \
  -H "Content-Type: application/json" \
  -d '{"model": "Samsung S24", "android": "15"}'

# قائمة الأجهزة المتصلة
curl http://76.13.213.128:3100/termux/devices

# إرسال أمر للتلفون
curl -X POST http://76.13.213.128:3100/termux/command \
  -H "Content-Type: application/json" \
  -d '{"deviceId": "xxx", "command": {"type": "exec", "cmd": "termux-battery-status"}}'

# تحميل سكريبت التثبيت الكامل
curl http://76.13.213.128:3100/termux/script/full
```

### 5. وكيل Root (Root Agent)

صلاحيات Root كاملة - تنفيذ أوامر، إدارة Docker، الشبكة، الملفات، المستخدمين.

```bash
# تنفيذ أمر
curl -X POST http://76.13.213.128:3100/root/exec \
  -H "Content-Type: application/json" \
  -d '{"command": "uptime && free -h"}'

# إدارة Docker
curl -X POST http://76.13.213.128:3100/root/docker \
  -H "Content-Type: application/json" \
  -d '{"action": "ps"}'

# إدارة الشبكة
curl -X POST http://76.13.213.128:3100/root/network \
  -H "Content-Type: application/json" \
  -d '{"action": "firewall"}'

# إدارة الملفات
curl -X POST http://76.13.213.128:3100/root/file \
  -H "Content-Type: application/json" \
  -d '{"action": "read", "path": "/etc/hostname"}'

# تحديث النظام
curl -X POST http://76.13.213.128:3100/root/update

# تثبيت حزمة
curl -X POST http://76.13.213.128:3100/root/install \
  -H "Content-Type: application/json" \
  -d '{"package": "htop"}'

# سجل التدقيق
curl http://76.13.213.128:3100/root/audit
```

### 6. بوابة الذكاء الاصطناعي (AI Gateway)

محادثة مع نماذج AI متعددة (Grok, GPT-5, Perplexity) مع fallback تلقائي.

```bash
# محادثة AI
curl -X POST http://76.13.213.128:3100/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "مرحبا، كيف حالك؟", "model": "grok"}'
```

---

## إعداد Termux على التلفون

### التثبيت السريع (أمر واحد):

```bash
curl -s http://76.13.213.128:3100/termux/script/full | jq -r '.content' | bash
```

### التثبيت اليدوي:

1. ثبت **Termux** من F-Droid
2. ثبت **Termux:API** و **Termux:Boot**
3. شغل:
```bash
pkg update -y && pkg install -y termux-api curl jq
curl -s http://76.13.213.128:3100/termux/script/monitor | jq -r '.content' > ~/openclaw_monitor.sh
chmod +x ~/openclaw_monitor.sh
bash ~/openclaw_monitor.sh
```

### التشغيل التلقائي عند إعادة تشغيل التلفون:

```bash
mkdir -p ~/.termux/boot
curl -s http://76.13.213.128:3100/termux/script/boot | jq -r '.content' > ~/.termux/boot/openclaw.sh
chmod +x ~/.termux/boot/openclaw.sh
```

---

## إدارة الخدمة

```bash
# حالة الخدمة
systemctl status openclaw

# إعادة تشغيل
systemctl restart openclaw

# إيقاف
systemctl stop openclaw

# السجلات
journalctl -u openclaw -f
cat /root/openclaw-system/logs/server.log
```

---

## جميع الـ Endpoints

| المجموعة | الطريقة | المسار | الوصف |
|---|---|---|---|
| Core | GET | `/health` | فحص صحة النظام |
| Core | GET | `/status` | حالة كاملة |
| AI | POST | `/chat` | محادثة AI |
| Security | GET | `/security/scan` | فحص أمني |
| Security | GET | `/security/status` | حالة الحماية |
| Security | POST | `/security/block` | حظر IP |
| Monitor | GET | `/monitor/status` | حالة المراقبة |
| Monitor | GET | `/monitor/metrics` | مقاييس النظام |
| Browser | POST | `/browser/open` | فتح صفحة |
| Browser | POST | `/browser/search` | بحث |
| Browser | POST | `/browser/interact` | تفاعل مع جلسة |
| Browser | POST | `/browser/download` | تحميل ملف |
| Browser | GET | `/browser/status` | حالة المتصفح |
| Termux | POST | `/termux/register` | تسجيل جهاز |
| Termux | POST | `/termux/heartbeat` | نبضة قلب |
| Termux | POST | `/termux/command` | إرسال أمر |
| Termux | GET | `/termux/devices` | قائمة الأجهزة |
| Termux | GET | `/termux/script/{type}` | تحميل سكريبت |
| Root | POST | `/root/exec` | تنفيذ أمر |
| Root | POST | `/root/docker` | إدارة Docker |
| Root | POST | `/root/network` | إدارة الشبكة |
| Root | POST | `/root/file` | إدارة الملفات |
| Root | POST | `/root/process` | إدارة العمليات |
| Root | POST | `/root/service` | إدارة الخدمات |
| Root | POST | `/root/user` | إدارة المستخدمين |
| Root | POST | `/root/update` | تحديث النظام |
| Root | POST | `/root/install` | تثبيت حزمة |
| Root | GET | `/root/audit` | سجل التدقيق |
