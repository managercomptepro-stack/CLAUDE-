/**
 * Static content of the legal pages and /aide, rendered into the HTML at build time (readable
 * without JavaScript, PLAN § Phase 8). Texts: src/i18n/legal-fr.ts — never in the client bundle.
 */
import { PUBLISHER, type Publisher } from '../data/legal.ts';
import { DEFAULT_SETTINGS } from '../data/settings.ts';
import { legalFr, type LegalBlock, type LegalDoc } from '../i18n/legal-fr.ts';
import { formatWhatsApp } from '../lib/format.ts';
import { escapeHtml } from './html.ts';
import { supportLink } from './support-link.ts';
import type { PageId } from './pages.ts';

/**
 * Escapes, then applies `**gras**` and `[texte](/lien)`: internal paths and #anchors only, never
 * « //autre-site » (protocol-relative link to another host, security audit of 3 Oct 2026).
 */
export function inline(text: string): string {
  return escapeHtml(text)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\[([^\]]+)\]\(((?:\/(?!\/)|#)[^)\s]*)\)/g, '<a href="$2">$1</a>');
}

function block(b: LegalBlock): string {
  if (typeof b === 'string') return `<p>${inline(b)}</p>`;
  if ('list' in b) return `<ul>${b.list.map((li) => `<li>${inline(li)}</li>`).join('')}</ul>`;
  return `<p class="legal__note">${inline(b.note)}</p>`;
}

function section(id: string, heading: string, body: string): string {
  return `<section class="legal__section" id="${id}" aria-labelledby="${id}-t"><h2 id="${id}-t">${escapeHtml(heading)}</h2>${body}</section>`;
}

function toc(items: readonly { id: string; heading: string }[]): string {
  const links = items.map((s) => `<li><a href="#${s.id}">${escapeHtml(s.heading)}</a></li>`).join('');
  return `<nav class="legal__toc" aria-label="${escapeHtml(legalFr.tocLabel)}"><p class="legal__toc-title">${escapeHtml(legalFr.tocLabel)}</p><ol>${links}</ol></nav>`;
}

function head(heading: string, updated: string | null, intro: string): string {
  return (
    `<h1 class="page__title">${escapeHtml(heading)}</h1>` +
    (updated ? `<p class="legal__updated">${escapeHtml(updated)}</p>` : '') +
    `<p class="legal__intro">${inline(intro)}</p>`
  );
}

function legalDoc(doc: LegalDoc, before: { id: string; heading: string; html: string }[] = []): string {
  const all = [...before.map((b) => ({ id: b.id, heading: b.heading })), ...doc.sections];
  return (
    head(doc.heading, doc.updated, doc.intro) +
    toc(all) +
    before.map((b) => section(b.id, b.heading, b.html)).join('') +
    doc.sections.map((s) => section(s.id, s.heading, s.blocks.map(block).join(''))).join('')
  );
}

function publisherSection(p: Publisher): string {
  const t = legalFr.legal;
  const value = (v: string | null) =>
    v?.trim() ? escapeHtml(v) : `<span class="legal__missing">${escapeHtml(legalFr.toBeCompleted)}</span>`;
  const rows = (Object.keys(t.publisherFields) as (keyof Publisher)[])
    .map((k) => `<dt>${escapeHtml(t.publisherFields[k])}</dt><dd>${value(p[k])}</dd>`)
    .join('');
  return (
    `<p>${escapeHtml(t.publisherIntro)}</p>` +
    `<dl class="legal__facts">${rows}<dt>${escapeHtml(t.contactLabel)}</dt><dd>${inline(t.contactValue)}</dd></dl>`
  );
}

function helpPage(): string {
  const t = legalFr.help;
  const number = DEFAULT_SETTINGS.supportWhatsApp;
  const faq = t.questions
    .map(
      (q) =>
        `<details class="faq" id="${q.id}"><summary class="faq__q">${escapeHtml(q.question)}</summary><div class="faq__a">${q.answer.map(block).join('')}</div></details>`,
    )
    .join('');
  // The number in the HTML is the default one; /aide's script replaces it with settings/public.
  const contact =
    `<p>${escapeHtml(t.contactBody)}</p>` +
    `<a class="button button--whatsapp button--block" data-support-link href="${escapeHtml(supportLink(number))}" target="_blank" rel="noopener noreferrer">` +
    `<img class="brand-mark" src="/brands/whatsapp-glyph-black.svg" width="24" height="24" alt="" />${escapeHtml(t.contactButton)}</a>` +
    `<p class="legal__number">${escapeHtml(t.contactNumber)} : <span data-support-number>${escapeHtml(formatWhatsApp(number))}</span></p>`;
  return (
    head(t.heading, null, t.intro) +
    `<div class="faq-list">${faq}</div>` +
    section('contact', t.contactHeading, contact)
  );
}

const STATIC_PAGES: Partial<Record<PageId, () => string>> = {
  terms: () => legalDoc(legalFr.terms),
  privacy: () => legalDoc(legalFr.privacy),
  rules: () => legalDoc(legalFr.rules),
  legal: () =>
    legalDoc(legalFr.legal, [
      { id: 'editeur', heading: legalFr.legal.publisherHeading, html: publisherSection(PUBLISHER) },
    ]),
  help: helpPage,
};

/** Pages whose whole content is in the HTML (their script only wires the shell). */
export function isStaticPage(id: PageId): boolean {
  return id in STATIC_PAGES;
}

/** <main> content of a static page, with the « relire par un juriste » note as an HTML comment. */
export function renderStaticContent(id: PageId): string | null {
  const render = STATIC_PAGES[id];
  if (!render) return null;
  const comment = id === 'help' ? '' : `<!-- ${legalFr.juristNote} -->`;
  return `${comment}<article class="page legal">${render()}</article>`;
}
