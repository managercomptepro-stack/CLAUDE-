/**
 * « Badges »: ID photos waiting for a decision (seen by moderators, decided by the super-admin),
 * then every verified member, with « Retirer » for the super-admin (owner's request of 3 Oct 2026).
 */
import { useState } from 'preact/hooks';
import { fr } from '../../i18n/fr';
import type { AdminRole } from '../../lib/admin-logic';
import {
  decideBadge,
  loadBadgeRequests,
  loadVerifiedMembers,
  setBadge,
  type BadgeRequest,
  type VerifiedMember,
} from '../../lib/admin';
import { reportError } from '../../lib/errors';
import { formatDate } from '../../lib/format';
import { EmptyState } from '../EmptyState';
import { showToast } from '../Toast';
import { Loaded, ReasonForm, useLoad } from './common';

function BadgeCard({
  actor,
  role,
  r,
  onDone,
}: {
  actor: string;
  role: AdminRole;
  r: BadgeRequest;
  onDone: () => void;
}) {
  const t = fr.admin.badges;
  const [refusing, setRefusing] = useState(false);
  const [busy, setBusy] = useState(false);
  const pseudo = r.pseudo ?? fr.admin.unknownMember;
  return (
    <li class="adm-item" data-badge={r.uid}>
      <p class="adm-item__title">
        <a href={`/membre?u=${encodeURIComponent(r.uid)}`} target="_blank" rel="noopener noreferrer">
          {pseudo}
        </a>
      </p>
      {r.createdAt && <p class="adm-item__meta">{t.sentAt(formatDate(r.createdAt))}</p>}
      {r.idImage && <img class="adm-shot" src={r.idImage} alt={t.idAlt(pseudo)} />}
      {role !== 'super' ? (
        <p class="field__hint">{fr.admin.superOnly}</p>
      ) : refusing ? (
        <ReasonForm
          id={`refuse-${r.uid}`}
          title={t.refuseTitle}
          hint={t.refuseHint}
          presets={t.refusePresets}
          confirmLabel={t.refuse}
          onCancel={() => setRefusing(false)}
          onConfirm={async (reason) => {
            await decideBadge(actor, r.uid, false, reason);
            showToast(t.refused, 'success');
            onDone();
          }}
        />
      ) : (
        <div class="adm-actions">
          <button
            type="button"
            class="button button--primary"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await decideBadge(actor, r.uid, true, null);
                showToast(t.granted, 'success');
                onDone();
              } catch (e) {
                showToast(reportError(e, 'admin-badge'), 'error');
                setBusy(false);
              }
            }}
          >
            {t.approve}
          </button>
          <button
            type="button"
            class="button button--danger"
            disabled={busy}
            onClick={() => setRefusing(true)}
          >
            {t.refuse}
          </button>
        </div>
      )}
    </li>
  );
}

function VerifiedLine({
  actor,
  role,
  v,
  onRemoved,
}: {
  actor: string;
  role: AdminRole;
  v: VerifiedMember;
  onRemoved: () => void;
}) {
  const t = fr.admin.badges;
  const [busy, setBusy] = useState(false);
  return (
    <li class="adm-item adm-item--row" data-verified={v.uid}>
      <div class="adm-item__main">
        <p class="adm-item__title">
          <a href={`/membre?u=${encodeURIComponent(v.uid)}`} target="_blank" rel="noopener noreferrer">
            {v.pseudo}
          </a>
        </p>
        {v.memberSince && <p class="adm-item__meta">{t.since(formatDate(v.memberSince))}</p>}
      </div>
      {role === 'super' && (
        <button
          type="button"
          class="button button--secondary"
          disabled={busy}
          onClick={async () => {
            if (busy) return;
            setBusy(true);
            try {
              await setBadge(actor, v.uid, false);
              showToast(fr.admin.promotions.badgeOff, 'success');
              onRemoved();
            } catch (e) {
              showToast(reportError(e, 'admin-badge'), 'error');
              setBusy(false);
            }
          }}
        >
          {t.remove}
        </button>
      )}
    </li>
  );
}

export function BadgesTab({ actor, role }: { actor: string; role: AdminRole }) {
  const t = fr.admin.badges;
  const { state, reload, update } = useLoad(loadBadgeRequests);
  const verified = useLoad(loadVerifiedMembers);
  return (
    <div class="stack">
      <section class="stack stack--tight" aria-labelledby="badge-requests">
        <h3 class="adm-subtitle" id="badge-requests">
          {t.pending}
        </h3>
        <Loaded state={state} reload={reload}>
          {(requests) =>
            requests.length === 0 ? (
              <EmptyState title={t.empty} />
            ) : (
              <ul class="adm-list">
                {requests.map((r) => (
                  <BadgeCard
                    key={r.uid}
                    actor={actor}
                    role={role}
                    r={r}
                    onDone={() => {
                      update((all) => all.filter((x) => x.uid !== r.uid));
                      verified.reload();
                    }}
                  />
                ))}
              </ul>
            )
          }
        </Loaded>
      </section>
      <section class="stack stack--tight" aria-labelledby="badge-verified">
        <Loaded state={verified.state} reload={verified.reload}>
          {(list) => (
            <>
              <h3 class="adm-subtitle" id="badge-verified">
                {t.verified(list.length)}
              </h3>
              {list.length === 0 ? (
                <p class="field__hint">{t.noneVerified}</p>
              ) : (
                <ul class="adm-list">
                  {list.map((v) => (
                    <VerifiedLine
                      key={v.uid}
                      actor={actor}
                      role={role}
                      v={v}
                      onRemoved={() => verified.update((all) => all.filter((x) => x.uid !== v.uid))}
                    />
                  ))}
                </ul>
              )}
            </>
          )}
        </Loaded>
      </section>
    </div>
  );
}
