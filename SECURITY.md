# Security policy

## Reporting a vulnerability

Please report privately, not in a public issue: open the repository's **Security** tab and choose **Report a vulnerability**. That starts a private GitHub security advisory with the maintainers. Include the input that triggers the problem (a URL, a spec or an expression), what happened and what you expected.

We aim to acknowledge a report within 7 days, and to agree on a fix and a disclosure date with you before anything is published. Fixes land on `main`; there are no separately maintained release branches yet.

## Scope

The parts of explorable that take untrusted input:

| Area | Code | What it must guarantee |
|---|---|---|
| Worker fetch and SSRF guard | `worker/url.ts`, `worker/fetch.ts` | Only public `http(s)` URLs are fetched. Private, loopback, link-local and reserved addresses (including decimal and hex IPv4 forms) and local host names are refused, and IPv6 literals are refused outright, on the pasted URL and on every redirect. At most 3 redirects, 10 s and 3 MB per fetch. |
| Article extraction | `worker/extract/` | Page HTML is parsed, never executed, and only plain text reaches the plan. |
| Expression evaluator | `skills/explorable/kit/src/expr/` | An `expr-curve` formula is lexed, parsed and compiled to closures over a fixed list of functions and constants. No `eval`, no `Function`, no property access; at most 200 characters and nesting depth 32. |
| AI plan assembly | `worker/plan/` | The one model reply is validated against a strict schema, clamped to model ranges, its expressions validated, and the result must pass `parseDoc`. Text is cleaned of control characters and escaped by the essay renderer. |
| Essay rendering | `skills/explorable/kit/src/doc/` | Every string is escaped; links must be `http(s)`. |

Out of scope: the cost of Workers AI calls on your own deployment (there is a per-address limit on new links; tune it for yours), and findings that need a malicious local `.dev.vars` or a modified build.

A known limit: a host name that resolves to a private address through DNS cannot be checked before the fetch inside a Worker. In production, the Workers runtime itself refuses private destinations.
