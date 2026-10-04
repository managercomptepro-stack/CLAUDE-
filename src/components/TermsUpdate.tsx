import { useState } from 'preact/hooks';
import { fr } from '../i18n/fr';
import { reportError } from '../lib/errors';

interface Props {
  uid: string;
  version: string;
  onAccepted: () => void;
}

/**
 * The terms changed since this member accepted them (`settings/public.termsVersion`): a new
 * acceptance is recorded before any account page (PLAN § Phase 8, rules `ownerUserUpdate`).
 */
export function TermsUpdate({ uid, version, onAccepted }: Props) {
  const t = fr.termsUpdate;
  const p = fr.profileForm;
  const [checked, setChecked] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function accept(e: Event) {
    e.preventDefault();
    if (busy) return;
    if (!checked) {
      setError(fr.form.termsRequired);
      return;
    }
    setBusy(true);
    setError('');
    try {
      await (await import('../lib/account')).acceptTerms(uid, version);
      onAccepted();
    } catch (err) {
      setError(reportError(err, 'terms-accept'));
      setBusy(false);
    }
  }

  return (
    <div class="page">
      <h1 class="page__title">{t.title}</h1>
      <form class="stack card" noValidate onSubmit={(e) => void accept(e)}>
        <p>{t.body}</p>
        <div class="field">
          <label class="check">
            <input
              type="checkbox"
              name="terms"
              checked={checked}
              aria-invalid={error ? 'true' : undefined}
              aria-describedby={error ? 'terms-update-error' : undefined}
              onChange={(e) => setChecked(e.currentTarget.checked)}
            />
            <span>
              {p.termsBefore}
              <a href="/cgu" target="_blank" rel="noopener noreferrer">
                {p.termsLink}
              </a>
              {p.termsMiddle}
              <a href="/confidentialite" target="_blank" rel="noopener noreferrer">
                {p.privacyLink}
              </a>
              {p.termsAfter}
            </span>
          </label>
          {error && (
            <p class="field__error" id="terms-update-error" role="alert">
              {error}
            </p>
          )}
        </div>
        <button type="submit" class="button button--primary button--block" disabled={busy}>
          {busy ? t.saving : t.accept}
        </button>
        <p class="field__hint">
          {t.refuse}
          <a href="/aide#contact">{t.contact}</a>.
        </p>
      </form>
    </div>
  );
}
