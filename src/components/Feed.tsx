import type { ComponentChildren } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { fr } from '../i18n/fr';
import { reportError } from '../lib/errors';
import { cityBySlug } from '../data/cities';
import { loadCityCount, loadFeedPage, type FeedCursor, type FeedQuery } from '../lib/feed';
import { readFeedCache, writeFeedCache } from '../lib/feed-cache';
import type { PublicListing } from '../lib/public-listing';
import { ListingCard } from './ListingCard';

interface Props {
  query: FeedQuery;
  /** Shown when the very first page is empty (honest empty state, SPEC § 6). */
  empty: ComponentChildren;
  /** Home and city pages: « Annonces récentes · N à … » above the cards (SPEC § 6). */
  banner?: boolean;
  /** Search results: one wide card per line (owner's request of 3 Oct 2026). */
  wide?: boolean;
}

interface State {
  items: PublicListing[];
  cursor: FeedCursor | null;
  done: boolean;
  loading: boolean;
  error: string | null;
}

/** Before the first answer: the last first page seen in this browser, if any (option B). */
function startFor(key: string): State {
  const cached = readFeedCache(key) ?? [];
  return {
    items: cached,
    cursor: null,
    done: false,
    loading: true,
    error: null,
  };
}

function queryKey(q: FeedQuery): string {
  return `${q.citySlug}|${q.genres.join(',')}|${q.ageMin}-${q.ageMax}`;
}

/**
 * Endless feed in packs of 20 (SPEC § 6): the next pack loads when the end of the list comes
 * into view (IntersectionObserver), or with the « Afficher plus » button (keyboard, old browsers).
 */
export function Feed({ query, empty, banner = false, wide = false }: Props) {
  const key = queryKey(query);
  const [state, setState] = useState<State>(() => startFor(key));
  /** Listings of the city (home and city pages only), counted once per city. */
  const [total, setTotal] = useState<{ city: string; n: number } | null>(null);
  const sentinel = useRef<HTMLDivElement>(null);
  /** Key of the feed currently shown: a late answer for an older query is dropped. */
  const current = useRef(key);
  const busy = useRef(false);

  async function load(cursor: FeedCursor | null, forKey: string) {
    busy.current = true;
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const page = await loadFeedPage(query, cursor);
      if (current.current !== forKey) return;
      // First page: replaces what was shown (cached copy); next pages: appended without duplicates.
      if (!cursor) writeFeedCache(forKey, page.items);
      setState((s) => {
        const shown = cursor ? s.items : [];
        const seen = new Set(shown.map((l) => l.id));
        return {
          items: [...shown, ...page.items.filter((l) => !seen.has(l.id))],
          cursor: page.cursor,
          done: page.done,
          loading: false,
          error: null,
        };
      });
    } catch (error) {
      if (current.current !== forKey) return;
      setState((s) => ({ ...s, loading: false, error: reportError(error, 'feed') }));
    } finally {
      if (current.current === forKey) busy.current = false;
    }
  }

  useEffect(() => {
    current.current = key;
    busy.current = false;
    setState(startFor(key));
    void load(null, key);
    // `query` is fully described by `key`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  useEffect(() => {
    if (!banner) return;
    let cancelled = false;
    loadCityCount(query.citySlug)
      .then((n) => !cancelled && setTotal({ city: query.citySlug, n }))
      // The number is a convenience: without it the heading simply shows no count.
      .catch((e: unknown) => reportError(e, 'city-count'));
    return () => {
      cancelled = true;
    };
  }, [banner, query.citySlug]);

  const more = () => {
    if (busy.current || state.done || state.error) return;
    void load(state.cursor, key);
  };

  useEffect(() => {
    const el = sentinel.current;
    if (!el || state.done || state.loading || state.error || !('IntersectionObserver' in window)) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) more();
      },
      { rootMargin: '600px 0px' },
    );
    io.observe(el);
    return () => io.disconnect();
  });

  const { items, loading, done, error } = state;
  // Everything loaded: the exact number shown; before that, the Firestore count of the city.
  const count = done && !error ? items.length : total?.city === query.citySlug ? total.n : null;
  if (!loading && !error && done && items.length === 0) return <>{empty}</>;

  const grid = `feed__grid${wide ? ' feed__grid--wide' : ''}`;
  const skeleton = (n: number) =>
    Array.from({ length: n }, (_, i) => (
      // Same shape as the cards that replace them (wide in search results): nothing moves.
      <li key={`s${i}`} class={`lcard lcard--skeleton${wide ? ' lcard--wide' : ''}`} aria-hidden="true">
        <div class="skeleton lcard__media" />
      </li>
    ));
  return (
    <section class="feed" aria-label={fr.feed.resultsLabel} aria-busy={loading}>
      {/* Always rendered (count filled in later): the cards below never move (CLS). */}
      {banner && (
        <div class="headline">
          <h2 class="headline__title">{fr.feed.recent}</h2>
          <span class="headline__tally">
            {count !== null && fr.feed.tally(count, cityBySlug(query.citySlug)?.name ?? '')}
          </span>
        </div>
      )}
      <ul class={grid}>
        {items.map((l, i) => (
          <ListingCard key={l.id} listing={l} eager={i < 2} wide={wide} />
        ))}
        {/* First page: placeholders replaced by the cards in one render; next pages: two more. */}
        {loading && !items.length && skeleton(4)}
        {loading && state.cursor && skeleton(2)}
      </ul>
      {loading && <span class="visually-hidden">{fr.loading}</span>}
      {error && (
        <div class="feed__status" role="alert">
          <p>{fr.feed.error}</p>
          <button type="button" class="button button--secondary" onClick={() => void load(state.cursor, key)}>
            {fr.retry}
          </button>
        </div>
      )}
      <div ref={sentinel} class="feed__sentinel" />
      {!loading && !error && !done && (
        <button type="button" class="button button--secondary button--block" onClick={more}>
          {fr.feed.loadMore}
        </button>
      )}
      {done && items.length > 0 && <p class="feed__status">{fr.feed.end}</p>}
    </section>
  );
}
