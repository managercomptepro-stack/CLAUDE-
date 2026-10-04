import { useEffect, useState } from 'preact/hooks';
import { EmptyState } from '../components/EmptyState';
import { VerifiedBadge } from '../components/Icon';
import { ListingCard } from '../components/ListingCard';
import { Skeleton } from '../components/Skeleton';
import { fr } from '../i18n/fr';
import { avatarDisplayUrl } from '../lib/cloudinary';
import { reportError } from '../lib/errors';
import { loadMember, type PublicMember } from '../lib/feed';
import { memberSince } from '../lib/format';
import { compareFeed, type PublicListing } from '../lib/public-listing';
import { mountPage } from '../shell/mount';

type State =
  | { kind: 'loading' }
  | { kind: 'missing' }
  | { kind: 'error' }
  | { kind: 'ok'; member: PublicMember; listings: PublicListing[] };

/** /membre?u=… (SPEC § 12): pseudo, photo, seniority, badge, and their shown listings. */
function MemberPage() {
  const uid = new URLSearchParams(location.search).get('u') ?? '';
  const [state, setState] = useState<State>({ kind: 'loading' });

  const load = () => {
    setState({ kind: 'loading' });
    if (!uid) {
      setState({ kind: 'missing' });
      return;
    }
    loadMember(uid)
      .then((found) => {
        if (!found) {
          setState({ kind: 'missing' });
          return;
        }
        document.title = fr.member.title(found.member.pseudo);
        setState({
          kind: 'ok',
          member: found.member,
          listings: [...found.listings].sort((a, b) => compareFeed(a, b)),
        });
      })
      .catch((error: unknown) => {
        reportError(error, 'member');
        setState({ kind: 'error' });
      });
  };

  useEffect(load, [uid]);

  if (state.kind === 'loading') {
    return (
      <div class="page">
        <Skeleton cards={2} />
      </div>
    );
  }
  if (state.kind !== 'ok') {
    return (
      <div class="page">
        <h1 class="page__title">{fr.headings.member}</h1>
        {state.kind === 'missing' ? (
          <EmptyState title={fr.member.unavailableTitle} body={fr.member.unavailableBody}>
            <a class="button button--primary" href="/">
              {fr.listing.backToFeed}
            </a>
          </EmptyState>
        ) : (
          <EmptyState title={fr.feed.error}>
            <button type="button" class="button button--primary" onClick={load}>
              {fr.retry}
            </button>
          </EmptyState>
        )}
      </div>
    );
  }

  const { member: m, listings } = state;
  const avatar = avatarDisplayUrl(m.photoUrl);
  return (
    <div class="page page--feed">
      <header class="profile-head">
        {avatar ? (
          <img class="avatar avatar--lg" src={avatar} width={80} height={80} alt="" />
        ) : (
          <span class="avatar avatar--lg avatar--empty" aria-hidden="true">
            {m.pseudo.charAt(0).toUpperCase()}
          </span>
        )}
        <div>
          <h1 class="profile-head__name">
            {m.pseudo} {m.verified && <VerifiedBadge />}
          </h1>
          <p class="profile-head__meta">{memberSince(m.memberSince)}</p>
        </div>
      </header>
      <h2 class="section-title">{fr.member.listings}</h2>
      {listings.length ? (
        <ul class="feed__grid">
          {listings.map((l, i) => (
            <ListingCard key={l.id} listing={l} eager={i < 2} />
          ))}
        </ul>
      ) : (
        <p class="feed__status">{fr.member.none}</p>
      )}
    </div>
  );
}

mountPage(<MemberPage />);
