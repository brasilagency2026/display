# Frete — Melhor Envio (Correios PAC et SEDEX)

## Ce qui est en place

- Calcul du frete dans le panier : le client saisit son CEP, le **serveur** interroge Melhor Envio, ne garde que **Correios PAC et SEDEX**, ajoute le **supplément configurable** (5,00 au départ, une seule fois par option) et renvoie le prix final.
- Le navigateur n'envoie ni prix ni service : seulement le CEP et les identifiants/quantités du panier. Prix, poids et dimensions sont recalculés côté serveur.
- Chaque cotation est enregistrée (`shippingQuotes`) avec tarif Melhor Envio, supplément et prix client, valable **30 minutes** (l'API ne fournit pas d'expiration). Une cotation identique encore valide est réutilisée ; une cotation expirée est recalculée.
- Connexion OAuth à Melhor Envio depuis `/admin/configuracoes`, renouvellement automatique du token (tâche quotidienne).
- Le client ne voit que le prix final. Le détail (tarif réel + supplément) est conservé en base pour l'administration.

**Pas encore fait** : achat d'étiquette, impression, suivi (phase commandes/production, après le paiement). Les droits OAuth demandés se limitent donc à `shipping-calculate` ; il faudra reconnecter le compte avec des droits supplémentaires à ce moment-là.

## Mise en route (sandbox d'abord)

Sandbox et production sont deux environnements **indépendants**, avec chacun son compte et son application.

1. Créer un compte sur https://sandbox.melhorenvio.com.br.
2. Dans le panneau : **Integrações → Área Dev. → Cadastrar Aplicativo**. Renseigner le nom, les e-mails de contact et, comme **URL de callback**, l'adresse affichée dans `/admin/configuracoes` (quadro « Melhor Envio »), du type `https://<déploiement>.convex.site/melhorenvio/callback`. Elle doit être identique à celle enregistrée, sinon l'API répond `Client invalid`. Noter le **Client ID** et le **Secret**.
3. Poser les secrets dans Convex (jamais dans le dépôt ni dans Vercel) :

```bash
# cmd.exe / bash — ajouter --prod pour le déploiement de production
npx convex env set MELHOR_ENVIO_CLIENT_ID 12345 --prod
npx convex env set MELHOR_ENVIO_CLIENT_SECRET "le-secret" --prod
npx convex env set MELHOR_ENVIO_ENV sandbox --prod        # sandbox (défaut) ou production
```

4. Dans `/admin/configuracoes` : renseigner l'**e-mail de contact** de la boutique (l'API l'exige dans l'en-tête `User-Agent`, jamais un e-mail personnel) et le **CEP d'origine**, puis cliquer sur **Conectar ao Melhor Envio** et autoriser l'application.
5. Tester dans le panier d'un produit réel : PAC et/ou SEDEX doivent apparaître avec le supplément inclus.

Pour passer en production : créer l'application dans l'environnement de production, remplacer `MELHOR_ENVIO_CLIENT_ID`, `MELHOR_ENVIO_CLIENT_SECRET` et `MELHOR_ENVIO_ENV=production`, puis reconnecter le compte.

## Mode simulation (développement uniquement)

`npx convex env set SHIPPING_MOCK true` affiche des tarifs **fictifs** (avec un bandeau « Valores de teste ») pour tester l'interface sans compte. Il est **ignoré** quand `MELHOR_ENVIO_ENV=production`. Le retirer avec `npx convex env remove SHIPPING_MOCK`.

## Tokens et sécurité

- Le token d'accès dure 30 jours et le token de rafraîchissement 45 jours (documentation officielle). Une tâche quotidienne (`crons.ts`) renouvelle le token 7 jours avant l'expiration ; un renouvellement est aussi tenté au moment d'une cotation si nécessaire. Si le renouvellement échoue, `/admin/configuracoes` montre « Conta conectada : Pendente » et il faut reconnecter.
- Les jetons changent à chaque renouvellement : ils ne peuvent pas vivre dans des variables d'environnement. Ils sont stockés dans la table `integrationTokens`, **réservée au serveur** : aucune fonction publique ne la lit, et l'interface admin n'affiche que des indicateurs (jamais le token ni le secret). Les secrets Client ID/Secret restent dans les variables Convex.
- Le paramètre `state` de l'autorisation est aléatoire, à usage unique, lié à l'administrateur et valable 10 minutes.

## Points à confirmer pendant les tests en sandbox

La documentation officielle ne précise pas tout ; ces hypothèses sont isolées dans `shared/melhorEnvio.ts` et `shared/shipping.ts` :

- **Noms des services** : le filtre garde les entrées dont la société contient « Correios » et dont le nom est exactement `PAC` ou `SEDEX` (donc pas `SEDEX 10`, `Mini Envios`, etc.). À vérifier avec la vraie réponse.
- **Unité du délai** (`delivery_time`) : non précisée par la documentation ; l'interface affiche « N dias ».
- **Prix** : le code utilise `custom_price` (recommandé par la documentation) sinon `price`.
- **Échange du code / renouvellement** : envoyés en `application/x-www-form-urlencoded` (les routes OAuth ne prennent pas du JSON). La documentation est ambiguë sur les paramètres exacts du renouvellement ; à confirmer.
- **Valeur déclarée** : fixée à 0 pour l'instant.

## Limites connues

- La cotation est publique (un client invité doit pouvoir calculer son frete) : chaque appel distinct déclenche une requête vers Melhor Envio. Le cache par empreinte limite les répétitions ; une limitation de débit plus stricte est prévue à la phase de préparation à la production.
- Les prix d'une cotation ne sont pas encore reliés à une commande : le checkout (phase suivante) devra revalider la cotation choisie (`quoteId`) côté serveur.
