import { STAGES } from '../../lib/explain.ts';

/** Skeleton essay column plus honest, timed stages and a Cancel button (PLAN §4.6). */
export function LoadingEssay({ url, stage, onCancel }: { url: string; stage: number; onCancel: () => void }) {
  return (
    <div className="loading">
      <p className="kicker">Building an explorable</p>
      <h1 tabIndex={-1} className="loading-title">
        Reading <span className="loading-url">{url}</span>
      </h1>
      <div className="loading-row">
        <output className="loading-stage">{STAGES[stage]}</output>
        <button type="button" className="button" onClick={onCancel}>
          Cancel
        </button>
      </div>
      <div className="skeleton" aria-busy="true">
        <span className="visually-hidden">The essay appears here when it is ready.</span>
        {['w90', 'w70', 'fig', 'w100', 'w95', 'w60'].map((k) => (
          <span key={k} className={`bar ${k}`} aria-hidden="true" />
        ))}
      </div>
    </div>
  );
}
