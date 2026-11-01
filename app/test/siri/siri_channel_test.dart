import 'package:family_groceries/siri/siri_channel.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  const channel = MethodChannel('hummlist/siri');
  late List<MethodCall> calls;
  Object? readAnswer;

  setUp(() {
    calls = [];
    readAnswer = null;
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(channel, (call) async {
          calls.add(call);
          return call.method == 'read' ? readAnswer : null;
        });
  });

  tearDown(
    () => TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(channel, null),
  );

  test('store hands over the map the Swift side keeps', () async {
    await const MethodSiriChannel().store(
      token: 'fgp_x',
      entry: const SiriKeychainEntry(id: 'i', userId: 'u', sessionId: 's'),
      voiceUrl: 'https://x/functions/v1/voice',
    );
    expect(calls.single.method, 'store');
    expect(calls.single.arguments, {
      'token': 'fgp_x',
      'id': 'i',
      'userId': 'u',
      'sessionId': 's',
      'url': 'https://x/functions/v1/voice',
    });
  });

  test('read answers the entry without a token, or null', () async {
    readAnswer = {'id': 'i', 'userId': 'u', 'sessionId': 's'};
    expect(
      await const MethodSiriChannel().read(),
      const SiriKeychainEntry(id: 'i', userId: 'u', sessionId: 's'),
    );
    readAnswer = null;
    expect(await const MethodSiriChannel().read(), isNull);
  });

  test('suggestions sends at most 50 names', () async {
    await const MethodSiriChannel().suggestions([
      for (var i = 0; i < 60; i++) 'n$i',
    ]);
    expect(
      ((calls.single.arguments as Map<Object?, Object?>)['names']! as List)
          .length,
      50,
    );
  });

  test('clear', () async {
    await const MethodSiriChannel().clear();
    expect(calls.single.method, 'clear');
  });
}
