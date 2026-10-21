// node --test skills/explorable/scripts/*.test.mjs (Node 20.10+, no deps)
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { auditFile, auditHtml, auditSpec } from './audit.mjs';
import { buildPage } from './build.mjs';

const here = (p) => fileURLToPath(new URL(p, import.meta.url));
const AUDIT = here('./audit.mjs');
const example = (name) => JSON.parse(readFileSync(here(`../examples/${name}/explorable.json`), 'utf8'));
const newton = () => example('newton-cooling');
const bloom = () => example('bloom-filter');
const fig = (doc) => doc.sections.find((s) => s.figure).figure;
const page = (doc = newton()) => buildPage(doc, { fonts: false });

/** Assert the audit reports a problem matching `re` (and so does not pass). */
function fails(problems, re) {
  assert.ok(problems.length > 0, 'expected the audit to fail');
  assert.ok(problems.some((p) => re.test(p)), `no problem matches ${re}:\n${problems.join('\n')}`);
}

describe('audit: the worked examples pass', () => {
  for (const name of ['bloom-filter', 'newton-cooling']) {
    for (const file of ['explorable.json', 'index.html']) {
      it(`${name}/${file}`, () => assert.deepEqual(auditFile(here(`../examples/${name}/${file}`)), []));
    }
  }
  it('the CLI ends with "audit passed" and exits 0', () => {
    const out = execFileSync(process.execPath, [AUDIT, here('../examples/newton-cooling/explorable.json')], { encoding: 'utf8' });
    assert.equal(out.trim().split('\n').at(-1), 'audit passed');
  });
});

describe('audit: failing fixtures', () => {
  it('missing alt', () => {
    const doc = newton();
    delete fig(doc).alt;
    fails(auditSpec(doc), /figure\.alt: is required/);
  });
  it('alt shorter than 40 characters', () => {
    const doc = newton();
    fig(doc).alt = 'A chart.';
    fails(auditSpec(doc), /alt: must be at least 40 characters/);
  });
  it('unknown model', () => {
    const doc = bloom();
    fig(doc).model.id = 'bloom-filtre';
    fails(auditSpec(doc), /unknown model "bloom-filtre"; use one of .*bloom-filter/);
  });
  it('external script', () => {
    const html = page().replace('</body>', '<script src="https://cdn.example.com/x.js"></script></body>');
    fails(auditHtml(html), /external reference src="https:\/\/cdn\.example\.com\/x\.js"/);
  });
  it('external stylesheet and CSS url()', () => {
    const html = page().replace('</head>', '<link rel="stylesheet" href="https://fonts.example.com/a.css"><style>body{background:url(/bg.png)}</style></head>');
    const problems = auditHtml(html);
    fails(problems, /external reference href="https:\/\/fonts\.example\.com/);
    fails(problems, /CSS loads url\(\/bg\.png\)/);
  });
  it('out-of-range param', () => {
    const doc = bloom();
    fig(doc).model.params.k = 99;
    fails(auditSpec(doc), /param k = 99 is outside its range/);
  });
  it('hostile expr', () => {
    const doc = newton();
    fig(doc).model.expr = 'constructor.constructor("alert(1)")()';
    fails(auditSpec(doc), /figure "fig-cooling": expression rejected/);
  });
  it('expr that is not finite at the end of a control', () => {
    const doc = newton();
    fig(doc).model.expr = 'Ta + (T0 - Ta)/(k - 0.01)';
    fails(auditSpec(doc), /readout "y" is not a finite number at .*k = 0\.01/);
  });
  it('4th hue in the page palette', () => {
    const html = page().replace('--series-2:', '--series-3:#8a4fbf;--series-2:');
    fails(auditHtml(html), /4 hue-coded series/);
  });
  it('a hue set in the spec options', () => {
    const doc = newton();
    fig(doc).options.colors = ['#2851C0', '#0F8A6E', '#C4451C', '#8A4FBF'];
    fails(auditSpec(doc), /options\.colors sets a colour/);
  });
  it('series colours too close under colour-vision deficiency', () => {
    fails(auditHtml(page().replace('--series-2:#0f8a6e', '--series-2:#2a55c4')), /too close for (normal|protan|deutan|tritan) vision/);
  });
  it('low-contrast text token', () => {
    fails(auditHtml(page().replace('--ink-2:#5a554b', '--ink-2:#c8c2b5')), /--ink-2 on --paper has contrast/);
  });
  it('raw colour outside the tokens', () => {
    fails(auditHtml(page().replace('</style>', '.x{fill:#ff00aa}</style>')), /colours used outside the palette tokens: #ff00aa/);
  });
  it('no controls', () => {
    const doc = newton();
    fig(doc).controls = [];
    fails(auditSpec(doc), /controls: needs 1 to 3 items/);
  });
  it('four controls', () => {
    const doc = newton();
    fig(doc).controls = ['x', 'k', 'T0', 'Ta'];
    fails(auditSpec(doc), /controls: needs 1 to 3 items/);
  });
  it('unknown readout', () => {
    const doc = newton();
    fig(doc).readouts = ['x', 'slope'];
    fails(auditSpec(doc), /readout "slope" is not an output of expr-curve \(it has x, y, ref, marker\)/);
  });
  it('handle that is not a control', () => {
    const doc = newton();
    fig(doc).options.handle = 'Ta';
    fails(auditSpec(doc), /options\.handle "Ta" is not one of the controls/);
  });
  it('empty sections', () => {
    const doc = newton();
    doc.sections = [];
    fails(auditSpec(doc), /sections: needs 2 to 6 items/);
  });
  it('no figure at all', () => {
    const doc = newton();
    for (const s of doc.sections) delete s.figure;
    fails(auditSpec(doc), /no section has a figure/);
  });
  it('missing caption', () => {
    const doc = newton();
    fig(doc).caption = '';
    fails(auditSpec(doc), /caption: must not be empty/);
  });
  it('no reduced-motion rule', () => {
    const html = page().replaceAll('prefers-reduced-motion:reduce', 'prefers-reduced-motion:no-preference');
    fails(auditHtml(html), /no @media \(prefers-reduced-motion: reduce\)/);
  });
  it('no title, no lang, no main landmark', () => {
    const html = page().replace(/<title>.*<\/title>/, '').replace('<html lang="en">', '<html>').replace(/<(\/?)main\b/g, '<$1div');
    const problems = auditHtml(html);
    fails(problems, /no <title>/);
    fails(problems, /no lang attribute/);
    fails(problems, /exactly one <main> landmark/);
  });
  it('inline style attribute', () => {
    fails(auditHtml(page().replace('<main id="explorable">', '<main id="explorable" style="color:red">')), /inline style= attribute/);
  });
  it('a page without the embedded doc', () => {
    fails(auditHtml(page().replace(/<script type="application\/json"[\s\S]*?<\/script>/, '')), /no embedded doc/);
  });
  it('the CLI prints numbered problems, "audit failed" and exits 1', () => {
    const doc = bloom();
    fig(doc).model.params.k = 99;
    fig(doc).model.params.n = -1;
    const file = join(mkdtempSync(join(tmpdir(), 'explorable-audit-')), 'bad.json');
    writeFileSync(file, JSON.stringify(doc));
    const r = spawnSync(process.execPath, [AUDIT, file], { encoding: 'utf8' });
    rmSync(dirname(file), { recursive: true });
    assert.equal(r.status, 1);
    const lines = r.stdout.trim().split('\n');
    assert.match(lines[1], /^1\. figure "fig-bits": param k = 99/);
    assert.match(lines[2], /^2\. figure "fig-bits": param n = -1/);
    assert.equal(lines.at(-1), 'audit failed: 2 problems');
  });
});
