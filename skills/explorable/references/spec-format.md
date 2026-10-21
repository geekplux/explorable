# `explorable.json`: ExplorableDoc v1

The spec is one JSON object, validated by `parseDoc` in `kit/src/doc/schema.ts`. Every object is strict: an unknown key is an error. Text lengths count visible characters, so padding and zero-width characters do not reach a minimum. `build.mjs` and `audit.mjs` print errors as `path: problem`, for example `sections[1].figure.alt: must be at least 40 characters`.

## The document

| Field | Rule |
|---|---|
| `schema` | `1` |
| `id` | lowercase letters, digits and dashes, starting with a letter or digit |
| `title` | 1–90 characters |
| `dek` | 1–220 characters: the one idea, in one or two sentences |
| `source.kind` | `"arxiv"`, `"blog"` or `"concept"` |
| `source.url` | optional, `http(s)://` only; the one link the page may have |
| `source.title` | 1–300 characters; `authors` (strings) and `year` (integer) are optional |
| `provenance` | `{ "mode": "curated" \| "ai" \| "match", "model"?: string, "generatedAt": ISO 8601 timestamp }` |
| `sections` | 2–6 sections; section and figure ids are unique across the doc |
| `takeaway` | 1–300 characters: the idea again, with its key formula |

A section is `{ "id", "heading" (≤ 90), "paragraphs" (1–4, each ≤ 700), "figure"? }`. The audit also requires at least one section with a figure.

Text may use three inline marks: `*em*`, `**strong**` and `` `code` `` (for formulas). Everything else is escaped, so HTML and links in text show as plain characters.

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
  "schema": 1,
  "id": "newton-cooling",
  "title": "Why coffee cools fast, then slowly",
  "dek": "The rate of cooling is proportional to the gap to room temperature…",
  "source": { "kind": "concept", "title": "Newton's law of cooling" },
  "provenance": { "mode": "curated", "generatedAt": "2026-10-21T00:00:00.000Z" },
  "sections": [
    { "id": "heat-flows-down-the-gap", "heading": "Heat flows down the gap", "paragraphs": ["…"] },
    { "id": "the-curve", "heading": "The curve", "paragraphs": ["…"], "figure": { "id": "fig-cooling", "kind": "curve", "…": "…" } }
  ],
  "takeaway": "…"
}
```

Use `"mode": "curated"` for a spec you wrote by hand and `"ai"` when a model drafted it; the page shows the provenance under the title.
