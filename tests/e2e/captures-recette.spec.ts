/**
 * Screenshots of the owner's recette feedback (3 Oct 2026, 28 points), docs/captures/recette/, on
 * demand only (CAPTURES=1, inside `firebase emulators:exec`), both themes, 375 and 360 px.
 */
import { expect, test, type Page } from '@playwright/test';
import { DEMO_PHOTOS } from '../../scripts/demo-data.ts';
import { uidOf, writeDoc } from '../../scripts/emulator.ts';
import { hoursAgo, seedListing } from './feed-fixtures';
import { adminMember } from './admin-fixtures';
import { verifiedMember } from './helpers';

test.skip(!process.env['CAPTURES'], 'set CAPTURES=1 to regenerate docs/captures');

const THEMES = ['light', 'dark'] as const;
type Theme = (typeof THEMES)[number];

async function useTheme(page: Page, theme: Theme): Promise<void> {
  await page.addInitScript((t) => {
    try {
      localStorage.setItem('nx-theme', t);
    } catch {
      /* ignore */
    }
  }, theme);
}

/** Waits for the fonts and the photos on screen (lazy ones further down never load by themselves). */
async function settle(page: Page): Promise<void> {
  await page.evaluate(async () => {
    await document.fonts.ready;
    const onScreen = [...document.querySelectorAll<HTMLImageElement>('img')].filter(
      (img) => !img.complete && img.getBoundingClientRect().top < innerHeight,
    );
    const loaded = Promise.all(
      onScreen.map((img) => new Promise((r) => img.addEventListener('load', r, { once: true }))),
    );
    await Promise.race([loaded, new Promise((r) => setTimeout(r, 10_000))]);
  });
}

const PEOPLE: [string, number, string, 0 | 1 | 2, boolean][] = [
  ['Nadia237', 26, 'Bonapriso', 2, true],
  ['Laure_Dla', 31, 'Akwa', 2, false],
  ['Junior237', 29, 'Makepe', 1, true],
  ['Mireille', 34, 'Bonamoussadi', 1, false],
  ['Sandra', 24, 'Bali', 0, false],
  ['Arnaud', 38, 'Logpom', 0, true],
  ['Carine', 28, 'Deido', 0, false],
  ['Boris', 33, 'Ndokoti', 0, false],
];

async function seedCity(city: string, tag: string): Promise<void> {
  await Promise.all(
    PEOPLE.map(([pseudo, age, district, rank, verified], i) =>
      seedListing({
        citySlug: city,
        pseudo: `${pseudo}${tag}`.slice(0, 20),
        age,
        district,
        rank,
        verified,
        createdAt: hoursAgo(i + 1),
        photos: [DEMO_PHOTOS[i % DEMO_PHOTOS.length] ?? '', DEMO_PHOTOS[(i + 1) % DEMO_PHOTOS.length] ?? ''],
      }),
    ),
  );
}

for (const theme of THEMES) {
  test(`lot 1 — home: rail on top, 2-column cards, ${theme}`, async ({ page }, info) => {
    test.setTimeout(90_000);
    const size = info.project.name.replace('mobile-', '');
    const city = theme === 'dark' ? 'yaounde' : 'garoua';
    await seedCity(city, `${size}${theme[0]}`);
    await useTheme(page, theme);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.addInitScript((c) => localStorage.setItem('nx-city', c), city);
    await page.goto('/');
    await expect(page.locator('.headline__tally')).toHaveText(/à/);
    await settle(page);
    await page.screenshot({ path: `docs/captures/recette/accueil-${theme}-${size}.png` });
    await page.locator('.headline').scrollIntoViewIfNeeded();
    await page.evaluate(() => scrollBy(0, -8));
    await settle(page);
    await page.screenshot({ path: `docs/captures/recette/accueil-fil-${theme}-${size}.png` });
  });
}

for (const theme of THEMES) {
  test(`lot 2 — search: filters and one result per line, ${theme}`, async ({ page }, info) => {
    test.setTimeout(90_000);
    const size = info.project.name.replace('mobile-', '');
    const city = theme === 'dark' ? 'bafia' : 'kousseri';
    await seedCity(city, `${size}${theme[0]}s`);
    await useTheme(page, theme);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(`/recherche?ville=${city}`);
    await expect(page.locator('.lcard:not(.lcard--skeleton)').first()).toBeVisible();
    await settle(page);
    await page.screenshot({ path: `docs/captures/recette/recherche-${theme}-${size}.png` });
    await page.getByRole('heading', { name: 'Résultats' }).scrollIntoViewIfNeeded();
    await settle(page);
    await page.screenshot({ path: `docs/captures/recette/recherche-resultats-${theme}-${size}.png` });
  });
}

for (const theme of THEMES) {
  test(`lot 3 — account: one profile block, notifications preview, deletion request, ${theme}`, async ({
    page,
  }, info) => {
    test.setTimeout(120_000);
    const size = info.project.name.replace('mobile-', '');
    await useTheme(page, theme);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const m = await verifiedMember(page);
    const uid = await uidOf(m.email, m.password);
    for (const [i, title] of [
      'Mise en avant Premium validée',
      'Avertissement',
      'Badge refusé',
      'Annonce supprimée',
    ].entries()) {
      await writeDoc(`users/${uid}/notifications/n${i}`, {
        type: 'warning',
        title,
        body: 'Texte de démonstration (émulateur).',
        read: i > 1,
        createdAt: new Date(Date.now() - i * 3_600_000),
        auditId: 'demo',
      });
    }
    await page.goto('/compte');
    await expect(page.locator('.card--profile [data-badge-block]')).toBeVisible();
    await settle(page);
    await page.screenshot({ path: `docs/captures/recette/compte-${theme}-${size}.png` });
    await page.screenshot({ path: `docs/captures/recette/compte-long-${theme}-${size}.png`, fullPage: true });

    await page.getByRole('button', { name: 'Supprimer mon compte', exact: true }).click();
    await page.getByLabel('Confirmez avec votre mot de passe').fill(m.password);
    await page.getByRole('button', { name: 'Demander la suppression' }).click();
    await expect(page.locator('h1')).toHaveText('Suppression demandée');
    await page.screenshot({ path: `docs/captures/recette/compte-suppression-${theme}-${size}.png` });
  });
}

for (const theme of THEMES) {
  test(`lot 4 — admin: tab bar, Utilisateurs, Badges, Réglages, ${theme}`, async ({ page }, info) => {
    test.setTimeout(120_000);
    const size = info.project.name.replace('mobile-', '');
    await useTheme(page, theme);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const { uid } = await adminMember(page, 'super');
    for (const [tab, name] of [
      ['recentes', 'recentes'],
      ['utilisateurs', 'utilisateurs'],
      ['badges', 'badges'],
      ['reglages', 'reglages'],
    ] as const) {
      await page.goto(`/admin#${tab}`);
      await page.reload();
      await expect(page.locator('.adm-panel__body')).toBeVisible({ timeout: 20_000 });
      await page.waitForLoadState('networkidle');
      await settle(page);
      await page.screenshot({ path: `docs/captures/recette/admin-${name}-${theme}-${size}.png` });
    }
    // Member card with the per-account cap of listings (owner, 3 Oct 2026).
    await page.goto('/admin#utilisateurs');
    await page.getByLabel('Pseudo ou identifiant du membre').fill(uid);
    await page.getByRole('button', { name: 'Rechercher' }).click();
    await page.getByLabel('Annonces autorisées pour ce compte').scrollIntoViewIfNeeded();
    await settle(page);
    await page.screenshot({ path: `docs/captures/recette/admin-fiche-${theme}-${size}.png` });
  });
}
