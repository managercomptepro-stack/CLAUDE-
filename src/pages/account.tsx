import { useState } from 'preact/hooks';
import { AuthGate, type Session } from '../components/AuthGate';
import { AvatarPicker } from '../components/AvatarPicker';
import { BadgeRequest } from '../components/BadgeRequest';
import { MyListings } from '../components/MyListings';
import { Notifications } from '../components/Notifications';
import { controlAttrs, Field } from '../components/Field';
import { CityField, WhatsAppField } from '../components/ProfileFields';
import { showToast } from '../components/Toast';
import { cityBySlug } from '../data/cities';
import { isGenre } from '../data/genres';
import { logOut, reauthenticate, usesPassword } from '../firebase/auth';
import { fr } from '../i18n/fr';
// Already loaded by AuthGate when this page renders: these imports resolve from cache.
const accountApi = () => import('../lib/account');
import { avatarDisplayUrl } from '../lib/cloudinary';
import { reportError } from '../lib/errors';
import { ageFrom, formatWhatsApp, memberSince } from '../lib/format';
import { validateContact, type FieldErrors } from '../lib/profile-form';
import type { OwnListing } from '../lib/listing-status';
import { VERIFY_EMAIL_PATH } from '../lib/navigation';
import { mountPage } from '../shell/mount';

function AccountPage({ session }: { session: Session }) {
  const { user, account } = session;
  const [photoUrl, setPhotoUrl] = useState(account.profile.photoUrl);
  const [listings, setListings] = useState<OwnListing[] | null>(null);

  const { profile } = account;
  const genre = isGenre(account.user.genre) ? fr.genres[account.user.genre] : '';
  return (
    <div class="page">
      <h1 class="page__title">{fr.headings.account}</h1>
      <div class="stack stack--tight">
        {!user.emailVerified && (
          <p class="notice" role="status">
            {fr.account.unverified} <a href={VERIFY_EMAIL_PATH}>{fr.account.unverifiedLink}</a>
          </p>
        )}
        {/* One profile block (owner's request of 3 Oct 2026): photo once, identity, status, photo buttons. */}
        <section class="card card--profile" aria-labelledby="profile-name">
          <div class="profile-head">
            <Avatar url={photoUrl} pseudo={profile.pseudo} />
            <div class="profile-head__text">
              <p class="profile-head__name" id="profile-name">
                {profile.pseudo}
              </p>
              <p class="profile-head__meta">
                {fr.account.age(ageFrom(account.user.birthDate))} · {genre} ·{' '}
                {memberSince(profile.memberSince)}
              </p>
              <p class="profile-head__meta">{user.email}</p>
            </div>
          </div>
          <AvatarPicker
            bare
            value={photoUrl}
            initial={profile.pseudo}
            onChange={async (url) => {
              const { updateProfilePhoto } = await accountApi();
              await updateProfilePhoto(user.uid, url);
              setPhotoUrl(url);
              // The listings carry a copy of the profile photo (best effort).
              const { syncProfilePhoto } = await import('../lib/listing');
              await syncProfilePhoto(user.uid, url).catch((e: unknown) => reportError(e, 'photo-sync'));
              showToast(url ? fr.avatar.saved : fr.avatar.removed, 'success');
            }}
          />
          <BadgeRequest uid={user.uid} verified={profile.verified} emailVerified={user.emailVerified} />
          <p class="field__hint">{fr.account.fixedNote}</p>
        </section>
        <Notifications uid={user.uid} listings={listings} preview={3} />
        <MyListings uid={user.uid} onLoaded={setListings} />
        <ContactForm session={session} />
        <button
          type="button"
          class="button button--secondary button--block"
          onClick={async () => {
            try {
              await logOut();
              location.assign('/');
            } catch (error) {
              showToast(reportError(error, 'logout'), 'error');
            }
          }}
        >
          {fr.account.logout}
        </button>
        <DeleteAccount session={session} />
      </div>
    </div>
  );
}

function Avatar({ url, pseudo }: { url: string | null; pseudo: string }) {
  const src = avatarDisplayUrl(url);
  return src ? (
    <img class="avatar" src={src} width="64" height="64" alt={fr.avatar.alt(pseudo)} />
  ) : (
    <span class="avatar avatar--empty" aria-hidden="true">
      {pseudo.charAt(0).toUpperCase()}
    </span>
  );
}

function ContactForm({ session }: { session: Session }) {
  const { user, account } = session;
  const [city, setCity] = useState(cityBySlug(account.user.city) ? account.user.city : '');
  const [whatsapp, setWhatsapp] = useState(
    account.user.whatsapp ? formatWhatsApp(account.user.whatsapp) : '',
  );
  const [errors, setErrors] = useState<FieldErrors<'city' | 'whatsapp'>>({});
  const [busy, setBusy] = useState(false);

  async function submit(e: Event) {
    e.preventDefault();
    if (busy) return;
    const checked = validateContact({ city, whatsapp });
    setErrors(checked.ok ? {} : checked.errors);
    if (!checked.ok) return;
    setBusy(true);
    try {
      const { updateContact } = await accountApi();
      await updateContact(user.uid, checked.value);
      setWhatsapp(formatWhatsApp(checked.value.whatsapp));
      showToast(fr.account.saved, 'success');
    } catch (error) {
      showToast(reportError(error, 'contact'), 'error');
    }
    setBusy(false);
  }

  return (
    <section class="card" aria-labelledby="contact-title">
      <h2 class="card__title" id="contact-title">
        {fr.account.contactTitle}
      </h2>
      <form class="form" noValidate onSubmit={submit}>
        <CityField value={city} error={errors.city} onChange={setCity} />
        <WhatsAppField value={whatsapp} error={errors.whatsapp} onChange={setWhatsapp} />
        <button type="submit" class="button button--primary button--block" disabled={busy}>
          {busy ? fr.login.working : fr.account.save}
        </button>
      </form>
    </section>
  );
}

/**
 * Deletion REQUEST (owner's decision of 3 Oct 2026): identity confirmed, then the account is frozen
 * and its listings leave the site; the page reloads on the « Suppression demandée » screen.
 */
function DeleteAccount({ session }: { session: Session }) {
  const { user } = session;
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const withPassword = usesPassword(user);

  async function confirm(e: Event) {
    e.preventDefault();
    if (busy) return;
    if (withPassword && !password) {
      setError(fr.errors.missingPassword);
      return;
    }
    setError('');
    setBusy(true);
    try {
      await reauthenticate(user, password);
      const { requestAccountDeletion } = await accountApi();
      await requestAccountDeletion(user.uid);
      location.reload();
    } catch (err) {
      setError(reportError(err, 'delete-account'));
      setBusy(false);
    }
  }

  // Required by law but not put forward (owner, 2 Oct 2026): a small grey link at the bottom.
  if (!open) {
    return (
      <button
        type="button"
        class="link-button link-button--muted link-button--center"
        onClick={() => setOpen(true)}
      >
        {fr.account.deleteTitle}
      </button>
    );
  }

  return (
    <section class="card card--danger" aria-labelledby="delete-title">
      <h2 class="card__title" id="delete-title">
        {fr.account.deleteTitle}
      </h2>
      <p>{fr.account.deleteBody}</p>
      <form class="form" noValidate onSubmit={confirm}>
        {withPassword ? (
          <Field id="delete-password" label={fr.account.deletePassword} error={error || undefined}>
            <input
              {...controlAttrs('delete-password', error || undefined)}
              type="password"
              autocomplete="current-password"
              value={password}
              onInput={(e) => setPassword(e.currentTarget.value)}
            />
          </Field>
        ) : (
          <>
            <p class="field__hint">{fr.account.deleteGoogle}</p>
            {error && (
              <p class="form-error" role="alert">
                {error}
              </p>
            )}
          </>
        )}
        <button type="submit" class="button button--danger button--block" disabled={busy}>
          {busy ? fr.login.working : fr.account.deleteConfirm}
        </button>
        <button
          type="button"
          class="link-button link-button--center"
          onClick={() => {
            setOpen(false);
            setError('');
          }}
        >
          {fr.account.deleteCancel}
        </button>
      </form>
    </section>
  );
}

// The bell is recounted by <Notifications> once it has marked what it shows as read.
mountPage(
  <AuthGate requirement="profile" bell={false}>
    {(session) => <AccountPage session={session} />}
  </AuthGate>,
);
