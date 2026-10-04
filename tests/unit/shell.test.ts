import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { fr } from '../../src/i18n/fr';
import { isStaticPage } from '../../src/shell/legal';
import { PAGES } from '../../src/shell/pages';
import { cityPageHtml } from '../../scripts/city-pages';
import { contentSecurityPolicy } from '../../src/shell/csp';
import {
  pageMeta,
  renderBody,
  renderBottomNav,
  renderHead,
  renderHeader,
  renderSupportFab,
  THEME_BOOT_SCRIPT,
} from '../../src/shell/render';
import { THEME_COLORS } from '../../src/styles/theme-colors';

describe('pages', () => {
  it('has one HTML entry per page, each with the shell markers and its page script', () => {
    for (const p of PAGES) {
      expect(existsSync(p.file), p.file).toBe(true);
      const html = readFileSync(p.file, 'utf8');
      expect(html).toContain('<!--nx:head-->');
      expect(html).toContain('<!--nx:body-->');
      // Static pages (content in the HTML): only the shell script, or /aide's support number.
      const script = isStaticPage(p.id) ? (p.id === 'help' ? 'help.ts' : 'static.ts') : `${p.id}.tsx`;
      expect(html).toContain(`/src/pages/${script}`);
      expect(existsSync(`src/pages/${script}`), p.id).toBe(true);
    }
  });

  it('opens the Firestore and Cloudinary connections early on the data pages only', () => {
    const head = (id: string) => renderHead(PAGES.find((p) => p.id === id)!);
    for (const id of ['home', 'search', 'listing', 'member', 'city']) {
      expect(head(id)).toContain('rel="preconnect" href="https://res.cloudinary.com"');
      expect(head(id)).toContain('rel="preconnect" href="https://firestore.googleapis.com" crossorigin');
    }
    expect(head('terms')).not.toContain('preconnect');
  });

  it('marks private pages noindex (SPEC § 13)', () => {
    for (const id of ['admin', 'account', 'publish', 'boost'] as const) {
      expect(renderHead(PAGES.find((p) => p.id === id)!)).toContain('noindex');
    }
    expect(renderHead(PAGES.find((p) => p.id === 'home')!)).not.toContain('noindex');
  });

  it('gives every page its own title and description', () => {
    const titles = PAGES.map((p) => pageMeta(p).title);
    const descriptions = PAGES.map((p) => pageMeta(p).description);
    expect(new Set(titles).size).toBe(PAGES.length);
    expect(new Set(descriptions).size).toBe(PAGES.length);
  });

  it('has 28 city pages, up to date, with their own title, description and canonical (SPEC § 13)', () => {
    const cities = PAGES.filter((p) => p.city);
    expect(cities).toHaveLength(28);
    for (const p of cities) {
      expect(readFileSync(p.file, 'utf8'), `${p.file}: run npm run pages:sync`).toBe(cityPageHtml());
    }
    const yaounde = renderHead(PAGES.find((p) => p.path === '/ville/yaounde')!);
    expect(yaounde).toContain('<title>Rencontres à Yaoundé — NIOXXER</title>');
    expect(yaounde).toContain('à Yaoundé. Gratuites');
    expect(yaounde).toContain('<link rel="canonical" href="https://nioxxer.com/ville/yaounde" />');
    expect(renderHead(PAGES.find((p) => p.id === 'home')!)).toContain('href="https://nioxxer.com/"');
    expect(renderHead(PAGES.find((p) => p.id === 'listing')!)).not.toContain('canonical');
    expect(renderHead(PAGES.find((p) => p.id === 'account')!)).not.toContain('canonical');
    expect(fr.pages.home.title).toBe(pageMeta(PAGES[0]!).title);
  });
});

describe('bottom bar', () => {
  it('is identical on every page apart from the highlighted tab', () => {
    const strip = (html: string) => html.replace(/ aria-current="page"/g, '');
    const reference = strip(renderBottomNav(null));
    for (const p of PAGES) expect(strip(renderBottomNav(p.nav))).toBe(reference);
  });

  it('has the 4 items in order: Accueil · Recherche · Publier · Compte', () => {
    const labels = [...renderBottomNav(null).matchAll(/bottomnav__label">([^<]+)</g)].map((m) => m[1]);
    expect(labels).toEqual(['Accueil', 'Recherche', 'Publier', 'Compte']);
  });

  it('highlights exactly one tab when the page has one', () => {
    expect(renderBottomNav('search').match(/aria-current/g)).toHaveLength(1);
    expect(renderBottomNav(null)).not.toContain('aria-current');
  });

  it('is part of every page body', () => {
    for (const p of PAGES) expect(renderBody(p)).toContain('class="bottomnav"');
  });
});

describe('theme colours', () => {
  it('match --bg of each theme in tokens.css', () => {
    const css = readFileSync('src/styles/tokens.css', 'utf8');
    const dark = css.match(/\[data-theme='dark'\][^}]*--bg:\s*(#[0-9A-Fa-f]{6})/)?.[1];
    const light = css.match(/\[data-theme='light'\][^}]*--bg:\s*(#[0-9A-Fa-f]{6})/)?.[1];
    expect(dark).toBe(THEME_COLORS.dark);
    expect(light).toBe(THEME_COLORS.light);
    expect(renderHead(PAGES[0]!)).toContain(`content="${THEME_COLORS.dark}"`);
  });
});

describe('security headers and Content-Security-Policy (audit of 3 Oct 2026)', () => {
  it('built pages carry the policy before any script, with the hash of the inline theme script', () => {
    const head = renderHead(PAGES[0]!, { csp: true });
    const meta = head.indexOf('http-equiv="Content-Security-Policy"');
    expect(meta).toBeGreaterThan(-1);
    expect(meta).toBeLessThan(head.indexOf('<script>'));
    const hash = createHash('sha256').update(THEME_BOOT_SCRIPT, 'utf8').digest('base64');
    // In the attribute the quotes are escaped (&#39;): the browser reads them back as quotes.
    expect(head).toContain(`&#39;sha256-${hash}&#39;`);
    const policy = contentSecurityPolicy([THEME_BOOT_SCRIPT]);
    for (const part of [
      "default-src 'self'",
      "object-src 'none'",
      "base-uri 'self'",
      'https://apis.google.com',
      'https://res.cloudinary.com/bcxiwwkh/',
      'https://*.firebaseapp.com',
      'https://www.google.com/recaptcha/',
      'https://www.gstatic.com/recaptcha/',
    ]) {
      expect(policy).toContain(part);
    }
    expect(policy).not.toMatch(/script-src[^;]*'unsafe-inline'/);
  });

  it('the dev server pages have no policy (HMR, emulators)', () => {
    expect(renderHead(PAGES[0]!)).not.toContain('Content-Security-Policy');
  });

  it('firebase.json sends HSTS, anti-framing and the other headers on every path', () => {
    const conf = JSON.parse(readFileSync('firebase.json', 'utf8')) as {
      hosting: { headers: { source: string; headers: { key: string; value: string }[] }[] };
    };
    const all = conf.hosting.headers.find((h) => h.source === '**')?.headers ?? [];
    const get = (k: string) => all.find((h) => h.key === k)?.value;
    expect(get('Strict-Transport-Security')).toMatch(/max-age=31536000/);
    expect(get('X-Frame-Options')).toBe('SAMEORIGIN');
    expect(get('Content-Security-Policy')).toBe("frame-ancestors 'self'");
    expect(get('Referrer-Policy')).toBe('strict-origin-when-cross-origin');
    expect(get('X-Content-Type-Options')).toBe('nosniff');
    expect(get('Permissions-Policy')).toContain('camera=()');
  });
});

describe('header pill and floating support button (owner, 3 Oct 2026)', () => {
  it('« Publier gratuit » opens /publier, before the theme button', () => {
    const header = renderHeader();
    expect(header).toContain('<a class="free-pill" href="/publier">Publier gratuit</a>');
    expect(header.indexOf('free-pill')).toBeLessThan(header.indexOf('data-theme-toggle'));
  });

  it('the WhatsApp button is on every page but /admin, with the support message', () => {
    for (const p of PAGES) {
      const body = renderBody(p);
      if (p.id === 'admin') expect(body).not.toContain('data-support-fab');
      else {
        expect(body).toContain('data-support-fab');
        expect(body).toContain('/brands/whatsapp-glyph-black.svg');
      }
    }
    expect(renderSupportFab()).toContain(encodeURIComponent('Bonjour, j’ai une question sur NIOXXER.'));
    expect(renderSupportFab()).toContain('rel="noopener noreferrer"');
  });
});

describe('page transitions (owner, 4 Oct 2026)', () => {
  it('only between public pages (account pages may redirect mid-transition)', () => {
    for (const p of PAGES) {
      const has = renderHead(p).includes('@view-transition');
      expect(has, p.id).toBe(!p.noindex && p.id !== 'login');
    }
    expect(renderHead(PAGES[0]!)).toContain('prefers-reduced-motion:no-preference');
  });
});
