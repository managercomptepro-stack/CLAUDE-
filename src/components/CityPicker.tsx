import { useEffect, useRef, useState } from 'preact/hooks';
import { CITIES, cityBySlug, nearestCity } from '../data/cities';
import { fr } from '../i18n/fr';
import { reportError } from '../lib/errors';
import { loadCityCounts } from '../lib/feed';
import { slugify } from '../lib/format';
import { Icon } from './Icon';

interface Props {
  value: string;
  onChange: (slug: string) => void;
}

const GEO_TIMEOUT_MS = 10_000;

/**
 * City selector (SPEC § 6): a button showing the city, opening a list of the 28 cities with a
 * search field, listing counts (counted on opening, cached 10 min) and « Autour de moi ».
 */
export function CityPicker({ value, onChange }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState('');
  const [counts, setCounts] = useState<Record<string, number> | null>(null);
  const [locating, setLocating] = useState(false);
  const [geoError, setGeoError] = useState(false);
  const name = cityBySlug(value)?.name ?? '';

  useEffect(() => {
    if (!open || counts) return;
    loadCityCounts()
      .then(setCounts)
      .catch((error: unknown) => reportError(error, 'city-counts'));
  }, [open, counts]);

  function show() {
    setFilter('');
    setGeoError(false);
    setOpen(true);
    dialog.current?.showModal();
  }

  function close() {
    dialog.current?.close();
  }

  function choose(slug: string) {
    close();
    if (slug !== value) onChange(slug);
  }

  function locate() {
    if (!('geolocation' in navigator)) {
      setGeoError(true);
      return;
    }
    setLocating(true);
    setGeoError(false);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        choose(nearestCity(pos.coords.latitude, pos.coords.longitude).slug);
      },
      () => {
        setLocating(false);
        setGeoError(true);
      },
      { timeout: GEO_TIMEOUT_MS, maximumAge: 600_000 },
    );
  }

  const needle = slugify(filter);
  const shown = CITIES.filter((c) => !needle || c.slug.includes(needle));

  return (
    <>
      <span class="city-pick">
        <span class="city-pick__label" aria-hidden="true">
          {fr.cityPicker.label}
        </span>
        <button type="button" class="city-button" aria-label={fr.feed.cityButton(name)} onClick={show}>
          <Icon name="pin" />
          <span class="city-button__name">{name}</span>
          <Icon name="chevronDown" />
        </button>
      </span>
      <dialog
        ref={dialog}
        class="sheet"
        aria-labelledby="city-picker-title"
        onClose={() => setOpen(false)}
        onClick={(e) => {
          // A tap on the dimmed backdrop (outside the sheet) closes it.
          if (e.target === dialog.current) close();
        }}
      >
        <div class="sheet__inner">
          <div class="sheet__head">
            <h2 id="city-picker-title" class="sheet__title">
              {fr.cityPicker.title}
            </h2>
            <button type="button" class="icon-button" aria-label={fr.cityPicker.close} onClick={close}>
              <Icon name="close" />
            </button>
          </div>
          <label class="search-field">
            <Icon name="search" />
            <span class="visually-hidden">{fr.cityPicker.search}</span>
            <input
              type="search"
              class="search-field__input"
              placeholder={fr.cityPicker.search}
              value={filter}
              onInput={(e) => setFilter(e.currentTarget.value)}
              autocomplete="off"
            />
          </label>
          <button
            type="button"
            class="button button--secondary button--block"
            onClick={locate}
            disabled={locating}
          >
            <Icon name="locate" />
            {locating ? fr.cityPicker.nearBusy : fr.cityPicker.near}
          </button>
          {geoError && (
            <p class="field__error" role="alert">
              {fr.cityPicker.nearFailed}
            </p>
          )}
          <ul class="city-list">
            {shown.map((c) => (
              <li key={c.slug}>
                <button
                  type="button"
                  class="city-list__item"
                  aria-current={c.slug === value ? 'true' : undefined}
                  onClick={() => choose(c.slug)}
                >
                  <span>{c.name}</span>
                  {counts && <span class="city-list__count">{fr.cityPicker.count(counts[c.slug] ?? 0)}</span>}
                </button>
              </li>
            ))}
          </ul>
          {!shown.length && <p class="sheet__empty">{fr.cityPicker.noMatch}</p>}
        </div>
      </dialog>
    </>
  );
}
