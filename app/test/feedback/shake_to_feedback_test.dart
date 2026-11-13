import 'dart:async';

import 'package:family_groceries/app/router.dart';
import 'package:family_groceries/feedback/feedback_context.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:material_ui/material_ui.dart';
import 'package:sensors_plus/sensors_plus.dart';

import '../more/more_harness.dart';

void main() {
  setUpAll(fakeSupabase);

  Finder key(String k) => find.byKey(ValueKey(k));
  final start = DateTime.utc(2026, 11, 6, 12);

  /// Three hard swings from [atMs] on, sampled every 20 ms.
  Future<void> shake(
    WidgetTester tester,
    StreamController<AccelerometerEvent> samples, {
    int atMs = 0,
  }) async {
    for (var ms = 0; ms < 600; ms += 20) {
      final g = ms % 200 < 60 ? 3.5 : 1.0;
      samples.add(
        AccelerometerEvent(
          0,
          g * 9.81,
          0,
          start.add(Duration(milliseconds: atMs + ms)),
        ),
      );
    }
    await tester.pumpAndSettle();
  }

  const phones = TargetPlatformVariant({
    TargetPlatform.android,
    TargetPlatform.iOS,
  });

  testWidgets(
    'a shake on Anpassen opens the form about Anpassen; the note says so',
    (tester) async {
      final samples = StreamController<AccelerometerEvent>.broadcast();
      addTearDown(samples.close);
      final more = await pumpMore(
        tester,
        location: editPath,
        app: true,
        shakeSamples: samples.stream,
      );
      expect(key('stores-screen'), findsOneWidget);
      expect(samples.hasListener, isTrue);
      await shake(tester, samples);
      expect(key('feedback-sheet'), findsOneWidget);
      expect(key('feedback-shake-hint'), findsOneWidget);
      await tester.enterText(key('feedback-message'), 'Lidl hakt');
      await tester.pump();
      await tester.ensureVisible(key('feedback-send'));
      await tester.pumpAndSettle();
      await tester.tap(key('feedback-send'));
      await tester.pumpAndSettle();
      final scene = more.feedback.rows.values.single.context.scene;
      expect(scene.entryPoint, FeedbackEntryPoint.shake);
      expect(scene.screen, 'stores', reason: 'the live screen');
    },
    variant: phones,
  );

  testWidgets('a shake on More is about More, not the list before it', (
    tester,
  ) async {
    final samples = StreamController<AccelerometerEvent>.broadcast();
    addTearDown(samples.close);
    final more = await pumpMore(
      tester,
      location: listPath,
      app: true,
      shakeSamples: samples.stream,
    );
    await tester.tap(key('tab-more'));
    await tester.pumpAndSettle();
    expect(more.screens.feedbackScreen, 'list', reason: "More's row");
    await shake(tester, samples);
    await tester.enterText(key('feedback-message'), 'Mehr hakt');
    await tester.pump();
    await tester.ensureVisible(key('feedback-send'));
    await tester.pumpAndSettle();
    await tester.tap(key('feedback-send'));
    await tester.pumpAndSettle();
    expect(more.feedback.rows.values.single.context.scene.screen, 'more');
  });

  testWidgets('a shake while the form shows opens no second one', (
    tester,
  ) async {
    final samples = StreamController<AccelerometerEvent>.broadcast();
    addTearDown(samples.close);
    await pumpMore(
      tester,
      location: listPath,
      app: true,
      shakeSamples: samples.stream,
    );
    await shake(tester, samples);
    expect(key('feedback-sheet'), findsOneWidget);
    // Well after the cooldown.
    await shake(tester, samples, atMs: 5000);
    expect(key('feedback-sheet'), findsOneWidget);
    await tester.tap(key('feedback-close'));
    await tester.pumpAndSettle();
    expect(key('feedback-sheet'), findsNothing);
    await shake(tester, samples, atMs: 10000);
    expect(key('feedback-sheet'), findsOneWidget, reason: 'closed, it opens');
  }, variant: phones);

  testWidgets('a shake under another dialog opens nothing', (tester) async {
    final samples = StreamController<AccelerometerEvent>.broadcast();
    addTearDown(samples.close);
    await pumpMore(
      tester,
      location: listPath,
      app: true,
      shakeSamples: samples.stream,
    );
    showDialog<void>(
      context: tester.element(find.byType(Scaffold).first),
      builder: (_) => const AlertDialog(
        key: ValueKey('other-dialog'),
        content: Text('Sicher?'),
      ),
    );
    await tester.pumpAndSettle();
    expect(key('other-dialog'), findsOneWidget);
    await shake(tester, samples);
    expect(key('feedback-sheet'), findsNothing);
    Navigator.of(tester.element(key('other-dialog'))).pop();
    await tester.pumpAndSettle();
    await shake(tester, samples, atMs: 5000);
    expect(key('feedback-sheet'), findsOneWidget, reason: 'dialog gone');
  }, variant: phones);

  testWidgets('no shake on a desktop: the accelerometer is never asked', (
    tester,
  ) async {
    final samples = StreamController<AccelerometerEvent>.broadcast();
    addTearDown(samples.close);
    await pumpMore(
      tester,
      location: listPath,
      app: true,
      shakeSamples: samples.stream,
    );
    expect(samples.hasListener, isFalse);
  }, variant: TargetPlatformVariant.desktop());

  testWidgets('in the background the accelerometer is off; back, it is on', (
    tester,
  ) async {
    final samples = StreamController<AccelerometerEvent>.broadcast();
    addTearDown(samples.close);
    await pumpMore(
      tester,
      location: listPath,
      app: true,
      shakeSamples: samples.stream,
    );
    expect(samples.hasListener, isTrue);
    tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.inactive);
    tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.hidden);
    tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.paused);
    await tester.pump();
    expect(samples.hasListener, isFalse);
    tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.hidden);
    tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.inactive);
    tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.resumed);
    await tester.pump();
    expect(samples.hasListener, isTrue);
    await shake(tester, samples);
    expect(key('feedback-sheet'), findsOneWidget);
  });
}
