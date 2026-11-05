# Guide d'administration

## Devenir administrateur

1. Créer un compte sur le site (`/entrar` → « Criar conta »).
2. Attribuer le rôle depuis la ligne de commande (fonction interne, non appelable depuis le navigateur) :

```bash
# cmd.exe (Windows)
npx convex run admin:setUserRole "{\"email\":\"vous@exemple.com\",\"role\":\"super_admin\"}" --prod

# bash / zsh
npx convex run admin:setUserRole '{"email":"vous@exemple.com","role":"super_admin"}' --prod
```

Sans `--prod`, la commande vise le déploiement de développement. Les rôles sont `super_admin`, `admin`, `customer`, `affiliate`.
Ensuite, `/admin` est accessible (reconnexion éventuelle).

> Le contrôle d'accès réel est dans chaque fonction Convex (`requireAdmin`). Masquer l'écran côté navigateur n'est qu'un confort.

## Menus

| Menu | Rôle |
| --- | --- |
| Painel | Produits/designs publiés, commandes, faturamento aprovado, estoque baixo |
| Produtos | Création, édition, publication, archivage ; images ; options (variantes) |
| Categorias | Nom, slug, description, image, ordre, publication |
| Designs | Modèles graphiques, suppléments, produits et technologies compatibles |
| Estoque | Ajustement du stock par option (historique enregistré) |
| Configurações | Infos de la boutique, CEP d'origine, acréscimo de frete, PAC/SEDEX |

## Règles à connaître

- **Designs** : seul l'administrateur les crée ; les clients ne peuvent que choisir parmi les designs publiés. Un design n'est jamais supprimé, seulement archivé (les commandes y feront référence).
- **Prix** : prix final = prix base + ajustement de l'option + supplément du design. Les montants se saisissent en reais (`49,90`) et sont stockés en centavos. Le serveur recalcule toujours les prix.
- **Produit sans option** : vendu au prix base. Dès qu'une option existe, le client doit en choisir une.
- **Stock** : « Controlar estoque » désactivé = pas de limite. Seuil d'alerte par option (5 par défaut).
- **Images** : JPG, PNG, WebP ou AVIF, 5 Mo max, 10 par produit. Pour la rapidité, préférer AVIF ou WebP d'environ 1200 à 1600 px de large : les images sont servies telles quelles, sans redimensionnement. Type et taille sont revérifiés côté serveur. La première image est la principale. Une image retirée est supprimée du stockage à l'enregistrement.
- **Frete** : le supplément (5,00 au départ) est ajouté une fois par commande. Seuls Correios PAC et SEDEX seront proposés.
- **Données DEMO** : marquées « DEMO ». Suppression : `npx convex run seed:removeDemo [--prod]`.

## Journal d'audit

Chaque création/modification (produit, option, design, catégorie, stock, paramètres, rôle) écrit une ligne dans `auditLogs` (acteur, action, entité). Aucun secret n'y est stocké.
