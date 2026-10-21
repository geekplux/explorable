import { fileURLToPath } from 'node:url';
import { cloudflare } from '@cloudflare/vite-plugin';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

// Vitest reuses this config; it must never start workerd (D15: plain Vitest).
const testing = Boolean(process.env.VITEST);

export default defineConfig({
  // The Cloudflare plugin runs worker/index.ts in workerd for `vite dev` and
  // `vite preview`, and builds dist/client + dist/explorable (D2).
  plugins: [react(), ...(testing ? [] : [cloudflare()])],
  // Keep SVG thumbnails as files (<img src="/assets/…svg">), never data: URIs.
  build: { assetsInlineLimit: (file) => (file.endsWith('.svg') ? false : undefined) },
  resolve: {
    alias: { '@kit': fileURLToPath(new URL('./skills/explorable/kit/src', import.meta.url)) },
  },
  test: {
    include: [
      'src/**/*.test.{ts,tsx}',
      'skills/explorable/kit/{src,react}/**/*.test.{ts,tsx}',
      'worker/**/*.test.ts',
      'scripts/**/*.test.ts',
    ],
    // Shared, RAM-tight machine: few forked workers. DOM tests opt in per file
    // with `// @vitest-environment happy-dom`.
    pool: 'forks',
    maxWorkers: 2,
    environment: 'node',
  },
});
