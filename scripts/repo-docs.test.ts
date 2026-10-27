// Repository hygiene: the GitHub issue forms parse and are well formed, CI lives in
// .github/workflows/ci.yml, and every
// relative link and repository path named in the contributor docs resolves.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';

type Yaml = string | number | boolean | null | Yaml[] | { [key: string]: Yaml };
type YamlMap = { [key: string]: Yaml };

const indent = (s: string) => s.length - s.trimStart().length;
const isItem = (s: string) => /^-(\s|$)/.test(s.trimStart());

/**
 * The YAML subset issue forms need: block maps and lists, `|` and `>` block scalars,
 * quoted and plain scalars and one-line `[a, b]` lists. Anything outside it, or a
 * plain scalar that full YAML would read differently, throws instead of guessing.
 */
function parseYaml(text: string): Yaml {
  const lines = text.replaceAll('\r', '').split('\n');
  let i = 0;
  const skip = () => {
    while (i < lines.length && (!lines[i]!.trim() || lines[i]!.trimStart().startsWith('#'))) i++;
  };
  const fail = (why: string): never => {
    throw new Error(`line ${i + 1}: ${why}`);
  };
  function scalar(raw: string): Yaml {
    const v = raw.replace(/\s+#.*$/, '').trim();
    if (v.startsWith('"')) return JSON.parse(v) as string;
    if (v.startsWith("'")) return /^'((?:[^']|'')*)'$/.exec(v)?.[1]?.replaceAll("''", "'") ?? fail('unterminated quote');
    if (v.startsWith('[')) return v.endsWith(']') ? v.slice(1, -1).split(',').map((s) => s.trim()).filter(Boolean).map(scalar) : fail('unterminated list');
    if (/^[{&*!|>%@`]/.test(v) || /:(\s|$)/.test(v)) fail(`quote this value: ${v}`);
    if (v === 'true' || v === 'false') return v === 'true';
    if (v === '' || v === 'null' || v === '~') return null;
    return /^-?\d+(\.\d+)?$/.test(v) ? Number(v) : v;
  }
  function blockScalar(parent: number, folded: boolean): string {
    const body: string[] = [];
    while (i < lines.length && (!lines[i]!.trim() || indent(lines[i]!) > parent)) body.push(lines[i++]!);
    const pad = Math.min(...body.filter((l) => l.trim()).map(indent));
    return body.map((l) => l.slice(pad)).join(folded ? ' ' : '\n').trim();
  }
  function node(at: number): Yaml {
    return isItem(lines[i]!) ? list(at) : map(at);
  }
  function list(at: number): Yaml[] {
    const out: Yaml[] = [];
    for (skip(); i < lines.length && indent(lines[i]!) === at && isItem(lines[i]!); skip()) {
      const rest = lines[i]!.trimStart().slice(1).trimStart();
      if (/^[\w-]+:(\s|$)/.test(rest)) {
        lines[i] = `${' '.repeat(at + 2)}${rest}`;
        out.push(map(at + 2));
      } else {
        out.push(scalar(rest));
        i++;
      }
    }
    return out;
  }
  function map(at: number): YamlMap {
    const out: YamlMap = {};
    for (skip(); i < lines.length && indent(lines[i]!) === at && !isItem(lines[i]!); skip()) {
      const m = /^([\w-]+):(?:\s+(.*))?$/.exec(lines[i]!.trim()) ?? fail('expected "key: value"');
      const [, key = '', value = ''] = m;
      if (Object.hasOwn(out, key)) fail(`duplicate key ${key}`);
      i++;
      if (/^[|>][+-]?$/.test(value)) out[key] = blockScalar(at, value.startsWith('>'));
      else if (value.trim()) out[key] = scalar(value);
      else {
        skip();
        const next = i < lines.length ? indent(lines[i]!) : -1;
        out[key] = next > at || (next === at && isItem(lines[i]!)) ? node(next) : null;
      }
    }
    if (i < lines.length && indent(lines[i]!) > at) fail('unexpected indentation');
    return out;
  }
  skip();
  const doc = i < lines.length ? node(indent(lines[i]!)) : null;
  skip();
  if (i < lines.length) fail('unexpected content');
  return doc;
}

const FORMS = '.github/ISSUE_TEMPLATE';
const asMap = (v: Yaml | undefined): YamlMap => (v && typeof v === 'object' && !Array.isArray(v) ? v : {});
const list = (v: Yaml | undefined): Yaml[] => (Array.isArray(v) ? v : []);

/** What GitHub would reject in an issue form's `body`, as readable strings. */
function formProblems(body: YamlMap[]): string[] {
  const out: string[] = [];
  const ids = new Set<string>();
  for (const [i, field] of body.entries()) {
    const attrs = asMap(field.attributes);
    const where = `body[${i}] (${String(field.id ?? field.type)})`;
    if (!['markdown', 'textarea', 'input', 'dropdown', 'checkboxes'].includes(String(field.type))) out.push(`${where}: unknown type`);
    if (field.type === 'markdown') {
      if (typeof attrs.value !== 'string') out.push(`${where}: markdown needs attributes.value`);
      continue;
    }
    const id = String(field.id);
    if (!/^[a-z0-9_-]+$/.test(id)) out.push(`${where}: bad id`);
    if (ids.has(id)) out.push(`${where}: duplicate id`);
    ids.add(id);
    if (typeof attrs.label !== 'string') out.push(`${where}: needs attributes.label`);
    const options = list(attrs.options);
    if (field.type === 'dropdown' && (!options.length || !options.every((o) => typeof o === 'string'))) out.push(`${where}: dropdown options must be strings`);
    if (field.type === 'checkboxes' && (!options.length || !options.every((o) => typeof asMap(o).label === 'string'))) out.push(`${where}: checkbox options need labels`);
  }
  return out;
}

describe('parseYaml', () => {
  it('reads the subset and rejects what YAML would misread', () => {
    expect(parseYaml('a: 1\nb:\n  - x: "q: r"\n    y: [one, two]\n  - plain\nc: |\n  line 1\n\n  line 2\n')).toEqual({
      a: 1, b: [{ x: 'q: r', y: ['one', 'two'] }, 'plain'], c: 'line 1\n\nline 2',
    });
    expect(() => parseYaml('a: b: c\n')).toThrow(/quote this value/);
    expect(() => parseYaml('a: 1\n    b: 2\n')).toThrow(/unexpected indentation/);
    expect(() => parseYaml('a: 1\na: 2\n')).toThrow(/duplicate key/);
  });
});

describe('GitHub issue forms', () => {
  const files = readdirSync(FORMS).filter((f) => f.endsWith('.yml')).toSorted();

  it('has the bug, figure and sample forms plus config.yml', () => {
    expect(files).toEqual(['bug_report.yml', 'config.yml', 'figure_request.yml', 'sample_request.yml']);
  });

  it.each(files.filter((f) => f !== 'config.yml'))('%s is a valid issue form', (file) => {
    const form = asMap(parseYaml(readFileSync(join(FORMS, file), 'utf8')));
    expect([typeof form.name, typeof form.description]).toEqual(['string', 'string']);
    const body = Array.isArray(form.body) ? form.body.map(asMap) : [];
    expect(body.length).toBeGreaterThan(1);
    expect(formProblems(body)).toEqual([]);
  });

  it('config.yml disables blank issues and links security reports to private advisories', () => {
    const config = asMap(parseYaml(readFileSync(join(FORMS, 'config.yml'), 'utf8')));
    expect(config.blank_issues_enabled).toBe(false);
    const links = list(config.contact_links).map(asMap);
    expect(links.length).toBeGreaterThan(0);
    for (const link of links) expect([typeof link.name, typeof link.about, String(link.url).startsWith('https://')]).toEqual(['string', 'string', true]);
    expect(links.some((l) => String(l.url).endsWith('/security/advisories/new'))).toBe(true);
  });

  it('CI lives in .github/workflows/ci.yml, and the old ci/ copy is gone', () => {
    expect(existsSync('.github/workflows/ci.yml')).toBe(true);
    expect(existsSync('ci')).toBe(false);
  });
});

const DOCS = [
  'README.md', 'examples/README.md', 'CONTRIBUTING.md', 'CODE_OF_CONDUCT.md', 'SECURITY.md', 'CHANGELOG.md',
  'docs/ARCHITECTURE.md', 'docs/EXTENDING.md', 'docs/GOOD_FIRST_ISSUES.md', 'docs/DEPLOY.md', '.github/pull_request_template.md',
];
const clean = (p: string) => p.replace(/#.*$/, '');
/** Paths that are linked before their file exists. Remove an entry once the file is added. */
const PENDING: string[] = [];
/** Relative link and image targets (markdown or `src`/`href` attributes, resolved from the doc's folder) and repository paths in inline code (from the root). */
function namedPaths(doc: string): string[] {
  const text = readFileSync(doc, 'utf8');
  const links = [...text.matchAll(/\]\(([^)\s]+)\)|\b(?:src|href)="([^"]+)"/g)].map((m) => (m[1] ?? m[2])!).filter((t) => !/^(?:[a-z]+:|#)/i.test(t));
  const code = [...text.matchAll(/`((?:\.github|ci|docs|scripts|skills|src|worker)\/[^`\s]*)`/g)].map((m) => m[1]!);
  // Skip templates such as `models/<id>.ts`, globs, and the files EXTENDING.md's worked examples create.
  const created = /\/(?:coin-flips|meter|tanh)\.[\w.]+$/;
  return [...links.map((p) => join(dirname(doc), clean(p))), ...code.map(clean)].filter((p) => p && !/[<*{]/.test(p) && !created.test(p));
}

describe('contributor docs', () => {
  it.each(DOCS)('%s exists and every relative link and named path resolves', (doc) => {
    const missing = namedPaths(doc).filter((p) => !existsSync(p) && !PENDING.includes(p));
    expect(missing).toEqual([]);
  });

  it('DEPLOY.md has the anchors the app and README link to, and names the committed production KV id', () => {
    const deploy = readFileSync('docs/DEPLOY.md', 'utf8');
    expect(deploy).toMatch(/^## Self-host without AI$/m); // #self-host-without-ai (src/components/states/ErrorState.tsx)
    expect(deploy).toContain('pnpm build:prod && pnpm exec wrangler deploy');
    const id = /"binding": "EXPLORABLE_CACHE", "id": "([0-9a-f]{32})"/.exec(readFileSync('wrangler.jsonc', 'utf8'))?.[1];
    expect(id).toBe('06957ddddaad40bb86bfa7df7b6edd75');
    expect(deploy).toContain(id);
  });

  it('pending paths are still missing (drop them from PENDING once they exist)', () => {
    expect(PENDING.filter((p) => existsSync(p))).toEqual([]);
  });

  it('README leads with the pitch, the hero image and the quick start', () => {
    const headings = readFileSync('README.md', 'utf8').split('\n').filter((l) => l.startsWith('## '));
    const top = readFileSync('README.md', 'utf8').split('## ')[0]!;
    expect(top).toContain('docs/assets/hero.webp');
    expect(top).toContain('Live demo: https://explorable.geekplux.com');
    expect(headings[0]).toBe('## Quick start');
  });

  it('the README hero is a WebP within its size budget', () => {
    const webp = readFileSync('docs/assets/hero.webp');
    expect([webp.subarray(0, 4).toString(), webp.subarray(8, 12).toString()]).toEqual(['RIFF', 'WEBP']);
    expect(webp.length).toBeLessThan(200 * 1024);
  });

  it('the social preview (for the repository setting) is a 1280 × 640 PNG', () => {
    const png = readFileSync('public/social-preview.png');
    expect(png.subarray(1, 4).toString()).toBe('PNG');
    expect(png.length).toBeLessThan(1024 * 1024);
    expect([png.readUInt32BE(16), png.readUInt32BE(20)]).toEqual([1280, 640]);
  });

  it('the link-preview card is a JPEG og:image with the same card moving as og:video', () => {
    const jpg = readFileSync('public/og.jpg');
    expect(jpg.readUInt16BE(0)).toBe(0xffd8);
    expect(jpg.length).toBeLessThan(300 * 1024);
    expect(readFileSync('public/og.mp4').length).toBeLessThan(1024 * 1024);
    const html = readFileSync('index.html', 'utf8');
    expect(html).toContain('<meta property="og:image" content="https://explorable.geekplux.com/og.jpg" />');
    expect(html).toContain('<meta property="og:video" content="https://explorable.geekplux.com/og.mp4" />');
    expect(html).toContain('<meta property="og:video:type" content="video/mp4" />');
    expect(html).toContain('<meta name="twitter:card" content="summary_large_image" />');
  });

  it('LICENSE is MIT with the project copyright line', () => {
    const text = readFileSync('LICENSE', 'utf8');
    expect(text).toMatch(/^MIT License/);
    expect(text).toContain('Copyright (c) 2026 geekplux and explorable contributors');
  });
});
