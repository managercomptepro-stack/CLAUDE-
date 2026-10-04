/**
 * Firebase Auth, loaded only by the pages that need an account (connexion, vérification,
 * compte, publier, booster, admin). Adapted from v1 (archives/v1/js/nioxxer-auth.js).
 *
 * No popup/redirect resolver here: with one, Auth loads Google's iframe machinery (~130 KB and
 * ~2 s on slow 4G, measured with Lighthouse) on every page load. Google sign-in lives in
 * ./google.ts, imported only when the Google button is used or a redirect comes back.
 */
import {
  browserLocalPersistence,
  connectAuthEmulator,
  createUserWithEmailAndPassword,
  deleteUser,
  EmailAuthProvider,
  indexedDBLocalPersistence,
  initializeAuth,
  onAuthStateChanged,
  reauthenticateWithCredential,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
  type ActionCodeSettings,
  type Auth,
  type User,
} from 'firebase/auth';
import { AppError, errorCode } from '../lib/errors';
import { LOGIN_PATH, VERIFY_EMAIL_PATH } from '../lib/navigation';
import { clearUnread } from '../shell/bell';
import { firebaseApp, firebaseEnv } from './app';
import { startAppCheck } from './app-check';
import { EMULATOR_HOST, EMULATOR_PORTS } from './config';

export type { User };

let instance: Auth | null = null;

export function auth(): Auth {
  if (!instance) {
    // App Check comes with Auth (./app-check.ts): its token then goes with Auth and Firestore calls.
    startAppCheck(firebaseApp());
    instance = initializeAuth(firebaseApp(), {
      persistence: [indexedDBLocalPersistence, browserLocalPersistence],
    });
    instance.languageCode = 'fr';
    if (firebaseEnv.useEmulators) {
      connectAuthEmulator(instance, `http://${EMULATOR_HOST}:${EMULATOR_PORTS.auth}`, {
        disableWarnings: true,
      });
    }
  }
  return instance;
}

/** Resolves once Firebase knows whether someone is signed in (first auth state). */
export function currentUser(): Promise<User | null> {
  const a = auth();
  return new Promise((resolve) => {
    const stop = onAuthStateChanged(a, (user) => {
      stop();
      resolve(user);
    });
  });
}

function continueSettings(path: string): ActionCodeSettings {
  return { url: `${location.origin}${path}`, handleCodeInApp: false };
}

function isContinueUrlRefused(error: unknown): boolean {
  const code = errorCode(error);
  return code === 'auth/unauthorized-continue-uri' || code === 'auth/invalid-continue-uri';
}

/**
 * Verification e-mail whose link brings the user back to /verifier-email. If the domain is not
 * (yet) authorised in the Firebase console, Firebase refuses the return address: the plain
 * e-mail is sent instead, so a console setting never blocks a sign-up (v1 behaviour).
 */
export async function sendVerification(user: User, next: string): Promise<void> {
  const settings = continueSettings(`${VERIFY_EMAIL_PATH}?next=${encodeURIComponent(next)}`);
  try {
    await sendEmailVerification(user, settings);
  } catch (error) {
    if (!isContinueUrlRefused(error)) throw error;
    console.error('[NIOXXER auth] continue URL refused', location.origin);
    await sendEmailVerification(user);
  }
}

export async function signUpWithEmail(email: string, password: string): Promise<User> {
  const credential = await createUserWithEmailAndPassword(auth(), email.trim(), password);
  return credential.user;
}

export async function signInWithEmail(email: string, password: string): Promise<User> {
  const credential = await signInWithEmailAndPassword(auth(), email.trim(), password);
  return credential.user;
}

export async function resetPassword(email: string): Promise<void> {
  try {
    await sendPasswordResetEmail(auth(), email.trim(), continueSettings(LOGIN_PATH));
  } catch (error) {
    if (!isContinueUrlRefused(error)) throw error;
    await sendPasswordResetEmail(auth(), email.trim());
  }
}

/**
 * firestore.rules read `request.auth.token.email_verified`, frozen in the ID token when it was
 * issued. `reload()` updates `user.emailVerified` but not the token: just after clicking the
 * link, writes would be refused for up to an hour. Force a new token when it lags (v1 fix).
 */
export async function ensureFreshVerifiedToken(user: User): Promise<void> {
  if (!user.emailVerified) return;
  const { claims } = await user.getIdTokenResult();
  if (claims['email_verified'] !== true) await user.getIdToken(true);
}

/** Reloads the user from Firebase; true once the e-mail is verified (token refreshed). */
export async function refreshVerification(user: User): Promise<boolean> {
  await user.reload();
  const fresh = auth().currentUser ?? user;
  await ensureFreshVerifiedToken(fresh);
  return fresh.emailVerified;
}

export function usesPassword(user: User): boolean {
  return user.providerData.some((p) => p.providerId === 'password');
}

/** Identity confirmation required before deleting an account (password, or Google popup). */
export async function reauthenticate(user: User, password: string): Promise<void> {
  if (usesPassword(user)) {
    if (!user.email) throw new AppError('nioxxer/no-user');
    await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, password));
  } else {
    const { reauthenticateWithGoogle } = await import('./google');
    await reauthenticateWithGoogle(user);
  }
}

export async function deleteAuthUser(user: User): Promise<void> {
  await deleteUser(user);
  clearUnread();
}

export async function logOut(): Promise<void> {
  await signOut(auth());
  clearUnread();
}

/** Set just before leaving for a Google redirect sign-in (./google.ts). */
export const GOOGLE_PENDING_KEY = 'nx-google-redirect';

/** True when the page is the return from a Google redirect sign-in. */
export function pendingGoogleRedirect(): boolean {
  try {
    return sessionStorage.getItem(GOOGLE_PENDING_KEY) === '1';
  } catch {
    return false;
  }
}
