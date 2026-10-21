// node --test skills/explorable/scripts/*.test.mjs (Node 20.10+, no deps)
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { buildPage, inlineKit } from './build.mjs';

const here = (p) => fileURLToPath(new URL(p, import.meta.url));
const BUILD = here('./build.mjs');
const SPEC = here('../examples/newton-cooling/explorable.json');
const newton = () => JSON.parse(readFileSync(SPEC, 'utf8'));
const tmp = mkdtempSync(join(tmpdir(), 'explorable-build-'));
after(() => rmSync(tmp, { recursive: true, force: true }));
const cli = (...args) => spawnSync(process.execPath, [BUILD, ...args], { encoding: 'utf8' });

describe('buildPage', () => {
  const html = buildPage(newton());
  it('is deterministic', () => assert.equal(buildPage(newton()), html));
  it('has lang, title, one main landmark, the essay and a CSP', () => {
    assert.match(html, /^<!doctype html>\n<html lang="en">/);
    assert.match(html, /<title>Why coffee cools fast, then slowly<\/title>/);
    assert.equal(html.match(/<main\b/g).length, 1);
    assert.match(html, /<main id="explorable"><article class="essay" data-doc="newton-cooling">/);
    assert.match(html, /http-equiv="Content-Security-Policy" content="default-src 'none'; .*script-src 'sha256-/);
  });
  it('inlines the Newsreader font unless fonts are off', () => {
    assert.match(html, /@font-face\{font-family:Newsreader;src:url\(data:font\/woff2;base64,/);
    const lean = buildPage(newton(), { fonts: false });
    assert.doesNotMatch(lean, /@font-face/);
    assert.ok(html.length - lean.length > 50_000, 'the font is the bulk of the difference');
  });
  it('has no network references and no inline style attributes', () => {
    const markup = html.replace(/(<script\b[^>]*>)[\s\S]*?<\/script>/g, '$1</script>');
    assert.doesNotMatch(markup, /\s(src|href)=/);
    assert.doesNotMatch(markup, /\sstyle=/);
  });
  it('keeps hostile doc text inert', () => {
    const doc = newton();
    doc.title = '</title><script>alert(1)</script>';
    doc.sections[0].paragraphs[0] = '</script><img src=x onerror=alert(1)> and <!-- a comment';
    const page = buildPage(doc, { fonts: false });
    assert.equal(page.match(/<script\b/g).length, 2, 'only the data block and the kit script');
    assert.doesNotMatch(page, /<img\b/);
    assert.match(page, /<title>&lt;\/title&gt;&lt;script&gt;alert\(1\)&lt;\/script&gt;<\/title>/);
    const data = /<script type="application\/json" id="explorable-doc">([\s\S]*?)<\/script>/.exec(page)[1];
    assert.deepEqual(JSON.parse(data), doc);
  });
  it('the committed example pages are fresh', () => {
    for (const name of ['bloom-filter', 'newton-cooling']) {
      const spec = JSON.parse(readFileSync(here(`../examples/${name}/explorable.json`), 'utf8'));
      assert.equal(buildPage(spec), readFileSync(here(`../examples/${name}/index.html`), 'utf8'), `${name}: run build.mjs on it`);
    }
  });
});

describe('inlineKit', () => {
  it('turns the trailing export list into one object', () => {
    assert.equal(inlineKit('const a=1,b=2;export{a as one,b};'), 'const a=1,b=2;const explorableKit={one:a,b:b};');
  });
  it('refuses a bundle without a trailing export list', () => {
    assert.throws(() => inlineKit('module.exports = {}'), /pnpm build:kit/);
  });
});

describe('build.mjs CLI', () => {
  it('writes --out and reports the next step', () => {
    const out = join(tmp, 'page.html');
    const r = cli(SPEC, '--out', out);
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stdout, /wrote .*page\.html \(\d+\.\d KB\)\nnext: node .*audit\.mjs/);
    assert.equal(readFileSync(out, 'utf8'), buildPage(newton()));
  });
  it('--no-fonts writes a smaller page', () => {
    const out = join(tmp, 'lean.html');
    assert.equal(cli(SPEC, '--no-fonts', '--out', out).status, 0);
    assert.ok(statSync(out).size < statSync(join(tmp, 'page.html')).size - 50_000);
  });
  it('writes index.html beside the spec by default', () => {
    const spec = join(tmp, 'explorable.json');
    writeFileSync(spec, JSON.stringify(newton()));
    assert.equal(cli(spec).status, 0);
    assert.ok(existsSync(join(tmp, 'index.html')));
  });
  it('rejects an invalid spec with numbered schema errors and writes nothing', () => {
    const doc = newton();
    doc.sections[1].figure.alt = 'too short';
    delete doc.title;
    const spec = join(tmp, 'bad', 'explorable.json');
    mkdirSync(join(tmp, 'bad'));
    writeFileSync(spec, JSON.stringify(doc));
    const r = cli(spec);
    assert.equal(r.status, 1);
    assert.match(r.stderr, /^build failed:\n1\. title: is required\n2\. sections\[1\]\.figure\.alt: must be at least 40 characters/);
    assert.ok(!existsSync(join(tmp, 'bad', 'index.html')));
  });
  it('rejects bad arguments and unreadable JSON', () => {
    assert.match(cli().stderr, /usage: node build\.mjs/);
    assert.match(cli(SPEC, '--watch').stderr, /unknown argument --watch/);
    assert.match(cli(SPEC, '--out').stderr, /usage/);
    assert.match(cli(join(tmp, 'nope.json')).stderr, /cannot read .*nope\.json as JSON/);
  });
});
