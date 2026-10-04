/**
 * Background colour of each theme, needed outside CSS (meta theme-color). Must equal `--bg`
 * in tokens.css — tests/unit/shell.test.ts checks it.
 */
export type Theme = 'dark' | 'light';

export const THEME_COLORS: Record<Theme, string> = {
  dark: '#100e14',
  light: '#faf7f5',
};

/** localStorage key of the theme choice (display preference only). */
export const THEME_STORAGE_KEY = 'nx-theme';
