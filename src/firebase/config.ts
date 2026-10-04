/**
 * Firebase web configuration, chosen by the Vite build mode (owner decision, 2 Oct 2026: these
 * values are public by design — a web API key only identifies the project, security comes from
 * firestore.rules, CLAUDE.md § 4.10 — so they live here, not in .env files, which are kept for
 * real secrets).
 *
 * - development (`vite`, e2e): « demo-nioxxer », can only ever reach the local emulators.
 * - preview (`vite build --mode preview`): test project « nioxxer-staging » (decision 12).
 * - production (`vite build`): « nioxxer-cda95 », served on nioxxer.com.
 */
import type { FirebaseOptions } from 'firebase/app';

export type BuildMode = 'development' | 'preview' | 'production';

export interface FirebaseEnv {
  projectId: string;
  /**
   * reCAPTCHA Enterprise site key of Firebase App Check (public by design), or null: no App Check
   * (emulators, or a project where the owner has not created the key yet).
   */
  appCheckKey: string | null;
  /** localhost (dev) · nioxxer-staging.firebaseapp.com (preview) · nioxxer.com (production). */
  authDomain: string;
  useEmulators: boolean;
}

interface Target {
  env: FirebaseEnv;
  options: Omit<FirebaseOptions, 'projectId' | 'authDomain'>;
}

const TARGETS: Readonly<Record<BuildMode, Target>> = {
  development: {
    env: { projectId: 'demo-nioxxer', authDomain: 'localhost', useEmulators: true, appCheckKey: null },
    options: { apiKey: 'demo-api-key' },
  },
  // Web app « nioxxer-web » registered with `firebase apps:create` on 2 Oct 2026.
  preview: {
    // App Check key created by the owner on 3 Oct 2026 (monitoring mode, « Appliquer » not on).
    env: {
      projectId: 'nioxxer-staging',
      authDomain: 'nioxxer-staging.firebaseapp.com',
      useEmulators: false,
      appCheckKey: '6LebOd0tAAAAAHCGNnDsW97u7rJML-Xk0cQBQqg6',
    },
    options: {
      apiKey: 'AIzaSyAuvnG6yM3nQCrSkHfasS9LAzPNQY4yWVw',
      messagingSenderId: '32898601996',
      appId: '1:32898601996:web:6468faa27ad9863e558a29',
    },
  },
  // Owner's decision (4 Oct 2026, choice A): nioxxer.com is served by the « nioxxer-staging » project
  // that passed the owner's review; the v1 project « nioxxer-cda95 » is no longer used.
  production: {
    env: {
      projectId: 'nioxxer-staging',
      authDomain: 'nioxxer.com',
      useEmulators: false,
      // The reCAPTCHA key does not list nioxxer.com yet (monitoring mode only): off for now.
      appCheckKey: null,
    },
    options: {
      apiKey: 'AIzaSyAuvnG6yM3nQCrSkHfasS9LAzPNQY4yWVw',
      messagingSenderId: '32898601996',
      appId: '1:32898601996:web:6468faa27ad9863e558a29',
    },
  },
};

function target(mode: string): Target {
  if (mode === 'development' || mode === 'preview' || mode === 'production') return TARGETS[mode];
  throw new Error(`E_FIREBASE_ENV: unknown build mode « ${mode} »`);
}

export function envForMode(mode: string): FirebaseEnv {
  return target(mode).env;
}

export function firebaseOptions(mode: string): FirebaseOptions {
  const { env, options } = target(mode);
  return { ...options, projectId: env.projectId, authDomain: env.authDomain };
}

export const EMULATOR_HOST = '127.0.0.1';
export const EMULATOR_PORTS = { auth: 9099, firestore: 8080 } as const;
