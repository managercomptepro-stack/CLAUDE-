/**
 * Phase 8: legal pages and /aide readable without JavaScript, footer, Open Graph, and every
 * internal link of the rendered pages (validator: no dead link).
 */
import { expect, test, type Page } from '@playwright/test';
import { DEMO_SETTINGS } from '../../src/data/settings.ts';
import { legalFr } from '../../src/i18n/legal-fr.ts';
import { isStaticPage } from '../../src/shell/legal.ts';
import { pageByPath, PAGES } from '../../src/shell/pages.ts';
import { cityFor, seedListing } from './feed-fixtures';
import { verifiedMember } from './helpers';

const STATIC = [
  { path: '/cgu', heading: legalFr.terms.heading },
  { path: '/confidentialite', heading: legalFr.privacy.heading },
  { path: '/mentions-legales', heading: legalFr.legal.heading },
  { path: '/regles', heading: legalFr.rules.heading },
  { path: '/aide', heading: legalFr.help.heading },
];

test.describe('static pages without JavaScript', () => {
  test.use({ javaScriptEnabled: false });

  for (const s of STATIC) {
    test(`${s.path} is complete with JavaScript off`, async ({ page }) => {
      await page.goto(s.path);
      await expect(page.locator('h1')).toHaveText(s.heading);
      await expect(page.locator('[aria-busy="true"]')).toHaveCount(0);
      if (s.path === '/aide') {
        await expect(page.locator('details.faq')).toHaveCount(legalFr.help.questions.length);
        await page.getByText(legalFr.help.questions[0]!.question).click();
        await expect(page.locator('details.faq').first()).toHaveAttribute('open', '');
        await expect(page.locator('[data-support-link]')).toHaveAttribute(
          'href',
          /^https:\/\/wa\.me\/237678802447\?text=/,
        );
      } else {
        expect(await page.locator('section.legal__section').count()).toBeGreaterThan(3);
        // Table of contents → anchor of the page.
        const first = page.locator('.legal__toc a').first();
        const anchor = (await first.getAttribute('href')) ?? '';
        await first.click();
        await expect(page).toHaveURL(new RegExp(`${anchor}$`));
        await expect(page.locator(anchor)).toBeInViewport();
      }
      await expect(page.locator('footer.sitefoot a')).toHaveCount(5);
    });
  }
});

test('/aide: the WhatsApp button uses the support number of the settings', async ({ page }) => {
  await page.goto('/aide');
  const link = page.locator('[data-support-link]');
  const digits = DEMO_SETTINGS.supportWhatsApp.replace(/\D/g, '');
  await expect(link).toHaveAttribute('href', new RegExp(`^https://wa\\.me/${digits}\\?text=Bonjour`));
  await expect(link).toHaveAttribute('target', '_blank');
  await expect(link.locator('img')).toHaveAttribute('src', '/brands/whatsapp-glyph-black.svg');
});

test('Open Graph and footer on the home page', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute(
    'content',
    'https://nioxxer.com/og-image.png',
  );
  await expect(page.locator('meta[property="og:title"]')).toHaveAttribute(
    'content',
    'NIOXXER — Rencontres libres au Cameroun',
  );
  const og = await page.request.get('/og-image.png');
  expect(og.status()).toBe(200);
  expect(og.headers()['content-type']).toContain('image/png');
  // Footer below the first screen at load: it cannot shift what the visitor sees (CLS).
  const top = await page.locator('footer.sitefoot').evaluate((el) => el.getBoundingClientRect().top);
  expect(top).toBeGreaterThanOrEqual(page.viewportSize()!.height - 80);
});

async function linksOf(page: Page): Promise<string[]> {
  return page.locator('a[href]').evaluateAll((as) => as.map((a) => a.getAttribute('href') ?? ''));
}

test('every internal link of the rendered pages leads to a page (and an existing anchor)', async ({
  page,
}, info) => {
  test.skip(info.project.name !== 'mobile-375', 'links do not depend on the screen size');
  test.setTimeout(240_000);
  const city = cityFor(info, 'links');
  const { id } = await seedListing({ citySlug: city, title: 'Annonce des liens' });
  const uid = id.split('_')[0];
  const visited = new Set<string>();
  const found = new Map<string, string>(); // href → page where it was seen

  const crawl = async (path: string) => {
    await page.goto(path);
    await page.waitForLoadState('networkidle');
    visited.add(path);
    for (const href of await linksOf(page)) {
      if (!href.startsWith('/') || href.startsWith('//')) continue;
      if (!found.has(href)) found.set(href, path);
    }
  };

  const start = [
    ...PAGES.filter((p) => !p.city && p.id !== 'listing' && p.id !== 'member').map((p) => p.path),
    `/ville/${city}`,
    `/annonce?id=${id}`,
    `/membre?u=${uid}`,
  ];
  for (const path of start) await crawl(path);
  // Pages behind the account guard, signed in.
  await verifiedMember(page);
  for (const path of ['/compte', '/publier']) await crawl(path);

  expect(found.size).toBeGreaterThan(20);
  const dead: string[] = [];
  for (const [href, from] of found) {
    const [beforeHash = '', hash] = href.split('#');
    const path = beforeHash.split('?')[0] ?? '';
    const res = await page.request.get(beforeHash);
    const target = pageByPath(path);
    if (res.status() !== 200 || (!target && !/\.\w+$/.test(path))) {
      dead.push(`${from} → ${href} (${res.status()})`);
      continue;
    }
    if (hash && target && isStaticPage(target.id) && !(await res.text()).includes(`id="${hash}"`)) {
      dead.push(`${from} → ${href} (ancre absente)`);
    }
  }
  expect(dead).toEqual([]);
  expect(visited).toEqual(new Set([...start, '/compte', '/publier']));
});
