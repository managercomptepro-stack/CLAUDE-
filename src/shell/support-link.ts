import { fr } from '../i18n/fr.ts';

/** wa.me link of the support number (« +2376XXXXXXXX ») with the /aide message. */
export function supportLink(number: string): string {
  return `https://wa.me/${number.replace(/\D/g, '')}?text=${encodeURIComponent(fr.supportMessage)}`;
}
