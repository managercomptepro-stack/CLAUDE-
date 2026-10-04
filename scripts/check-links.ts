/**
 * Internal link validator (PLAN § Phase 8), run on the build by `npm test`:
 * - every internal `href` / `src` / `srcset` of every dist/**\/*.html leads to a built file
 *   (Firebase Hosting `cleanUrls`: « /cgu » → cgu.html);
 * - an anchor pointing at a static page (legal pages, /aide) exists in that page;
 * - every sitemap.xml address is on SITE_URL and leads to a built page;
 * - the legal texts are in the HTML only, never in the JavaScript bundle.
 * Prints one summary line, or the dead links, and exits with 1 when something is wrong.
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { legalFr } from '../src/i18n/legal-fr.ts';
import { isStaticPage } from '../src/shell/legal.ts';
import { pageByFile, SITE_URL } from '../src/shell/pages.ts';

const DIST = resolve(fileURLToPath(new URL('..', import.meta.url)), 'dist');

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

/** Built file served for an internal path, or null. */
export function resolvePath(path: string, dist = DIST): string | null {
  const clean = decodeURIComponent(path);
  const candidates = clean.endsWith('/') ? [`${clean}index.html`] : [clean, `${clean}.html`];
  for (const c of candidates) {
    const file = join(dist, c);
    if (existsSync(file) && statSync(file).isFile()) return file;
  }
  return null;
}

/** Internal references of an HTML document (href, src, srcset). */
export function internalRefs(html: string): string[] {
  const refs: string[] = [];
  for (const m of html.matchAll(/\s(?:href|src)="([^"]*)"/g)) refs.push(m[1] ?? '');
  for (const m of html.matchAll(/\ssrcset="([^"]*)"/g)) {
    for (const part of (m[1] ?? '').split(',')) refs.push(part.trim().split(/\s+/)[0] ?? '');
  }
  return refs.filter((r) => (r.startsWith('/') && !r.startsWith('//')) || r.startsWith('#'));
}

function hasId(html: string, id: string): boolean {
  return html.includes(`id="${id}"`);
}

function main(): void {
  if (!existsSync(DIST)) {
    console.error('[check-links] dist/ absent : lancez « npm run build » avant.');
    process.exit(1);
  }
  const files = walk(DIST);
  const htmlFiles = files.filter((f) => f.endsWith('.html'));
  const errors: string[] = [];
  let checked = 0;

  for (const file of htmlFiles) {
    const html = readFileSync(file, 'utf8');
    const from = relative(DIST, file).replace(/\\/g, '/');
    for (const ref of internalRefs(html)) {
      checked++;
      const [beforeHash = '', hash = ''] = ref.split('#');
      const path = beforeHash.split('?')[0] ?? '';
      const target = path ? resolvePath(path) : file;
      if (!target) {
        errors.push(`${from} → ${ref} : aucun fichier`);
        continue;
      }
      if (!hash || !target.endsWith('.html')) continue;
      const page = pageByFile(relative(DIST, target).replace(/\\/g, '/'));
      // Anchors of pages rendered by JavaScript (/compte#notifications…) are checked end to end.
      if (page && isStaticPage(page.id)) {
        if (!hasId(readFileSync(target, 'utf8'), hash)) errors.push(`${from} → ${ref} : ancre absente`);
      }
    }
  }

  const sitemapFile = join(DIST, 'sitemap.xml');
  const sitemap = existsSync(sitemapFile) ? readFileSync(sitemapFile, 'utf8') : '';
  if (!sitemap) errors.push('sitemap.xml absent');
  const locs = [...sitemap.matchAll(/<loc>([^<]*)<\/loc>/g)].map((m) => m[1] ?? '');
  for (const loc of locs) {
    checked++;
    if (!loc.startsWith(SITE_URL)) errors.push(`sitemap → ${loc} : hors de ${SITE_URL}`);
    else if (!resolvePath(loc.slice(SITE_URL.length) || '/')) errors.push(`sitemap → ${loc} : aucun fichier`);
  }
  if (!existsSync(join(DIST, 'robots.txt'))) errors.push('robots.txt absent');

  const markers = [legalFr.privacy.intro.slice(0, 50), legalFr.terms.intro.slice(0, 50), legalFr.help.intro];
  for (const js of files.filter((f) => f.endsWith('.js'))) {
    const code = readFileSync(js, 'utf8');
    if (markers.some((m) => code.includes(m)))
      errors.push(`${relative(DIST, js)} : textes légaux dans le JS`);
  }

  if (errors.length > 0) {
    console.error(`[check-links] ${errors.length} problème(s) :\n${errors.join('\n')}`);
    process.exit(1);
  }
  console.log(
    `[check-links] ${htmlFiles.length} pages, ${checked} liens internes et adresses du sitemap (${locs.length}) : aucun lien mort.`,
  );
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
