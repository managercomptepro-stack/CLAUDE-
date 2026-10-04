import { describe, expect, it, vi } from 'vitest';
import { decideAccess } from '../../src/lib/access';
import { isDisposableEmail } from '../../src/lib/disposable-email';
import { AppError, errorMessage, reportError } from '../../src/lib/errors';
import { loginUrl, profileStepUrl, safeNext, verifyEmailUrl } from '../../src/lib/navigation';
import {
  emailError,
  newPasswordError,
  parseBirthDate,
  pseudoError,
  validateContact,
  validateProfile,
  type ProfileInput,
} from '../../src/lib/profile-form';
import { fr } from '../../src/i18n/fr';

describe('errors', () => {
  it.each([
    ['auth/email-already-in-use', fr.errors.emailInUse],
    ['auth/wrong-password', fr.errors.wrongCredentials],
    ['auth/invalid-credential', fr.errors.wrongCredentials],
    ['auth/invalid-login-credentials', fr.errors.wrongCredentials],
    ['auth/network-request-failed', fr.errors.network],
    ['auth/popup-blocked', fr.errors.popupBlocked],
    ['permission-denied', fr.errors.permissionDenied],
  ])('%s → French message', (code, message) => {
    expect(errorMessage({ code, message: 'Firebase: raw' })).toBe(message);
  });

  it('never shows a raw Firebase message, even for an unknown code', () => {
    const msg = errorMessage({
      code: 'auth/something-new',
      message: 'Firebase: Error (auth/something-new).',
    });
    expect(msg).toBe(fr.errors.generic);
    expect(errorMessage(new Error('boom'))).toBe(fr.errors.generic);
    expect(errorMessage(null)).toBe(fr.errors.generic);
  });

  it('translates our own codes', () => {
    expect(errorMessage(new AppError('nioxxer/pseudo-taken'))).toBe(fr.errors.pseudoTaken);
    expect(errorMessage(new AppError('nioxxer/disposable-email'))).toBe(fr.errors.disposableEmail);
  });

  it('logs the raw code for diagnosis', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(reportError({ code: 'auth/user-disabled' }, 'test')).toBe(fr.errors.userDisabled);
    expect(spy).toHaveBeenCalledWith('[NIOXXER test]', 'auth/user-disabled');
    spy.mockRestore();
  });

  it('every French error text is free of codes', () => {
    for (const text of Object.values(fr.errors)) expect(text).not.toMatch(/auth\/|firebase/i);
  });
});

describe('safeNext', () => {
  it.each(['/compte', '/publier', '/booster?id=abc_1', '/annonce?id=x&y=2'])('keeps %s', (p) => {
    expect(safeNext(p)).toBe(p);
  });
  it.each([
    '//evil.com',
    '/\\evil.com',
    'https://evil.com',
    'javascript:alert(1)',
    '',
    null,
    undefined,
    '/a b',
  ])('refuses %s', (p) => {
    expect(safeNext(p)).toBe('/compte');
  });
  it('builds the guard URLs', () => {
    expect(loginUrl('/publier')).toBe('/connexion?next=%2Fpublier');
    expect(profileStepUrl('/compte')).toBe('/connexion?step=profil&next=%2Fcompte');
    expect(verifyEmailUrl('//evil.com')).toBe('/verifier-email?next=%2Fcompte');
  });
});

describe('decideAccess', () => {
  const verified = { anonymous: false, emailVerified: true };
  const unverified = { anonymous: false, emailVerified: false };
  it('no session or anonymous session → /connexion', () => {
    expect(decideAccess({ user: null, hasProfile: false }, 'profile', '/compte')).toEqual({
      kind: 'redirect',
      to: '/connexion?next=%2Fcompte',
    });
    expect(
      decideAccess(
        { user: { anonymous: true, emailVerified: false }, hasProfile: false },
        'profile',
        '/compte',
      ),
    ).toEqual({ kind: 'redirect', to: '/connexion?next=%2Fcompte' });
  });
  it('account without profile → profile step', () => {
    expect(decideAccess({ user: verified, hasProfile: false }, 'verified', '/publier')).toEqual({
      kind: 'redirect',
      to: '/connexion?step=profil&next=%2Fpublier',
    });
  });
  it('unverified e-mail → /verifier-email only where verification is required', () => {
    expect(decideAccess({ user: unverified, hasProfile: true }, 'verified', '/publier')).toEqual({
      kind: 'redirect',
      to: '/verifier-email?next=%2Fpublier',
    });
    expect(decideAccess({ user: unverified, hasProfile: true }, 'profile', '/compte')).toEqual({
      kind: 'allow',
    });
    expect(decideAccess({ user: verified, hasProfile: true }, 'verified', '/publier')).toEqual({
      kind: 'allow',
    });
  });
});

describe('profile form', () => {
  const NOW = new Date(Date.UTC(2026, 9, 2, 12));
  const valid: ProfileInput = {
    pseudo: 'Belle_Douala',
    birthDate: '1996-04-15',
    genre: 'femme',
    city: 'douala',
    whatsapp: '6 99 00 11 22',
    photoUrl: null,
    terms: true,
  };

  it('accepts a complete sheet and normalises it', () => {
    const r = validateProfile(valid, NOW);
    expect(r).toEqual({
      ok: true,
      value: {
        pseudo: 'Belle_Douala',
        pseudoLower: 'belle_douala',
        birthDate: new Date(Date.UTC(1996, 3, 15)),
        genre: 'femme',
        city: 'douala',
        whatsapp: '+237699001122',
        photoUrl: null,
      },
    });
  });

  it('accepts the optional photo only as a raw Cloudinary avatar URL', () => {
    const url = 'https://res.cloudinary.com/bcxiwwkh/image/upload/v1790960020/j0jjvgfilrtqchvyoqes.jpg';
    const ok = validateProfile({ ...valid, photoUrl: url }, NOW);
    expect(ok.ok && ok.value.photoUrl).toBe(url);
    const bad = validateProfile({ ...valid, photoUrl: 'https://evil.example/x.jpg' }, NOW);
    expect(bad.ok ? null : Object.keys(bad.errors)).toEqual(['photoUrl']);
  });

  it('refuses 17 years and 364 days, accepts 18 years', () => {
    const minor = validateProfile({ ...valid, birthDate: '2008-10-03' }, NOW);
    expect(minor.ok ? null : minor.errors.birthDate).toBe(fr.form.birthMinor);
    expect(validateProfile({ ...valid, birthDate: '2008-09-30' }, NOW).ok).toBe(true);
  });

  it('reports every missing field', () => {
    const r = validateProfile(
      { pseudo: '', birthDate: '', genre: '', city: '', whatsapp: '', photoUrl: null, terms: false },
      NOW,
    );
    expect(r.ok).toBe(false);
    if (!r.ok)
      expect(Object.keys(r.errors).sort()).toEqual([
        'birthDate',
        'city',
        'genre',
        'pseudo',
        'terms',
        'whatsapp',
      ]);
  });

  it('checks real calendar dates', () => {
    expect(parseBirthDate('1995-02-29')).toBeNull();
    expect(parseBirthDate('1996-02-29')).toEqual(new Date(Date.UTC(1996, 1, 29)));
    expect(parseBirthDate('15/04/1996')).toBeNull();
    expect(parseBirthDate('1850-01-01')).toBeNull();
    const future = validateProfile({ ...valid, birthDate: '2030-01-01' }, NOW);
    expect(future.ok ? null : future.errors.birthDate).toBe(fr.form.birthInvalid);
  });

  it.each([
    ['ab', fr.form.pseudoLength],
    ['a'.repeat(21), fr.form.pseudoLength],
    ['_debut', fr.form.pseudoChars],
    ['avec espace', fr.form.pseudoChars],
    ['éloïse', fr.form.pseudoChars],
    ['SuperAdmin', fr.form.pseudoReserved],
    ['nioxxer_officiel', fr.form.pseudoReserved],
    ['lyceenne', fr.textProblems.minor],
    ['tarif_nuit', fr.textProblems.price],
  ])('pseudo « %s » refused', (pseudo, message) => {
    expect(pseudoError(pseudo)).toBe(message);
  });

  it.each(['Joe', 'mimi.237', 'Couple-Kribi', 'x_y_z'])('pseudo « %s » accepted', (pseudo) => {
    expect(pseudoError(pseudo)).toBeNull();
  });

  it('validates the contact edit', () => {
    expect(validateContact({ city: 'kribi', whatsapp: '655443322' })).toEqual({
      ok: true,
      value: { city: 'kribi', whatsapp: '+237655443322' },
    });
    const bad = validateContact({ city: 'paris', whatsapp: '12' });
    expect(bad.ok ? null : Object.keys(bad.errors).sort()).toEqual(['city', 'whatsapp']);
  });

  it('checks e-mail and password', () => {
    expect(emailError('a@b.cm')).toBeNull();
    expect(emailError(' a@b.cm ')).toBeNull();
    expect(emailError('a@b')).toBe(fr.errors.invalidEmail);
    expect(newPasswordError('1234567')).toBe(fr.form.passwordShort(8));
    expect(newPasswordError('12345678')).toBeNull();
  });
});

describe('disposable e-mails', () => {
  it('refuses known disposable domains, case-insensitively', async () => {
    expect(await isDisposableEmail('x@yopmail.com')).toBe(true);
    expect(await isDisposableEmail('x@YOPMAIL.COM')).toBe(true);
    expect(await isDisposableEmail('x@0-mail.com')).toBe(true);
  });
  it('accepts common providers', async () => {
    for (const d of ['gmail.com', 'yahoo.fr', 'outlook.com', 'hotmail.com', 'icloud.com', 'yahoo.com']) {
      expect(await isDisposableEmail(`x@${d}`)).toBe(false);
    }
    expect(await isDisposableEmail('pas-un-email')).toBe(false);
  });
});
