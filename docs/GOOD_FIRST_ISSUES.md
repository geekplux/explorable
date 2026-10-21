# Good first issues

Ten scoped starting points. Each fits in one small PR (see [CONTRIBUTING.md](../CONTRIBUTING.md)), and [EXTENDING.md](EXTENDING.md) has the step-by-step guide for the model, sample and expression items. Comment on the issue before you start so two people don't build the same thing.

## 1. A validated dark palette

Add a dark theme under `prefers-color-scheme: dark`: dark `paper` and `well` surfaces and lighter series colours in `skills/explorable/kit/src/color/palette.ts` and `skills/explorable/kit/src/styles/tokens.css`.
**Done when** `color/cvd.test.ts` passes for the dark surfaces too (every series pair apart under protanopia, deuteranopia and tritanopia; text 4.5:1, graphics 3:1), and smoke shots in both schemes look right.

## 2. A `pendulum` or `random-walk` model (one per PR)

`pendulum`: period against amplitude, showing where the small-angle formula 2π√(L/g) stops being true. `random-walk`: seeded steps, with the spread growing like √n. Both draw as a `curve`.
**Done when** the model follows [add a model](EXTENDING.md#add-a-model), with values you can check by hand in its test and a spec that ends in `audit passed`.

## 3. "Copy link to this figure state"

A small button under each figure that copies a URL with the current params, such as `/s/attention#fig-scaling?dk=64`, and restores them on load. Params come from the figure runtime (`skills/explorable/kit/src/runtime/mount.ts`); routing is `src/router.ts`.
**Done when** a restored link shows the same readout, values outside a param's range are clamped, and the button is keyboard operable and announces "Link copied".

## 4. A `fourier-series` model

Partial sums of a square wave with N terms, with the target wave as the dotted reference series (`refSeries`), so the reader sees the overshoot at the jump stay put as N grows.
**Done when** it follows [add a model](EXTENDING.md#add-a-model) and its test pins the overshoot near 9% of the jump.

## 5. A reduced-data mode for the histogram

Under `prefers-reduced-data: reduce`, or on a slow device, the `diffusion-forward` histogram (`skills/explorable/kit/src/figures/histogram.ts`) could draw from 500 samples instead of 2,000.
**Done when** both modes are seeded and deterministic, a test covers both, and the figure's description says which sample size it shows.

## 6. A Spanish translation of a sample

Translate one sample, for example `src/samples/attention.json` as `attention-es`. The doc schema has no language field yet: add an optional `lang` to `ExplorableDoc` in `skills/explorable/kit/src/doc/schema.ts` and set it on the essay, so screen readers switch voice.
**Done when** the sample follows [add a sample](EXTENDING.md#add-a-sample), and alt text, labels and live descriptions are translated too.

## 7. A print stylesheet

`@media print` rules in `src/styles/app.css`: hide the controls and knobs, open every "Show data" table, keep each figure on one page and print the source URL.
**Done when** a PDF printed from `/s/bloom-filter` reads well in greyscale.

## 8. `log2` and `log10` in expressions

Add both to the expression language. Follow [add an expression function](EXTENDING.md#add-an-expression-function).
**Done when** both compile to `Math.log2` and `Math.log10` in a test, and the references and the prompt list them.

## 9. Harness port race

`scripts/lib/harness.mjs` picks a free port, then starts the preview server on it. If another process takes the port in between, the run can drive the wrong app.
**Done when** the harness fails fast if the server process exits, and checks a page marker (such as the wordmark) before any flow runs.

## 10. Narrow-screen figure polish

Two cosmetic follow-ups: at t = 0 the knob of diffusion Fig 2 covers the y-axis tick label "1" (`skills/explorable/kit/src/figures/curve.ts`), and at 390 and 320 px the Bloom Fig 2 readout wraps mid-phrase ("false-" / "positive rate").
**Done when** `pnpm e2e diffusion bloom` shots at 1280, 390 and 320 px show neither problem.
