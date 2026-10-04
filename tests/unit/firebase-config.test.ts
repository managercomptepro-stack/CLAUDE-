import { describe, expect, it } from 'vitest';
import { envForMode, firebaseOptions } from '../../src/firebase/config';

describe('firebase config by build mode', () => {
  it('development: demo project, emulators only', () => {
    expect(envForMode('development')).toEqual({
      projectId: 'demo-nioxxer',
      authDomain: 'localhost',
      useEmulators: true,
      appCheckKey: null,
    });
    expect(firebaseOptions('development').apiKey).toBe('demo-api-key');
  });

  it('preview: the separate test project nioxxer-staging (never production)', () => {
    const o = firebaseOptions('preview');
    expect(o.projectId).toBe('nioxxer-staging');
    expect(o.authDomain).toBe('nioxxer-staging.firebaseapp.com');
    expect(o.appId).toMatch(/^1:32898601996:web:/);
    expect(envForMode('preview').useEmulators).toBe(false);
  });

  it('production: nioxxer-staging with authDomain nioxxer.com', () => {
    const o = firebaseOptions('production');
    expect(o.projectId).toBe('nioxxer-staging');
    expect(o.authDomain).toBe('nioxxer.com');
    expect(o.appId).toMatch(/^1:32898601996:web:/);
    expect(envForMode('production').useEmulators).toBe(false);
  });

  it('only the demo project uses the emulators', () => {
    for (const mode of ['development', 'preview', 'production']) {
      const e = envForMode(mode);
      expect(e.useEmulators).toBe(e.projectId.startsWith('demo-'));
    }
  });

  it('refuses an unknown mode', () => {
    expect(() => envForMode('staging')).toThrow(/E_FIREBASE_ENV/);
    expect(() => firebaseOptions('test')).toThrow(/E_FIREBASE_ENV/);
  });
});

describe('App Check (reCAPTCHA Enterprise, owner 3 Oct 2026)', () => {
  it('only on the preview project for now; never on the emulators', () => {
    expect(envForMode('development').appCheckKey).toBeNull();
    expect(envForMode('preview').appCheckKey).toBe('6LebOd0tAAAAAHCGNnDsW97u7rJML-Xk0cQBQqg6');
    expect(envForMode('production').appCheckKey).toBeNull();
  });
});
