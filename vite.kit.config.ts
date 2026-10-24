// pnpm build:kit: the framework-free kit as one minified ESM file plus its CSS,
// committed to skills/explorable/kit/dist so the skill works with no install (D5).
// Output must be byte-for-byte deterministic: CI rebuilds it and runs git diff.
import { readFileSync } from 'node:fs';
import { defineConfig, type Plugin } from 'vite';

const FONT = 'public/fonts/serif-latin.woff2';

/** Ship the files the standalone builder needs beside the bundle. */
const skillAssets: Plugin = {
  name: 'explorable-skill-assets',
  generateBundle() {
    const emit = (fileName: string, source: string | Uint8Array) => this.emitFile({ type: 'asset', fileName, source });
    // Node 20 reads a bare .js file as CommonJS unless a package.json says otherwise.
    emit('package.json', `${JSON.stringify({ type: 'module', private: true }, null, 2)}\n`);
    emit('serif-latin.woff2', readFileSync(FONT));
    emit('OFL.txt', readFileSync('public/fonts/OFL.txt'));
  },
};

export default defineConfig({
  publicDir: false,
  logLevel: 'warn',
  plugins: [skillAssets],
  build: {
    outDir: 'skills/explorable/kit/dist',
    emptyOutDir: true,
    target: 'es2022',
    minify: true,
    sourcemap: false,
    reportCompressedSize: false,
    // Library mode keeps whitespace in ES output by default; strip it too.
    rolldownOptions: { output: { minify: true } },
    lib: {
      entry: 'skills/explorable/kit/src/bundle.ts',
      formats: ['es'],
      fileName: () => 'explorable-kit.js',
      cssFileName: 'explorable-kit',
    },
  },
});
