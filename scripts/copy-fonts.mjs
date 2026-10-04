// Copies the self-hosted fonts (latin subset, woff2) and their OFL licences from @fontsource
// into public/fonts (ARCHITECTURE § 10). Run with `npm run fonts` after a font upgrade.
import { copyFileSync, mkdirSync, statSync } from 'node:fs';

const FILES = [
  ['@fontsource/karla/files/karla-latin-400-normal.woff2', 'karla-latin-400-normal.woff2'],
  ['@fontsource/karla/files/karla-latin-700-normal.woff2', 'karla-latin-700-normal.woff2'],
  ['@fontsource/young-serif/files/young-serif-latin-400-normal.woff2', 'young-serif-latin-400-normal.woff2'],
  ['@fontsource/karla/LICENSE', 'LICENSE-Karla-OFL.txt'],
  ['@fontsource/young-serif/LICENSE', 'LICENSE-YoungSerif-OFL.txt'],
];

mkdirSync('public/fonts', { recursive: true });
for (const [from, to] of FILES) {
  copyFileSync(`node_modules/${from}`, `public/fonts/${to}`);
  console.log(`${to}  ${statSync(`public/fonts/${to}`).size} bytes`);
}
