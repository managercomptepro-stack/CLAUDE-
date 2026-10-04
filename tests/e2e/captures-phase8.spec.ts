/**
 * Phase 8 screenshots (docs/captures/phase-8/), on demand only (CAPTURES=1, inside
 * `firebase emulators:exec`): legal pages, help, footer, new-terms screen, admin terms field.
 */
import { expect, test, type Page } from '@playwright/test';
import { readDoc, uidOf, writeDoc } from '../../scripts/emulator.ts';
import { adminMember } from './admin-fixtures';
import { verifiedMember } from './helpers';

test.skip(!process.env['CAPTURES'], 'set CAPTURES=1 to regenerate docs/captures');

const THEMES = ['dark', 'light'] as const;

async function useTheme(page: Page, theme: (typeof THEMES)[number]): Promise<void> {
  await page.addInitScript((t) => {
    try {
      localStorage.setItem('nx-theme', t);
    } catch {
      /* ignore */
    }
  }, theme);
}

for (const theme of THEMES) {
  test(`legal pages, help, footer, new terms, ${theme} theme`, async ({ page }, testInfo) => {
    test.setTimeout(150_000);
    const size = testInfo.project.name.replace('mobile-', '');
    const shot = async (name: string) => {
      await page.evaluate(() => document.fonts.ready);
      await page.screenshot({ path: `docs/captures/phase-8/${name}-${theme}-${size}.png` });
    };
    const at = async (path: string, anchor?: string) => {
      await page.goto(anchor ? `${path}#${anchor}` : path);
      await expect(page.locator('h1')).toBeVisible();
    };
    await useTheme(page, theme);

    await at('/cgu');
    await shot('cgu-haut');
    await at('/cgu', 'interdits');
    await shot('cgu-interdits');
    await at('/confidentialite', 'annonces');
    await shot('confidentialite-numero');
    await at('/confidentialite', 'conservation');
    await shot('confidentialite-conservation');
    await at('/mentions-legales', 'editeur');
    await shot('mentions-editeur');
    await at('/regles', 'securite');
    await shot('regles-securite');
    await at('/aide');
    await page.locator('details.faq summary').nth(1).click();
    await shot('aide-faq');
    await at('/aide', 'contact');
    await shot('aide-contact');
    await at('/cgu');
    await page.locator('footer.sitefoot').scrollIntoViewIfNeeded();
    await shot('pied-de-page');

    // A member who accepted an older version (written with the rules bypassed).
    const m = await verifiedMember(page);
    const uid = await uidOf(m.email, m.password);
    await writeDoc(`users/${uid}`, { ...(await readDoc(`users/${uid}`)), termsVersion: '2000-01-1' });
    await page.goto('/compte');
    await expect(page.getByRole('heading', { name: 'Nos conditions ont changé' })).toBeVisible();
    await shot('nouvelles-conditions');
    await page.getByRole('button', { name: 'Accepter et continuer' }).click();
    await expect(page.getByRole('alert')).toBeVisible();
    await shot('nouvelles-conditions-erreur');
  });

  test(`admin settings: terms version field, ${theme} theme`, async ({ page }, testInfo) => {
    test.setTimeout(90_000);
    const size = testInfo.project.name.replace('mobile-', '');
    await useTheme(page, theme);
    await adminMember(page, 'super');
    await page.goto('/admin#reglages');
    const field = page.getByLabel('Version des conditions d’utilisation');
    await expect(field).toHaveValue('2026-10-1');
    await field.scrollIntoViewIfNeeded();
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: `docs/captures/phase-8/admin-version-conditions-${theme}-${size}.png` });
  });
}
