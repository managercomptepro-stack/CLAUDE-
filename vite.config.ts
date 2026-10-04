import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import preact from '@preact/preset-vite';
import { defineConfig } from 'vite';
import { shellPlugin } from './scripts/vite-shell-plugin.ts';
import { entryName, PAGES } from './src/shell/pages.ts';

const root = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  appType: 'mpa',
  plugins: [preact(), shellPlugin()],
  server: { port: 5173, strictPort: true },
  build: {
    target: 'es2020',
    rolldownOptions: {
      input: Object.fromEntries(PAGES.map((p) => [entryName(p), resolve(root, p.file)])),
    },
  },
});
