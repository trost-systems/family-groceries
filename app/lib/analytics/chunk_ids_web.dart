import 'dart:js_interop';
import 'dart:js_interop_unsafe';

/// The chunk ids `posthog-cli sourcemap inject` writes into the built
/// JavaScript (`globalThis._posthogChunkIds`, file URL to id), so PostHog
/// finds the uploaded source map for a frame. Empty when the build was not
/// injected.
Map<String, String> chunkIds() {
  final ids = globalContext['_posthogChunkIds'].dartify();
  return ids is Map
      ? {for (final e in ids.entries) '${e.key}': '${e.value}'}
      : const {};
}
