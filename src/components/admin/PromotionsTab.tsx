/** « Mises en avant » (super-admin): Premium/Sponsorisé without payment, and the verified badge. */
import { useState } from 'preact/hooks';
import { fr } from '../../i18n/fr';
import { PROMOTION_DAYS, promotionUntil } from '../../lib/admin-logic';
import { loadPromoted, setBadge, setPromotion, type AdminListing, type MemberRecord } from '../../lib/admin';
import { reportError } from '../../lib/errors';
import { formatDate } from '../../lib/format';
import { listingState } from '../../lib/listing-status';
import { showToast } from '../Toast';
import { AdminListingRow, Loaded, SearchBox, useLoad } from './common';
import { MemberHead, SearchResult, useMemberSearch } from './MembersTab';

function PromotionLine({ l }: { l: AdminListing }) {
  const t = fr.admin.promotions;
  const boost = listingState(l).boost;
  if (!boost) return null;
  return <p class="adm-item__meta">{boost.until ? t.until(formatDate(boost.until)) : t.noEnd}</p>;
}

function RemoveButton({ actor, l, onDone }: { actor: string; l: AdminListing; onDone: () => void }) {
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      class="button button--secondary"
      disabled={busy}
      onClick={async (e) => {
        // Synchronous lock: a second tap before the re-render wrote and announced the removal twice.
        const button = e.currentTarget;
        if (button.disabled) return;
        button.disabled = true;
        setBusy(true);
        try {
          await setPromotion(actor, l, { rank: 0, boostUntil: null });
          showToast(fr.admin.promotions.removed, 'success');
          onDone();
        } catch (e) {
          showToast(reportError(e, 'admin-unpromote'), 'error');
          button.disabled = false;
          setBusy(false);
        }
      }}
    >
      {fr.admin.promotions.remove}
    </button>
  );
}

/** Level + duration (7/14/30 days or no end), applied in one audited write. Also in « Récentes ». */
export function PromotionForm({
  actor,
  l,
  onDone,
}: {
  actor: string;
  l: AdminListing;
  onDone: (next: AdminListing) => void;
}) {
  const t = fr.admin.promotions;
  const [rank, setRank] = useState<0 | 1 | 2>(l.rank === 2 ? 2 : l.rank === 1 ? 1 : 0);
  const [days, setDays] = useState<string>('7');
  const [busy, setBusy] = useState(false);
  const levelId = `level-${l.id}`;
  const daysId = `days-${l.id}`;
  return (
    <form
      class="adm-promo"
      onSubmit={async (e) => {
        e.preventDefault();
        if (busy) return;
        setBusy(true);
        try {
          const until = rank > 0 ? promotionUntil(days === 'none' ? null : Number(days), new Date()) : null;
          await setPromotion(actor, l, { rank, boostUntil: until });
          showToast(rank > 0 ? t.applied : t.removed, 'success');
          onDone({ ...l, rank, boostUntil: until });
        } catch (err) {
          showToast(reportError(err, 'admin-promote'), 'error');
        } finally {
          setBusy(false);
        }
      }}
    >
      <div class="field">
        <label class="field__label" for={levelId}>
          {t.level}
        </label>
        <select
          id={levelId}
          class="field__control"
          value={String(rank)}
          onChange={(e) => setRank(Number(e.currentTarget.value) as 0 | 1 | 2)}
        >
          <option value="0">{t.free}</option>
          <option value="1">{fr.card.sponsored}</option>
          <option value="2">{fr.card.premium}</option>
        </select>
      </div>
      {rank > 0 && (
        <div class="field">
          <label class="field__label" for={daysId}>
            {t.duration}
          </label>
          <select
            id={daysId}
            class="field__control"
            value={days}
            onChange={(e) => setDays(e.currentTarget.value)}
          >
            {PROMOTION_DAYS.map((d) => (
              <option key={String(d)} value={d === null ? 'none' : String(d)}>
                {d === null ? t.unlimited : t.days(d)}
              </option>
            ))}
          </select>
        </div>
      )}
      <button type="submit" class="button button--primary" disabled={busy}>
        {t.apply}
      </button>
    </form>
  );
}

function BadgeToggle({
  actor,
  m,
  onDone,
}: {
  actor: string;
  m: MemberRecord;
  onDone: (verified: boolean) => void;
}) {
  const t = fr.admin.promotions;
  const [busy, setBusy] = useState(false);
  if (m.pseudo === null) return null;
  return (
    <button
      type="button"
      class="button button--secondary button--block"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          await setBadge(actor, m.uid, !m.verified);
          showToast(m.verified ? t.badgeOff : t.badgeOn, 'success');
          onDone(!m.verified);
        } catch (e) {
          showToast(reportError(e, 'admin-badge'), 'error');
        } finally {
          setBusy(false);
        }
      }}
    >
      {m.verified ? t.removeBadge : t.grantBadge}
    </button>
  );
}

export function PromotionsTab({ actor }: { actor: string }) {
  const t = fr.admin.promotions;
  const promoted = useLoad(loadPromoted);
  const s = useMemberSearch();
  const m = s.member;

  return (
    <div class="stack">
      <section class="card" aria-labelledby="promoted-title">
        <h3 class="card__title" id="promoted-title">
          {t.current}
        </h3>
        <Loaded state={promoted.state} reload={promoted.reload}>
          {(list) =>
            list.length === 0 ? (
              <p class="field__hint">{t.none}</p>
            ) : (
              <ul class="adm-list">
                {list.map((l) => (
                  <AdminListingRow key={l.id} l={l}>
                    <PromotionLine l={l} />
                    <div class="adm-actions">
                      <RemoveButton
                        actor={actor}
                        l={l}
                        onDone={() => {
                          promoted.update((all) => all.filter((x) => x.id !== l.id));
                          // The member shown below must not keep the old level of this listing.
                          if (m?.listings.some((x) => x.id === l.id)) {
                            s.setMember({
                              ...m,
                              listings: m.listings.map((x) =>
                                x.id === l.id ? { ...x, rank: 0, boostUntil: null } : x,
                              ),
                            });
                          }
                        }}
                      />
                    </div>
                  </AdminListingRow>
                ))}
              </ul>
            )
          }
        </Loaded>
      </section>

      <section class="card" aria-labelledby="promote-title">
        <h3 class="card__title" id="promote-title">
          {t.find}
        </h3>
        <SearchBox id="promote-search" label={fr.admin.members.search} onSearch={s.search} />
        <SearchResult found={m} error={s.error} />
        {m && (
          <div class="stack" data-member-card={m.uid}>
            <MemberHead m={m} />
            <BadgeToggle actor={actor} m={m} onDone={(verified) => s.setMember({ ...m, verified })} />
            {m.listings.length === 0 ? (
              <p class="field__hint">{fr.admin.members.noListings}</p>
            ) : (
              <ul class="adm-list">
                {m.listings
                  .filter((l) => l.status === 'active')
                  .map((l) => (
                    // Keyed by level too: the form starts again from a level changed elsewhere.
                    <AdminListingRow key={`${l.id}-${l.rank}`} l={l}>
                      <PromotionForm
                        actor={actor}
                        l={l}
                        onDone={(next) => {
                          s.setMember({ ...m, listings: m.listings.map((x) => (x.id === l.id ? next : x)) });
                          promoted.reload();
                        }}
                      />
                    </AdminListingRow>
                  ))}
              </ul>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
