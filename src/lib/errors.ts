/**
 * Turns Firebase (Auth, Firestore) and NIOXXER error codes into clear French for the user.
 * The raw code goes to console.error (allowed, CLAUDE.md § 7): without it, a generic message
 * cannot be diagnosed. From v1 `translateAuthError` (archives/v1/js/nioxxer-auth.js).
 */
import { fr } from '../i18n/fr';

/** Error codes raised by our own code (not by Firebase). */
export type AppErrorCode =
  | 'nioxxer/disposable-email'
  | 'nioxxer/pseudo-taken'
  | 'nioxxer/settings-missing'
  | 'nioxxer/no-user'
  | 'nioxxer/no-deletion-request'
  | 'nioxxer/image-unreadable'
  | 'nioxxer/upload-failed'
  | 'nioxxer/upload-cancelled'
  | 'nioxxer/listing-limit'
  | 'nioxxer/publish-banned'
  | 'nioxxer/image-too-large'
  | 'nioxxer/boost-pending'
  | 'nioxxer/listing-gone';

export class AppError extends Error {
  readonly code: AppErrorCode;
  constructor(code: AppErrorCode) {
    super(code);
    this.code = code;
  }
}

/** The `code` of a Firebase/NIOXXER error, or '' for anything else. */
export function errorCode(error: unknown): string {
  if (typeof error === 'object' && error !== null && 'code' in error) {
    const code = (error as { code: unknown }).code;
    if (typeof code === 'string') return code;
  }
  return '';
}

const MESSAGES: Readonly<Record<string, string>> = {
  'auth/email-already-in-use': fr.errors.emailInUse,
  'auth/invalid-email': fr.errors.invalidEmail,
  'auth/missing-email': fr.errors.invalidEmail,
  'auth/missing-password': fr.errors.missingPassword,
  'auth/weak-password': fr.errors.weakPassword,
  'auth/too-many-requests': fr.errors.tooManyRequests,
  'auth/user-not-found': fr.errors.wrongCredentials,
  'auth/wrong-password': fr.errors.wrongCredentials,
  'auth/invalid-credential': fr.errors.wrongCredentials,
  'auth/invalid-login-credentials': fr.errors.wrongCredentials,
  'auth/user-disabled': fr.errors.userDisabled,
  'auth/popup-closed-by-user': fr.errors.popupClosed,
  'auth/cancelled-popup-request': fr.errors.popupClosed,
  'auth/user-cancelled': fr.errors.popupClosed,
  'auth/popup-blocked': fr.errors.popupBlocked,
  'auth/operation-not-supported-in-this-environment': fr.errors.inAppBrowser,
  'auth/web-storage-unsupported': fr.errors.inAppBrowser,
  'auth/unauthorized-domain': fr.errors.googleNotEnabled,
  'auth/operation-not-allowed': fr.errors.methodNotEnabled,
  'auth/network-request-failed': fr.errors.network,
  'auth/requires-recent-login': fr.errors.recentLogin,
  'auth/user-mismatch': fr.errors.userMismatch,
  'auth/expired-action-code': fr.errors.expiredLink,
  'auth/invalid-action-code': fr.errors.expiredLink,
  'auth/account-exists-with-different-credential': fr.errors.accountExists,
  'permission-denied': fr.errors.permissionDenied,
  unavailable: fr.errors.network,
  'deadline-exceeded': fr.errors.network,
  'nioxxer/disposable-email': fr.errors.disposableEmail,
  'nioxxer/pseudo-taken': fr.errors.pseudoTaken,
  'nioxxer/settings-missing': fr.errors.settingsMissing,
  'nioxxer/no-user': fr.errors.noUser,
  'nioxxer/no-deletion-request': fr.errors.noDeletionRequest,
  'nioxxer/image-unreadable': fr.errors.imageUnreadable,
  'nioxxer/upload-failed': fr.errors.uploadFailed,
  'nioxxer/upload-cancelled': fr.errors.uploadCancelled,
  'nioxxer/listing-limit': fr.errors.listingLimit,
  'nioxxer/publish-banned': fr.errors.publishBanned,
  'nioxxer/image-too-large': fr.errors.imageTooLarge,
  'nioxxer/boost-pending': fr.errors.boostPending,
  'nioxxer/listing-gone': fr.admin.payments.listingGone,
};

/** French message for any error; never shows a raw Firebase message. */
export function errorMessage(error: unknown): string {
  const code = errorCode(error);
  return MESSAGES[code] ?? fr.errors.generic;
}

/** Logs the raw code (diagnosis) and returns the French message (display). */
export function reportError(error: unknown, context: string): string {
  console.error(`[NIOXXER ${context}]`, errorCode(error) || error);
  return errorMessage(error);
}
