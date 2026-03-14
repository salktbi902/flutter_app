import 'package:flutter/material.dart';
import 'dart:convert';
import 'package:http/http.dart' as http;
import 'dart:async';

class DashboardScreen extends StatefulWidget {
  final String serverUrl;
  const DashboardScreen({super.key, required this.serverUrl});

  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen> {
  Map<String, dynamic> _health = {};
  List<dynamic> _agents = [];
  Map<String, dynamic> _ollamaStatus = {};
  Map<String, dynamic> _security = {};
  Map<String, dynamic> _memory = {};
  bool _loading = true;
  String _error = '';
  Timer? _refreshTimer;

  @override
  void initState() {
    super.initState();
    _loadAll();
    _refreshTimer = Timer.periodic(const Duration(seconds: 30), (_) => _loadAll());
  }

  @override
  void dispose() {
    _refreshTimer?.cancel();
    super.dispose();
  }

  Future<void> _loadAll() async {
    try {
      final results = await Future.wait([
        _fetch('/health'),
        _fetch('/agents'),
        _fetch('/ollama/status'),
        _fetch('/security/status'),
        _fetch('/memory'),
      ]);
      if (mounted) {
        setState(() {
          _health = results[0] is Map ? results[0] as Map<String, dynamic> : {};
          _agents = results[1] is List ? results[1] as List : [];
          _ollamaStatus = results[2] is Map ? results[2] as Map<String, dynamic> : {};
          _security = results[3] is Map ? results[3] as Map<String, dynamic> : {};
          _memory = results[4] is Map ? results[4] as Map<String, dynamic> : {};
          _loading = false;
          _error = '';
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _loading = false;
          _error = e.toString();
        });
      }
    }
  }

  Future<dynamic> _fetch(String path) async {
    try {
      final res = await http.get(
        Uri.parse('${widget.serverUrl}$path'),
      ).timeout(const Duration(seconds: 10));
      if (res.statusCode == 200) {
        return json.decode(res.body);
      }
    } catch (_) {}
    return {};
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Row(
          children: [
            Icon(Icons.dashboard, size: 28),
            SizedBox(width: 8),
            Text('لوحة التحكم', style: TextStyle(fontWeight: FontWeight.bold)),
          ],
        ),
        actions: [
          IconButton(
            icon: _loading
                ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2))
                : const Icon(Icons.refresh),
            onPressed: _loadAll,
          ),
        ],
      ),
      body: _error.isNotEmpty && _health.isEmpty
          ? Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  const Icon(Icons.cloud_off, size: 64, color: Colors.red),
                  const SizedBox(height: 16),
                  const Text('لا يمكن الاتصال بالسيرفر', style: TextStyle(fontSize: 18)),
                  const SizedBox(height: 8),
                  Text(widget.serverUrl, style: const TextStyle(color: Colors.grey)),
                  const SizedBox(height: 16),
                  ElevatedButton.icon(
                    onPressed: _loadAll,
                    icon: const Icon(Icons.refresh),
                    label: const Text('إعادة المحاولة'),
                  ),
                ],
              ),
            )
          : RefreshIndicator(
              onRefresh: _loadAll,
              child: ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  // Server Status Card
                  _buildStatusCard(),
                  const SizedBox(height: 16),

                  // Quick Stats
                  _buildQuickStats(),
                  const SizedBox(height: 16),

                  // Agents Card
                  _buildAgentsCard(),
                  const SizedBox(height: 16),

                  // Ollama Card
                  _buildOllamaCard(),
                  const SizedBox(height: 16),

                  // Security Card
                  _buildSecurityCard(),
                  const SizedBox(height: 16),

                  // Memory Card
                  _buildMemoryCard(),
                ],
              ),
            ),
    );
  }

  Widget _buildStatusCard() {
    final status = _health['status'] ?? 'unknown';
    final version = _health['version'] ?? '---';
    final uptime = _health['uptime'] ?? '---';
    final isHealthy = status == 'healthy';

    return Card(
      color: isHealthy ? Colors.green.withOpacity(0.15) : Colors.red.withOpacity(0.15),
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: isHealthy ? Colors.green : Colors.red,
                borderRadius: BorderRadius.circular(12),
              ),
              child: Icon(
                isHealthy ? Icons.check_circle : Icons.error,
                color: Colors.white,
                size: 32,
              ),
            ),
            const SizedBox(width: 16),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'OpenClaw v$version',
                    style: const TextStyle(fontSize: 20, fontWeight: FontWeight.bold),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    isHealthy ? 'يعمل بشكل طبيعي' : 'يوجد مشكلة',
                    style: TextStyle(color: isHealthy ? Colors.green : Colors.red),
                  ),
                  Text('وقت التشغيل: $uptime', style: const TextStyle(color: Colors.grey)),
                ],
              ),
            ),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
              decoration: BoxDecoration(
                color: isHealthy ? Colors.green : Colors.red,
                borderRadius: BorderRadius.circular(20),
              ),
              child: Text(
                isHealthy ? 'متصل' : 'غير متصل',
                style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildQuickStats() {
    return Row(
      children: [
        _buildStatTile('الوكلاء', '${_agents.length}', Icons.smart_toy, Colors.blue),
        const SizedBox(width: 8),
        _buildStatTile('Ollama', _ollamaStatus['status'] == 'active' ? 'نشط' : 'متوقف',
            Icons.memory, Colors.purple),
        const SizedBox(width: 8),
        _buildStatTile('الذكريات', '${(_memory['memories'] as List?)?.length ?? 0}',
            Icons.psychology, Colors.orange),
        const SizedBox(width: 8),
        _buildStatTile('الحماية', 'نشطة', Icons.shield, Colors.green),
      ],
    );
  }

  Widget _buildStatTile(String label, String value, IconData icon, Color color) {
    return Expanded(
      child: Card(
        child: Padding(
          padding: const EdgeInsets.all(12),
          child: Column(
            children: [
              Icon(icon, color: color, size: 24),
              const SizedBox(height: 4),
              Text(value, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
              Text(label, style: const TextStyle(fontSize: 11, color: Colors.grey)),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildAgentsCard() {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Row(
              children: [
                Icon(Icons.smart_toy, color: Colors.blue),
                SizedBox(width: 8),
                Text('الوكلاء', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
              ],
            ),
            const Divider(),
            ..._agents.map((agent) => ListTile(
                  leading: CircleAvatar(
                    backgroundColor: Colors.blue.withOpacity(0.2),
                    child: const Icon(Icons.smart_toy, color: Colors.blue, size: 20),
                  ),
                  title: Text(agent['name'] ?? ''),
                  subtitle: Text(agent['role'] ?? '', maxLines: 1, overflow: TextOverflow.ellipsis),
                  trailing: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                    decoration: BoxDecoration(
                      color: Colors.green.withOpacity(0.2),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Text(agent['model'] ?? '', style: const TextStyle(fontSize: 12, color: Colors.green)),
                  ),
                )),
          ],
        ),
      ),
    );
  }

  Widget _buildOllamaCard() {
    final model = _ollamaStatus['defaultModel'] ?? '---';
    final status = _ollamaStatus['status'] ?? 'unknown';
    final isActive = status == 'active';

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                const Icon(Icons.memory, color: Colors.purple),
                const SizedBox(width: 8),
                const Text('Ollama AI', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
                const Spacer(),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  decoration: BoxDecoration(
                    color: isActive ? Colors.green.withOpacity(0.2) : Colors.red.withOpacity(0.2),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Text(
                    isActive ? 'نشط' : 'متوقف',
                    style: TextStyle(color: isActive ? Colors.green : Colors.red, fontWeight: FontWeight.bold),
                  ),
                ),
              ],
            ),
            const Divider(),
            ListTile(
              leading: const Icon(Icons.model_training, color: Colors.purple),
              title: const Text('النموذج الافتراضي'),
              subtitle: Text(model, style: const TextStyle(fontWeight: FontWeight.bold)),
            ),
            ListTile(
              leading: const Icon(Icons.dns, color: Colors.purple),
              title: const Text('المضيف'),
              subtitle: Text(_ollamaStatus['host'] ?? '---'),
            ),
            ListTile(
              leading: const Icon(Icons.chat, color: Colors.purple),
              title: const Text('الجلسات النشطة'),
              subtitle: Text('${_ollamaStatus['sessions'] ?? 0}'),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildSecurityCard() {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Row(
              children: [
                Icon(Icons.shield, color: Colors.green),
                SizedBox(width: 8),
                Text('الحماية', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
              ],
            ),
            const Divider(),
            ListTile(
              leading: const Icon(Icons.lock, color: Colors.green),
              title: const Text('التشفير'),
              subtitle: const Text('AES-256-GCM'),
              trailing: const Icon(Icons.check_circle, color: Colors.green),
            ),
            ListTile(
              leading: const Icon(Icons.block, color: Colors.red),
              title: const Text('IPs محظورة'),
              subtitle: Text('${(_security['blockedIPs'] as List?)?.length ?? 0} عنوان'),
            ),
            ListTile(
              leading: const Icon(Icons.monitor_heart, color: Colors.orange),
              title: const Text('المراقبة'),
              subtitle: const Text('نشطة 24/7'),
              trailing: const Icon(Icons.check_circle, color: Colors.green),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildMemoryCard() {
    final memories = (_memory['memories'] as List?) ?? [];

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                const Icon(Icons.psychology, color: Colors.orange),
                const SizedBox(width: 8),
                const Text('الذاكرة', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
                const Spacer(),
                Text('${memories.length} ذكرى', style: const TextStyle(color: Colors.grey)),
              ],
            ),
            const Divider(),
            if (memories.isEmpty)
              const Padding(
                padding: EdgeInsets.all(16),
                child: Center(child: Text('لا توجد ذكريات بعد', style: TextStyle(color: Colors.grey))),
              )
            else
              ...memories.take(5).map((m) => ListTile(
                    leading: const Icon(Icons.bookmark, color: Colors.orange, size: 20),
                    title: Text(m['key'] ?? '', maxLines: 1, overflow: TextOverflow.ellipsis),
                    subtitle: Text(m['value'] ?? '', maxLines: 2, overflow: TextOverflow.ellipsis),
                  )),
          ],
        ),
      ),
    );
  }
}
