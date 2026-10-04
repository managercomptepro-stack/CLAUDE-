# NIOXXER

Site de petites annonces de rencontre pour le Cameroun. Bilingue français/anglais, web mobile.

Un utilisateur crée un profil (numéro vérifié par WhatsApp, validation manuelle en back-office), publie jusqu'à 3 annonces actives avec photo, et les visiteurs le contactent via un bouton qui ouvre WhatsApp. Gratuit ; les revenus viennent du boost, qui remonte une annonce en tête du fil de sa ville.

Contexte complet : `NIOXXER-DOSSIER-PROJET.md` (rédigé avant la Note de transition : identifiant
téléphone et Premium à 10 000 F y sont périmés, le présent fichier fait foi). Ce fichier ne contient
que ce qu'il faut savoir pour écrire du code correct.

---

## Jetons de design — règle non négociable

Toutes les couleurs et polices viennent de `css/tokens.css` (variables `:root`).
**Aucune couleur ni police en dur dans un écran.** Si une valeur manque, on l'ajoute aux jetons.
Pour une teinte avec transparence : `rgba(var(--accent-rgb),.12)` (jetons `--*-rgb`).
Seules exceptions : `<meta name="theme-color">` (n'accepte pas de variable), les 4 couleurs du
logo Google (charte Google), `favicon.svg`, le blanc/noir purs des voiles et masques.

Trois feuilles, liées dans cet ordre avant le `<style>` propre à la page :
- `css/tokens.css` — variables + socle commun à toutes les pages + logo
- `css/app.css` — composants partagés des écrans (décor, en-tête, feuilles, onglets…)
- `css/legal.css` — pages légales (cgu, confidentialité, mentions, règles, sécurité)

Repères : fond `--bg:#100E14`, encre `--ink:#F2EDF3`, accent `--accent:#F0455F`, safran `--saffron:#F5C542`.
Titres en Young Serif (`--font-display`), interface en Karla (`--font-ui`). Rayons 16 px sur les cartes, 999 px sur les pilules.

Logo : `img/logo.webp` (+ `img/logo.png` en repli, via `<picture>`), hauteur réglée par
`--logo-h`, `--logo-h-condensed`, `--logo-h-foot`. Source haute définition : `logo-removebg.png` (non publiée).

Mouvement : `html.calm` coupe les animations quand l'appareil demande « réduire les animations ».
Le bandeau « Les activer ici » a été retiré à la demande du porteur (25 septembre 2026) : ne pas le remettre.

## Tests et mise en ligne

- `npm install` une fois, puis `npm test` : tests unitaires (`tests/config.test.mjs`), règles Firestore
  sur émulateurs (`tests/signup.test.mjs`, rules 4 et 5 + contenu des champs) et configuration
  d'hébergement (`tests/hosting.test.mjs` : fichiers publiés, liens, en-têtes).
- firebase-tools est épinglé en 13.x dans `package.json` : les versions 14+ exigent Java 21 pour
  les émulateurs, la machine de dev a Java 11.
- Mise en ligne : `npm run deploy` (lance les tests, puis publie le site, `firestore.rules` et
  `firestore.indexes.json`). En local : `npm run dev` (site + émulateurs sur http://localhost:5173 ;
  `js/firebase-config.js` bascule seul sur les émulateurs en local).
- JS et CSS sont servis en `no-cache` (revalidation) : les noms de fichiers ne sont pas versionnés,
  un cache long servirait un vieux `config.js` à une page récente.

## Stack

- **Laravel 11**, PHP 8.3
- **PostgreSQL 16** — recherche full-text (`tsvector` + index GIN)
- **Redis** — cache, compteurs, files de jobs
- **Filament v3** — back-office admin
- **Blade + Livewire + Tailwind** — front (pas de SPA, le SEO porte l'acquisition)
- **Cloudflare R2** — stockage images ; **Turnstile** — anti-robot
- Déploiement : VPS Ubuntu, Nginx

Dev local : Laragon en natif (pas de Docker — virtualisation désactivée sur la machine de dev).

## Note de transition — backend de lancement (provisoire)

**Décidé le 12 septembre 2026.** Le lancement utilise **Firebase Auth + Firestore**
(plan Spark, gratuit) à la place de Laravel/PostgreSQL, le temps que le site
génère des revenus. Raison : la vérification par SMS ou par API WhatsApp n'a
aucun palier gratuit chez Firebase (SMS exige le plan Blaze dès le premier
message), alors que l'authentification par e-mail est gratuite jusqu'à
50 000 utilisateurs actifs mensuels.

Ce que ça change, à garder en tête tant qu'on est sur ce backend :

- **L'identifiant de compte devient l'e-mail**, pas le téléphone (voir la
  modification de la rule 5 ci-dessous et de la liste « Ce qu'il ne faut pas
  faire »). Le numéro WhatsApp reste un champ de profil, saisi pour la
  confiance et pour le futur bouton de contact — ce n'est plus lui qui
  ancre l'identité du compte.
- **La contrainte d'âge (rule 4)** est portée par une règle de sécurité
  Firestore sur le champ `naissance` (`firestore.rules`), pas par un `CHECK`
  SQL — c'est l'équivalent le plus proche disponible sur ce backend.
- **Pas de recherche plein texte réelle** (pas de `tsvector`/GIN) et **pas de
  rate-limiting par IP natif** — les plafonds anti-abus du bouton de contact
  (§ Points de conception) restent à concevoir séparément avant d'implémenter
  ce bouton sur Firebase.
- **Les photos sont hors périmètre pour l'instant.** Depuis le 3 février
  2026, Cloud Storage exige un compte de facturation (plan Blaze) même pour
  un usage minime, et le palier gratuit de Storage ne couvre de toute façon
  que les régions `us-central1`, `us-west1` et `us-east1` — jamais la même
  région que Firestore (`europe-west1`, choisie pour la latence vers le
  Cameroun). L'upload de photo est donc désactivé dans l'interface
  (`publier.html` n'a pas de champ photo)
  jusqu'à ce que l'hébergement des images soit tranché séparément (Blaze
  avec bucket `us-central1` et alertes budget, ou service tiers gratuit).
- **La config web Firebase (apiKey, authDomain, projectId…) n'est pas un
  secret** — elle est publique par conception, la sécurité vient des règles
  Firestore, pas de la confidentialité de ces valeurs. Elle est donc commitée
  en clair dans `js/firebase-config.js`, sans variable d'environnement.
- L'expéditeur des e-mails de vérification est celui par défaut de Firebase
  (`noreply@<projet>.firebaseapp.com`) au lancement. Le passage à
  `noreply@nioxxer.com` se fait entièrement depuis la console
  (Authentication > Templates > customize domain) : aucun code ne doit
  dépendre du domaine d'expéditeur.

Retour à Laravel/PostgreSQL prévu une fois le site rentable — ne pas
construire d'abstraction supplémentaire pour retarder ce retour, juste
documenter les écarts au fur et à mesure.

### Périmètre en ligne (mis à jour le 26 septembre 2026)

Règle retenue : **on ne met en ligne que ce qui fonctionne vraiment.** Une
page qui affiche des données inventées ou dont le bouton principal ne fait
rien ne part pas en production.

En ligne — 13 pages, adresses propres : `/` (index.html), `/recherche`,
`/connexion`, `/verifier-email`, `/compte`, `/publier`, `/annonce?id=…`, les
cinq pages légales, 404. Les anciennes adresses (`nioxxer-*-v2`,
`verify-email`…) redirigent en 301 (`firebase.json` > redirects).

Annonces : collection Firestore `annonces`, identifiants `<uid>_1..3`
(plafond de 3), expiration = `createdAt` + 60 jours, sans photo. Toutes les
contraintes sont dans `firestore.rules` et testées (`tests/signup.test.mjs`).
Logique client : `js/annonces.js`. Le contact et le signalement passent par
WhatsApp vers le numéro NIOXXER (le numéro de l'annonceur n'est jamais exposé,
rule 7) ; il n'y a donc ni journal des clics ni dépublication automatique à
3 signalements : la modération se fait à la main depuis la console Firebase.

Hors ligne, maquettes dans `archives/maquettes/` : crédits, admin, états.
Elles exigent un backend qui n'existe pas (paiements, rôles admin).
Ne pas remettre en ligne une de ces pages sans les données réelles derrière.

## Conventions

- Dépôt `nioxxer`, base `nioxxer`, préfixe Redis `nioxxer:`
- Code, noms de classes, variables et commits **en anglais**
- Textes destinés aux utilisateurs **toujours** dans les fichiers de langue, jamais en dur
- Tests : Pest (backend Laravel) ; sur le backend de lancement Firebase : `npm test`. Toute règle
  listée sous « Règles non négociables » doit avoir un test.

---

## Règles non négociables

Ces règles portent des obligations légales ou de sécurité. Ne les contourne pas, ne les assouplis pas, ne les mets pas en commentaire « à réactiver plus tard ». Si une tâche semble les exiger, arrête-toi et signale-le.

### 1. Modération des images — trois sorties, jamais deux

Toute photo passe par le pipeline avant d'être visible. Trois issues :

| Détection | Action |
|---|---|
| **Minorité apparente** au-dessus du seuil | `rejected`. Jamais publiée, jamais mise en file. Notification à l'auteur + alerte admin. |
| **Nudité explicite** (organes génitaux, actes sexuels) | `held`. Non visible tant qu'un humain n'a pas tranché. |
| Tout le reste | `published` immédiatement |

« Tout le reste » inclut explicitement : maillot de bain, tenue moulante, pose suggestive, décolleté, torse nu, photo floue, vocabulaire limite. Ces cas ne sont **pas** mis en attente.

Le rejet sur minorité apparente est **automatique et non révisable dans le flux normal**. Il ne passe pas par la file de modération.

### 2. Un seul modèle de paiement

**Naviguer, contacter, créer un compte, se vérifier et publier sont gratuits.**
Créditer son compte est **optionnel**, uniquement pour la mise en avant.

| Produit | Prix | Effet |
|---|---|---|
| Premium 7 jours | 5 000 F | Bandeau du haut, par annonce |
| Boost 7 jours | 1 000 F | Rang dans le fil de la ville |
| Boost 3 jours | 500 F | Idem, formule d'essai |

Paliers de recharge : 1 000 · 2 000 · 5 000 · 10 000 F.

Règles Premium : **par annonce**, cumulable avec le boost, **arrêt sec à 7 jours sans renouvellement
automatique**, alerte la veille de l'expiration. Le surclassement admin est gratuit et **illimité jusqu'à
retrait manuel**. Si plus de 20 Premium, **rotation aléatoire fixée une fois par session**, pas par requête.
Un compteur d'affichages est visible dans « Mes annonces ».

Aucun écran ne doit suggérer que publier est payant.

### 3. Services sexuels tarifés interdits

Les annonces de services sexuels tarifés (ndolo payant, bizi, massage tarifé, escorte) sont interdites par les CGU. Le filtre textuel est **trilingue : français, anglais, pidgin camerounais**.

Un déclenchement textuel ne bloque pas seul la publication : il augmente le score et abaisse le seuil de mise en attente sur les images de la même annonce.

Motif : art. 294 du Code pénal camerounais — facilitation de la prostitution d'autrui ou partage de son produit, même occasionnel. NIOXXER perçoit de l'argent via le boost, donc les deux branches du texte s'appliquent.

### 4. Âge minimum 18 ans

Contrainte au niveau base sur `users.birthdate`. Pas seulement une validation de formulaire.

**Sur le backend de lancement (Firebase, voir Note de transition) :** contrainte portée par
`firestore.rules` sur le champ `naissance` — refusée à l'écriture, pas seulement au formulaire.

### 5. Vérification obligatoire pour toute fonctionnalité de compte

Un profil ne peut accéder à son profil, publier une annonce, ou gérer ses annonces que si son
e-mail est vérifié (`emailVerified` / `email_verified`). Naviguer et contacter restent libres et
anonymes, sans compte ; **les fonctionnalités liées à un compte ne le sont pas**. C'est le seul
ancrage d'identité du système.

Compromis assumé du 12 septembre 2026 (voir Note de transition) : un e-mail vérifié est moins
coûteux à contourner qu'un numéro WhatsApp vérifié — la modération y perd un levier contre les
comptes recréés après bannissement. Accepté pour tenir le budget de lancement à 0 €.

### 6. `credit_ledger` en ajout seul

Jamais d'`UPDATE`, jamais de `DELETE`. Bloque-les au niveau du modèle Eloquent. Le solde est `SUM(delta)`, caché dans Redis mais toujours recalculable depuis la table.

### 7. Le numéro WhatsApp n'apparaît jamais dans le HTML

Ni dans le rendu serveur, ni dans un attribut `data-`, ni dans une réponse JSON de listing. Il est assemblé côté serveur au moment du clic, après validation Turnstile et vérification des plafonds.

### 8. Paiement Mobile Money manuel

déclare sa transaction. L'administrateur rapproche et valide.

- `topups.reference` est **unique en base** : une référence ne sert qu'une fois
- Les numéros d'encaissement viennent de `settings`, jamais du code
- Le crédit du ledger n'a lieu qu'après validation humaine
- Chaque validation ou rejet est écrit dans `audit_log`

### 9. Journalisation

Toute décision de modération, tout bannissement, tout ajustement de crédit s'écrit dans `audit_log` avec agent, horodatage, motif, avant/après. C'est la preuve de diligence.

### 10. La vérification est derrière une interface

`VerificationChannel` avec `send(User): string` et `confirm(string $code, string $fromPhone): bool`.

Trois implémentations :
- `WhatsAppManualChannel` — **défaut**. Pas d'API. Génère un code, construit le lien `https://wa.me/237678802447?text=CODE`, et crée une entrée dans la file de vérification que l'admin valide dans Filament.
- `WhatsAppCloudChannel` — Cloud API de Meta, si elle devient accessible
- `SmsChannel` — repli agrégateur local

Le canal actif vient de la configuration. Ne couple jamais du code métier à WhatsApp directement.

**Numéro NIOXXER : +237 678 802 447**, à mettre en configuration, jamais en dur dans le code.

**Règle de sécurité de la validation manuelle :** l'écran Filament affiche côte à côte le **code attendu**, le **numéro déclaré dans le profil**, et l'horodatage. L'admin ne valide que si le numéro expéditeur du message WhatsApp correspond au numéro déclaré. Sans cette comparaison, la vérification ne vaut rien.

Code à usage unique, expiration 15 minutes, 5 tentatives maximum.

---

## Points de conception à respecter

**Classement du fil** — récence + bonus boost + activité récente + photo non floutée. Maximum **3 annonces boostées dans les 10 premiers résultats**, et le boost est cantonné à la ville de l'annonce.

**Élargissement automatique** — si la ville filtrée compte moins de 20 annonces actives, compléter avec les villes voisines et l'afficher explicitement à l'utilisateur.

**Boost** — 3 jours = 500 F, 7 jours = 1 000 F, prix paramétrables depuis Filament. Étiquette « Sponsorisé » obligatoire (loi 2010/021 : toute publicité en ligne doit être identifiable). Remboursement automatique en crédits si l'annonce est retirée pendant la période.

**Crédits** — paliers 1 000 / 2 000 / 5 000 / 10 000 F. Les mises en avant débitent le solde.
Publier ne débite jamais rien.

**Plafonds anti-abus** — bouton de contact : 10 clics/heure/IP, 30/jour/IP. Vérification : 5 tentatives, expiration 15 minutes, restriction au préfixe `+237`.

**Domaine** — nioxxer.com

**Annonces** — 3 actives maximum par profil, expiration à 60 jours, au moins une photo, floutage optionnel.

**Signalements** — 3 signalements d'IP distinctes → dépublication automatique en attente de revue.
Le formulaire propose 7 motifs qualifiés, dont « service tarifé » et « la personne semble mineure ».

**Villes** — 28 villes classées par population, avec recherche. Les quartiers sont propres à chaque ville :
ne jamais afficher les quartiers de Douala pour une autre ville.

**Genres** — 7 valeurs : Femme, Homme, Gay, Lesbienne, Trans, Couples, Autres. Partout : inscription,
profil, filtres.

**Contact** — le bouton ouvre `https://wa.me/237678802447` avec un message pré-rempli.

**Rétention** — compte inactif 24 mois, annonce expirée 90 jours, `contact_clicks` 12 mois, logs 12 mois, `audit_log` et `credit_ledger` 5 ans.

---

## Ce qu'il ne faut pas faire

- Ne pas ajouter de catégories d'annonces (décision produit : les filtres portent la découverte)
- Ne pas ajouter de messagerie interne (le contact passe par WhatsApp)
- Ne pas ajouter de swipe (phase 4 au plus tôt)
- L'e-mail est l'identifiant unique du compte et doit être vérifié avant toute fonctionnalité
  de compte (voir Note de transition et rule 5) ; le numéro WhatsApp est un champ de profil,
  pas un identifiant de connexion
- Ne pas exiger de compte pour naviguer ou contacter
- Ne pas utiliser `localStorage` pour des données métier
- Ne jamais afficher de chiffre inventé (nombre de contacts, multiplicateur de vues) : brancher sur une
  vraie donnée ou ne rien afficher

---

## Modèle de données — ajouts

```sql
promotions                      -- remplace boosts
  id, listing_id, user_id
  kind        varchar(10)       -- premium | boost
  source      varchar(10)       -- paid | admin
  cost        integer           -- 0 si admin
  granted_by  bigint NULL
  starts_at, ends_at NULL       -- NULL = illimité (admin)
  revoked_at NULL, impressions integer DEFAULT 0

settings                        -- prix et paliers, modifiables sans redéploiement
  key varchar(60) PK, value jsonb, updated_by bigint, updated_at
  -- toute modification écrite dans audit_log : c'est de l'argent

quartiers
  id, city_id FK, name, slug
```

`credit_ledger.reason` : `topup`, `boost`, `premium`, `refund_removed`, `admin_adjust`.

## Ordre de construction

1. Socle Laravel + i18n FR/EN + Filament
2. Schéma et modèles
3. Vérification WhatsApp (+ repli SMS)
4. Annonces, photos, pipeline de modération
5. Fil public, filtres, classement
6. Bouton de contact + Turnstile + journalisation
7. Signalements et back-office de modération
8. Crédits, Mobile Money, boost

Ne passe pas à l'étape suivante tant que la précédente n'a pas ses tests.
