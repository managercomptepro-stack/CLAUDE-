import { describe, expect, it } from 'vitest';
import { CONTACT_PATTERN, findTextProblem, MINOR_PATTERN, PRICE_PATTERN } from '../../src/data/moderation';
import { ACCEPTED, REFUSED } from './moderation-samples';

describe('moderation — accepted texts', () => {
  it('has at least 30 accepted examples', () => {
    expect(ACCEPTED.length).toBeGreaterThanOrEqual(30);
  });
  it.each(ACCEPTED)('accepts « %s »', (text) => {
    expect(findTextProblem(text)).toBeNull();
  });
});

describe('moderation — refused texts', () => {
  it('has at least 30 refused examples', () => {
    expect(REFUSED.length).toBeGreaterThanOrEqual(30);
  });
  it.each(REFUSED)('refuses « %s » as %s', (text, reason) => {
    expect(findTextProblem(text)).toBe(reason);
  });
});

describe('moderation — patterns are RE2-compatible', () => {
  // RE2 (Firestore rules) has no look-around, no back-references, and an ASCII-only \b.
  it.each([
    ['MINOR_PATTERN', MINOR_PATTERN],
    ['PRICE_PATTERN', PRICE_PATTERN],
    ['CONTACT_PATTERN', CONTACT_PATTERN],
  ])('%s uses no unsupported syntax', (_name, pattern) => {
    expect(pattern).not.toMatch(/\(\?[=!<]/);
    expect(pattern).not.toMatch(/\\[1-9]/);
    expect(pattern).not.toMatch(/\\b/);
    expect(pattern).not.toContain("'");
  });
});
