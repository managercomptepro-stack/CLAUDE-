import { fr } from '../i18n/fr';

/** Line icons of the public pages (24×24, stroke = currentColor, decorative: aria-hidden). */
const PATHS = {
  pin: 'M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0C18.5 15.4 12 21 12 21z M12 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z',
  chevronDown: 'm6 9 6 6 6-6',
  eye: 'M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  heart: 'M12 20s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.2a4.3 4.3 0 0 1 7.5 2.6C19.5 15.4 12 20 12 20z',
  share: 'M12 15V3.5 M7.5 8 12 3.5 16.5 8 M5 12.5V19a1.5 1.5 0 0 0 1.5 1.5h11A1.5 1.5 0 0 0 19 19v-6.5',
  flag: 'M5.5 21V4 M5.5 4.5h11l-2 4 2 4h-11',
  phone:
    'M6.6 3.5h2.8l1.4 4.2-2 1.3a12 12 0 0 0 6.2 6.2l1.3-2 4.2 1.4v2.8a1.6 1.6 0 0 1-1.7 1.6A16.5 16.5 0 0 1 5 5.2a1.6 1.6 0 0 1 1.6-1.7z',
  close: 'M6 6l12 12 M18 6 6 18',
  locate:
    'M12 19a7 7 0 1 0 0-14 7 7 0 0 0 0 14z M12 2v3 M12 19v3 M2 12h3 M19 12h3 M12 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4z',
  search: 'M11 17.5a6.5 6.5 0 1 0 0-13 6.5 6.5 0 0 0 0 13z m5-1.5 4.5 4.5',
  sliders: 'M4 7h10 M18 7h2 M16 5v4 M4 17h4 M12 17h8 M10 15v4',
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({ name, filled = false }: { name: IconName; filled?: boolean }) {
  return (
    <svg
      class={`icon${filled ? ' icon--filled' : ''}`}
      viewBox="0 0 24 24"
      width="24"
      height="24"
      aria-hidden="true"
      focusable="false"
    >
      <path d={PATHS[name]} />
    </svg>
  );
}

/** Blue « verified » badge (SPEC § 8), announced to screen readers. */
export function VerifiedBadge() {
  return (
    <span class="verified" role="img" aria-label={fr.card.verified} title={fr.card.verified}>
      <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" focusable="false">
        <path d="M12 2.5 14.6 4.4l3.2-.2.9 3.1 2.6 1.9-1.1 3 1.1 3-2.6 1.9-.9 3.1-3.2-.2L12 21.5l-2.6-1.9-3.2.2-.9-3.1-2.6-1.9 1.1-3-1.1-3 2.6-1.9.9-3.1 3.2.2z" />
        <path class="verified__check" d="m8.5 12.2 2.4 2.4 4.6-5" />
      </svg>
    </span>
  );
}
