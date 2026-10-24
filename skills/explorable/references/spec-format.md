# `explorable.json`: ExplorableDoc v1 and v2

The spec is one JSON object, validated by `parseDoc` in `kit/src/doc/schema.ts`. Every object is strict: an unknown key is an error. Text lengths count visible characters, so padding and zero-width characters do not reach a minimum. `build.mjs` and `audit.mjs` print errors as `path: problem`, for example `sections[1].figure.alt: must be at least 40 characters`.

## The document

| Field | Rule |
|---|---|
| `schema` | `2` (notes, plain words); `1` is still valid, without notes |
| `id` | lowercase letters, digits and dashes, starting with a letter or digit |
| `title` | 1–90 characters |
| `dek` | 1–220 characters: the one idea, in one or two sentences |
| `source.kind` | `"arxiv"`, `"blog"` or `"concept"` |
| `source.url` | optional, `http(s)://` only; the one link the page may have |
| `source.title` | 1–300 characters; `authors` (strings) and `year` (integer) are optional |
| `provenance` | `{ "mode": "curated" \| "ai" \| "match", "model"?: string, "generatedAt": ISO 8601 timestamp }` |
| `sections` | 2–6 sections; section and figure ids are unique across the doc |
| `takeaway` | 1–300 characters: the idea again, in words, with no formula |
| `notes` | schema 2 only, optional: up to 12 notes (below) |

A section is `{ "id", "heading" (≤ 90), "paragraphs" (1–4, each ≤ 700), "figure"? }`. The audit also requires at least one section with a figure.

Text may use three inline marks, `*em*`, `**strong**` and `` `code` `` (for a short symbol), plus note markers `[[id]]` in paragraphs and the takeaway. Everything else is escaped, so HTML and links in text show as plain characters.

## Notes (schema 2)

Plain words first: a formula or a citation sits behind a small marker instead of in the sentence (`writing.md` says when to make one and how to write it). Set `"schema": 2` and list the notes once, at doc level; a paragraph or the takeaway references one with `[[id]]`.

| Note | Fields | Renders as |
|---|---|---|
| math | `{ "id", "kind": "math", "formula" (≤ 160), "plain" (≤ 240) }` | a small Σ button where `[[id]]` sits, straight after its sentence; Enter, Space or a click opens a panel under the paragraph with the formula and its gloss (`aria-expanded`, several can be open) |
| source | `{ "id", "kind": "source", "label" (≤ 60), "title" (≤ 200), "detail"? (≤ 120), "url"? (https) }` | the `label` in the text with a dotted underline; focus, hover or a tap opens a card with the title, the detail and "Open the paper on arXiv" (arxiv.org) or "Open the source"; Esc closes it |

Rules, all checked by `parseDoc` (and so by `build.mjs` and the audit):

- `notes` holds at most 12 notes. Ids match `^[a-z][a-z0-9-]{0,23}$` and are unique.
- Markers go only in paragraphs and the takeaway. The title, dek, headings and figure text cannot hold one: `dek: [[m1]] marks a note; notes can be referenced only from paragraphs and the takeaway`.
- Every `[[id]]` names a note: `sections[0].paragraphs[0]: unknown note "nope"; the notes are law, newton`.
- Every note is referenced: `notes[0]: note "law" is never referenced; put [[law]] in a paragraph or the takeaway, or remove the note`.
- A paragraph has at most one math marker, and a math note is referenced once. A source note may be cited more than once; later cards get the ids `note-<id>-2`, `note-<id>-3`, …
- A v1 doc may not hold `notes` or markers: `notes need "schema": 2`.

`formula` is Unicode like code (`wᵢ = exp(sᵢ / T) / Σⱼ exp(sⱼ / T)`), never LaTeX; `plain` is ordinary text with the inline marks. The kit sets variables in italics for you, in notes and in the text (`d_k` becomes an italic *d* with a subscript k).

```json
{
  "schema": 2,
  "sections": [
    { "id": "scores", "heading": "From scores to weights", "paragraphs": [
      "Attention turns scores into weights with a softmax.[[m1]] [[vaswani]] divide every score by √d_k first."
    ] }
  ],
  "notes": [
    { "id": "m1", "kind": "math", "formula": "wᵢ = exp(sᵢ / T) / Σⱼ exp(sⱼ / T)", "plain": "Each weight is its score, exponentiated, as a share of the total." },
    { "id": "vaswani", "kind": "source", "label": "Vaswani et al.", "title": "Attention Is All You Need", "detail": "Vaswani, Shazeer, Parmar and 5 others, 2017", "url": "https://arxiv.org/abs/1706.03762" }
  ]
}
```

The audit warns (it does not fail) when the dek, a paragraph or the takeaway still reads like a formula: two or more operations on variables, a relation with an operation (`k ≈ (m/n)·ln 2`), Σ or ∂ with an operand, or LaTeX. A single variable or setting stays in the text: "the temperature T", "at T = 1", "divided by √d_k". The check is `findFormula` in `kit/src/doc/formula.ts` (exported by the kit as `findFormula` and `bodyHasFormula`); markers are ignored. A finished schema 2 page has no warnings.

## A figure

| Field | Rule |
|---|---|
| `id` | slug, unique in the doc |
| `kind` | `"bars"`, `"bits"`, `"histogram"` or `"curve"` (`figure-kinds.md`) |
| `title`, `caption` | 1–120 and 1–400 characters |
| `alt` | 40–600 characters: what the figure is, what it shows at the start, and how it changes (`writing.md`) |
| `model` | a registry model `{ "id", "params": { name: number } }` (`models.md`) or an `expr-curve` (`expressions.md`) |
| `controls` | 1–3 names of model params the reader changes (`"x"` is the knob on an `expr-curve`) |
| `readouts` | 1–3 output ids shown under the figure |
| `options` | optional; values are strings, numbers, booleans or string lists (`figure-kinds.md`) |

The audit then checks what the schema cannot: the model exists, the kind can show it, each param is in range, each readout is an output, `options.handle` is one of the controls, no option holds a colour, every label has a letter or digit, and every number shown is finite at every control stop.

## Skeleton

The smallest useful start is a copy of `examples/newton-cooling/explorable.json`. Its shape:

```json
{
  "schema": 2,
  "id": "newton-cooling",
  "title": "Why coffee cools fast, then slowly",
  "dek": "A hot drink loses heat in proportion to how much hotter it is than the room…",
  "source": { "kind": "concept", "title": "Newton's law of cooling" },
  "provenance": { "mode": "curated", "generatedAt": "2026-10-21T00:00:00.000Z" },
  "sections": [
    { "id": "heat-flows-down-the-gap", "heading": "Heat flows down the gap", "paragraphs": ["… proportional to the gap between its temperature and the room's.[[law]]", "…"] },
    { "id": "the-curve", "heading": "The curve", "paragraphs": ["…"], "figure": { "id": "fig-cooling", "kind": "curve", "…": "…" } }
  ],
  "takeaway": "Cooling is proportional to the gap, so the gap shrinks by the same fraction every minute…",
  "notes": [
    { "id": "law", "kind": "math", "formula": "dT/dt = −k·(T − Tₐ)", "plain": "The temperature T changes at a rate of −k times the gap to the room temperature Tₐ…" }
  ]
}
```

A schema 1 doc is the same without `notes` and markers; it still builds, and formulas in its text are warnings. Use `"mode": "curated"` for a spec you wrote by hand and `"ai"` when a model drafted it; an AI-drafted page says "Written by AI from the source." in its byline.
