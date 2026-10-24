import { describe, expect, it } from 'vitest';
import { bodyHasFormula } from '../../skills/explorable/kit/src/doc/formula.ts';
import type { DocSource } from '../../skills/explorable/kit/src/doc/schema.ts';
import { FALLBACK_GLOSS, MAX_NOTES, markCitations, plainWords, sourceLabel, sourceNote } from './plain';

const paper: DocSource = {
  kind: 'arxiv',
  url: 'https://arxiv.org/abs/1706.03762',
  title: 'Attention Is All You Need',
  authors: ['Ashish Vaswani', 'Noam Shazeer', 'Niki Parmar', 'Jakob Uszkoreit', 'Llion Jones'],
  year: 2017,
};
const post: DocSource = { kind: 'blog', url: 'http://example.org/bloom', title: 'Bloom filters by example', authors: ['Bill Mill'] };
const anon: DocSource = { kind: 'blog', url: 'https://example.org/ropes', title: 'Why ropes beat strings for big edits' };
const W = '`wᵢ = e^(sᵢ) / Σⱼ e^(sⱼ)`';
const run = (paragraphs: string[], notes: { id: string; formula: string; plain: string }[] = [], src = paper, rest: { dek?: string; takeaway?: string } = {}) =>
  plainWords({ dek: rest.dek ?? 'A short dek.', paragraphs: [paragraphs], takeaway: rest.takeaway ?? 'A plain takeaway.' }, notes, src);

describe('formulas left in the text', () => {
  it('moves a formula after a colon into a math note, with the model gloss for the same formula', () => {
    const r = run([`A softmax turns the scores into weights: ${W}. The weights add up to 1.`], [{ id: 'q', formula: 'wᵢ = e^(sᵢ)/Σⱼ e^(sⱼ)', plain: 'Each weight is a share.' }]);
    expect(r.paragraphs[0]).toEqual(['A softmax turns the scores into weights.[[m1]] The weights add up to 1.']);
    expect(r.notes).toEqual([{ id: 'm1', kind: 'math', formula: 'wᵢ = e^(sᵢ) / Σⱼ e^(sⱼ)', plain: 'Each weight is a share.' }]);
    expect(r.report).toMatchObject({ moved: 1, kept: 0 });
  });

  it('cuts a parenthesis or a formula between commas, and says "a formula" where it is part of the grammar', () => {
    expect(run(['The weights (wᵢ = e^(sᵢ) / Σⱼ e^(sⱼ)) add up to 1.']).paragraphs[0]).toEqual(['The weights add up to 1.[[m1]]']);
    expect(run(['The gap decays, T(t) = Tₐ + (T₀ − Tₐ)·e^(−kt), and halves often. Drag k.']).paragraphs[0]).toEqual(['The gap decays and halves often.[[m1]] Drag k.']);
    const r = run(['Solve it and you get `T(t) = Tₐ + (T₀ − Tₐ)·e^(−kt)`. Drag the point.']);
    expect(r.paragraphs[0]).toEqual(['Solve it and you get a formula.[[m1]] Drag the point.']);
    // No model gloss for this formula: the honest fallback.
    expect(r.notes[0]).toMatchObject({ formula: 'T(t) = Tₐ + (T₀ − Tₐ)·e^(−kt)', plain: FALLBACK_GLOSS });
    expect(run(['`q·k = Σᵢ qᵢkᵢ` is the score.']).paragraphs[0]).toEqual(['A formula is the score.[[m1]]']);
  });

  it('keeps one math marker per paragraph: a second formula is cut, its sentence dropped, or (alone) kept', () => {
    const notes = [{ id: 'm1', formula: 'Var(q·k) = d_k', plain: 'Variances add.' }];
    // Same formula as the paragraph's note: the copy in the text goes.
    expect(run(['The variance is d_k.[[m1]] In symbols: Var(q·k) = d_k.'], notes).paragraphs[0]).toEqual(['The variance is d_k.[[m1]] In symbols.']);
    // A different formula after a colon is cut; one that is part of a sentence drops the sentence.
    expect(run(['The variance is d_k.[[m1]] So the spread is: σ = √d_k · 1.'], notes).paragraphs[0]).toEqual(['The variance is d_k.[[m1]] So the spread is.']);
    const dropped = run(['The variance is d_k.[[m1]] Its spread is σ = √d_k · 1 here. Drag d_k.'], notes);
    expect(dropped.paragraphs[0]).toEqual(['The variance is d_k.[[m1]] Drag d_k.']);
    expect(dropped.report).toMatchObject({ dropped: 1, kept: 0 });
    // The only sentence holds the marker: the formula stays, and the doc still validates (a warning in the audit).
    const kept = run(['Its spread is σ = √d_k · 1 here.[[m1]]'], notes);
    expect(kept.paragraphs[0]).toEqual(['Its spread is σ = √d_k · 1 here.[[m1]]']);
    expect(kept.report).toMatchObject({ kept: 1 });
  });

  it('never puts a marker in the dek: its formulas are cut or their sentence dropped', () => {
    const r = run(['Plain.'], [], paper, { dek: 'Scores grow: `Var(q·k) = d_k · Var(qᵢ)`. Dividing keeps them soft.[[m1]]' });
    expect(r.dek).toBe('Scores grow. Dividing keeps them soft.');
    expect(r.notes).toEqual([]);
  });

  it('moves formulas from the takeaway, and stops at the note budget', () => {
    const r = run(['Plain.'], [], paper, { takeaway: 'So attention uses softmax(QKᵀ / √d_k) and stays soft.' });
    expect(r.takeaway).toBe('So attention uses a formula and stays soft.[[m1]]');
    const many = Array.from({ length: MAX_NOTES + 2 }, (_, i) => `Step ${i}: x = a·b + ${i}.`);
    const full = plainWords({ dek: 'd', paragraphs: many.map((p) => [p]), takeaway: 't' }, [], paper);
    expect(full.notes).toHaveLength(MAX_NOTES);
    expect(full.paragraphs.slice(MAX_NOTES).flat()).toEqual([`Step ${MAX_NOTES}.`, `Step ${MAX_NOTES + 1}.`]);
    expect(full.paragraphs.flat().some(bodyHasFormula)).toBe(false);
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

  it('turns a marker named after an author into the source marker', () => {
    expect(run(['[[vaswani]] suspect this.']).paragraphs[0]).toEqual(['[[source]] suspect this.']);
  });
});

describe('citations of the source', () => {
  it('rewrites author-year, "et al." and parenthetical citations as one source note', () => {
    const r = run(['Vaswani et al. (2017) suspect this. It holds (Vaswani et al., 2017).', 'As Ashish Vaswani writes, it works.']);
    expect(r.paragraphs[0]).toEqual(['[[source]] suspect this. It holds ([[source]]).', 'As [[source]] writes, it works.']);
    expect(r.notes).toEqual([sourceNote(paper)]);
    expect(r.report.cited).toBe(3);
  });

  it('builds the note from metadata only', () => {
    expect(sourceNote(paper)).toEqual({
      id: 'source', kind: 'source', label: 'Vaswani et al.', title: 'Attention Is All You Need',
      detail: 'Vaswani, Shazeer, Parmar and 2 others, 2017', url: 'https://arxiv.org/abs/1706.03762',
    });
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

describe('formula spans', () => {
  it('takes a formula whole where the kit tokenizer stops inside it, but not the words after it', () => {
    expect(run(['The weights sum, wᵢ = e^(sᵢ) / Σⱼ e^(sⱼ), to 1.']).notes[0]).toMatchObject({ formula: 'wᵢ = e^(sᵢ) / Σⱼ e^(sⱼ)' });
    expect(run(['Its spread is σ = √d_k · 1 (see the figure).']).notes[0]).toMatchObject({ formula: 'σ = √d_k · 1' });
    // A marker before the formula is not part of it.
    const notes = [{ id: 'm1', formula: 'v = d_k', plain: 'p' }];
    expect(run(['The variance is d_k.[[m1]] σ = √d_k · 1 follows. Drag it.'], notes).paragraphs[0]).toEqual(['The variance is d_k.[[m1]] Drag it.']);
  });
});
