// Usage: node m3-scheme.mjs [#seed]: prints the Material 3 tonal-spot roles (light and dark)
// that Flutter's ColorScheme.fromSeed builds, as JSON.
import { Hct, SchemeTonalSpot, MaterialDynamicColors, argbFromHex, hexFromArgb } from '@material/material-color-utilities';

const seed = Hct.fromInt(argbFromHex(process.argv[2] ?? '#2E7D32'));
const roles = ['primary', 'onPrimary', 'primaryContainer', 'onPrimaryContainer', 'secondary', 'onSecondary',
  'secondaryContainer', 'onSecondaryContainer', 'tertiary', 'onTertiary', 'tertiaryContainer', 'onTertiaryContainer',
  'error', 'onError', 'errorContainer', 'onErrorContainer', 'surface', 'onSurface', 'onSurfaceVariant',
  'surfaceContainerLowest', 'surfaceContainerLow', 'surfaceContainer', 'surfaceContainerHigh', 'surfaceContainerHighest',
  'outline', 'outlineVariant', 'inverseSurface', 'inverseOnSurface', 'inversePrimary'];
const out = {};
for (const isDark of [false, true]) {
  const scheme = new SchemeTonalSpot(seed, isDark, 0);
  out[isDark ? 'dark' : 'light'] = Object.fromEntries(roles.map((r) => [r, hexFromArgb(MaterialDynamicColors[r].getArgb(scheme))]));
}
console.log(JSON.stringify(out, null, 2));
