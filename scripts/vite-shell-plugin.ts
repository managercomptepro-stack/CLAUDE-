/**
 * Vite plugin: injects the static shell (src/shell/render.ts) into every HTML entry, emits
 * sitemap.xml and robots.txt (src/shell/seo.ts), and
 * serves clean URLs (« /recherche » → recherche.html) in dev and preview, like Firebase
 * Hosting `cleanUrls` does in production.
 */
import type { Connect, Plugin } from 'vite';
import { pageByFile, pageByPath } from '../src/shell/pages.ts';
import { renderBody, renderHead } from '../src/shell/render.ts';
import { robotsTxt, sitemapXml } from '../src/shell/seo.ts';

const HEAD_MARK = '<!--nx:head-->';
const BODY_MARK = '<!--nx:body-->';

function cleanUrlMiddleware(): Connect.NextHandleFunction {
  return (req, _res, next) => {
    const url = req.url ?? '/';
    const [path = '/', query] = url.split('?');
    const page = path !== '/' ? pageByPath(path.replace(/\/$/, '')) : undefined;
    if (page) req.url = `/${page.file}${query ? `?${query}` : ''}`;
    next();
  };
}

export function shellPlugin(): Plugin {
  return {
    name: 'nioxxer-shell',
    transformIndexHtml: {
      order: 'pre',
      handler(html, ctx) {
        const file = ctx.path.replace(/^\//, '');
        const page = pageByFile(file);
        if (!page) throw new Error(`[nioxxer-shell] no page definition for ${ctx.path}`);
        if (!html.includes(HEAD_MARK) || !html.includes(BODY_MARK)) {
          throw new Error(`[nioxxer-shell] ${file} must contain ${HEAD_MARK} and ${BODY_MARK}`);
        }
        // Content-Security-Policy in built pages only (ctx.server = Vite dev server).
        return html
          .replace(HEAD_MARK, renderHead(page, { csp: !ctx.server }))
          .replace(BODY_MARK, renderBody(page));
      },
    },
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'sitemap.xml', source: sitemapXml() });
      this.emitFile({ type: 'asset', fileName: 'robots.txt', source: robotsTxt() });
    },
    configureServer(server) {
      server.middlewares.use(cleanUrlMiddleware());
    },
    configurePreviewServer(server) {
      server.middlewares.use(cleanUrlMiddleware());
    },
  };
}
