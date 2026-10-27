// Shared extraction helpers: one streaming htmlparser2 pass collects readable
// blocks (paragraphs, headings, list items) and page metadata.
import { Parser } from 'htmlparser2';
import { ApiError } from '../errors';

export const MIN_TEXT = 600;
export const MAX_TEXT = 12_000;

export interface Extracted {
  kind: 'arxiv' | 'web';
  url: string;
  title: string;
  authors: string[];
  year: number | null;
  abstract: string;
  headings: string[];
  /** Abstract + body text, capped at MAX_TEXT characters. */
  text: string;
}

export type Attrs = Record<string, string>;
export interface Block {
  tag: string;
  text: string;
  /** Characters of the text that sit inside links. */
  links: number;
  /** Id of the innermost content root (article/main), 0 when outside any. */
  root: number;
}
export interface Collected {
  blocks: Block[];
  title: string;
  meta: Map<string, string>;
}
export interface CollectOptions {
  /** Drop this element and everything inside it. */
  skip: (tag: string, attrs: Attrs, inRoot: boolean) => boolean;
  isRoot: (tag: string, attrs: Attrs) => boolean;
}

const BLOCK_TAGS = new Set(['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'li', 'blockquote', 'pre', 'dd']);

export const squash = (s: string): string => s.replace(/\s+/g, ' ').trim();

/** Cut at a word boundary at or before `max` characters. */
export function cap(text: string, max = MAX_TEXT): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const space = cut.lastIndexOf(' ');
  return (space > max * 0.8 ? cut.slice(0, space) : cut).trimEnd();
}

export function requireText(text: string): string {
  if (text.length < MIN_TEXT) {
    throw new ApiError('TOO_LITTLE_TEXT', `Only ${text.length} characters of readable text were found (at least ${MIN_TEXT} are needed).`);
  }
  return text;
}

export const yearOf = (s: string | undefined): number | null => {
  const m = /\b(19|20)\d{2}\b/.exec(s ?? '');
  return m ? Number(m[0]) : null;
};

export function collectBlocks(html: string, { skip, isRoot }: CollectOptions): Collected {
  const blocks: Block[] = [];
  const meta = new Map<string, string>();
  const stack: Array<{ tag: string; skip: boolean; block: boolean; root: number }> = [];
  let roots = 0;
  let title: string | null = null;
  let inTitle = false;
  let buf = '';
  let links = 0;
  const top = () => stack[stack.length - 1];
  const flush = () => {
    const text = squash(buf);
    const block = stack.toReversed().find((f) => f.block);
    if (text && block) blocks.push({ tag: block.tag, text, links: Math.min(links, text.length), root: top()?.root ?? 0 });
    buf = '';
    links = 0;
  };
  const parser = new Parser(
    {
      onopentag(tag, attrs) {
        const parent = top();
        const root = parent?.root ?? 0;
        if (tag === 'meta' && attrs.content) meta.set((attrs.property ?? attrs.name ?? '').toLowerCase(), squash(attrs.content));
        const skipped = Boolean(parent?.skip) || skip(tag, attrs, root > 0);
        const block = !skipped && BLOCK_TAGS.has(tag);
        if (block) flush();
        if (!skipped && tag === 'math') buf += ` ${attrs.alttext ?? ''} `;
        if (!skipped && tag === 'br') buf += ' ';
        if (tag === 'title' && title === null && !stack.some((f) => f.tag === 'svg')) [title, inTitle] = ['', true];
        stack.push({ tag, skip: skipped || tag === 'math', block, root: !skipped && isRoot(tag, attrs) ? ++roots : root });
      },
      ontext(text) {
        const frame = top();
        if (inTitle) title += text;
        if (!frame || frame.skip) return;
        buf += text;
        if (stack.some((f) => f.tag === 'a')) links += squash(text).length;
      },
      onclosetag(tag) {
        if (tag === 'title') inTitle = false;
        if (top()?.block) flush();
        stack.pop();
      },
    },
    { decodeEntities: true },
  );
  parser.end(html);
  return { blocks, title: squash(title ?? ''), meta };
}

export const headingsOf = (blocks: Block[]): string[] => blocks.filter((b) => /^h[1-3]$/.test(b.tag)).map((b) => b.text);
