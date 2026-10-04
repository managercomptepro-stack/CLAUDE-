# NIOXXER v2 — Cahier des charges produit

Source : entretien du propriétaire du 2 octobre 2026 (60 questions). Ce document fait foi pour le
produit. En cas de contradiction avec un ancien document (`archives/v1/…`), **ce document gagne**.

---

## 1. Concept

- **NIOXXER** : plateforme de **petites annonces de rencontre libre** au Cameroun. Simples,
  discrètes, gratuites à publier.
- Un carrefour où des adultes se trouvent puis discutent sur **WhatsApp**. Le site ne porte aucune
  messagerie.
- Nom **NIOXXER** et logo conservés. Domaine **nioxxer.com**. Français uniquement. Mobile d'abord
  (l'ordinateur viendra plus tard ; il doit seulement rester propre).
- Référence d'ergonomie citée par le propriétaire : la **fluidité** d'un site concurrent (pages
  rapides, connectées entre elles, défilement sans fin des annonces). On reprend la mécanique
  d'interface, **pas son contenu**.

## 2. Qui fait quoi

| Action | Sans compte | Compte non vérifié | Compte vérifié (e-mail) |
|---|---|---|---|
| Voir le fil, filtrer, ouvrir une annonce | ✅ | ✅ | ✅ |
| Contacter sur WhatsApp, partager | ✅ | ✅ | ✅ |
| Aimer, signaler une annonce | ✅ (session anonyme) | ✅ | ✅ |
| Publier, modifier, supprimer ses annonces | ❌ | ❌ (page « vérifiez votre e-mail ») | ✅ |
| Booster une annonce | ❌ | ❌ | ✅ |
| Demander le badge vérifié | ❌ | ❌ | ✅ |

- Adultes uniquement (18 ans et plus). Hommes, femmes et toutes orientations.

## 3. Profils (genres)

Liste fermée, partout (inscription, annonce, filtres) : **Femme, Homme, Gay, Lesbienne, Trans,
Couple, Autre**.

## 4. Inscription et connexion

- Deux méthodes : **e-mail + mot de passe** et **Google**.
- Formulaire d'inscription : **pseudo**, **date de naissance**, **profil** (genre), **ville**
  (liste), **numéro WhatsApp**, photo de profil (**facultative**), e-mail, mot de passe, case
  **« J'accepte les Conditions d'utilisation et la Politique de confidentialité »** (obligatoire),
  bouton « Créer mon compte ».
- Inscription Google : après Google, la même fiche (sans e-mail/mot de passe) est demandée avant
  tout accès au compte.
- Le **pseudo** est un pseudonyme (pas de vrai nom exigé), **unique**, **non modifiable**.
- La **date de naissance** n'est **pas modifiable** (l'âge affiché est calculé).
- Ville, WhatsApp, photo de profil : modifiables dans « Mon compte ». Photo : ajouter, changer,
  supprimer.
- **E-mail de vérification** envoyé à l'inscription ; le lien doit arriver en **boîte de
  réception** (domaine d'envoi personnalisé, voir HUMAN-TODO). Tant que l'e-mail n'est pas
  vérifié : pas de publication.
- Mot de passe oublié : e-mail de réinitialisation.
- Supprimer son compte : possible depuis « Mon compte » (supprime annonces et profil).

## 5. Annonces

### Contenu d'une annonce

| Champ | Source | Modifiable par l'auteur |
|---|---|---|
| Pseudo | compte | non |
| Photo de profil | compte | via le compte |
| Âge | calculé depuis la date de naissance du compte | non |
| Ancienneté du membre (« membre depuis 3 jours / 2 mois ») | date de création du compte | non |
| Badge vérifié (bleu) | admin | non |
| Profil (genre) | annonce, prérempli depuis le compte | oui |
| Ville (liste) | annonce, préremplie | oui |
| Quartier (texte libre, 40 car. max) | annonce | oui |
| Titre (60 car. max) | annonce | oui |
| Description (1 000 car. max) | annonce | oui |
| « Ce que je propose » (texte libre, 300 car. max) | annonce | oui |
| Photos : 1 à **5** pour toutes les annonces, gratuites ou boostées (pas de vidéo) | annonce | oui |
| WhatsApp (préremplie depuis le compte, peut différer) | annonce, document privé | oui |
| Mode de contact : « Messages uniquement » ou « Appels et messages » | annonce | oui |
| Vues, j'aime | compteurs réels | non |

- **Aucun prix** dans l'annonce (refusé automatiquement). Aucun numéro de téléphone, lien wa.me
  ou e-mail dans les textes (le contact passe par le bouton).
- Boutons sur l'annonce : **WhatsApp** (logo officiel ; ouvre la conversation avec message
  prérempli « Bonjour, je vous contacte depuis NIOXXER au sujet de votre annonce « {titre} ». »),
  **J'aime**, **Partager** (partage natif du téléphone, sinon copie du lien), **Signaler**.
- Si l'auteur a choisi « Appels et messages », un second bouton « Appeler » est affiché.
- Plusieurs annonces par compte : **7 annonces actives maximum** (décision du propriétaire ;
  réglable par le super-admin dans l'admin › Réglages).
- **Publication immédiate** (pas de validation préalable). Contrôles automatiques à l'écriture :
  majorité, termes liés aux mineurs, prix, coordonnées dans le texte.
- **Durée de vie : 6 mois**, puis suppression automatique. Rappel affiché dans « Mes annonces »
  7 jours avant l'expiration. L'auteur peut **republier** (prolonger de 6 mois) depuis
  « Mes annonces ».
- Une annonce **supprimée par la modération** reste visible (état « Supprimée », motif) dans
  « Mes annonces » ; l'auteur peut l'**effacer** pour libérer son emplacement. Le strike et
  l'entrée du journal d'audit restent (décision du 2 oct. 2026).
- L'âge affiché est calculé au **mois près** (seul le mois de naissance est public) ; la
  vérification de majorité, elle, utilise la date exacte.
- **Filigrane** NIOXXER discret (opacité réduite) incrusté dans chaque photo **à l'envoi**.

## 6. Accueil, fil et recherche

- En haut : sélecteur de **ville** (28 villes, voir § 11) avec recherche dans la liste ; la ville
  choisie est mémorisée. Bouton facultatif « Autour de moi » (géolocalisation du téléphone, avec
  permission) qui choisit la ville la plus proche. Sans choix : **Douala**.
- **Bandeau Premium** sous les filtres (reprise du « Ruban » de la v1, demande du propriétaire du
  3 oct. 2026) : titre « Premium » + trait + compteur ; jusqu'à 30 cartes verticales (photo pleine,
  étiquette Premium ou Sponsorisé, pseudo, âge, badge, quartier, liseré doré pour Premium), Premium
  d'abord puis Sponsorisées ; défilement automatique en boucle, pause au toucher, glissement au
  doigt, reprise après 2 s, bords estompés. Masqué s'il n'y en a aucune. Puis « Annonces récentes ·
  N à {ville} » et le fil.
- **Fil** : défilement sans fin, par paquets de **20**. Ordre : **Premium**, puis **Sponsorisé**,
  puis gratuites, chaque groupe de la plus récente à la plus ancienne.
- Carte d'annonce : photo principale, pseudo, âge, badge vérifié, profil, quartier, début du
  titre, vues, j'aime, étiquette Premium/Sponsorisé si mise en avant.
- **Filtres** (page Recherche et raccourcis sur l'accueil) : **profil** (7 valeurs, plusieurs
  possibles), **ville**, **âge** par double curseur **18 à 70 ans**. Pas de filtre par quartier.
  Même ordre de tri que le fil.
- Ville vide : message honnête « Pas encore d'annonce à {ville} » + bouton Publier. Pas de faux
  contenu.

## 7. Mise en avant payante (seule source de revenus)

| Formule | Prix | Durée | Effet |
|---|---|---|---|
| **Premium** | **2 000 F CFA** | 7 jours | Bandeau défilant en haut + tête du fil + cadre or + défilé de ses photos sur sa carte + étiquette « Premium » |
| **Sponsorisé** | **500 F CFA** | 7 jours | Au-dessus des annonces gratuites + étiquette « Sponsorisé » |

- Paiement **par annonce**, pas de crédits, pas d'abonnement, pas de renouvellement automatique.
- Prix modifiables par le super-administrateur dans les réglages (pas dans le code).
- **Parcours** : « Booster » sur une de mes annonces → choisir Premium ou Sponsorisé → choisir
  **MTN Mobile Money** ou **Orange Money** (logos officiels) → le site affiche le **numéro et le
  nom du bénéficiaire** réglés par l'admin + le montant exact → l'annonceur paie depuis son
  téléphone → il envoie la **capture d'écran** du paiement (et, facultatif, la référence de la
  transaction) → statut « En attente de vérification ».
- L'admin compare avec son relevé Mobile Money, puis **valide** (le boost démarre maintenant,
  7 jours ; si l'annonce est déjà boostée avec une fin dans le futur, les 7 jours s'ajoutent à
  cette date de fin) ou **rejette** (avec motif).
- L'annonceur reçoit une **notification** sur le site dans les deux cas.
- À l'expiration, l'annonce redevient gratuite. Rappel « votre Premium se termine demain »
  affiché dans « Mes annonces ».
- L'admin peut aussi, sans paiement, mettre une annonce en Premium/Sponsorisé (durée choisie ou
  illimitée) et retirer une mise en avant.

## 8. Badge vérifié (bleu)

- L'annonceur peut **demander** le badge en envoyant une photo de sa **pièce d'identité**
  (stockée de façon restreinte, supprimée après décision, voir ARCHITECTURE).
- L'admin valide ou refuse ; il peut aussi attribuer/retirer le badge de sa propre initiative.

## 9. Notifications (sur le site)

Icône cloche dans l'en-tête avec pastille du nombre non lu. Cas :
- Boost validé / rejeté (avec motif).
- Badge vérifié accordé / refusé.
- Annonce supprimée par la modération (avec motif).
- Rappels calculés (pas de stockage) : annonce qui expire dans 7 jours, boost qui finit demain.

## 10. Administration

- Rôles : **super-administrateur** (le propriétaire) et **modérateurs** (2 au départ ; le
  super-admin les ajoute et les retire depuis l'admin).
- Modérateur : voit les **annonces récentes**, les **annonces signalées** (motif « semble
  mineure » en tête), supprime une annonce avec motif, avertit. Il ne voit **ni les dossiers
  privés** des membres (e-mail, date de naissance, WhatsApp) **ni les pièces d'identité** : seul le
  nombre de strikes et l'état de la publication lui sont lisibles (décision du 3 oct. 2026).
- Super-admin : tout ce que fait le modérateur + **traiter les demandes de badge** (seul à voir les
  pièces d'identité), **valider/rejeter les paiements**, accorder
  Premium/Sponsorisé/badge, régler les **numéros et noms Mobile Money** et les **prix**, gérer
  les modérateurs, bannir/débannir, voir le journal d'audit.
- **5 annonces supprimées pour infraction** → le compte ne peut plus publier (bannissement de
  publication ; levable par le super-admin).
- Motifs de signalement (7) : La personne semble mineure · Service sexuel tarifé · Photos volées
  ou d'une autre personne · Arnaque ou demande d'argent · Contenu choquant ou violent · Faux profil
  · Autre.
- Une annonce qui reçoit **10 signalements** de **comptes vérifiés** distincts (seuil réglable par
  le super-admin) est **masquée automatiquement** (décision du 3 oct. 2026). Les signalements de
  visiteurs anonymes ou non vérifiés restent enregistrés et visibles dans l'admin (onglet
  Signalements, comptés à part) mais ne comptent pas pour le masquage. Elle est masquée
  en attendant la décision d'un admin. Les annonces masquées remontent **en tête** de l'admin
  (onglet Signalements), avec un bouton **« Rétablir »** (audité) ou la suppression avec motif.
  Une même personne peut multiplier les sessions anonymes : c'est pourquoi elles ne comptent plus
  pour le masquage ; App Check (reCAPTCHA) limitera aussi les robots.

## 11. Villes (28, ordre d'affichage)

Douala, Yaoundé, Garoua, Bamenda, Maroua, Bafoussam, Ngaoundéré, Bertoua, Edéa, Loum, Kumba,
Nkongsamba, Buea, Kumbo, Foumban, Dschang, Ebolowa, Kousséri, Guider, Mbouda, Limbé, Kribi,
Bafang, Tiko, Mbalmayo, Sangmélima, Meiganga, Bafia.

(Liste reprise de la v1, `archives/v1/js/config.js`. Les quartiers sont en saisie libre : la
table de quartiers v1 n'est pas utilisée.) Ajouter les coordonnées GPS approximatives de chaque
ville pour « Autour de moi » ; source à citer dans le code en commentaire, à vérifier.

## 12. Pages

| Adresse | Page |
|---|---|
| `/` | Accueil : ville, bandeau Premium, fil infini |
| `/recherche` | Filtres + résultats |
| `/ville/{slug}` | Page par ville (même fil, titre et description propres pour Google) |
| `/annonce?id=…` | Détail d'une annonce |
| `/membre?u=…` | Profil public d'un annonceur : pseudo, photo, ancienneté, badge, ses annonces |
| `/connexion` | Connexion / création de compte (onglets) |
| `/verifier-email` | Attente de vérification, renvoyer l'e-mail |
| `/compte` | Mon compte : profil, mes annonces, notifications, badge, déconnexion, suppression |
| `/publier` | Créer / modifier une annonce |
| `/booster?id=…` | Parcours de paiement |
| `/admin` | Administration (rôles) |
| `/aide` | Aide + contact NIOXXER sur WhatsApp |
| `/cgu`, `/confidentialite`, `/mentions-legales`, `/regles` | Pages légales |
| 404 | Page introuvable soignée |

## 13. Partage et référencement

- Aperçu de lien (Open Graph) quand on colle nioxxer.com sur WhatsApp/Facebook : image
  `og-image.png`, titre « NIOXXER — Rencontres libres au Cameroun », description courte.
- Une page par ville avec titre et description uniques ; `sitemap.xml`, `robots.txt`.
- `/admin`, `/compte`, `/publier`, `/booster` : `noindex`.

## 14. Hors périmètre v2 (ne pas construire)

Messagerie interne, crédits, abonnements, vidéos, swipe, version anglaise, application native,
paiement automatique par API Mobile Money.
