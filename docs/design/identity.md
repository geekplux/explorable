# Identity spec for Phase 2: "Field notebook, live ink"

Written by `explorable-designer` on 2026-10-19 for `phase-2-design-system`. This spec confirms PLAN.md §4 and makes it implementable. **Where this file and PLAN §4 disagree, this file wins** (deltas listed in §0). Figure internals (bars, bits, histogram, curve, knobs that move) are Phase 4+ and are out of scope here, apart from the class names Phase 4 will fill in.

Reference render of the mark, wordmark, type and gallery cards (headless Chrome, real subsetted fonts): [`assets/identity-specimen.png`](assets/identity-specimen.png).

**Designer sign-off on distinctiveness (PLAN §7 Phase 2 risk).** The identity rests on three things no template has: (1) one colour, vermilion, means "your hand goes here", and it always comes as the same hollow ring knob, in the logo, in every thumbnail and in every figure; (2) a mark that *is* the product (a curve, a slider track, and a knob whose position you read off the curve); (3) a warm paper and near-black ink pairing with a soft-cornered display serif, set like a lab notebook (small-caps kickers, hanging section numbers, hairline rules). It does not borrow from any of Sean's other sites.

---

## 0. Deltas from PLAN §4 (main agent: record in DECISIONS.md and update §4.1)

| # | Change | Why |
|---|---|---|
| 1 | `--series-1` cobalt `#2457C5` → **`#2851C0`** | With `#2457C5` the cobalt↔teal pair is **7.98** under tritan simulation (the validator prints it rounded as "8.0"). A5 requires ≥ 8, so the Phase 2 unit test would fail. `#2851C0` is ΔE 1.6 from the old value (not visibly different) and gives **9.51**. It also raises link and focus contrast (6.54:1 on paper). |
| 2 | Fonts: ᾱ, √, Greek letters, subscripts, ∂, ≈ and arrows are **not in Fraunces or Newsreader at all** (checked the full OFL source fonts, not only the Latin subset). No subset or `unicode-range` on these two families can fix it. Two tiny self-hosted fallback faces cover them instead (§2.3). | Without this, √ in "Why attention divides by √d" renders in whatever system font happens to be installed, and looks different on every OS. |
| 3 | Fraunces and Newsreader ship as **static-optical-size instances** (Fraunces opsz 48, SOFT 50, WONK 0; Newsreader opsz 16), each keeping only the `wght` 400–700 axis. | Keeping `opsz` doubles the file size (Fraunces 62 KB → 33 KB, Newsreader 99 KB → 43 KB) and blows the 70 KB preload budget. SOFT 50 gives the slightly rounded "ink" terminals. |
| 4 | Mark knob at `cx=20` (PLAN said 19), and the drop line ends in a filled ink dot on the curve at (20, 12.5). | At x = 20 the curve is exactly at y = 12.48, so the "reading" dot sits on the line. |
| 5 | Highlighted top bar in thumbnails uses the filled ink ▼ plus "top", not a ring. | Same reason as samples.md §6: a ring means "draggable" and nothing else. |
| 6 | Card = paper surface with a `--well` thumbnail band (a mini figure card), not a full `--well` card. | The thumbnail then reads as "a still from a figure", and the card text sits on the highest-contrast surface. |

---

## 1. Colour tokens (final)

All hex values are final for v1 light theme. `tokens.css` must contain exactly these names and values (case-insensitive), and `kit/src/color/palette.ts` must export the same values.

| Token | Hex | Use | Contrast (WCAG 2.x) |
|---|---|---|---|
| `--paper` | `#FBF8F1` | page background, card surface | – |
| `--well` | `#F3EEE2` | figure card surface, thumbnail band | – |
| `--rule` | `#D8D0BF` | hairlines, borders, grid. Decorative only, never meaning | 1.45 paper / 1.32 well |
| `--ink` | `#1D1B17` | body text, headings, axes | 16.21 paper / 14.85 well |
| `--ink-2` | `#5A554B` | secondary text, captions, kickers, labels | 6.98 paper / 6.40 well |
| `--ink-3` | `#7A7365` | minor ticks, slider tracks, pill borders. **Graphics only, never text** | 4.43 paper / 4.06 well |
| `--live` | `#C4451C` | draggable things only: knobs, slider thumbs | 4.70 paper / 4.30 well (graphics ≥ 3 ✓) |
| `--live-ink` | `#A93A12` | vermilion *text*: error headings | 6.00 paper / 5.50 well / 5.17 on live-wash |
| `--live-wash` | `#FBE3D8` | error panel tint (always with icon + text) | ink on it 13.98 |
| `--series-1` | **`#2851C0`** | cobalt: primary data, links, **focus ring** | 6.54 paper / 5.99 well / 5.64 live-wash / 5.63 note-wash |
| `--series-2` | `#0F8A6E` | teal: secondary series. **Graphics only** | 4.06 paper / 3.72 well |
| `--note-wash` | `#F6E7B8` | ochre highlighter: "current value" chips, `::selection` | ink on it 13.95 |

Supporting tokens (not colour-checked):

| Token | Value |
|---|---|
| `--font-display` | `Fraunces, "Explorable Greek", "Explorable Math", Georgia, "Times New Roman", serif` |
| `--font-text` | `Newsreader, "Explorable Greek", "Explorable Math", Georgia, "Times New Roman", serif` |
| `--font-ui` | `ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif` |
| `--font-mono` | `ui-monospace, "SF Mono", Menlo, Consolas, monospace` |
| `--space-1 … --space-8` | `.25rem .5rem .75rem 1rem 1.5rem 2rem 3rem 4rem` |
| `--radius` / `--radius-pill` | `10px` / `999px` |
| `--ease` | `cubic-bezier(.2,.7,.2,1)` |
| `--dur-ui` | `160ms` (PLAN cap is 200 ms) |
| `--measure` | `38rem` (essay text column) |
| `--wide` | `56rem` (figure breakout) |
| `--shell` | `60rem` (gallery, header, footer) |

### 1.1 Validator numbers (computed for this spec)

Method: Machado, Oliveira & Fernandes 2009, severity 1.0, applied in **linear** sRGB, clamped to [0, 1], then Euclidean distance in OKLab × 100. This is the same as the dataviz `validate_palette.py`. `cvd.ts` must use this exact pipeline; applying the matrices to gamma-encoded values gives different numbers.

| Pair | normal | protan | deutan | tritan |
|---|---|---|---|---|
| cobalt `#2851C0` ↔ vermilion `#C4451C` | 33.20 | 25.94 | 31.00 | 30.82 |
| cobalt `#2851C0` ↔ teal `#0F8A6E` | 23.31 | 22.16 | 21.24 | **9.51** (was 7.98 with `#2457C5`) |
| vermilion `#C4451C` ↔ teal `#0F8A6E` | 25.69 | 13.50 | **10.58** | 31.20 |

Worst CVD pair: 9.51 (≥ 8 ✓). Worst normal pair: 23.31 (≥ 15 ✓). `validate_palette.py --pairs all --surface "#FBF8F1"` and `--surface "#F3EEE2"` with `#2851C0,#C4451C,#0F8A6E`: all five checks PASS on both surfaces (lightness band 0.43–0.77, chroma ≥ 0.1, CVD, normal floor, contrast ≥ 3:1).

The 4th-hue rule from PLAN §4.1 stands: at most 3 hue-coded series; anything more uses ink with line style or pattern.

### 1.2 What `cvd.test.ts` asserts (P2 AC 1)

1. For each of the 3 series pairs and each of protan, deutan, tritan: ΔE ≥ 8. Normal vision ΔE ≥ 15.
2. A table-driven check that rejects a fourth series: the test iterates `SERIES` (exported from `palette.ts`), so adding a fourth entry runs it through the same assertions. Include one negative test proving the checker fails a known bad pair (for example `#2457C5`/`#0F8A6E` tritan 7.98 < 8), so the test can't pass vacuously.
3. Text contrast ≥ 4.5 on **both** `--paper` and `--well` for `--ink`, `--ink-2`, `--live-ink`, `--series-1`.
4. Graphics contrast ≥ 3 on both surfaces for `--live`, `--series-1`, `--series-2`, `--ink-3`.
5. `--live-ink` on `--live-wash` ≥ 4.5, and `--ink` on `--note-wash` ≥ 4.5.
6. Reference values to pin the implementation (± 0.02): cobalt↔teal tritan 9.51; vermilion↔teal deutan 10.58; `--ink-2` on `--well` 6.40; `--series-2` on `--well` 3.72.

---

## 2. Typography

### 2.1 Files (`public/fonts/`, all SIL OFL 1.1)

| File | Source (github.com/google/fonts, `ofl/…`) | Instance | Subset | Size (measured) | Loading |
|---|---|---|---|---|---|
| `fraunces-latin.woff2` | `fraunces/Fraunces[SOFT,WONK,opsz,wght].ttf` | SOFT=50, WONK=0, opsz=48, wght 400–700 kept | Latin (below) | 33.3 KB | normal (`font-display: swap`) |
| `newsreader-latin.woff2` | `newsreader/Newsreader[opsz,wght].ttf` | opsz=16, wght 400–700 kept | Latin | 43.0 KB | **preloaded** |
| `newsreader-italic-latin.woff2` | `newsreader/Newsreader-Italic[opsz,wght].ttf` | opsz=16, wght 400–700 | Latin | 47.8 KB | lazy (only when italic is used) |
| `symbols-greek.woff2` | `notoserif/NotoSerif[wdth,wght].ttf` | wdth=100, wght 400–700 | Greek list (below) | 13.9 KB | lazy via `unicode-range` |
| `symbols-math.woff2` | `stixtwomath/STIXTwoMath-Regular.ttf` | static 400 | math list (below) | 6.4 KB | lazy via `unicode-range` |
| `OFL.txt` | – | – | – | – | contains all four copyright lines + the OFL text |

Budget: preloaded fonts = 43.0 KB (≤ 70 KB, P1 ✓). First load of `/` = 33.3 + 43.0 + 13.9 + 6.4 ≈ 97 KB, because the card titles and deks contain √, ᾱ and ₀. That matches D13's "about 95 KB".

OFL.txt copyright lines, verbatim:
- `Copyright 2018 The Fraunces Project Authors (https://github.com/undercasetype/Fraunces)`
- `Copyright 2020 The Newsreader Project Authors (http://github.com/productiontype/Newsreader)`
- `Copyright 2022 The Noto Project Authors (https://github.com/notofonts/latin-greek-cyrillic)`
- `Copyright 2001-2021 The STIX Fonts Project Authors (https://github.com/stipub/stixfonts), with Reserved Font Name "TM Math". STIX Fonts™ is a trademark of The Institute of Electrical and Electronics Engineers, Inc.`

Because subsetting counts as modifying the font, the two symbol subsets **must be renamed internally** (name IDs 1, 4, 6, 16, 17) to `Explorable Greek` / `Explorable Math`. Their CSS family names are the same. This keeps us clear of Reserved Font Names and trademarks.

### 2.2 Build recipe (run once; binaries are committed)

The implementer may put this in `scripts/fonts/README.md` (docs, not a build step). The fontTools at `/usr/local/bin` has no brotli, so use a throwaway venv: `python3 -m venv /tmp/fontvenv && /tmp/fontvenv/bin/pip install fonttools brotli`. Download the TTFs with `curl -L https://github.com/google/fonts/raw/main/ofl/<path>` (URL-encode `[`, `]`, `,`) into a fresh empty directory.

```
LATIN="U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD"
FEAT="kern,liga,clig,calt,ccmp,locl,mark,mkmk,case,tnum,pnum,lnum,onum,sups,ordn,frac,numr,dnom"
python -m fontTools.varLib.instancer Fraunces.ttf SOFT=50 WONK=0 opsz=48 wght=400:700 -o fr.ttf
python -m fontTools.varLib.instancer Newsreader.ttf opsz=16 wght=400:700 -o nr.ttf
python -m fontTools.varLib.instancer Newsreader-Italic.ttf opsz=16 wght=400:700 -o nri.ttf
python -m fontTools.varLib.instancer NotoSerif.ttf wdth=100 wght=400:700 -o ns.ttf
for f in fr nr nri; do python -m fontTools.subset $f.ttf --unicodes="$LATIN" --layout-features="$FEAT" --flavor=woff2 --output-file=$f.woff2; done
python -m fontTools.subset ns.ttf --unicodes="U+0391-03A9,U+03B1-03C9,U+1FB1,U+1FB9,U+0304,U+2070-209F,U+1D40,U+1D62,U+2C7C" \
  --layout-features="kern,mark,mkmk,ccmp,locl" --flavor=woff2 --output-file=symbols-greek.woff2
python -m fontTools.subset STIXTwoMath-Regular.ttf --unicodes="U+00B1,U+00D7,U+00F7,U+2190-2199,U+2202,U+2207,U+2208,U+2211,U+2212,U+221A,U+221D,U+221E,U+2223,U+2227-222B,U+2248,U+2260-2265,U+22C5" \
  --layout-features="" --flavor=woff2 --output-file=symbols-math.woff2
# then rename name IDs 1/4/6/16/17 of the two symbol files (fontTools: font['name'].setName(...)) and re-save as woff2
```

Expected sizes are within ±1 KB of §2.1. Fraunces 400–700 still covers wordmark 650, h1/h2 600 and card titles 600.

### 2.3 Glyph coverage and the fallback strategy (the ᾱ / √ question)

Measured against the **full** OFL source fonts:

| Glyphs used in samples | Fraunces | Newsreader | Served by |
|---|---|---|---|
| Latin, “ ” … · − ³ Ł | yes | yes | the main faces (Latin subset) |
| ᾱ (U+1FB1), β δ ε Σ, ₀–₉, ᵢ ᵀ ⱼ | **no** | **no** | `Explorable Greek` (Noto Serif, 400–700, weight-matched) |
| √ ∂ ≈ ≤ ≥ ∞ ← ↗ → × ± | **no** | **no** | `Explorable Math` (STIX Two Math 400; Chrome synthesises bold in h1/h2) |

`@font-face` rules (in `src/styles/tokens.css`, `font-display: swap` on all):

| family | src | weight | style | unicode-range |
|---|---|---|---|---|
| `Fraunces` | `/fonts/fraunces-latin.woff2` | `400 700` | normal | Latin list above |
| `Newsreader` | `/fonts/newsreader-latin.woff2` | `400 700` | normal | Latin list |
| `Newsreader` | `/fonts/newsreader-italic-latin.woff2` | `400 700` | italic | Latin list |
| `Explorable Greek` | `/fonts/symbols-greek.woff2` | `400 700` | normal | `U+0370-03FF, U+1F00-1FFF, U+2070-209F, U+1D00-1DBF, U+2C60-2C7F` |
| `Explorable Math` | `/fonts/symbols-math.woff2` | `400` | normal | `U+00B1, U+00D7, U+00F7, U+2190-21FF, U+2200-22FF` |

**Watch this:** the two symbol faces must be **two different family names**. Do not use one family with two `@font-face` rules and different weight descriptors. I tried that first: Chrome groups faces by descriptors, picks the Greek face for every weight, and never loads the math face, so √ falls back to a system font. With two names, both load (verified: `document.fonts` reports both `loaded` on a page with √ and ᾱ).

`index.html`: `<link rel="preload" href="/fonts/newsreader-latin.woff2" as="font" type="font/woff2" crossorigin>`. That is the only preload.

UI (`--font-ui`) and readouts (`--font-mono`) stay on system fonts. Every platform's system UI and monospace fonts include Greek and √, and putting a serif fallback into a monospace stack would break column alignment. Screen-reader strings still spell symbols out (diffusion.md, "alpha-bar").

### 2.4 Scale and roles

| Role | Font | Size / line-height | Weight | Colour | Notes |
|---|---|---|---|---|---|
| Wordmark (home) | display | 2.75rem / 1 (2.25rem < 640 px) | 650 | ink | letter-spacing −0.01em |
| Wordmark (header) | display | 1.25rem / 1 | 650 | ink | |
| h1 (essay, not-found) | display | `clamp(2rem, 5vw, 2.75rem)` / 1.1 | 600 | ink | `text-wrap: balance` |
| h2 (essay sections) | display | 1.5rem / 1.25 | 600 | ink | hanging number, §5.2 |
| Card title (h3) | display | 1.25rem / 1.25 | 600 | ink | |
| Pitch (home) | text | 1.25rem / 1.45 | 400 | ink-2 | max 34ch |
| Dek | text | 1.25rem / 1.45 | 400 | ink | |
| Body | text | 1.1875rem / 1.6 (1.0625rem < 640 px) | 400 | ink | `hanging-punctuation: first` where supported |
| Caption | text italic | 0.9375rem / 1.5 | 400 | ink-2 | |
| Card dek | text | 0.9375rem / 1.5 | 400 | ink-2 | |
| Kicker ("ARXIV PAPER", "FIG. 1", "START WITH ONE OF THESE") | ui | 0.8125rem | 500 | ink-2 | `font-variant-caps: all-small-caps; letter-spacing: .06em` |
| UI text (back link, source line, provenance, footer) | ui | 0.9375rem / 1.4 | 400 | ink-2 (links cobalt) | |
| Source chip, readouts, inline `code` | mono | 0.8125rem (code 0.9em) | 400 | ink-2 / ink | `font-variant-numeric: tabular-nums` |

Links: `--series-1`, underline `text-decoration-thickness: 1px; text-underline-offset: .18em`; on hover thickness 2px. Visited is the same colour. `::selection { background: var(--note-wash); color: var(--ink) }` (13.95:1).

---

## 3. Mark, wordmark, favicon

Files: copy `docs/design/assets/mark.svg` → `src/assets/mark.svg`, `docs/design/assets/favicon.svg` → `public/favicon.svg`, and `not-found-mark.svg` for §7. Markup is final; do not redraw.

### 3.1 Mark (32 × 32 grid)

An ink bell curve over a slider track. The vermilion ring knob on the track selects a position, and a dotted ink drop line leads up to a filled ink dot where the curve "answers". It reads in monochrome too: ring, line and dot are shapes, not colours.

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="32" height="32" fill="none"><path d="M4 22C10 22 12 8 16 8S22 22 28 22" stroke="#1D1B17" stroke-width="2.5" stroke-linecap="round"/><path d="M4 27H28" stroke="#1D1B17" stroke-width="2" stroke-linecap="round"/><path d="M20 21.5V14.5" stroke="#1D1B17" stroke-width="1.5" stroke-linecap="round" stroke-dasharray="0 3.5"/><circle cx="20" cy="12.5" r="2" fill="#1D1B17"/><circle cx="20" cy="27" r="3.5" fill="#FBF8F1" stroke="#C4451C" stroke-width="2.5"/></svg>
```

Minimum size 20 px. Below that, use the favicon variant. When inlined in React, replace the hex values with `currentColor` (curve, track, line, dot) and `var(--live)` / `var(--paper)` for the knob, so the mark follows the tokens.

### 3.2 Favicon (`public/favicon.svg`)

Heavier strokes, no drop line, and a paper rounded square so it shows on dark tab strips.

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" fill="none"><rect width="32" height="32" rx="7" fill="#FBF8F1"/><path d="M4 21C10 21 12 7 16 7S22 21 28 21" stroke="#1D1B17" stroke-width="3" stroke-linecap="round"/><path d="M4 26.5H28" stroke="#1D1B17" stroke-width="2.5" stroke-linecap="round"/><circle cx="20" cy="26.5" r="3.75" fill="#FBF8F1" stroke="#C4451C" stroke-width="3"/></svg>
```

`index.html`: replace `<link rel="icon" href="data:,">` with `<link rel="icon" href="/favicon.svg" type="image/svg+xml">`. `theme-color` stays `#FBF8F1`.

### 3.3 Wordmark (`src/components/Wordmark.tsx`)

- Structure: `<span class="wordmark">` + inline mark `<svg aria-hidden="true" focusable="false">` + the real text `explorable` (lowercase). The accessible name comes from the text, so the SVG is hidden. The `title` prop from PLAN §4.5 becomes unnecessary; if the implementer keeps it, it must not double-announce.
- Props: `size: 'home' | 'header'` (2.75rem / 1.25rem font-size).
- Geometry: `display: inline-flex; align-items: baseline; gap: .18em`. The SVG is `width: 1.25em; height: 1.25em; position: relative; top: .195em`, so the mark's slider track (y = 27/32) sits **exactly on the text baseline**: the word rests on the track.
- Font: `--font-display`, weight 650, letter-spacing −0.01em, ink.
- On `/` it is the content of the page's `h1` (`<h1 tabIndex={-1}><Wordmark size="home"/></h1>`, accessible name "explorable"). On other pages it is a link `<a href="/" aria-label="explorable, home">` inside the header.

---

## 4. Header and footer

**Header** (`Header.tsx`): `<header class="site-header">` inside a `--shell` container, padding `--space-5` top / `--space-4` bottom.
- On `/` there is no separate bar. The hero is the `h1` wordmark, then the pitch.
- On every other page: the header-size wordmark link on the left, and a 1px `--rule` bottom border across the shell width. Nothing else. No nav menu, no theme toggle.

**Footer** (`Footer.tsx`): `<footer class="site-footer">` in a `--shell` container, a 1px `--rule` top border, `--space-7` margin above, padding `--space-5` 0 `--space-7`. The text is UI font 0.875rem in ink-2:
`Made with explorable · MIT licence · Source on GitHub · Accessibility`
- "MIT licence" → `https://github.com/geekplux/explorable/blob/main/LICENSE`.
- "Source on GitHub" → `https://github.com/geekplux/explorable`.
- "Accessibility" → `https://github.com/geekplux/explorable#accessibility`.
- Separators `·` are `aria-hidden="true"`. The link list is a `<ul>` with inline items. Every link is a ≥ 44 × 44 target (§8).

---

## 5. Pages and components

### 5.1 Gallery (`/`)

Top to bottom, in a `--shell` container (`width: min(60rem, 100% - 2.5rem)`, centred):
1. `h1` wordmark (home size), margin-top `--space-7` (desktop) / `--space-6` (< 640).
2. Pitch, unchanged copy: "The core idea of a paper or post, rebuilt as a short essay with figures you can drag." Text font, 1.25rem, ink-2, `max-width: 34ch`.
3. A reserved slot for `UrlField` (built in Phase 10). In Phase 2 render **nothing**: no placeholder box and no fake input (F1 allows no non-functional inputs).
4. Kicker `h2` "Start with one of these" (PLAN 4.3 says "Or start with one of these"; the "Or" only makes sense once the URL field exists, so P10 changes the copy). Margin `--space-7` 0 `--space-4`.
5. Card grid `<ul class="cards">`: `display: grid; gap: 1.25rem`. 1 column below 640 px, `repeat(2, 1fr)` at `min-width: 640px`, `repeat(3, 1fr)` at `min-width: 960px`. Use viewport media queries, not `auto-fill`, so the column counts are exact at 1280 / 800 / 390.
6. Footer.

### 5.2 Sample card (`SampleCard.tsx`)

```
┌──────────────────────────────┐  paper surface, 1px --rule border, radius 10px, overflow hidden
│  [thumbnail 16:9, --well]    │  <img src=thumb alt="" width=320 height=180>, bottom border 1px --rule
├──────────────────────────────┤
│ Why attention divides by √d  │  h3 > a (display 600, 1.25rem, ink, no underline)
│ Dot products of random …     │  dek (text 0.9375rem, ink-2), clamp to 4 lines
│ (arXiv 1706.03762)           │  source chip: mono 0.8125rem ink-2, 1px --rule pill
└──────────────────────────────┘
```
- Markup order inside `<li class="card">`: `img`, `h3 > a`, `p.card-dek`, `p.card-source`. The link is the only focusable element. Keep the Phase 1 stretched-link pattern (`a::after { position:absolute; inset:0 }`), so the whole card is the hit area.
- Body padding `.9rem 1.1rem 1rem`. The dek is clamped with `-webkit-line-clamp: 4` (full text stays in the DOM).
- Thumbnail `alt=""`: the title and dek already say everything, and the image is a decorative still. The SVG files keep their own `<title>` for standalone viewing.
- Hover (pointer only, `@media (hover: hover)`): `transform: translateY(-2px)`, border-color `--ink-3`, title underline. Transition `transform, border-color` over `--dur-ui` with `--ease`.
- Focus: the card shows the focus ring via `.card:has(a:focus-visible)` (§8), and the link's own outline is suppressed only inside cards.
- **Never colour alone:** cards differ by thumbnail drawing and text, not hue.

### 5.3 Thumbnails (`src/samples/thumbs/<slug>.svg`)

Copy from `docs/design/assets/thumbs/`. Common frame: `viewBox="0 0 320 180"`, a full `--well` background rect, system UI / mono text only (an `<img>` SVG cannot use page web fonts), token hex values only, and **exactly one vermilion ring knob with a 3-line grip** on a `--ink-3` track at the bottom, with its current value in mono at the right. That is the visual promise: every sample has something to drag. Each shows its Fig 1 at the default state from `docs/figures/*.md`. P6 may replace them with generated stills that follow the same frame.

| Slug | Drawing (all values are the real defaults) | Non-colour encodings |
|---|---|---|
| `attention` | Six cobalt bars with ink outline for "the cat sat on the mat" at T = 1 (softmax of [0.3, 2.5, 1.2, 0.4, 0.3, 1.4]: 0.057, 0.513, 0.140, 0.063, 0.057, 0.171) on a fixed 0–1 axis with `--rule` gridlines at .25/.5/.75/1. Token labels under bars. Filled ink ▼ + bold "top 0.51" over "cat". Log track for T (ticks 0.1, 0.5, 1, 2, 5), knob at T = 1, readout "T = 1.00". | bar height and position, the ▼ shape, direct labels |
| `bloom-filter` | 32 bits as 2 rows × 16 (cells 16 × 20). Set bits (n = 8, k = 3: {0,1,4,5,7,8,9,10,12,14,16,18,19,21,23,24,27,29,30,31}, 20 of 32) are ink fill with a paper "1". Unset bits are paper fill, `--rule` border, ink-2 "0". Query chip "cat?" with 3 ink arrows to bits 1, 4, 7, each probed cell boxed by a 3 px cobalt outline drawn **outside** the cell, then ✓ "maybe". "20 / 32 bits set" in mono. n track 0–12, knob at 8, "n = 8". | 0/1 glyphs, arrows, outline boxes, ✓ + word |
| `diffusion` | Histogram at t = 0: two clumps (modes −2 and +1.5, σ 0.25, analytic bin masses, 40 bins over [−4, 4]) as cobalt bars with ink outline, a dotted ink N(0, 1) curve directly labelled "N(0, 1)", x ticks −4…4. t track (ticks 0/250/500/750/1000), knob at t = 0, "t = 0". | dotted vs solid fill, direct label |

Contrast inside thumbnails: ink-2 text on well 6.40; paper "1" on ink 16.2; cobalt outline on well 5.99.

Note for the P5 figure designer: a cobalt probe outline drawn *inside* an ink-filled cell is nearly invisible (cobalt on near-black). Draw it outside the cell, as the thumbnail does.

### 5.4 Essay page (`/s/:slug`) and `kit.css`

Page structure: Header (header-size wordmark), `main.page.essay-page`, Footer.

**Columns without `100vw`** (avoids scrollbar-induced horizontal scroll):
- `.essay-page` is full width with `padding-inline: 1rem`.
- Text blocks (hero children, section `p`, `h2`, takeaway, back nav) use `max-width: var(--measure); margin-inline: auto`, plus `padding-inline: .25rem` < 640 px. That gives the plan's `min(38rem, 100% − 2.5rem)`.
- `.xfig` uses `max-width: var(--wide); margin: var(--space-6) auto`. The figure breaks out of the text column and keeps ≥ 1rem gutters.

**Hero** (`.essay-hero`): back nav ("All explorables", arrow `aria-hidden`), then `--space-6`, kicker (`essay-kicker`), h1, dek, source line (UI font, ink-2; the cited title link in cobalt), provenance pill. Bottom margin `--space-7`.

**Provenance pill** (`.essay-provenance`): UI font 0.8125rem, ink-2, `--radius-pill`, padding `.1rem .6rem`, `display: inline-block`. The border style carries the mode, never colour: `curated` is a solid 1px `--ink-3` border; `ai` is dashed; `match` is dotted. The text always names the mode (already in `essay.ts`).

**Section headings (notebook signature):** `.essay-section h2` has a hanging section number. Use a CSS counter on `.essay-host` and `h2::before { content: counter(sec) / ""; }`. The `/ ""` alt text keeps it out of the accessibility tree. It is set in display 400, ink-2, 1.5rem. From `min-width: 1100px` it hangs in the margin: absolutely positioned at `right: calc(100% + 1rem)`, with a 1px `--rule` 1.5rem rule after it. Below that width it is **not shown** (`display: none`), so small screens stay clean. The takeaway `h2` gets no number.

**Figure card** (Phase 2 styles the static shell; Phase 4 fills it):
- Wrap `.xfig-head` and `.xfig-stage` in one `<div class="xfig-card">` (a small `essay.ts` change; update its test). The card has a `--well` background, 1px `--rule` border, `--radius`, and padding `--space-4` (`--space-3` < 640).
- `.xfig-head`: a flex row with gap `.5rem` and baseline alignment. `.xfig-num` is the kicker style ("FIG. 1", CSS small caps on "Fig. 1"). `.xfig-title` is UI font 600, 0.9375rem, ink.
- `.xfig-stage`: in P2 it holds the static `alt` paragraph (text font 1rem, ink-2, `margin-top: --space-3`). Classes reserved for P4 with layout only: `.xfig-drawing` (`aspect-ratio: 16/9`, 4/3 < 640), `.xfig-controls` (flex wrap, gap `--space-4`), `.xfig-foot` (flex, `justify-content: space-between`: `.xfig-data-toggle` left, `.xfig-readout` right in mono, tabular-nums, ink).
- `figcaption`: outside the card, `margin: --space-3 0 0`, caption style (italic, ink-2). Its max-width is `--measure`, left-aligned with the card's left edge.

**Takeaway**: a `--rule` 1px top border with `--space-6` padding-top, then the "Read the original" standalone link.

### 5.5 Not-found (`/s/nope`, `/whatever`)

- Header + `main.page.not-found` in the `--shell` container + footer.
- Top: `not-found-mark.svg` inline at 64 × 64, `aria-hidden`. It is the mark with the curve flattened to a straight line: the knob is there, but there is nothing to read.
  ```svg
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="64" height="64" fill="none" aria-hidden="true"><path d="M4 22H28" stroke="#1D1B17" stroke-width="2.5" stroke-linecap="round"/><path d="M4 27H28" stroke="#1D1B17" stroke-width="2" stroke-linecap="round"/><circle cx="20" cy="27" r="3.5" fill="#FBF8F1" stroke="#C4451C" stroke-width="2.5"/></svg>
  ```
- `h1` (tabIndex −1, focus target): **"No explorable lives here"** (exact text).
- One line, text font, ink-2: "The link may be mistyped, or this explorable was never made. These ones work, offline too:"
- The same card grid as the gallery (reuse `SampleCard`; the grid heading is a visually hidden `h2` "Sample explorables" so the heading outline stays valid).
- `document.title` stays "Not found · explorable".
- No back link is needed (the cards and the header wordmark go home). Keep "All explorables" only on essay pages.

### 5.6 Loading, error, offline (Phase 10, recorded here so the identity is complete)

Loading skeleton bars are `--rule` on paper. The error panel is `--live-wash` with an ink icon and a `--live-ink` heading. The offline banner is a `--note-wash` strip with an icon and text. Full spec in `docs/design/states.md` (P10). Nothing to build in P2.

---

## 6. Motion and reduced motion

- Only these transitions exist in P2: card hover (`transform`, `border-color`) and link underline thickness, all `--dur-ui` / `--ease`. No entrance animations, no page transitions, no smooth scroll.
- Keep the Phase 1 global rule under `@media (prefers-reduced-motion: reduce)`: `transition: none !important; animation: none !important; scroll-behavior: auto !important` on `*, *::before, *::after`. Also no hover lift: `.card:hover { transform: none }` in that query, because an instant 2 px jump is still motion.
- Kit-side tokens for P4 (defined in `kit.css` now, unused until then): `--follow-tau: 90ms`, `--hint-delay: 1200ms`, `--hint-duration: 600ms`, `--hint-distance: 8px`.

## 7. Forced colours

Under `@media (forced-colors: active)`, the focus ring uses `outline-color: Highlight` and card borders use `CanvasText`. Thumbnails are images and stay legible. Nothing else changes, because every meaning already has a shape or text.

## 8. Focus and hit areas

- **Focus ring:** `:focus-visible { outline: 3px solid var(--series-1); outline-offset: 2px; }` on everything. Never `outline: none` without a replacement. Exceptions: the `h1[tabindex="-1"]` focus target (programmatic focus, no ring), and a card's inner link, where the ring moves to the card: `.card:has(a:focus-visible) { outline: 3px solid var(--series-1); outline-offset: 2px }` (use `:has(:focus-visible)`, not `:focus-within`, so a mouse click does not show it). Ring contrast: 6.54 on paper, 5.99 on well (≥ 3 ✓).
- **Hit areas ≥ 44 × 44 CSS px** for every standalone small link: header wordmark link, "All explorables", footer links, "Read the original", source chip links (if any). Technique: `display: inline-flex; align-items: center; min-height: 44px; min-width: 44px; padding-inline: .25rem`, with negative margin-inline (−.25rem) so text alignment doesn't shift. Links inside running prose (the essay source line citation and paragraph links) are exempt under WCAG 2.5.8's inline exception, but the source line gets `line-height: 2.75` on its link-bearing row < 640 px to keep neighbours apart.
- Cards: the whole card is the target (stretched link).

---

## 9. Acceptance criteria for the implementer (Phase 2)

These refine PLAN Phase 2 AC 1–7. The verifier checks them.

1. **Tokens.** `src/styles/tokens.css` defines every token in §1 with exactly those hex values (including `--series-1: #2851C0`). `git grep -i 2457c5 -- src skills` returns nothing. `palette.ts` exports the same values, and a test asserts that `tokens.css` and `palette.ts` agree (read the CSS file in the test).
2. **Palette as code.** `cvd.test.ts` covers §1.2 items 1–6, including the negative test, and pins cobalt↔teal tritan at 9.51 ± 0.02 and vermilion↔teal deutan at 10.58 ± 0.02.
3. **Fonts.** The five woff2 files plus `OFL.txt` (all four copyright lines) exist in `public/fonts/`. Each is within ±2 KB of the §2.1 sizes. Only `newsreader-latin.woff2` is preloaded. In the harness on `/s/diffusion`, after `document.fonts.ready`: `document.fonts.check('16px Newsreader')`, `document.fonts.check('600 16px Fraunces')`, and every `FontFace` with family `Explorable Greek` and `Explorable Math` have status `loaded`. Zero third-party requests.
4. **Glyphs.** A zoomed screenshot of the attention h1 and the diffusion dek (`glyphs-desktop.png`) shows √, ᾱ and ₀ in the bundled faces, not in a system serif. Mechanically, the symbol faces report `loaded` (AC 3). `fc-match` cannot see web fonts, so the screenshot is the visual proof.
5. **Wordmark and mark.** `src/assets/mark.svg` and `public/favicon.svg` are byte-identical to `docs/design/assets/` (or differ only by `currentColor`/`var()` substitutions in an inline React version). `index.html` links `/favicon.svg`. On `/`, the `h1` accessible name is "explorable", and the mark's SVG is `aria-hidden`. On other pages the header link's accessible name is "explorable, home". The track sits on the text baseline (screenshot check, `wordmark.png`).
6. **Gallery layout.** At 1280 × 800 there are 3 cards per row; at 800 × 800, 2; at 390 × 844, 1. `document.documentElement.scrollWidth <= innerWidth` at 390. Each card has an `img` with `alt=""` loading `/…thumbs/<slug>…svg`, an h3 link, the dek and the source chip.
7. **Thumbnails.** The three SVGs are copied from `docs/design/assets/thumbs/`. Each contains exactly one `<g class="knob">`, uses only §1 hex values (grep), and has no `<script>`, no `<image>` and no external references.
8. **Essay layout.** At 1280, the `.xfig-card` width is 896 px (56rem) and paragraph width is ≤ 608 px (38rem). At 390, figure cards have ≥ 16 px gutters and nothing overflows horizontally. Section numbers are visible at ≥ 1100 px, absent from the accessibility tree (axe/AX tree check: h2 names have no leading digit), and hidden below 1100.
9. **Focus.** A keyboard-only pass on `/` (Tab through header, cards, footer) shows a 3 px `rgb(40, 81, 192)` outline with a 2 px offset on each stop; for cards it is on the `<li>`. Mouse-clicking a card does not show the ring. Screenshot `focus-card.png`.
10. **Hit areas.** At 390 × 844, every `a` outside `p` running text in `header`, `nav`, `footer` and `.essay-original` has a bounding box ≥ 44 × 44.
11. **Reduced motion.** With `emulateMedia({ reducedMotion: 'reduce' })`, the computed `transition-duration` on `.card` and on links is `0s`, and hovering a card leaves `transform` as `none`.
12. **Not found.** `/s/nope` and `/whatever` show the flat-line mark, the h1 "No explorable lives here" (focused after in-app navigation), the explanation line, and three sample cards that work. Title is "Not found · explorable". Screenshot `not-found-desktop.png`.
13. **CVD screenshots** (`attention-protan.png`, `-deutan.png`, `-tritan.png`, and also `home-tritan.png`): the knob, the bars and the bit cells are still distinguishable by shape and label.
14. **Budget sanity** (enforced in P3, measured now): CSS ≤ 20 KB gzip; fonts as in §2.1.

## 10. Things the implementer must watch

1. **Two family names for the symbol faces** (§2.3), or √ silently falls back to a system font.
2. **CVD maths in linear RGB**, then OKLab. Gamma-space application gives different numbers and can flip the 9.51 / 10.58 margins.
3. **Rename the symbol subsets internally** (OFL Reserved Font Name and trademark hygiene), and commit `OFL.txt` with all four copyright lines.
4. **No `100vw`** for the figure breakout. Headless Chrome has classic scrollbars, and `100vw` causes horizontal scroll at 1280.
5. **`essay.ts` gains `.xfig-card`.** Update `essay.test.ts`, and keep the shell readable without CSS.
6. `--ink-3` and `--series-2` are **never text** (4.43 and 4.06 on paper, below 4.5).
7. Thumbnails are `<img>` (not inline), so they cannot read CSS variables. If a token hex ever changes, the SVGs must change too. AC 7's grep catches drift.
8. The vermilion ring is reserved: no other UI element (badges, bullets, hover states, error icons) may use a vermilion circle or ring.
9. Update `index.html` (favicon, preload) and drop the Phase 1 `--series-1: #2457c5` from `base.css` (tokens move to `tokens.css`).
10. Kill any preview server and browser after each check (shared machine).
