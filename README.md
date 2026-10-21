# Enseigne3D

Générateur d'enseignes en relief à imprimer en 3D, directement dans le navigateur.

**Utiliser l'outil : https://barbatronic.github.io/enseigne3d/**

Tu tapes un texte, tu choisis une police, et l'outil prépare des blocs prêts à imprimer :

- **Lettres multicolores** incrustées à fleur de la face, une pièce par couleur.
- **Découpe automatique** selon la taille de ton plateau. La coupe contourne les lettres et ne les traverse jamais. Tu peux aussi couper à la main entre deux lettres.
- **Jonctions vissées M3** avec renforts, trous et logements d'écrou, placées sur la partie droite de chaque jonction.
- **Liaison entre les mots** : une plaque imprimée à plat, encastrée et vissée au dos des deux mots.
- **Fixation murale alignée** : trous de serrure, crochets ou plots double face, avec les cotes de perçage.
- **Enseigne drapeau double face**, perpendiculaire au mur, fixée par tiges filetées M6.
- **Flèche** (gauche, droite, haut ou bas).
- **Chanfrein** sur la face visible, silhouette pleine (intérieur des O, p, A rempli).
- **Exports** : STL par pièce, 3MF par bloc et 3MF multi-plateaux, avec un filament par couleur pour OrcaSlicer et Bambu Studio (*Fichier > Ouvrir un projet*).

Toutes les pièces s'impriment face contre le plateau, sans support.

Les réglages (texte, couleurs, police, cotes) sont enregistrés dans le navigateur et retrouvés à la prochaine ouverture. Le bouton *Réinitialiser* revient aux valeurs par défaut.

## Lancer en local

Les modules JavaScript et le Web Worker ne fonctionnent pas en ouvrant `index.html` directement (`file://`). Il faut un petit serveur web :

```sh
npm run serve        # puis ouvrir http://localhost:8080
```

ou `python3 -m http.server 8080`.

## Organisation du code

Pas d'étape de compilation : des modules JavaScript natifs, et les bibliothèques chargées depuis jsDelivr ([manifold-3d](https://github.com/elalish/manifold) pour la géométrie, [opentype.js](https://opentype.js.org/) pour les polices, [three.js](https://threejs.org/) pour l'aperçu, [fflate](https://github.com/101arrowz/fflate) pour les archives).

```
index.html, css/style.css   page et styles
js/config.js                polices proposées, réglages et valeurs par défaut
js/main.js                  interface : réglages, polices, calcul, tableau, téléchargements
js/worker.js                calcul en arrière-plan (l'interface reste fluide)
js/ui/                      aperçu 3D, champs de réglage, ruban de lettres, sauvegarde locale
js/geometry/                calcul pur, sans DOM (testé dans Node)
  build.js                  assemble une enseigne complète
  layout.js                 glyphes et flèche
  shapes.js                 silhouette et corps chanfreiné
  cuts.js                   découpe, contournement des lettres, vis des jonctions
  links.js                  liaisons entre les mots
  fixings.js                fixation murale
  flag.js                   enseigne drapeau
js/export/                  STL, 3MF (plateaux), noms de fichiers, textes de synthèse
tests/                      contrôles automatiques
```

## Tests

```sh
npm install
npm test
```

Les tests calculent plusieurs enseignes et vérifient que :
- chaque pièce est un solide fermé, d'un seul morceau ;
- chaque vis correspond bien à un trou ;
- toutes les jonctions ont leurs vis ;
- les fixations sont alignées ;
- le 3MF multi-plateaux ne fait déborder ni chevaucher aucune pièce.

Ils tournent sur GitHub à chaque push.

## Publication

Chaque push sur `main` relance les tests puis publie le site sur GitHub Pages (`.github/workflows/pages.yml`).

## Licence

MIT, voir [LICENSE](LICENSE).
