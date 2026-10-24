# React

`kit/react/Explorable.tsx` renders a doc in a React app: the static, escaped essay HTML from `essayHtml(doc)`, then live figures mounted by `hydrateFigures` in an effect and torn down on unmount. It is the same code path the standalone page uses, and the same component the explorable web app renders its essays with.

Use it when the user's project is React (Vite or any bundler that handles TypeScript and CSS imports). For a static site, a blog or docs that take plain HTML, ship the page from `build.mjs` instead.

## Set up

From the React project's root, with the skill installed at `~/.claude/skills/explorable`:

```sh
mkdir -p src/explorable && cp -R ~/.claude/skills/explorable/kit/src ~/.claude/skills/explorable/kit/react src/explorable/
find src/explorable -name '*.test.ts' -delete
find src/explorable -name __snapshots__ -type d -prune -exec rm -rf {} +
npm install valibot
```

Keep `src/` and `react/` side by side: `Explorable.tsx` imports `../src/…`. The kit's only runtime dependency is `valibot` (the schema); React is the app's own. The tests are removed because some of them read the skill's examples and would not resolve inside your project.

The kit imports its modules with `.ts` extensions and uses ES2023 array methods, so `tsconfig` needs `"allowImportingTsExtensions": true` (with `"noEmit": true`) and `"lib": ["ES2023", "DOM", "DOM.Iterable"]`. Vite's React TypeScript template already sets the first.

## Use

Write and audit the spec as usual (steps 1–3 and 5 of the workflow; `audit.mjs` on the JSON also checks the page it would build). Then:

```tsx
import spec from './cooling.explorable.json';
import { parseDoc } from './explorable/src/doc/schema.ts';
import { Explorable } from './explorable/react/Explorable.tsx';
import './explorable/src/styles/tokens.css';
import './explorable/src/styles/kit.css';

const parsed = parseDoc(spec);
if (!parsed.ok) throw new Error(parsed.errors.join('\n'));
const doc = parsed.doc;

export function CoolingExplainer() {
  return <Explorable doc={doc} className="essay-host" />;
}
```

- **Validate first.** `Explorable` trusts its `doc`. `parseDoc` returns `{ ok: true, doc }` or `{ ok: false, errors }` with the same messages `build.mjs` prints.
- **Keep `doc` and `options` stable.** The effect re-hydrates when either changes identity, so parse at module scope or in `useMemo`, and do not pass an inline `options={{ … }}` object.
- **CSS.** `tokens.css` holds the palette and type tokens and `kit.css` the essay and figure styles. The app's page CSS (fonts, a global reduced-motion rule) is yours to add; the figures already skip easing under reduced motion.
- **Server rendering.** `essayHtml` is a pure string function, so the essay renders on the server; the figures go live in the browser when the effect runs.

## Check it

Audit the JSON (`node ~/.claude/skills/explorable/scripts/audit.mjs src/cooling.explorable.json` must end `audit passed`), then open the app and go through the review checklist in `verify.md`.
