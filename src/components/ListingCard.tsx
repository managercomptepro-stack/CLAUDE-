import { useEffect, useRef } from 'preact/hooks';
import { fr } from '../i18n/fr';
import { listingPhotoUrl, parsePhotoRef } from '../lib/photo-url';
import { ageFromBirthMonth, promotion, type PublicListing } from '../lib/public-listing';
import { prepareListing } from '../lib/listing-handoff';
import { reveal } from '../lib/reveal';
import { Icon, VerifiedBadge } from './Icon';

export function listingHref(id: string): string {
  return `/annonce?id=${encodeURIComponent(id)}`;
}

function Photo({ refStr, alt, eager }: { refStr: string; alt: string; eager: boolean }) {
  const size = parsePhotoRef(refStr);
  return (
    <img
      class="lcard__img"
      src={listingPhotoUrl(refStr, 360) ?? ''}
      width={size?.width}
      height={size?.height}
      alt={alt}
      loading={eager ? 'eager' : 'lazy'}
      decoding="async"
      {...(eager ? { fetchpriority: 'high' } : {})}
    />
  );
}

export function PromotionTag({ tier }: { tier: 'premium' | 'sponsored' }) {
  return <span class={`tag tag--${tier}`}>{tier === 'premium' ? fr.card.premium : fr.card.sponsored}</span>;
}

/**
 * Feed card (SPEC § 6, design of 3 Oct 2026): tall photo with the text laid on it over a dark
 * gradient — pseudo, age, badge, profile and district, views and likes in small — and the
 * Premium/Sponsorisé label. Every card has the same size (2 per line); `wide` = one per line with
 * the start of the title (search results). Premium (decision 6): gold frame and its photos scroll
 * sideways; Sponsored: a quieter frame. Cards added below the screen fade in (../lib/reveal).
 */
export function ListingCard({
  listing: l,
  eager = false,
  wide = false,
}: {
  listing: PublicListing;
  eager?: boolean;
  wide?: boolean;
}) {
  const ref = useRef<HTMLLIElement>(null);
  useEffect(() => reveal(ref.current), []);
  const tier = promotion(l);
  const alt = fr.card.photoAlt(l.pseudo);
  const photos = tier === 'premium' ? l.photos : l.photos.slice(0, 1);
  const cls = ['lcard', tier && `lcard--${tier}`, wide && 'lcard--wide'].filter(Boolean).join(' ');
  return (
    <li ref={ref} class={cls} data-listing={l.id}>
      <a
        class="lcard__link"
        href={listingHref(l.id)}
        onPointerDown={() => prepareListing(l)}
        onFocus={() => prepareListing(l)}
      >
        <div class="lcard__media">
          <div class="lcard__photos">
            {photos.map((p, i) => (
              <Photo
                key={p}
                refStr={p}
                alt={i === 0 ? alt : fr.card.photoN(i + 1, photos.length)}
                eager={eager && i === 0}
              />
            ))}
          </div>
          <span class="lcard__scrim" aria-hidden="true" />
          {tier && <PromotionTag tier={tier} />}
          {photos.length > 1 && (
            <span class="lcard__count" aria-hidden="true">
              {photos.length}
            </span>
          )}
          <div class="lcard__caption">
            <p class="lcard__who">
              <span class="lcard__pseudo">{l.pseudo}</span>
              <span class="lcard__age">{fr.card.age(ageFromBirthMonth(l.birthMonth))}</span>
              {l.verified && <VerifiedBadge />}
            </p>
            <p class="lcard__where">
              {fr.genres[l.genre]} · {l.district}
            </p>
            {wide && <p class="lcard__title">{l.title}</p>}
            <p class="lcard__stats">
              <span>
                <Icon name="eye" />
                <span class="visually-hidden">{fr.card.views(l.views)}</span>
                <span aria-hidden="true">{l.views}</span>
              </span>
              <span>
                <Icon name="heart" />
                <span class="visually-hidden">{fr.card.likes(l.likes)}</span>
                <span aria-hidden="true">{l.likes}</span>
              </span>
            </p>
          </div>
        </div>
      </a>
    </li>
  );
}
