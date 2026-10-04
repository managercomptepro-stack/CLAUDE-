/** sitemap.xml and robots.txt, generated at build time from PAGES (SPEC § 13). */
import { PAGES, SITE_URL, type PageDef } from './pages.ts';

/** In the sitemap: indexable pages whose content does not depend on the query string. */
export function sitemapPages(): PageDef[] {
  return PAGES.filter((p) => !p.noindex && p.id !== 'listing' && p.id !== 'member' && p.id !== 'login');
}

export function sitemapXml(): string {
  const urls = sitemapPages()
    .map((p) => `  <url><loc>${SITE_URL}${p.path}</loc></url>`)
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}

/**
 * Everything may be crawled: private pages carry `noindex` (a Disallow would hide that tag from
 * search engines and could still let the bare address be indexed).
 */
export function robotsTxt(): string {
  return `User-agent: *\nAllow: /\n\nSitemap: ${SITE_URL}/sitemap.xml\n`;
}
