import { useEffect, useState } from 'preact/hooks';
import { AuthGate, type Session } from '../components/AuthGate';
import { EmptyState } from '../components/EmptyState';
import { controlAttrs, Field } from '../components/Field';
import { PhotoUploader } from '../components/PhotoUploader';
import { CityField } from '../components/ProfileFields';
import { Skeleton } from '../components/Skeleton';
import { GENRES } from '../data/genres';
import { TEXT_MAX } from '../data/limits';
import { fr } from '../i18n/fr';
import { AppError, errorCode, reportError } from '../lib/errors';
import { formatWhatsApp } from '../lib/format';
import {
  createListing,
  loadListingCap,
  loadOwnListing,
  loadOwnListings,
  updateListing,
} from '../lib/listing';
import { validateListing, type ListingField, type ListingInput, type ListingText } from '../lib/listing-form';
import type { FieldErrors } from '../lib/profile-form';
import { ACCOUNT_PATH } from '../lib/navigation';
import { mountPage } from '../shell/mount';

type Load =
  | { kind: 'loading' }
  | { kind: 'form'; editId: string | null; initial: ListingInput }
  | { kind: 'blocked'; title: string; body: string }
  | { kind: 'error'; message: string };

function PublishPage({ session }: { session: Session }) {
  const { user, account } = session;
  const editId = new URLSearchParams(location.search).get('id');
  const [load, setLoad] = useState<Load>({ kind: 'loading' });

  useEffect(() => {
    void (async () => {
      try {
        if (account.user.publishBanned) throw new AppError('nioxxer/publish-banned');
        if (editId) {
          const found = await loadOwnListing(user.uid, editId);
          if (!found) {
            setLoad({ kind: 'blocked', title: fr.listingForm.editHeading, body: fr.listingForm.notFound });
            return;
          }
          if (found.listing.status !== 'active') {
            setLoad({ kind: 'blocked', title: fr.listingForm.editHeading, body: fr.listingForm.notEditable });
            return;
          }
          const l = found.listing;
          setLoad({
            kind: 'form',
            editId,
            initial: {
              genre: l.genre,
              citySlug: l.citySlug,
              district: l.district,
              title: l.title,
              description: l.description,
              offer: l.offer,
              photos: l.photos,
              whatsapp: found.whatsapp ? formatWhatsApp(found.whatsapp) : '',
              contactMode: l.contactMode,
            },
          });
          return;
        }
        const [cap, own] = await Promise.all([loadListingCap(user.uid), loadOwnListings(user.uid)]);
        if (own.length >= cap) {
          setLoad({ kind: 'blocked', title: fr.listingForm.limitTitle, body: fr.errors.listingLimit });
          return;
        }
        setLoad({
          kind: 'form',
          editId: null,
          initial: {
            genre: account.user.genre,
            citySlug: account.user.city,
            district: '',
            title: '',
            description: '',
            offer: '',
            photos: [],
            whatsapp: account.user.whatsapp ? formatWhatsApp(account.user.whatsapp) : '',
            contactMode: 'message',
          },
        });
      } catch (error) {
        if (errorCode(error) === 'nioxxer/publish-banned') {
          setLoad({ kind: 'blocked', title: fr.headings.publish, body: fr.errors.publishBanned });
        } else setLoad({ kind: 'error', message: reportError(error, 'publish-load') });
      }
    })();
  }, [user.uid, editId, account]);

  if (load.kind === 'loading') {
    return (
      <div class="page">
        <Skeleton cards={3} />
      </div>
    );
  }
  if (load.kind === 'blocked' || load.kind === 'error') {
    const title = load.kind === 'blocked' ? load.title : fr.headings.publish;
    return (
      <div class="page">
        <h1 class="page__title">{title}</h1>
        <EmptyState title={load.kind === 'blocked' ? load.body : load.message}>
          <a class="button button--primary" href={ACCOUNT_PATH}>
            {fr.listingForm.toMyListings}
          </a>
        </EmptyState>
      </div>
    );
  }
  return <ListingForm uid={user.uid} editId={load.editId} initial={load.initial} />;
}

function ListingForm(props: { uid: string; editId: string | null; initial: ListingInput }) {
  const [values, setValues] = useState<ListingInput>(props.initial);
  const [photos, setPhotos] = useState<string[]>(props.initial.photos);
  const [errors, setErrors] = useState<FieldErrors<ListingField>>({});
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const t = fr.listingForm;
  /** Editing a field clears its error message (it is checked again on submit). */
  const clearError = (key: ListingField) => setErrors((e) => (key in e ? { ...e, [key]: undefined } : e));
  const set = <K extends keyof ListingInput>(key: K, value: ListingInput[K]) => {
    setValues((v) => ({ ...v, [key]: value }));
    clearError(key);
  };
  const updatePhotos = (update: (prev: string[]) => string[]) => {
    setPhotos(update);
    clearError('photos');
  };

  async function submit(e: Event) {
    e.preventDefault();
    if (busy) return;
    setFormError('');
    const checked = validateListing({ ...values, photos });
    setErrors(checked.ok ? {} : checked.errors);
    if (!checked.ok) {
      document.querySelector('[aria-invalid="true"], .field__error')?.scrollIntoView({ block: 'center' });
      return;
    }
    setBusy(true);
    try {
      if (props.editId) await updateListing(props.editId, checked.value);
      else await createListing(props.uid, checked.value);
      setDone(true);
      window.scrollTo(0, 0);
    } catch (error) {
      setFormError(reportError(error, 'publish'));
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div class="page">
        <h1 class="page__title">{props.editId ? t.savedTitle : t.publishedTitle}</h1>
        <EmptyState title={props.editId ? t.savedBody : t.publishedBody}>
          <div class="stack">
            <a class="button button--primary" href={ACCOUNT_PATH}>
              {t.toMyListings}
            </a>
            {!props.editId && (
              <a class="button button--secondary" href="/publier">
                {t.another}
              </a>
            )}
          </div>
        </EmptyState>
      </div>
    );
  }

  const text = (field: ListingText, label: string, hint?: string, multiline = false) => {
    const value = values[field];
    const attrs = controlAttrs(field, errors[field], hint);
    return (
      <Field
        id={field}
        label={label}
        error={errors[field]}
        hint={hint}
        counter={t.counter(value.length, TEXT_MAX[field])}
      >
        {multiline ? (
          <textarea
            {...attrs}
            maxLength={TEXT_MAX[field]}
            value={value}
            onInput={(e) => set(field, e.currentTarget.value)}
          />
        ) : (
          <input
            {...attrs}
            type="text"
            maxLength={TEXT_MAX[field]}
            value={value}
            onInput={(e) => set(field, e.currentTarget.value)}
          />
        )}
      </Field>
    );
  };

  return (
    <div class="page">
      <h1 class="page__title">{props.editId ? t.editHeading : fr.headings.publish}</h1>
      <p class="lead">
        {t.rulesIntro}{' '}
        <a href="/regles" target="_blank" rel="noopener noreferrer">
          {t.rules}
        </a>
      </p>
      <form class="form" noValidate onSubmit={submit}>
        <PhotoUploader photos={photos} setPhotos={updatePhotos} error={errors.photos} />
        {text('title', t.title)}
        {text('description', t.description, undefined, true)}
        {text('offer', t.offer, t.offerHint, true)}
        <Field id="genre" label={t.genre} error={errors.genre}>
          <select
            {...controlAttrs('genre', errors.genre)}
            value={values.genre}
            onChange={(e) => set('genre', e.currentTarget.value)}
          >
            <option value="">{fr.profileForm.choose}</option>
            {GENRES.map((g) => (
              <option key={g} value={g}>
                {fr.genres[g]}
              </option>
            ))}
          </select>
        </Field>
        <CityField value={values.citySlug} error={errors.citySlug} onChange={(v) => set('citySlug', v)} />
        {text('district', t.district, t.districtHint)}
        <Field id="whatsapp" label={t.whatsapp} error={errors.whatsapp} hint={t.whatsappHint}>
          <input
            {...controlAttrs('whatsapp', errors.whatsapp, t.whatsappHint)}
            type="tel"
            inputMode="tel"
            autocomplete="tel-national"
            placeholder={fr.profileForm.whatsappPlaceholder}
            maxLength={20}
            value={values.whatsapp}
            onInput={(e) => set('whatsapp', e.currentTarget.value)}
          />
        </Field>
        <fieldset class="field">
          <legend class="field__label">{t.contactMode}</legend>
          <div class="choice">
            {(
              [
                ['message', t.contactMessage],
                ['call_message', t.contactCall],
              ] as const
            ).map(([mode, label]) => (
              <label key={mode}>
                <input
                  type="radio"
                  name="contactMode"
                  value={mode}
                  checked={values.contactMode === mode}
                  onChange={() => set('contactMode', mode)}
                />
                {label}
              </label>
            ))}
          </div>
          {errors.contactMode && <p class="field__error">{errors.contactMode}</p>}
        </fieldset>
        {formError && (
          <p class="form-error" role="alert">
            {formError}
          </p>
        )}
        <button type="submit" class="button button--primary button--block" disabled={busy}>
          {busy ? fr.login.working : props.editId ? t.submitEdit : t.submitCreate}
        </button>
      </form>
    </div>
  );
}

mountPage(<AuthGate requirement="verified">{(session) => <PublishPage session={session} />}</AuthGate>);
