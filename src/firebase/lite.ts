/**
 * Firestore « lite » (REST, no realtime): much lighter than the full SDK, used for every read
 * and write outside the admin (CLAUDE.md § 3).
 */
import { connectFirestoreEmulator, getFirestore, type Firestore } from 'firebase/firestore/lite';
import { firebaseApp, firebaseEnv } from './app';
import { EMULATOR_HOST, EMULATOR_PORTS } from './config';

let instance: Firestore | null = null;

export function db(): Firestore {
  if (!instance) {
    instance = getFirestore(firebaseApp());
    if (firebaseEnv.useEmulators) connectFirestoreEmulator(instance, EMULATOR_HOST, EMULATOR_PORTS.firestore);
  }
  return instance;
}
