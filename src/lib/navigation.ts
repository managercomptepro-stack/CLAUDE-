/** Internal links of the account flow. */

export const ACCOUNT_PATH = '/compte';
export const LOGIN_PATH = '/connexion';
export const VERIFY_EMAIL_PATH = '/verifier-email';

/**
 * Safe internal path for `?next=`: only an address of the site (« /… »), never « //other-site »,
 * « /\\other-site » nor a full URL (open redirect). From v1 `safeNext`.
 */
export function safeNext(raw: string | null | undefined, fallback = ACCOUNT_PATH): string {
  return typeof raw === 'string' && /^\/(?![/\\])[\w\-/?=&%.]*$/.test(raw) ? raw : fallback;
}

function withNext(path: string, next: string, extra = ''): string {
  return `${path}?${extra}next=${encodeURIComponent(safeNext(next))}`;
}

export function loginUrl(next: string): string {
  return withNext(LOGIN_PATH, next);
}

/** Profile step of /connexion (Google sign-up, or an e-mail account without its profile). */
export function profileStepUrl(next: string): string {
  return withNext(LOGIN_PATH, next, 'step=profil&');
}

export function verifyEmailUrl(next: string): string {
  return withNext(VERIFY_EMAIL_PATH, next);
}

/** `next` parameter of the current address. */
export function currentNext(search: string = location.search): string {
  return safeNext(new URLSearchParams(search).get('next'));
}
