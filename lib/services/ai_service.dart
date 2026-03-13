import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;

class AIService extends ChangeNotifier {
  static const String _baseUrl = 'http://76.13.213.128:3000';
  
  List<Map<String, String>> _messages = [];
  bool _isLoading = false;
  String _sessionId = 'default';
  bool _isConnected = false;

  List<Map<String, String>> get messages => _messages;
  bool get isLoading => _isLoading;
  bool get isConnected => _isConnected;

  /// فحص حالة السيرفر
  Future<Map<String, dynamic>?> checkHealth() async {
    try {
      final response = await http.get(
        Uri.parse('$_baseUrl/health'),
      ).timeout(const Duration(seconds: 10));
      
      if (response.statusCode == 200) {
        _isConnected = true;
        notifyListeners();
        return json.decode(response.body);
      }
    } catch (e) {
      _isConnected = false;
      notifyListeners();
      debugPrint('خطأ في فحص السيرفر: $e');
    }
    return null;
  }

  /// إرسال رسالة للـ AI
  Future<String> sendMessage(String message) async {
    _isLoading = true;
    _messages.add({'role': 'user', 'content': message});
    notifyListeners();

    try {
      final response = await http.post(
        Uri.parse('$_baseUrl/api/v1/ai/chat'),
        headers: {'Content-Type': 'application/json'},
        body: json.encode({
          'message': message,
          'sessionId': _sessionId,
        }),
      ).timeout(const Duration(seconds: 30));

      if (response.statusCode == 200) {
        final data = json.decode(response.body);
        final reply = data['response'] ?? data['message'] ?? 'لا توجد استجابة';
        _messages.add({'role': 'assistant', 'content': reply});
        _isLoading = false;
        notifyListeners();
        return reply;
      } else {
        throw Exception('خطأ في الاستجابة: ${response.statusCode}');
      }
    } catch (e) {
      final errorMsg = 'خطأ في الاتصال: $e';
      _messages.add({'role': 'assistant', 'content': errorMsg});
      _isLoading = false;
      notifyListeners();
      return errorMsg;
    }
  }

  /// توليد واجهة مستخدم
  Future<String> generateUI(String description, {String platform = 'flutter'}) async {
    try {
      final response = await http.post(
        Uri.parse('$_baseUrl/api/v1/ai/generate-ui'),
        headers: {'Content-Type': 'application/json'},
        body: json.encode({
          'description': description,
          'platform': platform,
        }),
      ).timeout(const Duration(seconds: 30));

      if (response.statusCode == 200) {
        final data = json.decode(response.body);
        return data['code'] ?? data['result'] ?? '';
      }
    } catch (e) {
      debugPrint('خطأ في توليد UI: $e');
    }
    return '';
  }

  /// تنفيذ أمر
  Future<String> executeCommand(String command) async {
    try {
      final response = await http.post(
        Uri.parse('$_baseUrl/api/v1/ai/execute'),
        headers: {'Content-Type': 'application/json'},
        body: json.encode({'command': command}),
      ).timeout(const Duration(seconds: 30));

      if (response.statusCode == 200) {
        final data = json.decode(response.body);
        return data['output'] ?? data['result'] ?? '';
      }
    } catch (e) {
      return 'خطأ: $e';
    }
    return 'خطأ غير معروف';
  }

  /// البحث في الذاكرة
  Future<List<dynamic>> searchMemory(String query, {int limit = 5}) async {
    try {
      final response = await http.post(
        Uri.parse('$_baseUrl/api/v1/ai/memory/search'),
        headers: {'Content-Type': 'application/json'},
        body: json.encode({
          'query': query,
          'limit': limit,
        }),
      ).timeout(const Duration(seconds: 15));

      if (response.statusCode == 200) {
        final data = json.decode(response.body);
        return data['results'] ?? [];
      }
    } catch (e) {
      debugPrint('خطأ في البحث: $e');
    }
    return [];
  }

  /// مسح المحادثة
  void clearMessages() {
    _messages.clear();
    notifyListeners();
  }

  /// تعيين معرف الجلسة
  void setSessionId(String id) {
    _sessionId = id;
    notifyListeners();
  }
}
