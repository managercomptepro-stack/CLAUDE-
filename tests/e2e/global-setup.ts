import { clearAuth, clearFirestore, writeDoc } from '../../scripts/emulator.ts';
import { DEMO_SETTINGS, SETTINGS_PATH } from '../../src/data/settings.ts';

/** Fresh emulators for every run: no accounts, only the public settings. */
export default async function globalSetup(): Promise<void> {
  await clearAuth();
  await clearFirestore();
  await writeDoc(SETTINGS_PATH, { ...DEMO_SETTINGS });
}
