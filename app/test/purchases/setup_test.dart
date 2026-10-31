import 'package:family_groceries/purchases/fake_store.dart';
import 'package:family_groceries/purchases/purchase_repository.dart';
import 'package:family_groceries/purchases/setup.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  StoreChoice choose({
    bool web = false,
    TargetPlatform platform = TargetPlatform.iOS,
    String fakeStore = '',
    bool release = false,
    bool revenueCat = true,
    String iosKey = 'appl_test',
    String androidKey = 'goog_test',
  }) => storeChoice(
    web: web,
    platform: platform,
    fakeStore: fakeStore,
    release: release,
    revenueCat: revenueCat,
    iosKey: iosKey,
    androidKey: androidKey,
  );

  test('iOS sells through the App Store, Android through Play', () {
    expect(
      choose(),
      isA<RevenueCatStore>()
          .having((s) => s.store, 'store', AppStore.apple)
          .having((s) => s.apiKey, 'key', 'appl_test'),
    );
    expect(
      choose(platform: TargetPlatform.android),
      isA<RevenueCatStore>()
          .having((s) => s.store, 'store', AppStore.google)
          .having((s) => s.apiKey, 'key', 'goog_test'),
    );
  });

  test('the purchase define off: coming soon', () {
    for (final platform in [TargetPlatform.iOS, TargetPlatform.android]) {
      expect(
        choose(platform: platform, revenueCat: false),
        isA<NoStore>().having(
          (s) => s.answer,
          'answer',
          isA<PurchasesNotYet>(),
        ),
      );
    }
  });

  test("without the platform's SDK key: coming soon", () {
    expect(
      choose(iosKey: ''),
      isA<NoStore>().having((s) => s.answer, 'answer', isA<PurchasesNotYet>()),
    );
    expect(
      choose(platform: TargetPlatform.android, androidKey: ''),
      isA<NoStore>().having((s) => s.answer, 'answer', isA<PurchasesNotYet>()),
    );
  });

  test('desktop sells nothing without the fake store', () {
    for (final platform in [
      TargetPlatform.linux,
      TargetPlatform.macOS,
      TargetPlatform.windows,
    ]) {
      expect(
        choose(platform: platform),
        isA<NoStore>().having(
          (s) => s.answer,
          'answer',
          isA<PurchasesUnsupported>(),
        ),
      );
    }
  });

  test('the fake store replaces the store outside release builds', () {
    expect(
      choose(
        platform: TargetPlatform.linux,
        fakeStore: 'pending',
        revenueCat: false,
      ),
      isA<FakeStoreChoice>().having(
        (s) => s.mode,
        'mode',
        FakeStoreMode.pending,
      ),
      reason: 'also with the purchase define off',
    );
    expect(
      choose(fakeStore: 'ok', release: true),
      isA<RevenueCatStore>(),
      reason: 'a release build ignores FAKE_STORE',
    );
  });

  test('the web app never sells, fake store or not', () {
    for (final choice in [
      choose(web: true),
      choose(web: true, fakeStore: 'ok'),
    ]) {
      expect(
        choice,
        isA<NoStore>().having(
          (s) => s.answer,
          'answer',
          isA<PurchasesUnsupported>(),
        ),
      );
    }
  });

  test('an unknown FAKE_STORE value fails loudly', () {
    expect(() => choose(fakeStore: 'maybe'), throwsArgumentError);
  });
}
