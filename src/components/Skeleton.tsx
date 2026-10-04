import { fr } from '../i18n/fr';

interface Props {
  /** Number of card placeholders. */
  cards?: number;
  title?: boolean;
}

/** Same classes as the static skeleton of the shell (src/shell/render.ts). */
export function Skeleton({ cards = 3, title = true }: Props) {
  return (
    <div aria-busy="true">
      {title && <div class="skeleton skeleton--title" />}
      {Array.from({ length: cards }, (_, i) => (
        <div key={i} class="skeleton skeleton--card" />
      ))}
      <span class="visually-hidden">{fr.loading}</span>
    </div>
  );
}
