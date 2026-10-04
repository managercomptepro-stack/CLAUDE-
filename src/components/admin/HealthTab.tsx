/** « Santé » (all admins) and « Nettoyage » (super-admin: fallback of the scheduled job). */
import { useCallback, useState } from 'preact/hooks';
import { FEED_PAGE_SIZE } from '../../data/limits';
import { firebaseEnv } from '../../firebase/app';
import { fr } from '../../i18n/fr';
import { homeLoadsPerDay, SPARK, type AdminRole } from '../../lib/admin-logic';
import { loadHealth, planCleanup, runCleanup, type CleanupPlan } from '../../lib/admin';
import { reportError } from '../../lib/errors';
import { Loaded, useLoad } from './common';

const number = (n: number) => n.toLocaleString('fr-FR');

export function HealthTab({ role }: { role: AdminRole }) {
  const t = fr.admin.health;
  const load = useCallback(() => loadHealth(role), [role]);
  const { state, reload } = useLoad(load);
  const project = firebaseEnv.projectId;
  const consoleUrl = `https://console.firebase.google.com/project/${encodeURIComponent(project)}`;
  return (
    <div class="stack">
      <section class="card" aria-labelledby="health-counts">
        <h3 class="card__title" id="health-counts">
          {t.counts}
        </h3>
        <Loaded state={state} reload={reload}>
          {(h) => (
            <dl class="facts" data-health>
              <dt>{t.active}</dt>
              <dd>{number(h.active)}</dd>
              <dt>{t.hidden}</dt>
              <dd>{number(h.hidden)}</dd>
              <dt>{t.removed}</dt>
              <dd>{number(h.removed)}</dd>
              <dt>{t.promoted}</dt>
              <dd>{number(h.promoted)}</dd>
              {h.members !== null && (
                <>
                  <dt>{t.members}</dt>
                  <dd>{number(h.members)}</dd>
                </>
              )}
              {h.pendingBadges !== null && (
                <>
                  <dt>{t.pendingBadges}</dt>
                  <dd>{number(h.pendingBadges)}</dd>
                </>
              )}
              {h.pendingPayments !== null && (
                <>
                  <dt>{t.pendingPayments}</dt>
                  <dd>{number(h.pendingPayments)}</dd>
                </>
              )}
            </dl>
          )}
        </Loaded>
      </section>
      <section class="card" aria-labelledby="health-quotas">
        <h3 class="card__title" id="health-quotas">
          {t.quotas}
        </h3>
        <ul class="adm-bullets">
          <li>{t.reads(number(SPARK.reads))}</li>
          <li>{t.writes(number(SPARK.writes))}</li>
          <li>{t.hosting(SPARK.hostingMb)}</li>
        </ul>
        <p>{t.estimate(FEED_PAGE_SIZE, number(homeLoadsPerDay(FEED_PAGE_SIZE)))}</p>
        <p class="field__hint">{t.usageNote}</p>
        <h4 class="adm-subtitle">{t.consoles}</h4>
        <ul class="adm-bullets">
          <li>
            <a href={`${consoleUrl}/firestore/usage`} target="_blank" rel="noopener noreferrer">
              {t.firestoreUsage}
            </a>
          </li>
          <li>
            <a href={`${consoleUrl}/hosting`} target="_blank" rel="noopener noreferrer">
              {t.hostingUsage}
            </a>
          </li>
          <li>
            <a href={`${consoleUrl}/authentication/users`} target="_blank" rel="noopener noreferrer">
              {t.authUsers}
            </a>
          </li>
          <li>
            <a href="https://console.cloudinary.com/" target="_blank" rel="noopener noreferrer">
              {t.cloudinary}
            </a>
          </li>
        </ul>
      </section>
    </div>
  );
}

type Step =
  | { kind: 'idle' }
  | { kind: 'analysing' }
  | { kind: 'planned'; plan: CleanupPlan }
  | { kind: 'running'; done: number; total: number }
  | { kind: 'done'; count: number };

export function CleanupTab({ actor }: { actor: string }) {
  const t = fr.admin.cleanup;
  const [step, setStep] = useState<Step>({ kind: 'idle' });
  const [error, setError] = useState('');

  async function analyse() {
    setError('');
    setStep({ kind: 'analysing' });
    try {
      setStep({ kind: 'planned', plan: await planCleanup() });
    } catch (e) {
      setError(reportError(e, 'admin-cleanup'));
      setStep({ kind: 'idle' });
    }
  }

  async function run(plan: CleanupPlan) {
    const total = plan.expired.length + plan.boosts.length + plan.shots.length;
    setError('');
    setStep({ kind: 'running', done: 0, total });
    try {
      const count = await runCleanup(actor, plan, (done) => setStep({ kind: 'running', done, total }));
      setStep({ kind: 'done', count });
    } catch (e) {
      setError(reportError(e, 'admin-cleanup'));
      setStep({ kind: 'idle' });
    }
  }

  const plan = step.kind === 'planned' ? step.plan : null;
  const total = plan ? plan.expired.length + plan.boosts.length + plan.shots.length : 0;
  return (
    <section class="card stack" aria-labelledby="adm-panel-title" data-cleanup>
      <p>{t.intro}</p>
      <p class="field__hint">{t.later}</p>
      {plan && (
        <ul class="adm-bullets" data-cleanup-plan>
          <li>{t.expired(plan.expired.length)}</li>
          <li>{t.boosts(plan.boosts.length)}</li>
          <li>{t.shots(plan.shots.length)}</li>
        </ul>
      )}
      {plan && plan.more && <p class="notice">{t.more}</p>}
      {plan && total === 0 && <p class="notice notice--ok">{t.nothing}</p>}
      {step.kind === 'running' && (
        <p class="notice" role="status">
          {t.running(step.done, step.total)}
        </p>
      )}
      {step.kind === 'done' && (
        <p class="notice notice--ok" role="status">
          {t.done(step.count)}
        </p>
      )}
      {error && (
        <p class="form-error" role="alert">
          {error}
        </p>
      )}
      {plan && total > 0 ? (
        <button type="button" class="button button--danger button--block" onClick={() => void run(plan)}>
          {t.run}
        </button>
      ) : (
        <button
          type="button"
          class="button button--primary button--block"
          disabled={step.kind === 'analysing' || step.kind === 'running'}
          onClick={() => void analyse()}
        >
          {step.kind === 'analysing' ? t.analysing : t.analyse}
        </button>
      )}
    </section>
  );
}
