import { render } from 'preact';
import { fr } from '../i18n/fr';

export type ToastKind = 'info' | 'success' | 'error';

interface ToastItem {
  id: number;
  message: string;
  kind: ToastKind;
}

const DURATION_MS = 4000;
let items: ToastItem[] = [];
let nextId = 1;
let host: HTMLElement | null = null;

function ToastList({ list }: { list: ToastItem[] }) {
  return (
    <div class="toast-stack" role="status" aria-live="polite">
      {list.map((t) => (
        <div key={t.id} class={`toast toast--${t.kind}`}>
          <span class="toast__message">{t.message}</span>
          <button
            type="button"
            class="toast__close"
            aria-label={fr.toast.close}
            onClick={() => dismiss(t.id)}
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}

function paint(): void {
  if (!host) {
    host = document.createElement('div');
    document.body.appendChild(host);
  }
  render(<ToastList list={items} />, host);
}

function dismiss(id: number): void {
  items = items.filter((t) => t.id !== id);
  paint();
}

/** Shows a short message at the bottom of the screen (above the bottom bar). */
export function showToast(message: string, kind: ToastKind = 'info'): void {
  // The same message already on screen is not shown twice (double tap on a button).
  if (items.some((t) => t.message === message && t.kind === kind)) return;
  const id = nextId++;
  items = [...items, { id, message, kind }];
  paint();
  window.setTimeout(() => dismiss(id), DURATION_MS);
}
