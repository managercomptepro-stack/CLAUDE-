import type { ComponentChildren } from 'preact';
import { CITIES } from '../data/cities';
import { GENRES } from '../data/genres';
import { TEXT_MAX } from '../data/limits';
import { fr } from '../i18n/fr';
import type { FieldErrors, ProfileField, ProfileInput } from '../lib/profile-form';
import { AvatarPicker } from './AvatarPicker';
import { controlAttrs, Field } from './Field';

interface Props {
  values: ProfileInput;
  errors: FieldErrors<ProfileField>;
  onChange: (next: ProfileInput) => void;
  /** Extra fields placed just before the terms checkbox (e-mail and password at sign-up). */
  beforeTerms?: ComponentChildren;
}

/** Profile sheet of SPEC § 4, shared by the e-mail sign-up and the Google profile step. */
export function ProfileFields({ values, errors, onChange, beforeTerms }: Props) {
  const set = <K extends keyof ProfileInput>(key: K, value: ProfileInput[K]) =>
    onChange({ ...values, [key]: value });
  const t = fr.profileForm;
  return (
    <>
      <Field id="pseudo" label={t.pseudo} error={errors.pseudo} hint={t.pseudoHint}>
        <input
          {...controlAttrs('pseudo', errors.pseudo, t.pseudoHint)}
          type="text"
          autocomplete="username"
          autocapitalize="none"
          spellcheck={false}
          maxLength={TEXT_MAX.pseudo}
          value={values.pseudo}
          onInput={(e) => set('pseudo', e.currentTarget.value)}
        />
      </Field>
      <Field id="birthDate" label={t.birthDate} error={errors.birthDate} hint={t.birthHint}>
        <input
          {...controlAttrs('birthDate', errors.birthDate, t.birthHint)}
          type="date"
          autocomplete="bday"
          min="1900-01-01"
          value={values.birthDate}
          onInput={(e) => set('birthDate', e.currentTarget.value)}
        />
      </Field>
      <Field id="genre" label={t.genre} error={errors.genre}>
        <select
          {...controlAttrs('genre', errors.genre)}
          value={values.genre}
          onChange={(e) => set('genre', e.currentTarget.value)}
        >
          <option value="">{t.choose}</option>
          {GENRES.map((g) => (
            <option key={g} value={g}>
              {fr.genres[g]}
            </option>
          ))}
        </select>
      </Field>
      <CityField value={values.city} error={errors.city} onChange={(v) => set('city', v)} />
      <WhatsAppField value={values.whatsapp} error={errors.whatsapp} onChange={(v) => set('whatsapp', v)} />
      <AvatarPicker
        value={values.photoUrl}
        initial={values.pseudo}
        onChange={(url) => set('photoUrl', url)}
      />
      {errors.photoUrl && <p class="field__error">{errors.photoUrl}</p>}
      {beforeTerms}
      <div class="field">
        <label class="check">
          <input
            type="checkbox"
            name="terms"
            checked={values.terms}
            aria-invalid={errors.terms ? 'true' : undefined}
            aria-describedby={errors.terms ? 'terms-error' : undefined}
            onChange={(e) => set('terms', e.currentTarget.checked)}
          />
          <span>
            {t.termsBefore}
            <a href="/cgu" target="_blank" rel="noopener noreferrer">
              {t.termsLink}
            </a>
            {t.termsMiddle}
            <a href="/confidentialite" target="_blank" rel="noopener noreferrer">
              {t.privacyLink}
            </a>
            {t.termsAfter}
          </span>
        </label>
        {errors.terms && (
          <p class="field__error" id="terms-error">
            {errors.terms}
          </p>
        )}
      </div>
    </>
  );
}

export function CityField(props: {
  value: string;
  error?: string | undefined;
  onChange: (v: string) => void;
}) {
  return (
    <Field id="city" label={fr.profileForm.city} error={props.error}>
      <select
        {...controlAttrs('city', props.error)}
        value={props.value}
        onChange={(e) => props.onChange(e.currentTarget.value)}
      >
        <option value="">{fr.profileForm.choose}</option>
        {CITIES.map((c) => (
          <option key={c.slug} value={c.slug}>
            {c.name}
          </option>
        ))}
      </select>
    </Field>
  );
}

export function WhatsAppField(props: {
  value: string;
  error?: string | undefined;
  onChange: (v: string) => void;
}) {
  const hint = fr.profileForm.whatsappHint;
  return (
    <Field id="whatsapp" label={fr.profileForm.whatsapp} error={props.error} hint={hint}>
      <input
        {...controlAttrs('whatsapp', props.error, hint)}
        type="tel"
        inputMode="tel"
        autocomplete="tel-national"
        placeholder={fr.profileForm.whatsappPlaceholder}
        maxLength={20}
        value={props.value}
        onInput={(e) => props.onChange(e.currentTarget.value)}
      />
    </Field>
  );
}
