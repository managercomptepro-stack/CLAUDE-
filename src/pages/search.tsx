import { useState } from 'preact/hooks';
import { CityPicker } from '../components/CityPicker';
import { EmptyState } from '../components/EmptyState';
import { Feed } from '../components/Feed';
import { AgeRange, GenreChips } from '../components/SearchFilters';
import { cityBySlug } from '../data/cities';
import { fr } from '../i18n/fr';
import { rememberedCity } from '../lib/city-memory';
import { defaultFilters, filtersFromSearch, filtersToSearch, type FeedFilters } from '../lib/public-listing';
import { mountPage } from '../shell/mount';

/**
 * /recherche (SPEC § 6): profile (several), city, age 18–70; results in the feed order. The
 * filters live in the address, so a search can be shared and survives a reload.
 */
function SearchPage() {
  const [filters, setFilters] = useState<FeedFilters>(() =>
    filtersFromSearch(new URLSearchParams(location.search), rememberedCity()),
  );

  const update = (patch: Partial<FeedFilters>) => {
    const next = { ...filters, ...patch };
    history.replaceState(null, '', `/recherche${filtersToSearch(next)}`);
    setFilters(next);
  };

  const isDefault = filtersToSearch(filters) === filtersToSearch(defaultFilters(filters.citySlug));

  return (
    <div class="page page--feed">
      <h1 class="page__title">{fr.headings.search}</h1>
      <section class="card filters" aria-label={fr.headings.search}>
        <div class="field">
          <span class="field__label" id="search-city">
            {fr.search.city}
          </span>
          <CityPicker value={filters.citySlug} onChange={(citySlug) => update({ citySlug })} />
        </div>
        <GenreChips value={filters.genres} onChange={(genres) => update({ genres })} />
        <AgeRange
          min={filters.ageMin}
          max={filters.ageMax}
          onCommit={(ageMin, ageMax) => update({ ageMin, ageMax })}
        />
        {!isDefault && (
          <button type="button" class="link-button" onClick={() => update(defaultFilters(filters.citySlug))}>
            {fr.search.reset}
          </button>
        )}
      </section>
      <h2 class="section-title">{fr.search.results}</h2>
      <Feed
        query={filters}
        wide
        empty={
          <EmptyState
            title={
              isDefault ? fr.feed.emptyTitle(cityBySlug(filters.citySlug)?.name ?? '') : fr.search.emptyTitle
            }
            body={isDefault ? fr.feed.emptyBody : fr.search.emptyBody}
          >
            {isDefault && (
              <a class="button button--primary" href="/publier">
                {fr.feed.emptyAction}
              </a>
            )}
          </EmptyState>
        }
      />
    </div>
  );
}

mountPage(<SearchPage />);
