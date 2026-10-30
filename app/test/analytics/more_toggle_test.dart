import 'package:family_groceries/analytics/analytics.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import '../more/more_harness.dart';
import 'fakes.dart';

void main() {
  setUpAll(fakeSupabase);

  final toggle = find.byKey(const ValueKey('more-analytics'));
  final version = find.byKey(const ValueKey('more-version'));

  late MemoryAnalyticsStore store;
  setUp(() => store = MemoryAnalyticsStore());

  Future<(Analytics, RecordingSink)> consented() async {
    final sink = RecordingSink();
    final analytics = await loadedAnalytics(sink, store)
      ..setUser(customer);
    await analytics.decide(granted: true);
    await analytics.flush();
    return (analytics, sink);
  }

  testWidgets('a build without a key has no usage-data section', (
    tester,
  ) async {
    await pumpMore(tester);
    expect(toggle, findsNothing);
  });

  testWidgets('the switch shows the decision; off stops sending at once', (
    tester,
  ) async {
    final (analytics, sink) = await consented();
    await pumpMore(tester, analytics: analytics, size: const Size(390, 2000));
    expect(toggle, findsOneWidget);
    expect(tester.widget<SwitchListTile>(toggle).value, isTrue);

    analytics
      ..track('item_ticked')
      ..track('item_ticked');
    await tester.tap(toggle);
    await tester.pumpAndSettle();
    expect(analytics.state.consent, isFalse);
    expect(tester.widget<SwitchListTile>(toggle).value, isFalse);
    expect(analytics.queued, isEmpty);
    expect(store.id, isNull, reason: 'off deletes the install id');
    analytics.track('item_ticked');
    await analytics.flush();
    expect(sink.names, ['first_open']);

    final before = sink.events.single['properties']! as Map;
    await tester.tap(toggle);
    await tester.pumpAndSettle();
    expect(analytics.state.consent, isTrue);
    await analytics.flush();
    expect(sink.names, ['first_open', 'first_open']);
    expect(
      (sink.events.last['properties']! as Map)['install_id'],
      allOf(store.id, isNot(before['install_id'])),
      reason: 'on again: a new install id',
    );
  });

  testWidgets('a long press on the version marks the install internal', (
    tester,
  ) async {
    final (analytics, _) = await consented();
    await pumpMore(tester, analytics: analytics, size: const Size(390, 2000));
    expect(find.byKey(const ValueKey('more-test-error')), findsNothing);
    await tester.longPress(version);
    await tester.pumpAndSettle();
    expect(analytics.state.internalInstall, isTrue);
    expect(find.text('Interne Installation'), findsOneWidget);
    expect(find.byKey(const ValueKey('more-test-error')), findsOneWidget);
    await tester.longPress(version);
    await tester.pumpAndSettle();
    expect(analytics.state.internalInstall, isFalse);
  });
}
