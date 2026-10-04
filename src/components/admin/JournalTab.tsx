/** « Journal » (super-admin): the append-only `auditLog`, newest first. */
import { useEffect, useState } from 'preact/hooks';
import { fr } from '../../i18n/fr';
import { actionLabel, changeSummary } from '../../lib/admin-logic';
import { loadAudit, pseudosOf } from '../../lib/admin';
import { formatDate, formatTime } from '../../lib/format';
import { EmptyState } from '../EmptyState';
import { Loaded, LoadMore, usePaged } from './common';

const firstAudit = () => loadAudit(null);
/** Actor of the entries written by the scheduled job (scripts/maintenance.ts). */
const SYSTEM_ACTOR = 'system';

export function JournalTab() {
  const t = fr.admin.journal;
  const paged = usePaged(firstAudit, loadAudit);
  const [names, setNames] = useState<Map<string, string>>(new Map());
  const actors = [...new Set(paged.items.map((e) => e.actorUid))]
    .filter((u) => u !== SYSTEM_ACTOR && !names.has(u))
    .join(',');

  useEffect(() => {
    if (!actors) return;
    let cancelled = false;
    pseudosOf(actors.split(','))
      .then((found) => !cancelled && setNames((m) => new Map([...m, ...found])))
      // Names are a convenience: the uid stays shown when they cannot be read.
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [actors]);

  return (
    <Loaded state={paged.head.state} reload={paged.head.reload}>
      {() =>
        paged.items.length === 0 ? (
          <EmptyState title={t.empty} />
        ) : (
          <>
            <ul class="adm-list">
              {paged.items.map((e) => {
                const change = changeSummary(e.before, e.after);
                return (
                  <li key={e.id} class="adm-log" data-audit={e.action}>
                    <p class="adm-item__title">{actionLabel(e.action)}</p>
                    <p class="adm-item__meta">
                      {e.createdAt ? `${formatDate(e.createdAt)} ${formatTime(e.createdAt)} · ` : ''}
                      {t.by(e.actorUid === SYSTEM_ACTOR ? t.system : (names.get(e.actorUid) ?? e.actorUid))}
                    </p>
                    <p class="adm-log__line">
                      {t.target} : <span class="adm-mono">{`${e.targetType}/${e.targetId}`}</span>
                    </p>
                    {e.reason && (
                      <p class="adm-log__line">
                        {t.reason} : {e.reason}
                      </p>
                    )}
                    {change && (
                      <p class="adm-log__line">
                        {t.change} : <span class="adm-mono">{change}</span>
                      </p>
                    )}
                  </li>
                );
              })}
            </ul>
            <LoadMore
              show={paged.cursor !== null}
              busy={paged.busy}
              error={paged.error}
              onClick={() => void paged.loadMore()}
            />
          </>
        )
      }
    </Loaded>
  );
}
