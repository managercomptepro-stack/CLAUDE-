/** Pieces shared by the admin tabs: loading states, listing row, reason form, member search. */
import type { ComponentChildren } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import type { QueryDocumentSnapshot } from 'firebase/firestore/lite';
import { cityBySlug } from '../../data/cities';
import { TEXT_MAX } from '../../data/limits';
import { fr } from '../../i18n/fr';
import { reasonError } from '../../lib/admin-logic';
import type { AdminListing, Page } from '../../lib/admin';
import { reportError } from '../../lib/errors';
import { formatDate } from '../../lib/format';
import { listingState } from '../../lib/listing-status';
import { listingPhotoUrl, parsePhotoRef } from '../../lib/photo-url';
import { EmptyState } from '../EmptyState';
import { listingHref, PromotionTag } from '../ListingCard';
import { Skeleton } from '../Skeleton';

export type LoadState<T> =
  { kind: 'loading' } | { kind: 'ready'; data: T } | { kind: 'error'; message: string };

/** Runs `load` (must be stable: module function or useCallback) and keeps its result. */
export function useLoad<T>(load: () => Promise<T>) {
  const [state, setState] = useState<LoadState<T>>({ kind: 'loading' });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let cancelled = false;
    load()
      .then((data) => !cancelled && setState({ kind: 'ready', data }))
      .catch(
        (e: unknown) => !cancelled && setState({ kind: 'error', message: reportError(e, 'admin-load') }),
      );
    return () => {
      cancelled = true;
    };
  }, [load, attempt]);
  return {
    state,
    reload: () => {
      setState({ kind: 'loading' });
      setAttempt((n) => n + 1);
    },
    update: (fn: (d: T) => T) =>
      setState((s) => (s.kind === 'ready' ? { kind: 'ready', data: fn(s.data) } : s)),
  };
}

/** Skeleton while loading, error with « Réessayer », then the content. */
export function Loaded<T>({
  state,
  reload,
  children,
}: {
  state: LoadState<T>;
  reload: () => void;
  children: (data: T) => ComponentChildren;
}) {
  if (state.kind === 'loading') return <Skeleton cards={2} title={false} />;
  if (state.kind === 'error') {
    return (
      <EmptyState title={state.message}>
        <button type="button" class="button button--primary" onClick={reload}>
          {fr.retry}
        </button>
      </EmptyState>
    );
  }
  return <>{children(state.data)}</>;
}

/** Paginated list (« Charger plus »). Both loaders must be stable (module functions). */
export function usePaged<T>(
  first: () => Promise<Page<T>>,
  next: (after: QueryDocumentSnapshot) => Promise<Page<T>>,
) {
  const head = useLoad(first);
  const [more, setMore] = useState<Page<T> | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const ready = head.state.kind === 'ready' ? head.state.data : null;
  const cursor = more ? more.cursor : (ready?.cursor ?? null);
  return {
    head,
    items: ready ? [...ready.items, ...(more?.items ?? [])] : [],
    cursor,
    busy,
    error,
    loadMore: async () => {
      if (!cursor || busy) return;
      setBusy(true);
      setError('');
      try {
        const page = await next(cursor);
        setMore((m) => ({ items: [...(m?.items ?? []), ...page.items], cursor: page.cursor }));
      } catch (e) {
        setError(reportError(e, 'admin-more'));
      } finally {
        setBusy(false);
      }
    },
  };
}

export function LoadMore({
  show,
  busy,
  error,
  onClick,
}: {
  show: boolean;
  busy: boolean;
  error: string;
  onClick: () => void;
}) {
  return (
    <>
      {error && (
        <p class="field__error" role="alert">
          {error}
        </p>
      )}
      {show && (
        <button
          type="button"
          class="button button--secondary button--block"
          disabled={busy}
          onClick={onClick}
        >
          {fr.admin.loadMore}
        </button>
      )}
    </>
  );
}

/** Tags of a listing as the moderation sees it. */
function ListingTags({ l }: { l: AdminListing }) {
  const t = fr.admin.listing;
  const s = listingState(l);
  const tier = s.boost?.tier ?? null;
  return (
    <p class="adm-item__tags">
      {l.status === 'removed' && <span class="adm-tag adm-tag--danger">{t.removed}</span>}
      {l.status === 'closed' && <span class="adm-tag adm-tag--warn">{t.closed}</span>}
      {l.hidden && <span class="adm-tag adm-tag--warn">{t.hidden}</span>}
      {s.status === 'expired' && <span class="adm-tag">{t.expired}</span>}
      {tier && <PromotionTag tier={tier} />}
      {l.reportsCount > 0 && <span class="adm-tag adm-tag--warn">{t.reports(l.reportsCount)}</span>}
    </p>
  );
}

/** One listing in an admin list; the actions come from the tab. */
export function AdminListingRow({ l, children }: { l: AdminListing; children?: ComponentChildren }) {
  const t = fr.admin.listing;
  const main = l.photos[0];
  const size = main ? parsePhotoRef(main) : null;
  const city = cityBySlug(l.citySlug)?.name ?? l.citySlug;
  return (
    <li class="adm-item" data-listing={l.id}>
      <div class="adm-item__main">
        {main ? (
          <img
            class="adm-item__thumb"
            src={listingPhotoUrl(main, 360) ?? ''}
            width={size?.width}
            height={size?.height}
            alt=""
            loading="lazy"
          />
        ) : (
          <span class="adm-item__thumb" aria-hidden="true" />
        )}
        <div class="adm-item__text">
          <p class="adm-item__title">{l.title}</p>
          <p class="adm-item__meta">
            {t.by(l.pseudo)} · {city} · {t.created(formatDate(l.createdAt))}
          </p>
          <ListingTags l={l} />
        </div>
      </div>
      {l.status === 'removed' && l.removedReason && (
        <p class="field__hint">{t.removedReason(l.removedReason)}</p>
      )}
      <details class="adm-item__more">
        <summary>{t.text}</summary>
        <p class="adm-item__desc">{l.description}</p>
        {l.offer && (
          <p class="adm-item__desc">
            <strong>{t.offer} : </strong>
            {l.offer}
          </p>
        )}
        <p class="adm-item__links">
          <a href={listingHref(l.id)} target="_blank" rel="noopener noreferrer">
            {t.open}
          </a>
          <a href={`/membre?u=${encodeURIComponent(l.ownerUid)}`} target="_blank" rel="noopener noreferrer">
            {t.member}
          </a>
        </p>
      </details>
      {children}
    </li>
  );
}

interface ReasonFormProps {
  id: string;
  title: string;
  hint: string;
  presets: readonly string[];
  confirmLabel: string;
  onConfirm: (reason: string) => Promise<void>;
  onCancel: () => void;
}

/** Mandatory reason (3–300 characters) with a few one-tap suggestions. */
export function ReasonForm({ id, title, hint, presets, confirmLabel, onConfirm, onCancel }: ReasonFormProps) {
  const t = fr.admin;
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: Event) {
    e.preventDefault();
    if (busy) return;
    const problem = reasonError(reason);
    setError(problem ?? '');
    if (problem) return;
    setBusy(true);
    try {
      await onConfirm(reason.trim());
    } catch (err) {
      setError(reportError(err, 'admin-action'));
      setBusy(false);
    }
  }

  return (
    <form class="adm-reason" noValidate onSubmit={(e) => void submit(e)}>
      <p class="adm-reason__title">{title}</p>
      <p class="field__hint">{hint}</p>
      {presets.length > 0 && (
        <div class="adm-chips" role="group" aria-label={t.actions.presets}>
          {presets.map((p) => (
            <button
              key={p}
              type="button"
              class="adm-chip"
              aria-pressed={reason === p}
              onClick={() => setReason(p)}
            >
              {p}
            </button>
          ))}
        </div>
      )}
      <div class="field">
        <label class="field__label" for={id}>
          {t.actions.reason}
        </label>
        <textarea
          id={id}
          class="field__control"
          rows={2}
          maxLength={TEXT_MAX.reason}
          value={reason}
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          onInput={(e) => setReason(e.currentTarget.value)}
        />
        {error && (
          <p class="field__error" id={`${id}-error`} role="alert">
            {error}
          </p>
        )}
      </div>
      <div class="adm-actions">
        <button type="submit" class="button button--danger" disabled={busy}>
          {confirmLabel}
        </button>
        <button type="button" class="button button--secondary" disabled={busy} onClick={onCancel}>
          {t.cancel}
        </button>
      </div>
    </form>
  );
}

/** Pseudo/uid search box (Utilisateurs, Mises en avant). */
export function SearchBox({
  id,
  label,
  onSearch,
}: {
  id: string;
  label: string;
  onSearch: (key: string) => Promise<void>;
}) {
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState(false);
  return (
    <form
      class="adm-search"
      role="search"
      onSubmit={async (e) => {
        e.preventDefault();
        if (busy || !value.trim()) return;
        setBusy(true);
        try {
          await onSearch(value);
        } finally {
          setBusy(false);
        }
      }}
    >
      <label class="field__label" for={id}>
        {label}
      </label>
      <div class="adm-search__row">
        <input
          id={id}
          class="field__control"
          type="search"
          autoComplete="off"
          autoCapitalize="off"
          spellcheck={false}
          value={value}
          onInput={(e) => setValue(e.currentTarget.value)}
        />
        <button type="submit" class="button button--primary" disabled={busy}>
          {busy ? fr.admin.members.searching : fr.admin.members.searchButton}
        </button>
      </div>
    </form>
  );
}
