import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../services/ai_service.dart';
import '../services/websocket_service.dart';

class TerminalScreen extends StatefulWidget {
  const TerminalScreen({super.key});

  @override
  State<TerminalScreen> createState() => _TerminalScreenState();
}

class _TerminalScreenState extends State<TerminalScreen> {
  final TextEditingController _commandController = TextEditingController();
  final ScrollController _scrollController = ScrollController();
  final List<Map<String, String>> _history = [];

  void _executeCommand() async {
    final cmd = _commandController.text.trim();
    if (cmd.isEmpty) return;

    setState(() {
      _history.add({'type': 'command', 'text': '\$ $cmd'});
    });
    _commandController.clear();

    // محاولة الإرسال عبر WebSocket أولاً
    final ws = context.read<WebSocketService>();
    if (ws.isConnected) {
      ws.sendTerminalCommand(cmd);
    }

    // إرسال عبر HTTP كاحتياط
    final result = await context.read<AIService>().executeCommand(cmd);
    
    setState(() {
      _history.add({'type': 'output', 'text': result});
    });

    _scrollToBottom();
  }

  void _scrollToBottom() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (_scrollController.hasClients) {
        _scrollController.animateTo(
          _scrollController.position.maxScrollExtent,
          duration: const Duration(milliseconds: 300),
          curve: Curves.easeOut,
        );
      }
    });
  }

  @override
  void initState() {
    super.initState();
    _history.add({
      'type': 'output',
      'text': '🤖 Android AI Studio Terminal v2.0\n'
          '📡 متصل بـ 76.13.213.128:3000\n'
          '💡 اكتب أمراً للتنفيذ أو "help" للمساعدة\n'
          '─────────────────────────────────',
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Row(
          children: [
            Icon(Icons.terminal, size: 28),
            SizedBox(width: 8),
            Text('Terminal'),
          ],
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.delete_outline),
            onPressed: () {
              setState(() => _history.clear());
            },
          ),
        ],
      ),
      body: Column(
        children: [
          // سجل الأوامر
          Expanded(
            child: Container(
              color: const Color(0xFF0D1117),
              child: ListView.builder(
                controller: _scrollController,
                padding: const EdgeInsets.all(12),
                itemCount: _history.length,
                itemBuilder: (context, index) {
                  final item = _history[index];
                  final isCommand = item['type'] == 'command';
                  
                  return Padding(
                    padding: const EdgeInsets.symmetric(vertical: 2),
                    child: SelectableText(
                      item['text'] ?? '',
                      style: TextStyle(
                        fontFamily: 'monospace',
                        fontSize: 14,
                        color: isCommand ? Colors.greenAccent : Colors.white70,
                        fontWeight: isCommand ? FontWeight.bold : FontWeight.normal,
                      ),
                    ),
                  );
                },
              ),
            ),
          ),
          // حقل الأوامر
          Container(
            color: const Color(0xFF161B22),
            padding: const EdgeInsets.all(8),
            child: Row(
              children: [
                const Text(
                  '\$ ',
                  style: TextStyle(
                    fontFamily: 'monospace',
                    fontSize: 16,
                    color: Colors.greenAccent,
                    fontWeight: FontWeight.bold,
                  ),
                ),
                Expanded(
                  child: TextField(
                    controller: _commandController,
                    style: const TextStyle(
                      fontFamily: 'monospace',
                      fontSize: 14,
                      color: Colors.white,
                    ),
                    decoration: const InputDecoration(
                      hintText: 'اكتب أمراً...',
                      hintStyle: TextStyle(color: Colors.grey),
                      border: InputBorder.none,
                    ),
                    onSubmitted: (_) => _executeCommand(),
                  ),
                ),
                IconButton(
                  icon: const Icon(Icons.play_arrow, color: Colors.greenAccent),
                  onPressed: _executeCommand,
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  @override
  void dispose() {
    _commandController.dispose();
    _scrollController.dispose();
    super.dispose();
  }
}
