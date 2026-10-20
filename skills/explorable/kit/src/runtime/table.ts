/** "Show data": a toggle button and a real `<table>` of the current values (A3). */
export function createDataTable(id: string, caption: string, columns: readonly string[], rowHeader = 0) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'xfig-data-toggle';
  button.textContent = 'Show data';
  button.setAttribute('aria-expanded', 'false');
  button.setAttribute('aria-controls', id);

  const table = document.createElement('table');
  table.id = id;
  table.className = 'xfig-table';
  table.hidden = true;
  const cap = table.createCaption();
  cap.textContent = caption;
  const head = table.createTHead().insertRow();
  const body = table.createTBody();
  let shown = '';
  /** Set the column headers (skipped if unchanged). */
  const setColumns = (cols: readonly string[]) => {
    if (cols.join('\n') === shown) return;
    shown = cols.join('\n');
    head.replaceChildren(
      ...cols.map((c) => Object.assign(document.createElement('th'), { scope: 'col', textContent: c })),
    );
  };
  setColumns(columns);

  button.addEventListener('click', () => {
    table.hidden = !table.hidden;
    button.setAttribute('aria-expanded', String(!table.hidden));
    button.textContent = table.hidden ? 'Show data' : 'Hide data';
  });

  return {
    button,
    table,
    setColumns,
    /** A one-line summary after the caption, e.g. the current verdict. */
    setNote(note: string) {
      cap.textContent = note ? `${caption}. ${note}` : caption;
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
