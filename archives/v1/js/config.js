/* Configuration NIOXXER — valeurs partagées par tous les écrans.
 *
 * Script classique (pas un module) : chargé par <script src="/js/config.js">
 * avant le script de la page, il expose ses constantes globalement et
 * fonctionne aussi en ouvrant les fichiers en local (file://).
 *
 * CLAUDE.md rule 10 : le numéro NIOXXER vit dans la configuration, jamais
 * recopié en dur dans le code d'un écran. Les pages légales affichent en
 * revanche ce numéro directement dans leur HTML : la loi 2010/021 impose
 * que les coordonnées de contact restent lisibles sans JavaScript.
 */

const NIOXXER_WA = '237678802447';

/* Message pré-rempli du bouton Contacter (CLAUDE.md § Contact). */
const NIOXXER_WA_MESSAGE =
  'Bonjour, je vous contacte depuis NIOXXER au sujet de votre annonce.';

/* Seuil de majorité, en jours — CLAUDE.md rule 4.
 *
 * DOIT rester identique à firestore.rules (duration.value(6575, 'd')).
 * 18 ans valent 6574 ou 6575 jours selon les années bissextiles traversées ;
 * on retient la borne haute pour ne jamais laisser passer un mineur.
 *
 * Le contrôle du formulaire utilisait « age >= 18 », plus permissif que les
 * règles : une date acceptée à l'écran pouvait ensuite être refusée par
 * Firestore, et l'utilisateur recevait une erreur de permissions brute.
 * Les deux seuils doivent bouger ensemble. */
const SEUIL_MAJORITE_JOURS = 6575;

/* Échappement HTML — obligatoire pour toute donnée saisie par un utilisateur
 * (prénom, quartier, texte d'annonce, e-mail…) avant de l'insérer via
 * innerHTML ou insertAdjacentHTML. Sans cela, une annonce contenant
 * <img src=x onerror=…> exécuterait du code chez chaque visiteur du fil. */
function nxEsc(v){
  return String(v == null ? '' : v)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

/* Contrôles du texte d'une annonce — MÊMES motifs que firestore.rules
 * (fonctions coordonnees / suspect) ; tests/config.test.mjs le vérifie.
 * Appliqués au texte mis en minuscules. */
const NIOXXER_RE_COORDONNEES =
  '([0-9]([ ./-]?[0-9]){7}|wa[.]me|whatsapp[.]com|@[a-z0-9-]+[.][a-z]{2,})';
const NIOXXER_RE_SUSPECT =
  '(escort|massage|bizi|tarif|payant|cfa|cash|money|sponsor|wolowoss|tchoko|short ?time|shot ?time|long ?time|per night|par nuit|une passe|ndolo payant|pay me|r[eé]mun[eé]r)';
function texteContientCoordonnees(t){ return new RegExp(NIOXXER_RE_COORDONNEES,'s').test(String(t||'').toLowerCase()); }
function texteSuspect(t){ return new RegExp(NIOXXER_RE_SUSPECT,'s').test(String(t||'').toLowerCase()); }

/* Âge révolu — même formule que firestore.rules (ageDe) :
 * année moyenne de 365,2425 jours. */
function ageDepuis(naissance, maintenant){
  const n = naissance instanceof Date ? naissance.getTime() : +naissance;
  return Math.floor(((maintenant || Date.now()) - n) / 31556952000);
}

/* Numéro WhatsApp — normalisé au format exigé par firestore.rules :
 * +2376XXXXXXXX (mobile camerounais). Accepte « 6 78 80 24 47 »,
 * « 678802447 », « +237 678 80 24 47 », « 00237678802447 »…
 * Renvoie null si le champ est vide, false si le numéro n'est pas valide. */
function normaliserWhatsApp(raw){
  let d = String(raw == null ? '' : raw).replace(/[\s.\-()]/g,'');
  if (!d) return null;
  d = d.replace(/^(\+|00)?237/,'');
  return /^6\d{8}$/.test(d) ? '+237' + d : false;
}
/* Affichage lisible d'un numéro normalisé : « 6 78 80 24 47 ». */
function afficherWhatsApp(n){
  const d = String(n || '').replace(/^\+237/,'');
  return /^6\d{8}$/.test(d) ? d.replace(/^(\d)(\d{2})(\d{2})(\d{2})(\d{2})$/,'$1 $2 $3 $4 $5') : String(n || '');
}

/* ── Comportements partagés ──────────────────────────────────────────
 * Les boutons Retour des en-têtes n'avaient aucun gestionnaire : ils
 * étaient décoratifs. On les câble ici une fois pour toutes les pages
 * qui chargent ce fichier, plutôt que de recopier le même handler.
 * Repli sur l'accueil quand la page est ouverte directement (pas
 * d'historique à remonter, cas d'un lien partagé sur WhatsApp). */
document.querySelectorAll('[aria-label="Retour"]').forEach(function (b) {
  if (b.dataset.backWired) return;
  b.dataset.backWired = '1';
  b.addEventListener('click', function () {
    if (history.length > 1) history.back();
    else location.assign('/');
  });
});

/* Quartiers par ville — CLAUDE.md : les quartiers sont propres a chaque
 * ville, on n'affiche jamais ceux de Douala ailleurs. Table partagee :
 * elle ne vivait que dans la page Recherche, et la page Publier
 * l'utilisait sans l'avoir definie (ReferenceError, selecteur casse). */
const NIOXXER_QUARTIERS={
 'Douala':['Akwa','Bonapriso','Deido','Makepe','Bonamoussadi','Bali','Bonanjo','New Bell','Ndokotti','Logbessou','Bépanda','PK14'],
 'Yaoundé':['Bastos','Essos','Mvog-Mbi','Biyem-Assi','Nlongkak','Mvan','Ngousso','Odza','Nkolbisson','Mokolo','Emana','Mendong'],
 'Garoua':['Poumpoumré','Roumdé Adjia','Djamboutou','Yelwa','Foulbéré'],
 'Bamenda':['Nkwen','Mankon','Up Station','Ntarinkon','Bambili','Mile 4','Old Town'],
 'Maroua':['Domayo','Djarengol','Kakataré','Founangué','Palar'],
 'Bafoussam':['Tamdja','Djeleng','Kamkop','Banengo','Tougang','Ndiendam'],
 'Ngaoundéré':['Baladji','Dang','Mbideng','Burkina','Bamyanga'],
 'Bertoua':['Nkolbikon','Mokolo','Madagascar','Enia','Tigaza'],
 'Edéa':['Ekité','Mbanda','Bilalang','Pongo'],
 'Loum':['Loum Ville','Loum Chantier','Njombé'],
 'Kumba':['Fiango','Kosala','Buea Road','Mambanda','Three Corners'],
 'Nkongsamba':['Bonaberi','Ekanang','Nlonako','Quartier Haoussa'],
 'Buea':['Molyko','Bonduma','Great Soppo','Muea','Bokwango','Mile 16'],
 'Kumbo':['Tobin','Squares','Mbveh','Romajay'],
 'Foumban':['Njisse','Mantoum','Koutaba Road','Palais'],
 'Dschang':['Foto','Foreke','Paid Ground','Campus'],
 'Ebolowa':['Angale','Mvog-Betsi','Elat','Nkoemvone'],
 'Kousséri':['Madagascar','Lycee','Douanes','Gaya'],
 'Guider':['Mayo-Louti','Bidzar','Djaba'],
 'Mbouda':['Bamendjinda','Bamesso','Centre Ville'],
 'Limbé':['Down Beach','Mile 4','Bota','Isokolo','New Town','Church Street'],
 'Kribi':['Dombe','Mpangou','Talla','Mboa Manga','Centre'],
 'Bafang':['Banka','Bakou','Famleng','Centre Ville'],
 'Tiko':['Likomba','Holforth','Missellele','Ombe'],
 'Mbalmayo':['Nkolyem','Abang','Mekomba','Centre'],
 'Sangmélima':['Akon','Mekomo','Centre Ville'],
 'Meiganga':['Baboua','Kombo Laka','Centre'],
 'Bafia':['Bakoa','Nyokon','Centre Ville']
};
