# NIOXXER — Où placer chaque fichier

Structure attendue dans `Desktop\NIOXXER` :

```
NIOXXER/
├── CLAUDE.md                     ← à la racine, lu automatiquement par Claude Code
├── docs/
│   ├── DOSSIER-PROJET.md         ← renommer NIOXXER-DOSSIER-PROJET.md
│   ├── ETAT-ET-PLAN.md           ← renommer NIOXXER-ETAT-ET-PLAN.md
│   └── RESTE-A-FAIRE.md          ← renommer NIOXXER-RESTE-A-FAIRE.md
└── maquettes/
    ├── tokens.css                ← renommer nioxxer-tokens.css
    ├── accueil.html
    ├── annonce.html
    ├── publier.html
    ├── compte.html
    ├── credits.html
    ├── recherche.html
    ├── connexion.html
    ├── admin.html
    ├── cgu.html
    ├── confidentialite.html
    ├── mentions-legales.html
    ├── regles.html
    ├── securite.html
    └── etats.html
```

Correspondance des noms téléchargés :

| Fichier téléchargé | Destination |
|---|---|
| `CLAUDE.md` | `CLAUDE.md` |
| `NIOXXER-DOSSIER-PROJET.md` | `docs/DOSSIER-PROJET.md` |
| `NIOXXER-ETAT-ET-PLAN.md` | `docs/ETAT-ET-PLAN.md` |
| `NIOXXER-RESTE-A-FAIRE.md` | `docs/RESTE-A-FAIRE.md` |
| `nioxxer-tokens.css` | `maquettes/tokens.css` |
| `nioxxer-accueil.html` | `maquettes/accueil.html` |
| `nioxxer-annonce.html` | `maquettes/annonce.html` |
| `nioxxer-publier-v2.html` | `maquettes/publier.html` |
| `nioxxer-compte-annonces-v2.html` | `maquettes/compte.html` |
| `nioxxer-credits-v2.html` | `maquettes/credits.html` |
| `nioxxer-recherche-v2.html` | `maquettes/recherche.html` |
| `nioxxer-connexion-v2.html` | `maquettes/connexion.html` |
| `nioxxer-admin-v2.html` | `maquettes/admin.html` |
| `cgu.html` … `etats.html` | `maquettes/` tels quels |

---

## Le premier prompt à donner à Claude Code

Ouvre un terminal dans `NIOXXER`, lance `claude`, puis colle ceci :

> Lis CLAUDE.md et docs/DOSSIER-PROJET.md, puis parcours le dossier maquettes/ pour comprendre
> l'interface attendue. Ne code encore rien. Résume-moi en dix lignes ce que tu as compris du produit,
> des règles non négociables et du modèle de paiement, pour que je vérifie que rien ne s'est perdu.

Cette étape de vérification vaut le détour : si le résumé est juste, tu peux enchaîner les prompts A à K
de la section 13 du dossier en confiance.

---

## Les trois choses à ne jamais laisser dériver

1. **Publier est gratuit.** Aucun écran ne doit suggérer le contraire. Seule la mise en avant est payante.
2. **Les jetons de design.** Aucune couleur, police ou rayon écrit en dur dans un écran. Tout vient de
   `tokens.css`.
3. **Les trois sorties du filtre.** Minorité apparente → rejet automatique, jamais publiée, jamais mise
   en file. Nudité explicite → attente. Tout le reste → en ligne immédiatement.
