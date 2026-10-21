# Extending explorable

Four guides: [add a model](#add-a-model), [add a figure kind](#add-a-figure-kind), [add a sample](#add-a-sample) and [add an expression function](#add-an-expression-function). Each ends with a checklist. The code they touch:

| Path | What lives there |
|---|---|
| `skills/explorable/kit/src/registry.ts` | `ModelDef`, `ParamDef`, `OutputDef`, `registerModel` |
| `skills/explorable/kit/src/models/` | one file per model, with its test |
| `skills/explorable/kit/src/figures/` | one file per figure kind (`bars`, `bits`, `histogram`, `curve`) |
| `skills/explorable/kit/src/runtime/mount.ts` | `BUILT_IN_MODELS` and the `KINDS` table: controls, readout, live text and data table around every figure |
| `skills/explorable/kit/src/expr/` | the expression language for `expr-curve` |
| `src/samples/` | the built-in samples and their thumbnails |
| `worker/plan/` | the AI plan: the model catalogue, the prompt and the assembly into a doc |

The kit is shared by the app and the skill. The skill runs from the prebuilt bundle in `skills/explorable/kit/dist/`, so every kit change ends with `pnpm build:kit`, a rebuild of the example pages (step 4 of the first guide) and a commit of both. The skill's own references (`skills/explorable/references/`) describe the same contracts for spec authors; keep them in step.

## Add a model

A model turns params into outputs with a pure `compute`, so every number on a figure is real. Write a model when the idea needs a procedure or randomness. If the idea is a formula y = f(x), a spec can use `expr-curve` and needs no new code.

This guide adds `coin-flips`: the share of heads in n fair flips settles toward one half.

**1. Write `skills/explorable/kit/src/models/coin-flips.ts`.**

```ts
/** `coin-flips`: the share of heads in n fair flips settles toward 1/2 (the law of large numbers). */
import { registerModel } from '../registry.ts';
import { mulberry32 } from '../rng.ts';

export type CoinParams = { n: number; seed: number };
export type CoinOutputs = { heads: number; share: number; gap: number; running: number[] };

const MAX_FLIPS = 200;

export const coinFlips = registerModel<CoinParams, CoinOutputs>({
  id: 'coin-flips',
  title: 'Coin flips and the law of large numbers',
  kinds: ['curve'],
  keywords: ['coin', 'flips', 'law of large numbers', 'average', 'probability'],
  params: {
    n: { label: 'number of flips', min: 1, max: MAX_FLIPS, step: 1, default: 20 },
    seed: { label: 'seed', min: 0, max: 2 ** 32 - 1, step: 1, default: 1 },
  },
  outputs: {
    heads: { label: 'heads', format: 'int' },
    share: { label: 'share of heads', format: 'fixed2' },
    gap: { label: 'distance from one half', format: 'fixed2' },
  },
  compute({ n, seed }) {
    const rng = mulberry32(seed);
    const counts: number[] = [];
    for (let i = 0, h = 0; i < MAX_FLIPS; i++) counts.push((h += rng() < 0.5 ? 1 : 0));
    const k = Math.min(MAX_FLIPS, Math.max(1, Math.round(n)));
    const heads = counts[k - 1]!;
    // One point per flip count 1…200: evenly spaced along the n track, as `curve` expects.
    const running = counts.map((h, i) => h / (i + 1));
    return { heads, share: heads / k, gap: Math.abs(heads / k - 0.5), running };
  },
  describe(p, o) {
    return `After ${p.n} flips, ${o.heads} came up heads: a share of ${o.share.toFixed(2)}, ${o.gap.toFixed(2)} from one half.`;
  },
});
```

The rules: randomness only from `mulberry32(seed)` (never `Math.random` or the clock), every number output finite at every control stop, list outputs only feed the drawing (they cannot be readouts), and `spoken` on any label with symbols (`√ᾱ_t` → "signal"). Pick `kinds` by the outputs each kind reads: `curve` takes list outputs named in `options.series`, sampled evenly along the x param's track; `bars` reads `weights` (0 to 1), `scores` and `topIndex`. `histogram` and `bits` are still specific to `diffusion-forward` and `bloom-filter`.

**2. Write `skills/explorable/kit/src/models/coin-flips.test.ts`.** Pin a few values you can explain, and check what the audit will check.

```ts
import { describe, expect, it } from 'vitest';
import { getModel } from '../registry.ts';
import { BUILT_IN_MODELS } from '../runtime/mount.ts';
import { coinFlips as model } from './coin-flips.ts';

const at = (n: number, seed = 1) => model.compute({ n, seed });

describe('coin-flips', () => {
  it('is registered and built in', () => {
    expect(getModel('coin-flips')).toBe(model);
    expect(BUILT_IN_MODELS).toContain(model);
  });

  it.each([[10, 3], [20, 12], [100, 53], [200, 105]])('seed 1: %i flips give %i heads', (n, heads) => {
    expect(at(n).heads).toBe(heads);
    expect(at(n).share).toBeCloseTo(heads / n, 12);
  });

  it('is deterministic per seed, and the running share ends at the share', () => {
    expect(at(50)).toEqual(at(50));
    expect(at(50, 2).running).not.toEqual(at(50).running);
    expect(at(200).running).toHaveLength(200);
    expect(at(200).running.at(-1)).toBe(at(200).share);
  });

  it('every number output is finite at every stop of n', () => {
    const { min, max, step } = model.params.n;
    for (let n = min; n <= max; n += step) {
      const o = at(n);
      expect([o.heads, o.share, o.gap].every(Number.isFinite)).toBe(true);
    }
  });

  it('describes the state in one sentence', () => {
    expect(model.describe({ n: 10, seed: 1 }, at(10))).toBe('After 10 flips, 3 came up heads: a share of 0.30, 0.20 from one half.');
  });
});
```

**3. Build it in.** In `skills/explorable/kit/src/runtime/mount.ts`, import the model and add it to `BUILT_IN_MODELS`:

```ts
import { coinFlips } from '../models/coin-flips.ts';
export const BUILT_IN_MODELS = [softmaxTemperature, attentionScaling, bloomFilter, diffusionForward, coinFlips] as unknown as readonly ModelDef[];
```

**4. Run the checks, then rebuild the skill bundle and the example pages** (they inline the bundle, and a test checks they are fresh):

```sh
pnpm check
pnpm build:kit
for spec in skills/explorable/examples/*/explorable.json; do node skills/explorable/scripts/build.mjs "$spec"; done
node --test skills/explorable/scripts/*.test.mjs
```

**5. See it on a page.** Save this as `/tmp/coin/explorable.json`, then build and audit it:

```json
{ "schema": 1, "id": "coin-flips", "title": "Coin flips settle down", "dek": "The share of heads wanders early and settles near one half.",
  "source": { "kind": "concept", "title": "Law of large numbers" },
  "provenance": { "mode": "curated", "generatedAt": "2026-10-21T00:00:00.000Z" },
  "sections": [
    { "id": "flips", "heading": "Flip after flip", "paragraphs": ["Drag n and watch the share of heads."],
      "figure": { "id": "fig-flips", "kind": "curve", "title": "Share of heads after n flips", "caption": "One seeded run of 200 flips.",
        "alt": "A line of the running share of heads over 1 to 200 flips, wandering early and settling near one half.",
        "model": { "id": "coin-flips", "params": { "n": 20, "seed": 1 } },
        "controls": ["n"], "readouts": ["heads", "share"],
        "options": { "handle": "n", "xParam": "n", "series": ["running"], "seriesLabels": ["share of heads"],
          "yMin": 0, "yMax": 1, "yLabel": "share", "tableColumns": ["heads", "share", "gap"] } } },
    { "id": "why", "heading": "Why it settles", "paragraphs": ["Each flip moves the share by less than the one before."] }
  ],
  "takeaway": "More flips, smaller wobble." }
```

```sh
node skills/explorable/scripts/build.mjs /tmp/coin/explorable.json
node skills/explorable/scripts/audit.mjs /tmp/coin/index.html
```

**6. Document it** with a row in the registry table of `skills/explorable/references/models.md`.

**7. Offer it to the AI planner** only once a curated sample uses it (see [add a sample](#add-a-sample)): the planner copies kind options such as `series` from the model's `template` sample, and a `curve` without them is empty. Then add the model to `MODELS` in `worker/plan/schema.ts`, write its one-clause `TEACHES` entry in `worker/plan/prompt.ts` (a test requires one), set `template: '<slug>'` on the model, and bump `PROMPT_VERSION`, which is part of the cache key.

Checklist:

- [ ] `models/<id>.ts` registers a pure, seeded model; defaults sit inside their ranges (`registerModel` throws otherwise)
- [ ] `models/<id>.test.ts` pins values and checks determinism, finite outputs at every stop and `describe`
- [ ] added to `BUILT_IN_MODELS`
- [ ] `pnpm check` passes; `pnpm build:kit` output and rebuilt example pages committed; skill tests pass
- [ ] a spec using it builds and ends in `audit passed`
- [ ] `references/models.md` row; planner entry only with a template sample

## Add a figure kind

A figure kind draws one model's state as flat SVG. The runtime builds the rest (controls, readout, live text and data table), so a kind only draws and lists its data. This guide adds `meter`: one number output as a filled bar with its value written beside it.

1. Add the name to `FIGURE_KINDS` in `skills/explorable/kit/src/doc/schema.ts`, and to the pinned list in `skills/explorable/kit/src/index.test.ts`.
2. Write `skills/explorable/kit/src/figures/meter.ts`:

```ts
/** `meter`: one number output (0 to 1) as a filled bar, its label and value written beside it. */
import { format } from '../format.ts';
import { svgEl } from '../runtime/handle.ts';
import type { FigureMount } from '../runtime/mount.ts';

export const mountMeter: FigureMount = (el, { spec, model }) => {
  const id = String(spec.options?.output ?? spec.readouts[0]);
  const def = model.outputs[id]!;
  const svg = svgEl(el, 'svg', { class: 'xfig-svg xfig-meter', viewBox: '0 0 400 48', role: 'img', 'aria-label': spec.title });
  svgEl(svg, 'rect', { class: 'xfig-meter-track', x: 0, y: 8, width: 240, height: 24 });
  const bar = svgEl(svg, 'rect', { class: 'xfig-bar', x: 0, y: 8, height: 24 });
  const text = svgEl(svg, 'text', { x: 252, y: 26 });
  const value = (out: Record<string, number | number[]>) => Number(out[id]);
  return {
    draw(_shown, out) {
      bar.setAttribute('width', String(240 * Math.min(1, Math.max(0, value(out)))));
      text.textContent = `${def.label} ${format(value(out), def.format)}`;
    },
    columns: [def.label],
    rows: (_p, out) => [[format(value(out), def.format)]],
    destroy: () => svg.remove(),
  };
};
```

3. Register it in the `KINDS` table of `skills/explorable/kit/src/runtime/mount.ts` (`meter: mountMeter`), and add `'meter'` to the `kinds` of each model it can show (the audit rejects a kind the model does not list).
4. Style it in `skills/explorable/kit/src/styles/kit.css` with palette tokens only, such as `.xfig-meter-track { fill: var(--well); stroke: var(--ink-2); }`. A built page that uses a colour outside the tokens fails the audit.
5. Test it in `skills/explorable/kit/src/figures/meter.test.ts`:

```ts
// @vitest-environment happy-dom
import { expect, it, vi } from 'vitest';
import { essayHtml, hydrateFigures } from '../doc/essay.ts';
import { parseDoc } from '../doc/schema.ts';

const figure = {
  id: 'fig-meter', kind: 'meter', title: 'Top weight', caption: 'The largest softmax weight.',
  alt: 'A horizontal bar filled to the top softmax weight, about two thirds of the way.',
  model: { id: 'softmax-temperature', params: { T: 1, n: 3, s1: 2, s2: 1, s3: 0 } }, controls: ['T'], readouts: ['top'],
};
const doc = {
  schema: 1, id: 'meter-demo', title: 'Meter demo', dek: 'One number as a bar.', takeaway: 'It works.',
  source: { kind: 'concept', title: 'Softmax' }, provenance: { mode: 'curated', generatedAt: '2026-10-21T00:00:00.000Z' },
  sections: [{ id: 'a', heading: 'A', paragraphs: ['Drag T.'], figure }, { id: 'b', heading: 'B', paragraphs: ['Done.'] }],
};

it('draws the output and lists it in the data table', () => {
  vi.stubGlobal('IntersectionObserver', undefined); // always on screen
  const parsed = parseDoc(doc);
  if (!parsed.ok) throw new Error(parsed.errors.join('\n'));
  const root = document.createElement('div');
  root.innerHTML = essayHtml(parsed.doc);
  document.body.append(root);
  const { destroy } = hydrateFigures(root, parsed.doc, { reducedMotion: true });
  expect(root.querySelector('svg.xfig-meter text')?.textContent).toBe('top weight 0.67');
  expect(root.querySelector('input[type="range"]')).not.toBeNull();
  destroy();
});
```

6. Check it in a browser: a flow in `scripts/flows/` that drags and keys through the figure, with shots at 1280, 390 and 320 px, `cvd('protan' | 'deutan' | 'tritan')` shots and a clean `axe()`.
7. Document its options in `skills/explorable/references/figure-kinds.md`, then rebuild the bundle and the examples as in step 4 of [add a model](#add-a-model).

Checklist:

- [ ] in `FIGURE_KINDS`, the `index.test.ts` list, `KINDS` and at least one model's `kinds`
- [ ] meaning carried by shape, line style or words, not hue alone; at most 3 hue-coded series
- [ ] any knob made with `createHandle` (see `figures/bars.ts`), so it is a keyboard `role="slider"` with 44 px targets
- [ ] a happy-dom test, an e2e flow with CVD shots and a clean axe run
- [ ] `references/figure-kinds.md` updated; bundle and example pages rebuilt and committed

## Add a sample

A built-in sample is an `ExplorableDoc` committed as JSON, so the gallery works offline with no key.

1. Design it first in `docs/figures/<slug>.md`: the one idea, 2 or 3 figures, their controls and readouts, and hand-computed values. `docs/figures/samples.md` has the rules every sample shares.
2. Write `src/samples/<slug>.json`: `"schema": 1`, `"provenance": { "mode": "curated", … }`, 2 to 6 sections, at least 2 figures, `alt` of 40 characters or more. Topics stay away from finance.
3. Draw `src/samples/thumbs/<slug>.svg` at 320 × 180 with a `<title>`, using the colours in `skills/explorable/kit/src/color/palette.ts`.
4. Add it to `samples` in `src/samples/index.ts` (gallery order) and to the list in `src/samples/samples.test.ts`, which then parses and renders it:

```ts
expect(samples.map((s) => s.id)).toEqual(['attention', 'bloom-filter', 'diffusion', '<slug>']);
```

5. Add `'<slug>'` to the app-samples loop at the end of `skills/explorable/scripts/audit.test.mjs`, so the skill audit covers it.
6. If it is a model's match-mode template, import it into `TEMPLATES` in `worker/plan/assemble.ts` and set the model's `template`.
7. Run `pnpm smoke` (it finds every `src/samples/*.json`) and look at the shots.

Checklist:

- [ ] design doc, JSON, thumbnail
- [ ] `index.ts`, `samples.test.ts` and `audit.test.mjs` lists updated
- [ ] `pnpm check`, `pnpm smoke` and the skill tests pass

## Add an expression function

`expr-curve` formulas may call only the functions in `FUNCS`. This guide adds `tanh`.

1. Add `['tanh', [Math.tanh, 1]]` to `FUNCS` in `skills/explorable/kit/src/expr/parser.ts`. The number is the arity: 1, 2, or 0 for "two or more". The name becomes a built-in, so a spec can no longer use it as a param name.
2. Test it in `skills/explorable/kit/src/expr/tanh.test.ts`:

```ts
import { expect, it } from 'vitest';
import { compileExpr } from './compile.ts';
import { badName, parse } from './parser.ts';

it('tanh compiles to Math.tanh, takes one argument and is a built-in name', () => {
  for (const x of [-3, -0.5, 0, 0.5, 3]) expect(compileExpr('tanh(k*x)', ['x', 'k'])([x, 2])).toBe(Math.tanh(2 * x));
  expect(() => parse('tanh(x, 1)', ['x'])).toThrow('tanh() takes 1 argument (at 1)');
  expect(badName('tanh')).toBe('"tanh" is a built-in name');
});
```

3. List it in the functions row of `skills/explorable/references/expressions.md`, and in the EXPR RULES of `worker/plan/prompt.ts` and `docs/design/prompt.md`; bump `PROMPT_VERSION`.
4. `pnpm check`, then rebuild the bundle and the examples and run the skill tests, as in step 4 of [add a model](#add-a-model).

Checklist:

- [ ] `FUNCS` entry with the right arity
- [ ] a test against `Math`, the arity error and `badName`
- [ ] references, prompt and prompt spec updated; `PROMPT_VERSION` bumped; bundle and example pages rebuilt and committed
