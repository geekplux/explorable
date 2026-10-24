/**
 * "Show data": a toggle button and a real `<table>` of the current values (A3),
 * in a focusable, labelled scroll region so a wide table never scrolls the page.
 */
import { setMath } from './math.ts';

/** A column header: its text, or the text plus a spoken form for screen readers (e.g. "signal" for "signal √ᾱ_t"). */
export type Column = string | { text: string; spoken?: string };

export function createDataTable(id: string, caption: string, columns: readonly Column[], rowHeader = 0, vars?: ReadonlySet<string>) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'xfig-data-toggle';
  button.textContent = 'Show data';
  button.setAttribute('aria-expanded', 'false');
  button.setAttribute('aria-controls', id);

  const wrap = document.createElement('div');
  wrap.id = id;
  wrap.className = 'xfig-table-wrap';
  wrap.hidden = true;
  wrap.setAttribute('role', 'region');
  wrap.tabIndex = 0;
  wrap.setAttribute('aria-labelledby', `${id}-caption`);
  const table = document.createElement('table');
  table.className = 'xfig-table';
  wrap.append(table);
  const cap = table.createCaption();
  cap.id = `${id}-caption`;
  cap.textContent = caption;
  const head = table.createTHead().insertRow();
  const body = table.createTBody();
  let shown = '';
  /** Set the column headers (skipped if unchanged). */
  const setColumns = (cols: readonly Column[]) => {
    const parts = cols.map((c) => (typeof c === 'string' ? { text: c } : c));
    const key = JSON.stringify(parts);
    if (key === shown) return;
    shown = key;
    head.replaceChildren(
      ...parts.map(({ text, spoken }) => {
        const th = Object.assign(document.createElement('th'), { scope: 'col' });
        setMath(th, text, { vars });
        if (spoken && spoken !== text) th.setAttribute('aria-label', spoken);
        return th;
      }),
    );
  };
  setColumns(columns);

  button.addEventListener('click', () => {
    wrap.hidden = !wrap.hidden;
    button.setAttribute('aria-expanded', String(!wrap.hidden));
    button.textContent = wrap.hidden ? 'Show data' : 'Hide data';
  });

  return {
    button,
    /** The scroll region holding the table; mount this. */
    wrap,
    table,
    setColumns,
    /** A one-line summary after the caption, e.g. the current verdict. */
    setNote(note: string) {
      cap.textContent = note ? `${caption} — ${note}` : caption;
    },
    /** Replace the body rows; the `rowHeader` cell of each row is a row header. */
    setRows(rows: readonly (readonly string[])[]) {
      body.replaceChildren(
        ...rows.map((cells) => {
          const tr = document.createElement('tr');
          cells.forEach((text, i) => {
            const cell = document.createElement(i === rowHeader ? 'th' : 'td');
            if (i === rowHeader) cell.setAttribute('scope', 'row');
            cell.textContent = text;
            tr.append(cell);
          });
          return tr;
        }),
      );
    },
  };
}
