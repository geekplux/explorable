import { useEffect, useState } from 'react';
import { EssayView } from '../components/EssayView.tsx';
import { setDraft } from '../components/UrlField.tsx';
import { ErrorState } from '../components/states/ErrorState.tsx';
import { LoadingEssay } from '../components/states/LoadingEssay.tsx';
import { useExplain } from '../hooks/useExplain.ts';
import { navigate } from '../router.ts';

/** `/x?url=`: loading, then the essay or an error panel. */
export function ResultPage({ url }: { url: string }) {
  const [attempt, setAttempt] = useState(0);
  const state = useExplain(url, attempt);
  const done = state.status === 'done';

  useEffect(() => setDraft(url), [url]);
  useEffect(() => {
    document.title = `${!done ? 'Explaining…' : state.ok ? state.doc.title : 'Could not explain this link'} – Explorable`;
    // The essay's h1 (tabindex -1) takes focus once it replaces the skeleton.
    // preventScroll: a deep link (#section) has already scrolled the essay to its heading.
    if (done && state.ok) document.querySelector<HTMLElement>('main h1')?.focus({ preventScroll: true });
  }, [done, state]);

  if (!done) {
    const cancel = () => {
      state.cancel();
      navigate('/');
    };
    return (
      <main className="page essay-page">
        <div className="essay-col">
          <LoadingEssay url={url} stage={state.stage} onCancel={cancel} />
        </div>
      </main>
    );
  }
  if (!state.ok) {
    return (
      <main className="page essay-page">
        <div className="essay-col">
          <ErrorState error={state.error} url={url} onRetry={() => setAttempt((n) => n + 1)} />
        </div>
      </main>
    );
  }
  return (
    <main className="page essay-page">
      <EssayView doc={state.doc} />
    </main>
  );
}
