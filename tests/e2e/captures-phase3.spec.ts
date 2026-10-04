/**
 * Phase 3 screenshots (docs/captures/phase-3/), regenerated on demand only:
 * firebase emulators:exec --only auth,firestore --project demo-nioxxer
 *   "cross-env CAPTURES=1 playwright test captures-phase3"
 */
import { expect, test, type Page } from '@playwright/test';
import { createAuthUser } from '../../scripts/emulator.ts';
import { fillSignUp, logIn, newMember, verify } from './helpers';

test.skip(!process.env['CAPTURES'], 'set CAPTURES=1 to regenerate docs/captures');

for (const theme of ['dark', 'light'] as const) {
  test(`account screens, ${theme} theme`, async ({ page }, testInfo) => {
    const size = testInfo.project.name.replace('mobile-', '');
    await page.addInitScript((t) => {
      try {
        localStorage.setItem('nx-theme', t);
      } catch {
        /* ignore */
      }
    }, theme);
    const shot = async (name: string, p: Page = page) => {
      await p.evaluate(() => document.fonts.ready);
      await p.screenshot({ path: `docs/captures/phase-3/${name}-${theme}-${size}.png` });
    };

    // Login tab, forgotten password, sign-up form with errors.
    await page.goto('/connexion?tab=login');
    await expect(page.locator('h1')).toHaveText('Connexion');
    await shot('connexion-se-connecter');
    await page.getByRole('button', { name: 'Mot de passe oublié ?' }).click();
    await shot('connexion-mot-de-passe-oublie');
    await page.goto('/connexion');
    await page.getByRole('button', { name: 'Créer mon compte' }).click();
    await expect(page.getByText('Choisissez votre ville.')).toBeVisible();
    await page.getByLabel('Pseudo').scrollIntoViewIfNeeded();
    await page.evaluate(() => window.scrollTo(0, 0));
    await shot('connexion-creer-erreurs');

    // Filled sign-up, verification page, account, deletion panel.
    const m = newMember();
    await fillSignUp(page, m);
    await shot('connexion-creer');
    await page.getByRole('button', { name: 'Créer mon compte' }).scrollIntoViewIfNeeded();
    await shot('connexion-creer-bas');
    await page.getByRole('button', { name: 'Créer mon compte' }).click();
    await expect(page).toHaveURL(/\/verifier-email/);
    await shot('verifier-email');
    await verify(page, m);
    await expect(page.locator('#profile-name')).toHaveText(m.pseudo);
    await shot('compte');
    await page.getByRole('button', { name: 'Supprimer mon compte', exact: true }).scrollIntoViewIfNeeded();
    await shot('compte-bas');
    await page.getByRole('button', { name: 'Supprimer mon compte', exact: true }).click();
    await page.getByRole('button', { name: 'Supprimer définitivement' }).scrollIntoViewIfNeeded();
    await shot('compte-suppression');

    // Profile step (account without profile, as after Google).
    const context = await page.context().browser()!.newContext({
      viewport: page.viewportSize(),
      isMobile: true,
      hasTouch: true,
    });
    const other = await context.newPage();
    await other.addInitScript((t) => localStorage.setItem('nx-theme', t), theme);
    const g = newMember();
    await createAuthUser(g.email, g.password);
    await logIn(other, g.email, g.password);
    await expect(other.locator('h1')).toHaveText('Complétez votre profil');
    await shot('connexion-etape-profil', other);
    await context.close();
  });
}
