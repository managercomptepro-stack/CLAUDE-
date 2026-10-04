/**
 * Static page shell (head, header, bottom bar, skeleton). Rendered to HTML at build time by
 * the Vite plugin in `scripts/vite-shell-plugin.ts`, so it is visible before any JavaScript
 * runs (ARCHITECTURE § 10). This is the ONLY implementation of the header and bottom bar.
 */
import { fr } from '../i18n/fr.ts';
import { THEME_COLORS, THEME_STORAGE_KEY } from '../styles/theme-colors.ts';
import { BELL_MEMBER_ATTR, BELL_STORAGE_KEY } from './bell.ts';
import { contentSecurityPolicy } from './csp.ts';
import { DEFAULT_SETTINGS } from '../data/settings.ts';
import { escapeHtml } from './html.ts';
import { supportLink } from './support-link.ts';
import { isStaticPage, renderStaticContent } from './legal.ts';
import { SITE_URL, type NavTab, type PageDef } from './pages.ts';

/** Self-hosted font preloaded on every page (the only weight above the fold). */
export const PRELOADED_FONT = '/fonts/karla-latin-400-normal.woff2';
/**
 * Header logo, transparent (readable on both themes), shown 40 px high: 2× (182×80, ~10 KB) and
 * 3× (273×120) downscales of public/logo.webp (364×160, 27 KB) — measured by Lighthouse, the
 * full-size file was a quarter of the home page weight.
 */
const LOGO = {
  src: '/logo-header-2x.webp',
  srcset: '/logo-header-2x.webp 2x, /logo-header-3x.webp 3x',
  width: 182,
  height: 80,
} as const;

export { escapeHtml };

/**
 * Runs before first paint: applies the remembered theme (dark by default, owner's decision of 3 Oct 2026) so the page never
 * flashes the wrong colours, and shows the notification bell of a signed-in member (./bell.ts)
 * without moving the header. Display preferences only (CLAUDE.md § 6).
 */
export const THEME_BOOT_SCRIPT =
  `(function(){var d=document.documentElement,t='dark';try{if(localStorage.getItem('${THEME_STORAGE_KEY}')==='light')t='light';` +
  `if(localStorage.getItem('${BELL_STORAGE_KEY}')!==null)d.setAttribute('${BELL_MEMBER_ATTR}','')}catch(e){}` +
  `d.setAttribute('data-theme',t);d.setAttribute('data-js','')})();`;

/** <title> and description: one per page, one per city for the /ville/{slug} pages. */
export function pageMeta(page: PageDef): { title: string; description: string } {
  if (page.city) {
    return { title: fr.cityPage.title(page.city.name), description: fr.cityPage.description(page.city.name) };
  }
  return page.id === 'city' ? fr.pages.home : fr.pages[page.id];
}

/** Canonical link for indexable pages whose content does not depend on the query string. */
function canonicalUrl(page: PageDef): string | null {
  if (page.noindex || page.id === 'listing' || page.id === 'member') return null;
  return `${SITE_URL}${page.path === '/' ? '/' : page.path}`;
}

/** Link preview image (SPEC § 13), 1200×630. */
export const OG_IMAGE = { url: `${SITE_URL}/og-image.png`, width: 1200, height: 630 } as const;

/**
 * Open Graph + Twitter tags of every page (link previews on WhatsApp / Facebook). The listing and
 * member pages have no server: their preview is the generic one of the page.
 */
export function openGraph(page: PageDef, meta: { title: string; description: string }): string[] {
  const url = `${SITE_URL}${page.path === '/' ? '/' : page.path}`;
  return [
    '<meta property="og:type" content="website" />',
    `<meta property="og:site_name" content="${escapeHtml(fr.appName)}" />`,
    '<meta property="og:locale" content="fr_FR" />',
    `<meta property="og:title" content="${escapeHtml(meta.title)}" />`,
    `<meta property="og:description" content="${escapeHtml(meta.description)}" />`,
    `<meta property="og:url" content="${escapeHtml(url)}" />`,
    `<meta property="og:image" content="${OG_IMAGE.url}" />`,
    `<meta property="og:image:width" content="${OG_IMAGE.width}" />`,
    `<meta property="og:image:height" content="${OG_IMAGE.height}" />`,
    `<meta property="og:image:alt" content="${escapeHtml(fr.ogImageAlt)}" />`,
    '<meta name="twitter:card" content="summary_large_image" />',
  ];
}

/** Pages that read listings on arrival: their two third-party hosts are opened early (LCP). */
const DATA_PAGES = new Set<PageDef['id']>(['home', 'search', 'listing', 'member', 'city']);
const PRECONNECT = [
  '<link rel="preconnect" href="https://firestore.googleapis.com" crossorigin />',
  '<link rel="preconnect" href="https://res.cloudinary.com" />',
];

/**
 * Smooth page change in Chrome (cross-document view transition, owner's request of 4 Oct 2026):
 * public pages only, never the account pages, which may redirect while a transition runs
 * (« Transition was aborted »). Fade + slide, transform/opacity only, off with « reduce motion ».
 */
export const VIEW_TRANSITION_CSS =
  '@media (prefers-reduced-motion:no-preference){@view-transition{navigation:auto}' +
  '::view-transition-old(root){animation:vt-out .18s ease-in both}' +
  '::view-transition-new(root){animation:vt-in .28s cubic-bezier(.22,.68,.28,1) both}}' +
  '@keyframes vt-out{to{opacity:0;transform:translateX(-24px)}}' +
  '@keyframes vt-in{from{opacity:0;transform:translateX(24px)}}';

/** `csp`: built pages only (the dev server keeps HMR and the emulators without a policy). */
export function renderHead(page: PageDef, { csp = false }: { csp?: boolean } = {}): string {
  const meta = pageMeta(page);
  const canonical = canonicalUrl(page);
  return [
    '<meta charset="utf-8" />',
    csp
      ? `<meta http-equiv="Content-Security-Policy" content="${escapeHtml(contentSecurityPolicy([THEME_BOOT_SCRIPT]))}" />`
      : '',
    '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />',
    `<title>${escapeHtml(meta.title)}</title>`,
    `<meta name="description" content="${escapeHtml(meta.description)}" />`,
    page.noindex ? '<meta name="robots" content="noindex, nofollow" />' : '',
    canonical ? `<link rel="canonical" href="${escapeHtml(canonical)}" />` : '',
    ...openGraph(page, meta),
    `<meta name="theme-color" content="${THEME_COLORS.dark}" />`,
    '<meta name="color-scheme" content="dark light" />',
    `<script>${THEME_BOOT_SCRIPT}</script>`,
    page.noindex || page.id === 'login' ? '' : `<style>${VIEW_TRANSITION_CSS}</style>`,
    `<link rel="preload" href="${PRELOADED_FONT}" as="font" type="font/woff2" crossorigin />`,
    ...(DATA_PAGES.has(page.id) ? PRECONNECT : []),
    '<link rel="icon" href="/favicon.svg" type="image/svg+xml" />',
    '<link rel="stylesheet" href="/src/styles/main.css" />',
  ]
    .filter(Boolean)
    .join('\n    ');
}

const ICONS = {
  home: '<path d="M4 11.5 12 4l8 7.5V20a1 1 0 0 1-1 1h-4.5v-6h-5v6H5a1 1 0 0 1-1-1z"/>',
  search: '<circle cx="11" cy="11" r="6.5"/><path d="m16 16 4.5 4.5"/>',
  publish: '<path d="M12 5v14M5 12h14"/>',
  account: '<circle cx="12" cy="8.5" r="4"/><path d="M4.5 20.5c1.2-3.8 4-5.5 7.5-5.5s6.3 1.7 7.5 5.5"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2.5M12 19v2.5M2.5 12H5M19 12h2.5M5.3 5.3l1.8 1.8M16.9 16.9l1.8 1.8M5.3 18.7l1.8-1.8M16.9 7.1l1.8-1.8"/>',
  moon: '<path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/>',
  bell: '<path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 2H4.5z"/><path d="M10 20.5a2 2 0 0 0 4 0"/>',
} as const;

function icon(name: keyof typeof ICONS, className = 'icon'): string {
  return (
    `<svg class="${className}" viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" ` +
    `focusable="false">${ICONS[name]}</svg>`
  );
}

export function renderHeader(): string {
  return `<header class="topbar">
      <div class="topbar__inner">
        <a class="topbar__brand" href="/" aria-label="${escapeHtml(fr.header.homeLink)}">
          <img src="${LOGO.src}" srcset="${LOGO.srcset}" width="${LOGO.width}" height="${LOGO.height}" alt="" decoding="async" fetchpriority="high" />
        </a>
        <div class="topbar__actions">
          <a class="free-pill" href="/publier">${escapeHtml(fr.header.freePill)}</a>
          <a class="icon-button topbar__bell" href="/compte#notifications" data-bell aria-label="${escapeHtml(fr.bell.label)}">
            ${icon('bell')}<span class="topbar__badge" data-bell-count hidden></span>
          </a>
          <button type="button" class="icon-button" data-theme-toggle aria-label="${escapeHtml(fr.theme.toLight)}">
            ${icon('sun', 'icon icon--when-dark')}${icon('moon', 'icon icon--when-light')}
          </button>
        </div>
      </div>
    </header>`;
}

const TABS: readonly { tab: NavTab; href: string; label: string }[] = [
  { tab: 'home', href: '/', label: fr.nav.home },
  { tab: 'search', href: '/recherche', label: fr.nav.search },
  { tab: 'publish', href: '/publier', label: fr.nav.publish },
  { tab: 'account', href: '/compte', label: fr.nav.account },
];

export function renderBottomNav(active: NavTab | null): string {
  const items = TABS.map(({ tab, href, label }) => {
    const current = tab === active ? ' aria-current="page"' : '';
    const cls = tab === 'publish' ? 'bottomnav__item bottomnav__item--publish' : 'bottomnav__item';
    const ico = tab === 'publish' ? `<span class="bottomnav__plus">${icon(tab)}</span>` : icon(tab);
    return `<li><a class="${cls}" href="${href}" data-tab="${tab}"${current}>${ico}<span class="bottomnav__label">${escapeHtml(label)}</span></a></li>`;
  }).join('');
  return `<nav class="bottomnav" aria-label="${escapeHtml(fr.nav.label)}"><ul class="bottomnav__list">${items}</ul></nav>`;
}

/** Pure-CSS placeholder shown in <main> until the page script replaces it. */
export function renderSkeleton(): string {
  const card = '<div class="skeleton skeleton--card"></div>';
  return `<div class="page" aria-busy="true">
        <div class="skeleton skeleton--title"></div>
        ${card}${card}${card}
        <span class="visually-hidden">${escapeHtml(fr.loading)}</span>
      </div>`;
}

const FOOTER_LINKS: readonly { href: string; label: string }[] = [
  { href: '/aide', label: fr.footer.help },
  { href: '/regles', label: fr.footer.rules },
  { href: '/cgu', label: fr.footer.terms },
  { href: '/confidentialite', label: fr.footer.privacy },
  { href: '/mentions-legales', label: fr.footer.legal },
];

/** Links to help and the legal pages, below <main> (which is at least one screen tall: no CLS). */
export function renderFooter(): string {
  const links = FOOTER_LINKS.map((l) => `<li><a href="${l.href}">${escapeHtml(l.label)}</a></li>`).join('');
  return `<footer class="sitefoot"><ul class="sitefoot__links">${links}</ul><p class="sitefoot__note">${escapeHtml(fr.footer.note)}</p></footer>`;
}

/**
 * Floating WhatsApp support button (owner's request of 3 Oct 2026), every page but /admin. The
 * href carries the default number (works without JavaScript); on tap, the number set in admin ›
 * Réglages is read first (src/shell/client.ts), so no page pays a Firestore read for it.
 */
export function renderSupportFab(): string {
  return `<a class="support-fab" data-support-fab href="${escapeHtml(supportLink(DEFAULT_SETTINGS.supportWhatsApp))}" target="_blank" rel="noopener noreferrer" aria-label="${escapeHtml(fr.supportFab)}">
      <img src="/brands/whatsapp-glyph-black.svg" width="26" height="26" alt="" />
    </a>`;
}

export function renderBody(page: PageDef): string {
  const content = isStaticPage(page.id) ? renderStaticContent(page.id) : renderSkeleton();
  return `<a class="skip-link" href="#app">${escapeHtml(fr.skipToContent)}</a>
    ${renderHeader()}
    <main id="app" tabindex="-1">
      ${content}
    </main>
    ${renderFooter()}
    ${page.id === 'admin' ? '' : renderSupportFab()}
    ${renderBottomNav(page.nav)}`;
}
