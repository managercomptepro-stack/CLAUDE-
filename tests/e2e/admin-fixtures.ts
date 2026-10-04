/** Admin accounts for the phase 7 end-to-end tests (Auth + Firestore emulators). */
import type { Browser, Page, TestInfo } from '@playwright/test';
import { uidOf, writeDoc } from '../../scripts/emulator.ts';
import { mockCloudinary, verifiedMember } from './helpers';

/** Verified member given an admin role with the rules bypassed (as the owner does in the console). */
export async function adminMember(page: Page, role: 'super' | 'moderator') {
  await mockCloudinary(page);
  const m = await verifiedMember(page);
  const uid = await uidOf(m.email, m.password);
  await writeDoc(`admins/${uid}`, { role, addedBy: 'console', addedAt: new Date() });
  return { m, uid };
}

/** A second browser on the same viewport (another person). */
export async function otherPage(browser: Browser, info: TestInfo): Promise<Page> {
  const { viewport, isMobile, hasTouch } = info.project.use;
  const context = await browser.newContext({
    viewport,
    isMobile,
    hasTouch,
    baseURL: info.project.use.baseURL,
  });
  return context.newPage();
}
