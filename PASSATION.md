# Passation — NIOXXER v2 (3 oct. 2026)

**Objectif** : reconstruire NIOXXER v2 phase par phase (docs/PLAN.md), preuves dans PROGRESS.md, commit par étape verte.

**Fait** (commits `3efd147` phase 8, `06b95a0` résultats, `1901ce4` décisions)
- Phases 0–8 terminées. Phase 8 : pages légales + /aide statiques (sans JS), pied de page, réacceptation CGU (AuthGate), OG, sitemap/robots, validateur de liens, `scripts/maintenance.ts` + workflow GitHub.
- `npm test` → 433 unitaires + 144 règles + build + check-links (0 lien mort) ; E2E légal/admin-global verts ; aperçu staging publié (expire 10 oct.), OG validé (opengraph.xyz), Lighthouse `/` 87–91.
- Décisions propriétaire 15–17 : Q22–Q27 validées (nudité interdite, pas de remboursement, etc.).

**Reste**
1. Phase 9 (docs/PLAN.md § Phase 9) : `deploy:preview`, écrire `docs/RECETTE.md` (une case par parcours SPEC, Android Chrome + lien WhatsApp), corriger les retours.
2. Propriétaire (HUMAN-TODO) : identité éditeur dans `src/data/legal.ts` (sinon `deploy` refusé), avis juriste loi 2024/017, secrets GitHub au moment de la bascule, `admins/{uid}`, numéros MoMo, logos.
3. Production seulement sur demande explicite du propriétaire.

**Fichiers clés** : `src/i18n/legal-fr.ts` (textes légaux, build seulement) · `src/shell/legal.ts`, `render.ts`, `seo.ts` · `src/components/AuthGate.tsx`, `TermsUpdate.tsx` · `scripts/maintenance.ts`, `check-links.ts`, `check-legal.ts` · `.github/workflows/maintenance.yml` · `tests/rules/maintenance.test.ts`, `tests/e2e/legal.spec.ts`, `captures-phase8.spec.ts`.

**Pièges**
- `dist/` et `node_modules/` interdits en lecture (réglages) : vérifier via scripts (check-links) ou `node -e` (exports).
- PROGRESS.md en CRLF partiel : éditer par script Python (`newline=''`, convertir en `\r\n`) ; heredocs longs tronqués → script dans le scratchpad.
- Ne jamais piper une commande E2E dans `head` (coupe la suite) : sortie dans un fichier puis grep.
- E2E sous charge : timeouts `shell.spec` → relancer seul. Villes réservées `tests/e2e/feed-fixtures.ts` (`links` = kribi).
- Lighthouse bruité (1er passage 67 puis 91) : relancer ×2. firebase-admin 14 exige Node 22 → rester en 13.10.0.
