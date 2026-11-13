import 'dart:ui' show Tristate;

import 'package:family_groceries/analytics/analytics.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:material_ui/material_ui.dart';

import '../more/more_harness.dart';
import 'fakes.dart';

void main() {
  setUpAll(fakeSupabase);

  final toggle = find.byKey(const ValueKey('more-analytics'));
  bool on(WidgetTester tester) =>
      tester
          .getSemantics(toggle)
          .getSemanticsData()
          .flagsCollection
          .isToggled ==
      Tristate.isTrue;
  final version = find.byKey(const ValueKey('more-version'));

  /// More, then its Nutzungsdaten row: the switch lives on that page.
  Future<void> openUsageData(WidgetTester tester, Analytics analytics) async {
    await pumpMore(tester, analytics: analytics, size: const Size(390, 2000));
    expect(toggle, findsNothing, reason: 'not on the menu');
    await tester.tap(find.byKey(const ValueKey('more-usage-data')));
    await tester.pumpAndSettle();
    expect(find.byKey(const ValueKey('more-usage-data-page')), findsOneWidget);
  }

  late MemoryAnalyticsStore store;
  setUp(() => store = MemoryAnalyticsStore());

  Future<(Analytics, NativePostHog)> consented() async {
    final sink = NativePostHog()..install();
    final analytics = await loadedAnalytics(store)
      ..setUser(customer);
    await analytics.decide(granted: true);
    await analytics.flush();
    return (analytics, sink);
  }

  testWidgets('a build without a key has no Nutzungsdaten row or switch', (
    tester,
  ) async {
    await pumpMore(tester, size: const Size(390, 2000));
    expect(find.byKey(const ValueKey('more-settings')), findsOneWidget);
    expect(find.byKey(const ValueKey('more-usage-data')), findsNothing);
    expect(toggle, findsNothing);
    expect(find.text('Nutzungsdaten'), findsNothing);
  });

  testWidgets('the switch shows the decision; off stops sending at once', (
    tester,
  ) async {
    final (analytics, sink) = await consented();
    await openUsageData(tester, analytics);
    expect(toggle, findsOneWidget);
    expect(on(tester), isTrue);

    await tester.tap(toggle);
    await tester.pumpAndSettle();
    expect(analytics.state.consent, isFalse);
    expect(on(tester), isFalse);
    expect(sink.methods.last, 'close', reason: 'off stops the SDK');
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
    expect(find.byType(SnackBar), findsNothing);
    await tester.longPress(version);
    await tester.pumpAndSettle();
    expect(analytics.state.internalInstall, isFalse);
    expect(find.text('Interne Installation'), findsNothing);
  });

  testWidgets('an internal install copies the install id flags target', (
    tester,
  ) async {
    final clipboard = <String>[];
    tester.binding.defaultBinaryMessenger.setMockMethodCallHandler(
      SystemChannels.platform,
      (call) async {
        if (call.method == 'Clipboard.setData') {
          clipboard.add((call.arguments as Map)['text'] as String);
        }
        return null;
      },
    );
    final (analytics, _) = await consented();
    await pumpMore(tester, analytics: analytics, size: const Size(390, 2000));
    final copy = find.byKey(const ValueKey('more-install-id'));
    expect(copy, findsNothing, reason: 'only on an internal install');
    await tester.longPress(version);
    await tester.pumpAndSettle();
    expect(find.textContaining(store.id!), findsOneWidget);
    await tester.tap(copy);
    await tester.pumpAndSettle();
    expect(clipboard, [store.id], reason: 'the distinct id PostHog sees');
  });
}
