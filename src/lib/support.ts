/** Support WhatsApp number of /aide, from `settings/public` (Firestore lite, one read). */
import { doc, getDoc } from 'firebase/firestore/lite';
import { SUPPORT_WHATSAPP_PATTERN } from '../data/limits';
import { DEFAULT_SETTINGS, SETTINGS_PATH } from '../data/settings';
import { db } from '../firebase/lite';
import { supportLink } from '../shell/support-link';
import { formatWhatsApp } from './format';

async function supportNumber(): Promise<string | null> {
  const snap = await getDoc(doc(db(), SETTINGS_PATH));
  const number = snap.data()?.['supportWhatsApp'];
  return typeof number === 'string' && new RegExp(SUPPORT_WHATSAPP_PATTERN).test(number) ? number : null;
}

/** wa.me link of the current support number, or of the default one. */
export async function currentSupportLink(): Promise<string> {
  return supportLink((await supportNumber()) ?? DEFAULT_SETTINGS.supportWhatsApp);
}

export async function applySupportNumber(): Promise<void> {
  const number = await supportNumber();
  if (!number) return;
  for (const a of document.querySelectorAll<HTMLAnchorElement>('[data-support-link]'))
    a.href = supportLink(number);
  for (const el of document.querySelectorAll('[data-support-number]'))
    el.textContent = formatWhatsApp(number);
}
