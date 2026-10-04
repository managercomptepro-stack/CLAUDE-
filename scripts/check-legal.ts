/**
 * Run by `npm run deploy` (production only): refuses to publish while the publisher identity of
 * /mentions-legales is incomplete (src/data/legal.ts — facts only the owner can give).
 */
import { missingPublisherFields } from '../src/data/legal.ts';
import { legalFr } from '../src/i18n/legal-fr.ts';

const missing = missingPublisherFields();
if (missing.length > 0) {
  const labels = missing.map((k) => legalFr.legal.publisherFields[k]).join(', ');
  console.error(
    `[check-legal] Mentions légales incomplètes (src/data/legal.ts) : ${labels}. Déploiement refusé.`,
  );
  process.exit(1);
}
console.log('[check-legal] Mentions légales complètes.');
