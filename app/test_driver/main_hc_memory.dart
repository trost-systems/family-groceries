import 'dart:convert';
import 'dart:developer' as developer;

import 'package:flutter/painting.dart';

import 'main_marionette.dart' as marionette;

/// Profile entrypoint for the hc-memory hill climb (`tool/hillclimb/hc-memory`):
/// the Marionette app plus `ext.hc.imageCache`, which reports the image
/// cache's size, since profile builds cannot evaluate expressions.
Future<void> main() async {
  developer.registerExtension('ext.hc.imageCache', (method, parameters) async {
    final cache = PaintingBinding.instance.imageCache;
    return developer.ServiceExtensionResponse.result(
      jsonEncode({
        'bytes': cache.currentSizeBytes,
        'count': cache.currentSize,
        'live': cache.liveImageCount,
        'maxBytes': cache.maximumSizeBytes,
      }),
    );
  });
  await marionette.main();
}
