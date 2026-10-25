/**
 * Colour tokens: Radix Colors 3.0 sand, indigo and orange, light and dark (docs/redesign/DESIGN.md §2).
 * Must match `styles/tokens.css` (tested): the scales, and which step each role or v1 alias points at.
 */
type Scale = readonly [string, string, string, string, string, string, string, string, string, string, string, string];
export type Scheme = 'light' | 'dark';
export type ScaleName = 'sand' | 'indigo' | 'orange';

export const RADIX: Record<Scheme, Record<ScaleName, Scale>> = {
  light: {
    sand: ['#FDFDFC', '#F9F9F8', '#F1F0EF', '#E9E8E6', '#E2E1DE', '#DAD9D6', '#CFCECA', '#BCBBB5', '#8D8D86', '#82827C', '#63635E', '#21201C'],
    indigo: ['#FDFDFE', '#F7F9FF', '#EDF2FE', '#E1E9FF', '#D2DEFF', '#C1D0FF', '#ABBDF9', '#8DA4EF', '#3E63DD', '#3358D4', '#3A5BC7', '#1F2D5C'],
    orange: ['#FEFCFB', '#FFF7ED', '#FFEFD6', '#FFDFB5', '#FFD19A', '#FFC182', '#F5AE73', '#EC9455', '#F76B15', '#EF5F00', '#CC4E00', '#582D1D'],
  },
  dark: {
    sand: ['#111110', '#191918', '#222221', '#2A2A28', '#31312E', '#3B3A37', '#494844', '#62605B', '#6F6D66', '#7C7B74', '#B5B3AD', '#EEEEEC'],
    indigo: ['#11131F', '#141726', '#182449', '#1D2E62', '#253974', '#304384', '#3A4F97', '#435DB1', '#3E63DD', '#5472E4', '#9EB1FF', '#D6E1FF'],
    orange: ['#17120E', '#1E160F', '#331E0B', '#462100', '#562800', '#66350C', '#7E451D', '#A35829', '#F76B15', '#FF801F', '#FFA057', '#FFE0C2'],
  },
};

type Step = readonly [ScaleName, number];
/** Each colour token → its Radix step. `handle` differs by scheme: orange-10 on light sand-1 (3.27:1), orange-9 on dark. */
const STEPS = {
  bg: ['sand', 1],
  text: ['sand', 12],
  'text-2': ['sand', 11],
  line: ['sand', 6],
  'line-2': ['sand', 7],
  field: ['sand', 2],
  'field-line': ['sand', 8],
  data: ['indigo', 9],
  'data-top': ['indigo', 11],
  link: ['indigo', 11],
  'link-line': ['indigo', 8],
  focus: ['indigo', 9],
  handle: { light: ['orange', 10], dark: ['orange', 9] },
  // v1 aliases
  paper: ['sand', 1],
  well: ['sand', 2],
  rule: ['sand', 6],
  ink: ['sand', 12],
  'ink-2': ['sand', 11],
  'ink-3': ['sand', 10],
  live: { light: ['orange', 10], dark: ['orange', 9] },
  // orange-11 is 4.43:1 on light sand-1, under the text floor, so error text takes orange-12.
  'live-ink': ['orange', 12],
  'live-wash': ['orange', 3],
  'series-1': ['indigo', 9],
  'series-2': ['sand', 12],
  'note-wash': ['sand', 3],
} as const satisfies Record<string, Step | Record<Scheme, Step>>;

export type Token = keyof typeof STEPS;

/** Where a token points in a scheme, e.g. `['orange', 10]`. */
export function stepOf(token: Token, scheme: Scheme): Step {
  const s: Step | Record<Scheme, Step> = STEPS[token];
  return 'light' in s ? s[scheme] : s;
}

const resolve = (scheme: Scheme) =>
  Object.fromEntries(Object.keys(STEPS).map((t) => {
    const [scale, n] = stepOf(t as Token, scheme);
    return [t, RADIX[scheme][scale][n - 1]];
  })) as Record<Token, string>;

/** Token → hex in the light scheme (the default) and in the dark scheme. */
export const PALETTE: Readonly<Record<Token, string>> = resolve('light');
export const PALETTE_DARK: Readonly<Record<Token, string>> = resolve('dark');
export const PALETTES: Readonly<Record<Scheme, Readonly<Record<Token, string>>>> = { light: PALETTE, dark: PALETTE_DARK };

/** Hue-coded series: indigo (data), ink, orange (the handle). At most 3: see D22. */
export const SERIES: readonly string[] = [PALETTE['series-1'], PALETTE['series-2'], PALETTE.live];
export const SERIES_DARK: readonly string[] = [PALETTE_DARK['series-1'], PALETTE_DARK['series-2'], PALETTE_DARK.live];

/** Surfaces that text and graphics sit on. */
export const SURFACES: readonly string[] = [PALETTE.paper, PALETTE.well];
export const SURFACES_DARK: readonly string[] = [PALETTE_DARK.paper, PALETTE_DARK.well];

/** Tokens used as text (WCAG ≥ 4.5) and as graphics only (≥ 3). */
export const TEXT_TOKENS: readonly Token[] = ['ink', 'ink-2', 'link', 'live-ink'];
export const GRAPHIC_TOKENS: readonly Token[] = ['handle', 'data', 'focus', 'series-2', 'ink-3'];
