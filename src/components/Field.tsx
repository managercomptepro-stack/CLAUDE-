import type { ComponentChildren } from 'preact';

interface Props {
  id: string;
  label: string;
  error?: string | undefined;
  hint?: string | undefined;
  /** « 12 / 60 » under text fields. */
  counter?: string | undefined;
  children: ComponentChildren;
}

/** Attributes for the control inside a <Field> (same id, error and hint wiring everywhere). */
export function controlAttrs(id: string, error?: string, hint?: string) {
  const describedBy = [error ? `${id}-error` : '', hint ? `${id}-hint` : ''].filter(Boolean).join(' ');
  return {
    id,
    name: id,
    class: 'field__control',
    'aria-invalid': error ? ('true' as const) : undefined,
    'aria-describedby': describedBy || undefined,
  };
}

/** Label + control + hint + error. The control comes from the caller, built with controlAttrs. */
export function Field({ id, label, error, hint, counter, children }: Props) {
  return (
    <div class="field">
      <label class="field__label" for={id}>
        {label}
      </label>
      {children}
      {counter && (
        <p class="field__counter" aria-hidden="true">
          {counter}
        </p>
      )}
      {hint && (
        <p class="field__hint" id={`${id}-hint`}>
          {hint}
        </p>
      )}
      {error && (
        <p class="field__error" id={`${id}-error`}>
          {error}
        </p>
      )}
    </div>
  );
}
