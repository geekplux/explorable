const SITES = [
  ['Vert', 'vert.geekplux.com', 'Turn a GPX track into a terrain poster'],
  ['Reasontrail', 'reasontrail.geekplux.com', 'See how your coding agent got there'],
  ['Pagelapse', 'pagelapse.geekplux.com', 'Watch a web page change over the years'],
  ['markvis', 'github.com/geekplux/markvis', 'Charts written in Markdown'],
] as const;

/** "Made by GeekPlux": the author's site first, then four other projects (DESIGN §4). */
export function MadeBy() {
  return (
    <div className="made-by">
      <a className="maker" href="https://geekplux.com">
        <h2>Made by GeekPlux</h2>
        <span className="made-by-dek">Writing, projects and data visualization</span>
        <span className="made-by-url">geekplux.com</span>
      </a>
      <ul className="made-by-sites">
        {SITES.map(([name, host, dek]) => (
          <li key={host}>
            <a href={`https://${host}`}>
              <span className="made-by-name">{name}</span>
              <span className="made-by-dek">{dek}</span>
              <span className="made-by-url">{host}</span>
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
