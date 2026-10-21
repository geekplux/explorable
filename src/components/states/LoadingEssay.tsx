import { useEffect, useRef } from 'react';
import { STAGES } from '../../lib/explain.ts';

const hostOf = (url: string): string => {
  try {
    return new URL(url).host || url;
  } catch {
    return url;
  }
};

/** Skeleton essay column plus honest, timed stages and a Cancel button (PLAN §4.6). */
export function LoadingEssay({ url, stage, onCancel }: { url: string; stage: number; onCancel: () => void }) {
  const heading = useRef<HTMLHeadingElement>(null);
  // Focus the heading on mount: covers "Try again", which swaps the error panel
  // for this view without a route change (so App's focus move does not run).
  useEffect(() => heading.current?.focus(), []);

  return (
    <div className="loading">
      <p className="kicker">Building an explorable</p>
      <h1 ref={heading} tabIndex={-1} className="loading-title">
        Reading {hostOf(url)}
      </h1>
      <p className="loading-link">
        Link: <span className="loading-url">{url}</span>
      </p>
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
