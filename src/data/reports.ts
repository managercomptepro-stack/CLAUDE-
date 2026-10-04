/** The 7 report reasons (SPEC § 10), « seems underage » first: it is shown first in the admin. */
export const REPORT_REASONS = [
  'minor',
  'paid_sex',
  'stolen_photos',
  'scam',
  'shocking',
  'fake_profile',
  'other',
] as const;

export type ReportReason = (typeof REPORT_REASONS)[number];
