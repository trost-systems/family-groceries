{{flutter_js}}
{{flutter_build_config}}

// A boot asset load cut off mid-flight (a network change aborts it) would
// leave a blank page; reload instead, at most twice per tab session.
const bootRetries = 'fg-boot-retries';
function retryBoot(error) {
  console.error('Flutter boot failed:', error);
  const tries = Number(sessionStorage.getItem(bootRetries) ?? 0);
  if (tries >= 2) throw error;
  sessionStorage.setItem(bootRetries, String(tries + 1));
  location.reload();
}

// With onEntrypointLoaded the loader does not watch its script tag, so
// catch a failed main.dart.js here (load errors only reach capture listeners).
let started = false;

// Job 52: index.html's splash stays until the engine has drawn the app's first frame.
globalThis.addEventListener('flutter-first-frame', () => document.getElementById('splash')?.remove(), { once: true });
globalThis.addEventListener('error', (event) => {
  if (!started && event.target instanceof HTMLScriptElement) {
    retryBoot(new Error(`failed to load ${event.target.src}`));
  }
}, true);

// Job 33c (legal review H-02): the engine files (canvaskit/, skwasm) and the fonts come from our
// own origin, never from www.gstatic.com or fonts.gstatic.com. app/web/fonts/ mirrors the paths
// the engine asks for (scripts/web-fonts.sh). The loader reads canvasKitBaseUrl, the engine
// fontFallbackBaseUrl, so both get the config.
// Job 201: the engines that may run main.dart.wasm. The loader still checks the Wasm features
// dart2wasm needs (Safari 26.2+, Firefox 147+) and runs main.dart.js where they are missing.
// Set an engine to false to send all its browsers back to main.dart.js.
const wasmAllowList = { blink: true, webkit: true, gecko: true };
const config = { canvasKitBaseUrl: '/canvaskit/', fontFallbackBaseUrl: '/fonts/', wasmAllowList };
_flutter.loader.load({
  config,
  onEntrypointLoaded: async (engineInitializer) => {
    try {
      const appRunner = await engineInitializer.initializeEngine(config);
      await appRunner.runApp();
      started = true;
      sessionStorage.removeItem(bootRetries);
    } catch (error) {
      retryBoot(error);
    }
  },
}).catch(retryBoot);
