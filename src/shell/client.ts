/** Client side of the static shell: theme toggle (display preference only, CLAUDE.md § 6), bell badge. */
import { fr } from '../i18n/fr';
import { THEME_COLORS, THEME_STORAGE_KEY, type Theme } from '../styles/theme-colors';
import { applyBell, cachedUnread } from './bell';

export function currentTheme(): Theme {
  return document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
}

function applyTheme(theme: Theme): void {
  document.documentElement.setAttribute('data-theme', theme);
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_COLORS[theme]);
  for (const btn of document.querySelectorAll<HTMLButtonElement>('[data-theme-toggle]')) {
    btn.setAttribute('aria-label', theme === 'dark' ? fr.theme.toLight : fr.theme.toDark);
  }
}

function saveTheme(theme: Theme): void {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Storage blocked (private mode): the choice simply lasts for this page.
  }
}

/** Floating support button: the current number (admin › Réglages) is read on tap only. */
function wireSupportFab(): void {
  const fab = document.querySelector<HTMLAnchorElement>('[data-support-fab]');
  fab?.addEventListener('click', (e) => {
    e.preventDefault();
    const fallback = fab.href;
    void import('../lib/support')
      .then((m) => m.currentSupportLink())
      .catch(() => fallback)
      .then((href) => window.open(href, '_blank', 'noopener,noreferrer') ?? location.assign(href));
  });
}

export function initShell(): void {
  applyTheme(currentTheme());
  applyBell(cachedUnread());
  wireSupportFab();
  for (const btn of document.querySelectorAll<HTMLButtonElement>('[data-theme-toggle]')) {
    btn.addEventListener('click', () => {
      const next: Theme = currentTheme() === 'dark' ? 'light' : 'dark';
      applyTheme(next);
      saveTheme(next);
    });
  }
}
