import 'dart:async';

import 'package:family_groceries/design/fonts.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';

/// The app's assets, except that loads of [failing] fail, as a blocked
/// font fetch does.
class _FailingBundle({final Set<String>? failing}) extends CachingAssetBundle {
  final requested = <String>[];

  @override
  Future<ByteData> load(String key) {
    requested.add(key);
    if (failing == null || failing!.contains(key)) {
      return Future.error(FlutterError('Unable to load asset: "$key"'));
    }
    return rootBundle.load(key);
  }
}

Future<List<Object>> _uncaughtWhileLoading(AssetBundle bundle) async {
  final uncaught = <Object>[];
  await runZonedGuarded(
    () => loadAppFonts(bundle: bundle),
    (error, _) => uncaught.add(error),
  );
  await pumpEventQueue();
  return uncaught;
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  test('fonts that fail to load reach no zone error handler', () async {
    final bundle = _FailingBundle();

    expect(await _uncaughtWhileLoading(bundle), isEmpty);
    expect(bundle.requested, hasLength(6));
  });

  test('two failed files of one family reach no zone error handler', () async {
    final bundle = _FailingBundle(
      failing: {'assets/fonts/Inter-Medium.ttf', 'assets/fonts/Inter-Bold.ttf'},
    );

    expect(await _uncaughtWhileLoading(bundle), isEmpty);
    expect(bundle.requested, hasLength(6));
  });
}
