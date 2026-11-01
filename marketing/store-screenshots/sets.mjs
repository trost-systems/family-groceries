// What the stores get: every device's output size, the app viewport it is filmed at and the
// scenes it shows, in store order. layout() is the one geometry that capture (the viewport to
// film) and compose (where the capture sits under the caption) share.
//
// Store rules (checked in compose.mjs): PNG, 24-bit RGB without alpha.
// Play: phone and 7"/10" tablet screenshots 9:16, each side 320 to 3840 px (10": at least 1080);
//   feature graphic 1024 x 500; hi-res icon 512 x 512.
// App Store: 6.9" iPhone 1320 x 2868 portrait, 13" iPad 2064 x 2752 portrait.

export const LOCALES = {
  'de-DE': { lang: 'de', scenario: 'demo-haushalt' },
  'en-US': { lang: 'en', scenario: 'demo-household-en' },
};

export const STORES = ['play', 'appstore'];

const ALL = ['list', 'add', 'tick', 'sync', 'due', 'dark'];

export const DEVICES = {
  'play-phone': { store: 'play', width: 1080, height: 1920, viewportWidth: 390, scenes: ALL },
  'play-tablet7': { store: 'play', width: 1440, height: 2560, viewportWidth: 600, scenes: ['list', 'add', 'tick', 'sync'] },
  'play-tablet10': { store: 'play', width: 1800, height: 3200, viewportWidth: 800, scenes: ['list', 'add', 'tick', 'sync'] },
  'appstore-iphone69': { store: 'appstore', width: 1320, height: 2868, viewportWidth: 440, scenes: ALL },
  'appstore-ipad13': { store: 'appstore', width: 2064, height: 2752, viewportWidth: 1032, scenes: ['list', 'add', 'sync', 'due'] },
};

export const FEATURE_GRAPHIC = { width: 1024, height: 500 };
export const ICON = { width: 512, height: 512 };

/**
 * The frame of one device in output pixels: the caption band on top, then a phone or tablet body
 * whose screen runs to the bottom edge (the body's foot bleeds off), and the app viewport whose
 * CSS pixels fill that screen exactly, so the whole app down to its tab bar is in the frame.
 */
export function layout(device) {
  const { width: W, height: H, viewportWidth } = DEVICES[device];
  const unit = W / 1080;
  const band = Math.round(Math.min(H * 0.22, W * 0.4));
  const margin = Math.round(84 * unit);
  const bezel = Math.round(16 * unit);
  const screen = { x: margin + bezel, y: band + bezel, width: W - 2 * (margin + bezel) };
  const scale = screen.width / viewportWidth;
  screen.height = H - screen.y;
  const viewport = { width: viewportWidth, height: Math.floor(screen.height / scale) };
  return {
    unit,
    band,
    body: { x: margin, y: band, width: W - 2 * margin, radius: Math.round(56 * unit), bezel },
    screen: { ...screen, radius: Math.round(42 * unit) },
    scale,
    viewport,
    // Filmed sharper than shown, then scaled down in compose.
    dpr: Math.max(2, Math.ceil(scale)),
  };
}

/** Every (locale, device, scene) the run makes, numbered per device in store order. */
export function shots({ locales = Object.keys(LOCALES), stores = STORES } = {}) {
  return locales.flatMap((locale) =>
    Object.entries(DEVICES)
      .filter(([, d]) => stores.includes(d.store))
      .flatMap(([device, d]) => d.scenes.map((scene, i) => ({ locale, device, scene, n: i + 1 }))));
}
