# Changelog

All notable changes to this project are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project will follow [Semantic Versioning](https://semver.org/spec/v2.0.0.html) from its first release.

## [Unreleased]

### Added: page-view counts on the live site

- explorable.geekplux.com counts page views with Google Analytics: the route only (`/`, `/s/<essay>`, `/x`), never a pasted link or the title of what it explains. Self-hosted copies load no analytics.

### Added: a daily cap on live AI

- Live explains are capped site-wide each day (`DAILY_AI_CAP`, 100 model calls per UTC day). Past the cap, a link that matches a built-in explainer opens in match mode (not cached), any other link gets a new `AI_BUDGET` error page, and the samples keep working. PR Previews never call the model. The footer says so.

### Changed: the October 2026 redesign

Explorable now reads as a short essay in plain words for a curious reader with school maths, with formulas and sources one click away, in a new identity (spec: `docs/redesign/DESIGN.md`).

- **Identity.** Radix Colors sand, indigo and orange tokens, with a dark theme that follows the system setting, and a light/dark toggle in the header that remembers a choice different from the system (no flash on load, print stays light); Source Serif 4, Geist and Geist Mono, self-hosted. The serif is pinned at optical size 20 and draws its own √, ∑, ≈, ≤, ≥ and ∞. A new spiral logo and favicon; a header with navigation on every page, a "Made by GeekPlux" block linking geekplux.com and sibling projects, and a simpler footer. The "All explorables" back links are gone; the logo goes home.
- **Home.** A hero with a live, draggable figure, a numbered essay index with thumbnails that play once on hover, a "How it works" section, and plain-words copy. The "Try" chips are gone; the essay index lists the same samples. Index deks set variables the same way as the essay.
- **Essay.** A 640px column at 20/1.6 with 720px figures, a title block with a "Based on …" byline (plus "Written by AI from the source." for AI essays) in place of the kicker and provenance badge, hanging section numbers, and a takeaway that ends in "Read the original paper/post". Variables are set in italics (d_k, T, q, k) everywhere text is formatted, including figure labels, readouts, legends and table headers. Contents sit in the left gutter at ≥ 1280px with a reading-progress track and a bracket over the sections in view; contents links move focus to their heading, and a link to a section (`#divide-by-root-d`) opens there. Loading, error and not-found pages are restyled in the essay column, with no kickers or skeleton.
- **Figures.** A title, the stage, the controls, a mono readout and a "Show data" text button between hairlines. The drag hint, the knob grip and the ▼ top marker are gone, the leading bar is drawn in indigo-11, readouts drop the "·" joiner, and the knob's native twin slider is kept for assistive tech but hidden. The attention figure's width knob reads "key width d sub k" to screen readers instead of "d_k".
- **Motion.** The title travels from the index into the essay (300ms view transition), bars settle in 250ms, figures below the fold enter once, the title block fades in; all of it is off under reduced motion.
- **Plain words and notes.** The three samples are rewritten for a curious reader with no background beyond school maths. Formulas sit behind a small Σ marker that opens a panel with the formula and a one-sentence gloss, and author citations ("Vaswani et al.") open a card with the paper's title and link on focus, hover or tap. In the panel only variables (Latin and Greek) are italic; digits, signs, function names and words stay upright. Data tables set variables in their caption and cells too.
- **AI in plain words.** Essays from a pasted link come out in the same voice (prompt `p3`, so earlier cached essays are not served): the model is asked for one big idea in plain words, with formulas in math notes and the source cited as `[[source]]`. The user message says how `[[source]]` will read, so the verb agrees. A deterministic safety net, with no second model call and no rewriting inside a sentence, drops a sentence that is only a formula the model already put in a note, turns citations of the source into one source note built from the article's metadata, and removes markers that point nowhere or hold LaTeX. The kit's formula check reads ‖…‖ and |…| as brackets. The Worker logs the essay's Flesch–Kincaid grade (counts only, not shown).
- **Print.** Essays print on A4 as a clean article: a running head with the logo and the essay's address on every page, no site chrome, contents or buttons, figures whole and in the state you left them with a line such as "Shown at *T* = 1. Interactive version at explorable.geekplux.com/s/attention#fig-temperature", and only the math notes you opened. Printing never turns dark.
- **Skill.** `/explorable` writes plain words too: SKILL.md leads with that idea, `references/writing.md` covers when to make a math note, how to write its gloss and how to cite through a source note, and `references/spec-format.md` documents schema 2 in full. Both worked examples are schema 2 with no formula warnings (the Bloom filter example cites its tutorial through a source note where it gives the same formula), three new evals check plain words, citations and a LaTeX request, and the skill page check opens a note. Standalone pages inline the serif's math signs, so √ matches the text around it.
- **Docs and images.** The README leads with the site's pitch and a screenshot of the new home (`docs/assets/hero.webp`); the social preview is redrawn in the new identity and served at `/social-preview.png` with Open Graph and Twitter card tags; `pnpm build:images` makes both. `docs/design/identity.md` is marked superseded, and `docs/design/prompt.md` describes p3.

### Added

- A "PDF" button at the end of each essay's byline: the built-in samples download a pre-rendered PDF (`public/pdf/<slug>.pdf`, made by `pnpm build:pdf` with headless Chromium, every math note open), and an essay from a pasted link opens the print dialog to save it as a PDF. The service worker leaves the PDFs alone.
- ExplorableDoc v2: optional doc-level `notes` (math and source) referenced from paragraphs and the takeaway with `[[id]]`, validated with path-specific errors; v1 stays valid. `hydrateNotes` in the kit runtime (called by `hydrateFigures`) so standalone skill pages get the same notes, and `bodyHasFormula`/`findFormula`, a shared check for body text that reads like a formula; the skill audit warns with it.
- A gallery of three built-in sample explorables that open instantly and work offline with no key: why attention divides by √d (`attention`), how a Bloom filter says "maybe" (`bloom-filter`) and noise one step at a time in diffusion models (`diffusion`).
- A visual identity (replaced by the redesign above): the wordmark and mark, Fraunces and Newsreader type, a paper-and-ink palette with 3 colour-vision-checked series colours, and small self-hosted symbol fonts for Greek and math glyphs.
- The figure kit, framework-free and shared by the app and the skill: the `ExplorableDoc` v1 schema, a model registry with seeded randomness, and four figure kinds (`bars`, `bits`, `histogram`, `curve`) with a draggable knob, labelled native controls, a live readout, a spoken description and a "Show data" table on every figure.
- Registry models `softmax-temperature`, `attention-scaling`, `bloom-filter` and `diffusion-forward`, each with hand-computed fixture tests.
- A safe expression language for `expr-curve` figures: its own lexer, parser and closure compiler, with no `eval`, plus finite-sample validation.
- A Cloudflare Worker that guards and fetches a pasted arXiv or blog URL, extracts its text, and makes at most one Workers AI call for a figure plan. Results are cached in KV by URL. A keyword match mode reuses a curated sample without calling the model.
- The URL flow in the app, with loading, error, offline and "AI unavailable" states, and a local search over the samples for typed text.
- The `/explorable` agent skill in `skills/explorable/`: a prebuilt kit bundle, a standalone page builder, an audit script that ends in `audit passed`, two worked examples (Bloom filter, Newton cooling), references, evals and a CI definition (now `.github/workflows/ci.yml`).
- A headless-browser harness (`pnpm smoke`, `pnpm e2e`) with axe, keyboard, reduced-motion and colour-vision checks, and a bundle size budget.
- A README with a hero image and three-way quick start, a social preview image (`pnpm build:images`), a root `examples/` gallery of standalone sample pages (`pnpm build:examples`, checked fresh in CI) and a launch kit in `docs/LAUNCH.md`.
- Deployment prep with no deploy: an offline service worker (`scripts/gen-sw.mjs`), a strict CSP and cache headers (`public/_headers`), a production Wrangler environment with Workers AI, KV and a 10-per-minute rate limit on uncached explains, `pnpm build:prod`, a `pnpm run check:deploy` dry run and `docs/DEPLOY.md`.
- Open-source basics: MIT licence, contributing guide, code of conduct, security policy, issue and PR templates, `docs/EXTENDING.md` and `docs/GOOD_FIRST_ISSUES.md`.

### Accessibility

- Meaning is never carried by colour alone: glyphs, line styles, marker shapes and direct labels back up every hue.
- Every figure is keyboard operable, with 44 px targets, and `prefers-reduced-motion` turns off easing and hints.

[Unreleased]: https://github.com/geekplux/explorable/commits/main
