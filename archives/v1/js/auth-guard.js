// Garde de route — NIOXXER
//
// À inclure en <script type="module" src="/js/auth-guard.js"></script> tout en
// haut du <body>, uniquement sur les pages qui exigent un compte connecté ET
// vérifié : compte, publier.
//
// Ne pas l'inclure sur les pages publiques (accueil, annonce, recherche) :
// naviguer et contacter restent anonymes, sans compte (CLAUDE.md).
//
// La page demandée est transmise en ?next= : après connexion (ou
// vérification de l'e-mail), l'utilisateur revient exactement où il allait.
// Le contenu est masqué le temps de la vérification pour éviter un flash de
// contenu protégé avant la redirection.

import { auth, onAuthStateChanged } from "./nioxxer-auth.js";

document.documentElement.style.visibility = "hidden";
const next = encodeURIComponent(location.pathname + location.search);

onAuthStateChanged(auth, (user) => {
  if (!user) {
    window.location.replace("/connexion?mode=log&next=" + next);
    return;
  }
  if (!user.emailVerified) {
    window.location.replace("/verifier-email?next=" + next);
    return;
  }
  document.documentElement.style.visibility = "";
});
