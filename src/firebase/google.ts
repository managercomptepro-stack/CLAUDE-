/**
 * Google sign-in (ARCHITECTURE § 7). Imported on demand only: the popup/redirect resolver loads
 * Google's iframe machinery, which must never slow down the first display of a page.
 */
import {
  browserPopupRedirectResolver,
  getRedirectResult,
  GoogleAuthProvider,
  reauthenticateWithPopup,
  signInWithPopup,
  signInWithRedirect,
  type User,
} from 'firebase/auth';
import { errorCode } from '../lib/errors';
import { googleMode, isMobileUserAgent } from '../lib/in-app-browser';
import { firebaseEnv } from './app';
import { auth, GOOGLE_PENDING_KEY as PENDING_KEY } from './auth';

function provider(): GoogleAuthProvider {
  const p = new GoogleAuthProvider();
  p.setCustomParameters({ prompt: 'select_account' });
  return p;
}

async function redirect(): Promise<null> {
  try {
    sessionStorage.setItem(PENDING_KEY, '1');
  } catch {
    // Storage blocked: the result is then only read if the user comes back to /connexion.
  }
  await signInWithRedirect(auth(), provider(), browserPopupRedirectResolver);
  return null;
}

/**
 * Redirect on mobile when the auth handler is on the site's own domain, popup otherwise; a
 * blocked popup falls back to the redirect where it is reliable. Returns the user for a popup,
 * null for a redirect (the page is left; see `pendingGoogleRedirect`).
 */
export async function signInWithGoogle(): Promise<User | null> {
  const sameDomain = firebaseEnv.authDomain === location.hostname;
  const mode = googleMode({
    mobile: isMobileUserAgent(navigator.userAgent),
    authDomain: firebaseEnv.authDomain,
    hostname: location.hostname,
  });
  if (mode === 'redirect') return redirect();
  try {
    const result = await signInWithPopup(auth(), provider(), browserPopupRedirectResolver);
    return result.user;
  } catch (error) {
    if (errorCode(error) !== 'auth/popup-blocked' || !sameDomain) throw error;
    return redirect();
  }
}

/** Reads the result of a Google redirect (throws its error, e.g. account exists). */
export async function googleRedirectResult(): Promise<void> {
  try {
    sessionStorage.removeItem(PENDING_KEY);
  } catch {
    // ignore
  }
  await getRedirectResult(auth(), browserPopupRedirectResolver);
}

export async function reauthenticateWithGoogle(user: User): Promise<void> {
  await reauthenticateWithPopup(user, provider(), browserPopupRedirectResolver);
}
