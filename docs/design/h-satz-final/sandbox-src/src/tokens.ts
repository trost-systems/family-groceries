import { Hct, MaterialDynamicColors, SchemeTonalSpot, hexFromArgb, type DynamicColor } from '@material/material-color-utilities'

/** Same seed and algorithm as the Flutter app: ThemeData(colorSchemeSeed: Color(0xFF2E7D32)) -> SchemeTonalSpot. */
export const SEED = 0xff2e7d32

const ROLES = [
  'primary', 'onPrimary', 'primaryContainer', 'onPrimaryContainer',
  'secondary', 'onSecondary', 'secondaryContainer', 'onSecondaryContainer',
  'tertiary', 'onTertiary', 'tertiaryContainer', 'onTertiaryContainer',
  'error', 'onError', 'errorContainer', 'onErrorContainer',
  'surface', 'onSurface', 'onSurfaceVariant', 'surfaceDim', 'surfaceBright',
  'surfaceContainerLowest', 'surfaceContainerLow', 'surfaceContainer', 'surfaceContainerHigh', 'surfaceContainerHighest',
  'outline', 'outlineVariant', 'inverseSurface', 'inverseOnSurface', 'inversePrimary', 'scrim',
] as const

const kebab = (s: string) => s.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)

export function schemeVars(dark = false): Record<string, string> {
  const scheme = new SchemeTonalSpot(Hct.fromInt(SEED), dark, 0)
  const colors = MaterialDynamicColors as unknown as Record<string, DynamicColor>
  return Object.fromEntries(ROLES.map((r) => [`--md-${kebab(r)}`, hexFromArgb(colors[r].getArgb(scheme))]))
}

/** Type, shape and spacing scale (M3 type scale on the system font stack; no web fonts at runtime). */
const STATIC_VARS: Record<string, string> = {
  '--font': 'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  '--font-hand': '"Bradley Hand", "Segoe Print", "Comic Sans MS", "Chalkboard SE", cursive',
  '--radius-xs': '4px',
  '--radius-s': '8px',
  '--radius-m': '12px',
  '--radius-l': '16px',
  '--radius-xl': '28px',
  '--space-1': '4px',
  '--space-2': '8px',
  '--space-3': '12px',
  '--space-4': '16px',
  '--space-5': '24px',
  '--elev-1': '0 1px 2px rgb(0 0 0 / 0.18), 0 1px 3px 1px rgb(0 0 0 / 0.08)',
  '--elev-2': '0 1px 2px rgb(0 0 0 / 0.2), 0 2px 6px 2px rgb(0 0 0 / 0.1)',
  '--elev-3': '0 4px 8px 3px rgb(0 0 0 / 0.12), 0 1px 3px rgb(0 0 0 / 0.2)',
}

export function installTokens(): void {
  const root = document.documentElement
  for (const [k, v] of Object.entries({ ...schemeVars(false), ...STATIC_VARS })) root.style.setProperty(k, v)
}
