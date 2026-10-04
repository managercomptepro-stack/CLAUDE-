/**
 * Single source of truth (ARCHITECTURE § 5): firestore.rules must contain exactly the block
 * generated from src/data, and the rules' text check must give the same verdict as the client.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { isReservedPseudo } from '../../src/data/limits';
import { findTextProblem } from '../../src/data/moderation';
import { renderSharedBlock } from '../../scripts/rules-shared';
import { ACCEPTED, REFUSED } from './moderation-samples';

const rules = readFileSync('firestore.rules', 'utf8');

function sharedValue(name: string): string {
  const m = rules.match(new RegExp(`function ${name}\\(\\) \\{ return '([^']*)'; \\}`));
  if (!m?.[1]) throw new Error(`${name} not found in firestore.rules`);
  return m[1];
}

/** What the rules do: lower() on ASCII letters only (proven on the emulator), then one regex. */
function rulesRefuse(text: string): boolean {
  const pattern = sharedValue('forbiddenTextPattern');
  expect(pattern.startsWith('(?s)')).toBe(true);
  const asciiLower = text.normalize('NFC').replace(/[A-Z]/g, (c) => c.toLowerCase());
  return new RegExp(pattern.slice(4), 's').test(asciiLower);
}

describe('firestore.rules shared block', () => {
  it('is identical to the block generated from src/data (run `npm run rules:sync` if not)', () => {
    expect(rules).toContain(renderSharedBlock());
  });
});

describe('reserved pseudos: rules == client', () => {
  it.each([
    ['Admin_237', true],
    ['nioxxer.officiel', true],
    ['SupportClient', true],
    ['Moderateur', true],
    ['Bob_237', false],
    ['Amandine', false],
  ])('%s → reserved: %s', (pseudo, reserved) => {
    expect(isReservedPseudo(pseudo)).toBe(reserved);
    expect(new RegExp(sharedValue('reservedPseudoPattern')).test(pseudo.toLowerCase())).toBe(reserved);
  });
});

describe('rules text check == client text check', () => {
  it.each(ACCEPTED)('both accept « %s »', (text) => {
    expect(findTextProblem(text)).toBeNull();
    expect(rulesRefuse(text)).toBe(false);
  });

  it.each(REFUSED.map(([t]) => t))('both refuse « %s »', (text) => {
    expect(findTextProblem(text)).not.toBeNull();
    expect(rulesRefuse(text)).toBe(true);
  });

  it.each(REFUSED.map(([t]) => t.toUpperCase()))('both refuse the capitalised « %s »', (text) => {
    expect(findTextProblem(text)).not.toBeNull();
    expect(rulesRefuse(text)).toBe(true);
  });
});
