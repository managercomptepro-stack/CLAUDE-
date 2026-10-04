import { useEffect, useRef, useState } from 'preact/hooks';
import { AuthGate, type Session } from '../components/AuthGate';
import { BadgesTab } from '../components/admin/BadgesTab';
import { CleanupTab, HealthTab } from '../components/admin/HealthTab';
import { JournalTab } from '../components/admin/JournalTab';
import { RecentTab, ReportsTab } from '../components/admin/ListingsTabs';
import { MembersTab } from '../components/admin/MembersTab';
import { PaymentsTab } from '../components/admin/PaymentsTab';
import { PromotionsTab } from '../components/admin/PromotionsTab';
import { SettingsTab } from '../components/admin/SettingsTab';
import { TeamTab } from '../components/admin/TeamTab';
import { EmptyState } from '../components/EmptyState';
import { Icon } from '../components/Icon';
import { Skeleton } from '../components/Skeleton';
import { fr } from '../i18n/fr';
import { loadRole } from '../lib/admin';
import { tabFromHash, tabsFor, type AdminRole, type AdminTab } from '../lib/admin-logic';
import { reportError } from '../lib/errors';
import { mountPage } from '../shell/mount';
import '../styles/admin.css';

type Load =
  { kind: 'loading' } | { kind: 'ready'; role: AdminRole | null } | { kind: 'error'; message: string };

/** /admin (SPEC § 10): reserved to `admins/{uid}`; nothing else is read before the role is known. */
function AdminRoot({ session }: { session: Session }) {
  const uid = session.user.uid;
  const [load, setLoad] = useState<Load>({ kind: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    loadRole(uid)
      .then((role) => !cancelled && setLoad({ kind: 'ready', role }))
      .catch((e: unknown) => !cancelled && setLoad({ kind: 'error', message: reportError(e, 'admin-role') }));
    return () => {
      cancelled = true;
    };
  }, [uid, attempt]);

  if (load.kind === 'loading') {
    return (
      <div class="page">
        <Skeleton cards={2} />
      </div>
    );
  }
  if (load.kind === 'error') {
    return (
      <div class="page">
        <EmptyState title={load.message}>
          <button
            type="button"
            class="button button--primary"
            onClick={() => {
              setLoad({ kind: 'loading' });
              setAttempt((n) => n + 1);
            }}
          >
            {fr.retry}
          </button>
        </EmptyState>
      </div>
    );
  }
  if (!load.role) {
    return (
      <div class="page">
        <h1 class="page__title">{fr.headings.admin}</h1>
        <EmptyState title={fr.admin.deniedTitle} body={fr.admin.deniedBody}>
          <a class="button button--primary" href="/">
            {fr.admin.home}
          </a>
        </EmptyState>
      </div>
    );
  }
  return <AdminApp actor={uid} role={load.role} />;
}

function Panel({ tab, actor, role }: { tab: AdminTab; actor: string; role: AdminRole }) {
  switch (tab) {
    case 'signalements':
      return <ReportsTab actor={actor} />;
    case 'recentes':
      return <RecentTab actor={actor} role={role} />;
    case 'paiements':
      return <PaymentsTab actor={actor} />;
    case 'badges':
      return <BadgesTab actor={actor} role={role} />;
    case 'utilisateurs':
      return <MembersTab actor={actor} />;
    case 'mises-en-avant':
      return <PromotionsTab actor={actor} />;
    case 'reglages':
      return <SettingsTab actor={actor} />;
    case 'equipe':
      return <TeamTab actor={actor} />;
    case 'journal':
      return <JournalTab />;
    case 'sante':
      return <HealthTab role={role} />;
    case 'nettoyage':
      return <CleanupTab actor={actor} />;
  }
}

function AdminApp({ actor, role }: { actor: string; role: AdminRole }) {
  const tabs = tabsFor(role);
  const [tab, setTab] = useState<AdminTab>(() => tabFromHash(location.hash, role));
  const navRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const onHash = () => setTab(tabFromHash(location.hash, role));
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, [role]);

  // Keep the current tab visible in the scrolling tab bar.
  useEffect(() => {
    navRef.current
      ?.querySelector('[aria-current="page"]')
      ?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [tab]);

  // The bar scrolls (owner's request of 3 Oct 2026): faded edges and arrows where tabs are hidden.
  const [more, setMore] = useState({ before: false, after: false });
  useEffect(() => {
    const nav = navRef.current;
    if (!nav) return;
    const measure = () => {
      const max = nav.scrollWidth - nav.clientWidth;
      setMore({ before: nav.scrollLeft > 4, after: nav.scrollLeft < max - 4 });
    };
    measure();
    nav.addEventListener('scroll', measure, { passive: true });
    window.addEventListener('resize', measure);
    return () => {
      nav.removeEventListener('scroll', measure);
      window.removeEventListener('resize', measure);
    };
  }, []);
  const slide = (dir: 1 | -1) => {
    const nav = navRef.current;
    if (!nav) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    nav.scrollBy({ left: dir * nav.clientWidth * 0.7, behavior: reduce ? 'auto' : 'smooth' });
  };

  return (
    <div class="page">
      <h1 class="page__title">{fr.headings.admin}</h1>
      <p class="adm-role">{fr.admin.role[role]}</p>
      <div
        class={`adm-tabs-wrap${more.before ? ' adm-tabs-wrap--before' : ''}${more.after ? ' adm-tabs-wrap--after' : ''}`}
      >
        <nav class="adm-tabs" aria-label={fr.admin.tabsLabel} ref={navRef}>
          {tabs.map((id) => (
            <a
              key={id}
              class="adm-tabs__tab"
              href={`#${id}`}
              data-tab={id}
              aria-current={id === tab ? 'page' : undefined}
            >
              {fr.admin.tabs[id]}
            </a>
          ))}
        </nav>
        {/* Pointer shortcuts only: the tabs themselves stay reachable with the keyboard. */}
        <button
          type="button"
          class="adm-tabs__arrow adm-tabs__arrow--before"
          tabIndex={-1}
          aria-label={fr.admin.tabsBefore}
          onClick={() => slide(-1)}
        >
          <Icon name="chevronDown" />
        </button>
        <button
          type="button"
          class="adm-tabs__arrow adm-tabs__arrow--after"
          tabIndex={-1}
          aria-label={fr.admin.tabsAfter}
          onClick={() => slide(1)}
        >
          <Icon name="chevronDown" />
        </button>
      </div>
      <section class="adm-panel" aria-labelledby="adm-panel-title">
        <h2 class="adm-panel__title" id="adm-panel-title">
          {fr.admin.tabs[tab]}
        </h2>
        <div key={tab} class="adm-panel__body panel-in">
          <Panel tab={tab} actor={actor} role={role} />
        </div>
      </section>
    </div>
  );
}

mountPage(<AuthGate requirement="profile">{(session) => <AdminRoot session={session} />}</AuthGate>);
