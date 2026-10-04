import { cityBySlug } from '../data/cities';
import { GENRES } from '../data/genres';
import { fr } from '../i18n/fr';
import { defaultFilters, filtersToSearch } from '../lib/public-listing';
import { CityPicker } from './CityPicker';
import { EmptyState } from './EmptyState';
import { Feed } from './Feed';
import { Icon } from './Icon';
import { PremiumBanner } from './PremiumBanner';

interface Props {
  heading: string;
  citySlug: string;
  onCity: (slug: string) => void;
}

/**
 * Home and /ville/{slug} (same feed, SPEC § 6 and § 12): Premium banner of every city at the very
 * top (owner's decision of 3 Oct 2026), then title, city, shortcuts and the feed of the city.
 */
export function CityFeedPage({ heading, citySlug, onCity }: Props) {
  const name = cityBySlug(citySlug)?.name ?? '';
  const all = defaultFilters(citySlug);
  return (
    <div class="page page--feed">
      <PremiumBanner />
      <div class="feed-head">
        <h1 class="page__title">{heading}</h1>
        <CityPicker value={citySlug} onChange={onCity} />
      </div>
      <nav class="chips chips--scroll" aria-label={fr.feed.shortcuts}>
        {GENRES.map((g) => (
          <a key={g} class="chip chip--link" href={`/recherche${filtersToSearch({ ...all, genres: [g] })}`}>
            {fr.genres[g]}
          </a>
        ))}
        <a class="chip chip--link" href={`/recherche${filtersToSearch(all)}`}>
          <Icon name="sliders" />
          {fr.feed.allFilters}
        </a>
      </nav>
      <Feed
        query={all}
        banner
        empty={
          <EmptyState title={fr.feed.emptyTitle(name)} body={fr.feed.emptyBody}>
            <a class="button button--primary" href="/publier">
              {fr.feed.emptyAction}
            </a>
          </EmptyState>
        }
      />
    </div>
  );
}
