/** « Signalements » and « Récentes » (moderators and super-admin). */
import { useState } from 'preact/hooks';
import { REPORT_REASONS } from '../../data/reports';
import { fr } from '../../i18n/fr';
import {
  clearReports,
  loadRecent,
  loadReportQueue,
  removeListing,
  warnMember,
  type AdminListing,
} from '../../lib/admin';
import { reportError } from '../../lib/errors';
import { EmptyState } from '../EmptyState';
import { showToast } from '../Toast';
import type { AdminRole } from '../../lib/admin-logic';
import { AdminListingRow, Loaded, LoadMore, ReasonForm, useLoad, usePaged } from './common';
import { PromotionForm } from './PromotionsTab';

const REMOVE_PRESETS = REPORT_REASONS.filter((r) => r !== 'other').map((r) => fr.report.reasons[r]);

/**
 * Supprimer (motif, strike) · Avertir · Rétablir / Classer sans suite · Mettre en avant (super-admin,
 * « Récentes », owner's request of 3 Oct 2026).
 */
function ModerationActions({
  actor,
  l,
  onChange,
  canPromote = false,
}: {
  actor: string;
  l: AdminListing;
  onChange: (next: AdminListing | null) => void;
  canPromote?: boolean;
}) {
  const t = fr.admin.actions;
  const [mode, setMode] = useState<'remove' | 'warn' | 'promote' | null>(null);
  const [busy, setBusy] = useState(false);

  if (mode === 'promote') {
    return (
      <div class="stack stack--tight panel-in">
        <PromotionForm
          actor={actor}
          l={l}
          onDone={(next) => {
            onChange(next);
            setMode(null);
          }}
        />
        <button type="button" class="link-button" onClick={() => setMode(null)}>
          {fr.admin.cancel}
        </button>
      </div>
    );
  }

  if (mode === 'remove') {
    return (
      <ReasonForm
        id={`remove-${l.id}`}
        title={t.removeTitle}
        hint={t.removeHint}
        presets={REMOVE_PRESETS}
        confirmLabel={t.remove}
        onCancel={() => setMode(null)}
        onConfirm={async (reason) => {
          const sanction = await removeListing(actor, l, reason);
          showToast(
            sanction ? t.removed(sanction.strikes, sanction.publishBanned) : t.removedNoRecord,
            'success',
          );
          onChange({ ...l, status: 'removed', removedReason: reason });
          setMode(null);
        }}
      />
    );
  }
  if (mode === 'warn') {
    return (
      <ReasonForm
        id={`warn-${l.id}`}
        title={t.warnTitle}
        hint={t.warnHint}
        presets={REMOVE_PRESETS}
        confirmLabel={t.warn}
        onCancel={() => setMode(null)}
        onConfirm={async (reason) => {
          await warnMember(actor, l, reason);
          showToast(t.warned, 'success');
          setMode(null);
        }}
      />
    );
  }
  const reported = l.hidden || l.reportsCount > 0;
  return (
    <div class="adm-actions">
      {l.status === 'active' && reported && (
        <button
          type="button"
          class="button button--secondary"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              await clearReports(actor, l);
              showToast(l.hidden ? t.restored : t.dismissed, 'success');
              onChange(null);
            } catch (e) {
              showToast(reportError(e, 'admin-restore'), 'error');
              setBusy(false);
            }
          }}
        >
          {l.hidden ? t.restore : t.dismiss}
        </button>
      )}
      {l.status === 'active' && (
        <button type="button" class="button button--danger" disabled={busy} onClick={() => setMode('remove')}>
          {t.remove}
        </button>
      )}
      <button type="button" class="button button--secondary" disabled={busy} onClick={() => setMode('warn')}>
        {t.warn}
      </button>
      {canPromote && l.status === 'active' && (
        <button type="button" class="button button--gold" disabled={busy} onClick={() => setMode('promote')}>
          {t.promote}
        </button>
      )}
    </div>
  );
}

export function ReportsTab({ actor }: { actor: string }) {
  const { state, reload, update } = useLoad(loadReportQueue);
  return (
    <Loaded state={state} reload={reload}>
      {(queue) =>
        queue.length === 0 ? (
          <EmptyState title={fr.admin.reports.empty} />
        ) : (
          <ul class="adm-list">
            {queue.map((q) => (
              <AdminListingRow key={q.listing.id} l={q.listing}>
                {q.reasons.length > 0 && (
                  <ul class="adm-reasons">
                    {q.reasons.map((r) => (
                      <li key={r.reason} class={r.reason === 'minor' ? 'adm-reasons__minor' : undefined}>
                        {fr.report.reasons[r.reason]} × {r.count}
                      </li>
                    ))}
                  </ul>
                )}
                {q.uncounted > 0 && (
                  <p class="field__hint" data-uncounted>
                    {fr.admin.reports.uncounted(q.uncounted)}
                  </p>
                )}
                {q.notes.length > 0 && (
                  <details class="adm-item__more">
                    <summary>{fr.admin.reports.notes}</summary>
                    <ul class="adm-notes">
                      {q.notes.map((n, i) => (
                        <li key={i}>{n}</li>
                      ))}
                    </ul>
                  </details>
                )}
                <ModerationActions
                  actor={actor}
                  l={q.listing}
                  // Handled (removed, restored, dismissed): it leaves the queue.
                  onChange={() => update((all) => all.filter((x) => x.listing.id !== q.listing.id))}
                />
              </AdminListingRow>
            ))}
          </ul>
        )
      }
    </Loaded>
  );
}

const firstRecent = () => loadRecent(null);

export function RecentTab({ actor, role }: { actor: string; role: AdminRole }) {
  const paged = usePaged(firstRecent, loadRecent);
  const [changed, setChanged] = useState<Record<string, AdminListing>>({});
  return (
    <Loaded state={paged.head.state} reload={paged.head.reload}>
      {() => {
        const items = paged.items.map((l) => changed[l.id] ?? l);
        if (items.length === 0) return <EmptyState title={fr.admin.recent.empty} />;
        return (
          <>
            <ul class="adm-list">
              {items.map((l) => (
                <AdminListingRow key={l.id} l={l}>
                  <ModerationActions
                    actor={actor}
                    l={l}
                    canPromote={role === 'super'}
                    onChange={(next) =>
                      setChanged((c) => ({ ...c, [l.id]: next ?? { ...l, hidden: false, reportsCount: 0 } }))
                    }
                  />
                </AdminListingRow>
              ))}
            </ul>
            <LoadMore
              show={paged.cursor !== null}
              busy={paged.busy}
              error={paged.error}
              onClick={() => void paged.loadMore()}
            />
          </>
        );
      }}
    </Loaded>
  );
}
