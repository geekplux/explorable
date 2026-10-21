# Changelog

All notable changes to this project are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project will follow [Semantic Versioning](https://semver.org/spec/v2.0.0.html) from its first release.

## [Unreleased]

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
- Open-source basics: MIT licence, contributing guide, code of conduct, security policy, issue and PR templates, `docs/EXTENDING.md` and `docs/GOOD_FIRST_ISSUES.md`.

### Accessibility

- Meaning is never carried by colour alone: glyphs, line styles, marker shapes and direct labels back up every hue.
- Every figure is keyboard operable, with 44 px targets, and `prefers-reduced-motion` turns off easing and hints.

[Unreleased]: https://github.com/geekplux/explorable/commits/main
