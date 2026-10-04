// Test de bout en bout de l'inscription NIOXXER contre les émulateurs
// Firebase (Auth + Firestore), avec le vrai firestore.rules du projet.
// Reproduit le parcours : inscription -> lien de vérification -> retour sur
// verify-email (reload) -> enregistrement du profil. Couvre les rules 4 et 5.
//
// Lancement depuis la racine : npm install, puis npm test.
// firebase-tools est épinglé en 13.x : les versions 14+ exigent Java 21 pour
// les émulateurs, et la machine de dev a Java 11.
import { initializeApp } from "firebase/app";
import {
  getAuth, connectAuthEmulator, createUserWithEmailAndPassword,
  sendEmailVerification, signOut,
} from "firebase/auth";
import {
  getFirestore, connectFirestoreEmulator, doc, setDoc, getDoc, deleteDoc, updateDoc,
  getDocs, query, where, orderBy, limit, collection,
  serverTimestamp,
} from "firebase/firestore";

const PROJECT = "demo-nioxxer";
const app = initializeApp({ apiKey: "demo", projectId: PROJECT, authDomain: "localhost" });
const auth = getAuth(app);
connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
const db = getFirestore(app);
connectFirestoreEmulator(db, "127.0.0.1", 8080);

let pass = 0, fail = 0;
async function expect(name, fn, shouldSucceed) {
  try {
    await fn();
    if (shouldSucceed) { pass++; console.log("  OK   " + name); }
    else { fail++; console.log("  FAIL " + name + " (accepté, aurait dû être refusé)"); }
  } catch (e) {
    if (!shouldSucceed) { pass++; console.log("  OK   " + name + " (refusé : " + e.code + ")"); }
    else { fail++; console.log("  FAIL " + name + " -> " + (e.code || e.message)); }
  }
}
const DAY = 86400000;
const naissance = (jours) => new Date(Date.now() - jours * DAY);
const profil = (n) => ({ nom: "Test", naissance: n, genre: "Femme", ville: "Douala", whatsapp: null, updatedAt: serverTimestamp() });

async function verifierEmailViaEmulateur(email) {
  const r = await fetch(`http://127.0.0.1:9099/emulator/v1/projects/${PROJECT}/oobCodes`);
  const { oobCodes } = await r.json();
  const code = oobCodes.filter(c => c.email === email && c.requestType === "VERIFY_EMAIL").pop();
  if (!code) throw new Error("aucun lien de vérification émis");
  const res = await fetch(code.oobLink);   // équivaut au clic dans l'e-mail
  if (!res.ok) throw new Error("lien de vérification refusé : " + res.status);
}

const email = `t${Date.now()}@exemple.com`;
console.log("\n1. Inscription, e-mail non vérifié");
const cred = await createUserWithEmailAndPassword(auth, email, "secret123");
await sendEmailVerification(cred.user);
const uid = cred.user.uid;
await expect("profil refusé tant que l'e-mail n'est pas vérifié (rule 5)",
  () => setDoc(doc(db, "users", uid), profil(naissance(9000))), false);

console.log("\n2. Clic sur le lien, puis « J'ai vérifié mon e-mail » (reload)");
await verifierEmailViaEmulateur(email);
await auth.currentUser.reload();
console.log("  emailVerified après reload() : " + auth.currentUser.emailVerified);
const claim = (await auth.currentUser.getIdTokenResult()).claims.email_verified;
console.log("  claim email_verified du jeton après reload() : " + claim);
// Raison d'être de ensureFreshVerifiedToken (js/nioxxer-auth.js) : reload()
// seul ne réémet pas le jeton, les règles voient encore « non vérifié ».
if (claim === false) await expect("reload() seul : écriture encore refusée (jeton périmé)",
  () => setDoc(doc(db, "users", uid), profil(naissance(9000))), false);
else console.log("  NOTE le SDK réémet désormais le jeton au reload() ; le correctif reste sans effet de bord");

console.log("\n3. Même logique que ensureFreshVerifiedToken (js/nioxxer-auth.js)");
if ((await auth.currentUser.getIdTokenResult()).claims.email_verified !== true) await auth.currentUser.getIdToken(true);
await expect("profil enregistré une fois le jeton rafraîchi",
  () => setDoc(doc(db, "users", uid), profil(naissance(9000)), { merge: true }), true);

console.log("\n4. Âge minimum (rule 4), seuil 6575 jours");
await expect("17 ans refusé", () => setDoc(doc(db, "users", uid), profil(naissance(17 * 365))), false);
await expect("6574 jours refusé", () => setDoc(doc(db, "users", uid), profil(naissance(6574))), false);
await expect("6576 jours accepté", () => setDoc(doc(db, "users", uid), profil(naissance(6576))), true);
await expect("naissance absente refusée", () => setDoc(doc(db, "users", uid), { nom: "x", updatedAt: serverTimestamp() }), false);
await expect("naissance en texte refusée", () => setDoc(doc(db, "users", uid), profil("2000-01-01")), false);

console.log("\n5. Contenu des champs");
const ok = profil(naissance(9000));
await expect("WhatsApp normalisé +2376XXXXXXXX accepté", () => setDoc(doc(db, "users", uid), { ...ok, whatsapp: "+237678802447" }), true);
await expect("WhatsApp sans +237 refusé", () => setDoc(doc(db, "users", uid), { ...ok, whatsapp: "678802447" }), false);
await expect("WhatsApp avec espaces refusé", () => setDoc(doc(db, "users", uid), { ...ok, whatsapp: "+237 6 78 80 24 47" }), false);
await expect("WhatsApp étranger refusé", () => setDoc(doc(db, "users", uid), { ...ok, whatsapp: "+33612345678" }), false);
await expect("WhatsApp fixe (2…) refusé", () => setDoc(doc(db, "users", uid), { ...ok, whatsapp: "+237233421234" }), false);
await expect("WhatsApp absent accepté", () => { const { whatsapp, ...sans } = ok; return setDoc(doc(db, "users", uid), sans); }, true);
await expect("genre hors des 7 valeurs refusé", () => setDoc(doc(db, "users", uid), { ...ok, genre: "Escort" }), false);
await expect("genre vide refusé", () => setDoc(doc(db, "users", uid), { ...ok, genre: "" }), false);
for (const g of ["Femme", "Homme", "Gay", "Lesbienne", "Trans", "Couples", "Autres"])
  await expect("genre « " + g + " » accepté", () => setDoc(doc(db, "users", uid), { ...ok, genre: g }), true);
await expect("ville hors liste refusée", () => setDoc(doc(db, "users", uid), { ...ok, ville: "Paris" }), false);
await expect("ville accentuée acceptée (Ngaoundéré)", () => setDoc(doc(db, "users", uid), { ...ok, ville: "Ngaoundéré" }), true);
await expect("nom d'un caractère refusé", () => setDoc(doc(db, "users", uid), { ...ok, nom: "A" }), false);
await expect("nom de 31 caractères refusé", () => setDoc(doc(db, "users", uid), { ...ok, nom: "x".repeat(31) }), false);
await expect("nom non textuel refusé", () => setDoc(doc(db, "users", uid), { ...ok, nom: 42 }), false);
await expect("updatedAt fourni par le client refusé", () => setDoc(doc(db, "users", uid), { ...ok, updatedAt: new Date() }), false);
await expect("ville manquante refusée", () => { const { ville, ...sans } = ok; return setDoc(doc(db, "users", uid), sans); }, false);

console.log("\n6. Accès");
await expect("champ inconnu refusé (credits)", () => setDoc(doc(db, "users", uid), { ...profil(naissance(9000)), credits: 999 }), false);
await expect("lecture de son profil", () => getDoc(doc(db, "users", uid)), true);
await expect("lecture du profil d'un autre refusée", () => getDoc(doc(db, "users", "autre-uid")), false);
await expect("écriture du profil d'un autre refusée", () => setDoc(doc(db, "users", "autre-uid"), profil(naissance(9000))), false);
await expect("suppression du profil d'un autre refusée", () => deleteDoc(doc(db, "users", "autre-uid")), false);
await expect("autre collection refusée", () => setDoc(doc(db, "credit_ledger", "x"), { delta: 1 }), false);

console.log("\n7. Annonces");
// Profil de référence : Femme, Douala, né il y a 9150 jours (25 ans).
await setDoc(doc(db, "users", uid), { ...profil(naissance(9150)), nom: "Test" });
const age = Math.floor((Date.now() - naissance(9150).getTime()) / 31556952000);
const A = (o = {}) => ({
  uid, prenom: "Test", age, genre: "Femme", ville: "Douala", quartier: "Akwa",
  texte: "Je cherche une relation sérieuse, sorties et cinéma le week-end.",
  statut: "publiee", sponsorise: false, premium: false, suspect: false,
  createdAt: serverTimestamp(), updatedAt: serverTimestamp(), ...o,
});
const slot = (n, u = uid) => doc(db, "annonces", u + "_" + n);
await expect("annonce valide publiée (emplacement 1)", () => setDoc(slot(1), A()), true);
await expect("emplacement 2", () => setDoc(slot(2), A()), true);
await expect("emplacement 3", () => setDoc(slot(3), A()), true);
await expect("4e annonce refusée (emplacement 4)", () => setDoc(slot(4), A()), false);
await expect("identifiant libre refusé", () => setDoc(doc(db, "annonces", "abc"), A()), false);
await expect("annonce au nom d'un autre compte refusée", () => setDoc(slot(1, "autre-uid"), A()), false);
await deleteDoc(slot(2)); await deleteDoc(slot(3));
const mauvais = [
  ["prénom différent du profil", { prenom: "Autre" }],
  ["âge rajeuni", { age: age - 3 }],
  ["âge vieilli", { age: age + 1 }],
  ["âge mineur", { age: 17 }],
  ["genre différent du profil", { genre: "Homme" }],
  ["ville différente du profil", { ville: "Yaoundé" }],
  ["texte trop court", { texte: "Salut toi" }],
  ["texte trop long", { texte: "a".repeat(601) }],
  ["numéro de téléphone dans le texte", { texte: "Appelle-moi au 6 78 80 24 47 pour se voir vite" }],
  ["lien WhatsApp dans le texte", { texte: "Écris-moi directement sur wa.me/237678 merci" }],
  ["e-mail dans le texte", { texte: "Écris-moi à moi.test@gmail.com pour discuter" }],
  ["texte suspect non marqué", { texte: "Massage relaxant à domicile, discrétion assurée" }],
  ["texte normal marqué suspect", { suspect: true }],
  ["sponsorisée sans paiement", { sponsorise: true }],
  ["premium sans paiement", { premium: true }],
  ["statut autre que publiee", { statut: "held" }],
  ["champ en trop (whatsapp)", { whatsapp: "+237678802447" }],
  ["createdAt fourni par le client", { createdAt: new Date() }],
  ["quartier trop long", { quartier: "x".repeat(41) }],
];
for (const [nom, o] of mauvais) await expect(nom + " : refusé", () => setDoc(slot(2), A(o)), false);
await expect("texte suspect CORRECTEMENT marqué : publié (rule 3 : ne bloque pas seul)",
  () => setDoc(slot(2), A({ texte: "Massage relaxant à domicile, discrétion assurée", suspect: true })), true);
await expect("modification du texte par le titulaire", () => updateDoc(slot(1), { texte: "Nouveau texte de mon annonce, toujours sérieux.", updatedAt: serverTimestamp() }), true);
await expect("modification de createdAt refusée (prolongation)", () => updateDoc(slot(1), { createdAt: serverTimestamp(), updatedAt: serverTimestamp() }), false);
await expect("lecture d'une annonce publiée", () => getDoc(slot(1)), true);
await expect("liste publique par ville (requête du fil)", () => getDocs(query(collection(db, "annonces"),
  where("statut", "==", "publiee"), where("ville", "==", "Douala"), orderBy("createdAt", "desc"), limit(60))), true);
await expect("liste de mes annonces (Mon compte)", () => getDocs(query(collection(db, "annonces"), where("uid", "==", uid))), true);
await expect("liste de toutes les annonces sans filtre refusée", () => getDocs(collection(db, "annonces")), false);

console.log("\n8. Un autre compte ne touche pas aux annonces");
const app2 = initializeApp({ apiKey: "demo", projectId: PROJECT, authDomain: "localhost" }, "b");
const auth2 = getAuth(app2); connectAuthEmulator(auth2, "http://127.0.0.1:9099", { disableWarnings: true });
const db2 = getFirestore(app2); connectFirestoreEmulator(db2, "127.0.0.1", 8080);
const email2 = `u${Date.now()}@exemple.com`;
await createUserWithEmailAndPassword(auth2, email2, "secret123");
await sendEmailVerification(auth2.currentUser);
await verifierEmailViaEmulateur(email2);
await auth2.currentUser.reload(); await auth2.currentUser.getIdToken(true);
await expect("B lit l'annonce publiée de A", () => getDoc(doc(db2, "annonces", uid + "_1")), true);
await expect("B ne modifie pas l'annonce de A", () => updateDoc(doc(db2, "annonces", uid + "_1"), { texte: "Texte modifié par quelqu'un d'autre ici" }), false);
await expect("B ne supprime pas l'annonce de A", () => deleteDoc(doc(db2, "annonces", uid + "_1")), false);
await expect("B sans profil ne publie pas", () => setDoc(doc(db2, "annonces", auth2.currentUser.uid + "_1"),
  { ...A(), uid: auth2.currentUser.uid }), false);
await signOut(auth2);
await expect("visiteur sans compte lit une annonce publiée", () => getDoc(doc(db2, "annonces", uid + "_1")), true);
await expect("visiteur sans compte lit le fil", () => getDocs(query(collection(db2, "annonces"),
  where("statut", "==", "publiee"), where("ville", "==", "Douala"), orderBy("createdAt", "desc"), limit(60))), true);
await expect("visiteur sans compte ne publie pas", () => setDoc(doc(db2, "annonces", "x_1"), A()), false);

console.log("\n9. Suppression du compte (Réglages)");
await expect("le titulaire supprime ses annonces", async () => { await deleteDoc(slot(1)); await deleteDoc(slot(2)); }, true);
await expect("le titulaire supprime son profil", () => deleteDoc(doc(db, "users", uid)), true);
await signOut(auth);
await expect("lecture sans compte refusée", () => getDoc(doc(db, "users", uid)), false);

console.log(`\n${pass} OK, ${fail} FAIL`);
process.exit(fail ? 1 : 0);
