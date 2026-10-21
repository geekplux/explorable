# Deploying explorable

explorable is one Cloudflare Worker with Static Assets: the built app in `dist/client`, the API in `worker/`, a KV namespace for the cache, Workers AI for the one plan call per new link, and a rate limiter. Local development (`pnpm dev`, `pnpm preview`, the tests and the harness) never needs any of this.

The local config at the top of `wrangler.jsonc` is safe by design: no AI, a simulated KV namespace, debug routes on. Deploys use the `env.production` block instead, which `pnpm build:prod` bakes into `dist/explorable/wrangler.json`.

## Prerequisites

- Node 22.12 or newer and pnpm 9 (`corepack enable`), then `pnpm install`.
- A Cloudflare account. Workers AI, KV and rate limiting are all available on the free plan; see the cost note below.
- No secrets: Workers AI is a binding, so there is no API key to store.

## One-time setup

1. Log in: `pnpm exec wrangler login`.
2. Create the cache namespace: `pnpm exec wrangler kv namespace create EXPLORABLE_CACHE`. It prints an `id`.
3. Paste that id into `wrangler.jsonc`, under `env.production.kv_namespaces`, in place of `REPLACE_WITH_KV_ID`. If wrangler offers to edit the config for you, check that the id lands in `env.production` and not at the top level. The id is not a secret, so it can be committed.
4. Optional: change `AI_MODEL` in `env.production.vars` (default `@cf/meta/llama-3.3-70b-instruct-fp8-fast`). Leave `EXPLORABLE_DEBUG` at `"0"`; `"1"` exposes the raw `/api/extract` debug route.

## Check, then deploy

Build for production and do a dry run first. The dry run bundles everything and lists the bindings, but uploads nothing:

```sh
pnpm build:prod
pnpm run check:deploy
```

The binding list should show `EXPLORABLE_CACHE` (with your id), `AI`, `EXPLAIN_LIMITER (10 requests/60s)`, `ASSETS`, `AI_MODEL` and `EXPLORABLE_DEBUG ("0")`. The dry-run bundle goes to `.wrangler/dry-run/`, which git ignores.

Then deploy:

```sh
pnpm build:prod && pnpm exec wrangler deploy
```

Always run `pnpm build:prod` right before deploying. `wrangler deploy` uses whatever the last build wrote to `dist/` (via `.wrangler/deploy/config.json`), and a plain `pnpm build` writes the local config, which has debug routes on and a fake KV id.

The Worker is named `explorable-production` (wrangler appends the environment name), so it is served at `https://explorable-production.<your-subdomain>.workers.dev` until you add a custom domain. Check it with `curl https://<host>/api/health`, which should return `{"ok":true,"ai":true,"kv":true}`.

What ships with it:

- `public/_headers` sets a strict Content-Security-Policy (`'self'` only, nothing inline, no `unsafe-eval`), `X-Content-Type-Options: nosniff`, a `Referrer-Policy`, `no-cache` for pages and a one-year `immutable` cache for the hashed files in `/assets/`. The Worker sets its own security headers on `/api/*`.
- `dist/client/sw.js`, written by `scripts/gen-sw.mjs`, precaches the app, the samples and the fonts so they reload offline. Its cache name is a hash of the build, so a new deploy replaces the old cache on the next visit. It never caches `/api/*`.

## Rollback

List recent versions, then roll back to the previous one (or to a version id from the list):

```sh
pnpm exec wrangler deployments list --name explorable-production
pnpm exec wrangler rollback --name explorable-production
pnpm exec wrangler rollback <version-id> --name explorable-production
```

A rollback does not touch KV. Cache keys include the prompt and schema version, so a Worker from before a prompt change reads only its own entries.

## Self-host without AI

The app is fully useful without Workers AI, and then it costs no AI calls at all:

1. Delete the `"ai": { "binding": "AI" }` line from `env.production` in `wrangler.jsonc`.
2. Set up KV as above (or delete the `kv_namespaces` entry too; the Worker then runs without a cache).
3. Deploy with the same command.

Without a model the built-in samples, the search and the keyword match mode all work. A pasted link that matches a sample (for example `https://arxiv.org/abs/1706.03762`) gets that sample's essay with the article's real title and authors. Any other link shows the extracted title and abstract with an "AI unavailable" note and a link back to this section. `/api/health` reports `"ai":false`.

## Cost note

- **One AI call per new link, at most.** A sample, a cached link, a keyword match, or a link that fails before planning (blocked, unreachable, too short) costs no AI call. There are no retries.
- **KV cache.** A finished doc is cached for 30 days and most errors for 10 minutes (never rate-limit or internal errors), keyed by the canonical URL, so a link shared widely is planned once. Each explain reads two KV keys (doc and error) and, on a miss, writes at most one.
- **Rate limit.** `EXPLAIN_LIMITER` allows 10 uncached explains per client IP per minute; cache hits are never limited. Over the limit the API answers `429 RATE_LIMITED` and the app says to wait a minute.
- **Static assets** are served by Cloudflare and do not run the Worker; only `/api/*` does.

Workers AI is billed by usage beyond a daily free allocation; check Cloudflare's current Workers AI and KV pricing pages for your plan before a public launch.
