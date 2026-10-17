// Studio Light palette — the single JS source of colour (docs/frontend/DESIGN-CONSULT.md). Mirrors
// the `--studio-*` primitives in global.css one-to-one; AntD's theme (theme.ts) reads these because
// its token algorithm needs concrete values, not CSS variables. Change a colour here AND in global.css.

export const studio = {
  warmWhite: '#faf9f7',
  white: '#ffffff',
  stone: '#f2f1ee',
  hairline: '#eceae6',
  hairlineStrong: '#dcdad5',
  ink: '#17171a',
  ink2: '#2a2a30',
  graphite: '#5a5a60',
  slate: '#636368',
  mist: '#9a9aa0',
  persimmon: '#bf4a1f',
  persimmonDeep: '#a63e17',
  persimmonDeeper: '#8f3412',
  persimmonSoft: '#fbe9de',
  peach: '#f7e6dc',
  lilac: '#e3e6f5',
  ai: '#f2a27e',
  red: '#b3261e',
  green: '#3f6a2c',
  amberInk: '#8a5a12',
  indigo: '#3a4d7a',
  persimmonRing: 'rgba(191, 74, 31, 0.35)',
  inkShadowContact: 'rgba(23, 23, 26, 0.06)',
  inkShadowAmbient: 'rgba(23, 23, 26, 0.1)',
} as const;

/** Ink night — mirrors the `[data-theme='dark']` block in global.css (provisional, deferred). */
export const studioNight = {
  canvas: '#111113',
  surface: '#1b1b1f',
  sunken: '#0c0c0e',
  border: '#2c2c32',
  text: '#f4f3f1',
  textSecondary: '#b9b9bf',
  persimmon: '#e8784b',
  persimmonHover: '#ee8c63',
  persimmonActive: '#f0936b',
  amber: '#e2b865',
  success: '#8bb873',
  error: '#ef7a6c',
  info: '#9aaed6',
} as const;

export const fonts = {
  body: '"Inter","Noto Naskh Arabic",system-ui,-apple-system,"Segoe UI",sans-serif',
  heading: '"Outfit","Noto Naskh Arabic",system-ui,-apple-system,"Segoe UI",sans-serif',
} as const;
