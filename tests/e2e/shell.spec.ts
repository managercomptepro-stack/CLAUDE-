import { expect, test, type Page } from '@playwright/test';
import { PAGES } from '../../src/shell/pages';

const NAV_HREFS = ['/', '/recherche', '/publier', '/compte'];
/** Pages behind AuthGate: without a session they send the visitor to /connexion?next=… */
const GUARDED = new Set(['/verifier-email', '/compte', '/publier', '/booster', '/admin']);

async function navMarkup(page: Page): Promise<string> {
  return page.locator('nav.bottomnav').evaluate((el) => el.outerHTML.replace(/ aria-current="page"/g, ''));
}

test.describe('shell', () => {
  for (const p of PAGES) {
    test(`${p.path} opens with header, content and bottom bar`, async ({ page }) => {
      const errors: string[] = [];
      page.on('pageerror', (e) => errors.push(e.message));
      page.on('console', (m) => {
        if (m.type() === 'error') errors.push(m.text());
      });

      const response = await page.goto(p.path);
      expect(response?.status()).toBe(200);
      if (GUARDED.has(p.path)) {
        await expect(page).toHaveURL(`/connexion?next=${encodeURIComponent(p.path)}`);
      }
      await expect(page.locator('header.topbar')).toBeVisible();
      // Owner's phone test (2 Oct 2026): the bars must be opaque, content never shows through.
      for (const bar of ['header.topbar', 'nav.bottomnav']) {
        const bg = await page.locator(bar).evaluate((el) => getComputedStyle(el).backgroundColor);
        expect(bg, `${bar} background`).toMatch(/^rgb\(\d+, \d+, \d+\)$/);
      }
      await expect(page.locator('h1')).toBeVisible();
      await expect(page.locator('nav.bottomnav a')).toHaveCount(4);
      const hrefs = await page
        .locator('nav.bottomnav a')
        .evaluateAll((as) => as.map((a) => a.getAttribute('href')));
      expect(hrefs).toEqual(NAV_HREFS);
      if (p.nav && !GUARDED.has(p.path)) {
        await expect(page.locator(`nav.bottomnav a[data-tab="${p.nav}"]`)).toHaveAttribute(
          'aria-current',
          'page',
        );
      }
      expect(errors).toEqual([]);
    });
  }

  test('bottom bar markup is identical on every page', async ({ page }) => {
    // One navigation per page of the site: the default 30 s is too short under a full parallel run.
    test.setTimeout(90_000);
    await page.goto('/');
    const reference = await navMarkup(page);
    for (const p of PAGES) {
      await page.goto(p.path);
      if (GUARDED.has(p.path)) await page.waitForURL(/\/connexion\?next=/);
      expect(await navMarkup(page), p.path).toBe(reference);
    }
  });

  test('bottom bar links navigate', async ({ page }) => {
    await page.goto('/');
    await page.locator('nav.bottomnav a[data-tab="search"]').click();
    await expect(page).toHaveURL(/\/recherche$/);
    await expect(page.locator('nav.bottomnav a[data-tab="search"]')).toHaveAttribute('aria-current', 'page');
  });

  test('theme is dark by default, toggles, and is remembered across pages and reloads', async ({ page }) => {
    await page.goto('/');
    const html = page.locator('html');
    await expect(html).toHaveAttribute('data-theme', 'dark');
    const toggle = page.locator('[data-theme-toggle]');
    await expect(toggle).toHaveAttribute('aria-label', 'Passer au thème clair');
    await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', '#100e14');

    // Under load the button may be tapped before the page script wired it: tap until it switches.
    await expect(async () => {
      await toggle.click();
      await expect(html).toHaveAttribute('data-theme', 'light', { timeout: 1000 });
    }).toPass();
    await expect(toggle).toHaveAttribute('aria-label', 'Passer au thème sombre');
    await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', '#faf7f5');

    await page.reload();
    await expect(html).toHaveAttribute('data-theme', 'light');
    await page.goto('/recherche');
    await expect(html).toHaveAttribute('data-theme', 'light');
  });

  test('backgrounds follow the theme tokens', async ({ page }) => {
    await page.goto('/');
    const bg = () => page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    expect(await bg()).toBe('rgb(16, 14, 20)');
    await expect(async () => {
      await page.locator('[data-theme-toggle]').click();
      await expect(page.locator('html')).toHaveAttribute('data-theme', 'light', { timeout: 1000 });
    }).toPass();
    expect(await bg()).toBe('rgb(250, 247, 245)');
  });

  test('« Publier gratuit » pill, « Ville : » label, floating WhatsApp support (not on /admin)', async ({
    page,
  }) => {
    await page.goto('/');
    const pill = page.getByRole('link', { name: 'Publier gratuit' });
    await expect(pill).toHaveAttribute('href', '/publier');
    await expect(page.locator('.city-pick__label')).toHaveText('Ville :');
    const fab = page.getByRole('link', { name: 'Écrire au support NIOXXER sur WhatsApp' });
    await expect(fab).toBeVisible();
    // Above the bottom bar, never over the « + Publier » button.
    const fabBox = (await fab.boundingBox())!;
    const nav = (await page.locator('nav.bottomnav').boundingBox())!;
    expect(fabBox.y + fabBox.height).toBeLessThanOrEqual(nav.y);
    expect(fabBox.width).toBe(48);
    // On tap: the number set in admin › Réglages (emulator settings), the support message.
    await page.context().route('https://wa.me/**', (r) => r.fulfill({ body: 'WhatsApp' }));
    const [popup] = await Promise.all([page.waitForEvent('popup'), fab.click()]);
    await expect.poll(() => popup.url()).toContain('wa.me/');
    expect(decodeURIComponent(popup.url())).toContain('Bonjour, j’ai une question sur NIOXXER.');
    await popup.close();
    await page.goto('/admin');
    await expect(page.locator('[data-support-fab]')).toHaveCount(0);
  });

  test('404 page offers a way back home', async ({ page }) => {
    await page.goto('/404');
    await expect(page.locator('h1')).toHaveText('Page introuvable');
    await expect(page.getByRole('link', { name: 'Retour à l’accueil', exact: true })).toHaveAttribute(
      'href',
      '/',
    );
  });
});

// Phase 1 screenshots, regenerated only on demand (CAPTURES=1) so a test run leaves docs/ alone.
test.describe('captures', () => {
  test.skip(!process.env['CAPTURES'], 'set CAPTURES=1 to regenerate docs/captures');
  const SHOTS = ['/', '/recherche', '/404'];

  test('screens in dark and light themes', async ({ page }, testInfo) => {
    const size = testInfo.project.name.replace('mobile-', '');
    for (const theme of ['dark', 'light'] as const) {
      await page.addInitScript((t) => {
        try {
          localStorage.setItem('nx-theme', t);
        } catch {
          /* ignore */
        }
      }, theme);
      for (const path of SHOTS) {
        await page.goto(path);
        await expect(page.locator('h1')).toBeVisible();
        await page.evaluate(() => document.fonts.ready);
        const name = path === '/' ? 'accueil' : path.slice(1);
        await page.screenshot({ path: `docs/captures/phase-1/${name}-${theme}-${size}.png` });
      }
    }
  });
});
