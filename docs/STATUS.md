STATE: DONE

explorable is **shipped and live** at https://explorable.geekplux.com. All 15 phases are merged to `main`. Cloudflare Workers Builds (Git integration) deploys `main` on every merge; nobody runs `wrangler deploy` by hand.

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

## Open items

- Move `ci/github-workflow.yml` to `.github/workflows/` (needs a token with `workflow` scope).
- Upload the social preview image in GitHub repo settings (manual).
- Create issue labels `figure` and `sample` on GitHub (the issue forms apply them; `bug` exists by default).
- Review docs/LAUNCH.md drafts; nothing has been posted.

Last updated: 2026-10-21
