/**
 * Page guard decision (pure, unit-tested). Protected content is rendered only once this returns
 * « allow »: until then the page shows its skeleton, so nothing protected ever flashes.
 */
import { loginUrl, profileStepUrl, verifyEmailUrl } from './navigation';

/** What a page needs: an account with its profile, or in addition a verified e-mail. */
export type Requirement = 'profile' | 'verified';

export interface AccessState {
  /** null = no session (or an anonymous one, which never counts as an account). */
  user: { anonymous: boolean; emailVerified: boolean } | null;
  hasProfile: boolean;
}

export type AccessDecision = { kind: 'allow' } | { kind: 'redirect'; to: string };

export function decideAccess(state: AccessState, requirement: Requirement, here: string): AccessDecision {
  const { user } = state;
  if (!user || user.anonymous) return { kind: 'redirect', to: loginUrl(here) };
  if (!state.hasProfile) return { kind: 'redirect', to: profileStepUrl(here) };
  if (requirement === 'verified' && !user.emailVerified)
    return { kind: 'redirect', to: verifyEmailUrl(here) };
  return { kind: 'allow' };
}
