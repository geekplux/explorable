---
name: explorable
description: Build an interactive explainer, an explorable explanation in the Bret Victor, Bartosz Ciechanowski or Amelia Wattenberger style, as a short scrolling essay whose figures are live models of one idea with a draggable figure knob, sliders and live readouts, written to one standalone HTML page that works offline or dropped into a React app. Use this whenever someone asks to make this paper or concept interactive, wants a draggable figure, an interactive diagram or an interactive figure for a blog post or docs, a lesson or a lecture, or wants to let readers play with a formula, even if they don't say explorable. Works from a concept, a formula, an arXiv abstract or pasted article text.
license: MIT
compatibility: Claude Code and other agents that load SKILL.md skills; Node.js 20.10+; Chrome optional for browser checks
---

# Explorable

This skill turns one idea into a short essay with live figures. The reader drags a knob on the chart or a slider under it, and every number on the page (the curve, the bars, the readout, the spoken description) is recomputed by a real model of the idea. You write one JSON spec; `scripts/build.mjs` turns it into a single HTML file that opens from `file://` with no network, and `scripts/audit.mjs` proves it is correct.

Two complete examples ship with the skill. Open the closer one before you start and copy its `explorable.json`:

- `examples/bloom-filter/` uses a **registry model**: a row of 32 bits where you insert words and ask about one, then a curve of the false-positive rate. Closest for algorithms and data structures.
- `examples/newton-cooling/` uses **`expr-curve`**: `T(t) = Tₐ + (T₀ − Tₐ)·e^(−kt)` with knobs for k and T₀, and a marker at the half-life. Closest for anything with a formula.

Build and audit one in under a second (commands run from this skill's folder):

```sh
node scripts/build.mjs examples/newton-cooling/explorable.json
node scripts/audit.mjs examples/newton-cooling/index.html
```

## The one idea that matters

**One idea, one live model, and the reader's hand on the parameter that matters.**

An explorable is not an illustrated article. It picks the single thing the reader should leave with, finds the one parameter that makes that idea visible when it moves, and hands that parameter to the reader. Everything else is cut.

| Idea | Model | Figure | The parameter in the reader's hand |
|---|---|---|---|
| A Bloom filter says "maybe", never a false "no" | `bloom-filter` | `bits` | words inserted `n`, hashes `k` |
| Temperature sharpens a softmax | `softmax-temperature` | `bars` | temperature `T` |
| Attention divides by √d_k | `attention-scaling` | `bars` | key width `dk`, the √d_k switch |
| Diffusion adds noise on a schedule | `diffusion-forward` | `histogram`, `curve` | step `t` |
| Coffee cools fast, then slowly | `expr-curve` | `curve` | time `x`, cooling constant `k` |
| Anything else with a formula | `expr-curve` | `curve` | `x` or any declared param (1–3 controls) |

Two ways this fails:

- **Three ideas at once.** A figure per idea and none of them land. Pick one; name the others as follow-ups in your reply.
- **A figure that only decorates.** If dragging the control changes nothing the reader cares about, it is the wrong control or the wrong model.

## Workflow

1. **Pick the one idea.** Write it as one sentence a curious non-expert can follow. It becomes the `dek` (≤ 220 characters). If the request crams in several ideas, choose the one the rest depend on and say why in your reply.
2. **Choose a registry model or `expr-curve`.** Use a registry model only when the idea *is* that model's idea, not when it shares words (`references/models.md`). Otherwise write `y = f(x)` as an `expr-curve` (`references/expressions.md`). Search the registry:
   ```sh
   node -e "import('./kit/dist/explorable-kit.js').then(k => console.log(k.searchModels('bloom filter false positives').map(m => m.id)))"
   ```
3. **Write `explorable.json`.** Copy the closest example to where the page should live (here `/tmp/explorable-draft`) and edit it: 2–6 sections, a figure where the reader should *do* something, 1–3 controls and 1–3 readouts per figure, alt text of at least 40 characters. Field limits are in `references/spec-format.md`, figure options in `references/figure-kinds.md`, voice in `references/writing.md`.
   ```sh
   mkdir -p /tmp/explorable-draft
   cp examples/newton-cooling/explorable.json /tmp/explorable-draft/explorable.json
   ```
4. **Build it.** `build.mjs` validates the spec and writes `index.html` next to it (`--out page.html` to choose the path, `--no-fonts` to skip the inlined Source Serif 4 font, about 44 KB smaller).
   ```sh
   node scripts/build.mjs /tmp/explorable-draft/explorable.json
   ```
5. **Audit until it prints `audit passed`.** Audit the spec while you edit and the built page at the end. Each problem is numbered and says what to change; fix them all and rerun. Exit code 0 only on `audit passed`.
   ```sh
   node scripts/audit.mjs /tmp/explorable-draft/explorable.json
   node scripts/audit.mjs /tmp/explorable-draft/index.html
   ```
6. **Open the page and drag.** Drag the knob, Tab to it and press the arrow keys, and check that the readout moves the way the essay says it will. A one-line headless check and the full checklist are in `references/verify.md`.

In a React project, render the audited spec with `kit/react/Explorable.tsx` instead of shipping the built page (`references/react.md`).

## Quality bar

Every item is enforced by the kit or the audit; none rests on good intentions.

- **A real model.** Every number comes from the model's `compute`, a pure function (seeded randomness only). The audit computes each readout, marker, reference curve and label value at the defaults and at every stop of every control (up to 65 per control) and fails on any non-finite value.
- **One idea per figure.** 1–3 controls and 1–3 readouts per figure; 2–6 sections; at least one figure.
- **Accessible.** Each control is a labelled native slider, switch or radio group; the knob on the chart is a `role="slider"` with arrow, Page and Home/End keys. Changes are spoken through a throttled live region, and every figure has a "Show data" table. The audit requires alt text of at least 40 characters, a caption, labels with real words, `lang`, `<title>`, one `<main>` and an `<h1>` (`references/accessibility.md`).
- **Never colour alone, CVD-safe.** Series differ by line style, markers and direct labels as well as hue. The audit rejects colour values in figure options, more than 3 hue-coded series, any series pair too close under protan, deutan or tritan simulation, and text or graphics below WCAG contrast.
- **Reduced motion.** Under `prefers-reduced-motion: reduce` there is no easing and no hint animation; the audit fails a page without that media rule.
- **No decorative 3D.** The figure kinds are `bars`, `bits`, `histogram` and `curve`, all flat SVG; the schema rejects any other kind. A request for 3D gets the 2D figure that carries the idea, with the reason stated.
- **Offline and self-contained.** One file with inline CSS, JS and font. A Content-Security-Policy blocks the network, and the audit rejects any external `src` or `href` except a link to `source.url`.
- **True words.** State only facts and numbers the source or the model gives. Nothing about money, prices, trading or payments.

## What ships in the folder

| Path | Use it for |
|---|---|
| `kit/dist/explorable-kit.js`, `.css` | The prebuilt, framework-free kit (ESM): `parseDoc`, `essayHtml`, `hydrateFigures`, `searchModels`, `getModel`, `exprCurveModel`, the palette and CVD checks. Node scripts import it directly. |
| `kit/src/` | The kit's TypeScript source and its Vitest tests: schema, models, figure kinds, runtime, expression language, palette. |
| `kit/react/Explorable.tsx` | A thin React wrapper: static essay HTML plus live figures hydrated in an effect. |
| `scripts/build.mjs` | Spec to standalone page. Zero dependencies. |
| `scripts/audit.mjs` | Proves a spec or a page; ends `audit passed` or exits 1. |
| `scripts/*.test.mjs` | Regression tests: `node --test scripts/*.test.mjs`. |
| `examples/*/` | Worked examples, each `explorable.json` plus its built `index.html`. |
| `evals/evals.json` | Realistic prompts with checkable expected outputs. |

## Edge cases

- **No registry model fits.** Use `expr-curve`; if the idea has no formula you can state honestly, explain the concept in prose and pick the nearest relation the source does state.
- **A PDF or a page you cannot read.** The skill does not fetch or parse PDFs. Ask for the text or the key formula, or build from the concept the user names with `source.kind: "concept"`, and say which you did. Never invent the paper's numbers.
- **Colour-only encodings** ("red for hot, blue for cold, no labels"): the audit fails them; use the kit's line styles, markers and direct labels.

## References

Load these only when the step needs them:

- `references/spec-format.md`: every field of `explorable.json`, its limits and a minimal skeleton.
- `references/models.md`: the registry models, their params and outputs, and when to use each.
- `references/figure-kinds.md`: `bars`, `bits`, `histogram`, `curve` and their options.
- `references/expressions.md`: the `expr-curve` language, its limits and the errors you will meet.
- `references/writing.md`: the voice, the essay flow, alt text and phrases to avoid.
- `references/accessibility.md`: what the kit does for keyboard, screen readers, CVD and motion, and what is left to you.
- `references/verify.md`: the commands, reading the audit, the browser check and the review checklist.
- `references/react.md`: using `kit/react/Explorable.tsx` in a React app.
