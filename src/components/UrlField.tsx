import { type FormEvent, useId, useRef, useState } from 'react';
import { classifyInput } from '../lib/input.ts';
import { explainPath, navigate } from '../router.ts';
import { useOnline } from './states/OfflineBanner.tsx';

/** The input survives navigation (Cancel, Back, "Edit the link" come back to it filled). */
let draft = '';
export const setDraft = (value: string): void => {
  draft = value;
};
export const getDraft = (): string => draft;

const TRY = [
  ['Attention Is All You Need', 'https://arxiv.org/abs/1706.03762'],
  ['Bloom Filters by Example', 'https://llimllib.github.io/bloomfilter-tutorial/'],
  ['Denoising diffusion', 'https://arxiv.org/abs/2006.11239'],
] as const;

/**
 * The single input: a link goes to /x?url=, words search the built-in samples
 * (reported through `onQuery`, no network), anything broken gets an inline message.
 */
export function UrlField({ onQuery }: { onQuery: (query: string) => void }) {
  const [value, setValue] = useState(draft);
  const [message, setMessage] = useState('');
  const [invalid, setInvalid] = useState(false);
  const online = useOnline();
  const input = useRef<HTMLInputElement>(null);
  const id = useId();

  const change = (next: string) => {
    setValue(next);
    setDraft(next);
    setMessage('');
    setInvalid(false);
    const parsed = classifyInput(next);
    onQuery(parsed.kind === 'text' ? parsed.query : '');
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const parsed = classifyInput(value);
    // Only a malformed or missing link marks the field invalid; offline or a search is not the input's fault.
    setInvalid(parsed.kind === 'empty' || parsed.kind === 'invalid');
    if (parsed.kind === 'empty') setMessage('Paste a link to an arXiv paper or a blog post, or type a topic.');
    else if (parsed.kind === 'invalid') setMessage(parsed.message);
    else if (parsed.kind === 'text') setMessage('Pick a built-in match below, or paste a link.');
    else if (!online) setMessage('You’re offline, so this link can’t be read now. The samples below still work.');
    else navigate(explainPath(parsed.url));
    if (parsed.kind !== 'url' || !online) input.current?.focus();
  };

  return (
    <form className="url-field" onSubmit={submit} noValidate>
      <label htmlFor={id}>Paste an arXiv or blog link, or type a topic</label>
      <div className="url-row">
        <input
          ref={input}
          id={id}
          type="text"
          inputMode="url"
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          enterKeyHint="go"
          placeholder="https://arxiv.org/abs/1706.03762"
          value={value}
          aria-invalid={invalid || undefined}
          aria-describedby={`${id}-msg`}
          onChange={(e) => change(e.target.value)}
        />
        <button type="submit" className="button primary">
          Explain
        </button>
      </div>
      <p id={`${id}-msg`} className="url-message" role="alert">
        {message && (
          <>
            <span aria-hidden="true">! </span>
            {message}
          </>
        )}
      </p>
      {!value.trim() && (
        <p className="try">
          <span className="kicker">Try</span>
          {TRY.map(([label, url]) => (
            <button key={url} type="button" className="chip" aria-describedby={`${id}-try`} onClick={() => (change(url), input.current?.focus())}>
              {label}
            </button>
          ))}
          <span id={`${id}-try`} hidden>
            Puts its link in the field
          </span>
        </p>
      )}
    </form>
  );
}
