import 'package:flutter_test/flutter_test.dart';
import 'package:android_ai_studio/main.dart';

void main() {
  testWidgets('App loads correctly', (WidgetTester tester) async {
    await tester.pumpWidget(const AndroidAIStudio());
    expect(find.text('AI Studio Chat'), findsOneWidget);
  });
}
