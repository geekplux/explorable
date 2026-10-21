import { useEffect, useRef, useState } from 'react';
import { EXPECT_COPY, SLOW_MS, STAGES } from '../../lib/explain.ts';

const hostOf = (url: string): string => {
  try {
    return new URL(url).host || url;
  } catch {
    return url;
  }
};

/** Whole seconds since mount, ticking once a second (a plain number: no motion). */
function useElapsed(): number {
  const [start] = useState(() => Date.now());
  const [now, setNow] = useState(start);
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  return Math.floor((now - start) / 1000);
}

/**
 * Skeleton essay column, the steps of a new link with the current one marked,
 * what to expect, and Cancel (PLAN §4.6). Only the current step (and, once, a
 * "longer than usual" note) is announced, politely; the seconds counter is silent.
 */
export function LoadingEssay({ url, stage, onCancel }: { url: string; stage: number; onCancel: () => void }) {
  const heading = useRef<HTMLHeadingElement>(null);
  // Focus the heading on mount: covers "Try again", which swaps the error panel
  // for this view without a route change (so App's focus move does not run).
  useEffect(() => heading.current?.focus(), []);
  const seconds = useElapsed();
  const slow = seconds * 1000 >= SLOW_MS;
  const current = STAGES[Math.min(stage, STAGES.length - 1)]!;

  return (
    <div className="loading">
      <p className="kicker">Building an explorable</p>
      <h1 ref={heading} tabIndex={-1} className="loading-title">
        Reading {hostOf(url)}
      </h1>
      <p className="loading-link">
        Link: <span className="loading-url">{url}</span>
      </p>
      <ol className="loading-steps" aria-label="Steps">
        {STAGES.map((s, i) => {
          const state = i < stage ? 'done' : i === stage ? 'current' : 'next';
          return (
            <li key={s.id} className={`loading-step is-${state}`} aria-current={state === 'current' ? 'step' : undefined}>
              <span className="loading-mark" aria-hidden="true">{state === 'done' ? '✓' : ''}</span>
              {s.label}
              {state === 'done' && <span className="visually-hidden"> (done)</span>}
              {state === 'current' && <span className="loading-seconds" aria-hidden="true">{seconds} s</span>}
            </li>
          );
        })}
      </ol>
      <p className="loading-stage visually-hidden" aria-live="polite">
        {current.label}…{slow ? ' This is taking longer than usual; it is still working.' : ''}
      </p>
      <div className="loading-row">
        <p className="loading-expect">
          {slow ? 'Taking longer than usual. Still working, or cancel and try again later.' : EXPECT_COPY}
        </p>
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
