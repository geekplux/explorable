# Sample `diffusion`: Noise, one step at a time

Shared rules (formats, keyboard, encodings, motion, RNG, optional fields) are in [samples.md](samples.md). This file has the essay, both figure specs, the reference values and the JSON skeleton that became `src/samples/diffusion.json`. Visual details (colours, markers, the knob's look, readout punctuation, motion) follow [DESIGN.md](../redesign/DESIGN.md) and the kit where they differ from this file.

- **Title:** Noise, one step at a time
- **Dek:** A diffusion model's forward process blurs data into pure Gaussian noise over 1,000 small steps, and a closed form jumps straight to any step: x_t = √ᾱ_t·x₀ + √(1−ᾱ_t)·ε.
- **Source:** Jonathan Ho, Ajay Jain, Pieter Abbeel. *Denoising Diffusion Probabilistic Models*. 2020. arXiv:2006.11239, https://arxiv.org/abs/2006.11239
- **Gallery thumbnail:** Fig 1 at its default state (t = 0: the two clumps).

## Essay flow

| # | Section id | Heading | Figure | Reader's job |
|---|---|---|---|---|
| 1 | `start-with-data` | Start with data | none | Meet the toy data: two clumps of numbers. |
| 2 | `one-small-step` | One small step | none | The single-step rule, and why it shrinks as well as adds noise. |
| 3 | `jump-to-any-step` | Jump to any step | `fig-histogram` | Scrub t; watch the clumps blur, merge and become N(0, 1). |
| 4 | `signal-and-noise` | Signal fades, noise rises | `fig-signal-noise` | See the schedule's shape; find the crossing at t ≈ 260. |
| 5 | `why-it-matters` | Why the shortcut matters | none | Connect the closed form to how DDPM trains. |

Progressive disclosure: sections 1 and 2 build the one-step rule in words. Fig 1 shows its effect on real samples. Fig 2 pulls out the two numbers that drive Fig 1 and plots them over the whole schedule.

The JSON skeleton at the end holds the first draft of the prose; the shipped text is in `src/samples/diffusion.json`.

---

## Shared model: `diffusion-forward` (used by both figures)

Registry params:

| Param | Label | Min | Max | Step | pageStep | Default | Unit | Control |
|---|---|---|---|---|---|---|---|---|
| `t` | step t | 0 | 1000 | 1 | 50 | 0 | – | range (with knob) |
| `seed` | seed | 0 | 2³²−1 | 1 | – | 2020 | – | not exposed |

**Constants:** T = 1000, β₁ = 1e-4, β_T = 0.02. Data: N = 2,000 samples, modes μ = −2 and +1.5, σ = 0.25, equal weight. Histogram: 60 bins over [−4, 4), so the bin width is w = 8/60.

**Schedule (computed once at module load, in double precision):**
- `β_t = 1e-4 + (0.02 − 1e-4)·(t − 1)/999` for t = 1 … 1000. So β₁ = 0.0001, β₅₀₀ = 0.010040 and β₁₀₀₀ = 0.02.
- `ᾱ_0 = 1` and `ᾱ_t = ᾱ_(t−1)·(1 − β_t)`, a cumulative product in order. It is stored as a `Float64Array(1001)`.

**Samples (computed once per seed and cached):**
- `rng = mulberry32(seed)`, one normal per two uniforms (samples.md §8).
- Draw order: first 2,000 normals zᵢ for the data, then 2,000 normals εᵢ for the noise.
- `x0ᵢ = (i < 1000 ? −2 : 1.5) + 0.25·zᵢ`. The mode is assigned by index, not drawn, so each clump has exactly 1,000 samples.

**compute({ t }):**
- `s = √ᾱ_t`, `n = √(1 − ᾱ_t)`, `x_tᵢ = s·x0ᵢ + n·εᵢ`.
- `hist[j]`: the count of samples in bin j, divided by N·w (a density). The bin is `j = clamp(floor((x + 4)/w), 0, 59)`, so out-of-range values land in the edge bins. None occur for seed 2020.
- `hist0`: the same for t = 0 (cached).
- `alphaBar = ᾱ_t`, `signal = s`, `noise = n`.
- `snrDb = 10·log₁₀(ᾱ_t/(1 − ᾱ_t))`, which is `+∞` at t = 0 and prints as `∞ dB`.
- `mean` and `sd`: the sample mean and sample SD (divide by N − 1) of `x_t`.
- `signalSeries[t] = √ᾱ_t` and `noiseSeries[t] = √(1 − ᾱ_t)` for t = 0 … 1000 (precomputed, returned by reference).
- `crossT`: the first t with ᾱ_t ≤ 0.5. That is 260; the crossing lies between t = 259 and 260.

Outputs and formats:

| Output | Label | Format | Unit |
|---|---|---|---|
| `alphaBar` | ᾱ_t | `sig3` (samples.md §4) | – |
| `signal` | signal √ᾱ_t | fixed3 | – |
| `noise` | noise √(1−ᾱ_t) | fixed3 | – |
| `snrDb` | SNR | fixed1 (non-finite → ∞) | dB |
| `sd` | spread (SD) | fixed2 | – |
| `mean` | mean | fixed2 | – |
| `hist`, `hist0`, `signalSeries`, `noiseSeries` | – | – | – |
| `crossT` | – | int | – |

**Honesty note on paths (also in the caption).** Each sample keeps one fixed ε across all t, so scrubbing moves each sample smoothly along the straight line from x₀ toward ε. The histogram at every t is exactly the forward-process marginal q(x_t | x₀) = N(√ᾱ_t·x₀, 1 − ᾱ_t), because DDPM's closed form says so. The path a single sample takes between two values of t is *not* the path the step-by-step chain would take, since the real chain adds fresh noise at every step. The figure shows correct snapshots, not correct trajectories.

**Performance.** One compute at t = 500 bins 2,000 samples in about 0.11 ms in Node, far under the 8 ms budget the model tests enforce. The ε table is never resampled while scrubbing.

**Font note.** ᾱ (U+1FB1), ₀ and the Greek letters come from the self-hosted "Explorable Greek" face, and math signs such as √ from the serif or the "Explorable Math" face (`src/styles/fonts.css`); a page fetches each face only when it uses one of its glyphs. Screen-reader strings spell them out ("alpha-bar", "square root of").

---

## Fig 1: `fig-histogram` (kind `histogram`)

**Idea.** Repeated shrink-and-add-noise steps erase any data distribution into N(0, 1), and the closed form shows the state at any step directly.

**Controls.** `t`. A scrubber track under the histogram, 0 to 1000, with the ring knob and labelled ticks at 0, 250, 500, 750 and 1000 (`options.ticks`). It also has a native range with `<output>` showing "t = 0". Keyboard: Arrow ± 1, PageUp/PageDown ± 50, Home 0, End 1000. `aria-valuetext`: "step t 260 of 1000".

**Drawing.**
- **Data bars:** 60 histogram bars in cobalt with a 1 px ink outline.
- **Axes:** the x axis runs from −4 to 4 with ticks at every integer. The y axis is "density", **fixed** from 0 to 1.0 with gridlines at 0.25 steps. It is never autoscaled; the peak at t = 0 is 0.82 and the N(0, 1) peak is 0.40.
- **Reference:** the N(0, 1) density as a dotted ink curve, directly labelled "N(0, 1)" just right of its peak. It is always visible, so the reader sees the target from the start.
- **Ghost** (`options.ghost = true`): the t = 0 histogram as a dashed `--ink-3` step outline, labelled "data (t = 0)" at the +1.5 clump. It is hidden at t = 0, where it would coincide with the bars.
- **±2σ guides:** two short ink-2 hairlines at x = −2 and x = +2 above the axis, labelled "−2σ" and "+2σ" with "(of N(0, 1))" in the axis caption. They carry no fill and no colour meaning.
- **Chip:** a chip at the top left reads `t = 260, ᾱ_t = 0.498`. It repeats the controlled state next to the drawing, in ink on `--note-wash`.

**Readouts.** `["signal", "noise", "sd"]` → at t = 0: `signal √ᾱ_t 1.000 noise √(1−ᾱ_t) 0.000 spread (SD) 1.77`.

**Live description.** `Step t = {t}: {round(signal·100)}% of the original signal and noise of {noise fixed2}; the samples spread with SD {sd fixed2}, and pure noise would be 1.00.` Speak it as "alpha-bar" where ᾱ appears.

**Show data table.** 60 rows: `bin from`, `bin to` (fixed2), `density now` (fixed3), `density at t = 0` (fixed3), `N(0, 1) density at bin centre` (fixed3).

**States to discover (seed 2020).**
1. t = 0: two tight clumps near −2 and +1.5, density about 0.8. The spread is 1.77, the spread of the data itself.
2. t = 100: 95 % of the signal is left. The clumps are wider and lower (≈ 0.4 to 0.5) but clearly apart.
3. t ≈ 250 to 370: the clumps lean in toward 0 and merge into one hump. For two equal clumps that is when their separation 3.5·√ᾱ_t falls below twice the clump spread, at t ≈ 369.
4. t = 500: 28 % signal; one hump, with the spread already down to 1.09.
5. t = 600 to 750: 16 % then 6 % signal. The bars sit on the dotted N(0, 1) to within sampling noise.
6. t = 1000: 0.6 % signal and spread 1.01. The data is gone.

**Alt (static).** "Histogram of 2,000 numbers from two clumps, centred near −2 and +1.5, at diffusion step t = 0. As t increases to 1,000 the clumps shrink toward 0, blur, merge into one hump around t = 370 and end as the standard normal curve N(0, 1)."

**Caption.** "2,000 samples (seed 2020) pushed through DDPM's linear schedule, β from 0.0001 to 0.02 over 1,000 steps. Each histogram is the exact distribution at that step; each sample keeps one fixed noise draw, so its path between steps is illustrative."

**Reduced motion.** The bars jump to the new t; no morph easing. Otherwise bar heights follow with the 90 ms exponential follow on keyboard steps, and 1:1 while dragging.

### Fixtures (`diffusion-forward`, schedule)

| t | ᾱ_t | √ᾱ_t | √(1−ᾱ_t) | SNR (dB) | theoretical SD √(3.125·ᾱ_t + 1 − ᾱ_t) |
|---|---|---|---|---|---|
| 0 | 1 | 1.0000 | 0.0000 | ∞ | 1.7678 |
| 1 | 0.999900 | 0.9999 | 0.0100 | 40.00 | 1.7677 |
| 2 | 0.999780 | 0.9999 | 0.0148 | 36.58 | 1.7676 |
| 10 | 0.998105 | 0.9991 | 0.0435 | 27.22 | 1.7666 |
| 50 | 0.971016 | 0.9854 | 0.1702 | 15.25 | 1.7503 |
| 100 | 0.897018 | 0.9471 | 0.3209 | 9.40 | 1.7047 |
| 200 | 0.659039 | 0.8118 | 0.5839 | 2.86 | 1.5493 |
| 250 | 0.524085 | 0.7239 | 0.6899 | 0.42 | 1.4539 |
| 259 | 0.500245 | – | – | – | – |
| 260 | 0.497614 | – | – | – | – |
| 300 | 0.396420 | 0.6296 | 0.7769 | −1.83 | 1.3573 |
| 400 | 0.195146 | 0.4418 | 0.8971 | −6.15 | 1.1894 |
| 500 | 0.078587 | 0.2803 | 0.9599 | −10.69 | 1.0803 |
| 600 | 0.025879 | 0.1609 | 0.9870 | −15.76 | 1.0271 |
| 750 | 0.0033506 | 0.0579 | 0.9983 | −24.73 | 1.0036 |
| 900 | 0.00027521 | 0.0166 | 0.9999 | −35.60 | 1.0003 |
| 1000 | 4.0358e-5 | 0.0064 | 1.0000 | −43.94 | 1.0000 |

- ᾱ₁ = 1 − 1e-4 = 0.9999 exactly (to 1e-12), and ᾱ₁₀₀₀ = 4.0358e-5 (within 10 % of 4.0e-5).
- `crossT = 260`. The first t with signal < 0.1 is 674, and the first with signal < 0.05 is 770.
- Mixture moments: mean −0.25, variance 0.0625 + (4 + 2.25)/2 − 0.0625 = 3.125, SD 1.7678.
- Tolerances: 1e-6 relative on ᾱ_t, 1e-4 on everything else.

### Fixtures (`diffusion-forward`, samples at seed 2020)

Stream check: `x0[0..3] = −2.325990 −2.465774 −2.224807 −1.984393`, `x0[1000..1003] = 1.759179 1.174598 1.814187 1.091213`, `ε[0..3] = −0.911090 1.359381 0.159937 −0.531646`.

| t | mean | SD | density in bin of −2 (j = 15) | in bin of +1.5 (j = 41) | in bin of −0.25 (j = 28) | max density | max \|density − N(0,1) pdf\| over bins |
|---|---|---|---|---|---|---|---|
| 0 | −0.2547 | 1.7694 | 0.735 | 0.817 | 0.000 | 0.817 | 0.748 |
| 100 | −0.2450 | 1.7080 | 0.401 | 0.491 | 0.000 | 0.499 | 0.420 |
| 250 | −0.1924 | 1.4607 | 0.214 | 0.214 | 0.090 | 0.330 | 0.319 |
| 400 | −0.1230 | 1.1995 | 0.116 | 0.109 | 0.341 | 0.349 | 0.117 |
| 500 | −0.0826 | 1.0915 | 0.112 | 0.131 | 0.457 | 0.457 | 0.110 |
| 600 | −0.0525 | 1.0386 | 0.079 | 0.128 | 0.352 | 0.454 | 0.069 |
| 750 | −0.0264 | 1.0149 | 0.075 | 0.128 | 0.360 | 0.409 | 0.059 |
| 1000 | −0.0133 | 1.0111 | 0.105 | 0.150 | 0.390 | 0.401 | 0.084 |

What the fixtures show:
- t = 1000: |mean| = 0.013 < 0.1 and SD 1.011, within 1 ± 0.05.
- t = 0 is bimodal: bins 15 and 41 are both above 0.5 and bin 28 (between them) is 0.

The raw counts are 196, 218 and 0 at t = 0 and 28, 40 and 104 at t = 1000. Snapshot `hist` at t = 0 and 1000.

### Checks (Fig 1)

1. The y axis stays at 0 to 1.0 for every t (a DOM test at t = 0 and t = 1000).
2. At t = 0 the readout reads exactly `signal √ᾱ_t 1.000 noise √(1−ᾱ_t) 0.000 spread (SD) 1.77`, and at t = 1000 `signal √ᾱ_t 0.006 noise √(1−ᾱ_t) 1.000 spread (SD) 1.01`.
3. PageUp from t = 0 goes to 50, and End goes to 1000.
4. The "N(0, 1)" label and the "data (t = 0)" label are text elements in the SVG (not only in the legend).
5. Scrubbing never reallocates the sample arrays (a test spies on the RNG: zero draws after the first compute for a seed).

---

## Fig 2: `fig-signal-noise` (kind `curve`, model `diffusion-forward`)

**Idea.** The schedule's shape: the remaining signal √ᾱ_t falls slowly, then fast, then barely, mirrored by the noise √(1 − ᾱ_t), and the two cross at t ≈ 260, where SNR = 1.

**Model.** The same `diffusion-forward` registry model, not `expr-curve`. ᾱ_t is a cumulative product with no closed form in the whitelisted expression language, so the registry provides the precomputed series `signalSeries` and `noiseSeries`. The curve kind draws `number[]` outputs named in `options.series`, with the series index as x, and the param named in `options.xParam` as the knob.

**Controls.** `t`: a ring knob that rides on the signal curve and drags horizontally, plus a native range. Keyboard as in Fig 1 (PageUp ± 50). `aria-valuetext`: "step t 100 of 1000".

**Drawing.**
- x axis "step t" from 0 to 1000, ticks at 0, 250, 500, 750 and 1000. y axis "coefficient" from 0 to 1.
- `signalSeries`: cobalt solid 2 px with ● markers every 100 steps, directly labelled "signal √ᾱ_t" near t = 120.
- `noiseSeries`: teal dashed (6 3) 2 px with ■ markers every 100 steps, labelled "noise √(1−ᾱ_t)" near t = 120.
- Vertical dotted ink marker at `crossT`, labelled "signal = noise (t ≈ 260)".
- At the knob's t, a small filled teal ■ on the noise curve and a dotted ink drop line from the knob to the x axis.
- A legend appears because there are 2 series; it shows each line style and marker.

**Readouts.** `["alphaBar", "snrDb"]` → at t = 100: `ᾱ_t 0.897 SNR 9.4 dB`; at t = 0: `ᾱ_t 1.00 SNR ∞ dB`; at t = 1000: `ᾱ_t 4.04 × 10⁻⁵ SNR −43.9 dB`.

**Live description.** `At t = {t}, alpha-bar is {alphaBar}: signal {signal fixed2}, noise {noise fixed2}, signal-to-noise ratio {snrDb fixed1} dB.`

**Show data table.** 11 rows at the knob's t ± 5 steps × 10 (t − 50, t − 40, … t + 50, clipped). Columns: `t`, `ᾱ_t` (sig3), `signal` (fixed3), `noise` (fixed3), `SNR dB` (fixed1).

**States to discover.**
1. Default t = 100: the signal is still 0.95 and the noise 0.32. SNR is 9.4 dB.
2. Drag to the crossing: ᾱ_t is 0.500 at t = 259 and 0.498 at t = 260, and the SNR readout shows `0.0 dB` at both (negative zero prints as 0.0). From here on, most of the variance is noise, and it happens only a quarter of the way through the schedule.
3. t = 500: the signal is down to 0.28 (−10.7 dB).
4. t = 750 to 1000: the signal goes from 0.058 to 0.006. The last 250 steps change the picture very little, which is why later work proposed other schedules.

**Alt (static).** "Line chart over diffusion steps 0 to 1,000: the signal coefficient (the square root of alpha-bar) falls from 1 to almost 0, slowly at first, then steeply between steps 100 and 600, while the noise coefficient (the square root of one minus alpha-bar) rises from 0 to 1. They cross at step 260."

**Caption.** "Both curves come from the same schedule as the figure above, β from 0.0001 to 0.02. Drag along the signal curve; the readout shows ᾱ_t and the signal-to-noise ratio in decibels."

**Reduced motion.** The knob and drop line move instantly.

**Implementation note.** This figure draws the registry's precomputed `signalSeries` and `noiseSeries` outputs (`number[]`, index = t); it does not use `expr-curve`, because ᾱ_t is a cumulative product with no closed form in the expression language. Extra options used by the `curve` kind: `yLabel: "coefficient"`, `markEvery: 100` (● / ■ every 100 steps), `tableStep: 10`, `tableColumns: ["alphaBar", "signal", "noise", "snrDb"]` and `describe` (the live-description template above, with `{name:fixed2}` format overrides). Direct labels sit at the right end of each line rather than near t = 120, clear of the default knob at t = 100 and its "drag" hint.

### Checks (Fig 2)

1. The two series are told apart by line style and marker (solid with ● versus dashed with ■), with direct labels. In a deutan or tritan screenshot both remain identifiable from the labels.
2. The marker sits at x = 260 and its label reads "signal = noise (t ≈ 260)".
3. The readout at t = 0 reads `ᾱ_t 1.00 SNR ∞ dB` (proves the non-finite formatting).
4. The series come from the model outputs. The figure contains no hard-coded ᾱ values (grep the figure source for `0.0001`).

---

## JSON skeleton (`src/samples/diffusion.json`)

```json
{
  "schema": 1,
  "id": "diffusion",
  "title": "Noise, one step at a time",
  "dek": "A diffusion model's forward process blurs data into pure Gaussian noise over 1,000 small steps, and a closed form jumps straight to any step: x_t = √ᾱ_t·x₀ + √(1−ᾱ_t)·ε.",
  "source": {
    "kind": "arxiv",
    "url": "https://arxiv.org/abs/2006.11239",
    "title": "Denoising Diffusion Probabilistic Models",
    "authors": ["Jonathan Ho", "Ajay Jain", "Pieter Abbeel"],
    "year": 2020
  },
  "provenance": { "mode": "curated", "generatedAt": "2026-10-19T00:00:00.000Z" },
  "sections": [
    {
      "id": "start-with-data",
      "heading": "Start with data",
      "paragraphs": [
        "A diffusion model learns to make data by first learning how it gets destroyed. The destroying half, the *forward process*, has no learned parts at all: it is a fixed recipe that adds noise. Ho, Jain and Abbeel's denoising diffusion probabilistic models (DDPM) apply it to images, but every pixel follows the same rule, so one number is enough to watch it work.",
        "Our data is 2,000 numbers drawn from two clumps, one around −2 and one around +1.5, each with a spread of 0.25. Think of them as two kinds of picture. The question is what the noise does to the clumps, step by step."
      ]
    },
    {
      "id": "one-small-step",
      "heading": "One small step",
      "paragraphs": [
        "Each step shrinks the current value a little and adds a little fresh Gaussian noise: `x_t = √(1 − β_t)·x_(t−1) + √β_t·ε`, with ε drawn from N(0, 1). The shrink matters. If x_(t−1) already has variance 1, the new value has variance `(1 − β_t) + β_t = 1`. Without the shrink, noise would pile up and the values would drift ever wider.",
        "The step sizes β_t follow a schedule. DDPM uses T = 1,000 steps with β rising linearly from 0.0001 at the first step to 0.02 at the last. Early steps barely touch the data; the last steps are 200 times larger."
      ]
    },
    {
      "id": "jump-to-any-step",
      "heading": "Jump to any step",
      "paragraphs": [
        "Steps compose. Multiply the shrink factors together, `ᾱ_t = (1 − β₁)(1 − β₂)…(1 − β_t)`, and the whole chain from x₀ collapses into one line: `x_t = √ᾱ_t·x₀ + √(1 − ᾱ_t)·ε`. The first coefficient, √ᾱ_t, is how much of the original signal is left; the second, √(1 − ᾱ_t), is how much noise has replaced it.",
        "The figure uses that line directly. Scrub t from 0 to 1,000. At t = 100 the clumps are softer but still apart. Around t = 370 they merge into one hump. By t = 600 only 16% of the signal is left and the samples sit on the dotted N(0, 1) curve; at t = 1,000 their spread is 1.01 and the data is gone."
      ],
      "figure": {
        "id": "fig-histogram",
        "kind": "histogram",
        "title": "Two clumps become one bell",
        "caption": "2,000 samples (seed 2020) pushed through DDPM's linear schedule, β from 0.0001 to 0.02 over 1,000 steps. Each histogram is the exact distribution at that step; each sample keeps one fixed noise draw, so its path between steps is illustrative.",
        "alt": "Histogram of 2,000 numbers from two clumps, centred near −2 and +1.5, at diffusion step t = 0. As t increases to 1,000 the clumps shrink toward 0, blur, merge into one hump around t = 370 and end as the standard normal curve N(0, 1).",
        "model": { "id": "diffusion-forward", "params": { "t": 0, "seed": 2020 } },
        "controls": ["t"],
        "readouts": ["signal", "noise", "sd"],
        "options": { "handle": "t", "ticks": ["0", "250", "500", "750", "1000"], "ghost": true, "refLabel": "N(0, 1)" }
      }
    },
    {
      "id": "signal-and-noise",
      "heading": "Signal fades, noise rises",
      "paragraphs": [
        "Plot the two coefficients against t and the schedule shows its shape. The signal √ᾱ_t falls slowly at first, then quickly, then hardly at all; the noise √(1 − ᾱ_t) mirrors it. They cross at t ≈ 260, where ᾱ_t = 0.5 and the signal-to-noise ratio `ᾱ_t / (1 − ᾱ_t)` is exactly 1, or 0 dB.",
        "Most of the change happens in the first half. Past t ≈ 750 the signal is under 6%, and each further step changes little. Later papers proposed other schedules for exactly this reason: the schedule is a design choice, not a law."
      ],
      "figure": {
        "id": "fig-signal-noise",
        "kind": "curve",
        "title": "How much signal is left at each step",
        "caption": "Both curves come from the same schedule as the figure above, β from 0.0001 to 0.02. Drag along the signal curve; the readout shows ᾱ_t and the signal-to-noise ratio in decibels.",
        "alt": "Line chart over diffusion steps 0 to 1,000: the signal coefficient (the square root of alpha-bar) falls from 1 to almost 0, slowly at first, then steeply between steps 100 and 600, while the noise coefficient (the square root of one minus alpha-bar) rises from 0 to 1. They cross at step 260.",
        "model": { "id": "diffusion-forward", "params": { "t": 100, "seed": 2020 } },
        "controls": ["t"],
        "readouts": ["alphaBar", "snrDb"],
        "options": {
          "handle": "t",
          "xParam": "t",
          "series": ["signalSeries", "noiseSeries"],
          "seriesLabels": ["signal √ᾱ_t", "noise √(1−ᾱ_t)"],
          "seriesSpoken": ["signal, square root of alpha-bar", "noise, square root of one minus alpha-bar"],
          "markers": ["crossT"],
          "markerLabels": ["signal = noise (t ≈ {marker})"],
          "ticks": ["0", "250", "500", "750", "1000"]
        }
      }
    },
    {
      "id": "why-it-matters",
      "heading": "Why the shortcut matters",
      "paragraphs": [
        "Generation runs the process backwards: a network learns to predict the noise ε that was mixed into x_t, so it can take a little of it away at each step. Training needs examples at random steps, and the closed form makes each one cheap: pick an x₀, pick a t, draw ε and form `√ᾱ_t·x₀ + √(1 − ᾱ_t)·ε` in one line, with no loop over the earlier steps. DDPM's simplified training objective is just the squared error between the true ε and the predicted one."
      ]
    }
  ],
  "takeaway": "The forward process is a fixed schedule of tiny shrink-and-add-noise steps. Their product ᾱ_t gives a one-line jump to any step, x_t = √ᾱ_t·x₀ + √(1 − ᾱ_t)·ε, and by t = 1,000 any data has become N(0, 1)."
}
```

Note: `options.ticks` is a `string[]` because the `options` type allows `string[]` but not `number[]`. The figure parses the values as numbers.
