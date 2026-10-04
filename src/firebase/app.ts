import { getApp, getApps, initializeApp, type FirebaseApp } from 'firebase/app';
import { envForMode, firebaseOptions, type FirebaseEnv } from './config';

export const firebaseEnv: FirebaseEnv = envForMode(import.meta.env.MODE);

export function firebaseApp(): FirebaseApp {
  return getApps().length ? getApp() : initializeApp(firebaseOptions(import.meta.env.MODE));
}
