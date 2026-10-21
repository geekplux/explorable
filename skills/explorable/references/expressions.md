# `expr-curve`: a model from a formula

When no registry model teaches the idea, describe it as y = f(x). The kit parses the expression with its own small parser (`kit/src/expr/`) and compiles it to a closure. Nothing is ever passed to `eval`, so a spec cannot run code.

```json
"model": {
  "id": "expr-curve",
  "expr": "Ta + (T0 - Ta)*exp(-k*x)",
  "x": { "name": "x", "label": "time (minutes)", "min": 0, "max": 60 },
  "y": { "label": "temperature (°C)", "min": 0, "max": 100 },
  "params": [
    { "name": "k", "label": "cooling constant k (per minute)", "min": 0.01, "max": 0.2, "default": 0.05, "step": 0.005 }
  ]
},
"controls": ["x", "k"],
"readouts": ["x", "y"]
```

- `x.name` is always `"x"`; `x.scale` may be `"log"`. `y.min` and `y.max` fix the axis; leave them out to fit the first state.
- Up to 6 `params`, each with `min < max` and `min ≤ default ≤ max`. Without `step`, the step is the power of ten at or below (max − min) / 100.
- `controls` names `x` (the knob on the curve) and/or params; params you do not list stay at their default.
- Outputs are `x`, `y`, plus `ref` with `options.refExpr` and `marker` with `options.markerExpr`. Readouts are usually `["x", "y"]`.

## The language

| Allowed | |
|---|---|
| numbers | `2`, `0.5`, `1e-3` |
| names | `x`, the declared params, `pi`, `e` |
| operators | `+ - * / ^`, unary `-`, parentheses; `^` binds tighter than unary minus, so `-x^2` is −(x²) |
| functions | `exp`, `log` and `ln` (both natural log), `sqrt`, `abs`, `sin`, `cos`, `tan`, `floor`, `ceil`, `pow(a, b)`, `min(a, b, …)`, `max(a, b, …)` |

Nothing else: no strings, no `.`, `=`, `;`, `[` or `{`. At most 200 characters and a nesting depth of 32. A param name is an identifier that is not `x`, not a function or constant name, and not a reserved word such as `constructor` or `eval`.

## What validation checks

1. The expression parses and every name is declared.
2. At least 90% of 64 samples across the x range (params at their defaults) are finite. With x from −10 to 60, `log(x)` fails: `"log(x)" is finite at only 54 of 64 samples; at least 90% must be`.
3. The audit then computes `y` (and `ref`, `marker` and any templated value) at the defaults and at every stop of every control, and names the first state where it is not finite: `marker is not a finite number at k = 0`.

## Errors you will meet, and the fix

| Problem | Fix |
|---|---|
| `log(x)` or `sqrt(x)` with `x.min` ≤ 0 | start x above 0 (`"min": 0.01`) |
| `1/k` with a `k` range that includes 0 | start k above 0 |
| `unknown name "T0" (at 1)` | declare it in `params` |
| `param "e" is a built-in name` | rename the param (`eps`) |
| `marker is not a finite number at k = 0` | `markerExpr` uses params only, never `x`; keep it finite across every param range |

## Extras in `options`

`refExpr` draws a second, dotted curve over `x` and the params, labelled by `refLabel`. `markerExpr` places a vertical marker at an x computed from the params only, labelled by `markerLabel`, where `{marker}` and `{param}` fill in values: `"gap halves at {marker} min"`. See `figure-kinds.md` for the rest.

`examples/newton-cooling/explorable.json` uses all of them; `examples/bloom-filter/explorable.json` has an `expr-curve` of the false-positive rate over n with a marker where the current k is best.
