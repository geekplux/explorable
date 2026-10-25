import { describe, expect, it } from 'vitest';
import { parseDoc } from './schema.ts';

const ALT = 'Six bars, one per token, with the tallest bar over the word cat.';
const figure = () => ({
  id: 'fig-a',
  kind: 'bars',
  title: 'Figure A',
  caption: 'A caption.',
  alt: ALT,
  model: { id: 'softmax-temperature', params: { T: 1 } },
  controls: ['T'],
  readouts: ['top'],
  options: { handle: 'T', labels: ['a', 'b'], compare: true },
});
const curve = () => ({
  ...figure(),
  id: 'fig-b',
  kind: 'curve',
  model: {
    id: 'expr-curve',
    expr: '(1 - exp(-k*x/m))^k',
    x: { name: 'x', label: 'n', min: 1, max: 64 },
    y: { label: 'rate', min: 0, max: 1 },
    params: [{ name: 'k', label: 'k', min: 1, max: 6, default: 3, step: 1 }, { name: 'm', label: 'm', min: 16, max: 128, default: 32 }],
  },
  controls: ['x', 'k', 'm'],
  readouts: ['x', 'y'],
});
// Any JSON-shaped value; fixtures mutate it freely.
type Json = any; // oxlint-disable-line typescript/no-explicit-any
const valid = (): Json => ({
  schema: 1,
  id: 'demo',
  title: 'A demo',
  dek: 'One idea.',
  source: { kind: 'arxiv', url: 'https://arxiv.org/abs/1706.03762', title: 'Paper', authors: ['A B'], year: 2017 },
  provenance: { mode: 'curated', generatedAt: '2026-10-19T00:00:00.000Z' },
  sections: [
    { id: 's1', heading: 'One', paragraphs: ['First.'], figure: figure() },
    { id: 's2', heading: 'Two', paragraphs: ['Second.'], figure: curve() },
  ],
  takeaway: 'Take this away.',
});

const section = (n: number) => ({ id: `s${n}`, heading: 'H', paragraphs: ['P.'] });

describe('parseDoc', () => {
  it('accepts a valid doc, including expr-curve and designer options', () => {
    const result = parseDoc(valid());
    expect(result.ok ? [] : result.errors).toEqual([]);
  });

  const cases: [string, (d: Json) => void, string][] = [
    ['missing alt', (d) => delete d.sections[0].figure.alt, 'sections[0].figure.alt: is required'],
    ['short alt', (d) => (d.sections[0].figure.alt = 'Too short.'), 'sections[0].figure.alt: must be at least 40 characters'],
    ['space-padded alt', (d) => (d.sections[0].figure.alt = `Chart.${' '.repeat(50)}`), 'sections[0].figure.alt: must be at least 40 characters'],
    ['whitespace-only caption', (d) => (d.sections[0].figure.caption = ' \n\t '), 'sections[0].figure.caption: must not be empty'],
    ['zero-width-padded alt', (d) => (d.sections[0].figure.alt = `Chart.${'\u200B'.repeat(50)}`), 'sections[0].figure.alt: must be at least 40 characters'],
    ['invisible-only heading', (d) => (d.sections[0].heading = '\u200B\u2060\u200E '), 'sections[0].heading: must not be empty'],
    ['param label "-"', (d) => (d.sections[1].figure.model.params[0].label = '-'), 'sections[1].figure.model.params[0].label: must have a letter or digit'],
    ['param label "—"', (d) => (d.sections[1].figure.model.params[1].label = ' — '), 'sections[1].figure.model.params[1].label: must have a letter or digit'],
    ['x label only a combining mark', (d) => (d.sections[1].figure.model.x.label = '\u0301'), 'sections[1].figure.model.x.label: must not be empty'],
    ['y label only combining marks', (d) => (d.sections[1].figure.model.y.label = '\u0301\u0308 '), 'sections[1].figure.model.y.label: must not be empty'],
    ['heading only a combining mark', (d) => (d.sections[0].heading = '\u0301'), 'sections[0].heading: must not be empty'],
    ['0 sections',(d) => (d.sections = []), 'sections: needs 2 to 6 items'],
    ['7 sections', (d) => (d.sections = [1, 2, 3, 4, 5, 6, 7].map(section)), 'sections: needs 2 to 6 items'],
    ['4 controls', (d) => (d.sections[1].figure.controls = ['x', 'k', 'm', 'k']), 'sections[1].figure.controls: needs 1 to 3 items'],
    ['wrong schema version', (d) => (d.schema = 3), 'schema: must be 1 or 2 (ExplorableDoc v1 or v2)'],
    ['unknown kind', (d) => (d.sections[0].figure.kind = 'pie'), 'sections[0].figure.kind: must be one of bars, bits, histogram, curve'],
    ['long title', (d) => (d.title = 'x'.repeat(91)), 'title: must be at most 90 characters'],
    ['5 paragraphs', (d) => (d.sections[0].paragraphs = ['a', 'b', 'c', 'd', 'e']), 'sections[0].paragraphs: needs 1 to 4 items'],
    ['no readouts', (d) => (d.sections[0].figure.readouts = []), 'sections[0].figure.readouts: needs 1 to 3 items'],
    ['unknown control', (d) => (d.sections[0].figure.controls = ['nope']), 'sections[0].figure.controls: every control must name'],
    ['bad timestamp', (d) => (d.provenance.generatedAt = 'yesterday'), 'provenance.generatedAt: must be an ISO 8601 timestamp'],
    ['duplicate ids', (d) => (d.sections[1].id = 's1'), 'sections: section and figure ids must be unique'],
    ['expr param default out of range', (d) => (d.sections[1].figure.model.params[0].default = 9), 'sections[1].figure.model.params[0]: needs min < max'],
    ['expr x name', (d) => (d.sections[1].figure.model.x.name = 't'), 'sections[1].figure.model.x.name: must be "x"'],
    ['non-numeric param', (d) => (d.sections[0].figure.model.params.T = '1'), 'sections[0].figure.model.params.T: Invalid type'],
    ['bad option value', (d) => (d.sections[0].figure.options.handle = { a: 1 }), 'sections[0].figure.options.handle: Invalid type'],
    ['empty takeaway', (d) => (d.takeaway = ''), 'takeaway: must not be empty'],
    ['zero step', (d) => (d.sections[1].figure.model.params[0].step = 0), 'sections[1].figure.model.params[0].step: must be greater than 0'],
    ['unknown figure key', (d) => (d.sections[0].figure.optons = {}), 'sections[0].figure: unknown key "optons"'],
    ['unknown doc key', (d) => (d.titel = 'x'), '(doc): unknown key "titel"'],
    ['javascript: source url', (d) => (d.source.url = 'javascript:alert(1)'), 'source.url: must be an http(s) URL'],
    ['sections not an array', (d) => (d.sections = 'none'), 'sections: Invalid type'],
  ];

  it.each(cases)('rejects %s with a path-specific message', (_name, mutate, message) => {
    const doc = valid();
    mutate(doc);
    const result = parseDoc(doc);
    expect(result.ok ? 'accepted' : result.errors.join('\n')).toContain(message);
  });

  it('rejects a non-object at the root', () => {
    expect(parseDoc(null)).toEqual({ ok: false, errors: [expect.stringMatching(/^\(doc\): /)] });
  });
});

/** A v2 doc: one math note under the first paragraph, a source note cited twice, a math note in the takeaway. */
const v2 = (): Json => {
  const d = valid();
  d.schema = 2;
  d.sections[0].paragraphs = ['The weights add up to 1.[[m1]] [[vaswani]] say so.'];
  d.sections[1].paragraphs = ['As [[vaswani]] put it.'];
  d.takeaway = 'Divide, and the weights stay soft.[[m2]]';
  d.notes = [
    { id: 'm1', kind: 'math', formula: 'wᵢ = exp(sᵢ / T) / Σⱼ exp(sⱼ / T)', plain: 'Each weight is a share of the total.' },
    { id: 'm2', kind: 'math', formula: 'softmax(QKᵀ / √d_k) · V', plain: 'Equation 1 of the paper.' },
    { id: 'vaswani', kind: 'source', label: 'Vaswani et al.', title: 'Attention Is All You Need', detail: 'Vaswani and 7 others, 2017', url: 'https://arxiv.org/abs/1706.03762' },
  ];
  return d;
};

describe('parseDoc v2 notes', () => {
  it('accepts a v2 doc with math and source notes, and a v2 doc with no notes', () => {
    const result = parseDoc(v2());
    expect(result.ok ? [] : result.errors).toEqual([]);
    const plain = { ...valid(), schema: 2 };
    expect(parseDoc(plain).ok).toBe(true);
  });

  it('keeps v1 valid: a v1 doc may not have notes or markers', () => {
    expect(parseDoc(valid()).ok).toBe(true);
  });

  const cases: [string, (d: Json) => void, string][] = [
    ['an unknown note id', (d) => (d.sections[1].paragraphs[0] = 'See [[m9]].'), 'sections[1].paragraphs[0]: unknown note "m9"; the notes are m1, m2, vaswani'],
    ['a mistyped marker', (d) => (d.takeaway = 'Soft.[[M2]]'), 'takeaway: unknown note "M2"'],
    ['a note never referenced', (d) => (d.takeaway = 'Divide, and the weights stay soft.'), 'notes[1]: note "m2" is never referenced; put [[m2]] in a paragraph or the takeaway'],
    ['two math markers in one paragraph', (d) => (d.sections[0].paragraphs[0] += ' Then this.[[m2]]'), 'sections[0].paragraphs[0]: at most one math note per paragraph (this one has m1, m2)'],
    ['a math note under two paragraphs', (d) => (d.sections[1].paragraphs.push('Again.[[m1]]')), 'sections[1].paragraphs[1]: math note "m1" is already referenced in sections[0].paragraphs[0]'],
    ['duplicate note ids', (d) => d.notes.push({ ...d.notes[0] }), 'notes[3].id: duplicate note id "m1"'],
    ['a marker in a heading', (d) => (d.sections[0].heading = 'One [[m1]]'), 'sections[0].heading: [[m1]] marks a note; notes can be referenced only from paragraphs and the takeaway'],
    ['a marker in the dek', (d) => (d.dek = 'One idea.[[m1]]'), 'dek: [[m1]] marks a note; notes can be referenced only'],
    ['a marker in a caption', (d) => (d.sections[0].figure.caption = 'A caption.[[m1]]'), 'sections[0].figure.caption: [[m1]] marks a note'],
    ['notes in a v1 doc', (d) => (d.schema = 1), 'notes: notes need "schema": 2'],
    ['markers in a v1 doc', (d) => ((d.schema = 1), delete d.notes), 'sections[0].paragraphs[0]: [[m1]] marks a note, which needs "schema": 2'],
    ['a bad note id', (d) => (d.notes[0].id = 'M1'), 'notes[0].id: must be a lowercase letter'],
    ['an unknown note kind', (d) => (d.notes[0].kind = 'quote'), 'notes[0].kind: must be "math" or "source"'],
    ['a long formula', (d) => (d.notes[0].formula = 'x'.repeat(161)), 'notes[0].formula: must be at most 160 characters'],
    ['a long gloss', (d) => (d.notes[0].plain = 'x'.repeat(241)), 'notes[0].plain: must be at most 240 characters'],
    ['an empty gloss', (d) => (d.notes[0].plain = ' '), 'notes[0].plain: must not be empty'],
    ['a long source label', (d) => (d.notes[2].label = 'x'.repeat(61)), 'notes[2].label: must be at most 60 characters'],
    ['a long source title', (d) => (d.notes[2].title = 'x'.repeat(201)), 'notes[2].title: must be at most 200 characters'],
    ['a long source detail', (d) => (d.notes[2].detail = 'x'.repeat(121)), 'notes[2].detail: must be at most 120 characters'],
    ['an http source url', (d) => (d.notes[2].url = 'http://arxiv.org/abs/1706.03762'), 'notes[2].url: must be an https URL'],
    ['a javascript: source url', (d) => (d.notes[2].url = 'javascript:alert(1)'), 'notes[2].url:'],
    ['a math note with a source key', (d) => (d.notes[0].url = 'https://example.com/'), 'notes[0]: unknown key "url"'],
    ['13 notes', (d) => (d.notes = Array.from({ length: 13 }, (_, i) => ({ id: `s${i}`, kind: 'source', label: 'A', title: 'T' }))), 'notes: at most 12 notes'],
  ];

  it.each(cases)('rejects %s with a path-specific message', (_name, mutate, message) => {
    const doc = v2();
    mutate(doc);
    const result = parseDoc(doc);
    expect(result.ok ? 'accepted' : result.errors.join('\n')).toContain(message);
  });

  it('reports a malformed note id once, not also as unknown or unreferenced', () => {
    const doc = v2();
    doc.notes[0].id = 'M1';
    doc.sections[0].paragraphs[0] = doc.sections[0].paragraphs[0].replace('[[m1]]', '[[M1]]');
    const result = parseDoc(doc);
    expect(result.ok ? [] : result.errors.filter((e) => /M1|notes\[0\]/.test(e))).toEqual([
      'notes[0].id: must be a lowercase letter, then up to 23 lowercase letters, digits or dashes',
      'sections[0].paragraphs[0]: unknown note "M1"; the notes are m2, vaswani',
    ]);
  });

  it('reports every note problem at once', () => {
    const doc = v2();
    doc.sections[1].paragraphs[0] = 'See [[m9]] and [[m8]].';
    const result = parseDoc(doc);
    expect(result.ok ? [] : result.errors.filter((e) => e.includes('unknown note'))).toHaveLength(2);
  });
});

describe('the root', () => {
  it('rejects a non-object at the root', () => {
    expect(parseDoc(null)).toEqual({ ok: false, errors: [expect.stringMatching(/^\(doc\): /)] });
  });
});
