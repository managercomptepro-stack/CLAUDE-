# Recette finale — NIOXXER v2 (phase 9)

À faire **par le propriétaire, sur son téléphone Android**. Une case = un parcours de la SPEC.
Coche la case quand le résultat attendu est exact ; sinon note ce que tu vois (capture d'écran
bienvenue) et envoie-le à Claude Code. La recette est **signée** quand tu écris dans la
conversation : « Recette signée ».

- **Lien de test** : https://nioxxer-staging--preview-5k9bgz5i.web.app (expire le **10 oct. 2026** ;
  Claude Code le renouvelle sur demande). Projet de test `nioxxer-staging` : rien de ce que tu fais
  ici ne touche le site en ligne.
- **Deux façons d'ouvrir** chaque fois que c'est indiqué **[C+W]** : (C) dans **Chrome** ;
  (W) en touchant le lien dans une conversation **WhatsApp** (WhatsApp l'ouvre dans sa fenêtre
  intégrée). Fais tout le reste dans Chrome.
- Matériel utile : un 2e appareil ou un onglet de navigation privée (= un 2e visiteur), 2 photos
  à toi, une capture d'écran quelconque (pour le paiement), une photo de pièce d'identité (pour le
  badge ; elle est effacée après la décision).

---

## 0. Préparation (une seule fois)

- [ ] Tu as un compte sur le lien de test et ton document `admins/{ton uid}` avec `role: "super"`
      existe dans la console Firestore de **nioxxer-staging** (sinon : inscris-toi, demande ton uid
      à Claude Code, crée le document — HUMAN-TODO « Avant la phase 7 »).
- [ ] Admin › Réglages : un numéro + nom **MTN MoMo** et/ou **Orange Money** sont renseignés
      (sinon le parcours Booster affiche « Le paiement n'est pas encore ouvert », ce qui est normal).

## 1. Ouvrir le site

- [ ] **[C+W]** Colle le lien dans une conversation WhatsApp (à toi-même) : un **aperçu** apparaît
      (image NIOXXER, titre « NIOXXER — Rencontres libres au Cameroun », courte description).
- [ ] **[C+W]** L'accueil s'affiche vite : la structure de la page (en-tête, barre du bas) apparaît
      avant les annonces, rien ne « saute » quand les photos arrivent.
- [ ] **[C+W]** Barre du bas fixe : Accueil · Recherche · **+** (Publier) · Compte. Chaque bouton
      ouvre la bonne page.
- [ ] Bascule de thème (icône dans l'en-tête) : sombre ↔ clair. Ferme Chrome, rouvre le site :
      le thème choisi est gardé.

## 2. Visiteur sans compte (SPEC § 2 et § 6)

Déconnecte-toi d'abord (Compte › Se déconnecter) ou utilise un onglet de navigation privée.

- [ ] Sélecteur de **ville** : la liste a 28 villes (Douala en premier), la recherche dans la liste
      marche (tape « kri » → Kribi). Ville choisie, ferme et rouvre le site : elle est gardée.
      Première visite sans choix : **Douala**.
- [ ] « **Autour de moi** » : le téléphone demande la permission de localisation ; si tu acceptes,
      la ville la plus proche est choisie ; si tu refuses, un message clair, rien ne casse.
- [ ] **Bandeau Premium** (s'il existe au moins une annonce Premium/Sponsorisée dans la ville) :
      titre « Premium » + compteur, cartes qui défilent seules, s'arrêtent quand tu touches,
      glissent au doigt, repartent après ~2 s. Cartes Premium à liseré doré, étiquette visible
      « Premium » ou « Sponsorisé ». Aucune mise en avant → pas de bandeau du tout.
- [ ] **Fil** : « Annonces récentes · N à {ville} » ; en descendant, de nouvelles annonces se
      chargent sans bouton (paquets de 20). Ordre : Premium, puis Sponsorisé, puis gratuites.
- [ ] Carte d'annonce : photo, pseudo, âge, badge bleu (si vérifié), profil, quartier, début du
      titre, vues, j'aime, étiquette si mise en avant.
- [ ] Ville sans annonce (ex. Bafia) : « Pas encore d'annonce à Bafia » + bouton Publier. Aucune
      fausse annonce, aucun faux chiffre nulle part sur le site.
- [ ] **Recherche** : filtre profil (plusieurs choix parmi Femme, Homme, Gay, Lesbienne, Trans,
      Couple, Autre), ville, âge par double curseur 18–70. Les résultats suivent les filtres ;
      « Effacer les filtres » remet tout à zéro. Filtres trop étroits → message honnête.
- [ ] **[C+W]** Page **ville** : ouvre `/ville/kribi` (ajoute-le au lien de test) : même fil,
      titre propre à Kribi.
- [ ] **[C+W]** **Annonce** : galerie de photos (filigrane NIOXXER discret visible sur chaque
      photo), pseudo, âge (au mois près), « membre depuis… », badge, profil, ville, quartier,
      titre, description, « Ce que je propose », vues, j'aime.
- [ ] Bouton **WhatsApp** (logo officiel) : WhatsApp s'ouvre sur le numéro de l'annonce avec le
      message prérempli « Bonjour, je vous contacte depuis NIOXXER au sujet de votre annonce
      « {titre} ». ». **[C+W]** : vérifie aussi depuis la fenêtre ouverte par WhatsApp.
- [ ] Annonce en « Appels et messages » : un bouton **Appeler** ouvre le composeur avec le numéro.
      Annonce en « Messages uniquement » : pas de bouton Appeler.
- [ ] **J'aime** (sans compte) : le compteur augmente de 1, le bouton passe à « Vous aimez » ;
      un 2e appui retire le j'aime.
- [ ] **Partager** : le menu de partage du téléphone s'ouvre (WhatsApp proposé) ; le lien envoyé
      ouvre bien cette annonce. (Si pas de menu : « Lien copié. »)
- [ ] **Signaler** (sans compte) : 7 motifs (« La personne semble mineure » en premier) → envoyer
      → message de confirmation.
- [ ] **[C+W]** **Profil public** : touche le pseudo sur une annonce → pseudo, photo, ancienneté,
      badge, liste de ses annonces.
- [ ] Touche **+** (Publier) sans compte : tu es envoyé vers la connexion (pas de page vide).

## 3. Inscription et connexion (SPEC § 4)

Utilise une **nouvelle adresse e-mail** (pas celle de ton compte admin).

- [ ] Connexion › onglet « Créer un compte » : pseudo, date de naissance, profil, ville, numéro
      WhatsApp, photo de profil (facultative), e-mail, mot de passe, case CGU + Confidentialité
      (liens cliquables). Sans la case : refus avec message clair.
- [ ] Date de naissance de **moins de 18 ans** : refusée avec message clair.
- [ ] Pseudo déjà pris (ex. le tien) : refusé « Ce pseudo est déjà pris ». Pseudo contenant un mot
      lié aux mineurs (ex. « ecoliere ») : refusé.
- [ ] Compte créé → page « **Vérifiez votre e-mail** ». L'e-mail arrive (noter : boîte de
      réception ou spam ? — l'arrivée en boîte de réception n'est garantie qu'après le réglage
      de domaine en production). « Renvoyer l'e-mail » a un compte à rebours.
- [ ] Avant de cliquer le lien : touche **+** → tu restes bloqué sur « Vérifiez votre e-mail ».
      Après le lien : tu peux publier.
- [ ] **Continuer avec Google** (autre compte Google) : après Google, la même fiche est demandée
      (sans e-mail ni mot de passe) avant tout accès au compte.
- [ ] Se déconnecter, puis se reconnecter par e-mail + mot de passe. Mauvais mot de passe :
      message en français clair.
- [ ] **Mot de passe oublié ?** → « Envoyer le lien » → e-mail reçu → nouveau mot de passe →
      connexion avec le nouveau.

## 4. Mon compte (SPEC § 4, § 8, § 9)

- [ ] Pseudo et date de naissance affichés mais **non modifiables**.
- [ ] Changer la **ville** et le **numéro WhatsApp** → enregistré, gardé après rechargement.
- [ ] Photo de profil : **ajouter**, **changer**, **supprimer**.
- [ ] Cloche de l'en-tête : la pastille montre le nombre de notifications non lues ; la liste est
      dans Compte › Notifications (voir § 7 et § 8 ci-dessous pour les déclencher).
- [ ] **Badge vérifié** : « Choisir la photo de la pièce » → « Envoyer ma demande » → « Demande
      envoyée : en attente de vérification ».

## 5. Publier et gérer ses annonces (SPEC § 5)

- [ ] **+** → formulaire prérempli (profil, ville, WhatsApp du compte). Remplis quartier, titre,
      description, « Ce que je propose », 1 à 5 photos, mode de contact → publier → l'annonce est
      **en ligne tout de suite** sur l'accueil de sa ville.
- [ ] Refus automatiques (un essai chacun, message clair, rien de publié) :
      un **prix** (« 10 000 F », « tarif ») · un terme lié aux **mineurs** (« 16 ans »,
      « lycéenne ») · un **numéro de téléphone**, un lien **wa.me** ou un **e-mail** dans le texte.
      Doivent **passer** : « 25 ans », « 1m75 », « 2 enfants ».
- [ ] 6e photo impossible (5 maximum).
- [ ] Numéro WhatsApp de l'annonce différent de celui du compte → le bouton WhatsApp de l'annonce
      ouvre bien le numéro de l'annonce.
- [ ] Ouvre le code source de l'annonce (Chrome : `view-source:` devant l'adresse) : le numéro
      WhatsApp **n'y figure pas**.
- [ ] **Mes annonces** : vignette, statut, « N vues · N j'aime ». **Modifier** (change l'ordre des
      photos, le titre) → enregistré. **Supprimer** → l'annonce disparaît du fil.
- [ ] Limite : à la **8e** annonce active, message « Vous avez atteint le nombre maximum
      d'annonces… » (limite 7 réglable dans Admin › Réglages — tu peux la baisser à 2 pour
      tester vite, puis la remettre à 7).
- [ ] **Republier** visible dans « Mes annonces » (prolonge de 6 mois).

## 6. Booster (SPEC § 7)

- [ ] Mes annonces › **Booster** → choisir **Premium (2 000 F)** ou **Sponsorisé (500 F)** →
      choisir **MTN Mobile Money** ou **Orange Money** → le site affiche le **numéro, le nom du
      bénéficiaire** (réglés dans l'admin) et le **montant exact**. Le numéro se copie.
- [ ] Sans capture : refus « Ajoutez la capture d'écran du paiement ». Avec capture (+ référence
      facultative) → « Envoyer ma demande » → statut « En attente de vérification ».
- [ ] Une 2e demande pour la même annonce pendant l'attente est refusée.

## 7. Administration (SPEC § 10) — avec ton compte super-admin

- [ ] `/admin` avec un compte **sans rôle** : « Accès réservé à l'équipe ». Avec ton compte :
      les onglets Signalements, Récentes, Paiements, Badges, Utilisateurs, Mises en avant,
      Réglages, Équipe, Journal, Santé, Nettoyage s'ouvrent **sans message d'erreur** (un message
      « index » = à signaler à Claude Code).
- [ ] **Paiements** : la demande du § 6 est là avec sa capture → **Valider** → l'annonce passe en
      Premium/Sponsorisé (étiquette, bandeau ou au-dessus des gratuites, cadre or pour Premium) ;
      l'annonceur reçoit la notification « boost validé ». Refais un boost et **Rejette** avec
      motif → notification avec le motif.
- [ ] **Badges** : la demande du § 4 → **Valider** → badge bleu sur le profil et les annonces +
      notification. (Refais une demande et **Refuse** avec motif → notification.)
- [ ] **Signalements** : le signalement du § 2 est là, « semble mineure » en tête. **Supprimer**
      l'annonce avec motif → l'auteur voit « Supprimée » + motif dans « Mes annonces », reçoit une
      notification, et peut **Effacer** l'annonce. **Classer sans suite** sur un autre signalement.
- [ ] **Masquage auto** : Réglages › seuil de signalements → **2** ; signale une annonce depuis
      Chrome normal puis depuis un onglet privé → l'annonce disparaît du fil et remonte en tête
      des Signalements → **Rétablir** → elle revient. Remets le seuil à **10**.
- [ ] **Mises en avant** : mettre une annonce en Premium/Sponsorisé **sans paiement** (durée ou
      illimitée), puis **retirer** la mise en avant.
- [ ] **Utilisateurs** : retrouver un compte, **Avertir** (notification reçue), **Bannir** (il ne
      peut plus publier) puis **Débannir**.
- [ ] **Réglages** : changer un prix (ex. Sponsorisé 600 F) → le parcours Booster affiche le
      nouveau prix ; remettre 500 F.
- [ ] **Équipe** : ajouter un **modérateur** (ton 2e compte) → il voit Signalements, Récentes,
      Badges (sans pouvoir décider) et Santé, mais **pas** Paiements, Utilisateurs, Réglages ni
      Journal ; puis le retirer.
- [ ] **Journal** : chaque action ci-dessus y figure (qui, quoi, quand, motif).
- [ ] **Santé** et **Nettoyage › Analyser** s'affichent avec de vrais compteurs.

## 8. Pages d'information (SPEC § 12, § 13)

- [ ] **[C+W]** Pied de page : Aide · Règles · CGU · Confidentialité · Mentions légales, chaque
      lien ouvre sa page. `/mentions-legales` affiche « À compléter » tant que tu n'as pas donné
      l'identité de l'éditeur (normal).
- [ ] `/aide` : questions qui s'ouvrent, bouton WhatsApp du support vers le bon numéro.
- [ ] Adresse inexistante (ex. `/abc`) : page « introuvable » soignée avec retour à l'accueil.
- [ ] Supprimer un compte de test : Compte › **Supprimer mon compte** → confirmation → ses
      annonces disparaissent du fil, reconnexion impossible.

## 9. Ce que tu ne peux pas tester à la main (prouvé par les tests automatiques)

Expiration des annonces à 6 mois et rappel à J-7, rappel « votre Premium se termine demain », fin
d'un boost après 7 jours, blocage de publication à 5 suppressions, refus des mineurs et des prix
**côté serveur** (même si le formulaire est contourné), nettoyage nocturne. Voir `PROGRESS.md`
(433 tests unitaires, 144 tests de règles, tests de bout en bout).

---

## 10. Après la bascule en production (sur nioxxer.com, à faire une fois en ligne)

Seulement après ton feu vert explicite pour `npm run deploy` (et HUMAN-TODO « bascule » terminé).

- [ ] **[C+W]** https://nioxxer.com charge vite, aperçu WhatsApp correct.
- [ ] Connexion **Google** sur nioxxer.com (fenêtre Google, retour sur le site connecté).
- [ ] Inscription e-mail : l'e-mail de vérification arrive en **boîte de réception** (pas en
      spam), expéditeur NIOXXER.
- [ ] Une **vraie publication** avec photos, visible sur l'accueil depuis un autre téléphone.

**Signature** : écris « Recette signée » dans la conversation quand les sections 0 à 8 sont
cochées (ou que les écarts restants sont acceptés par écrit).
