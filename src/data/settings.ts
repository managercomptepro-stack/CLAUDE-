/**
 * `settings/public` (ARCHITECTURE § 4): read by everyone, written by the super-admin only.
 * DEMO_SETTINGS is what `npm run seed` writes in the emulators; production payees are entered in
 * the admin « Réglages » tab, never taken from here.
 */
export interface PayeeSettings {
  number: string;
  name: string;
}

export interface PublicSettings {
  prices: { premium: number; sponsored: number };
  /** Days of each formula, set apart by the super-admin (owner's request of 3 Oct 2026). */
  boostDays: { premium: number; sponsored: number };
  payment: { mtn: PayeeSettings; orange: PayeeSettings };
  maxActiveListings: number;
  reportsHideThreshold: number;
  supportWhatsApp: string;
  termsVersion: string;
}

export const SETTINGS_PATH = 'settings/public';

/**
 * Values of the specification (SPEC § 7 and § 10, ARCHITECTURE § 4) without any payee: what the
 * admin « Réglages » form starts from when `settings/public` does not exist yet.
 */
export const DEFAULT_SETTINGS: PublicSettings = {
  prices: { premium: 2000, sponsored: 500 },
  boostDays: { premium: 7, sponsored: 7 },
  payment: { mtn: { number: '', name: '' }, orange: { number: '', name: '' } },
  maxActiveListings: 7,
  reportsHideThreshold: 10,
  supportWhatsApp: '+237678802447',
  termsVersion: '2026-10-1',
};

/**
 * `settings/public` as read from Firestore. Before 3 Oct 2026 `boostDays` was one number for both
 * formulas: read as the same number of days for each, until the next save of « Réglages ».
 */
export function normalizeSettings(raw: Record<string, unknown>): PublicSettings {
  const days = raw['boostDays'];
  const boostDays =
    typeof days === 'number'
      ? { premium: days, sponsored: days }
      : {
          premium: Number((days as Record<string, unknown> | undefined)?.['premium'] ?? 0),
          sponsored: Number((days as Record<string, unknown> | undefined)?.['sponsored'] ?? 0),
        };
  return { ...(raw as unknown as PublicSettings), boostDays };
}

export const DEMO_SETTINGS: PublicSettings = {
  ...DEFAULT_SETTINGS,
  // Fictitious payees, emulators only (never written to a real project).
  payment: {
    mtn: { number: '+237600000001', name: 'Démo NIOXXER MTN' },
    orange: { number: '+237600000002', name: 'Démo NIOXXER Orange' },
  },
};
