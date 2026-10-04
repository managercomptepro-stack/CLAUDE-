import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { internalRefs, resolvePath } from '../../scripts/check-links';
import { missingPublisherFields, PUBLISHER } from '../../src/data/legal';
import { CITIES } from '../../src/data/cities';
import { DEFAULT_SETTINGS } from '../../src/data/settings';
import { fr } from '../../src/i18n/fr';
import { legalFr } from '../../src/i18n/legal-fr';
import { inline, isStaticPage, renderStaticContent } from '../../src/shell/legal';
import { pageByPath, PAGES, SITE_URL, type PageId } from '../../src/shell/pages';
import { OG_IMAGE, renderBody, renderHead } from '../../src/shell/render';
import { robotsTxt, sitemapXml } from '../../src/shell/seo';
import { supportLink } from '../../src/shell/support-link';

const STATIC: PageId[] = ['terms', 'privacy', 'legal', 'rules', 'help'];
const page = (id: PageId) => PAGES.find((p) => p.id === id)!;
const html = (id: PageId) => renderStaticContent(id) ?? '';
const text = (h: string) =>
  h
    .replace(/<[^>]+>/g, ' ')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ');

describe('static pages (readable without JavaScript)', () => {
  it('are the 4 legal pages and /aide, with their content in the HTML instead of the skeleton', () => {
    expect(
      PAGES.filter((p) => isStaticPage(p.id))
        .map((p) => p.id)
        .sort(),
    ).toEqual([...STATIC].sort());
    for (const id of STATIC) {
      const body = renderBody(page(id));
      expect(body, id).toContain('<article class="page legal">');
      expect(body, id).not.toContain('aria-busy');
      expect(body, id).not.toContain('<script');
      expect(body.match(/<h1/g)?.length, id).toBe(1);
    }
    expect(renderBody(page('home'))).toContain('aria-busy="true"');
  });

  it('carry the « relire par un juriste » note as an HTML comment, not on screen', () => {
    for (const id of ['terms', 'privacy', 'legal', 'rules'] as const) {
      expect(html(id)).toContain(`<!-- ${legalFr.juristNote} -->`);
      expect(text(html(id).replace(/<!--[\s\S]*?-->/g, ''))).not.toContain('juriste');
    }
  });

  it('have a table of contents whose every entry leads to a section of the page', () => {
    for (const id of ['terms', 'privacy', 'legal', 'rules'] as const) {
      const h = html(id);
      const toc = [...h.matchAll(/<li><a href="#([^"]+)">/g)].map((m) => m[1]);
      expect(toc.length, id).toBeGreaterThan(3);
      for (const anchor of toc) expect(h, `${id}#${anchor}`).toContain(`id="${anchor}"`);
    }
  });

  it('only link to existing pages and, on static pages, to existing anchors', () => {
    for (const id of STATIC) {
      for (const ref of internalRefs(html(id))) {
        const [path = '', hash] = ref.split('#');
        if (!path || /\.\w+$/.test(path)) continue; // same-page anchors, files: check-links
        const target = pageByPath(path);
        expect(target, `${id} → ${ref}`).toBeDefined();
        if (hash && target && isStaticPage(target.id))
          expect(html(target.id), `${id} → ${ref}`).toContain(`id="${hash}"`);
      }
    }
  });

  it('escape the text and allow internal links only in the inline markup', () => {
    expect(inline('<b>a</b> & **gras**')).toBe('&lt;b&gt;a&lt;/b&gt; &amp; <strong>gras</strong>');
    expect(inline('[aide](/aide#contact)')).toBe('<a href="/aide#contact">aide</a>');
    expect(inline('[x](https://exemple.cm)')).toBe('[x](https://exemple.cm)');
    expect(inline('[x](javascript:alert(1))')).not.toContain('<a');
    // Protocol-relative « //host » would leave the site: not a link (security audit, 3 Oct 2026).
    expect(inline('[x](//exemple.cm/piege)')).not.toContain('<a');
  });

  it('cover what PLAN § Phase 8 requires', () => {
    const terms = text(html('terms'));
    expect(terms).toContain('hébergeur neutre');
    expect(terms).toContain('sous sa seule responsabilité');
    expect(terms).toContain('article 294');
    expect(terms).toContain('personne mineure');
    expect(terms).toContain('18 ans et plus');
    expect(terms).toContain('Premium');
    expect(terms).toContain('2010/021');
    const privacy = text(html('privacy'));
    expect(html('privacy')).toContain('href="/aide#contact"');
    for (const word of ['Cloudinary', 'Firebase', 'GitHub', '6 mois', 'Vos droits', '2024/017']) {
      expect(privacy, word).toContain(word);
    }
    // Decision 13 and the honest limit of the WhatsApp number (ARCHITECTURE § 4).
    expect(privacy).toContain('votre dossier privé est conservé après la suppression du compte');
    expect(privacy).toContain('une annonce à la fois');
    expect(privacy).toContain('30 jours après la décision');
  });

  it('show « À compléter » for every publisher fact the owner has not given yet', () => {
    const missing = missingPublisherFields();
    expect(text(html('legal')).split(legalFr.toBeCompleted).length - 1).toBe(missing.length);
    expect(missingPublisherFields({ ...PUBLISHER, name: 'X', legalForm: ' ' })).not.toContain('name');
    expect(missingPublisherFields({ ...PUBLISHER, name: 'X', legalForm: ' ' })).toContain('legalForm');
  });

  it('/aide: FAQ in <details>, WhatsApp button with the default support number', () => {
    const h = html('help');
    expect(h.match(/<details class="faq"/g)?.length).toBe(legalFr.help.questions.length);
    const link = supportLink(DEFAULT_SETTINGS.supportWhatsApp);
    expect(link).toBe(`https://wa.me/237678802447?text=${encodeURIComponent(fr.supportMessage)}`);
    expect(h).toContain(`data-support-link href="${link.replace(/&/g, '&amp;')}"`);
    expect(h).toContain('id="contact"');
    expect(h).toContain('/brands/whatsapp-glyph-black.svg');
  });
});

describe('footer', () => {
  it('is on every page and links to help and the 4 legal pages', () => {
    for (const p of PAGES) {
      const body = renderBody(p);
      for (const href of ['/aide', '/regles', '/cgu', '/confidentialite', '/mentions-legales']) {
        expect(body, `${p.file} ${href}`).toContain(`<li><a href="${href}">`);
      }
    }
  });
});

describe('Open Graph (SPEC § 13)', () => {
  it('is on every page, with an absolute image and the page title', () => {
    for (const p of PAGES) {
      const head = renderHead(p);
      expect(head, p.file).toContain(`<meta property="og:image" content="${SITE_URL}/og-image.png" />`);
      expect(head, p.file).toContain('<meta property="og:image:width" content="1200" />');
      expect(head, p.file).toContain('<meta name="twitter:card" content="summary_large_image" />');
      expect(head, p.file).toMatch(/<meta property="og:title" content="[^"]+" \/>/);
      expect(head, p.file).toMatch(/<meta property="og:description" content="[^"]+" \/>/);
    }
    expect(renderHead(page('home'))).toContain(
      '<meta property="og:title" content="NIOXXER — Rencontres libres au Cameroun" />',
    );
    expect(OG_IMAGE.url.startsWith('https://')).toBe(true);
  });
});

describe('sitemap.xml and robots.txt', () => {
  it('list the home page, search, help, the 4 legal pages and the 28 cities — no private page', () => {
    const xml = sitemapXml();
    const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
    expect(locs).toContain(`${SITE_URL}/`);
    for (const path of ['/recherche', '/aide', '/cgu', '/confidentialite', '/mentions-legales', '/regles']) {
      expect(locs).toContain(`${SITE_URL}${path}`);
    }
    for (const c of CITIES) expect(locs).toContain(`${SITE_URL}/ville/${c.slug}`);
    expect(locs).toHaveLength(7 + CITIES.length);
    for (const path of ['/compte', '/publier', '/booster', '/admin', '/annonce', '/membre', '/404']) {
      expect(locs).not.toContain(`${SITE_URL}${path}`);
    }
  });

  it('robots.txt allows crawling and points to the sitemap', () => {
    expect(robotsTxt()).toBe(`User-agent: *\nAllow: /\n\nSitemap: ${SITE_URL}/sitemap.xml\n`);
  });
});

describe('link validator (scripts/check-links.ts)', () => {
  it('finds internal references and resolves clean URLs like Firebase Hosting', () => {
    const dist = mkdtempSync(join(tmpdir(), 'nx-links-'));
    mkdirSync(join(dist, 'ville'));
    writeFileSync(join(dist, 'index.html'), '');
    writeFileSync(join(dist, 'cgu.html'), '');
    writeFileSync(join(dist, 'ville', 'douala.html'), '');
    expect(
      internalRefs(
        '<a href="/cgu#age">x</a><a href="https://wa.me/1">y</a><img src="/a.webp" srcset="/a.webp 2x, /b.webp 3x" /><a href="//cdn.x/y">z</a><a href="#top">t</a>',
      ),
    ).toEqual(['/cgu#age', '/a.webp', '#top', '/a.webp', '/b.webp']);
    expect(resolvePath('/', dist)).toBe(join(dist, 'index.html'));
    expect(resolvePath('/cgu', dist)).toBe(join(dist, 'cgu.html'));
    expect(resolvePath('/ville/douala', dist)).toBe(join(dist, 'ville', 'douala.html'));
    expect(resolvePath('/ville/paris', dist)).toBeNull();
    expect(resolvePath('/ville', dist)).toBeNull();
  });
});
