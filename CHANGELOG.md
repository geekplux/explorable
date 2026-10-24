# Changelog

All notable changes to this project are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project will follow [Semantic Versioning](https://semver.org/spec/v2.0.0.html) from its first release.

## [Unreleased]

### Changed

- Redesign foundation: Radix Colors sand, indigo and orange tokens with a dark theme that follows the system setting; Source Serif 4, Geist and Geist Mono, self-hosted (`docs/redesign/DESIGN.md`).
- A new spiral logo and favicon; a header with navigation on every page, a "Made by GeekPlux" block linking geekplux.com and sibling projects, and a simpler footer. The "All explorables" back links are gone; the logo goes home.
- Home page redesign: a hero with a live, draggable figure, a numbered essay index with thumbnails that play once on hover, a "How it works" section, and plain-words copy. The "Try" chips are gone; the essay index lists the same samples. Figure readouts drop the "·" joiner, and the leading bar is drawn in indigo-11.

### Added

- A gallery of three built-in sample explorables that open instantly and work offline with no key: why attention divides by √d (`attention`), how a Bloom filter says "maybe" (`bloom-filter`) and noise one step at a time in diffusion models (`diffusion`).
- A visual identity: the wordmark and mark, Fraunces and Newsreader type, a paper-and-ink palette with 3 colour-vision-checked series colours, and small self-hosted symbol fonts for Greek and math glyphs.
- The figure kit, framework-free and shared by the app and the skill: the `ExplorableDoc` v1 schema, a model registry with seeded randomness, and four figure kinds (`bars`, `bits`, `histogram`, `curve`) with a draggable knob, labelled native controls, a live readout, a spoken description and a "Show data" table on every figure.
- Registry models `softmax-temperature`, `attention-scaling`, `bloom-filter` and `diffusion-forward`, each with hand-computed fixture tests.
- A safe expression language for `expr-curve` figures: its own lexer, parser and closure compiler, with no `eval`, plus finite-sample validation.
- A Cloudflare Worker that guards and fetches a pasted arXiv or blog URL, extracts its text, and makes at most one Workers AI call for a figure plan. Results are cached in KV by URL. A keyword match mode reuses a curated sample without calling the model.
- The URL flow in the app, with loading, error, offline and "AI unavailable" states, and a local search over the samples for typed text.
- The `/explorable` agent skill in `skills/explorable/`: a prebuilt kit bundle, a standalone page builder, an audit script that ends in `audit passed`, two worked examples (Bloom filter, Newton cooling), references, evals and a CI definition in `ci/github-workflow.yml`.
- A headless-browser harness (`pnpm smoke`, `pnpm e2e`) with axe, keyboard, reduced-motion and colour-vision checks, and a bundle size budget.
- A README with a hero image and three-way quick start, a social preview image (`pnpm build:images`), a root `examples/` gallery of standalone sample pages (`pnpm build:examples`, checked fresh in CI) and a launch kit in `docs/LAUNCH.md`.
- Deployment prep with no deploy: an offline service worker (`scripts/gen-sw.mjs`), a strict CSP and cache headers (`public/_headers`), a production Wrangler environment with Workers AI, KV and a 10-per-minute rate limit on uncached explains, `pnpm build:prod`, a `pnpm run check:deploy` dry run and `docs/DEPLOY.md`.
- Open-source basics: MIT licence, contributing guide, code of conduct, security policy, issue and PR templates, `docs/EXTENDING.md` and `docs/GOOD_FIRST_ISSUES.md`.

### Accessibility

- Meaning is never carried by colour alone: glyphs, line styles, marker shapes and direct labels back up every hue.
- Every figure is keyboard operable, with 44 px targets, and `prefers-reduced-motion` turns off easing and hints.

[Unreleased]: https://github.com/geekplux/explorable/commits/main
