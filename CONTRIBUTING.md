# Contributing to explorable

Thanks for helping. Explorable turns a paper or a blog post into a short read in plain words about its one big idea, with figures you can drag, and every number on a figure comes from a tested model. Contributions that keep it that way are welcome: new models and figure kinds, new samples, fixes, docs and translations. [docs/GOOD_FIRST_ISSUES.md](docs/GOOD_FIRST_ISSUES.md) lists scoped starting points.

By taking part you agree to the [Code of Conduct](CODE_OF_CONDUCT.md). Report security problems privately, as [SECURITY.md](SECURITY.md) describes.

## Setup

You need [pnpm](https://pnpm.io) 9 (`corepack enable` gives you the pinned version). You do not need to install Node yourself: `.npmrc` pins `use-node-version`, so pnpm fetches Node 22 on first use and runs every script with it.

```sh
pnpm install
pnpm dev        # the app and the Worker together; open the URL Vite prints
```

No account and no API key are needed. The built-in samples work offline. Locally there is no Workers AI binding, so a pasted URL either matches a curated sample or shows the "AI unavailable" state. Copy `.dev.vars.example` to `.dev.vars` to change local vars; never commit `.dev.vars`.

## Scripts

| Script | What it does |
|---|---|
| `pnpm check` | lint (oxlint), typecheck (`tsc --noEmit` for the app, the Node scripts and the Worker) and unit tests (Vitest). Run it before every push. |
| `pnpm test` | Vitest only. `pnpm test registry` runs only the matching files. |
| `pnpm build` | production build of the app and the Worker into `dist/`. |
| `pnpm build:kit` | rebuilds the skill's prebuilt kit bundle in `skills/explorable/kit/dist/`. Whenever you change `skills/explorable/kit/src/`, run it, rebuild the example pages (`node skills/explorable/scripts/build.mjs <spec>` for each `skills/explorable/examples/*/explorable.json`) and commit both: CI checks they are fresh. |
| `pnpm build:examples` | rebuilds the root gallery, `examples/<slug>.html`, from `src/samples/*.json` through the skill's builder. Run it after changing a sample or the kit, and commit the pages: CI checks they are fresh. |
| `pnpm build:images` | recaptures the README hero (`docs/assets/hero.webp`, the home page's hero at 1440 wide) and the social preview (`public/social-preview.png`, served for the `og:image` tags) through the harness. |
| `pnpm build:pdf` | renders each built-in sample to `public/pdf/<slug>.pdf` (A4, every math note open) through the harness; commit the PDFs when a sample, the kit or the print stylesheet changes. |
| `pnpm smoke` | the harness: builds, then screenshots `/` and every sample at 1280, 800 and 390 px, checking fonts, overflow and console errors. Shots land in `test-results/smoke/`. |
| `pnpm e2e <flow…>` | runs the browser flows in `scripts/flows/` (for example `pnpm e2e gallery keyboard`), with axe and colour-vision helpers. |
| `pnpm check:size` | bundle size budget for the app. |
| `pnpm check:skill-page` | opens the skill's example pages from `file://` with the network off. |
| `node --test skills/explorable/scripts/*.test.mjs` | the skill's own tests, dependency-free. |

### The browser harness

`scripts/lib/harness.mjs` starts one preview server and one headless Chrome, and always stops both, even on Ctrl-C. It uses the system Chrome at `/usr/bin/google-chrome`; set `CHROME_PATH` to use another. In a container without a sandbox, set `EXPLORABLE_CHROME_NO_SANDBOX=1`. Add `--no-build` to reuse an existing `dist/`. A flow is a module that exports `async ({ page, baseURL, shot, assert, cvd, axe }) => {}`.

## Pull requests

- **One idea per PR, about 400 changed lines.** The count excludes lockfiles, fixtures, sample and spec JSON, the generated `kit/dist`, built example HTML, images and screenshots. Tests may push a PR over; say so and give the real size in the description.
- Fill in the PR template's checklist. UI changes need screenshots at 1280 and 390 px.
- Add a line to the `Unreleased` section of [CHANGELOG.md](CHANGELOG.md).
- Commit messages follow `type(scope): summary`, for example `feat(kit): pendulum model` or `fix(worker): …`.
- Keep the dependency footprint small. A new runtime dependency needs a reason in the PR.

## Adding to the kit

[docs/EXTENDING.md](docs/EXTENDING.md) walks through adding a model, a figure kind, a sample and an expression function, each with a checklist and a test template. The skill's references in [skills/explorable/references/](skills/explorable/references/) describe the same contracts from the spec author's side.

## Accessibility and colour rules

These are part of "done", not polish:

- **Never colour alone.** Every encoding also has a shape, a line style, a glyph or a word: the top bar has ▼ and "top", curves are solid ●, dashed ■ and dash-dot ▲, bits show `1` and `0`.
- **At most 3 hue-coded series**, from the kit palette (`skills/explorable/kit/src/color/palette.ts`). No colours in specs or options. Any palette change must keep every pair of series apart under protanopia, deuteranopia and tritanopia (`color/cvd.test.ts` checks it), with text at 4.5:1 and graphics at 3:1 contrast.
- **Keyboard.** Every control is a labelled native control or a `role="slider"` knob with arrows, PageUp/PageDown and Home/End. Targets are at least 44 × 44 px. Focus is always visible.
- **Screen readers.** Every figure has alt text, a live one-sentence description and a "Show data" table. Symbols get spoken forms (`spoken`, `seriesSpoken`).
- **Reduced motion.** Under `prefers-reduced-motion: reduce` there is no easing and no animated hint.
- **No decorative 3D**, and nothing finance-related in samples, examples or tests.

`pnpm e2e gallery keyboard reduced-motion theme` covers axe, keyboard paths, reduced motion, the light/dark toggle and colour-vision screenshots for the app.
