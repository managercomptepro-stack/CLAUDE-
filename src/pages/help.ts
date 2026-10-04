/**
 * /aide: the FAQ is in the HTML (src/shell/legal.ts). The WhatsApp button carries the default
 * support number; the current one (admin › Réglages) replaces it once `settings/public` is read.
 */
import { reportError } from '../lib/errors';
import { initShell } from '../shell/client';

initShell();
void import('../lib/support')
  .then((m) => m.applySupportNumber())
  .catch((e: unknown) => reportError(e, 'support'));
