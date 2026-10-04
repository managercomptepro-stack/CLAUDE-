/** « Équipe » (super-admin): add or remove moderators by e-mail or uid. */
import { useState } from 'preact/hooks';
import { fr } from '../../i18n/fr';
import { loadTeam, resolveAccount, setModerator, type TeamMember } from '../../lib/admin';
import { reportError } from '../../lib/errors';
import { formatDate } from '../../lib/format';
import { controlAttrs, Field } from '../Field';
import { showToast } from '../Toast';
import { Loaded, useLoad } from './common';

function AddModerator({ actor, team, onAdded }: { actor: string; team: TeamMember[]; onAdded: () => void }) {
  const t = fr.admin.team;
  const [value, setValue] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  return (
    <form
      class="card"
      noValidate
      onSubmit={async (e) => {
        e.preventDefault();
        if (busy || !value.trim()) return;
        setBusy(true);
        setError('');
        try {
          const uid = await resolveAccount(value);
          if (!uid) setError(t.notFound);
          else if (uid === actor) setError(t.self);
          else if (team.some((m) => m.uid === uid)) setError(t.already);
          else {
            await setModerator(actor, uid, true);
            setValue('');
            showToast(t.added, 'success');
            onAdded();
          }
        } catch (err) {
          setError(reportError(err, 'admin-team'));
        } finally {
          setBusy(false);
        }
      }}
    >
      <h3 class="card__title">{t.add}</h3>
      <Field id="team-who" label={t.who} hint={t.whoHint} error={error}>
        <input
          {...controlAttrs('team-who', error, t.whoHint)}
          type="text"
          autoComplete="off"
          autoCapitalize="off"
          spellcheck={false}
          value={value}
          onInput={(e) => setValue(e.currentTarget.value)}
        />
      </Field>
      <button type="submit" class="button button--primary button--block" disabled={busy}>
        {t.addButton}
      </button>
    </form>
  );
}

function TeamRow({ actor, m, onRemoved }: { actor: string; m: TeamMember; onRemoved: () => void }) {
  const t = fr.admin.team;
  const [busy, setBusy] = useState(false);
  const isSelf = m.uid === actor;
  return (
    <li class="adm-team" data-team={m.uid}>
      <div>
        <p class="adm-item__title">
          {m.pseudo ?? fr.admin.unknownMember}
          {isSelf && ` (${t.you})`}
        </p>
        <p class="adm-item__meta">
          {fr.admin.role[m.role]}
          {m.addedAt && ` · ${t.since(formatDate(m.addedAt))}`}
        </p>
      </div>
      {m.role === 'moderator' && !isSelf && (
        <button
          type="button"
          class="button button--secondary"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              await setModerator(actor, m.uid, false);
              showToast(t.removed, 'success');
              onRemoved();
            } catch (e) {
              showToast(reportError(e, 'admin-team'), 'error');
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

export function TeamTab({ actor }: { actor: string }) {
  const t = fr.admin.team;
  const { state, reload, update } = useLoad(loadTeam);
  return (
    <Loaded state={state} reload={reload}>
      {(team) => (
        <div class="stack">
          <section class="card" aria-labelledby="team-title">
            <h3 class="card__title" id="team-title">
              {t.title}
            </h3>
            <ul class="adm-list">
              {team.map((m) => (
                <TeamRow
                  key={m.uid}
                  actor={actor}
                  m={m}
                  onRemoved={() => update((all) => all.filter((x) => x.uid !== m.uid))}
                />
              ))}
            </ul>
            {!team.some((m) => m.role === 'moderator') && <p class="field__hint">{t.empty}</p>}
          </section>
          <AddModerator actor={actor} team={team} onAdded={reload} />
        </div>
      )}
    </Loaded>
  );
}
