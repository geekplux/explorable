# Accessibility

The kit does most of the work; the spec supplies the words. This file lists what each side owns and what the audit proves.

## What the kit does (`kit/src/runtime/`, `kit/src/figures/`)

- **Keyboard.** Every name in `controls` gets a labelled native control: a range slider, a `role="switch"` button for a 0/1 param, or a radio group for a choice. The knob on the chart (`options.handle`) is an SVG `role="slider"` with Tab focus, arrows (± one step), PageUp/PageDown (± ten steps by default), and Home/End. Log-scale params move 1% (arrows) or 10% (Page keys) of their range.
- **Screen readers.** Each control has an `aria-valuetext` in words ("key width d k 64"). The figure is described by its `alt`. A polite live region speaks the figure's one-sentence description at most every 500 ms, and during a drag only once the pointer rests. "Show data" opens a real `<table>` of the current values.
- **Targets.** Knobs, tracks, switches and radio pills are at least 44 × 44 px.
- **Motion.** Drags move 1:1. Keyboard steps ease over about 90 ms, and a one-time nudge hints at the knob. Under `prefers-reduced-motion: reduce` there is no easing and no nudge (the hint is a static dashed ring), and the page CSS turns off transitions and animations. Figures compute only while on screen.
- **Never colour alone.** Bars mark the top item with ▼ and "top"; bits show `1`/`0` glyphs and hatch a false positive with the words "maybe (false positive)"; curves differ by solid ●, dashed ■ and dash-dot ▲ and are labelled directly; a reference is dotted ink.
- **Palette.** At most 3 hue-coded series (cobalt, teal and vermilion, the "live" colour). The kit simulates protanopia, deuteranopia and tritanopia (Machado 2009) and requires every pair of series to stay apart (OKLab ΔE ≥ 8 under each simulation, ≥ 15 for normal vision).

## What you write

- `alt` of 40–600 characters that a reader who cannot see the figure can follow (`writing.md`).
- Labels with words: control labels, `labels`, `seriesLabels`, `refLabel`, `markerLabel`. A blank label, one that is only punctuation such as `-`, or a template that is only a placeholder such as `{marker}` fails.
- `seriesSpoken` when a series label has symbols a screen reader would mangle (`√ᾱ_t` → "signal").
- No colour in options and no colour words in text.

## What the audit proves (`scripts/audit.mjs`)

| Check | Fails with |
|---|---|
| alt ≥ 40 visible characters, a caption | `figure.alt: must be at least 40 characters` |
| labels say something | `options.seriesLabels[0] is empty; every label must say what it marks` |
| no colour in options | `options.seriesColors sets a colour; the kit owns the palette …` |
| at most 3 hue-coded series | `4 hue-coded series (…); at most 3 pass the colour-vision checks` |
| series stay apart under CVD | `series … and … are too close for deutan vision (ΔE 5.1)` |
| contrast: text 4.5:1, graphics 3:1 on paper and well | `--series-2 on --paper has contrast 2.80:1; it needs 3:1` |
| reduced-motion rule present | `no @media (prefers-reduced-motion: reduce) rule in the CSS` |
| `lang`, `<title>`, one `<main>`, an `<h1>` | `<html> has no lang attribute` |
| no inline `style=` | `inline style= attribute in the markup` |

The audit cannot judge whether your alt text is *true* or whether a label is helpful. Read them aloud against the figure (`verify.md`).
