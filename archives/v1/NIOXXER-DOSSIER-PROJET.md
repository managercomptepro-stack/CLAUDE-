# NIOXXER — Dossier de projet

**Site de rencontre libre — Cameroun**

**Porteur :** Franck Kouonang Piekap
**Date :** 29 août 2026
**Statut :** spécification validée, maquettes livrées, prêt pour développement
**Domaine :** nioxxer.com
**Nom du projet :** NIOXXER
**Conventions de nommage :** dépôt `nioxxer`, base `nioxxer`, namespace `App\\Nioxxer`, préfixe Redis `nioxxer:`

---

## 1. Ce qu'est NIOXXER

NIOXXER est un site de **petites annonces de rencontre** pour le Cameroun, en français et en anglais, accessible depuis le navigateur mobile.

Une personne s'inscrit, crée un profil, publie une ou plusieurs annonces avec photo. Les visiteurs parcourent le fil, filtrent par ville, quartier, âge et genre, et contactent l'auteur d'une annonce via un bouton qui ouvre WhatsApp. Le service est gratuit ; les revenus viennent du **boost**, qui fait remonter une annonce en tête du fil de sa ville pendant quelques jours.

### Ce que NIOXXER n'est pas

Les annonces de services sexuels tarifés (ndolo payant, bizi, massage, escorte) sont **interdites**. Ce n'est pas une posture : l'article 294 du Code pénal punit de six mois à cinq ans de prison et jusqu'à 1 000 000 FCFA d'amende celui qui facilite la prostitution d'autrui **ou qui en partage le produit, même occasionnellement**. Un site qui perçoit de l'argent (boost) sur une annonce de service tarifé tombe dans les deux branches du texte.

En revanche, toutes les intentions de rencontre sont admises : relation sérieuse, amitié, sorties, relation décontractée. La ligne est le **service sexuel tarifé**, pas le type de relation.

---

## 2. Décisions produit verrouillées

| Sujet | Décision |
|---|---|
| Découverte | Fil d'annonces avec recherche et filtres. Pas de swipe au lancement |
| Structure | Un profil par personne, 3 annonces actives maximum, expiration à 60 jours |
| Catégories | Aucune. La découverte passe par les filtres |
| Photo | Au moins une par annonce, trois maximum. Floutage optionnel |
| Visibilité | Profils et annonces publics, consultables sans compte |
| Contact | Bouton « Contacter sur WhatsApp », numéro masqué, clic journalisé |
| Identification du visiteur | Aucune. On contacte sans compte |
| Identification du publieur | **Numéro WhatsApp vérifié** par validation manuelle |
| Identifiant de compte | Le numéro de téléphone. Pas d'e-mail |
| Connexion | Code à six chiffres |
| Âge minimum | 18 ans, déclaré à l'inscription, contrainte en base |
| Genres | 7 valeurs : Femme, Homme, Gay, Lesbienne, Trans, Couples, Autres |
| Villes | **28 villes** classées par population, avec recherche et quartiers propres |
| Modération | Publication immédiate, sauf minorité apparente (rejet) et nudité explicite (attente) |
| Publication | **Gratuite**, sans condition |
| Crédits | **Optionnels**, uniquement pour la mise en avant |
| Mise en avant | Premium 5 000 F / 7 j · Boost 1 000 F / 7 j · Boost 500 F / 3 j |
| Paliers de recharge | 1 000 · 2 000 · 5 000 · 10 000 F |
| Paiement | **Manuel** : versement MoMo ou OM sur les numéros NIOXXER, validation en back-office |
| Langues | Français et anglais |
| Ton | Vouvoiement partout |
| Plateforme | Site web mobile (PWA). Pas d'application native au départ |
| Porteur juridique | Nom propre (une société reste recommandée) |

---|---|
| Découverte | Fil de profils/annonces avec recherche et filtres. Pas de swipe au lancement. |
| Structure | Un profil par personne, pouvant publier plusieurs annonces (3 actives max) |
| Catégories | Aucune. Un seul type d'annonce, la découverte passe par les filtres |
| Photo | Au moins une photo obligatoire par annonce. Floutage optionnel |
| Visibilité | Profils et annonces publics, visibles sans compte (indexables Google) |
| Contact | Bouton « Contacter sur WhatsApp », numéro masqué, clic journalisé |
| Identification du contacteur | Aucune. Le visiteur contacte sans compte |
| Identification du publieur | **Numéro WhatsApp vérifié** (validation manuelle), obligatoire pour publier |
| Identifiant de compte | Le numéro de téléphone. Pas d'e-mail |
| Âge minimum | 18 ans, déclaré à l'inscription |
| Modération | Publication immédiate, sauf deux cas retenus par le filtre (voir §6) |
| Monétisation | Profil et annonces gratuits. Seul le boost est payant |
| Boost | 3 jours = 500 F, 7 jours = 1 000 F. Débité sur un portefeuille de crédits |
| Paiement | Recharge du portefeuille par Mobile Money (paliers 1 000 / 2 000 / 5 000 F) |
| Couverture | 7 principales villes, inscription ouverte partout |
| Langues | Français et anglais dès le lancement |
| Plateforme | Site web mobile (PWA). Pas d'application native au départ |
| Porteur juridique | Nom propre (une société reste recommandée, voir §9) |

---

## 3. Architecture technique

### Stack

| Couche | Choix | Motif |
|---|---|---|
| Backend | Laravel 11 (PHP 8.3) | Écosystème mature, hébergement local facile |
| Admin | **Filament v3** | Back-office complet en jours plutôt qu'en mois |
| Base | PostgreSQL 16 | Recherche full-text, index géo, JSON natif |
| Cache / files | Redis | Sessions, compteurs, files de jobs |
| Front | Blade + Livewire + Tailwind | Peu de code, excellent SEO, léger en données |
| Images | Cloudflare R2 | Pas de frais de sortie |
| CDN / WAF | Cloudflare (gratuit) | Cache, protection, Turnstile |
| Serveur | VPS Hetzner CX22 | ~2 900 FCFA/mois (ou 0 avec Oracle Always Free) |

### Environnement de développement

Sur ta machine (ThinkPad i7-7500U, 8 Go, virtualisation désactivée) : **Laragon en natif**, avec PHP, PostgreSQL et Redis installés directement. Pas de Docker Desktop — sans virtualisation activée dans le BIOS, il te coûterait plus de temps qu'il n'en ferait gagner. La conteneurisation viendra au moment du déploiement seulement.

### Principes structurants

1. **Le pipeline de modération est sur le chemin critique.** Aucune image n'est publiée sans être passée par le scan.
2. **Le portefeuille de crédits est un journal en ajout seul.** Jamais d'`UPDATE`, jamais de `DELETE`.
3. **Toute décision de modération est journalisée.** C'est la preuve de diligence.
4. **La vérification d'identité est derrière une interface abstraite.** Basculer de WhatsApp vers SMS doit être l'affaire d'une heure.

---

## 4. Modèle de données

```sql
-- ---------- Comptes ----------
users
  id               bigserial PK
  phone            varchar(20) UNIQUE NOT NULL   -- format E.164, +237...
  phone_verified_at timestamptz
  display_name     varchar(60) NOT NULL
  birthdate        date NOT NULL                 -- contrôle 18 ans
  gender           varchar(12) NOT NULL   -- femme|homme|gay|lesbienne|trans|couples|autres
  seeking          varchar(12) NOT NULL
  city_id          bigint FK -> cities
  quarter_id       bigint FK -> quarters NULL
  bio              text
  locale           varchar(5) DEFAULT 'fr'
  status           varchar(20) DEFAULT 'active'  -- active|suspended|banned
  banned_at        timestamptz
  ban_reason       text
  last_active_at   timestamptz
  created_at, updated_at

-- ---------- Vérification ----------
verifications
  id               bigserial PK
  user_id          bigint FK
  channel          varchar(20)      -- whatsapp|sms
  code             varchar(12)      -- code aléatoire attendu
  status           varchar(20)      -- pending|verified|expired
  attempts         smallint DEFAULT 0
  expires_at       timestamptz
  verified_at      timestamptz
  created_at

-- ---------- Géographie ----------
cities            id, name_fr, name_en, slug, region, is_featured
quarters          id, city_id FK, name, slug

-- ---------- Annonces ----------
listings
  id               bigserial PK
  user_id          bigint FK
  title            varchar(120) NOT NULL
  body             text NOT NULL
  city_id          bigint FK
  quarter_id       bigint FK NULL
  status           varchar(20)   -- draft|published|held|rejected|expired|removed
  published_at     timestamptz
  expires_at       timestamptz   -- publication + 60 jours
  boost_until      timestamptz NULL
  boost_rank       smallint DEFAULT 0
  view_count       integer DEFAULT 0
  contact_count    integer DEFAULT 0
  search_vector    tsvector      -- index GIN
  created_at, updated_at

listing_photos
  id, listing_id FK, path, is_primary boolean, is_blurred boolean,
  scan_status varchar(20),      -- pending|clean|held|rejected
  scan_scores  jsonb,           -- {nudity: .., minor: ..}
  scanned_at

-- ---------- Modération ----------
moderation_jobs
  id, listing_id FK, photo_id FK NULL,
  trigger varchar(30),          -- explicit_nudity|apparent_minor|report
  scores jsonb,
  verdict varchar(20),          -- pending|approved|rejected
  reviewer_id bigint NULL,
  reason text,
  decided_at, created_at

reports
  id, listing_id FK, reporter_ip inet, reporter_user_id bigint NULL,
  motive varchar(40),           -- paid_service|minor|nudity|scam|fake|other
  body text,
  status varchar(20),           -- open|actioned|dismissed
  created_at

audit_log
  id, actor_id bigint NULL, action varchar(60),
  subject_type varchar(40), subject_id bigint,
  before jsonb, after jsonb, ip inet, created_at

-- ---------- Contact (visiteur anonyme) ----------
contact_clicks
  id, listing_id FK,
  ip inet, user_agent text, turnstile_ok boolean,
  created_at
  -- index sur (listing_id, created_at) et (ip, created_at)

-- ---------- Monnaie ----------
credit_ledger                   -- APPEND ONLY
  id, user_id FK, delta integer, balance_after integer,
  reason           varchar(40)   -- topup|boost|premium|refund_removed|admin_adjust
  ref_type varchar(30), ref_id bigint,
  created_at


promotions                      -- remplace boosts
  id            bigserial PK
  listing_id    bigint FK
  user_id       bigint FK
  kind          varchar(10)   -- premium | boost
  source        varchar(10)   -- paid | admin
  cost          integer       -- 0 si surclassement admin
  granted_by    bigint NULL   -- admin auteur du surclassement
  starts_at     timestamptz
  ends_at       timestamptz NULL  -- NULL = illimité (admin)
  revoked_at    timestamptz NULL
  impressions   integer DEFAULT 0
  created_at
  -- index sur (kind, starts_at, ends_at)

topups                          -- déclarations de paiement Mobile Money
  id            bigserial PK
  user_id       bigint FK
  amount        integer
  operator      varchar(10)   -- mtn | orange
  payer_msisdn  varchar(20)
  reference     varchar(60) UNIQUE NOT NULL
  status        varchar(20)   -- pending | credited | rejected
  reviewed_by   bigint NULL
  reviewed_at   timestamptz NULL
  reject_reason varchar(60) NULL
  created_at

settings                        -- prix et paliers, sans redéploiement
  key           varchar(60) PK  -- premium_price, boost_7d_price, topup_tiers,
                                -- collect_msisdn_mtn, collect_msisdn_orange
  value         jsonb
  updated_by    bigint FK
  updated_at    timestamptz
  -- toute modification écrite dans audit_log : c'est de l'argent

quartiers
  id, city_id FK, name, slug
```

**Contraintes non négociables :**

- `credit_ledger` : le solde est `SUM(delta)`, mis en cache dans Redis mais toujours recalculable.
- `users.birthdate` : contrainte de vérification `age >= 18` au niveau base.

---

## 5. Vérification WhatsApp (gratuite, validation manuelle)

**Numéro NIOXXER : +237 678 802 447** (MTN, ligne dédiée)

### Principe

Pas d'API, pas de vérification d'entreprise Meta, pas de RCCM. L'application **WhatsApp Business** classique tourne sur un téléphone dédié. C'est l'utilisateur qui écrit ; recevoir est gratuit.

### Flux

1. L'utilisateur remplit son profil et déclare son numéro WhatsApp
2. Au clic sur « Vérifier », le système génère un code court (ex. `NX-4837`), valable 15 minutes
3. Un lien s'ouvre : `https://wa.me/237678802447?text=NX-4837`, message prérempli
4. Il appuie sur envoyer
5. Le message arrive sur le téléphone NIOXXER
6. Dans Filament, l'écran « Vérifications en attente » affiche : code attendu, numéro déclaré, horodatage
7. L'admin compare avec le message reçu et valide

### Règle de sécurité

**Le numéro expéditeur du message WhatsApp doit être identique au numéro déclaré dans le profil.** C'est tout l'objet de la vérification. Si les deux diffèrent, rejet. L'écran d'administration affiche les deux côte à côte pour rendre l'erreur impossible.

### Charge

Cinq minutes par jour à 30 profils. À combiner avec la passe quotidienne de modération : même moment, même écran.

### Précautions

- Ligne **dédiée**, jamais utilisée à titre personnel — le numéro sera public sur le site et recevra du spam
- Téléphone allumé et connecté en permanence
- Message d'absence configuré dans WhatsApp Business : « Code bien reçu. Votre profil sera activé sous quelques heures. »
- Code à usage unique, expiration 15 minutes, 5 tentatives maximum

### Évolution

Quand le volume dépasse ~50 vérifications par jour, deux sorties :

1. **Cloud API de Meta** — à tester même sans RCCM : les plafonds portent sur les messages émis, or NIOXXER ne fait que recevoir. Gratuit à essayer, une heure de travail.
2. **Création d'une entreprise** (RCCM) puis vérification Meta, ce qui débloque l'automatisation complète.

### Repli

L'interface `VerificationChannel` expose `send(User): string` et `confirm(string $code, string $fromPhone): bool`. Trois implémentations prévues : `WhatsAppManualChannel` (défaut), `WhatsAppCloudChannel`, `SmsChannel` (agrégateur local — MTarget publie une grille à partir de 8 FCFA HT/SMS ; Nexah et Obit SMS sont comparables). Le canal actif vient de la configuration.

---

## 6. Pipeline de modération

### Seuils retenus

Le filtre tourne en moins d'une seconde, invisible pour l'utilisateur. Trois sorties :

| Sortie | Action |
|---|---|
| **Minorité apparente** détectée au-dessus du seuil | Rejet automatique. Jamais en ligne, jamais en file. Notification à l'auteur. Alerte admin. |
| **Nudité explicite** (organes génitaux, actes sexuels) | Mise en attente (`held`). Non visible. Tu tranches. |
| **Tout le reste** | En ligne immédiatement |

« Tout le reste » couvre explicitement : maillot de bain, tenue moulante, pose suggestive, décolleté, torse nu, photo floue, vocabulaire limite. Rien de cela ne t'est soumis.

**Volume attendu :** 1 à 2 % des annonces. Sur 50 publications/jour, une ou deux à regarder. Traitable depuis le téléphone en trente secondes.

### Implémentation en deux étages

1. **Étage local (gratuit).** Un modèle open source de détection NSFW tourne sur le VPS en CPU. Suffisant pour ton volume. Il élimine 90 % des cas d'emblée.
2. **Étage API (payant, marginal).** Seules les images dont le score tombe dans la zone incertaine partent vers une API externe (Sightengine ou AWS Rekognition), qui apporte la détection de minorité apparente, plus fiable. Coût divisé par dix.

### Filtre textuel

Lexique pondéré **trilingue — français, anglais, pidgin camerounais** : *ndolo* (contexte tarifé), *bizi*, *nuitée*, *tarif*, *combien*, *massage*, *sans tabou*, *disponible 24h*, et leurs variantes. Détection des numéros de téléphone et pseudos WhatsApp dans le corps du texte.

Un déclenchement textuel ne bloque pas seul la publication : il augmente le score et abaisse le seuil de mise en attente sur les images de la même annonce.

### Retrait a posteriori

- Bouton de signalement sur chaque annonce, motifs qualifiés
- **Trois signalements distincts** (IP différentes) → dépublication automatique en attente de revue
- Toute décision écrite dans `audit_log` : agent, horodatage, motif

### Rythme

**10 minutes par jour**, une passe. Au-delà de 50 annonces/jour, prévoir un modérateur à temps partiel (60–100 000 FCFA/mois).

---

## 7. Découverte, filtres et classement

### Filtres (l'interface principale)

Ville → quartier → tranche d'âge → genre → genre recherché → avec photo non floutée → actif récemment.

Sans catégories, ce sont les filtres qui portent toute la navigation. Ils doivent être en haut, visibles, et mémorisés entre les sessions.

### Classement du fil

```
score = récence_publication
      + (boost_actif ? bonus_boost : 0)
      + bonus_activité_récente
      + bonus_photo_non_floutée
```

**Deux garde-fous :**

- Maximum **3 annonces boostées** parmi les 10 premiers résultats. Sinon la tête du fil devient entièrement payante et les utilisateurs gratuits partent.
- Le boost est **cantonné à la ville** de l'annonce.

### Élargissement automatique

Si la ville sélectionnée compte moins de 20 annonces actives, le fil complète avec les villes voisines, avec une mention explicite (« Peu d'annonces à Ngaoundéré — voici aussi Garoua »). Sans cela, un utilisateur d'une petite ville voit trois annonces et ne revient jamais.

---

## 8. Contact, crédits et paiement

### Bouton de contact

Le numéro **n'est jamais dans le HTML**. Au clic :

1. Cloudflare Turnstile valide que ce n'est pas un robot
2. Plafonds vérifiés : 10 clics/heure/IP, 30/jour/IP
3. Ligne écrite dans `contact_clicks` : annonce, IP, user-agent, horodatage
4. Le serveur renvoie l'URL `wa.me` assemblée, avec un message pré-rempli

Sans cette protection, la base de numéros est aspirée en quelques jours.

### Un seul modèle de paiement

**Naviguer, contacter, créer un compte, se vérifier et publier sont gratuits.** Créditer son compte est optionnel.

| Produit | Durée | Prix | Effet |
|---|---|---|---|
| **Premium** | 7 jours | 5 000 F | Bandeau du haut, badge doré |
| **Boost** | 7 jours | 1 000 F | Rang dans le fil de la ville |
| **Boost** | 3 jours | 500 F | Idem, formule d'essai |

Premium et boost **se cumulent** sur une même annonce. Le Premium est **par annonce**, s'arrête sec à 7 jours **sans renouvellement automatique**, et l'utilisateur est averti la veille.

Paliers de recharge : **1 000 · 2 000 · 5 000 · 10 000 F**. Le palier 5 000 F couvre exactement une semaine de Premium.

### Paiement Mobile Money manuel

NIOXXER n'utilise **pas de prestataire de paiement**. L'utilisateur verse directement sur les lignes NIOXXER, puis déclare sa transaction.

1. Il choisit un palier
2. L'écran affiche les deux numéros d'encaissement (MTN et Orange) avec un bouton Copier, et rappelle d'envoyer **le montant exact**
3. Il paie depuis son téléphone
4. Il saisit **l'opérateur, son numéro payeur et l'identifiant de transaction** reçu par SMS
5. Une entrée passe en file `topups` avec le statut `pending`
6. L'administrateur rapproche la déclaration de son relevé, puis **valide** — le ledger est crédité — ou **rejette** avec un motif
7. La décision est écrite dans `audit_log`

**Contraintes.** La référence de transaction est **unique en base** : elle ne peut servir deux fois. Les numéros d'encaissement sont paramétrables depuis le back-office. L'écran annonce clairement un délai de quelques heures.

**Risque à connaître.** Encaisser des revenus commerciaux sur une ligne Mobile Money personnelle expose à un plafonnement ou à un blocage par l'opérateur. Point à traiter avec l'avocat et le comptable.

### Remboursement

Si une annonce mise en avant est retirée pour un motif indépendant de l'auteur, la période restante est recréditée (`refund_removed`). Aucun remboursement lorsque le retrait sanctionne une infraction.

## 9. Conformité juridique

### Textes applicables

| Texte | Ce qu'il impose |
|---|---|
| **Loi 2024/017** (données personnelles) | Autorisation préalable de l'autorité avant tout traitement, sous peine de 5 à 50 millions FCFA. Registre des traitements. Consentement exprès. Consentement parental pour les moins de 18 ans. |
| **Loi 2010/021** (commerce électronique) | Accès permanent aux mentions : nom, adresse, e-mail, téléphone, RCCM, capital, numéro de contribuable. Toute publicité clairement identifiée comme telle → l'étiquette « Sponsorisé » sur les boosts. |
| **Loi 2010/012** (cybercriminalité) | Art. 76 : 5 à 10 ans de prison pour diffusion de contenu pornographique impliquant un enfant. Art. 74 : 1 à 2 ans pour atteinte à l'intimité de la vie privée (photos publiées sans consentement). |
| **Code pénal, art. 294** | Proxénétisme : facilitation ou partage du produit, même occasionnel. |

### Livrables à faire produire par l'avocat (budget 300 000 – 800 000 FCFA)

1. Demande d'autorisation préalable auprès de l'autorité de protection des données
2. Registre des traitements : finalités, catégories, destinataires, durées, mesures de sécurité
3. CGU, avec **interdiction explicite des annonces de services sexuels tarifés** et clause de coopération avec les autorités
4. Politique de confidentialité et durées de conservation
5. Mentions légales conformes à la loi 2010/021
6. **Procédure écrite de signalement d'incident**

### Durées de conservation à inscrire

| Donnée | Durée |
|---|---|
| Compte inactif | Suppression à 24 mois |
| Annonce expirée | Suppression à 90 jours |
| `contact_clicks` | 12 mois |
| Logs de connexion | 12 mois |
| `audit_log` et `credit_ledger` | 5 ans (preuve) |

Délai de réponse à une demande d'effacement : **30 jours**, avec journal des demandes.

### Procédure d'incident (le document qui te protège)

Quand un utilisateur signale un guet-apens, une agression ou une tentative d'extorsion :

1. Gel immédiat du compte mis en cause
2. Conservation des données associées : annonce, photos, `contact_clicks`, IP, horodatages
3. Accusé de réception à la victime **sous 24 h**
4. Transmission à la police judiciaire
5. Écriture dans `audit_log`

C'est ce document, plus le journal, qui te distingue d'un complice le jour où l'incident se produit.

### Point ouvert : le porteur


---

## 10. Phasage

### Phase 1 — Socle (5 à 7 semaines)

Authentification par téléphone, vérification WhatsApp, profils, annonces avec photos, scan d'images, fil avec filtres, villes et quartiers, bouton de contact avec Turnstile et journalisation, signalements, back-office Filament, bilingue FR/EN.

**Tout est gratuit.** Objectif : valider que le pipeline de modération tient et que les gens publient.

### Phase 2 — Monétisation (2 à 3 semaines)


### Phase 3 — Croissance (3 à 4 semaines)

Optimisation SEO des pages d'annonces, PWA installable, notifications web, tableau de bord de statistiques, élargissement automatique du rayon.

### Phase 4 — Extension

Application Android, mode swipe en découverte secondaire, champ « intention » si les signalements pour malentendu montent.

---

## 11. Budget prévisionnel

### Mise en route

| Poste | Montant |
|---|---|
| Avocat (conformité, CGU, autorisation) | 300 000 – 800 000 FCFA |
| Nom de domaine | 10 000 – 20 000 FCFA/an |
| Ligne dédiée +237 678 802 447 | Coût d'une puce |
| Développement | Ton temps |

### Mensuel au démarrage

| Poste | Montant |
|---|---|
| VPS Hetzner CX22 (2 vCPU, 4 Go) | ~2 900 FCFA — ou **0** avec Oracle Cloud Always Free |
| Cloudflare (CDN + WAF + Turnstile) | **0 FCFA** |
| Cloudflare R2 (10 Go inclus, pas de frais de sortie) | **0 FCFA** au démarrage |
| Vérification WhatsApp | **0 FCFA** |
| Scan d'images (étage API seul) | 0 – 5 000 FCFA selon le volume |
| Domaine (lissé sur l'année) | ~800 FCFA |
| **Total** | **~4 000 – 9 000 FCFA** |

**Économies possibles au démarrage :** supprimer Redis (Laravel sait utiliser la base pour le cache et les files) et héberger PostgreSQL sur le même serveur, sans base managée. Aucun impact fonctionnel à cette échelle.

**Oracle Cloud Always Free** offre jusqu'à 4 cœurs ARM et 24 Go de RAM gratuits à vie. Deux réserves : carte bancaire exigée pour la vérification du compte, et capacité ARM souvent indisponible à l'inscription. À tenter en premier — si ça passe, le serveur coûte zéro.

À écarter : les offres gratuites de Render et Railway mettent le service en veille après inactivité, ce qui est éliminatoire pour un site public vivant du référencement.

### Seuil de rentabilité

À 1 000 FCFA le boost de 7 jours, il faut **moins de 10 boosts par mois** pour couvrir l'exploitation. Sur une base de 2 000 profils actifs avec 5 % de boosteurs hebdomadaires, tu es autour de 100 000 FCFA mensuels. C'est un modèle de volume : il ne devient intéressant qu'avec une masse locale réelle, d'où l'intérêt de concentrer la communication sur Douala et Yaoundé même si l'inscription est ouverte partout.

---

## 12. Risques et parades

| Risque | Gravité | Parade |
|---|---|---|
| Annonces de services tarifés | **Critique** | Interdiction CGU, lexique trilingue, signalement, journal de diligence |
| Mineurs sur la plateforme | **Critique** | 18 ans déclaré, vérification WhatsApp, rejet automatique sur minorité apparente |
| Faux profils en masse | Élevé | Un compte par numéro vérifié, plafonds, Turnstile |
| Aspiration des numéros | Élevé | Numéro absent du HTML, Turnstile, plafonds par IP |
| Fuite de crédit SMS par robots | Moyen | Restriction au préfixe +237, plafonds de renvoi |
| Téléphone de vérification éteint ou hors réseau | Moyen | Alerte si aucune vérification traitée en 12 h ; repli SMS configurable |
| Fil vide dans les petites villes | Moyen | Élargissement automatique du rayon |
| Départ des femmes | **Élevé** | Floutage optionnel, signalement en un geste, modération visible |
| Litige de paiement | Moyen | Ledger en ajout seul, référence unique, journal des validations |

Le dernier risque de la liste mérite une note. Sur ce marché, la confiance est le point faible de tous les acteurs : les avis publics des applications concurrentes décrivent des forfaits payés sans service rendu et un support injoignable. C'est simultanément ta plus grande menace et ta meilleure porte d'entrée.

---

## 13. Prompts Claude Code

Les maquettes HTML livrées sont la référence visuelle et fonctionnelle. Chaque prompt doit commencer par
« Lis CLAUDE.md et docs/DOSSIER-PROJET.md ».

### A — Initialisation
> Initialise un projet Laravel 11 avec PostgreSQL, Redis, Filament v3, Livewire et Tailwind.
> Configure l'internationalisation français/anglais avec préfixes d'URL /fr/ et /en/ et balises hreflang.
> Importe `public/css/tokens.css` fourni : toutes les valeurs de couleur, police, rayon et durée viennent
> de ce fichier, aucune valeur en dur.

### B — Modèle de données
> Crée les migrations, modèles et factories pour le schéma de la section 4 : users, verifications, cities,
> quartiers, listings, listing_photos, moderation_jobs, reports, audit_log, contact_clicks, credit_ledger,
> promotions, topups, settings. Respecte : credit_ledger en ajout seul, topups.reference unique,
> contrainte base age >= 18, index GIN sur listings.search_vector, index sur contact_clicks(ip, created_at)
> et promotions(kind, starts_at, ends_at). Alimente cities avec les 28 villes et quartiers fournis.

### C — Vérification WhatsApp
> Implémente l'interface `VerificationChannel` avec `send(User): string` et
> `confirm(string $code, string $fromPhone): bool`. Trois implémentations : WhatsAppManualChannel (défaut),
> WhatsAppCloudChannel, SmsChannel. Le canal actif vient de la configuration. Code unique, expiration
> 15 minutes, 5 tentatives. L'écran Filament affiche côte à côte le code attendu et le numéro expéditeur.

### D — Pipeline de modération
> Implémente le pipeline en deux étages de la section 6. Étage local NSFW sur CPU, étage API uniquement
> sur score incertain. Trois sorties : minorité apparente → rejet automatique et alerte ;
> nudité explicite → statut held ; sinon published. Filtre textuel trilingue français, anglais, pidgin.
> Chaque décision écrite dans audit_log.

### E — Fil, filtres et bandeau Premium
> Reproduis `nioxxer-accueil.html`. Bandeau de 20 emplacements : Premium d'abord, complété par les
> sponsorisées si moins de 5 Premium. Si plus de 20 Premium, tirage aléatoire **fixé une fois par session**.
> Fil : sponsorisées en tête par ordre d'arrivée, puis les gratuites. Filtres déroulants Tout, Ville,
> Genre, Âge, Récent, avec recherche sur les 28 villes. Pagination hybride : 2 chargements automatiques
> puis bouton.

### F — Page d'annonce
> Reproduis `nioxxer-annonce.html`. Galerie glissante, badges Premium et Boost distincts, bouton WhatsApp
> collant, signalement à 7 motifs qualifiés, sections « ses autres annonces » et « même quartier » placées
> après le bouton de contact. Balises Open Graph et JSON-LD.

### G — Publication
> Reproduis `nioxxer-publier-v2.html`. Publication **gratuite**, aucun débit. Barre de progression,
> photos avec floutage optionnel, 28 villes avec recherche, bloc de règles, consentement obligatoire.
> Au clic : vérification WhatsApp puis proposition Premium et boost.

### H — Crédits et paiement manuel
> Reproduis `nioxxer-credits-v2.html`. Aucun prestataire de paiement. Affiche les deux numéros
> d'encaissement lus depuis `settings`, avec bouton Copier et rappel du montant exact. Formulaire de
> déclaration : opérateur, numéro payeur, référence unique. Crée une ligne `topups` en `pending`.
> Onglet Mise en avant : Premium 5 000 F, boost 1 000 et 500 F, avec détection des crédits insuffisants
> et retour sur l'annonce après recharge.

### I — Back-office
> Reproduis `nioxxer-admin-v2.html`. Six onglets : Modération, Vérifications, Signalements, **Recharges**,
> Premium, Tarifs, Journal. Recharges : file des topups, rapprochement, validation ou rejet motivé,
> réglage des numéros d'encaissement. Premium : remplissage du bandeau, ancienneté des surclassements
> admin, alerte au-delà de 30 jours. Tarifs : prix et paliers modifiables, toute modification journalisée.

### J — Compte, recherche, connexion
> Reproduis `nioxxer-compte-annonces-v2.html`, `nioxxer-recherche-v2.html` et `nioxxer-connexion-v2.html`.
> 7 genres partout, 28 villes avec quartiers propres à chaque ville, code à six chiffres, compteur
> d'affichages Premium, alerte d'expiration.

### K — Pages statiques
> Intègre `cgu.html`, `confidentialite.html`, `mentions-legales.html`, `regles.html`, `securite.html`
> et les trois états de `etats.html` (404, aucun résultat, annonce expirée).

## 14. Avant d'écrire la première ligne de code

- [x] Domaine retenu : **nioxxer.com**
- [ ] Mettre en service la ligne dédiée +237 678 802 447 et installer WhatsApp Business dessus
- [ ] Tester par curiosité la Cloud API Meta sans RCCM (une heure, gratuit) — si elle passe, l'automatisation est immédiate
- [ ] Mettre en service les deux lignes d'encaissement MTN et Orange, et les saisir dans le back-office
- [ ] Prendre rendez-vous avec l'avocat, en lui apportant ce dossier
- [x] 28 villes et leurs quartiers intégrés — **à faire relire** pour Kribi, Tiko, Mbalmayo, Sangmélima, Bafang, Bafia, Meiganga, Guider, Mbouda, Kousséri, Kumbo, Foumban
- [ ] Rédiger la première version du lexique trilingue de modération
