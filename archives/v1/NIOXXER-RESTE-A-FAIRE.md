# NIOXXER — Ce qui reste à faire

> **Règle qui prime sur tout le reste :** naviguer, contacter, créer un compte, se vérifier et publier sont **gratuits**. Créditer son compte est **optionnel**, uniquement pour le boost et le Premium.

**Mis à jour le 30 août 2026.** Compagnon de `NIOXXER-ETAT-ET-PLAN.md`, qui contient l'analyse. Ici, uniquement les tâches.

---

## Décisions déjà arrêtées — ne plus y revenir

- Découverte par fil et filtres, pas de swipe
- Un profil, jusqu'à 3 annonces actives, expiration à 60 jours
- Pas de catégories d'annonces, les filtres portent la découverte
- Au moins une photo par annonce, floutage optionnel
- Profils publics, contact anonyme sans compte
- Contact par bouton WhatsApp, numéro masqué, clic journalisé
- Vérification du numéro par WhatsApp, validation manuelle en back-office
- Code à six chiffres pour se connecter, pas de mot de passe, pas d'e-mail
- 18 ans minimum
- Publication immédiate sauf minorité apparente et nudité explicite
- Site web mobile d'abord, pas d'application native
- Français et anglais
- 27 villes classées par population, 7 genres
- **Tout est gratuit sauf la mise en avant** : navigation, contact, création de compte, vérification, publication
- **Créditer son compte est optionnel** — uniquement pour accéder au boost et au Premium
- Mise en avant : boost 500 F / 3 j, 1 000 F / 7 j, Premium 5 000 F / 7 j
- Premium et boost se cumulent, Premium par annonce, arrêt sec à 7 jours
- Surclassement admin illimité jusqu'à retrait
- Rotation aléatoire si plus de 20 Premium
- Paliers de recharge : **1 000 · 2 000 · 5 000 · 10 000 F**

---

## Étape 1 — Jetons de design

- [x] Créer `tokens.css` : palette, polices, rayons, durées, échelle d'espacement
- [x] Y placer le décor animé (masses, motifs, étincelles) en composant réutilisable
- [x] Y placer la politique de mouvement : `html.calm`, `prefers-reduced-motion`, bandeau de reprise
- [x] Vérifier qu'aucune couleur ne reste écrite en dur dans un écran

**Référence :** `nioxxer-accueil.html`. Fond `#100E14`, encre `#F2EDF3`, accent `#F0455F`, safran `#F5C542`, secondaire `#A198A6`. Young Serif pour les titres, Karla pour le reste. Rayons 16 px et 999 px.

---

## Étape 2 — Reprise des écrans

Chaque écran repris doit intégrer : la palette, les polices, le décor animé, la politique de mouvement, la barre d'onglets avec indicateur glissant et l'en-tête condensé. **Publier reste gratuit partout** — aucun écran ne doit suggérer le contraire.

### 2.1 Page d'annonce — *à faire en premier, c'est la page indexée par Google*
- [x] Refonte palette et polices
- [x] Badge « Sponsorisé » → **Premium** avec liseré or ; badge boost distinct
- [x] Bouton Contacter → lien `wa.me` réel avec message pré-rempli
- [x] Retirer ou brancher « 3 personnes l'ont contactée cette semaine »
- [x] Formulaire de signalement réel, avec motifs qualifiés
- [x] Balises SEO : titre, description, données structurées

### 2.2 Publier
- [x] Refonte palette et polices
- [x] Le bouton reste **« Publier gratuitement »** — pas de débit, pas de solde à cette étape
- [x] Sélecteur de ville : 27 villes avec recherche
- [x] Quota « X/3 active » branché sur le nombre réel
- [x] Proposition Premium et boost après publication réussie

### 2.3 Mon compte et Mes annonces
- [x] Refonte palette et polices
- [x] Palier **Premium 5 000 F/semaine** à côté des boosts
- [x] État « Premium actif » distinct de « Boostée », avec jours restants
- [x] **Compteur d'affichages** par annonce Premium — preuve pour l'acheteur
- [x] Historique des crédits distinguant recharge, boost, premium, remboursements
- [x] Alerte la veille de l'expiration d'un Premium

### 2.4 Crédits
- [x] Refonte palette et polices
- [x] Palier de recharge **10 000 F** ajouté
- [x] Onglet Premium, durée hebdomadaire, pas de renouvellement automatique
- [x] Si crédits insuffisants : afficher le **montant manquant** et revenir sur l'annonce concernée après recharge
- [x] Retirer ou mesurer l'affirmation « vue quatre fois plus »

### 2.5 Recherche
- [x] Refonte palette et polices
- [x] Reprendre le motif de feuille déroulante de l'accueil
- [x] 7 genres, 27 villes avec recherche
- [x] **Table des quartiers par ville** — aujourd'hui seul Douala est renseigné, en dur
- [x] Compteur de résultats branché sur une vraie requête

### 2.6 Créer un compte et connexion
- [x] Refonte palette et polices
- [x] Champ genre : 7 options
- [x] Ville d'inscription : liste des 27

### 2.7 Back-office
- [x] Refonte palette et polices
- [x] **Écran de réglages tarifaires** : prix des boosts, prix du Premium, paliers de recharge — paramétrables sans redéploiement
- [x] **Gestion Premium** : liste des actifs, dates d'expiration, surclassement manuel
- [x] Ancienneté des surclassements admin, tri, alerte au-delà de 30 jours
- [x] Contrôle du remplissage du bandeau : combien de Premium, combien de sponsorisées en complément
- [x] Toute modification tarifaire écrite dans `audit_log`

---

## Étape 3 — Écrans qui n'existent pas

- [x] Conditions d'utilisation
- [x] Politique de confidentialité
- [x] Mentions légales
- [x] Règles de publication
- [x] Se rencontrer en sécurité
- [x] Formulaire de signalement complet
- [x] Page 404
- [x] État « aucun résultat » sur le fil et la recherche
- [x] Écran d'expiration d'annonce à 60 jours, avec republication

Les cinq premières sont liées depuis le pied de page et **bloquent l'ouverture du site**.

---

## Étape 4 — Modèle de données à compléter

- [x] Table `promotions` remplaçant `boosts` — champs `kind`, `source`, `ends_at` nullable, `impressions`, `granted_by`
- [x] Table `settings` — prix des mises en avant et paliers de recharge
- [x] `credit_ledger.reason` : `topup`, `boost`, `premium`, `refund_removed`, `admin_adjust`
- [x] Table `quartiers` alimentée pour les 27 villes
- [x] Champ `gender` acceptant les 7 valeurs

---

## Étape 5 — Documents à mettre à jour

- [x] `docs/DOSSIER-PROJET.md` : gratuité totale sauf mise en avant, Premium, nouvelles tables, 27 villes, 7 genres, ordre du fil
- [x] `CLAUDE.md` : mêmes points, plus les jetons de design comme règle non négociable

---

## Étape 6 — Ménage

- [x] Déplacer dans `archives/` les huit fichiers d'exploration : trois directions couleur, trois fonds, la version diagnostic, les deux maquettes intermédiaires
- [x] Ne garder à la racine que les écrans du produit

---

## Paiement — décision du 30 août 2026

**Aucun prestataire.** L'utilisateur verse sur les lignes NIOXXER (MTN et Orange), puis déclare sa
transaction : opérateur, numéro payeur, identifiant reçu par SMS. L'administrateur rapproche avec son
relevé et valide. La référence est unique en base. Les numéros d'encaissement sont paramétrables depuis
le back-office. Délai annoncé : quelques heures.

**Risque à traiter avec l'avocat et le comptable :** encaisser des revenus commerciaux sur une ligne
Mobile Money personnelle expose à un plafonnement ou à un blocage par l'opérateur.

## Fait le 30 août 2026

Les sept écrans du produit sont à la nouvelle direction, les cinq pages légales sont écrites,
les trois états manquants sont maquettés, les explorations sont archivées et `CLAUDE.md` est à jour.

**Tout le travail de conception est terminé.** Huit écrans, six pages statiques, les jetons de design,
le dossier de projet et `CLAUDE.md` sont à jour et cohérents entre eux.

**Reste à faire, et rien de tout cela ne dépend de la conception :**

| # | Tâche | Qui | Bloquant |
|---|---|---|---|
| 1 | Compléter les mentions légales : RCCM, capital, contribuable, hébergeur, directeur de publication | Toi | **Oui** |
| 2 | Faire valider les cinq pages légales par un avocat camerounais | Avocat | **Oui** |
| 3 | Déposer la demande d'autorisation auprès de l'autorité de protection des données | Toi + avocat | **Oui** |
| 4 | Réserver nioxxer.com | Toi | Oui |
| 5 | Mettre en service les deux lignes d'encaissement MTN et Orange | Toi | Oui |
| 6 | Mettre en service la ligne WhatsApp Business +237 678 802 447 | Toi | Oui |
| 7 | Faire relire les quartiers de 12 villes (voir liste ci-dessous) | Toi | Non |
| 8 | Trancher le logo | Toi | Non |
| 9 | Tester la Cloud API Meta sans RCCM | Toi | Non |
| 10 | Développer, avec Claude Code et les prompts A à K du dossier | Claude Code | — |

**Quartiers à faire relire** — sûrs : Douala, Yaoundé, Buea, Bamenda, Bafoussam, Limbé, Kumba.
À vérifier : Kribi, Tiko, Mbalmayo, Sangmélima, Bafang, Bafia, Meiganga, Guider, Mbouda, Kousséri,
Kumbo, Foumban.

---

## Encore ouvert

- **Le logo.** Trois propositions écartées. Trois pistes SVG et trois duos de couleurs sont disponibles dans `nioxxer-pistes-logo.html` et `nioxxer-duos-couleurs.html`.
- **Le nom de domaine.** À réserver, avec les variantes proches.
- **La vérification d'entreprise Meta.** À tester tôt : elle conditionne l'automatisation de la vérification WhatsApp.
- **Les chiffres inventés** dans les maquettes : à brancher sur de vraies données ou à retirer avant toute démonstration publique.
