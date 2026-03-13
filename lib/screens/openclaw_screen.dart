import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import '../services/openclaw_service.dart';

class OpenClawScreen extends StatefulWidget {
  const OpenClawScreen({super.key});

  @override
  State<OpenClawScreen> createState() => _OpenClawScreenState();
}

class _OpenClawScreenState extends State<OpenClawScreen> with SingleTickerProviderStateMixin {
  late TabController _tabController;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 7, vsync: this);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<OpenClawService>().loadAll();
    });
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Row(
          children: [
            Icon(Icons.pets, size: 28, color: Color(0xFFFF6B35)),
            SizedBox(width: 8),
            Text('OpenClaw'),
            SizedBox(width: 4),
            Text('v4.0', style: TextStyle(fontSize: 12, color: Colors.grey)),
          ],
        ),
        actions: [
          Consumer<OpenClawService>(
            builder: (_, oc, __) => Row(
              children: [
                Icon(
                  Icons.circle,
                  size: 10,
                  color: oc.isConnected ? Colors.greenAccent : Colors.redAccent,
                ),
                const SizedBox(width: 4),
                Text(
                  oc.isConnected ? 'متصل' : 'غير متصل',
                  style: TextStyle(
                    fontSize: 12,
                    color: oc.isConnected ? Colors.greenAccent : Colors.redAccent,
                  ),
                ),
                const SizedBox(width: 8),
              ],
            ),
          ),
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: () => context.read<OpenClawService>().loadAll(),
          ),
        ],
        bottom: TabBar(
          controller: _tabController,
          isScrollable: true,
          tabAlignment: TabAlignment.start,
          tabs: const [
            Tab(icon: Icon(Icons.dashboard, size: 20), text: 'لوحة التحكم'),
            Tab(icon: Icon(Icons.smart_toy, size: 20), text: 'الوكلاء'),
            Tab(icon: Icon(Icons.terminal, size: 20), text: 'الطرفية'),
            Tab(icon: Icon(Icons.language, size: 20), text: 'المتصفح'),
            Tab(icon: Icon(Icons.memory, size: 20), text: 'الذاكرة'),
            Tab(icon: Icon(Icons.shield, size: 20), text: 'الحماية'),
            Tab(icon: Icon(Icons.phone_android, size: 20), text: 'Termux'),
          ],
        ),
      ),
      body: TabBarView(
        controller: _tabController,
        children: const [
          _DashboardTab(),
          _AgentsTab(),
          _CodexTab(),
          _BrowserTab(),
          _MemoryTab(),
          _SecurityTab(),
          _TermuxTab(),
        ],
      ),
    );
  }
}

// ==================== لوحة التحكم ====================
class _DashboardTab extends StatelessWidget {
  const _DashboardTab();

  @override
  Widget build(BuildContext context) {
    return Consumer<OpenClawService>(
      builder: (_, oc, __) {
        if (oc.isLoading && oc.healthData == null) {
          return const Center(child: CircularProgressIndicator());
        }
        return RefreshIndicator(
          onRefresh: () => oc.loadAll(),
          child: ListView(
            padding: const EdgeInsets.all(16),
            children: [
              // حالة النظام
              _SectionCard(
                icon: Icons.monitor_heart,
                title: 'حالة النظام',
                color: const Color(0xFFFF6B35),
                child: Column(
                  children: [
                    _StatusTile('الحالة', oc.healthData?['status'] ?? 'غير معروف',
                        oc.healthData?['status'] == 'healthy'),
                    _StatusTile('الإصدار', oc.healthData?['version'] ?? '-', true),
                    _StatusTile('وقت التشغيل', oc.healthData?['uptime'] ?? '-', true),
                    _StatusTile('الوكلاء', '${oc.agents.length} وكيل', oc.agents.isNotEmpty),
                  ],
                ),
              ),
              const SizedBox(height: 12),
              // Gamification
              if (oc.gamification != null)
                _SectionCard(
                  icon: Icons.emoji_events,
                  title: 'الإنجازات',
                  color: Colors.amber,
                  child: Column(
                    children: [
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceAround,
                        children: [
                          _StatBox('المستوى', '${oc.gamification!['level'] ?? 1}', Icons.star, Colors.amber),
                          _StatBox('XP', '${oc.gamification!['xp'] ?? 0}', Icons.bolt, Colors.orange),
                          _StatBox('المهام', '${oc.gamification!['tasksCompleted'] ?? 0}', Icons.task_alt, Colors.green),
                        ],
                      ),
                      const SizedBox(height: 12),
                      // شريط التقدم
                      ClipRRect(
                        borderRadius: BorderRadius.circular(8),
                        child: LinearProgressIndicator(
                          value: ((oc.gamification!['xp'] ?? 0) % 100) / 100,
                          minHeight: 10,
                          backgroundColor: Colors.grey[800],
                          valueColor: const AlwaysStoppedAnimation(Colors.amber),
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        '${(oc.gamification!['xp'] ?? 0) % 100}/100 XP للمستوى التالي',
                        style: TextStyle(fontSize: 12, color: Colors.grey[400]),
                      ),
                    ],
                  ),
                ),
              const SizedBox(height: 12),
              // القوالب الجاهزة
              _SectionCard(
                icon: Icons.widgets,
                title: 'القوالب الجاهزة (${oc.templates.length})',
                color: Colors.purple,
                child: Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: oc.templates.map((t) => Chip(
                    avatar: const Icon(Icons.code, size: 16),
                    label: Text(t['name'] ?? ''),
                    backgroundColor: Colors.purple.withOpacity(0.2),
                  )).toList(),
                ),
              ),
              const SizedBox(height: 12),
              // إجراءات سريعة
              _SectionCard(
                icon: Icons.flash_on,
                title: 'إجراءات سريعة',
                color: Colors.blue,
                child: Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: [
                    _ActionChip('إعادة تشغيل', Icons.restart_alt, () async {
                      await oc.codexExec('systemctl restart openclaw');
                      if (context.mounted) {
                        ScaffoldMessenger.of(context).showSnackBar(
                          const SnackBar(content: Text('جاري إعادة التشغيل...')),
                        );
                      }
                    }),
                    _ActionChip('تحديث', Icons.update, () => oc.loadAll()),
                    _ActionChip('تنظيف الذاكرة', Icons.cleaning_services, () async {
                      await oc.codexExec('sync && echo 3 > /proc/sys/vm/drop_caches');
                      if (context.mounted) {
                        ScaffoldMessenger.of(context).showSnackBar(
                          const SnackBar(content: Text('تم تنظيف الذاكرة')),
                        );
                      }
                    }),
                  ],
                ),
              ),
            ],
          ),
        );
      },
    );
  }
}

// ==================== الوكلاء ====================
class _AgentsTab extends StatelessWidget {
  const _AgentsTab();

  @override
  Widget build(BuildContext context) {
    return Consumer<OpenClawService>(
      builder: (_, oc, __) {
        if (oc.agents.isEmpty) {
          return const Center(child: Text('لا يوجد وكلاء'));
        }
        return ListView.builder(
          padding: const EdgeInsets.all(16),
          itemCount: oc.agents.length,
          itemBuilder: (context, index) {
            final agent = oc.agents[index];
            final icons = {
              'master': Icons.pets,
              'flutter': Icons.phone_android,
              'uiDesigner': Icons.palette,
              'debugger': Icons.bug_report,
              'codeReviewer': Icons.rate_review,
              'projectGen': Icons.rocket_launch,
              'codeAnalyzer': Icons.analytics,
              'communicator': Icons.message,
              'devops': Icons.cloud,
            };
            final colors = {
              'master': const Color(0xFFFF6B35),
              'flutter': Colors.blue,
              'uiDesigner': Colors.pink,
              'debugger': Colors.red,
              'codeReviewer': Colors.green,
              'projectGen': Colors.purple,
              'codeAnalyzer': Colors.teal,
              'communicator': Colors.orange,
              'devops': Colors.indigo,
            };
            final id = agent['id'] ?? '';
            return Card(
              margin: const EdgeInsets.only(bottom: 12),
              child: ListTile(
                leading: CircleAvatar(
                  backgroundColor: (colors[id] ?? Colors.grey).withOpacity(0.2),
                  child: Icon(icons[id] ?? Icons.smart_toy, color: colors[id] ?? Colors.grey),
                ),
                title: Text(agent['name'] ?? '', style: const TextStyle(fontWeight: FontWeight.bold)),
                subtitle: Text(agent['role'] ?? ''),
                trailing: Chip(
                  label: Text(agent['model'] ?? '', style: const TextStyle(fontSize: 11)),
                  backgroundColor: Colors.blue.withOpacity(0.2),
                ),
                onTap: () => _showAgentChat(context, agent, oc),
              ),
            );
          },
        );
      },
    );
  }

  void _showAgentChat(BuildContext context, Map<String, dynamic> agent, OpenClawService oc) {
    final controller = TextEditingController();
    String? response;
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setSheetState) => Padding(
          padding: EdgeInsets.only(
            bottom: MediaQuery.of(ctx).viewInsets.bottom,
            left: 16, right: 16, top: 16,
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text('محادثة مع ${agent['name']}', style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
              const SizedBox(height: 12),
              TextField(
                controller: controller,
                decoration: InputDecoration(
                  hintText: 'اكتب رسالتك...',
                  border: const OutlineInputBorder(),
                  suffixIcon: IconButton(
                    icon: const Icon(Icons.send),
                    onPressed: () async {
                      if (controller.text.isEmpty) return;
                      setSheetState(() => response = 'جاري الرد...');
                      final result = await oc.chat(controller.text, agent: agent['id']);
                      setSheetState(() => response = result?['response'] ?? 'لا توجد استجابة');
                    },
                  ),
                ),
                maxLines: 3,
              ),
              if (response != null) ...[
                const SizedBox(height: 12),
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: Colors.blue.withOpacity(0.1),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: SelectableText(response!, style: const TextStyle(fontSize: 14)),
                ),
              ],
              const SizedBox(height: 16),
            ],
          ),
        ),
      ),
    );
  }
}

// ==================== الطرفية (Codex CLI) ====================
class _CodexTab extends StatefulWidget {
  const _CodexTab();

  @override
  State<_CodexTab> createState() => _CodexTabState();
}

class _CodexTabState extends State<_CodexTab> {
  final _controller = TextEditingController();
  final _scrollController = ScrollController();
  final List<Map<String, String>> _history = [];

  void _execute() async {
    final cmd = _controller.text.trim();
    if (cmd.isEmpty) return;
    setState(() => _history.add({'type': 'cmd', 'text': '\$ $cmd'}));
    _controller.clear();
    final oc = context.read<OpenClawService>();
    final result = await oc.codexExec(cmd);
    setState(() {
      if (result != null) {
        _history.add({'type': 'out', 'text': result['stdout'] ?? ''});
        if ((result['stderr'] ?? '').isNotEmpty) {
          _history.add({'type': 'err', 'text': result['stderr']});
        }
      } else {
        _history.add({'type': 'err', 'text': 'خطأ في الاتصال'});
      }
    });
    Future.delayed(const Duration(milliseconds: 100), () {
      _scrollController.animateTo(
        _scrollController.position.maxScrollExtent,
        duration: const Duration(milliseconds: 300),
        curve: Curves.easeOut,
      );
    });
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        // أزرار سريعة
        SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          padding: const EdgeInsets.all(8),
          child: Row(
            children: [
              _QuickCmd('حالة Docker', 'docker ps', _runQuick),
              _QuickCmd('المساحة', 'df -h /', _runQuick),
              _QuickCmd('الذاكرة', 'free -h', _runQuick),
              _QuickCmd('العمليات', 'top -bn1 | head -15', _runQuick),
              _QuickCmd('الشبكة', 'ss -tlnp', _runQuick),
              _QuickCmd('السجلات', 'journalctl -u openclaw --no-pager -n 20', _runQuick),
            ],
          ),
        ),
        const Divider(height: 1),
        // سجل الأوامر
        Expanded(
          child: Container(
            color: Colors.black,
            child: ListView.builder(
              controller: _scrollController,
              padding: const EdgeInsets.all(12),
              itemCount: _history.length,
              itemBuilder: (_, i) {
                final item = _history[i];
                Color color;
                switch (item['type']) {
                  case 'cmd': color = Colors.greenAccent; break;
                  case 'err': color = Colors.redAccent; break;
                  default: color = Colors.white70;
                }
                return Padding(
                  padding: const EdgeInsets.only(bottom: 4),
                  child: SelectableText(
                    item['text'] ?? '',
                    style: TextStyle(
                      fontFamily: 'monospace',
                      fontSize: 13,
                      color: color,
                    ),
                  ),
                );
              },
            ),
          ),
        ),
        // حقل الإدخال
        Container(
          color: Colors.grey[900],
          padding: const EdgeInsets.all(8),
          child: Row(
            children: [
              const Text('root@openclaw:', style: TextStyle(color: Colors.greenAccent, fontFamily: 'monospace', fontSize: 13)),
              const SizedBox(width: 4),
              Expanded(
                child: TextField(
                  controller: _controller,
                  style: const TextStyle(fontFamily: 'monospace', fontSize: 13),
                  decoration: const InputDecoration(
                    hintText: 'أدخل أمر...',
                    border: InputBorder.none,
                    isDense: true,
                    contentPadding: EdgeInsets.symmetric(vertical: 8),
                  ),
                  onSubmitted: (_) => _execute(),
                ),
              ),
              IconButton(
                icon: const Icon(Icons.send, size: 20),
                onPressed: _execute,
              ),
            ],
          ),
        ),
      ],
    );
  }

  void _runQuick(String cmd) {
    _controller.text = cmd;
    _execute();
  }
}

// ==================== المتصفح ====================
class _BrowserTab extends StatefulWidget {
  const _BrowserTab();

  @override
  State<_BrowserTab> createState() => _BrowserTabState();
}

class _BrowserTabState extends State<_BrowserTab> {
  final _urlController = TextEditingController(text: 'https://google.com');
  Map<String, dynamic>? _result;
  bool _isLoading = false;

  void _openUrl() async {
    setState(() => _isLoading = true);
    final oc = context.read<OpenClawService>();
    final result = await oc.browserOpen(_urlController.text);
    setState(() {
      _result = result;
      _isLoading = false;
    });
  }

  void _screenshot() async {
    setState(() => _isLoading = true);
    final oc = context.read<OpenClawService>();
    final result = await oc.browserScreenshot(_urlController.text);
    setState(() {
      _result = result;
      _isLoading = false;
    });
  }

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        // حالة المتصفح
        Consumer<OpenClawService>(
          builder: (_, oc, __) => _SectionCard(
            icon: Icons.language,
            title: 'حالة المتصفح',
            color: Colors.blue,
            child: Column(
              children: [
                _StatusTile('Puppeteer', oc.browserStatus?['puppeteer'] == true ? 'نشط' : 'غير نشط',
                    oc.browserStatus?['puppeteer'] == true),
                _StatusTile('Chromium', oc.browserStatus?['chromiumPath'] ?? 'غير موجود',
                    oc.browserStatus?['chromiumPath'] != null),
                _StatusTile('الجلسات', '${oc.browserStatus?['activeSessions'] ?? 0}', true),
              ],
            ),
          ),
        ),
        const SizedBox(height: 16),
        // فتح URL
        TextField(
          controller: _urlController,
          decoration: InputDecoration(
            labelText: 'عنوان URL',
            border: const OutlineInputBorder(),
            suffixIcon: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                IconButton(icon: const Icon(Icons.open_in_browser), onPressed: _openUrl, tooltip: 'فتح'),
                IconButton(icon: const Icon(Icons.camera_alt), onPressed: _screenshot, tooltip: 'لقطة شاشة'),
              ],
            ),
          ),
          onSubmitted: (_) => _openUrl(),
        ),
        const SizedBox(height: 16),
        if (_isLoading) const Center(child: CircularProgressIndicator()),
        if (_result != null)
          _SectionCard(
            icon: Icons.web,
            title: 'النتيجة',
            color: Colors.green,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                if (_result!['title'] != null)
                  Text('العنوان: ${_result!['title']}', style: const TextStyle(fontWeight: FontWeight.bold)),
                if (_result!['sessionId'] != null)
                  Text('الجلسة: ${_result!['sessionId']}', style: TextStyle(fontSize: 12, color: Colors.grey[400])),
                const SizedBox(height: 8),
                if (_result!['content'] != null)
                  Container(
                    height: 200,
                    width: double.infinity,
                    padding: const EdgeInsets.all(8),
                    decoration: BoxDecoration(
                      color: Colors.black,
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: SingleChildScrollView(
                      child: SelectableText(
                        '${_result!['content']}'.substring(0, ('${_result!['content']}'.length > 2000) ? 2000 : '${_result!['content']}'.length),
                        style: const TextStyle(fontFamily: 'monospace', fontSize: 12, color: Colors.white70),
                      ),
                    ),
                  ),
              ],
            ),
          ),
      ],
    );
  }
}

// ==================== الذاكرة ====================
class _MemoryTab extends StatefulWidget {
  const _MemoryTab();

  @override
  State<_MemoryTab> createState() => _MemoryTabState();
}

class _MemoryTabState extends State<_MemoryTab> {
  final _keyController = TextEditingController();
  final _valueController = TextEditingController();
  final _recallController = TextEditingController();
  dynamic _recallResult;

  @override
  Widget build(BuildContext context) {
    return Consumer<OpenClawService>(
      builder: (_, oc, __) => ListView(
        padding: const EdgeInsets.all(16),
        children: [
          // حالة الذاكرة
          _SectionCard(
            icon: Icons.memory,
            title: 'حالة الذاكرة',
            color: Colors.teal,
            child: Column(
              children: [
                _StatusTile('النوع', oc.memoryStatus?['type'] ?? 'JSON', true),
                _StatusTile('العناصر', '${oc.memoryStatus?['entries'] ?? 0}', true),
                _StatusTile('الملف', oc.memoryStatus?['file'] ?? '-', true),
              ],
            ),
          ),
          const SizedBox(height: 16),
          // حفظ في الذاكرة
          _SectionCard(
            icon: Icons.save,
            title: 'حفظ في الذاكرة',
            color: Colors.green,
            child: Column(
              children: [
                TextField(
                  controller: _keyController,
                  decoration: const InputDecoration(labelText: 'المفتاح', border: OutlineInputBorder()),
                ),
                const SizedBox(height: 8),
                TextField(
                  controller: _valueController,
                  decoration: const InputDecoration(labelText: 'القيمة', border: OutlineInputBorder()),
                  maxLines: 3,
                ),
                const SizedBox(height: 8),
                FilledButton.icon(
                  onPressed: () async {
                    final success = await oc.saveMemory(_keyController.text, _valueController.text);
                    if (context.mounted) {
                      ScaffoldMessenger.of(context).showSnackBar(
                        SnackBar(content: Text(success ? 'تم الحفظ بنجاح' : 'فشل الحفظ')),
                      );
                    }
                    if (success) {
                      _keyController.clear();
                      _valueController.clear();
                      oc.fetchMemoryStatus();
                    }
                  },
                  icon: const Icon(Icons.save),
                  label: const Text('حفظ'),
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),
          // استرجاع من الذاكرة
          _SectionCard(
            icon: Icons.search,
            title: 'استرجاع من الذاكرة',
            color: Colors.orange,
            child: Column(
              children: [
                TextField(
                  controller: _recallController,
                  decoration: InputDecoration(
                    labelText: 'المفتاح',
                    border: const OutlineInputBorder(),
                    suffixIcon: IconButton(
                      icon: const Icon(Icons.search),
                      onPressed: () async {
                        final result = await oc.recallMemory(_recallController.text);
                        setState(() => _recallResult = result);
                      },
                    ),
                  ),
                ),
                if (_recallResult != null) ...[
                  const SizedBox(height: 8),
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: Colors.orange.withOpacity(0.1),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: SelectableText(
                      '$_recallResult',
                      style: const TextStyle(fontFamily: 'monospace', fontSize: 13),
                    ),
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}

// ==================== الحماية ====================
class _SecurityTab extends StatelessWidget {
  const _SecurityTab();

  @override
  Widget build(BuildContext context) {
    return Consumer<OpenClawService>(
      builder: (_, oc, __) => ListView(
        padding: const EdgeInsets.all(16),
        children: [
          _SectionCard(
            icon: Icons.shield,
            title: 'حالة الحماية',
            color: Colors.red,
            child: Column(
              children: [
                _StatusTile('الجدار الناري', oc.securityStatus?['firewall'] ?? 'نشط', true),
                _StatusTile('التشفير', oc.securityStatus?['encryption'] ?? 'AES-256', true),
                _StatusTile('IPs محظورة', '${oc.securityStatus?['blockedIPs'] ?? 0}',
                    (oc.securityStatus?['blockedIPs'] ?? 0) > 0),
                _StatusTile('المراقبة', oc.securityStatus?['monitoring'] ?? '24/7', true),
              ],
            ),
          ),
          const SizedBox(height: 16),
          // إجراءات الحماية
          _SectionCard(
            icon: Icons.security,
            title: 'إجراءات الحماية',
            color: Colors.deepOrange,
            child: Column(
              children: [
                ListTile(
                  leading: const Icon(Icons.block, color: Colors.red),
                  title: const Text('فحص التهديدات'),
                  onTap: () async {
                    final result = await oc.codexExec('fail2ban-client status 2>/dev/null || echo "fail2ban غير مثبت"');
                    if (context.mounted) {
                      ScaffoldMessenger.of(context).showSnackBar(
                        SnackBar(content: Text(result?['stdout'] ?? 'خطأ')),
                      );
                    }
                  },
                ),
                ListTile(
                  leading: const Icon(Icons.vpn_key, color: Colors.amber),
                  title: const Text('فحص SSH'),
                  onTap: () async {
                    final result = await oc.codexExec('last -10');
                    if (context.mounted) {
                      _showResultDialog(context, 'سجل الدخول', result?['stdout'] ?? 'لا توجد بيانات');
                    }
                  },
                ),
                ListTile(
                  leading: const Icon(Icons.update, color: Colors.green),
                  title: const Text('تحديث الحماية'),
                  onTap: () async {
                    await oc.codexExec('apt-get update -qq && apt-get upgrade -y -qq');
                    if (context.mounted) {
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(content: Text('جاري التحديث...')),
                      );
                    }
                  },
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  void _showResultDialog(BuildContext context, String title, String content) {
    showDialog(
      context: context,
      builder: (_) => AlertDialog(
        title: Text(title),
        content: SingleChildScrollView(
          child: SelectableText(content, style: const TextStyle(fontFamily: 'monospace', fontSize: 12)),
        ),
        actions: [TextButton(onPressed: () => Navigator.pop(context), child: const Text('إغلاق'))],
      ),
    );
  }
}

// ==================== Termux ====================
class _TermuxTab extends StatefulWidget {
  const _TermuxTab();

  @override
  State<_TermuxTab> createState() => _TermuxTabState();
}

class _TermuxTabState extends State<_TermuxTab> {
  String? _scriptContent;
  String _selectedType = 'full';

  @override
  Widget build(BuildContext context) {
    return Consumer<OpenClawService>(
      builder: (_, oc, __) => ListView(
        padding: const EdgeInsets.all(16),
        children: [
          _SectionCard(
            icon: Icons.phone_android,
            title: 'ربط Termux',
            color: Colors.green,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text('اختر نوع السكريبت:', style: TextStyle(fontWeight: FontWeight.bold)),
                const SizedBox(height: 8),
                Wrap(
                  spacing: 8,
                  children: [
                    ChoiceChip(label: const Text('كامل'), selected: _selectedType == 'full',
                        onSelected: (_) => setState(() => _selectedType = 'full')),
                    ChoiceChip(label: const Text('مراقبة'), selected: _selectedType == 'monitor',
                        onSelected: (_) => setState(() => _selectedType = 'monitor')),
                    ChoiceChip(label: const Text('بدء تلقائي'), selected: _selectedType == 'boot',
                        onSelected: (_) => setState(() => _selectedType = 'boot')),
                  ],
                ),
                const SizedBox(height: 12),
                FilledButton.icon(
                  onPressed: () async {
                    final result = await oc.getTermuxScript(_selectedType);
                    setState(() => _scriptContent = result?['content']);
                  },
                  icon: const Icon(Icons.download),
                  label: const Text('جلب السكريبت'),
                ),
              ],
            ),
          ),
          if (_scriptContent != null) ...[
            const SizedBox(height: 16),
            _SectionCard(
              icon: Icons.code,
              title: 'السكريبت',
              color: Colors.teal,
              child: Column(
                children: [
                  Container(
                    height: 300,
                    width: double.infinity,
                    padding: const EdgeInsets.all(8),
                    decoration: BoxDecoration(
                      color: Colors.black,
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: SingleChildScrollView(
                      child: SelectableText(
                        _scriptContent!,
                        style: const TextStyle(fontFamily: 'monospace', fontSize: 12, color: Colors.greenAccent),
                      ),
                    ),
                  ),
                  const SizedBox(height: 8),
                  Row(
                    children: [
                      Expanded(
                        child: FilledButton.icon(
                          onPressed: () {
                            Clipboard.setData(ClipboardData(text: _scriptContent!));
                            ScaffoldMessenger.of(context).showSnackBar(
                              const SnackBar(content: Text('تم النسخ!')),
                            );
                          },
                          icon: const Icon(Icons.copy),
                          label: const Text('نسخ'),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ],
          const SizedBox(height: 16),
          // تعليمات
          _SectionCard(
            icon: Icons.help_outline,
            title: 'تعليمات التثبيت',
            color: Colors.blue,
            child: const Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('1. ثبت Termux من F-Droid', style: TextStyle(height: 2)),
                Text('2. ثبت Termux:API و Termux:Boot', style: TextStyle(height: 2)),
                Text('3. انسخ السكريبت والصقه في Termux', style: TextStyle(height: 2)),
                Text('4. السكريبت يربط التلفون بالسيرفر تلقائياً', style: TextStyle(height: 2)),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

// ==================== Widgets مشتركة ====================

class _SectionCard extends StatelessWidget {
  final IconData icon;
  final String title;
  final Color color;
  final Widget child;

  const _SectionCard({required this.icon, required this.title, required this.color, required this.child});

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(icon, color: color, size: 24),
                const SizedBox(width: 8),
                Text(title, style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.bold)),
              ],
            ),
            const Divider(),
            child,
          ],
        ),
      ),
    );
  }
}

class _StatusTile extends StatelessWidget {
  final String label;
  final String value;
  final bool active;

  const _StatusTile(this.label, this.value, this.active);

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        children: [
          Icon(Icons.circle, size: 8, color: active ? Colors.greenAccent : Colors.redAccent),
          const SizedBox(width: 8),
          Text(label, style: const TextStyle(fontWeight: FontWeight.bold)),
          const Spacer(),
          Text(value, style: TextStyle(color: Colors.grey[400], fontSize: 13)),
        ],
      ),
    );
  }
}

class _StatBox extends StatelessWidget {
  final String label;
  final String value;
  final IconData icon;
  final Color color;

  const _StatBox(this.label, this.value, this.icon, this.color);

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Icon(icon, color: color, size: 28),
        const SizedBox(height: 4),
        Text(value, style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold, color: color)),
        Text(label, style: TextStyle(fontSize: 12, color: Colors.grey[400])),
      ],
    );
  }
}

class _ActionChip extends StatelessWidget {
  final String label;
  final IconData icon;
  final VoidCallback onTap;

  const _ActionChip(this.label, this.icon, this.onTap);

  @override
  Widget build(BuildContext context) {
    return ActionChip(
      avatar: Icon(icon, size: 16),
      label: Text(label),
      onPressed: onTap,
    );
  }
}

class _QuickCmd extends StatelessWidget {
  final String label;
  final String cmd;
  final Function(String) onTap;

  const _QuickCmd(this.label, this.cmd, this.onTap);

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(left: 8),
      child: ActionChip(
        label: Text(label, style: const TextStyle(fontSize: 12)),
        onPressed: () => onTap(cmd),
        backgroundColor: Colors.blue.withOpacity(0.15),
      ),
    );
  }
}
