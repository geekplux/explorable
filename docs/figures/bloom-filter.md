# Sample `bloom-filter`: How a Bloom filter says “maybe”

Shared rules (formats, keyboard, encodings, motion, invented fields) are in [samples.md](samples.md). This file has the essay, both figure specs, the reference values and the JSON skeleton for `src/samples/bloom-filter.json`.

- **Title:** How a Bloom filter says “maybe”
- **Dek:** A Bloom filter stores a set as a handful of bits. It can say “maybe” to a word it never saw, but never “no” to one it did, and the number of hashes sets how often that “maybe” is wrong.
- **Source:** Bill Mill, *Bloom Filters by Example*, https://llimllib.github.io/bloomfilter-tutorial/ (blog; no year given, so `year` is omitted).
- **Gallery thumbnail:** Fig 1 at its default state (k = 3, n = 8, query "cat").

## Essay flow

| # | Section id | Heading | Figure | Reader's job |
|---|---|---|---|---|
| 1 | `a-set-made-of-bits` | A set made of bits | none | Learn the write path and read path in two paragraphs. |
| 2 | `watch-it-fill` | Watch it fill up | `fig-bits` | Insert words, ask about cat (yes), plum (no) and cherry (false maybe). |
| 3 | `why-no-is-always-true` | Why “no” is always true | none (it points back to Fig 1) | Bits only turn on, so errors run one way. Watch "hen" say maybe before it is inserted. |
| 4 | `predicting-false-positives` | Predicting the false positives | none (it points back to Fig 1's readouts) | Derive (1 − e^(−kn/m))^k. Compare predicted with observed, honestly. |
| 5 | `choosing-k` | Choosing k | `fig-fpr-curve` | See the trade-off in k and the optimum k = (m/n)·ln 2. |

Progressive disclosure: Fig 1 is concrete (12 named words, 32 visible bits, one query at a time). Its readouts introduce the predicted and observed rates that section 4 explains. Fig 2 abstracts the same model into a curve over n, with m and k free.

The full prose is in the JSON skeleton at the end.

---

## Fig 1: `fig-bits` (kind `bits`, model `bloom-filter`, Phase 5)

**Idea.** Inserting sets bits that never clear, so a member always answers "maybe" and a non-member answers "definitely not" unless other words happen to cover all of its bits.

**Model.** `bloom-filter`. Registry params:

| Param | Label | Min | Max | Step | Default | Unit | Control |
|---|---|---|---|---|---|---|---|
| `m` | bits | 32 | 32 | 1 | 32 | bits | not exposed (fixed at 32 in v1, so the `/ 32` unit is static) |
| `k` | hashes per word | 1 | 6 | 1 | 3 | hashes | range |
| `n` | words inserted | 0 | 12 | 1 | 8 | words | range (with knob) |
| `q` | ask about | 0 | 5 | 1 | 0 | – | choice; `choices` = `QUERIES` |

**Word lists (model constants, exported for tests and the table; finance-free).**
- `INSERT` (inserted in this order; n takes the first n): `cat, dog, owl, fox, bee, elk, yak, eel, ant, bat, cow, hen`.
- `QUERIES` (the radio group): `cat, owl, plum, cherry, banana, hen`.
- `PROBES` (50 words never inserted, used for the observed rate): `apple, pear, plum, kiwi, lime, lemon, mango, peach, grape, melon, cherry, date, fig, guava, papaya, olive, quince, apricot, banana, orange, lychee, durian, carrot, potato, onion, garlic, leek, pea, bean, corn, kale, radish, turnip, celery, squash, pumpkin, tomato, pepper, spinach, lettuce, cabbage, beet, okra, yam, ginger, basil, mint, sage, thyme, parsley`.

All words are lowercase ASCII, so a string's UTF-8 bytes equal its `charCodeAt` values.

**Hashing (deterministic double hashing).**
- `h1 = fnv1a32(word)`: offset basis `0x811c9dc5`, prime `0x01000193`; per byte `h ^= byte; h = Math.imul(h, 0x01000193) >>> 0`.
- `h2 = fmix32(h1)`, the Murmur3 32-bit finalizer: `h ^= h >>> 16; h = Math.imul(h, 0x85ebca6b) >>> 0; h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35) >>> 0; h ^= h >>> 16`.
- `a = h1 mod m`. `b = (h2 mod m) | 1`. b is odd, so for m = 32 the k probes are always k distinct cells.
- Probe i (i = 0 … k − 1) = `(a + i·b) mod m`.

*Why not a second FNV of a salted string?* With m = 32 only the low 5 bits matter, and FNV-1a's low bits of `word + "#"` are a function of the low bits of `fnv1a(word)`. That made b depend on a, so whole probe patterns collided and k barely mattered. The finalizer mixes high bits into low bits. I tested this against theory with random words (200 filters × 300 queries): the mean false-positive rate at n = 8 is 0.224, 0.159, 0.157, 0.201, 0.234 and 0.289 for k = 1 to 6, against predicted 0.221, 0.155, 0.147, 0.160, 0.185 and 0.220. The excess at high k is a known effect of double hashing with only 16 possible strides at m = 32. It is real behaviour, not a bug.

**compute(p).**
- `bits`: OR in the probes of `INSERT[0..n−1]`.
- `probes`: the probes of `QUERIES[q]`.
- `queryState`: 1 = maybe (true positive) if `QUERIES[q]` is in `INSERT[0..n−1]`; else 2 = maybe (false positive) if every probe bit is 1; else 0 = definitely not.
- `firstZero`: the first probe in probe order whose bit is 0, or −1.
- `bitsSet`: the sum of `bits`.
- `fpr = (1 − e^(−k·n/m))^k`.
- `fpObserved`: the number of `PROBES` words whose k probe bits are all 1.

Outputs:
- `bits` (number[32]), `probes` (number[k]), `queryState` (int), `firstZero` (int);
- `bitsSet`: label "bits set", int, unit "/ 32";
- `fpr`: label "predicted FPR", percent;
- `fpObserved`: label "observed FP", int, unit "/ 50".

**Controls.**
- `n`: the ring knob sits on a track under the word chips, between chip n and chip n + 1, with ticks 0 to 12. There is also a native range. `aria-valuetext`: "words inserted 8".
- `k`: a native range with `<output>` showing "k = 3". `aria-valuetext`: "hashes per word 3".
- `q`: a radio group, "Ask about", with six options. The arrow keys move the selection (native radio behaviour).

**Drawing (SVG).**
1. **Word row:** 12 chips in `INSERT` order. Inserted chips (index < n) have a solid ink outline, ink text and a small "＋" glyph. Chips not yet inserted have a dashed `--ink-3` outline and `--ink-2` text. The row is labelled "inserted:".
2. **Bit strip:** 32 cells of at least 24 px on desktop, 1 row. At < 640 px, 2 rows of 16 (P5 risk note). There is a small index (0 to 31) above each cell in `--ink-2`.
   - A set bit has an ink fill with a paper "1" glyph.
   - An unset bit has a paper fill, a `--rule` border and an `--ink-2` "0" glyph.
   - The glyph always carries the value, so the meaning does not depend on fill alone.
3. **Query:** a chip under the strip reads "cherry?". It has k ink arrows (1.5 px, arrowheads) to its probe cells, and each probed cell gets a 3 px cobalt outline.
   - Definitely not: the `firstZero` cell gets an ink ✕ above it and the label "0 here → definitely not".
4. **Verdict badge** beside the query chip:
   - `queryState 0`: ✕ icon + "definitely not".
   - `queryState 1`: ✓ icon + "maybe (true positive)", plus the note "the filter can't tell this apart from a false positive; the figure knows because it keeps the list".
   - `queryState 2`: 45° hatch background + ! icon + **"maybe (false positive)"** (exact text, which P5 AC 2 asserts). The query chip also gets the hatch.

No colour carries meaning on its own: set and unset have glyphs, probes have arrows and outlines, and the verdict is text plus an icon (and hatch for a false positive).

**Readouts.** `["bitsSet", "fpr", "fpObserved"]` → `bits set 20 / 32 · predicted FPR 14.7% · observed FP 10 / 50`.

**Live description.** `{n} words inserted with k = {k}: {bitsSet} of 32 bits set. “{word}”: {verdict text}. Predicted false-positive rate {fpr}; {fpObserved} of 50 test words came back maybe.`

**Show data table.** Columns: `bit` (0 to 31), `value` (0 or 1), `probed by “{word}”` (yes or blank). Below it, a one-line summary repeats the verdict.

**States to discover (all verified, see the fixtures).**
1. Default (k = 3, n = 8, "cat"): all of cat's bits 7, 4 and 1 are 1. Verdict: maybe (true positive).
2. "plum": bits 11, 8 and 5 → bit 11 is 0 → definitely not.
3. "cherry": bits 24, 19 and 14 are all 1 → **false positive**. At k = 3 cherry lands on exactly fox's three bits (fox is 14, 19, 24), so cherry is a false positive from n = 4 onward. At k = 1 or 2 it is definitely not.
4. "banana": bits 16, 29 and 10, set by dog and elk together. It is a false positive from n = 6 (k = 3) and at every k ≥ 2 (n = 8): a false positive made by several words at once.
5. "hen" (the 12th animal): definitely not until n = 10, **maybe (false positive) at n = 11 before it is inserted**, and maybe (true positive) at n = 12.
6. Drag k from 1 to 6 at n = 8: bits set go 7 → 26, while predicted FPR goes 22.1 % → 15.5 % → 14.7 % → 16.0 % → 18.5 % → 22.0 %, a U shape.
7. n = 0: every query is definitely not, and the predicted and observed rates are both 0.

**Alt (static).** "A row of 32 bits after inserting 8 animal names with 3 hashes each: 20 bits are set. Asking about “cat” finds all 3 of its bits set, so the answer is maybe; “plum” hits a 0 bit, so it is definitely not; “cherry” finds all 3 bits set though it was never added, a false positive."

**Caption.** "Each word is hashed k times and sets k of the 32 bits. Drag n to insert more animals, change k, and pick a word to ask about. Hatching marks a false “maybe”."

**Reduced motion.** Newly set bits appear at once (otherwise a 150 ms opacity fade). Arrows redraw at once. No nudge.

### Fixtures (`bloom-filter`)

**FNV-1a vectors:** `""` → `0x811c9dc5`, `"a"` → `0xe40c292c` (P5 AC 1), `"foobar"` → `0xbf9cf968`.

**Per-word hashes** (h1, h2 = fmix32(h1), a, b, probes for k = 6; the probes for smaller k are the prefix):

| word | h1 | h2 | a | b | probes (k = 6) |
|---|---|---|---|---|---|
| cat | 0x06745c07 | 0xf01dce9c | 7 | 29 | 7,4,1,30,27,24 |
| dog | 0xe668bd09 | 0x91a945a7 | 9 | 7 | 9,16,23,30,5,12 |
| owl | 0xa715b2e5 | 0x4d26b43a | 5 | 27 | 5,0,27,22,17,12 |
| fox | 0xb6f3934e | 0x424c7b24 | 14 | 5 | 14,19,24,29,2,7 |
| bee | 0x51ae487f | 0x25b52ab3 | 31 | 19 | 31,18,5,24,11,30 |
| elk | 0x65885d9d | 0xcea6efed | 29 | 13 | 29,10,23,4,17,30 |
| yak | 0x4ea9c2ec | 0x67921a49 | 12 | 9 | 12,21,30,7,16,25 |
| eel | 0x84774549 | 0x0214095f | 9 | 31 | 9,8,7,6,5,4 |
| ant | 0x1f29dbd6 | 0xb86bec76 | 22 | 23 | 22,13,4,27,18,9 |
| bat | 0x70b773a8 | 0x26afae18 | 8 | 25 | 8,1,26,19,12,5 |
| cow | 0xf78ddc50 | 0xef1d119f | 16 | 31 | 16,15,14,13,12,11 |
| hen | 0x08b4ad08 | 0x1d0ed0e6 | 8 | 7 | 8,15,22,29,4,11 |
| plum | 0xb6adb06b | 0x8296261c | 11 | 29 | 11,8,5,2,31,28 |
| cherry | 0x497ae878 | 0xf89ae55a | 24 | 27 | 24,19,14,9,4,31 |
| banana | 0xd9889f50 | – | 16 | 13 | 16,29,10,23,4,17 |

(banana's h2 is not listed because a and b fully determine the probes.)

**Bit arrays** (index 0 first):

| k | n | bits | set |
|---|---|---|---|
| 3 | 8 | `11001101111010101011010110010111` | 20 |
| 1 | 8 | `00000101010010100000000000000101` | 7 |
| 6 | 8 | `11101111111110101111011111010111` | 26 |
| 3 | 4 | `11001101010000101001000110010000` | 12 |
| 3 | 12 | `11001101111011111011011110110111` | 24 |
| 3 | 0 | all 0 | 0 |

**Query states at n = 8** (TP = maybe, true positive; FP = maybe, false positive; NO = definitely not):

| k | cat | owl | plum | cherry | banana | hen |
|---|---|---|---|---|---|---|
| 1 | TP | TP | NO | NO | NO | NO |
| 2 | TP | TP | NO | NO | FP | NO |
| 3 | TP | TP | NO (firstZero 11) | FP | FP | NO (firstZero 15) |
| 4 | TP | TP | NO | FP | FP | NO |
| 5 | TP | TP | **FP** | FP | FP | NO |
| 6 | TP | TP | NO | FP | FP | NO |

At k = 3: "hen" is NO for n = 0 to 10, FP at n = 11 and TP at n = 12. "cherry" is NO for n = 0 to 3 and FP from n = 4. "banana" is NO for n = 0 to 5 and FP from n = 6.

**Observed false positives out of 50** (rows n, columns k = 1 … 6):

```
n= 0   0  0  0  0  0  0
n= 1   1  0  0  0  0  0
n= 2   1  0  0  0  0  0
n= 3   1  0  0  0  0  0
n= 4   1  1  1  1  1  0
n= 5   4  2  3  4  4  5
n= 6   7  5  7  5  5  6
n= 7   9  8  9  7 10 11
n= 8   9  9 10 11 14 15
n= 9  10 14 16 15 18 21
n=10  10 15 16 15 19 21
n=11  14 17 19 19 23 27
n=12  14 17 19 19 23 27
```

At k = 3, n = 8, the false positives are: cherry, banana, bean, radish, turnip, spinach, lettuce, okra, thyme, parsley.

**Bits set** (rows n, columns k = 1 … 6):

```
n= 0   0  0  0  0  0  0
n= 4   4  8 12 15 17 18
n= 8   7 15 20 22 25 26
n=12  10 19 24 25 28 29
```

**Predicted FPR (1 − e^(−kn/32))^k:**

| n \ k | 1 | 2 | 3 | 4 | 5 | 6 |
|---|---|---|---|---|---|---|
| 1 | 0.0308 | 0.0037 | 0.0007 | 0.0002 | 0.0001 | 0.0000 |
| 2 | 0.0606 | 0.0138 | 0.0050 | 0.0024 | 0.0014 | 0.0009 |
| 4 | 0.1175 | 0.0489 | 0.0306 | 0.0240 | 0.0217 | 0.0216 |
| 6 | 0.1710 | 0.0978 | 0.0796 | 0.0775 | 0.0834 | 0.0949 |
| 8 | 0.2212 | 0.1548 | **0.1469** | 0.1597 | 0.1849 | 0.2198 |
| 10 | 0.2684 | 0.2160 | 0.2252 | 0.2592 | 0.3085 | 0.3683 |
| 12 | 0.3127 | 0.2784 | 0.3080 | 0.3642 | 0.4350 | 0.5126 |

P5 AC 1 fixture: m = 32, k = 3, n = 8 → (1 − e^(−0.75))³ = 0.1469 (±1e-4). The expected number of bits set is 32·(1 − (1 − 1/32)^(kn)) = 17.06 for k = 3, n = 8. This filter has 20.

**Property test (P5 AC 1):** over 200 seeded random words (mulberry32(7), lengths 3 to 7, letters a to z), inserted one at a time with k = 1 … 6, every inserted word queries TP. This holds by construction; the test guards against off-by-one errors in the probe loop.

### Acceptance criteria for the implementer (Fig 1, in addition to P5)

1. Every fixture table above is reproduced exactly (bits strings, query states, observed counts).
2. At the defaults, picking "cherry" shows the hatched badge with the exact text "maybe (false positive)".
3. Picking "plum" at the defaults shows ✕ above bit 11 and "definitely not".
4. With "hen" selected, moving n from 10 to 11 to 12 shows NO → FP → TP.
5. Each cell's value is readable without colour (a "1" or "0" glyph in every cell at ≥ 24 px desktop width). The 2-row layout applies at < 640 px with no horizontal scroll at 390 px.
6. No word list contains a finance term (a test greps the exported lists against the guard regex).

---

## Fig 2: `fig-fpr-curve` (kind `curve`, model `expr-curve`, Phase 7)

**Idea.** For fixed m and k, the false-positive rate rises with n in an S-curve. Each k is the best choice at exactly one load, n = (m/k)·ln 2, where half the bits are set and the rate is (1/2)^k.

**Model.** `expr-curve`.
- `expr`: `(1 - exp(-k*x/m))^k`
- `x`: `{ name: "x", label: "items inserted n", min: 1, max: 64, scale: "linear" }`
- `y`: `{ label: "false-positive rate", min: 0, max: 1 }`
- `params`: `k` (label "hashes per word k", 1 to 6, default 3, step 1) and `m` (label "bits m", 16 to 128, default 32, step 8).
- `options.markerExpr`: `m*ln(2)/k`. `options.markerLabel`: `k = {k} is best at n ≈ {marker}`.
- `options.refExpr`: `0.5^(m*ln(2)/x)`, the rate with the best real-valued k at each n, which is `(1/2)^((m/n)·ln 2)` ≈ 0.6185^(m/n). `options.refLabel`: `best possible k`.
- `options.x0`: 8. `options.xStep`: 1 (invented: the knob snaps to whole items). `options.xFormat`: `int`. `options.yFormat`: `percent`.
- `options.describe` (invented, optional): `At n = {x} items, the false-positive rate is {y}.` (P7 AC 6 wording).

All three expressions use only whitelisted tokens (`exp`, `ln`, `^`, `*`, `/`, `-`, numbers and declared identifiers). They are finite over the full x range and every param range, so they pass the 90 %-finite check.

**Controls.** `["x", "k", "m"]`.
- `x`: the ring knob on the curve, dragged horizontally; it snaps to integers. Keyboard: Arrow ± 1, PageUp/PageDown ± 10. `aria-valuetext`: "8 items inserted".
- `k` and `m`: native ranges in the controls row.

**Drawing.**
- The main curve: cobalt, solid 2 px, with circle markers every 8 items, labelled at its right end "k = 3, m = 32".
- The reference: dotted ink, labelled "best possible k".
- The marker: a vertical ink hairline at n = m·ln 2 / k with the label "k = 3 is best at n ≈ 7.4" and a small filled ink ● where the curve meets the reference. The ● is deliberately not a ring, because a ring means draggable.
  - If the marker falls outside [1, 64], draw a ▶ at the right edge with the label "k = 1 is best at n ≈ 88.7 (off the chart)".
- The y axis shows percent ticks at 0, 25, 50, 75 and 100 %. The x axis has ticks at 1, 8, 16, 32 and 64.
- A legend appears because there are 2 series. It shows the solid line with ● markers and the dotted line.

**Readouts.** `["x", "y"]` → `items inserted n 8 · false-positive rate 14.7%`.

**Show data table.** 11 rows of sampled points around the knob (x − 5 … x + 5, clipped to range). Columns: `n`, `false-positive rate` (percent), `best possible` (percent).

**States to discover.**
1. Default (m = 32, k = 3, n = 8): 14.7 %, just above the dotted best of 14.6 %. The marker sits at 7.4, nearly where you are.
2. Drag n to 4: 3.1 % (the best possible is 2.1 %). Drag to 16: 46.9 % against 38.3 %. Drag to 32: 85.8 %. One fixed k is only optimal near one load.
3. Set k = 1: the marker jumps to 22.2. Set k = 6: it jumps to 3.7. At the marker the curve always touches the dotted line, at exactly (1/2)^k: 12.5 % for k = 3, 50 % for k = 1, 1.56 % for k = 6, for any m.
4. Double m to 64 (k = 3): the whole curve stretches right by 2×, and at n = 8 the rate drops from 14.7 % to 3.1 %. Bits per item, m/n, is what matters.

**Alt (static).** "Line chart of the false-positive rate against the number of items inserted, for 32 bits and 3 hashes: the rate rises from near 0 at 1 item to 14.7% at 8 items and 86% at 32 items. A dotted curve shows the best possible rate, which the line touches at about 7.4 items, where 3 hashes is optimal."

**Caption.** "The curve is (1 − e^(−kn/m))^k for your m and k. The dotted line is the best any number of hashes could do; the marker shows where your k is the best choice."

**Reduced motion.** The knob and curve update instantly when k or m changes (otherwise the curve path eases with the 90 ms follow).

### Fixtures (`expr-curve`, Bloom)

| m | k | n | FPR | best possible | marker n = m·ln 2/k |
|---|---|---|---|---|---|
| 32 | 3 | 1 | 0.072 % | 0.000 % (2.4e-7) | 7.394 |
| 32 | 3 | 4 | 3.058 % | 2.142 % | 7.394 |
| 32 | 3 | 8 | 14.689 % | 14.634 % | 7.394 |
| 32 | 3 | 16 | 46.886 % | 38.255 % | 7.394 |
| 32 | 3 | 32 | 85.795 % | 61.850 % | 7.394 |
| 32 | 3 | 64 | 99.258 % | 78.645 % | 7.394 |
| 32 | 1 | 8 | 22.120 % | 14.634 % | 22.181 |
| 32 | 6 | 8 | 21.983 % | 14.634 % | 3.697 |
| 64 | 3 | 8 | 3.058 % | 2.142 % | 14.787 |
| 128 | 6 | 8 | 0.094 % | 0.046 % | 14.787 |
| 16 | 3 | 8 | 46.886 % | 38.255 % | 3.697 |

At the marker the FPR equals 0.5^k exactly: 0.12500 (k = 3), 0.50000 (k = 1), 0.01563 (k = 6). Tolerance 1e-9 on the expression evaluator against `Math` (P7 AC 2 asks for 1e-12 on random points; these are the readable anchors).

### Acceptance criteria for the implementer (Fig 2, in addition to P7)

1. At the defaults the readout reads exactly `items inserted n 8 · false-positive rate 14.7%`, and the live description reads "At n = 8 items, the false-positive rate is 14.7%."
2. The marker label reads "k = 3 is best at n ≈ 7.4". After k = 6 it reads "k = 6 is best at n ≈ 3.7".
3. The reference curve is dotted ink and directly labelled. The marker point is a filled ●, not a ring.
4. At m = 128, k = 1 the marker is off the chart and shown as an edge ▶ with its label.
5. Changing m or k keeps the knob at the same n and updates its y.

---

## JSON skeleton (`src/samples/bloom-filter.json`)

```json
{
  "schema": 1,
  "id": "bloom-filter",
  "title": "How a Bloom filter says “maybe”",
  "dek": "A Bloom filter stores a set as a handful of bits. It can say “maybe” to a word it never saw, but never “no” to one it did, and the number of hashes sets how often that “maybe” is wrong.",
  "source": {
    "kind": "blog",
    "url": "https://llimllib.github.io/bloomfilter-tutorial/",
    "title": "Bloom Filters by Example",
    "authors": ["Bill Mill"]
  },
  "provenance": { "mode": "curated", "generatedAt": "2026-10-19T00:00:00.000Z" },
  "sections": [
    {
      "id": "a-set-made-of-bits",
      "heading": "A set made of bits",
      "paragraphs": [
        "Suppose you want to remember which words you have seen without storing the words. A Bloom filter starts with m bits, all 0. To add a word, you hash it k different ways, each hash picking one of the m bits, and set those k bits to 1. That is the whole write path: no words are kept, only bits.",
        "To ask whether a word is in the set, you hash it the same k ways and look at its bits. If any of them is 0, the word was never added: *definitely not*. If all of them are 1, the word was probably added, but you cannot be sure, because other words may have set those bits. The filter's honest answer is *maybe*."
      ]
    },
    {
      "id": "watch-it-fill",
      "heading": "Watch it fill up",
      "paragraphs": [
        "The figure has 32 bits and a list of twelve animal names. Drag n to add the first n animals, and change k, the number of hashes per word. Then pick a word to ask about. Arrows run from the word to its k bits.",
        "Start with “cat”, which is in the set: all three of its bits are lit, and they always will be. Now ask about “plum”. One of its bits is 0, and that single 0 is proof. Then ask about “cherry”. You never added it, yet all three of its bits are 1: a false positive. At k = 3, “cherry” happens to land on exactly the same three bits as “fox”."
      ],
      "figure": {
        "id": "fig-bits",
        "kind": "bits",
        "title": "Inserting words, asking about words",
        "caption": "Each word is hashed k times and sets k of the 32 bits. Drag n to insert more animals, change k, and pick a word to ask about. Hatching marks a false “maybe”.",
        "alt": "A row of 32 bits after inserting 8 animal names with 3 hashes each: 20 bits are set. Asking about “cat” finds all 3 of its bits set, so the answer is maybe; “plum” hits a 0 bit, so it is definitely not; “cherry” finds all 3 bits set though it was never added, a false positive.",
        "model": { "id": "bloom-filter", "params": { "m": 32, "k": 3, "n": 8, "q": 0 } },
        "controls": ["n", "k", "q"],
        "readouts": ["bitsSet", "fpr", "fpObserved"],
        "options": { "handle": "n" }
      }
    },
    {
      "id": "why-no-is-always-true",
      "heading": "Why “no” is always true",
      "paragraphs": [
        "Bits only ever go from 0 to 1. Adding a word never clears a bit, so a word you added keeps all of its bits lit for good, and the filter can never answer “definitely not” about it. Every mistake runs one way: a word you never added finds all of its bits already set by others.",
        "Ask about “hen”, the twelfth animal, and drag n up from 8. At n = 11 “hen” already says maybe, before you have added it: other animals set its bits. At n = 12 it is in the set for real. From the outside the two answers look the same, and that is exactly what “maybe” means. The figure can tell them apart only because it keeps the list; the filter cannot."
      ]
    },
    {
      "id": "predicting-false-positives",
      "heading": "Predicting the false positives",
      "paragraphs": [
        "You can predict how often “maybe” is wrong. Each of the k·n hashes misses a given bit with probability 1 − 1/m, so after n words a bit is still 0 with probability `(1 − 1/m)^(kn) ≈ e^(−kn/m)`. A word you never added is a false positive when all k of its bits are 1, which gives `FPR ≈ (1 − e^(−kn/m))^k`. For m = 32, n = 8 and k = 3 that is `(1 − e^(−0.75))³ ≈ 14.7%`.",
        "The figure also measures. It asks about 50 fruits and vegetables it never added and counts how many come back maybe. At the defaults that is 10 of 50, or 20%, a little above the prediction. The formula describes an average filter. This one happens to have 20 of its 32 bits set rather than the expected 17, and `(20/32)³ ≈ 24%`. A filter this small is noisy; with more bits, the measured rate settles onto the formula."
      ]
    },
    {
      "id": "choosing-k",
      "heading": "Choosing k",
      "paragraphs": [
        "More hashes cut both ways. Each extra hash is one more bit a stranger has to match, which helps, but it also fills the bits faster, which hurts. In the first figure at n = 8, the predicted rate is 22% at k = 1, 14.7% at k = 3 and 22% again at k = 6. Somewhere in between is a best k.",
        "Setting the derivative to zero gives `k = (m/n)·ln 2`, the point where about half the bits are set. There the false-positive rate is `(1/2)^k ≈ 0.6185^(m/n)`. The curve below plots the rate against n for your m and k. The marker shows the n at which your k is the best choice, and the dotted curve is the best any k could do. Drag along the curve and watch it touch the dotted line at the marker."
      ],
      "figure": {
        "id": "fig-fpr-curve",
        "kind": "curve",
        "title": "False positives as the filter fills",
        "caption": "The curve is (1 − e^(−kn/m))^k for your m and k. The dotted line is the best any number of hashes could do; the marker shows where your k is the best choice.",
        "alt": "Line chart of the false-positive rate against the number of items inserted, for 32 bits and 3 hashes: the rate rises from near 0 at 1 item to 14.7% at 8 items and 86% at 32 items. A dotted curve shows the best possible rate, which the line touches at about 7.4 items, where 3 hashes is optimal.",
        "model": {
          "id": "expr-curve",
          "expr": "(1 - exp(-k*x/m))^k",
          "x": { "name": "x", "label": "items inserted n", "min": 1, "max": 64, "scale": "linear" },
          "y": { "label": "false-positive rate", "min": 0, "max": 1 },
          "params": [
            { "name": "k", "label": "hashes per word k", "min": 1, "max": 6, "default": 3, "step": 1 },
            { "name": "m", "label": "bits m", "min": 16, "max": 128, "default": 32, "step": 8 }
          ]
        },
        "controls": ["x", "k", "m"],
        "readouts": ["x", "y"],
        "options": {
          "x0": 8,
          "xStep": 1,
          "xFormat": "int",
          "yFormat": "percent",
          "markerExpr": "m*ln(2)/k",
          "markerLabel": "k = {k} is best at n ≈ {marker}",
          "refExpr": "0.5^(m*ln(2)/x)",
          "refLabel": "best possible k",
          "describe": "At n = {x} items, the false-positive rate is {y}."
        }
      }
    }
  ],
  "takeaway": "A Bloom filter never says no to a word it holds, because bits only turn on. Its one error is a false “maybe”, at a rate near (1 − e^(−kn/m))^k, which is lowest when k ≈ (m/n)·ln 2 and half the bits are set."
}
```

Note for Phase 1: `params[].step` on `expr-curve` and the `options` keys above are proposals (see samples.md §3). If P3's schema rejects unknown `expr-curve` param keys, either add `step` to the schema or drop it from this JSON until P7.
