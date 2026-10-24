# Verify

Commands run from the skill folder with Node 20.10 or newer and no installed packages.

## The audit

```sh
node scripts/audit.mjs examples/bloom-filter/explorable.json
node scripts/audit.mjs examples/bloom-filter/index.html
```

On a spec, the audit checks the doc and then the page `build.mjs` would write for it. On a page, it reads the doc embedded in `<script id="explorable-doc">` and checks the page as built. Output:

```
audit examples/bloom-filter/index.html
audit passed
```

or numbered problems, a summary line and exit code 1:

```
audit /tmp/p/explorable.json
1. figure "fig-cooling": options.seriesColors sets a colour; the kit owns the palette (at most 3 hue-coded series), so encode with line style, shape or labels
audit failed: 1 problem
```

Warnings come before the last line and do not fail the audit. `warning: sections[3].paragraphs[0] reads like a formula (…)` names text to say in words, with the formula moved into a math note (`writing.md`); a finished page has none.

Fix every problem and rerun until the last line is `audit passed`. Do not edit the page by hand: change the spec and rebuild, or the audit of the page will disagree with the spec.

| Group | What it proves |
|---|---|
| schema | every field and limit in `spec-format.md`, and the notes: known ids, every note used, one math marker per paragraph |
| plain words | a warning for each dek, paragraph or takeaway that reads like a formula (`findFormula`) |
| figures | a known model the kind can show, params in range, controls are params, readouts are outputs, `handle` is a control, no colour options, labels with words |
| numbers | readouts, markers, reference curves and templated values are finite at the defaults and at every stop of every control (up to 65 per control) |
| page | `lang`, `<title>`, one `<main>`, an `<h1>`, one figure shell per figure, no inline `style=` |
| offline | no external `src`, `href`, `srcset`, `action`, `poster` or `data`, and no CSS `@import` or remote `url()`; only `source.url` and source notes may link out |
| notes | one math marker in the markup per math note in the doc |
| motion and colour | a reduced-motion rule; palette CVD separation and contrast (`accessibility.md`) |

## Regression tests

```sh
node --test scripts/*.test.mjs
```

They build and audit both examples, run a failing fixture for each audit check, check that the frontmatter of `SKILL.md` parses, that every file the skill's docs name exists, and that `evals/evals.json` is complete.

## In a browser (optional, needs Chrome)

Hydration marks each live figure with `data-live`. This one-shot check prints how many figures came alive (2 for either example); Chrome exits by itself. The `--no-sandbox` flag is only needed inside containers.

```sh
google-chrome --headless=new --disable-gpu --no-sandbox --virtual-time-budget=3000 --dump-dom "file://$PWD/examples/newton-cooling/index.html" | grep -o 'data-live=""' | wc -l
```

## Review checklist

Open the page from `file://` and go through it as a reader:

1. The first figure is in the first screenful or the second, and its section says what to drag.
2. Drag the knob: the drawing, the readout and the slider move together, with no in-between numbers in the readout.
3. Tab to each control and press the arrow keys, PageUp and Home: each one changes a readout.
4. Read the alt text and the live description aloud against the figure. Is every number true at the start?
5. Turn on reduced motion (in Chrome DevTools: Rendering, Emulate CSS media feature) and step again: no easing, no nudge.
6. Open every Σ note: does the formula say what the sentence before it says, and does the gloss name each symbol in words? Focus each source label: the card shows the right title and link.
7. Does dragging show the idea in the `dek`? If the reader could skip the figure and lose nothing, change the control or the model.
8. Narrow the window to 390 px: nothing overlaps, and the controls wrap.

The audit proves structure, numbers and palette. Only you can check that the prose is true and that the figure teaches the idea.
