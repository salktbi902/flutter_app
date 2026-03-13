import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';
import '../services/ai_service.dart';
import '../services/websocket_service.dart';
import '../services/openclaw_service.dart';

class SettingsScreen extends StatefulWidget {
  const SettingsScreen({super.key});

  @override
  State<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends State<SettingsScreen> {
  Map<String, dynamic>? _healthData;
  bool _isChecking = false;

  void _checkHealth() async {
    setState(() => _isChecking = true);
    final data = await context.read<AIService>().checkHealth();
    await context.read<OpenClawService>().checkHealth();
    setState(() {
      _healthData = data;
      _isChecking = false;
    });
  }

  @override
  void initState() {
    super.initState();
    _checkHealth();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Row(
          children: [
            Icon(Icons.settings, size: 28),
            SizedBox(width: 8),
            Text('الإعدادات'),
          ],
        ),
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          // حالة الاتصال
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      const Icon(Icons.cloud, size: 24),
                      const SizedBox(width: 8),
                      Text('حالة السيرفرات', style: Theme.of(context).textTheme.titleMedium),
                      const Spacer(),
                      if (_isChecking)
                        const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2))
                      else
                        IconButton(icon: const Icon(Icons.refresh), onPressed: _checkHealth),
                    ],
                  ),
                  const Divider(),
                  _StatusRow(
                    label: 'AI Studio API',
                    value: _healthData != null ? 'متصل' : 'غير متصل',
                    isConnected: _healthData != null,
                  ),
                  Consumer<OpenClawService>(
                    builder: (_, oc, __) => _StatusRow(
                      label: 'OpenClaw v4.0',
                      value: oc.isConnected ? 'متصل' : 'غير متصل',
                      isConnected: oc.isConnected,
                    ),
                  ),
                  Consumer<WebSocketService>(
                    builder: (_, ws, __) => _StatusRow(
                      label: 'WebSocket',
                      value: ws.isConnected ? 'متصل' : 'غير متصل',
                      isConnected: ws.isConnected,
                    ),
                  ),
                  if (_healthData != null) ...[
                    _StatusRow(
                      label: 'الإصدار',
                      value: _healthData!['version'] ?? 'غير معروف',
                      isConnected: true,
                    ),
                    if (_healthData!['services'] != null) ...[
                      _StatusRow(
                        label: 'Redis',
                        value: _healthData!['services']['redis'] ?? 'غير معروف',
                        isConnected: _healthData!['services']['redis'] == 'connected',
                      ),
                    ],
                  ],
                ],
              ),
            ),
          ),
          const SizedBox(height: 16),
          // معلومات الاتصال
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      const Icon(Icons.info_outline, size: 24),
                      const SizedBox(width: 8),
                      Text('معلومات الاتصال', style: Theme.of(context).textTheme.titleMedium),
                    ],
                  ),
                  const Divider(),
                  const _InfoRow(label: 'IP', value: '76.13.213.128'),
                  const _InfoRow(label: 'AI Studio', value: 'http://76.13.213.128:3000'),
                  const _InfoRow(label: 'OpenClaw', value: 'http://76.13.213.128:3100'),
                  const _InfoRow(label: 'WebSocket', value: 'ws://76.13.213.128:3000'),
                ],
              ),
            ),
          ),
          const SizedBox(height: 16),
          // OpenClaw
          Card(
            color: const Color(0xFFFF6B35).withOpacity(0.1),
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      const Icon(Icons.pets, size: 24, color: Color(0xFFFF6B35)),
                      const SizedBox(width: 8),
                      Text('OpenClaw Master Agent', style: Theme.of(context).textTheme.titleMedium),
                    ],
                  ),
                  const Divider(),
                  Consumer<OpenClawService>(
                    builder: (_, oc, __) => Column(
                      children: [
                        _StatusRow(label: 'الوكلاء', value: '${oc.agents.length} وكيل', isConnected: oc.agents.isNotEmpty),
                        _StatusRow(label: 'المتصفح', value: oc.browserStatus?['puppeteer'] == true ? 'Puppeteer نشط' : 'غير نشط',
                            isConnected: oc.browserStatus?['puppeteer'] == true),
                        _StatusRow(label: 'الذاكرة', value: '${oc.memoryStatus?['entries'] ?? 0} عنصر', isConnected: true),
                        _StatusRow(label: 'الحماية', value: oc.securityStatus?['firewall'] ?? 'نشط', isConnected: true),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 16),
          // عن التطبيق
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      const Icon(Icons.smart_toy, size: 24),
                      const SizedBox(width: 8),
                      Text('عن التطبيق', style: Theme.of(context).textTheme.titleMedium),
                    ],
                  ),
                  const Divider(),
                  const _InfoRow(label: 'الاسم', value: 'Android AI Studio'),
                  const _InfoRow(label: 'الإصدار', value: '3.0.0'),
                  const _InfoRow(label: 'المطور', value: 'salktbi902'),
                  const _InfoRow(label: 'OpenClaw', value: 'v4.0 Master Agent'),
                  const SizedBox(height: 12),
                  FilledButton.tonal(
                    onPressed: () async {
                      final url = Uri.parse('https://github.com/salktbi902/flutter_app');
                      if (await canLaunchUrl(url)) {
                        await launchUrl(url, mode: LaunchMode.externalApplication);
                      }
                    },
                    child: const Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(Icons.code),
                        SizedBox(width: 8),
                        Text('عرض الكود المصدري'),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 16),
          // إجراءات
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      const Icon(Icons.build_circle_outlined, size: 24),
                      const SizedBox(width: 8),
                      Text('إجراءات', style: Theme.of(context).textTheme.titleMedium),
                    ],
                  ),
                  const Divider(),
                  ListTile(
                    leading: const Icon(Icons.refresh),
                    title: const Text('إعادة الاتصال بالكل'),
                    onTap: () {
                      context.read<WebSocketService>().disconnect();
                      context.read<WebSocketService>().connect();
                      context.read<OpenClawService>().loadAll();
                      _checkHealth();
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(content: Text('جاري إعادة الاتصال...')),
                      );
                    },
                  ),
                  ListTile(
                    leading: const Icon(Icons.delete_sweep),
                    title: const Text('مسح المحادثات'),
                    onTap: () {
                      context.read<AIService>().clearMessages();
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(content: Text('تم مسح المحادثات')),
                      );
                    },
                  ),
                  ListTile(
                    leading: const Icon(Icons.restart_alt, color: Color(0xFFFF6B35)),
                    title: const Text('إعادة تشغيل OpenClaw'),
                    onTap: () async {
                      await context.read<OpenClawService>().codexExec('systemctl restart openclaw');
                      if (mounted) {
                        ScaffoldMessenger.of(context).showSnackBar(
                          const SnackBar(content: Text('جاري إعادة تشغيل OpenClaw...')),
                        );
                      }
                    },
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _StatusRow extends StatelessWidget {
  final String label;
  final String value;
  final bool isConnected;

  const _StatusRow({required this.label, required this.value, required this.isConnected});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        children: [
          Icon(Icons.circle, size: 10, color: isConnected ? Colors.greenAccent : Colors.redAccent),
          const SizedBox(width: 8),
          Text(label, style: const TextStyle(fontWeight: FontWeight.bold)),
          const Spacer(),
          Text(value, style: TextStyle(color: Colors.grey[400])),
        ],
      ),
    );
  }
}

class _InfoRow extends StatelessWidget {
  final String label;
  final String value;

  const _InfoRow({required this.label, required this.value});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        children: [
          Text(label, style: const TextStyle(fontWeight: FontWeight.bold)),
          const Spacer(),
          SelectableText(value, style: TextStyle(color: Colors.grey[400])),
        ],
      ),
    );
  }
}
