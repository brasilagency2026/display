# Boutique de displays acrílicos com QR Code e NFC

Boutique e-commerce brésilienne (interface en PT-BR). Cahier des charges : voir le document de référence du projet.

## Stack

React 19 + Vite + TypeScript + Tailwind CSS 4 · Convex (backend, base de données, auth) · Vercel (frontend statique).

## État actuel

Fonctionne :
- Boutique PT-BR : accueil, loja (recherche, catégories, tri), fiche produit (options + designs prédéfinis), panier recalculé côté serveur, connexion/inscription, compte
- Administration `/admin` : produits, options/variantes, stock, catégories, designs, images, paramètres de la boutique et du frete (voir `docs/ADMIN_GUIDE.md`)
- Schéma Convex complet, contrôle d'accès centralisé, journal d'audit
- Règles de prix et de livraison PAC/SEDEX + supplément configurable, avec tests (`npm test`)
- Build statique Vercel + déploiement Convex automatique (`vercel.json`, variable `CONVEX_DEPLOY_KEY`)

Pas encore fait : checkout, appels réels Melhor Envio, Mercado Pago, commandes/production QR-NFC, affiliation, Mercado Livre. Ces modules attendent leurs identifiants ; rien n'est simulé comme « réel ».

## Démarrage local

```bash
npm install
cp .env.example .env.local      # renseigner VITE_CONVEX_URL après l'étape Convex
npx convex dev                  # crée le déploiement Convex dev et génère convex/_generated
npx @convex-dev/auth            # configure les clés JWT de Convex Auth
npm run dev
```

Scripts : `npm run dev`, `npm run build`, `npm test`, `npm run typecheck`.

## Déploiement Vercel (via GitHub)

1. Importer le dépôt dans Vercel (framework Vite détecté, `vercel.json` fourni).
2. Variables d'environnement du projet : `VITE_CONVEX_URL`, `VITE_STORE_NAME`, `VITE_STORE_URL`.
3. Déployer le backend séparément : `npx convex deploy`, puis utiliser l'URL du déploiement de production pour `VITE_CONVEX_URL`.

Les secrets (Mercado Pago, Melhor Envio, Mercado Livre) se configurent uniquement dans Convex (`npx convex env set`), jamais en `VITE_`.

## Points à confirmer avec le propriétaire

Nom de marque, domaine, logo, CEP d'origine, dimensions/poids des emballages, catalogue réel, taux d'affiliation, contacts, informations légales.
