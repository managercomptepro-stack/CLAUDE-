import { useEffect } from 'preact/hooks';
import { ACCOUNT_PURGE_DAYS } from '../data/limits';
import { logOut } from '../firebase/auth';
import { fr } from '../i18n/fr';
import { reportError } from '../lib/errors';
import { formatDate } from '../lib/format';
import { showToast } from './Toast';

const DAY_MS = 86_400_000;

/**
 * Shown instead of every page with an account once its deletion was requested (owner's decision
 * of 3 Oct 2026): the account is frozen until the super-admin or the nightly job erases it.
 */
export function DeletionPending({ askedAt }: { askedAt: Date }) {
  const t = fr.account;
  // Shown right after the request (page reloaded where the button was): start at the top.
  useEffect(() => window.scrollTo(0, 0), []);
  const deadline = new Date(askedAt.getTime() + ACCOUNT_PURGE_DAYS * DAY_MS);
  return (
    <div class="page">
      <h1 class="page__title">{t.pendingTitle}</h1>
      <section class="card panel-in">
        <p>{t.pendingBody(formatDate(askedAt), formatDate(deadline))}</p>
        <p class="field__hint">
          {t.pendingHelp}
          <a href="/aide#contact">{t.pendingContact}</a>.
        </p>
        <button
          type="button"
          class="button button--secondary button--block"
          onClick={async () => {
            try {
              await logOut();
              location.assign('/');
            } catch (error) {
              showToast(reportError(error, 'logout'), 'error');
            }
          }}
        >
          {t.logout}
        </button>
      </section>
    </div>
  );
}
