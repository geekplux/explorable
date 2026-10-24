/**
 * explorable kit: the public, framework-free API shared by the web app and the
 * `/explorable` skill. Import from here rather than from individual modules.
 * @packageDocumentation
 */

/** ExplorableDoc v1 and v2 schema, its inferred types and `parseDoc`. */
export {
  ExplorableDocSchema,
  FIGURE_KINDS,
  parseDoc,
  type DocSection,
  type DocSource,
  type ExplorableDoc,
  type ExprCurveModel,
  type ExprParam,
  type FigureKind,
  type FigureSpec,
  type MathNote,
  type Note,
  type ParseResult,
  type Provenance,
  type RegistryModelRef,
  type SourceNote,
} from './doc/schema.ts';
/** Notes (v2): the `[[id]]` marker syntax, its checks, and the body-text formula check shared with the Worker. */
export { NOTE_MARK, noteIssues, noteRefs, type NoteIssue } from './doc/notes.ts';
export { bodyHasFormula, findFormula } from './doc/formula.ts';
export { hydrateNotes } from './runtime/notes.ts';
/** Static, escaped essay HTML and the inline formatter it uses. */
export { authorLine, essayHtml, hydrateFigures } from './doc/essay.ts';
/** Live figure runtime: mount one figure into a shell, and the built-in models. */
export { BUILT_IN_MODELS, mountFigure, type FigureCtx, type FigureMount, type FigureView, type MountOptions } from './runtime/mount.ts';
/** `expr-curve`: the per-figure model and the error its validation throws. */
export { exprCurveModel } from './models/expr-curve.ts';
export { ExprError } from './expr/lexer.ts';
export { entropyBits, softmax, softmaxTemperature } from './models/softmax-temperature.ts';
export { escapeHtml, formatInline, safeHttpUrl } from './doc/inline.ts';
/** Model registry: register, look up and search models. */
export { getModel, registerModel, searchModels, type ModelDef, type OutputDef, type ParamDef } from './registry.ts';
/** Seeded randomness and readout formats. */
export { mulberry32, type Rng } from './rng.ts';
export { format, type Format } from './format.ts';
/** Palette tokens and colour-vision checks. */
export { PALETTE, PALETTE_DARK, PALETTES, RADIX, SERIES, SERIES_DARK, SURFACES, SURFACES_DARK, type Scheme, type Token } from './color/palette.ts';
export { contrast, deltaE, seriesFailures, simulate, type Vision } from './color/cvd.ts';
