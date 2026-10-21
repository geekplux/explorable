const REPO = 'https://github.com/geekplux/explorable';
const LINKS = [
  ['MIT licence', `${REPO}/blob/main/LICENSE`],
  ['Source on GitHub', REPO],
  ['Accessibility', `${REPO}#accessibility`],
] as const;

export function Footer() {
  return (
    <footer className="site-footer shell">
      <ul>
        <li>Made with explorable</li>
        {LINKS.map(([label, href]) => (
          <li key={href}>
            <span aria-hidden="true">·</span>
            <a href={href} className="hit">
              {label}
            </a>
          </li>
        ))}
      </ul>
    </footer>
  );
}
