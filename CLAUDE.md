# NIOXXER v2 — instructions permanentes pour Claude Code

Tu construis **NIOXXER v2** : site mobile de petites annonces de rencontre libre entre adultes au
Cameroun, en français, sur **nioxxer.com**. La v1 a échoué (lent, incohérent, pages factices). Tu
repars d'une base propre. Prends ton temps : le propriétaire préfère 5 heures de travail vérifié à
un résultat rapide et faux.

Ce fichier contient les **règles**. Le détail est dans `docs/` — lis-le avant chaque phase :

| Fichier | Contenu | Quand le lire |
|---|---|---|
| `docs/SPEC.md` | Cahier des charges produit (les 60 réponses du propriétaire) | Au début, puis à chaque phase |
| `docs/ARCHITECTURE.md` | Stack, modèle de données, règles de sécurité, limites gratuites, performance | Avant d'écrire du code |
| `docs/PLAN.md` | Phases, critères d'acceptation, tests exigés | Avant chaque phase |
| `docs/LECONS-V1.md` | Pourquoi la v1 a échoué, ce qu'on réutilise | Au début |
| `docs/HUMAN-TODO.md` | Réglages que SEUL le propriétaire peut faire (consoles) | Quand tu es bloqué par un réglage |
| `PROGRESS.md` | Ton journal d'avancement — **ta mémoire entre sessions** | Au début de CHAQUE session |

---

## 1. Méthode de travail (obligatoire)

1. **Début de session** : lis `PROGRESS.md`, puis la phase en cours dans `docs/PLAN.md`. Ne te fie
   pas à ta mémoire d'une session précédente : le contexte a pu être compacté.
2. **Une phase à la fois.** Ne commence pas la phase N+1 tant que tous les critères d'acceptation
   de la phase N ne sont pas prouvés (tests verts + vérification visuelle).
3. **Avant de coder une phase** : écris un mini-plan (fichiers touchés, tests à écrire) dans
   `PROGRESS.md`. Écris les tests en même temps que le code, pas après.
4. **Preuve, pas affirmation.** Tu ne déclares jamais « fait », « ça marche », « testé » sans avoir
   exécuté la commande et lu sa sortie. Dans `PROGRESS.md`, chaque critère coché cite la commande
   exécutée et le résultat (ex. `npm run test:rules → 47 passed`).
5. **Vérification visuelle** : chaque écran est vérifié avec Playwright en viewport **375×812**
   (et 360×740), en thème sombre ET clair, capture d'écran enregistrée dans `docs/captures/`.
   Regarde réellement les captures (outil Read sur l'image) avant de conclure.
6. **Commit git à la fin de chaque étape verte**, message en anglais, petit et descriptif.
   Jamais de commit avec des tests rouges.
7. **Fin de session** : mets à jour `PROGRESS.md` (fait / en cours / prochain pas / blocages).
8. Pour les revues importantes (fin de phase 3, 5, 7), lance un **sous-agent de relecture** qui
   n'a pas écrit le code : il relit le diff contre `docs/SPEC.md` et `docs/ARCHITECTURE.md` et
   liste les écarts. Corrige avant de passer à la suite.

## 2. Anti-hallucination (obligatoire)

- **N'invente aucune API.** Avant d'utiliser une fonction d'une bibliothèque (Firebase, Cloudinary,
  Preact, Vite, Playwright), vérifie qu'elle existe dans la version installée : lis les types dans
  `node_modules/<paquet>/**/*.d.ts` ou la doc officielle. En cas de doute, écris un test minimal.
- **Versions** : avant d'installer, `npm view <paquet> version`. Épingle les versions exactes dans
  `package.json` (pas de `^`). Note-les dans `PROGRESS.md`.
- **Aucune donnée inventée à l'écran** : pas de fausses annonces, faux compteurs, faux avis, faux
  « 1 200 membres ». Tout chiffre affiché vient de Firestore. Si une donnée n'existe pas, on
  n'affiche rien ou un état vide honnête.
- **Données de démonstration** : uniquement dans les émulateurs (script `npm run seed`), jamais
  en production.
- **Réglages de console** (Firebase, Google Cloud, Cloudinary, DNS) : tu ne peux pas les faire.
  Ne prétends pas qu'ils sont faits. Ajoute la tâche dans `docs/HUMAN-TODO.md`, continue avec les
  émulateurs, et signale-le en fin de session.
- **Si la spec est ambiguë** : choisis l'option la plus simple compatible avec `docs/SPEC.md`,
  écris la question et ton choix dans `PROGRESS.md` § Questions, et continue. Ne t'arrête pas.
- **N'ajoute aucune fonctionnalité absente de la spec** (pas de messagerie, pas de crédits, pas de
  vidéo, pas de swipe, pas d'anglais). Une idée utile → `PROGRESS.md` § Idées, pas dans le code.

## 3. Stack (décidée — ne pas changer sans accord écrit du propriétaire)

- **Vite** (multi-pages) + **TypeScript strict** + **Preact** (composants, hooks). Pas de React,
  pas de Next, pas de Tailwind (CSS natif avec variables, voir § Design).
- **Firebase plan Spark (gratuit, sans carte)** : Hosting, Authentication (e-mail/mot de passe,
  Google, anonyme), Cloud Firestore. **Pas de Cloud Functions, pas de Cloud Storage** (indisponibles
  sur Spark). Toute la sécurité passe par `firestore.rules`.
- Lecture publique avec **`firebase/firestore/lite`** (bien plus léger) ; SDK Firestore complet
  seulement là où c'est indispensable (admin).
- **Cloudinary (gratuit)** pour les photos : upload non signé via presets restreints, filigrane
  appliqué À L'UPLOAD (transformation entrante), livraison `f_auto,q_auto`, petites largeurs.
- **Tâches planifiées** : GitHub Actions (cron) + script Node avec compte de service (voir
  ARCHITECTURE § Maintenance). Repli : bouton « Nettoyage » dans l'admin.
- Tests : **Vitest** (unitaires), **@firebase/rules-unit-testing** sur émulateurs (règles),
  **Playwright** (bout en bout, mobile, contre émulateurs), **Lighthouse** (performance).
- Machine de dev : **Windows**, PowerShell, pas de Docker. Scripts npm multiplateformes
  (`cross-env` si besoin). Émulateurs Firebase : voir HUMAN-TODO (Java).

## 4. Règles non négociables

1. **Majeurs uniquement.** Date de naissance obligatoire, âge ≥ 18 ans vérifié dans
   `firestore.rules` (pas seulement le formulaire), date de naissance non modifiable ensuite.
2. **Tolérance zéro sur les mineurs.** Tout texte (pseudo, description, « ce que je propose »,
   quartier) contenant un terme de la liste `MINOR_TERMS` est **refusé par `firestore.rules`** et
   par le client (même liste, test qui vérifie que les deux sont identiques). Motif de signalement
   « La personne semble mineure » prioritaire dans l'admin.
3. **Pas de prix dans les annonces** (décision du propriétaire : le prix se discute sur WhatsApp).
   Montants et termes tarifaires refusés (`PRICE_PATTERN`), même mécanisme que la règle 2.
4. **Plateforme neutre.** Le contenu appartient à ses auteurs. CGU acceptées par case à cocher à
   l'inscription (version + date enregistrées). Les CGU interdisent tout contenu illégal, y compris
   l'offre de services sexuels tarifés (art. 294 du Code pénal camerounais) — c'est la protection
   juridique du propriétaire, ne l'affaiblis pas.
5. **Le numéro WhatsApp n'est jamais dans le HTML ni dans les documents publics d'annonce.** Il est
   lu dans un document séparé uniquement au clic sur le bouton WhatsApp (voir ARCHITECTURE).
6. **Compte requis seulement pour publier.** Regarder, filtrer et contacter : libre, sans compte.
   Publier, booster, gérer ses annonces : compte + e-mail vérifié (`email_verified` dans les règles).
7. **Publicité identifiable** : toute annonce mise en avant porte l'étiquette visible « Premium »
   ou « Sponsorisé » (loi camerounaise 2010/021).
8. **Journal d'audit** : toute action admin (suppression, badge, boost, bannissement, réglage de
   paiement, validation/rejet de paiement) écrit dans `auditLog` (création seule, jamais modifié).
9. **Rien n'est publié qui ne fonctionne pas.** Une page dont le bouton principal ne fait rien
   ne part pas en production.
10. **Secrets** : la config web Firebase et les noms de presets Cloudinary sont publics par
    conception. Le **secret API Cloudinary** et la **clé de compte de service Firebase** ne vont
    JAMAIS dans le dépôt ni dans le code client : uniquement en secrets GitHub Actions.

11. **Audit de sécurité à chaque nouvelle fonctionnalité** (règle du propriétaire, 3 oct. 2026) :
    un sous-agent de relecture indépendant vérifie secrets, règles Firestore (IDOR, élévation de
    privilèges, montants, doubles soumissions), exposition des données, XSS, uploads, en-têtes
    (`firebase.json` + CSP de `src/shell/csp.ts`), dépendances (`npm audit`), build de production
    et maintenance. Chaque trou trouvé est **corrigé** avec un test autorisé/refusé, pas seulement
    listé. Tout nouveau domaine externe doit être ajouté à la CSP (sinon il est bloqué en ligne).

## 5. Performance (exigence, pas option)

Public : téléphones Android moyens, connexion notée 6/10 par le propriétaire. La v1 mettait
**10,8 s** à charger l'accueil. Objectifs mesurés par Lighthouse mobile (throttling par défaut) :

- Performance ≥ **85** sur accueil, recherche, annonce. LCP ≤ 2,5 s. CLS ≤ 0,05.
- JS initial de l'accueil ≤ **120 Ko gzip**. Polices auto-hébergées (woff2, sous-ensemble latin),
  `font-display: swap`. Aucune requête bloquante vers un domaine tiers avant le premier affichage.
- Le squelette de la page s'affiche avant tout appel réseau Firebase.
- Images : vignette de fil ≤ 30 Ko (`w_360`), `loading="lazy"`, dimensions fixées (pas de saut).
- Fichiers JS/CSS hachés par Vite → cache long (`max-age=31536000, immutable`) ; HTML en `no-cache`.
- Le quota Hosting Spark est de **360 Mo/jour** de transfert : chaque Ko compte.

## 6. Design

- Mobile d'abord (360–430 px). Desktop : colonne centrale de 480 px max, propre, sans plus.
- Thème **sombre par défaut** + thème clair, bascule mémorisée (`localStorage`, préférence
  d'affichage uniquement). Toutes les couleurs et polices via variables CSS dans
  `src/styles/tokens.css`. **Aucune couleur en dur dans un composant.**
- Palette de départ (reprise de la v1, validée) : fond `#100E14`, encre `#F2EDF3`, accent
  `#F0455F`, or/safran `#F5C542` (réservé au Premium). Titres Young Serif, interface Karla.
- Barre fixe en bas, 4 éléments : Accueil · Recherche · **Publier (+ central)** · Compte.
- Pas de décor animé lourd (cause de lenteur v1). Animations courtes (≤ 250 ms), uniquement
  `transform`/`opacity`, coupées si `prefers-reduced-motion`.
- Logos officiels uniquement pour WhatsApp, MTN MoMo, Orange Money, Google (fichiers SVG
  officiels, voir HUMAN-TODO si absents ; ne jamais les redessiner).
- Qualité visée : application professionnelle, soignée, cohérente sur TOUTES les pages (la v1
  avait deux identités visuelles différentes). Un composant = une seule implémentation partagée.

## 7. Conventions

- Code, noms, commits : **anglais**. Textes visibles : **français**, tous dans `src/i18n/fr.ts`
  (aucun texte utilisateur en dur dans un composant).
- Toute donnée utilisateur affichée passe par le rendu Preact (échappement automatique) ;
  `dangerouslySetInnerHTML` interdit.
- Pas de `any` TypeScript. Pas de code mort, pas de `console.log` en production
  (`console.error` avec code d'erreur autorisé).
- Messages d'erreur Firebase traduits en français clair (reprendre `translateAuthError` de la v1).
- Chaque règle de `firestore.rules` a au moins un test « autorisé » et un test « refusé ».

## 8. Commandes

```
npm run dev          # Vite + émulateurs (auth, firestore) — site sur http://localhost:5173
npm run seed         # données de démo DANS LES ÉMULATEURS uniquement
npm test             # unitaires + règles + build
npm run test:e2e     # Playwright mobile contre émulateurs
npm run lighthouse   # budget de performance sur le build
npm run deploy:preview   # canal de prévisualisation Firebase (lien temporaire)
npm run deploy           # production — UNIQUEMENT après accord du propriétaire
```

Tu ne lances **jamais** `npm run deploy` (production) sans que le propriétaire l'ait demandé
explicitement dans la conversation. `deploy:preview` est autorisé en fin de phase.
