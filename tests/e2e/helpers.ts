/** Shared steps of the account end-to-end tests (Auth + Firestore emulators). */
import { expect, type Page } from '@playwright/test';
import { applyVerification } from '../../scripts/emulator.ts';

export const PASSWORD = 'motdepasse-e2e';

export interface Member {
  email: string;
  pseudo: string;
  password: string;
}

export function newMember(): Member {
  const id = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
  return { email: `e2e-${id}@exemple.cm`, pseudo: `Test_${id}`.slice(0, 20), password: PASSWORD };
}

/** Birth date `years` years ago (UTC), as typed in <input type="date">. */
export function birthYearsAgo(years: number, extraDays = 0): string {
  const d = new Date();
  d.setUTCFullYear(d.getUTCFullYear() - years);
  d.setUTCDate(d.getUTCDate() - extraDays);
  return d.toISOString().slice(0, 10);
}

/** Catches any raw Firebase text on screen (PLAN phase 3: no raw Firebase error). */
export async function expectNoRawFirebaseText(page: Page): Promise<void> {
  const text = await page.locator('main').innerText();
  expect(text).not.toMatch(/auth\/|firebase|permission-denied|FirebaseError/i);
}

export async function fillSignUp(page: Page, m: Member, birth = birthYearsAgo(25)): Promise<void> {
  await page.goto('/connexion');
  await page.getByRole('tab', { name: 'Créer un compte' }).click();
  await page.getByLabel('Pseudo').fill(m.pseudo);
  await page.getByLabel('Date de naissance').fill(birth);
  await page.getByLabel('Profil').selectOption('femme');
  await page.getByLabel('Ville').selectOption('douala');
  await page.getByLabel('Numéro WhatsApp').fill('6 99 00 11 22');
  await page.getByLabel('E-mail').fill(m.email);
  await page.getByLabel('Mot de passe').fill(m.password);
  await page.getByRole('checkbox').check();
}

export async function signUp(page: Page, m: Member): Promise<void> {
  await fillSignUp(page, m);
  await page.getByRole('button', { name: 'Créer mon compte' }).click();
  // Sign-up chains several network calls (disposable list, pseudo, account, batch, e-mail).
  await expect(page).toHaveURL(/\/verifier-email\?next=/, { timeout: 15_000 });
  await expect(page.getByText(`Nous avons envoyé un lien de vérification à ${m.email}.`)).toBeVisible();
}

export async function verify(page: Page, m: Member): Promise<void> {
  await page.waitForLoadState('load');
  await applyVerification(m.email);
  // If /verifier-email finished loading after the link was applied, it already left by itself.
  if (page.url().includes('/verifier-email')) {
    await page
      .getByRole('button', { name: 'J’ai vérifié mon e-mail' })
      .click({ timeout: 5000 })
      .catch(() => undefined);
  }
  await expect(page).toHaveURL('/compte');
}

export async function logIn(page: Page, email: string, password: string): Promise<void> {
  await page.goto('/connexion?tab=login');
  await page.getByLabel('E-mail').fill(email);
  await page.getByLabel('Mot de passe').fill(password);
  await page.getByRole('button', { name: 'Se connecter', exact: true }).click();
}

export const PHOTO_FIXTURE = 'tests/e2e/fixtures/photo-gps.jpg';
const CLOUD = 'https://res.cloudinary.com/bcxiwwkh/image/upload';

export interface CloudinaryMock {
  /** Bodies of the upload requests received (multipart, binary). */
  uploads: Buffer[];
  /** Makes the next N uploads fail with HTTP 500. */
  failNext: (n: number) => void;
}

/**
 * Intercepts Cloudinary (PLAN phase 4: no real upload in E2E). Uploads answer like the real
 * service (answer shape of the 2 Oct 2026 upload test); images are served from the fixture.
 */
export async function mockCloudinary(page: Page): Promise<CloudinaryMock> {
  const uploads: Buffer[] = [];
  let failures = 0;
  let counter = 0;
  await page.route('https://api.cloudinary.com/v1_1/bcxiwwkh/image/upload', async (route) => {
    uploads.push(route.request().postDataBuffer() ?? Buffer.alloc(0));
    if (failures > 0) {
      failures -= 1;
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: '{"error":{"message":"boom"}}',
      });
      return;
    }
    counter += 1;
    const listing = (route.request().postDataBuffer() ?? Buffer.alloc(0))
      .toString('latin1')
      .includes('nioxxer_listing');
    const id = `${listing ? 'e2ephoto' : 'e2eavatar'}${counter}${Date.now().toString(36)}`;
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        public_id: id,
        width: listing ? 1600 : 400,
        height: listing ? 1200 : 400,
        format: 'jpg',
        secure_url: `${CLOUD}/v1790960020/${id}.jpg`,
        asset_folder: listing ? 'listings' : 'avatars',
      }),
    });
  });
  await page.route(`${CLOUD}/**`, (route) =>
    route.fulfill({ path: PHOTO_FIXTURE, contentType: 'image/jpeg' }),
  );
  return { uploads, failNext: (n) => (failures = n) };
}

/** The uploaded file part is a re-encoded JPEG without any EXIF block (no GPS position). */
export function expectCleanJpeg(body: Buffer): void {
  const text = body.toString('latin1');
  expect(text).toContain('name="upload_preset"');
  expect(text).toContain('\xff\xd8\xff');
  expect(text).not.toContain('Exif\x00\x00');
  expect(text).not.toContain('EXIF-MARKER-SECRET');
  expect(text).not.toContain('NIOXXER-TEST-CAMERA');
}

/** Signed-up member with a verified e-mail, on /compte. */
export async function verifiedMember(page: Page): Promise<Member> {
  const m = newMember();
  await signUp(page, m);
  await verify(page, m);
  return m;
}
