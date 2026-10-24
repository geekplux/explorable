/**
 * Notes (ExplorableDoc v2, docs/redesign/DESIGN.md §9): formulas and sources kept out of the body text behind a
 * marker. A paragraph or the takeaway references a note with `[[id]]`; a math marker renders after its sentence and
 * opens a panel under the paragraph, a source marker renders as the note's label and opens a small card.
 */

/** A valid note id (the schema checks it; `noteIssues` skips notes without one). */
export const NOTE_ID = /^[a-z][a-z0-9-]{0,23}$/;

/** A note marker, `[[id]]`. Anything between the brackets counts, so a mistyped id is reported, not shown. */
export const NOTE_MARK = /\[\[([^[\]\n]{1,40})\]\]/g;

/** "Bill Mill", "A and B", or "Vaswani et al.": the byline's authors, and the label of a source note the Worker builds. */
export function authorLine(authors: readonly string[] | undefined): string {
  if (!authors || authors.length === 0) return '';
  if (authors.length === 1) return authors[0] ?? '';
  if (authors.length === 2) return `${authors[0]} and ${authors[1]}`;
  return `${surname(authors[0] ?? '')} et al.`;
}

/** The family name a citation uses: the last word of a name. */
export const surname = (name: string): string => name.trim().split(/\s+/).pop() ?? '';

/** The note ids a text references, in order. */
export function noteRefs(text: string): string[] {
  return [...text.matchAll(NOTE_MARK)].map((m) => m[1]!.trim());
}

/** The shape `noteIssues` reads: an ExplorableDoc that passed the structural schema. */
interface NotesDoc {
  schema: number;
  title: string;
  dek: string;
  takeaway: string;
  sections: readonly { heading: string; paragraphs: readonly string[]; figure?: { title: string; caption: string; alt: string } }[];
  notes?: readonly { id: string; kind: 'math' | 'source' }[];
}

export interface NoteIssue {
  path: (string | number)[];
  message: string;
}

const where = (path: (string | number)[]) => path.map((k, i) => (typeof k === 'number' ? `[${k}]` : `${i ? '.' : ''}${k}`)).join('');

/**
 * Problems with a doc's notes and markers: markers in a v1 doc or outside paragraphs and the takeaway, unknown or
 * duplicate ids, more than one math marker in a paragraph, a math note referenced twice, and a note never referenced.
 */
export function noteIssues(doc: NotesDoc): NoteIssue[] {
  const out: NoteIssue[] = [];
  const v2 = doc.schema === 2;
  const bodies: [(string | number)[], string][] = [
    ...doc.sections.flatMap((s, i) => s.paragraphs.map((p, j): [(string | number)[], string] => [['sections', i, 'paragraphs', j], p])),
    [['takeaway'], doc.takeaway],
  ];
  const others: [(string | number)[], string][] = [
    [['title'], doc.title],
    [['dek'], doc.dek],
    ...doc.sections.flatMap((s, i): [(string | number)[], string][] => [
      [['sections', i, 'heading'], s.heading],
      ...(s.figure ? (['title', 'caption', 'alt'] as const).map((k): [(string | number)[], string] => [['sections', i, 'figure', k], s.figure![k]]) : []),
    ]),
  ];
  for (const [path, text] of others) {
    const refs = noteRefs(text);
    if (refs.length) out.push({ path, message: `[[${refs[0]}]] marks a note; notes can be referenced only from paragraphs and the takeaway` });
  }
  if (!v2) {
    if (doc.notes) out.push({ path: ['notes'], message: 'notes need "schema": 2' });
    for (const [path, text] of bodies) {
      const refs = noteRefs(text);
      if (refs.length) out.push({ path, message: `[[${refs[0]}]] marks a note, which needs "schema": 2` });
    }
    return out;
  }
  const byId = new Map<string, { kind: string; at: number }>();
  (doc.notes ?? []).forEach((note, i) => {
    // A malformed id already has its own error: skip the note so it is not also reported unknown or unreferenced.
    if (!NOTE_ID.test(note.id)) return;
    if (byId.has(note.id)) out.push({ path: ['notes', i, 'id'], message: `duplicate note id "${note.id}"` });
    else byId.set(note.id, { kind: note.kind, at: i });
  });
  const used = new Map<string, (string | number)[]>();
  for (const [path, text] of bodies) {
    const math: string[] = [];
    for (const id of noteRefs(text)) {
      const note = byId.get(id);
      if (!note) {
        const known = [...byId.keys()];
        out.push({ path, message: `unknown note "${id}"${known.length ? `; the notes are ${known.join(', ')}` : '; the doc has no notes'}` });
        continue;
      }
      const first = used.get(id);
      if (note.kind === 'math') {
        math.push(id);
        if (first) out.push({ path, message: `math note "${id}" is already referenced in ${where(first)}; a math note sits under one paragraph` });
      }
      if (!first) used.set(id, path);
    }
    if (math.length > 1) out.push({ path, message: `at most one math note per paragraph (this one has ${math.join(', ')})` });
  }
  for (const [id, { at }] of byId) {
    if (!used.has(id)) out.push({ path: ['notes', at], message: `note "${id}" is never referenced; put [[${id}]] in a paragraph or the takeaway, or remove the note` });
  }
  return out;
}
