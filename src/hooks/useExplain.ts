import { useEffect, useRef, useState } from 'react';
import { type ExplainResult, STAGE_AT_MS, TIMEOUT_MS, fail, readExplain } from '../lib/explain.ts';

export type ExplainState = { status: 'loading'; stage: number } | ({ status: 'done' } & ExplainResult);

/**
 * GET /api/explain for `url`: one request per (url, attempt), aborted on
 * unmount, on `cancel()` or after 30 s. `stage` advances on the honest
 * timeline in STAGE_AT_MS. Offline, it fails with OFFLINE and never fetches.
 */
export function useExplain(url: string, attempt = 0): ExplainState & { cancel: () => void } {
  const request = `${attempt}:${url}`;
  // State is tagged with the request it belongs to, so a new request starts at "loading" without a reset.
  const [tagged, setTagged] = useState<{ request: string; state: ExplainState } | null>(null);
  const controller = useRef<AbortController | null>(null);

  useEffect(() => {
    const ac = new AbortController();
    controller.current = ac;
    const set = (state: ExplainState) => setTagged({ request, state });
    const timers = STAGE_AT_MS.slice(1).map((ms, i) => setTimeout(() => set({ status: 'loading', stage: i + 1 }), ms));
    const timeout = setTimeout(() => ac.abort('timeout'), TIMEOUT_MS);
    const stop = () => {
      timers.forEach(clearTimeout);
      clearTimeout(timeout);
    };
    const target = `/api/explain?url=${encodeURIComponent(request.slice(request.indexOf(':') + 1))}`;
    (navigator.onLine ? fetch(target, { signal: ac.signal, headers: { accept: 'application/json' } }) : Promise.reject(new Error('offline')))
      .then((res) => res.json())
      .then(readExplain, (error: unknown) => {
        if (ac.signal.reason === 'timeout') return fail('TIMEOUT');
        if (!navigator.onLine) return fail('OFFLINE');
        return fail(error instanceof SyntaxError ? 'INTERNAL' : 'NETWORK');
      })
      .then((result) => {
        stop();
        if (!ac.signal.aborted || ac.signal.reason === 'timeout') set({ status: 'done', ...result });
      });
    return () => {
      stop();
      ac.abort('unmount');
    };
  }, [request]);

  const state: ExplainState = tagged?.request === request ? tagged.state : { status: 'loading', stage: 0 };
  return { ...state, cancel: () => controller.current?.abort('cancel') };
}
