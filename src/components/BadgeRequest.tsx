import { useEffect, useRef, useState } from 'preact/hooks';
import { DATA_URL_MAX_CHARS } from '../data/limits';
import { fr } from '../i18n/fr';
import { reportError } from '../lib/errors';
import type { BadgeRequestStatus } from '../lib/verification';
import { VerifiedBadge } from './Icon';
import { showToast } from './Toast';

interface Props {
  uid: string;
  verified: boolean;
  emailVerified: boolean;
}

type Load = { kind: 'loading' } | { kind: 'ready'; status: BadgeRequestStatus | null } | { kind: 'error' };

/**
 * Verification status inside the profile block of /compte (SPEC § 8, owner's request of 3 Oct
 * 2026): « Compte vérifié » with the badge, the pending request, or « Demander la vérification »
 * which opens the ID photo form sent to the moderation.
 */
export function BadgeRequest({ uid, verified, emailVerified }: Props) {
  const t = fr.badge;
  const [load, setLoad] = useState<Load>({ kind: 'loading' });
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (verified) return;
    let cancelled = false;
    import('../lib/verification')
      .then((m) => m.loadBadgeStatus(uid))
      .then((status) => !cancelled && setLoad({ kind: 'ready', status }))
      .catch((e: unknown) => {
        reportError(e, 'badge-status');
        if (!cancelled) setLoad({ kind: 'error' });
      });
    return () => {
      cancelled = true;
    };
  }, [uid, verified]);

  let content;
  if (verified) {
    content = (
      <p class="badge-state badge-state--ok">
        <VerifiedBadge /> {t.granted}
      </p>
    );
  } else if (load.kind === 'loading' || load.kind === 'error') {
    // On a read error the block stays quiet: the rest of the account page keeps working.
    return null;
  } else if (load.status === 'pending') {
    content = (
      <p class="notice" role="status">
        {t.pending}
      </p>
    );
  } else if (!emailVerified) {
    content = <p class="field__hint">{t.needVerifiedEmail}</p>;
  } else if (!open) {
    content = (
      <>
        {load.status === 'rejected' && <p class="notice">{t.refused}</p>}
        <button type="button" class="button button--secondary button--block" onClick={() => setOpen(true)}>
          <VerifiedBadge /> {t.ask}
        </button>
      </>
    );
  } else {
    content = (
      <div class="stack panel-in">
        <p class="field__hint">{t.intro}</p>
        <BadgeForm
          uid={uid}
          previous={load.status}
          onSent={() => setLoad({ kind: 'ready', status: 'pending' })}
        />
      </div>
    );
  }
  return (
    <div class="badge-block" data-badge-block>
      <h3 class="visually-hidden">{t.title}</h3>
      {content}
    </div>
  );
}

function BadgeForm(props: { uid: string; previous: BadgeRequestStatus | null; onSent: () => void }) {
  const t = fr.badge;
  const inputRef = useRef<HTMLInputElement>(null);
  const [image, setImage] = useState<string | null>(null);
  const [preparing, setPreparing] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function pick(e: Event) {
    const input = e.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    setPreparing(true);
    setError('');
    try {
      const { compressToDataUrl } = await import('../lib/image-compress');
      setImage(await compressToDataUrl(file, DATA_URL_MAX_CHARS));
    } catch (err) {
      setError(reportError(err, 'badge-image'));
    } finally {
      setPreparing(false);
    }
  }

  async function submit() {
    if (busy || preparing) return;
    if (!image) {
      setError(t.missing);
      return;
    }
    setBusy(true);
    setError('');
    try {
      await (await import('../lib/verification')).submitBadgeRequest(props.uid, image, props.previous);
      showToast(t.sent, 'success');
      props.onSent();
    } catch (err) {
      setError(reportError(err, 'badge-submit'));
      setBusy(false);
    }
  }

  return (
    <div class="stack">
      {image && <img class="shot-preview" src={image} alt={t.previewAlt} />}
      <input
        ref={inputRef}
        class="visually-hidden"
        type="file"
        accept="image/jpeg,image/png,image/webp"
        tabIndex={-1}
        aria-hidden="true"
        data-badge-input
        onChange={(e) => void pick(e)}
      />
      <button
        type="button"
        class="button button--secondary button--block"
        disabled={preparing || busy}
        onClick={() => inputRef.current?.click()}
      >
        {preparing ? t.preparing : image ? t.change : t.choose}
      </button>
      {error && (
        <p class="field__error" role="alert">
          {error}
        </p>
      )}
      <button
        type="button"
        class="button button--primary button--block"
        disabled={busy || preparing}
        onClick={() => void submit()}
      >
        {busy ? t.sending : t.submit}
      </button>
    </div>
  );
}
