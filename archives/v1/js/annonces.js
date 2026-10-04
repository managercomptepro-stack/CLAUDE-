// Annonces — NIOXXER
//
// Lecture publique (fil, fiche) et gestion par le titulaire (publier,
// modifier, supprimer). Toutes les contraintes sont vérifiées par
// firestore.rules ; ce module applique les mêmes contrôles AVANT l'envoi
// pour afficher un message clair au lieu d'un refus brut.
//
// Nécessite js/config.js (script classique) chargé avant : texteSuspect,
// texteContientCoordonnees, ageDepuis, NIOXXER_WA, NIOXXER_WA_MESSAGE.

import { auth, db } from "./firebase-config.js";
import { ensureFreshVerifiedToken } from "./nioxxer-auth.js";
import {
  collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc,
  query, where, orderBy, limit, serverTimestamp, Timestamp,
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

export const DUREE_JOURS = 60;
export const MAX_ACTIVES = 3;
export const TEXTE_MIN = 20, TEXTE_MAX = 600, QUARTIER_MAX = 40;
const JOUR = 86400000;

const erreur = (code, message) => Object.assign(new Error(message || code), { code });

function dateDe(ts) { return ts && ts.toDate ? ts.toDate() : null; }
export function expireLe(a) {
  const c = a.createdAt instanceof Date ? a.createdAt : dateDe(a.createdAt);
  return c ? new Date(c.getTime() + DUREE_JOURS * JOUR) : null;
}
export function estActive(a) {
  const e = expireLe(a);
  return !e || e.getTime() > Date.now();   // createdAt encore en attente = toute neuve
}

/** Forme commune à l'accueil, à la fiche et à « Mes annonces ». */
function versAnnonce(snap) {
  const d = snap.data();
  return {
    id: snap.id, uid: d.uid, prenom: d.prenom, age: d.age, genre: d.genre,
    ville: d.ville, quartier: d.quartier || "", texte: d.texte,
    premium: !!d.premium, sponsorise: !!d.sponsorise, suspect: !!d.suspect,
    createdAt: dateDe(d.createdAt), updatedAt: dateDe(d.updatedAt),
  };
}

/** Contrôle du texte, identique aux règles. Renvoie un message ou null. */
export function verifierTexte(texte, quartier) {
  const t = String(texte || "").trim();
  if (t.length < TEXTE_MIN) return `Votre texte est trop court : ${TEXTE_MIN} caractères minimum.`;
  if (t.length > TEXTE_MAX) return `Votre texte est trop long : ${TEXTE_MAX} caractères maximum.`;
  if (texteContientCoordonnees(t))
    return "Retirez numéro de téléphone, lien WhatsApp ou e-mail du texte : le bouton Contacter s'en charge, et cela vous protège.";
  if (String(quartier || "").length > QUARTIER_MAX) return "Nom de quartier trop long.";
  return null;
}

function contenu(profil, { quartier, texte }) {
  const t = String(texte).trim();
  const naissance = profil.naissance && profil.naissance.toDate ? profil.naissance.toDate() : profil.naissance;
  return {
    uid: auth.currentUser.uid,
    prenom: profil.nom, age: ageDepuis(naissance), genre: profil.genre, ville: profil.ville,
    quartier: String(quartier || "").trim(), texte: t,
    statut: "publiee", sponsorise: false, premium: false, suspect: texteSuspect(t),
    updatedAt: serverTimestamp(),
  };
}

/** Annonces du titulaire connecté, actives d'abord. */
export async function mesAnnonces() {
  const uid = auth.currentUser.uid;
  const snap = await getDocs(query(collection(db, "annonces"), where("uid", "==", uid)));
  return snap.docs.map(versAnnonce).map((a) => ({ ...a, active: estActive(a), expire: expireLe(a) }))
    .sort((a, b) => (b.active - a.active) || ((b.createdAt || 0) - (a.createdAt || 0)));
}

/** Publie dans le premier emplacement libre (<uid>_1..3). Un emplacement
 *  occupé par une annonce expirée est libéré puis réutilisé. */
export async function publierAnnonce(profil, champs) {
  const msg = verifierTexte(champs.texte, champs.quartier);
  if (msg) throw erreur("nioxxer/texte", msg);
  await ensureFreshVerifiedToken();
  const uid = auth.currentUser.uid;
  const miennes = await mesAnnonces();
  const actives = miennes.filter((a) => a.active);
  if (actives.length >= MAX_ACTIVES) throw erreur("nioxxer/quota");
  const pris = new Set(actives.map((a) => a.id));
  const libre = [1, 2, 3].map((n) => uid + "_" + n).find((id) => !pris.has(id));
  const expiree = miennes.find((a) => a.id === libre);
  if (expiree) await deleteDoc(doc(db, "annonces", libre));
  await setDoc(doc(db, "annonces", libre), { ...contenu(profil, champs), createdAt: serverTimestamp() });
  return libre;
}

export async function modifierAnnonce(id, profil, champs) {
  const msg = verifierTexte(champs.texte, champs.quartier);
  if (msg) throw erreur("nioxxer/texte", msg);
  await ensureFreshVerifiedToken();
  await updateDoc(doc(db, "annonces", id), contenu(profil, champs));
}

export async function supprimerAnnonce(id) {
  await deleteDoc(doc(db, "annonces", id));
}

/** Utilisé par la suppression de compte. */
export async function supprimerToutesMesAnnonces() {
  for (const a of await mesAnnonces()) await supprimerAnnonce(a.id);
}

/** Une annonce publique (fiche), ou null. */
export async function lireAnnonce(id) {
  if (!/^[\w-]{1,80}$/.test(id || "")) return null;
  const snap = await getDoc(doc(db, "annonces", id));
  return snap.exists() ? versAnnonce(snap) : null;
}

/** Fil d'une ville : annonces publiées de moins de 60 jours, récentes
 *  d'abord. Index composite : firestore.indexes.json. */
export async function filAnnonces(ville, max = 60) {
  const depuis = Timestamp.fromMillis(Date.now() - DUREE_JOURS * JOUR);
  const snap = await getDocs(query(collection(db, "annonces"),
    where("statut", "==", "publiee"), where("ville", "==", ville),
    where("createdAt", ">", depuis), orderBy("createdAt", "desc"), limit(max)));
  return snap.docs.map(versAnnonce);
}

/** Lien de la fiche, pour les messages WhatsApp. */
export function lienAnnonce(a) {
  return location.origin + "/annonce?id=" + encodeURIComponent(a.id);
}

/** Bouton Contacter : WhatsApp vers le numéro NIOXXER (CLAUDE.md § Contact),
 *  avec le lien de l'annonce. Le numéro de l'annonceur n'est jamais exposé
 *  (rule 7). */
export function lienContact(a) {
  const texte = NIOXXER_WA_MESSAGE + (a ? " " + a.prenom + ", " + a.age + " ans : " + lienAnnonce(a) : "");
  return "https://wa.me/" + NIOXXER_WA + "?text=" + encodeURIComponent(texte);
}

/** Les 7 motifs de signalement (CLAUDE.md § Signalements). */
export const MOTIFS = [
  "Service sexuel tarifé",
  "La personne semble mineure",
  "Fausse identité ou photo d'une autre personne",
  "Arnaque ou demande d'argent",
  "Harcèlement, menaces ou propos haineux",
  "Coordonnées ou publicité dans l'annonce",
  "Autre contenu interdit",
];
export function lienSignalement(a, motif, precision) {
  const texte = "SIGNALEMENT NIOXXER\nMotif : " + motif + "\nAnnonce : " + lienAnnonce(a)
    + (precision ? "\nPrécision : " + precision : "");
  return "https://wa.me/" + NIOXXER_WA + "?text=" + encodeURIComponent(texte);
}

export function messageErreurAnnonce(e) {
  console.error("[NIOXXER annonces]", (e && e.code) || e);
  switch (e && e.code) {
    case "nioxxer/texte": return e.message;
    case "nioxxer/quota": return `Vous avez déjà ${MAX_ACTIVES} annonces actives. Supprimez-en une depuis Mon compte pour en publier une nouvelle.`;
    case "permission-denied": return "Publication refusée. Vérifiez votre texte (pas de numéro ni de lien) et que votre profil est complet, puis réessayez.";
    case "unavailable": case "deadline-exceeded": return "Connexion trop lente ou coupée. Vérifiez votre réseau et réessayez.";
    case "failed-precondition": return "Le fil se met en place, réessayez dans quelques minutes.";
    default: return "Une erreur est survenue. Réessayez." + (e && e.code ? " (" + e.code + ")" : "");
  }
}
