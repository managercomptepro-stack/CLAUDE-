/** Starts downloading the list early (focus on the e-mail field), so the check is instant. */
export function preloadDisposableList(): void {
  // A failed preload is retried by isDisposableEmail at submit time.
  import('../data/disposable-domains').catch(() => undefined);
}

/** True when the e-mail's domain is a known disposable provider (list loaded on demand). */
export async function isDisposableEmail(email: string): Promise<boolean> {
  const domain = (email.split('@')[1] ?? '').trim().toLowerCase();
  if (!domain) return false;
  const { DISPOSABLE_DOMAINS } = await import('../data/disposable-domains');
  return DISPOSABLE_DOMAINS.has(domain);
}
