# NIOXXER v2 — Architecture technique

Lis ce document en entier avant d'écrire du code. Les points marqués **[À PROUVER]** sont des
hypothèses techniques que tu dois **vérifier par un test sur émulateur** avant de bâtir dessus ;
note le résultat dans `PROGRESS.md`. Ne présente jamais une hypothèse comme un fait.

---

## 1. Vue d'ensemble

```
Téléphone (navigateur)
  │  HTML/CSS/JS statiques (Vite, hachés)  ◄── Firebase Hosting (nioxxer.com)
  │  Lecture/écriture données             ◄──► Cloud Firestore (règles = toute la sécurité)
  │  Comptes                              ◄──► Firebase Auth (e-mail, Google, anonyme)
  │  Photos d'annonces (upload non signé) ───► Cloudinary (filigrane à l'upload)
  │  Contact                               ───► wa.me / tel: (WhatsApp de l'annonceur)
GitHub Actions (cron quotidien, compte de service) ──► Firestore + Cloudinary Admin API
```

Pas de serveur à nous. Conséquences assumées :
- Toute règle métier qui doit résister à un utilisateur malveillant est dans `firestore.rules`.
- Ce que les règles ne savent pas faire (tâches planifiées, suppression Cloudinary) passe par le
  cron GitHub Actions ou par l'admin.

## 2. Limites gratuites RÉELLES (vérifiées le 2 octobre 2026)

| Service | Limite gratuite | Conséquence pour le code |
|---|---|---|
| Firestore (Spark) | 1 Gio stocké · **50 000 lectures/jour** · **20 000 écritures/jour** · 20 000 suppressions/jour | Pages de 20, pas de lecture inutile, compteurs de vues dédoublonnés |
| Hosting (Spark) | 10 Go stockés · **360 Mo transférés/jour** | Bundle minuscule, cache long sur fichiers hachés |
| Auth | E-mail, Google, anonyme inclus | — |
| Cloud Functions / Cloud Storage | **Indisponibles sur Spark** | Pas de code serveur Firebase, pas de Storage |
| Cloudinary Free | **25 crédits/mois partagés** : 1 crédit = 1 Go stocké OU 1 Go livré OU 1 000 transformations. Sans carte. | Seulement 2 tailles dérivées par photo ; compression avant envoi |

Ordres de grandeur à garder en tête (à afficher dans l'admin, rubrique « Santé ») :
- Un chargement d'accueil ≈ 20 lectures (fil) + ≤ 10 (bandeau Premium) + 1 (réglages)
  → **~1 400 chargements d'accueil/jour** avant d'atteindre 50 000 lectures.
- Cloudinary : ~1 000 annonces de 5 photos ≈ 1 Go stocké + ~10 000 transformations (≈ 11 crédits) ;
  il reste ~14 crédits de bande passante ≈ 14 Go ≈ quelques dizaines de milliers de pages vues/mois.
- Au-delà : passage au plan Blaze (facturation à l'usage, alertes de budget) — décision du
  propriétaire, pas la tienne. Le code doit fonctionner à l'identique sur les deux plans.

## 3. Arborescence

```
/                     (racine du dépôt)
├─ CLAUDE.md  PROGRESS.md  package.json  vite.config.ts  tsconfig.json
├─ firebase.json  .firebaserc  firestore.rules  firestore.indexes.json
├─ index.html recherche.html annonce.html membre.html connexion.html verifier-email.html
│  compte.html publier.html booster.html admin.html aide.html cgu.html confidentialite.html
│  mentions-legales.html regles.html 404.html      (entrées Vite, coquilles HTML minimales)
├─ scripts/
│  ├─ build-city-pages.ts   (génère dist/ville/{slug}/index.html au build)
│  ├─ seed-emulator.ts      (données de démo — émulateurs uniquement, refuse sinon)
│  └─ maintenance.ts        (tâche quotidienne, exécutée par GitHub Actions)
├─ .github/workflows/maintenance.yml
├─ public/  (logo, favicon, og-image, polices woff2, logos officiels SVG, robots.txt)
├─ src/
│  ├─ firebase/  app.ts (init), lite.ts (lectures publiques), auth.ts (chargé à la demande)
│  ├─ data/      cities.ts genres.ts moderation.ts (MINOR_TERMS, PRICE_PATTERN…) settings.ts
│  ├─ i18n/fr.ts
│  ├─ components/ (BottomNav, Header, CityPicker, ListingCard, PremiumMarquee, Feed,
│  │               FiltersSheet, AgeRange, PhotoUploader, WhatsAppButton, ReportSheet,
│  │               NotificationBell, Toast, EmptyState, Skeleton…)
│  ├─ pages/      (un fichier par page, monté par l'entrée HTML correspondante)
│  ├─ lib/        (cloudinary.ts, image-compress.ts, format.ts, in-app-browser.ts, errors.ts)
│  └─ styles/     tokens.css base.css
├─ tests/ unit/ rules/ e2e/
├─ docs/
└─ archives/v1/   (ancien site, NE PAS MODIFIER, ne pas publier)
```

`firebase.json` > `hosting.public` = `dist` (sortie Vite). Rien d'autre n'est publié.

## 4. Modèle de données Firestore

Horodatages : `serverTimestamp()` à l'écriture, vérifiés `== request.time` dans les règles.

### `users/{uid}` — privé (propriétaire + admins)
```
email, birthDate (timestamp, immuable), genre, city, whatsapp ("+2376XXXXXXXX"),
termsVersion (string), termsAcceptedAt, createdAt (immuable),
strikes (int, admin seul), publishBanned (bool, admin seul)
```

### `publicProfiles/{uid}` — public en lecture
```
pseudo (immuable), photoUrl | null, memberSince (= users.createdAt), verified (bool, admin seul)
```

### `usernames/{pseudoLower}` — unicité du pseudo
```
uid   (création seule si inexistant, jamais modifié ; supprimé avec le compte)
```

### `listings/{uid}_{n}` — public en lecture (n = 1…maxActiveListings lu dans `settings/public`, plafond porté par l'identifiant)
```
ownerUid, pseudo, profilePhotoUrl, verified, memberSince,      ← dénormalisés depuis le profil
birthMonth (timestamp au 1er du mois de naissance — jamais la date exacte en public ; l'âge
            affiché est donc approché au mois près, écart accepté par le propriétaire),
genre, citySlug, district, title, description, offer,
photos: ["<publicId>:<largeur>x<hauteur>", …] (1 à 5 chaînes), contactMode: "message" | "call_message",
rank (0 gratuit | 1 sponsorisé | 2 premium, admin seul), boostUntil | null (admin seul ;
      rank > 0 avec boostUntil null = mise en avant illimitée accordée par l'admin),
views, likes, reportsCount (incréments contrôlés), hidden (bool),
status: "active" | "removed", removedReason | null,
createdAt, updatedAt, renewedAt (= heure serveur de création ou de la dernière republication),
auditId (posé par les écritures admin, voir § 5)
```
**Changements prouvés en phase 2 (2 oct. 2026)** :
- `expiresAt` → **`renewedAt`** : le client ne connaît pas l'heure du serveur, il ne peut donc pas
  écrire « request.time + 180 j » exactement. On stocke `renewedAt == request.time` et
  l'expiration vaut `renewedAt + 180 j` (cron : `renewedAt < maintenant − 180 j`).
- Plus de champ `city` (nom) : il se déduit de `citySlug` via `src/data/cities.ts`.
- Photos en **chaînes compactes** (sans préfixe de dossier depuis le 2 oct. 2026, voir § 6) : les règles s'arrêtent à **1 000 expressions évaluées par
  requête** (limite atteinte et prouvée sur l'émulateur avec des photos en objets) ; la liste se
  valide en une seule regex (`join` + `matches`).
### `listings/{id}/private/contact` — lecture `get` publique, PAS `list`
```
whatsapp, callAllowed
```
Lu uniquement au clic sur WhatsApp/Appeler. Limite honnête : sans serveur, un robot qui connaît
les identifiants d'annonces peut lire ces numéros un par un. C'est accepté pour le lancement
(documenté dans la Politique de confidentialité). Le numéro n'est jamais dans la carte, le HTML,
ni un document listable.

### `likes/{listingId}_{uid}`, `reports/{listingId}_{uid}`
Un document par couple (annonce, visiteur) → un seul « j'aime » et un seul signalement par
personne, garanti par les règles. Les visiteurs sans compte reçoivent une **session anonyme
Firebase** au premier clic sur J'aime/Signaler (Auth chargé à ce moment-là seulement).
`reports` : `reason` (une des 7 valeurs), `note` (≤ 300 car.), `createdAt`.

### `boostRequests/{id}`
```
listingId, ownerUid, tier ("premium" | "sponsored"), operator ("mtn" | "orange"),
amount (doit égaler le prix courant de settings), txRef | null,
screenshot (data URL JPEG compressée ≤ 300 Ko, voir § 6), status ("pending" | "approved" |
"rejected"), rejectReason | null, createdAt, handledBy | null, handledAt | null
```
### `pendingBoosts/{listingId}` — verrou « une seule demande en attente par annonce »
`requestId, createdAt`. Créé dans le même lot que la demande (création refusée s'il existe déjà),
supprimé par le super-admin dans le lot qui valide ou rejette la demande. (Les règles ne savent
pas compter les demandes en attente : ce verrou le fait.)

### `verificationRequests/{uid}` — demande de badge
```
idImage (data URL JPEG ≤ 300 Ko), status, createdAt, handledBy, handledAt
```
Pièce d'identité : lisible par le demandeur et les admins seulement ; **l'image est effacée**
(champ remplacé par null) dès la décision.

### `users/{uid}/notifications/{id}`
`type`, `title`, `body`, `read` (seul champ modifiable par le propriétaire), `createdAt`.
Créées par un admin (règles), jamais par l'utilisateur.

### `admins/{uid}`
`role: "super" | "moderator"`, `addedBy`, `addedAt`. Le premier super-admin est créé à la main
dans la console (HUMAN-TODO). Ensuite seul un super gère cette collection.

### `settings/public` — lecture publique, écriture super-admin
```
prices: { premium: 2000, sponsored: 500 }, boostDays: 7,
payment: { mtn: { number, name }, orange: { number, name } },
maxActiveListings: 7, reportsHideThreshold: 10, supportWhatsApp: "+237678802447", termsVersion: "2026-10-1"
```

### `auditLog/{id}` — création par un admin seulement, jamais modifié ni supprimé
`actorUid, action, targetType, targetId, before, after, reason, createdAt`.

### Index composites (`firestore.indexes.json`)
11 index : `listings` (status, hidden [, citySlug] [, genre], rank desc, createdAt desc
[, birthMonth **desc**]) — les 8 combinaisons ville/profil/âge du fil (prouvé sur staging le 2 oct. 2026 : le champ de plage suit le sens du dernier `orderBy`, donc `birthMonth` DESCENDING ; test `tests/unit/indexes.test.ts`) ; `boostRequests` (status, createdAt)
et (ownerUid, createdAt desc) ; `verificationRequests` (status, createdAt). Le bandeau Premium
(égalités seules, sans tri) et `reports` (listingId) se contentent des index simples.
**Attention, prouvé** : l'émulateur n'exige AUCUN index composite. Les index doivent donc être
déployés et chaque requête vérifiée sur le vrai projet (canal de prévisualisation).

## 5. Règles de sécurité — exigences

Repars des fonctions éprouvées de la v1 (`archives/v1/firestore.rules` : `estMajeur`,
`whatsappValide`, `coordonnees`, gestion du jeton `email_verified`) mais réécris proprement.

- `isSignedIn`, `isVerified` (`request.auth.token.email_verified == true` ; non requis pour les
  sessions anonymes qui ne font que J'aime/Signaler), `isAdmin`, `isSuper`.
- **Majorité** : `birthDate` ≤ `request.time` − 6 575 jours (borne haute, cf. v1) ; même seuil
  côté client (constante partagée, test qui compare).
- **Textes** (`title`, `description`, `offer`, `district`, `pseudo`) : longueurs max ; refus si
  `MINOR_TERMS`, `PRICE_PATTERN` ou coordonnées (téléphone, wa.me, e-mail) détectés sur le texte
  en minuscules. Les motifs vivent dans `src/data/moderation.ts` ; un script de build les injecte
  dans `firestore.rules` (ou un test vérifie l'égalité caractère pour caractère) — **une seule
  source de vérité**. Les règles ne savent pas retirer les accents : `MINOR_TERMS` contient
  explicitement les variantes avec et sans accents. Tests obligatoires : ≥ 30 phrases interdites
  refusées et ≥ 30 phrases légitimes acceptées, dont **« 25 ans », « 1m75 », « 2 enfants »,
  « né en 1995 »** (pas de faux positif prix/téléphone).
- **Annonce, création** : propriétaire vérifié, non banni, id = `{uid}_{n}` avec 1 ≤ n ≤ `settings/public.maxActiveListings`
  (lu par `get()` dans les règles),
  champs exacts (`keys().hasOnly`), `rank == 0`, `boostUntil == null`, compteurs à 0,
  `hidden == false`, `renewedAt == request.time`, champs dénormalisés égaux au profil
  (`get(publicProfiles/uid)`).
- **Annonce, modification par l'auteur** : `diff().affectedKeys().hasOnly([...champs éditables])`.
  Republier = `renewedAt` remis à `request.time`.
- **Compteurs** : `views` +1 seul (aucun autre champ) ; `likes` ±1 seulement si le document
  `likes/{id}_{uid}` est créé/supprimé dans le même lot (`existsAfter`/`getAfter`) ;
  `reportsCount` +1 avec création du `reports/…` dans le même lot, et `hidden` peut passer à
  `true` dans ce même lot seulement si le nouveau compte ≥ `settings/public.reportsHideThreshold` (10).
- **Boost expiré, auto-réparation** (décision du 2 oct. 2026) : **n'importe qui** (même sans
  compte) peut passer `rank` à 0 et `boostUntil` à `null`, à condition que
  `resource.data.boostUntil < request.time` et que `diff().affectedKeys().hasOnly(['rank',
  'boostUntil'])`. Aucun autre changement permis par ce chemin. Le client le déclenche quand il
  lit une annonce boostée expirée. Tests : autorisé si expiré ; refusé si non expiré, si
  `boostUntil == null`, si un autre champ change, si la nouvelle valeur n'est pas exactement
  `rank 0 / null`.
- **Annonce supprimée par la modération** : l'auteur peut **effacer** (`delete`) son annonce
  quand `status == "removed"` (libère l'identifiant `{uid}_{n}`) ; il ne peut pas la modifier
  ni la remettre en `active`. `users.strikes` et `auditLog` ne sont pas touchés.
- **Compte** (relecture sécurité, phase 2) : `users` + `publicProfiles` + `usernames` sont créés
  ensemble (inscription) et supprimés ensemble (suppression du compte) ; impossible d'en
  recréer un seul pour remettre à zéro strikes, bannissement, date de naissance ou pseudo. Un
  compte avec strikes > 0 garde son dossier privé `users` (il peut effacer son profil public).
  Pseudos réservés refusés (admin, nioxxer, support…). Une annonce masquée par les signalements
  ne peut pas être supprimée par son auteur tant qu'un admin n'a pas décidé.
- **Rétablir** : un admin (modérateur ou super) peut repasser `hidden` à `false` sur une annonce
  masquée par les signalements, avec `auditLog` dans le même lot.
- **Admin** : modérateur → `status`, `removedReason`, `hidden` ; super → en plus `rank`,
  `boostUntil`, `verified`, réglages, admins, paiements. Toute écriture admin s'accompagne d'un
  `auditLog` dans le même lot : le document écrit porte `auditId` = identifiant d'une entrée
  `auditLog` qui n'existait pas avant la requête (`!exists`) et existe après (`existsAfter`),
  dont `actorUid` est l'admin et `targetId` le document visé.
- **Durcissements de la relecture sécurité de fin de phase 7 (3 oct. 2026)** : un strike de
  modérateur doit compter une annonce du membre passée de `active` à `removed` dans le même lot
  (son id est dans l'entrée d'audit, `after.listingId`) ; inversement, toute suppression d'une
  annonce active s'accompagne du strike de son auteur (sauf dossier `users` déjà effacé) ; seul le
  super remet en ligne une annonce supprimée ; `users` listable par le super seulement (e-mails,
  WhatsApp) ; une notification écrite par un admin porte `auditId` (entrée d'audit du même lot) et
  les types `boost_*`/`badge_*` viennent du super ; un super ne rétrograde pas un autre super ; le
  `private/contact` n'est effacé par le super qu'avec son annonce ; le verrou `pendingBoosts` n'est
  effacé que dans le lot qui décide la demande. Limites assumées : le contenu (`action`,
  `before`/`after`) d'une entrée d'audit n'est pas vérifié ; une même capture peut servir deux
  fois (seule garde : le relevé Mobile Money comparé à la main).
- **Limite de 1 000 expressions évaluées par requête** (prouvée en phase 2) : les listes fermées
  (villes, profils, motifs, types) sont des regex `^(a|b|…)$` générées, et les trois motifs de
  texte n'en font qu'un (`forbiddenTextPattern`). `lower()` des règles ne met en minuscules que
  l'ASCII : les classes `[…]` des motifs incluent aussi les majuscules accentuées.
- Lecture du fil : `status == "active" && hidden == false` (les requêtes clientes filtrent de
  même, sinon Firestore refuse la requête).
- Tout le reste : refusé (`match /{document=**} { allow read, write: if false; }`).

## 6. Photos et documents

- Compte Cloudinary : cloud name **`bcxiwwkh`** (`CLOUDINARY_CLOUD_NAME`), mode « dossiers
  dynamiques ». Réglages du propriétaire (2 oct. 2026) :
  - **`nioxxer_listing`** (non signé, photos d'annonce) : dossier `listings`, formats
    jpg/jpeg/png/webp/heic, ID public aléatoire, **transformation entrante**
    `c_limit,w_1600,h_1600/l_nioxxer_watermark/c_scale,fl_relative,w_0.25/o_42/fl_layer_apply,g_center/q_auto:good`
    (filigrane centré, opacité 42 % : demande du propriétaire du 3 oct. 2026 ; avant : `o_35` en bas à droite).
  - **`nioxxer_avatar`** (non signé, photo de profil, sans filigrane) : dossier `avatars`, mêmes
    formats, transformation entrante `c_fill,g_face,w_400,h_400/q_auto:good`.
  - Pas de limite de taille d'envoi réglable dans la console : la compression côté client suffit.
- ✅ **Prouvé par un vrai envoi** (2 oct. 2026, image de test 2400×1800 générée) :
  `nioxxer_listing` → 1600×1200, 25 Ko, **filigrane visible sur l'URL brute** (sans aucune
  transformation, avec ou sans numéro de version) en bas à droite, EXIF absent ;
  `nioxxer_avatar` → 400×400, 2,4 Ko, sans filigrane. Livraisons `f_auto,q_auto,w_360` et
  `w_960` → 200 (WebP). Retirer les paramètres de l'URL ne rend donc jamais une photo sans filigrane.
- **Identifiant public sans dossier** (prouvé) : en dossiers dynamiques, le dossier est un
  attribut (`asset_folder`) ; le `public_id` est aléatoire, sans préfixe `listings/`. Les photos
  d'annonce sont donc stockées `<publicId>:<largeur>x<hauteur>` (§ 4, `PHOTO_REF`).
- **Photo de profil** : on stocke le `secure_url` renvoyé (version + identifiant, sans
  transformation ; motif `AVATAR_URL_PATTERN` vérifié par les règles, qui refusent toute
  transformation dans l'URL stockée — sinon une incrustation de texte serait possible).
  Affichage : une seule taille dérivée `f_auto,q_auto,w_160` (affichée en 80 px max).
- Côté client avant envoi : redimensionnement canvas à 1600 px max, JPEG qualité 0,85, EXIF
  supprimé (pas de coordonnées GPS des photos !). Barre de progression, reprise en cas d'échec.
- Livraison : exactement **deux** tailles dérivées — fil `w_360` et détail `w_960`
  (`f_auto,q_auto`). Pas d'autres variantes (chaque variante coûte des transformations).
- Un upload non signé peut être abusé (envoi de fichiers par un tiers) : limites du preset +
  nettoyage des orphelins par le cron (§ 8).
- **Captures de paiement et pièces d'identité → PAS sur Cloudinary** (les URL y seraient
  publiques). Compressées côté client en JPEG ≤ 300 Ko et stockées en data URL dans le document
  Firestore protégé par les règles (limite d'un document : 1 Mio). Effacées après traitement.

## 7. Authentification

- `authDomain` = **`nioxxer.com`** en production (le site est sur Firebase Hosting, qui sert
  `/__/auth/handler` sur le domaine personnalisé). Cela rend `signInWithRedirect` fiable sur
  mobile, ce qui n'était pas le cas en v1 (`authDomain` sur firebaseapp.com + stockage tiers
  partitionné). Exige l'URI de redirection dans la console Google Cloud (HUMAN-TODO).
  Sur mobile : redirect ; sur desktop : popup, repli redirect si bloquée.
  Confirmé par le propriétaire (2 oct. 2026) : nioxxer.com est déjà servi par Firebase Hosting,
  projet `nioxxer-cda95`.
- La config web Firebase (publique) est **choisie par le mode de build** dans
  `src/firebase/config.ts` (décision du propriétaire, 2 oct. 2026 : les `.env*` sont réservés
  aux vrais secrets) : `development` → `demo-nioxxer` + émulateurs, `authDomain` `localhost` ;
  `preview` → projet de test **`nioxxer-staging`**, `authDomain`
  `nioxxer-staging.firebaseapp.com` (canal `*.web.app`, où le redirect n'est pas fiable →
  **popup uniquement**) ; `production` → `nioxxer-cda95`, `authDomain` `nioxxer.com`. Le redirect mobile n'est donc testé qu'après la bascule (phase 9).
- **Navigateurs intégrés** (WhatsApp, Facebook, Instagram, TikTok) : Google y refuse la
  connexion. Détecter par user-agent (`src/lib/in-app-browser.ts`, testé) → masquer le bouton
  Google, afficher « Ouvrez nioxxer.com dans Chrome » + lien `intent://` Android vers Chrome.
  La connexion par e-mail reste disponible partout.
- Après vérification de l'e-mail : forcer un nouveau jeton (`getIdToken(true)`) avant toute
  écriture (piège déjà résolu en v1 : `ensureFreshVerifiedToken`).
- Liste des domaines d'e-mail jetables : reprendre `archives/v1/js/disposable-domains.js`, chargée
  à la demande uniquement sur l'inscription.

## 8. Maintenance planifiée (GitHub Actions)

`.github/workflows/maintenance.yml`, cron quotidien (ex. 03:00 Douala = 02:00 UTC) + lancement
manuel. Exécute `scripts/maintenance.ts` avec `firebase-admin` et l'API Admin Cloudinary.
Secrets GitHub : `FIREBASE_SERVICE_ACCOUNT`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`,
`CLOUDINARY_CLOUD_NAME`. Le script :
1. Supprime les annonces expirées (`renewedAt < now − 180 j`) + `private/contact` + likes/reports liés
   + leurs photos Cloudinary.
1b. Supprime les `likes` et `reports` orphelins (annonce supprimée) ou antérieurs à la
   création de l'annonce qui occupe le même identifiant (emplacement réutilisé).
2. Repasse à `rank = 0, boostUntil = null` les boosts expirés (+ `auditLog` acteur `system`).
3. Supprime les photos Cloudinary orphelines de plus de 48 h (non référencées par une annonce).
4. Efface les images des `boostRequests` / `verificationRequests` traités depuis plus de 30 jours.
5. Écrit un résumé dans `auditLog` et sort en erreur si quelque chose échoue (e-mail GitHub).

Le script a un mode `--dry-run` (par défaut en test) et des tests contre l'émulateur.

**Mise en œuvre (phase 8, 3 oct. 2026)** : `firebase-admin` **13.10.0** (la 14.x exige Node 22 ;
la machine et le workflow sont en Node 20). Cloudinary par l'API Admin REST (Basic auth) :
`GET /resources/by_asset_folder` (500 par page, `next_cursor`) et `DELETE /resources/image/upload`
(100 identifiants par appel). Précisions :
- Les étapes **1b et 3** lisent des collections entières (likes, reports, listings, publicProfiles) :
  elles tournent **le dimanche** (UTC) ou avec `--orphans`, pour le quota de lectures Spark.
  Les étapes 1, 2 et 4 ne lisent que ce qui est à traiter (`renewedAt <`, `boostUntil <`,
  `screenshot != null` / `idImage != null` avec projection : les images ne sont pas téléchargées).
- Étape 3 : dossiers `listings` **et `avatars`** (une photo de profil remplacée ou d'un compte
  supprimé serait sinon gardée indéfiniment, contraire à la politique de confidentialité).
  Le filigrane `nioxxer_watermark` est protégé. **Garde-fou** : si plus de la moitié des photos de
  plus de 48 h (et plus de 20) semblent orphelines — mauvais projet, lecture vide — rien n'est
  effacé et le job échoue ; `--force` pour passer outre après vérification.
- Étape 4 : aussi les `verificationRequests` traitées dont l'image n'a pas été effacée.
- Journal : une entrée par annonce expirée / boost expiré / image effacée (comme le Nettoyage) +
  un résumé `maintenance.run` (compteurs, erreurs) ; acteur `system`, affiché « la tâche
  automatique » dans l'onglet Journal.
- Le rapport imprimé ne contient que des compteurs (pas de donnée personnelle dans les journaux
  GitHub).
**Repli sans GitHub** : bouton « Nettoyage » dans l'admin (super) qui fait les étapes 1, 2 et 4
avec les droits admin des règles (sans la suppression Cloudinary, impossible sans secret).
Côté client, par sécurité, une annonce expirée ou un boost expiré ne s'affichent jamais comme
actifs, même si le cron n'est pas passé ; un boost expiré est en outre remis à 0 par le premier
visiteur qui le voit (règle d'auto-réparation, § 5).

**Validation d'un boost** : `boostUntil = max(maintenant, boostUntil actuel) + boostDays`.

## 9. Requêtes du fil

```
listings where status == "active" and hidden == false [and citySlug == X] [and genre in [...]]
orderBy rank desc, createdAt desc, limit 20, startAfter(dernier document)
```
- Filtre d'âge **[À PROUVER]** : tester sur l'émulateur si un filtre de plage sur `birthMonth`
  peut coexister avec `orderBy rank, createdAt` sans casser l'ordre voulu. Si oui, l'utiliser.
  Sinon : filtrage côté client avec sur-lecture (pages de 40, on garde celles qui passent jusqu'à
  20 affichées), et le noter dans `PROGRESS.md` avec le coût en lectures.
- Compteurs par ville (sélecteur) : requêtes d'agrégation `count` lancées seulement à l'ouverture
  du sélecteur, mises en cache 10 min dans `sessionStorage`. **[À PROUVER]** : disponibilité de
  l'agrégation dans `firestore/lite` de la version installée.
- Vues : +1 au plus une fois par annonce, par navigateur et par jour (marqueur `localStorage`).
- Bandeau Premium (décision de phase 5) : pris dans le fil déjà chargé (Premium en tête), pas de
  requête à part (supprime un décalage de mise en page). Depuis le 3 oct. 2026 (demande du
  propriétaire) : « Ruban » de la v1 — jusqu'à 30 cartes, Premium puis Sponsorisées, défilement
  JavaScript 34 px/s en boucle (liste doublée), arrêté au toucher/survol/focus, reprise après 2 s,
  immobile avec `prefers-reduced-motion`. « Annonces récentes · N à {ville} » : N = nombre exact
  quand tout le fil est chargé, sinon le `count` de la ville (même requête et même cache que le
  sélecteur de ville : 1 lecture d'agrégation).

## 9 bis. Lecture REST directe — essayée puis annulée (2 oct. 2026)

Accord du propriétaire (écart à « firestore/lite partout », § 3 de CLAUDE.md) pour les seules
**lectures publiques** du premier affichage, mêmes règles Firestore, repli automatique sur le
SDK, et à condition d'un gain net mesuré. Constat qui l'a motivé : le SDK ajoute ses propres
en-têtes, ce qui impose une pré-requête CORS (OPTIONS) avant chaque lecture.

- Essai : `fetch` REST (`:runQuery` en POST `text/plain`, GET pour une annonce), requête CORS
  « simple ». Prouvé sur `nioxxer-staging` : une seule requête par page, plus aucune pré-requête,
  toutes les formes de requête du fil acceptées ; JS initial de l'accueil 161 → 129 Ko.
- Mesure Lighthouse sur staging, 3 passages avant / après :
  `/` 82·82·84 (LCP 3,67–3,82 s) → 78·75·76 (4,74–4,97 s) ; `/recherche` 80·86·87 →
  79·80·80 ; `/annonce` 75·75·81 → 80·81·76. Le temps est dominé par la réponse du serveur
  Firestore lui-même (~2,5 s observées depuis le poste de mesure), pas par la pré-requête.
- **Gain non net → A annulé** (condition du propriétaire). Le code a été retiré ; la stack reste
  `firestore/lite` partout.
- **Gardé (option B)** : `src/lib/feed-cache.ts` — la dernière 1re page vue de chaque fil
  (ville + filtres, 4 fils au plus, 24 h) est réaffichée tout de suite au visiteur qui revient,
  puis remplacée par la réponse fraîche. Données publiques seulement (jamais de numéro), dans
  `localStorage` : une erreur de stockage = pas de cache.

## 10. Performance — mise en œuvre

- Coquille HTML de chaque page avec en-tête, barre du bas et squelettes en CSS pur : visible
  avant le JS.
- Polices Young Serif + Karla en woff2 auto-hébergées (télécharger depuis Google Fonts, licence
  OFL ; garder le fichier de licence), préchargement de la seule graisse utilisée au-dessus de la
  ligne de flottaison.
- Firebase Auth jamais chargé sur l'accueil tant qu'on n'en a pas besoin (bouton Compte,
  J'aime, Signaler).
- `firebase.json` : en-têtes de cache (§ 5 de CLAUDE.md), `cleanUrls`, réécritures
  `/ville/**` vers les pages générées, 404.
- Mesure : `npm run lighthouse` sur le build servi localement, seuils dans CLAUDE.md § 5,
  rapport enregistré dans `docs/lighthouse/`.

## 11. Ce qui vient de la v1 (et seulement ça)

| Élément | Fichier source v1 | Usage v2 |
|---|---|---|
| Logo | `img/logo.webp`, `img/logo.png`, `logo-removebg.png`, `favicon.svg`, `og-image.png` | Tel quel ; `logo-removebg.png` sert de source au filigrane Cloudinary |
| Villes | `js/config.js` (clés de `NIOXXER_QUARTIERS`) | `src/data/cities.ts` (+ slug, + GPS) |
| Normalisation WhatsApp | `js/config.js` `normaliserWhatsApp` | `src/lib/format.ts` (avec tests) |
| Seuil de majorité | `js/config.js` + `firestore.rules` (6 575 j) | Constante partagée |
| Traduction erreurs Auth, `safeNext`, jeton frais | `js/nioxxer-auth.js` | `src/lib/errors.ts`, `src/firebase/auth.ts` |
| Domaines jetables | `js/disposable-domains.js` | Chargé à la demande |
| Palette / polices | `css/tokens.css` | Point de départ de `tokens.css` (+ thème clair) |
| Projet Firebase | `.firebaserc` (`nioxxer-cda95`) | Même projet |
| Textes légaux | `cgu.html`, `confidentialite.html`, `mentions-legales.html`, `regles.html` | À **réécrire** pour la v2 (neutralité, nouvelles données, Cloudinary, GitHub) |

Tout le reste de la v1 est archivé, pas réutilisé.
