# Architecture

Explorable turns one article into a short essay with live figures. Three parts share one figure kit: a React app, a Cloudflare Worker and an agent skill. This page says where each piece lives, how a pasted link becomes an essay, and why it is built this way.

## The parts

| Part | Where | What it does |
|---|---|---|
| Kit | `skills/explorable/kit/src` | The doc schema, the models, the expression language, the figure kinds and the runtime that mounts them. Framework-free TypeScript. |
| App | `src` | The React pages (home, sample essays, pasted links), the router, search over the samples, theme and print. Imports the kit through the `@kit` alias. |
| Worker | `worker` | `/api/explain`: guards and fetches a link, extracts the text, makes at most one model call and assembles a doc. Static assets serve everything else. |
| Skill | `skills/explorable` | `SKILL.md`, references, evals, two worked examples and the scripts that build and audit standalone pages. Uses the prebuilt kit in `skills/explorable/kit/dist`. |
| Tooling | `scripts` | Size budget, service worker, logo, thumbnails, PDFs, social images and the headless-browser harness. |

Inside the kit:

- `doc/`: the `ExplorableDoc` schema (valibot), inline formatting, notes and the formula check.
- `models/` and `registry.ts`: pure, seeded models. Every number a figure shows comes from one.
- `expr/`: lexer, parser and closure compiler for `expr-curve` expressions.
- `figures/`: the four kinds (`bars`, `bits`, `histogram`, `curve`), drawn as SVG.
- `runtime/`: the knob, native controls, readouts, the live region, the data table and `hydrateFigures`.
- `color/` and `styles/`: Radix-based tokens, the series palette and its colour-vision tests.

## How a request flows

```
  browser                         Worker (/api/explain)                  outside
  -------                         ---------------------                  -------
  paste URL ──► GET ?url= ──►  normaliseUrl + SSRF guard
                                      │
                                KV cache hit? ── yes ──► doc
                                      │ no
                                extract (arXiv / blog) ─────────────►  source page
                                      │
                                matchModels (keywords)
                                      │
                                daily cap left? ── no ──► match mode or AI_BUDGET
                                      │ yes
                                one Workers AI call ────────────────►  model
                                      │
                                assemblePlan + plain-words repair
                                      │
                                KV put ──► doc
  essay ◄── NDJSON stages ◄───────────┘
```

- The guard allows http(s) only, with no credentials and no custom port. It blocks private and loopback addresses and local host names, and it runs again on every redirect (at most 3). Fetches stop at 10 s or 3 MB.
- Cache keys include the canonical URL, the schema version and `PROMPT_VERSION`. Docs live 30 days, failures 10 minutes, a failed model call 1 minute.
- A client that asks for NDJSON hears the stages (fetching, reading, planning, composing). Two requests for the same link in one isolate share one job.
- Without a model binding, a link that matches a built-in template opens in match mode; any other link gets `AI_UNAVAILABLE`.
- Built-in samples never touch the Worker: they are JSON in `src/samples` and work offline.

## Decisions that shaped it

- **One kit, three hosts.** The app, the Worker and the skill import the same code, so a figure behaves the same everywhere and is tested once.
- **Figures from a library, not from generated code.** The model returns a plan that names registry models or a whitelisted expression. The assembler clamps parameters and drops what fails validation. Nothing the model writes runs as code.
- **No `eval`.** Expressions go through a small parser and compile to closures, with limits on length (200 characters) and depth (32).
- **One model call per uncached link, with no retries.** A deterministic post-process (`worker/plan/plain.ts`) fixes common slips instead of a second call. This keeps cost and latency predictable.
- **A daily cap on live AI.** `takeBudget` in `worker/budget.ts` counts every attempt against `DAILY_AI_CAP` (100 by default). A per-IP rate limit alone would not stop many IPs or varied links.
- **Static HTML first.** `essayHtml` renders an escaped essay that reads well before any script runs; `hydrateFigures` then mounts the figures. Standalone skill pages pre-render the same HTML.
- **Small and dependency-light.** Five runtime dependencies, an in-house router and a hand-written service worker. `pnpm check:size` enforces 110 KB of gzipped JS, 20 KB of CSS and 70 KB of preloaded fonts.
- **Never colour alone.** Series differ by shape, line style and direct labels as well as hue, and `cvd.test.ts` checks the palette under protanopia, deuteranopia and tritanopia simulations.

## Extending it

[EXTENDING.md](EXTENDING.md) walks through adding a model, a figure kind and an essay. The visual rules are in [redesign/DESIGN.md](redesign/DESIGN.md), the prompt in [design/prompt.md](design/prompt.md), and the design notes for the samples in [figures/](figures/).

- Changing the prompt in `worker/plan/prompt.ts` means bumping `PROMPT_VERSION`, which also retires old cache entries.
- Changing the kit means running `pnpm build:kit` and committing `skills/explorable/kit/dist`. CI fails if the bundle is stale.
- Changing a sample or the kit's look means `pnpm build:examples` (and `pnpm build:pdf` for the PDFs).

## Where the tests live

- Unit tests sit next to the code as `*.test.ts(x)` and run with `pnpm test` (Vitest).
- Model tests check hand-computed fixtures. Figure and runtime tests use happy-dom.
- Worker tests use the fakes in `worker/testing.ts` and recorded pages in `worker/fixtures`. They assert, for example, that the model is called once.
- The skill has its own `node --test` suite in `skills/explorable/scripts`, and `audit.mjs` checks the worked examples.
- `scripts/repo-docs.test.ts` checks that the contributor docs link only to paths that exist.
- `pnpm smoke` and `pnpm e2e` drive a headless browser through the flows in `scripts/flows` (keyboard, axe, reduced motion, offline, CSP).
