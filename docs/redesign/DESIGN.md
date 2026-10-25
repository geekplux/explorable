# Redesign 2026-10: design spec

This replaces `docs/design/identity.md` ("Field notebook, live ink") as the binding visual spec. The target boards are in [`target/`](target/): open the `.html` files in a browser for exact CSS (every rule is in the `<style>` block), and the `.webp` files for a quick look. The canvas the boards came from: https://claude.ai/artifact/HkhMzGnf9Xzvc1awMuhicw.

The goal is a refined, interactive and easy short read for a curious reader with no background beyond school maths. Plain words come first. Formulas, citations and references sit behind small markers that open on click (math) or on hover and focus (sources), unless the idea cannot be understood without them.

## 1. Binding UI rules (Sean)

1. Never use "·" as a separator in copy.
2. No redundant explanatory text.
3. Copy fits the audience: clear, not too casual, no filler, no coined words.
4. Every colour comes from Radix Colors and follows the 12-step roles: 1–2 backgrounds, 3–5 component backgrounds, 6–8 borders, 9–10 solids, 11–12 text.
5. Optical alignment. Nested corners are concentric: outer radius = inner radius + padding.
6. Lines and borders are 0.5px.
7. Minimal motion. When used: ease-out, 250ms base.
8. At most 4 type sizes (12/14/20/32 here), smallest 12px. Hierarchy comes from weight, colour and spacing.
9. Minimise decisions the user must make. The theme follows `prefers-color-scheme` until the reader picks one with the header toggle (§4, Sean 2026-10-25).
10. No casual radius or shadow, no coloured left-stripe cards, no card inside a card.
11. No habitual eyebrows or overlines above headings ("Fig. 1", "arXiv paper", "Or start with one of these" all go). Keep a label only when it adds information the heading lacks.

The logo is exempt from rules 4 and 6 (its gradient and construction lines are its own).

Product rules still apply: never colour alone, CVD-safe (protanopia, deuteranopia, tritanopia), keyboard-operable, reduced motion respected, no decorative 3D.

## 2. Tokens

Radix Colors 3.0, three scales, light and dark (values in `target/Home.html`, `.ex` and `.ex.dark` blocks, or radix-ui.com/colors):

- `sand` (warm grey): page and ink. Page `sand-1`, text `sand-12`, secondary text `sand-11`, hairlines `sand-6` (rows) and `sand-7` (figure frames), fields `sand-2` with a 0.5px `sand-8` inset line.
- `indigo`: data and links. Bars `indigo-9`, the leading bar `indigo-11`, links `indigo-11` with a 0.5px `indigo-8` underline, TOC bracket `indigo-9`, TOC progress `indigo-6`.
- `orange`: one meaning only, "you can drag or switch this". Handle and slider fill: light `orange-10` (3.27:1 on sand-1, passes 3:1 for UI), dark `orange-9`.

Indigo and orange stay apart under all three CVD simulations; shapes (bar vs round handle) carry the difference too. Update `kit/src/color/palette.ts` and its `cvd.test.ts` to the new values; keep the tests' intent (pairwise ΔE under each simulation, contrast floors).

The old token names (`--paper`, `--ink`, `--live`, `--series-1` …) may stay as aliases while pages migrate, but every value must come from the Radix scales. Dark theme: `@media (prefers-color-scheme: dark)`, or a reader's choice of dark with the header toggle (§4), swaps the scales; nothing else changes.

Type:

| Size | Face | Use |
|---|---|---|
| 32 | Source Serif 4, 600, line 1.15, −0.015em | page titles (h1) |
| 20 | Source Serif 4, 400, line 1.6 (body) / 1.5 (ledes) | reading text, ledes, section titles at 600 |
| 14 | Geist 400/500 | interface, nav, figure titles, captions (Source Serif 4 italic) |
| 12 | Geist 400/500, Geist Mono | labels, numbers, readouts, URLs |

Self-host all three (SIL OFL), Latin subsets as woff2 in `public/fonts/`, same approach as today (`src/styles/fonts.css`, `identity.md` §2). Keep the "Explorable Greek" / "Explorable Math" fallback faces for √, Σ, ∂, Greek letters if Source Serif 4 lacks a glyph. Readout numbers use tabular figures.

Shape: lines 0.5px; fields and buttons radius 10; no shadows except the 0.5px inset line on fields; figures have a hairline above and below and no box.

Motion: `--ease: cubic-bezier(0.2, 0.7, 0.2, 1)` (ease-out), `--dur: 250ms`. All of it is off under `prefers-reduced-motion: reduce`.

## 3. Logo: the spiral

A tapered stroke along the golden spiral's Fibonacci arcs, warming inward from indigo through violet and rose to a lit amber point. Drawn over its 0.5px construction squares at large sizes.

- Geometry, gradient, sizes: `target/Spiral.html` and the generator (`spiralShape`, `spiralMark` in `/mnt/project-files/explorable/redesign/reference/gen.mjs`). Exported SVGs: `/mnt/project-files/explorable/redesign/reference/logo/*.svg`.
- Arcs (cx, cy, r, from°, to°) in a 64 viewBox: `[38,48,32,180,270] [38,36,20,270,360] [46,36,12,0,90] [46,40,8,90,180] [42,40,4,180,270] [42,38,2,270,360]`.
- ≥ 28px: `spiralShape(7.5, 1)`, construction lines `M6 16H58V48H6ZM38 16V48M38 36H58M46 36V48M38 40H46M42 36V40` at 0.5px in `--logo-faint` (light `#b9bbc6`, dark `#5a6169`), compass dots r 0.9 at the first four arc centres, amber end dot r 2.6 with a halo (r 7, amber 0.55 → 0).
- < 28px: no construction, no halo, `spiralShape(10, 2.4)`, end dot r 3.4.
- Lockups (header, footer) use the wide crop: viewBox `3 10 58 41`, width = round(size × 58 / 41).
- App icon / favicon: the small mark on an ink (`#111110`) rounded square, rx 14.
- Gradient ids must be unique per instance on a page (two marks on one page today: header and footer).
- Budget: the inline header mark ≤ 4 KB. The generator's outline is dense; resample it (fewer points, or a smoothed cubic path) as long as edges stay smooth at 4× zoom. Compare against `target/Spiral.webp`.

Wordmark: the mark + "Explorable" in Source Serif 4 600, 20px (header), 14px (footer), gap 10px / 8px. Capital E in the wordmark and in all copy ("Explorable"); the skill command stays `/explorable`.

## 4. Chrome

- Header (all pages, including home): 64px tall, 0.5px `sand-6` bottom line, 120px side padding at 1440 (fluid: `clamp(16px, 8.3vw, 120px)`). Wordmark left; nav right in Geist 14 `sand-11`: Essays (home `#essays`), How it works (home `#how`), GitHub. Phone: wordmark and the theme toggle.
- Theme toggle: one 44px icon button after the nav, an 18px `sand-11` icon (`sand-12` on hover) for the theme it switches to (moon in light, sun in dark), named "Switch to dark theme" / "Switch to light theme". It sets `<html data-theme>` and localStorage; picking the system's own theme clears both, so the page follows the system again. `public/theme-init.js` applies the stored choice before first paint; print stays light.
- "Made by GeekPlux" block above the footer, on every page: a link to https://geekplux.com first ("Writing, projects and data visualization"), then a 2×2 list: Vert (vert.geekplux.org, "Turn a GPX track into a terrain poster"), Reasontrail (reasontrail.geekplux.com, "See how your coding agent got there"), Pagelapse (pagelapse.geekplux.com, "Watch a web page change over the years"), markvis (github.com/geekplux/markvis, "Charts written in Markdown").
- Footer: small wordmark left; right: Source on GitHub, Accessibility, MIT licence (plain text). No "·", no "Made with explorable".
- No "← All explorables" back links: the wordmark goes home.

## 5. Home (`/`), boards Home, HomeDark, HomePhone

1. Hero, two columns at desktop (480px text, 600px figure), stacked on phone:
   - h1 "Hard ideas, made clear with figures you can drag."
   - Lede: "Paste a link to a paper or a blog post. You get a short read in plain words about its one big idea, with figures to play with. No math required."
   - The URL field: visible label "Paste a link or type a topic", mono input with placeholder `https://arxiv.org/abs/1706.03762`, button "Explain" (sand-12 solid). Keeps all current behaviour (draft, search for topics, offline banner, errors).
   - Right: a live figure, the attention sample's temperature figure (softmax-temperature model) mounted with the kit, with its readout ("top weight", "entropy … bits") and the caption "Drag *T*. The word “sat” spreads its attention over the sentence; a low temperature lets one word take it all. From [Why attention divides by √d]." linking to the essay.
2. "Essays" (h2, 20/600, hairline under): a numbered list, not cards. Each row: number (01, 12px), title (20/600), dek (20, sand-11), meta line (source host in mono, "4 sections, 2 figures"), and a 240px thumbnail of the essay's first figure at rest with its handle (desktop only). Thumbnails are static SVG in the new style (see board), regenerated by a script from the samples.
3. "How it works" (h2), three numbered steps: **Read.** Explorable fetches the page and keeps only the text: a paper’s abstract and body, or a post’s article. **Explain.** One model call finds the one big idea and explains it in plain words, for a curious reader with no background. Formulas and sources wait behind a click. **Show.** Each figure comes from a kit of tested components, so what you drag runs a real model of the idea, not an animation. Then a row: "**In your coding agent.** The same kit ships as the `/explorable` skill." and the install command in a mono box.
4. Made by GeekPlux, footer.

Search results, the offline banner, loading and error states restyle to these tokens with no new chrome.

## 6. Essay (`/s/:slug`, `/x?url=`), boards Essay, EssayPhone

- A 640px centred reading column; figures 720px wide (−40px each side); phone: 16px gutters, figures full column width.
- Title block: h1 32; lede (the dek) 20 sand-11; byline row: "Based on [source title], Vaswani et al., 2017" (Geist 14, sand-11, title link in sand-12) with the PDF button at the right end (phase 6). No kicker. For AI-written essays add one short sentence to the byline, "Written by AI from the source.", instead of the separate provenance line; curated and matched essays show nothing extra.
- Contents in the left gutter at ≥ 1280px wide (hidden below): ported from geekplux.com `web/src/islands/Toc.tsx` (the `geekplux/site` repo): right-aligned toward the text, a 2px `sand-4` track whose `indigo-6` fill shows reading progress (CSS scroll timeline, no script), an `indigo-9` bracket on the track over the sections in view, those entries shift 3px toward the text and turn `sand-12`; the bracket moves in 250ms. Entries: the section headings plus "Takeaway". No "Contents" label.
- Section headings: 20/600 with the section number (12px Geist, sand-11) hanging in the gutter to the left.
- Body 20/1.6, paragraphs 20px apart, sections 56px apart.
- Variables in italics, as in a paper: `d_k` renders as italic *d* with a 14px subscript k; lone T, q, k, and other single-letter variables inside math spans are italic. Do this in the kit's inline formatter, not by hand in content.
- Figures: hairline above and below (`sand-7`), title in Geist 14/500 (no "Fig. n"), the stage, controls (switches: 32×18 track `sand-6`, `--handle` knob), a foot row with the readout (mono 12, numbers in sand-12 500) and a "Show data" text button that opens the existing data table, then the caption in Source Serif 4 italic 14 sand-11.
- Takeaway: hairline above, h2 "Takeaway", the paragraph, then "Read the original paper" (or "Read the original post").
- Then Made by GeekPlux and the footer.

## 7. Notes: formulas and sources behind a click (phase 4)

- A math note is a small square button after the sentence it belongs to (14px Σ glyph drawn as an SVG path, `indigo-3` background, `indigo-11` glyph; `indigo-9` background and `sand-1` glyph when open), `aria-expanded`, `aria-controls`, label "Show the math". Click or Enter/Space toggles a note panel right under the paragraph: `sand-2` background, radius 10, the formula centred in Source Serif 4 at 20, variables italic, then a 14px plain-words gloss. Several can be open at once. Not hover-only.
- A source note is the author name in the text ("Vaswani et al.") with a dotted 0.5px underline; hover or focus shows a small card (paper title, authors and year, "Open the paper on arXiv"). Esc closes it. Touch: tap toggles.
- Content model in §9.

## 8. PDF (phase 6), board Print

- A "PDF" text button with a download glyph at the right end of the byline row.
- A4 (794 × 1123 CSS px at 96dpi), margins as on the board; a running head (small wordmark left, the essay URL right); no header, footer, TOC, Made by GeekPlux or buttons.
- Figures print in their current state, with one line under the readout: "Shown at *T* = 1. Interactive version at explorable.geekplux.com/s/attention#fig-…". Notes print only if open; the pre-rendered sample PDFs open every math note (paper has no click).
- Built-in samples link to pre-rendered PDFs in `public/pdf/<slug>.pdf` (a script renders them with headless Chromium from the built site; committed). Essays from a pasted URL use `window.print()` with the same print stylesheet (the browser's "Save as PDF"). Cloudflare Browser Rendering is a later option, not in this redesign (see DECISIONS).

## 9. Content model and AI (phases 4 and 5)

ExplorableDoc v2 (kit `doc/schema.ts`), v1 stays valid:

- `version: 2`.
- Optional `notes: Note[]` at doc level, at most 12, ids unique, `^[a-z][a-z0-9-]{0,23}$`:
  - `{ id, kind: 'math', formula: string ≤ 160, plain: string ≤ 240 }`
  - `{ id, kind: 'source', label: string ≤ 60, title: string ≤ 200, detail?: string ≤ 120, url?: https URL }`
- Paragraphs may reference a note with `[[id]]`. A math marker renders after the preceding sentence; a source marker renders as its `label` with the card. Unknown ids are a validation error. At most one math marker per paragraph.
- Body text has no formulas: a validator check flags any paragraph whose `code` spans or symbol density look like a formula (the audit script and the Worker's post-process share this function).

Prompt p3 (`worker/plan/prompt.ts`, bump `PROMPT_VERSION` to `p3`): the reader is curious with no background beyond school maths; plain words; one big idea; formulas and citations go into notes, never into the body; at most one math note per paragraph; the takeaway restates the idea in words, not with the formula. No retries (the existing one-call decision stands): a deterministic post-process moves any formula left in the body into a math note and records a reading-level flag (Flesch–Kincaid grade, logged, not shown) for monitoring.
