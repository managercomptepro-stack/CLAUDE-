/**
 * Notification bell of the static header (SPEC § 9). Public pages never load Firebase Auth
 * (performance, CLAUDE.md § 5): the account pages count the unread notifications and keep the
 * number here (display only — the rules decide who reads what). The theme boot script reads it
 * before the first paint, so the bell appears without moving the header.
 */
import { fr } from '../i18n/fr.ts';

export const BELL_STORAGE_KEY = 'nx-unread';
/** Attribute set on <html> while a member is signed in on this browser. */
export const BELL_MEMBER_ATTR = 'data-member';

export function bellText(unread: number): string {
  if (unread <= 0) return '';
  return unread > 99 ? '99+' : String(unread);
}

export function cachedUnread(): number | null {
  try {
    const raw = localStorage.getItem(BELL_STORAGE_KEY);
    if (raw === null) return null;
    const n = Number(raw);
    return Number.isInteger(n) && n >= 0 ? n : 0;
  } catch {
    return null;
  }
}

/** Shows the bell (null = nobody signed in) and its badge. */
export function applyBell(unread: number | null): void {
  const root = document.documentElement;
  if (unread === null) root.removeAttribute(BELL_MEMBER_ATTR);
  else root.setAttribute(BELL_MEMBER_ATTR, '');
  const text = bellText(unread ?? 0);
  for (const bell of document.querySelectorAll<HTMLElement>('[data-bell]')) {
    bell.setAttribute('aria-label', text ? fr.bell.labelUnread(unread ?? 0) : fr.bell.label);
    const badge = bell.querySelector<HTMLElement>('[data-bell-count]');
    if (badge) {
      badge.textContent = text;
      badge.hidden = text === '';
    }
  }
}

export function saveUnread(unread: number): void {
  try {
    localStorage.setItem(BELL_STORAGE_KEY, String(Math.max(0, unread)));
  } catch {
    // Storage blocked: the badge lasts for this page only.
  }
  applyBell(Math.max(0, unread));
}

/** Signed out (or session gone): hide the bell. */
export function clearUnread(): void {
  try {
    localStorage.removeItem(BELL_STORAGE_KEY);
  } catch {
    // Nothing stored.
  }
  applyBell(null);
}
