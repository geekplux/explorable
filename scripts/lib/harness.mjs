// Headless-browser harness shared by smoke and e2e scripts (docs/PLAN.md §5.9).
// One preview server, one system Chrome; both are always cleaned up, also on
// SIGINT/SIGTERM. Chrome runs sandboxed unless EXPLORABLE_CHROME_NO_SANDBOX=1.
import { execFileSync, spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { createServer } from 'node:net';
import { join } from 'node:path';
import { chromium } from 'playwright-core';

const VITE = join(process.cwd(), 'node_modules', 'vite', 'bin', 'vite.js');
const CHROME = process.env.CHROME_PATH || '/usr/bin/google-chrome';

/** Everything that went wrong in the run; any entry makes the run fail. @type {string[]} */
export const problems = [];
/** @type {Array<() => Promise<string>>} */
const cleanups = [];
/** @type {string[]} */
const cleaned = [];

async function cleanup() {
  for (let fn = cleanups.pop(); fn; fn = cleanups.pop()) {
    try {
      cleaned.push(await fn());
    } catch (error) {
      problems.push(`cleanup failed: ${error}`);
    }
  }
}

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.once(signal, () => {
    cleanup().finally(() => process.exit(130));
  });
}

/** Run `main`, always clean up, print a summary and set the exit code. */
export async function run(main, successMessage) {
  try {
    await main();
  } catch (error) {
    problems.push(error instanceof Error ? (error.stack ?? error.message) : String(error));
  } finally {
    await cleanup();
    console.log(`cleaned up: ${cleaned.filter(Boolean).join(', ') || 'nothing'}`);
  }
  if (problems.length) {
    console.error(`\n${problems.length} problem(s):\n- ${problems.join('\n- ')}`);
    process.exitCode = 1;
  } else {
    console.log(successMessage);
  }
}

function waitForExit(child, ms) {
  return new Promise((resolve) => {
    if (child.exitCode !== null || child.signalCode !== null) return resolve(true);
    const timer = setTimeout(() => resolve(false), ms);
    child.once('exit', () => {
      clearTimeout(timer);
      resolve(true);
    });
  });
}

async function waitForHttp(url, child, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`preview exited early with code ${child.exitCode}`);
    try {
      const res = await fetch(url);
      if (res.status === 200) return;
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`preview did not answer 200 at ${url} within ${timeoutMs} ms`);
}

/** Listen on 127.0.0.1:`port` (0 = any), then release it; resolves the port. */
const probePort = (port) =>
  new Promise((resolve, reject) => {
    const server = createServer().once('error', reject);
    server.listen(port, '127.0.0.1', () => {
      const { port: got } = /** @type {import('node:net').AddressInfo} */ (server.address());
      server.close(() => resolve(got));
    });
  });

/** `preferred` if it is free, else any free port. */
const freePort = (preferred) => probePort(preferred).catch(() => probePort(0));

/**
 * Build (optionally), start `vite preview` (which runs the Worker in workerd
 * via @cloudflare/vite-plugin) in its own process group, run
 * fn({ baseURL }). Uses port 4173 when free, otherwise any free port.
 */
export async function withPreview(fn, { build = true, port: preferred = 4173 } = {}) {
  const port = await freePort(preferred);
  if (build) execFileSync(process.execPath, [VITE, 'build', '--logLevel', 'warn'], { stdio: 'inherit' });
  const child = spawn(
    process.execPath,
    [VITE, 'preview', '--host', '127.0.0.1', '--port', String(port), '--strictPort'],
    { detached: true, stdio: 'ignore' },
  );
  const pid = child.pid;
  if (pid === undefined) throw new Error('could not start vite preview');
  cleanups.push(async () => {
    try {
      process.kill(-pid, 'SIGTERM');
    } catch {
      return `preview ${pid}`; // already gone
    }
    if (!(await waitForExit(child, 3000))) process.kill(-pid, 'SIGKILL');
    // The Cloudflare plugin's workerd shares the group; make sure none of it outlives vite.
    await new Promise((r) => setTimeout(r, 200));
    try {
      process.kill(-pid, 'SIGKILL');
    } catch {
      // group already gone
    }
    return `preview ${pid} (+ workerd)`;
  });
  const baseURL = `http://127.0.0.1:${port}`;
  await waitForHttp(`${baseURL}/`, child, 30_000);
  return fn({ baseURL });
}

/**
 * Launch one headless system Chrome and run fn({ newPage }). Pages block and
 * record every request outside `baseURL`, and record console errors, page
 * errors, failed requests and HTTP errors into `problems`. Requests to `/api/*`
 * are recorded as problems too (the sample path never calls the Worker) unless
 * the page is opened with `{ allowApi: true }`.
 */
export async function withBrowser(fn, { baseURL }) {
  const browser = await chromium.launch({
    executablePath: CHROME,
    headless: true,
    chromiumSandbox: process.env.EXPLORABLE_CHROME_NO_SANDBOX !== '1',
  });
  cleanups.push(async () => {
    await browser.close();
    return 'browser';
  });
  const origin = new URL(baseURL).origin;

  async function newPage(viewport, { allowApi = false, ...options } = {}) {
    const context = await browser.newContext({ viewport, ...options });
    const blocked = new Set();
    await context.route('**/*', (route) => {
      const url = route.request().url();
      if (url.startsWith('data:')) return route.continue();
      const { origin: to, pathname } = new URL(url);
      if (to === origin && !allowApi && pathname.startsWith('/api/')) problems.push(`unexpected Worker request: ${url}`);
      if (to === origin) return route.continue();
      blocked.add(url);
      problems.push(`third-party request blocked: ${url}`);
      return route.abort('blockedbyclient');
    });
    const page = await context.newPage();
    page.on('console', (msg) => {
      if (msg.type() === 'error') problems.push(`console error on ${page.url()}: ${msg.text()}`);
    });
    page.on('pageerror', (error) => problems.push(`page error on ${page.url()}: ${error.message}`));
    page.on('requestfailed', (req) => {
      if (!blocked.has(req.url())) problems.push(`request failed: ${req.url()} (${req.failure()?.errorText})`);
    });
    page.on('response', (res) => {
      if (res.status() >= 400) problems.push(`HTTP ${res.status()}: ${res.url()}`);
    });
    return page;
  }

  return fn({ browser, newPage });
}

/** Screenshot the full page to `<out>/<name>.png`. */
export async function shot(page, out, name) {
  mkdirSync(out, { recursive: true });
  const path = join(out, `${name}.png`);
  await page.screenshot({ path, fullPage: true });
  return path;
}

/** Parse `--flag value [value…]` arguments into { flag: [values] }. */
/** @param {string[]} argv @returns {Record<string, string[]>} */
export function parseArgs(argv) {
  /** @type {Record<string, string[]>} */
  const args = { _: [] };
  let current = '_';
  for (const arg of argv) {
    if (arg.startsWith('--')) {
      current = arg.slice(2);
      args[current] ??= [];
    } else {
      (args[current] ??= []).push(arg);
    }
  }
  return args;
}
