/**
 * explorable kit: the public, framework-free API shared by the web app and the
 * `/explorable` skill. Import from here rather than from individual modules.
 * @packageDocumentation
 */

/** ExplorableDoc v1 schema, its inferred types and `parseDoc`. */
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
  type ParseResult,
  type Provenance,
  type RegistryModelRef,
} from './doc/schema.ts';
/** Static, escaped essay HTML and the inline formatter it uses. */
export { authorLine, essayHtml, hydrateFigures } from './doc/essay.ts';
/** Live figure runtime: mount one figure into a shell, and the built-in models. */
export { mountFigure, type FigureCtx, type FigureMount, type FigureView, type MountOptions } from './runtime/mount.ts';
export { entropyBits, softmax, softmaxTemperature } from './models/softmax-temperature.ts';
export { escapeHtml, formatInline, safeHttpUrl } from './doc/inline.ts';
/** Model registry: register, look up and search models. */
export { getModel, registerModel, searchModels, type ModelDef, type OutputDef, type ParamDef } from './registry.ts';
/** Seeded randomness and readout formats. */
export { mulberry32, type Rng } from './rng.ts';
export { format, type Format } from './format.ts';
/** Palette tokens and colour-vision checks. */
export { PALETTE, SERIES, type Token } from './color/palette.ts';
export { contrast, deltaE, seriesFailures, simulate, type Vision } from './color/cvd.ts';
