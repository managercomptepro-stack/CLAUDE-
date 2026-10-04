# Ce que SEUL le propriétaire peut faire

Claude Code ne peut pas cliquer dans les consoles web. Coche chaque ligne quand c'est fait et
dis-le à Claude Code. Claude Code ajoute ici toute nouvelle tâche de ce type.

## Avant la fin de la phase 3 (premier lien de prévisualisation)
- [ ] Dans un terminal PowerShell, dans le dossier NIOXXER : `npx firebase login` (connexion au
      compte Google propriétaire du projet `nioxxer-cda95`). Sans cela, `npm run deploy:preview`
      est impossible.

## Avant la phase 3 (comptes)
- [ ] **Java 21** (gratuit : Eclipse Temurin 21, adoptium.net) — sinon on reste sur firebase-tools 13.
- [ ] Console Firebase › Authentication › Sign-in method : activer **E-mail/Mot de passe**,
      **Google**, **Anonyme**.
- [ ] Console Firebase › Authentication › Settings › Authorized domains : `nioxxer.com`,
      `www.nioxxer.com`, `localhost`.
- [ ] Console Google Cloud (projet nioxxer-cda95) › APIs & Services › Credentials › client OAuth
      « Web client (auto created by Google Service) » › Authorized redirect URIs : ajouter
      `https://nioxxer.com/__/auth/handler`. Authorized JavaScript origins : `https://nioxxer.com`.
- [ ] Écran de consentement OAuth : nom « NIOXXER », logo, e-mail d'assistance, lien
      confidentialité `https://nioxxer.com/confidentialite`.
- [ ] Authentication › Templates : modèles d'e-mail en français ; **Customize domain** →
      `nioxxer.com` ; ajouter chez IONOS les enregistrements DNS (TXT + CNAME) donnés par Firebase ;
      attendre la coche verte. (C'est ce qui fait arriver les e-mails en boîte de réception.)

## Avant la phase 4 (photos)
- [x] Compte **Cloudinary** créé (2 oct. 2026), cloud name `bcxiwwkh`.
- [x] Presets non signés `nioxxer_listing` (filigrane) et `nioxxer_avatar` (photo de profil).
      Vérifiés par Claude Code par un vrai envoi (voir ARCHITECTURE § 6).
- [x] Filigrane `nioxxer_watermark` envoyé.
- [x] Cloud name donné à Claude Code (dans `CLOUDINARY_CLOUD_NAME`, règles à jour).
- [ ] Facultatif : Media Library › supprimer les 2 images de test du 2 oct. 2026
      (`mpb0pn6ouv10s41qzqdk` dans `listings`, `j0jjvgfilrtqchvyoqes` dans `avatars`) — Claude
      Code ne peut pas supprimer sans le secret API (jamais dans le code). Le nettoyage
      automatique (phase 8) les retirera sinon.

## Avant le premier test sur un vrai projet (fin de phase 3)
- [x] **Fait le 2 oct. 2026** : projet `nioxxer-staging` créé (Firestore Standard europe-west1,
      mode production ; Auth e-mail/mot de passe + Google + anonyme ; Hosting ; Spark, sans
      carte ; `nioxxer-cda95` non touché). Énoncé d'origine : **Décider** (voir PROGRESS § Questions Q4) : un canal de prévisualisation Firebase utilise
      la MÊME base Firestore et les MÊMES comptes que la production. Déployer les règles v2 sur
      `nioxxer-cda95` casserait le site v1 encore en ligne. Proposition : créer un projet gratuit
      séparé `nioxxer-staging` (console Firebase › Ajouter un projet, plan Spark, sans carte),
      y activer Authentication (e-mail, Google, anonyme) et Firestore, puis donner son nom à
      Claude Code.
- [ ] Console Firebase **nioxxer-staging** › Firestore Database › Démarrer une collection
      `settings`, document `public`, avec exactement ces champs (type entre parenthèses ; les
      nombres sans décimale). Sans lui, les règles refusent toute inscription.
      - `prices` (map) : `premium` (number) 2000 · `sponsored` (number) 500
      - `boostDays` (number) 7
      - `payment` (map) : `mtn` (map) : `number` (string) vide · `name` (string) vide ;
        `orange` (map) : `number` (string) vide · `name` (string) vide
      - `maxActiveListings` (number) 7
      - `reportsHideThreshold` (number) 10
      - `supportWhatsApp` (string) `+237678802447`
      - `termsVersion` (string) `2026-10-1`

- [ ] Puis teste sur ton téléphone : https://nioxxer-staging--preview-5k9bgz5i.web.app/connexion
      (lien valable jusqu'au 9 oct. 2026) — inscription, e-mail de vérification, compte. Si
      « Continuer avec Google » répond « La connexion Google n'est pas encore activée », ajoute
      `nioxxer-staging--preview-5k9bgz5i.web.app` dans Authentication › Settings › Authorized
      domains de **nioxxer-staging**.
- [ ] Facultatif : supprimer les fichiers locaux `.env.development`, `.env.preview`,
      `.env.production` (plus lus ni suivis par git : la config web publique est dans
      `src/firebase/config.ts`).

## E-mails de vérification (signalé le 2 oct. 2026 : arrivé en spam, signé « project-32898601996 »)
À faire dans **nioxxer-staging** maintenant, puis à l'identique dans **nioxxer-cda95** avant la bascule.
- [ ] Console Firebase › ⚙ Paramètres du projet › onglet Général › **Nom public** (« Public-facing
      name ») : `NIOXXER`. C'est ce nom qui remplace « project-32898601996 » dans les e-mails
      (variable `%APP_NAME%` des modèles).
- [ ] Même page › **Adresse e-mail d'assistance** : ton adresse (obligatoire pour l'écran Google).
- [ ] Authentication › **Modèles** (Templates) › icône crayon « Langue du modèle » : **Français**.
- [ ] Authentication › Modèles › **Vérification de l'adresse e-mail** › crayon :
      Nom de l'expéditeur `NIOXXER` ; Objet `Confirmez votre adresse e-mail NIOXXER`. Même chose
      pour **Réinitialisation du mot de passe** (objet `Choisissez un nouveau mot de passe NIOXXER`).
- [ ] Le spam vient surtout de l'expéditeur `noreply@nioxxer-staging.firebaseapp.com` (domaine
      partagé, sans réputation). Correctif durable : Authentication › Modèles › **Personnaliser le
      domaine** → `nioxxer.com` + enregistrements DNS chez IONOS (déjà prévu plus haut pour la
      production). Pour staging, c'est facultatif : marque l'e-mail « Pas un spam » pendant les
      tests.

## Test manuel de la phase 4 (sur le lien de prévisualisation)
- [ ] Connecté sur https://nioxxer-staging--preview-5k9bgz5i.web.app : Publier › ajoute
      **2 vraies photos** › publie. Puis Mon compte › Mes annonces : la vignette s'affiche.
- [ ] Vérifie le filigrane sur l'URL brute : Cloudinary › Media Library › dossier `listings` ›
      ouvre la dernière image › copie son URL (sans paramètres) dans le navigateur : le logo
      NIOXXER doit être visible en bas à droite.
- [ ] Mon compte : ajoute une photo de profil, puis change-la, puis supprime-la.
- [ ] Modifie l'annonce (ordre des photos), republie-la, supprime-la.

## Phase 6 (booster) — pour tester sur la prévisualisation
- [ ] Sans numéro de paiement réglé, `/booster` affiche honnêtement « Le paiement n'est pas encore
      ouvert ». Pour essayer le parcours sur `nioxxer-staging` avant l'admin (phase 7) : console
      Firestore du projet **nioxxer-staging** › `settings/public` › `payment` › renseigner
      `mtn.number` (ex. `+2376XXXXXXXX`) et `mtn.name` (et/ou `orange`). Un vrai numéro à toi :
      il est affiché aux annonceurs.
- [ ] Tant que les logos officiels MTN MoMo / Orange Money ne sont pas dans `public/brands/`, la
      page affiche seulement les noms « MTN Mobile Money » et « Orange Money » (jamais de logo
      redessiné).

## Avant la phase 7 (admin)
- [ ] Après ta première inscription sur le site de prévisualisation : console Firestore › créer
      le document `admins/{ton uid}` avec `role: "super"` (Claude Code te donnera l'uid).
- [ ] Renseigner dans l'admin › Réglages tes numéros et noms **MTN MoMo** et **Orange Money**.
- [ ] Sur `nioxxer-staging`, ouvrir chaque onglet de `/admin` une fois (Paiements, Badges,
      Nettoyage › Analyser surtout) : l'émulateur n'exige aucun index, seul le vrai projet dit si
      une requête en manque (message « index » → le signaler à Claude Code avec le lien affiché
      dans la console du navigateur).
- [ ] Logos officiels : télécharger les kits de marque officiels de **MTN MoMo** et **Orange
      Money** (et vérifier leurs conditions d'usage), les déposer dans `public/brands/`.
      WhatsApp et Google : Claude Code utilise les ressources officielles publiées par ces marques.

## Avant la phase 8 (maintenance)
- [ ] Compte **GitHub** + dépôt privé `nioxxer` ; pousser le code.
- [ ] Console Firebase › Paramètres du projet › Comptes de service › générer une clé →
      la coller dans GitHub › Settings › Secrets › `FIREBASE_SERVICE_ACCOUNT`. **Ne jamais la
      mettre dans le dossier du projet.**
- [ ] Cloudinary › API Keys → secrets GitHub `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`,
      `CLOUDINARY_CLOUD_NAME`.
- [ ] Une fois les secrets en place : GitHub › Actions › « Maintenance » › **Run workflow** avec
      « Analyser seulement » coché (et « orphelins » coché) → lire la ligne `[maintenance] {…}` du
      journal (compteurs seulement) et l'envoyer à Claude Code avant le premier vrai passage.
      La tâche tourne ensuite seule chaque nuit à 03:00 (Douala) ; un échec t'est envoyé par e-mail.
      Le compte de service vise le projet de PRODUCTION (`nioxxer-cda95`) : à faire au moment de
      la bascule (phase 9), pas avant (la v1 y tourne encore).

## Avant la bascule en production (phase 9) — mentions légales
- [ ] Donner à Claude Code les informations de l'**éditeur** (loi 2010/021) : nom ou raison
      sociale, forme juridique, adresse, numéro RCCM, numéro de contribuable, directeur de la
      publication. Tant qu'elles manquent, la page affiche « À compléter » et `npm run deploy`
      refuse de publier (`scripts/check-legal.ts`). Claude Code ne les invente pas.
- [ ] **Loi n° 2024/017 (données personnelles, en vigueur depuis le 23 juin 2026)** : d'après la
      presse spécialisée, le transfert de données hors du Cameroun exige une autorisation
      préalable de l'Autorité de protection des données (APDP). Le site stocke ses données chez
      Google (Firebase) et Cloudinary, hors du Cameroun. À vérifier avec le juriste (déclaration,
      autorisation) avant l'ouverture.

## Filigrane centré à 42 % (retours de recette du 3 oct. 2026)
- [ ] Cloudinary › Settings › Upload › Upload presets › **nioxxer_listing** › Upload Manipulations ›
      **Incoming transformation** : remplacer tout le texte par exactement :
      `c_limit,w_1600,h_1600/l_nioxxer_watermark/c_scale,fl_relative,w_0.25/o_42/fl_layer_apply,g_center/q_auto:good`
      puis **Save**. À faire sur le compte Cloudinary utilisé par le site (le même pour le test et la
      production). Ne change que les **nouvelles** photos : celles déjà envoyées gardent leur filigrane
      en bas à droite. Vérification : publier une photo, ouvrir son URL brute (Media Library) → logo au
      centre, un peu plus visible.
- [ ] Après la mise en ligne des nouvelles CGU et de la politique de confidentialité (suppression
      de compte = demande, effacement sous 60 jours) : Admin › Réglages › **Version des conditions** →
      par exemple `2026-10-2`, pour que chaque membre les accepte à nouveau.

## Sécurité (audit du 3 oct. 2026) — réglages de console
- [x] **Firebase App Check** sur `nioxxer-staging` : clé reCAPTCHA Enterprise créée (3 oct.), branchée
      dans le site (4 oct.), en mode surveillance.
- [ ] **App Check — activer « Appliquer » sur Authentication seulement** (staging), pas sur Firestore.
      Le site démarre App Check avec la connexion et avec les clics qui ouvrent une session (WhatsApp,
      J'aime, Signaler) ; l'accueil, la recherche et les annonces ne le chargent pas (mesuré : reCAPTCHA
      fait tomber Lighthouse de ~90 à 46–66). « Appliquer » sur Firestore refuserait donc l'accueil.
      Quand : après **48 à 72 h** d'usage réel du lien de test (toi + quelques testeurs : connexions,
      inscriptions, J'aime, signalements, WhatsApp). Où : Console Firebase › App Check › onglet **API** ›
      **Authentication** › métriques sur 7 jours. Condition : « Requêtes vérifiées » ≈ 100 % et
      « non valides / obsolètes » ≈ 0 (hors tes propres tests sur localhost). Alors : **Appliquer**
      sur Authentication. Firestore : laisser en « Surveiller ».
- [ ] **App Check en production** (`nioxxer-cda95`) au moment de la bascule : mêmes étapes que pour
      staging (clé reCAPTCHA « site web » à score sur le projet nioxxer-cda95, App Check › app web ›
      reCAPTCHA Enterprise), me donner l'ID de la clé.
- [ ] **Clés API web** (Google Cloud › API et services › Identifiants), pour `nioxxer-cda95` ET
      `nioxxer-staging` : restriction **Référents HTTP** (`https://nioxxer.com/*`,
      `https://*.web.app/*`, `https://*.firebaseapp.com/*`) et **API** limitées à Identity Toolkit,
      Token Service, Cloud Firestore, Firebase Installations. (Ces clés sont publiques par conception :
      aucune n'est à régénérer, aucun secret n'est jamais passé dans l'historique git.)
- [ ] **Cloudinary** › Settings › Upload › presets `nioxxer_listing` et `nioxxer_avatar` : *Allowed
      formats* `jpg,png,webp,heic` ; *Max file size* 5 Mo ; *Unique filename* activé ; dossier fixe.
      Puis Settings › Security › **Strict transformations** : activé, en autorisant seulement les
      transformations utilisées par le site (`f_auto,q_auto,w_160`, `w_360`, `w_960`) — sinon un tiers
      peut épuiser les crédits gratuits en demandant des tailles inventées.
- [ ] **Compte de service de la maintenance** : en générer un dédié (pas celui « firebase-adminsdk »
      qui a tous les droits) avec seulement les rôles **Cloud Datastore User** et **Firebase
      Authentication Admin**, et mettre sa clé dans le secret GitHub `FIREBASE_SERVICE_ACCOUNT`.
- [ ] **Node 22 et Java 21** sur ce PC (puis me prévenir) : ils permettent de mettre à jour
      `firebase-tools`, `firebase-admin` et `lighthouse`, dont les vulnérabilités restantes de
      `npm audit` dépendent (outils de développement seulement, rien n'est envoyé aux téléphones).

## Décisions qui t'appartiennent
- [ ] Faire relire par un juriste camerounais les 4 pages légales v2 (`/cgu`, `/confidentialite`,
      `/mentions-legales`, `/regles`) — textes dans `src/i18n/legal-fr.ts`.
- [ ] Stratégie des premières annonces pour que l'accueil ne soit pas vide au lancement.
- [ ] Passage au plan Blaze (avec alerte de budget) quand l'admin › Santé approche des quotas.
