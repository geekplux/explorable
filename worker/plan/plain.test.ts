import { describe, expect, it } from 'vitest';
import attention from '../../src/samples/attention.json';
import type { DocSource } from '../../skills/explorable/kit/src/doc/schema.ts';
import { MAX_NOTES, markCitations, plainWords, sourceLabel, sourceNote } from './plain';

const paper: DocSource = {
  kind: 'arxiv',
  url: 'https://arxiv.org/abs/1706.03762',
  title: 'Attention Is All You Need',
  authors: ['Ashish Vaswani', 'Noam Shazeer', 'Niki Parmar', 'Jakob Uszkoreit', 'Llion Jones'],
  year: 2017,
};
const ddpm: DocSource = { kind: 'arxiv', url: 'https://arxiv.org/abs/2006.11239', title: 'Denoising Diffusion Probabilistic Models', authors: ['Jonathan Ho', 'Ajay Jain', 'Pieter Abbeel'], year: 2020 };
const post: DocSource = { kind: 'blog', url: 'http://example.org/bloom', title: 'Bloom filters by example', authors: ['Bill Mill'] };
const anon: DocSource = { kind: 'blog', url: 'https://example.org/ropes', title: 'Why ropes beat strings for big edits' };
const W = 'wᵢ = e^(sᵢ) / Σⱼ e^(sⱼ)';
const gloss = { id: 'g', formula: W, plain: 'Each weight is a share.' };
type Notes = { id: string; formula: string; plain: string }[];
const cite = (t: string, src = ddpm) => markCitations(t, src).text;
const run = (paragraphs: string[], notes: Notes = [], src = paper, rest: { dek?: string; takeaway?: string } = {}) =>
  plainWords({ dek: rest.dek ?? 'A short dek.', paragraphs: [paragraphs], takeaway: rest.takeaway ?? 'A plain takeaway.' }, notes, src);

describe('formulas left in the text', () => {
  it('drops a sentence that is only a formula the model glossed, and puts the marker after the sentence before it', () => {
    const r = run([`A softmax turns the scores into weights. In symbols: \`${W}\`. The weights add up to 1.`], [gloss]);
    expect(r.paragraphs[0]).toEqual(['A softmax turns the scores into weights.[[m1]] The weights add up to 1.']);
    expect(r.notes).toEqual([{ id: 'm1', kind: 'math', formula: W, plain: 'Each weight is a share.' }]);
    expect(r.report).toMatchObject({ moved: 1, kept: 0 });
    // First in its paragraph: the marker follows the next sentence.
    expect(run([`${W}. A softmax turns the scores into weights. Drag T.`], [gloss]).paragraphs[0]).toEqual(['A softmax turns the scores into weights.[[m1]] Drag T.']);
  });

  it('leaves every other formula as written and counts it', () => {
    const cases = [
      // Part of a longer sentence.
      `Each weight ${W} is a share of the total, so the weights add up to 1.`,
      // No gloss from the model.
      'The model learns to predict the noise. The loss is L = ‖ε − ε_θ(x_t, t)‖². Smaller is better.',
      // The only sentence.
      `In symbols: ${W}.`,
    ];
    for (const text of cases) {
      const r = run([text], [gloss]);
      expect(r.paragraphs[0]).toEqual([text]);
      expect(r.report).toMatchObject({ moved: 0, kept: 1 });
      expect(r.notes).toEqual([]);
    }
  });

  it('keeps one math marker per paragraph, and never touches the dek', () => {
    const notes = [{ id: 'm1', formula: 'Var(q·k) = d_k', plain: 'Variances add.' }, gloss];
    const r = run([`The variance is d_k.[[m1]] Then: ${W}. Drag d_k.`], notes);
    expect(r.paragraphs[0]).toEqual([`The variance is d_k.[[m1]] Then: ${W}. Drag d_k.`]);
    expect(r.report).toMatchObject({ moved: 0, kept: 1 });
    const dek = run(['Plain.'], [gloss], paper, { dek: `Scores grow. ${W}. Dividing keeps them soft.[[g]]` });
    expect(dek.dek).toBe(`Scores grow. ${W}. Dividing keeps them soft.`);
    expect(dek.report).toMatchObject({ kept: 1, removed: 1 });
  });

  it('drops a model note written in LaTeX, with its marker; LaTeX in the text stays and is counted', () => {
    const r = run(['The weights sum to 1.[[t]] They are soft.', 'Divide by $\\sqrt{d_k}$ first.'], [{ id: 't', formula: '\\frac{e^{s_i}}{\\sum_j e^{s_j}}', plain: 'A share.' }]);
    expect(r.paragraphs[0]).toEqual(['The weights sum to 1. They are soft.', 'Divide by $\\sqrt{d_k}$ first.']);
    expect(r.notes).toEqual([]);
    expect(r.report).toMatchObject({ removed: 1, kept: 1 });
  });
});

describe('markers', () => {
  it('renumbers notes in reading order, and removes unknown, repeated and second math markers', () => {
    const notes = [
      { id: 'b', formula: 'y = a·x + c', plain: 'A line.' },
      { id: 'a', formula: 'z = x·x + 1', plain: 'A parabola.' },
      { id: 'unused', formula: 'w = 2·x + 1', plain: 'Never referenced.' },
    ];
    const r = run(['First.[[a]] Then.[[b]]', 'Again.[[a]] And [[zz]] more.[[b]]'], notes);
    expect(r.paragraphs[0]).toEqual(['First.[[m1]] Then.', 'Again. And more.[[m2]]']);
    expect(r.notes.map((n) => [n.id, n.kind === 'math' && n.plain])).toEqual([['m1', 'A parabola.'], ['m2', 'A line.']]);
    expect(r.report.removed).toBe(3);
  });

  it('stops at the note budget, keeping one place for the source note', () => {
    const notes = Array.from({ length: 14 }, (_, i) => ({ id: `m${i + 1}`, formula: `x = a·b + ${i}`, plain: `Rule ${i}.` }));
    const paragraphs = notes.map((n) => `Step ${n.id}.[[${n.id}]]`);
    expect(run(paragraphs, notes).notes).toHaveLength(MAX_NOTES);
    const cited = run([...paragraphs, 'Vaswani et al. (2017) show this.'], notes);
    expect(cited.notes.filter((n) => n.kind === 'math')).toHaveLength(MAX_NOTES - 1);
    expect(cited.notes.at(-1)?.kind).toBe('source');
  });

  it('turns a marker named after an author into the source marker', () => {
    expect(run(['[[vaswani]] suspect this.']).paragraphs[0]).toEqual(['[[source]] suspect this.']);
  });
});

describe('citations of the source', () => {
  it('rewrites author-year, "et al.", parenthetical and full-name citations as one source note', () => {
    const r = run(['Vaswani et al. (2017) suspect this. It holds (Vaswani et al., 2017).', 'As Ashish Vaswani writes, it works.', 'This follows Vaswani et al., 2017.']);
    expect(r.paragraphs[0]).toEqual(['[[source]] suspect this. It holds ([[source]]).', 'As [[source]] writes, it works.', 'This follows [[source]]']);
    expect(r.notes).toEqual([sourceNote(paper)]);
    expect(r.report.cited).toBe(4);
  });

  it('catches every surname from the metadata, "and colleagues" and "the authors of <title>"', () => {
    expect(cite('As Ho, Jain and Abbeel show, it works.')).toBe('As [[source]] show, it works.');
    expect(cite('Ho and colleagues trained it.')).toBe('[[source]] trained it.');
    expect(cite('The authors of Denoising Diffusion Probabilistic Models add noise.')).toBe('[[source]] add noise.');
    expect(cite('The authors of the paper “Attention Is All You Need” divide.', paper)).toBe('[[source]] divide.');
    // Other papers stay as they are.
    expect(cite('Ho et al. (2020) build on Sohl-Dickstein et al. (2015).')).toBe('[[source]] build on Sohl-Dickstein et al. (2015).');
  });

  it('builds the note from metadata only, listing up to four surnames', () => {
    expect(sourceNote(paper)).toMatchObject({ label: 'Vaswani et al.', detail: 'Vaswani, Shazeer, Parmar and 2 others, 2017', url: 'https://arxiv.org/abs/1706.03762' });
    const ode: DocSource = { kind: 'arxiv', title: 'Neural ordinary differential equations', authors: ['Ricky T. Q. Chen', 'Yulia Rubanova', 'Jesse Bettencourt', 'David Duvenaud'], year: 2018 };
    expect(sourceNote(ode).detail).toBe('Chen, Rubanova, Bettencourt and Duvenaud, 2018');
    // The attention sample's hand-written card comes out the same from its metadata.
    const sample = attention.notes.find((n) => n.kind === 'source')!;
    expect(sourceNote(attention.source as DocSource)).toEqual({ ...sample, id: 'source' });
    // An http URL is left out (the schema takes https only); a source with no authors is labelled by its title.
    expect(sourceNote(post)).toEqual({ id: 'source', kind: 'source', label: 'Bill Mill', title: 'Bloom filters by example', detail: 'Mill' });
    expect(sourceLabel(anon)).toBe('Why ropes beat strings for big edits');
    expect(sourceLabel({ ...anon, title: `${'word '.repeat(20)}end` }).length).toBeLessThanOrEqual(60);
  });

  it('rewrites the title in quotes as "the paper by …", or as the marker when there are no authors', () => {
    expect(markCitations('In “Attention Is All You Need”, words score words.', paper).text).toBe('In the paper by [[source]], words score words.');
    expect(markCitations('*Attention Is All You Need* starts here.', paper).text).toBe('The paper by [[source]] starts here.');
    expect(markCitations('As “Why ropes beat strings for big edits” shows, ropes win.', anon).text).toBe('As [[source]] shows, ropes win.');
  });

  it('leaves a bare surname alone, and lets the "et al." label close the sentence', () => {
    const bloom: DocSource = { kind: 'arxiv', title: 'Space/time trade-offs in hash coding', authors: ['Burton H. Bloom'], year: 1970 };
    expect(markCitations('Bloom filters answer fast.', bloom)).toEqual({ text: 'Bloom filters answer fast.', cited: 0 });
    expect(markCitations('Bloom (1970) found it.', bloom).text).toBe('[[source]] found it.');
    expect(markCitations('This is the work of Vaswani et al.', paper).text).toBe('This is the work of [[source]]');
    expect(markCitations('It holds (Vaswani et al., 2017).', paper, false).text).toBe('It holds.');
  });
});
