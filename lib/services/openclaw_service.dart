import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;

class OpenClawService extends ChangeNotifier {
  static const String _baseUrl = 'http://76.13.213.128:3100';

  bool _isConnected = false;
  Map<String, dynamic>? _healthData;
  Map<String, dynamic>? _statusData;
  List<dynamic> _agents = [];
  List<dynamic> _templates = [];
  Map<String, dynamic>? _memoryStatus;
  Map<String, dynamic>? _gamification;
  Map<String, dynamic>? _securityStatus;
  Map<String, dynamic>? _browserStatus;
  bool _isLoading = false;

  // Getters
  bool get isConnected => _isConnected;
  Map<String, dynamic>? get healthData => _healthData;
  Map<String, dynamic>? get statusData => _statusData;
  List<dynamic> get agents => _agents;
  List<dynamic> get templates => _templates;
  Map<String, dynamic>? get memoryStatus => _memoryStatus;
  Map<String, dynamic>? get gamification => _gamification;
  Map<String, dynamic>? get securityStatus => _securityStatus;
  Map<String, dynamic>? get browserStatus => _browserStatus;
  bool get isLoading => _isLoading;
  String get baseUrl => _baseUrl;

  /// فحص صحة النظام
  Future<bool> checkHealth() async {
    try {
      final response = await http.get(
        Uri.parse('$_baseUrl/health'),
      ).timeout(const Duration(seconds: 10));
      if (response.statusCode == 200) {
        _healthData = json.decode(response.body);
        _isConnected = true;
        notifyListeners();
        return true;
      }
    } catch (e) {
      _isConnected = false;
      notifyListeners();
      debugPrint('خطأ Health: $e');
    }
    return false;
  }

  /// جلب حالة النظام الكاملة
  Future<void> fetchStatus() async {
    try {
      final response = await http.get(
        Uri.parse('$_baseUrl/status'),
      ).timeout(const Duration(seconds: 10));
      if (response.statusCode == 200) {
        _statusData = json.decode(response.body);
        notifyListeners();
      }
    } catch (e) {
      debugPrint('خطأ Status: $e');
    }
  }

  /// جلب قائمة الوكلاء
  Future<void> fetchAgents() async {
    try {
      final response = await http.get(
        Uri.parse('$_baseUrl/agents'),
      ).timeout(const Duration(seconds: 10));
      if (response.statusCode == 200) {
        _agents = json.decode(response.body);
        notifyListeners();
      }
    } catch (e) {
      debugPrint('خطأ Agents: $e');
    }
  }

  /// جلب القوالب
  Future<void> fetchTemplates() async {
    try {
      final response = await http.get(
        Uri.parse('$_baseUrl/templates'),
      ).timeout(const Duration(seconds: 10));
      if (response.statusCode == 200) {
        _templates = json.decode(response.body);
        notifyListeners();
      }
    } catch (e) {
      debugPrint('خطأ Templates: $e');
    }
  }

  /// جلب حالة الذاكرة
  Future<void> fetchMemoryStatus() async {
    try {
      final response = await http.get(
        Uri.parse('$_baseUrl/memory/status'),
      ).timeout(const Duration(seconds: 10));
      if (response.statusCode == 200) {
        _memoryStatus = json.decode(response.body);
        notifyListeners();
      }
    } catch (e) {
      debugPrint('خطأ Memory: $e');
    }
  }

  /// حفظ في الذاكرة
  Future<bool> saveMemory(String key, dynamic value) async {
    try {
      final response = await http.post(
        Uri.parse('$_baseUrl/memory/save'),
        headers: {'Content-Type': 'application/json'},
        body: json.encode({'key': key, 'value': value}),
      ).timeout(const Duration(seconds: 10));
      return response.statusCode == 200;
    } catch (e) {
      debugPrint('خطأ حفظ الذاكرة: $e');
      return false;
    }
  }

  /// استرجاع من الذاكرة
  Future<dynamic> recallMemory(String key) async {
    try {
      final response = await http.post(
        Uri.parse('$_baseUrl/memory/recall'),
        headers: {'Content-Type': 'application/json'},
        body: json.encode({'key': key}),
      ).timeout(const Duration(seconds: 10));
      if (response.statusCode == 200) {
        return json.decode(response.body);
      }
    } catch (e) {
      debugPrint('خطأ استرجاع الذاكرة: $e');
    }
    return null;
  }

  /// جلب Gamification
  Future<void> fetchGamification() async {
    try {
      final response = await http.get(
        Uri.parse('$_baseUrl/gamification'),
      ).timeout(const Duration(seconds: 10));
      if (response.statusCode == 200) {
        _gamification = json.decode(response.body);
        notifyListeners();
      }
    } catch (e) {
      debugPrint('خطأ Gamification: $e');
    }
  }

  /// جلب حالة الحماية
  Future<void> fetchSecurityStatus() async {
    try {
      final response = await http.get(
        Uri.parse('$_baseUrl/security/status'),
      ).timeout(const Duration(seconds: 10));
      if (response.statusCode == 200) {
        _securityStatus = json.decode(response.body);
        notifyListeners();
      }
    } catch (e) {
      debugPrint('خطأ Security: $e');
    }
  }

  /// جلب حالة المتصفح
  Future<void> fetchBrowserStatus() async {
    try {
      final response = await http.get(
        Uri.parse('$_baseUrl/browser/status'),
      ).timeout(const Duration(seconds: 10));
      if (response.statusCode == 200) {
        _browserStatus = json.decode(response.body);
        notifyListeners();
      }
    } catch (e) {
      debugPrint('خطأ Browser: $e');
    }
  }

  /// فتح صفحة في المتصفح
  Future<Map<String, dynamic>?> browserOpen(String url) async {
    try {
      final response = await http.post(
        Uri.parse('$_baseUrl/browser/open'),
        headers: {'Content-Type': 'application/json'},
        body: json.encode({'url': url}),
      ).timeout(const Duration(seconds: 30));
      if (response.statusCode == 200) {
        return json.decode(response.body);
      }
    } catch (e) {
      debugPrint('خطأ فتح المتصفح: $e');
    }
    return null;
  }

  /// لقطة شاشة
  Future<Map<String, dynamic>?> browserScreenshot(String url) async {
    try {
      final response = await http.post(
        Uri.parse('$_baseUrl/browser/screenshot'),
        headers: {'Content-Type': 'application/json'},
        body: json.encode({'url': url}),
      ).timeout(const Duration(seconds: 30));
      if (response.statusCode == 200) {
        return json.decode(response.body);
      }
    } catch (e) {
      debugPrint('خطأ لقطة الشاشة: $e');
    }
    return null;
  }

  /// تنفيذ أمر Codex
  Future<Map<String, dynamic>?> codexExec(String command) async {
    try {
      final response = await http.post(
        Uri.parse('$_baseUrl/codex/exec'),
        headers: {'Content-Type': 'application/json'},
        body: json.encode({'command': command}),
      ).timeout(const Duration(seconds: 30));
      if (response.statusCode == 200) {
        return json.decode(response.body);
      }
    } catch (e) {
      debugPrint('خطأ Codex: $e');
    }
    return null;
  }

  /// محادثة مع AI
  Future<Map<String, dynamic>?> chat(String message, {String? agent}) async {
    _isLoading = true;
    notifyListeners();
    try {
      final body = <String, dynamic>{'message': message};
      if (agent != null) body['agent'] = agent;
      final response = await http.post(
        Uri.parse('$_baseUrl/chat'),
        headers: {'Content-Type': 'application/json'},
        body: json.encode(body),
      ).timeout(const Duration(seconds: 30));
      _isLoading = false;
      notifyListeners();
      if (response.statusCode == 200) {
        return json.decode(response.body);
      }
    } catch (e) {
      _isLoading = false;
      notifyListeners();
      debugPrint('خطأ Chat: $e');
    }
    return null;
  }

  /// إنشاء مهمة
  Future<Map<String, dynamic>?> createTask(String description, {String? agent}) async {
    try {
      final body = <String, dynamic>{'description': description};
      if (agent != null) body['agent'] = agent;
      final response = await http.post(
        Uri.parse('$_baseUrl/task'),
        headers: {'Content-Type': 'application/json'},
        body: json.encode(body),
      ).timeout(const Duration(seconds: 15));
      if (response.statusCode == 200) {
        return json.decode(response.body);
      }
    } catch (e) {
      debugPrint('خطأ Task: $e');
    }
    return null;
  }

  /// تطوير ذاتي
  Future<Map<String, dynamic>?> selfDev(String instruction) async {
    try {
      final response = await http.post(
        Uri.parse('$_baseUrl/self-dev'),
        headers: {'Content-Type': 'application/json'},
        body: json.encode({'instruction': instruction}),
      ).timeout(const Duration(seconds: 30));
      if (response.statusCode == 200) {
        return json.decode(response.body);
      }
    } catch (e) {
      debugPrint('خطأ Self-Dev: $e');
    }
    return null;
  }

  /// جلب سكريبت Termux
  Future<Map<String, dynamic>?> getTermuxScript(String type) async {
    try {
      final response = await http.get(
        Uri.parse('$_baseUrl/termux/script/$type'),
      ).timeout(const Duration(seconds: 10));
      if (response.statusCode == 200) {
        return json.decode(response.body);
      }
    } catch (e) {
      debugPrint('خطأ Termux Script: $e');
    }
    return null;
  }

  /// تحميل كل البيانات
  Future<void> loadAll() async {
    _isLoading = true;
    notifyListeners();
    await Future.wait([
      checkHealth(),
      fetchStatus(),
      fetchAgents(),
      fetchTemplates(),
      fetchMemoryStatus(),
      fetchGamification(),
      fetchSecurityStatus(),
      fetchBrowserStatus(),
    ]);
    _isLoading = false;
    notifyListeners();
  }
}
