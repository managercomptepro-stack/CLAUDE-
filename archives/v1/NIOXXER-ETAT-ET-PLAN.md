# NIOXXER — État des lieux et plan de reprise

**Date :** 30 août 2026
**Objet :** ce que la page d'accueil a établi, ce qui doit être propagé, ce qui reste à trancher.

---

## 1. Où on en est

Neuf écrans ont été maquettés. Ils ne sont pas dans le même état.

| Écran | Fichier | État |
|---|---|---|
| Accueil | `nioxxer-accueil.html` | **Référence à jour** |
| Page d'annonce | `nioxxer-page-annonce.html` | Ancienne direction |
| Publier | `nioxxer-publier.html` | Ancienne direction |
| Créer un compte / Connexion | `nioxxer-compte.html` | Ancienne direction |
| Recherche et filtres | `nioxxer-recherche.html` | Ancienne direction |
| Mon compte / Mes annonces | `nioxxer-compte-annonces.html` | Ancienne direction |
| Crédits et boost | `nioxxer-credits-boost.html` | Ancienne direction |
| Back-office | `nioxxer-admin.html` | Ancienne direction |
| Explorations (couleurs, fonds, logo) | 8 fichiers | À archiver, ne servent plus |

**L'écart est total, pas cosmétique.** Vérifié dans le code :

- Accueil : fond `#100E14`, accent `#F0455F`, polices Young Serif + Karla
- Tous les autres : fond `#07272B`, accent `#5FD3C4`, polices Outfit + DM Sans

Ce sont deux produits différents à l'écran. Aucune page ne peut être montrée à côté d'une autre en l'état.

---

## 2. Les quinze décisions à propager

Établies sur l'accueil, absentes ailleurs.

### Identité visuelle

1. **Palette** — fond `#100E14`, encre `#F2EDF3`, accent `#F0455F`, safran `#F5C542`, secondaire `#A198A6`, ligne `rgba(242,237,243,.10)`
2. **Typographie** — Young Serif pour les titres et les noms, Karla pour tout le reste
3. **Rayons** — 16 px sur les cartes, 999 px sur les pilules
4. **Densité** — marges de section 16 à 18 px, écart de grille 8 px, vignettes 228 px

### Fond et mouvement

5. **Décor animé** — trois masses colorées floutées, 40 petits motifs, 30 étincelles lumineuses, le tout cantonné aux 54 % supérieurs et éteint en fondu avant le contenu
6. **Politique de mouvement** — classe `html.calm` liée à `prefers-reduced-motion`, plus le bandeau « Les activer ici » qui permet de reprendre la main
7. **Entrée en cascade** — `[data-rise]` avec délais échelonnés
8. **Révélation au défilement** — `IntersectionObserver` sur les cartes, par paires décalées
9. **En-tête condensé** au défilement
10. **Indicateur d'onglet glissant** dans la barre du bas

### Logique produit

11. **Premium** remplace Sponsorisé en tête de fil — 10 000 F/semaine ou surclassement admin. Bandeau de 20 emplacements, Premium d'abord, complété par les sponsorisées classiques si moins de 5 Premium
12. **Ordre du fil** — sponsorisées en tête par ordre d'arrivée, puis les gratuites
13. **Filtres déroulants** — Tout, Ville, Genre, Âge, Récent. Feuille par le bas, recherche intégrée quand la liste est longue
14. **27 villes** classées par population, avec rang affiché
15. **7 genres** — Femme, Homme, Gay, Lesbienne, Trans, Couples, Autres

### Contact et pied de page

16. **Contact = WhatsApp direct** — le bouton ouvre `wa.me/237678802447` avec un message pré-rempli
17. **Pied de page en une ligne** — le paragraphe légal redondant a été supprimé, il vit dans les CGU

---

## 3. Écarts page par page

### Page d'annonce
- Palette et polices à refaire
- Badge « Sponsorisé » → **Premium** avec liseré or
- Bouton Contacter → lien WhatsApp réel
- La mention « 3 personnes l'ont contactée cette semaine » est une donnée inventée : soit on la branche sur `contact_clicks`, soit on la retire
- Manque : le bloc de signalement doit ouvrir un vrai formulaire, aujourd'hui c'est un bouton mort

### Publier
- Palette et polices à refaire
- Le sélecteur de ville ne propose que 7 villes → 27, avec recherche
- Manque : le quota « 1/3 active » doit être branché sur le nombre réel d'annonces
- Manque : proposition d'achat Premium après publication

### Compte / Connexion
- Palette et polices à refaire
- Manque : le champ genre à l'inscription doit proposer les 7 options, pas 2
- Manque : la ville d'inscription doit utiliser la liste des 27

### Recherche
- Palette et polices à refaire
- Les chips « Je cherche » ne proposent que 3 options → 7 genres
- Ville : 7 → 27 avec recherche
- Les quartiers sont ceux de Douala uniquement, en dur. Il faut une table quartiers par ville
- Le compteur de résultats est une formule inventée : à brancher sur une vraie requête

### Mon compte / Mes annonces
- Palette et polices à refaire
- Manque : le palier **Premium 10 000 F/semaine** à côté des boosts 500 et 1 000 F
- Manque : l'état « Premium actif » sur une annonce, distinct de « Sponsorisée »
- Manque : que se passe-t-il à l'expiration d'un Premium — retour en fil normal, avec notification

### Crédits et boost
- Palette et polices à refaire
- Ajouter le palier de recharge **10 000 F** aux paliers existants
- Manque : l'onglet Premium avec sa durée hebdomadaire et son renouvellement
- L'affirmation « vue environ quatre fois plus » est inventée : à remplacer par une mesure réelle ou à retirer

### Back-office
- Palette et polices à refaire
- Manque : écran de gestion Premium — liste des Premium actifs, dates d'expiration, surclassement manuel par l'admin
- Manque : le surclassement admin doit écrire dans `audit_log`
- Manque : contrôle du remplissage du bandeau — voir combien de Premium et combien de sponsorisées le complètent

---

## 4. Ce qui n'existe nulle part

- **Pages légales** : CGU, confidentialité, mentions légales, règles de publication. Elles sont liées dans le pied de page et n'existent pas
- **Page « Se rencontrer en sécurité »**, liée aussi
- **Formulaire de signalement** complet, avec motifs qualifiés
- **Table des quartiers** pour les 26 villes autres que Douala
- **Page 404** et **état « aucun résultat »**
- **Écran d'expiration d'annonce** à 60 jours, avec proposition de republication

---

## 5. Règles Premium — arrêtées le 30 août 2026

| Point | Règle |
|---|---|
| Prix | **5 000 F par annonce et par semaine** |
| Portée | Par annonce, pas par compte |
| Cumul | Premium et boost **se cumulent**. Le Premium porte le bandeau du haut, le boost porte le rang dans le fil |
| Expiration | Arrêt sec à 7 jours. **Aucun renouvellement automatique**, rachat manuel |
| Surclassement admin | Gratuit, **illimité jusqu'à retrait manuel** |
| Crédits insuffisants | L'utilisateur est envoyé recharger, puis revient acheter |
| Plus de 20 Premium | **Rotation aléatoire** à chaque chargement de page |

### Ce que ces règles imposent au produit

**Une alerte avant expiration.** Le Premium s'arrêtant sans prévenir, il faut notifier l'utilisateur la veille — sinon il perd sa place sans comprendre et se plaint.

**Un contrôle des surclassements dormants.** Le back-office doit afficher la date de surclassement et l'ancienneté de chaque Premium offert. Sans ça, les emplacements se remplissent de vieux cadeaux oubliés et les Premium payants n'ont plus de place. Prévoir un tri par ancienneté et une alerte au-delà de 30 jours.

**Un retour au bon endroit après recharge.** L'écran de recharge doit afficher le montant manquant et ramener l'utilisateur sur l'annonce concernée, pas sur l'accueil. Sinon l'achat est perdu en route.

**Une rotation stable pendant la session.** Un tirage aléatoire à chaque chargement, c'est bien pour l'équité entre acheteurs, mais si le tirage change à chaque pagination l'utilisateur voit le bandeau sauter. Le tirage doit être fixé une fois par session, pas à chaque requête.

**Une preuve d'affichage pour l'acheteur.** Avec la rotation, un acheteur peut ouvrir le site et ne pas se voir. Il faut un compteur d'affichages dans « Mes annonces », sinon il croira avoir payé pour rien.

### Nouveaux paliers de recharge

Le palier 5 000 F couvre exactement une semaine de Premium. On ajoute un palier **10 000 F** pour deux semaines ou pour combiner Premium et boost.

Paliers : 1 000 · 2 000 · 5 000 · 10 000 F

### Impact sur le modèle de données

La table `boosts` ne suffit plus. Elle devient :

```sql
promotions
  id            bigserial PK
  listing_id    bigint FK
  user_id       bigint FK
  kind          varchar(10)   -- premium | boost
  source        varchar(10)   -- paid | admin
  cost          integer       -- 0 si admin
  granted_by    bigint NULL   -- admin auteur du surclassement
  starts_at     timestamptz
  ends_at       timestamptz NULL   -- NULL = illimité (surclassement admin)
  revoked_at    timestamptz NULL
  impressions   integer DEFAULT 0
  created_at
```

Index sur `(kind, starts_at, ends_at)` pour la sélection du bandeau.

---

## 5 bis. Le paiement — un seul modèle

**Rien n'est payant sauf la mise en avant.**

| Étape | Coût |
|---|---|
| Naviguer, consulter une annonce | Gratuit, sans compte |
| Contacter quelqu'un | Gratuit, sans compte |
| Créer un compte | Gratuit |
| Vérifier son numéro WhatsApp | Gratuit |
| Publier une annonce | **Gratuit** |
| Créditer son compte | **Optionnel** |

Le portefeuille de crédits ne sert qu'à une chose : accéder aux services de mise en avant. Un utilisateur qui ne veut pas payer utilise le site entièrement, sans jamais recharger.

### Services de mise en avant

| Produit | Prix | Effet |
|---|---|---|
| Boost 3 jours | 500 F | Remonte l'annonce dans le fil de sa ville |
| Boost 7 jours | 1 000 F | Idem, meilleur rapport |
| Premium 7 jours | 5 000 F | Place l'annonce dans le bandeau du haut |

Les deux se cumulent sur une même annonce.

### Paliers de recharge

**1 000 · 2 000 · 5 000 · 10 000 F**

Le palier 5 000 F couvre exactement une semaine de Premium. Le palier 10 000 F couvre deux semaines, ou un Premium plus des boosts.

### Ce que le back-office doit permettre

Les prix des boosts et du Premium doivent être paramétrables en base, sans redéploiement, et toute modification écrite dans `audit_log` — c'est de l'argent.

```sql
settings
  key           varchar(60) PK   -- boost_3d_price, boost_7d_price, premium_price, topup_tiers
  value         jsonb
  updated_by    bigint FK
  updated_at    timestamptz
```

---

## 6. Ordre de travail proposé

Le principe : ne plus produire d'exploration, ne plus revenir en arrière.

**Étape 1 — Figer les jetons de design.** Un seul fichier `tokens.css` avec la palette, les polices, les rayons et les durées d'animation. Toutes les pages l'importent. Plus jamais de couleur écrite en dur dans un écran.

**Étape 2 — Trancher les six trous logiques ci-dessus.** Une seule passe de questions, puis on n'y revient plus.

**Étape 3 — Reprendre les sept écrans** dans cet ordre : page d'annonce, publier, mon compte, crédits, recherche, connexion, back-office. La page d'annonce en premier, parce qu'elle est la deuxième page vue par un visiteur et la seule qui soit indexée par Google. Chaque écran repris rappelle que **seule la mise en avant est payante** : publier reste gratuit partout.

**Étape 4 — Produire les pages manquantes**, en commençant par les pages légales, qui bloquent l'ouverture.

**Étape 5 — Mettre à jour le dossier et `CLAUDE.md`** : Premium, table `promotions`, table `settings`, paliers de recharge, 27 villes, 7 genres, ordre du fil, lien WhatsApp. Le modèle de données actuel ignore le Premium.

---

## 7. Ce qu'il faut arrêter

Huit fichiers d'exploration encombrent le dossier : les trois directions couleur, les trois fonds, la version diagnostic, les deux maquettes intermédiaires. Ils ont servi, ils ne servent plus. Archive-les dans un sous-dossier `archives/` pour ne garder que les écrans du produit.
