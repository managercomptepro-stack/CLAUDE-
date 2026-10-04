/**
 * Pure admin helpers (no Firestore, unit-tested): tabs per role, boost end on approval, strike and
 * automatic publication ban, report queue order, settings form, promotion end.
 */
import { REPORT_REASONS, type ReportReason } from '../data/reports';
import { STRIKES_BAN_THRESHOLD, TEXT_MAX } from '../data/limits';
import type { PublicSettings } from '../data/settings';
import { fr } from '../i18n/fr';
import type { BoostTier } from './boost-form';
import { formatDate, formatTime, normalizeSupportNumber, normalizeWhatsApp } from './format';
import type { FieldErrors, Validation } from './profile-form';

const DAY_MS = 86_400_000;

export type AdminRole = 'super' | 'moderator';

export function asRole(v: unknown): AdminRole | null {
  return v === 'super' || v === 'moderator' ? v : null;
}

export const ADMIN_TABS = [
  { id: 'signalements', superOnly: false },
  { id: 'recentes', superOnly: false },
  { id: 'paiements', superOnly: true },
  // ID photos are for the super-admin only (owner's decision of 3 Oct 2026).
  { id: 'badges', superOnly: true },
  { id: 'utilisateurs', superOnly: true },
  { id: 'mises-en-avant', superOnly: true },
  { id: 'reglages', superOnly: true },
  { id: 'equipe', superOnly: true },
  { id: 'journal', superOnly: true },
  { id: 'sante', superOnly: false },
  { id: 'nettoyage', superOnly: true },
] as const;

export type AdminTab = (typeof ADMIN_TABS)[number]['id'];

export function tabsFor(role: AdminRole): AdminTab[] {
  return ADMIN_TABS.filter((t) => role === 'super' || !t.superOnly).map((t) => t.id);
}

/** Tab named by the address (« #paiements »), or the first one the role may open. */
export function tabFromHash(hash: string, role: AdminRole): AdminTab {
  const tabs = tabsFor(role);
  const wanted = hash.replace(/^#/, '');
  return tabs.find((t) => t === wanted) ?? tabs[0] ?? 'signalements';
}

export const TIER_RANK: Record<BoostTier, 1 | 2> = { premium: 2, sponsored: 1 };

export function rankTier(rank: number): BoostTier | null {
  return rank === 2 ? 'premium' : rank === 1 ? 'sponsored' : null;
}

export interface Promotion {
  rank: number;
  /** null with rank > 0 = unlimited (granted by an admin). */
  boostUntil: Date | null;
}

/**
 * Promotion after a validated payment (SPEC § 7, owner's decision 10): `boostDays` from now, or
 * added to the end of a promotion still running. The higher tier of the two is kept; an
 * unlimited promotion stays unlimited.
 */
export function approvedBoost(current: Promotion, tier: BoostTier, boostDays: number, now: Date): Promotion {
  const running =
    current.rank > 0 && (current.boostUntil === null || current.boostUntil.getTime() > now.getTime());
  const rank = Math.max(TIER_RANK[tier], running ? current.rank : 0);
  if (running && current.boostUntil === null) return { rank, boostUntil: null };
  const start = running && current.boostUntil ? current.boostUntil : now;
  return { rank, boostUntil: new Date(start.getTime() + boostDays * DAY_MS) };
}

/** End of a promotion granted by hand: a number of days from now, or null = unlimited. */
export function promotionUntil(days: number | null, now: Date): Date | null {
  return days === null ? null : new Date(now.getTime() + days * DAY_MS);
}

/** Durations offered for a promotion granted by hand (null = unlimited). */
export const PROMOTION_DAYS: readonly (number | null)[] = [7, 14, 30, null];

export interface Sanction {
  strikes: number;
  publishBanned: boolean;
}

/** Listing removed for an infringement: strike +1, publication ban from the 5th (SPEC § 10). */
export function strikeAfterRemoval(s: Sanction): Sanction {
  const strikes = s.strikes + 1;
  return { strikes, publishBanned: s.publishBanned || strikes >= STRIKES_BAN_THRESHOLD };
}

/** Removal, warning and rejection reasons: 3 to 300 characters (rules: `maxReason`). */
export function reasonError(raw: string): string | null {
  const t = raw.trim();
  if (t.length < 3) return fr.admin.reasonRequired;
  if (t.length > TEXT_MAX.reason) return fr.admin.reasonTooLong(TEXT_MAX.reason);
  return null;
}

export interface QueueReport {
  listingId: string;
  reason: ReportReason;
  note: string;
  createdAt: Date;
  /** From a verified account: counted for the automatic hiding (reports before 3 Oct 2026 too). */
  counted: boolean;
}

export interface QueueListing {
  id: string;
  hidden: boolean;
  status: 'active' | 'removed' | 'closed';
  reportsCount: number;
  /** Last « Rétablir » / « Classer sans suite »: older reports are already handled. */
  reportsClearedAt: Date | null;
}

export interface QueueEntry<L extends QueueListing> {
  listing: L;
  /** Count per reason among the loaded reports, in the order of REPORT_REASONS. */
  reasons: { reason: ReportReason; count: number }[];
  notes: string[];
  minor: boolean;
  lastReport: Date | null;
  /** Reports of anonymous or unverified visitors (shown, not counted). */
  uncounted: number;
}

/**
 * « Signalements » tab (SPEC § 10): listings hidden by reports first, then those reported as
 * « seems underage », then by number of reports. Reports of anonymous visitors bring a listing in
 * too, without counting for the hiding. Removed listings and reports older than the last decision
 * (« Rétablir », « Classer sans suite ») are left out.
 */
export function reportQueue<L extends QueueListing>(
  listings: readonly L[],
  reports: readonly QueueReport[],
): QueueEntry<L>[] {
  const fresh = (l: L, r: QueueReport) =>
    r.listingId === l.id && (!l.reportsClearedAt || r.createdAt.getTime() > l.reportsClearedAt.getTime());
  const entries = listings
    .filter(
      (l) => l.status === 'active' && (l.hidden || l.reportsCount > 0 || reports.some((r) => fresh(l, r))),
    )
    .map((listing) => {
      const own = reports.filter((r) => fresh(listing, r));
      const reasons = REPORT_REASONS.map((reason) => ({
        reason,
        count: own.filter((r) => r.reason === reason).length,
      })).filter((r) => r.count > 0);
      const last = own.reduce<Date | null>((m, r) => (m && m > r.createdAt ? m : r.createdAt), null);
      return {
        listing,
        reasons,
        notes: own.map((r) => r.note.trim()).filter((n) => n !== ''),
        minor: own.some((r) => r.reason === 'minor'),
        lastReport: last,
        uncounted: own.filter((r) => !r.counted).length,
      };
    });
  return entries.sort(
    (a, b) =>
      Number(b.listing.hidden) - Number(a.listing.hidden) ||
      Number(b.minor) - Number(a.minor) ||
      b.listing.reportsCount - a.listing.reportsCount ||
      (b.lastReport?.getTime() ?? 0) - (a.lastReport?.getTime() ?? 0),
  );
}

/** Pseudo or uid typed in a search box (« @Alice » → « alice »). */
export function searchKey(raw: string): string {
  return raw.trim().replace(/^@/, '');
}

// ── Payment proof reused (security audit of 3 Oct 2026) ───────────────────

export interface PaymentProof {
  id: string;
  operator: string;
  txRef: string | null;
  screenshot: string | null;
}

/** « TX 123-45 » and « tx12345 » are the same reference. */
export function normalizeTxRef(ref: string): string {
  return ref.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * For each pending request: how many OTHER requests (pending or already handled) carry the same
 * transaction reference for the same operator, and whether another pending one has the very same
 * screenshot. One Mobile Money payment must not validate two boosts.
 */
export function proofReuse(
  pending: readonly PaymentProof[],
  others: readonly PaymentProof[],
): Map<string, { sameRef: number; sameShot: boolean }> {
  const all = new Map<string, PaymentProof>();
  for (const r of [...pending, ...others]) all.set(r.id, r);
  const out = new Map<string, { sameRef: number; sameShot: boolean }>();
  for (const r of pending) {
    const key = r.txRef ? normalizeTxRef(r.txRef) : '';
    let sameRef = 0;
    for (const o of all.values()) {
      if (o.id === r.id) continue;
      if (key && o.txRef && o.operator === r.operator && normalizeTxRef(o.txRef) === key) sameRef++;
    }
    const sameShot =
      r.screenshot !== null && pending.some((o) => o.id !== r.id && o.screenshot === r.screenshot);
    out.set(r.id, { sameRef, sameShot });
  }
  return out;
}

// ── Settings form ─────────────────────────────────────────────────────────

export interface SettingsInput {
  premium: string;
  sponsored: string;
  premiumDays: string;
  sponsoredDays: string;
  maxActiveListings: string;
  reportsHideThreshold: string;
  supportWhatsApp: string;
  mtnNumber: string;
  mtnName: string;
  orangeNumber: string;
  orangeName: string;
  termsVersion: string;
}

export type SettingsField = keyof SettingsInput;

/** Bounds checked by the rules (`validSettings`); the price cap only guards against typos. */
export const SETTINGS_BOUNDS = {
  price: [1, 1_000_000],
  boostDays: [1, 90],
  maxActiveListings: [1, 20],
  reportsHideThreshold: [2, 100],
  payeeName: 60,
} as const;

/** Version label of the terms (rules: 1 to 20 characters), e.g. « 2026-10-1 ». */
export const TERMS_VERSION_PATTERN = /^[0-9A-Za-z][0-9A-Za-z._-]{0,19}$/;

export function settingsToInput(s: PublicSettings): SettingsInput {
  return {
    premium: String(s.prices.premium),
    sponsored: String(s.prices.sponsored),
    premiumDays: String(s.boostDays.premium),
    sponsoredDays: String(s.boostDays.sponsored),
    maxActiveListings: String(s.maxActiveListings),
    reportsHideThreshold: String(s.reportsHideThreshold),
    supportWhatsApp: s.supportWhatsApp,
    mtnNumber: s.payment.mtn.number,
    mtnName: s.payment.mtn.name,
    orangeNumber: s.payment.orange.number,
    orangeName: s.payment.orange.name,
    termsVersion: s.termsVersion,
  };
}

function intIn(raw: string, [min, max]: readonly [number, number]): number | null {
  const t = raw.replace(/\s/g, '');
  if (!/^\d+$/.test(t)) return null;
  const n = Number(t);
  return n >= min && n <= max ? n : null;
}

/**
 * New `settings/public` from the form. A new `termsVersion` asks every member to accept the terms
 * again at their next visit of an account page (AuthGate).
 */
export function validateSettings(input: SettingsInput): Validation<PublicSettings, SettingsField> {
  const t = fr.admin.settings;
  const errors: FieldErrors<SettingsField> = {};
  const b = SETTINGS_BOUNDS;
  const num = (field: SettingsField, bounds: readonly [number, number]) => {
    const n = intIn(input[field], bounds);
    if (n === null) errors[field] = t.between(bounds[0], bounds[1]);
    return n ?? 0;
  };
  const premium = num('premium', b.price);
  const sponsored = num('sponsored', b.price);
  const premiumDays = num('premiumDays', b.boostDays);
  const sponsoredDays = num('sponsoredDays', b.boostDays);
  const maxActiveListings = num('maxActiveListings', b.maxActiveListings);
  const reportsHideThreshold = num('reportsHideThreshold', b.reportsHideThreshold);

  const support = normalizeSupportNumber(input.supportWhatsApp);
  if (!support) errors.supportWhatsApp = fr.admin.settings.supportInvalid;

  const payee = (numberField: 'mtnNumber' | 'orangeNumber', nameField: 'mtnName' | 'orangeName') => {
    const n = normalizeWhatsApp(input[numberField]);
    const name = input[nameField].trim();
    if (n === false) errors[numberField] = fr.form.whatsappInvalid;
    if (name.length > b.payeeName) errors[nameField] = t.nameTooLong(b.payeeName);
    // Both or neither: an operator is offered only with its number AND the payee's name.
    if (n && !name) errors[nameField] = t.nameRequired;
    if (!n && n !== false && name) errors[numberField] = t.numberRequired;
    return { number: n || '', name };
  };
  const mtn = payee('mtnNumber', 'mtnName');
  const orange = payee('orangeNumber', 'orangeName');
  const termsVersion = input.termsVersion.trim();
  if (!TERMS_VERSION_PATTERN.test(termsVersion)) errors.termsVersion = t.termsVersionInvalid;

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return {
    ok: true,
    value: {
      prices: { premium, sponsored },
      boostDays: { premium: premiumDays, sponsored: sponsoredDays },
      payment: { mtn, orange },
      maxActiveListings,
      reportsHideThreshold,
      supportWhatsApp: support || '',
      termsVersion,
    },
  };
}

// ── Journal ───────────────────────────────────────────────────────────────

function show(v: unknown): string {
  if (v === null || v === undefined || v === '') return '—';
  if (v instanceof Date) return `${formatDate(v)} ${formatTime(v)}`;
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}

/** « rank : 0 → 2 · boostUntil : — → 09/10/2026 10:00 » from the before/after of an audit entry. */
export function changeSummary(before: unknown, after: unknown): string {
  const isMap = (v: unknown): v is Record<string, unknown> =>
    typeof v === 'object' && v !== null && !(v instanceof Date) && !Array.isArray(v);
  if (!isMap(before) && !isMap(after)) return before === after ? '' : `${show(before)} → ${show(after)}`;
  const b = isMap(before) ? before : {};
  const a = isMap(after) ? after : {};
  const keys = [...new Set([...Object.keys(b), ...Object.keys(a)])];
  return keys
    .filter((k) => show(b[k]) !== show(a[k]))
    .map((k) => (k in b ? `${k} : ${show(b[k])} → ${show(a[k])}` : `${k} : ${show(a[k])}`))
    .join(' · ');
}

/** French label of a journal action (the raw code when unknown). */
export function actionLabel(action: string): string {
  const labels: Readonly<Record<string, string>> = fr.admin.journal.actions;
  return labels[action] ?? action;
}

// ── Health ────────────────────────────────────────────────────────────────

/** Spark quotas (ARCHITECTURE § 2, checked on 2 Oct 2026). */
export const SPARK = { reads: 50_000, writes: 20_000, hostingMb: 360 } as const;

/** Home page loads per day before the read quota (one home load ≈ one feed page). */
export function homeLoadsPerDay(readsPerLoad: number): number {
  return Math.floor(SPARK.reads / readsPerLoad);
}
