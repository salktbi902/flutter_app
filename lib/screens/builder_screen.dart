import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import '../services/ai_service.dart';

class BuilderScreen extends StatefulWidget {
  const BuilderScreen({super.key});

  @override
  State<BuilderScreen> createState() => _BuilderScreenState();
}

class _BuilderScreenState extends State<BuilderScreen> {
  final TextEditingController _descriptionController = TextEditingController();
  String _generatedCode = '';
  bool _isGenerating = false;
  String _selectedPlatform = 'flutter';

  void _generateUI() async {
    final desc = _descriptionController.text.trim();
    if (desc.isEmpty) return;

    setState(() {
      _isGenerating = true;
      _generatedCode = '';
    });

    final code = await context.read<AIService>().generateUI(
      desc,
      platform: _selectedPlatform,
    );

    setState(() {
      _generatedCode = code;
      _isGenerating = false;
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Row(
          children: [
            Icon(Icons.build, size: 28),
            SizedBox(width: 8),
            Text('No-Code Builder'),
          ],
        ),
      ),
      body: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // اختيار المنصة
            SegmentedButton<String>(
              segments: const [
                ButtonSegment(value: 'flutter', label: Text('Flutter')),
                ButtonSegment(value: 'react_native', label: Text('React Native')),
                ButtonSegment(value: 'html', label: Text('HTML/CSS')),
              ],
              selected: {_selectedPlatform},
              onSelectionChanged: (value) {
                setState(() => _selectedPlatform = value.first);
              },
            ),
            const SizedBox(height: 16),
            // وصف التطبيق
            TextField(
              controller: _descriptionController,
              decoration: InputDecoration(
                hintText: 'صف التطبيق الذي تريد بناءه...\nمثال: شاشة تسجيل دخول بإيميل وكلمة مرور',
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                ),
                filled: true,
                fillColor: Theme.of(context).colorScheme.surfaceVariant,
              ),
              textDirection: TextDirection.rtl,
              maxLines: 4,
            ),
            const SizedBox(height: 12),
            // زر التوليد
            FilledButton.icon(
              onPressed: _isGenerating ? null : _generateUI,
              icon: _isGenerating
                  ? const SizedBox(
                      width: 20,
                      height: 20,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : const Icon(Icons.auto_awesome),
              label: Text(_isGenerating ? 'جاري التوليد...' : 'توليد الكود'),
            ),
            const SizedBox(height: 16),
            // الكود المُولّد
            if (_generatedCode.isNotEmpty) ...[
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    'الكود المُولّد:',
                    style: Theme.of(context).textTheme.titleMedium,
                  ),
                  IconButton(
                    icon: const Icon(Icons.copy),
                    onPressed: () {
                      Clipboard.setData(ClipboardData(text: _generatedCode));
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(content: Text('تم نسخ الكود!')),
                      );
                    },
                  ),
                ],
              ),
              Expanded(
                child: Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: const Color(0xFF1E1E1E),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: SingleChildScrollView(
                    child: SelectableText(
                      _generatedCode,
                      style: const TextStyle(
                        fontFamily: 'monospace',
                        fontSize: 13,
                        color: Colors.greenAccent,
                      ),
                    ),
                  ),
                ),
              ),
            ] else
              Expanded(
                child: Center(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(
                        Icons.code,
                        size: 64,
                        color: Theme.of(context).colorScheme.primary.withOpacity(0.5),
                      ),
                      const SizedBox(height: 16),
                      Text(
                        'صف تطبيقك وسأكتب الكود لك!',
                        style: Theme.of(context).textTheme.titleMedium,
                      ),
                    ],
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }

  @override
  void dispose() {
    _descriptionController.dispose();
    super.dispose();
  }
}
