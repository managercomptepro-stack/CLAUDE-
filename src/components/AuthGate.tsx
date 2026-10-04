import type { ComponentChild } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { currentUser, ensureFreshVerifiedToken, type User } from '../firebase/auth';
import { fr } from '../i18n/fr';
import { decideAccess, type Requirement } from '../lib/access';
import type { Account } from '../lib/account';
import { errorCode, reportError } from '../lib/errors';
import { clearUnread } from '../shell/bell';
import { DeletionPending } from './DeletionPending';
import { EmptyState } from './EmptyState';
import { Skeleton } from './Skeleton';
import { TermsUpdate } from './TermsUpdate';

/** Current terms version, or null when `settings/public` does not exist yet (nothing to accept). */
async function currentTerms(lib: typeof import('../lib/account')): Promise<string | null> {
  try {
    return (await lib.loadSettings()).termsVersion;
  } catch (error) {
    if (errorCode(error) === 'nioxxer/settings-missing') return null;
    throw error;
  }
}

export interface Session {
  user: User;
  account: Account;
}

type State =
  | { kind: 'loading' }
  | { kind: 'ready'; session: Session }
  | { kind: 'terms'; session: Session; version: string }
  | { kind: 'error'; message: string };

interface Props {
  requirement: Requirement;
  /** Recount the unread notifications of the header bell (default). */
  bell?: boolean;
  children: (session: Session) => ComponentChild;
}

/**
 * Page guard: shows the skeleton until the session is known, then either renders the protected
 * content or leaves for /connexion, the profile step or /verifier-email. Nothing protected is
 * rendered before the decision (no flash). An account whose deletion was requested only sees
 * <DeletionPending>.
 */
export function AuthGate({ requirement, bell = true, children }: Props) {
  const [state, setState] = useState<State>({ kind: 'loading' });
  const [attempt, setAttempt] = useState(0);

  // Back button after logging out: the browser may restore this page from its cache (bfcache)
  // without running the guard again — reload it so the decision is made afresh.
  useEffect(() => {
    const onShow = (e: PageTransitionEvent) => {
      if (e.persisted) location.reload();
    };
    window.addEventListener('pageshow', onShow);
    return () => window.removeEventListener('pageshow', onShow);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const user = await currentUser();
        // Nobody signed in on this browser any more: the header bell goes away.
        if (!user || user.isAnonymous) clearUnread();
        // Firestore is loaded only once someone is signed in (a visitor is redirected without it).
        const lib = user && !user.isAnonymous ? await import('../lib/account') : null;
        const [account, termsVersion] =
          lib && user ? await Promise.all([lib.loadAccount(user.uid), currentTerms(lib)]) : [null, null];
        const decision = decideAccess(
          {
            user: user ? { anonymous: user.isAnonymous, emailVerified: user.emailVerified } : null,
            hasProfile: account !== null,
          },
          requirement,
          location.pathname + location.search,
        );
        if (decision.kind === 'redirect') {
          location.replace(decision.to);
          return;
        }
        if (!user || !account) return;
        await ensureFreshVerifiedToken(user);
        const session = { user, account };
        if (!cancelled) {
          setState(
            // A frozen account cannot accept new terms (rules): it goes straight to <DeletionPending>.
            termsVersion && account.user.termsVersion !== termsVersion && !account.user.deletionRequestedAt
              ? { kind: 'terms', session, version: termsVersion }
              : { kind: 'ready', session },
          );
        }
        if (bell) {
          void import('../lib/notifications')
            .then((m) => m.refreshBell(user.uid))
            .catch((e: unknown) => reportError(e, 'bell'));
        }
      } catch (error) {
        if (!cancelled) setState({ kind: 'error', message: reportError(error, 'guard') });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [requirement, bell, attempt]);

  if (state.kind === 'ready') {
    const asked = state.session.account.user.deletionRequestedAt;
    return asked ? <DeletionPending askedAt={asked} /> : <>{children(state.session)}</>;
  }
  if (state.kind === 'terms') {
    const { session, version } = state;
    return (
      <TermsUpdate
        uid={session.user.uid}
        version={version}
        onAccepted={() =>
          setState({
            kind: 'ready',
            session: {
              ...session,
              account: { ...session.account, user: { ...session.account.user, termsVersion: version } },
            },
          })
        }
      />
    );
  }
  if (state.kind === 'error') {
    return (
      <div class="page">
        <EmptyState title={state.message}>
          <button
            type="button"
            class="button button--primary"
            onClick={() => {
              setState({ kind: 'loading' });
              setAttempt((n) => n + 1);
            }}
          >
            {fr.retry}
          </button>
        </EmptyState>
      </div>
    );
  }
  return (
    <div class="page">
      <Skeleton cards={2} />
    </div>
  );
}
