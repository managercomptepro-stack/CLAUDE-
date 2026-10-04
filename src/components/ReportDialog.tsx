import { useRef, useState } from 'preact/hooks';
import { REPORT_REASONS, type ReportReason } from '../data/reports';
import { TEXT_MAX } from '../data/limits';
import { fr } from '../i18n/fr';
import { errorCode, reportError } from '../lib/errors';
import { Icon } from './Icon';
import { showToast } from './Toast';

const REPORTED_KEY = 'nx-reported';

function reportedIds(): string[] {
  try {
    const v: unknown = JSON.parse(localStorage.getItem(REPORTED_KEY) ?? '[]');
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

function markReported(id: string): void {
  try {
    localStorage.setItem(
      REPORTED_KEY,
      JSON.stringify([...reportedIds().filter((x) => x !== id), id].slice(-200)),
    );
  } catch {
    // Storage blocked: the rules still refuse a second report.
  }
}

/** « Signaler » (SPEC § 10): one of the 7 reasons + optional details, one report per visitor. */
export function ReportButton({ listingId }: { listingId: string }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [reason, setReason] = useState<ReportReason | ''>('');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  function open() {
    if (reportedIds().includes(listingId)) {
      showToast(fr.report.already, 'info');
      return;
    }
    setReason('');
    setNote('');
    setError('');
    dialog.current?.showModal();
  }

  async function submit(e: Event) {
    e.preventDefault();
    if (!reason) {
      setError(fr.report.reasonRequired);
      return;
    }
    setBusy(true);
    setError('');
    try {
      const { reportListing } = await import('../lib/social');
      await reportListing(listingId, reason, note);
      markReported(listingId);
      dialog.current?.close();
      showToast(fr.report.sent, 'success');
    } catch (err) {
      // The rules refuse a second report from the same visitor (permission-denied), but also a
      // report on a listing hidden or removed meanwhile: tell them apart by reading it again.
      if (errorCode(err) === 'permission-denied') {
        const { loadListing } = await import('../lib/feed');
        const shown = await loadListing(listingId).catch(() => null);
        dialog.current?.close();
        if (shown) {
          markReported(listingId);
          showToast(fr.report.already, 'info');
        } else {
          showToast(fr.listing.unavailableTitle, 'info');
        }
      } else {
        setError(reportError(err, 'report'));
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button type="button" class="action" onClick={open}>
        <Icon name="flag" />
        <span>{fr.listing.report}</span>
      </button>
      <dialog ref={dialog} class="sheet" aria-labelledby="report-title">
        <form class="sheet__inner form" onSubmit={submit} noValidate>
          <div class="sheet__head">
            <h2 id="report-title" class="sheet__title">
              {fr.report.title}
            </h2>
            <button
              type="button"
              class="icon-button"
              aria-label={fr.cityPicker.close}
              onClick={() => dialog.current?.close()}
            >
              <Icon name="close" />
            </button>
          </div>
          <fieldset class="field">
            <legend class="field__label">{fr.report.reasonLegend}</legend>
            <div class="choice">
              {REPORT_REASONS.map((r) => (
                <label key={r}>
                  <input
                    type="radio"
                    name="reason"
                    value={r}
                    checked={reason === r}
                    onChange={() => {
                      setReason(r);
                      setError('');
                    }}
                  />
                  {fr.report.reasons[r]}
                </label>
              ))}
            </div>
          </fieldset>
          <div class="field">
            <label class="field__label" for="report-note">
              {fr.report.note} <span class="field__optional">{fr.report.optional}</span>
            </label>
            <textarea
              id="report-note"
              class="field__control"
              rows={3}
              maxLength={TEXT_MAX.reportNote}
              value={note}
              onInput={(e) => setNote(e.currentTarget.value)}
            />
          </div>
          {error && (
            <p class="form-error" role="alert">
              {error}
            </p>
          )}
          <button type="submit" class="button button--danger button--block" disabled={busy}>
            {fr.report.submit}
          </button>
          <button
            type="button"
            class="link-button link-button--center"
            onClick={() => dialog.current?.close()}
          >
            {fr.report.cancel}
          </button>
        </form>
      </dialog>
    </>
  );
}
