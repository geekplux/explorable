/**
 * ExplorableDoc v1: the contract shared by built-in samples, the Worker output
 * and skill specs (docs/PLAN.md §5.2). Types only; the valibot schema that
 * validates these lands in Phase 3 and replaces this file.
 */

export type FigureKind = 'bars' | 'bits' | 'histogram' | 'curve';

export type SourceKind = 'arxiv' | 'blog' | 'concept';

export interface DocSource {
  kind: SourceKind;
  url?: string;
  title: string;
  authors?: string[];
  year?: number;
}

export interface Provenance {
  mode: 'curated' | 'ai' | 'match';
  model?: string;
  /** ISO 8601 timestamp. */
  generatedAt: string;
}

export interface RegistryModelRef {
  id: string;
  params: Record<string, number>;
}

export interface ExprParam {
  name: string;
  label: string;
  min: number;
  max: number;
  default: number;
  step?: number;
}

export interface ExprCurveModel {
  id: 'expr-curve';
  expr: string;
  x: { name: 'x'; label: string; min: number; max: number; scale?: 'linear' | 'log' };
  y: { label: string; min?: number; max?: number };
  params: ExprParam[];
}

export interface FigureSpec {
  id: string;
  kind: FigureKind;
  title: string;
  caption: string;
  /** Static text alternative, at least 40 characters. */
  alt: string;
  model: RegistryModelRef | ExprCurveModel;
  /** 1 to 3 parameter names the reader can change. */
  controls: string[];
  /** 1 to 3 output ids shown in the readout strip. */
  readouts: string[];
  options?: Record<string, string | number | boolean | string[]>;
}

export interface DocSection {
  id: string;
  heading: string;
  /** 1 to 4 paragraphs, inline markup only (see inline.ts). */
  paragraphs: string[];
  figure?: FigureSpec;
}

export interface ExplorableDoc {
  schema: 1;
  id: string;
  title: string;
  /** The one core idea, in one or two sentences. */
  dek: string;
  source: DocSource;
  provenance: Provenance;
  sections: DocSection[];
  takeaway: string;
}
