// node --test skills/explorable/scripts/*.test.mjs (Node 20.10+, no deps)
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import * as kit from '../kit/dist/explorable-kit.js';
import { auditFile, auditHtml, auditSpec, docWarnings, warnFile } from './audit.mjs';
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
  it('alt padded to 40 characters with spaces', () => {
    const doc = newton();
    fig(doc).alt = `Chart.${' '.repeat(50)}`;
    fails(auditSpec(doc), /figure\.alt: must be at least 40 characters/);
  });
  it('whitespace-only caption', () => {
    const doc = newton();
    fig(doc).caption = '   ';
    fails(auditSpec(doc), /figure\.caption: must not be empty/);
  });
  it('marker that is not finite at the end of a control', () => {
    const doc = newton();
    fig(doc).model.params.find((p) => p.name === 'k').min = 0;
    assert.equal(fig(doc).options.markerExpr, 'ln(2)/k');
    const problems = auditSpec(doc);
    assert.ok(problems.includes('figure "fig-cooling": marker is not a finite number at k = 0'), problems.join('\n'));
  });
  it('marker that is not finite inside a control\'s range (k steps through 0)', () => {
    const doc = newton();
    Object.assign(fig(doc).model.params.find((p) => p.name === 'k'), { min: -0.1, max: 0.1, step: 0.01 });
    assert.equal(fig(doc).options.markerExpr, 'ln(2)/k');
    const problems = auditSpec(doc);
    assert.ok(problems.includes('figure "fig-cooling": marker is not a finite number at k = 0'), problems.join('\n'));
  });
  it('marker that is NaN at one interior stop (T0 steps through 70)', () => {
    const doc = newton();
    fig(doc).options.markerExpr = 'ln(2)/k + 0/(T0-70)';
    const problems = auditSpec(doc);
    assert.ok(problems.includes('figure "fig-cooling": marker is not a finite number at T0 = 70'), problems.join('\n'));
  });
  it('a fine grid is sampled, ends included, and stays fast', () => {
    const doc = newton();
    // 6001 stops for T0: sampled, but its far end (T0 = 100) is always checked.
    Object.assign(fig(doc).model.params.find((p) => p.name === 'T0'), { step: 0.01 });
    fig(doc).options.markerExpr = 'ln(2)/k + 0/(T0-100)';
    const t = performance.now();
    const problems = auditSpec(doc);
    assert.ok(problems.includes('figure "fig-cooling": marker is not a finite number at T0 = 100'), problems.join('\n'));
    assert.ok(performance.now() - t < 1000, 'audit took over 1 s');
  });
  it('reference curve that is not finite at the end of a control', () => {
    const doc = newton();
    fig(doc).options.refExpr = 'Ta/(T0 - 40)';
    fails(auditSpec(doc), /figure "fig-cooling": ref is not a finite number at T0 = 40$/);
  });
  it('an output named only in describe that is not finite', () => {
    const doc = newton();
    const f = fig(doc);
    f.model.expr = 'Ta + (T0 - Ta)/(k - 0.01)';
    f.readouts = ['x'];
    f.options.describe = 'At {x} minutes the cup is at {y:fixed1} °C.';
    fails(auditSpec(doc), /figure "fig-cooling": output "y" \(in options\.describe\) is not a finite number at k = 0\.01$/);
  });
  it('empty and whitespace-only labels', () => {
    const doc = newton();
    Object.assign(fig(doc).options, { seriesLabels: ['k = {k}', '  '], refLabel: '', markerLabel: ' \t' });
    const problems = auditSpec(doc);
    fails(problems, /figure "fig-cooling": options\.seriesLabels\[1\] is empty/);
    fails(problems, /figure "fig-cooling": options\.refLabel is empty/);
    fails(problems, /figure "fig-cooling": options\.markerLabel is empty/);
  });
  it('a zero-width space pads an alt to 40 characters', () => {
    const doc = newton();
    fig(doc).alt = `Chart.${'\u200B'.repeat(50)}`;
    fails(auditSpec(doc), /figure\.alt: must be at least 40 characters/);
  });
  it('labels that are only zero-width or punctuation', () => {
    const doc = newton();
    Object.assign(fig(doc).options, { seriesLabels: ['\u200B', 'room'], markerLabel: '-', refLabel: '\u200B \u2060' });
    const problems = auditSpec(doc);
    fails(problems, /figure "fig-cooling": options\.seriesLabels\[0\] is empty/);
    fails(problems, /figure "fig-cooling": options\.markerLabel is empty/);
    fails(problems, /figure "fig-cooling": options\.refLabel is empty/);
    assert.ok(!problems.some((p) => /seriesLabels\[1\]/.test(p)), problems.join('\n'));
  });
  it('a param label "-" and an axis label made only of a combining mark', () => {
    const doc = newton();
    const m = fig(doc).model;
    m.params[0].label = '-';
    m.x.label = '\u0301';
    const problems = auditSpec(doc);
    fails(problems, /schema: sections\[\d\]\.figure\.model\.params\[0\]\.label: must have a letter or digit/);
    fails(problems, /schema: sections\[\d\]\.figure\.model\.x\.label: must not be empty/);
  });
  it('a marker label that is only a placeholder says only a number', () => {
    const doc = newton();
    Object.assign(fig(doc).options, { markerLabel: '{marker}', refLabel: ' {y:fixed1} \u200B', seriesLabels: ['k = {k}', 'room'] });
    const problems = auditSpec(doc);
    fails(problems, /figure "fig-cooling": options\.markerLabel "\{marker\}" says only a number; add what it marks/);
    fails(problems, /figure "fig-cooling": options\.refLabel ".*" says only a number; add what it marks/);
    assert.ok(!problems.some((p) => /seriesLabels/.test(p)), problems.join('\n'));
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
    fails(auditHtml(page().replace('--series-2:var(--sand-12)', '--series-2:#3a5fd0')), /too close for (normal|protan|deutan|tritan) vision/);
  });
  it('low-contrast text token', () => {
    fails(auditHtml(page().replace('--ink-2:var(--sand-11)', '--ink-2:#c8c2b5')), /--ink-2 on --paper has contrast/);
  });
  it('low-contrast token in the dark scheme only', () => {
    const problems = auditHtml(page().replace('--sand-11:#b5b3ad', '--sand-11:#3b3a37'));
    fails(problems, /--ink-2 on --paper has contrast [\d.]+:1 in the dark scheme/);
    assert.ok(!problems.some((p) => /--ink-2 on --paper has contrast [\d.]+:1;/.test(p)), 'light is unaffected');
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

/** The bloom-filter example with its first figure replaced by `figure` (and the second removed). */
function withFigure(figure) {
  const doc = bloom();
  const sections = doc.sections.filter((x) => x.figure);
  sections[0].figure = { ...sections[0].figure, ...figure };
  delete sections[1].figure;
  return doc;
}

/** The SNR figure of the app's diffusion sample: at t = 0 the SNR is +∞ dB, shown as "∞ dB". */
const snrFigure = (options = {}) => ({
  id: 'fig-snr',
  kind: 'curve',
  model: { id: 'diffusion-forward', params: { t: 100, seed: 2020 } },
  controls: ['t'],
  readouts: ['alphaBar', 'snrDb'],
  options: { handle: 't', xParam: 't', series: ['signalSeries', 'noiseSeries'], seriesLabels: ['signal', 'noise'], ...options },
});

// A test-only model: at x = 0 every output is +∞ except `nan`; at x = 1 `nan` is NaN; at x = 2 `inf` is −∞.
kit.registerModel({
  id: 'test-infinite',
  title: 'Test: infinite outputs',
  kinds: ['curve'],
  keywords: [],
  params: { x: { label: 'x', min: 0, max: 2, step: 1, default: 1 } },
  outputs: {
    inf: { label: 'inf', format: 'fixed1', infinite: true },
    nan: { label: 'nan', format: 'fixed1', infinite: true },
    raw: { label: 'raw', format: 'fixed1' },
  },
  compute: ({ x }) => ({ inf: [Infinity, 1, -Infinity][x], nan: x === 1 ? NaN : 1, raw: x === 0 ? Infinity : 1 }),
  describe: () => 'test',
});
const testFigure = (readouts, options = {}) => ({ id: 'fig-t', kind: 'curve', model: { id: 'test-infinite', params: { x: 1 } }, controls: ['x'], readouts, options });

describe('audit: outputs flagged `infinite` may show ±∞ as text, never NaN, never as a position', () => {
  it('diffusion-forward flags snrDb, and ∞ formats as "∞"', () => {
    assert.equal(kit.getModel('diffusion-forward').outputs.snrDb.infinite, true);
    assert.equal(kit.format(kit.getModel('diffusion-forward').compute({ t: 0, seed: 2020 }).snrDb, 'fixed1'), '∞');
  });
  it('a readout of +∞ dB at t = 0 passes', () => {
    assert.deepEqual(auditSpec(withFigure(snrFigure())), []);
  });
  it('the flagged output filled into describe passes', () => {
    assert.deepEqual(auditSpec(withFigure(snrFigure({ describe: 'At t = {t} the SNR is {snrDb:fixed1} dB.' }))), []);
  });
  it('+∞ and −∞ pass for a flagged readout', () => {
    assert.deepEqual(auditSpec(withFigure(testFigure(['inf']))), []);
  });
  it('a flagged output used as a marker stays strict', () => {
    const problems = auditSpec(withFigure(snrFigure({ markers: ['snrDb'] })));
    assert.deepEqual(problems, ['figure "fig-snr": marker "snrDb" is not a finite number at t = 0']);
  });
  it('NaN fails even when flagged', () => {
    assert.deepEqual(auditSpec(withFigure(testFigure(['nan']))), ['figure "fig-t": readout "nan" is not a finite number at the defaults (x = 1)']);
  });
  it('±∞ still fails for an output without the flag', () => {
    assert.deepEqual(auditSpec(withFigure(testFigure(['raw']))), ['figure "fig-t": readout "raw" is not a finite number at x = 0']);
  });
});

// The app's built-in samples are built from the same kit; auditing them here keeps app and skill from drifting.
// Skipped when the skill folder is used on its own (no app around it).
const APP_SAMPLES = here('../../../src/samples/');
describe('audit: the app samples pass', () => {
  for (const name of ['attention', 'bloom-filter', 'diffusion']) {
    const file = join(APP_SAMPLES, `${name}.json`);
    it(`src/samples/${name}.json`, { skip: !existsSync(file) && 'app samples not present' }, () => {
      const out = execFileSync(process.execPath, [AUDIT, file], { encoding: 'utf8' });
      assert.equal(out.trim().split('\n').at(-1), 'audit passed');
    });
  }
});

// ExplorableDoc v2: notes behind markers, checked by the schema; formulas left in the body are warnings.
const v2 = () => {
  const doc = newton();
  doc.schema = 2;
  for (const section of doc.sections) section.paragraphs = ['Drag the time and watch the gap close.'];
  doc.sections[0].paragraphs = ['Hot coffee loses heat fast at first, then slowly.[[law]] [[newton]] wrote it down.'];
  doc.takeaway = 'The gap to the room shrinks by the same share every minute.';
  doc.notes = [
    { id: 'law', kind: 'math', formula: 'dT/dt = −k·(T − Tₐ)', plain: 'The cooling rate is proportional to the gap to the room.' },
    { id: 'newton', kind: 'source', label: 'Newton', title: 'Scala graduum caloris', detail: 'Isaac Newton, 1701', url: 'https://example.org/newton-1701' },
  ];
  return doc;
};

describe('audit: ExplorableDoc v2 notes', () => {
  it('a v2 spec and its page pass, and the source note may link out', () => {
    assert.deepEqual(auditSpec(v2()), []);
    const html = page(v2());
    assert.match(html, /<button class="xnote-mk"[^>]*aria-controls="note-law"/);
    assert.match(html, /href="https:\/\/example\.org\/newton-1701"/);
    assert.deepEqual(auditHtml(html), []);
  });
  it('an unknown note id fails with its path', () => {
    const doc = v2();
    doc.sections[0].paragraphs[0] += ' Again.[[nope]]';
    fails(auditSpec(doc), /schema: sections\[0\]\.paragraphs\[0\]: unknown note "nope"/);
  });
  it('a note never referenced fails', () => {
    const doc = v2();
    doc.sections[0].paragraphs[0] = 'Plain words only.';
    fails(auditSpec(doc), /schema: notes\[0\]: note "law" is never referenced/);
  });
  it('two math markers in one paragraph fail', () => {
    const doc = v2();
    doc.notes.push({ id: 'law2', kind: 'math', formula: 'T(t) = Tₐ + (T₀ − Tₐ)·e^(−kt)', plain: 'The solution.' });
    doc.sections[0].paragraphs[0] += ' Solved.[[law2]]';
    fails(auditSpec(doc), /at most one math note per paragraph/);
  });
  it('markers in a v1 spec fail', () => {
    const doc = v2();
    doc.schema = 1;
    delete doc.notes;
    fails(auditSpec(doc), /needs "schema": 2/);
  });
  it('a link that is neither the source nor a source note still fails', () => {
    const doc = v2();
    const html = page(doc).replace('href="https://example.org/newton-1701"', 'href="https://evil.example/"');
    fails(auditHtml(html), /external reference href="https:\/\/evil\.example\/"/);
  });
  it('a page whose math markers do not match the doc fails', () => {
    const html = page(v2()).replace(/<button class="xnote-mk"[\s\S]*?<\/button>/, '');
    fails(auditHtml(html), /0 math markers in the markup but 1 math notes in the doc/);
  });
  it('a formula in body text is a warning, not a problem', () => {
    const doc = v2();
    doc.takeaway = 'So T(t) = Tₐ + (T₀ − Tₐ)·e^(−kt) for all t.';
    assert.deepEqual(auditSpec(doc), []);
    const warnings = docWarnings(doc);
    assert.equal(warnings.length, 1);
    assert.match(warnings[0], /^takeaway reads like a formula \(T\(t\) = Tₐ \+ \(T₀ − Tₐ\)·e\^\(−kt\)\); say it in words/);
    assert.deepEqual(docWarnings(v2()), []);
  });
  it('the CLI prints warnings before "audit passed" (the v1 examples keep their formulas)', () => {
    const file = here('../examples/newton-cooling/explorable.json');
    assert.ok(warnFile(file).length > 0, 'newton-cooling has formulas in its paragraphs');
    const lines = execFileSync(process.execPath, [AUDIT, file], { encoding: 'utf8' }).trim().split('\n');
    assert.ok(lines.slice(1, -1).every((l) => l.startsWith('warning: ')), lines.join('\n'));
    assert.equal(lines.at(-1), 'audit passed');
  });
  it('the app samples have no formula in their body text', () => {
    for (const name of ['attention', 'bloom-filter', 'diffusion']) {
      const file = join(APP_SAMPLES, `${name}.json`);
      if (existsSync(file)) assert.deepEqual(warnFile(file), [], name);
    }
  });
});

const withCss = (extra) => page().replace('</style>', `${extra}</style>`);
describe('audit: hex values only on the kit tokens', () => {
  it('a custom property of its own holding a colour fails', () => {
    fails(auditHtml(withCss('.zz{--zz:#f00}.xfig{color:var(--zz)}')), /colours used outside the palette tokens: #f00/);
  });
  it('a blackA name holding a non-black colour fails', () => {
    fails(auditHtml(withCss('.zz{--black-a3:#f006}')), /colours used outside the palette tokens: #f006/);
  });
});
