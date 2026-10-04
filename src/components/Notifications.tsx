import { useEffect, useRef, useState } from 'preact/hooks';
import { fr } from '../i18n/fr';
import { reportError } from '../lib/errors';
import { formatDate, formatTime } from '../lib/format';
import { dayWord, listingReminders, type OwnListing, type Reminder } from '../lib/listing-status';
import type { StoredNotification } from '../lib/notifications';
import { EmptyState } from './EmptyState';
import { Skeleton } from './Skeleton';

// Firestore is loaded on demand (already in cache once AuthGate has run).
const notificationsApi = () => import('../lib/notifications');

type Load =
  { kind: 'loading' } | { kind: 'ready'; items: StoredNotification[] } | { kind: 'error'; message: string };

export const NOTIFICATIONS_ANCHOR = 'notifications';

interface Props {
  uid: string;
  /** The member's listings once « Mes annonces » has loaded them (computed reminders). */
  listings: OwnListing[] | null;
  /** Shown before « Voir tout » (owner's request of 3 Oct 2026: a preview under the profile). */
  preview?: number;
}

/**
 * Notifications of /compte (SPEC § 9): computed reminders (never stored) then the stored
 * notifications, newest first. Unread ones are shown as « Nouveau » and marked as read.
 */
export function Notifications({ uid, listings, preview = Infinity }: Props) {
  const [load, setLoad] = useState<Load>({ kind: 'loading' });
  // Arriving from the bell: everything at once.
  const [all, setAll] = useState(() => location.hash === `#${NOTIFICATIONS_ANCHOR}`);
  const [attempt, setAttempt] = useState(0);
  const ref = useRef<HTMLElement>(null);
  /** Notifications already marked as read during this visit. */
  const marked = useRef(new Set<string>());

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const api = await notificationsApi();
        const items = await api.loadNotifications(uid);
        if (cancelled) return;
        setLoad({ kind: 'ready', items });
      } catch (error) {
        if (!cancelled) setLoad({ kind: 'error', message: reportError(error, 'notifications') });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [uid, attempt]);

  // Arriving from the bell (/compte#notifications): the section exists only now.
  useEffect(() => {
    if (load.kind === 'ready' && location.hash === `#${NOTIFICATIONS_ANCHOR}`) {
      ref.current?.scrollIntoView({ block: 'start' });
    }
  }, [load.kind]);

  const t = fr.notifications;
  const reminders = listings ? listingReminders(listings) : [];
  const total = reminders.length + (load.kind === 'ready' ? load.items.length : 0);
  const room = all ? Infinity : preview;
  const shownReminders = reminders.slice(0, room);
  const shownItems =
    load.kind === 'ready' ? load.items.slice(0, Math.max(0, room - shownReminders.length)) : [];

  // Shown on screen = read (the ones still hidden behind « Voir tout » stay unread). The badge is
  // recounted afterwards. A failure here must not hide the list already shown.
  const unseenKey = shownItems
    .filter((n) => !n.read && !marked.current.has(n.id))
    .map((n) => n.id)
    .join();
  useEffect(() => {
    if (!unseenKey) return;
    const ids = unseenKey.split(',');
    for (const id of ids) marked.current.add(id);
    void notificationsApi()
      .then(async (api) => {
        await api.markRead(uid, ids);
        await api.refreshBell(uid);
      })
      .catch((error: unknown) => reportError(error, 'notifications-read'));
  }, [uid, unseenKey]);

  return (
    <section class="card" id={NOTIFICATIONS_ANCHOR} ref={ref} aria-labelledby="notifications-title">
      <h2 class="card__title" id="notifications-title">
        {t.title}
      </h2>
      {load.kind === 'loading' && <Skeleton cards={1} title={false} />}
      {load.kind === 'error' && (
        <EmptyState title={load.message}>
          <button type="button" class="button button--secondary" onClick={() => setAttempt((n) => n + 1)}>
            {fr.retry}
          </button>
        </EmptyState>
      )}
      {load.kind === 'ready' &&
        (reminders.length === 0 && load.items.length === 0 ? (
          <p class="field__hint">{t.empty}</p>
        ) : (
          <ul class="notes">
            {shownReminders.map((r) => (
              <ReminderItem key={`${r.kind}-${r.listingId}`} reminder={r} />
            ))}
            {shownItems.map((n) => (
              <li key={n.id} class={`note${n.read ? '' : ' note--unread'}`} data-notification={n.id}>
                <div class="note__head">
                  <p class="note__title">{n.title}</p>
                  {!n.read && <span class="note__tag">{t.unread}</span>}
                </div>
                {n.body && <p class="note__body">{n.body}</p>}
                <p class="note__date">{formatDate(n.createdAt)}</p>
              </li>
            ))}
          </ul>
        ))}
      {load.kind === 'ready' && total > room && (
        <button type="button" class="link-button" onClick={() => setAll(true)}>
          {t.showAll(total)}
        </button>
      )}
    </section>
  );
}

function ReminderItem({ reminder: r }: { reminder: Reminder }) {
  const t = fr.notifications;
  const text =
    r.kind === 'expiry'
      ? t.expiry(r.title, r.daysLeft)
      : t.boostEnding(
          r.tier,
          r.title,
          dayWord(r.until) === 'today' ? 'today' : 'tomorrow',
          formatTime(r.until),
        );
  return (
    <li class="note note--reminder" data-reminder={r.kind}>
      <div class="note__head">
        <p class="note__body">{text}</p>
        <span class="note__tag">{t.reminder}</span>
      </div>
    </li>
  );
}
