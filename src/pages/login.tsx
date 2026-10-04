import { useEffect, useState } from 'preact/hooks';
import { controlAttrs, Field } from '../components/Field';
import { ProfileFields } from '../components/ProfileFields';
import { Skeleton } from '../components/Skeleton';
import {
  currentUser,
  deleteAuthUser,
  logOut,
  pendingGoogleRedirect,
  resetPassword,
  sendVerification,
  signInWithEmail,
  signUpWithEmail,
  reauthenticate,
  usesPassword,
  type User,
} from '../firebase/auth';
import { fr } from '../i18n/fr';
// Firestore is only needed once the visitor is known (or submits): loaded on demand.
const accountApi = () => import('../lib/account');
import { isDisposableEmail, preloadDisposableList } from '../lib/disposable-email';
import { AppError, errorCode, reportError } from '../lib/errors';
import { chromeIntentUrl, detectInAppBrowser, isAndroid } from '../lib/in-app-browser';
import { currentNext, verifyEmailUrl } from '../lib/navigation';
import {
  emailError,
  newPasswordError,
  PASSWORD_MIN,
  validateProfile,
  type FieldErrors,
  type ProfileField,
  type ProfileInput,
} from '../lib/profile-form';
import { mountPage } from '../shell/mount';

type Tab = 'create' | 'login';
type View =
  | { kind: 'loading' }
  | { kind: 'tabs'; tab: Tab; error?: string }
  | { kind: 'profile'; user: User; initial?: ProfileInput; error?: string }
  | { kind: 'forgot' }
  | { kind: 'finishDeletion'; user: User };

const EMPTY_PROFILE: ProfileInput = {
  pseudo: '',
  birthDate: '',
  genre: '',
  city: '',
  whatsapp: '',
  photoUrl: null,
  terms: false,
};

/** After sign-up: the verification e-mail, then /verifier-email (never blocks on the e-mail). */
async function goVerify(user: User, next: string): Promise<void> {
  try {
    await sendVerification(user, next);
  } catch (error) {
    reportError(error, 'verification');
  }
  location.assign(verifyEmailUrl(next));
}

function FormError({ message }: { message?: string | undefined }) {
  return message ? (
    <p class="form-error" role="alert">
      {message}
    </p>
  ) : null;
}

function LoginPage() {
  const next = currentNext();
  const [view, setView] = useState<View>({ kind: 'loading' });
  const [email, setEmail] = useState('');

  /** Signed-in user: profile step, e-mail verification, or the page asked for. */
  async function routeSignedIn(user: User): Promise<void> {
    const { hasLeftoverRecord, loadAccount } = await accountApi();
    const account = await loadAccount(user.uid);
    if (!account) {
      const leftover = await hasLeftoverRecord(user.uid);
      setView(leftover ? { kind: 'finishDeletion', user } : { kind: 'profile', user });
    } else if (!user.emailVerified) location.assign(verifyEmailUrl(next));
    else location.assign(next);
  }

  async function onSignedIn(user: User): Promise<void> {
    try {
      await routeSignedIn(user);
    } catch (error) {
      setView({ kind: 'tabs', tab: 'login', error: reportError(error, 'login') });
    }
  }

  useEffect(() => {
    void (async () => {
      let error: string | undefined;
      if (pendingGoogleRedirect()) {
        try {
          const { googleRedirectResult } = await import('../firebase/google');
          await googleRedirectResult();
        } catch (e) {
          error = reportError(e, 'google');
        }
      }
      const tab: Tab = new URLSearchParams(location.search).get('tab') === 'login' ? 'login' : 'create';
      try {
        const user = await currentUser();
        if (user && !user.isAnonymous) {
          await routeSignedIn(user);
          return;
        }
      } catch (e) {
        error = reportError(e, 'session');
      }
      setView({ kind: 'tabs', tab, ...(error ? { error } : {}) });
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs once, on arrival
  }, []);

  if (view.kind === 'loading') {
    return (
      <div class="page">
        <Skeleton cards={2} />
      </div>
    );
  }

  if (view.kind === 'profile') {
    return (
      <ProfileStep
        user={view.user}
        next={next}
        initial={view.initial}
        initialError={view.error}
        onLogout={() => setView({ kind: 'tabs', tab: 'login' })}
      />
    );
  }

  if (view.kind === 'finishDeletion') return <FinishDeletion user={view.user} />;

  if (view.kind === 'forgot') {
    return (
      <ForgotPassword
        email={email}
        setEmail={setEmail}
        onBack={() => setView({ kind: 'tabs', tab: 'login' })}
      />
    );
  }

  const tab = view.tab;
  const selectTab = (t: Tab) => setView({ kind: 'tabs', tab: t });
  return (
    <div class="page">
      <h1 class="page__title">{fr.headings.login}</h1>
      <div class="tabs" role="tablist" aria-label={fr.login.tabsLabel}>
        {(['create', 'login'] as const).map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            id={`tab-${t}`}
            class="tabs__tab"
            aria-selected={tab === t}
            aria-controls={`panel-${t}`}
            onClick={() => selectTab(t)}
          >
            {t === 'create' ? fr.login.tabCreate : fr.login.tabLogin}
          </button>
        ))}
      </div>
      <div
        key={tab}
        role="tabpanel"
        id={`panel-${tab}`}
        aria-labelledby={`tab-${tab}`}
        class="stack panel-in"
      >
        <FormError message={view.error} />
        <GoogleBlock onSignedIn={onSignedIn} />
        <div class="divider">{fr.login.or}</div>
        {tab === 'create' ? (
          <CreateForm
            next={next}
            onProfileNeeded={(user, initial, error) => setView({ kind: 'profile', user, initial, error })}
          />
        ) : (
          <LoginForm
            email={email}
            setEmail={setEmail}
            onForgot={() => setView({ kind: 'forgot' })}
            onSignedIn={onSignedIn}
          />
        )}
      </div>
    </div>
  );
}

type CreateField = ProfileField | 'email' | 'password';

function CreateForm(props: {
  next: string;
  onProfileNeeded: (user: User, initial: ProfileInput, error: string) => void;
}) {
  const [profile, setProfile] = useState<ProfileInput>(EMPTY_PROFILE);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<FieldErrors<CreateField>>({});
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: Event) {
    e.preventDefault();
    if (busy) return;
    setFormError('');
    const checked = validateProfile(profile);
    const found: FieldErrors<CreateField> = checked.ok ? {} : { ...checked.errors };
    const eErr = emailError(email);
    if (eErr) found.email = eErr;
    const pErr = newPasswordError(password);
    if (pErr) found.password = pErr;
    setErrors(found);
    if (!checked.ok || Object.keys(found).length) return;

    setBusy(true);
    try {
      if (await isDisposableEmail(email)) throw new AppError('nioxxer/disposable-email');
      const { createAccount, isPseudoTaken } = await accountApi();
      if (await isPseudoTaken(checked.value.pseudoLower)) throw new AppError('nioxxer/pseudo-taken');
      const user = await signUpWithEmail(email, password);
      try {
        await createAccount(user.uid, user.email ?? email.trim(), checked.value);
      } catch (error) {
        props.onProfileNeeded(user, profile, reportError(error, 'signup-profile'));
        return;
      }
      await goVerify(user, props.next);
    } catch (error) {
      const message = reportError(error, 'signup');
      const code = errorCode(error);
      if (code === 'nioxxer/pseudo-taken') setErrors({ pseudo: message });
      else if (
        code === 'nioxxer/disposable-email' ||
        code.startsWith('auth/email') ||
        code === 'auth/invalid-email'
      )
        setErrors({ email: message });
      else setFormError(message);
      setBusy(false);
    }
  }

  const pwHint = fr.login.passwordHint(PASSWORD_MIN);
  return (
    <form class="form" noValidate onSubmit={submit}>
      <p class="field__hint">{fr.login.createLead}</p>
      <ProfileFields
        values={profile}
        errors={errors}
        onChange={setProfile}
        beforeTerms={
          <>
            <EmailField
              value={email}
              error={errors.email}
              onChange={setEmail}
              onFocus={preloadDisposableList}
            />
            <Field id="password" label={fr.login.password} error={errors.password} hint={pwHint}>
              <input
                {...controlAttrs('password', errors.password, pwHint)}
                type="password"
                autocomplete="new-password"
                value={password}
                onInput={(e) => setPassword(e.currentTarget.value)}
              />
            </Field>
          </>
        }
      />
      <FormError message={formError} />
      <button type="submit" class="button button--primary button--block" disabled={busy}>
        {busy ? fr.login.working : fr.login.submitCreate}
      </button>
    </form>
  );
}

function EmailField(props: {
  value: string;
  error?: string | undefined;
  onChange: (v: string) => void;
  onFocus?: () => void;
}) {
  return (
    <Field id="email" label={fr.login.email} error={props.error}>
      <input
        {...controlAttrs('email', props.error)}
        type="email"
        inputMode="email"
        autocomplete="email"
        autocapitalize="none"
        spellcheck={false}
        value={props.value}
        onFocus={props.onFocus}
        onInput={(e) => props.onChange(e.currentTarget.value)}
      />
    </Field>
  );
}

function LoginForm(props: {
  email: string;
  setEmail: (v: string) => void;
  onForgot: () => void;
  onSignedIn: (user: User) => Promise<void>;
}) {
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<FieldErrors<'email' | 'password'>>({});
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: Event) {
    e.preventDefault();
    if (busy) return;
    setFormError('');
    const found: FieldErrors<'email' | 'password'> = {};
    const eErr = emailError(props.email);
    if (eErr) found.email = eErr;
    if (!password) found.password = fr.errors.missingPassword;
    setErrors(found);
    if (Object.keys(found).length) return;
    setBusy(true);
    try {
      const user = await signInWithEmail(props.email, password);
      await props.onSignedIn(user);
    } catch (error) {
      setFormError(reportError(error, 'login'));
      setBusy(false);
    }
  }

  return (
    <form class="form" noValidate onSubmit={submit}>
      <p class="field__hint">{fr.login.loginLead}</p>
      <EmailField value={props.email} error={errors.email} onChange={props.setEmail} />
      <Field id="password" label={fr.login.password} error={errors.password}>
        <input
          {...controlAttrs('password', errors.password)}
          type="password"
          autocomplete="current-password"
          value={password}
          onInput={(e) => setPassword(e.currentTarget.value)}
        />
      </Field>
      <button type="button" class="link-button" onClick={props.onForgot}>
        {fr.login.forgotLink}
      </button>
      <FormError message={formError} />
      <button type="submit" class="button button--primary button--block" disabled={busy}>
        {busy ? fr.login.working : fr.login.submitLogin}
      </button>
    </form>
  );
}

function GoogleBlock({ onSignedIn }: { onSignedIn: (user: User) => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const ua = navigator.userAgent;

  if (detectInAppBrowser(ua)) {
    return (
      <div class="notice" role="note">
        <p>
          <strong>{fr.login.inAppTitle}</strong>
        </p>
        <p>{fr.login.inAppBody}</p>
        {isAndroid(ua) && (
          <p>
            <a href={chromeIntentUrl(location.href)}>{fr.login.openInChrome}</a>
          </p>
        )}
      </div>
    );
  }

  async function google() {
    if (busy) return;
    setError('');
    setBusy(true);
    try {
      const { signInWithGoogle } = await import('../firebase/google');
      const user = await signInWithGoogle();
      if (user) await onSignedIn(user);
    } catch (e) {
      setError(reportError(e, 'google'));
      setBusy(false);
    }
  }

  return (
    <div class="stack">
      <button
        type="button"
        class="button button--secondary button--block button--google"
        disabled={busy}
        onClick={google}
      >
        {/* Official « G » from Google's sign-in kit (public/brands/README.md), one per theme. */}
        <img
          class="brand-mark icon--when-light"
          src="/brands/google-g-light.svg"
          width="24"
          height="24"
          alt=""
          loading="lazy"
        />
        <img
          class="brand-mark icon--when-dark"
          src="/brands/google-g-dark.svg"
          width="24"
          height="24"
          alt=""
          loading="lazy"
        />
        <span>{busy ? fr.login.working : fr.login.google}</span>
      </button>
      <FormError message={error} />
    </div>
  );
}

function ProfileStep(props: {
  user: User;
  next: string;
  initial?: ProfileInput | undefined;
  initialError?: string | undefined;
  onLogout: () => void;
}) {
  const [profile, setProfile] = useState<ProfileInput>(props.initial ?? EMPTY_PROFILE);
  const [errors, setErrors] = useState<FieldErrors<ProfileField>>({});
  const [formError, setFormError] = useState(props.initialError ?? '');
  const [busy, setBusy] = useState(false);

  async function submit(e: Event) {
    e.preventDefault();
    if (busy) return;
    setFormError('');
    const checked = validateProfile(profile);
    setErrors(checked.ok ? {} : checked.errors);
    if (!checked.ok) return;
    setBusy(true);
    try {
      const { createAccount } = await accountApi();
      await createAccount(props.user.uid, props.user.email ?? '', checked.value);
      if (props.user.emailVerified) location.assign(props.next);
      else await goVerify(props.user, props.next);
    } catch (error) {
      const message = reportError(error, 'profile');
      if (errorCode(error) === 'nioxxer/pseudo-taken') setErrors({ pseudo: message });
      else setFormError(message);
      setBusy(false);
    }
  }

  async function logout() {
    try {
      await logOut();
      props.onLogout();
    } catch (error) {
      setFormError(reportError(error, 'logout'));
    }
  }

  return (
    <div class="page">
      <h1 class="page__title">{fr.login.profileHeading}</h1>
      <p class="lead">{fr.login.profileLead}</p>
      <form class="form" noValidate onSubmit={submit}>
        {props.user.email && <p class="field__hint">{fr.login.signedInAs(props.user.email)}</p>}
        <ProfileFields values={profile} errors={errors} onChange={setProfile} />
        <FormError message={formError} />
        <button type="submit" class="button button--primary button--block" disabled={busy}>
          {busy ? fr.login.working : fr.login.profileSubmit}
        </button>
        <button type="button" class="link-button link-button--center" onClick={logout}>
          {fr.login.useOtherAccount}
        </button>
      </form>
    </div>
  );
}

/** A deletion interrupted after its Firestore step: only the Auth account is left to delete. */
function FinishDeletion({ user }: { user: User }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const withPassword = usesPassword(user);

  async function submit(e: Event) {
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
      await deleteAuthUser(user);
      setDone(true);
    } catch (err) {
      setError(reportError(err, 'finish-deletion'));
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div class="page">
        <h1 class="page__title">{fr.account.deletedTitle}</h1>
        <p class="lead">{fr.account.deletedBody}</p>
        <a class="button button--primary button--block" href="/">
          {fr.account.home}
        </a>
      </div>
    );
  }

  return (
    <div class="page">
      <h1 class="page__title">{fr.login.unfinishedHeading}</h1>
      <p class="lead">{fr.login.unfinishedLead}</p>
      <form class="form" noValidate onSubmit={submit}>
        {withPassword ? (
          <Field id="finish-password" label={fr.account.deletePassword} error={error || undefined}>
            <input
              {...controlAttrs('finish-password', error || undefined)}
              type="password"
              autocomplete="current-password"
              value={password}
              onInput={(e) => setPassword(e.currentTarget.value)}
            />
          </Field>
        ) : (
          <>
            <p class="field__hint">{fr.account.deleteGoogle}</p>
            <FormError message={error} />
          </>
        )}
        <button type="submit" class="button button--danger button--block" disabled={busy}>
          {busy ? fr.login.working : fr.login.unfinishedSubmit}
        </button>
      </form>
    </div>
  );
}

function ForgotPassword(props: { email: string; setEmail: (v: string) => void; onBack: () => void }) {
  const [error, setError] = useState('');
  const [formError, setFormError] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(e: Event) {
    e.preventDefault();
    if (busy) return;
    setFormError('');
    const eErr = emailError(props.email);
    setError(eErr ?? '');
    if (eErr) return;
    setBusy(true);
    try {
      await resetPassword(props.email);
      setSent(true);
    } catch (err) {
      // Never reveal whether an account exists: « user-not-found » counts as sent.
      if (errorCode(err) === 'auth/user-not-found') setSent(true);
      else setFormError(reportError(err, 'reset'));
    }
    setBusy(false);
  }

  return (
    <div class="page">
      <h1 class="page__title">{fr.login.forgotHeading}</h1>
      <p class="lead">{fr.login.forgotLead}</p>
      <form class="form" noValidate onSubmit={submit}>
        {sent ? (
          <p class="notice notice--ok" role="status">
            {fr.login.forgotSent}
          </p>
        ) : (
          <>
            <EmailField value={props.email} error={error || undefined} onChange={props.setEmail} />
            <FormError message={formError} />
            <button type="submit" class="button button--primary button--block" disabled={busy}>
              {busy ? fr.login.working : fr.login.forgotSubmit}
            </button>
          </>
        )}
        <button type="button" class="link-button link-button--center" onClick={props.onBack}>
          {fr.login.backToLogin}
        </button>
      </form>
    </div>
  );
}

mountPage(<LoginPage />);
