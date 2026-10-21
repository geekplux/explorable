import { useEffect, useRef, useState } from 'react';
import { type ExplainResult, IDLE_MS, STAGE_AT_MS, TIMEOUT_MS, fail, ndjsonLines, readExplain, stageIndex } from '../lib/explain.ts';

export type ExplainState = { status: 'loading'; stage: number } | ({ status: 'done' } & ExplainResult);

/** Reads a streamed miss: stage lines move `onStage`, any line resets the idle timer, the result line is the body. */
async function readBody(res: Response, onStage: (i: number) => void, onLine: () => void): Promise<unknown> {
  if (!(res.headers.get('content-type') ?? '').includes('ndjson') || !res.body) return res.json();
  for await (const text of ndjsonLines(res.body)) {
    onLine();
    const line = JSON.parse(text) as { type?: string; stage?: unknown };
    if (line.type === 'stage' && stageIndex(line.stage) >= 0) onStage(stageIndex(line.stage));
    else if (line.type === 'result') return line;
  }
  throw new TypeError('The stream ended before a result');
}

/**
 * GET /api/explain for `url`: one request per (url, attempt), aborted on
 * unmount, on `cancel()`, after TIMEOUT_MS, or after IDLE_MS with no line from
 * a streaming Worker. `stage` follows the stages the Worker streams; until the
 * first one arrives (or if it never does) it follows the honest timeline in
 * STAGE_AT_MS. Offline, it fails with OFFLINE and never fetches.
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
    let stage = 0;
    let fromServer = false;
    const advance = (i: number) => {
      if (i <= stage) return;
      stage = i;
      set({ status: 'loading', stage: i });
    };
    const timers = STAGE_AT_MS.slice(1).map((ms, i) => setTimeout(() => !fromServer && advance(i + 1), ms));
    const timeout = setTimeout(() => ac.abort('timeout'), TIMEOUT_MS);
    let idle: ReturnType<typeof setTimeout> | undefined;
    const poke = () => {
      clearTimeout(idle);
      idle = setTimeout(() => ac.abort('timeout'), IDLE_MS);
    };
    const stop = () => {
      timers.forEach(clearTimeout);
      clearTimeout(timeout);
      clearTimeout(idle);
    };
    const onStage = (i: number) => {
      fromServer = true;
      advance(i);
    };
    const target = `/api/explain?url=${encodeURIComponent(request.slice(request.indexOf(':') + 1))}`;
    const headers = { accept: 'application/x-ndjson, application/json;q=0.9' };
    (navigator.onLine ? fetch(target, { signal: ac.signal, headers }) : Promise.reject(new Error('offline')))
      .then((res) => readBody(res, onStage, poke))
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
