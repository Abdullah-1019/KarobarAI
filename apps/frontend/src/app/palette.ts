// Haveli palette — the single JS source of colour (docs/frontend/WORKLOG.md). Mirrors the
// `--haveli-*` primitives in global.css one-to-one; AntD's theme (theme.ts) reads these because its
// token algorithm needs concrete values, not CSS variables. Change a colour here AND in global.css.

export const haveli = {
  parchment: '#faf6ef',
  cream: '#fffdf9',
  sand: '#f1e8da',
  linen: '#e7dccb',
  clay: '#d4c4ab',
  espresso: '#2b1d14',
  walnut: '#5a3a22',
  umber: '#6b5a4b',
  taupe: '#7d6a58',
  copper: '#ae5429',
  copperDeep: '#9a4722',
  copperDeeper: '#7e3a1c',
  peachClay: '#f6e3d6',
  sindoor: '#c8402e',
  brass: '#c9963f',
  haldi: '#f6e7c4',
  moss: '#4f7a3a',
  indigo: '#3a4d7a',
  kiln: '#b3261e',
  turmericInk: '#8a5a12',
  copperRing: 'rgba(174, 84, 41, 0.28)',
  espressoShadow: 'rgba(43, 29, 20, 0.14)',
} as const;

/** Haveli at night — mirrors the `[data-theme='dark']` block in global.css. */
export const haveliNight = {
  canvas: '#17110c',
  surface: '#211912',
  sunken: '#120d09',
  border: '#3a2c20',
  text: '#f3eadf',
  textSecondary: '#c2b2a0',
  copper: '#e07a45',
  copperHover: '#e88d5d',
  copperActive: '#c96a39',
  brass: '#e2b865',
  success: '#8bb873',
  error: '#ef7a6c',
  info: '#9aaed6',
} as const;

export const fonts = {
  body: '"Inter","Noto Naskh Arabic",system-ui,-apple-system,"Segoe UI",sans-serif',
} as const;
