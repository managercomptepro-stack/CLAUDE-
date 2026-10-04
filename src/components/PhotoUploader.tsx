import { useEffect, useRef, useState } from 'preact/hooks';
import { PHOTOS_MAX } from '../data/limits';
import { fr } from '../i18n/fr';
import { uploadImage } from '../lib/cloudinary';
import { reportError } from '../lib/errors';
import { compressImage } from '../lib/image-compress';
import { listingPhotoUrl, movePhoto, parsePhotoRef, photoRef } from '../lib/listing-form';

/** Longest side sent to Cloudinary (the preset limits to 1600 too). */
const LISTING_MAX_SIDE = 1600;

interface Pending {
  key: number;
  percent: number;
  /** Compressed photo kept for « Réessayer ». */
  blob: Blob | null;
  error: string | null;
}

interface Props {
  photos: string[];
  setPhotos: (update: (prev: string[]) => string[]) => void;
  error?: string | undefined;
}

let nextKey = 1;

/**
 * 1 to 5 listing photos (PLAN phase 4): compressed and stripped of EXIF on the phone, sent one
 * by one to Cloudinary with progress, reordered with arrow buttons, the first one is the main
 * photo. A failed upload can be retried without picking the file again.
 */
export function PhotoUploader({ photos, setPhotos, error }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const [pending, setPending] = useState<Pending[]>([]);
  const room = PHOTOS_MAX - photos.length - pending.length;

  useEffect(() => {
    abortRef.current = new AbortController();
    return () => abortRef.current?.abort();
  }, []);

  const patch = (key: number, change: Partial<Pending>) =>
    setPending((list) => list.map((p) => (p.key === key ? { ...p, ...change } : p)));

  async function send(key: number, blob: Blob) {
    patch(key, { blob, error: null, percent: 0 });
    try {
      const up = await uploadImage(
        blob,
        'listing',
        (f) => patch(key, { percent: Math.round(f * 100) }),
        abortRef.current?.signal,
      );
      setPhotos((prev) =>
        prev.length < PHOTOS_MAX ? [...prev, photoRef(up.publicId, up.width, up.height)] : prev,
      );
      setPending((list) => list.filter((p) => p.key !== key));
    } catch (err) {
      patch(key, { error: reportError(err, 'photo') });
    }
  }

  async function pick(e: Event) {
    const target = e.currentTarget as HTMLInputElement;
    const files = Array.from(target.files ?? []).slice(0, Math.max(0, room));
    target.value = '';
    const jobs = files.map((file) => ({ file, key: nextKey++ }));
    setPending((list) => [...list, ...jobs.map(({ key }) => ({ key, percent: 0, blob: null, error: null }))]);
    // One at a time: on a slow connection, parallel uploads would all crawl.
    for (const { file, key } of jobs) {
      let blob: Blob;
      try {
        blob = (await compressImage(file, LISTING_MAX_SIDE)).blob;
      } catch (err) {
        patch(key, { error: reportError(err, 'photo') });
        continue;
      }
      await send(key, blob);
    }
  }

  return (
    <div class="field">
      <span class="field__label" id="photos-label">
        {fr.photos.label}
      </span>
      <p class="field__hint" id="photos-hint">
        {fr.photos.hint(PHOTOS_MAX)}
      </p>
      <ul class="photo-grid" aria-labelledby="photos-label">
        {photos.map((ref, i) => {
          const p = parsePhotoRef(ref);
          return (
            <li key={ref} class="photo-tile">
              <img
                class="photo-tile__img"
                src={listingPhotoUrl(ref, 360) ?? ''}
                width={p?.width}
                height={p?.height}
                alt={fr.photos.alt(i + 1)}
                loading="lazy"
              />
              {i === 0 && <span class="photo-tile__badge">{fr.photos.main}</span>}
              <div class="photo-tile__tools">
                <button
                  type="button"
                  class="photo-tile__tool"
                  disabled={i === 0}
                  aria-label={fr.photos.moveLeft(i + 1)}
                  onClick={() => setPhotos((prev) => movePhoto(prev, i, i - 1))}
                >
                  ‹
                </button>
                <button
                  type="button"
                  class="photo-tile__tool"
                  aria-label={fr.photos.remove(i + 1)}
                  onClick={() => setPhotos((prev) => prev.filter((r) => r !== ref))}
                >
                  ×
                </button>
                <button
                  type="button"
                  class="photo-tile__tool"
                  disabled={i === photos.length - 1}
                  aria-label={fr.photos.moveRight(i + 1)}
                  onClick={() => setPhotos((prev) => movePhoto(prev, i, i + 1))}
                >
                  ›
                </button>
              </div>
            </li>
          );
        })}
        {pending.map((p) => (
          <li key={p.key} class="photo-tile photo-tile--pending">
            {p.error ? (
              <div class="photo-tile__error">
                <p role="alert">{p.error}</p>
                {p.blob && (
                  <button
                    type="button"
                    class="link-button"
                    onClick={() => p.blob && void send(p.key, p.blob)}
                  >
                    {fr.photos.retry}
                  </button>
                )}
                <button
                  type="button"
                  class="photo-tile__tool"
                  aria-label={fr.photos.remove(photos.length + 1)}
                  onClick={() => setPending((list) => list.filter((x) => x.key !== p.key))}
                >
                  ×
                </button>
              </div>
            ) : (
              <div class="progress" role="status">
                <div class="progress__bar" style={{ transform: `scaleX(${p.percent / 100})` }} />
                <span class="progress__label">{fr.photos.sending(p.percent)}</span>
              </div>
            )}
          </li>
        ))}
        {room > 0 && (
          <li class="photo-tile photo-tile--add">
            <button
              type="button"
              class="photo-tile__add"
              aria-describedby="photos-hint"
              onClick={() => inputRef.current?.click()}
            >
              <span aria-hidden="true">+</span>
              {fr.photos.add}
            </button>
          </li>
        )}
      </ul>
      <input
        ref={inputRef}
        class="visually-hidden"
        type="file"
        multiple
        accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
        tabIndex={-1}
        aria-hidden="true"
        onChange={pick}
      />
      {error && (
        <p class="field__error" id="photos-error">
          {error}
        </p>
      )}
    </div>
  );
}
