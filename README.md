# Craquage by Kiabi

Prototype d'app « swipe » pour les articles femme Kiabi : on glisse à droite (**Go**) ou à gauche (**No go**), on change de couleur en touchant la photo, on garde ses envies, on découvre son style et on achète en un clic sur kiabi.com.

> Projet réalisé avec l'accord de Kiabi. Lien à ne pas diffuser avant validation.

## Utiliser l'app

- **Adresse** : `https://lmcfly.github.io/craquage-by-kiabi/` (une fois GitHub Pages activé, voir plus bas).
- **iPhone** : ouvrir l'adresse dans Safari → bouton Partager → **Sur l'écran d'accueil**.
- **Android** : ouvrir l'adresse dans Chrome → menu ⋮ → **Installer l'application**.
- Dans l'app, l'écrou en haut à droite (**Réglages**) propose aussi le raccourci, le mode jour/nuit, la langue (français, anglais, espagnol, allemand) et la suppression des données.

Les choix (Go, No go, couleurs, looks, réglages) sont enregistrés uniquement sur le téléphone.

## Le catalogue

- **Uniquement femme, uniquement marque Kiabi** (web et magasin, pas de marketplace) : le robot applique les filtres du site « Marques › Kiabi » et « Genre › Femme », écarte les tailles enfant/bébé et les noms qui contiennent homme, enfant, fille, garçon ou bébé.
- **Un peu de tout** : aucune catégorie ne dépasse 22 % du catalogue ; sur « Tout », l'app alterne les catégories (jamais deux fois la même d'affilée) tout en tenant compte des goûts.
- **Nouveautés automatiques** : chaque nuit, le robot lit chaque rayon trié par « Nouveautés », note la date d'arrivée des articles ; l'app glisse les nouveautés au début de la pile avec un badge **Nouveau** (7 jours).
- **Garde-fou** : si le robot récupère moins de la moitié des articles de la veille (blocage, panne), l'ancien catalogue est conservé.

## Ce qu'il y a dans le dépôt

| Fichier | Rôle |
|---|---|
| `index.html` | L'app (animation d'ouverture, swipe, catégories, mes envies, mes styles, partage) |
| `data/products.json` | Le catalogue Kiabi (articles, prix, couleurs, liens, photos) |
| `scripts/update-catalog.mjs` | Le robot qui récupère le catalogue sur les pages thématiques kiabi.com |
| `scripts/pages.json` | La liste des rayons parcourus : ajouter une page `/v/...` ici pour élargir le catalogue |
| `manifest.webmanifest`, `sw.js`, `icons/` | Installation sur l'écran d'accueil et ouverture hors ligne |
| `.github/workflows/deploy.yml` | Met le site en ligne à chaque modification |
| `.github/workflows/update-catalog.yml` | Met le catalogue à jour chaque nuit, puis remet le site en ligne |

Les photos ne sont pas stockées ici : elles sont affichées directement depuis `static.kiabi.com`.

## Activer le site (une seule fois)

1. Dans le dépôt : **Settings** → **Pages**.
2. **Source** : choisir **GitHub Actions**.
3. Onglet **Actions** → **Mise en ligne (GitHub Pages)** → **Run workflow**.

## Mettre à jour le catalogue à la main

Onglet **Actions** → **Mise à jour du catalogue Kiabi** → **Run workflow**. Si Kiabi bloque le robot, le catalogue existant est conservé.

En local :

```bash
npm install
npx playwright install chromium
npm run update-catalog
```
