/**
 * Content-Security-Policy of the built pages (security audit of 3 Oct 2026), as a <meta> tag
 * written at build time only: the Vite dev server (HMR, emulators) stays without it. Build-time
 * module (node:crypto), never shipped to the browser.
 *
 * - scripts: our bundles, the inline theme boot script (by its hash) and Google's loader used by
 *   Firebase Auth for the Google sign-in popup;
 * - connections: Firebase (Firestore, Auth, token refresh) and the Cloudinary upload API;
 * - images: our files, Cloudinary, and data:/blob: (payment and ID previews, photo previews);
 * - frames: the Firebase Auth helper (same origin on nioxxer.com, *.firebaseapp.com on the
 *   preview channel). `frame-ancestors` cannot live in a <meta>: it is a header (firebase.json).
 */
import { createHash } from 'node:crypto';
import { CLOUDINARY_CLOUD_NAME } from '../data/limits.ts';

export function scriptHash(source: string): string {
  return `'sha256-${createHash('sha256').update(source, 'utf8').digest('base64')}'`;
}

export function contentSecurityPolicy(inlineScripts: readonly string[]): string {
  const directives: Record<string, string[]> = {
    'default-src': ["'self'"],
    // + reCAPTCHA Enterprise of App Check (www.google.com/recaptcha, www.gstatic.com/recaptcha).
    'script-src': [
      "'self'",
      ...inlineScripts.map(scriptHash),
      'https://apis.google.com',
      'https://www.google.com/recaptcha/',
      'https://www.gstatic.com/recaptcha/',
    ],
    // Preact sets style properties through the DOM; the few inline style attributes of the
    // static HTML need 'unsafe-inline' (no script can run from a style).
    'style-src': ["'self'", "'unsafe-inline'"],
    'img-src': ["'self'", 'data:', 'blob:', `https://res.cloudinary.com/${CLOUDINARY_CLOUD_NAME}/`],
    'font-src': ["'self'"],
    'connect-src': [
      "'self'",
      'https://*.googleapis.com',
      'https://www.google.com/recaptcha/',
      `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/`,
    ],
    'frame-src': [
      "'self'",
      'https://*.firebaseapp.com',
      'https://accounts.google.com',
      'https://www.google.com/recaptcha/',
      'https://recaptcha.google.com/recaptcha/',
    ],
    'object-src': ["'none'"],
    'base-uri': ["'self'"],
    'form-action': ["'self'"],
  };
  return Object.entries(directives)
    .map(([k, v]) => `${k} ${v.join(' ')}`)
    .join('; ');
}
