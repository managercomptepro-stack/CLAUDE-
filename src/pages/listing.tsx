import { useEffect, useState } from 'preact/hooks';
import { EmptyState } from '../components/EmptyState';
import { Gallery } from '../components/Gallery';
import { Icon, VerifiedBadge } from '../components/Icon';
import { PromotionTag } from '../components/ListingCard';
import { ReportButton } from '../components/ReportDialog';
import { Skeleton } from '../components/Skeleton';
import { showToast } from '../components/Toast';
import { cityBySlug } from '../data/cities';
import { fr } from '../i18n/fr';
import { avatarDisplayUrl } from '../lib/cloudinary';
import { errorCode, reportError } from '../lib/errors';
import { countView, loadContact, loadListing } from '../lib/feed';
import { takeListing } from '../lib/listing-handoff';
import { formatDate, memberSince } from '../lib/format';
import {
  ageFromBirthMonth,
  dayKey,
  markView,
  promotion,
  telUrl,
  whatsappUrl,
  type PublicListing,
  type ViewMarks,
} from '../lib/public-listing';
import { mountPage } from '../shell/mount';

const VIEWS_KEY = 'nx-views';
const LIKED_KEY = 'nx-liked';

function readJson<T>(key: string, fallback: T): T {
  try {
    const v: unknown = JSON.parse(localStorage.getItem(key) ?? 'null');
    return v && typeof v === 'object' ? (v as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage blocked: only a display convenience is lost.
  }
}

/** +1 view at most once per listing, per browser and per day (ARCHITECTURE § 9). */
function countViewOnce(id: string): void {
  const marks = markView(readJson<ViewMarks>(VIEWS_KEY, {}), id, dayKey());
  if (!marks) return;
  writeJson(VIEWS_KEY, marks);
  countView(id).catch((error: unknown) => reportError(error, 'view'));
}

/** Listings liked in this browser: only to show the heart filled before any tap. */
function likedIds(): Record<string, true> {
  return readJson<Record<string, true>>(LIKED_KEY, {});
}

function Actions({ l }: { l: PublicListing }) {
  const [liked, setLiked] = useState(() => likedIds()[l.id] === true);
  const [likes, setLikes] = useState(l.likes);
  const [busy, setBusy] = useState<'' | 'whatsapp' | 'call' | 'like'>('');

  async function contact(kind: 'whatsapp' | 'call') {
    if (busy) return;
    setBusy(kind);
    try {
      // The number is read only now, never before the tap (CLAUDE.md § 4.5), by a session
      // (anonymous for a visitor: the rules refuse a read without one).
      await (await import('../lib/social')).visitorUid();
      const c = await loadContact(l.id);
      if (!c) throw new Error('E_NO_CONTACT');
      location.assign(kind === 'whatsapp' ? whatsappUrl(c.whatsapp, l.title) : telUrl(c.whatsapp));
    } catch (error) {
      showToast(reportError(error, 'contact'), 'error');
    } finally {
      setBusy('');
    }
  }

  async function like() {
    if (busy) return;
    setBusy('like');
    try {
      const { toggleLike } = await import('../lib/social');
      const now = await toggleLike(l.id);
      const others = Object.fromEntries(Object.entries(likedIds()).filter(([k]) => k !== l.id));
      writeJson(LIKED_KEY, now ? { ...others, [l.id]: true } : others);
      // The count follows what was stored, even if this browser had forgotten the like.
      setLikes((n) => Math.max(0, n + (now ? 1 : -1)));
      setLiked(now);
    } catch (error) {
      showToast(reportError(error, 'like'), 'error');
    } finally {
      setBusy('');
    }
  }

  async function share() {
    const url = `${location.origin}/annonce?id=${encodeURIComponent(l.id)}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: l.title, text: fr.listing.shareText(l.title), url });
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return;
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      showToast(fr.listing.shareCopied, 'success');
    } catch {
      showToast(fr.listing.shareFailed, 'error');
    }
  }

  return (
    <div class="listing-actions">
      <button
        type="button"
        class="button button--whatsapp button--block"
        aria-label={fr.listing.whatsappLabel}
        disabled={busy === 'whatsapp'}
        onClick={() => void contact('whatsapp')}
      >
        {/* Official glyph (public/brands/README.md), next to the word, never instead of it. */}
        <img class="brand-mark" src="/brands/whatsapp-glyph-black.svg" width={24} height={24} alt="" />
        {fr.listing.whatsapp}
      </button>
      {l.callAllowed && (
        <button
          type="button"
          class="button button--secondary button--block"
          disabled={busy === 'call'}
          onClick={() => void contact('call')}
        >
          <Icon name="phone" />
          {fr.listing.call}
        </button>
      )}
      <div class="actions-row">
        <button
          type="button"
          class={`action${liked ? ' action--on' : ''}`}
          aria-pressed={liked}
          disabled={busy === 'like'}
          onClick={() => void like()}
        >
          <Icon name="heart" filled={liked} />
          <span>{liked ? fr.listing.liked : fr.listing.like}</span>
          <span class="action__count">{likes}</span>
        </button>
        <button type="button" class="action" onClick={() => void share()}>
          <Icon name="share" />
          <span>{fr.listing.share}</span>
        </button>
        <ReportButton listingId={l.id} />
      </div>
    </div>
  );
}

function ListingView({ l }: { l: PublicListing }) {
  const tier = promotion(l);
  const avatar = avatarDisplayUrl(l.profilePhotoUrl);
  const city = cityBySlug(l.citySlug)?.name ?? '';
  return (
    <article class={`page listing${tier ? ` listing--${tier}` : ''}`}>
      <Gallery photos={l.photos} alt={fr.card.photoAlt(l.pseudo)} />
      <header class="listing__head">
        {tier && <PromotionTag tier={tier} />}
        <h1 class="listing__title">{l.title}</h1>
        <p class="listing__place">
          <Icon name="pin" />
          {fr.listing.place(l.district, city)}
        </p>
      </header>
      <Actions l={l} />
      <a class="listing__author" href={`/membre?u=${encodeURIComponent(l.ownerUid)}`}>
        {avatar ? (
          <img class="avatar" src={avatar} width={48} height={48} alt="" loading="lazy" />
        ) : (
          <span class="avatar avatar--empty" aria-hidden="true">
            {l.pseudo.charAt(0).toUpperCase()}
          </span>
        )}
        <span class="listing__author-text">
          <span class="listing__pseudo">
            {l.pseudo}, {fr.card.age(ageFromBirthMonth(l.birthMonth))} {l.verified && <VerifiedBadge />}
          </span>
          <span class="listing__meta">
            {fr.genres[l.genre]} · {memberSince(l.memberSince)}
          </span>
          <span class="listing__more">{fr.listing.memberLink}</span>
        </span>
      </a>
      <section class="listing__section">
        <h2 class="section-title">{fr.listing.description}</h2>
        <p class="listing__text">{l.description}</p>
      </section>
      {l.offer && (
        <section class="listing__section">
          <h2 class="section-title">{fr.listing.offer}</h2>
          <p class="listing__text">{l.offer}</p>
        </section>
      )}
      <ul class="listing__facts">
        <li>{l.callAllowed ? fr.listing.contactCalls : fr.listing.contactMessages}</li>
        <li>
          {fr.card.views(l.views)} · {fr.card.likes(l.likes)}
        </li>
        <li>{fr.listing.published(formatDate(l.createdAt))}</li>
      </ul>
    </article>
  );
}

type State =
  { kind: 'loading' } | { kind: 'missing' } | { kind: 'error' } | { kind: 'ok'; listing: PublicListing };

function ListingPage() {
  const id = new URLSearchParams(location.search).get('id') ?? '';
  // Opened from the rail or the feed: the copy on screen shows at once, then the fresh one.
  const [state, setState] = useState<State>(() => {
    const copy = takeListing(id);
    return copy ? { kind: 'ok', listing: copy } : { kind: 'loading' };
  });

  const load = () => {
    setState((s) => (s.kind === 'ok' ? s : { kind: 'loading' }));
    if (!id) {
      setState({ kind: 'missing' });
      return;
    }
    loadListing(id)
      .then((listing) => {
        if (!listing) {
          setState({ kind: 'missing' });
          return;
        }
        document.title = fr.listing.docTitle(listing.title);
        setState({ kind: 'ok', listing });
        countViewOnce(id);
      })
      .catch((error: unknown) => {
        reportError(error, 'listing');
        setState(errorCode(error) === 'permission-denied' ? { kind: 'missing' } : { kind: 'error' });
      });
  };

  useEffect(load, [id]);

  if (state.kind === 'loading') {
    return (
      <div class="page">
        <Skeleton cards={2} />
      </div>
    );
  }
  if (state.kind === 'ok') return <ListingView l={state.listing} />;
  return (
    <div class="page">
      <h1 class="page__title">{fr.headings.listing}</h1>
      {state.kind === 'missing' ? (
        <EmptyState title={fr.listing.unavailableTitle} body={fr.listing.unavailableBody}>
          <a class="button button--primary" href="/">
            {fr.listing.backToFeed}
          </a>
        </EmptyState>
      ) : (
        <EmptyState title={fr.listing.loadError}>
          <button type="button" class="button button--primary" onClick={load}>
            {fr.retry}
          </button>
        </EmptyState>
      )}
    </div>
  );
}

mountPage(<ListingPage />);
