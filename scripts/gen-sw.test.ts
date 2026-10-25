// The service worker generator (O2): what is precached, the hashed cache name,
// and that /api/* and other origins are never handled.
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { generate, precacheUrls } from './gen-sw.mjs';

const dirs: string[] = [];
function fakeBuild(files: Record<string, string>) {
  const dir = mkdtempSync(join(tmpdir(), 'gen-sw-'));
  dirs.push(dir);
  for (const [name, body] of Object.entries(files)) {
    mkdirSync(join(dir, name, '..'), { recursive: true });
    writeFileSync(join(dir, name), body);
  }
  return dir;
}
const offline = async () => {
  throw new TypeError('offline');
};
afterEach(() => dirs.splice(0).forEach((d) => rmSync(d, { recursive: true, force: true })));

const BUILD = {
  'index.html': '<!doctype html>',
  '_headers': '/*',
  '.assetsignore': 'wrangler.json',
  'assets/index-abc.js': 'js',
  'assets/index-abc.css': 'css',
  'fonts/serif-latin.woff2': 'font',
  'fonts/OFL.txt': 'licence',
  'favicon.svg': '<svg/>',
  'pdf/attention.pdf': '%PDF',
};

describe('gen-sw', () => {
  it('precaches the shell as / plus every asset and font, not platform files or the sample PDFs', () => {
    expect(precacheUrls(Object.keys(BUILD).toSorted())).toEqual(['/', '/assets/index-abc.css', '/assets/index-abc.js', '/favicon.svg', '/fonts/serif-latin.woff2']);
  });

  it('writes sw.js with a cache name that changes with the build and not with sw.js', () => {
    const dir = fakeBuild(BUILD);
    const first = generate(dir);
    expect(first.name).toMatch(/^explorable-[0-9a-f]{12}$/);
    const sw = readFileSync(join(dir, 'sw.js'), 'utf8');
    expect(sw).toContain(JSON.stringify(first.name));
    expect(sw).toContain(JSON.stringify(first.urls));
    expect(generate(dir).name).toBe(first.name); // the old sw.js is not hashed
    writeFileSync(join(dir, 'assets/index-abc.js'), 'js v2');
    expect(generate(dir).name).not.toBe(first.name);
  });

  it('never handles /api/*, non-GET or cross-origin requests; serves the cached shell offline', async () => {
    const dir = fakeBuild(BUILD);
    generate(dir);
    type Listener = (event: any) => void;
    const on: Record<string, Listener> = {};
    const shell = new Response('shell');
    const self = { addEventListener: (type: string, fn: Listener) => (on[type] = fn), location: { origin: 'https://x.test' } };
    const caches = { match: async (req: Request | string) => (req === '/' ? shell : undefined) };
    new Function('self', 'caches', 'fetch', readFileSync(join(dir, 'sw.js'), 'utf8'))(self, caches, offline);
    const handled = (url: string, init: { method?: string; mode?: string } = {}) => {
      let response: Promise<Response> | undefined;
      on.fetch!({ request: { url, method: init.method ?? 'GET', mode: init.mode ?? 'cors' }, respondWith: (r: Promise<Response>) => (response = r) });
      return response;
    };
    expect(handled('https://x.test/api/explain?url=a')).toBeUndefined();
    expect(handled('https://x.test/api/explain', { mode: 'navigate' })).toBeUndefined();
    expect(handled('https://x.test/pdf/attention.pdf', { mode: 'navigate' })).toBeUndefined();
    expect(handled('https://x.test/assets/index-abc.js', { method: 'POST' })).toBeUndefined();
    expect(handled('https://fonts.example.com/a.woff2')).toBeUndefined();
    expect(await handled('https://x.test/s/diffusion', { mode: 'navigate' })).toBe(shell);
    const src = readFileSync(join(dir, 'sw.js'), 'utf8');
    expect(src).toMatch(/skipWaiting\(\)[\s\S]*clients\.claim\(\)/);
  });

  it('refuses to run before a build', () => {
    expect(() => generate(fakeBuild({}))).toThrow(/build first/);
  });
});
