import 'package:flutter/material.dart';
import 'dart:convert';
import 'package:http/http.dart' as http;

class OllamaScreen extends StatefulWidget {
  final String serverUrl;
  const OllamaScreen({super.key, required this.serverUrl});

  @override
  State<OllamaScreen> createState() => _OllamaScreenState();
}

class _OllamaScreenState extends State<OllamaScreen> with SingleTickerProviderStateMixin {
  late TabController _tabController;
  final _chatController = TextEditingController();
  final _scrollController = ScrollController();
  List<Map<String, dynamic>> _messages = [];
  List<Map<String, dynamic>> _models = [];
  Map<String, dynamic> _status = {};
  String _selectedModel = 'qwen2.5:3b';
  String _pullModelName = '';
  bool _isLoading = false;
  bool _isPulling = false;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 3, vsync: this);
    _loadStatus();
    _loadModels();
  }

  @override
  void dispose() {
    _tabController.dispose();
    _chatController.dispose();
    _scrollController.dispose();
    super.dispose();
  }

  Future<Map<String, dynamic>> _api(String endpoint, {String method = 'GET', Map<String, dynamic>? body}) async {
    try {
      final url = Uri.parse('${widget.serverUrl}/ollama/$endpoint');
      http.Response res;
      if (method == 'POST') {
        res = await http.post(url, headers: {'Content-Type': 'application/json'}, body: jsonEncode(body ?? {})).timeout(const Duration(seconds: 120));
      } else {
        res = await http.get(url).timeout(const Duration(seconds: 30));
      }
      return jsonDecode(res.body);
    } catch (e) {
      return {'error': e.toString()};
    }
  }

  Future<void> _loadStatus() async {
    final data = await _api('status');
    if (mounted) setState(() => _status = data);
  }

  Future<void> _loadModels() async {
    final data = await _api('models');
    if (mounted && data is List) {
      setState(() => _models = List<Map<String, dynamic>>.from(data));
    }
  }

  Future<void> _sendMessage() async {
    final msg = _chatController.text.trim();
    if (msg.isEmpty) return;
    _chatController.clear();
    setState(() {
      _messages.add({'role': 'user', 'content': msg});
      _isLoading = true;
    });
    _scrollToBottom();

    final data = await _api('chat', method: 'POST', body: {'message': msg, 'model': _selectedModel});
    setState(() {
      _isLoading = false;
      _messages.add({
        'role': 'assistant',
        'content': data['response'] ?? data['error'] ?? 'خطأ',
        'model': data['model'] ?? _selectedModel,
        'duration': data['duration'] ?? '',
        'tokens': data['tokens'] ?? 0,
      });
    });
    _scrollToBottom();
  }

  Future<void> _pullModel() async {
    if (_pullModelName.isEmpty) return;
    setState(() => _isPulling = true);
    final data = await _api('pull', method: 'POST', body: {'model': _pullModelName});
    setState(() => _isPulling = false);
    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(
        content: Text(data['success'] == true ? 'تم تحميل $_pullModelName بنجاح!' : 'فشل: ${data['error'] ?? 'unknown'}'),
        backgroundColor: data['success'] == true ? Colors.green : Colors.red,
      ));
      _loadModels();
    }
  }

  Future<void> _deleteModel(String name) async {
    final confirm = await showDialog<bool>(context: context, builder: (ctx) => AlertDialog(
      title: const Text('حذف النموذج'),
      content: Text('هل تريد حذف $name؟'),
      actions: [
        TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('إلغاء')),
        TextButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('حذف', style: TextStyle(color: Colors.red))),
      ],
    ));
    if (confirm == true) {
      await _api('delete', method: 'POST', body: {'model': name});
      _loadModels();
    }
  }

  Future<void> _setDefault(String name) async {
    await _api('default', method: 'POST', body: {'model': name});
    setState(() => _selectedModel = name);
    _loadStatus();
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('النموذج الافتراضي: $name'), backgroundColor: Colors.blue));
  }

  void _scrollToBottom() {
    Future.delayed(const Duration(milliseconds: 100), () {
      if (_scrollController.hasClients) {
        _scrollController.animateTo(_scrollController.position.maxScrollExtent, duration: const Duration(milliseconds: 300), curve: Curves.easeOut);
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Row(children: [Text('🦙 '), Text('Ollama AI')]),
        backgroundColor: const Color(0xFF1a1f35),
        bottom: TabBar(controller: _tabController, tabs: const [
          Tab(icon: Icon(Icons.chat), text: 'محادثة'),
          Tab(icon: Icon(Icons.layers), text: 'النماذج'),
          Tab(icon: Icon(Icons.settings), text: 'إعدادات'),
        ]),
      ),
      body: TabBarView(controller: _tabController, children: [
        _buildChatTab(),
        _buildModelsTab(),
        _buildSettingsTab(),
      ]),
    );
  }

  Widget _buildChatTab() {
    return Column(children: [
      // Model selector
      Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
        color: const Color(0xFF161b22),
        child: Row(children: [
          const Text('النموذج: ', style: TextStyle(color: Colors.white70)),
          const SizedBox(width: 8),
          Expanded(
            child: DropdownButton<String>(
              value: _selectedModel,
              dropdownColor: const Color(0xFF21262d),
              style: const TextStyle(color: Colors.white),
              isExpanded: true,
              items: [
                DropdownMenuItem(value: 'qwen2.5:3b', child: Text('qwen2.5:3b (سريع)')),
                DropdownMenuItem(value: 'qwen2.5:32b', child: Text('qwen2.5:32b (قوي)')),
                ..._models.where((m) => m['name'] != 'qwen2.5:3b' && m['name'] != 'qwen2.5:32b')
                    .map((m) => DropdownMenuItem(value: m['name'] as String, child: Text(m['name'] as String))),
              ],
              onChanged: (v) => setState(() => _selectedModel = v!),
            ),
          ),
        ]),
      ),
      // Messages
      Expanded(
        child: _messages.isEmpty
            ? Center(child: Column(mainAxisSize: MainAxisSize.min, children: [
                const Text('🦙', style: TextStyle(fontSize: 64)),
                const SizedBox(height: 16),
                Text('Ollama AI محلي', style: TextStyle(fontSize: 20, color: Colors.white70)),
                const SizedBox(height: 8),
                Text('اكتب رسالة للبدء...', style: TextStyle(color: Colors.white38)),
              ]))
            : ListView.builder(
                controller: _scrollController,
                padding: const EdgeInsets.all(16),
                itemCount: _messages.length + (_isLoading ? 1 : 0),
                itemBuilder: (ctx, i) {
                  if (i == _messages.length) {
                    return const Align(alignment: Alignment.centerRight, child: Padding(
                      padding: EdgeInsets.all(16), child: CircularProgressIndicator()));
                  }
                  final msg = _messages[i];
                  final isUser = msg['role'] == 'user';
                  return Align(
                    alignment: isUser ? Alignment.centerLeft : Alignment.centerRight,
                    child: Container(
                      margin: const EdgeInsets.only(bottom: 12),
                      padding: const EdgeInsets.all(14),
                      constraints: BoxConstraints(maxWidth: MediaQuery.of(context).size.width * 0.8),
                      decoration: BoxDecoration(
                        color: isUser ? const Color(0xFF1f6feb) : const Color(0xFF21262d),
                        borderRadius: BorderRadius.circular(16).copyWith(
                          bottomLeft: isUser ? const Radius.circular(4) : null,
                          bottomRight: !isUser ? const Radius.circular(4) : null,
                        ),
                      ),
                      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        Text(msg['content'] ?? '', style: const TextStyle(color: Colors.white, fontSize: 15, height: 1.5)),
                        if (!isUser && msg['duration'] != null) ...[
                          const SizedBox(height: 6),
                          Text('${msg['model']} | ${msg['duration']} | ${msg['tokens']} tokens',
                            style: const TextStyle(color: Colors.white38, fontSize: 11)),
                        ],
                      ]),
                    ),
                  );
                },
              ),
      ),
      // Input
      Container(
        padding: const EdgeInsets.all(12),
        color: const Color(0xFF161b22),
        child: Row(children: [
          Expanded(
            child: TextField(
              controller: _chatController,
              style: const TextStyle(color: Colors.white),
              decoration: InputDecoration(
                hintText: 'اكتب رسالتك...',
                hintStyle: const TextStyle(color: Colors.white38),
                filled: true, fillColor: const Color(0xFF0d1117),
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide.none),
              ),
              onSubmitted: (_) => _sendMessage(),
            ),
          ),
          const SizedBox(width: 8),
          IconButton(
            onPressed: _isLoading ? null : _sendMessage,
            icon: Icon(_isLoading ? Icons.hourglass_empty : Icons.send, color: const Color(0xFF58a6ff)),
          ),
        ]),
      ),
    ]);
  }

  Widget _buildModelsTab() {
    return Column(children: [
      // Pull new model
      Container(
        padding: const EdgeInsets.all(16),
        color: const Color(0xFF161b22),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          const Text('📥 تحميل نموذج جديد', style: TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.bold)),
          const SizedBox(height: 8),
          Row(children: [
            Expanded(
              child: TextField(
                style: const TextStyle(color: Colors.white),
                decoration: InputDecoration(
                  hintText: 'مثال: llama3.2:3b, codellama:7b',
                  hintStyle: const TextStyle(color: Colors.white38),
                  filled: true, fillColor: const Color(0xFF0d1117),
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(8), borderSide: BorderSide.none),
                ),
                onChanged: (v) => _pullModelName = v,
              ),
            ),
            const SizedBox(width: 8),
            ElevatedButton.icon(
              onPressed: _isPulling ? null : _pullModel,
              icon: _isPulling ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2)) : const Icon(Icons.download),
              label: Text(_isPulling ? 'جاري...' : 'تحميل'),
              style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF238636)),
            ),
          ]),
        ]),
      ),
      const Divider(color: Color(0xFF30363d)),
      // Models list
      Expanded(
        child: _models.isEmpty
            ? const Center(child: CircularProgressIndicator())
            : RefreshIndicator(
                onRefresh: _loadModels,
                child: ListView.builder(
                  padding: const EdgeInsets.all(8),
                  itemCount: _models.length,
                  itemBuilder: (ctx, i) {
                    final m = _models[i];
                    final isDefault = m['name'] == _selectedModel;
                    return Card(
                      color: const Color(0xFF161b22),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12),
                        side: BorderSide(color: isDefault ? const Color(0xFF58a6ff) : const Color(0xFF30363d)),
                      ),
                      child: ListTile(
                        leading: CircleAvatar(
                          backgroundColor: isDefault ? const Color(0xFF1f6feb) : const Color(0xFF21262d),
                          child: const Text('🦙', style: TextStyle(fontSize: 20)),
                        ),
                        title: Text(m['name'] ?? '', style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
                        subtitle: Text('${m['size']} | ${m['family']} | ${m['params']} | ${m['quantization']}',
                          style: const TextStyle(color: Colors.white54, fontSize: 12)),
                        trailing: PopupMenuButton<String>(
                          icon: const Icon(Icons.more_vert, color: Colors.white54),
                          color: const Color(0xFF21262d),
                          onSelected: (action) {
                            if (action == 'default') _setDefault(m['name']);
                            if (action == 'delete') _deleteModel(m['name']);
                          },
                          itemBuilder: (ctx) => [
                            const PopupMenuItem(value: 'default', child: Text('تعيين كافتراضي', style: TextStyle(color: Colors.white))),
                            const PopupMenuItem(value: 'delete', child: Text('حذف', style: TextStyle(color: Colors.red))),
                          ],
                        ),
                      ),
                    );
                  },
                ),
              ),
      ),
    ]);
  }

  Widget _buildSettingsTab() {
    return ListView(padding: const EdgeInsets.all(16), children: [
      // Status card
      Card(
        color: const Color(0xFF161b22),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12), side: const BorderSide(color: Color(0xFF30363d))),
        child: Padding(padding: const EdgeInsets.all(16), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          const Text('📊 حالة Ollama', style: TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold)),
          const SizedBox(height: 12),
          _statusRow('الحالة', _status['available'] == true ? '✅ نشط' : '❌ غير متاح'),
          _statusRow('المضيف', _status['host'] ?? 'N/A'),
          _statusRow('النموذج الافتراضي', _status['defaultModel'] ?? 'N/A'),
          _statusRow('الجلسات النشطة', '${_status['sessions'] ?? 0}'),
        ])),
      ),
      const SizedBox(height: 16),
      // Quick actions
      Card(
        color: const Color(0xFF161b22),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12), side: const BorderSide(color: Color(0xFF30363d))),
        child: Padding(padding: const EdgeInsets.all(16), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          const Text('⚡ إجراءات سريعة', style: TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold)),
          const SizedBox(height: 12),
          _actionButton('🔄 تحديث الحالة', () { _loadStatus(); _loadModels(); }),
          _actionButton('🗑️ مسح المحادثة', () async {
            await _api('clear', method: 'POST', body: {});
            setState(() => _messages.clear());
          }),
          _actionButton('📥 تحميل qwen2.5:32b', () async {
            setState(() => _isPulling = true);
            await _api('pull', method: 'POST', body: {'model': 'qwen2.5:32b'});
            setState(() => _isPulling = false);
            _loadModels();
          }),
          _actionButton('📥 تحميل codellama:7b', () async {
            setState(() => _isPulling = true);
            await _api('pull', method: 'POST', body: {'model': 'codellama:7b'});
            setState(() => _isPulling = false);
            _loadModels();
          }),
        ])),
      ),
      const SizedBox(height: 16),
      // Recommended models
      Card(
        color: const Color(0xFF161b22),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12), side: const BorderSide(color: Color(0xFF30363d))),
        child: Padding(padding: const EdgeInsets.all(16), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          const Text('🌟 نماذج موصى بها', style: TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold)),
          const SizedBox(height: 12),
          _modelRecommendation('qwen2.5:3b', '1.9 GB', 'سريع - للمحادثات اليومية'),
          _modelRecommendation('qwen2.5:14b', '8 GB', 'متوازن - جودة عالية'),
          _modelRecommendation('qwen2.5:32b', '18 GB', 'قوي جداً - أفضل جودة'),
          _modelRecommendation('codellama:7b', '3.8 GB', 'متخصص بالبرمجة'),
          _modelRecommendation('llama3.2:3b', '2 GB', 'Meta - متعدد الاستخدامات'),
        ])),
      ),
    ]);
  }

  Widget _statusRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
        Text(label, style: const TextStyle(color: Colors.white54)),
        Text(value, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
      ]),
    );
  }

  Widget _actionButton(String label, VoidCallback onPressed) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: SizedBox(
        width: double.infinity,
        child: OutlinedButton(
          onPressed: onPressed,
          style: OutlinedButton.styleFrom(
            foregroundColor: Colors.white,
            side: const BorderSide(color: Color(0xFF30363d)),
            padding: const EdgeInsets.symmetric(vertical: 12),
          ),
          child: Text(label),
        ),
      ),
    );
  }

  Widget _modelRecommendation(String name, String size, String desc) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: ListTile(
        dense: true,
        contentPadding: EdgeInsets.zero,
        leading: const Text('🦙', style: TextStyle(fontSize: 20)),
        title: Text(name, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
        subtitle: Text('$size - $desc', style: const TextStyle(color: Colors.white54, fontSize: 12)),
        trailing: IconButton(
          icon: const Icon(Icons.download, color: Color(0xFF58a6ff), size: 20),
          onPressed: () async {
            setState(() => _isPulling = true);
            final data = await _api('pull', method: 'POST', body: {'model': name});
            setState(() => _isPulling = false);
            _loadModels();
            if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(
              content: Text(data['success'] == true ? 'تم تحميل $name!' : 'فشل التحميل'),
            ));
          },
        ),
      ),
    );
  }
}
