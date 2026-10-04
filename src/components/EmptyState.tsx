import type { ComponentChildren } from 'preact';

interface Props {
  title: string;
  body?: string;
  children?: ComponentChildren;
}

/** Honest empty state: says what is missing, never shows fake content. */
export function EmptyState({ title, body, children }: Props) {
  return (
    <section class="empty-state">
      <h2 class="empty-state__title">{title}</h2>
      {body && <p class="empty-state__body">{body}</p>}
      {children && <div class="empty-state__actions">{children}</div>}
    </section>
  );
}
