// Actions d'authentification partagées — NIOXXER
//
// Regroupe la logique Firebase Auth utilisée par /connexion, /verifier-email
// et /compte : gestion d'erreurs, liaison de comptes, retour après
// vérification, suppression de compte.

import { auth, db } from "./firebase-config.js";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendEmailVerification,
  sendPasswordResetEmail,
  GoogleAuthProvider,
  EmailAuthProvider,
  signInWithPopup,
  reauthenticateWithPopup,
  reauthenticateWithCredential,
  linkWithCredential,
  deleteUser,
  onAuthStateChanged,
  signOut,
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import {
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

export { auth, db, onAuthStateChanged, signOut };

/** Vrai si le domaine de l'e-mail figure dans la liste des fournisseurs jetables.
 *  La liste (152 Ko) n'est chargée qu'ici, au moment d'une inscription : les
 *  autres pages (compte, vérification) n'ont plus à la télécharger. */
export async function isDisposableEmail(email) {
  const { DISPOSABLE_DOMAINS } = await import("./disposable-domains.js");
  const domain = (email.split("@")[1] || "").trim().toLowerCase();
  return DISPOSABLE_DOMAINS.has(domain);
}

/** Traduit un code d'erreur Firebase Auth en message français destiné à
 *  l'utilisateur. Le code brut part aussi dans la console : sans lui, un
 *  « Une erreur est survenue » ne permet aucun diagnostic. */
export function translateAuthError(error) {
  const code = error && error.code;
  console.error("[NIOXXER auth]", code || error);
  switch (code) {
    case "auth/email-already-in-use":
      return "Cette adresse e-mail est déjà utilisée. Essayez de vous connecter à la place.";
    case "auth/invalid-email":
      return "Cette adresse e-mail n'est pas valide.";
    case "auth/missing-password":
      return "Entrez votre mot de passe.";
    case "auth/weak-password":
      return "Le mot de passe doit contenir au moins 6 caractères.";
    case "auth/too-many-requests":
      return "Trop de tentatives. Réessayez dans quelques minutes.";
    case "auth/user-not-found":
    case "auth/wrong-password":
    case "auth/invalid-credential":
      return "E-mail ou mot de passe incorrect.";
    case "auth/user-disabled":
      return "Ce compte a été suspendu. Contactez-nous sur WhatsApp.";
    case "auth/popup-closed-by-user":
    case "auth/cancelled-popup-request":
      return "La fenêtre Google a été fermée avant la fin de la connexion.";
    case "auth/popup-blocked":
      return "Votre navigateur a bloqué la fenêtre Google. Autorisez les fenêtres pop-up pour nioxxer.com, puis réessayez.";
    case "auth/operation-not-supported-in-this-environment":
    case "auth/web-storage-unsupported":
      return "La connexion Google ne fonctionne pas dans ce navigateur intégré. Ouvrez nioxxer.com dans Chrome ou Safari, ou utilisez votre e-mail.";
    case "auth/unauthorized-domain":
      return "La connexion Google n'est pas encore activée sur ce site. Utilisez votre e-mail et votre mot de passe en attendant.";
    case "auth/network-request-failed":
      return "Pas de connexion Internet, ou connexion trop lente. Vérifiez votre réseau et réessayez.";
    case "auth/requires-recent-login":
      return "Par sécurité, confirmez d'abord votre identité.";
    case "nioxxer/disposable-email":
      return "Les adresses e-mail temporaires ne sont pas acceptées. Utilisez une adresse e-mail habituelle.";
    case "nioxxer/cancelled":
      return "Opération annulée.";
    default:
      return "Une erreur est survenue. Réessayez." + (code ? " (" + code + ")" : "");
  }
}

/** Chemin interne sûr pour ?next= : uniquement une adresse du site (« /… »),
 *  jamais « //autre-site » ni une URL complète (redirection ouverte). */
export function safeNext(raw, fallback = "/compte") {
  return typeof raw === "string" && /^\/(?!\/)[\w\-/?=&%.]*$/.test(raw) ? raw : fallback;
}

/** Envoie l'e-mail de vérification avec un lien de retour vers le site.
 *  Si le domaine n'est pas (encore) autorisé dans la console Firebase,
 *  Firebase refuse l'adresse de retour : on renvoie alors l'e-mail simple,
 *  pour que l'inscription ne soit jamais bloquée par un réglage. */
async function envoyerVerification(user, next) {
  const url = location.origin + "/connexion?step=profil" + (next ? "&next=" + encodeURIComponent(next) : "");
  try {
    await sendEmailVerification(user, { url, handleCodeInApp: false });
  } catch (e) {
    if (e && (e.code === "auth/unauthorized-continue-uri" || e.code === "auth/invalid-continue-uri")) {
      console.warn("[NIOXXER auth] domaine non autorisé pour le lien de retour :", location.origin);
      await sendEmailVerification(user);
    } else throw e;
  }
}

/**
 * Inscription par e-mail + mot de passe. Refuse les domaines jetables,
 * puis envoie immédiatement l'e-mail de vérification.
 */
export async function signUpWithEmail(email, password, next) {
  if (await isDisposableEmail(email)) {
    throw Object.assign(new Error("disposable email"), { code: "nioxxer/disposable-email" });
  }
  const credential = await createUserWithEmailAndPassword(auth, email, password);
  await envoyerVerification(credential.user, next);
  return credential.user;
}

export async function logInWithEmail(email, password) {
  const credential = await signInWithEmailAndPassword(auth, email, password);
  return credential.user;
}

export async function resendVerificationEmail(next) {
  if (!auth.currentUser) throw new Error("Aucun utilisateur connecté.");
  await envoyerVerification(auth.currentUser, next);
}

export async function resetPassword(email) {
  await sendPasswordResetEmail(auth, email);
}

/**
 * Connexion Google, par fenêtre pop-up.
 *
 * Pas de repli signInWithRedirect : avec authDomain sur firebaseapp.com et
 * le site sur nioxxer.com, la redirection échoue sur Chrome 115+, Safari
 * 16.1+ et Firefox (stockage tiers partitionné). Quand la pop-up est
 * bloquée, le message d'erreur dit quoi faire. Dans les navigateurs intégrés
 * (WhatsApp, Facebook), Google interdit de toute façon sa connexion.
 *
 * Le projet a « Associer les comptes qui utilisent la même adresse e-mail » :
 * si Firebase refuse malgré tout (auth/account-exists-with-different-credential),
 * on demande le mot de passe existant via `onNeedPassword(email)` et on
 * rattache Google au même compte.
 */
export async function signInWithGoogle(onNeedPassword) {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });
  try {
    const result = await signInWithPopup(auth, provider);
    return { user: result.user, linked: false };
  } catch (error) {
    if (error.code !== "auth/account-exists-with-different-credential") throw error;
    if (typeof onNeedPassword !== "function") throw error;

    const email = error.customData && error.customData.email;
    const pendingCredential = GoogleAuthProvider.credentialFromError(error);
    if (!email || !pendingCredential) throw error;

    const password = await onNeedPassword(email);
    if (!password) {
      throw Object.assign(new Error("cancelled"), { code: "nioxxer/cancelled" });
    }

    const credential = await signInWithEmailAndPassword(auth, email, password);
    await linkWithCredential(credential.user, pendingCredential);
    await credential.user.reload();
    return { user: auth.currentUser, linked: true };
  }
}

/** Vrai si users/{uid} existe déjà. */
export async function profileExists(uid) {
  const snap = await getDoc(doc(db, "users", uid));
  return snap.exists();
}

/** Contenu de users/{uid}, ou null si le profil n'a pas encore été rempli. */
export async function getProfile(uid) {
  const snap = await getDoc(doc(db, "users", uid));
  return snap.exists() ? snap.data() : null;
}

/**
 * firestore.rules lit `request.auth.token.email_verified`, c'est-à-dire la
 * valeur figée dans le jeton d'identité au moment où il a été émis.
 * `user.reload()` met à jour `user.emailVerified` mais ne réémet pas le
 * jeton : juste après avoir cliqué le lien de vérification, le jeton dit
 * encore « non vérifié » et l'écriture est refusée, pendant jusqu'à une
 * heure. On force donc un nouveau jeton quand il est en retard.
 */
export async function ensureFreshVerifiedToken() {
  const user = auth.currentUser;
  if (!user || !user.emailVerified) return;
  const { claims } = await user.getIdTokenResult();
  if (claims.email_verified !== true) await user.getIdToken(true);
}

/** Enregistre le profil (prénom, date de naissance, genre, ville, WhatsApp optionnel). */
export async function saveProfile(uid, profile) {
  await ensureFreshVerifiedToken();
  await setDoc(
    doc(db, "users", uid),
    { ...profile, updatedAt: serverTimestamp() },
    { merge: true }
  );
}

/** Méthode de connexion du compte : "password", "google.com" ou les deux. */
export function providersOf(user) {
  return (user && user.providerData || []).map((p) => p.providerId);
}

/**
 * Suppression définitive du compte.
 * 1. Confirmation d'identité (mot de passe, ou fenêtre Google) — Firebase
 *    l'exige pour supprimer un compte, et elle évite qu'un téléphone prêté
 *    suffise à tout effacer.
 * 2. Suppression des annonces (`supprimerAnnonces`, fourni par l'appelant),
 *    puis du profil, puis du compte d'authentification — dans cet ordre :
 *    une fois le compte supprimé, plus rien d'autre ne peut l'être.
 */
export async function deleteAccount({ password, supprimerAnnonces }) {
  const user = auth.currentUser;
  if (!user) throw Object.assign(new Error("no user"), { code: "auth/requires-recent-login" });
  if (providersOf(user).includes("password")) {
    if (!password) throw Object.assign(new Error("missing password"), { code: "auth/missing-password" });
    await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, password));
  } else {
    await reauthenticateWithPopup(user, new GoogleAuthProvider());
  }
  await ensureFreshVerifiedToken();
  if (typeof supprimerAnnonces === "function") await supprimerAnnonces(user.uid);
  await deleteDoc(doc(db, "users", user.uid));
  await deleteUser(user);
}
