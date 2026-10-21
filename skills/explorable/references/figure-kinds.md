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

A registry model on a `curve` (today only `diffusion-forward`) gets nothing filled in, so set these too:

| Option | Meaning |
|---|---|
| `xParam` | the param on the x axis (default: the first control) |
| `series` | up to 3 list outputs, each sampled at even steps along the x track; for `diffusion-forward`, `signalSeries` and `noiseSeries` (index = t) |
| `refSeries` | the one of `series` drawn as the dotted reference, if any |
| `markers`, `markerLabels` | number outputs drawn as vertical markers at that x (`crossT`), and their labels; `{marker}` fills in the x |
| `tableColumns`, `tableStep` | number outputs shown as "Show data" columns, and the x spacing of its rows (default: the param's step) |

The diffusion signal/noise figure, complete:

```json
"model": { "id": "diffusion-forward", "params": { "t": 100, "seed": 2020 } },
"controls": ["t"],
"readouts": ["alphaBar", "snrDb"],
"options": {
  "handle": "t", "xParam": "t",
  "series": ["signalSeries", "noiseSeries"],
  "seriesLabels": ["signal √ᾱ_t", "noise √(1−ᾱ_t)"],
  "seriesSpoken": ["signal, square root of alpha-bar", "noise, square root of one minus alpha-bar"],
  "markers": ["crossT"], "markerLabels": ["signal = noise (t ≈ {marker})"],
  "ticks": ["0", "250", "500", "750", "1000"], "yLabel": "coefficient",
  "markEvery": 100, "tableStep": 10, "tableColumns": ["alphaBar", "signal", "noise", "snrDb"],
  "describe": "At t = {t}, alpha-bar is {alphaBar}: signal {signal:fixed2}, noise {noise:fixed2}, signal-to-noise ratio {snrDb:fixed1} dB."
}
```

## Rules the audit enforces on options

- `handle` must be one of `controls`.
- No option may hold a colour (`#hex`, `rgb()`, `hsl()`, `oklch()`, `oklab()`): `options.<key> sets a colour; the kit owns the palette`.
- Every label (`labels`, `compareLabels`, `seriesLabels`, `seriesSpoken`, `refLabel`, `markerLabel`, `markerLabels`, `yLabel`) needs a letter or digit, and a template needs words besides its `{placeholder}`: `"{marker}"` fails, `"k = {k}"` passes.
- Every marker, reference and templated value must be finite at every control stop.
