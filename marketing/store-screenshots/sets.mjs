// What the stores get: every device's output size, the capture it frames and the scenes it shows,
// in store order. The frame is P2 „Großschrift“ (job 77, picked by Peter on 2026-11-02): a
// two-line caption on honey, the real app as a card standing on the foot (frame.mjs).
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

/**
 * The app as filmed: a viewport in CSS pixels at a device pixel ratio. Every phone frame shows the
 * one phone capture (an Android-sized 360 x 800 screen, as job 77's P2 set), so Play and App Store
 * show the same app at the same type size; the tablets have their own.
 */
export const CAPTURES = {
  phone: { viewport: { width: 360, height: 800 }, dpr: 3 },
  tablet: { viewport: { width: 800, height: 1280 }, dpr: 2 },
};

// P2's order: the shared list first, the sync second, the voice shot later (Q35 N1).
const PHONE = ['list', 'sync', 'add', 'order', 'tick', 'invite'];
const TABLET = ['list', 'sync', 'add', 'order'];

export const DEVICES = {
  'play-phone': { store: 'play', width: 1080, height: 1920, rule: { sides: [320, 3840] }, capture: 'phone', scenes: PHONE },
  'play-tablet7': { store: 'play', width: 1440, height: 2560, rule: { sides: [320, 3840] }, capture: 'tablet', scenes: TABLET },
  'play-tablet10': { store: 'play', width: 1800, height: 3200, rule: { sides: [1080, 7680] }, capture: 'tablet', scenes: TABLET },
  // The 6.9-inch slot, which also takes 6.7-inch files (1290 x 2796); App Store Connect scales it
  // down for the smaller iPhones.
  'appstore-iphone69': { store: 'appstore', width: 1320, height: 2868, rule: { sizes: ['1320x2868', '1290x2796', '1260x2736'] }, capture: 'phone', scenes: PHONE },
  'appstore-iphone65': { store: 'appstore', width: 1284, height: 2778, rule: { sizes: ['1284x2778', '1242x2688'] }, capture: 'phone', scenes: PHONE },
  'appstore-ipad13': { store: 'appstore', width: 2064, height: 2752, rule: { sizes: ['2064x2752', '2048x2732'] }, capture: 'tablet', scenes: TABLET },
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

/** Every capture the run films: (locale, capture, scene), each once, whatever device frames it. */
export function captures({ locales = Object.keys(LOCALES), stores = STORES } = {}) {
  const seen = new Set();
  return locales.flatMap((locale) =>
    Object.values(DEVICES)
      .filter((d) => stores.includes(d.store))
      .flatMap((d) => d.scenes.map((scene) => ({ locale, capture: d.capture, scene })))
      .filter((c) => !seen.has(`${c.locale} ${c.capture} ${c.scene}`) && seen.add(`${c.locale} ${c.capture} ${c.scene}`)));
}

/** Every (locale, device, scene) the run writes, numbered per device in store order. */
export function shots({ locales = Object.keys(LOCALES), stores = STORES } = {}) {
  return locales.flatMap((locale) =>
    Object.entries(DEVICES)
      .filter(([, d]) => stores.includes(d.store))
      .flatMap(([device, d]) => d.scenes.map((scene, i) => ({ locale, device, capture: d.capture, scene, n: i + 1 }))));
}
