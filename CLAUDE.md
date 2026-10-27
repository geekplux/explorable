# CLAUDE.md: maintainer guide

Explorable turns an arXiv paper or blog post into a short essay in plain words with draggable figures whose numbers come from a real model of the idea. It is live at https://explorable.geekplux.com and ships the same figure kit as an agent skill, `/explorable`, in `skills/explorable/`. How the parts fit together: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Stack and commands

React 19 + Vite (Rolldown), TypeScript, Vitest, oxlint, pnpm. One Cloudflare Worker with Static Assets; Workers AI and KV in production.

```sh
pnpm dev                 # Vite dev server (the Worker runs in workerd, no login)
pnpm check               # lint + typecheck + test
pnpm build               # app build plus the service worker
pnpm check:size          # bundle budget (after a build)
pnpm build:kit           # rebuild skills/explorable/kit/dist; commit it
pnpm build:examples      # rebuild examples/; commit it
pnpm build:images        # README hero and social preview
pnpm build:pdf           # sample PDFs in public/pdf/
pnpm smoke / pnpm e2e    # headless-browser flows (scripts/flows)
pnpm check:skill-page    # check a standalone skill page in a browser
pnpm types:worker        # regenerate worker-configuration.d.ts
pnpm build:prod && pnpm run check:deploy   # production build and a wrangler dry run
```

Skill checks, as CI runs them: `node --test skills/explorable/scripts/*.test.mjs` and `node skills/explorable/scripts/audit.mjs <spec or page>` on each example (ends in `audit passed`).

## Rules

- Web UI is pure React + Vite on the VoidZero toolchain (Vite, Vitest, oxlint, Rolldown). No Next.js, no Remix, no other meta-framework. Package manager: pnpm.
- Anything deployed runs on Cloudflare. Deployment happens only through Workers Builds on merge to `main`. Never run `wrangler deploy`; the dry run `pnpm run check:deploy` is fine and should pass before every PR.
- `.claude/settings.json` denies `wrangler deploy`, `wrangler pages deploy`, `pnpm run deploy`, `gh pr merge`, `gh stack merge` and force pushes to `main`. Do not work around it or edit it.
- Never merge PRs; maintainers merge on GitHub.
- Never commit secrets. Local secrets go in `.dev.vars` (gitignored); deployed ones via `wrangler secret put`.
- Accessibility: never colour alone, palettes pass protanopia, deuteranopia and tritanopia checks, everything is keyboard operable, and reduced motion is respected.
- No decorative 3D. Nothing finance-related.
- No company names in project content, samples, docs, commits or PRs, apart from tools, services and cited sources.
- Keep CI (`.github/workflows/ci.yml`) in step with the checks contributors run locally.
- Lean AI: deterministic code first, at most one model call per uncached link, results cached in KV, and a site-wide daily cap (`DAILY_AI_CAP=100`).
- Built-in samples work offline and without any key.
- Keep the skill's anatomy: `SKILL.md`, `kit/`, `references/`, `examples/`, `scripts/` (audit and tests) and `evals/evals.json`.
- Visual rules live in `docs/redesign/DESIGN.md`; the prompt is described in `docs/design/prompt.md`. Changing the prompt means bumping `PROMPT_VERSION`.
