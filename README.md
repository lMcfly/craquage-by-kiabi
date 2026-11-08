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
- **Tailles** : pour chaque couleur, le robot note les tailles disponibles (XS à XXL, pointures 35 à 42) grâce au filtre « Taille » des rayons Kiabi. L'app demande la taille au premier lancement (modifiable dans Réglages › Mes infos) et ne montre que ce qui existe dans cette taille.
- **Garde-fou** : si le robot récupère moins de la moitié des articles de la veille (blocage, panne), l'ancien catalogue est conservé.

## Architecture

```
index.html                  Structure de la page (aucun style ni script en ligne)
manifest.webmanifest, sw.js Installation sur l'écran d'accueil et ouverture hors ligne
src/
  styles/
    base.css                Couleurs Kiabi (jour/nuit), typographie, éléments communs
    app.css                 Écrans : en-tête, réglages, cartes, onglets, envies, styles, fiche article
    splash.css              Animation d'ouverture
  js/                       Modules JavaScript (ES modules, sans outil de build)
    app.js                  Point d'entrée : état, algorithme de préférences, swipe, envies, styles, looks, réglages
    profile.js              Mes infos : tailles et pointures, filtre « ma taille »
    i18n.js                 Langue et thème choisis, traduction, format des prix et des couleurs
    translations.js         Tous les textes en français, anglais, espagnol, allemand
    catalog.js              Catégories, pastilles de couleur, photos Kiabi, calcul des promos
    splash.js               Animation « Craquage by K »
    platform.js             Comportement d'appli (pas de zoom) et service worker
    utils.js                Petits outils partagés (DOM, stockage local)
assets/
  brand/                    Logo K Kiabi (version claire et version blanche)
  icons/                    Icônes de l'app
data/products.json          Le catalogue (articles, prix, couleurs, liens, photos, date d'arrivée)
scripts/
  update-catalog.mjs        Le robot qui récupère le catalogue sur kiabi.com
  pages.json                Les rayons parcourus : ajouter une page /v/... ici pour élargir le catalogue
tests/smoke.mjs             Test de l'app dans un iPhone simulé (npm test)
.github/workflows/
  deploy.yml                Vérifie le code puis met le site en ligne à chaque modification
  update-catalog.yml        Met le catalogue à jour chaque nuit, puis remet le site en ligne
```

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
npm run update-catalog   # met à jour data/products.json
npm test                 # vérifie l'app dans un iPhone simulé
```
