# PROGRESS — journal de Claude Code

> Lis ce fichier au début de chaque session. Mets-le à jour à la fin de chaque étape.
> Chaque critère coché cite la commande exécutée et son résultat.

## Phase en cours
**Phase 9 — Recette finale (en cours, 3 oct. 2026)** : aperçu redéployé, `docs/RECETTE.md` écrit ;
attend la recette du propriétaire sur son téléphone, puis son feu vert explicite pour la production.
Phase 7 — Administration : **terminée** (3 oct. 2026), critères prouvés ci-dessous. Bandeau
Premium « Ruban » de la v1 : **fait** (3 oct.). **Phase 8 terminée** (3 oct. 2026, § Phase 8).
Prochaine : phase 9 (recette finale) — attend les réponses Q22–Q27 et HUMAN-TODO « bascule ».
Phase 6 — Booster et paiement manuel : **terminée** (2 oct. 2026). Phase 5 close : écart Lighthouse
(`/` ~82, LCP ~3,8 s, latence Firestore) **accepté par le propriétaire** le 2 oct. 2026 (réponse en
conversation : « Oui, accepté »). Phase 4 : test manuel par le propriétaire en attente (HUMAN-TODO).

## Environnement
- Node : `node -v` → v20.19.0
- Java : `java -version` → openjdk 11.0.32.1 → **firebase-tools 13.35.1** (Java 21 dans HUMAN-TODO)
- Git : `git --version` → 2.45.2.windows.1 ; dépôt local, branche `main`, `core.autocrlf=false`
- Versions épinglées (`package.json`, sans `^`) : preact 10.29.8, firebase 12.19.0, vite 8.3.2,
  @preact/preset-vite 2.10.6, @babel/core 7.29.7, typescript 6.0.3, vitest 4.1.11,
  @playwright/test 1.63.0, firebase-tools 13.35.1, @firebase/rules-unit-testing 5.0.2,
  eslint 10.11.0, @eslint/js 10.0.1, typescript-eslint 8.71.0, eslint-plugin-react-hooks 7.1.1,
  eslint-config-prettier 10.1.8, prettier 3.9.9, globals 17.13.0, concurrently 10.0.5,
  cross-env 10.1.0, tsx 4.23.15, @types/node 20.19.43, @fontsource/karla 5.3.0,
  @fontsource/young-serif 5.3.0. Vérifié : `node -p "require('./node_modules/<p>/package.json').version"`.
- Réseau lent : `npm install` a demandé 3 essais (coupure à 10 min, cache périmé avec
  `--prefer-offline`, ECONNRESET) → réussi avec `--fetch-retries=6` (« added 909 packages in 7m »).

## Fait
### Phase 9 — Recette finale et bascule (en cours)
Mini-plan (3 oct. 2026) : `deploy:preview` ; `docs/RECETTE.md` (une case par parcours SPEC, Android
Chrome + lien ouvert depuis WhatsApp, section « après la bascule ») ; corriger les retours ; production
seulement sur demande explicite.
- [x] `npm run deploy:preview` → exit 0, règles Firestore déployées sur `nioxxer-staging`, canal
      https://nioxxer-staging--preview-5k9bgz5i.web.app (expire **2026-10-10 11:23**).
- [x] `curl -w '%{http_code}'` sur les 16 adresses de la SPEC § 12 + sitemap → **200** ; `/n-existe-pas` → **404**.
- [x] `docs/RECETTE.md` : sections 0–8 (préparation, ouverture C+W, visiteur, inscription, compte,
      publier, booster, admin, pages), § 9 (ce que seuls les tests prouvent), § 10 (vérifs en ligne
      après `deploy`). Libellés recoupés avec `src/i18n/fr.ts` et `src/lib/admin-logic.ts` (onglets
      modérateur).
- [ ] Recette signée par le propriétaire.

**Retours de recette du propriétaire (3 oct. 2026, 28 points)** — décisions qui remplacent la SPEC
là où elles la contredisent : bandeau tout en haut, toutes villes, ordre tiré au hasard ; thème
clair par défaut ; « Supprimer mon compte » = demande (désactivation, effacement par l'admin ou
après 60 jours) ; Premium et Sponsorisé ont chacun prix + durée réglables ; filigrane centré 42 %.
Mini-plan par lots (commit à chaque lot vert, captures 375/360 clair+sombre) :
- **Lot 1 accueil (1–12)** : `lib/feed.ts` `loadBanner()` (toutes villes, `rank > 0`, index 0
  existant, plafond 100, boosts finis exclus) + `lib/shuffle.ts` (tirage au sort par niveau) ;
  `PremiumBanner` autonome, en tête de `CityFeedPage`, 190×260, 55 px/s, « quartier · ville »,
  hauteur réservée (cache local) et carte honnête « Votre annonce ici » si vide (pas de saut) ;
  `ListingCard` portrait, texte sur la photo, grille 2 colonnes pour tous ; cadres Premium/Sponsorisé
  + reflet (transform) ; apparition au défilement (`lib/reveal.ts`, cartes hors écran seulement →
  LCP intact) ; `:active` ; transitions de page (`@view-transition`) ; thème clair par défaut ;
  `--gutter` 12 px et espacements réduits. Tests : unitaires shuffle/banner, E2E feed/rail/shell.
- **Lot 2 recherche (13–15)** : résultats en une colonne, carte large (variante de `ListingCard`).
- **Lot 3 compte (16–21)** : un seul bloc profil + statut badge + aperçu des notifications ;
  demande de suppression (`users.deletionRequestedAt`, annonces `status: 'closed'`, règles + tests),
  onglet admin « Suppressions », effacement par l'admin, purge à 60 j dans `maintenance.ts` ;
  CGU + confidentialité.
- **Lot 4 admin + photos (22–28)** : « Mettre en avant » dans Récentes ; liste des vérifiés ;
  liste paginée des membres ; réglages Premium/Sponsorisé (prix + jours) → règles, `/booster`,
  validation ; barre d'onglets défilante ; doublon « Mise en avant retirée » ; nouvelle
  transformation Cloudinary dans HUMAN-TODO ; idée « payer pour dépasser la limite » § Idées.
- [x] **Lots 1–2 (accueil, recherche)** : `npm test` → exit 0 (**435** unitaires dont tirage au sort
      du bandeau, **146** règles dont requête du bandeau toutes villes autorisée / refusée sans filtres
      publics, build, liens : 0 mort) ; E2E `rail` + `feed` + `shell` ×2 tailles → **20 passed** puis
      **118 passed** (bandeau au-dessus du titre, toutes villes, Premium avant Sponsorisé, ordre différent
      d'un chargement à l'autre, 190×260, « quartier · ville », ~55 px/s, pause, invitation sans saut ;
      recherche : une carte par ligne avec titre ; thème clair par défaut). Captures
      `docs/captures/recette/` (accueil, fil, recherche ×2 thèmes ×2 tailles) regardées : doublon CSS
      de l'ancienne carte trouvé et retiré, texte sur photo renforcé.
      Corrigés en route : le bandeau ne remet plus à zéro les boosts finis (collision avec le fil sur
      le même document → fil bloqué) ; transitions natives entre pages retirées (erreur console
      « Transition was aborted » sur les redirections) → glissement `transform` de la page.
- [x] **Lots 3–4 (compte, admin, photos)** — un seul commit : les deux lots partagent `fr.ts`,
      `admin.ts`, `MembersTab.tsx` (liste des membres = point 25, demandes de suppression = point 20).
      `npm test` → exit 0 : **436** unitaires (durées séparées, ancien réglage numérique relu),
      **163** règles dont `deletion.test.ts` **12** (demande à l'heure serveur une seule fois, annonces
      fermées, plus de publication ni de modification, effacement par le super-admin seulement et dans
      l'ordre, dossier gardé si sanctionné, pierre tombale, réinscription refusée avec le même uid —
      contrôle positif avec un autre uid —, sanction toujours possible pendant la demande) et
      `maintenance.test.ts` **10** (purge à 60 j, dry-run, échec Auth → pierres tombales gardées,
      sans Auth → `sign-ins` sauté), réglages `boostDays` (map 1–90, nombre refusé) ; build ; liens.
      E2E : suite complète **208 passed** (1 délai sous charge sur /booster, repassé seul) puis
      après corrections `admin.spec` **16 passed**, `accounts`+`boost` **28**, `admin-global`
      **3**, `legal`+`boost`+`shell` **121**. Captures `docs/captures/recette/` (compte, compte long,
      suppression demandée, admin Récentes/Utilisateurs/Badges/Réglages ×2 thèmes ×2 tailles)
      regardées : écran « Suppression demandée » qui s'ouvrait défilé vers le bas → remis en haut.
      Régression trouvée et corrigée : pages légales sans JavaScript jamais « stables » pour
      Playwright à cause du glissement de page → glissement réservé aux pages où le JS tourne
      (`data-js` posé par le script du thème).
- [x] Relecture `verificateur` (lots 3–4) : 5 problèmes, tous corrigés et testés — compte figé +
      nouvelles CGU (écran bloqué), purge de nuit sans pierre tombale, sanction impossible pendant
      une demande, aperçu des notifications qui marquait lues celles cachées, comptes effacés
      sanctionnés qui encombraient la liste des demandes.
- [x] `npm run deploy:preview` (3 oct., 18:3x) → https://nioxxer-staging--preview-5k9bgz5i.web.app
      (expire le 10 oct.), règles déployées sur `nioxxer-staging`. Lighthouse canal (1er passage) :
      `/recherche` CLS **0,077** → 2 causes corrigées (cartes d'attente au format des cartes larges ;
      `main` d'un écran entier : le pied de page était juste derrière la barre du bas et comptait comme
      déplacé). Après : `/` **83** puis **89** et **88** (CLS 0, LCP ~3,1 s : écart déjà accepté),
      `/recherche` **87** (CLS 0), `/annonce` **99**, `/compte` **99**. E2E `legal`+`rail`+`feed`+`shell`
      → **133 passed**.
- [ ] Recette des 28 points par le propriétaire sur le lien de test.

### Modifications du propriétaire (3 oct. 2026, soir)
1. Thème **sombre** par défaut (retour au choix d'origine), clair au bouton.
2. « Ville : » à gauche du bouton de ville + lumière qui tourne sur son contour (dégradé conique en
   `transform: rotate`, coupé avec « réduire les animations »).
3. Pastille « Publier gratuit » dans l'en-tête (→ /publier), reflet périodique (transform).
4. Plafond d'annonces **par compte** (`users.maxListings`, 0–50, super-admin, audité `user.listing_cap`,
   « Revenir au réglage général » = null) ; les règles prennent ce plafond s'il existe
   (`listingCap()`), sinon le réglage général ; « Mes annonces » et /publier l'affichent.
5. Bouton WhatsApp flottant (48 px, logo officiel, au-dessus de la barre du bas, pas sur /admin), lien par
   défaut dans le HTML, numéro de `settings/public.supportWhatsApp` lu au clic seulement (aucune lecture
   Firestore par page vue) ; message « Bonjour, j'ai une question sur NIOXXER. » ; numéro de support
   désormais **international** (`+79003269415` accepté : règles, admin, `/aide`). Le contenu des pages
   garde 60 px de marge en bas et les toasts s'ouvrent au-dessus du bouton.

### App Check (4 oct. 2026)
- Clé reCAPTCHA Enterprise du propriétaire (staging, surveillance) dans `src/firebase/config.ts`
  (`appCheckKey`, null en dev/émulateurs et en production tant que la clé n'existe pas).
- 1er essai (App Check démarré avec l'app Firebase) : jeton bien présent, mais Lighthouse `/` **66 puis 46**
  (TBT 1,1–1,7 s, reCAPTCHA). Décision : App Check démarre avec **Firebase Auth** seulement
  (`src/firebase/app-check.ts`, appelé par `auth()`) → les pages publiques ne chargent pas reCAPTCHA.
- Vérifié sur le canal : accueil **0** requête reCAPTCHA, Lighthouse `/` **93 / 90**, `/annonce` **100** ;
  après un « J'aime » : reCAPTCHA chargé, `accounts:signUp`, `accounts:lookup`, `batchGet`, `commit`
  portent tous `X-Firebase-AppCheck` (« J'aime » de test annulé). Console : aucune erreur, aucun refus CSP
  (CSP complétée : `www.google.com/recaptcha`, `www.gstatic.com/recaptcha`, cadres reCAPTCHA).
  JS initial accueil 71,5 Ko gzip. `npm test` → 448 unitaires, 172 règles.
- « Appliquer » prévu sur **Authentication** seulement (HUMAN-TODO), Firestore en surveillance.

### Audit de sécurité (demande du propriétaire, 3 oct. 2026)
Méthode : contrôles mécaniques (historique git, `npm audit`, motifs XSS, build) + sous-agent de
relecture indépendant (lecture seule) ; règle permanente ajoutée à CLAUDE.md § 4.11.
- [x] **Secrets** : tout l'historique fouillé (`git rev-list --all` + `git grep` : clés privées,
      `private_key`, `api_secret`, `cloudinary://`, jetons GitHub/AWS) → **aucun secret**. Les
      `.env.development/.preview/.production` suivis jusqu'à `eadea11` ne contenaient que l'id de projet,
      l'authDomain et `VITE_USE_EMULATORS` (publics). Seules les 2 clés web Firebase `AIza…` (publiques
      par conception) → restriction par référent dans HUMAN-TODO. `.gitignore` complété (`*.pem`,
      `*.key`, `*.p12`, `*-adminsdk-*.json`, `credentials*.json`).
- [x] **Règles** (tests ajoutés) : `publicProfiles` liste réservée aux admins (avant : tout le monde
      pouvait lister tous les membres) ; numéro WhatsApp lisible seulement avec une session (anonyme
      suffit, ouverte au clic) ; numéro non modifiable par un compte bloqué ou figé (`canPublish`) ;
      plus d'effacement direct de `users`/`publicProfiles`/`usernames` par le membre (contournait la
      demande de suppression). `npm run test:rules` → **164 passed**.
- [x] **Paiement rejoué** : l'admin signale une référence de transaction déjà utilisée (même
      opérateur, écrite autrement) ou une capture identique (`proofReuse`, 3 tests unitaires). La
      référence reste facultative (SPEC § 7) : la rendre obligatoire et unique = décision du propriétaire.
- [x] **Maintenance** : garde-fou anti-effacement massif aussi sur les annonces expirées (> 200) et
      les comptes à purger (> 50), `--force` pour passer ; journal des annonces expirées sans titre ni
      propriétaire (2 tests sur émulateur) ; workflow : actions épinglées par commit,
      `persist-credentials: false`.
- [x] **En-têtes** : CSP en `<meta>` sur les pages construites (`src/shell/csp.ts` : scripts du site +
      empreinte SHA-256 du script de thème + `apis.google.com` ; images Cloudinary `bcxiwwkh`,
      `data:`, `blob:` ; connexions `*.googleapis.com` + API d'envoi Cloudinary ; `object-src 'none'`),
      `firebase.json` : HSTS, `X-Frame-Options: SAMEORIGIN` + `frame-ancestors 'self'` (pas `DENY` :
      sur nioxxer.com la connexion Google charge `/__/auth/iframe` du même domaine dans un cadre).
      3 tests unitaires.
- [x] **XSS / liens** : aucun `innerHTML`/`dangerouslySetInnerHTML` ; tous les `target="_blank"` en
      `rel="noopener noreferrer"` ; mini-balisage légal refuse `//autre-site` (test).
- [x] **Dépendances** : `npm audit fix` (compatible) + `overrides` `@grpc/grpc-js` 1.14.5 → 46 → **39**
      alertes ; le SDK Firebase client n'est plus signalé ; aucune trace de `grpc-js` dans `dist/assets`.
      Restent : `firebase-tools` (Java 21 requis), `firebase-admin` 14 et `lighthouse` 13 (Node 22
      requis) → outils de dev / CI uniquement (HUMAN-TODO).
- [x] **Build** : aucun `console.log`, aucune donnée de démo importée dans `src/`, erreurs Firebase
      traduites (déjà vérifié par `translateAuthError` / `reportError`).
- [x] Vérifications : `npm test` → exit 0 (**442** unitaires, **164** règles, build, liens) ; E2E complet
      **206 passed** (3 aléas de charge : socket coupé, délai), relancés : `admin`+`rail`+`listing`+`shell`
      **132 passed** puis les 2 derniers `shell` (réseau suspendu par Windows ; course du bouton de thème
      rendue robuste) **4 passed**. `deploy:preview` → en-têtes vérifiés par `curl -I` (CSP
      frame-ancestors, HSTS, X-Frame-Options, Referrer, Permissions, nosniff) ; navigateur sur le canal :
      accueil (annonces, photos) sans erreur de console, /connexion : script Google `apis.google.com` et
      cadre `…firebaseapp.com/__/auth/iframe` chargés sans refus CSP (la fenêtre Google ne s'ouvre pas
      depuis un clic automatique : clic final à faire par le propriétaire).
- [x] **Décisions du propriétaire (3 oct. 2026)** — 1 : seuls les signalements de **comptes vérifiés**
      comptent pour le masquage automatique ; les anonymes sont enregistrés (`verified: false`, imposé par
      les règles) et montrés à part dans l'admin ; « Classer sans suite »/« Rétablir » datent la décision
      (`reportsClearedAt`, heure serveur) pour que les anciens signalements anonymes ne reviennent pas.
      2 : `users/{uid}` (e-mail, naissance, WhatsApp) et `verificationRequests` réservés au membre et au
      super-admin ; les modérateurs lisent `sanctions/{uid}` (strikes + publication bloquée, tenu à jour
      dans le même lot que `users`, imposé par les règles) ; onglet Badges réservé au super-admin.
      SPEC § 10 et textes légaux mis à jour. Tests : règles `social` (anonyme/non vérifié jamais compté,
      ne masque pas au seuil, ne peut se dire vérifié), `admin` (miroir obligatoire et identique, lecture
      équipe seulement, pièces d'identité super-admin seulement, dossiers privés refusés aux modérateurs,
      `reportsClearedAt` à l'heure serveur seulement) ; unitaires file d'attente (signalements non comptés,
      retour après classement) ; E2E signalement anonyme puis compte vérifié, droits du modérateur.
      Limite : un compte déjà sanctionné avant le 3 oct. sans miroir `sanctions` ferait échouer son
      prochain strike (aucun sur staging à notre connaissance).


### Phase 0 — Préparation
- [x] Dépôt git créé + snapshot v1 : `git log --oneline` → `481f37b chore: snapshot v1 site as-is before v2 rebuild`
      (68 fichiers suivis ; `.gitignore` posé avant le snapshot pour exclure `node_modules`, logs, `.firebase/`).
- [x] Inventaire avant : 70 fichiers hors `node_modules` ; aucun secret trouvé (recherche de
      `*serviceAccount*`, `.pem`, `.key`, `.env*`, `"private_key"`, `api_secret` → 0 résultat).
- [x] Archivage : `git mv` de tout l'ancien site vers `archives/v1/` (y compris les anciens
      `archives/maquettes`, `archives/public-spa`, `archives/nioxxer-tokens.maquette.css`).
      Comptage : `git ls-files | wc -l` → 68 avant, 68 après ; `git ls-files archives/v1 | wc -l`
      → 57 ; racine suivie = 11 (CLAUDE.md, PROGRESS.md, PROMPT-DEMARRAGE.md, .firebaserc,
      .gitignore, .claude/launch.json, docs/ ×5) → 57 + 11 = 68 ✔.
      `firestore-debug.log` (non suivi) déplacé aussi. Dossier vide `nioxxer/` supprimé.
- [x] Racine propre : `ls -A` → `.claude .firebase .firebaserc .git .gitignore CLAUDE.md
      PROGRESS.md PROMPT-DEMARRAGE.md archives docs public` (`.firebase/` = cache de déploiement, ignoré).
- [x] Logos copiés (pas déplacés) dans `public/` : favicon.svg, logo-removebg.png, logo.png,
      logo.webp, og-image.png.
- [x] Ancien `node_modules` supprimé (`test ! -e node_modules` → ok) ; réinstallation en phase 1.
- [x] Aucun déploiement.
- Note : les décisions du propriétaire (réponses 1–10) ont été reportées dans SPEC, ARCHITECTURE,
  PLAN et HUMAN-TODO juste avant le snapshot ; elles sont donc incluses dans le commit `481f37b`.

### Phase 1 — Socle technique ✅

**Critères prouvés**
- [x] `npm run build` sans avertissement : `npx vite build 2>&1 | grep -ciE "warn|\(!\)"` → `0`
      (l'avertissement initial `configLoader: 'native'` a été corrigé par des extensions `.ts`
      explicites, pas masqué). JS commun `mount-*.js` 15,71 kB / **6,56 kB gzip** ; CSS 2,4 kB gzip.
- [x] `npm test` (lint + prettier --check + vitest + tsc + build) → exit 0 ; « All matched files
      use Prettier code style! » ; **Test Files 5 passed, Tests 131 passed** (après corrections du vérificateur).
- [x] Tests unitaires `cities` (28 villes, ordre SPEC, slugs, GPS au Cameroun, ville la plus
      proche), `format` (WhatsApp, âge, seuil 6575 j, 17 ans 364 j refusé, ancienneté), `moderation`
      (35 phrases acceptées dont « 25 ans », « 1m75 », « 2 enfants », « né en 1995 », « 27 F cherche homme » ; 41 refusées ;
      motifs compatibles RE2), `shell`, `firebase-config` → verts (dans les 131).
- [x] Toutes les pages s'ouvrent en dev : `npx playwright test` → **44 passed** (16 pages × 2
      viewports 375×812 et 360×740 : statut 200, en-tête, h1, 4 liens de barre, aucun
      `console.error`/`pageerror`).
- [x] Barre du bas identique partout : test e2e « bottom bar markup is identical on every page »
      (outerHTML comparé sur les 16 pages) + test unitaire équivalent → verts.
- [x] Bascule de thème mémorisée : test e2e « theme is dark by default, toggles, and is
      remembered across pages and reloads » + couleur de fond calculée (rgb(16,14,20) /
      rgb(250,247,245)) → verts.
- [x] Revue par le sous-agent `testeur` : npm test / playwright / prettier → seul écart :
      10 fichiers non formatés → corrigé (`prettier --write`), `format:check` ajouté à `npm test`.
- [x] Relecture par le sous-agent `verificateur` → corrigé : âges en lettres (« seize ans »,
      « dix-sept ans ») et « 17 yo » refusés ; « 27 F » accepté (un « f » seul exige 3 chiffres,
      « k » collé aux chiffres) ; contournement « 6 - 78 - 80 » bloqué (jusqu’à 3 séparateurs) ;
      clé de thème sortie de `render.ts`. Noté pour la phase 2 : `(?s)` obligatoire dans `matches()`.
      Faux positif connu et accepté : une date complète « 12/05/1995 » est vue comme un numéro.
- [x] Critique visuelle par le sous-agent `critique-visuel` (note 5/10) → corrigé : logo agrandi
      (40 px) et posé sur une pastille sombre en thème clair, libellés de barre alignés (même
      boîte de 32 px pour toutes les icônes) et en 12 px, titre 28 px, carte vide à bordure pleine,
      bouton de thème aligné sur la marge. Non retenu : même accent en clair et en sombre
      (#F0455F avec texte blanc < 4,5:1 ; on garde #D42F4C en clair).

**Captures** (`docs/captures/phase-1/`, 16 fichiers, regardées avec Read) :
- `accueil-dark-375.png` : en-tête logo + soleil, titre « Annonces », carte vide, barre du bas, Accueil actif en accent.
- `accueil-light-375.png` : même mise en page en clair, logo sur pastille sombre lisible, Publier en accent.
- `recherche-dark-375.png` : onglet Recherche actif, libellés alignés sur une même ligne.
- `compte-dark-360.png` : onglet Compte actif, rien ne déborde à 360 px.
- `404-dark-360.png` / `404-light-360.png` : titre + « Ce lien ne mène à aucune page » + bouton Retour à l'accueil.
- Les variantes `-light-` / `-360` restantes ont été générées par le même test ; contrôlées par échantillon.

**Vérifié sur l'émulateur Hosting** (`firebase emulators:start --only hosting`, sert `dist/`) :
`/`, `/recherche`, `/cgu`, assets, polices, logo → 200 ; `/page-qui-nexiste-pas` → 404 avec
`<title>Page introuvable — NIOXXER</title>` (cleanUrls + 404 OK).
~~[À PROUVER]~~ ✅ prouvé en fin de phase 3 par `curl -I` sur le canal `nioxxer-staging` (voir
phase 3). L'émulateur Hosting de firebase-tools 13 n'applique pas les en-têtes personnalisés.

**Décisions techniques**
- Coquille (en-tête, barre du bas, `<head>`, squelette) = fonctions TypeScript rendues en HTML
  statique au build par `scripts/vite-shell-plugin.ts` (une seule implémentation, visible avant
  le JS, pas d'hydratation). Le contenu des pages est en Preact.
- Polices copiées depuis `@fontsource/*` par `npm run fonts` (Karla 400 = 13,1 Ko, 700 = 13,3 Ko,
  Young Serif = 27,0 Ko) + licences OFL dans `public/fonts/`.
- Dev = projet `demo-nioxxer` (ne peut atteindre que les émulateurs ; `readEnv` refuse les
  mélanges). `authDomain` via `VITE_AUTH_DOMAIN` (`.env.development|preview|production`).
- Émulateurs Auth/Firestore (Java 11) pas encore démarrés : ce sera le premier pas de la phase 2.
- Écart avec le mini-plan : `src/firebase/lite.ts` et `auth.ts` n'ont pas été créés en phase 1
  (aucune page ne lit de données) ; ils viendront avec leur premier usage (phases 3 et 5).

**Mini-plan**
- Config : `package.json` (versions exactes), `tsconfig.json`, `vite.config.ts` (multi-pages,
  plugin « shell »), `eslint.config.js`, `.prettierrc.json`, `playwright.config.ts`,
  `firebase.json`, `firestore.rules` (refus total provisoire, réécrit en phase 2),
  `firestore.indexes.json` (vide), `.env.development` / `.env.preview` / `.env.production`.
- `src/firebase/` : `config.ts`, `app.ts`, `lite.ts`, `auth.ts` (chargé à la demande).
- `src/styles/` : `tokens.css` (sombre + clair), `base.css` ; `public/fonts/` woff2 latin
  (Young Serif 400, Karla 400/700) + licence OFL, copiés depuis `@fontsource/*`.
- `src/i18n/fr.ts` ; `src/data/` `cities.ts`, `genres.ts`, `moderation.ts`, `limits.ts` ;
  `src/lib/format.ts`.
- Coquille : `src/shell/` (en-tête, barre du bas, `<head>`, squelette — rendus en HTML statique
  au build par le plugin Vite, donc visibles avant le JS ; une seule implémentation) +
  `src/shell/client.ts` (bascule de thème). Composants Preact : `Toast`, `Skeleton`, `EmptyState`.
- 17 coquilles HTML (16 pages + 404) + `src/pages/*.tsx`.
- Tests : `tests/unit/cities|format|moderation|shell.test.ts` ; `tests/e2e/shell.spec.ts`
  (toutes les pages s'ouvrent, barre du bas identique, thème mémorisé) + captures.

**Choix de versions (Node 20.19 installé)**
- Vitest 5 exige Node ≥ 22.12 → **Vitest 4.1.11**. jsdom 30 exige Node 22 → non installé
  (pas nécessaire en phase 1).
- typescript-eslint 8.71 accepte TypeScript < 6.1 → **TypeScript 6.0.3** (pas 7.0).
- Preact 11.0.0 sorti le 30/09/2026 (2 jours) → **Preact 10.29.8** (écosystème éprouvé).
- @preact/preset-vite demande @babel/core 7 → **@babel/core 7.29.7**.

### Phase 2 — Règles Firestore

**Mini-plan** : `firestore.rules` complet (toutes les collections d'ARCHITECTURE § 4) ; bloc
partagé généré depuis `src/data` (`scripts/rules-shared.ts`, `npm run rules:sync`) ; tests
`tests/rules/` (accounts, listings, social, admin, queries, smoke) ; `tests/unit/rules-sync.test.ts`
(source unique) ; `firestore.indexes.json` ; `npm run test:rules` (émulateur lancé par
`firebase emulators:exec`) intégré à `npm test`.

**Critères prouvés**
- [x] Émulateurs Auth + Firestore démarrent avec Java 11 / firebase-tools 13.35.1 :
      « All emulators ready » (Auth 127.0.0.1:9099, Firestore 127.0.0.1:8080).
- [x] `npm run test:rules` → **Test Files 6 passed, Tests 129 passed** (après relecture), « Script exited
      successfully (code 0) » (≥ 60 exigés). Couvre toute la liste minimale de PLAN phase 2 +
      décisions 2, 3, 4 ; chaque règle a au moins un cas autorisé et un cas refusé.
- [x] Source unique : `tests/unit/rules-sync.test.ts` → le bloc de `firestore.rules` est
      identique au bloc généré ; la vérification « façon règles » (minuscules ASCII + regex
      combinée) donne le même verdict que `findTextProblem` sur 35 phrases acceptées, 41 refusées
      et leurs 41 versions en MAJUSCULES.
- [x] Relecture sécurité par le sous-agent `verificateur` (règles relues en attaquant) → 7 points :
      corrigés + testés : (1) contournement du bannissement par suppression/recréation de
      `users` → création de `users` + `publicProfiles` liée au même lot, suppression de compte
      « tout ou rien », dossier privé conservé si strikes > 0 ; (2) suppression/republication
      d'une annonce masquée pour effacer ses signalements → suppression refusée tant qu'elle est
      masquée, `likes ≥ 0`, un ancien « j'aime » ne décompte plus une annonce recréée ; (5)
      `auditId` libre dans une demande de badge → refusé ; (6) photo de profil d'un autre compte
      Cloudinary → nom de cloud figé (provisoire « nioxxer », à remplacer, HUMAN-TODO), pseudos
      réservés (admin, nioxxer, support, moderat…, officiel, staff, equipe) ; (7) une entrée
      d'audit couvrant plusieurs documents → `targetType` vérifié (liste fermée).
      Acceptés et documentés : (3) signalements par sessions anonymes (décision 4) ; (4) vues
      sans connexion pouvant consommer le quota d'écritures (même nature que les lectures
      publiques ; parade = App Check, § Idées). Limites sans serveur notées par le relecteur :
      filtres de texte contournables (« 1 6 ans », lettres, emoji), numéro WhatsApp non prouvé,
      annonce expirée visible jusqu'au nettoyage (le client la masquera).
- [x] `npm test` (lint + prettier + 255 unitaires + **129 règles** + build) → exit 0.

### Phase 3 — Comptes

**Mini-plan**
- Firebase : `src/firebase/lite.ts` (Firestore lite + émulateur), `src/firebase/auth.ts`
  (`initializeAuth` chargé seulement sur les pages de compte ; inscription, connexion, Google
  popup/redirect, vérification avec lien de retour, mot de passe oublié, jeton frais,
  ré-authentification, déconnexion, suppression).
- `src/lib/` : `errors.ts` (erreurs Auth/Firestore → français, reprise de `translateAuthError`),
  `navigation.ts` (`safeNext`), `in-app-browser.ts` (WhatsApp, Facebook, Instagram, TikTok +
  mode Google redirect/popup), `profile-form.ts` (validation de la fiche, même seuils que les
  règles), `access.ts` (décision de garde pure), `account.ts` (création users + publicProfiles +
  usernames en un lot, mise à jour ville/WhatsApp, suppression « tout ou rien »),
  `disposable-email.ts` + `src/data/disposable-domains.ts` (liste v1, chargée à la demande),
  `src/data/settings.ts` (type + valeurs de démo des réglages).
- Composants : `AuthGate` (squelette → redirection, aucun contenu protégé avant décision),
  `Field`, `ProfileFields` (fiche partagée inscription e-mail / étape Google). CSS formulaires.
- Pages : `/connexion` (onglets Créer / Se connecter, étape profil, mot de passe oublié,
  Google masqué dans les navigateurs intégrés), `/verifier-email`, `/compte` ; garde sur
  `/publier`, `/booster`, `/admin`.
- `scripts/seed-emulator.ts` + `npm run seed` (réglages `settings/public` seulement, émulateurs
  uniquement) ; e2e lancés par `firebase emulators:exec` (auth + firestore).
- Tests : unitaires `errors`, `navigation`, `in-app-browser` (vrais user-agents), `profile-form`,
  `access`, `disposable-email` ; e2e `tests/e2e/accounts.spec.ts` (inscription → oobCode →
  compte ; connexion ; mot de passe oublié ; suppression ; gardes ; erreurs en français) +
  captures `docs/captures/phase-3/`.
- Reporté en phase 4 (Q5) : photo de profil (exige Cloudinary, HUMAN-TODO non fait).

**Critères prouvés (sur émulateurs)**
- [x] `npm run test:e2e` (Playwright dans `firebase emulators:exec --only auth,firestore`) →
      **62 passed**, 6 skipped (captures, sur demande) ; relancé 2 fois de suite → 60/60 puis
      62/62 (instabilités corrigées : délai de 60 s pour les parcours de compte, attente de la
      redirection après déconnexion, liste d'e-mails jetables préchargée au focus du champ).
      Couvre : inscription → lien de vérification (oobCode de l'émulateur appliqué par
      `accounts:update`) → compte ; `/publier` renvoie vers `/verifier-email` tant que l'e-mail
      n'est pas vérifié ; mineur (18 ans − 1 jour), CGU non cochées, e-mail jetable refusés en
      français ; pseudo déjà pris (casse différente) refusé ; connexion, mauvais mot de passe,
      déconnexion ; mot de passe oublié (lien de l'émulateur, nouveau mot de passe) ; compte
      Auth sans profil → étape profil ; ville/WhatsApp modifiés et conservés après rechargement ;
      suppression du compte (mauvais mot de passe refusé, puis tout effacé, pseudo libéré) ;
      suppression interrompue d'un compte sanctionné terminée à la connexion suivante ; gardes
      sans session → `/connexion?next=…`.
- [x] Aucun message brut Firebase : `expectNoRawFirebaseText` (aucun « auth/ », « firebase »,
      « permission-denied » à l'écran) dans les tests d'erreurs + test unitaire : chaque code
      inconnu → « Une erreur est survenue. Réessayez. ».
- [x] `npm test` → exit 0 : prettier OK, **Tests 320 passed** (unitaires, dont
      `accounts-lib` 48, `in-app-browser` 16 user-agents WhatsApp/Facebook/Instagram/TikTok/
      WebView/Chrome Android/Safari iOS, `firebase-config` 5), **129 règles**, build sans
      avertissement. JS commun de l'accueil inchangé : `mount-*.js` **8,73 kB gzip** ; Auth +
      Firestore lite (62 kB gzip) et la liste jetable (50,5 kB gzip) ne sont chargés que par les
      pages de compte.
- [x] Relecture par le sous-agent `verificateur` (fin de phase 3, CLAUDE.md § 1.8) : aucun
      écart sur les règles ; 7 points, tous corrigés : (1) suppression interrompue → écran
      « Suppression à terminer » (+ e2e) ; (2) retour arrière depuis le cache après
      déconnexion → la garde recharge la page (`pageshow.persisted`) ; (3) la suppression
      efface aussi `verificationRequests/{uid}` (photo d'identité) et les notifications ;
      (4) popup Google bloquée → repli redirect si le gestionnaire Auth est sur le domaine,
      `account-exists-with-different-credential` traduit ; (5) `.env*` retirés du suivi git et
      ignorés (config publique dans `config.ts`, décision du propriétaire) ; (6) « Renvoyer
      l'e-mail » ne bloque 60 s qu'après un envoi réussi ; (7) placeholder WhatsApp dans `fr.ts`.

**Captures** (`docs/captures/phase-3/`, 36 fichiers, 375 et 360, sombre et clair ; générées par
`cross-env CAPTURES=1 playwright test captures-phase3` dans `emulators:exec`, regardées avec Read) :
- `connexion-se-connecter-dark-375.png` : onglets, e-mail, mot de passe, « Mot de passe oublié ? », bouton Google texte.
- `connexion-creer-erreurs-light-375.png` : champs vides en rouge, messages français sous chaque champ.
- `connexion-creer-bas-dark-375.png` : e-mail, mot de passe, case CGU avec liens, « Créer mon compte », Google.
- `connexion-mot-de-passe-oublie-light-375.png` : titre, explication, champ e-mail, bouton, retour.
- `connexion-etape-profil-light-360.png` : « Complétez votre profil », e-mail connecté rappelé, fiche.
- `verifier-email-dark-360.png` : adresse rappelée, étapes, « J'ai vérifié », « Renvoyer », déconnexion.
- `compte-dark-375.png` : avatar à initiale, pseudo, âge, ancienneté, e-mail, profil, coordonnées.
- `compte-suppression-light-375.png` : zone de suppression ouverte, mot de passe, bouton danger, Annuler.
- Corrigé grâce aux captures : barres haut/bas rendues opaques (0,98) et `scroll-padding` pour
  qu'un champ ou bouton amené à l'écran ne finisse jamais sous la barre du bas.

**Prévisualisation sur `nioxxer-staging`** (2 oct. 2026)
- [x] `npm run deploy:preview` → règles + index + canal : « Channel URL (nioxxer-staging):
      https://nioxxer-staging--preview-5k9bgz5i.web.app [expires 2026-10-09] ».
      `nioxxer-cda95` non touché.
- [x] Index : `firebase firestore:indexes --project nioxxer-staging` → 11 index.
- [x] Règles v2 actives (REST anonyme) : `usernames/inexistant` → NOT_FOUND (lecture permise),
      `users/inexistant` → PERMISSION_DENIED, `settings/public` → NOT_FOUND (à créer, HUMAN-TODO).
- [x] **En-têtes (le [À PROUVER] de la phase 1)** par `curl -I` sur le canal : `/`, `/compte`,
      `/connexion` → `Cache-Control: no-cache`, `X-Content-Type-Options: nosniff`,
      `Referrer-Policy`, `Permissions-Policy` ; `/assets/home-*.js` et `/fonts/*.woff2` →
      `Cache-Control: public, max-age=31536000, immutable` ; `/nexiste-pas` → 404.
- [x] `/connexion` sur le canal : formulaire affiché, aucune erreur console (navigateur intégré).
- [ ] Inscription réelle sur staging : après création de `settings/public` par le propriétaire.

**Décisions techniques**
- Config web Firebase choisie par mode de build dans `src/firebase/config.ts` (décision du
  propriétaire) : development → `demo-nioxxer` + émulateurs ; preview → `nioxxer-staging`
  (app web `nioxxer-web` créée par `firebase apps:create` avec accord du propriétaire, appId
  `1:32898601996:web:6468faa27ad9863e558a29`) ; production → `nioxxer-cda95`.
- `deploy:preview` vise désormais `nioxxer-staging` (règles + index + canal `preview`).
- Inscription : pseudo vérifié avant la création du compte Auth ; si le lot Firestore échoue
  ensuite, l'utilisateur arrive sur l'étape profil avec la fiche déjà remplie.
- Suppression bloquée tant qu'une annonce est masquée par signalements et attend un modérateur
  (règles) → message clair (Q6).
- Le contrôle du rôle admin sur `/admin` viendra en phase 7 (garde « profil » en attendant).

**Questions de la phase**
- Q5 Photo de profil reportée en phase 4 (Cloudinary non configuré) — rien n'est affiché en
  attendant (pas de bouton inactif).
- Q6 Suppression du compte refusée pendant l'examen d'une annonce signalée (choix le plus simple
  compatible avec les règles de la phase 2).
- Q7 Logo Google officiel : autorisation de téléchargement demandée au propriétaire ; bouton
  texte « Continuer avec Google » en attendant (jamais de logo redessiné).

### Phase 3 — retours du propriétaire (test Android Chrome, 2 oct. 2026)

Inscription e-mail et Google OK sur le téléphone. Corrections demandées :
- [x] (1) `/connexion` : « Continuer avec Google » en haut des deux onglets, puis « ou », puis le
      formulaire. Logo « G » officiel (kit `signin-assets.zip` de Google, téléchargé avec accord,
      fichiers Light/Dark copiés octet pour octet : sha256 `6587b180…` / `2f7ecc30…`, provenance
      dans `public/brands/README.md`).
- [x] (2) `/compte` : la suppression devient un petit lien gris « Supprimer mon compte » en bas
      de page, qui ouvre la même procédure.
- [x] (3) Logo : `logo.webp` était déjà transparent ; le rectangle noir était la pastille CSS
      `--logo-plate` de la phase 1 → supprimée (lisible sur les deux fonds, vérifié sur captures).
- [x] (4) Lenteur — `npm run lighthouse` (nouveau, `scripts/lighthouse.ts`, Lighthouse
      **12.8.2** épinglé car 13 exige Node 22 ; mobile, 4G lente émulée) sur le lien de
      prévisualisation :

| Page | Avant : score · LCP · poids · requêtes | Après (2 passages) |
|---|---|---|
| `/` | 95 · 1,59 s · 93,9 Ko · 10 | 99–100 · 1,21–1,58 s · 77,1 Ko · 10 |
| `/connexion` | 74 · 3,73 s · 285,7 Ko · 17 | 99–100 · 1,55–1,65 s · 116 Ko · 13 |
| `/compte` (visiteur → redirection) | 80 · 4,13 s · 295,7 Ko · 32 | 99 · 1,56–1,69 s · 121 Ko · 24 |

  Causes trouvées (audit `network-requests` et `largest-contentful-paint-element`) et correctifs :
  1. Le résolveur popup/redirect passé à `initializeAuth` + `getRedirectResult` à chaque arrivée
     chargeaient la machinerie Google (api.js, gapi_iframes, iframe, iframe.js 92 Ko,
     getProjectConfig : ~134 Ko, ~2 s) **avant** d'afficher le formulaire (délai de rendu du LCP
     2,5 s). → Google isolé dans `src/firebase/google.ts`, importé au clic ; `getRedirectResult`
     seulement au retour d'une redirection (marqueur `sessionStorage`).
  2. Firestore lite dans le chunk initial → chargé seulement quand une session existe
     (AuthGate) ou à l'envoi d'un formulaire. Chunk auth 36 Ko gzip, Firestore 27 Ko à part.
  3. Logo 27,5 Ko affiché en 91×40 → `logo-header-2x.webp` 10,3 Ko (+ 3× 15,7 Ko via `srcset`).
  Reste le plus lourd : les polices (53 Ko : Karla 400/700 + Young Serif), déjà en sous-ensemble
  latin. Limite : `/compte` est mesuré en visiteur (redirection) ; la version connectée ajoute
  le chunk Firestore (27 Ko) et deux lectures.
  Conséquence notée : sans initialisation anticipée, une popup Google sur Safari iOS peut être
  bloquée ; en production le mobile utilise la redirection, et une popup bloquée y bascule en
  redirection (même domaine). Sur le lien de prévisualisation, message « autorisez les pop-up ».
- [x] Lighthouse lancé via `chrome-headless-shell` de Playwright avec `--no-sandbox` (le bac à
      sable de Chrome ne démarre pas dans le shell isolé de la machine ; navigateur de mesure
      limité à nos pages).
- [x] (5) E-mail de vérification en spam : réglages console ajoutés à `docs/HUMAN-TODO.md`
      (nom public NIOXXER, modèles en français, domaine personnalisé).
- (6) Photo de profil en phase 4, cloud name Cloudinary à venir du propriétaire.
- [x] Tests : `npx vitest run` → 320 passed ; `npm run test:e2e` → 62 passed ; captures
      régénérées (40, dont `compte-bas-*` : lien discret) et regardées.
- [x] `npm run deploy:preview` → https://nioxxer-staging--preview-5k9bgz5i.web.app (expire le
      2026-10-09 17:46).

### Phase 4 — Publier

**Cloudinary vérifié par un vrai envoi (2 oct. 2026)** : cloud `bcxiwwkh` ; `nioxxer_listing` →
1600×1200, filigrane visible sur l'URL brute (avec et sans version), EXIF absent ;
`nioxxer_avatar` → 400×400 sans filigrane ; `w_360`/`w_960` livrés en WebP. Découverte :
dossiers dynamiques → `public_id` sans préfixe `listings/` → `PHOTO_REF` = `<publicId>:<l>x<h>`,
motif d'avatar resserré (URL brute versionnée seulement) ; `npm run rules:sync` puis
`npm run test:rules` → 129 passed ; `rules-sync` → 124 passed.

**Mini-plan**
1. Photo de profil (inscription + Mon compte) : `src/lib/image-compress.ts` (redimensionnement
   canvas, JPEG 0,85, EXIF retiré), `src/lib/cloudinary.ts` (envoi non signé XHR avec
   progression, URL de livraison), composant `AvatarPicker` (ajouter, changer, supprimer,
   progression, réessayer), `createAccount(photoUrl)`, `updateProfilePhoto`. Tests : unitaires
   (URL, réponse Cloudinary, dimensions) ; e2e avec Cloudinary **intercepté** (photo avec EXIF
   GPS → corps envoyé sans EXIF ; inscription avec photo ; ajout/changement/suppression dans
   Mon compte ; échec d'envoi → message + réessayer).
2. `PhotoUploader` (1 à 5, réordonner, principale) + `/publier` (création/modification, mêmes
   validations que les règles, compteurs) + `src/lib/listing.ts`.
3. « Mes annonces » dans `/compte` (modifier, supprimer, republier, état, plafond 7) ;
   répercussion de la photo de profil sur les annonces.
4. E2E « publier, modifier, republier, supprimer », captures, revue, test manuel HUMAN-TODO.

**Étape 1 — photo de profil ✅**
- [x] `npx vitest run` → **332 passed** (dont `cloudinary.test.ts` : réponse réelle d'envoi,
      autre cloud refusé, URL brute seule acceptée, transformation `f_auto,q_auto,w_160` ajoutée
      à l'affichage, `PHOTO_REF` sans dossier ; `fitWithin` ; fiche avec photo).
- [x] `npm run test:rules` → 129 passed (avatar : URL brute versionnée acceptée, `null`
      accepté, URL avec transformation `l_text:` refusée, URL avec paramètre refusée).
- [x] `npm run test:e2e` → **68 passed** dont `profile-photo.spec.ts` (Cloudinary intercepté) :
      photo JPEG portant EXIF + GPS (`tests/e2e/fixtures/photo-gps.jpg`) → corps envoyé =
      JPEG réencodé sans bloc `Exif`, sans le texte repère ni la marque de l'appareil, preset
      `nioxxer_avatar` ; inscription avec photo → visible dans Mon compte ; ajout, changement,
      suppression, conservés après rechargement ; échec d'envoi → message français + réessai.
- [x] Captures `docs/captures/phase-4/` (12) : `inscription-photo-vide`, `inscription-photo`,
      `compte-photo` en sombre/clair, 375/360 — regardées : champ facultatif après WhatsApp,
      aperçu rond 80 px, « Changer / Supprimer la photo », photo dans l'en-tête du compte.
- Choix : la photo est envoyée dès qu'elle est choisie (progression visible) ; une photo
  remplacée ou abandonnée reste sur Cloudinary jusqu'au nettoyage des orphelins (phase 8).
- À faire à l'étape 3 : répercuter la photo de profil sur les annonces (`profilePhotoUrl`
  dénormalisé).

**Étapes 2–4 — publier, Mes annonces ✅**
- Fichiers : `src/lib/listing-form.ts` (validation = règles, références photo, ordre),
  `src/lib/listing-status.ts` (expiration, état affiché, emplacement libre — sans Firestore),
  `src/lib/listing.ts` (création en un lot annonce + contact privé, modification, republication,
  suppression, copie de la photo de profil), `PhotoUploader`, `MyListings`, `/publier`.
- [x] `npm test` → exit 0 : **344 passed** (dont `listing.test.ts` 12 : prix/mineur/coordonnées
      refusés avec le texte du propriétaire, « 25 ans, 1m75, 2 enfants, né en 1995 » acceptés,
      longueurs identiques aux règles, 1 à 5 photos, URL `w_360`/`w_960`, ordre, état « en
      ligne / expire dans 5 jours / expirée / masquée / supprimée », Premium seulement pendant
      sa durée, emplacement libre) ; **129 règles** ; build OK.
- [x] `npm run test:e2e` → **78 passed** (2 passages verts) dont `publish.spec.ts` ×2 viewports :
      **publier** (2 photos, préremplissage genre/ville/WhatsApp depuis le compte, compteur
      24 / 60, « Appels et messages ») → document public sans numéro, `private/contact`
      `{whatsapp, callAllowed: true}`, photos `<id>:1600x1200`, envois sans EXIF ;
      **Mes annonces** (« En ligne jusqu'au … », « 1 / 7 annonces ») ; **modifier** (titre,
      photo 2 devenue principale, relu dans Firestore) ; **republier** (`renewedAt` avancé) ;
      **supprimer** avec confirmation (annonce + contact effacés) ; textes interdits refusés
      avant envoi ; sans photo refusé ; plafond 7 affiché et appliqué ; nouvelle photo de profil
      recopiée sur l'annonce.
- [x] Bug trouvé par l'e2e et corrigé : après « Republier », la ligne restait bloquée
      (`busy` jamais remis à zéro) → « Supprimer » grisé.
- [x] Critique visuelle (sous-agent `critique-visuel`, 6,5/10) → corrigé : outils photo 44 px
      (grille sur 2 colonnes), `--ink-faint` relevé (3,5–3,7:1 → ≥ 5,0:1, calculé), focus du
      thème clair distinct du rouge d'erreur (1,12:1 avant), bordure des boutons secondaires
      (`--line-strong`), avatar vide sobre, « Supprimer » écarté des autres actions, titre du
      succès non répété, cadre du groupe radio, erreur effacée dès la correction du champ.
      Non retenu (vérifié par calcul) : contraste des aides `--ink-muted` (6,4–7,1:1, conforme) ;
      accent différent en clair (décision phase 1, texte blanc ≥ 4,5:1).
- [x] Captures `docs/captures/phase-4/` (32 : `publier-vide`, `publier-erreurs`,
      `publier-rempli-bas`, `publier-succes`, `mes-annonces`, photo de profil) et phase 3
      régénérées après le changement de jetons — regardées.
- Choix : republication possible à tout moment pour une annonce active (prolonge de 6 mois à
  partir d'aujourd'hui) ; une annonce masquée par signalements n'a aucune action (règles) ;
  envoi des photos une par une (connexion lente).

### Phase 5 — Fil, recherche, annonce, profil public

**Mini-plan**
1. Données : `src/lib/public-listing.ts` (pur : document → annonce publique, âge au mois près,
   expirée/boost expiré, bornes `birthMonth` d'une plage d'âge, URL wa.me, marqueur de vue du
   jour, filtres ⇄ adresse) + `src/lib/feed.ts` (Firestore lite : page du fil `startAfter`,
   bandeau Premium, annonce, profil + annonces d'un membre, contact au clic, vue, j'aime,
   signalement en transaction, remise à zéro d'un boost expiré — décision 2, compteurs par ville
   en cache 10 min). Photos : `src/lib/photo-url.ts` (sorti de `listing-form` pour ne pas charger
   la modération sur le fil). Tests unitaires.
2. Composants : `ListingCard` (Premium : cadre or + défilé de photos), `Feed` (paquets de 20,
   IntersectionObserver + bouton de repli, squelettes, état vide), `PremiumBanner`, `CityPicker`
   (recherche, mémorisation, « Autour de moi », compteurs), `AgeRange` (double curseur 18–70),
   `GenreChips`, `ReportDialog`.
3. Pages : `/` (+ raccourcis profil → `/recherche`), `/ville/{slug}` (28 fichiers générés par
   `npm run pages:sync`, titre/description/canonical propres, test « à jour » comme `rules-sync`),
   `/recherche` (filtres dans l'adresse), `/annonce`, `/membre`.
4. `npm run seed` : ~60 annonces de démo (refus sans `FIRESTORE_EMULATOR_HOST`) ; photos = images
   d'exemple du compte Cloudinary (`sample`, `cld-sample-2`, `-4`, `-5` : fleurs, montagnes, plats, chaussure — `cld-sample-3` montre des personnes, écartée ; vérifiées 200).
5. E2E `tests/e2e/feed.spec.ts`, `listing.spec.ts` (une ville réservée par test et par viewport) :
   ordre, pagination sans doublon ni trou, filtres, WhatsApp intercepté + numéro absent du DOM
   avant le clic, 10 signalements → masquée, j'aime unique, vue 1×/jour, ville mémorisée,
   « Autour de moi », page ville, membre. Captures phase 5. Lighthouse `/`, `/recherche`,
   `/annonce`. Revue sous-agent, critique visuelle, deploy:preview + index sur staging.

**Retour du propriétaire (test téléphone phase 4, 2 oct. 2026)** : publication, photos, profil,
Mes annonces OK. Bug : en-tête transparent au défilement (/publier, /compte, thème clair).
- [x] Correctif : `--bar` plein dans les deux thèmes (#100E14 / #FAF7F5, plus d'alpha 0,98),
      `--bar-line` (bordure 1 px) + `--bar-shadow` sous l'en-tête, z-index 40 (au-dessus de tout
      contenu de page, sous les toasts). Barre du bas idem.
- [x] Test e2e ajouté dans `shell.spec.ts` : fond calculé de l'en-tête et de la barre du bas =
      `rgb(…)` sans transparence, sur chaque page.
- [x] Preuve : `firebase emulators:exec … "cross-env CAPTURES=1 playwright test captures-phase5"`
      → **4 passed** ; `docs/captures/phase-5/entete-defilement-{compte,publier}-{dark,light}-{375,360}.png`
      regardées : page défilée de 260 px, rien ne transparaît derrière le logo, fine ombre sous la barre.

**Fait (2 oct. 2026, commits `6d47686` + suivant)**
- Fichiers : `src/lib/public-listing.ts` (pur), `feed.ts`, `social.ts` (Auth chargé au premier
  J'aime/Signaler), `photo-url.ts`, `city-memory.ts` ; composants `Feed`, `ListingCard`,
  `PremiumBanner`, `CityPicker`, `SearchFilters`, `Gallery`, `ReportDialog`, `CityFeedPage`, `Icon` ;
  pages `home`, `city` (28 × `ville/{slug}.html`, `npm run pages:sync`), `search`, `listing`,
  `member` ; `src/styles/feed.css` ; `scripts/demo-data.ts` + `npm run seed` (56 annonces).
- [x] `npm test` → exit 0 : prettier OK, **366 unitaires** (dont `public-listing` 16 : bornes
      `birthMonth` vérifiées mois par mois 1990–2008, ordre, boost expiré, wa.me encodé, vue 1×/jour,
      bandeau ≤ 10 Premium ; `demo-data` 4 : textes acceptés par la modération, refus sans
      `FIRESTORE_EMULATOR_HOST` local ; `shell` : 28 pages ville à jour, titre/description/canonical
      propres, préconnexions), **129 règles**, build sans avertissement.
- [x] `npm run test:e2e` → **164 passed**, 22 skipped (captures) — `feed.spec.ts` + `listing.spec.ts`
      ×2 viewports : ordre Premium > Sponsorisé > gratuit (boost expiré remis à 0 puis classé
      gratuit, annonce de plus de 6 mois absente) ; pagination 45 annonces : 20 au départ, puis
      défilement jusqu'à « Vous avez vu toutes les annonces », 45 ids sans doublon dans l'ordre
      attendu ; filtres profil multiple + âge + adresse + clavier (End/Home) + rechargement ; ville
      vide honnête ; sélecteur (recherche « yaou », mémorisé après rechargement) ; « Autour de moi »
      (géolocalisation Kribi simulée) ; page ville (titre, canonical, description, h1) ; WhatsApp :
      aucune requête `private/contact` ni numéro dans le HTML avant le clic, puis
      `https://wa.me/2376…?text=Bonjour, je vous contacte depuis NIOXXER au sujet de votre annonce « … ».`
      (intercepté) ; Appeler seulement en « Appels et messages » ; J'aime unique (rechargement,
      marqueur effacé : le document stocké décide) ; vue comptée 1 fois par navigateur et par jour ;
      Partager → lien copié ; **10 visiteurs distincts signalent → `hidden: true`, reportsCount 10**,
      annonce indisponible et absente du fil ; 2e signalement du même visiteur refusé ; page membre
      (annonce masquée absente, Sponsorisé d'abord) ; annonce/membre inconnus.
- [x] Relecture sous-agent `verificateur` (CLAUDE.md § 1.8) → corrigé : (1) bandeau sans
      étiquette visible → « Premium » affiché (§ 4.7) ; (2) poignées d'âge superposées à 70 →
      la poignée encore mobile passe dessus ; (3) J'aime oublié par le navigateur : le compteur suit
      l'opération réellement faite ; (4) `permission-denied` au signalement : « déjà signalé »
      seulement si l'annonce est toujours visible, sinon « plus disponible ». Notés : (5) compteurs
      du sélecteur incluent les annonces expirées non encore nettoyées ; (6) index à vérifier sur
      staging (émulateur sans index).
- [x] Critique visuelle (sous-agent, 5/10) → corrigé : photo Premium pleine largeur (plus de
      photo coupée), puces et poignées du curseur à 44 px, bordure Sponsorisé neutre (l'accent reste
      aux actions). Non retenu : logo (fichier validé par le propriétaire), titre + pastille sur la
      page ville (la pastille est le sélecteur). En attente : logo WhatsApp officiel (autorisation
      de téléchargement demandée au propriétaire, bouton texte en attendant).
- [x] Lighthouse **local** (`vite build --mode development` + `vite preview` + émulateurs + seed,
      mobile 4G lente) : diagnostic par PerformanceObserver → CLS 0,083 de `/` = bandeau arrivant
      après le fil ; LCP de `/annonce` = 260 Ko d'images de galerie en concurrence. Correctifs :
      bandeau tiré de la 1re page du fil (une requête de moins, rendu en même temps que les cartes),
      squelette séparé, préconnexion Firestore + Cloudinary sur les pages de données, photos
      secondaires chargées après la principale. Résultat :

| Page | Avant | Après |
|---|---|---|
| `/` | 90 · LCP 3,27 s · CLS 0,083 | 92–93 · LCP 2,91–3,15 s · CLS 0 |
| `/recherche` | 95 · LCP 2,85 s · CLS 0 | 95 · LCP 2,87 s · CLS 0 |
| `/annonce` | 84 · LCP 4,41 s · CLS 0 | 94 · LCP 2,84 s · CLS 0 |
| `/ville/yaounde` | — | 95 · LCP 2,84 s · CLS 0 |

  ⚠️ LCP > 2,5 s en local : l'émulateur sert le JSON **sans compression** (44 Ko pour 20 annonces,
  ~5× moins en gzip en production) ; chaîne JS → requête → photo. Mesure sur staging à faire.
  JS initial de l'accueil (sortie de build) : lite 30,4 + app 11,8 + mount 11,2 + ListingCard 3,7
  + city-memory 1,9 + format 1,6 + CityFeedPage 1,1 + petits morceaux < 3 → **≈ 64 Ko gzip**
  (Lighthouse « Script 65,6 Ko ») ≤ 120 Ko.
- [x] `npm run deploy:preview` → https://nioxxer-staging--preview-5k9bgz5i.web.app (expire le
      9 oct.). **Vérification des requêtes sur staging** (`test-results/staging-check.mjs`,
      Playwright sur le canal) : accueil, compteurs par ville, `/recherche?profil=femme` → OK ;
      **toutes les requêtes avec âge → `FAILED_PRECONDITION` (index manquant)**. Message de
      Firestore décodé : il exige `birthMonth` **DESCENDING** après `rank desc, createdAt desc`
      (le fichier l'avait en ASCENDING). Corrigé dans `firestore.indexes.json` (4 index), test
      `tests/unit/indexes.test.ts` (8 formes de requête du fil), `firebase deploy --only
      firestore:indexes --force` sur `nioxxer-staging` (« Deleting 4 indexes… deployed »).
- [x] Revérification après construction des index (4e essai, ~2 min) : les 7 formes de requête
      (ville, profil, âge, profil + âge, âge jusqu'à 70, compteurs) → résultats ou état vide honnête,
      **aucune erreur**.
- [ ] **Lighthouse sur staging — budget NON tenu** (`npm run lighthouse -- <canal>`, 4G lente simulée) :
      `/` 77–82 · LCP 3,80–4,22 s ; `/recherche` 87 · LCP 3,64 s ; `/annonce` 71 · LCP 4,62 s ;
      CLS 0 partout, TBT < 80 ms, poids 161–211 Ko, JS ≈ 56 Ko gzip. Analyse des rapports
      (`largest-contentful-paint-element`, `network-requests`, `network-server-latency`) : le LCP
      attend la 1re requête Firestore, précédée d'une **pré-requête CORS (preflight) imposée par
      les en-têtes du SDK** (1,28 s → 5,11 s observé), latence serveur Firestore observée
      **1 812 ms** (Cloudinary 547 ms, Hosting 389 ms). Ce n'est plus le poids de la page.
      Options soumises au propriétaire (Blocages).
- [x] **Décision du propriétaire (2 oct. 2026) : A + B sous conditions.** Mesure « avant »
      (staging, 3 passages) : `/` 82·82·84 (LCP 3,82/3,80/3,67 s) ; `/recherche` 80·86·87
      (4,63/3,75/3,71 s) ; `/annonce` 75·75·81 (4,49/4,46/3,66 s). A (lecture REST simple, repli
      SDK, SDK chargé seulement en repli) codé et testé (unitaires + e2e : en-têtes sans `x-`,
      repli quand REST répond 500) ; sur staging : une seule `POST :runQuery` par page, 0
      « Preflight » dans les rapports Lighthouse de `/` et `/recherche`, toutes les formes de
      requête OK, poids 161 → 129 Ko. Mesure « après » : `/` 78·75·76 (LCP 4,74/4,97/4,93 s) ;
      `/recherche` 79·80·80 (4,98/4,83/4,89 s) ; `/annonce` 80·81·76 (3,79/3,50/4,86 s).
      Chronologie : la requête REST seule dure 4,4 s (serveur Firestore ~2,5 s observées) ;
      l'image démarre à ~5,9 s contre ~6,0 s avant. **Gain non net → A annulé** (code retiré),
      **B gardé** : `src/lib/feed-cache.ts` (+ `tests/unit/feed-cache.test.ts` 3 tests, e2e
      « returning visitor » : page en cache affichée alors que les requêtes sont retenues, puis
      remplacée par la fraîche). Documenté : ARCHITECTURE § 9 bis.
- [x] Après retour à « B seul » : `npm test` → exit 0 (**373** unitaires, **129** règles, build) ;
      `npm run test:e2e` → **166 passed**, 22 skipped ; `npm run deploy:preview` (staging = code gardé).
- [x] Logo WhatsApp officiel : conditions de la page Meta acceptées (accord du propriétaire),
      pack `WhatsApp-Brand-Resource-Center.zip` (10,6 Mo) téléchargé hors du projet, glyphe noir
      RGB copié octet pour octet (sha256 identique) dans `public/brands/whatsapp-glyph-black.svg`,
      provenance dans `public/brands/README.md` ; affiché à côté du mot « WhatsApp » (jamais à sa
      place). Capture `annonce-light-375.png` regardée. Clause Meta signalée au propriétaire :
      pas d'usage « objectionable » (site de rencontres adultes : risque accepté par lui).
- ⚠️ Budget Lighthouse (≥ 85, LCP ≤ 2,5 s) **toujours non tenu** sur les pages qui lisent
      Firestore : limite côté serveur Firestore depuis le réseau de mesure, hors de portée du code.
- Choix (§ Questions Q8–Q10) : bandeau = Premium de la 1re page (≤ 20 plus récentes, 10 tirées au
  hasard) ; âge 18 et 70 aux extrémités = pas de borne (« 70 ans et + ») ; vue/J'aime/signalement
  mémorisés dans `localStorage` (affichage seulement, les règles décident).

### Phase 6 — Booster et paiement manuel
Mini-plan (2 oct. 2026). Règles `boostRequests` / `pendingBoosts` / `notifications` déjà écrites et
testées en phase 2 (`tests/rules/admin.test.ts`, `accounts.test.ts`) : la phase est surtout de l'interface.
- `src/lib/boost-form.ts` (pur) : formules (prix + durée lus dans `settings`), opérateurs disponibles
  (numéro + nom réglés), numéro local à copier, référence facultative (≤ 60), paliers de compression.
- `src/lib/image-compress.ts` : `compressToDataUrl` (JPEG ≤ `DATA_URL_MAX_CHARS`, paliers taille/qualité).
- `src/lib/boost.ts` (Firestore lite) : contexte (annonce, réglages, verrou `pendingBoosts`) ; envoi
  en un lot `boostRequests/{auto}` + `pendingBoosts/{listingId}`.
- `src/pages/boost.tsx` : étapes formule → opérateur → paiement (numéro, nom, montant exact, Copier,
  capture, référence) → « En attente ». États honnêtes : annonce introuvable / non boostable / demande
  déjà en attente / paiement pas encore ouvert (aucun numéro réglé).
- `MyListings` : bouton « Booster » (annonce en ligne, non masquée, sans boost illimité), ligne
  « Demande en attente » (lecture du verrou), rappel « se termine demain » (boost J-1).
- Cloche : lien dans l'en-tête statique, visible seulement pour un membre connecté ; nombre non lu mis
  en cache (`localStorage`, affichage seulement) par les pages à compte, appliqué avant le 1er affichage
  par le script de thème (pas de saut de mise en page, pas de SDK Auth sur les pages publiques).
- `/compte#notifications` : rappels calculés (expiration 7 j, boost J-1) + notifications enregistrées,
  marquées lues à l'affichage.
- Tests : unitaires (`boost-form`, `compressToDataUrl` paliers, rappels, cache de la cloche, rendu de
  l'en-tête) ; règles : lecture/comptage des notifications non lues ; E2E « demande de boost → visible
  en attente », 2e demande impossible, cloche + liste + rappels ; captures phase-6 (375/360, sombre/clair).

Résultats (2 oct. 2026) :
- [x] `npm test` → exit 0 : **390** unitaires (dont `tests/unit/boost.test.ts`, 17 tests : formules,
      opérateurs réglés, numéro local copié, référence, refus expiré/supprimé/masqué/illimité, rappels
      7 j et J-1, paliers de compression, cloche + script d'amorce), **130** règles (+1 : liste et
      comptage des notifications par leur propriétaire, refusés à un autre membre), build.
- [x] `npm run test:e2e` → **174 passed**, 26 skipped, 0 failed. `tests/e2e/boost.spec.ts` (×2 tailles) :
      demande de boost → « En attente » (prix lus dans settings, numéro `600000001` lu dans le
      presse-papiers, capture obligatoire, document stocké : montant exact, JPEG ≤ `DATA_URL_MAX_CHARS`,
      **sans EXIF/GPS**, verrou `pendingBoosts`, ligne « en attente » et plus de bouton Booster, retour
      sur /booster = écran d'attente) ; refus annonce expirée / supprimée / d'un autre / sans id ;
      cloche (compte sur page à compte, affichée sur l'accueil depuis le cache, liste + « Nouveau » +
      2 rappels, marquée lue, disparaît à la déconnexion) ; capture synthétique 1440×3120 (> 1 Mo PNG)
      compressée sous la limite. Run précédent : 3 dépassements de délai `load` dans `shell.spec.ts`
      sous charge (suite complète + relecture en parallèle) ; `shell.spec.ts` seul → 98 passed, puis
      suite complète verte.
- [x] Captures `docs/captures/phase-6/` (CAPTURES=1 → 4 passed, 32 images) regardées :
      `booster-1-formule` : Premium cadre or présélectionné, Sponsorisé, prix et 7 jours, sans abonnement
      · `booster-2-operateur` : MTN / Orange en texte (logos officiels absents, HUMAN-TODO) ·
      `booster-3-paiement` : montant, numéro en paires + Copier, bénéficiaire, avertissement nom ·
      `booster-3-capture` : aperçu, référence, bouton d'envoi · `booster-4-envoyee` : « Demande envoyée »
      + pastille « En attente de vérification » · `booster-deja-en-attente` : écran d'attente sans
      formulaire · `compte-notifications` : 2 rappels (or) + notification « Nouveau », cloche sans
      pastille après lecture · `compte-mes-annonces` : ligne « demande en attente », pastille
      « Premium : fin demain à HH:MM » (texte raccourci : il passait sur 2 lignes à 360 px).
- [x] Relecture `verificateur` (sous-agent) : 3 remarques ; corrigées : un échec du marquage « lu » ne
      masque plus la liste ; un échec de lecture du verrou ne bloque plus « Mes annonces ». Logos : HUMAN-TODO.
- JS initial de l'accueil : lite 30,42 + app 11,79 + fr 7,16 + mount 5,41 + petits morceaux ≈ 66 Ko
  gzip (≤ 120). Numéros de démonstration absents du build (`grep -l "Démo NIOXXER" dist/assets/*.js` → rien).

### Phase 8 — Pages légales, aide, SEO, maintenance ✅
Mini-plan (3 oct. 2026) :
- **Pages statiques lisibles sans JS** : contenu de `/cgu`, `/confidentialite`, `/mentions-legales`,
  `/regles`, `/aide` rendu dans le HTML au build (`src/shell/legal.ts`, textes dans
  `src/i18n/legal-fr.ts`, importé seulement au build → 0 octet dans le JS client ; mini-balisage
  `[texte](/lien)` et `**gras**` appliqué après échappement). Commentaire HTML « Modèle à faire relire
  par un juriste ». Les 4 pages légales n'ont plus que `initShell()` (`src/pages/static.ts`) ;
  `/aide` : FAQ en `<details>` + bouton WhatsApp du support (numéro par défaut dans le HTML,
  remplacé par `settings/public.supportWhatsApp` quand le JS charge). `PendingPage` supprimé.
- **Pied de page** commun (shell) : Aide · Règles · CGU · Confidentialité · Mentions légales · 18+.
  `main` en hauteur minimale d'un écran → le pied ne remonte jamais dans l'écran au chargement (CLS 0).
- **termsVersion** : `AuthGate` compare `users.termsVersion` à `settings.termsVersion` ; différente →
  écran « Nos conditions ont changé » (case + bouton, `termsVersion` + `termsAcceptedAt` serveur,
  déjà permis par les règles) avant toute page à compte. Champ « Version des conditions » ajouté aux
  Réglages (super, audité).
- **SEO** : Open Graph + Twitter sur toutes les pages (`renderHead`), `sitemap.xml` (accueil,
  recherche, aide, 4 pages légales, 28 villes) et `robots.txt` générés au build depuis `PAGES`.
- **Liens** : `scripts/check-links.ts` (tous les `href`/`src` internes de `dist/**/*.html` + sitemap
  → fichier existant ; ancres des pages statiques) ajouté à `npm test` ; E2E `links.spec.ts` qui
  parcourt les pages rendues par le JS et charge chaque lien interne.
- **Maintenance** : `firebase-admin` 13.10.0 (14.x exige Node 22). `scripts/maintenance.ts` (étapes
  ARCHITECTURE § 8, `--dry-run`, acteur `system` dans `auditLog`, Cloudinary par l'API Admin REST
  `GET /resources/by_asset_folder`, `DELETE /resources/image/upload` par 100, garde-fou si trop de
  photos semblent orphelines) + `.github/workflows/maintenance.yml` (02:00 UTC + manuel) + tests
  sur émulateur (`tests/rules/maintenance.test.ts` : analyse sans écriture, exécution réelle,
  garde-fou, échec Cloudinary → code d'erreur). `deploy` bloqué tant que l'identité de l'éditeur
  (mentions légales) est vide (`scripts/check-legal.ts`).
- Fin : captures 375/360 sombre/clair, critique visuelle, relecture `verificateur`, `deploy:preview`,
  aperçu OG vérifié sur le canal, commit.

Résultats (3 oct. 2026) :
- [x] `npm test` → exit 0 : **433** unitaires (dont `legal.test.ts` 13 : pages statiques sans
      squelette ni script, commentaire « juriste » hors écran, sommaire → ancres, liens internes et
      ancres valides, échappement du mini-balisage, contenu exigé par le PLAN (art. 294, décision 13,
      limite du numéro WhatsApp), « À compléter », OG sur les 44 pages, sitemap 7 + 28 adresses,
      robots ; `maintenance.test.ts` 4 : client Cloudinary paginé, suppression par 100, erreur HTTP),
      **144** règles (dont `maintenance.test.ts` **6** sur émulateur : `--dry-run` n'écrit rien,
      vrai passage + idempotence, sans `--orphans`, 2 garde-fous, étape en échec → erreur et les
      autres continuent), build, **validateur de liens** : « 44 pages, 1613 liens internes et
      adresses du sitemap (35) : aucun lien mort ».
- [x] E2E : `legal.spec` ×2 tailles **15 passed** (5 pages lisibles JS coupé, FAQ ouvrable, sommaire
      → ancre, numéro du support, OG + pied hors du 1er écran, **parcours de tous les liens rendus**
      de 17 pages + /compte et /publier connectés : 0 lien mort) ; `admin-global` **3 passed** (dont
      nouvelle version des CGU → écran bloquant, case obligatoire, `termsVersion` + date serveur
      enregistrés, puis accès ; /aide suit `supportWhatsApp`) ; `shell.spec` relancé seul (2 délais
      sous charge dans la suite complète) **98 passed**.
- [x] CLI : `emulators:exec … "tsx scripts/maintenance.ts --dry-run --orphans"` → rapport JSON de
      compteurs, code 0 ; sans secret → `E_NO_SERVICE_ACCOUNT`, code 1. `check:legal` → refusé
      (6 champs éditeur manquants), comme prévu.
- [x] Captures `docs/captures/phase-8/` (48 images, CAPTURES=1 → 8 passed) regardées. Critique
      visuelle (sous-agent) 7/10 : corrigés — doublon de liens légaux sur /aide (retiré, le pied
      suffit), tableau de l'éditeur empilé (plus de coupures à 360 px), cibles du sommaire agrandies
      (compromis 4 px : 44 px rendait le sommaire trop long), écart du pied réduit ; écarté — taille
      des cases à cocher (style commun à l'inscription).
- [x] Relecture `verificateur` : 0 bug grave, 3 mineurs corrigés + testés — garde-fou aussi quand
      aucune photo n'est référencée (même < 20), photos d'une annonce expirée effacées juste après
      elle, verrou `pendingBoosts` effacé avec l'annonce expirée.
- [x] `npm run deploy:preview` → https://nioxxer-staging--preview-5k9bgz5i.web.app (expire le
      10 oct.) : `/cgu`, `/aide` 200 HTML, `/sitemap.xml` 200 `application/xml` (35 `<loc>`),
      `/robots.txt` 200, `/og-image.png` 200. **Aperçu OG** (opengraph.xyz sur le canal) : 0 erreur,
      titre 39 car., description 107 car., image 185 Ko 1200×630 chargée, `summary_large_image`.
- [x] Lighthouse canal : `/cgu` **99**, `/aide` **99** (CLS 0) ; `/` 1er passage 67 (TBT 626 ms,
      bruit de la machine), relancé ×2 → **91** et **87**, LCP 3,0 s (écart déjà accepté), CLS 0,008.
- ⚠️ Reste au propriétaire (HUMAN-TODO) : identité de l'éditeur, relecture juriste, loi 2024/017
  (transfert hors du Cameroun), secrets GitHub + premier passage en analyse.

### Phase 7 — Administration ✅
Mini-plan (2 oct. 2026). Les règles admin (`admins`, `settings`, modération, strikes, boosts,
badges, `auditLog`) existent et sont testées depuis la phase 2 (`tests/rules/admin.test.ts`) : la
phase est l'interface + les lots d'écriture. Firestore **lite** suffit (pas de temps réel) : pas de SDK complet.
- `src/lib/admin-logic.ts` (pur, testé) : onglets par rôle, `boostUntil` à la validation
  (décision 10 : max(maintenant, fin actuelle) + `boostDays` ; illimitée conservée), strike +1 et
  bannissement auto à 5, tri des signalements (masquées → « semble mineure » → nombre), validation
  du formulaire Réglages (numéros `+2376…` ou vides), libellés du journal.
- `src/lib/admin.ts` (Firestore lite) : rôle (`admins/{uid}`), requêtes par onglet (limites 30–100),
  et chaque action en **un lot** avec son entrée `auditLog` (une par document audité) + notification :
  supprimer (motif, strike, notification), avertir, rétablir/classer, valider/rejeter un paiement
  (annonce + demande + verrou + notification), badge accordé/refusé/retiré (profil + ses annonces),
  mise en avant manuelle, bannir/débannir, réglages, modérateurs (ajout par e-mail ou uid, retrait =
  rôle `none`), nettoyage (annonces expirées + contact, boosts expirés, captures traitées > 30 j).
- `src/pages/admin.tsx` + `src/components/admin/*.tsx` (un fichier par onglet) + `src/styles/admin.css`.
  Onglets en barre défilante (liens `#onglet`), modérateur : Signalements, Récentes, Badges, Santé.
- Badge côté membre (SPEC § 8, absent des phases précédentes) : bloc « Badge vérifié » dans `/compte`
  (photo de pièce compressée, état en attente / refusé / accordé) — nécessaire pour que l'onglet Badges serve.
- Tests : unitaires `tests/unit/admin.test.ts` ; E2E `tests/e2e/admin.spec.ts` : modérateur sans
  Paiements/Réglages, non-admin refusé, parcours boost validé → tête du fil + bandeau + notification,
  rejet avec motif, 5 suppressions → publication bloquée, rétablir, badge, réglages, équipe, nettoyage ;
  captures `docs/captures/phase-7/`. Fin : relecture sécurité par sous-agent (CLAUDE.md § 1.8).

Résultats (3 oct. 2026) :
- [x] `npm test` → exit 0 : **415** unitaires (dont `tests/unit/admin.test.ts`, 25 tests : onglets par
      rôle, validation de boost décision 10, strikes et blocage à 5, file des signalements, formulaire
      Réglages, journal, estimation Santé), **138** règles (+8 après relecture sécurité), build.
- [x] `npm run test:e2e` → **188 passed**, 30 skipped, 0 failed (run du 3 oct., admin-global compris).
      Run final après durcissement des règles : 183 passed + 3 dépassements de délai sous charge
      (`feed.spec` reload ×2, `shell.spec` /confidentialite) → relancés seuls : feed + shell
      **114 passed**, `--project=admin-global --no-deps` **2 passed** ; `admin.spec` ×2 tailles **12 passed**.
      `admin.spec.ts` : refus sans rôle ; modérateur = 4 onglets, `#reglages` ramené à Signalements,
      « Rétablir » audité, badge visible sans bouton ; paiement Premium demandé (UI phase 6) puis
      validé → `rank 2`, fin à +7 j, demande `approved`, verrou effacé, 2 entrées d'audit, **en tête
      du fil devant 2 annonces plus récentes, dans le bandeau, notification reçue** ; rejet avec
      motif obligatoire ; **5 suppressions par un modérateur → strikes 5, publication bloquée sur
      /publier**, puis levée par le super (Utilisateurs) ; badge demandé dans /compte (sans EXIF) →
      accordé → profil + annonce `verified`, pièce effacée ; mise en avant manuelle sans fin puis retirée.
      `admin-global.spec.ts` (projet lancé après tous les autres : il touche aux données communes) :
      Réglages validés et audités, Équipe (e-mail inconnu refusé, ajout par e-mail, vrai accès
      modérateur, retrait → accès refusé), Journal, Nettoyage (annonce expirée + contact effacés,
      boost expiré remis à 0 audité, capture de 40 j effacée).
- [x] Corrigé en route : `profile-photo.spec` visait « le » champ fichier de /compte (il y en a deux
      avec le badge) ; course réelle de la cloche (un recomptage fini après « Se déconnecter » la
      faisait réapparaître → ignoré si la session a changé) ; `shell.spec` 16 navigations : délai 90 s ;
      suppression d'une annonce sans dossier `users` : message de confirmation ajouté.
- [x] Captures `docs/captures/phase-7/` (CAPTURES=1 → 4 passed, 64 images) regardées :
      `admin-signalements` : masquées en tête, 2 étiquettes, motifs comptés, 3 boutons ·
      `admin-supprimer-motif` : 6 motifs en puces + champ + Supprimer/Annuler · `admin-paiements` :
      formule, montant, opérateur, référence, date, membre, capture · `admin-reglages` : 3 cartes de
      champs · `admin-utilisateurs` : fiche (uid, e-mail, strikes, publication, rôle) · `admin-mises-en-avant`
      : « sans fin » + Retirer · `admin-sante` : compteurs + quotas · `admin-journal` : libellé, auteur,
      cible, motif, changement · `admin-equipe`, `admin-nettoyage` (titre en double retiré) ·
      `moderateur-*` : 4 onglets, pièce visible sans bouton · `compte-badge` : texte + 2 boutons.
- [x] Relecture sécurité (sous-agent `dev-securite-mobile`) : 0 critique, 3 importants corrigés dans
      les règles + tests (strike lié à une vraie suppression et inversement ; `users` listable par le
      super seul ; notifications admin auditées, `boost_*`/`badge_*` réservées au super), mineurs
      corrigés : super ne rétrograde pas un super, contact effacé seulement avec son annonce, verrou
      effacé seulement avec la décision, remise en ligne d'une annonce supprimée réservée au super.
      Laissés (documentés ARCHITECTURE § 5) : contenu des entrées d'audit non vérifié, capture
      réutilisable deux fois, demande `pending` d'une annonce effacée par le Nettoyage (visible dans
      Paiements : « rejeter seulement »).
- JS initial de l'accueil ≈ 69 Ko gzip (≤ 120 ; `fr` 7,2 → 10,4 Ko avec les textes admin). Démo absente du build.
- ⚠️ Index réels des requêtes admin à vérifier sur staging (HUMAN-TODO).

### Bandeau Premium « Ruban » de la v1 (demande du propriétaire, 3 oct. 2026)
- `railOf()` (`src/lib/public-listing.ts`, remplace `premiumOfPage` et le `shuffle` devenu inutile) :
  promotions en cours du fil chargé, Premium puis Sponsorisées, ordre du fil, 30 au plus.
- `src/components/PremiumBanner.tsx` réécrit : titre « Premium » + trait + compteur (« 3 premium ·
  2 sponsorisées », règle de la v1 : seulement « N premium » à partir de 5), cartes 152×206 photo
  Cloudinary `w_360`, dégradé, étiquette dorée/sponsorisée, « pseudo, âge » + badge, quartier,
  liseré doré Premium ; défilement JS 34 px/s en boucle (position fractionnaire), arrêt au
  toucher/survol/focus, glisser à la souris, reprise 2 s, rien avec « réduire les animations »
  (copie de boucle masquée). Jetons v2 ajoutés (`--gold-lift`, `--gold-line`, `--plate-*`).
- `Feed` : « Annonces récentes · N à {ville} » (`loadCityCount`, cache partagé avec le sélecteur).
- Pseudo long : coupé avec « … » (virgule gardée avec le pseudo), âge et badge toujours visibles.
- Tests : unitaire `railOf` ; `feed.spec` (ordre du ruban, compteur, « 7 à … ») ; `rail.spec`
  (×2 tailles : ordre, 152×206, photo `w_360`, étiquettes, badge, vitesse 30–80 px en 1,5 s, arrêt
  au survol puis reprise après 2 s, immobile en mouvement réduit). `npm test` → 414 unitaires,
  138 règles, build ; rail + feed + admin ×2 tailles → **34 passed**.
- Captures `docs/captures/ruban/` (375/360, sombre/clair, immobile et en défilement) regardées :
  conformes à la v1. Critique visuelle (sous-agent) : 5 remarques ; retenue : espace parasite
  « Junior237… , 29 » (corrigé). Écartées car contraires à « reprendre exactement » la v1 et aux
  jetons v2 : tailles 10,5/11 px, étiquette sur chaque carte (obligatoire, loi 2010/021), teinte
  `--gold-text` claire.
- Suite E2E complète : 186 passed, 2 échecs `accounts.spec` = **vrai bug trouvé** : `ageFrom`
  divisait par une année moyenne → « 24 ans » le jour des 25 ans (né le 3 oct. 2001, test du
  3 oct.). Corrigé par un calcul calendaire UTC + test unitaire (anniversaire, 29 février) ;
  `accounts.spec` ×2 → 20 passed, `admin-global` → 2 passed ; `npm test` → 415 unitaires.
- `npm run deploy:preview` (staging : index + règles durcies publiés, canal
  https://nioxxer-staging--preview-5k9bgz5i.web.app, expire le 10 oct.) puis
  `MSYS_NO_PATHCONV=1 npm run lighthouse -- <canal> --pages=/` → **score 86**, FCP 1,69 s,
  LCP 3,37 s, TBT 138 ms, **CLS 0,000**, 168 Ko (écart LCP déjà accepté en phase 5, ~3,8 s alors).
- Q21 : au-delà de 20 promotions dans une ville, le ruban se complète au fil des pages chargées
  (pas de requête à part : 0 lecture en plus, pas de décalage).

## Décisions [À PROUVER] — résultats sur l'émulateur (2 oct. 2026)
- ✅ Filtre d'âge : plage sur `birthMonth` + `orderBy rank desc, createdAt desc` → ordre
  conservé et plage respectée (`tests/rules/queries.test.ts`, aussi avec `genre in`). On
  l'utilise : pas de sur-lecture côté client.
- ✅ Pagination `startAfter` sans doublon ni trou (même fichier).
- ✅ `firestore/lite` (12.19.0) : `getDocs` + `getCount` fonctionnent contre l'émulateur.
- ✅ `(?s)` dans `matches()` : un terme interdit après un retour à la ligne est refusé.
- ✅ `List.join()` existe dans les règles (validation des photos en une regex).
- ❌→corrigé : `lower()` des règles ne met en minuscules que l'ASCII (« ÉCOLIÈRE » passait).
  Correctif : `withAccentCapitals` ajoute les majuscules accentuées dans chaque classe `[…]`.
- ❌→corrigé : limite de **1 000 expressions évaluées** atteinte dès 2 photos (journal de
  l'émulateur : « maximum of 1000 expressions to evaluate has been reached »). Correctifs :
  listes fermées en regex, une seule regex de texte, photos en chaînes. Test du cas le plus
  lourd (5 photos, textes à longueur maximale, création puis édition) → vert.
- ⚠️ L'émulateur n'exige aucun index composite : `firestore.indexes.json` (11 index) devra être
  déployé et chaque requête vérifiée sur un vrai projet (voir Q4).
- ⚠️ Comptage des expressions en production non mesurable localement : marge vérifiée
  uniquement par le test « cas le plus lourd ».

**Changements de modèle (reportés dans ARCHITECTURE § 4–5)** : `expiresAt` → `renewedAt`
(heure serveur ; expiration = +180 j) ; plus de `city` dans l'annonce (déduit de `citySlug`) ;
photos = chaînes `listings/<id>:<l>x<h>` ; verrou `pendingBoosts/{listingId}` ; champ `auditId`
sur les documents écrits par un admin.

## Prochain pas
Fin de phase 3 : `npm run deploy:preview` sur `nioxxer-staging`, `curl -I` des en-têtes de cache,
puis test d'inscription réel une fois `settings/public` créé par le propriétaire (HUMAN-TODO).
Ensuite phase 4 (publier) — attend Cloudinary (HUMAN-TODO).

## Décisions du propriétaire (2 oct. 2026)
1. Tout archiver sauf `.claude/` et `PROMPT-DEMARRAGE.md`.
2. Auto-réparation des boosts expirés par n'importe qui (rank/boostUntil seulement, si expiré) + tests.
3. L'auteur peut effacer une annonce `removed` ; strike et audit restent.
4. Signalements anonymes acceptés au lancement ; annonces masquées en tête de l'admin + « Rétablir » audité.
5. nioxxer.com déjà sur Firebase Hosting (`nioxxer-cda95`) ; `authDomain` via `VITE_AUTH_DOMAIN` ; preview = popup.
6. 5 photos pour tous ; Premium = cadre or + défilé de photos sur la carte.
7. Âge au mois près accepté.
8. Variantes accentuées dans MINOR_TERMS ; « 25 ans », « 1m75 », « 2 enfants », « né en 1995 » doivent passer.
9. `firebase login` dans HUMAN-TODO (fait par le propriétaire).
10. Boost validé : +7 j à partir de la fin actuelle si elle est future.
11. Q1, Q2, Q3 validées (pseudo, liste de prix, « depuis 15 ans » refusé).
12. Q4 : projet séparé `nioxxer-staging` pour les prévisualisations ; le propriétaire le crée
    (HUMAN-TODO) et préviendra. En attendant : émulateurs uniquement.
13. Politique de confidentialité (phase 8) : mentionner que les comptes sanctionnés (strikes > 0)
    gardent leur dossier privé `users` après suppression du compte.
14. Q11, Q12, Q13 (phase 6) validées. Numéros de paiement et logos MTN/Orange : le propriétaire
    les fournira au moment de tester l'admin (phase 7).
15. (3 oct. 2026) Q22 validée : nudité explicite interdite sur les photos (déjà écrit : CGU
    « Contenus interdits » et `/regles` « Ce qui est interdit »). Q23 validée : pas de remboursement
    d'une mise en avant si l'annonce est supprimée pour infraction (CGU « Mise en avant payante »).
16. (3 oct. 2026) Identité de l'éditeur et avis juridique sur la loi 2024/017 : le propriétaire s'en
    occupe avant la mise en ligne.
17. (3 oct. 2026) Q24, Q25, Q26, Q27 validées telles quelles. Pas de phrase sur la nudité dans la
    politique de confidentialité.

## Questions (choix pris en attendant la réponse du propriétaire)
- Q28 (recette) Bandeau : tirage au sort **dans** chaque groupe, Premium toujours avant Sponsorisé
  (le Premium paie 4× plus). Plafond de lecture 100 annonces (quota Spark). Aucune mise en avant :
  carte « Votre annonce ici » → Mes annonces, à la même hauteur (pas de saut de page).
- Q30 (recette) Suppression de compte = demande : confirmation par mot de passe (ou Google) gardée ;
  annonces passées en `closed` (jamais rouvertes) ; profil public `/membre` toujours lisible mais sans
  annonce pendant les 60 jours ; pas d'annulation depuis le site. Demandes en tête de l'onglet
  **Utilisateurs** (pas de 12e onglet : la barre est déjà longue). Effacement par l'admin : Firestore
  tout de suite, compte de connexion + photos Cloudinary par la tâche de nuit (pierre tombale
  `deletedAccounts/{uid}` ; même uid ne peut pas se réinscrire avant). Une demande de paiement en
  attente du membre reste dans « Paiements » (à rejeter).
- Q31 (recette) Durée Premium / Sponsorisé : `settings.boostDays` devient `{ premium, sponsored }` ;
  un ancien réglage (un seul nombre) est lu comme la même durée pour les deux jusqu'au prochain
  enregistrement de Réglages. Avantages Sponsorisé sur /booster : « Bandeau défilant en haut de
  l'accueil, dans toutes les villes » ajouté (le bandeau contient les Sponsorisées depuis le 3 oct.).
- Q32 (recette) « Mise en avant retirée » en double : pas reproduit à coup sûr ; cause la plus
  probable = double appui sur « Retirer » (aucun verrou) → bouton verrouillé tout de suite, et un
  message identique déjà affiché n'est plus empilé. La fiche du membre en dessous suit le retrait.
- Q33 (recette) Filigrane centré : taille inchangée (25 % de la largeur), seuls la position et
  l'opacité changent, comme demandé.
- Q29 (recette) Carte du fil (2 colonnes) : pseudo, âge, badge, profil · quartier, vues, j'aime sur la
  photo ; le **début du titre** n'apparaît plus que sur la carte large de la recherche (trop serré à
  170 px). Défilé des photos Premium sur la carte conservé (décision 6).
- Q1 (phase 1) Format du pseudo non précisé → choix : 3 à 20 caractères, lettres sans accent,
  chiffres, `_ . -` (`^[a-z0-9][a-z0-9_.-]{2,19}$` sur la forme minuscule, qui sert d'identifiant
  `usernames/{pseudoLower}`). L'affichage garde les majuscules saisies.
- Q2 (phase 1) Liste de prix v1 : retirés de `PRICE_TERMS` car faux positifs fréquents :
  « cash » (« je suis cash » = franc), « sponsor » (le site affiche « Sponsorisé »), « massage ».
  Gardés : montant + devise, cfa/fcfa/xaf, tarif, prix, payant, rémunér…, money, escort, bizi,
  wolowoss, tchoko, short/long time, par nuit, une passe… À valider par le propriétaire.
- Q4 ✅ tranchée (2 oct. 2026) : `nioxxer-staging` créé par le propriétaire (Firestore europe-west1, Auth e-mail + Google + anonyme, Hosting, Spark). Énoncé : **Projet de test séparé ?** Un canal de prévisualisation Firebase partage la base
  Firestore et les comptes de la production : déployer les règles v2 sur `nioxxer-cda95`
  casserait le site v1 en ligne. Proposition : projet gratuit `nioxxer-staging` pour les
  prévisualisations (phases 3 à 8), bascule sur `nioxxer-cda95` en phase 9. En attendant :
  aucun déploiement, tout sur émulateurs. (Ajouté à HUMAN-TODO.)
- Q3 (phase 1) `MINOR_TERMS` : âges 10–17 suivis de « ans » refusés ; âges à un chiffre acceptés
  (« en couple depuis 3 ans »). Conséquence assumée : « depuis 15 ans » est refusé.

- Q8 (phase 5) Bandeau Premium : pris dans la 1re page du fil (20 annonces, Premium en tête) au
  lieu d'une requête à part — supprime un décalage de mise en page (CLS 0,083 → 0) et une requête.
  Au-delà de 20 Premium dans une ville, le bandeau ne montre que les 20 plus récentes.
- Q9 (phase 5) Curseur d'âge : 18 à gauche et 70 à droite = aucune borne (70 = « 70 ans et + »).
- Q10 (phase 5) Ordre exact malgré un boost expiré : remise à zéro (décision 2) puis relecture de la
  page (une lecture de plus, une fois par boost expiré).

- Q11 (phase 6) Cloche : la pastille compte les notifications **enregistrées** non lues ; les rappels
  calculés (expiration 7 j, boost J-1) sont en tête de `/compte#notifications` et dans « Mes annonces »
  mais ne gonflent pas la pastille (pas d'état « lu »). Nombre mis en cache dans `localStorage`
  (`nx-unread`, affichage seulement) par les pages à compte : les pages publiques ne chargent pas
  Firebase Auth. Limite : déconnexion depuis un autre appareil = cloche visible jusqu'à la prochaine
  page à compte.
- Q12 (phase 6) Booster refusé côté client pour une annonce expirée, masquée ou déjà mise en avant sans
  fin (les règles n'exigent que `status == "active"`) : évite un paiement inutile.
- Q13 (phase 6) Notifications marquées lues dès leur affichage dans `/compte` (30 dernières).

- Q14 (phase 7) Paiement validé alors qu'une mise en avant d'un **autre niveau** court : les jours
  s'ajoutent à la fin actuelle (décision 10) et le niveau le plus haut des deux est gardé (Premium en
  cours + Sponsorisé payé = Premium prolongé de 7 j). Une mise en avant sans fin reste sans fin.
- Q15 (phase 7) Demande de badge côté membre (SPEC § 8) absente des phases 3–6 : ajoutée dans `/compte`
  (bloc « Badge vérifié »), sinon l'onglet Badges ne sert à rien.
- Q16 (phase 7) « Santé » : sans serveur, la consommation réelle du jour n'est pas lisible depuis le
  site. Affichés : compteurs Firestore (`getCount`), quotas Spark (ARCHITECTURE § 2), estimation
  « accueil ≈ 20 lectures → ~2 500 chargements/jour » (le « ~1 400 » d'ARCHITECTURE comptait le
  bandeau à part, supprimé par Q8) et liens vers les consoles.
- Q17 (phase 7) Annonce signalée mais pas masquée : bouton « Classer sans suite » (compteur remis à 0,
  audité — même écriture que « Rétablir », déjà permise par les règles), sinon la file ne se vide jamais.
- Q18 (phase 7) « Débloquer la publication » ne remet pas les strikes à 0 : une nouvelle suppression
  rebloque aussitôt (≥ 5). « Avertir » = notification + entrée de journal, sans strike.
- Q19 (phase 7) Retirer un modérateur = rôle `none` (les règles interdisent d'effacer `admins/{uid}`).
- Q20 (phase 7) Badge recopié sur les annonces du membre : un petit lot audité par annonce (limite de
  lectures des règles par requête), donc pas atomique ; si le réseau coupe, relancer « Accorder le
  badge » (Mises en avant) recopie le reste.

- Q21b (phase 8) Textes légaux dans `src/i18n/legal-fr.ts` (et non `fr.ts`) : ils ne servent qu'au
  build (HTML statique) ; dans `fr.ts` ils alourdiraient le JS de chaque page (~15 Ko). Vérifié par
  `scripts/check-links.ts` (aucun texte légal dans `dist/assets/*.js`).
- Q22 (phase 8) **Nudité explicite interdite** dans les CGU et les règles (absent de la SPEC) : les
  photos sont visibles sans compte ni contrôle d'âge ; choix le plus prudent. À valider.
- Q23 (phase 8) Mise en avant : une annonce supprimée pour infraction perd sa mise en avant **sans
  remboursement** ; toute réclamation passe par le WhatsApp du support. À valider.
- Q24 (phase 8) Identité de l'éditeur inconnue → « À compléter » sur `/mentions-legales` et
  `npm run deploy` refusé tant qu'elle manque (HUMAN-TODO). Aucun nom inventé.
- Q25 (phase 8) `termsVersion` modifiable dans admin › Réglages (super, audité, motif : 1–20
  caractères). Un membre qui refuse la nouvelle version n'a plus accès à son compte : l'écran lui
  propose de contacter le support (pas de suppression de compte sans accepter).
- Q26 (phase 8) Pied de page (Aide · Règles · Conditions · Confidentialité · Mentions légales) sur
  **toutes** les pages : sinon `/aide` et les pages légales n'avaient aucun lien d'accès. `main` fait
  au moins un écran de haut → le pied n'est jamais dans l'écran au chargement (CLS inchangé).
- Q27 (phase 8) Maintenance : scans complets (likes/reports orphelins, photos orphelines) **le
  dimanche** seulement ; photos de profil (`avatars`) incluses ; garde-fou contre un effacement
  massif. `robots.txt` autorise tout (les pages privées ont `noindex`) ; `/connexion` hors sitemap.

## Idées (hors périmètre, pour plus tard)
- (point 28 de la recette, préparé, **non activé**) Payer pour dépasser le nombre d'annonces
  gratuites (`maxActiveListings`, réglable dans Admin › Réglages, inchangé). Piste : un « emplacement
  supplémentaire » acheté comme une mise en avant (même parcours MoMo/Orange + capture, validé par le
  super-admin), qui augmenterait une limite **par compte** (`users.extraSlots`, écrit seulement par le
  super-admin et audité) ; les règles accepteraient alors `slot <= maxActiveListings + extraSlots`.
  À chiffrer et valider par le propriétaire avant tout code.
- Annuler une demande de suppression de compte (aujourd'hui : contacter le support ; l'équipe ne peut
  pas l'annuler non plus, il faudrait une règle « retrait de la demande » auditée).
- App Check (reCAPTCHA) pour limiter les robots sur Firestore (signalements multiples via
  sessions anonymes, fausses vues qui consomment le quota d'écritures).

## Blocages
(aucun)

### Bascule production (4 oct. 2026)
- [x] Recette signée par le propriétaire (conversation, 4 oct.). Éditeur : PAPA BONHEUR, Moscou City, Russie.
- [x] `scripts/export-v1.ts` (`npm run export:v1`) : export lecture seule Firestore + comptes Auth → `archives/v1-export/` (ignoré par git). `tsc`, eslint, prettier OK ; `vitest` → 449 passed ; `check:legal` → complètes.
- [x] Workflow `production.yml` (run 37211871765, succès) : export v1 → settings 1, users 2, comptes Auth 2, aucune annonce ; `npm run deploy` → 449 unitaires + 172 règles, check-links 0 mort, hosting+règles+index sur nioxxer-cda95 ; nioxxer.com : 35 pages du sitemap + /connexion /publier /compte /admin → 200, /n-existe-pas → 404.
- [ ] Test manuel du propriétaire : connexion e-mail, Google, publication.
- [x] Choix A du propriétaire (4 oct.) : connexion e-mail/Google en échec sur nioxxer-cda95 → la
      production pointe sur `nioxxer-staging` (config, `.firebaserc`, `deploy`). `vitest` → 449 passed,
      `tsc` OK. Déploiement par `.github/deploy-trigger` après les réglages console (HUMAN-TODO § Choix A).
- [x] Run 37220401340 (succès) : `npm run deploy` sur `nioxxer-staging` (tests verts, hosting + règles + index),
      nioxxer.com : pages du sitemap + /connexion /publier /compte /admin → 200, 404 OK. Le run 37219881549
      avait échoué (403, droits du compte de service sur staging) avant tout changement en ligne.
- [ ] Test du propriétaire sur nioxxer.com : connexion e-mail, Google, vérification e-mail, publication.
- [x] Super-admin du propriétaire (uid OaBo4GjayqXmnoq6HnrKkEAyJCT2) sur nioxxer-staging :
      `scripts/grant-super-admin.ts` via `grant-admin.yml`, run 37226001774 → succès (+ entrée auditLog).
- [ ] E-mail de vérification non reçu : vérifier le domaine personnalisé des modèles Auth (HUMAN-TODO).
