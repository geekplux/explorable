import { useEffect, useState } from 'react';
import { EssayView } from '../components/EssayView.tsx';
import { setDraft } from '../components/UrlField.tsx';
import { ErrorState } from '../components/states/ErrorState.tsx';
import { LoadingEssay } from '../components/states/LoadingEssay.tsx';
import { ProvenanceBadge } from '../components/states/ProvenanceBadge.tsx';
import { useExplain } from '../hooks/useExplain.ts';
import { navigate } from '../router.ts';

/** `/x?url=`: loading, then the essay or an error panel. */
export function ResultPage({ url }: { url: string }) {
  const [attempt, setAttempt] = useState(0);
  const state = useExplain(url, attempt);
  const done = state.status === 'done';

  useEffect(() => setDraft(url), [url]);
  useEffect(() => {
    document.title = `${!done ? 'Explaining…' : state.ok ? state.doc.title : 'Could not explain this link'} · explorable`;
    // The essay's h1 (tabindex -1) takes focus once it replaces the skeleton.
    if (done && state.ok) document.querySelector<HTMLElement>('main h1')?.focus();
  }, [done, state]);

  if (!done) {
    const cancel = () => {
      state.cancel();
      navigate('/');
    };
    return (
      <main className="page result-page shell">
        <LoadingEssay url={url} stage={state.stage} onCancel={cancel} />
      </main>
    );
  }
  if (!state.ok) {
    return (
      <main className="page result-page shell">
        <ErrorState error={state.error} url={url} onRetry={() => setAttempt((n) => n + 1)} />
      </main>
    );
  }
  return (
    <main className="page essay-page">
      <nav aria-label="Back">
        <a href="/" className="back hit">
          <span aria-hidden="true">← </span>All explorables
        </a>
      </nav>
      <ProvenanceBadge doc={state.doc} cache={state.cache} />
      <EssayView doc={state.doc} />
    </main>
  );
}
