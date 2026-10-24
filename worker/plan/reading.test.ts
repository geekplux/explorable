import { describe, expect, it } from 'vitest';
import attention from '../../src/samples/attention.json';
import type { ExplorableDoc } from '../../skills/explorable/kit/src/doc/schema.ts';
import { fleschKincaid, readingLevel, syllables } from './reading';

describe('reading level', () => {
  it('counts syllables by vowel groups, minus a silent ending', () => {
    const words = { the: 1, cat: 1, probability: 5, temperature: 4, divides: 2, based: 1, include: 2, convolutional: 5, neural: 2, sequence: 2, '2017': 1, 'd_k': 1 };
    for (const [word, n] of Object.entries(words)) expect([word, syllables(word)]).toEqual([word, n]);
  });

  it('grades known passages (counted by hand)', () => {
    // 9 words, 2 sentences, 9 syllables: 0.39 × 4.5 + 11.8 × 1 − 15.59.
    expect(fleschKincaid(['The cat sat on the mat. The dog ran.'])).toEqual({ grade: -2, words: 9, sentences: 2 });
    // The first sentence of the attention paper's abstract: 21 words, 1 sentence, 41 syllables.
    const abstract = 'The dominant sequence transduction models are based on complex recurrent or convolutional neural networks that include an encoder and a decoder.';
    expect(fleschKincaid([abstract])).toEqual({ grade: 15.6, words: 21, sentences: 1 });
    // A passage with no closing punctuation is one sentence; an empty one counts nothing.
    expect(fleschKincaid(['Drag T down', ''])).toMatchObject({ words: 3, sentences: 1 });
    expect(fleschKincaid([])).toEqual({ grade: 0, words: 0, sentences: 0 });
  });

  it("grades a doc's paragraphs and takeaway, reading a source marker as its label", () => {
    const doc = attention as ExplorableDoc;
    const level = readingLevel(doc);
    expect(level.grade).toBeGreaterThan(6);
    expect(level.grade).toBeLessThan(12);
    // "[[vaswani]] suspect exactly this" reads "Vaswani et al. suspect exactly this": three words, no sentence break.
    const one = { ...doc, sections: [{ ...doc.sections[0]!, paragraphs: ['[[vaswani]] suspect this.[[m1]]'] }], takeaway: 'Done.' };
    expect(readingLevel(one)).toMatchObject({ words: 6, sentences: 2 });
  });
});
