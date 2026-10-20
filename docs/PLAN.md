# PLAN: explorable

Written by the `planner` sub-agent on 2026-10-19. Binding inputs: `CLAUDE.md`, including the "North star" section. This file covers the product, the user, acceptance criteria, design direction, architecture, open decisions, the phase plan (one PR per phase), what is out of scope, and risks.

---

## 1. Product goal

`explorable` turns the core idea of a paper or blog post into a short scrolling essay with live figures, in the spirit of Bartosz Ciechanowski and Amelia Wattenberger. You paste an arXiv or blog URL, or pick a built-in sample. Each figure has a control you can drag, and its numbers are computed by a real, tested model of the idea, so it is never a screenshot or a canned animation. A Cloudflare Worker fetches and cleans the article. It then makes **one** Workers AI call that picks the single core idea and returns a figure plan as schema-validated JSON. The page is built only from a small library of tested, parameterised figure components (the **kit**); generated code is never run. Results are cached in KV by URL. The same kit ships as an agent skill, `/explorable`, so any coding agent can build an explorable for a concept with one command. The project is open source (MIT) and packaged to the standard of a project people star and recommend.

## 2. User first

**Who.** Curious technical readers: engineers, students, researchers and technical writers. They meet a paper or post whose central idea they half understand ("why does attention divide by √d?", "how can a Bloom filter be wrong only one way?"). The second user is a **coding agent** (Claude Code and similar), asked to "make an interactive explainer of X" for a blog, docs page or lesson.

**When they reach for it.** They have just finished an abstract and feel they could follow it if they could poke at it. Or they are writing a post and want one honest interactive figure without building a visualisation from scratch.

**Fastest path to the first "wow" (target: under 10 seconds, at no cost to the user):**
1. Open the site. There is nothing to install, no account and no key. The first view is the wordmark, one line saying what this is, a single input ("Paste an arXiv or blog link, or type a topic"), and a gallery of three sample explorables.
2. Click "Why attention divides by √d". It opens instantly from data bundled with the app, with no network request and no key, and it works offline.
3. The first figure sits in the first screenful. A vermilion knob invites a drag. Dragging the temperature makes the attention bars sharpen into a spike, and the readout ("top weight 0.97 · entropy 0.21 bits") changes on every frame. That is the wow: the idea responds to their hand.
4. Then they paste their own arXiv link. Within about 15 seconds they get the same kind of essay for that paper. If AI is not configured on a self-hosted copy, they get an honest, useful fallback instead of a dead end.

**Skill, one command to try** (exact text to put in the README in Phase 14):
```
npx degit geekplux/explorable/skills/explorable ~/.claude/skills/explorable && \
node ~/.claude/skills/explorable/scripts/build.mjs ~/.claude/skills/explorable/examples/bloom-filter/explorable.json
```
This writes a standalone `index.html` next to the spec that opens from `file://` and works offline. In Claude Code, `/explorable explain how a Bloom filter trades memory for false positives` then uses the same kit.

**Value, then convenience.** Every feature below has to answer "what does the user get and how much time does it save?" Features that fail that test are cut (see section 9).

## 3. Product acceptance criteria

All criteria are testable. "Harness" means the repo's Playwright scripts (`pnpm smoke`, `pnpm e2e <flow>`) running the system Chrome headless.

### Functional
1. **F1.** `/` renders the wordmark, a one-line pitch, exactly one text input (`<input type="url|text">` with a visible label) with a submit button, and at least 3 sample cards. Each card has a title, the one-sentence core idea, a source citation and a thumbnail. There are no other inputs.
2. **F2.** Activating a sample card (click or Enter) navigates to `/s/<slug>` and renders the essay with no network request other than same-origin static assets. The essay has a title, a dek (the one-sentence core idea), a source citation with a link, 3 to 6 sections, at least 2 live figures, and a closing takeaway.
3. **F3.** Every figure has at least one control (a drag handle on the figure and/or a labelled slider) and at least one live readout. Changing the control changes the readout and the drawing on the same frame. Every number shown comes from a registry model whose unit tests compare it against hand-computed reference values.
4. **F4.** Submitting an arXiv URL (`/abs/`, `/pdf/`, `/html/`, with or without a version) or a blog URL navigates to `/x?url=<encoded>`. That page shows an explorable or a specific, actionable error state within 30 s. A repeat request for the same canonical URL is served from KV (`"cache": "hit"`) with no AI call.
5. **F5.** An uncached URL costs **at most one** Workers AI call. A cached URL costs zero, and so does the no-AI ("match") mode. Unit tests count calls to `env.AI.run`.
6. **F6.** Model output is never run as code. Figures come only from registry models, or from the whitelisted expression language (`expr-curve`), which is parsed and checked by our own evaluator. An invalid or partial plan degrades: invalid figures are dropped, and if no valid figure remains the user sees an error state, never a crash or a blank page.
7. **F7.** Text in the input that is not a URL runs a local, offline search over samples and registry models. It never calls the network or the LLM.
8. **F8.** Running `node skills/explorable/scripts/build.mjs <spec.json>` under Node 20.10 or later with no install writes a standalone HTML page that works from `file://` offline. `node skills/explorable/scripts/audit.mjs <spec.json|page.html>` ends with `audit passed`. `node --test skills/explorable/scripts/*.test.mjs` passes. `evals/evals.json` has at least 5 evals.

### Accessibility
9. **A1.** Every control can be reached with Tab in a logical order and has a visible focus ring with at least 3:1 contrast. Arrow keys, PageUp/PageDown, Home and End change values. Drag handles are `role="slider"` with `aria-valuemin/max/now` and an `aria-valuetext` that includes units.
10. **A2.** Readouts sit in a polite live region throttled to at most one announcement per 500 ms. A drag never floods the screen reader.
11. **A3.** Every figure has a static text alternative (`alt` in the spec), a live one-sentence description of the current state, and a "Show data" toggle that reveals a real `<table>` of the current values.
12. **A4.** An axe-core run in the harness reports 0 serious or critical violations on `/`, every `/s/<slug>`, and each `/x` state (loading, error, result).
13. **A5.** Unit tests enforce the palette. Every categorical pair has ΔE (OKLab × 100) ≥ 8 under protanopia, deuteranopia and tritanopia simulation (Machado 2009, severity 1.0) and ≥ 15 for normal vision. Body text contrast is ≥ 4.5:1 and graphics are ≥ 3:1 on both surfaces. Every hue-coded encoding is doubled by line style, marker shape, pattern or a direct label.
14. **A6.** Under `prefers-reduced-motion: reduce` there are no animated transitions, no hint nudges and no idle motion, and value changes apply instantly. The harness checks this with `emulateMedia({ reducedMotion: 'reduce' })`.
15. **A7.** At 390×844 there is no horizontal scroll, and every handle and control has a hit area of at least 44×44 CSS px.
16. **A8.** At 200% zoom (1280 wide), text does not overlap and no content is clipped.

### Performance and footprint
17. **P1.** `pnpm check:size` passes on `dist/`. The initial JS for `/` is ≤ 110 KB gzip, total CSS ≤ 20 KB gzip, and preloaded fonts ≤ 70 KB.
18. **P2.** On the local preview with 4× CPU throttling (CDP `Emulation.setCPUThrottlingRate`), LCP on `/` and on `/s/attention` is ≤ 1500 ms, as measured by the harness.
19. **P3.** One `compute()` of each registry model at its maximum parameters takes ≤ 8 ms in a Vitest timing test (median of 20 runs).
20. **P4.** Runtime dependencies are limited to `react`, `react-dom`, `valibot` and `htmlparser2` (the Worker only). There is no UI, chart or router library. Runtime deps total ≤ 5.

### Offline and no key
21. **O1.** When the harness blocks every request outside the preview origin, `/` and every sample render with zero failed requests and zero third-party requests. Fonts are self-hosted.
22. **O2.** After the first load, with the browser context offline, reloading `/` and `/s/<slug>` works through the service worker. The input then shows "You're offline. The samples below still work."
23. **O3.** `pnpm dev`, `pnpm test`, `pnpm build`, `pnpm smoke` and `pnpm e2e` need no API key and no Cloudflare login. Without an AI binding, `/x` returns either a match-mode explorable or a clear `AI_UNAVAILABLE` state.

### Safety and hygiene
24. **S1.** No secrets are in git. Only `.dev.vars.example` is committed.
25. **S2.** The Worker fetches only `http(s)` on default ports. It refuses `localhost`, private and link-local IP literals and `*.local` hosts, follows at most 3 redirects (re-checking each), caps the body at 3 MB, and times out after 10 s.
26. **S3.** All document text is HTML-escaped when rendered, and inline markup comes only from our own formatter. The deployed CSP has no `unsafe-eval` and no third-party origins.
27. **S4.** There are no finance topics, data or features, and Sean's employer is never mentioned. The verifier greps for both on every phase.

### Open-source packaging
28. **OS1.** The repo has: a README that sells in 10 seconds (pitch, hero image, demo-link placeholder, quick start, how it works, roadmap), LICENSE (MIT), CONTRIBUTING.md, CODE_OF_CONDUCT.md, SECURITY.md, issue and PR templates under `.github/` (not `workflows/`), CHANGELOG.md, `docs/EXTENDING.md`, `docs/GOOD_FIRST_ISSUES.md`, a social preview image, an `examples/` gallery, `docs/LAUNCH.md`, and CI at `ci/github-workflow.yml`.

---

## 4. Design direction: "Field notebook, live ink"

The idea: a careful lab notebook on warm paper, written in near-black ink. **Exactly one colour means "you can touch this"**: vermilion, always carried by the same shape, a hollow ring knob. Data uses calm cobalt and teal. The overall feel is quiet, precise and tactile, not a dashboard and not a template. It must not copy any of Sean's other sites.

### 4.1 Colour (light theme, v1)
| Token | Hex | Use | Contrast |
|---|---|---|---|
| `--paper` | `#FBF8F1` | page background | – |
| `--well` | `#F3EEE2` | figure card surface | – |
| `--rule` | `#D8D0BF` | hairlines, grid (decorative only, never meaning) | – |
| `--ink` | `#1D1B17` | body text, axes | 16.2:1 on paper, 14.9:1 on well |
| `--ink-2` | `#5A554B` | secondary text, captions, labels on wells | 7.0:1 on paper, 6.4:1 on well |
| `--ink-3` | `#7A7365` | minor ticks, non-text graphics only | 4.4:1 on paper, 4.1:1 on well |
| `--live` | `#C4451C` | **draggable things**: knobs, slider thumbs, the controlled item (series 3) | 4.7:1 on paper, 4.3:1 on well (graphics) |
| `--live-ink` | `#A93A12` | vermilion text (error headings, active labels) | 6.0:1 on paper, 5.2:1 on `--live-wash` |
| `--live-wash` | `#FBE3D8` | error panel and selected-row tint (always with icon or text) | ink on it: 14.0:1 |
| `--series-1` | `#2457C5` | cobalt: primary data series, links, **focus ring** | 6.1:1 on paper |
| `--series-2` | `#0F8A6E` | teal: secondary series (graphics only, never body text) | 4.1:1 on paper, 3.7:1 on well |
| `--note-wash` | `#F6E7B8` | ochre highlight behind "current value" chips (decorative) | ink on it: 14.0:1 |

**Validated** with the dataviz palette validator (`--pairs all`) on both `--paper` and `--well`, using `#2457C5, #C4451C, #0F8A6E`. Lightness band, chroma floor, CVD separation (worst: teal↔vermilion ΔE 10.6 deutan, tritan 8.0), normal-vision floor (worst 22.5) and contrast ≥ 3:1 all pass. A fourth hue (purple, ochre, pink) failed CVD separation or contrast in every variant tried. **Rule:** a figure uses at most 3 hue-coded series; anything beyond that uses ink with line style or pattern. Phase 2 puts this check into the kit as a unit test (`kit/src/color/cvd.ts`), so a palette change cannot regress silently.

**Never colour alone** (each figure kind must follow this):
- series-1 is a solid 2 px line with circle markers; series-2 is a dashed (6 3) line with square markers; the live or controlled item is a hollow ring knob, 2.5 px vermilion stroke on paper fill, with a 3-line grip.
- uncertain or "false positive" states use a 45° hatch pattern plus a text label ("maybe"); reference or theoretical curves are dotted ink with a direct label.
- every series is labelled directly at its end; a legend appears only when there are 2 or more series, and it shows the marker shape too.

Dark theme is on the roadmap. It would need its own validated steps, not an automatic inversion.

### 4.2 Typography
All fonts are self-hosted from `public/fonts/` (Latin subset woff2, SIL OFL, with `OFL.txt` committed). There is no runtime font CDN.
- **Display (wordmark, h1, h2):** Fraunces, variable `wght` 400–700 (about 37 KB). Weight 600 for h1/h2; the wordmark is 650 with letter-spacing -0.01em.
- **Text (essay body):** Newsreader, variable `wght` 400–700 (about 58 KB; preloaded). Newsreader Italic (about 65 KB) is not preloaded and loads only when italic text is used.
- **UI and figure labels:** `ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`, 0.8125rem; small-caps kicker labels use `font-variant-caps: all-small-caps; letter-spacing: .06em`.
- **Readouts:** `ui-monospace, "SF Mono", Menlo, Consolas, monospace` with `font-variant-numeric: tabular-nums`, so digits do not jitter while dragging.
- **Scale (ratio about 1.25):** body 1.1875rem/1.6 on desktop and 1.0625rem on mobile; h2 1.5rem; h1 `clamp(2rem, 5vw, 2.75rem)`/1.1; captions 0.9375rem italic in `--ink-2`.
- Fallbacks are `Georgia, "Times New Roman", serif` with `font-display: swap`. Fonts must not block first paint.

### 4.3 Layout
- **Essay column:** `width: min(38rem, 100% - 2.5rem)`, centred, about 68ch.
- **Figures break out:** `width: min(56rem, 100% - 2rem)`. A figure card has a `--well` background, a 1 px `--rule` border and a 10 px radius.
  - Its header row reads "FIG. 2" in small caps on the left, with the title beside it.
  - The SVG drawing follows at a 16:9 aspect on desktop and 4:3 on mobile.
  - The controls row comes next: labelled sliders with their value outputs.
  - The readout strip sits bottom right in monospace, and "Show data" sits bottom left.
  - The caption goes below the card.
- **Gallery (`/`):** a header with the wordmark, then the pitch line, then the input. After that comes "Or start with one of these" and a card grid (3-up at ≥ 960 px, 2-up at ≥ 640 px, 1-up below). Each card holds a thumbnail (a still of its first figure), title, dek and a source chip such as "arXiv 1706.03762".
- **Essay page:** a back link ("← All explorables"), kicker (source kind), h1, dek, a source line ("Based on *Attention Is All You Need*, Vaswani et al., 2017 ↗") and a provenance badge ("Curated", "Generated with AI from the source: check the original", or "Matched to a built-in explainer"). Sections and the takeaway follow, then "Read the original ↗".
- **Footer:** "Made with explorable · MIT · Source on GitHub", plus an accessibility statement link to the README section.

### 4.4 Motion
- UI transitions are ≤ 200 ms with `cubic-bezier(.2,.7,.2,1)`, on opacity and transform only.
- **Direct manipulation is 1:1**: while dragging, the figure follows the pointer exactly, with no easing.
- Keyboard steps and slider jumps ease with an exponential follow (time constant 90 ms). A figure computes only while it is on screen (IntersectionObserver).
- Hint: once, 1.2 s after a figure first enters view, its knob nudges 8 px and back (600 ms). This never repeats, never runs after the first interaction, and never runs under reduced motion.
- There is no parallax, scroll-jacking, looping idle animation, flashing or decorative 3D.
- Under `prefers-reduced-motion: reduce`, all of the above become instant state changes, and the hint becomes a static dashed ring with the text "drag".

### 4.5 Logo and wordmark
**Mark** (`src/assets/mark.svg`, also the favicon, on a 32×32 grid): an ink bell curve (`M4 22 C10 22 12 8 16 8 S22 22 28 22`, 2.5 px stroke, round caps) above a slider track (`M4 27 H28`, 2 px ink, round caps). A hollow vermilion ring knob (`cx=19 cy=27 r=3.5`, paper fill, 2.5 px `#C4451C` stroke) sits on the track, and a dotted ink drop line goes from the knob up to the curve. The message is "drag the knob, the model answers." The shape still reads in monochrome.
**Wordmark:** the mark followed by lowercase "explorable" in Fraunces 650, with optical alignment so the knob's centre lines up with the x-height.
The component is `src/components/Wordmark.tsx` with a size prop and a `title` for screen readers.

### 4.6 States (all polished, all accessible)
- **Empty (no input yet):** placeholder text "https://arxiv.org/abs/1706.03762", plus three "Try" chips with real, non-finance links that fill the input.
- **Loading (`/x`):** a skeleton essay column (rule-coloured bars) with `aria-busy="true"`. A live region announces honest stages driven by elapsed time and server events, with no fake percentages: "Fetching the article…", "Finding the core idea…" after 1.5 s, "Assembling live figures…" after 6 s. A "Cancel" button aborts the request.
- **Error:** a `--live-wash` panel with an icon and a heading in `--live-ink`. The panel says in one plain sentence what happened, then what to do, then offers "Open a sample instead" (3 mini cards). Each error code has its own copy (see 5.6).
- **Offline:** a banner above the input; the samples stay fully usable.
- **Not found:** "No explorable lives here" plus the gallery.

### 4.7 Voice
Calm, precise and curious. Write in the second person and in the present tense ("Drag the temperature down. Watch one token win."). No hype words. Numbers always come with units.

---

## 5. Architecture

### 5.1 Repository layout (target)
```
package.json  pnpm-lock.yaml  .npmrc (use-node-version=22.23.3)  .nvmrc  .oxlintrc.json
tsconfig.json (references) tsconfig.app.json tsconfig.node.json tsconfig.worker.json
vite.config.ts  vite.kit.config.ts (P11)  wrangler.jsonc (P8)  index.html  .dev.vars.example (P8)
src/                         React shell (thin)
  main.tsx App.tsx router.ts (in-house history router)
  pages/ GalleryPage.tsx SamplePage.tsx ResultPage.tsx NotFoundPage.tsx
  components/ Wordmark.tsx Header.tsx Footer.tsx SampleCard.tsx UrlField.tsx EssayView.tsx states/*
  samples/ index.ts attention.json bloom-filter.json diffusion.json thumbs/*.svg
  styles/ tokens.css base.css app.css
public/ fonts/*.woff2 fonts/OFL.txt favicon.svg  _headers (P15)
worker/                      Cloudflare Worker (P8–P9, P15)
  index.ts url.ts fetch.ts cache.ts  extract/{arxiv,blog,text}.ts  plan/{prompt,schema,ai,match,assemble}.ts
  fixtures/ (HTML/Atom/AI-response fixtures, excluded from line counts)
skills/explorable/           the agent skill; kit/src is the single source of truth for the kit
  SKILL.md  kit/src/…  kit/react/Explorable.tsx  kit/dist/explorable-kit.{js,css} (generated, committed)
  references/*.md  examples/<name>/{explorable.json,index.html}  scripts/*.mjs  evals/evals.json
scripts/                     repo tooling (Node, run via pnpm)
  lib/harness.mjs smoke.mjs e2e.mjs flows/*.mjs check-size.mjs gen-sw.mjs social-image.mjs build-examples.mjs
examples/                    root gallery of standalone builds (P14)
ci/github-workflow.yml       CI definition (never under .github/workflows/)
docs/ PLAN.md STATUS.md DECISIONS.md figures/*.md design/*.md screenshots/phase-<n>/ EXTENDING.md GOOD_FIRST_ISSUES.md LAUNCH.md DEPLOY.md assets/
```

### 5.2 The kit (`skills/explorable/kit/src`, framework-free TypeScript)
- `doc/schema.ts`: valibot schema for **ExplorableDoc v1** (below). Exports `parseDoc(unknown): Result`, the `ExplorableDoc` type, and `planJsonSchema()` (via `@valibot/to-json-schema`) for Workers AI.
- `doc/inline.ts`: escaping plus a tiny inline formatter (`*em*`, `**strong**`, `` `code` ``). Everything else is escaped text.
- `doc/essay.ts`: `essayHtml(doc): string` produces static, escaped HTML: hero, sections, and figure shells with title, caption, `alt` and a `<noscript>`-friendly text alternative. `hydrateFigures(root, doc, opts) → { destroy }` mounts live figures into the shells. The React app and the standalone skill page use the same two functions, so the output matches in both places.
- `registry.ts` + `models/*.ts`: a `ModelDef` for each model:
  ```ts
  interface ModelDef<P extends Record<string, number>, O extends Record<string, number | number[]>> {
    id: string; title: string; kinds: FigureKind[]; keywords: string[];          // keywords drive offline search + match mode
    params: { [K in keyof P]: { label: string; min: number; max: number; step: number; default: number; unit?: string; scale?: 'linear' | 'log' } };
    outputs: Record<string, { label: string; unit?: string; format: 'int' | 'fixed1' | 'fixed2' | 'fixed3' | 'percent' | 'sci' }>;
    compute(p: P): O;                       // pure + deterministic (seeded RNG only)
    describe(p: P, o: O): string;           // one-sentence live text alternative
    template?: string;                      // slug of the curated sample used in match mode
  }
  ```
  v1 models: `softmax-temperature`, `attention-scaling`, `bloom-filter`, `diffusion-forward`, `expr-curve`.
- `figures/*.ts`: figure kinds, each `mount(el, spec, ctx) → { update(params), destroy() }`. There are four in v1: `bars` (a distribution over labelled categories), `bits` (a bit array with hashed probes), `histogram` (samples over one axis with a reference curve), and `curve` (y = f(x) with a draggable point and markers).
- `runtime/*.ts`: `controls.ts` (labelled native `<input type=range>` with `<output>`), `handle.ts` (SVG drag handle: pointer capture plus keyboard `role=slider`), `motion.ts` (reduced-motion detection, exponential follow, one-time hint), `announce.ts` (throttled live region), `table.ts` (the "Show data" table), `mount.ts` (dispatch by kind, IntersectionObserver gating).
- `expr/*.ts`: the safe expression language for `expr-curve`:
  - Allowed: numbers, declared identifiers, `x`, `pi`, `e`, the operators `+ - * / ^`, unary `-` and parentheses, and the functions `exp log ln sqrt abs sin cos tan min max pow floor ceil`.
  - Limits: at most 200 characters and AST depth ≤ 32. There are no strings, member access or assignment.
  - It compiles to a closure. Validation checks that the expression parses, that every identifier is declared, and that at least 90% of 64 samples over the x range are finite.
- `color/palette.ts` + `color/cvd.ts`: tokens as TS constants, the Machado 2009 simulation, OKLab ΔE, and WCAG contrast. Tests enforce A5.
- `rng.ts` (mulberry32 with a fixed seed, so screenshots are deterministic) and `format.ts` (readout formats).
- `styles/kit.css`: essay and figure styles, which use the tokens from 4.1.
- `kit/react/Explorable.tsx`: a thin React wrapper (`dangerouslySetInnerHTML={{__html: essayHtml(doc)}}` plus `hydrateFigures` in an effect). The app uses it, and so can skill users who work in React.

**ExplorableDoc v1** (the central contract for samples, the Worker output and skill specs):
```ts
type ExplorableDoc = {
  schema: 1; id: string; title: string /* ≤90 */; dek: string /* ≤220, the one core idea */;
  source: { kind: 'arxiv' | 'blog' | 'concept'; url?: string; title: string; authors?: string[]; year?: number };
  provenance: { mode: 'curated' | 'ai' | 'match'; model?: string; generatedAt: string /* ISO */ };
  sections: { id: string; heading: string; paragraphs: string[] /* 1–4, each ≤700 */; figure?: FigureSpec }[];  // 2–6
  takeaway: string /* ≤300 */;
};
type FigureSpec = {
  id: string; kind: 'bars' | 'bits' | 'histogram' | 'curve'; title: string; caption: string; alt: string /* ≥40 chars */;
  model: { id: string; params: Record<string, number> }
       | { id: 'expr-curve'; expr: string; x: { name: 'x'; label: string; min: number; max: number; scale?: 'linear' | 'log' };
           y: { label: string; min?: number; max?: number }; params: { name: string; label: string; min: number; max: number; default: number }[] };
  controls: string[] /* 1–3 param names */; readouts: string[] /* 1–3 output ids */;
  options?: Record<string, string | number | boolean | string[]>  /* kind-specific, e.g. bar labels, query word */;
};
```

### 5.3 Data flow
```
Sample:  click card ──► /s/<slug> ──► samples/<slug>.json (bundled) ──► essayHtml + hydrateFigures ──► live figures
URL:     input ──► /x?url=… ──► GET /api/explain?url=…  (Worker)
           1 normalise + guard URL (arXiv → canonical id)        url.ts
           2 KV get  doc:v1:<PROMPT_VERSION>:<sha256(canonical)> cache.ts ── hit ─► return {doc, cache:"hit"}
           3 fetch + extract  (arXiv Atom API + arxiv.org/html; blogs → readability-lite)   fetch.ts extract/*
           4 deterministic match over registry keywords            plan/match.ts
           5 if env.AI present: ONE env.AI.run(AI_MODEL, JSON Mode, schema=planJsonSchema())  plan/ai.ts
             else if match ≥ threshold: curated template doc with source swapped (mode "match")
             else: error AI_UNAVAILABLE (with the extracted title + abstract excerpt)
           6 assemble: Plan → ExplorableDoc (clamp params, validate expr, drop bad figures, parseDoc)  plan/assemble.ts
           7 KV put (TTL 30 d); failures cached as err:v1:… (TTL 10 min)  ──► {ok, doc, cache, mode}
Text:    input (not a URL) ──► local search over samples + registry keywords (no network)
Skill:   agent writes explorable.json ──► scripts/build.mjs ──► standalone HTML (kit/dist inlined) ──► scripts/audit.mjs ──► "audit passed"
```

### 5.4 Cloudflare pieces
- **One Worker with Static Assets.** It serves the built SPA with `not_found_handling: "single-page-application"` and `run_worker_first: ["/api/*"]`. It is built with `@cloudflare/vite-plugin`, so `vite dev` and `vite preview` run the real Worker in workerd.
- **Bindings:** assets `ASSETS`; KV `EXPLORABLE_CACHE`; Workers AI `AI` (production env only); rate limiting `EXPLAIN_LIMITER` (production only, 10 uncached explains per minute per IP, P15).
- **Vars:**
  - `AI_MODEL` defaults to `@cf/meta/llama-3.3-70b-instruct-fp8-fast`.
  - `PROMPT_VERSION` is a string that goes into the cache key.
  - `EXPLORABLE_DEBUG` is `"1"` only in local dev and enables `/api/extract`.
- **Environments:**
  - The top-level config is **local-safe**: no `ai` binding, and a local KV id that Miniflare simulates.
  - `env.production` adds `ai`, the real KV id (placeholder until Sean creates it), the rate limiter and the vars.
  - A production build is `CLOUDFLARE_ENV=production vite build`. Dev, preview, tests and the harness never touch AI and never need a login.
- No D1 or R2 is needed in v1.

### 5.5 Where AI is used (and only there)
Exactly one place: `worker/plan/ai.ts`, with one `env.AI.run` per uncached URL.
- **Input:** a system prompt with the kit catalogue (model ids, params, outputs, figure kinds, `expr-curve` rules), match candidates as hints, and ≤ 12,000 characters of extracted text.
- **Output:** **Plan** JSON (core idea, title, dek, 3–5 sections of prose, 2–3 figure choices with params as `{name, value}` pairs). It runs with `temperature: 0.2`, `max_tokens: 1800` and `response_format: { type: "json_schema", json_schema }`.
- **Not AI:** URL handling, extraction, model maths, figure rendering, validation, search, match mode and caching are all deterministic.
- "JSON Mode couldn't be met", invalid JSON or schema failure lead to `PLAN_INVALID`. That result is cached for 10 minutes, and there are **no retries**.
- Prose generated by AI is labelled as such on the page, next to the source link.

### 5.6 API contract
`GET /api/explain?url=<encoded>` returns `200 { ok: true, doc, cache: "hit" | "miss", mode: "ai" | "match" }` or `4xx/5xx { ok: false, error: { code, message, hint } }`.

| Code | When it happens |
|---|---|
| `INVALID_URL` | the input is not a usable URL |
| `BLOCKED_URL` | the URL fails the safety guard |
| `FETCH_FAILED` | the fetch errored or timed out |
| `UNSUPPORTED_CONTENT` | e.g. a PDF that is not on arXiv, or a non-HTML page |
| `TOO_LITTLE_TEXT` | fewer than 600 characters were extracted |
| `AI_UNAVAILABLE` | no AI binding and no match |
| `PLAN_INVALID` | the AI plan failed validation |
| `NO_FIGURE` | no valid figure remained after assembly |
| `RATE_LIMITED` | the per-IP limit was hit |
| `INTERNAL` | anything else |

`GET /api/health` returns `{ ok, ai: boolean, kv: boolean }`.

### 5.7 Caching
- **KV:** final docs for 30 days. The key includes `PROMPT_VERSION` and the schema version, so a prompt change invalidates old docs. Errors are cached for 10 minutes. The response carries an `x-explorable-cache` header.
- **Static assets:** `/assets/*` is immutable for one year (P15 `_headers`), and `index.html` is `no-cache`.
- **Service worker (P15):** it precaches the app shell, fonts and every asset, so samples work offline on reload. It never caches `/api/*`.

### 5.8 Local development without Workers AI
- **Default:** no AI binding, so the Worker uses match mode. For example, pasting `https://arxiv.org/abs/1706.03762` matches `attention-scaling` and returns the curated template with the real arXiv title and authors. An unmatched URL returns `AI_UNAVAILABLE`.
- **Unit tests:** the AI path is tested with a fake `env.AI.run` that returns recorded fixtures (`worker/fixtures/ai/*.json`: valid, invalid JSON, schema violation, out-of-range params, malicious expression, prose containing `<script>`).
- **UI e2e:** the harness mocks `/api/explain` with `page.route`, so it is deterministic and needs no network. One optional live flow (`url-live`) goes through the local Worker to real arXiv, uses match mode, and is skipped when there is no network.

### 5.9 Tooling
- **Package manager and Node:** pnpm 9. `.npmrc` sets `use-node-version=22.23.3`, so pnpm downloads Node 22 for all scripts (the machine has Node 20.19.2; Vitest 5 and wrangler 4.151 need Node 22 or later).
- **Build and test:** Vite 8 (Rolldown) with `@vitejs/plugin-react` 6, React 19.3, TypeScript 7 (`tsc --noEmit`), Vitest 5 (`--pool=forks --maxWorkers=2`, happy-dom for DOM tests), oxlint, and `playwright-core` driving `/usr/bin/google-chrome`. There are no browser downloads.
- **Scripts:**

  | Script | Command |
  |---|---|
  | `lint` | `oxlint` |
  | `typecheck` | `tsc --noEmit -p tsconfig.app.json && tsc --noEmit -p tsconfig.node.json` (`&& … -p tsconfig.worker.json` from P8) |
  | `test` | `vitest run` |
  | `build` | `vite build` |
  | `preview` | `vite preview` |
  | `smoke` | `node scripts/smoke.mjs` |
  | `e2e` | `node scripts/e2e.mjs` |
  | `check:size` | `node scripts/check-size.mjs` |
  | `check` | `pnpm lint && pnpm typecheck && pnpm test` |
  | `build:kit` | P11 |
  | `build:examples` | P14 |
  | `build:prod` | `CLOUDFLARE_ENV=production vite build` (P15) |
  | `check:deploy` | `wrangler deploy --dry-run --outdir .wrangler/dry-run` (P15) |

- **Harness contract** (`scripts/lib/harness.mjs`):
  - `withPreview(fn, { build = true, port = 4173 })`: builds, spawns `vite preview --port 4173 --strictPort` detached (records the PID), and waits for HTTP 200 (30 s timeout).
  - `withBrowser(fn)`: one Chrome, headless, `executablePath: '/usr/bin/google-chrome'`.
  - It records console errors, page errors, failed and third-party requests.
  - `shot(page, name)` writes `<out>/<name>.png`.
  - In `finally` and on SIGINT/SIGTERM it closes the browser and kills the preview **process group** (`process.kill(-pid)`). It prints `cleaned up: preview <pid>, browser` and exits non-zero on any recorded error.
  - `smoke.mjs --out <dir> [--routes / /s/attention …]` screenshots each route at 1280×800 and 390×844 and ends with `smoke passed`.
  - `e2e.mjs <flow…> --out <dir>` runs `scripts/flows/<flow>.mjs` (default export `async ({ page, baseURL, shot, assert, cvd, axe }) => {}`) inside one preview and one browser.

### 5.10 Samples (non-finance, real sources, real models)
1. **`attention`: "Why attention divides by √d."**
   - Source: Vaswani et al. 2017, *Attention Is All You Need*, arXiv:1706.03762.
   - Fig 1 (`bars`, `softmax-temperature`): six tokens of the sentence "the cat sat on the mat", with fixed logits. Drag the temperature (0.05–5). Readouts: top weight, entropy in bits.
   - Fig 2 (`bars`, `attention-scaling`): seeded q and k ~ N(0,1) for 8 keys. Drag d_k (1–512, log scale), with a "divide by √d_k" toggle. Readouts: logit standard deviation (≈√d_k when unscaled, ≈1 when scaled), top weight, entropy. You see the unscaled softmax saturate into a one-hot.
2. **`bloom-filter`: "How a Bloom filter says 'maybe'."**
   - Source: Bill Mill, *Bloom Filters by Example* (https://llimllib.github.io/bloomfilter-tutorial/).
   - Fig 1 (`bits`, `bloom-filter`): m = 32 bits, deterministic FNV-1a double hashing, insert n of 12 animal words. Drag k (1–6) and n. Query a word from a list of fruits and animals. A false positive is hatched and labelled "maybe (false positive)". Readouts: bits set, predicted FPR (1 − e^(−kn/m))^k, observed false positives over 50 probe words.
   - Fig 2 (`curve`, `expr-curve`, P7): FPR against n for the chosen m and k, with a marker at the optimal k = (m/n) ln 2.
3. **`diffusion`: "Noise, one step at a time."**
   - Source: Ho, Jain, Abbeel 2020, *Denoising Diffusion Probabilistic Models*, arXiv:2006.11239.
   - Fig 1 (`histogram`, `diffusion-forward`): 2,000 seeded samples from a two-mode 1-D data distribution (modes at −2 and +1.5, σ 0.25). Scrub t over 0–1000 with a linear β schedule (1e-4 to 0.02). x_t = √ᾱ_t·x₀ + √(1−ᾱ_t)·ε, with an N(0,1) reference curve (dotted). Readouts: t, ᾱ_t, signal √ᾱ_t, noise √(1−ᾱ_t), SNR.
   - Fig 2 (`curve`, P7): √ᾱ_t and √(1−ᾱ_t) against t, cobalt solid and teal dashed, with the current t marked.
- Samples are hand-curated with `explorable-designer` (`provenance.mode: "curated"`) in the same schema the pipeline outputs. They also serve as match-mode templates.
- Skill examples (P11) cover concepts beyond the samples: `bloom-filter` (registry model) and `newton-cooling` (`expr-curve`: T(t) = T_a + (T₀ − T_a)·e^(−kt)).

---

## 6. Open technical decisions (with recommendation)

The main agent should record these in `docs/DECISIONS.md`.

| # | Decision | Recommendation | Alternatives | Why |
|---|---|---|---|---|
| D1 | Node version | `.npmrc` `use-node-version=22.23.3` (pnpm-managed Node 22); `engines.node >=22.12`; `.nvmrc` 22 | pin Vitest 4.1 and wrangler ≤ 4.85 on Node 20; install Node 22 system-wide | The machine has Node 20.19.2, while Vitest 5 needs ^22.12 and wrangler ≥ 4.90 needs ≥ 22. pnpm-managed Node needs no system change. Skill scripts stay compatible with Node 20.10 or later. |
| D2 | Hosting shape | One Worker with Static Assets, `/api/*` run worker first, built with `@cloudflare/vite-plugin` | Pages + Functions; separate `wrangler dev` alongside Vite | One deployable and one dev server, and preview runs the real Worker. Cloudflare's current recommendation for new projects. |
| D3 | AI model | `@cf/meta/llama-3.3-70b-instruct-fp8-fast` with JSON Mode, set via the `AI_MODEL` var | `@cf/meta/llama-3.1-8b-instruct` (cheaper, weaker at structure); `@cf/deepseek-ai/deepseek-r1-distill-qwen-32b` (reasoning tokens, slower) | It is on the JSON-Mode list and the strongest instruction-follower there. One call per URL plus a KV cache keeps cost low. |
| D4 | Binding names | `ASSETS`, `EXPLORABLE_CACHE` (KV), `AI`, `EXPLAIN_LIMITER`; `AI` exists only in `env.production` | AI declared at top level | Local dev, tests and the harness never need a login. A missing AI binding is the tested degraded path. |
| D5 | Where the kit lives | Source of truth in `skills/explorable/kit/src` (TS); the app imports it through the `@kit` alias; prebuilt `kit/dist` is committed, and CI checks it is fresh | `packages/kit` workspace copied into the skill | The skill folder stays self-contained and works with no install, and there is no sync step or drift. |
| D6 | Essay rendering | The kit renders an escaped HTML string (`essayHtml`) and hydrates figures (`hydrateFigures`); React is the shell | React-only essay plus a separate standalone renderer | One implementation for the app and the skill. Content is readable without JS. Smaller React surface. |
| D7 | Validation | valibot + `@valibot/to-json-schema` | zod (larger); hand-written validator plus JSON Schema | Small, tree-shakable and typed; one schema produces both the validator and the Workers AI `json_schema`. |
| D8 | Extraction | arXiv Atom API (`export.arxiv.org/api/query?id_list=`) + `arxiv.org/html/<id>`; blogs: a `htmlparser2` streaming "readability-lite" (keeps article/main/p/h1–h3/li, drops nav/aside/footer/script/style, scores blocks by text and link density) | `@mozilla/readability` + `linkedom` (heavier); `HTMLRewriter` (tests need workerd, which is RAM-heavy) | Small, testable in plain Vitest with fixtures, and runs in Workers. |
| D9 | Generic figures | The whitelisted `expr-curve` expression language | registry only (too little coverage); LLM-written code (forbidden) | Covers many closed-form ideas with no code execution. |
| D10 | Without AI | A deterministic keyword matcher returns the curated template (`mode: "match"`), otherwise `AI_UNAVAILABLE` | always error | Deterministic code first, so self-hosters without AI still get value. |
| D11 | Non-URL input | Local search over samples and the registry; no LLM | free-text generation through AI | Offline and free, with no abuse surface. |
| D12 | Samples | Hand-curated with `explorable-designer` and committed as JSON | generated by AI at build time | No key needed. They set the quality bar and double as match templates. |
| D13 | Fonts | Self-hosted Fraunces (display) and Newsreader (text) woff2, Latin subset, OFL | system serif stack (0 KB but bland on Linux); a single family | A distinctive identity with no runtime network font dependency. About 95 KB first load, italic lazy. |
| D14 | Router | In-house history router of about 40 lines (`/`, `/s/:slug`, `/x?url=`) | react-router | Keeps the dependency footprint small. |
| D15 | Worker tests | Plain Vitest with a fake KV (Map) and fake AI | `@cloudflare/vitest-pool-workers` | RAM-tight machine; the logic is written as pure functions. |
| D16 | TypeScript | TS 7.0 (native `tsc`); fall back to 5.9 if a config option is unsupported | 5.9 | Faster typechecks. Use only `moduleResolution: "bundler"` and `paths` without `baseUrl`. |
| D17 | Offline | A hand-written service worker plus a post-build manifest script (`scripts/gen-sw.mjs`) | vite-plugin-pwa / Workbox | About 60 lines with no dependency. |
| D18 | Theme | Light only in v1; dark is on the roadmap | ship dark now | Dark needs its own validated palette, and the time is better spent on figures. |
| D19 | Math in prose | Unicode text formulas in monospace; no LaTeX | KaTeX (about 70 KB gzip plus fonts) | Fast load and offline. |
| D20 | API shape | `GET /api/explain?url=` and the result route `/x?url=` | POST | Idempotent, shareable links that map one-to-one to the KV key. |
| D21 | Line budget | "≤ 400 changed lines" excludes lockfiles, fixtures, sample/spec JSON, generated `kit/dist`, built example HTML, fonts/images/screenshots and designer specs under `docs/figures` + `docs/design` | count everything | Matches the intent of "reviewable in about 20 minutes". |
| D22 | Phase count | 15 phases | 10–13 phases with larger PRs | The ≤ 400-line PR rule wins over the 10–13 target (see 7.0). |

---

## 7. Phases

### 7.0 Conventions for every phase
- **One phase = one PR** on branch `phase-<n>-<slug>`, stacked with `gh stack`. Size is roughly ≤ 400 changed lines excluding the items listed in D21.
- **Phase count.** 15 is above the 10–13 target, because keeping each PR at or under about 400 lines required the splits. If the main agent wants fewer phases, the safest merge is P13 + P14 (both mostly prose).
- **Standard gate.** The verifier always runs these, in order, and records the results:
  ```
  pnpm install --frozen-lockfile
  pnpm lint && pnpm typecheck && pnpm test
  pnpm build
  pnpm smoke --out docs/screenshots/phase-<n>          # / and every sample route, desktop 1280x800 + mobile 390x844
  pnpm e2e <phase flows> --out docs/screenshots/phase-<n>   # from P3 on
  ps -eo pid,cmd | grep -E "vite|workerd|wrangler|chrome" | grep -v grep   # must show nothing the verifier started
  git grep -nIiE "price|trading|crypto|payment|invoice|stock market" -- . ':!docs/PLAN.md' ':!pnpm-lock.yaml'   # finance guard (review any hit)
  git grep -nIE "(sk-|api[_-]?key\s*[:=]\s*['\"][A-Za-z0-9])" -- . ':!pnpm-lock.yaml'                           # secrets guard
  ```
  The verifier also checks every acceptance criterion of the phase, looks at every screenshot, and confirms there is no Next.js or Remix, no decorative 3D, no `.github/workflows/`, no `wrangler deploy` (except the P15 dry run), and no mention of Sean's employer.
- **Specialists.** `explorable-designer` runs before any figure or layout work and writes specs to `docs/figures/<name>.md` or `docs/design/*.md`. `a11y-reviewer` runs on every UI phase before the verifier signs off. `skill-author` handles everything under `skills/` that is SKILL.md, references, evals or the audit.
- **Shared machine.** One headless browser at a time. Builds run sequentially. Kill every server you start. No watch modes.

---

### Phase 1: `phase-1-toolchain-sample`
**Goal.** A working toolchain plus the built-in sample rendering path: open the gallery, click a sample, read its essay (figures show their static text alternative until P4).

**Scope** (about 430 lines; config-heavy, quick to review):
- **Toolchain:**
  - `package.json` with the scripts from 5.9 (lint, typecheck, test, build, preview, smoke, check), plus `.npmrc` (`use-node-version=22.23.3`) and `.nvmrc`.
  - `vite.config.ts` with React, the `@kit` alias and the Vitest config (forks, maxWorkers 2, happy-dom per file).
  - `tsconfig.json`, `tsconfig.app.json` and `tsconfig.node.json`, plus `.oxlintrc.json` and `index.html`.
- **Harness:** `scripts/lib/harness.mjs` and `scripts/smoke.mjs` (contract in 5.9).
- **Kit:**
  - `skills/explorable/kit/src/doc/types.ts`: ExplorableDoc v1 types only; valibot comes in P3.
  - `doc/inline.ts`: escaping and the inline formatter, with tests.
  - `doc/essay.ts`: `essayHtml`, where figures render as shells with title, caption and alt, with tests.
- **App:**
  - `src/main.tsx`, `src/App.tsx`, `src/router.ts` (with a test), `pages/GalleryPage.tsx`, `pages/SamplePage.tsx` and `components/EssayView.tsx`.
  - `src/samples/index.ts` plus three sample JSON files (first-draft prose; figures fully specified but rendered static), and `src/styles/base.css` (minimal).
- **CI:** `ci/github-workflow.yml` (checkout, pnpm, `pnpm check`, `pnpm build`).

**Acceptance criteria.**
1. `pnpm lint`, `pnpm typecheck` and `pnpm test` pass. `pnpm test` runs at least 12 tests: router, escaping (`<script>` stays inert), inline formatter, `essayHtml` structure (h1, dek, n sections, one figure shell per figure with title, caption and alt).
2. `pnpm build` succeeds. `pnpm smoke --out docs/screenshots/phase-1` builds, starts the preview, screenshots `/` and `/s/attention` at 1280×800 and 390×844, prints `smoke passed`, and leaves no `vite` or `chrome` process (checked with `ps`).
3. `/` lists 3 sample cards (title, dek, source) as links. Activating one goes to `/s/<slug>` and shows the essay with h1, dek, source link, sections, figure shells and the takeaway. Unknown slugs show a plain "not found" message.
4. With third-party requests blocked, the harness reports zero failed requests and zero console errors.
5. `ci/github-workflow.yml` exists, and nothing exists under `.github/workflows/`.
6. `pnpm exec node -v` prints v22.x, and all package scripts run under it.

**Verifier.** The standard gate, plus `pnpm exec node -v`. Run `pnpm smoke` twice and check `ps` after each. Keyboard: Tab to the second card, Enter, and the URL becomes `/s/bloom-filter`. Screenshots: `home-desktop.png`, `home-mobile.png`, `attention-desktop.png`, `attention-mobile.png`, `bloom-filter-desktop.png`.

**Specialists.** `explorable-designer` drafts the three sample essays (sections, figure intents) in `docs/figures/samples.md` before the implementer writes the JSON.

**Risks.**
- `use-node-version` needs a one-time Node download. Fallback is D1's pins.
- TS 7 config differences. Fallback is TS 5.9 (D16).
- Chrome sandbox in a container may need `--no-sandbox`. Allow it only via an env flag.

---

### Phase 2: `phase-2-design-system`
**Goal.** The identity from section 4: tokens, fonts, wordmark and logo, essay and figure-card layout, gallery cards with thumbnails, the not-found state, focus styles and the reduced-motion base, plus the palette checker as code.

**Scope** (about 400 lines):
- **Styles:** `src/styles/tokens.css`, `base.css` and `app.css`, plus `skills/explorable/kit/src/styles/kit.css` (essay column, figure card, caption, readout strip).
- **Fonts:** `public/fonts/{fraunces-latin.woff2,newsreader-latin.woff2,newsreader-italic-latin.woff2,OFL.txt}` (binaries excluded from the line count). `@font-face` rules and the Newsreader preload go in `index.html`.
- **Components:** `src/components/{Wordmark,Header,Footer,SampleCard}.tsx`, `src/assets/mark.svg`, `public/favicon.svg`, `src/samples/thumbs/*.svg` and `pages/NotFoundPage.tsx`.
- **Palette as code:** `skills/explorable/kit/src/color/{palette.ts,cvd.ts}` with tests: Machado matrices, OKLab ΔE, WCAG contrast, and assertions for A5 on both surfaces.

**Acceptance criteria.**
1. Every hex value in `tokens.css` matches 4.1. `cvd.test.ts` proves that all series pairs pass protan, deutan and tritan (ΔE ≥ 8) and normal vision (≥ 15). It also checks text and graphics contrast as listed in 4.1, and fails if a fourth series hue is added without passing.
2. The page renders in Newsreader and Fraunces from `/fonts/` with no third-party request. In the harness, `document.fonts.check('16px Newsreader')` is true.
3. The wordmark matches 4.5, the favicon is set, and the wordmark has an accessible name.
4. The gallery layout matches 4.3 at 1280 (3-up), 800 (2-up) and 390 (1-up), with no horizontal scroll at 390.
5. Every focusable element shows a 3 px cobalt focus ring with a 2 px offset.
6. Under `prefers-reduced-motion: reduce`, computed `transition-duration` is 0s on cards and buttons.
7. The not-found page (`/s/nope`, `/whatever`) shows "No explorable lives here" and the gallery.

**Verifier.** The standard gate. Harness checks: (a) a keyboard-only pass on `/`, screenshotting the focus ring on a card (`focus-card.png`); (b) the `/s/nope` state (`not-found-desktop.png`); (c) desktop at 800 px (`home-800.png`). Run the CVD simulation (an SVG `feColorMatrix` filter on `<html>`) on `/s/attention` for protan, deutan and tritan (`attention-protan.png` and so on). The verifier may inline the filter code until P3 adds `cvd()`.

**Specialists.** `explorable-designer` first writes `docs/design/identity.md` (it confirms or refines section 4; any change to a hex value must re-pass the validator). `a11y-reviewer` checks before the verifier.

**Risks.** Font weight (the budget is checked in P3). Distinctiveness is subjective, so the designer signs off in identity.md.

---

### Phase 3: `phase-3-kit-contracts`
**Goal.** The typed contracts and test tooling that every later phase relies on: a validated doc schema, the model registry types, the RNG and formats, the e2e runner with CVD and axe helpers, and size budgets.

**Scope** (about 380 lines):
- **Kit:** `kit/src/doc/schema.ts` (valibot ExplorableDoc v1 plus `parseDoc`; replaces `types.ts`, and the types are inferred), `kit/src/registry.ts` (`ModelDef`, `FigureKind`, `registerModel`, `getModel`, `searchModels(query)`), `kit/src/rng.ts`, `kit/src/format.ts` and `kit/src/index.ts` (the public typed API with TSDoc). Each has tests.
- **Sample check:** a test that every sample JSON passes `parseDoc`.
- **Harness:** `scripts/e2e.mjs`, `scripts/flows/{gallery,keyboard}.mjs`, and `scripts/lib/{cvd.mjs,axe.mjs}`. `cvd(page, 'protan'|'deutan'|'tritan')` injects the matrix filter. `axe(page)` injects `axe-core` from `node_modules` and returns the violations.
- **Size budgets:** `scripts/check-size.mjs` (P1 budgets, gzip via `node:zlib`) and the `check:size` script.

**Acceptance criteria.**
1. `parseDoc` accepts all three samples and rejects at least 10 malformed fixtures, each with a path-specific message: missing alt, alt < 40 chars, 0 or 7 sections, more than 3 controls, wrong schema version, unknown kind, and so on.
2. `searchModels('bloom')` returns `bloom-filter` first once that model is registered (tested with a stub model in P3).
3. `mulberry32(42)` produces a stable sequence (snapshot), and `format` covers int, fixed and sci at the edges (0, 1e-9, 1e6).
4. `pnpm e2e gallery keyboard --out …` passes. `axe()` reports 0 serious or critical violations on `/` and `/s/attention`.
5. `pnpm check:size` passes and prints a table (JS, CSS, fonts, gzip).
6. `devDependencies` adds only `valibot` (runtime), `axe-core` and `playwright-core` (if not already present).

**Verifier.** The standard gate plus `pnpm check:size` and `pnpm e2e gallery keyboard`. Screenshots: `home-protan.png`, `home-deutan.png`, `home-tritan.png`, and `keyboard-*.png` from the flow.

**Specialists.** None required. `a11y-reviewer` gives the axe helper a short look.

**Risks.**
- valibot to JSON Schema coverage for unions. The Plan schema in P9 is kept flat on purpose.
- happy-dom limits. DOM-heavy behaviour is covered by e2e instead.

---

### Phase 4: `phase-4-runtime-attention`
**Goal.** The figure runtime and the first figure kind (`bars`) with `softmax-temperature`, so Fig 1 of the attention sample is fully live. This is the first "wow".

**Scope** (about 440 lines; the largest code phase):
- **Runtime:** `kit/src/runtime/{controls,handle,motion,announce,table,mount}.ts`.
- **Figure and model:** `kit/src/figures/bars.ts` (SVG bars, direct labels, value labels, top-bar ring marker, temperature knob on a track) and `kit/src/models/softmax-temperature.ts` (numerically stable softmax, entropy in bits).
- **Hydration:** `kit/src/doc/essay.ts` gains `hydrateFigures`. Adds `kit/react/Explorable.tsx`, and `EssayView.tsx` uses it.
- **Flows:** `scripts/flows/{attention,reduced-motion}.mjs`.
- **Tests:** model tests with reference values, runtime tests (keyboard steps, aria attributes, announce throttle, table contents) and timing (P3 criterion).

**Acceptance criteria.**
1. Model tests pass:
   - at T = 1, the softmax of logits [2, 1, 0.1] is [0.659, 0.242, 0.099] (±1e-3);
   - as T → 0.05 the top weight is above 0.999;
   - at T = 5 the entropy is within 0.05 bits of log2(6) for near-equal logits;
   - compute takes ≤ 8 ms.
2. On `/s/attention`, Fig 1 shows 6 bars labelled with tokens. Dragging the knob, or using the slider and arrow keys, changes the temperature. The bars and the readout ("top weight 0.xx · entropy x.xx bits") update on the same frame.
3. The knob has `role=slider`, a name, `aria-valuetext="temperature 0.50"`, and supports arrow, PageUp/PageDown, Home and End. The hit area is ≥ 44 px. The live region announces at most once per 500 ms.
4. "Show data" toggles a table of token and weight. The live description updates, for example "Temperature 0.50: 'cat' gets 81% of the attention."
5. Reduced motion: no hint nudge, and keyboard steps are instant. Without reduced motion there is exactly one nudge, which never repeats.
6. The highlighted top bar carries its ring marker as well as its colour. Fig 2 still shows its static shell until P5.
7. The figure stops updating while off screen (IntersectionObserver), checked with a unit test using a mock observer.

**Verifier.** The standard gate plus `pnpm e2e attention reduced-motion`. In the flow: drag the knob from T = 1 to T = 0.1 with `page.mouse`, and assert that the readout text changes and the top weight is above 0.9. Then a keyboard-only pass: Tab to the knob, press End, assert the value equals max. Screenshots: `attention-fig1-default.png`, `attention-fig1-sharp.png`, `attention-fig1-flat.png`, `attention-fig1-focus.png`, `attention-fig1-table.png`, `attention-fig1-deutan.png`, `-protan.png`, `-tritan.png`, `attention-mobile.png`. Run axe on the page.

**Specialists.** `explorable-designer` writes `docs/figures/attention.md` first (both figures; the implementer builds Fig 1). `a11y-reviewer` checks before the verifier.

**Risks.**
- Pointer capture with touch: test `pointerType: 'touch'` emulation at 390 px.
- Line overrun: if it goes above about 450, move `table.ts` to P5.

---

### Phase 5: `phase-5-bloom-bits`
**Goal.** The `bits` figure kind with the `bloom-filter` model, which makes the Bloom sample live. Also the `attention-scaling` model, which reuses `bars` and makes attention Fig 2 live.

**Scope** (about 400 lines):
- **Bloom:** `kit/src/models/bloom-filter.ts` (FNV-1a 32-bit plus double hashing h_i = h1 + i·h2 mod m; insert/query; predicted and observed FPR) and `kit/src/figures/bits.ts` (32 cells in a ruled strip; set bits filled ink; probe arrows from the query word to k cells; a false positive gets a 45° hatch and the label "maybe (false positive)", a true negative is labelled "definitely not").
- **Attention:** `kit/src/models/attention-scaling.ts` (seeded q and k; the √d_k toggle as a 0/1 param) and a `bars` option for the toggle.
- **Wiring:** sample JSON updates, `scripts/flows/{bloom,attention}.mjs`, and tests.

**Acceptance criteria.**
1. Bloom tests:
   - FNV-1a matches known vectors ("a" → 0xe40c292c);
   - inserted words always query positive (property test over 200 seeded words);
   - the predicted FPR for m = 32, k = 3, n = 8 is (1 − e^(−0.75))³ = 0.1469 ±1e-4;
   - observed false positives over the 50 fixed probes are deterministic (snapshot).
2. On `/s/bloom-filter`, the k and n controls (slider and knob) and the query picker (a keyboard-operable `<select>` or a radio group) all update the bits, arrows and readouts (bits set, predicted FPR %, observed FP x/50). At least one built-in query shows a false positive at the default settings.
3. Meaning never relies on colour: a false positive is shown by hatch and label, set bits by fill and the "1" glyph at ≥ 24 px cell size on desktop. The CVD screenshots stay readable.
4. Attention Fig 2: dragging d_k from 1 to 512 with "divide by √d_k" off drives the top weight toward 1 and the readout logit SD toward about √d_k. With it on, SD ≈ 1 (±0.3 over seeds). Tests cover both.
5. Every new control meets the A1–A3 criteria (aria, keyboard, table, live description).

**Verifier.** The standard gate plus `pnpm e2e bloom attention`. Flows: set k = 1, then k = 6 with the keyboard, and assert the predicted FPR changes. Pick the false-positive query and assert the label "maybe (false positive)" is visible. Screenshots: `bloom-default.png`, `bloom-false-positive.png`, `bloom-k6.png`, `bloom-mobile.png`, `bloom-deutan.png`, `bloom-tritan.png`, `attention-fig2-unscaled.png`, `attention-fig2-scaled.png`. Run axe.

**Specialists.** `explorable-designer` writes `docs/figures/bloom-filter.md`, then `a11y-reviewer`.

**Risks.** Cell size at 390 px: wrap to 2 rows of 16. Keep word lists free of finance terms.

---

### Phase 6: `phase-6-diffusion-histogram`
**Goal.** The `histogram` figure kind with the `diffusion-forward` model, which makes the diffusion sample live and fixes thumbnails to real stills.

**Scope** (about 350 lines):
- **Diffusion:** `kit/src/models/diffusion-forward.ts` (linear β, cumulative ᾱ via a precomputed table, seeded x₀ and ε, 2,000 samples, 60 bins) and `kit/src/figures/histogram.ts` (ink-outlined bars, dotted N(0,1) reference with a direct label, a scrubber for t with tick marks at 0/250/500/750/1000, and a ±2σ band).
- **Thumbnails:** `scripts/gen-thumbs.mjs` (optional: renders each sample's Fig 1 at its default state into `src/samples/thumbs/*.svg` through the kit in Node, using string output; if not feasible, keep the hand-drawn thumbnails and note it), plus a flow and tests.

**Acceptance criteria.**
1. Model tests:
   - ᾱ₁ = 1 − 1e-4 (t = 0 shows the data itself);
   - ᾱ₁₀₀₀ ≈ 4.0e-5 (±10%);
   - at t = 1000 the sample mean is |μ| < 0.1 and the SD is within 1 ± 0.05;
   - at t = 0 the histogram is bimodal (two peaks near −2 and +1.5);
   - compute ≤ 8 ms at 2,000 samples (the ε table is precomputed once per seed).
2. Scrubbing t (by drag, slider or keys, where PageUp/PageDown step by 50) morphs the histogram, and the readouts (t, ᾱ_t, signal, noise, SNR) update.
3. The reference curve is dotted ink and directly labelled "N(0, 1)". Data bars are cobalt with an ink outline, so the encoding never relies on colour.
4. Reduced motion: no morph easing.
5. The P2 performance budget still holds (`pnpm check:size`).

**Verifier.** The standard gate plus `pnpm e2e diffusion`. Screenshots at t = 0, 100, 400 and 1000 (`diffusion-t0.png` and so on), `diffusion-mobile.png`, the three CVD screenshots and `diffusion-table.png`. Measure LCP with a 4× CPU throttle on `/s/diffusion` (P2) and record the value.

**Specialists.** `explorable-designer` writes `docs/figures/diffusion.md`, then `a11y-reviewer`.

**Risks.** Per-frame cost on low-end mobile: transform the cached ε table instead of resampling.

---

### Phase 7: `phase-7-curve-expr`
**Goal.** The safe expression language and the `curve` figure kind. This adds Bloom Fig 2 (FPR against n) and diffusion Fig 2 (signal and noise against t), and gives the AI pipeline its generic figure.

**Scope** (about 400 lines):
- **Expression language:** `kit/src/expr/{lexer,parser,compile,validate}.ts` (grammar in 5.2) and `kit/src/models/expr-curve.ts` (a `ModelDef` whose params are declared in the spec).
- **Figure:** `kit/src/figures/curve.ts`: linear or log x, up to 3 series with distinct line style and marker, a draggable point on the primary series (the knob), and optional vertical markers with direct labels (such as "optimal k").
- **Wiring:** sample updates, a flow and tests.

**Acceptance criteria.**
1. The parser accepts `(1 - exp(-k*x/m))^k` and `sqrt(1-a)`. It rejects at least 12 hostile inputs with specific errors: `constructor`, `this.x`, `a=1`, `"str"`, `x;y`, `__proto__`, `alert(1)`, undeclared identifiers, 201-character input, depth 33, empty input, and `1e999` (which gives a non-finite result).
2. `validate` rejects expressions where fewer than 90% of 64 samples are finite. Compiled evaluation matches `Math` references to 1e-12 on 100 seeded points.
3. The parser never uses `eval`, `Function` or `with`. A test greps the source.
4. Bloom Fig 2 draws the FPR curve for the current m and k, with a marker at the optimal k for the current n. Dragging the knob along the curve reads out n and FPR.
5. Diffusion Fig 2: √ᾱ_t is solid cobalt with circle markers and √(1−ᾱ_t) is dashed teal with square markers, both labelled directly, with the current t marked. (√ᾱ_t uses a registry-provided precomputed series rather than expr; document this in the figure spec.)
6. `curve` meets A1–A3, the table lists the sampled points around the knob, and the live description reads like "At n = 8 items, the false-positive rate is 14.7%."

**Verifier.** The standard gate plus `pnpm e2e bloom diffusion`. Screenshots: `bloom-fig2.png`, `bloom-fig2-drag.png`, `diffusion-fig2.png`, the CVD set for both, and `curve-mobile.png`. Run axe.

**Specialists.** `explorable-designer` updates `docs/figures/bloom-filter.md` and `docs/figures/diffusion.md` with the Fig 2 specs, then `a11y-reviewer`.

**Risks.**
- Parser bugs are a security surface, so it gets the dense test list above.
- If the line count goes over, move the log-scale support to P9's assembler phase (it is not needed by the samples).

---

### Phase 8: `phase-8-worker-extract`
**Goal.** The Cloudflare Worker, wired into Vite, that safely fetches and extracts arXiv papers and blog posts. No AI yet.

**Scope** (about 400 lines; fixtures excluded):
- **Config:** `wrangler.jsonc` (top-level, local-safe: `assets` with SPA handling and `run_worker_first: ["/api/*"]`, KV `EXPLORABLE_CACHE` with a local id, vars `EXPLORABLE_DEBUG`), `@cloudflare/vite-plugin` in `vite.config.ts`, `tsconfig.worker.json`, `worker-configuration.d.ts` (from `wrangler types`, committed) and `.dev.vars.example`.
- **Worker:** `worker/index.ts` (router: `/api/health`, `/api/extract` only when `EXPLORABLE_DEBUG` is "1"), `worker/url.ts` (normalise: lowercase host, drop the hash and `utm_*`, arXiv canonical id from abs/pdf/html with or without version; guard: S2), `worker/fetch.ts` (timeout, redirects, size cap, content-type, User-Agent `explorable/0.x (+https://github.com/geekplux/explorable)`) and `worker/extract/{arxiv,blog,text}.ts`.
- **Fixtures and tests:** `worker/fixtures/` (trimmed Atom XML for 1706.03762 and 2006.11239, trimmed arXiv HTML, the trimmed Bloom tutorial HTML, a nav-heavy blog page and a tiny page) and tests.

**Acceptance criteria.**
1. URL tests:
   - these all map to `arxiv:1706.03762`: `https://arxiv.org/abs/1706.03762v7`, `http://arxiv.org/pdf/1706.03762.pdf`, `arxiv.org/html/1706.03762v2#S3`;
   - old-style ids also work (`hep-th/9901001`);
   - `utm_*` params are stripped;
   - `http://localhost`, `http://127.0.0.1`, `http://10.0.0.1`, `http://[::1]`, `http://169.254.169.254`, `file:///etc/passwd`, `ftp://x` and `https://example.com:8080` are rejected as `BLOCKED_URL` or `INVALID_URL`.
2. Extraction tests:
   - the arXiv extractor returns the title, the authors (8 for 1706.03762), the year, the abstract and section text capped at 12,000 characters;
   - the blog extractor gets the Bloom tutorial's title and body while dropping nav and footer;
   - under 600 characters returns `TOO_LITTLE_TEXT`; a non-arXiv PDF returns `UNSUPPORTED_CONTENT`;
   - fetch tests (with a mocked `fetch`) cover the timeout, the 3 MB cap, more than 3 redirects, and a redirect to a private IP being blocked.
3. `pnpm build` produces the client and the Worker. `pnpm preview` serves `/`, `/s/attention` (SPA fallback on deep links, including a reload) and `/api/health` → `{ ok: true, ai: false, kv: true }`.
4. The sample path is unchanged: `pnpm smoke` passes and no request goes to the Worker on `/` or `/s/*`.
5. No login or key is needed. The `ps` check after the harness shows no `workerd` left.

**Verifier.** The standard gate. With the preview running (background, PID recorded): `curl -s localhost:4173/api/health`, then `curl -s "localhost:4173/s/bloom-filter"` (200, HTML). Optional, network permitting: `curl -s "localhost:4173/api/extract?url=https://arxiv.org/abs/1706.03762"` should return a title containing "Attention". Kill the preview. Screenshots: `deep-link-reload.png` (`/s/diffusion` loaded directly).

**Specialists.** None.

**Risks.**
- workerd plus Chrome RAM: run the curl checks and browser checks one after the other, not at the same time.
- `@cloudflare/vite-plugin` with Vite 8: the peer range covers ^8. Pin exact versions.
- arXiv rate limits only affect live checks. Tests use fixtures.

---

### Phase 9: `phase-9-worker-plan-cache`
**Goal.** `GET /api/explain`: KV cache, deterministic match, one Workers AI call in JSON Mode, plan validation and assembly into an ExplorableDoc.

**Scope** (about 420 lines; AI fixtures excluded):
- `worker/plan/schema.ts`: the Plan valibot schema (flat; `figure.model` is an enum of registry ids; params as `{name, value}[]`) and `planJsonSchema()`.
- `worker/plan/prompt.ts`: a system prompt that states the one-idea rule, the voice, the kit catalogue generated from the registry, the expr grammar, no finance topics and no code; plus `PROMPT_VERSION`.
- `worker/plan/ai.ts`: a single `env.AI.run`; handles `response` arriving as an object or a string, and the "JSON Mode couldn't be met" error.
- `worker/plan/match.ts`: keyword scoring over title, abstract and headings; the threshold is a constant with tests.
- `worker/plan/assemble.ts`: clamps to param ranges, validates expr, drops bad figures, fills ids, and runs `parseDoc`.
- `worker/cache.ts` (`crypto.subtle` sha256 keys, TTLs) and `worker/routes/explain.ts`.
- Fake AI and KV in tests, plus `worker/fixtures/ai/*.json`.

**Acceptance criteria.**
1. With a fake AI returning `valid.json`, `/api/explain` returns `{ ok: true, mode: "ai", cache: "miss" }` and a doc that passes `parseDoc`. A second call returns `cache: "hit"`, and the `env.AI.run` call count stays at 1. A 0-call test covers match mode.
2. Fixtures:
   - invalid JSON or the "JSON Mode couldn't be met" error give `PLAN_INVALID`, which is cached for 600 s (fake KV TTL asserted);
   - out-of-range params are clamped, which the test asserts;
   - a hostile expr drops that figure, and with no figures left the result is `NO_FIGURE`;
   - prose with `<script>` is stored as text, and `essayHtml` escapes it (test).
3. With no AI binding:
   - Atom/HTML fixtures for 1706.03762 produce `mode: "match"` with the attention template, `provenance.mode = "match"`, and the source title and authors from the paper;
   - an unrelated blog fixture gives `AI_UNAVAILABLE`, with the extracted title in `error.hint`.
4. The request body to `env.AI.run` contains `response_format.type = "json_schema"` and ≤ 12,000 characters of source text, and `max_tokens` ≤ 1800 (snapshot of the request shape).
5. The cache key changes when `PROMPT_VERSION` changes (test).
6. Every error code in 5.6 has at least one test and a stable `{ code, message, hint }`.

**Verifier.** The standard gate. Preview check (local, no AI): `curl -s "localhost:4173/api/explain?url=https%3A%2F%2Farxiv.org%2Fabs%2F1706.03762"` → `mode: "match"` (needs network for arXiv; if offline, record "skipped: no network", since unit tests cover it). A second identical curl has the `x-explorable-cache: hit` header. Kill the preview. There are no screenshots unless UI changed; the smoke run still happens.

**Specialists.** `explorable-designer` reviews the prompt's figure catalogue wording in `docs/design/prompt.md` (short) before implementation.

**Risks.**
- LLM schema adherence with a 70B model. Keep the schema flat, put two worked examples in the prompt, and keep the lean fallbacks.
- The prompt must not leak article text into logs beyond what is needed.

---

### Phase 10: `phase-10-url-flow-ui`
**Goal.** The single input, end to end: paste a URL → `/x?url=` → loading → result or error. Typed words → local search. All states polished.

**Scope** (about 390 lines):
- `src/components/UrlField.tsx` (one labelled input; submits on Enter or paste-then-Enter; detects URL vs text; inline validation message), `src/hooks/useExplain.ts` (AbortController, 30 s timeout, stage timer), `pages/ResultPage.tsx`, `components/states/{LoadingEssay,ErrorState,OfflineBanner,SearchResults,ProvenanceBadge}.tsx`, and "Try" chips.
- Flows: `scripts/flows/{url-flow,search}.mjs`, which mock `/api/explain` with `page.route` for success-ai, success-match, each error code and a slow response (5 s).

**Acceptance criteria.**
1. Pasting `https://arxiv.org/abs/1706.03762` and pressing Enter navigates to `/x?url=https%3A%2F%2Farxiv.org%2Fabs%2F1706.03762`. The skeleton shows with `aria-busy`, the live region announces the stages in order, and the result renders through `Explorable` with the provenance badge text from 4.3.
2. Every error code renders the 4.6 error panel with its own copy, a heading that takes focus (`tabindex=-1`), and three sample mini cards. `AI_UNAVAILABLE` shows the extracted title and explains that live generation needs Workers AI, with a link to the self-hosting docs anchor.
3. Cancel aborts the fetch and returns to `/` with the input still filled. Back and forward between `/` and `/x` and `/s` work.
4. Typing `bloom` (not a URL) shows the matching sample immediately with no network request (the harness asserts zero `/api` requests). Typing nonsense shows "No built-in match: paste a link instead."
5. `navigator.onLine === false` shows the offline banner, and submitting a URL while offline shows a friendly message instead of fetching.
6. axe on the loading, error and result states reports 0 serious or critical violations. Everything is keyboard-only operable.

**Verifier.** The standard gate plus `pnpm e2e url-flow search`. Screenshots: `input-empty.png`, `input-typed.png`, `loading-desktop.png`, `loading-mobile.png`, `result-ai.png`, `result-match.png`, `error-fetch-failed.png`, `error-ai-unavailable.png`, `error-mobile.png`, `search-bloom.png`, `offline-banner.png`. Optional live flow through the real local Worker (`url-live`, skipped without network).

**Specialists.** `explorable-designer` checks the states against 4.6 (short notes in `docs/design/states.md`), then `a11y-reviewer`.

**Risks.** Honest progress copy (no fake percentages). Focus management on route changes.

---

### Phase 11: `phase-11-skill-build-audit`
**Goal.** Make the kit usable as a zero-install agent skill: a prebuilt kit bundle, a one-command standalone builder, the audit and its tests, two worked examples, and CI that keeps them all honest.

**Scope** (about 400 lines; generated `kit/dist` and example HTML excluded):
- **Kit bundle:** `vite.kit.config.ts` (library mode → `skills/explorable/kit/dist/explorable-kit.js` (ESM, minified) and `explorable-kit.css`) and the `build:kit` script.
- **Builder:** `skills/explorable/scripts/build.mjs <spec.json> [--out file.html] [--no-fonts]`. It runs on Node ≥ 20.10 with zero dependencies. It validates with the bundle's `parseDoc`, and writes a single HTML file with inline CSS, inline JS, the inlined Newsreader roman as base64 (unless `--no-fonts`), `lang`, `<title>`, a `<main>` landmark and the static `essayHtml` content, plus a hydration script.
- **Audit:** `skills/explorable/scripts/audit.mjs <spec.json|page.html>`. Checks: schema, each figure has 1–3 controls and readouts, alt ≥ 40 chars, a caption, params in range, expr valid and finite, palette CVD and contrast via the kit, no external `src`/`href` except `source.url`, the reduced-motion CSS present, and the page has landmarks and a title. It prints numbered problems and exits 1, or ends with `audit passed`.
- **Regression tests:** `skills/explorable/scripts/{build,audit}.test.mjs` (node:test).
- **Examples:** `skills/explorable/examples/{bloom-filter,newton-cooling}/explorable.json` plus the built `index.html` files.
- **CI:** `ci/github-workflow.yml` extended (the skill job: `node --test skills/explorable/scripts/*.test.mjs`, rebuild both examples, `pnpm build:kit`, then `git diff --exit-code`).

**Acceptance criteria.**
1. `pnpm build:kit` is deterministic: two runs produce the same bytes.
2. Building each example with system Node 20 (`/usr/bin/node skills/explorable/scripts/build.mjs skills/explorable/examples/<name>/explorable.json`) writes `index.html`. `node skills/explorable/scripts/audit.mjs` on both the JSON and the HTML ends with `audit passed`.
3. `node --test skills/explorable/scripts/*.test.mjs` passes. It includes at least 8 failing-audit fixtures: missing alt, unknown model, external script, out-of-range param, hostile expr, 4th hue, no controls, and empty sections.
4. Opening `index.html` from `file://` in the harness, with all network blocked, works: the figures are live, a keyboard step changes a readout, and there are no console errors.
5. The kit bundle is ≤ 45 KB gzip (it has no React).
6. The CI file covers the app checks and the skill checks, and nothing is added under `.github/workflows/`.

**Verifier.** The standard gate; the commands above with `/usr/bin/node` (Node 20) for the skill scripts; `pnpm build:kit && git diff --exit-code skills/explorable/kit/dist`; harness `file://` checks. Screenshots: `skill-bloom-filter.png`, `skill-newton-cooling.png`, `skill-newton-cooling-mobile.png`, `skill-newton-cooling-deutan.png`.

**Specialists.** `skill-author` (it clones anatomy to /tmp read-only per its instructions, then deletes the clone) designs the script interfaces and audit checks. `explorable-designer` writes `docs/figures/newton-cooling.md`. `a11y-reviewer` checks the standalone page.

**Risks.**
- Inlined fonts bloat the HTML (about 80 KB), so `--no-fonts` exists.
- Bundle drift: the CI freshness check catches it.

---

### Phase 12: `phase-12-skill-docs-evals`
**Goal.** The skill meets the wheresryan22/anatomy bar: SKILL.md, references, evals, and a passing audit by `skill-author`.

**Scope** (about 380 lines; mostly markdown and JSON):
- **SKILL.md** (≤ 200 lines). Frontmatter:
  - `name: explorable`;
  - a trigger-rich `description` ("interactive explainer", "explorable explanation", "make this paper/concept interactive", "draggable figure", "Bret Victor/Ciechanowski style", "for a blog post or docs", "even if they don't say explorable");
  - `license: MIT`;
  - `compatibility: Claude Code and other agents that load SKILL.md skills; Node.js 20.10+; Chrome optional for browser checks`.

  Body:
  - It leads with **the one idea**: "One idea, one live model, and the reader's hand on the parameter that matters."
  - It points to the closest worked example.
  - The workflow is: pick the one idea → choose a registry model or `expr-curve` → write `explorable.json` → `build.mjs` → `audit.mjs` until `audit passed` → open and drag it.
  - The quality bar: real model, a11y, CVD-safe, reduced motion, no decorative 3D.
- **References:** `skills/explorable/references/{spec-format.md, models.md, figure-kinds.md, expressions.md, writing.md, accessibility.md, verify.md, react.md}`.
- **Evals:** `skills/explorable/evals/evals.json` with at least 6 evals (`id`, `prompt`, `expected_output`, `files`), including these edge cases:
  1. A concept with no registry model → `expr-curve`.
  2. A request for a 3D figure → a 2D explanation, with the reason stated.
  3. A React project → `kit/react/Explorable.tsx`.
  4. A non-arXiv PDF link → ask for the text or use the concept.
  5. A request that crams in three ideas → pick one and say why.
  6. A request that would need colour-only encoding → the audit fails it until shapes are added.
- `README.md` in the skill folder: a 10-line install-and-try.

**Acceptance criteria.**
1. `skill-author` audit: every bar item in CLAUDE.md passes. The frontmatter parses as YAML with all 4 keys. Every file SKILL.md links to exists (checked by a new `skills/explorable/scripts/links.test.mjs`).
2. Every `expected_output` is concrete and checkable: it names files, the exact audit line `audit passed`, the controls and the readouts.
3. Every command in SKILL.md, copied verbatim, works from a clean checkout with Node 20 (the verifier runs each).
4. There are no claims in SKILL.md that are not backed by kit code or an audit check (cross-checked by `skill-author`).

**Verifier.** The standard gate plus `node --test skills/explorable/scripts/*.test.mjs`. Run each SKILL.md command. Screenshots: none new (the smoke run still happens).

**Specialists.** `skill-author` (lead), `explorable-designer` for `writing.md`.

**Risks.** SKILL.md bloat: push detail into the references.

---

### Phase 13: `phase-13-oss-hygiene`
**Goal.** The open-source repository basics that signal a healthy project.

**Scope** (about 400 lines of markdown and YAML):
- `LICENSE` (MIT, "Copyright (c) 2026 geekplux and explorable contributors").
- `CONTRIBUTING.md`: setup (pnpm; Node 22 is fetched by pnpm automatically), scripts, the harness, the line-budget PR norm, how to add a figure (link), and the a11y and CVD rules.
- `CODE_OF_CONDUCT.md`: Contributor Covenant 2.1, with reports going through GitHub private reporting or the maintainer's GitHub contact (no employer, no personal email invented).
- `SECURITY.md`: private advisories, plus the scope (Worker fetch guard, expr evaluator).
- `.github/ISSUE_TEMPLATE/{bug_report.yml, figure_request.yml, sample_request.yml, config.yml}` and `.github/pull_request_template.md` (checklist: `pnpm check`, smoke, screenshots, CVD, keyboard, CHANGELOG line).
- `CHANGELOG.md` (Keep a Changelog; an `Unreleased` entry summarising P1–P12).
- `docs/EXTENDING.md`: step by step guides to add a model, add a figure kind, add a sample and add an expr function, each with a checklist and test template.
- `docs/GOOD_FIRST_ISSUES.md`: 8–10 scoped candidates, e.g. a dark theme palette (validated), a `pendulum` model, a `random-walk` model, a "copy link to this figure state" feature, a `fourier-series` registry model, a reduced-data mode for the histogram, a Spanish translation of a sample, a print stylesheet, and `expr` functions `log2`/`log10`.

**Acceptance criteria.**
1. All files exist. The YAML issue forms parse (a test or script validates them with a tiny YAML check, or the verifier uses `python3 -c "import yaml"` if available, otherwise a manual review).
2. Nothing under `.github/workflows/`.
3. Following EXTENDING.md's "add a model" steps literally on a scratch branch (verifier dry run, then reverted) yields passing tests.
4. There is no mention of Sean's employer and no finance examples.

**Verifier.** The standard gate (no UI change; smoke still runs), the YAML parse, the link check (every relative link in the new docs resolves), and the EXTENDING dry run (then `git checkout -- . && git clean -fd` of the scratch work only).

**Specialists.** `skill-author` reviews EXTENDING.md for consistency with the skill references.

**Risks.** The Contributor Covenant text length is boilerplate and excluded from the review effort.

---

### Phase 14: `phase-14-readme-launch`
**Goal.** A README that sells in 10 seconds, a social preview image, a root `examples/` gallery and the launch kit.

**Scope** (about 380 lines):
- **README.md** (rewrite):
  - one-line pitch, then the hero image (`docs/assets/hero.png`, captured from `/s/attention` mid-drag), then a "Live demo: link coming soon" placeholder;
  - quick start for three audiences: (1) the web demo; (2) local `pnpm i && pnpm dev`; (3) the one-command skill install and try (section 2);
  - how it works as a mermaid diagram of 5.3, with the "only one AI call" explanation;
  - the samples table, the accessibility statement, self-hosting (with or without AI), the roadmap (dark theme, more figure kinds, share links to figure state, more samples, i18n), contributing and the licence;
  - status badges are text only (no workflow badge yet).
- **Scripts:** `scripts/social-image.mjs` (renders `scripts/social/social.html` (wordmark, pitch, a live-figure still) at 1280×640 through the harness → `docs/assets/social-preview.png`) and `scripts/build-examples.mjs` plus the `build:examples` script (builds each `src/samples/*.json` through the skill builder into `examples/<slug>.html`).
- **Gallery:** `examples/README.md` (a table of the 3 samples and 2 skill examples, with screenshot, source, and how to rebuild).
- **Launch kit:** `docs/LAUNCH.md`:
  - a Show HN title and post and an X thread draft, both marked "draft, do not post";
  - 3 demo scenarios (student reading the attention paper; writer adding a Bloom figure to a post with the skill; self-hoster running without AI);
  - a comparison with alternatives (static diagrams, hand-built D3/Observable notebooks, generic "chat with PDF" tools, LLM-generated free-form code), in an honest table of what each gives the reader;
  - a pre-launch checklist.

**Acceptance criteria.**
1. The README's first screen (rendered as GitHub markdown) contains the pitch, the hero image and the quick start. The hero image exists and is under 400 KB. Every link and image path in README and `examples/README.md` resolves (link-check script).
2. `pnpm build:examples` writes 3 standalone pages, and `audit.mjs` passes on each.
3. `docs/assets/social-preview.png` is 1280×640 and under 1 MB. STATUS follow-ups note that it must be uploaded in the repo settings by hand.
4. LAUNCH.md has all 4 parts, states clearly that nothing is posted, and has no finance or employer mentions.
5. The "one command to try the skill" in README is verified by the verifier into a temp HOME (`HOME=$(mktemp -d)`), using a local path instead of degit if there is no network.

**Verifier.** The standard gate, `pnpm build:examples`, the audit on each, the link check, and `file` dimensions of the images. Screenshots: `readme-hero.png` (copy of the hero), `social-preview.png`, `examples-attention.png` (standalone file).

**Specialists.** `explorable-designer` (hero and social composition), `skill-author` (skill quick start accuracy).

**Risks.** The GIF is optional, since it is large. A still hero is the default, and a GIF goes in a good-first-issue.

---

### Phase 15: `phase-15-deploy-prep` (final; stops for Sean's approval)
**Goal.** Production readiness and a verified deployment dry run: offline service worker, security and caching headers, rate limiting, the production Wrangler environment and deployment docs. **No deploy.**

**Scope** (about 350 lines):
- **Service worker:** `scripts/gen-sw.mjs` (post-build: writes `dist/client/sw.js` with the precache list and a hashed cache name) and registration in `src/main.tsx` (production builds only).
- **Headers:** `public/_headers`:
  - CSP: `default-src 'self'; img-src 'self' data:; font-src 'self'; style-src 'self'; script-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'`, with nothing inline;
  - `/assets/*` immutable;
  - `index.html` no-cache;
  - `X-Content-Type-Options` and `Referrer-Policy`.
- **Wrangler config:** `wrangler.jsonc` `env.production` (AI binding `AI`; KV `EXPLORABLE_CACHE` with an id placeholder `REPLACE_WITH_KV_ID` documented; `ratelimits` `EXPLAIN_LIMITER` 10/60 s; vars `AI_MODEL`, `PROMPT_VERSION`; `observability.enabled: true`). The Worker applies the limiter to uncached explains only.
- **Scripts:** `build:prod` (`CLOUDFLARE_ENV=production vite build && node scripts/gen-sw.mjs`) and `check:deploy` (`wrangler deploy --dry-run --outdir .wrangler/dry-run`).
- **Docs:**
  - `docs/DEPLOY.md`: prerequisites, `wrangler login`, `wrangler kv namespace create EXPLORABLE_CACHE`, pasting the id, the exact deploy command, rollback with `wrangler rollback`, and how to self-host without AI;
  - a cost note (one AI call per new URL, KV cache, rate limit);
  - a CHANGELOG line.

**Acceptance criteria.**
1. `pnpm build:prod && pnpm run check:deploy` succeeds and writes `.wrangler/dry-run/` (gitignored). The output lists the bindings `ASSETS`, `EXPLORABLE_CACHE`, `AI` and `EXPLAIN_LIMITER`. No real deploy happens (verifier: `git grep -n "wrangler deploy" -- package.json` shows only `check:deploy`; the shell history has no non-dry-run deploy).
2. The harness checks offline behaviour (O2): load `/`, wait for the SW to activate, call `context.setOffline(true)`, then reload `/` and `/s/diffusion`. Both render with live figures, and the input shows the offline message.
3. The preview response headers include the CSP from the scope list. Under that CSP there are no console CSP violations on `/`, every sample and `/x` (mocked).
4. A unit test shows the rate limiter returns `RATE_LIMITED` (429) when the binding says no, and does not apply to cache hits.
5. P1 and P2 budgets pass: `pnpm check:size`, and LCP measured by the harness with 4× throttle on `/` and `/s/attention`.
6. The PR description contains the exact deploy command (`pnpm build:prod && pnpm exec wrangler deploy`), the one-time setup steps, and "awaiting Sean's approval to deploy". STATUS becomes `STATE: DONE` with that note (main agent).

**Verifier.** The standard gate, `pnpm build:prod`, `pnpm run check:deploy`, and `pnpm e2e offline csp`, then the `ps` cleanup check. Screenshots: `offline-reload-home.png`, `offline-reload-diffusion.png`, `final-home-desktop.png`, `final-home-mobile.png`, `final-attention-desktop.png`.

**Specialists.** `a11y-reviewer` does a final full pass over all routes (axe, keyboard, CVD, reduced motion) and reports in the PR.

**Risks.**
- The dry run without a login may warn about the account. It is acceptable if bundling succeeds; record the output.
- A strict CSP can break Vite's injected styles. Keep all CSS in files with no inline styles; the kit sets SVG attributes, not `style=` strings.
- The SW serving stale assets after a deploy: use a hashed cache name and `skipWaiting` on activate, with an update toast deferred to a good-first-issue.

---

## 8. Phase summary

| # | Branch | Goal (one line) | Est. lines |
|---|---|---|---|
| 1 | `phase-1-toolchain-sample` | Toolchain, harness, CI file, gallery, and sample essays rendered statically | ~430 |
| 2 | `phase-2-design-system` | Identity: tokens, fonts, wordmark, layout, cards, not-found, CVD palette test | ~400 |
| 3 | `phase-3-kit-contracts` | valibot doc schema, registry types, RNG/format, e2e runner with CVD/axe, size budgets | ~380 |
| 4 | `phase-4-runtime-attention` | Figure runtime and `bars` with softmax temperature: the first live figure | ~440 |
| 5 | `phase-5-bloom-bits` | `bits` and the Bloom model; attention Fig 2 (√d scaling) | ~400 |
| 6 | `phase-6-diffusion-histogram` | `histogram` and the diffusion forward model | ~350 |
| 7 | `phase-7-curve-expr` | Safe expression language, `curve` kind, Fig 2 for Bloom and diffusion | ~400 |
| 8 | `phase-8-worker-extract` | Worker with Vite plugin, URL guard, arXiv and blog extraction | ~400 |
| 9 | `phase-9-worker-plan-cache` | `/api/explain`: KV cache, match mode, one JSON-Mode AI call, assembly | ~420 |
| 10 | `phase-10-url-flow-ui` | Input → loading → result or error, local search, offline banner | ~390 |
| 11 | `phase-11-skill-build-audit` | Kit bundle, standalone builder, audit and tests, 2 examples, CI skill job | ~400 |
| 12 | `phase-12-skill-docs-evals` | SKILL.md, references, evals; anatomy bar audit | ~380 |
| 13 | `phase-13-oss-hygiene` | LICENSE, CONTRIBUTING, CoC, SECURITY, templates, CHANGELOG, EXTENDING, good first issues | ~400 |
| 14 | `phase-14-readme-launch` | README, hero, social image, examples gallery, LAUNCH.md | ~380 |
| 15 | `phase-15-deploy-prep` | SW offline, CSP and headers, rate limit, production env, dry run, DEPLOY.md; stops for approval | ~350 |

---

## 9. Out of scope (v1)

- Accounts, saving, comments, analytics or tracking.
- Editing an explorable in the UI.
- Free-text generation through AI (typed text is local search only).
- PDFs that are not on arXiv.
- LaTeX/KaTeX rendering.
- Video or GIF export.
- Dark theme (roadmap).
- i18n (roadmap).
- Any figure code generated by the LLM.
- Decorative 3D or WebGL.
- More than one AI call per URL, or streaming or agentic multi-step generation.
- D1/R2 storage.
- Moving `ci/github-workflow.yml` into `.github/workflows/` (needs the `workflow` token scope; listed as a STATUS follow-up).
- Posting any launch material.
- Actually deploying (awaits Sean).
- Anything finance-related.

## 10. Risks (cross-cutting)

| Risk | Impact | Mitigation |
|---|---|---|
| Node 20 on the machine vs Node 22 needed by the toolchain | Phase 1 blocked | pnpm `use-node-version` (D1); fallback version pins |
| RAM (~2 GB free): Vite build + workerd + Chrome | OOM or flaky checks | Steps run one after another; one browser; Vitest forks ≤ 2; the harness kills process groups; `ps` check in every verify |
| LLM fails JSON Mode or picks a poor idea | Bad or no result for some URLs | Flat schema, registry catalogue in the prompt, clamp-and-drop assembler, match-mode fallback, short negative cache, honest error copy |
| LLM prose is inaccurate | Misleads readers | Provenance badge, source link always visible, numbers only from models, figures never from prose |
| arXiv HTML missing or rate limited; blog extraction noisy | Weaker plans | Abstract-only fallback, polite User-Agent, KV cache, `TOO_LITTLE_TEXT` copy |
| Expression evaluator as a security surface | Code execution | Hand-written parser, no `eval`/`Function`, hostile-input tests, length and depth caps, CSP without `unsafe-eval` |
| Workers AI cost or abuse once public | Spend | One call per URL, 30-day cache, rate limit binding, negative cache |
| Version churn (Vite 8, Vitest 5, TS 7, wrangler 4.151, cloudflare plugin 1.64) | Toolchain breakage | Exact pins in package.json; fallbacks noted in D1/D16 |
| Stacked PR conflicts in shared files (CHANGELOG, STATUS, samples) | Rebase pain | CHANGELOG only from P13; STATUS is edited only by the main agent; `gh stack sync` |
| Screenshot bloat in git | Repo size | PNG at 1×, ≤ 15 shots per phase, mobile shots clipped to the first two screens |
| Font files and licensing | Legal or size | OFL fonts with OFL.txt committed; Latin subsets; budget enforced |
| Copyright of source text | Legal | Store only generated summaries plus ≤ 2-sentence quotes with attribution; never re-host full text |
