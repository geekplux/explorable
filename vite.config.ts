import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@kit': fileURLToPath(new URL('./skills/explorable/kit/src', import.meta.url)) },
  },
  test: {
    include: ['src/**/*.test.{ts,tsx}', 'skills/explorable/kit/src/**/*.test.ts'],
    // Shared, RAM-tight machine: few forked workers. DOM tests opt in per file
    // with `// @vitest-environment happy-dom`.
    pool: 'forks',
    maxWorkers: 2,
    environment: 'node',
  },
});
