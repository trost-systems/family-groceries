{{flutter_js}}
{{flutter_build_config}}

// Everything comes from this folder, never from www.gstatic.com or
// fonts.gstatic.com (as in app/web/flutter_bootstrap.js). The loader reads
// canvasKitBaseUrl, the engine fontFallbackBaseUrl; both resolve against the
// <base href>.
const config = { canvasKitBaseUrl: 'canvaskit/', fontFallbackBaseUrl: 'fonts/' };
_flutter.loader.load({
  config,
  onEntrypointLoaded: async (engineInitializer) => {
    const appRunner = await engineInitializer.initializeEngine(config);
    await appRunner.runApp();
  },
});
