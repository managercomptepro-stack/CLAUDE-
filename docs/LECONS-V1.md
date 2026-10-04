# Pourquoi la v1 a échoué — à ne pas répéter

Constats du 2 octobre 2026, mesurés sur nioxxer.com depuis l'ordinateur du propriétaire.

| # | Constat v1 | Cause | Règle v2 |
|---|---|---|---|
| 1 | Accueil chargé en **10,8 s** | SDK Firebase complet téléchargé depuis gstatic.com (3 fichiers : ~6 s, ~5 s, ~3 s), polices Google 2,7 s, page bloquée jusqu'à la fin | Bundle Vite, `firestore/lite`, Auth à la demande, polices locales, coquille affichée d'abord |
| 2 | Chaque fichier ~1 s, même 3 Ko | Tout en `Cache-Control: no-cache` car noms de fichiers non versionnés | Fichiers hachés par Vite + cache long |
| 3 | Décor animé lourd (flous, 40 motifs, 30 étincelles) | Esthétique avant vitesse | Pas de décor animé |
| 4 | Deux identités visuelles différentes selon les pages | Maquettes successives jamais harmonisées | Un seul jeu de composants partagés |
| 5 | Instructions contradictoires (Laravel/PostgreSQL ET Firebase, identifiant téléphone ET e-mail, Premium 5 000 F ET 10 000 F) | CLAUDE.md empilé au fil des changements | Un CLAUDE.md court + SPEC unique qui fait foi ; l'ancien est archivé |
| 6 | Accueil vide « 0 à Douala » | Lancement sans contenu | Prévoir une stratégie de premières annonces (décision du propriétaire, hors code) ; jamais de faux contenu |
| 7 | Boutons décoratifs, sélecteur de quartier cassé (variable non définie), pages factices | Code écrit sans test de bout en bout | E2E Playwright obligatoire par parcours |
| 8 | Connexion Google fragile | `authDomain` sur firebaseapp.com, popup seule, navigateurs intégrés WhatsApp | `authDomain` = nioxxer.com, redirect sur mobile, détection navigateur intégré |
| 9 | « Ça tourne en rond » pendant une semaine | Pas de phases ni de critères d'arrêt, affirmations sans preuve | Phases à critères, preuves dans PROGRESS.md, commits |

## Ce qui était bon et qu'on garde

Voir ARCHITECTURE § 11 : logo, villes, normalisation WhatsApp, seuil de majorité, traduction des
erreurs Auth, astuce du jeton `email_verified`, domaines jetables, palette, projet Firebase.
