# Redesign 2026-10: plan

Spec: [DESIGN.md](DESIGN.md). Targets: [target/](target/). Requested by Sean on 2026-10-24.

Eight stacked PRs. Each branch starts from the previous one; each PR's base is the previous branch, so they review in order. Nothing merges until Sean reviews; merging to `main` deploys (Workers Builds).

| # | Branch | What |
|---|---|---|
| 1 | `redesign-1-tokens` | Radix tokens light + dark, fonts |
| 2 | `redesign-2-logo-chrome` | Spiral logo, header, footer, Made by GeekPlux |
| 3 | `redesign-3-home` | Home: hero with live figure, essay index, how it works, plain copy |
| 4 | `redesign-4-essay` | Essay layout, gutter contents, italic variables, figure chrome, motion |
| 5 | `redesign-5-notes` | ExplorableDoc v2 notes, math and source markers, samples rewritten in plain words |
| 6 | `redesign-6-ai-plain` | Prompt p3, Worker schema + post-process, reading-level flag |
| 7 | `redesign-7-pdf` | PDF button, print stylesheet, pre-rendered sample PDFs |
| 8 | `redesign-8-skill-docs` | Skill, references, evals, examples, README, social image, CHANGELOG |

Phase 1 of the acceptance list below was split into PRs 1 and 2 to keep each near the line budget; from "Phase 2" on, phase n is PR n + 1.

## Conventions for every phase

- Line budget about 400 changed lines, excluding lockfiles, fonts and other binaries, sample JSON, generated `kit/dist`, built examples, screenshots and docs under `docs/redesign/`.
- Every phase: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, and `pnpm build:kit` when the kit changed (the committed `kit/dist` must match). The headless browser suite runs once, at the end, for the flows the phase touched.
- Two review rounds (verify, fix, verify, fix), then stop.
- One or two before/after screenshots at 1440 light as WebP in `docs/screenshots/redesign-<PR number>/` for the PR.
- Never deploy, never merge, never push to `main`, never edit `.claude/settings.json`, never commit secrets, no company names beyond tools, services and cited sources, nothing finance-related.

## Phase 1: foundation

Goal: the new identity everywhere it is global.

Acceptance:
1. `tokens.css` holds the Radix sand, indigo and orange scales (light and dark via `prefers-color-scheme`), the role tokens of DESIGN §2 (`--bg`, `--handle`, lines, text), type and motion tokens; old names alias to Radix values; no other colour literals in `src/styles` or `kit/src/styles` (except the logo).
2. `palette.ts` and `cvd.test.ts` updated; tests assert indigo vs orange separation under protanopia, deuteranopia and tritanopia and the contrast floors (text ≥ 4.5:1 on sand-1 and dark sand-1, handle ≥ 3:1).
3. Source Serif 4 (roman + italic), Geist and Geist Mono self-hosted woff2 (Latin), OFL text kept; Fraunces and Newsreader removed; smoke checks updated to the new families; the Greek/Math fallback still renders √, Σ, ∂, α.
4. Spiral logo per DESIGN §3: a `Logo` component (sizes, wide crop, unique gradient ids), header and footer lockups, `public/favicon.svg`, `src/assets/mark.svg`; header mark ≤ 4 KB.
5. Header on every route (including home) with nav; Made by GeekPlux block and the new footer on every route; no "·" anywhere in `src/`; "All explorables" back links removed.
6. Dark theme renders with no hard-coded light colours left (checked on home and an essay).

## Phase 2: home

Acceptance:
1. Home matches `target/Home.webp` (desktop), `HomePhone.webp` (390) and `HomeDark.webp` in structure and copy (DESIGN §5).
2. The hero figure is live (kit mount of the attention sample's temperature figure), keyboard operable, readout updates, links to the essay.
3. Essay index replaces sample cards; thumbnails regenerated in the new style by a script; rows are single links with visible focus.
4. URL field behaviour unchanged (existing tests pass; label text updated).
5. Hover or focus on a row plays its thumbnail once (handle sweeps and returns, 600ms); nothing on touch or reduced motion.
6. axe: no violations on `/` light and dark.

## Phase 3: essay

Acceptance:
1. Essay pages match `target/Essay.webp` and `EssayPhone.webp` (DESIGN §6) for all three samples and for `/x?url=` results.
2. No kicker, no "Fig. n", no separate provenance line; AI essays carry "Written by AI from the source." in the byline.
3. Gutter contents ported from geekplux.com Toc.tsx: progress fill via scroll timeline, bracket over sections in view, 3px shift, 250ms; hidden below 1160px; reduced motion: bracket jumps, fill static.
4. Italic variables via the kit inline formatter (unit tests for `d_k`, lone single letters, no false positives in ordinary words such as "a", "I", "T-shirt").
5. Figure chrome restyled in `kit.css` (title, hairlines, readout, "Show data", switch, slider with orange handle); a dragged figure eases bars in 250ms, readouts change instantly.
6. Title view transition from the index into the essay (same-document `startViewTransition` in the router; no-op where unsupported); figures below the fold enter once (fade, 0.985 → 1, 250ms).
7. Loading, error and not-found states use the new tokens.

## Phase 4: notes

Acceptance:
1. Kit schema accepts v1 and v2 (DESIGN §9); unknown note ids, >1 math marker per paragraph and duplicate ids fail validation with clear messages.
2. `essayHtml` renders math markers and note panels, source labels and cards, all escaped; behaviour (toggle, Esc, focus, `aria-expanded`) wired in the kit runtime so the skill output works without React.
3. The three samples rewritten as v2 in plain words: no formula in body text; formulas moved into math notes with glosses; the attention sample matches the board text (DESIGN §7 and `target/Essay.html`).
4. A shared `bodyHasFormula()` check in the kit, used by tests and the skill audit.
5. The skill's `spec-format.md` and audit accept v2.

## Phase 5: AI in plain words

Acceptance:
1. Prompt p3 per DESIGN §9; `PROMPT_VERSION = 'p3'`.
2. Worker plan schema and `assemble` produce v2 docs with notes; JSON Schema for Workers AI regenerated.
3. Deterministic post-process: formulas left in body moved into math notes; citations of the source become a source note; result always validates.
4. Reading-level flag (Flesch–Kincaid grade) computed and logged; unit-tested.
5. Fixtures in `worker/fixtures/ai` updated; all Worker tests pass; no retries added.

## Phase 6: PDF

Acceptance:
1. PDF button in the byline row; samples download `public/pdf/<slug>.pdf`; other essays call `window.print()`.
2. Print stylesheet per DESIGN §8 and `target/Print.webp`: A4, running head, no chrome, figures in their current state with the state line and link, notes only if open.
3. `pnpm build:pdf` renders the sample PDFs with headless Chromium from the built site; committed PDFs each ≤ 600 KB.
4. The service worker precaches nothing new beyond what the size budget allows (`pnpm check:size` passes).

## Phase 7: skill and docs

Acceptance:
1. `skills/explorable` SKILL.md, `references/writing.md` (plain-words voice, notes), `spec-format.md` (v2), examples rebuilt, `evals/evals.json` gains at least two evals for plain words and notes; `node --test` and the audit pass.
2. README: new pitch, hero screenshot, copy matching the site.
3. Social image regenerated with the new identity.
4. `docs/design/identity.md` marked superseded by this spec; CHANGELOG entry; DECISIONS rows for the redesign.
