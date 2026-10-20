# Sample `attention`: Why attention divides by √d

Shared rules (formats, keyboard, encodings, motion, RNG, invented fields) are in [samples.md](samples.md). This file has the essay, both figure specs, the reference values and the JSON skeleton for `src/samples/attention.json`.

- **Title:** Why attention divides by √d
- **Dek:** Dot products of random d-dimensional vectors spread out like √d, which pushes a softmax into a one-hot spike. Dividing the scores by √d_k keeps them at unit scale, so attention stays soft and trainable.
- **Source:** Ashish Vaswani, Noam Shazeer, Niki Parmar, Jakob Uszkoreit, Llion Jones, Aidan N. Gomez, Łukasz Kaiser, Illia Polosukhin. *Attention Is All You Need*. 2017. arXiv:1706.03762, https://arxiv.org/abs/1706.03762
- **Gallery thumbnail:** Fig 1 at its default state (T = 1).

## Essay flow

| # | Section id | Heading | Figure | Reader's job |
|---|---|---|---|---|
| 1 | `scores-to-weights` | From scores to weights | `fig-temperature` | Meet softmax with one knob. |
| 2 | `sharp-or-soft` | Sharp or soft is a matter of scale | none | Name what they found: scale, not order, sets the sharpness. Why saturation stops learning. |
| 3 | `where-scale-comes-from` | Where the scale comes from | `fig-scaling` | Drag d_k with no scaling and watch the softmax saturate. |
| 4 | `divide-by-root-d` | The fix: divide by √d_k | none (it points back to Fig 2's switch) | Flip the switch; see why √d_k, not d_k. |

Progressive disclosure: Fig 1 isolates softmax with hand-fixed scores. Fig 2 replaces the hand-fixed scores with real random dot products. Section 4 shows that the paper's √d_k is the same temperature knob from Fig 1, set automatically to T = √d_k.

The full prose is in the JSON skeleton at the end. It is first-draft quality and ready to transcribe.

---

## Fig 1: `fig-temperature` (kind `bars`, model `softmax-temperature`, Phase 4)

**Idea.** Softmax sharpness depends only on the scale of the scores. Dividing by a temperature T changes the scale while keeping the order.

**Model.** `softmax-temperature`. Registry params:

| Param | Label | Min | Max | Step | Default | Unit | Scale | Control |
|---|---|---|---|---|---|---|---|---|
| `T` | temperature | 0.05 | 5 | 0.01 | 1 | – | log | range (with knob) |
| `n` | number of items | 2 | 8 | 1 | 6 | – | linear | not exposed |
| `s1` … `s8` | score 1 … 8 | −10 | 10 | 0.01 | 0 | – | linear | not exposed |

`compute`: `zᵢ = sᵢ / T` for i = 1…n. Subtract `max z` for stability. `wᵢ = exp(zᵢ − max) / Σ exp(zⱼ − max)`. Entropy `H = −Σ wᵢ log₂ wᵢ`, with terms where `wᵢ = 0` counted as 0. `top = max wᵢ`. `topIndex = argmax` (the first index wins a tie).

Outputs: `weights` (number[n]), `top` (label "top weight", fixed2), `entropy` (label "entropy", unit "bits", fixed2), `topIndex` (int).

**Doc params (fixed, hand-chosen and illustrative):** query token "sat" over the six tokens of "the cat sat on the mat", with scores `s = [0.3, 2.5, 1.2, 0.4, 0.3, 1.4]`. "cat" is the most relevant, "mat" second and "sat" itself third. The two "the" tokens share a score on purpose: their bars stay equal at every T, which is a quiet check that the weights depend only on the score.

**Controls.** `T`, on a log track under the bars with the ring knob. Ticks are labelled 0.1, 0.5, 1, 2 and 5. The track position is `log(T)`. The same `T` is on a native range in the controls row, with an `<output>` showing `T = 1.00`. Keyboard follows the log rule in samples.md §5 (Arrow ≈ ×1.047, PageUp ≈ ×1.585). `aria-valuetext`: "temperature 1.00" on the native range; the knob (named "temperature (drag on chart)") uses the value only, "1.00" (see DECISIONS.md).

**Drawing.**
- Six vertical bars in token order. The x labels are the tokens.
- The y axis is weight, from 0 to 1, **fixed** (never autoscaled, otherwise flattening would be invisible). Gridlines sit at 0.25, 0.5, 0.75 and 1.
- Each bar shows its value label above it (fixed2).
- The maximum bar gets the filled ink ▼ and "top" (samples.md §6). Its value label is bold.
- A chip at the top left reads "query: sat".
- All bars are cobalt with an ink outline. One series, so no legend.

**Readouts.** `["top", "entropy"]` → `top weight 0.51 · entropy 2.05 bits`.

**Live description (`describe`).** `Temperature {T fixed2}: “{label of top}” gets {round(top·100)}% of the attention; entropy {entropy fixed2} bits.` At the default: "Temperature 1.00: “cat” gets 51% of the attention; entropy 2.05 bits." At T = 0.5: "… “cat” gets 82% …" (P4 AC 4 quotes 81 % as an example; with these scores the true value is 81.66 %, so 82 %).

**Show data table.** Columns: `#`, `token`, `score`, `weight` (fixed3), with rows in token order. Position numbers keep the two "the" rows apart.

**States to discover.**
1. Default T = 1: "cat" about half, the rest shared.
2. Drag down to T = 0.5: "cat" at 0.82 and entropy at 1.01 bits.
3. T = 0.25: 0.98 and 0.15 bits. At T ≤ 0.1 it is effectively one-hot (0.99998 and 0.00 bits).
4. Drag up to T = 5: everything is near 1/6 and entropy is 2.57 bits, near the 2.58-bit ceiling (log₂ 6).
5. Through all of it the ranking never changes and the two "the" bars stay equal.

**Alt (static).** "Bar chart of how much attention the word “sat” pays to each word of “the cat sat on the mat” at temperature 1: cat 0.51, mat 0.17, sat 0.14, on 0.06, and each “the” 0.06. Lower temperatures sharpen the bars into a single spike on “cat”."

**Caption.** "The scores are fixed by hand; the softmax is computed live. Drag the temperature T and watch one word take over or the weights even out."

**Reduced motion.** Bars and labels jump to the new value; no follow easing; no nudge (a static dashed ring with "drag" instead).

### Fixtures (`softmax-temperature`)

Plan fixture (P4 AC 1): scores `[2, 1, 0.1]`, T = 1 → `[0.6590, 0.2424, 0.0986]`.

Sample scores `[0.3, 2.5, 1.2, 0.4, 0.3, 1.4]` (the, cat, sat, on, the, mat):

| T | weights (the, cat, sat, on, the, mat) | top | entropy (bits) |
|---|---|---|---|
| 0.05 | 0.00000 1.00000 0.00000 0.00000 0.00000 0.00000 | 1.000000 | 0.00000 |
| 0.1 | 0.00000 0.99998 0.00000 0.00000 0.00000 0.00002 | 0.999981 | 0.00033 |
| 0.25 | 0.00015 0.98201 0.00542 0.00022 0.00015 0.01206 | 0.982009 | 0.14980 |
| 0.5 | 0.01003 0.81658 0.06065 0.01225 0.01003 0.09048 | 0.816575 | 1.00849 |
| 1 | 0.05684 0.51296 0.13980 0.06282 0.05684 0.17075 | 0.512961 | 2.04735 |
| 2 | 0.10687 0.32106 0.16761 0.11235 0.10687 0.18524 | 0.321061 | 2.45264 |
| 5 | 0.14253 0.22130 0.17064 0.14541 0.14253 0.17760 | 0.221303 | 2.56533 |

Near-equal scores for P4 AC 1: `[0.1, 0, 0.05, 0, 0.1, 0]` at T = 5 → entropy 2.58490 bits, against log₂ 6 = 2.58496.

Test tolerances: ±1e-4 on weights, ±1e-4 on entropy.

### Acceptance criteria for the implementer (Fig 1, in addition to P4)

1. The y axis is fixed at 0 to 1 at every T.
2. The two "the" bars have identical heights at all 7 fixture temperatures (a DOM test on bar heights).
3. The top marker is ▼ plus the text "top", not a ring (or the deviation is recorded in DECISIONS.md).
4. With the knob at T = 0.25, the readout reads exactly `top weight 0.98 · entropy 0.15 bits`.
5. Home sets T = 0.05 and the readout shows `top weight 1.00 · entropy 0.00 bits`. End sets T = 5.00 and it shows `top weight 0.22 · entropy 2.57 bits`.

---

## Fig 2: `fig-scaling` (kind `bars`, model `attention-scaling`, Phase 5)

**Idea.** Without scaling, the spread of dot-product scores grows like √d_k, so softmax saturates as the vectors get wider. Dividing by √d_k holds the spread near 1 at every width.

**Model.** `attention-scaling`. Registry params:

| Param | Label | Min | Max | Step | Default | Unit | Scale | Control |
|---|---|---|---|---|---|---|---|---|
| `dk` | key width d_k | 1 | 512 | 1 | 4 | dimensions | log | range (with knob) |
| `scaled` | divide by √d_k | 0 | 1 | 1 | 0 | – | linear | toggle (`role="switch"`) |
| `seed` | seed | 0 | 2³²−1 | 1 | 229 | – | linear | not exposed |

`compute`:
- `rng = mulberry32(seed)`. Draw in this order, one normal per two uniforms (samples.md §8): `q[0..511]`, then `key₁[0..511]`, `key₂[0..511]`, … `key₈[0..511]`. That is 4,608 normals, drawn **once per seed and cached**, so dragging d_k only re-sums.
- For width d, use the first d components (prefix vectors): `rawⱼ = Σ_{i<d} q[i]·keyⱼ[i]`. The vectors grow as you drag instead of being redrawn, so the figure changes continuously.
- `scoresⱼ = scaled ? rawⱼ / √d : rawⱼ`.
- `weights = softmax(scores)` (stable). `weightsOther` = softmax of the other toggle state.
- `sd` = the **sample** standard deviation of the 8 scores (divide by 7). `sdExpected = scaled ? 1 : √d`.
- `top`, `entropy` (bits) and `topIndex` as in Fig 1.

Outputs: `scores` (number[8]), `weights` (number[8]), `weightsOther` (number[8]), `sd` (label "score SD", fixed2), `sdExpected` (fixed2), `top` (label "top weight", fixed2), `entropy` (label "entropy", unit "bits", fixed2), `topIndex` (int).

**Seed choice (be honest about it).** The SD of 8 scores is a small-sample estimate. Seed 229 was chosen from seeds 1 to 5,000 as the first seed that meets all of these: at every power of two from 1 to 512 the scaled SD lies within 0.75 to 1.3; unscaled, the top weight is below 0.6 at d_k = 4, above 0.95 at d_k = 64, and above 0.99 at d_k = 256 and 512; scaled, the top weight at d_k = 64 is below 0.6. It is a representative draw, not a special one. The figure always prints the expected value beside the sample SD (see the score strip), so the reader can compare the two.

**Controls.**
- `dk` as a log track with the ring knob, ticks at 1, 8, 64 and 512, plus a native range. `aria-valuetext`: "key width d k 64 dimensions".
- `scaled` as a labelled switch, "divide by √d_k", in the controls row. Its accessible name is "divide scores by square root of d k".
- Keyboard: log rule for `dk`; Space or Enter toggles the switch.

**Drawing.**
- Eight bars labelled k₁ … k₈ (`options.labels`), with a fixed y axis from 0 to 1. Value labels (fixed2), and the ▼ "top" marker as in Fig 1. Cobalt fill with an ink outline.
- `options.compare = true`: a dashed ink outline bar over each bar shows `weightsOther`. A legend (two series) shows a solid swatch for "this setting" and a dashed outline for "with ÷√d_k" or "without ÷√d_k" (the text follows the toggle).
- `options.scoreStrip = true` (should, may be deferred): above the bars, a number line from −32 to 32 with ticks every 8. It has 8 ink circle markers at the scores, each labelled with its key index. Scores outside the line are drawn as a ▶ or ◀ at the edge with the value. A dotted ink bracket spans ±`sdExpected`, labelled "expected ±√d_k = ±8.00" (unscaled) or "expected ±1" (scaled). A solid ink bracket spans ±`sd`, labelled "measured ±7.93". The strip shows the cause; the bars show the effect.
- A small "query: random q" chip, and the caption explains that q and k are random.

**Readouts.** `["sd", "top", "entropy"]` → `score SD 2.02 · top weight 0.57 · entropy 1.85 bits`.

**Live description.** `d_k = {dk}, {scaled ? "divided by √d_k" : "not scaled"}: scores spread with SD {sd fixed2} (expected {sdExpected fixed2}); key {topIndex+1} gets {round(top·100)}% of the weight.` Write the screen-reader variant in words: "square root of d k".

**Show data table.** Columns: `key`, `score` (fixed3), `weight` (fixed3), `weight with other setting` (fixed3).

**States to discover.**
1. Default (d_k = 4, not scaled): the weights are soft-ish, with k₄ at 0.57.
2. Drag d_k to 64, unscaled: the SD is about 8 and k₇ takes 0.9998 of the weight, a one-hot. The dashed outlines (the scaled weights) stay spread out.
3. Drag d_k to 512: the SD is about 24 and the spike is total. Which key wins can change as dimensions are added; there is always exactly one winner.
4. Flip "divide by √d_k": the SD drops to about 1 and stays there from 1 to 512. Entropy stays near 2 to 2.7 bits.
5. At d_k = 1 the switch has no effect (√1 = 1). Both states are identical, which is a sanity check.

**Alt (static).** "Bar chart of softmax attention weights over eight random keys for key width d_k = 4 without scaling: weights are uneven, with key 4 highest at 0.57. As d_k grows toward 512 the unscaled weights collapse onto one key, while dividing by √d_k keeps them spread out."

**Caption.** "The query q and the eight keys are random, with N(0, 1) components (seed 229). Drag the width d_k; switch the √d_k division on and off. Dashed outlines show the other setting."

**Reduced motion.** Instant updates. The switch changes state with no transition.

### Fixtures (`attention-scaling`, seed 229, sample SD with divisor 7)

| d_k | unscaled SD | unscaled top (key) | unscaled H (bits) | scaled SD | scaled top (key) | scaled H (bits) | √d_k |
|---|---|---|---|---|---|---|---|
| 1 | 1.0664 | 0.3092 (k₃) | 2.5081 | 1.0664 | 0.3092 (k₃) | 2.5081 | 1.000 |
| 2 | 1.3199 | 0.3452 (k₃) | 2.3400 | 0.9333 | 0.2844 (k₃) | 2.6059 | 1.414 |
| 4 | 2.0162 | 0.5738 (k₄) | 1.8542 | 1.0081 | 0.3412 (k₄) | 2.5778 | 2.000 |
| 8 | 2.2626 | 0.7489 (k₄) | 1.3126 | 0.7999 | 0.3340 (k₄) | 2.6571 | 2.828 |
| 16 | 3.4911 | 0.4834 (k₂) | 1.5957 | 0.8728 | 0.2475 (k₂) | 2.6936 | 4.000 |
| 32 | 4.7755 | 0.9221 (k₇) | 0.4256 | 0.8442 | 0.3332 (k₇) | 2.6228 | 5.657 |
| 64 | 7.9282 | 0.9998 (k₇) | 0.0025 | 0.9910 | 0.4797 (k₇) | 2.3100 | 8.000 |
| 128 | 10.0112 | 1.0000 (k₇) | 0.0001 | 0.8849 | 0.4485 (k₇) | 2.4289 | 11.314 |
| 256 | 19.8407 | 0.9976 (k₁) | 0.0272 | 1.2400 | 0.2897 (k₁) | 2.5213 | 16.000 |
| 512 | 23.9455 | 1.0000 (k₁) | 0.0000 | 1.0583 | 0.6059 (k₁) | 1.9985 | 22.627 |

Full vectors for snapshot tests:
- d_k = 4, unscaled scores: `1.6296 −0.1152 −0.4700 2.9303 −0.7801 −3.7044 1.6703 0.4067`; weights `0.1563 0.0273 0.0191 0.5738 0.0140 0.0008 0.1628 0.0460`.
- d_k = 4, scaled scores: `0.8148 −0.0576 −0.2350 1.4651 −0.3900 −1.8522 0.8352 0.2034`; weights `0.1781 0.0744 0.0623 0.3412 0.0534 0.0124 0.1817 0.0966`.
- d_k = 64, unscaled scores: `2.8841 1.2931 −9.0573 −12.6939 −3.9898 −3.5474 11.7376 −9.1697`; weights `0.0001 0.0000 0.0000 0.0000 0.0000 0.0000 0.9998 0.0000`.
- d_k = 64, scaled scores: `0.3605 0.1616 −1.1322 −1.5867 −0.4987 −0.4434 1.4672 −1.1462`; weights `0.1586 0.1300 0.0357 0.0226 0.0672 0.0710 0.4797 0.0352`.

Tolerance ±1e-3 on scores, ±1e-4 on weights and SD. P5 AC 4 ("SD ≈ 1 ±0.3 over seeds" when scaled) holds for seed 229 at every row above (0.80 to 1.24). For a multi-seed property test, use the mean of the scaled SD over seeds 1 to 50 at d_k = 64. It is 1.0014 (assert within 1 ± 0.1). Do not assert ±0.3 on every individual seed: with 8 keys, 14 of those 50 seeds fall outside (range 0.37 to 1.89), and that is honest sampling noise, not a bug.

### Acceptance criteria for the implementer (Fig 2, in addition to P5)

1. Prefix property: going from d to d + 1 does not change `q[0..d−1]` (a unit test on the cached normals).
2. Seed 229 reproduces the fixture table above within tolerance.
3. With `scaled = 0`, the dashed outlines show the scaled weights, and vice versa. The legend text follows the toggle.
4. At d_k = 1, toggling `scaled` changes no number in the readout.
5. The switch has `role="switch"` and `aria-checked`, and works with Space and Enter.

---

## JSON skeleton (`src/samples/attention.json`)

```json
{
  "schema": 1,
  "id": "attention",
  "title": "Why attention divides by √d",
  "dek": "Dot products of random d-dimensional vectors spread out like √d, which pushes a softmax into a one-hot spike. Dividing the scores by √d_k keeps them at unit scale, so attention stays soft and trainable.",
  "source": {
    "kind": "arxiv",
    "url": "https://arxiv.org/abs/1706.03762",
    "title": "Attention Is All You Need",
    "authors": ["Ashish Vaswani", "Noam Shazeer", "Niki Parmar", "Jakob Uszkoreit", "Llion Jones", "Aidan N. Gomez", "Łukasz Kaiser", "Illia Polosukhin"],
    "year": 2017
  },
  "provenance": { "mode": "curated", "generatedAt": "2026-10-19T00:00:00.000Z" },
  "sections": [
    {
      "id": "scores-to-weights",
      "heading": "From scores to weights",
      "paragraphs": [
        "A transformer reads a sentence by letting every word ask a question of every other word. The asking word holds a *query* vector q, each word it looks at offers a *key* vector k, and their dot product `q·k` is a score: how relevant that word looks. Scores can be any real number, so attention turns them into weights with a softmax, `wᵢ = exp(sᵢ / T) / Σⱼ exp(sⱼ / T)`. The weights are positive and add up to 1.",
        "Below, the word “sat” is asking about the six words of “the cat sat on the mat”. The scores are fixed by hand so you can watch the softmax on its own. The one knob is the temperature T, which divides every score before the softmax. Drag it."
      ],
      "figure": {
        "id": "fig-temperature",
        "kind": "bars",
        "title": "Temperature sets how sharp the softmax is",
        "caption": "The scores are fixed by hand; the softmax is computed live. Drag the temperature T and watch one word take over or the weights even out.",
        "alt": "Bar chart of how much attention the word “sat” pays to each word of “the cat sat on the mat” at temperature 1: cat 0.51, mat 0.17, sat 0.14, on 0.06, and each “the” 0.06. Lower temperatures sharpen the bars into a single spike on “cat”.",
        "model": {
          "id": "softmax-temperature",
          "params": { "T": 1, "n": 6, "s1": 0.3, "s2": 2.5, "s3": 1.2, "s4": 0.4, "s5": 0.3, "s6": 1.4 }
        },
        "controls": ["T"],
        "readouts": ["top", "entropy"],
        "options": { "labels": ["the", "cat", "sat", "on", "the", "mat"], "query": "sat", "handle": "T" }
      }
    },
    {
      "id": "sharp-or-soft",
      "heading": "Sharp or soft is a matter of scale",
      "paragraphs": [
        "At T = 1, “cat” gets about half of the attention and the rest is shared. Drag T down to 0.25 and “cat” takes 98%: the entropy, a measure of how spread out the weights are, falls from 2.05 bits to 0.15. Push T up to 5 and the weights flatten toward 1/6 each, close to the 2.58-bit maximum for six words. The order of the scores never changes. Only their scale does, and the scale alone decides whether attention is a spotlight or a floodlight.",
        "The spotlight end is a problem for learning. How much a weight moves when a score moves is `∂wᵢ/∂sⱼ = wᵢ(δᵢⱼ − wⱼ)`. When one weight is nearly 1 and the rest are nearly 0, every one of those terms is nearly 0, so a training signal that tries to move attention elsewhere barely registers. A saturated softmax has stopped listening."
      ]
    },
    {
      "id": "where-scale-comes-from",
      "heading": "Where the scale comes from",
      "paragraphs": [
        "Nobody sets a temperature by hand inside a transformer. The scale of the scores comes from the vectors themselves. A dot product of two d_k-dimensional vectors is a sum of d_k products, `q·k = Σᵢ qᵢkᵢ`. If every component is random with mean 0 and variance 1, each product also has mean 0 and variance 1, and the variances of independent terms add up. So the score has variance d_k and a standard deviation of √d_k.",
        "The figure draws one query and eight keys at random, with components from N(0, 1), and shows the softmax of their eight scores with no scaling at all. Drag d_k, the width of the vectors, from 1 to 512. The scores spread out roughly as √d_k, and a softmax that is soft at d_k = 4 turns into a single spike long before 512."
      ],
      "figure": {
        "id": "fig-scaling",
        "kind": "bars",
        "title": "Wider vectors, sharper softmax, unless you divide by √d_k",
        "caption": "The query q and the eight keys are random, with N(0, 1) components (seed 229). Drag the width d_k; switch the √d_k division on and off. Dashed outlines show the other setting.",
        "alt": "Bar chart of softmax attention weights over eight random keys for key width d_k = 4 without scaling: weights are uneven, with key 4 highest at 0.57. As d_k grows toward 512 the unscaled weights collapse onto one key, while dividing by √d_k keeps them spread out.",
        "model": { "id": "attention-scaling", "params": { "dk": 4, "scaled": 0, "seed": 229 } },
        "controls": ["dk", "scaled"],
        "readouts": ["sd", "top", "entropy"],
        "options": { "labels": ["k₁", "k₂", "k₃", "k₄", "k₅", "k₆", "k₇", "k₈"], "query": "random q", "handle": "dk", "compare": true, "scoreStrip": true }
      }
    },
    {
      "id": "divide-by-root-d",
      "heading": "The fix: divide by √d_k",
      "paragraphs": [
        "Vaswani et al. suspect exactly this: for large d_k the dot products grow large in magnitude and push the softmax into regions where its gradients are extremely small. Their remedy is one division. Scaled dot-product attention is `softmax(QKᵀ / √d_k) · V`. A score whose spread is √d_k, divided by √d_k, has a spread of about 1, whatever the width.",
        "Turn on “divide by √d_k” in the figure above and drag d_k again. The spread now stays near 1 and the weights stay soft at every width. In the paper's base model d_k = 64, so without the division the scores would be 8 times too spread out, the same as running the softmax at T = 1/8. Dividing by √d_k is the temperature knob from the first figure, set to T = √d_k so the scores always arrive at unit scale.",
        "Why the square root and not d_k itself? Dividing by d_k would shrink the spread to 1/√d_k, which is 0.04 at d_k = 512, and the weights would be nearly uniform: attention would see nothing. √d_k is the one choice that keeps the spread fixed as the width changes."
      ]
    }
  ],
  "takeaway": "The sharpness of a softmax depends on the scale of its scores, not just their order. Dot products of d_k-dimensional vectors spread out like √d_k, so attention divides by √d_k: a fixed temperature that hands the softmax unit-scale scores at any width."
}
```
