/** « Paiements » (super-admin): manual Mobile Money check, then Valider / Rejeter (SPEC § 7). */
import { useState } from 'preact/hooks';
import { DEFAULT_SETTINGS, type PublicSettings } from '../../data/settings';
import { fr } from '../../i18n/fr';
import { approvedBoost } from '../../lib/admin-logic';
import {
  approvePayment,
  loadPendingPayments,
  loadSettingsDoc,
  rejectPayment,
  type PaymentRequest,
} from '../../lib/admin';
import { formatAmount } from '../../lib/boost-form';
import { reportError } from '../../lib/errors';
import { formatDate, formatTime } from '../../lib/format';
import { EmptyState } from '../EmptyState';
import { PromotionTag } from '../ListingCard';
import { showToast } from '../Toast';
import { Loaded, ReasonForm, useLoad } from './common';

const loadPayments = async () => {
  const [requests, settings] = await Promise.all([loadPendingPayments(), loadSettingsDoc()]);
  return { requests, boostDays: (settings ?? DEFAULT_SETTINGS).boostDays };
};

function PaymentCard({
  actor,
  r,
  boostDays,
  onDone,
}: {
  actor: string;
  r: PaymentRequest;
  boostDays: PublicSettings['boostDays'];
  onDone: () => void;
}) {
  const t = fr.admin.payments;
  const [rejecting, setRejecting] = useState(false);
  const [busy, setBusy] = useState(false);
  const l = r.listing;
  const canApprove = l !== null && l.status === 'active';
  const preview = l
    ? approvedBoost({ rank: l.rank, boostUntil: l.boostUntil }, r.tier, boostDays[r.tier], new Date())
    : null;

  return (
    <li class="adm-item" data-payment={r.id}>
      <div class="adm-pay__head">
        <PromotionTag tier={r.tier} />
        <span class="adm-pay__amount">{formatAmount(r.amount)}</span>
      </div>
      <p class="adm-item__title">{l ? l.title : r.listingId}</p>
      <dl class="facts">
        <dt>{t.expected}</dt>
        <dd>{formatAmount(r.amount)}</dd>
        <dt>{t.operator}</dt>
        <dd>{fr.boost.operators[r.operator]}</dd>
        <dt>{t.txRef}</dt>
        <dd>{r.txRef ?? t.noRef}</dd>
        <dt>{t.sentAt}</dt>
        <dd>{r.createdAt ? `${formatDate(r.createdAt)} ${formatTime(r.createdAt)}` : '—'}</dd>
        <dt>{t.member}</dt>
        <dd>
          <a href={`/membre?u=${encodeURIComponent(r.ownerUid)}`} target="_blank" rel="noopener noreferrer">
            {l?.pseudo ?? r.ownerUid}
          </a>
        </dd>
      </dl>
      {(r.reuse.sameRef > 0 || r.reuse.sameShot) && (
        <p class="notice notice--danger" role="alert" data-reuse>
          {r.reuse.sameRef > 0 && t.sameRef(r.reuse.sameRef)} {r.reuse.sameShot && t.sameShot}
        </p>
      )}
      {r.screenshot && <img class="adm-shot" src={r.screenshot} alt={t.screenshotAlt} />}
      {canApprove && preview ? (
        <p class="notice">
          {preview.boostUntil ? t.willRun(formatDate(preview.boostUntil)) : t.willRunUnlimited}
        </p>
      ) : (
        <p class="notice">{t.listingGone}</p>
      )}
      {rejecting ? (
        <ReasonForm
          id={`reject-${r.id}`}
          title={t.rejectTitle}
          hint={t.rejectHint}
          presets={t.rejectPresets}
          confirmLabel={t.reject}
          onCancel={() => setRejecting(false)}
          onConfirm={async (reason) => {
            await rejectPayment(actor, r, reason);
            showToast(t.rejected, 'success');
            onDone();
          }}
        />
      ) : (
        <div class="adm-actions">
          {canApprove && (
            <button
              type="button"
              class="button button--primary"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await approvePayment(actor, r, boostDays[r.tier]);
                  showToast(t.approved, 'success');
                  onDone();
                } catch (e) {
                  showToast(reportError(e, 'admin-approve'), 'error');
                  setBusy(false);
                }
              }}
            >
              {t.approve}
            </button>
          )}
          <button
            type="button"
            class="button button--danger"
            disabled={busy}
            onClick={() => setRejecting(true)}
          >
            {t.reject}
          </button>
        </div>
      )}
    </li>
  );
}

export function PaymentsTab({ actor }: { actor: string }) {
  const { state, reload, update } = useLoad(loadPayments);
  return (
    <Loaded state={state} reload={reload}>
      {({ requests, boostDays }) =>
        requests.length === 0 ? (
          <EmptyState title={fr.admin.payments.empty} />
        ) : (
          <ul class="adm-list">
            {requests.map((r) => (
              <PaymentCard
                key={r.id}
                actor={actor}
                r={r}
                boostDays={boostDays}
                onDone={() => update((d) => ({ ...d, requests: d.requests.filter((x) => x.id !== r.id) }))}
              />
            ))}
          </ul>
        )
      }
    </Loaded>
  );
}
