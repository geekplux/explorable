// URL normalisation and the safety guard.
// The guard runs on the pasted URL and again on every redirect (fetch.ts).
// WHATWG URL parsing already turns decimal/hex/octal IPv4 forms such as
// http://2130706433 or http://0x7f.1 into dotted form, so one check covers all.
import { ApiError } from './errors';

export type Source =
  | { kind: 'arxiv'; id: string; canonical: string; url: string }
  | { kind: 'web'; canonical: string; url: string };

const ARXIV_ID = String.raw`(\d{4}\.\d{4,5}|[a-z][a-z-]*(?:\.[a-z]{2})?/\d{7})`;
const ARXIV_PATH = new RegExp(String.raw`^/(?:abs|pdf|html)/${ARXIV_ID}(?:v\d+)?(?:\.pdf)?/?$`, 'i');
const ARXIV_BARE = new RegExp(String.raw`^arxiv:\s*${ARXIV_ID}(?:v\d+)?$`, 'i');
const ARXIV_HOSTS = new Set(['arxiv.org', 'www.arxiv.org', 'export.arxiv.org']);
const TRACKING = /^(utm_.*|fbclid|gclid)$/i;

// Private, loopback, link-local, shared, documentation, benchmark, multicast, reserved.
const BLOCKED_V4: Array<[string, number]> = [
  ['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8], ['169.254.0.0', 16],
  ['172.16.0.0', 12], ['192.0.0.0', 24], ['192.0.2.0', 24], ['192.168.0.0', 16],
  ['198.18.0.0', 15], ['198.51.100.0', 24], ['203.0.113.0', 24], ['224.0.0.0', 3],
];
const LOCAL_SUFFIX = /(^|\.)(localhost|localdomain|local|internal|intranet|lan|home|corp|home\.arpa)$/;

const v4 = (ip: string) => ip.split('.').reduce((n, part) => n * 256 + Number(part), 0);

export function isBlockedHost(hostname: string): boolean {
  const lower = hostname.toLowerCase();
  if (lower.startsWith('[')) return true; // IPv6 literals: none are needed for articles
  // An empty label (`127.0.0.1..`, `.foo`) makes the parser treat an IP or local
  // name as a domain, slipping past the checks below; no real article needs one.
  if (lower.startsWith('.') || lower.includes('..')) return true;
  const host = lower.replace(/\.+$/, '');
  if (/^\d+\.\d+\.\d+\.\d+$/.test(host)) {
    const ip = v4(host);
    return BLOCKED_V4.some(([base, bits]) => Math.floor(ip / 2 ** (32 - bits)) === Math.floor(v4(base) / 2 ** (32 - bits)));
  }
  return !host.includes('.') || LOCAL_SUFFIX.test(host);
}

/** Parse (adding https:// when no scheme is given) and apply the safety guard. */
export function guardUrl(input: string): URL {
  const raw = input.trim();
  let url: URL;
  try {
    if (!raw || raw.length > 2048) throw new Error('length');
    url = new URL(/^[a-z][a-z\d+.-]*:\/\//i.test(raw) ? raw : `https://${raw}`);
  } catch {
    throw new ApiError('INVALID_URL', 'That does not look like a link.');
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new ApiError('BLOCKED_URL', `${url.protocol.slice(0, -1)} links are not supported.`);
  }
  if (url.username || url.password) throw new ApiError('BLOCKED_URL', 'Links with credentials are not allowed.');
  if (url.port) throw new ApiError('BLOCKED_URL', 'Links with a custom port are not allowed.');
  if (isBlockedHost(url.hostname)) throw new ApiError('BLOCKED_URL', 'Private or local addresses are not allowed.');
  return url;
}

const arxiv = (id: string): Source => ({ kind: 'arxiv', id, canonical: `arxiv:${id}`, url: `https://arxiv.org/abs/${id}` });

/** Canonical source for a pasted URL: arXiv papers by id, other pages cleaned. */
export function normaliseUrl(input: string): Source {
  const bare = ARXIV_BARE.exec(input.trim())?.[1];
  if (bare) return arxiv(bare);
  const url = guardUrl(input);
  const id = ARXIV_HOSTS.has(url.hostname) ? ARXIV_PATH.exec(url.pathname)?.[1] : undefined;
  if (id) return arxiv(id);
  url.hash = '';
  url.search = new URLSearchParams([...url.searchParams].filter(([key]) => !TRACKING.test(key))).toString();
  return { kind: 'web', canonical: url.href, url: url.href };
}
