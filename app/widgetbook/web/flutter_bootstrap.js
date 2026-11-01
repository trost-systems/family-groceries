{{flutter_js}}
{{flutter_build_config}}

// As in the app (job 33c): the engine and its fallback fonts load from the catalogue's own
// origin, never gstatic.com. scripts/widgetbook.sh copies app/web/fonts next to the build.
// Relative, so the catalogue works under any --base-href.
const config = { canvasKitBaseUrl: 'canvaskit/', fontFallbackBaseUrl: 'fonts/' };
_flutter.loader.load({
  config,
  onEntrypointLoaded: async (engineInitializer) => {
    const appRunner = await engineInitializer.initializeEngine(config);
    await appRunner.runApp();
  },
});
