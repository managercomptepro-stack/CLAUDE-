/* ──────────────────────────────────────────
   NIOXXER — Auth & Profile (Firebase)
   ────────────────────────────────────────── */

// ── Firebase config ─────────────────────────
const firebaseConfig = {
  apiKey: "AIzaSyBQz0NOIbDahSMyZLCKutn3vgKHVte9a0o",
  authDomain: "nioxxer-cda95.firebaseapp.com",
  projectId: "nioxxer-cda95",
  storageBucket: "nioxxer-cda95.firebasestorage.app",
  messagingSenderId: "933001931493",
  appId: "1:933001931493:web:a7f547b5f18a5a1621c20c"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db   = firebase.firestore();

// ── UI helpers ──────────────────────────────
function showPage(page) {
  document.querySelectorAll('[id^="page-"]').forEach(el => {
    el.classList.remove('active');
    if (el.id === 'page-home') el.style.display = 'none';
  });
  const target = document.getElementById('page-' + page);
  if (target) {
    if (page === 'home') {
      target.style.display = 'block';
    } else {
      target.classList.add('active');
    }
  }
  window.scrollTo(0, 0);
}

function showLoading(on) {
  document.getElementById('loading').classList.toggle('active', on);
}

function toast(msg, type) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className = 'toast ' + (type || 'info');
  el.classList.add('show');
  clearTimeout(el._timer);
  el._timer = setTimeout(() => el.classList.remove('show'), 4000);
}

function updateNav(user) {
  document.getElementById('nav-guest').style.display = user ? 'none' : '';
  document.getElementById('nav-user').style.display  = user ? '' : 'none';
}

function showVerifyBanner(show) {
  document.getElementById('verify-banner').style.display = show ? 'block' : 'none';
}

// ── Age check (18+) ─────────────────────────
function isAtLeast18(dateStr) {
  const birth = new Date(dateStr);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age >= 18;
}

// ── Auth state listener ─────────────────────
auth.onAuthStateChanged(async (user) => {
  updateNav(user);
  if (user) {
    // Reload to get latest emailVerified status
    await user.reload();
    const fresh = auth.currentUser;

    if (!fresh.emailVerified) {
      showVerifyBanner(true);
      showPage('home');
      toast("Verifiez votre e-mail pour acceder a votre profil.", "info");
      return;
    }

    showVerifyBanner(false);

    // Load profile
    try {
      const doc = await db.collection('users').doc(fresh.uid).get();
      if (doc.exists) {
        const d = doc.data();
        document.getElementById('prof-nom').value = d.nom || '';
        if (d.naissance && d.naissance.toDate) {
          const dt = d.naissance.toDate();
          document.getElementById('prof-naissance').value = dt.toISOString().split('T')[0];
        }
        document.getElementById('prof-genre').value    = d.genre || '';
        document.getElementById('prof-ville').value    = d.ville || '';
        document.getElementById('prof-whatsapp').value = d.whatsapp || '';
        showPage('home');
      } else {
        // No profile yet — show profile form
        showPage('profile');
        toast("Completez votre profil pour continuer.", "info");
      }
    } catch (e) {
      console.error('Firestore read error:', e);
      showPage('profile');
    }
  } else {
    showVerifyBanner(false);
    showPage('home');
  }
});

// ── Email registration ──────────────────────
async function registerEmail(e) {
  e.preventDefault();
  const email = document.getElementById('reg-email').value.trim();
  const pw    = document.getElementById('reg-password').value;
  const pw2   = document.getElementById('reg-password2').value;

  if (pw !== pw2) { toast("Les mots de passe ne correspondent pas.", "error"); return; }

  showLoading(true);
  try {
    const cred = await auth.createUserWithEmailAndPassword(email, pw);
    await cred.user.sendEmailVerification();
    toast("Compte cree ! Verifiez votre boite mail.", "success");
    showPage('home');
  } catch (err) {
    toast(firebaseError(err), "error");
  }
  showLoading(false);
}

// ── Email login ─────────────────────────────
async function loginEmail(e) {
  e.preventDefault();
  const email = document.getElementById('login-email').value.trim();
  const pw    = document.getElementById('login-password').value;

  showLoading(true);
  try {
    await auth.signInWithEmailAndPassword(email, pw);
    toast("Bienvenue !", "success");
  } catch (err) {
    toast(firebaseError(err), "error");
  }
  showLoading(false);
}

// ── Google sign-in ──────────────────────────
async function loginGoogle() {
  showLoading(true);
  try {
    const provider = new firebase.auth.GoogleAuthProvider();
    await auth.signInWithPopup(provider);
    toast("Bienvenue !", "success");
  } catch (err) {
    if (err.code !== 'auth/popup-closed-by-user') {
      toast(firebaseError(err), "error");
    }
  }
  showLoading(false);
}

// ── Logout ──────────────────────────────────
async function logout() {
  await auth.signOut();
  showPage('home');
  toast("Deconnecte.", "info");
}

// ── Resend verification ─────────────────────
async function resendVerification() {
  try {
    await auth.currentUser.sendEmailVerification();
    toast("E-mail de verification renvoye !", "success");
  } catch (err) {
    toast(firebaseError(err), "error");
  }
}

// ── Save profile to Firestore ───────────────
async function saveProfile(e) {
  e.preventDefault();
  const user = auth.currentUser;
  if (!user) { toast("Connectez-vous d'abord.", "error"); return; }

  await user.reload();
  if (!user.emailVerified) {
    toast("Verifiez votre e-mail avant de completer votre profil.", "error");
    return;
  }

  const nom       = document.getElementById('prof-nom').value.trim();
  const naissance = document.getElementById('prof-naissance').value;
  const genre     = document.getElementById('prof-genre').value;
  const ville     = document.getElementById('prof-ville').value.trim();
  const whatsapp  = document.getElementById('prof-whatsapp').value.trim();

  if (!nom || !naissance || !genre || !ville || !whatsapp) {
    toast("Tous les champs sont obligatoires.", "error");
    return;
  }

  if (!isAtLeast18(naissance)) {
    toast("Vous devez avoir 18 ans minimum.", "error");
    return;
  }

  showLoading(true);
  try {
    await db.collection('users').doc(user.uid).set({
      nom,
      naissance: firebase.firestore.Timestamp.fromDate(new Date(naissance)),
      genre,
      ville,
      whatsapp,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
    toast("Profil enregistre !", "success");
    showPage('home');
  } catch (err) {
    console.error('Firestore write error:', err);
    toast("Erreur : " + err.message, "error");
  }
  showLoading(false);
}

// ── Firebase error messages (FR) ────────────
function firebaseError(err) {
  const map = {
    'auth/email-already-in-use': "Cet e-mail est deja utilise.",
    'auth/invalid-email': "Adresse e-mail invalide.",
    'auth/weak-password': "Mot de passe trop faible (6 caracteres min).",
    'auth/user-not-found': "Aucun compte avec cet e-mail.",
    'auth/wrong-password': "Mot de passe incorrect.",
    'auth/invalid-credential': "Identifiants invalides.",
    'auth/too-many-requests': "Trop de tentatives. Reessayez plus tard.",
    'auth/network-request-failed': "Erreur reseau. Verifiez votre connexion.",
    'auth/popup-blocked': "Popup bloquee. Autorisez les popups pour ce site."
  };
  return map[err.code] || err.message;
}

// ── Init: show home ─────────────────────────
showPage('home');
