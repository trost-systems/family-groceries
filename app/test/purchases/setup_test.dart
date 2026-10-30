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
  }) => storeChoice(
    web: web,
    platform: platform,
    fakeStore: fakeStore,
    release: release,
  );

  test('iOS sells through the App Store, Android through Play', () {
    expect(
      choose(),
      isA<DeviceStore>().having((s) => s.store, 'store', AppStore.apple),
    );
    expect(
      choose(platform: TargetPlatform.android),
      isA<DeviceStore>().having((s) => s.store, 'store', AppStore.google),
    );
  });

  test('desktop sells nothing without the fake store', () {
    for (final platform in [
      TargetPlatform.linux,
      TargetPlatform.macOS,
      TargetPlatform.windows,
    ]) {
      expect(choose(platform: platform), isA<NoStore>());
    }
  });

  test('the fake store replaces the store outside release builds', () {
    expect(
      choose(platform: TargetPlatform.linux, fakeStore: 'pending'),
      isA<FakeStoreChoice>().having(
        (s) => s.mode,
        'mode',
        FakeStoreMode.pending,
      ),
    );
    expect(
      choose(fakeStore: 'ok', release: true),
      isA<DeviceStore>(),
      reason: 'a release build ignores FAKE_STORE',
    );
  });

  test('the web app never sells, fake store or not', () {
    expect(choose(web: true), isA<NoStore>());
    expect(choose(web: true, fakeStore: 'ok'), isA<NoStore>());
  });

  test('an unknown FAKE_STORE value fails loudly', () {
    expect(() => choose(fakeStore: 'maybe'), throwsArgumentError);
  });
}
