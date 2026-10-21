const ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

/** Escape text for use in HTML content and in quoted attribute values. */
export function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (ch) => ESCAPES[ch] ?? ch);
}

/**
 * Render the tiny inline language used in doc prose: `*em*`, `**strong**`
 * and `` `code` ``. Everything else is escaped text, so the only markup in
 * the output is the markup produced here. Code spans are literal: no
 * emphasis inside them. Unmatched markers stay as plain characters.
 */
export function formatInline(text: string): string {
  return escapeHtml(text)
    .split(/(`[^`\n]+`)/)
    .map((part, i) => {
      if (i % 2 === 1) return `<code>${part.slice(1, -1)}</code>`;
      return part
        .replace(/\*\*(?=\S)([^*]+?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(?=\S)([^*]+?)\*/g, '<em>$1</em>');
    })
    .join('');
}

/** Return the URL if it is absolute http(s), otherwise null (no `javascript:` etc.). */
export function safeHttpUrl(url: string | undefined): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? parsed.href : null;
  } catch {
    return null;
  }
}
