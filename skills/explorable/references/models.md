# Models

Every number on the page comes from a `ModelDef` (`kit/src/registry.ts`): params in, outputs out, through a pure `compute` that uses only seeded randomness, so the same params always draw the same figure. There are four registry models plus `expr-curve`, which you build per figure from a formula (`expressions.md`).

**Use a registry model only when the idea *is* that model's idea.** "Heat diffusion" is not `diffusion-forward`, even though the search below ranks it first. When no model teaches the idea, use `expr-curve`.

## The registry

| Model | Kinds | Teaches | Params (default) | Outputs |
|---|---|---|---|---|
| `bloom-filter` | `bits` | a bit array with k hashes answers membership with no false "no" and a tunable false "maybe" | `k` hashes per word 1–6 (3); `n` words inserted 0–12 (8); `q` word asked about, choice 0–5: cat, owl, plum, cherry, banana, hen (0); `m` bits, fixed at 32 | `bitsSet` (/ 32), `fpr` predicted false-positive rate, `fpObserved` (/ 50) |
| `softmax-temperature` | `bars` | dividing scores by a temperature T sets how sharp a softmax is | `T` 0.05–5, log scale (1); `n` items 2–8 (6); `s1`…`s8` scores −10–10 (0) | `top` weight, `entropy` (bits), `topIndex` |
| `attention-scaling` | `bars` | dot products of wider vectors spread like √d_k and saturate softmax unless divided by √d_k | `dk` key width 1–512, log scale (4); `scaled` 0/1 switch (0); `seed` (229) | `sd` score SD, `sdExpected`, `top`, `entropy`, `topIndex` |
| `diffusion-forward` | `histogram`, `curve` | a fixed noise schedule turns data into N(0, 1), and a closed form jumps to any step t | `t` step 0–1000 (0); `seed` (2020) | `alphaBar`, `signal`, `noise`, `snrDb` (may be ∞ at t = 0), `sd`, `mean`, `crossT` |

Set every param you care about in `model.params`; any you leave out takes its default. Leave `seed` and fixed params alone. A param outside its range fails the audit with `param k = 9 is outside its range 1 to 6`.

Outputs that are lists (`weights`, `bits`, `hist`, `signalSeries`…) feed the drawing; they cannot be readouts. A readout must be one of the number outputs above.

## Find and inspect a model

Run from the skill folder:

```sh
node -e "import('./kit/dist/explorable-kit.js').then(k => console.log(k.searchModels('softmax temperature sampling').map(m => m.id)))"
node -e "import('./kit/dist/explorable-kit.js').then(k => console.log(k.getModel('bloom-filter').params))"
```

`searchModels` ranks by id, keywords and title, best first, and returns `[]` when nothing matches. It is a hint, not a verdict.

## Choosing

| The idea… | Use |
|---|---|
| is one of the four above | that model, with its first kind (`curve` for `diffusion-forward` only to show signal and noise over t) |
| is a formula or a relation the source states, y = f(x) | `expr-curve` |
| has no honest formula (a history, a debate, a procedure) | `expr-curve` for the one quantitative relation inside it, or tell the user no live figure would be true |

The examples use both: `examples/bloom-filter/` puts the `bloom-filter` model in its first figure and an `expr-curve` of `(1 − e^(−kn/m))^k` in its second.
