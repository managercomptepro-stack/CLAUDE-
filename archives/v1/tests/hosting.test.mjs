// Vérifie la configuration d'hébergement (firebase.json) avec le code même
// de firebase-tools :
//  - listFiles : la liste exacte des fichiers envoyés par `firebase deploy`
//    (l'émulateur Hosting, lui, ignore la clé "ignore" et sert tout) ;
//  - superstatic : le calcul des en-têtes par adresse ;
// puis contrôle que chaque lien local des pages publiées pointe vers un
// fichier réellement publié.
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { listFiles } = require("firebase-tools/lib/listFiles.js");
const patterns = require("superstatic/lib/utils/patterns.js");
// glob-slasher s'appuie sur path.join : sous Windows il produit des « \ ».
// La production tourne sous Linux, on remet donc des « / ».
const slasher = (u) => require("glob-slasher")(u).split("\\").join("/");

const root = new URL("..", import.meta.url);
const cfg = JSON.parse(readFileSync(new URL("firebase.json", root), "utf8")).hosting;
const published = new Set(listFiles(root.pathname.replace(/^\/([A-Za-z]:)/, "$1"), cfg.ignore));

let pass = 0, fail = 0;
function check(name, ok, detail) {
  if (ok) { pass++; console.log("  OK   " + name); }
  else { fail++; console.log("  FAIL " + name + (detail ? " -> " + detail : "")); }
}

console.log("Fichiers publiés");
const LIVE = ["index.html", "recherche.html", "connexion.html", "verifier-email.html", "compte.html",
  "publier.html", "annonce.html", "404.html", "cgu.html", "confidentialite.html",
  "mentions-legales.html", "regles.html", "securite.html"];
for (const f of [...LIVE, "css/tokens.css", "css/app.css", "css/legal.css", "css/form.css", "js/config.js", "js/annonces.js",
  "js/nioxxer-auth.js", "js/firebase-config.js", "js/auth-guard.js", "js/disposable-domains.js",
  "img/logo.webp", "img/logo.png", "og-image.png", "favicon.svg", "robots.txt", "sitemap.xml"])
  check("publié : " + f, published.has(f));

console.log("Fichiers qui ne doivent JAMAIS être publiés");
for (const f of [...published]) {
  const bad = /^(\.|node_modules\/|tests\/|archives\/)|(^|\/)\.[^/]+/.test(f)
    || /\.(md|zip|sh|rules)$/.test(f)
    || ["firebase.json", "package.json", "package-lock.json", "logo-removebg.png", "CLAUDE_md_ajout.txt",
        "config_dns_firebase.txt", "firestore.indexes.json"].includes(f)
    || /\.log$/.test(f);
  if (bad) check("exclu : " + f, false, "serait publié");
}
check(`aucun fichier interdit parmi les ${published.size} publiés`, true);
check("liste raisonnable (< 60 fichiers)", published.size < 60, published.size + " : " + [...published].join(", "));

console.log("Liens locaux des pages publiées");
for (const page of LIVE) {
  const html = readFileSync(new URL(page, root), "utf8");
  const refs = [...html.matchAll(/(?:href|src|srcset)="([^"#?]+)[^"]*"/g)].map(m => m[1])
    .concat([...html.matchAll(/(?:location\.(?:assign|replace)|import)\(\s*['"]\.?\/?([^'"?#]+)/g)].map(m => m[1]))
    .filter(u => !/^(https?:|mailto:|data:|\/\/)/.test(u) && u !== "/" && !u.includes("'+"));
  for (const u of new Set(refs)) {
    const f = u.replace(/^\.?\//, "").replace(/\/$/, "") || "index.html";
    check(`${page} → ${u}`, published.has(f) || published.has(f + ".html"), "introuvable dans la publication");
  }
}

console.log("En-têtes (moteur superstatic, dernière règle gagnante)");
function headersFor(url) {
  const out = {};
  for (const rule of cfg.headers) {
    if (patterns.configMatcher(slasher(url), { ...rule, source: slasher(rule.source) }))
      for (const h of rule.headers) out[h.key.toLowerCase()] = h.value;
  }
  return out;
}
for (const u of ["/", "/cgu", "/nioxxer-recherche-v2", "/js/config.js", "/css/tokens.css", "/sitemap.xml"]) {
  const h = headersFor(u);
  check(`${u} : Cache-Control no-cache`, h["cache-control"] === "no-cache", h["cache-control"]);
  check(`${u} : nosniff`, h["x-content-type-options"] === "nosniff");
  // Pas de X-Frame-Options : l'iframe de Firebase Auth (/__/auth/iframe) est
  // servie par ce même hébergement ; DENY y bloquerait la connexion Google.
  check(`${u} : pas de X-Frame-Options`, !("x-frame-options" in h));
}
for (const u of ["/img/logo.webp", "/img/logo.png", "/og-image.png", "/favicon.svg"]) {
  const h = headersFor(u);
  check(`${u} : cache 7 jours`, h["cache-control"] === "public, max-age=604800", h["cache-control"]);
}

console.log("Redirections des anciennes adresses (301)");
{
  const R = Object.fromEntries((cfg.redirects || []).map(r => [r.source, r]));
  for (const [ancienne, nouvelle] of [["/nioxxer-accueil", "/"], ["/nioxxer-recherche-v2", "/recherche"],
      ["/nioxxer-connexion-v2", "/connexion"], ["/nioxxer-compte-annonces-v2", "/compte"], ["/verify-email", "/verifier-email"],
      ["/nioxxer-annonce", "/annonce"], ["/nioxxer-publier-v2", "/publier"]])
    for (const src of [ancienne, ancienne + ".html"])
      check(`${src} → ${nouvelle}`, R[src] && R[src].destination === nouvelle && R[src].type === 301, JSON.stringify(R[src]));
  for (const r of cfg.redirects) check(`destination publiée : ${r.destination}`,
    published.has((r.destination.slice(1) || "index") + ".html"));
}

console.log("Page 404");
check('404.html porte <base href="/"> (liens valables sur /a/b/c)', readFileSync(new URL("404.html", root), "utf8").includes('<base href="/">'));

console.log(`\n${pass} OK, ${fail} FAIL`);
process.exit(fail ? 1 : 0);
