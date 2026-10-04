import type { FirebaseApp } from 'firebase/app';
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from 'firebase/app-check';
import { firebaseEnv } from './app';

let started = false;

/**
 * Firebase App Check (reCAPTCHA Enterprise, invisible score), started with Firebase Auth only:
 * sign-in, account pages, and the taps that open a session (WhatsApp, J'aime, Signaler). The public
 * pages (home, search, listing) never load reCAPTCHA: measured on 4 Oct 2026, it cost 1 to 1.6 s of
 * main thread and Lighthouse fell from ~88 to 46–66. So « Appliquer » is meant for Authentication
 * (no more scripted anonymous sessions); Firestore stays in monitoring. Never on the emulators.
 */
export function startAppCheck(app: FirebaseApp): void {
  if (started || !firebaseEnv.appCheckKey || firebaseEnv.useEmulators) return;
  started = true;
  initializeAppCheck(app, {
    provider: new ReCaptchaEnterpriseProvider(firebaseEnv.appCheckKey),
    isTokenAutoRefreshEnabled: true,
  });
}
