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
    ['0 sections',(d) => (d.sections = []), 'sections: needs 2 to 6 items'],
    ['7 sections', (d) => (d.sections = [1, 2, 3, 4, 5, 6, 7].map(section)), 'sections: needs 2 to 6 items'],
    ['4 controls', (d) => (d.sections[1].figure.controls = ['x', 'k', 'm', 'k']), 'sections[1].figure.controls: needs 1 to 3 items'],
    ['wrong schema version', (d) => (d.schema = 2), 'schema: must be 1 (ExplorableDoc v1)'],
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
