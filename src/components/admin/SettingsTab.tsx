/** « Réglages » (super-admin): prices, duration, Mobile Money payees, caps — `settings/public`. */
import { useState } from 'preact/hooks';
import { DEFAULT_SETTINGS, type PublicSettings } from '../../data/settings';
import { fr } from '../../i18n/fr';
import {
  settingsToInput,
  validateSettings,
  type SettingsField,
  type SettingsInput,
} from '../../lib/admin-logic';
import { loadSettingsDoc, saveSettings } from '../../lib/admin';
import { reportError } from '../../lib/errors';
import type { FieldErrors } from '../../lib/profile-form';
import { controlAttrs, Field } from '../Field';
import { showToast } from '../Toast';
import { Loaded, useLoad } from './common';

function SettingsForm({ actor, saved }: { actor: string; saved: PublicSettings | null }) {
  const t = fr.admin.settings;
  const [current, setCurrent] = useState(saved);
  const [input, setInput] = useState<SettingsInput>(settingsToInput(saved ?? DEFAULT_SETTINGS));
  const [errors, setErrors] = useState<FieldErrors<SettingsField>>({});
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState('');

  const field = (name: SettingsField, label: string, mode: 'numeric' | 'tel' | 'text', hint?: string) => (
    <Field id={`set-${name}`} label={label} error={errors[name]} hint={hint}>
      <input
        {...controlAttrs(`set-${name}`, errors[name], hint)}
        type={mode === 'tel' ? 'tel' : 'text'}
        inputMode={mode === 'text' ? undefined : mode}
        autoComplete="off"
        value={input[name]}
        onInput={(e) => setInput({ ...input, [name]: e.currentTarget.value })}
      />
    </Field>
  );

  async function submit(e: Event) {
    e.preventDefault();
    if (busy) return;
    const checked = validateSettings(input);
    setErrors(checked.ok ? {} : checked.errors);
    if (!checked.ok) return;
    if (current && JSON.stringify(checked.value) === JSON.stringify(current)) {
      showToast(t.unchanged);
      return;
    }
    setBusy(true);
    setFormError('');
    try {
      await saveSettings(actor, current, checked.value);
      setCurrent(checked.value);
      setInput(settingsToInput(checked.value));
      showToast(t.saved, 'success');
    } catch (err) {
      setFormError(reportError(err, 'admin-settings'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form class="stack" noValidate onSubmit={(e) => void submit(e)}>
      {!current && <p class="notice">{t.missing}</p>}
      {/* Each formula on its own (owner's request of 3 Oct 2026): price and number of days. */}
      <fieldset class="card adm-fieldset">
        <legend class="card__title">{t.premiumTitle}</legend>
        {field('premium', t.price, 'numeric')}
        {field('premiumDays', t.days, 'numeric')}
      </fieldset>
      <fieldset class="card adm-fieldset">
        <legend class="card__title">{t.sponsoredTitle}</legend>
        {field('sponsored', t.price, 'numeric')}
        {field('sponsoredDays', t.days, 'numeric')}
      </fieldset>
      <fieldset class="card adm-fieldset">
        <legend class="card__title">{t.payment}</legend>
        <p class="field__hint">{t.paymentHint}</p>
        <p class="adm-subtitle">{t.mtn}</p>
        {field('mtnNumber', t.number, 'tel')}
        {field('mtnName', t.name, 'text')}
        <p class="adm-subtitle">{t.orange}</p>
        {field('orangeNumber', t.number, 'tel')}
        {field('orangeName', t.name, 'text')}
      </fieldset>
      <fieldset class="card adm-fieldset">
        <legend class="card__title">{t.listings}</legend>
        {field('maxActiveListings', t.maxActiveListings, 'numeric')}
        {field('reportsHideThreshold', t.reportsHideThreshold, 'numeric')}
        {field('supportWhatsApp', t.support, 'tel')}
        {field('termsVersion', t.termsVersion, 'text', t.termsVersionHint)}
      </fieldset>
      {formError && (
        <p class="form-error" role="alert">
          {formError}
        </p>
      )}
      <button type="submit" class="button button--primary button--block" disabled={busy}>
        {busy ? t.saving : t.save}
      </button>
    </form>
  );
}

export function SettingsTab({ actor }: { actor: string }) {
  const { state, reload } = useLoad(loadSettingsDoc);
  return (
    <Loaded state={state} reload={reload}>
      {(saved) => <SettingsForm actor={actor} saved={saved} />}
    </Loaded>
  );
}
