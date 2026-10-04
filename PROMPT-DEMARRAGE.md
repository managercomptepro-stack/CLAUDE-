# Message à coller dans Claude Code (dans le dossier NIOXXER)

Conseil : choisis le meilleur modèle disponible, et lance d'abord en **mode plan** (Shift+Tab
deux fois) pour la première session.

---

Tu reconstruis NIOXXER de zéro (v2). Avant d'écrire la moindre ligne de code, lis en entier :
CLAUDE.md, PROGRESS.md, docs/SPEC.md, docs/ARCHITECTURE.md, docs/PLAN.md, docs/LECONS-V1.md,
docs/HUMAN-TODO.md.

Ensuite :
1. Résume-moi en 15 lignes maximum ce que tu as compris du produit et de l'architecture, et
   liste les points qui te semblent ambigus, contradictoires ou techniquement risqués (avec ta
   proposition pour chacun). Attends ma réponse.
2. Puis exécute le plan phase par phase, sans sauter d'étape. Ne passe à la phase suivante
   qu'avec tous les critères prouvés dans PROGRESS.md (commande + résultat) et un commit.
3. Prends le temps qu'il faut : je préfère 5 heures de travail vérifié à un résultat rapide.
   Ne me dis jamais « c'est fait » sans preuve.
4. Quand tu as besoin d'un réglage de console, ajoute-le à docs/HUMAN-TODO.md, continue avec les
   émulateurs, et préviens-moi en fin de phase.
5. À la fin de chaque phase, envoie-moi un compte rendu de 5 lignes maximum : fait, prouvé par,
   captures, prochain pas, ce que j'ai à faire.

Ne déploie jamais en production sans que je le demande. Le canal de prévisualisation est autorisé.
