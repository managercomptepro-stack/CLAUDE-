import { assertFails, assertSucceeds, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, getDoc } from 'firebase/firestore';
import { afterAll, beforeAll, describe, it } from 'vitest';
import { createEnv, fs, seed, SETTINGS, userCtx } from './setup';

let env: RulesTestEnvironment;
beforeAll(async () => {
  env = await createEnv();
  await env.clearFirestore();
  await seed(env, { 'settings/public': SETTINGS });
});
afterAll(async () => env.cleanup());

describe('smoke', () => {
  it('reads public settings, refuses an unknown collection', async () => {
    const db = fs(env.unauthenticatedContext());
    await assertSucceeds(getDoc(doc(db, 'settings/public')));
    await assertFails(getDoc(doc(db, 'unknown/x')));
    await assertFails(getDoc(doc(fs(userCtx(env, 'alice')), 'settings/other')));
  });
});
