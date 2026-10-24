import { type FormEvent, useEffect, useId, useRef, useState } from 'react';
import { classifyInput } from '../lib/input.ts';
import { explainPath, navigate } from '../router.ts';
import { useOnline } from './states/OfflineBanner.tsx';

/** The input survives navigation (Cancel, Back, "Edit the link" come back to it filled). */
let draft = '';
export const setDraft = (value: string): void => {
  draft = value;
};
export const getDraft = (): string => draft;

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
  const frame = useRef(0);
  const id = useId();

  useEffect(() => () => cancelAnimationFrame(frame.current), []);

  const change = (next: string) => {
    cancelAnimationFrame(frame.current);
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
    if (parsed.kind === 'url' && online) return navigate(explainPath(parsed.url));
    // Only a malformed or missing link marks the field invalid; offline or a search is not the input's fault.
    setInvalid(parsed.kind === 'empty' || parsed.kind === 'invalid');
    const next =
      parsed.kind === 'empty'
        ? 'Paste a link to an arXiv paper or a blog post, or type a topic.'
        : parsed.kind === 'invalid'
          ? parsed.message
          : parsed.kind === 'text'
            ? 'Pick a built-in match below, or paste a link.'
            : 'You’re offline, so this link can’t be read now.';
    // Clear, move focus, then set the message on the next frame: the alert is
    // announced once (not also as the focused input's description), and a
    // repeated identical message is announced again.
    setMessage('');
    input.current?.focus();
    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => setMessage(next));
  };

  return (
    <form className="url-field" onSubmit={submit} noValidate>
      <label htmlFor={id}>Paste a link or type a topic</label>
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
    </form>
  );
}
