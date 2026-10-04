import { useEffect, useRef, useState } from 'preact/hooks';
import { fr } from '../i18n/fr';
import { avatarDisplayUrl, uploadImage } from '../lib/cloudinary';
import { reportError } from '../lib/errors';
import { compressImage } from '../lib/image-compress';

/** Uploaded side: the preset crops to 400×400; 800 px keeps the face sharp and the upload small. */
const AVATAR_MAX_SIDE = 800;

type Status =
  | { kind: 'idle' }
  | { kind: 'sending'; percent: number }
  /** `retry`: the compressed photo, kept to send it again without asking for it. */
  | { kind: 'error'; message: string; retry: Blob | null };

interface Props {
  /** Stored `secure_url`, or null. */
  value: string | null;
  /** Letter shown when there is no photo. */
  initial: string;
  /** Saves the new value (sign-up form state, or Firestore in « Mon compte »). */
  onChange: (url: string | null) => Promise<void> | void;
  /** « Mon compte »: buttons only, the photo is the one of the profile block (shown once). */
  bare?: boolean;
}

/** Optional profile photo: add, change, remove, with upload progress and retry (SPEC § 4). */
export function AvatarPicker({ value, initial, onChange, bare = false }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const [status, setStatus] = useState<Status>({ kind: 'idle' });
  const busy = status.kind === 'sending';

  useEffect(() => () => abortRef.current?.abort(), []);

  async function send(blob: Blob) {
    abortRef.current = new AbortController();
    setStatus({ kind: 'sending', percent: 0 });
    try {
      const uploaded = await uploadImage(
        blob,
        'avatar',
        (f) => setStatus({ kind: 'sending', percent: Math.round(f * 100) }),
        abortRef.current.signal,
      );
      await onChange(uploaded.secureUrl);
      setStatus({ kind: 'idle' });
    } catch (error) {
      setStatus({ kind: 'error', message: reportError(error, 'avatar'), retry: blob });
    }
  }

  async function pick(e: Event) {
    const target = e.currentTarget as HTMLInputElement;
    const file = target.files?.[0];
    target.value = '';
    if (!file) return;
    let blob: Blob;
    try {
      blob = (await compressImage(file, AVATAR_MAX_SIDE)).blob;
    } catch (error) {
      setStatus({ kind: 'error', message: reportError(error, 'avatar'), retry: null });
      return;
    }
    await send(blob);
  }

  async function remove() {
    try {
      await onChange(null);
      setStatus({ kind: 'idle' });
    } catch (error) {
      setStatus({ kind: 'error', message: reportError(error, 'avatar'), retry: null });
    }
  }

  const src = avatarDisplayUrl(value);
  return (
    <div class={bare ? 'avatar-picker--bare' : 'field'}>
      <span class={bare ? 'visually-hidden' : 'field__label'} id="avatar-label">
        {fr.avatar.label} <span class="field__optional">{fr.avatar.optional}</span>
      </span>
      <div class="avatar-picker">
        {bare ? null : src ? (
          <img class="avatar avatar--lg" src={src} width="80" height="80" alt={fr.avatar.alt(initial)} />
        ) : (
          <span class="avatar avatar--lg avatar--empty" aria-hidden="true">
            {initial.charAt(0).toUpperCase() || '?'}
          </span>
        )}
        <div class="avatar-picker__actions">
          <button
            type="button"
            class="button button--secondary"
            disabled={busy}
            aria-describedby="avatar-label"
            onClick={() => inputRef.current?.click()}
          >
            {value ? fr.avatar.change : fr.avatar.add}
          </button>
          {value && !busy && (
            <button type="button" class="link-button" onClick={remove}>
              {fr.avatar.remove}
            </button>
          )}
        </div>
      </div>
      <input
        ref={inputRef}
        class="visually-hidden"
        type="file"
        accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
        tabIndex={-1}
        aria-hidden="true"
        onChange={pick}
      />
      {status.kind === 'sending' && (
        <div class="progress" role="status">
          <div class="progress__bar" style={{ transform: `scaleX(${status.percent / 100})` }} />
          <span class="progress__label">{fr.avatar.sending(status.percent)}</span>
        </div>
      )}
      {status.kind === 'error' && (
        <div class="stack">
          <p class="field__error" role="alert">
            {status.message}
          </p>
          {status.retry && (
            <button type="button" class="link-button" onClick={() => status.retry && void send(status.retry)}>
              {fr.avatar.retry}
            </button>
          )}
        </div>
      )}
      {!bare && <p class="field__hint">{fr.avatar.hint}</p>}
    </div>
  );
}
