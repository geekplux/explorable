# /explorable

An agent skill that turns one idea into a short read in plain words, with figures you can drag. Formulas and sources wait behind small notes. It writes a single HTML file that works offline, and every number on the page comes from a real model. It needs Node.js 20.10+ and nothing else.

Install it and build the Bloom filter example in one command:

```sh
npx degit geekplux/explorable/skills/explorable ~/.claude/skills/explorable && \
node ~/.claude/skills/explorable/scripts/build.mjs ~/.claude/skills/explorable/examples/bloom-filter/explorable.json
```

Open `~/.claude/skills/explorable/examples/bloom-filter/index.html` in a browser and drag. Then, in Claude Code, ask: `/explorable explain how a Bloom filter trades memory for false positives`.

Check the install with `node --test ~/.claude/skills/explorable/scripts/*.test.mjs`. How the skill works is in [SKILL.md](SKILL.md).
