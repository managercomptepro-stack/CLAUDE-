/**
 * `npm run seed`: demo data IN THE EMULATORS ONLY (CLAUDE.md § 2). Start them first with
 * `npm run dev`. Writes `settings/public` (without it the rules refuse sign-ups) and ~60 demo
 * listings (scripts/demo-data.ts). Refuses to run unless FIRESTORE_EMULATOR_HOST points to this
 * machine; scripts/emulator.ts also refuses any project id that is not « demo-… ».
 */
import { DEMO_SETTINGS, SETTINGS_PATH } from '../src/data/settings.ts';
import { seedDocs } from './demo-data.ts';
import { EMULATOR_PROJECT, writeDoc } from './emulator.ts';

const host = process.env['FIRESTORE_EMULATOR_HOST'] ?? '';
if (!/^(127\.0\.0\.1|localhost|\[::1\]):\d+$/.test(host)) {
  console.error(`E_NOT_EMULATOR: FIRESTORE_EMULATOR_HOST must point to the local emulator (got « ${host} »)`);
  process.exit(1);
}

await writeDoc(SETTINGS_PATH, { ...DEMO_SETTINGS });
const docs = seedDocs();
for (const d of docs) await writeDoc(d.path, d.data);
const listings = docs.filter((d) => /^listings\/[^/]+$/.test(d.path)).length;
console.info(
  `seed: ${SETTINGS_PATH} + ${listings} demo listings written in the emulator (${EMULATOR_PROJECT})`,
);
