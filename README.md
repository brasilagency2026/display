# Boutique de displays acrílicos com QR Code e NFC

Boutique e-commerce brésilienne (interface en PT-BR). Cahier des charges : voir le document de référence du projet.

## Stack

React 19 + Vite + TypeScript + Tailwind CSS 4 · Convex (backend, base de données, auth) · Vercel (frontend statique).

## État actuel — Phase 0 (fondations)

Fonctionne :
- Frontend Vite/React/Tailwind, routes de base, formats BRL / CEP / dates `dd/mm/aaaa`
- Build statique (`dist/`) compatible Vercel, avec réécriture SPA (`vercel.json`)
- Schéma Convex complet (catalogue, designs admin-only, commandes à 3 statuts séparés, paiements, expéditions, QR/NFC, affiliés, Mercado Livre, audit)
- Contrôle d'accès centralisé côté backend (`convex/access.ts`)
- Logique de livraison PAC/SEDEX + supplément configurable (`shared/shipping.ts`) avec tests

Pas encore fait (phases suivantes) : pages catalogue/panier/checkout, administration, appels réels Melhor Envio, Mercado Pago, affiliation, Mercado Livre. Rien n'est simulé comme « réel » : ces modules attendent leurs identifiants.

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
