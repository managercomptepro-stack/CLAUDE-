// Configuration Firebase — NIOXXER
//
// Ces valeurs sont publiques par conception (une apiKey web identifie le
// projet, elle n'autorise rien par elle-même). La sécurité vient de
// firestore.rules, pas de la confidentialité de ces champs. Aucune variable
// d'environnement n'est nécessaire ici.
//
// Storage : volontairement NON initialisé. Le bucket n'est pas provisionné
// (plan Spark, pas de carte bancaire liée) — appeler getStorage() renverrait
// 402/403. Le champ storageBucket ci-dessous est conservé tel que la console
// le fournit, mais rien ne doit s'en servir tant que l'hébergement des
// photos n'est pas tranché (voir CLAUDE.md § Note de transition).

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import { getAuth, connectAuthEmulator } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import { getFirestore, connectFirestoreEmulator } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBQz0NOIbDahSMyZLCKutn3vgKHVte9a0o",
  authDomain: "nioxxer-cda95.firebaseapp.com",
  projectId: "nioxxer-cda95",
  storageBucket: "nioxxer-cda95.firebasestorage.app",
  messagingSenderId: "933001931493",
  appId: "1:933001931493:web:a7f547b5f18a5a1621c20c",
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

// E-mails de vérification / réinitialisation et pages Firebase en français.
auth.languageCode = "fr";

// En local (npm run dev / .claude/launch.json), tout passe par les
// émulateurs : aucun compte ni aucune annonce de test n'atterrit en
// production.
export const EMULATEURS = ["localhost", "127.0.0.1"].includes(location.hostname);
if (EMULATEURS) {
  connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
  connectFirestoreEmulator(db, "127.0.0.1", 8080);
}
