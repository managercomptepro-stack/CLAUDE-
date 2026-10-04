import { useEffect, useRef, useState } from 'preact/hooks';
import { AuthGate, type Session } from '../components/AuthGate';
import { EmptyState } from '../components/EmptyState';
import { controlAttrs, Field } from '../components/Field';
import { Skeleton } from '../components/Skeleton';
import { showToast } from '../components/Toast';
import { DATA_URL_MAX_CHARS, TEXT_MAX } from '../data/limits';
import { fr } from '../i18n/fr';
import type { BoostContext } from '../lib/boost';
import {
  availableOperators,
  boostBlock,
  displayNumber,
  formatAmount,
  localNumber,
  normalizeTxRef,
  OPERATORS,
  tierOffers,
  type BoostTier,
  type Operator,
} from '../lib/boost-form';
import { reportError } from '../lib/errors';
import { formatDate } from '../lib/format';
import { listingPhotoUrl, parsePhotoRef } from '../lib/listing-form';
import { listingState, type OwnListing } from '../lib/listing-status';
import { mountPage } from '../shell/mount';

// Firestore is loaded on demand (already in cache once AuthGate has run).
const boostApi = () => import('../lib/boost');

type Load = { kind: 'loading' } | { kind: 'ready'; ctx: BoostContext } | { kind: 'error'; message: string };

function BoostPage({ session }: { session: Session }) {
  const uid = session.user.uid;
  const listingId = new URLSearchParams(location.search).get('id') ?? '';
  const [load, setLoad] = useState<Load>({ kind: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const ctx = await (await boostApi()).loadBoostContext(uid, listingId);
        if (!cancelled) setLoad({ kind: 'ready', ctx });
      } catch (error) {
        if (!cancelled) setLoad({ kind: 'error', message: reportError(error, 'boost-load') });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [uid, listingId, attempt]);

  return (
    <div class="page">
      <h1 class="page__title">{fr.headings.boost}</h1>
      {load.kind === 'loading' && <Skeleton cards={2} title={false} />}
      {load.kind === 'error' && (
        <EmptyState title={load.message}>
          <button type="button" class="button button--primary" onClick={() => setAttempt((n) => n + 1)}>
            {fr.retry}
          </button>
        </EmptyState>
      )}
      {load.kind === 'ready' && <BoostContent uid={uid} ctx={load.ctx} />}
    </div>
  );
}

function BackToAccount() {
  return (
    <a class="button button--secondary" href="/compte">
      {fr.boost.toAccount}
    </a>
  );
}

function BoostContent({ uid, ctx }: { uid: string; ctx: BoostContext }) {
  const t = fr.boost;
  const { listing, settings, pendingSince } = ctx;
  if (!listing) {
    return (
      <EmptyState title={t.notFound}>
        <BackToAccount />
      </EmptyState>
    );
  }
  const block = boostBlock(listing);
  return (
    <div class="stack">
      <ListingSummary listing={listing} />
      {block ? (
        <EmptyState title={t.blocked[block]}>
          <BackToAccount />
        </EmptyState>
      ) : pendingSince ? (
        <Pending sent={false} since={pendingSince} />
      ) : availableOperators(settings).length === 0 ? (
        <EmptyState title={t.closedTitle} body={t.closedBody}>
          <BackToAccount />
        </EmptyState>
      ) : (
        <BoostFlow uid={uid} listing={listing} settings={settings} />
      )}
    </div>
  );
}

function ListingSummary({ listing }: { listing: OwnListing }) {
  const main = listing.photos[0];
  const size = main ? parsePhotoRef(main) : null;
  return (
    <div class="boost-listing">
      {main && (
        <img
          class="boost-listing__thumb"
          src={listingPhotoUrl(main, 360) ?? ''}
          width={size?.width}
          height={size?.height}
          alt=""
        />
      )}
      <p class="boost-listing__title">{listing.title}</p>
    </div>
  );
}

/** « En attente de vérification »: right after sending, or when a request is already waiting. */
function Pending({ sent, since }: { sent: boolean; since: Date }) {
  return (
    <section class="card boost-pending" role="status" aria-labelledby="boost-pending-title">
      <h2 class="card__title" id="boost-pending-title">
        {sent ? fr.boost.sentTitle : fr.boost.pendingTitle}
      </h2>
      {sent && <p class="boost-pending__state">{fr.boost.pendingTitle}</p>}
      <p>{fr.boost.pendingBody}</p>
      <p class="field__hint">{fr.boost.pendingSince(formatDate(since))}</p>
      <BackToAccount />
    </section>
  );
}

const TOTAL_STEPS = 3;

function StepHead({ n, title }: { n: number; title: string }) {
  return (
    <div class="boost-step__head">
      <p class="boost-step__count">{fr.boost.step(n, TOTAL_STEPS)}</p>
      <h2 class="card__title" id={`boost-step-${n}`}>
        {title}
      </h2>
    </div>
  );
}

interface FlowProps {
  uid: string;
  listing: OwnListing;
  settings: BoostContext['settings'];
}

function BoostFlow({ uid, listing, settings }: FlowProps) {
  const t = fr.boost;
  const offers = tierOffers(settings);
  const ready = availableOperators(settings);
  const [step, setStep] = useState<1 | 2 | 3 | 'sent'>(1);
  const [tier, setTier] = useState<BoostTier>('premium');
  const [operator, setOperator] = useState<Operator>(ready[0] ?? 'mtn');
  const [sentAt, setSentAt] = useState<Date | null>(null);
  const offer = offers.find((o) => o.tier === tier) ?? offers[0];
  // Dated boost in force: the new days are added to its end (owner's decision 10).
  const runningUntil = listingState(listing).boost?.until ?? null;

  if (step === 'sent' && sentAt) return <Pending sent since={sentAt} />;
  if (!offer) return null;

  if (step === 1) {
    return (
      <section class="card boost-step" aria-labelledby="boost-step-1">
        <StepHead n={1} title={t.tierTitle} />
        <fieldset class="offers">
          <legend class="visually-hidden">{t.tierTitle}</legend>
          {offers.map((o) => (
            <label key={o.tier} class={`offer offer--${o.tier}`}>
              <input
                type="radio"
                name="tier"
                value={o.tier}
                checked={tier === o.tier}
                onChange={() => setTier(o.tier)}
              />
              <span class="offer__body">
                <span class="offer__head">
                  <span class={`tag tag--${o.tier}`}>{t.tiers[o.tier].name}</span>
                  <span class="offer__price">{formatAmount(o.price)}</span>
                </span>
                <span class="offer__days">{t.duration(o.days)}</span>
                <ul class="offer__perks">
                  {t.tiers[o.tier].perks.map((p) => (
                    <li key={p}>{p}</li>
                  ))}
                </ul>
              </span>
            </label>
          ))}
        </fieldset>
        {runningUntil && (
          <p class="notice">{t.extends(formatDate(runningUntil), offer?.days ?? settings.boostDays[tier])}</p>
        )}
        <p class="field__hint">{t.perListing}</p>
        <button type="button" class="button button--primary button--block" onClick={() => setStep(2)}>
          {t.continue}
        </button>
      </section>
    );
  }

  if (step === 2) {
    return (
      <section class="card boost-step" aria-labelledby="boost-step-2">
        <StepHead n={2} title={t.operatorTitle} />
        <fieldset class="offers">
          <legend class="visually-hidden">{t.operatorTitle}</legend>
          {OPERATORS.map((o) => {
            const available = ready.includes(o);
            return (
              <label key={o} class={`offer offer--operator${available ? '' : ' offer--off'}`}>
                <input
                  type="radio"
                  name="operator"
                  value={o}
                  checked={operator === o}
                  disabled={!available}
                  onChange={() => setOperator(o)}
                />
                <span class="offer__body">
                  <span class="offer__name">{t.operators[o]}</span>
                  {!available && <span class="field__hint">{t.operatorUnavailable}</span>}
                </span>
              </label>
            );
          })}
        </fieldset>
        <button type="button" class="button button--primary button--block" onClick={() => setStep(3)}>
          {t.continue}
        </button>
        <button type="button" class="link-button link-button--center" onClick={() => setStep(1)}>
          {t.back}
        </button>
      </section>
    );
  }

  return (
    <PayStep
      uid={uid}
      listingId={listing.id}
      tier={tier}
      operator={operator}
      amount={offer.price}
      settings={settings}
      onBack={() => setStep(2)}
      onSent={() => {
        setSentAt(new Date());
        setStep('sent');
      }}
    />
  );
}

interface PayProps {
  uid: string;
  listingId: string;
  tier: BoostTier;
  operator: Operator;
  amount: number;
  settings: BoostContext['settings'];
  onBack: () => void;
  onSent: () => void;
}

function PayStep({ uid, listingId, tier, operator, amount, settings, onBack, onSent }: PayProps) {
  const t = fr.boost;
  const payee = settings.payment[operator];
  const inputRef = useRef<HTMLInputElement>(null);
  const [shot, setShot] = useState<string | null>(null);
  const [preparing, setPreparing] = useState(false);
  const [shotError, setShotError] = useState('');
  const [txRef, setTxRef] = useState('');
  const [txError, setTxError] = useState('');
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState('');

  async function copy() {
    try {
      await navigator.clipboard.writeText(localNumber(payee.number));
      showToast(t.copied, 'success');
    } catch {
      showToast(t.copyFailed, 'error');
    }
  }

  async function pick(e: Event) {
    const input = e.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    setPreparing(true);
    setShotError('');
    try {
      const { compressToDataUrl } = await import('../lib/image-compress');
      setShot(await compressToDataUrl(file, DATA_URL_MAX_CHARS));
    } catch (error) {
      setShotError(reportError(error, 'boost-screenshot'));
    } finally {
      setPreparing(false);
    }
  }

  async function submit(e: Event) {
    e.preventDefault();
    if (busy || preparing) return;
    const ref = normalizeTxRef(txRef);
    const refError = 'error' in ref ? t.txRefTooLong(TEXT_MAX.txRef) : '';
    setTxError(refError);
    setShotError(shot ? '' : t.screenshotMissing);
    if (!shot || 'error' in ref) return;
    setBusy(true);
    setFormError('');
    try {
      await (
        await boostApi()
      ).submitBoostRequest(uid, listingId, {
        tier,
        operator,
        amount,
        txRef: ref.value,
        screenshot: shot,
      });
      onSent();
    } catch (error) {
      setFormError(reportError(error, 'boost-submit'));
      setBusy(false);
    }
  }

  return (
    <section class="card boost-step" aria-labelledby="boost-step-3">
      <StepHead n={3} title={t.payTitle} />
      <p>{t.payIntro(formatAmount(amount), t.operators[operator])}</p>
      <dl class="pay-box">
        <div class="pay-box__row">
          <dt>{t.amount}</dt>
          <dd class="pay-box__amount">{formatAmount(amount)}</dd>
        </div>
        <div class="pay-box__row">
          <dt>{t.number}</dt>
          <dd class="pay-box__number">
            <span data-pay-number>{displayNumber(payee.number)}</span>
            <button type="button" class="button button--secondary pay-box__copy" onClick={() => void copy()}>
              {t.copy}
            </button>
          </dd>
        </div>
        <div class="pay-box__row">
          <dt>{t.payee}</dt>
          <dd>{payee.name}</dd>
        </div>
      </dl>
      <p class="notice">{t.checkName(payee.name)}</p>
      <form class="form" noValidate onSubmit={(e) => void submit(e)}>
        <div class="field">
          <p class="field__label" id="boost-shot-label">
            {t.screenshot}
          </p>
          <p class="field__hint">{t.screenshotHint}</p>
          {shot && <img class="shot-preview" src={shot} alt={t.screenshotAlt} />}
          <input
            ref={inputRef}
            class="visually-hidden"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            tabIndex={-1}
            aria-hidden="true"
            data-screenshot-input
            onChange={(e) => void pick(e)}
          />
          <button
            type="button"
            class="button button--secondary button--block"
            aria-describedby="boost-shot-label"
            disabled={preparing}
            onClick={() => inputRef.current?.click()}
          >
            {preparing ? t.preparing : shot ? t.change : t.choose}
          </button>
          {shotError && (
            <p class="field__error" role="alert">
              {shotError}
            </p>
          )}
        </div>
        <Field id="boost-txref" label={t.txRef} hint={t.txRefHint} error={txError || undefined}>
          <input
            {...controlAttrs('boost-txref', txError || undefined, t.txRefHint)}
            type="text"
            autocomplete="off"
            maxLength={TEXT_MAX.txRef + 20}
            value={txRef}
            onInput={(e) => setTxRef(e.currentTarget.value)}
          />
        </Field>
        {formError && (
          <p class="form-error" role="alert">
            {formError}
          </p>
        )}
        <button type="submit" class="button button--primary button--block" disabled={busy || preparing}>
          {busy ? t.sending : t.submit}
        </button>
        <button type="button" class="link-button link-button--center" onClick={onBack}>
          {t.back}
        </button>
      </form>
    </section>
  );
}

mountPage(<AuthGate requirement="verified">{(session) => <BoostPage session={session} />}</AuthGate>);
