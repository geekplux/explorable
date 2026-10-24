import { describe, expect, it } from 'vitest';
import { bodyHasFormula, findFormula } from './formula.ts';

// The formula sentences of the v1 samples (before the plain-words rewrite).
const FORMULAS = [
  'Scores can be any real number, so attention turns them into weights with a softmax, `wᵢ = exp(sᵢ / T) / Σⱼ exp(sⱼ / T)`. The weights are positive.',
  'How much a weight moves when a score moves is `∂wᵢ/∂sⱼ = wᵢ(δᵢⱼ − wⱼ)`.',
  'A dot product of two d_k-dimensional vectors is a sum of d_k products, `q·k = Σᵢ qᵢkᵢ`.',
  'Their remedy is one division. Scaled dot-product attention is `softmax(QKᵀ / √d_k) · V`.',
  'After n words a bit is still 0 with probability `(1 − 1/m)^(kn) ≈ e^(−kn/m)`.',
  'A word you never added is a false positive when all k of its bits are 1, which gives `FPR ≈ (1 − e^(−kn/m))^k`.',
  'For m = 32, n = 8 and k = 3 that is `(1 − e^(−0.75))³ ≈ 14.7%`.',
  'This one happens to have 20 of its 32 bits set rather than the expected 17, and `(20/32)³ ≈ 24%`.',
  'Setting the derivative to zero gives `k = (m/n)·ln 2`, the point where about half the bits are set.',
  'There the false-positive rate is `(1/2)^k ≈ 0.6185^(m/n)`.',
  'Each step adds a little fresh Gaussian noise: `x_t = √(1 − β_t)·x_(t−1) + √β_t·ε`, with ε drawn from N(0, 1).',
  'If x_(t−1) already has variance 1, the new value has variance `(1 − β_t) + β_t = 1`.',
  'Multiply the shrink factors together, `ᾱ_t = (1 − β₁)(1 − β₂)…(1 − β_t)`, and the chain collapses.',
  'They cross where the signal-to-noise ratio `ᾱ_t / (1 − ᾱ_t)` is exactly 1.',
  // The same formulas without code ticks, as a model might write them.
  'Its one error is a false “maybe”, at a rate near (1 − e^(−kn/m))^k, which is lowest when k ≈ (m/n)·ln 2 and half the bits are set.',
  'Their product ᾱ_t gives a one-line jump to any step, x_t = √ᾱ_t·x₀ + √(1 − ᾱ_t)·ε, and by t = 1,000 any data has become N(0, 1).',
  'Each weight is wᵢ = exp(sᵢ/T) / Σⱼ exp(sⱼ/T).',
  'The rate is about e^(−kn/m) raised to k, or 1 - x * y + z in code terms.',
  'The score is the sum Σ qᵢkᵢ over the components.',
  'A gradient ∂L/∂w tells you which way to move.',
  'The area under the curve is ∫ f(x) dx.',
  'In LaTeX that is \\frac{1}{\\sqrt{d_k}}.',
  'Written as x^{2} it is plain.',
  'The energy is E = mc².',
  'A line is y = 2x + 1.',
  'It cools as T(t) = Tₐ + (T₀ − Tₐ)·e^(−kt) from any start.',
];

// Plain rewrites and settings that read as words: a variable, a value, one root or one operation.
const PLAIN = [
  'Scores can be any real number, so attention turns them into weights with a softmax.[[m1]] The weights are positive and add up to 1.',
  'The asking word holds a *query* vector q, each word it looks at offers a *key* vector k, and their dot product `q·k` is a score.',
  'The one knob is the temperature T, which divides every score before the softmax. Drag it.',
  'At T = 1, “cat” gets about half of the attention. Drag T down to 0.25 and “cat” takes 98%: the entropy falls from 2.05 bits to 0.15.',
  'Push T up to 5 and the weights flatten toward 1/6 each, close to the 2.58-bit maximum for six words.',
  'A dot product of two d_k-dimensional vectors is a sum of d_k products, one for each pair of matching components.[[m3]]',
  'So the score has variance d_k and a standard deviation of √d_k.',
  'The figure draws one query and eight keys at random, with components from N(0, 1).',
  '[[vaswani]] suspect exactly this. Their remedy is one division: every score is divided by √d_k before the softmax.[[m4]]',
  'In the paper’s base model d_k = 64, so without the division the scores would be 8 times too spread out, the same as running the softmax at T = 1/8.',
  'Dividing by √d_k is the temperature knob from the first figure, set to T = √d_k so the scores always arrive at unit scale.',
  'Dividing by d_k would shrink the spread to 1/√d_k, which is 0.04 at d_k = 512.',
  'A bit stays 0 only if every one of the k·n hashes so far has missed it.',
  'For m = 32, n = 8 and k = 3 that comes to about 14.7%.',
  'The best k is about 0.69 times the number of bits per word, m divided by n.',
  'Multiply the numbers 1 − β_t of every step so far, call the product ᾱ_t, and the chain from x₀ collapses into one line.',
  'The first part, √ᾱ_t, is how much of the original signal is left.',
  'They cross at t ≈ 260, where ᾱ_t = 0.5: a signal-to-noise ratio of exactly 1, or 0 decibels (dB).',
  'DDPM uses T = 1,000 steps, with β rising in equal increments from 0.0001 at the first step to 0.02 at the last.',
  'Our data is 2,000 numbers drawn from two clumps, one around −2 and one around +1.5, each with a spread of 0.25.',
  'T cells, Mr. T, the A-team, and/or the e.g. clause; it costs 5 m/s, in 2017–2020, at 10:30.',
  'The k-means method, the 3-4 split and a well-known fact.',
  'A field of 5 km² and a box of 20 cm³.',
  'Pick one (and/or both) of them; the ratio is 3/4 or so.',
];

describe('bodyHasFormula', () => {
  it.each(FORMULAS)('flags %s', (text) => {
    expect(bodyHasFormula(text)).toBe(true);
  });

  it.each(PLAIN)('lets %s through', (text) => {
    expect(findFormula(text)).toBeNull();
  });

  it('names the stretch that reads like a formula', () => {
    expect(findFormula('It is `q·k = Σᵢ qᵢkᵢ`, a sum.')).toBe('`q·k = Σᵢ qᵢkᵢ`');
    expect(findFormula('So x_t = √ᾱ_t·x₀ + √(1 − ᾱ_t)·ε holds.')).toBe('x_t = √ᾱ_t·x₀ + √(1 − ᾱ_t)·ε');
    expect(findFormula('So T(t) = Tₐ + (T₀ − Tₐ)·e^(−kt) for all t.')).toBe('T(t) = Tₐ + (T₀ − Tₐ)·e^(−kt)');
  });

  it('ignores note markers and emphasis', () => {
    expect(bodyHasFormula('A softmax.[[m1]] Then *T* = 1.')).toBe(false);
    expect(bodyHasFormula('')).toBe(false);
  });
});
