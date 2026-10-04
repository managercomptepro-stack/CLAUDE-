/**
 * Phase 7 screenshots (docs/captures/phase-7/), on demand only (CAPTURES=1, inside
 * `firebase emulators:exec`): every admin tab, the moderator view and the badge block of /compte.
 */
import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { demoListing, listingId } from '../../scripts/demo-data.ts';
import { writeDoc } from '../../scripts/emulator.ts';
import { adminMember } from './admin-fixtures';
import { seedListing } from './feed-fixtures';
import { PHOTO_FIXTURE } from './helpers';

test.skip(!process.env['CAPTURES'], 'set CAPTURES=1 to regenerate docs/captures');

const THEMES = ['dark', 'light'] as const;
const PHOTO_DATA_URL = `data:image/jpeg;base64,${readFileSync(PHOTO_FIXTURE).toString('base64')}`;

async function useTheme(page: Page, theme: (typeof THEMES)[number]): Promise<void> {
  await page.addInitScript((t) => {
    try {
      localStorage.setItem('nx-theme', t);
    } catch {
      /* ignore */
    }
  }, theme);
}

/** Reported, hidden, paid and badge-requesting members, written with the rules bypassed. */
async function seed(tag: string) {
  const hidden = await seedListing({
    title: 'Soirée à Bonapriso',
    hidden: true,
    reportsCount: 10,
    description: 'Je cherche une rencontre détendue ce week-end, apéro puis balade.',
  });
  const minor = await seedListing({ title: 'Rencontre à Bastos', reportsCount: 2 });
  for (const [i, reason] of (['minor', 'fake_profile'] as const).entries()) {
    await writeDoc(`reports/${minor.id}_v${tag}${i}`, {
      listingId: minor.id,
      uid: `v${tag}${i}`,
      reason,
      note: i === 0 ? 'Les photos font très jeune.' : '',
      createdAt: new Date(),
    });
  }
  await writeDoc(`reports/${hidden.id}_v${tag}h`, {
    listingId: hidden.id,
    uid: `v${tag}h`,
    reason: 'scam',
    note: 'Demande un dépôt avant le rendez-vous.',
    createdAt: new Date(),
  });

  const payer = `payer${tag}`;
  const paid = listingId(payer, 1);
  await writeDoc(
    `listings/${paid}`,
    demoListing({ uid: payer, pseudo: 'Nadia237', title: 'Balade à Kribi' }),
  );
  await writeDoc(`boostRequests/req${tag}`, {
    listingId: paid,
    ownerUid: payer,
    tier: 'premium',
    operator: 'mtn',
    amount: 2000,
    txRef: 'MP261002.4821',
    screenshot: PHOTO_DATA_URL,
    status: 'pending',
    rejectReason: null,
    createdAt: new Date(),
    handledBy: null,
    handledAt: null,
  });
  await writeDoc(`pendingBoosts/${paid}`, { requestId: `req${tag}`, createdAt: new Date() });

  const asker = `asker${tag}`;
  await writeDoc(`publicProfiles/${asker}`, {
    pseudo: 'Laure_Dla',
    photoUrl: null,
    memberSince: new Date(),
    verified: false,
  });
  await writeDoc(`verificationRequests/${asker}`, {
    idImage: PHOTO_DATA_URL,
    status: 'pending',
    createdAt: new Date(),
    handledBy: null,
    handledAt: null,
  });
  await seedListing({ title: 'Premium offert', rank: 2, boostDays: null });
}

for (const theme of THEMES) {
  test(`admin tabs, moderator view and badge block, ${theme} theme`, async ({ page }, testInfo) => {
    test.setTimeout(240_000);
    const size = testInfo.project.name.replace('mobile-', '');
    const shot = async (name: string, fullPage = false) => {
      await page.evaluate(() => document.fonts.ready);
      await page.screenshot({ path: `docs/captures/phase-7/${name}-${theme}-${size}.png`, fullPage });
    };
    await useTheme(page, theme);
    await seed(`${theme}${size}`);

    // Badge block of /compte, before the role is given.
    const { m, uid } = await adminMember(page, 'moderator');
    await page.goto('/compte');
    const block = page.locator('[data-badge-block]');
    await block.scrollIntoViewIfNeeded();
    await shot('compte-badge');

    // Moderator view.
    await page.goto('/admin#signalements');
    await expect(page.locator('.adm-item').first()).toBeVisible();
    await shot('moderateur-signalements');
    await page.goto('/admin#badges');
    await expect(page.locator('[data-badge]').first()).toBeVisible();
    await shot('moderateur-badges');

    // Super-admin: every tab.
    await writeDoc(`admins/${uid}`, { role: 'super', addedBy: 'console', addedAt: new Date() });
    const tabs: [string, () => Promise<void>][] = [
      ['signalements', async () => void (await expect(page.locator('.adm-item').first()).toBeVisible())],
      ['recentes', async () => void (await expect(page.locator('.adm-item').first()).toBeVisible())],
      ['paiements', async () => void (await expect(page.locator('[data-payment]').first()).toBeVisible())],
      ['badges', async () => void (await expect(page.locator('[data-badge]').first()).toBeVisible())],
      [
        'utilisateurs',
        async () => {
          await page.getByLabel('Pseudo ou identifiant du membre').fill(m.pseudo);
          await page.getByRole('button', { name: 'Rechercher' }).click();
          await expect(page.locator('[data-member-card]')).toBeVisible();
        },
      ],
      ['mises-en-avant', async () => void (await expect(page.locator('.adm-item').first()).toBeVisible())],
      [
        'reglages',
        async () => void (await expect(page.getByLabel('Premium', { exact: true })).toBeVisible()),
      ],
      ['equipe', async () => void (await expect(page.locator('[data-team]').first()).toBeVisible())],
      ['sante', async () => void (await expect(page.locator('[data-health]')).toBeVisible())],
      [
        'nettoyage',
        async () => {
          await page.getByRole('button', { name: 'Analyser' }).click();
          await expect(page.locator('[data-cleanup-plan]')).toBeVisible();
        },
      ],
    ];
    for (const [tab, ready] of tabs) {
      await page.goto(`/admin#${tab}`);
      await page.reload();
      await ready();
      await shot(`admin-${tab}`);
    }

    // An action form open (removal with a reason).
    await page.goto('/admin#signalements');
    const row = page.locator('.adm-item').first();
    await row.getByRole('button', { name: 'Supprimer' }).click();
    await row.locator('form').scrollIntoViewIfNeeded();
    await shot('admin-supprimer-motif');
    await row.getByRole('button', { name: 'Photos volées ou d’une autre personne' }).click();
    await row.locator('form').getByRole('button', { name: 'Supprimer' }).click();
    await expect(page.locator('.toast', { hasText: 'Annonce supprimée' })).toBeVisible();

    // Journal, now holding that removal.
    await page.goto('/admin#journal');
    await page.reload();
    await expect(page.locator('[data-audit]').first()).toBeVisible();
    await shot('admin-journal');

    // Payment card scrolled to its buttons.
    await page.goto('/admin#paiements');
    const card = page.locator('[data-payment]').first();
    await card.getByRole('button', { name: 'Valider' }).scrollIntoViewIfNeeded();
    await shot('admin-paiement-boutons');
  });
}
