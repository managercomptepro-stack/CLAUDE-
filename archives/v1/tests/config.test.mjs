// Tests unitaires de js/config.js (normalisation WhatsApp, échappement HTML).
// config.js est un script classique pour le navigateur : on l'exécute dans
// un bac à sable avec un `document` minimal.
import { readFileSync } from "node:fs";
import vm from "node:vm";

const ctx = { document: { querySelectorAll: () => [] }, history: {}, location: {} };
vm.createContext(ctx);
vm.runInContext(readFileSync(new URL("../js/config.js", import.meta.url), "utf8") +
  "\n;globalThis.__api={normaliserWhatsApp,afficherWhatsApp,nxEsc,SEUIL_MAJORITE_JOURS};", ctx);
const { normaliserWhatsApp, afficherWhatsApp, nxEsc, SEUIL_MAJORITE_JOURS } = ctx.__api;

let pass = 0, fail = 0;
function eq(name, got, want) {
  if (got === want) { pass++; console.log("  OK   " + name); }
  else { fail++; console.log(`  FAIL ${name} : obtenu ${JSON.stringify(got)}, attendu ${JSON.stringify(want)}`); }
}

console.log("normaliserWhatsApp");
eq("vide -> null", normaliserWhatsApp(""), null);
eq("espaces seuls -> null", normaliserWhatsApp("   "), null);
eq("6 78 80 24 47", normaliserWhatsApp("6 78 80 24 47"), "+237678802447");
eq("678802447", normaliserWhatsApp("678802447"), "+237678802447");
eq("+237 678 80 24 47", normaliserWhatsApp("+237 678 80 24 47"), "+237678802447");
eq("00237678802447", normaliserWhatsApp("00237678802447"), "+237678802447");
eq("237-678-802-447", normaliserWhatsApp("237-678-802-447"), "+237678802447");
eq("8 chiffres -> invalide", normaliserWhatsApp("67880244"), false);
eq("fixe 233… -> invalide", normaliserWhatsApp("233421234"), false);
eq("étranger -> invalide", normaliserWhatsApp("+33612345678"), false);
eq("lettres -> invalide", normaliserWhatsApp("6abc"), false);
eq("affichage", afficherWhatsApp("+237678802447"), "6 78 80 24 47");

console.log("nxEsc");
eq("balise neutralisée", nxEsc('<img src=x onerror="a()">'), "&lt;img src=x onerror=&quot;a()&quot;&gt;");
eq("apostrophe et &", nxEsc("l'a & b"), "l&#39;a &amp; b");
eq("null -> vide", nxEsc(null), "");
eq("nombre", nxEsc(25), "25");

console.log("Contrôles du texte d'annonce");
{
  const api = vm.runInContext("({texteContientCoordonnees,texteSuspect,ageDepuis,NIOXXER_RE_COORDONNEES,NIOXXER_RE_SUSPECT})", ctx);
  const rulesSrc = readFileSync(new URL("../firestore.rules", import.meta.url), "utf8");
  eq("motif coordonnées identique à firestore.rules", rulesSrc.includes("'(?s).*" + api.NIOXXER_RE_COORDONNEES + ".*'"), true);
  eq("motif suspect identique à firestore.rules", rulesSrc.includes("'(?s).*" + api.NIOXXER_RE_SUSPECT + ".*'"), true);
  eq("numéro collé refusé", api.texteContientCoordonnees("appelle moi 678802447 ok"), true);
  eq("numéro espacé refusé", api.texteContientCoordonnees("6 78 80 24 47"), true);
  eq("numéro avec points refusé", api.texteContientCoordonnees("6.78.80.24.47"), true);
  eq("lien wa.me refusé", api.texteContientCoordonnees("écris sur WA.ME/237"), true);
  eq("e-mail refusé", api.texteContientCoordonnees("moi@gmail.com"), true);
  eq("âge et année acceptés", api.texteContientCoordonnees("J'ai 25 ans, née en 1999, 1m70"), false);
  eq("texte normal non suspect", api.texteSuspect("Je cherche une relation sérieuse à Douala"), false);
  eq("escort suspect", api.texteSuspect("Escorte disponible"), true);
  eq("tarif suspect", api.texteSuspect("Tarifs raisonnables"), true);
  eq("FCFA suspect", api.texteSuspect("10 000 FCFA la nuit"), true);
  eq("pidgin wolowoss suspect", api.texteSuspect("no be wolowoss"), true);
  eq("short time suspect", api.texteSuspect("short time or long time"), true);
  eq("ndolo payant suspect", api.texteSuspect("ndolo payant seulement"), true);
  eq("rémunération suspecte", api.texteSuspect("contre rémunération"), true);
  eq("suspect sur plusieurs lignes", api.texteSuspect("bonjour\nmassage relaxant"), true);
  const n = new Date(Date.UTC(2000, 0, 15));
  eq("âge : veille de l'anniversaire", api.ageDepuis(n, Date.UTC(2026, 0, 13)), 25);
  eq("âge : lendemain de l'anniversaire", api.ageDepuis(n, Date.UTC(2026, 0, 17)), 26);
}

console.log("Seuil de majorité");
const rules = readFileSync(new URL("../firestore.rules", import.meta.url), "utf8");
eq("même seuil que firestore.rules", rules.includes(`duration.value(${SEUIL_MAJORITE_JOURS}, 'd')`), true);

console.log(`\n${pass} OK, ${fail} FAIL`);
process.exit(fail ? 1 : 0);
