STATE: DONE

explorable is **shipped and live** at https://explorable.geekplux.com. All 15 phases are merged to `main`. Cloudflare Workers Builds (Git integration) deploys `main` on every merge; nobody runs `wrangler deploy` by hand.

The October 2026 redesign (docs/redesign/PLAN.md, 8 stacked PRs) is built and **awaiting Sean's review**. Nothing is merged; merging the stack to `main` deploys it.

# Status

- Live: https://explorable.geekplux.com (`/api/health` → `{"ok":true,"ai":true,"kv":true}`)
- Production KV namespace `06957ddddaad40bb86bfa7df7b6edd75` is committed in `wrangler.jsonc` (`env.production`).
- Plan: docs/PLAN.md (15 phases, all done)
- Blockers: none

| Phase | Branch | PR | State |
|---|---|---|---|
| 1 | phase-1-toolchain-sample | https://github.com/geekplux/explorable/pull/1 | Merged |
| 2 | phase-2-design-system | https://github.com/geekplux/explorable/pull/2 | Merged |
| 3 | phase-3-kit-contracts | https://github.com/geekplux/explorable/pull/4 | Merged |
| 4 | phase-4-runtime-attention | https://github.com/geekplux/explorable/pull/5 | Merged |
| 5 | phase-5-bloom-bits | https://github.com/geekplux/explorable/pull/6 | Merged |
| 6 | phase-6-diffusion-histogram | https://github.com/geekplux/explorable/pull/7 | Merged |
| 7 | phase-7-curve-expr | https://github.com/geekplux/explorable/pull/8 | Merged |
| 8 | phase-8-worker-extract | https://github.com/geekplux/explorable/pull/9 | Merged |
| 9 | phase-9-worker-plan-cache | https://github.com/geekplux/explorable/pull/10 | Merged |
| 10 | phase-10-url-flow-ui | https://github.com/geekplux/explorable/pull/11 | Merged |
| 11 | phase-11-skill-build-audit | https://github.com/geekplux/explorable/pull/12 | Merged |
| 12 | phase-12-skill-docs-evals | https://github.com/geekplux/explorable/pull/13 | Merged |
| 13 | phase-13-oss-hygiene | https://github.com/geekplux/explorable/pull/14 | Merged |
| 14 | phase-14-readme-launch | https://github.com/geekplux/explorable/pull/15 | Merged |
| 15 | phase-15-deploy-prep | https://github.com/geekplux/explorable/pull/16 | Merged, deployed (KV id: #17) |

## Redesign 2026-10 (stacked PRs, each based on the previous branch)

| # | Branch | PR | State |
|---|---|---|---|
| 1 | redesign-1-tokens | https://github.com/geekplux/explorable/pull/22 | Open, awaiting review |
| 2 | redesign-2-logo-chrome | https://github.com/geekplux/explorable/pull/23 | Open, awaiting review |
| 3 | redesign-3-home | https://github.com/geekplux/explorable/pull/24 | Open, awaiting review |
| 4 | redesign-4-essay | https://github.com/geekplux/explorable/pull/26 | Open, awaiting review |
| 5 | redesign-5-notes | https://github.com/geekplux/explorable/pull/27 | Open, awaiting review |
| 6 | redesign-6-ai-plain | https://github.com/geekplux/explorable/pull/28 | Open, awaiting review |
| 7 | redesign-7-pdf | https://github.com/geekplux/explorable/pull/29 | Open, awaiting review |
| 8 | redesign-8-skill-docs | to be opened (skill, docs, README, social image) | Ready for review |

Redesign follow-ups:

- Check prompt p3 live with Workers AI on the PR 6 preview (only unit tests and fixtures have run it so far).
- Firefox and Safari print without the PDF running head (CSS page-margin boxes are Chromium-only); the essay prints the same otherwise.
- Delete the stale remote branch `redesign-1-foundation` (replaced by `redesign-1-tokens` and `redesign-2-logo-chrome`).
- After merge, upload `public/social-preview.png` as the repository's social preview (Settings → General).

## Open items

- Create issue labels `figure` and `sample` on GitHub (the issue forms apply them; `bug` exists by default).
- Review docs/LAUNCH.md drafts; nothing has been posted.

Last updated: 2026-10-24
