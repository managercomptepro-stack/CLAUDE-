import { useRef, useState } from 'preact/hooks';
import { fr } from '../i18n/fr';
import { listingPhotoUrl, parsePhotoRef } from '../lib/photo-url';

/** Listing photos, swiped sideways (native scroll snap), with a « 2 / 5 » position. */
export function Gallery({ photos, alt }: { photos: string[]; alt: string }) {
  const track = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  // The other photos wait for the first one: on a slow connection they would compete with it
  // (Lighthouse: 260 KB of images before the main photo was shown).
  const [rest, setRest] = useState(false);

  const onScroll = () => {
    const el = track.current;
    if (!el || !el.clientWidth) return;
    setIndex(Math.round(el.scrollLeft / el.clientWidth));
  };

  // Frame shaped like the main photo (between portrait 4:5 and landscape 4:3): known before the
  // image arrives, so nothing jumps, and little empty space around landscape photos.
  const main = parsePhotoRef(photos[0] ?? '');
  const ratio = main ? Math.min(4 / 3, Math.max(4 / 5, main.width / main.height)) : 4 / 5;

  return (
    <section class="gallery" aria-label={fr.listing.gallery}>
      <div
        class="gallery__track"
        ref={track}
        onScroll={onScroll}
        tabIndex={0}
        style={{ aspectRatio: ratio.toFixed(3) }}
      >
        {photos.map((p, i) => {
          const size = parsePhotoRef(p);
          if (i > 0 && !rest) {
            return <span key={p} class="gallery__img gallery__img--waiting" />;
          }
          return (
            <img
              key={p}
              class="gallery__img"
              src={listingPhotoUrl(p, 960) ?? ''}
              width={size?.width}
              height={size?.height}
              alt={i === 0 ? alt : fr.card.photoN(i + 1, photos.length)}
              loading={i === 0 ? 'eager' : 'lazy'}
              decoding="async"
              {...(i === 0
                ? { fetchpriority: 'high', onLoad: () => setRest(true), onError: () => setRest(true) }
                : {})}
            />
          );
        })}
      </div>
      {photos.length > 1 && (
        <p class="gallery__position" aria-hidden="true">
          {index + 1} / {photos.length}
        </p>
      )}
    </section>
  );
}
