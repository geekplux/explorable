# Built-in samples: essays and figure specs

Written by `explorable-designer` on 2026-10-19 for Phase 1, with the figure details that Phases 4 to 7 build. Binding inputs: `CLAUDE.md` and `docs/PLAN.md` (§2, §4, §5.2, §5.3, §5.10, Phases 1 and 4 to 7).

This file covers what all three samples share: the field mapping to ExplorableDoc v1, the field names this spec invents, the readout, keyboard, encoding and motion rules, and the seeded random source. Each sample has its own file with the essay prose, the figure specs, the hand-computed fixtures and a JSON skeleton you can transcribe into `src/samples/<slug>.json`:

| Slug | Title | Source | Spec | Figures (kind, model, phase) |
|---|---|---|---|---|
| `attention` | Why attention divides by √d | Vaswani et al. 2017, arXiv:1706.03762 | [attention.md](attention.md) | `bars` / `softmax-temperature` (P4); `bars` / `attention-scaling` (P5) |
| `bloom-filter` | How a Bloom filter says “maybe” | Bill Mill, *Bloom Filters by Example* | [bloom-filter.md](bloom-filter.md) | `bits` / `bloom-filter` (P5); `curve` / `expr-curve` (P7) |
| `diffusion` | Noise, one step at a time | Ho, Jain, Abbeel 2020, arXiv:2006.11239 | [diffusion.md](diffusion.md) | `histogram` / `diffusion-forward` (P6); `curve` / `diffusion-forward` (P7) |

The order on the gallery is attention, bloom-filter, diffusion. The plan's keyboard check ("Tab to the second card … `/s/bloom-filter`") depends on it.

---

## 1. The one idea per sample, and the order the reader meets it

Every essay follows the same arc: (1) the smallest version of the mechanism with one knob, (2) what the reader finds by dragging, (3) where the effect comes from, (4) the fix or the formula, (5) a takeaway the reader could say aloud. Each figure teaches one idea. The second figure in each essay adds a dimension to the first and never replaces it.

| Sample | Fig 1 teaches | Fig 2 teaches |
|---|---|---|
| attention | The scale of the scores, not their order, decides how sharp the softmax is. | Dot products of width d_k spread out like √d_k, so unscaled attention saturates. Dividing by √d_k fixes it at every width. |
| bloom-filter | A false "maybe" is possible, a false "no" is not. Load (n) and hash count (k) decide how full the bits get. | The false-positive rate against n, and the best k = (m/n)·ln 2. |
| diffusion | Shrink-and-add-noise steps turn any data into N(0, 1). The closed form jumps to any t. | The schedule's shape: signal √ᾱ_t and noise √(1−ᾱ_t) cross at t ≈ 260. |

## 2. Mapping to ExplorableDoc v1 (PLAN §5.2)

The JSON skeletons in each sample file are valid ExplorableDoc v1 as the plan defines it, plus the invented fields listed in §3. Constraints I checked by script against every skeleton: title ≤ 90 characters, dek ≤ 220, 2 to 6 sections, 1 to 4 paragraphs per section, each paragraph ≤ 700, takeaway ≤ 300, alt ≥ 40, 1 to 3 controls, 1 to 3 readouts.

- `schema: 1`. `id` is the slug.
- `source`: `kind`, `url`, `title`, `authors`, `year`. The Bloom post has no year on the page that I can verify, so `year` is left out (it is optional).
- `provenance`: `{ "mode": "curated", "generatedAt": "2026-10-19T00:00:00.000Z" }`. There is no `model` field for curated docs.
- `sections[].paragraphs` use only the inline formatter from §5.2: `*em*`, `**strong**` and `` `code` ``. Formulas go in `` `code` `` so they render in monospace (D19). Quotes in prose are typographic (“ ” ‘ ’), so the JSON needs no escaped quotes.
- `figure.model.params` holds the **initial** value of every model parameter the figure uses, including fixed ones such as seeds and scores. Ranges, steps and units live in the registry `ModelDef`, not in the doc, except for `expr-curve`, where the doc declares them (plan §5.2).
- `figure.controls` lists the parameter names the reader can change. `figure.readouts` lists the output ids shown in the readout strip.

## 3. Field names this spec invents (the plan is silent on these)

The implementer should add each of these to the schema (P3) or registry (P4 to P7), or push back. All are optional, so the docs stay valid if a field is dropped.

**In the doc (`FigureSpec.options`, which the plan already types as `Record<string, string | number | boolean | string[]>`):**

| Option | Kind | Meaning |
|---|---|---|
| `handle` | all | The parameter name that gets the on-figure ring knob. Every control also gets a labelled native slider, radio group or switch in the controls row. |
| `labels` | `bars` | Category labels, one per bar. |
| `query` | `bars` | The asking token, shown as a chip, e.g. "query: sat". |
| `compare` | `bars` | `true` draws the weights for the *other* toggle state as dashed ink outlines (attention Fig 2). |
| `scoreStrip` | `bars` | `true` draws the raw scores as dots on a fixed number line above the bars (attention Fig 2). Optional for P5; it may be deferred if the line budget is tight. |
| `ghost` | `histogram` | `true` draws the t = 0 histogram as a dashed ink-3 outline labelled "data (t = 0)". |
| `ticks` | `histogram`, `curve` | Labelled tick values on the scrubber or x axis, as a `string[]` of numbers (the plan's `options` type has no `number[]`). |
| `refLabel` | `histogram`, `curve` | Direct label of the dotted reference curve. |
| `series`, `seriesLabels` | `curve` (registry model) | Output ids of `number[]` outputs to draw as series, and their direct labels. |
| `xParam` | `curve` (registry model) | Which model parameter is the x axis and the knob (`t` for diffusion). The series index is the x value. |
| `markers`, `markerLabels` | `curve` | Output ids (registry) giving x positions of vertical markers, and their labels. |
| `markerExpr`, `markerLabel` | `curve` (`expr-curve`) | A marker x position as a whitelisted expression over the declared params, and its label. The label may hold `{name}` placeholders for declared params and `{marker}` for the marker x, each formatted with fixed1 (integers without decimals). |
| `refExpr` | `curve` (`expr-curve`) | A second, dotted reference curve, written in the same expression language and validated the same way. |
| `x0` | `curve` (`expr-curve`) | Initial knob position on x. |
| `xStep` | `curve` (`expr-curve`) | Snap step for the knob on x. The default is continuous, rounded to (max − min)/1000. |
| `describe` | `curve` (`expr-curve`) | Live-description template with `{x}`, `{y}` and `{name}` placeholders, formatted with the readout formats. The default is `At {x.label} = {x}, {y.label} is {y}.` |
| `xFormat`, `yFormat` | `curve` (`expr-curve`) | Readout formats for the `x` and `y` outputs. |

**In the doc schema (`expr-curve` model):** `params[].step` (optional number). Without it the step is (max − min)/100. The Bloom Fig 2 `k` needs `step: 1`.

**In `figure.controls` for `expr-curve`:** the name `x` means "the knob on the curve". It counts toward the 1 to 3 controls.

**`expr-curve` outputs:** `x`, `y` (the knob's point), plus `marker` when `markerExpr` is set.

**In the registry (`ModelDef.params[*]`), not the doc:**
- `control?: 'range' | 'toggle' | 'choice'`. The default is `range`. `toggle` renders a switch (`role="switch"`) for a 0/1 param. `choice` renders a radio group from `choices`.
- `choices?: string[]`: labels for a `choice` param; the param value is the index.
- `pageStep?: number`: PageUp/PageDown step. The default is 10 × `step` (diffusion `t` uses 50, as P6 requires).

**In `format.ts`:** a new `sig3` format (see §4) and the rule that non-finite values print as `∞` or `−∞`.

## 4. Readouts and number formats

The readout strip shows each readout as `<label> <value>[ <unit>]`, joined by ` · ` (a middle dot with spaces), in monospace with tabular numerals. Example: `top weight 0.51 · entropy 2.05 bits`.

| Format | Rule | Examples |
|---|---|---|
| `int` | round half away from zero, no grouping below 10,000 | `20`, `260` |
| `fixed1` / `fixed2` / `fixed3` | `toFixed(n)`; negative zero prints as `0.00` | `7.93`, `0.000` |
| `percent` | × 100. One decimal at ≥ 1 %, two decimals below 1 %, `0%` for exactly 0 | `14.7%`, `0.07%`, `0%` |
| `sci` | 3 significant digits, `4.04 × 10⁻⁵` (Unicode superscripts) | |
| `sig3` *(invented)* | 3 significant digits in plain notation when \|v\| ≥ 0.001, else `sci` | `1.00`, `0.897`, `0.0786`, `0.00335`, `4.04 × 10⁻⁵` |
| any | `Infinity` → `∞`, `-Infinity` → `−∞` | `∞ dB` |

`aria-valuetext` on a control is `<label> <value> <unit>` with words, never symbols that a screen reader mangles: "temperature 0.50", "key width d k 64", "step t 260", "hashes per word 3".

## 5. Controls and keyboard (all figures)

- Every control exists twice and stays in sync: a labelled native control in the controls row (range, radio group or switch), plus, for the param named in `options.handle`, an on-figure ring knob with `role="slider"`.
- **Linear params:** Arrow keys move ± `step`, PageUp/PageDown move ± `pageStep` (default 10 × `step`), Home/End go to min/max.
- **Log-scale params** (`scale: 'log'`): Arrow keys move 1 % of the log range and PageUp/PageDown 10 %. The result rounds to `step` and always moves by at least one `step`. Dragging is continuous in log space, then rounded.
- Values always clamp to [min, max] and round to `step`. The displayed value and the model input are the same rounded number.
- Hit area ≥ 44 × 44 CSS px for every knob, thumb and radio (A7).

## 6. Visual vocabulary (only the three plan hues; never colour alone)

| Meaning | Encoding |
|---|---|
| Draggable / the reader's hand | vermilion `--live` hollow ring knob, 2.5 px stroke, paper fill, 3-line grip. **Used for nothing else.** |
| Primary data | cobalt `--series-1` fill with a 1 px `--ink` outline (bars, histogram), or a solid 2 px line with circle markers (curves) |
| Secondary data | teal `--series-2` dashed (6 3) 2 px line with square markers |
| Reference / theory | dotted ink line (1.5 px, dash 1 3, round caps), always directly labelled |
| "Other setting" comparison | dashed ink outline, no fill, labelled in a legend that shows the outline |
| Uncertain / false positive | 45° hatch in `--ink-2` (4 px spacing, 1 px) plus the text label "maybe (false positive)" |
| Highlighted maximum | a filled ink ▼ triangle above the bar plus the text "top", and the value label in bold |

**Deviation from P4 AC 6 (recommendation):** the plan says the top bar carries a "ring marker". A ring means "you can drag this" (§4.1), so a ring on a bar that cannot be dragged breaks the one rule the identity relies on. Use the filled ▼ plus "top" instead. If the main agent keeps the ring, it must be visibly different from the knob (filled, no grip).

Hairline grids use `--rule` and carry no meaning. Text on figures uses `--ink` or `--ink-2`, never a series hue, except focus rings (cobalt, 3 px).

## 7. Motion (all figures)

- Dragging is 1:1, with no easing. Keyboard steps and slider jumps ease with an exponential follow (τ = 90 ms) applied to the **drawn** values only. The model always computes the exact target, and readouts show the target value at once, so a readout never shows an in-between number.
- The one-time hint (8 px knob nudge, 600 ms, 1.2 s after first view) runs once per figure and never after an interaction.
- `prefers-reduced-motion: reduce`: no easing, no nudge. The hint becomes a static dashed ring with the text "drag". Nothing else changes, because every figure's meaning is in its states, not in its motion.
- Figures compute only while on screen.

## 8. Seeded randomness (shared by `attention-scaling` and `diffusion-forward`)

Use the plan's `mulberry32` exactly:

```
mulberry32(a): returns () => { a |= 0; a = a + 0x6D2B79F5 | 0;
  let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
  return ((t ^ t >>> 14) >>> 0) / 4294967296 }
```

Fixture: `mulberry32(42)` yields `0.6011037519, 0.4482905590, 0.8524657935, 0.6697340414, 0.1748138987`.

Standard normals use Box–Muller with **one normal per two uniforms** (the sine branch is discarded, so the stream order is simple and reproducible): `u1 = 1 − rng()` (in (0, 1], so `ln` is finite), `u2 = rng()`, `z = √(−2 ln u1) · cos(2π u2)`. Each model states the exact draw order. The fixtures in the sample files depend on that order, so do not change it without regenerating them.

## 9. Phase 1 (static) rendering

Until a figure kind exists, its shell shows the "FIG. n" kicker, the title, the `alt` text as the body of the figure area (in `--ink-2`, not hidden), and the caption. The alt texts are written to stand alone as a description of the default state, so the static essay still reads well. Card thumbnails (P2, P6) show each sample's Fig 1 in its default state.

## 10. Content guards

All three essays and every word list were checked against the finance guard terms and contain none. The Bloom word lists are animals, fruits, vegetables and herbs only. Sean's employer is not mentioned. Sources are cited with title, authors and link. Direct quotes are avoided; the attention essay paraphrases the paper's √d_k argument and attributes it.
