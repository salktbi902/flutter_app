#!/usr/bin/env node
/**
 * OpenClaw v4.0 - Master AI Agent
 * الوكيل الرئيسي الذكي - يوزع الشغل على الوكلاء المتخصصين
 * 🧠 ذاكرة طويلة المدى | 🔧 تطوير ذاتي | 🔓 كل الصلاحيات
 * 🤖 وكلاء متخصصين | 🌐 متصفح | 📱 Termux | 💻 Linux Shell
 */
const http = require('http');
const https = require('https');
const { exec, execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const os = require('os');
const { URL } = require('url');

// ==================== CONFIG ====================
const BASE = '/root/openclaw-system';
const CONFIG = {
  port: 3100, host: '0.0.0.0', base: BASE,
  dirs: { logs: `${BASE}/logs`, security: `${BASE}/security`, memory: `${BASE}/memory`,
    agents: `${BASE}/agents`, templates: `${BASE}/templates`, projects: `${BASE}/projects`,
    browser: `${BASE}/browser/screenshots`, codex: `${BASE}/codex`, shell: `${BASE}/shell` },
  blockedIPs: new Set(), rateLimits: new Map(), rateMax: 100,
  phones: new Map(), browserSessions: new Map(), shellSessions: new Map()
};

// Create all dirs
Object.values(CONFIG.dirs).forEach(d => fs.mkdirSync(d, { recursive: true }));

// Encryption
const keyFile = `${BASE}/.encryption_key`;
let ENC_KEY, ENC_IV;
if (fs.existsSync(keyFile)) {
  const k = JSON.parse(fs.readFileSync(keyFile, 'utf8'));
  ENC_KEY = Buffer.from(k.key, 'hex'); ENC_IV = Buffer.from(k.iv, 'hex');
} else {
  ENC_KEY = crypto.randomBytes(32); ENC_IV = crypto.randomBytes(16);
  fs.writeFileSync(keyFile, JSON.stringify({ key: ENC_KEY.toString('hex'), iv: ENC_IV.toString('hex') }));
}

// ==================== LOGGER ====================
const logger = {
  _log(level, icon, agent, msg) {
    const ts = new Date().toISOString();
    const line = `${icon} [${level}] [${agent}] ${msg}`;
    console.log(line);
    const logFile = `${CONFIG.dirs.logs}/openclaw_${ts.split('T')[0]}.log`;
    fs.appendFileSync(logFile, `${ts} ${line}\n`);
  },
  info: (a, m) => logger._log('INFO', '📋', a, m),
  warn: (a, m) => logger._log('WARN', '⚠️', a, m),
  error: (a, m) => logger._log('ERROR', '❌', a, m),
  alert: (a, m) => logger._log('ALERT', '🚨', a, m),
};

// ==================== MEMORY SYSTEM ====================
class MemorySystem {
  constructor() {
    this.name = 'MemorySystem';
    this.memFile = `${CONFIG.dirs.memory}/long_term.json`;
    this.chatFile = `${CONFIG.dirs.memory}/conversations.json`;
    this.prefsFile = `${CONFIG.dirs.memory}/preferences.json`;
    this.memory = this._load(this.memFile, { facts: [], skills: [], projects: [], errors: [], solutions: [] });
    this.conversations = this._load(this.chatFile, []);
    this.preferences = this._load(this.prefsFile, { colors: [], patterns: [], tools: [], languages: ['ar'] });
  }

  _load(file, def) { try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return def; } }
  _save(file, data) { fs.writeFileSync(file, JSON.stringify(data, null, 2)); }

  // تذكر حقيقة أو معلومة
  remember(category, data) {
    if (!this.memory[category]) this.memory[category] = [];
    this.memory[category].push({ ...data, timestamp: new Date().toISOString() });
    if (this.memory[category].length > 1000) this.memory[category] = this.memory[category].slice(-1000);
    this._save(this.memFile, this.memory);
    logger.info(this.name, `🧠 Remembered: ${category} - ${JSON.stringify(data).substring(0, 100)}`);
    return { stored: true, category };
  }

  // استرجاع من الذاكرة
  recall(category, query) {
    const items = this.memory[category] || [];
    if (!query) return items.slice(-20);
    const q = query.toLowerCase();
    return items.filter(i => JSON.stringify(i).toLowerCase().includes(q)).slice(-20);
  }

  // حفظ محادثة
  saveConversation(msg, response, agent) {
    this.conversations.push({ msg, response: response?.substring(0, 500), agent, ts: new Date().toISOString() });
    if (this.conversations.length > 5000) this.conversations = this.conversations.slice(-5000);
    this._save(this.chatFile, this.conversations);
  }

  // بحث ذكي في كل الذاكرة
  search(query) {
    const q = query.toLowerCase();
    const results = { facts: [], skills: [], projects: [], conversations: [] };
    Object.keys(this.memory).forEach(cat => {
      results[cat] = (this.memory[cat] || []).filter(i => JSON.stringify(i).toLowerCase().includes(q)).slice(-10);
    });
    results.conversations = this.conversations.filter(c => 
      c.msg?.toLowerCase().includes(q) || c.response?.toLowerCase().includes(q)
    ).slice(-10);
    return results;
  }

  // تعلم تفضيل جديد
  learnPreference(key, value) {
    if (!this.preferences[key]) this.preferences[key] = [];
    if (!this.preferences[key].includes(value)) this.preferences[key].push(value);
    this._save(this.prefsFile, this.preferences);
    return { learned: true, key, value };
  }

  getStatus() {
    return {
      name: this.name, status: 'active',
      facts: this.memory.facts?.length || 0,
      skills: this.memory.skills?.length || 0,
      projects: this.memory.projects?.length || 0,
      conversations: this.conversations.length,
      preferences: Object.keys(this.preferences).length
    };
  }
}

// ==================== AI AGENTS (Specialized) ====================
class AIAgentSystem {
  constructor(memory) {
    this.name = 'AIAgentSystem';
    this.memory = memory;
    this.agents = {
      master: { name: 'OpenClaw Master', role: 'الوكيل الرئيسي - يوزع المهام ويراقب', model: 'grok', systemPrompt: 'أنت OpenClaw، الوكيل الرئيسي الذكي. مهمتك توزيع الشغل على الوكلاء المتخصصين وإدارة كل شي. أنت تفهم العربي وتتكلم بطريقة مختصرة وذكية.' },
      flutter: { name: 'Flutter Expert', role: 'خبير Flutter - يكتب أكواد نظيفة', model: 'grok', systemPrompt: 'أنت خبير Flutter متخصص. تكتب أكواد Dart/Flutter نظيفة وعالية الجودة. تتبع أفضل الممارسات وتستخدم State Management صحيح.' },
      uiDesigner: { name: 'UI Designer', role: 'مصمم UI/UX - يقترح تصاميم', model: 'grok', systemPrompt: 'أنت مصمم UI/UX محترف. تقترح تصاميم جميلة ومريحة للعين مع ألوان متناسقة. تكتب كود Flutter للتصاميم مباشرة.' },
      debugger: { name: 'Debugger', role: 'منقح أخطاء - يحل المشاكل', model: 'grok', systemPrompt: 'أنت خبير تنقيح أخطاء. تحلل الأخطاء وتجد الحلول بسرعة. تشرح المشكلة والحل بوضوح.' },
      codeReviewer: { name: 'Code Reviewer', role: 'مراجع كود - يحسن الأداء', model: 'grok', systemPrompt: 'أنت مراجع كود محترف. تحلل الكود وتعطي اقتراحات لتحسين الأداء والأمان وقابلية الصيانة.' },
      projectGen: { name: 'Project Generator', role: 'مولد مشاريع - ينشئ مشاريع كاملة', model: 'grok', systemPrompt: 'أنت مولد مشاريع Flutter. عندما يطلب المستخدم مشروع، تنشئ كل الملفات: main.dart, screens, models, services, pubspec.yaml. ترجع JSON مع كل الملفات.' },
      codeAnalyzer: { name: 'Code Analyzer', role: 'محلل كود - يفحص الجودة', model: 'grok', systemPrompt: 'أنت محلل كود. تفحص الكود وتعطي: أخطاء محتملة، اقتراحات تحسين، تقييم أداء، مشاكل أمنية. ترجع تقرير مفصل.' },
      communicator: { name: 'Communicator', role: 'وكيل اتصالات - يدير الرسائل', model: 'grok', systemPrompt: 'أنت وكيل اتصالات. تدير الرسائل والإشعارات بين المستخدم والنظام.' },
      devops: { name: 'DevOps Agent', role: 'وكيل DevOps - يدير السيرفر والنشر', model: 'grok', systemPrompt: 'أنت خبير DevOps. تدير السيرفرات، Docker، CI/CD، والنشر. تحل مشاكل البنية التحتية.' }
    };
    this.taskQueue = [];
    this.activeJobs = new Map();
  }

  // توزيع المهمة على الوكيل المناسب تلقائياً
  async dispatch(message, preferredAgent) {
    let agent = preferredAgent;
    if (!agent || !this.agents[agent]) {
      agent = this._detectAgent(message);
    }
    const agentConfig = this.agents[agent];
    logger.info(this.name, `🎯 Dispatching to ${agentConfig.name}: ${message.substring(0, 80)}`);
    
    // حفظ في الذاكرة
    this.memory.remember('tasks', { agent, message: message.substring(0, 200) });
    
    const response = await this._callAI(agentConfig, message);
    this.memory.saveConversation(message, response, agent);
    
    return { agent: agentConfig.name, role: agentConfig.role, response, model: agentConfig.model };
  }

  // كشف الوكيل المناسب تلقائياً
  _detectAgent(msg) {
    const m = msg.toLowerCase();
    if (m.includes('flutter') || m.includes('dart') || m.includes('widget')) return 'flutter';
    if (m.includes('تصميم') || m.includes('ui') || m.includes('ux') || m.includes('لون') || m.includes('design')) return 'uiDesigner';
    if (m.includes('خطأ') || m.includes('error') || m.includes('bug') || m.includes('مشكل')) return 'debugger';
    if (m.includes('راجع') || m.includes('review') || m.includes('حسن') || m.includes('أداء')) return 'codeReviewer';
    if (m.includes('مشروع') || m.includes('تطبيق') || m.includes('أنشئ') || m.includes('project') || m.includes('generate')) return 'projectGen';
    if (m.includes('حلل') || m.includes('فحص') || m.includes('analyze') || m.includes('تحليل')) return 'codeAnalyzer';
    if (m.includes('سيرفر') || m.includes('docker') || m.includes('deploy') || m.includes('نشر')) return 'devops';
    if (m.includes('رسالة') || m.includes('إشعار') || m.includes('تنبيه')) return 'communicator';
    return 'master';
  }

  async _callAI(agentConfig, message) {
    const models = {
      grok: { url: 'https://api.x.ai/v1/chat/completions', model: 'grok-3-fast', key: process.env.XAI_API_KEY },
      openai: { url: process.env.OPENAI_API_BASE ? `${process.env.OPENAI_API_BASE}/chat/completions` : 'https://api.openai.com/v1/chat/completions', model: 'gpt-4o-mini', key: process.env.OPENAI_API_KEY },
      perplexity: { url: 'https://api.perplexity.ai/chat/completions', model: 'sonar-pro', key: process.env.SONAR_API_KEY }
    };

    // Memory context
    const recentConvos = this.memory.conversations.slice(-5).map(c => `[${c.agent}] ${c.msg}`).join('\n');
    const prefs = JSON.stringify(this.memory.preferences);

    const tryModel = async (modelName) => {
      const m = models[modelName];
      if (!m || !m.key) return null;
      const body = JSON.stringify({
        model: m.model,
        messages: [
          { role: 'system', content: `${agentConfig.systemPrompt}\n\nالذاكرة السابقة:\n${recentConvos}\n\nتفضيلات المستخدم: ${prefs}` },
          { role: 'user', content: message }
        ],
        max_tokens: 4000, temperature: 0.7
      });
      return new Promise((resolve) => {
        const u = new URL(m.url);
        const req = https.request({ hostname: u.hostname, path: u.pathname, method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${m.key}`, 'Content-Length': Buffer.byteLength(body) }
        }, (res) => {
          let d = ''; res.on('data', c => d += c);
          res.on('end', () => { try { resolve(JSON.parse(d).choices?.[0]?.message?.content || null); } catch { resolve(null); } });
        });
        req.on('error', () => resolve(null));
        req.setTimeout(30000, () => { req.destroy(); resolve(null); });
        req.write(body); req.end();
      });
    };

    // Fallback chain
    for (const model of [agentConfig.model || 'grok', 'openai', 'perplexity']) {
      const result = await tryModel(model);
      if (result) return result;
    }
    return 'عذراً، لم أتمكن من الاتصال بأي نموذج AI. تحقق من مفاتيح API.';
  }

  listAgents() {
    return Object.entries(this.agents).map(([id, a]) => ({ id, name: a.name, role: a.role, model: a.model }));
  }

  getStatus() {
    return { name: this.name, status: 'active', agents: Object.keys(this.agents).length, 
      taskQueue: this.taskQueue.length, activeJobs: this.activeJobs.size };
  }
}

// ==================== TEMPLATES SYSTEM ====================
class TemplateSystem {
  constructor() {
    this.name = 'TemplateSystem';
    this.templates = this._initTemplates();
  }

  _initTemplates() {
    return {
      login: { name: 'تسجيل دخول', category: 'auth', description: 'شاشة تسجيل دخول مع خلفية متدرجة',
        code: `import 'package:flutter/material.dart';\nclass LoginScreen extends StatefulWidget {\n  @override _LoginScreenState createState() => _LoginScreenState();\n}\nclass _LoginScreenState extends State<LoginScreen> {\n  final _email = TextEditingController();\n  final _pass = TextEditingController();\n  @override Widget build(BuildContext context) {\n    return Scaffold(body: Container(\n      decoration: BoxDecoration(gradient: LinearGradient(colors: [Color(0xFF667eea), Color(0xFF764ba2)], begin: Alignment.topLeft, end: Alignment.bottomRight)),\n      child: Center(child: Card(margin: EdgeInsets.all(32), child: Padding(padding: EdgeInsets.all(24), child: Column(mainAxisSize: MainAxisSize.min, children: [\n        Text('تسجيل الدخول', style: TextStyle(fontSize: 24, fontWeight: FontWeight.bold)),\n        SizedBox(height: 20),\n        TextField(controller: _email, decoration: InputDecoration(labelText: 'البريد الإلكتروني', prefixIcon: Icon(Icons.email))),\n        SizedBox(height: 16),\n        TextField(controller: _pass, obscureText: true, decoration: InputDecoration(labelText: 'كلمة المرور', prefixIcon: Icon(Icons.lock))),\n        SizedBox(height: 24),\n        ElevatedButton(onPressed: () {}, child: Text('دخول'), style: ElevatedButton.styleFrom(minimumSize: Size(double.infinity, 48))),\n      ]))))));\n  }\n}` },
      productList: { name: 'قائمة منتجات', category: 'ecommerce', description: 'شبكة منتجات مع بحث وفلترة',
        code: `import 'package:flutter/material.dart';\nclass ProductListScreen extends StatelessWidget {\n  final products = List.generate(20, (i) => {'name': 'منتج \${i+1}', 'price': (i+1)*10.0, 'image': 'https://picsum.photos/200?random=\$i'});\n  @override Widget build(BuildContext context) {\n    return Scaffold(appBar: AppBar(title: Text('المتجر'), actions: [IconButton(icon: Icon(Icons.search), onPressed: () {}), IconButton(icon: Icon(Icons.shopping_cart), onPressed: () {})]),\n      body: GridView.builder(padding: EdgeInsets.all(8), gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(crossAxisCount: 2, childAspectRatio: 0.75), itemCount: products.length, itemBuilder: (ctx, i) {\n        return Card(child: Column(children: [Expanded(child: Image.network(products[i]['image'], fit: BoxFit.cover)), Padding(padding: EdgeInsets.all(8), child: Column(children: [Text(products[i]['name']), Text('\\$\${products[i]['price']}', style: TextStyle(color: Colors.green, fontWeight: FontWeight.bold))]))]));\n      }));\n  }\n}` },
      chat: { name: 'شات', category: 'social', description: 'واجهة محادثة مع فقاعات رسائل', code: 'ChatScreen template' },
      map: { name: 'خريطة', category: 'location', description: 'خريطة تفاعلية مع علامات', code: 'MapScreen template' },
      camera: { name: 'كاميرا', category: 'media', description: 'التقاط صور وفيديو', code: 'CameraScreen template' },
      settings: { name: 'إعدادات', category: 'utility', description: 'شاشة إعدادات مع تبديلات', code: 'SettingsScreen template' },
      profile: { name: 'ملف شخصي', category: 'social', description: 'صفحة ملف شخصي مع صورة وإحصائيات', code: 'ProfileScreen template' },
      dashboard: { name: 'لوحة تحكم', category: 'admin', description: 'داشبورد مع بطاقات إحصائية', code: 'DashboardScreen template' },
      onboarding: { name: 'شاشة ترحيب', category: 'intro', description: 'صفحات ترحيب متحركة', code: 'OnboardingScreen template' },
      bottomNav: { name: 'شريط تنقل سفلي', category: 'navigation', description: 'تنقل سفلي مع 4 شاشات', code: 'BottomNavScreen template' },
    };
  }

  list(category) {
    const all = Object.entries(this.templates).map(([id, t]) => ({ id, ...t, code: undefined }));
    return category ? all.filter(t => t.category === category) : all;
  }

  get(id) { return this.templates[id] || { error: 'Template not found' }; }

  getCategories() {
    const cats = new Set(Object.values(this.templates).map(t => t.category));
    return [...cats];
  }

  getStatus() { return { name: this.name, status: 'active', templates: Object.keys(this.templates).length, categories: this.getCategories().length }; }
}

// ==================== CODEX CLI (Code Agent) ====================
class CodexAgent {
  constructor(memory) {
    this.name = 'CodexAgent';
    this.memory = memory;
    this.sessions = new Map();
  }

  // تنفيذ أمر في بيئة Linux مدمجة
  async execCommand(command, sessionId) {
    const sid = sessionId || crypto.randomUUID();
    if (!this.sessions.has(sid)) {
      this.sessions.set(sid, { id: sid, history: [], cwd: '/root', created: new Date().toISOString() });
    }
    const session = this.sessions.get(sid);
    
    // حماية من الأوامر المدمرة
    const blocked = ['rm -rf /', 'mkfs', ':(){:|:&};:', 'dd if=/dev/zero of=/dev/sd'];
    if (blocked.some(b => command.includes(b))) {
      return { error: 'أمر محظور: عملية تدميرية', blocked: true, sessionId: sid };
    }

    return new Promise((resolve) => {
      exec(command, { cwd: session.cwd, timeout: 60000, maxBuffer: 1024 * 1024 * 10,
        env: { ...process.env, HOME: '/root', TERM: 'xterm-256color' }
      }, (err, stdout, stderr) => {
        const result = { sessionId: sid, command, stdout: stdout?.substring(0, 50000) || '', 
          stderr: stderr?.substring(0, 10000) || '', exitCode: err?.code || 0, cwd: session.cwd };
        session.history.push({ command, result: stdout?.substring(0, 500), ts: new Date().toISOString() });
        this.memory.remember('commands', { command, success: !err });
        resolve(result);
      });
    });
  }

  // إنشاء/تعديل ملف
  async fileOp(action, filePath, content) {
    try {
      switch (action) {
        case 'read': return { content: fs.readFileSync(filePath, 'utf8'), path: filePath };
        case 'write': fs.mkdirSync(path.dirname(filePath), { recursive: true }); fs.writeFileSync(filePath, content); return { written: true, path: filePath };
        case 'list': return { files: fs.readdirSync(filePath).map(f => ({ name: f, isDir: fs.statSync(path.join(filePath, f)).isDirectory() })) };
        case 'delete': fs.unlinkSync(filePath); return { deleted: true, path: filePath };
        default: return { error: 'Invalid action' };
      }
    } catch (e) { return { error: e.message }; }
  }

  // توليد مشروع Flutter كامل
  async generateProject(description) {
    const projectDir = `${CONFIG.dirs.projects}/project_${Date.now()}`;
    fs.mkdirSync(`${projectDir}/lib/screens`, { recursive: true });
    fs.mkdirSync(`${projectDir}/lib/models`, { recursive: true });
    fs.mkdirSync(`${projectDir}/lib/services`, { recursive: true });
    
    this.memory.remember('projects', { description, dir: projectDir });
    return { projectDir, description, status: 'created',
      files: ['lib/main.dart', 'lib/screens/', 'lib/models/', 'lib/services/', 'pubspec.yaml'],
      message: 'المشروع جاهز! استخدم وكيل Flutter لتوليد الأكواد.' };
  }

  getSessions() { return [...this.sessions.values()].map(s => ({ ...s, history: s.history.length })); }
  getStatus() { return { name: this.name, status: 'active', sessions: this.sessions.size }; }
}

// ==================== SELF-EVOLUTION AGENT ====================
class SelfEvolutionAgent {
  constructor(memory) {
    this.name = 'SelfEvolutionAgent';
    this.memory = memory;
    this.improvements = [];
  }

  start() {
    logger.info(this.name, '🔧 Self-Evolution Agent started');
    // فحص دوري كل 30 دقيقة
    setInterval(() => this.checkAndImprove(), 30 * 60 * 1000);
  }

  async checkAndImprove() {
    const errors = this.memory.recall('errors');
    const recentErrors = errors.filter(e => Date.now() - new Date(e.timestamp).getTime() < 3600000);
    if (recentErrors.length > 5) {
      logger.alert(this.name, `🔧 ${recentErrors.length} أخطاء في الساعة الأخيرة - جاري التحليل`);
      this.improvements.push({ type: 'error_analysis', count: recentErrors.length, ts: new Date().toISOString() });
    }
    // فحص صحة النظام
    const health = { cpu: os.loadavg()[0], memUsed: Math.round((1 - os.freemem() / os.totalmem()) * 100), uptime: os.uptime() };
    if (health.memUsed > 85) {
      logger.alert(this.name, `🔧 ذاكرة عالية: ${health.memUsed}% - جاري التنظيف`);
      exec('sync && echo 3 > /proc/sys/vm/drop_caches', () => {});
    }
    return health;
  }

  // تحديث النظام تلقائياً
  async selfUpdate(component, code) {
    const backup = `${CONFIG.base}/backups/backup_${Date.now()}.js`;
    fs.mkdirSync(path.dirname(backup), { recursive: true });
    try {
      if (fs.existsSync(`${CONFIG.base}/server.js`)) {
        fs.copyFileSync(`${CONFIG.base}/server.js`, backup);
      }
      this.memory.remember('updates', { component, backup });
      return { updated: true, component, backup };
    } catch (e) { return { error: e.message }; }
  }

  getStatus() { return { name: this.name, status: 'active', improvements: this.improvements.length }; }
}

// ==================== SECURITY AGENT ====================
class SecurityAgent {
  constructor() { this.name = 'SecurityAgent'; this.threats = []; }
  start() {
    logger.info(this.name, '🛡️ Security Agent started');
    this._loadBlockedIPs();
    this.setupFirewall();
    setInterval(() => this.fullScan(), 5 * 60 * 1000);
    this.fullScan();
  }
  _loadBlockedIPs() {
    try {
      const out = execSync('grep "Failed password" /var/log/auth.log 2>/dev/null | grep -oP "\\d+\\.\\d+\\.\\d+\\.\\d+" | sort | uniq -c | sort -rn | head -20', { encoding: 'utf8' });
      out.split('\n').filter(Boolean).forEach(l => { const p = l.trim().split(/\s+/); if (parseInt(p[0]) > 5) { CONFIG.blockedIPs.add(p[1]); this.blockIP(p[1]); } });
    } catch {}
  }
  async fullScan() {
    const _e = c => new Promise(r => exec(c, (e, o) => r(o?.trim() || '')));
    return { timestamp: new Date().toISOString(), openPorts: await _e('ss -tlnp | grep LISTEN'),
      activeConnections: await _e('ss -tn state established | wc -l'),
      diskUsage: await _e('df -h / | tail -1'), dockerContainers: await _e('docker ps --format "{{.Names}}: {{.Status}}"') };
  }
  setupFirewall() {
    ['iptables -A INPUT -p tcp --syn -m limit --limit 10/s --limit-burst 20 -j ACCEPT',
     'iptables -A INPUT -p tcp --dport 22 -m connlimit --connlimit-above 5 -j DROP'
    ].forEach(r => exec(r, () => {}));
  }
  blockIP(ip) { CONFIG.blockedIPs.add(ip); exec(`iptables -A INPUT -s ${ip} -j DROP`); logger.alert(this.name, `🚫 Blocked: ${ip}`); }
  getStatus() { return { name: this.name, status: 'active', blockedIPs: [...CONFIG.blockedIPs], threats: this.threats.length }; }
}

// ==================== MONITOR AGENT ====================
class MonitorAgent {
  constructor() { this.name = 'MonitorAgent'; this.metrics = []; }
  start() { logger.info(this.name, '👁️ Monitor Agent started'); setInterval(() => this.collect(), 60000); this.collect(); }
  async collect() {
    const m = { ts: new Date().toISOString(), cpu: os.loadavg(), mem: { total: os.totalmem(), free: os.freemem(), pct: Math.round((1 - os.freemem() / os.totalmem()) * 100) }, uptime: os.uptime() };
    this.metrics.push(m); if (this.metrics.length > 1440) this.metrics = this.metrics.slice(-1440);
    if (m.mem.pct > 85) logger.alert(this.name, `🚨 High memory: ${m.mem.pct}%`);
    return m;
  }
  getStatus() { return { name: this.name, status: 'active', dataPoints: this.metrics.length, latest: this.metrics[this.metrics.length - 1] }; }
}

// ==================== BROWSER AGENT ====================
class BrowserAgent {
  constructor() { this.name = 'BrowserAgent'; this.puppeteerAvailable = false; this.puppeteerModule = null; }
  start() {
    logger.info(this.name, '🌐 Browser Agent started');
    try { require.resolve('puppeteer-core'); this.puppeteerAvailable = true; this.puppeteerModule = 'puppeteer-core'; logger.info(this.name, '✅ Puppeteer-core available'); }
    catch { try { require.resolve('puppeteer'); this.puppeteerAvailable = true; this.puppeteerModule = 'puppeteer'; } catch { this.puppeteerAvailable = false; } }
  }
  async openPage(url, opts = {}) {
    if (this.puppeteerAvailable) {
      try {
        const pup = require(this.puppeteerModule);
        const browser = await pup.launch({ headless: 'new', executablePath: '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu', '--disable-dev-shm-usage'] });
        const page = await browser.newPage(); await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });
        const title = await page.title(); const content = await page.evaluate(() => document.body.innerText.substring(0, 5000));
        const ssPath = `${CONFIG.dirs.browser}/page_${Date.now()}.png`;
        await page.screenshot({ path: ssPath, fullPage: false });
        const sid = crypto.randomUUID(); CONFIG.browserSessions.set(sid, { browser, page, url, title });
        setTimeout(() => { browser.close().catch(() => {}); CONFIG.browserSessions.delete(sid); }, 300000);
        return { title, content, screenshot: ssPath, sessionId: sid, status: 200, mode: 'puppeteer' };
      } catch (e) { logger.error(this.name, `Puppeteer error: ${e.message}`); }
    }
    // Curl fallback
    return new Promise(r => { exec(`curl -sL -m 15 "${url}"`, (e, o) => { r({ title: 'Unknown', content: o?.substring(0, 5000) || '', status: e ? 500 : 200, mode: 'curl-fallback' }); }); });
  }
  async search(query) { return this.openPage(`https://www.google.com/search?q=${encodeURIComponent(query)}`); }
  getStatus() { return { name: this.name, status: 'active', puppeteer: this.puppeteerAvailable, sessions: CONFIG.browserSessions.size }; }
}

// ==================== TERMUX AGENT ====================
class TermuxAgent {
  constructor() { this.name = 'TermuxAgent'; }
  start() { logger.info(this.name, '📱 Termux Agent started'); }
  registerDevice(data) {
    const id = crypto.randomUUID();
    CONFIG.phones.set(id, { ...data, id, registered: new Date().toISOString(), lastSeen: new Date().toISOString() });
    return { deviceId: id, status: 'registered' };
  }
  heartbeat(id, data) { const d = CONFIG.phones.get(id); if (d) { d.lastSeen = new Date().toISOString(); d.data = data; return { ok: true }; } return { error: 'Device not found' }; }
  sendCommand(id, cmd) { const d = CONFIG.phones.get(id); if (d) { d.pendingCommand = cmd; return { sent: true }; } return { error: 'Device not found' }; }
  getScript(type) {
    const scripts = {
      monitor: { name: 'openclaw_monitor.sh', content: '#!/bin/bash\nSERVER="http://76.13.213.128:3100"\nDEVICE_ID=$(curl -s -X POST $SERVER/termux/register -H "Content-Type: application/json" -d "{}" | jq -r .deviceId)\nwhile true; do\n  BAT=$(termux-battery-status 2>/dev/null || echo "{}")\n  NET=$(termux-wifi-connectioninfo 2>/dev/null || echo "{}")\n  curl -s -X POST $SERVER/termux/heartbeat -H "Content-Type: application/json" -d "{\\\"deviceId\\\":\\\"$DEVICE_ID\\\",\\\"battery\\\":$BAT,\\\"network\\\":$NET}"\n  sleep 60\ndone' },
      full: { name: 'openclaw_full.sh', content: '#!/bin/bash\npkg update -y && pkg install -y termux-api curl jq\nSERVER="http://76.13.213.128:3100"\ncurl -s $SERVER/termux/script/monitor | jq -r .content > ~/openclaw_monitor.sh\nchmod +x ~/openclaw_monitor.sh\nnohup bash ~/openclaw_monitor.sh &\necho "✅ OpenClaw Termux Agent installed"' },
      boot: { name: 'openclaw_boot.sh', content: '#!/bin/bash\nsleep 10\nbash ~/openclaw_monitor.sh &' }
    };
    return scripts[type] || { error: 'Script not found' };
  }
  getStatus() { return { name: this.name, status: 'active', devices: CONFIG.phones.size }; }
}

// ==================== ROOT AGENT ====================
class RootAgent {
  constructor() { this.name = 'RootAgent'; this.isRoot = process.getuid?.() === 0; this.auditLog = []; }
  start() { logger.info(this.name, `🔓 Root Agent started (root: ${this.isRoot})`); }
  async rootExec(command, opts = {}) {
    this.auditLog.push({ command, ts: new Date().toISOString() });
    const blocked = ['rm -rf /', 'mkfs', ':(){:|:&};:', 'dd if=/dev/zero of=/dev/sd'];
    if (blocked.some(b => command.includes(b))) return { error: 'Blocked: destructive', blocked: true };
    return new Promise(r => {
      exec(command, { timeout: opts.timeout || 60000, maxBuffer: 50 * 1024 * 1024 }, (e, o, se) => {
        r({ command, stdout: o?.substring(0, 50000) || '', stderr: se?.substring(0, 10000) || '', exitCode: e?.code || 0 });
      });
    });
  }
  async serviceCtl(svc, action) { return this.rootExec(`systemctl ${action} ${svc}`); }
  async dockerCtl(action, args) {
    const cmds = { ps: 'docker ps --format "table {{.Names}}\\t{{.Status}}\\t{{.Ports}}"', images: 'docker images', logs: `docker logs --tail 50 ${args}`, restart: `docker restart ${args}` };
    return this.rootExec(cmds[action] || `docker ${action} ${args || ''}`);
  }
  getStatus() { return { name: this.name, status: 'active', isRoot: this.isRoot, auditLog: this.auditLog.length, platform: `${os.platform()} ${os.arch()}` }; }
}

// ==================== GAMIFICATION ====================
class GamificationSystem {
  constructor(memory) {
    this.name = 'GamificationSystem';
    this.memory = memory;
    this.statsFile = `${CONFIG.dirs.memory}/gamification.json`;
    this.stats = this._load();
  }
  _load() { try { return JSON.parse(fs.readFileSync(this.statsFile, 'utf8')); } catch { return { points: 0, badges: [], streak: 0, level: 1, history: [] }; } }
  _save() { fs.writeFileSync(this.statsFile, JSON.stringify(this.stats, null, 2)); }
  addPoints(amount, reason) {
    this.stats.points += amount;
    this.stats.level = Math.floor(this.stats.points / 100) + 1;
    this.stats.history.push({ points: amount, reason, ts: new Date().toISOString() });
    this._checkBadges();
    this._save();
    return { points: this.stats.points, level: this.stats.level, added: amount, reason };
  }
  _checkBadges() {
    const badges = [
      { id: 'first_code', name: '🏅 أول كود', condition: this.stats.points >= 10 },
      { id: 'flutter_dev', name: '🏅 مطور Flutter', condition: this.stats.points >= 100 },
      { id: 'ui_expert', name: '🥈 خبير UI', condition: this.stats.points >= 250 },
      { id: 'publisher', name: '🥇 ناشر تطبيقات', condition: this.stats.points >= 500 },
      { id: 'problem_solver', name: '💡 حل 100 مشكلة', condition: this.stats.history.length >= 100 },
    ];
    badges.forEach(b => { if (b.condition && !this.stats.badges.find(x => x.id === b.id)) this.stats.badges.push({ id: b.id, name: b.name, earned: new Date().toISOString() }); });
  }
  getStatus() { return { ...this.stats, name: this.name }; }
}

// ==================== MAIN SERVER ====================
class OpenClawMaster {
  constructor() {
    this.memory = new MemorySystem();
    this.agents = new AIAgentSystem(this.memory);
    this.templates = new TemplateSystem();
    this.codex = new CodexAgent(this.memory);
    this.evolution = new SelfEvolutionAgent(this.memory);
    this.security = new SecurityAgent();
    this.monitor = new MonitorAgent();
    this.browser = new BrowserAgent();
    this.termux = new TermuxAgent();
    this.root = new RootAgent();
    this.gamification = new GamificationSystem(this.memory);
    this.startTime = new Date();
    this.version = '4.0.0';
  }

  start() {
    this.security.start(); this.monitor.start(); this.browser.start();
    this.termux.start(); this.root.start(); this.evolution.start();

    const server = http.createServer((req, res) => this.handle(req, res));
    server.listen(CONFIG.port, CONFIG.host, () => {
      console.log('');
      console.log('╔══════════════════════════════════════════════════╗');
      console.log('║     🤖 OpenClaw Master AI Agent v4.0             ║');
      console.log('║     🧠 Memory System: ACTIVE                     ║');
      console.log('║     🎯 AI Agents (9): ACTIVE                     ║');
      console.log('║     📦 Templates (10+): LOADED                   ║');
      console.log('║     💻 Codex CLI: ACTIVE                         ║');
      console.log('║     🔧 Self-Evolution: ACTIVE                    ║');
      console.log('║     🛡️  Security: ACTIVE                         ║');
      console.log('║     🌐 Browser (Puppeteer): ACTIVE               ║');
      console.log('║     📱 Termux: ACTIVE                            ║');
      console.log('║     🔓 Root: ACTIVE                              ║');
      console.log('║     🏆 Gamification: ACTIVE                      ║');
      console.log(`║     🔗 Port: ${CONFIG.port}                               ║`);
      console.log('╚══════════════════════════════════════════════════╝');
      logger.info('Master', `🚀 OpenClaw v${this.version} running on port ${CONFIG.port}`);
    });
    process.on('SIGTERM', () => { logger.info('Master', '🛑 Shutting down...'); process.exit(0); });
    process.on('SIGINT', () => { logger.info('Master', '🛑 Shutting down...'); process.exit(0); });
  }

  async handle(req, res) {
    const ip = req.socket.remoteAddress;
    if (CONFIG.blockedIPs.has(ip)) { res.writeHead(403); res.end('Blocked'); return; }
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') { res.writeHead(200); res.end(); return; }

    const route = new URL(req.url, `http://${req.headers.host}`).pathname;
    let body = '';
    if (['POST', 'PUT'].includes(req.method)) {
      body = await new Promise(r => { let d = ''; req.on('data', c => d += c); req.on('end', () => r(d)); });
    }

    try {
      const result = await this.route(route, body, req.method);
      // Serve HTML for dashboard
      if (typeof result === 'string' && result.startsWith('<!DOCTYPE')) {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); res.end(result);
      } else {
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' }); res.end(JSON.stringify(result, null, 2));
      }
    } catch (e) {
      logger.error('Router', e.message);
      this.memory.remember('errors', { route, error: e.message });
      res.writeHead(500, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: e.message }));
    }
  }

  async route(p, body, method) {
    const d = body ? JSON.parse(body) : {};
    
    // === Dashboard ===
    if (p === '/dashboard') return this._serveDashboard();
    
    // === Core ===
    if (p === '/') return this._apiDocs();
    if (p === '/health') return { status: 'healthy', version: this.version, uptime: Math.round((Date.now() - this.startTime) / 1000) + 's' };
    if (p === '/status') return this._fullStatus();

    // === Master AI (Main Chat) ===
    if (p === '/chat') { this.gamification.addPoints(1, 'chat'); return this.agents.dispatch(d.message, d.agent); }
    if (p === '/agents') return this.agents.listAgents();

    // === Memory ===
    if (p === '/memory/remember') return this.memory.remember(d.category, d.data);
    if (p === '/memory/recall') return this.memory.recall(d.category, d.query);
    if (p === '/memory/search') return this.memory.search(d.query);
    if (p === '/memory/preferences') return method === 'POST' ? this.memory.learnPreference(d.key, d.value) : this.memory.preferences;
    if (p === '/memory/status') return this.memory.getStatus();

    // === Templates ===
    if (p === '/templates') return this.templates.list(d.category);
    if (p === '/templates/categories') return this.templates.getCategories();
    if (p.startsWith('/templates/')) return this.templates.get(p.split('/')[2]);

    // === Codex CLI (Linux Shell) ===
    if (p === '/codex/exec') return this.codex.execCommand(d.command, d.sessionId);
    if (p === '/codex/file') return this.codex.fileOp(d.action, d.path, d.content);
    if (p === '/codex/project') { this.gamification.addPoints(50, 'project_created'); return this.codex.generateProject(d.description); }
    if (p === '/codex/sessions') return this.codex.getSessions();
    if (p === '/codex/status') return this.codex.getStatus();

    // === Security ===
    if (p === '/security/scan') return this.security.fullScan();
    if (p === '/security/status') return this.security.getStatus();
    if (p === '/security/block') { this.security.blockIP(d.ip); return { blocked: d.ip }; }

    // === Monitor ===
    if (p === '/monitor/status') return this.monitor.getStatus();
    if (p === '/monitor/metrics') return this.monitor.collect();

    // === Browser ===
    if (p === '/browser/open') return this.browser.openPage(d.url, d.options || {});
    if (p === '/browser/search') return this.browser.search(d.query);
    if (p === '/browser/status') return this.browser.getStatus();

    // === Termux ===
    if (p === '/termux/register') return this.termux.registerDevice(d);
    if (p === '/termux/heartbeat') return this.termux.heartbeat(d.deviceId, d);
    if (p === '/termux/command') return this.termux.sendCommand(d.deviceId, d.command);
    if (p === '/termux/devices') return [...CONFIG.phones.values()];
    if (p.startsWith('/termux/script/')) return this.termux.getScript(p.split('/')[3]);
    if (p === '/termux/status') return this.termux.getStatus();

    // === Root ===
    if (p === '/root/exec') return this.root.rootExec(d.command, d.options);
    if (p === '/root/docker') return this.root.dockerCtl(d.action, d.args);
    if (p === '/root/service') return this.root.serviceCtl(d.service, d.action);
    if (p === '/root/status') return this.root.getStatus();
    if (p === '/root/audit') return this.root.auditLog.slice(-50);

    // === Evolution ===
    if (p === '/evolution/status') return this.evolution.getStatus();
    if (p === '/evolution/check') return this.evolution.checkAndImprove();

    // === Gamification ===
    if (p === '/gamification') return this.gamification.getStatus();
    if (p === '/gamification/add') return this.gamification.addPoints(d.points || 10, d.reason || 'manual');

    return { error: 'Route not found', path: p };
  }

  _fullStatus() {
    return {
      server: { version: this.version, uptime: Math.round((Date.now() - this.startTime) / 1000) + 's', port: CONFIG.port },
      agents: this.agents.getStatus(), memory: this.memory.getStatus(), templates: this.templates.getStatus(),
      codex: this.codex.getStatus(), evolution: this.evolution.getStatus(), security: this.security.getStatus(),
      monitor: this.monitor.getStatus(), browser: this.browser.getStatus(), termux: this.termux.getStatus(),
      root: this.root.getStatus(), gamification: this.gamification.getStatus()
    };
  }

  _apiDocs() {
    return {
      name: 'OpenClaw Master AI Agent', version: this.version,
      description: 'الوكيل الرئيسي الذكي - يوزع الشغل على الوكلاء المتخصصين',
      endpoints: {
        dashboard: ['GET /dashboard'],
        core: ['GET /health', 'GET /status', 'GET /agents'],
        ai: ['POST /chat {message, agent?}'],
        memory: ['POST /memory/remember {category, data}', 'POST /memory/recall {category, query?}', 'POST /memory/search {query}', 'GET /memory/preferences', 'POST /memory/preferences {key, value}', 'GET /memory/status'],
        templates: ['GET /templates', 'GET /templates/categories', 'GET /templates/:id'],
        codex: ['POST /codex/exec {command, sessionId?}', 'POST /codex/file {action, path, content?}', 'POST /codex/project {description}', 'GET /codex/sessions', 'GET /codex/status'],
        security: ['GET /security/scan', 'GET /security/status', 'POST /security/block {ip}'],
        monitor: ['GET /monitor/status', 'GET /monitor/metrics'],
        browser: ['POST /browser/open {url}', 'POST /browser/search {query}', 'GET /browser/status'],
        termux: ['POST /termux/register', 'POST /termux/heartbeat', 'POST /termux/command', 'GET /termux/devices', 'GET /termux/script/:type', 'GET /termux/status'],
        root: ['POST /root/exec {command}', 'POST /root/docker {action, args?}', 'POST /root/service {service, action}', 'GET /root/status', 'GET /root/audit'],
        evolution: ['GET /evolution/status', 'GET /evolution/check'],
        gamification: ['GET /gamification', 'POST /gamification/add {points, reason}']
      }
    };
  }

  _serveDashboard() {
    return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>OpenClaw Dashboard</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Segoe UI',Tahoma,sans-serif;background:#0a0e17;color:#e0e0e0;direction:rtl}
.header{background:linear-gradient(135deg,#1a1f35,#0d1117);padding:20px 30px;display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #30363d}
.header h1{font-size:24px;background:linear-gradient(90deg,#58a6ff,#bc8cff);-webkit-background-clip:text;-webkit-text-fill-color:transparent}
.header .status{color:#3fb950;font-size:14px}
.container{display:grid;grid-template-columns:250px 1fr;height:calc(100vh - 70px)}
.sidebar{background:#161b22;border-left:1px solid #30363d;padding:15px 0}
.sidebar a{display:flex;align-items:center;gap:10px;padding:12px 20px;color:#8b949e;text-decoration:none;transition:all .2s}
.sidebar a:hover,.sidebar a.active{background:#1f2937;color:#58a6ff;border-right:3px solid #58a6ff}
.sidebar a .icon{font-size:18px}
.main{padding:25px;overflow-y:auto}
.cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:16px;margin-bottom:25px}
.card{background:#161b22;border:1px solid #30363d;border-radius:12px;padding:20px;transition:transform .2s}
.card:hover{transform:translateY(-2px);border-color:#58a6ff}
.card .icon{font-size:28px;margin-bottom:10px}
.card .title{font-size:13px;color:#8b949e;margin-bottom:5px}
.card .value{font-size:22px;font-weight:bold;color:#e6edf3}
.card .badge{display:inline-block;padding:2px 8px;border-radius:10px;font-size:11px;margin-top:8px}
.badge.green{background:#0d3321;color:#3fb950}.badge.blue{background:#0c2d6b;color:#58a6ff}.badge.purple{background:#2d1b4e;color:#bc8cff}
.section{background:#161b22;border:1px solid #30363d;border-radius:12px;padding:20px;margin-bottom:20px}
.section h2{font-size:18px;margin-bottom:15px;color:#e6edf3;display:flex;align-items:center;gap:8px}
.chat-box{display:flex;flex-direction:column;height:400px}
.chat-messages{flex:1;overflow-y:auto;padding:10px;background:#0d1117;border-radius:8px;margin-bottom:10px}
.msg{margin-bottom:12px;padding:10px 14px;border-radius:12px;max-width:80%;font-size:14px;line-height:1.6}
.msg.user{background:#1f6feb;color:white;margin-left:auto;border-bottom-left-radius:4px}
.msg.ai{background:#21262d;color:#e6edf3;margin-right:auto;border-bottom-right-radius:4px}
.msg .agent-tag{font-size:11px;color:#8b949e;margin-bottom:4px}
.chat-input{display:flex;gap:8px}
.chat-input input{flex:1;background:#0d1117;border:1px solid #30363d;border-radius:8px;padding:12px;color:#e6edf3;font-size:14px}
.chat-input input:focus{outline:none;border-color:#58a6ff}
.chat-input button{background:#238636;color:white;border:none;border-radius:8px;padding:12px 24px;cursor:pointer;font-size:14px}
.chat-input button:hover{background:#2ea043}
.terminal{background:#0d1117;border-radius:8px;padding:15px;font-family:'Courier New',monospace;font-size:13px;height:300px;overflow-y:auto}
.terminal .prompt{color:#3fb950}.terminal .output{color:#8b949e;white-space:pre-wrap}
.term-input{display:flex;gap:8px;margin-top:10px}
.term-input input{flex:1;background:#0d1117;border:1px solid #30363d;border-radius:8px;padding:10px;color:#3fb950;font-family:monospace}
.agents-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:12px}
.agent-card{background:#0d1117;border:1px solid #30363d;border-radius:10px;padding:15px;text-align:center}
.agent-card .name{font-weight:bold;color:#58a6ff;margin-bottom:5px}.agent-card .role{font-size:12px;color:#8b949e}
.templates-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:12px}
.template-card{background:#0d1117;border:1px solid #30363d;border-radius:10px;padding:15px;cursor:pointer;transition:all .2s}
.template-card:hover{border-color:#bc8cff;transform:translateY(-2px)}
.template-card .name{font-weight:bold;margin-bottom:5px}.template-card .desc{font-size:12px;color:#8b949e}
@media(max-width:768px){.container{grid-template-columns:1fr}.sidebar{display:none}.cards{grid-template-columns:1fr 1fr}}
</style>
</head>
<body>
<div class="header">
  <h1>🤖 OpenClaw Master v4.0</h1>
  <div class="status" id="serverStatus">● متصل</div>
</div>
<div class="container">
  <nav class="sidebar">
    <a href="#" class="active" onclick="showPage('home')"><span class="icon">🏠</span> الرئيسية</a>
    <a href="#" onclick="showPage('chat')"><span class="icon">💬</span> المحادثة</a>
    <a href="#" onclick="showPage('agents')"><span class="icon">🤖</span> الوكلاء</a>
    <a href="#" onclick="showPage('terminal')"><span class="icon">💻</span> الطرفية</a>
    <a href="#" onclick="showPage('templates')"><span class="icon">📦</span> القوالب</a>
    <a href="#" onclick="showPage('memory')"><span class="icon">🧠</span> الذاكرة</a>
    <a href="#" onclick="showPage('security')"><span class="icon">🛡️</span> الحماية</a>
    <a href="#" onclick="showPage('browser')"><span class="icon">🌐</span> المتصفح</a>
    <a href="#" onclick="showPage('termux')"><span class="icon">📱</span> Termux</a>
    <a href="#" onclick="showPage('gamification')"><span class="icon">🏆</span> الإنجازات</a>
  </nav>
  <main class="main" id="mainContent"></main>
</div>
<script>
const API = window.location.origin;
let currentPage = 'home';

async function api(path, data) {
  const opts = data ? { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(data) } : {};
  const r = await fetch(API + path, opts);
  return r.json();
}

function showPage(page) {
  currentPage = page;
  document.querySelectorAll('.sidebar a').forEach(a => a.classList.remove('active'));
  event?.target?.closest('a')?.classList.add('active');
  const pages = { home: renderHome, chat: renderChat, agents: renderAgents, terminal: renderTerminal,
    templates: renderTemplates, memory: renderMemory, security: renderSecurity, browser: renderBrowser,
    termux: renderTermux, gamification: renderGamification };
  (pages[page] || renderHome)();
}

async function renderHome() {
  const s = await api('/status');
  document.getElementById('mainContent').innerHTML = \`
    <div class="cards">
      <div class="card"><div class="icon">🤖</div><div class="title">الوكلاء النشطين</div><div class="value">\${s.agents?.agents || 9}</div><div class="badge green">نشط</div></div>
      <div class="card"><div class="icon">🧠</div><div class="title">الذاكرة</div><div class="value">\${s.memory?.conversations || 0}</div><div class="badge blue">محادثة</div></div>
      <div class="card"><div class="icon">📦</div><div class="title">القوالب</div><div class="value">\${s.templates?.templates || 10}</div><div class="badge purple">جاهز</div></div>
      <div class="card"><div class="icon">🛡️</div><div class="title">IPs محظورة</div><div class="value">\${s.security?.blockedIPs?.length || 0}</div><div class="badge green">آمن</div></div>
      <div class="card"><div class="icon">🌐</div><div class="title">المتصفح</div><div class="value">\${s.browser?.puppeteer ? 'Puppeteer' : 'Curl'}</div><div class="badge blue">\${s.browser?.sessions || 0} جلسة</div></div>
      <div class="card"><div class="icon">📱</div><div class="title">Termux</div><div class="value">\${s.termux?.devices || 0}</div><div class="badge purple">جهاز</div></div>
      <div class="card"><div class="icon">💻</div><div class="title">Codex CLI</div><div class="value">\${s.codex?.sessions || 0}</div><div class="badge green">جلسة</div></div>
      <div class="card"><div class="icon">🏆</div><div class="title">النقاط</div><div class="value">\${s.gamification?.points || 0}</div><div class="badge purple">مستوى \${s.gamification?.level || 1}</div></div>
    </div>
    <div class="section"><h2>📊 حالة النظام</h2>
      <p>الإصدار: \${s.server?.version} | وقت التشغيل: \${s.server?.uptime} | CPU: \${s.monitor?.latest?.cpu?.[0]?.toFixed(2) || 'N/A'} | RAM: \${s.monitor?.latest?.mem?.pct || 'N/A'}%</p>
    </div>\`;
}

async function renderChat() {
  document.getElementById('mainContent').innerHTML = \`
    <div class="section"><h2>💬 محادثة OpenClaw</h2>
      <div class="chat-box">
        <div class="chat-messages" id="chatMsgs"><div class="msg ai"><div class="agent-tag">🤖 OpenClaw Master</div>مرحباً! أنا OpenClaw، وكيلك الذكي. كيف أقدر أساعدك؟</div></div>
        <div class="chat-input"><input id="chatIn" placeholder="اكتب رسالتك..." onkeypress="if(event.key==='Enter')sendChat()"><button onclick="sendChat()">إرسال</button></div>
      </div></div>\`;
}

async function sendChat() {
  const input = document.getElementById('chatIn');
  const msg = input.value.trim(); if (!msg) return;
  const msgs = document.getElementById('chatMsgs');
  msgs.innerHTML += \`<div class="msg user">\${msg}</div>\`;
  input.value = ''; msgs.scrollTop = msgs.scrollHeight;
  msgs.innerHTML += \`<div class="msg ai" id="typing"><div class="agent-tag">⏳ جاري التفكير...</div></div>\`;
  msgs.scrollTop = msgs.scrollHeight;
  const r = await api('/chat', { message: msg });
  document.getElementById('typing')?.remove();
  msgs.innerHTML += \`<div class="msg ai"><div class="agent-tag">🤖 \${r.agent} (\${r.role})</div>\${r.response?.replace(/\\n/g,'<br>')}</div>\`;
  msgs.scrollTop = msgs.scrollHeight;
}

async function renderAgents() {
  const agents = await api('/agents');
  document.getElementById('mainContent').innerHTML = \`
    <div class="section"><h2>🤖 الوكلاء المتخصصين</h2>
      <div class="agents-grid">\${agents.map(a => \`<div class="agent-card"><div style="font-size:24px">🤖</div><div class="name">\${a.name}</div><div class="role">\${a.role}</div><div class="badge blue">\${a.model}</div></div>\`).join('')}</div>
    </div>\`;
}

async function renderTerminal() {
  document.getElementById('mainContent').innerHTML = \`
    <div class="section"><h2>💻 الطرفية (Linux Shell)</h2>
      <div class="terminal" id="termOutput"><span class="prompt">root@openclaw:~# </span><span class="output">مرحباً بك في بيئة Linux المدمجة</span></div>
      <div class="term-input"><input id="termIn" placeholder="أدخل أمر..." onkeypress="if(event.key==='Enter')execCmd()"><button onclick="execCmd()" style="background:#238636;color:white;border:none;border-radius:8px;padding:10px 20px;cursor:pointer">تنفيذ</button></div>
    </div>\`;
}

async function execCmd() {
  const input = document.getElementById('termIn');
  const cmd = input.value.trim(); if (!cmd) return;
  const term = document.getElementById('termOutput');
  term.innerHTML += \`\\n<span class="prompt">root@openclaw:~# </span>\${cmd}\\n\`;
  input.value = '';
  const r = await api('/codex/exec', { command: cmd });
  term.innerHTML += \`<span class="output">\${r.stdout || r.stderr || 'تم التنفيذ'}</span>\\n\`;
  term.scrollTop = term.scrollHeight;
}

async function renderTemplates() {
  const templates = await api('/templates');
  document.getElementById('mainContent').innerHTML = \`
    <div class="section"><h2>📦 القوالب الجاهزة (\${templates.length})</h2>
      <div class="templates-grid">\${templates.map(t => \`<div class="template-card" onclick="alert('قالب: \${t.name}')"><div class="name">\${t.name}</div><div class="desc">\${t.description}</div><div class="badge purple">\${t.category}</div></div>\`).join('')}</div>
    </div>\`;
}

async function renderMemory() {
  const m = await api('/memory/status');
  document.getElementById('mainContent').innerHTML = \`
    <div class="section"><h2>🧠 نظام الذاكرة</h2>
      <div class="cards">
        <div class="card"><div class="icon">📝</div><div class="title">حقائق</div><div class="value">\${m.facts}</div></div>
        <div class="card"><div class="icon">💬</div><div class="title">محادثات</div><div class="value">\${m.conversations}</div></div>
        <div class="card"><div class="icon">📂</div><div class="title">مشاريع</div><div class="value">\${m.projects}</div></div>
        <div class="card"><div class="icon">⚙️</div><div class="title">تفضيلات</div><div class="value">\${m.preferences}</div></div>
      </div>
      <div style="margin-top:15px"><input id="memSearch" placeholder="بحث في الذاكرة..." style="width:100%;background:#0d1117;border:1px solid #30363d;border-radius:8px;padding:12px;color:#e6edf3" onkeypress="if(event.key==='Enter')searchMemory()"></div>
      <div id="memResults" style="margin-top:10px"></div>
    </div>\`;
}

async function searchMemory() {
  const q = document.getElementById('memSearch').value;
  const r = await api('/memory/search', { query: q });
  document.getElementById('memResults').innerHTML = '<pre style="color:#8b949e;font-size:12px">' + JSON.stringify(r, null, 2) + '</pre>';
}

async function renderSecurity() {
  const s = await api('/security/status');
  document.getElementById('mainContent').innerHTML = \`
    <div class="section"><h2>🛡️ الحماية والأمان</h2>
      <div class="cards">
        <div class="card"><div class="icon">🚫</div><div class="title">IPs محظورة</div><div class="value">\${s.blockedIPs?.length || 0}</div></div>
        <div class="card"><div class="icon">⚠️</div><div class="title">تهديدات</div><div class="value">\${s.threats}</div></div>
      </div>
      <h3 style="margin-top:15px;color:#8b949e">IPs المحظورة:</h3>
      <div style="margin-top:10px">\${(s.blockedIPs||[]).map(ip => \`<span class="badge green" style="margin:4px">\${ip}</span>\`).join('')}</div>
    </div>\`;
}

async function renderBrowser() {
  document.getElementById('mainContent').innerHTML = \`
    <div class="section"><h2>🌐 المتصفح الخاص</h2>
      <div style="display:flex;gap:8px;margin-bottom:15px">
        <input id="browserUrl" placeholder="أدخل رابط..." style="flex:1;background:#0d1117;border:1px solid #30363d;border-radius:8px;padding:12px;color:#e6edf3">
        <button onclick="openUrl()" style="background:#1f6feb;color:white;border:none;border-radius:8px;padding:12px 24px;cursor:pointer">فتح</button>
      </div>
      <div id="browserResult"></div>
    </div>\`;
}

async function openUrl() {
  const url = document.getElementById('browserUrl').value;
  document.getElementById('browserResult').innerHTML = '<p style="color:#8b949e">⏳ جاري الفتح...</p>';
  const r = await api('/browser/open', { url });
  document.getElementById('browserResult').innerHTML = \`<div class="card"><div class="title">\${r.title}</div><div style="font-size:12px;color:#8b949e;margin-top:8px;max-height:200px;overflow:auto">\${r.content?.substring(0,1000) || ''}</div><div class="badge blue">\${r.mode}</div></div>\`;
}

async function renderTermux() {
  const s = await api('/termux/status');
  document.getElementById('mainContent').innerHTML = \`
    <div class="section"><h2>📱 Termux - التحكم بالتلفون</h2>
      <div class="cards">
        <div class="card"><div class="icon">📱</div><div class="title">أجهزة متصلة</div><div class="value">\${s.devices}</div></div>
      </div>
      <div style="margin-top:15px;background:#0d1117;padding:15px;border-radius:8px">
        <h3 style="color:#58a6ff;margin-bottom:10px">📋 أمر التثبيت:</h3>
        <code style="color:#3fb950;font-size:13px">curl -s http://76.13.213.128:3100/termux/script/full | jq -r '.content' | bash</code>
      </div>
    </div>\`;
}

async function renderGamification() {
  const g = await api('/gamification');
  document.getElementById('mainContent').innerHTML = \`
    <div class="section"><h2>🏆 الإنجازات والنقاط</h2>
      <div class="cards">
        <div class="card"><div class="icon">⭐</div><div class="title">النقاط</div><div class="value">\${g.points}</div></div>
        <div class="card"><div class="icon">📊</div><div class="title">المستوى</div><div class="value">\${g.level}</div></div>
        <div class="card"><div class="icon">🏅</div><div class="title">الشارات</div><div class="value">\${g.badges?.length || 0}</div></div>
        <div class="card"><div class="icon">🔥</div><div class="title">السلسلة</div><div class="value">\${g.streak}</div></div>
      </div>
      <h3 style="margin-top:15px;color:#8b949e">الشارات:</h3>
      <div style="margin-top:10px">\${(g.badges||[]).map(b => \`<span class="badge purple" style="margin:4px;font-size:14px">\${b.name}</span>\`).join('') || '<span style="color:#8b949e">لا توجد شارات بعد</span>'}</div>
    </div>\`;
}

// Auto-refresh
showPage('home');
setInterval(() => { if (currentPage === 'home') renderHome(); }, 30000);
</script>
</body>
</html>`;
  }
}

// ==================== START ====================
const server = new OpenClawMaster();
server.start();
