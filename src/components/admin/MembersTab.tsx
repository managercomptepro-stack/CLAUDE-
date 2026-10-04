/**
 * « Utilisateurs » (super-admin): search by pseudo or uid, every member page by page (owner's
 * request of 3 Oct 2026), the deletion requests first, then a member's record: strikes,
 * block/unblock publication, erase an account whose deletion was asked.
 */
import { useState } from 'preact/hooks';
import { cityBySlug } from '../../data/cities';
import { ACCOUNT_CAP_MAX, ACCOUNT_PURGE_DAYS } from '../../data/limits';
import { DEFAULT_SETTINGS } from '../../data/settings';
import { fr } from '../../i18n/fr';
import {
  eraseAccount,
  findMember,
  loadDeletionRequests,
  loadMember,
  loadMembers,
  loadSettingsDoc,
  setListingCap,
  setPublishBan,
  type MemberRecord,
  type MemberRow,
} from '../../lib/admin';
import { reportError } from '../../lib/errors';
import { ageFrom, formatDate } from '../../lib/format';
import { EmptyState } from '../EmptyState';
import { showToast } from '../Toast';
import { AdminListingRow, Loaded, LoadMore, ReasonForm, SearchBox, useLoad, usePaged } from './common';

const DAY_MS = 86_400_000;
const purgeDate = (asked: Date) => new Date(asked.getTime() + ACCOUNT_PURGE_DAYS * DAY_MS);

/** Shared by « Utilisateurs » and « Mises en avant »: search, then show the member. */
export function useMemberSearch() {
  const [member, setMember] = useState<MemberRecord | null | undefined>(undefined);
  const [error, setError] = useState('');
  return {
    member,
    setMember,
    error,
    search: async (key: string) => {
      setError('');
      try {
        setMember(await findMember(key));
      } catch (e) {
        setMember(undefined);
        setError(reportError(e, 'admin-search'));
      }
    },
    open: async (uid: string) => {
      setError('');
      try {
        setMember(await loadMember(uid));
      } catch (e) {
        setMember(undefined);
        setError(reportError(e, 'admin-search'));
      }
    },
  };
}

export function SearchResult({ found, error }: { found: MemberRecord | null | undefined; error: string }) {
  if (error) {
    return (
      <p class="field__error" role="alert">
        {error}
      </p>
    );
  }
  return found === null ? <EmptyState title={fr.admin.members.notFound} /> : null;
}

function MemberFacts({ m }: { m: MemberRecord }) {
  const t = fr.admin.members;
  return (
    <dl class="facts">
      <dt>{t.uid}</dt>
      <dd class="adm-mono">{m.uid}</dd>
      {m.email && (
        <>
          <dt>{t.email}</dt>
          <dd>{m.email}</dd>
        </>
      )}
      {m.city && (
        <>
          <dt>{t.city}</dt>
          <dd>{cityBySlug(m.city)?.name ?? m.city}</dd>
        </>
      )}
      {m.birthDate && (
        <>
          <dt>{t.age}</dt>
          <dd>{fr.account.age(ageFrom(m.birthDate))}</dd>
        </>
      )}
      {m.createdAt && (
        <>
          <dt>{t.since}</dt>
          <dd>{formatDate(m.createdAt)}</dd>
        </>
      )}
      <dt>{t.strikes}</dt>
      <dd data-strikes>{m.strikes}</dd>
      <dt>{t.publication}</dt>
      <dd data-publication>{m.publishBanned ? t.banned : t.allowed}</dd>
      <dt>{t.badge}</dt>
      <dd>{m.verified ? t.verified : t.notVerified}</dd>
      <dt>{t.role}</dt>
      <dd>{m.role ? fr.admin.role[m.role] : t.noRole}</dd>
      {(m.deletionRequestedAt || m.erasedAt) && (
        <>
          <dt>{t.deletion}</dt>
          <dd data-deletion>
            {m.erasedAt
              ? t.erasedOn(formatDate(m.erasedAt))
              : m.deletionRequestedAt &&
                t.deletionAsked(
                  formatDate(m.deletionRequestedAt),
                  formatDate(purgeDate(m.deletionRequestedAt)),
                )}
          </dd>
        </>
      )}
    </dl>
  );
}

const loadGeneralCap = async () => ((await loadSettingsDoc()) ?? DEFAULT_SETTINGS).maxActiveListings;

/**
 * Cap of active listings for this account, above or below the general one (owner's request of
 * 3 Oct 2026); empty = the general setting. Audited.
 */
function ListingCap({
  actor,
  m,
  onSaved,
}: {
  actor: string;
  m: MemberRecord;
  onSaved: (cap: number | null) => void;
}) {
  const t = fr.admin.members;
  const general = useLoad(loadGeneralCap);
  const [value, setValue] = useState(m.maxListings === null ? '' : String(m.maxListings));
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const id = `cap-${m.uid}`;

  async function save(cap: number | null) {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      await setListingCap(actor, m, cap);
      setValue(cap === null ? '' : String(cap));
      showToast(cap === null ? t.capReset : t.capSaved, 'success');
      onSaved(cap);
    } catch (e) {
      setError(reportError(e, 'admin-cap'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      class="adm-cap"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        const n = Number(value.trim());
        if (!/^\d{1,2}$/.test(value.trim()) || n > ACCOUNT_CAP_MAX) {
          setError(t.capInvalid(ACCOUNT_CAP_MAX));
          return;
        }
        void save(n);
      }}
    >
      <div class="field">
        <label class="field__label" for={id}>
          {t.cap}
        </label>
        <input
          id={id}
          class="field__control"
          inputMode="numeric"
          value={value}
          placeholder={general.state.kind === 'ready' ? String(general.state.data) : ''}
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={`${id}-hint`}
          onInput={(e) => setValue(e.currentTarget.value)}
        />
        <p class="field__hint" id={`${id}-hint`}>
          {m.maxListings === null ? t.capGeneral : t.capOwn(m.maxListings)}
          {general.state.kind === 'ready' && ` ${t.capGeneralValue(general.state.data)}`}
        </p>
        {error && (
          <p class="field__error" role="alert">
            {error}
          </p>
        )}
      </div>
      <div class="adm-actions">
        <button type="submit" class="button button--primary" disabled={busy}>
          {t.capSave}
        </button>
        {m.maxListings !== null && (
          <button
            type="button"
            class="button button--secondary"
            disabled={busy}
            onClick={() => void save(null)}
          >
            {t.capBack}
          </button>
        )}
      </div>
    </form>
  );
}

export function MemberHead({ m }: { m: MemberRecord }) {
  return <h3 class="card__title">{m.pseudo ?? fr.admin.members.noProfile}</h3>;
}

function MemberLine({ r, onOpen }: { r: MemberRow; onOpen: (uid: string) => void }) {
  const t = fr.admin.members;
  const flags = t.flags(r.strikes, r.publishBanned);
  return (
    <li class="adm-item adm-item--row" data-member-row={r.uid}>
      <div class="adm-item__main">
        <p class="adm-item__title">{r.pseudo ?? t.noProfile}</p>
        <p class="adm-item__meta">
          {[
            r.email,
            r.city ? (cityBySlug(r.city)?.name ?? r.city) : null,
            r.createdAt ? formatDate(r.createdAt) : null,
          ]
            .filter(Boolean)
            .join(' · ')}
        </p>
        {r.deletionRequestedAt && !r.erasedAt && (
          <p class="adm-item__meta adm-item__meta--warn">
            {t.requestLine(formatDate(r.deletionRequestedAt), formatDate(purgeDate(r.deletionRequestedAt)))}
          </p>
        )}
        {flags && <p class="adm-item__meta adm-item__meta--warn">{flags}</p>}
      </div>
      <button type="button" class="button button--secondary" onClick={() => onOpen(r.uid)}>
        {t.open}
      </button>
    </li>
  );
}

function DeletionRequests({ onOpen }: { onOpen: (uid: string) => void }) {
  const requests = useLoad(loadDeletionRequests);
  return (
    <Loaded state={requests.state} reload={requests.reload}>
      {(rows) =>
        rows.length > 0 && (
          <section class="stack stack--tight" aria-labelledby="deletion-requests">
            <h3 class="adm-subtitle" id="deletion-requests">
              {fr.admin.members.requests} ({rows.length})
            </h3>
            <ul class="adm-list">
              {rows.map((r) => (
                <MemberLine key={r.uid} r={r} onOpen={onOpen} />
              ))}
            </ul>
          </section>
        )
      }
    </Loaded>
  );
}

const firstMembers = () => loadMembers(null);

function AllMembers({ onOpen }: { onOpen: (uid: string) => void }) {
  const t = fr.admin.members;
  const list = usePaged(firstMembers, loadMembers);
  return (
    <section class="stack stack--tight" aria-labelledby="all-members">
      <h3 class="adm-subtitle" id="all-members">
        {t.all}
      </h3>
      <Loaded state={list.head.state} reload={list.head.reload}>
        {() =>
          list.items.length === 0 ? (
            <p class="field__hint">{t.none}</p>
          ) : (
            <ul class="adm-list">
              {list.items.map((r) => (
                <MemberLine key={r.uid} r={r} onOpen={onOpen} />
              ))}
            </ul>
          )
        }
      </Loaded>
      <LoadMore
        show={list.cursor !== null}
        busy={list.busy}
        error={list.error}
        onClick={() => void list.loadMore()}
      />
    </section>
  );
}

export function MembersTab({ actor }: { actor: string }) {
  const t = fr.admin.members;
  const s = useMemberSearch();
  const [busy, setBusy] = useState(false);
  const [erasing, setErasing] = useState(false);
  /** Bumped after an erase: both lists are read again. */
  const [version, setVersion] = useState(0);
  const m = s.member;

  async function toggleBan(member: MemberRecord) {
    setBusy(true);
    try {
      const banned = !member.publishBanned;
      await setPublishBan(actor, member, banned);
      s.setMember({ ...member, publishBanned: banned });
      showToast(banned ? t.bannedToast : t.unbannedToast, 'success');
    } catch (e) {
      showToast(reportError(e, 'admin-ban'), 'error');
    } finally {
      setBusy(false);
    }
  }

  const open = (uid: string) => {
    setErasing(false);
    void s
      .open(uid)
      .then(() => document.querySelector('[data-member-card]')?.scrollIntoView({ block: 'start' }));
  };

  return (
    <div class="stack">
      <SearchBox id="member-search" label={t.search} onSearch={s.search} />
      <SearchResult found={m} error={s.error} />
      {m && (
        <section class="card panel-in" data-member-card={m.uid}>
          <MemberHead m={m} />
          <MemberFacts m={m} />
          {m.hasRecord && !m.erasedAt && (
            <button
              type="button"
              class={`button button--block ${m.publishBanned ? 'button--primary' : 'button--danger'}`}
              disabled={busy}
              onClick={() => void toggleBan(m)}
            >
              {m.publishBanned ? t.unban : t.ban}
            </button>
          )}
          {m.hasRecord && !m.erasedAt && !m.deletionRequestedAt && (
            <ListingCap actor={actor} m={m} onSaved={(cap) => s.setMember({ ...m, maxListings: cap })} />
          )}
          {m.deletionRequestedAt &&
            !m.erasedAt &&
            (erasing ? (
              <ReasonForm
                id={`erase-${m.uid}`}
                title={t.eraseTitle}
                hint={t.eraseBody}
                presets={[]}
                confirmLabel={t.erase}
                onCancel={() => setErasing(false)}
                onConfirm={async (reason) => {
                  await eraseAccount(actor, m, reason);
                  showToast(t.erased, 'success');
                  s.setMember(undefined);
                  setErasing(false);
                  setVersion((v) => v + 1);
                }}
              />
            ) : (
              <button
                type="button"
                class="button button--danger button--block"
                onClick={() => setErasing(true)}
              >
                {t.erase}
              </button>
            ))}
          <h4 class="adm-subtitle">{t.listings}</h4>
          {m.listings.length === 0 ? (
            <p class="field__hint">{t.noListings}</p>
          ) : (
            <ul class="adm-list">
              {m.listings.map((l) => (
                <AdminListingRow key={l.id} l={l} />
              ))}
            </ul>
          )}
          <button
            type="button"
            class="link-button link-button--center"
            onClick={() => s.setMember(undefined)}
          >
            {t.close}
          </button>
        </section>
      )}
      <DeletionRequests key={`r${version}`} onOpen={open} />
      <AllMembers key={`a${version}`} onOpen={open} />
    </div>
  );
}
