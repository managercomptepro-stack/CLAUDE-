/**
 * The member's stored notifications (`users/{uid}/notifications`, ARCHITECTURE § 4): written by
 * an admin, read and marked as read by their owner only.
 */
import {
  collection,
  doc,
  getCount,
  getDocs,
  limit,
  orderBy,
  query,
  Timestamp,
  where,
  writeBatch,
} from 'firebase/firestore/lite';
import { NOTIFICATION_TYPES, type NotificationType } from '../data/notifications';
import { auth } from '../firebase/auth';
import { db } from '../firebase/lite';
import { saveUnread } from '../shell/bell';

export interface StoredNotification {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  read: boolean;
  createdAt: Date;
}

/** Shown in /compte; older ones are not displayed. */
export const NOTIFICATIONS_SHOWN = 30;

const box = (uid: string) => collection(db(), 'users', uid, 'notifications');

function isType(v: unknown): v is NotificationType {
  return typeof v === 'string' && (NOTIFICATION_TYPES as readonly string[]).includes(v);
}

export async function loadNotifications(uid: string): Promise<StoredNotification[]> {
  const snap = await getDocs(query(box(uid), orderBy('createdAt', 'desc'), limit(NOTIFICATIONS_SHOWN)));
  return snap.docs.flatMap((d) => {
    const v = d.data();
    if (!isType(v['type'])) return [];
    return [
      {
        id: d.id,
        type: v['type'],
        title: String(v['title'] ?? ''),
        body: String(v['body'] ?? ''),
        read: v['read'] === true,
        createdAt: v['createdAt'] instanceof Timestamp ? v['createdAt'].toDate() : new Date(0),
      },
    ];
  });
}

/** Marks the given notifications as read (the only change the rules allow the owner). */
export async function markRead(uid: string, ids: readonly string[]): Promise<void> {
  if (ids.length === 0) return;
  const batch = writeBatch(db());
  for (const id of ids) batch.update(doc(box(uid), id), { read: true });
  await batch.commit();
}

/** Counts the unread notifications and refreshes the header bell. */
export async function refreshBell(uid: string): Promise<void> {
  const snap = await getCount(query(box(uid), where('read', '==', false)));
  // Signed out while counting (« Se déconnecter » clicked meanwhile): the bell must not come back.
  if (auth().currentUser?.uid !== uid) return;
  saveUnread(snap.data().count);
}
