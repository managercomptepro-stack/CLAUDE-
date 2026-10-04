import { useEffect, useState } from 'preact/hooks';
import { AuthGate, type Session } from '../components/AuthGate';
import { logOut, refreshVerification, sendVerification } from '../firebase/auth';
import { fr } from '../i18n/fr';
import { reportError } from '../lib/errors';
import { currentNext } from '../lib/navigation';
import { mountPage } from '../shell/mount';

const RESEND_DELAY_S = 60;

function VerifyEmail({ session }: { session: Session }) {
  const { user } = session;
  const next = currentNext();
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const [wait, setWait] = useState(0);

  async function check(silent: boolean) {
    if (busy) return;
    setBusy(true);
    try {
      if (await refreshVerification(user)) {
        location.replace(next);
        return;
      }
      if (!silent) setMessage({ text: fr.verify.notYet, ok: false });
    } catch (error) {
      const text = reportError(error, 'verify');
      if (!silent) setMessage({ text, ok: false });
    }
    setBusy(false);
  }

  // Already verified (link opened on this device) → straight to the page asked for.
  useEffect(() => {
    if (user.emailVerified) location.replace(next);
    const onVisible = () => {
      if (document.visibilityState === 'visible') void check(true);
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- registered once
  }, []);

  useEffect(() => {
    if (wait <= 0) return;
    const id = window.setTimeout(() => setWait((s) => s - 1), 1000);
    return () => window.clearTimeout(id);
  }, [wait]);

  async function resend() {
    if (wait > 0 || busy) return;
    setBusy(true);
    try {
      await sendVerification(user, next);
      setWait(RESEND_DELAY_S);
      setMessage({ text: fr.verify.resent, ok: true });
    } catch (error) {
      setMessage({ text: reportError(error, 'resend'), ok: false });
    }
    setBusy(false);
  }

  async function logout() {
    try {
      await logOut();
      location.assign('/');
    } catch (error) {
      setMessage({ text: reportError(error, 'logout'), ok: false });
    }
  }

  return (
    <div class="page">
      <h1 class="page__title">{fr.headings.verifyEmail}</h1>
      <div class="stack">
        <div class="card">
          <p>
            <strong>{fr.verify.lead(user.email ?? '')}</strong>
          </p>
          <p>{fr.verify.steps}</p>
          <p class="field__hint">{fr.verify.why}</p>
        </div>
        {message && (
          <p class={message.ok ? 'notice notice--ok' : 'form-error'} role={message.ok ? 'status' : 'alert'}>
            {message.text}
          </p>
        )}
        <button
          type="button"
          class="button button--primary button--block"
          disabled={busy}
          onClick={() => void check(false)}
        >
          {busy ? fr.login.working : fr.verify.check}
        </button>
        <button
          type="button"
          class="button button--secondary button--block"
          disabled={wait > 0 || busy}
          onClick={resend}
        >
          {wait > 0 ? fr.verify.resendIn(wait) : fr.verify.resend}
        </button>
        <button type="button" class="link-button link-button--center" onClick={logout}>
          {fr.verify.logout}
        </button>
      </div>
    </div>
  );
}

mountPage(<AuthGate requirement="profile">{(session) => <VerifyEmail session={session} />}</AuthGate>);
