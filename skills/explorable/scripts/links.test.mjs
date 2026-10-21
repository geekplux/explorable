// node --test skills/explorable/scripts/*.test.mjs (Node 20.10+, no deps)
// The skill's docs hold together: SKILL.md frontmatter parses, every file the docs
// name exists, every reference is linked from SKILL.md, and the evals are complete.
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const read = (p) => readFileSync(join(ROOT, p), 'utf8');
const REFS = readdirSync(join(ROOT, 'references')).filter((f) => f.endsWith('.md')).map((f) => `references/${f}`);
const DOCS = ['SKILL.md', 'README.md', ...REFS];

/**
 * The YAML subset a SKILL.md frontmatter needs: one `key: value` per line, values plain
 * or quoted. Rejects what full YAML would misread in a plain scalar (`: `, ` #`, a
 * leading indicator character) instead of guessing.
 */
function parseFrontmatter(text) {
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n/.exec(text);
  if (!m) throw new Error('no frontmatter: the file must start with a --- block');
  const out = {};
  for (const [i, line] of m[1].split(/\r?\n/).entries()) {
    if (!line.trim() || line.trimStart().startsWith('#')) continue;
    const kv = /^([A-Za-z][\w-]*):(?:\s+(.*))?$/.exec(line);
    if (!kv) throw new Error(`line ${i + 2}: expected "key: value", got ${JSON.stringify(line)}`);
    const [, key, raw = ''] = kv;
    if (key in out) throw new Error(`line ${i + 2}: duplicate key ${key}`);
    let value = raw.trim();
    const q = /^(["'])(.*)\1$/.exec(value);
    if (q) value = q[1] === '"' ? JSON.parse(value) : q[2].replaceAll("''", "'");
    else if (/^[[\]{}&*!|>'"%@`,?:-]/.test(value) || /:\s|\s#/.test(value)) {
      throw new Error(`line ${i + 2}: the value of ${key} needs quotes in YAML`);
    }
    out[key] = value;
  }
  return out;
}

/** Skill-relative paths a doc names: in links, inline code and code blocks. `~/.claude/skills/explorable/` is the skill root. */
function namedPaths(text) {
  const t = text.replaceAll('~/.claude/skills/explorable/', ' ');
  const paths = new Set();
  for (const [, target] of t.matchAll(/\]\(([^)\s]+)\)/g)) if (!/^(?:[a-z]+:|#)/i.test(target)) paths.add(target);
  for (const [, p] of t.matchAll(/(?<![\w./~-])(?:\.\/)?((?:kit|scripts|examples|references|evals)\/[\w.*/-]*)/g)) paths.add(p);
  for (const [, p] of t.matchAll(/`([\w-]+\.md)`/g)) paths.add(p);
  return [...paths].map((p) => p.replace(/[.,:;]+$/, ''));
}

/** Does `pattern` (relative to `base`, `*` within one segment) match at least one file or folder? */
function exists(base, pattern) {
  let found = [base];
  for (const seg of pattern.split('/').filter(Boolean)) {
    const re = new RegExp(`^${seg.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replaceAll('*', '[^/]*')}$`);
    found = found.flatMap((dir) => {
      if (!seg.includes('*')) return existsSync(join(dir, seg)) ? [join(dir, seg)] : [];
      try {
        return readdirSync(dir).filter((f) => re.test(f)).map((f) => join(dir, f));
      } catch {
        return [];
      }
    });
  }
  return found.length > 0;
}

describe('SKILL.md', () => {
  const text = read('SKILL.md');
  it('has frontmatter with name, description, license and compatibility', () => {
    const fm = parseFrontmatter(text);
    assert.deepEqual(Object.keys(fm).toSorted(), ['compatibility', 'description', 'license', 'name']);
    assert.equal(fm.name, 'explorable');
    assert.equal(fm.license, 'MIT');
    assert.match(fm.compatibility, /Node\.js 20\.10\+/);
    assert.ok(fm.description.length <= 1024, `description is ${fm.description.length} characters; keep it to 1024`);
  });
  it('has a trigger-rich description', () => {
    const { description } = parseFrontmatter(text);
    for (const phrase of ['interactive explainer', 'explorable explanation', 'make this paper or concept interactive', 'draggable figure', 'Bret Victor', 'Ciechanowski', 'blog post or docs', "even if they don't say explorable"]) {
      assert.ok(description.includes(phrase), `description lacks "${phrase}"`);
    }
  });
  it('leads with the one idea and stays under 200 lines', () => {
    assert.ok(text.split('\n').length <= 200, `${text.split('\n').length} lines`);
    assert.match(text, /One idea, one live model, and the reader's hand on the parameter that matters\./);
  });
  it('links every reference', () => {
    for (const ref of REFS) assert.ok(text.includes(`\`${ref}\``), `SKILL.md does not link ${ref}`);
  });
});

describe('the frontmatter parser', () => {
  it('rejects what YAML would misread', () => {
    assert.throws(() => parseFrontmatter('---\nname: a: b\n---\n'), /needs quotes/);
    assert.throws(() => parseFrontmatter('---\nname: x #y\n---\n'), /needs quotes/);
    assert.throws(() => parseFrontmatter('---\n  name: x\n---\n'), /expected "key: value"/);
    assert.throws(() => parseFrontmatter('# no frontmatter\n'), /no frontmatter/);
  });
  it('reads quoted values', () => {
    assert.deepEqual(parseFrontmatter(`---\na: "x: y"\nb: 'it''s'\n---\n`), { a: 'x: y', b: "it's" });
  });
});

describe('every file the docs name exists', () => {
  for (const doc of DOCS) {
    it(doc, () => {
      const paths = namedPaths(read(doc));
      const missing = paths.filter((p) => !exists(ROOT, p) && !exists(join(ROOT, dirname(doc)), p));
      assert.deepEqual(missing, [], `${doc} names missing files`);
    });
  }
  it('finds the paths it should', () => {
    assert.deepEqual(namedPaths('see `models.md`, [x](SKILL.md), node scripts/audit.mjs examples/a/b.json and ~/.claude/skills/explorable/kit/src but not docs/kit/x or /tmp/scripts/y'), [
      'SKILL.md', 'scripts/audit.mjs', 'examples/a/b.json', 'kit/src', 'models.md',
    ]);
    assert.ok(!exists(ROOT, 'references/nope.md') && exists(ROOT, 'scripts/*.test.mjs') && exists(ROOT, 'examples/*/'));
  });
});

describe('evals/evals.json', () => {
  const { skill_name: name, evals } = JSON.parse(read('evals/evals.json'));
  it('names the skill and has at least 6 evals with unique ids', () => {
    assert.equal(name, 'explorable');
    assert.ok(Array.isArray(evals) && evals.length >= 6, `${evals?.length} evals`);
    assert.equal(new Set(evals.map((e) => e.id)).size, evals.length);
  });
  it('every eval has a prompt, a checkable expected_output and files', () => {
    for (const e of evals) {
      assert.deepEqual(Object.keys(e).toSorted(), ['expected_output', 'files', 'id', 'prompt'], `eval ${e.id}`);
      assert.ok(typeof e.prompt === 'string' && e.prompt.length >= 40, `eval ${e.id}: prompt`);
      assert.ok(typeof e.expected_output === 'string' && e.expected_output.includes('audit passed'), `eval ${e.id}: expected_output must name the exact line \`audit passed\``);
      assert.ok(Array.isArray(e.files), `eval ${e.id}: files`);
      for (const f of e.files) assert.ok(existsSync(join(ROOT, f)), `eval ${e.id}: missing file ${f}`);
    }
  });
  it('covers the edge cases', () => {
    const all = evals.map((e) => `${e.prompt}\n${e.expected_output}`).join('\n');
    for (const [what, re] of [
      ['no registry model: expr-curve', /expr-curve/],
      ['3D request', /3D/],
      ['React project', /Explorable\.tsx/],
      ['PDF link', /\.pdf\b/],
      ['several ideas at once', /picks one idea/],
      ['colour-only encoding', /sets a colour/],
    ]) assert.match(all, re, `no eval covers: ${what}`);
  });
});

