import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist/', 'archives/', 'node_modules/', 'playwright-report/', 'test-results/'] },
  js.configs.recommended,
  ...tseslint.configs.strict,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,
      '@typescript-eslint/no-explicit-any': 'error',
      'no-console': ['error', { allow: ['error'] }],
    },
  },
  {
    files: ['**/*.mjs'],
    languageOptions: { globals: globals.node },
  },
  {
    files: ['scripts/**', 'tests/**', '*.config.ts'],
    rules: { 'no-console': 'off' },
  },
  {
    files: ['tests/**'],
    rules: { '@typescript-eslint/no-non-null-assertion': 'off' },
  },
  prettier,
);
