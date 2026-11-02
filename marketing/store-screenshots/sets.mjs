// What the stores get: every device's output size, the app viewport it is filmed at and the
// scenes it shows, in store order. layout() is the one geometry that capture (the viewport to
// film) and compose (where the capture sits under the caption) share.
//
// Store rules: PNG, 24-bit RGB without alpha (compose.mjs checks every file), and each device's
// `rule` below (deviceProblems). Play: each side within `sides`, the long side at most twice the
// short one; Play features 9:16 shots. App Store: one of the accepted sizes. Play's feature graphic
// is 1024 x 500, its hi-res icon 512 x 512.

export const LOCALES = {
  'de-DE': { lang: 'de', scenario: 'demo-haushalt' },
  'en-US': { lang: 'en', scenario: 'demo-household-en' },
};

export const STORES = ['play', 'appstore'];

// The empty add sheet opens at half the screen, so „Wieder fällig“ needs a tall phone to show rows.
const PHONE = ['list', 'add', 'tick', 'sync', 'edit', 'dark'];
const TALL_PHONE = ['list', 'add', 'tick', 'sync', 'due', 'edit', 'dark'];

export const DEVICES = {
  'play-phone': { store: 'play', width: 1080, height: 1920, rule: { sides: [320, 3840] }, viewport: { width: 390, height: 780 }, scenes: PHONE },
  'play-tablet7': { store: 'play', width: 1440, height: 2560, rule: { sides: [320, 3840] }, viewport: { width: 600, height: 960 }, scenes: ['list', 'add', 'tick', 'sync'] },
  'play-tablet10': { store: 'play', width: 1800, height: 3200, rule: { sides: [1080, 7680] }, viewport: { width: 800, height: 1280 }, scenes: ['list', 'add', 'tick', 'sync'] },
  'appstore-iphone69': { store: 'appstore', width: 1320, height: 2868, rule: { sizes: ['1320x2868', '1290x2796', '1260x2736'] }, viewport: { width: 440, height: 900 }, scenes: TALL_PHONE },
  'appstore-ipad13': { store: 'appstore', width: 2064, height: 2752, rule: { sizes: ['2064x2752', '2048x2732'] }, viewport: { width: 1032, height: 1300 }, scenes: ['list', 'add', 'sync', 'due'] },
};

/** What breaks the device's store rule, if anything. */
export function deviceProblems(device) {
  const { width: w, height: h, rule } = DEVICES[device];
  const problems = [];
  if (rule.sizes && !rule.sizes.includes(`${w}x${h}`)) problems.push(`${w}x${h} is not one of ${rule.sizes.join(', ')}`);
  if (rule.sides) {
    const [min, max] = rule.sides;
    if (Math.min(w, h) < min || Math.max(w, h) > max) problems.push(`sides ${w} and ${h} must lie within ${min} to ${max}`);
    if (Math.max(w, h) > 2 * Math.min(w, h)) problems.push(`${w}x${h}: the long side may be at most twice the short one`);
    if (w * 16 !== h * 9) problems.push(`${w}x${h} is not 9:16`);
  }
  return problems.map((p) => `${device}: ${p}`);
}

export const FEATURE_GRAPHIC = { width: 1024, height: 500 };
export const ICON = { width: 512, height: 512 };

/**
 * The frame of one device in output pixels: the caption band on top, then a phone or tablet body
 * whose screen runs to the bottom edge (the body's foot bleeds off). The app is filmed at the
 * device's viewport (a real device's CSS size, minus its system bars); the screen gets that
 * shape at the height below the band, so the whole app down to its tab bar is in the frame.
 */
export function layout(device) {
  const { width: W, height: H, viewport } = DEVICES[device];
  const unit = W / 1080;
  const band = Math.round(Math.min(H * 0.22, W * 0.4));
  const bezel = Math.round(16 * unit);
  const top = band + bezel;
  const scale = (H - top) / viewport.height;
  const width = Math.round(viewport.width * scale);
  const x = Math.round((W - width) / 2);
  if (x - bezel < 40 * unit) throw new Error(`${device}: the screen (${width} px) leaves no margin in ${W} px`);
  return {
    unit,
    band,
    body: { x: x - bezel, y: band, width: width + 2 * bezel, radius: Math.round(56 * unit), bezel },
    screen: { x, y: top, width, height: H - top, radius: Math.round(42 * unit) },
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
