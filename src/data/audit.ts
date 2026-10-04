/**
 * Kinds of documents an admin can write. Each admin write carries `auditId`; the rules check
 * that the audit entry names this exact target type and id, so one entry covers one document.
 */
export const AUDIT_TARGET_TYPES = [
  'settings',
  'admin',
  'user',
  'profile',
  'listing',
  'boostRequest',
  'verification',
] as const;

export type AuditTargetType = (typeof AUDIT_TARGET_TYPES)[number];
