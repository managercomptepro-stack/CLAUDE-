/** `npm run pages:sync` — (re)writes ville/{slug}.html for the 28 cities of src/data/cities.ts. */
import { mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { PAGES } from '../src/shell/pages.ts';
import { cityPageHtml } from './city-pages.ts';

const files = new Set(PAGES.filter((p) => p.city).map((p) => p.file));
mkdirSync('ville', { recursive: true });
for (const name of readdirSync('ville')) {
  if (!files.has(`ville/${name}`)) rmSync(`ville/${name}`);
}
for (const file of files) writeFileSync(file, cityPageHtml());
console.info(`pages:sync: ${files.size} city pages written in ville/`);
