/** `npm run rules:sync` — rewrites the generated block of firestore.rules from src/data. */
import { readFileSync, writeFileSync } from 'node:fs';
import { injectSharedBlock } from './rules-shared.ts';

const FILE = 'firestore.rules';
const before = readFileSync(FILE, 'utf8');
const after = injectSharedBlock(before);
writeFileSync(FILE, after);
console.log(before === after ? 'firestore.rules already in sync' : 'firestore.rules updated');
