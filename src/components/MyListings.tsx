import { useEffect, useState } from 'preact/hooks';
import { fr } from '../i18n/fr';
import { reportError } from '../lib/errors';
import { boostBlock } from '../lib/boost-form';
import { formatDate, formatTime } from '../lib/format';
import {
  boostEndingSoon,
  dayWord,
  expiresAt,
  listingState,
  type ListingState,
  type OwnListing,
} from '../lib/listing-status';

// Firestore is loaded on demand (already in cache once AuthGate has run).
const listingApi = () => import('../lib/listing');
import { listingPhotoUrl, parsePhotoRef } from '../lib/listing-form';
import { EmptyState } from './EmptyState';
import { Skeleton } from './Skeleton';
import { showToast } from './Toast';

type Load =
  | { kind: 'loading' }
  | { kind: 'ready'; listings: OwnListing[]; max: number; pending: ReadonlySet<string> }
  | { kind: 'error'; message: string };

interface Props {
  uid: string;
  /** Called with the listings once loaded (computed reminders of /compte). */
  onLoaded?: (listings: OwnListing[]) => void;
}

/**
 * « Mes annonces » (PLAN phases 4 and 6): state, edit, republish, delete, boost; cap of the
 * account shown.
 */
export function MyListings({ uid, onLoaded }: Props) {
  const [load, setLoad] = useState<Load>({ kind: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const [{ loadOwnListings, loadListingCap }, { pendingListingIds }] = await Promise.all([
          listingApi(),
          import('../lib/boost'),
        ]);
        const [listings, max] = await Promise.all([loadOwnListings(uid), loadListingCap(uid)]);
        // Only an indicator: if it fails, « Mes annonces » stays usable (the rules refuse a 2nd request).
        const pending = await pendingListingIds(
          uid,
          listings.filter((l) => l.status === 'active').map((l) => l.id),
        ).catch((error: unknown) => {
          reportError(error, 'boost-pending');
          return new Set<string>();
        });
        if (cancelled) return;
        setLoad({ kind: 'ready', listings, max, pending });
        onLoaded?.(listings);
      } catch (error) {
        if (!cancelled) setLoad({ kind: 'error', message: reportError(error, 'my-listings') });
      }
    })();
    return () => {
      cancelled = true;
    };
    // onLoaded is a state setter of the parent: stable, not a dependency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid, attempt]);

  const reload = () => setAttempt((n) => n + 1);
  const t = fr.myListings;

  return (
    <section class="card" id="annonces" aria-labelledby="my-listings-title">
      <div class="card__head">
        <h2 class="card__title" id="my-listings-title">
          {t.title}
        </h2>
        {load.kind === 'ready' && <span class="card__meta">{t.count(load.listings.length, load.max)}</span>}
      </div>
      {load.kind === 'loading' && <Skeleton cards={1} title={false} />}
      {load.kind === 'error' && (
        <EmptyState title={load.message}>
          <button type="button" class="button button--secondary" onClick={reload}>
            {fr.retry}
          </button>
        </EmptyState>
      )}
      {load.kind === 'ready' && (
        <>
          {load.listings.length === 0 ? (
            <p class="field__hint">{t.empty}</p>
          ) : (
            <ul class="my-listings">
              {load.listings.map((l) => (
                <ListingRow key={l.id} listing={l} pending={load.pending.has(l.id)} onChanged={reload} />
              ))}
            </ul>
          )}
          {load.listings.length < load.max && (
            <a class="button button--primary button--block" href="/publier">
              {t.publish}
            </a>
          )}
        </>
      )}
    </section>
  );
}

function statusLine(l: OwnListing, s: ListingState): string {
  const t = fr.myListings;
  switch (s.status) {
    case 'removed':
      return t.removed;
    case 'hidden':
      return t.hidden;
    case 'expired':
      return t.expired;
    case 'expiring':
      return t.expiresIn(s.daysLeft);
    default:
      return t.activeUntil(formatDate(expiresAt(l.renewedAt)));
  }
}

function boostLine(s: ListingState): string | null {
  if (!s.boost) return null;
  const t = fr.myListings;
  const premium = s.boost.tier === 'premium';
  if (!s.boost.until) return premium ? t.premium : t.sponsored;
  if (boostEndingSoon(s)) {
    const when = dayWord(s.boost.until) === 'today' ? 'today' : 'tomorrow';
    return t.boostEnding(s.boost.tier, when, formatTime(s.boost.until));
  }
  const d = formatDate(s.boost.until);
  return premium ? t.premiumUntil(d) : t.sponsoredUntil(d);
}

interface RowProps {
  listing: OwnListing;
  /** A boost request of this listing is waiting for the admin. */
  pending: boolean;
  onChanged: () => void;
}

function ListingRow({ listing: l, pending, onChanged }: RowProps) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const s = listingState(l);
  const t = fr.myListings;
  const main = l.photos[0];
  const size = main ? parsePhotoRef(main) : null;
  const boost = boostLine(s);

  async function run(action: () => Promise<void>, done: string) {
    if (busy) return;
    setBusy(true);
    try {
      await action();
      showToast(done, 'success');
      setConfirming(false);
      onChanged();
    } catch (error) {
      showToast(reportError(error, 'my-listing'), 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <li class="my-listing" data-listing={l.id}>
      <div class="my-listing__main">
        {main && (
          <img
            class="my-listing__thumb"
            src={listingPhotoUrl(main, 360) ?? ''}
            width={size?.width}
            height={size?.height}
            alt=""
            loading="lazy"
          />
        )}
        <div class="my-listing__text">
          <p class="my-listing__title">{l.title}</p>
          <p class={`my-listing__status my-listing__status--${s.tone}`}>{statusLine(l, s)}</p>
          {l.status === 'removed' && l.removedReason && (
            <p class="my-listing__meta">{t.removedReason(l.removedReason)}</p>
          )}
          {boost && <p class="my-listing__boost">{boost}</p>}
          {pending && <p class="my-listing__status--pending">{t.boostPending}</p>}
          <p class="my-listing__meta">{t.stats(l.views, l.likes)}</p>
        </div>
      </div>
      {confirming ? (
        <div class="my-listing__confirm" role="group">
          <p>{t.confirmRemove(l.title)}</p>
          <div class="my-listing__actions">
            <button
              type="button"
              class="button button--danger"
              disabled={busy}
              onClick={() => void run(async () => (await listingApi()).deleteListing(l.id), t.removedToast)}
            >
              {l.status === 'removed' ? t.erase : t.remove}
            </button>
            <button type="button" class="link-button" onClick={() => setConfirming(false)}>
              {fr.account.deleteCancel}
            </button>
          </div>
        </div>
      ) : (
        <div class="my-listing__actions">
          {!pending && boostBlock(l) === null && (
            <a class="button button--primary" href={`/booster?id=${encodeURIComponent(l.id)}`}>
              {t.boost}
            </a>
          )}
          {s.canEdit && (
            <a class="button button--secondary" href={`/publier?id=${encodeURIComponent(l.id)}`}>
              {t.edit}
            </a>
          )}
          {s.canRepublish && (
            <button
              type="button"
              class="button button--secondary"
              disabled={busy}
              onClick={() => void run(async () => (await listingApi()).republishListing(l.id), t.republished)}
            >
              {t.republish}
            </button>
          )}
          {s.canDelete && (
            <button type="button" class="link-button link-button--muted" onClick={() => setConfirming(true)}>
              {l.status === 'removed' ? t.erase : t.remove}
            </button>
          )}
        </div>
      )}
    </li>
  );
}
