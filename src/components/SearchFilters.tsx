import { useEffect, useRef, useState } from 'preact/hooks';
import { GENRES, type Genre } from '../data/genres';
import { AGE_FILTER_MAX, AGE_FILTER_MIN } from '../data/limits';
import { fr } from '../i18n/fr';

/** Profile filter (SPEC § 6): the 7 profiles, several possible, as toggle chips (checkboxes). */
export function GenreChips({ value, onChange }: { value: Genre[]; onChange: (g: Genre[]) => void }) {
  const toggle = (g: Genre, on: boolean) =>
    onChange(GENRES.filter((x) => (x === g ? on : value.includes(x))));
  return (
    <fieldset class="field">
      <legend class="field__label">{fr.search.genres}</legend>
      <p class="field__hint">{fr.search.genresHint}</p>
      <div class="chips">
        {GENRES.map((g) => (
          <label key={g} class="chip">
            <input
              type="checkbox"
              class="chip__input"
              checked={value.includes(g)}
              onChange={(e) => toggle(g, e.currentTarget.checked)}
            />
            <span class="chip__label">{fr.genres[g]}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

const pct = (n: number) => ((n - AGE_FILTER_MIN) / (AGE_FILTER_MAX - AGE_FILTER_MIN)) * 100;

/**
 * Double age slider 18–70 (SPEC § 6): two native range inputs on one track, so each thumb works
 * with a finger and with the keyboard (arrows, Page up/down, Home/End) and is labelled. The value
 * follows the finger; the search runs when the thumb is released (`onCommit`).
 */
export function AgeRange({
  min,
  max,
  onCommit,
}: {
  min: number;
  max: number;
  onCommit: (min: number, max: number) => void;
}) {
  const [lo, setLo] = useState(min);
  const [hi, setHi] = useState(max);
  // Latest values: with the keyboard, `input` and `change` fire together, before a re-render.
  const latestRef = useRef({ lo: min, hi: max });
  useEffect(() => {
    latestRef.current = { lo: min, hi: max };
    setLo(min);
    setHi(max);
  }, [min, max]);

  /** Keeps the thumbs from crossing (the DOM value too, which Preact would not reset). */
  const move = (which: 'lo' | 'hi', el: HTMLInputElement) => {
    const v = Number(el.value);
    const next = which === 'lo' ? Math.min(v, latestRef.current.hi) : Math.max(v, latestRef.current.lo);
    if (next !== v) el.value = String(next);
    latestRef.current = { ...latestRef.current, [which]: next };
    if (which === 'lo') setLo(next);
    else setHi(next);
  };

  const commit = () => {
    const { lo: a, hi: b } = latestRef.current;
    if (a !== min || b !== max) onCommit(a, b);
  };

  return (
    <fieldset class="field">
      <legend class="field__label">{fr.search.age}</legend>
      <p class="age-range__value" aria-live="polite">
        {fr.search.ageValue(lo, hi)}
      </p>
      <div class="age-range" style={{ '--from': `${pct(lo)}%`, '--to': `${pct(hi)}%` }}>
        <input
          type="range"
          // Both thumbs on the same age: the one that can still move on that side stays on top
          // (at 70 only the minimum can move, at 18 only the maximum).
          class={`age-range__input${lo === hi && lo > (AGE_FILTER_MIN + AGE_FILTER_MAX) / 2 ? ' age-range__input--top' : ''}`}
          min={AGE_FILTER_MIN}
          max={AGE_FILTER_MAX}
          step={1}
          value={lo}
          aria-label={fr.search.ageMin}
          aria-valuetext={fr.search.ageUnit(lo)}
          onInput={(e) => move('lo', e.currentTarget)}
          onChange={commit}
        />
        <input
          type="range"
          class="age-range__input"
          min={AGE_FILTER_MIN}
          max={AGE_FILTER_MAX}
          step={1}
          value={hi}
          aria-label={fr.search.ageMax}
          aria-valuetext={fr.search.ageUnit(hi)}
          onInput={(e) => move('hi', e.currentTarget)}
          onChange={commit}
        />
      </div>
    </fieldset>
  );
}
