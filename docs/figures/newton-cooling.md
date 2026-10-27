# Skill example `newton-cooling`: Why coffee cools fast, then slowly

The second worked example of the `/explorable` skill, built from the `expr-curve` worked example in [../design/prompt.md](../design/prompt.md). It shows how to explain an idea that has no registry model: the curve is a whitelisted expression, so every number on screen still comes from a real model. Shared rules (formats, keyboard, encodings, motion) are in [samples.md](samples.md).

- **Core idea:** a hot object cools in proportion to how much hotter it is than the room, so the gap shrinks by the same fraction every minute and halves every ln 2 / k minutes, whatever the start.
- **Source:** `kind: concept` (Newton's law of cooling); no URL, so the page has no outbound link.
- **Files:** `skills/explorable/examples/newton-cooling/explorable.json`, built to `index.html` with `node skills/explorable/scripts/build.mjs …/explorable.json`.

## Essay flow

| # | Section id | Heading | Figure | Reader's job |
|---|---|---|---|---|
| 1 | `heat-flows-down-the-gap` | Heat flows down the gap | none | Meet the rule: rate ∝ gap. |
| 2 | `the-curve` | The curve | `fig-cooling` | Drag along time, then change k and T₀; watch the half-life marker stay put when T₀ moves. |
| 3 | `a-half-life-for-the-gap` | A half-life for the gap | `fig-half-life` | See ln 2 / k fall steeply, then flatten. |

## Fig 1: `fig-cooling` (kind `curve`, model `expr-curve`)

- **Model:** `T(t) = Ta + (T0 − Ta)·exp(−k·t)`, written `Ta + (T0 - Ta)*exp(-k*x)`. x is time, 0–60 min (step 1, starts at 10). Params: k 0.01–0.2 /min (step 0.005, default 0.05), T0 40–100 °C (step 1, default 90), Ta 10–30 °C (step 1, default 20; not a control, it stays fixed at 20).
- **Controls (3):** `x` (the ring knob on the curve, `options.handle: "x"`, plus a slider), `k`, `T0`.
- **Readouts (2):** time in minutes (`int`) and temperature in °C (`fixed1`).
- **Reference:** `refExpr: "Ta"`, a dotted ink line labelled "room temperature Tₐ". The curve approaches it but never crosses it.
- **Marker:** `markerExpr: "ln(2)/k"`, a vertical ink rule labelled "gap halves at {marker} min". Moving T₀ changes the curve but not the marker. That is the point of the essay, and the reader can see it.
- **Live text:** "At {x} minutes the cup is at {y} °C; the gap to the room halves every {marker} minutes."
- **Defaults to check:** at t = 10, k = 0.05, T₀ = 90 and Tₐ = 20, T = 20 + 70·e^(−0.5) ≈ 62.5 °C, and the gap halves at ln 2 / 0.05 ≈ 13.9 min.

## Fig 2: `fig-half-life` (kind `curve`, model `expr-curve`)

- **Model:** `ln(2)/x`, where x is the cooling constant k, 0.01–0.3 /min (step 0.005, starts at 0.05). y is the half-life of the gap in minutes, 0–70.
- **Controls (1):** `x` (knob and slider). **Readouts (2):** k (`fixed3`) and half-life (`fixed1`).
- **Defaults to check:** at k = 0.05 the half-life is 13.9 min. At k = 0.01 it is 69.3, and at 0.3 it is 2.3.

## Never colour alone

Both figures use the kit's `curve` kind, so the encodings are the tested ones. The model curve is a solid cobalt line with ● markers and a direct label. The room-temperature reference is a dotted ink line with its own direct label. The half-life marker is a solid ink vertical rule with a text label ("gap halves at 13.9 min"). Every value is also available in the readout strip, in the live description and in the "Show data" table.
