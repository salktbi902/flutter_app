import 'dart:convert';
import 'dart:async';
import 'package:flutter/foundation.dart';
import 'package:web_socket_channel/web_socket_channel.dart';

class WebSocketService extends ChangeNotifier {
  static const String _wsUrl = 'ws://76.13.213.128:3000/ws/chat';
  static const String _terminalWsUrl = 'ws://76.13.213.128:3000/ws/terminal';
  
  WebSocketChannel? _chatChannel;
  WebSocketChannel? _terminalChannel;
  
  bool _isConnected = false;
  String _lastMessage = '';
  String _lastTerminalOutput = '';
  
  final StreamController<String> _chatStreamController = StreamController<String>.broadcast();
  final StreamController<String> _terminalStreamController = StreamController<String>.broadcast();

  bool get isConnected => _isConnected;
  String get lastMessage => _lastMessage;
  String get lastTerminalOutput => _lastTerminalOutput;
  Stream<String> get chatStream => _chatStreamController.stream;
  Stream<String> get terminalStream => _terminalStreamController.stream;

  /// الاتصال بالسيرفر عبر WebSocket
  void connect() {
    _connectChat();
    _connectTerminal();
  }

  void _connectChat() {
    try {
      _chatChannel = WebSocketChannel.connect(Uri.parse(_wsUrl));
      _chatChannel!.stream.listen(
        (data) {
          _lastMessage = data.toString();
          _chatStreamController.add(_lastMessage);
          _isConnected = true;
          notifyListeners();
        },
        onError: (error) {
          debugPrint('خطأ WebSocket Chat: $error');
          _isConnected = false;
          notifyListeners();
          // إعادة الاتصال بعد 5 ثوانٍ
          Future.delayed(const Duration(seconds: 5), _connectChat);
        },
        onDone: () {
          _isConnected = false;
          notifyListeners();
          Future.delayed(const Duration(seconds: 5), _connectChat);
        },
      );
      _isConnected = true;
      notifyListeners();
    } catch (e) {
      debugPrint('فشل الاتصال بـ WebSocket Chat: $e');
      _isConnected = false;
      notifyListeners();
    }
  }

  void _connectTerminal() {
    try {
      _terminalChannel = WebSocketChannel.connect(Uri.parse(_terminalWsUrl));
      _terminalChannel!.stream.listen(
        (data) {
          _lastTerminalOutput = data.toString();
          _terminalStreamController.add(_lastTerminalOutput);
          notifyListeners();
        },
        onError: (error) {
          debugPrint('خطأ WebSocket Terminal: $error');
          Future.delayed(const Duration(seconds: 5), _connectTerminal);
        },
        onDone: () {
          Future.delayed(const Duration(seconds: 5), _connectTerminal);
        },
      );
    } catch (e) {
      debugPrint('فشل الاتصال بـ WebSocket Terminal: $e');
    }
  }

  /// إرسال رسالة عبر WebSocket
  void sendChatMessage(String message) {
    if (_chatChannel != null) {
      _chatChannel!.sink.add(json.encode({
        'type': 'chat',
        'message': message,
      }));
    }
  }

  /// إرسال أمر للتيرمنال
  void sendTerminalCommand(String command) {
    if (_terminalChannel != null) {
      _terminalChannel!.sink.add(json.encode({
        'type': 'command',
        'command': command,
      }));
    }
  }

  /// قطع الاتصال
  void disconnect() {
    _chatChannel?.sink.close();
    _terminalChannel?.sink.close();
    _isConnected = false;
    notifyListeners();
  }

  @override
  void dispose() {
    disconnect();
    _chatStreamController.close();
    _terminalStreamController.close();
    super.dispose();
  }
}
