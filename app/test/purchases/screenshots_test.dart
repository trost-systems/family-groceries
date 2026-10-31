// Job 25, 43: PR screenshots of the Hummlist Lifetime page in its native states
// (the web build only shows the web state). Renders More's real page with
// the fake store and the app's theme, in Roboto and the Material icons from
// the Flutter SDK. Skipped unless SCREENSHOT_DIR is set:
//   SCREENSHOT_DIR=/tmp/shots flutter test --update-goldens \
//     test/purchases/screenshots_test.dart
import 'dart:io';

import 'package:family_groceries/app/language.dart';
import 'package:family_groceries/app/router.dart';
import 'package:family_groceries/purchases/purchase_cubit.dart';
import 'package:family_groceries/purchases/purchase_repository.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';

import '../more/more_harness.dart';
import 'fakes.dart';

final _dir = Platform.environment['SCREENSHOT_DIR'];

Future<void> _loadFonts() async {
  // flutter_tester lives in <sdk>/bin/cache/artifacts/engine/<platform>/.
  final artifacts = File(Platform.resolvedExecutable).parent.parent.parent;
  final fonts = Directory('${artifacts.path}/material_fonts');
  Future<void> family(String name, List<String> files) async {
    final loader = FontLoader(name);
    for (final f in files) {
      final bytes = File('${fonts.path}/$f').readAsBytesSync();
      loader.addFont(Future.value(ByteData.view(bytes.buffer)));
    }
    await loader.load();
  }

  await family('Roboto', [
    'Roboto-Regular.ttf',
    'Roboto-Medium.ttf',
    'Roboto-Bold.ttf',
  ]);
  await family('MaterialIcons', ['MaterialIcons-Regular.otf']);
}

typedef Scene = ({
  String name,
  String location,
  FakePurchaseRepository Function() store,
  bool unlocked,
  Future<void> Function(WidgetTester, More)? act,
});

Future<void> _buy(WidgetTester tester, More more) async {
  await tester.tap(find.byKey(const ValueKey('lifetime-buy')));
  await tester.pump();
}

final List<Scene> _scenes = [
  (
    name: 'offer',
    location: lifetimePath,
    store: FakePurchaseRepository.new,
    unlocked: false,
    act: null,
  ),
  (
    name: 'pending',
    location: lifetimePath,
    store: () => FakePurchaseRepository(bought: const Pending()),
    unlocked: false,
    act: _buy,
  ),
  (
    name: 'unlocking',
    location: lifetimePath,
    store: FakePurchaseRepository.new,
    unlocked: false,
    act: _buy,
  ),
  (
    name: 'unlocked',
    location: lifetimePath,
    store: FakePurchaseRepository.new,
    unlocked: true,
    act: null,
  ),
  (
    name: 'unavailable',
    location: lifetimePath,
    store: () => FakePurchaseRepository(product: const ProductNotFound()),
    unlocked: false,
    act: null,
  ),
  (
    name: 'not-yet',
    location: lifetimePath,
    store: () => FakePurchaseRepository(withoutStore: const PurchasesNotYet()),
    unlocked: false,
    act: null,
  ),
  (
    name: 'offline',
    location: lifetimePath,
    store: () => FakePurchaseRepository(product: const StoreUnavailable()),
    unlocked: false,
    act: null,
  ),
  (
    name: 'error',
    location: lifetimePath,
    store: () => FakePurchaseRepository(bought: const StoreFailed('E42')),
    unlocked: false,
    act: _buy,
  ),
  (
    name: 'used-elsewhere',
    location: lifetimePath,
    store: () => FakePurchaseRepository(bought: const BelongsElsewhere()),
    unlocked: false,
    act: _buy,
  ),
  (
    name: 'more',
    location: morePath,
    store: FakePurchaseRepository.new,
    unlocked: false,
    act: null,
  ),
];

void main() {
  setUpAll(() async {
    await fakeSupabase();
    if (_dir != null) {
      await _loadFonts();
      WidgetsApp.debugAllowBannerOverride = false;
    }
  });

  for (final scene in _scenes) {
    for (final (lang, language) in [
      ('de', AppLanguage.byCode('de')),
      ('en', AppLanguage.byCode('en')),
    ]) {
      for (final size in const [Size(390, 844), Size(1366, 1024)]) {
        final name = 'job25-app-${scene.name}-$lang-${size.width.toInt()}';
        testWidgets(name, skip: _dir == null, (tester) async {
          final more = await pumpMore(
            tester,
            location: scene.location,
            size: size,
            language: language,
            store: scene.store(),
            entitlements: FakeEntitlementsSource(unlockedNow: scene.unlocked),
          );
          await tester.pumpAndSettle();
          await scene.act?.call(tester, more);
          await expectLater(
            find.byType(MaterialApp),
            matchesGoldenFile(Uri.file('$_dir/$name.png')),
          );
          // "Unlocking" waits for an unlock that never comes here.
          await tester.pump(unlockWait);
        });
      }
    }
  }
}
