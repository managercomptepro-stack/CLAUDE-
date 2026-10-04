/** Stored notification types (SPEC § 9). Reminders (expiry, boost ending) are computed, not stored. */
export const NOTIFICATION_TYPES = [
  'boost_approved',
  'boost_rejected',
  'badge_granted',
  'badge_refused',
  'listing_removed',
  'warning',
] as const;

export type NotificationType = (typeof NOTIFICATION_TYPES)[number];
