import 'dart:async';

import 'package:fake_async/fake_async.dart';
import 'package:family_groceries/purchases/purchase_repository.dart';
import 'package:family_groceries/purchases/store_prices.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  final calls = <MethodCall>[];

  void answer(Future<Object?> Function(MethodCall call) handler) {
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(ChannelStorePrices.channel, (call) {
          calls.add(call);
          return handler(call);
        });
  }

  setUp(calls.clear);
  tearDown(
    () => TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(ChannelStorePrices.channel, null),
  );

  Map<String, String> price(String formatted, String currency) => {
    'price': formatted,
    'currency': currency,
  };

  Future<Map<PremiumPlan, StorePrice>> readPrices() async {
    final read = await const ChannelStorePrices().read();
    return (read as PricesRead).prices;
  }

  group('read', () {
    test('asks for both products and the Play base plan, once', () async {
      answer(
        (_) async => {
          'yearly': price('9,99 €', 'EUR'),
          'lifetime': price('29,99 €', 'EUR'),
        },
      );

      expect(await readPrices(), {
        PremiumPlan.yearly: const StorePrice('9,99 €', 'EUR'),
        PremiumPlan.lifetime: const StorePrice('29,99 €', 'EUR'),
      });
      expect(calls, hasLength(1));
      expect(calls.single.method, 'prices');
      expect(calls.single.arguments, {
        'yearly': 'com.hummlist.app.yearly',
        'lifetime': 'com.hummlist.app.lifetime',
        'basePlan': 'yearly',
      });
    });

    test("keeps the store's own formatting in any currency", () async {
      for (final (formatted, currency) in [
        (r'$9.99', 'USD'),
        ('£8.99', 'GBP'),
        ('CHF 9.90', 'CHF'),
        (r'R$ 54,90', 'BRL'),
      ]) {
        answer((_) async => {'yearly': price(formatted, currency)});
        final yearly = (await readPrices())[PremiumPlan.yearly]!;
        expect(yearly.formatted, formatted);
        expect(yearly.currencyCode, currency);
        expect(yearly.euro, isFalse);
      }
    });

    test('a plan the storefront does not sell is left out', () async {
      answer((_) async => {'yearly': price('9,99 €', 'EUR'), 'lifetime': null});

      expect(await readPrices(), {
        PremiumPlan.yearly: const StorePrice('9,99 €', 'EUR'),
      });
    });

    test('no plan sold here: an empty price list, not unavailable', () async {
      answer((_) async => {'yearly': null, 'lifetime': null});

      expect(await readPrices(), isEmpty);
    });

    test('a failing store is unavailable', () async {
      answer((_) async => throw PlatformException(code: 'billing'));
      expect(await const ChannelStorePrices().read(), isA<PricesUnavailable>());
    });

    test('a build without the native side is unavailable', () async {
      expect(await const ChannelStorePrices().read(), isA<PricesUnavailable>());
    });

    test('a store silent for 10 s is unavailable', () {
      fakeAsync((async) {
        answer((_) => Completer<Object?>().future);
        StorePrices? read;
        unawaited(const ChannelStorePrices().read().then((r) => read = r));

        async.elapse(const Duration(seconds: 9));
        expect(read, isNull);
        async.elapse(const Duration(seconds: 1));
        expect(read, isA<PricesUnavailable>());
      });
    });

    test(
      'an answer of the wrong shape is unavailable, not half a price',
      () async {
        for (final malformed in <Object?>[
          null,
          'EUR',
          ['9,99 €'],
          {'yearly': '9,99 €'},
          {
            'yearly': {'price': '9,99 €'},
          },
          {'yearly': price('', 'EUR')},
          {
            'yearly': price('9,99 €', 'EUR'),
            'lifetime': {'price': 29.99, 'currency': 'EUR'},
          },
        ]) {
          answer((_) async => malformed);
          expect(
            await const ChannelStorePrices().read(),
            isA<PricesUnavailable>(),
            reason: '$malformed',
          );
        }
      },
    );
  });

  group('manageSubscriptions', () {
    test("reports whether the store's sheet opened", () async {
      for (final shown in [true, false]) {
        answer((_) async => shown);
        expect(await const ChannelStorePrices().manageSubscriptions(), shown);
      }
      expect(calls.map((c) => c.method), everyElement('manageSubscriptions'));
    });

    test(
      'an error or no native side: false, the caller opens the URL',
      () async {
        answer((_) async => throw PlatformException(code: 'no_scene'));
        expect(await const ChannelStorePrices().manageSubscriptions(), isFalse);

        TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
            .setMockMethodCallHandler(ChannelStorePrices.channel, null);
        expect(await const ChannelStorePrices().manageSubscriptions(), isFalse);
      },
    );
  });

  test('the fake store answers what it was given and counts', () async {
    final fake = FakeStorePrices(const PricesUnavailable());
    expect(await fake.read(), isA<PricesUnavailable>());
    expect(await fake.read(), isA<PricesUnavailable>());
    expect(fake.reads, 2);
    expect(await fake.manageSubscriptions(), isFalse);
  });

  group('storePriceReader', () {
    StorePriceReader choose({
      bool web = false,
      TargetPlatform platform = TargetPlatform.iOS,
      String fakeStore = '',
      bool release = false,
    }) => chooseStorePriceReader(
      web: web,
      platform: platform,
      fakeStore: fakeStore,
      release: release,
    );

    test('iOS and Android ask their store', () {
      expect(choose(), isA<ChannelStorePrices>());
      expect(
        choose(platform: TargetPlatform.android),
        isA<ChannelStorePrices>(),
      );
      expect(choose(release: true), isA<ChannelStorePrices>());
    });

    test('the web app never reads a store, fake or not', () {
      expect(choose(web: true), isA<NoStorePrices>());
      expect(choose(web: true, fakeStore: 'ok'), isA<NoStorePrices>());
    });

    test('desktop has no store', () {
      expect(choose(platform: TargetPlatform.linux), isA<NoStorePrices>());
    });

    test('the fake store charges the launch prices outside release', () async {
      for (final platform in [TargetPlatform.linux, TargetPlatform.android]) {
        final reader = choose(platform: platform, fakeStore: 'ok');
        expect(reader, isA<FakeStorePrices>());
        final read = await reader.read() as PricesRead;
        expect(read.prices, {
          PremiumPlan.yearly: const StorePrice('9,99 €', 'EUR'),
          PremiumPlan.lifetime: const StorePrice('29,99 €', 'EUR'),
        });
      }
      expect(
        choose(platform: TargetPlatform.linux, fakeStore: 'ok', release: true),
        isA<NoStorePrices>(),
      );
      expect(choose(fakeStore: 'ok', release: true), isA<ChannelStorePrices>());
    });
  });
}
