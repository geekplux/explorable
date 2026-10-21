/** v1 light-theme colour tokens. Must match `styles/tokens.css` (tested). */
export const PALETTE = {
  paper: '#FBF8F1',
  well: '#F3EEE2',
  rule: '#D8D0BF',
  ink: '#1D1B17',
  'ink-2': '#5A554B',
  'ink-3': '#7A7365',
  live: '#C4451C',
  'live-ink': '#A93A12',
  'live-wash': '#FBE3D8',
  'series-1': '#2851C0',
  'series-2': '#0F8A6E',
  'note-wash': '#F6E7B8',
} as const;

export type Token = keyof typeof PALETTE;

/** Hue-coded series (cobalt, teal, vermilion = the live item). At most 3: see D22. */
export const SERIES: readonly string[] = [PALETTE['series-1'], PALETTE['series-2'], PALETTE.live];

/** Surfaces that text and graphics sit on. */
export const SURFACES: readonly string[] = [PALETTE.paper, PALETTE.well];

/** Tokens used as text (WCAG ≥ 4.5) and as graphics only (≥ 3). */
export const TEXT_TOKENS: readonly Token[] = ['ink', 'ink-2', 'live-ink', 'series-1'];
export const GRAPHIC_TOKENS: readonly Token[] = ['live', 'series-1', 'series-2', 'ink-3'];
