/** What the single input holds: a link to explain, words to search, or a broken link. */
export type Input = { kind: 'empty' } | { kind: 'url'; url: string } | { kind: 'text'; query: string } | { kind: 'invalid'; message: string };

const ARXIV_ID = /^(?:arxiv:)?(\d{4}\.\d{4,5}(?:v\d+)?)$/i;
const BARE_HOST = /^[a-z0-9-]+(?:\.[a-z0-9-]+)*\.[a-z]{2,}(?:[/?#]\S*)?$/i;

/** Classify input deterministically: http(s) links, bare hosts and arXiv ids are links; anything else is a search. */
export function classifyInput(raw: string): Input {
  const s = raw.trim();
  if (!s) return { kind: 'empty' };
  const id = ARXIV_ID.exec(s)?.[1];
  if (id) return { kind: 'url', url: `https://arxiv.org/abs/${id}` };
  const scheme = /^([a-z][a-z0-9+.-]*):/i.exec(s)?.[1]?.toLowerCase();
  if (scheme && scheme !== 'http' && scheme !== 'https' && !/^\S+:\d/.test(s)) {
    return { kind: 'invalid', message: 'Only http and https links work. Paste the article’s web address.' };
  }
  if (!scheme && !BARE_HOST.test(s)) return { kind: 'text', query: s };
  try {
    const url = new URL(scheme === 'http' || scheme === 'https' ? s : `https://${s}`);
    if (/\s/.test(s) || !url.hostname.includes('.')) throw new Error('no host');
    return { kind: 'url', url: url.href };
  } catch {
    return { kind: 'invalid', message: 'That link looks incomplete. Paste the full address, such as https://arxiv.org/abs/1706.03762.' };
  }
}
