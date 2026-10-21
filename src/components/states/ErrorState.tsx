import { useEffect, useRef } from 'react';
import type { ErrorCode, ExplainError } from '../../lib/explain.ts';
import { MiniCards } from '../SampleCard.tsx';

const SELF_HOST = 'https://github.com/geekplux/explorable/blob/main/docs/DEPLOY.md#self-host-without-ai';

/** Heading, then one sentence on what happened and what to do; `retry` offers "Try again". */
const COPY: Record<ErrorCode, [string, string, boolean?]> = {
  INVALID_URL: ['That doesn’t look like a link', 'Paste a full address that starts with https://, such as an arXiv abstract page.'],
  BLOCKED_URL: ['That address can’t be fetched', 'Only public web pages can be read. Paste the public link to the article.'],
  FETCH_FAILED: ['The article didn’t load', 'The site didn’t answer in time or refused the request. Try again in a moment, or check the link opens.', true],
  UNSUPPORTED_CONTENT: ['That isn’t an article page', 'explorable reads arXiv papers and HTML articles. For a PDF outside arXiv, paste the page that links to it.'],
  TOO_LITTLE_TEXT: ['Too little text to explain', 'The page has under 600 characters of readable text. Paste the article itself, not an index or landing page.'],
  AI_UNAVAILABLE: ['Live generation is off here', 'Turning a new link into an essay needs Workers AI, which this copy of explorable runs without, and the page matches none of the built-in explainers.'],
  PLAN_INVALID: ['The model’s plan didn’t hold up', 'Its answer failed our checks, so nothing half-made is shown. Try again in 10 minutes.'],
  NO_FIGURE: ['No live figure fits this idea yet', 'The figure kit has no tested model for this core idea. The samples show what works today.'],
  RATE_LIMITED: ['Too many new links at once', 'Wait a minute, then try again. Links explained before open instantly.', true],
  INTERNAL: ['Something broke on our side', 'It isn’t your link. Try again in a moment.', true],
  TIMEOUT: ['That took too long', 'The answer didn’t arrive in time. Try again: the work may finish and be saved meanwhile.', true],
  NETWORK: ['Couldn’t reach explorable', 'The request didn’t get through. Check your connection and try again.', true],
  OFFLINE: ['You’re offline', 'Explaining a link needs the network. The samples below still work offline.', true],
};

export function ErrorState({ error, url, onRetry }: { error: ExplainError; url: string; onRetry: () => void }) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => heading.current?.focus(), []);
  const [title, body, retry] = COPY[error.code];
  return (
    <div className="error-state">
      <section className="error-panel" aria-labelledby="error-heading" data-code={error.code}>
        <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" aria-hidden="true" focusable="false">
          <path d="M12 3 22 20H2Z" />
          <path d="M12 10v4M12 17v.5" strokeLinecap="round" />
        </svg>
        <h1 id="error-heading" tabIndex={-1} ref={heading}>
          {title}
        </h1>
        <p>{body}</p>
        {error.code === 'AI_UNAVAILABLE' && error.hint && <p className="error-hint">{error.hint}</p>}
        <p className="error-source">
          Link: <span className="loading-url">{url}</span>
        </p>
        <p className="error-actions">
          {retry && (
            <button type="button" className="button" onClick={onRetry}>
              Try again
            </button>
          )}
          <a href="/" className="hit">
            Edit the link
          </a>
          {error.code === 'AI_UNAVAILABLE' && (
            <a href={SELF_HOST} className="hit">
              Self-host with Workers AI
            </a>
          )}
        </p>
      </section>
      <h2 className="kicker">Open a sample instead</h2>
      <MiniCards />
    </div>
  );
}
