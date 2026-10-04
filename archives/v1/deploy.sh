#!/bin/bash
# ═══════════════════════════════════════════════
#  NIOXXER — Script de déploiement Firebase
# ═══════════════════════════════════════════════
# Ce script déploie le site sur Firebase Hosting.
# Exécutez-le depuis le dossier du projet.
#
# Prérequis : Node.js installé sur votre machine.
# ═══════════════════════════════════════════════

set -e

echo ""
echo "╔═══════════════════════════════════════╗"
echo "║   NIOXXER — Déploiement Firebase      ║"
echo "╚═══════════════════════════════════════╝"
echo ""

# 1. Vérifier Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js n'est pas installé."
    echo "   Téléchargez-le : https://nodejs.org"
    exit 1
fi
echo "✅ Node.js $(node -v) détecté"

# 2. Installer Firebase CLI si nécessaire
if ! command -v firebase &> /dev/null; then
    echo "📦 Installation de Firebase CLI..."
    npm install -g firebase-tools
fi
echo "✅ Firebase CLI $(firebase --version) détecté"

# 3. Connexion Firebase
echo ""
echo "🔐 Connexion à Firebase..."
echo "   (Une fenêtre de navigateur va s'ouvrir)"
echo ""
firebase login

# 4. Déploiement — site ET règles Firestore.
#    Les règles portent la barrière 18 ans et le blocage e-mail non vérifié :
#    publier le site sans elles ouvrirait la base.
echo ""
echo "🚀 Déploiement du site et des règles Firestore..."
firebase deploy --only hosting,firestore:rules

echo ""
echo "╔═══════════════════════════════════════╗"
echo "║   ✅ Déploiement terminé !            ║"
echo "║                                       ║"
echo "║   🌐 https://nioxxer-cda95.web.app   ║"
echo "║   🌐 https://nioxxer.com (si DNS OK) ║"
echo "╚═══════════════════════════════════════╝"
echo ""
