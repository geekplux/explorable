# Figure kinds

There are four kinds, all flat SVG drawn by `kit/src/figures/*.ts`. The schema rejects any other `kind` (`must be one of bars, bits, histogram, curve`), and the audit rejects a kind the model cannot show. There is no 3D kind: a depth axis that only decorates hides values behind each other, and a rotating view takes the reader's hand off the one parameter that matters.

Every kind gets the same frame from the runtime (`kit/src/runtime/mount.ts`): the title, the drawing, a labelled native control for each name in `controls`, the readout strip (`label value unit · …`), a live description, and a "Show data" table.

## `bars`: a distribution over labelled items

Models: `softmax-temperature`, `attention-scaling`. The tallest bar gets a filled ▼ and the word "top", not a colour.

| Option | Meaning |
|---|---|
| `labels` | one label per bar, e.g. `["mat", "rug", "floor"]` (set `n` to match for `softmax-temperature`) |
| `query` | a chip above the bars: `query: sat` |
| `itemName` | the table's item column header (default `item`) |
| `compare` | `true`: dashed outlines show the weights at the other switch setting (`attention-scaling`) |
| `compareLabels` | legend text for the two settings |
| `ticks` | labelled values on the knob's track, as strings: `["0.1", "1", "5"]` |

## `bits`: a bit array with hashed probes

Model: `bloom-filter`. Each cell shows a `1` or `0` glyph as well as its fill; a false positive gets a 45° hatch and the words "maybe (false positive)". The knob on the word row drives `options.handle` (default `n`).

## `histogram`: samples over one axis with a reference curve

Model: `diffusion-forward`.

| Option | Meaning |
|---|---|
| `ghost` | `true`: the t = 0 histogram as a dashed outline |
| `refLabel` | direct label of the dotted reference curve (default `N(0, 1)`) |
| `ticks` | labelled values on the step track |

## `curve`: y = f(x) with a draggable point

Models: `expr-curve` (always), `diffusion-forward`. Up to 3 series, one of which may be the dotted reference: solid with ● markers, dashed with ■, dash-dot with ▲, each directly labelled, so no line depends on its hue.

For `expr-curve` the kit fills `series`, `seriesLabels`, `markers` and `yLabel` from the model; set these when you need them:

| Option | Meaning |
|---|---|
| `handle` | `"x"`: the ring knob rides the curve |
| `x0`, `xStep` | the knob's start and snap step |
| `xSymbol` | short name of x in the slider and table (`"t"`) |
| `xFormat`, `yFormat` | readout formats: `int`, `fixed1`, `fixed2`, `fixed3`, `percent`, `sci`, `sig3` |
| `refExpr`, `refLabel` | a second, dotted curve and its label |
| `markerExpr`, `markerLabel` | a vertical marker at x = f(params) and its label, e.g. `"gap halves at {marker} min"` |
| `seriesLabels`, `seriesSpoken` | direct labels of the curve and the reference, and their spoken forms; `{name}` fills in a value |
| `describe` | the live sentence, e.g. `"At {x} minutes the cup is at {y} °C."` |
| `ticks`, `markEvery` | labelled x ticks (strings) and spacing of the ●/■ markers |
| `yMin`, `yMax`, `yLabel` | for registry curves; `expr-curve` takes them from `model.y` |

A registry model on a `curve` also needs `xParam`, `series` (list outputs), `markers` and `tableColumns`; copy them from the diffusion sample in the app (`src/samples/diffusion.json` in the repository).

## Rules the audit enforces on options

- `handle` must be one of `controls`.
- No option may hold a colour (`#hex`, `rgb()`, `hsl()`, `oklch()`, `oklab()`): `options.<key> sets a colour; the kit owns the palette`.
- Every label (`labels`, `compareLabels`, `seriesLabels`, `seriesSpoken`, `refLabel`, `markerLabel`, `markerLabels`, `yLabel`) needs a letter or digit, and a template needs words besides its `{placeholder}`: `"{marker}"` fails, `"k = {k}"` passes.
- Every marker, reference and templated value must be finite at every control stop.
