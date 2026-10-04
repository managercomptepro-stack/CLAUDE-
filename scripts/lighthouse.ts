/**
 * `npm run lighthouse [-- <base-url>] [-- --pages=/,/connexion]`: Lighthouse mobile (default
 * throttling: slow 4G, 4× CPU) on each page, then a summary and the CLAUDE.md § 5 budget.
 * Base URL: the argument, else LH_URL, else the local build served by `vite preview` (4173).
 */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from '@playwright/test';

interface Audit {
  numericValue?: number;
  details?: { items?: { transferSize?: number; resourceType?: string }[] };
}
interface Report {
  categories: { performance: { score: number | null } };
  audits: Record<string, Audit | undefined>;
  runtimeError?: { message: string };
}

const args = process.argv.slice(2);
const base = (
  args.find((a) => /^https?:/.test(a)) ??
  process.env['LH_URL'] ??
  'http://localhost:4173'
).replace(/\/$/, '');
const pagesArg = args.find((a) => a.startsWith('--pages='));
const pages = pagesArg ? pagesArg.slice('--pages='.length).split(',') : ['/', '/connexion', '/compte'];
/** CLAUDE.md § 5: performance ≥ 85 on home, search and listing; LCP ≤ 2.5 s; CLS ≤ 0.05. */
const BUDGET_PAGES = new Set(['/', '/recherche', '/annonce']);
const outDir = join('test-results', 'lighthouse');
mkdirSync(outDir, { recursive: true });

/**
 * Chromium installed by Playwright, as « chrome-headless-shell ». `--no-sandbox`: Chrome's own
 * sandbox cannot start inside the sandboxed shell of the dev machine; acceptable here because
 * this measuring browser only opens our own pages.
 */
function chromePath(): string {
  const full = chromium.executablePath();
  const shell = full
    .replace(/chromium-(\d+)/, 'chromium_headless_shell-$1')
    .replace(/chrome-(win64|linux|mac)/, 'chrome-headless-shell-$1')
    .replace(/chrome(\.exe)?$/, 'chrome-headless-shell$1');
  return existsSync(shell) ? shell : full;
}

const kb = (bytes: number) => `${(bytes / 1024).toFixed(1)} Ko`;
const sec = (ms: number) => `${(ms / 1000).toFixed(2)} s`;
let failed = false;

for (const page of pages) {
  const url = base + page;
  const file = join(outDir, `${page === '/' ? 'accueil' : page.slice(1).replace(/\W+/g, '-')}.json`);
  const run = spawnSync(
    process.execPath,
    [
      join('node_modules', 'lighthouse', 'cli', 'index.js'),
      url,
      '--only-categories=performance',
      '--output=json',
      `--output-path=${file}`,
      '--chrome-flags=--headless=new --no-sandbox',
      '--quiet',
    ],
    { env: { ...process.env, CHROME_PATH: chromePath() }, stdio: ['ignore', 'ignore', 'inherit'] },
  );
  if (run.status !== 0) {
    console.error(`E_LIGHTHOUSE ${url}: exit ${run.status}`);
    failed = true;
    continue;
  }
  const r = JSON.parse(readFileSync(file, 'utf8')) as Report;
  if (r.runtimeError) {
    console.error(`E_LIGHTHOUSE ${url}: ${r.runtimeError.message}`);
    failed = true;
    continue;
  }
  const num = (id: string) => r.audits[id]?.numericValue ?? NaN;
  const requests = r.audits['network-requests']?.details?.items ?? [];
  const score = Math.round((r.categories.performance.score ?? 0) * 100);
  const lcp = num('largest-contentful-paint');
  const cls = num('cumulative-layout-shift');
  const byType = new Map<string, number>();
  for (const it of requests) {
    const t = it.resourceType ?? 'Other';
    byType.set(t, (byType.get(t) ?? 0) + (it.transferSize ?? 0));
  }
  console.info(
    [
      `${page}  score ${score}`,
      `FCP ${sec(num('first-contentful-paint'))}`,
      `LCP ${sec(lcp)}`,
      `TBT ${Math.round(num('total-blocking-time'))} ms`,
      `CLS ${cls.toFixed(3)}`,
      `poids ${kb(num('total-byte-weight'))}`,
      `${requests.length} requêtes`,
    ].join(' · '),
  );
  console.info(
    '   ' +
      [...byType.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([t, b]) => `${t} ${kb(b)}`)
        .join(', '),
  );
  if (BUDGET_PAGES.has(page) && (score < 85 || lcp > 2500 || cls > 0.05)) {
    console.error(`   BUDGET ✗ ${page} (score ≥ 85, LCP ≤ 2,5 s, CLS ≤ 0,05)`);
    failed = true;
  }
}

process.exit(failed ? 1 : 0);
