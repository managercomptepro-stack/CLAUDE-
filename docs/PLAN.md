# NIOXXER v2 — Plan de construction

Règle : une phase n'est terminée que lorsque **chaque** critère est prouvé (commande + résultat
dans `PROGRESS.md`) et que le travail est commité. Pas de saut de phase.

Chaque phase se termine par :
1. `npm test` vert (et `npm run test:e2e` à partir de la phase 3).
2. Captures Playwright 375×812 (sombre + clair) des écrans touchés dans `docs/captures/phase-N/`,
   regardées et commentées en une ligne chacune dans `PROGRESS.md`.
3. Commit. Mise à jour de `PROGRESS.md`.

---

## Phase 0 — Préparation (sans rien casser)

- Vérifier si le dossier est un dépôt git ; sinon `git init`, premier commit « snapshot v1 »
  de l'existant tel quel.
- Créer `archives/v1/` et y **déplacer** tout l'ancien site (HTML, css, js, img, tests, scripts,
  zips, md de la v1, `firestore.rules` v1…) **sauf** : `CLAUDE.md` (nouveau), `docs/`,
  `PROGRESS.md`, `.firebaserc`, `.git`, `node_modules` (à supprimer puis réinstaller).
  Copier (pas déplacer) les fichiers de logo dans `public/`.
- `.gitignore` : `node_modules`, `dist`, `*.log`, `.firebase/`, `test-results/`, `playwright-report/`,
  fichiers de clés (`*serviceAccount*.json`).
- Lister dans `PROGRESS.md` : version de Node (`node -v`), de Java (`java -version`), présence de
  Git. Si Java < 21 : utiliser `firebase-tools` **13.35.1** (dernière compatible Java 11, comme en
  v1) et ajouter « installer Java 21 » dans HUMAN-TODO ; ne pas bloquer.
- **Ne pas déployer.** Le site v1 reste en ligne jusqu'à la bascule (phase 9).

✅ Critères : `git log` montre le snapshot ; racine propre ; `archives/v1` complet (compare le
nombre de fichiers avant/après).

## Phase 1 — Socle technique

- Vite multi-pages + TypeScript strict + Preact, ESLint + Prettier, Vitest, Playwright
  (Chromium seulement, viewport mobile par défaut).
- Firebase : `src/firebase/app.ts`, bascule auto vers émulateurs en local, `authDomain`
  configurable (localhost en dev, `nioxxer.com` en prod).
- `firebase.json` (public = dist, cleanUrls, en-têtes, 404, émulateurs auth/firestore/hosting),
  scripts npm de CLAUDE.md § 8.
- `src/styles/tokens.css` (thèmes sombre + clair), `base.css`, polices auto-hébergées.
- `src/i18n/fr.ts`, `src/data/cities.ts` (28 villes, slugs, GPS), `genres.ts`, `moderation.ts`.
- Composants de structure : `Header`, `BottomNav` (Accueil · Recherche · + Publier · Compte),
  `ThemeToggle`, `Toast`, `Skeleton`, `EmptyState`. Toutes les pages existent en coquille.

✅ Critères : `npm run build` sans avertissement ; toutes les pages s'ouvrent en dev ; la barre du
bas est identique partout ; bascule de thème mémorisée ; tests unitaires de `cities`, `format`,
`moderation` verts.

## Phase 2 — Règles Firestore (avant toute interface de données)

- Écrire `firestore.rules` complet (ARCHITECTURE § 5) et `firestore.indexes.json`.
- Tests `tests/rules/` : pour chaque collection, cas autorisés ET refusés. Liste minimale :
  mineur refusé (17 ans et 364 jours) / majeur accepté ; date de naissance non modifiable ;
  pseudo unique ; annonce sans e-mail vérifié refusée ; id hors 1–7 refusé (et suit `maxActiveListings` si on le change) ; texte avec terme
  mineur / prix / numéro refusé ; auteur ne peut pas toucher `rank`, `boostUntil`, `views`,
  `verified` ; vues +1 seulement ; un seul like et un seul signalement par uid ; masquage à 10
  signalements ; banni ne publie plus ; modérateur ne peut pas valider un paiement ; super peut ;
  écriture admin sans `auditLog` refusée ; `auditLog` non modifiable ; `private/contact` en `get`
  oui, en `list` non ; réglages modifiables par super seulement ; boost expiré remis à 0 par
  n'importe qui (et seulement `rank`/`boostUntil`, seulement si expiré) ; auteur peut effacer
  une annonce `removed` mais pas la réactiver ; « Rétablir » (hidden → false) admin + audit.
- Prouver les points **[À PROUVER]** de requêtes (ARCHITECTURE § 9) sur l'émulateur.
- Test « source unique » : motifs de `moderation.ts` == motifs dans `firestore.rules`.

✅ Critères : `npm run test:rules` vert, nombre de tests ≥ 60, décisions [À PROUVER] notées.

## Phase 3 — Comptes

- `/connexion` (onglets Créer / Se connecter), `/verifier-email`, mot de passe oublié.
- Inscription e-mail : fiche complète de SPEC § 4, case CGU, pseudo unique (transaction
  `usernames`), refus des e-mails jetables, envoi de l'e-mail de vérification avec retour sur le
  site.
- Google : redirect sur mobile / popup sur desktop, fiche de profil obligatoire ensuite,
  détection navigateur intégré (tests unitaires sur des user-agents réels WhatsApp, Facebook,
  Instagram, Chrome Android, Safari iOS).
- Garde de pages (compte, publier, booster, admin) sans flash de contenu protégé.
- `/compte` : profil (modifier ville, WhatsApp, photo ; pseudo et naissance en lecture seule),
  déconnexion, suppression du compte (ré-authentification, suppression annonces + profil +
  pseudo + compte).
- E2E : inscription → lien de vérification récupéré via l'API de l'émulateur Auth
  (`/emulator/v1/projects/{projet}/oobCodes`) → compte accessible ; connexion ; mot de passe
  oublié ; suppression de compte.

✅ Critères : E2E vert ; capture de chaque écran ; aucun message d'erreur brut Firebase à l'écran.

## Phase 4 — Publier

- `PhotoUploader` : 1 à 5 photos, compression + suppression EXIF côté client, upload Cloudinary
  non signé avec progression, réordonner, supprimer, première photo = principale.
- `/publier` : création et modification, champs SPEC § 5, compteurs de caractères, validation
  identique aux règles (même module), messages clairs (« Les prix ne sont pas autorisés dans
  l'annonce : vous en parlerez sur WhatsApp »).
- « Mes annonces » dans `/compte` : liste, modifier, supprimer, republier, état (active,
  expire dans X jours, Premium jusqu'au…), plafond de 7 affiché.
- En E2E, l'appel réseau Cloudinary est **intercepté** (réponse simulée) : aucun envoi réel.
- Test manuel décrit pour le propriétaire dans HUMAN-TODO : publier une vraie annonce avec
  2 photos sur le canal de prévisualisation, vérifier le filigrane en ouvrant l'URL brute de
  la photo.

✅ Critères : E2E « publier, modifier, republier, supprimer » vert ; textes interdits refusés
côté client ET règles ; capture des étapes.

## Phase 5 — Fil, recherche, annonce, profil public

- Accueil : sélecteur de ville (recherche, mémorisation, « Autour de moi »), bandeau Premium
  défilant (pause au toucher, `prefers-reduced-motion` respecté), fil infini par 20
  (IntersectionObserver), squelettes, état vide honnête.
- `/recherche` : filtres profil (multi), ville, double curseur d'âge 18–70 accessible au doigt
  et au clavier ; résultats même tri.
- `/ville/{slug}` : pages générées au build (titre, description, canonical), même fil.
- `/annonce` : galerie (balayage horizontal), toutes les infos SPEC § 5, boutons WhatsApp
  (lecture de `private/contact` au clic, `https://wa.me/<numéro>?text=<message encodé>`),
  Appeler si autorisé, J'aime, Partager (Web Share API, repli copie), Signaler (7 motifs).
  Vue comptée une fois par jour.
- `/membre` : profil public + ses annonces.
- `npm run seed` : ~60 annonces de démo variées dans l'émulateur (refuse de tourner hors
  émulateur — vérifie `FIRESTORE_EMULATOR_HOST`).
- E2E : ordre Premium > Sponsorisé > gratuit ; pagination sans doublon ni trou ; filtres ;
  clic WhatsApp ouvre la bonne URL (interceptée) ; numéro absent du DOM avant le clic ; 10
  signalements masquent l'annonce ; like unique.
- Lighthouse sur accueil, recherche, annonce.

✅ Critères : E2E vert ; Lighthouse ≥ 85 (rapports dans `docs/lighthouse/`) ; JS initial accueil
≤ 120 Ko gzip (sortie de build citée) ; revue par sous-agent faite et corrigée.

## Phase 6 — Booster et paiement manuel

- `/booster?id=` : choix formule (prix lus dans `settings`), choix MTN/Orange (logos officiels),
  numéro + nom du bénéficiaire + montant exact, bouton copier le numéro, envoi de la capture
  (compression ≤ 300 Ko) + référence facultative, écran « En attente ».
- Empêcher une 2e demande en attente pour la même annonce.
- `NotificationBell` + liste dans `/compte`, rappels calculés (expiration annonce 7 j, boost J-1).

✅ Critères : E2E « demande de boost → visible en attente » vert ; capture de chaque étape.

## Phase 7 — Administration

- `/admin` (garde : `admins/{uid}`), navigation par onglets adaptée au mobile :
  **Signalements** (annonces masquées en tête avec bouton « Rétablir » audité, puis « semble
  mineure »), **Récentes**, **Paiements** (super),
  **Badges**, **Utilisateurs** (rechercher par pseudo, strikes, bannir/débannir — super),
  **Mises en avant** (accorder/retirer Premium/Sponsorisé/badge — super), **Réglages** (prix,
  numéros et noms MoMo/Orange, plafond — super), **Équipe** (ajouter/retirer modérateurs par
  e-mail ou uid — super), **Journal**, **Santé** (estimation lectures/écritures, nombre
  d'annonces, lien vers les consoles), **Nettoyage** (repli du cron).
- Validation de paiement : affiche capture, montant attendu, opérateur, référence, date ; boutons
  Valider (démarre 7 jours maintenant) / Rejeter (motif obligatoire) ; notification + audit dans
  le même lot.
- Suppression pour infraction : motif obligatoire, strike +1, bannissement de publication auto
  à 5, notification, audit.
- E2E : modérateur ne voit pas Paiements/Réglages ; parcours complet boost validé → annonce en
  tête + bandeau + notification reçue ; 5 suppressions → publication bloquée.

✅ Critères : E2E vert ; revue par sous-agent sur la sécurité (règles + admin) faite et corrigée.

## Phase 8 — Pages légales, aide, SEO, maintenance

- Réécrire `/cgu`, `/confidentialite`, `/mentions-legales`, `/regles`, `/aide` pour la v2
  (plateforme neutre, contenu sous la responsabilité de son auteur, interdiction des contenus
  illégaux dont art. 294 et tout ce qui concerne des mineurs, données collectées réelles,
  Cloudinary, Firebase, GitHub Actions, durée de conservation 6 mois, droits de l'utilisateur,
  contact). Les rendre lisibles sans JavaScript. Ajouter en tête : « Modèle à faire relire par
  un juriste » dans un commentaire HTML, pas à l'écran.
- `termsVersion` dans `settings` ; si la version change, demander une nouvelle acceptation à la
  connexion.
- Open Graph sur toutes les pages, `sitemap.xml` (accueil + 28 villes + pages légales),
  `robots.txt`, `noindex` sur pages privées.
- `scripts/maintenance.ts` + workflow GitHub + tests sur émulateur en `--dry-run`.

✅ Critères : validateur de liens interne vert (aucun lien mort) ; tests maintenance verts ;
aperçu OG vérifié avec un outil de prévisualisation sur le canal de preview.

## Phase 9 — Recette finale et bascule

- `npm run deploy:preview` → lien de prévisualisation.
- Écrire `docs/RECETTE.md` : liste de contrôle pas à pas pour le propriétaire sur SON téléphone
  (Android, Chrome ET lien ouvert depuis WhatsApp), une case par parcours de la SPEC.
- Corriger tout ce que le propriétaire remonte.
- Bascule en production **uniquement** sur demande explicite du propriétaire : `npm run deploy`,
  puis vérification en ligne (chargement, connexion Google sur nioxxer.com, e-mail reçu en
  boîte de réception, publication réelle).

✅ Critères : recette signée par le propriétaire dans la conversation.
