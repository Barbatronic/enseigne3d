// Réglages partagés entre l'interface, le worker de calcul et les tests.

export const CDN = {
  manifold: 'https://cdn.jsdelivr.net/npm/manifold-3d@3.2.1/manifold.js',
  opentype: 'https://cdn.jsdelivr.net/npm/opentype.js@1.3.4/dist/opentype.module.js',
  fflate: 'https://cdn.jsdelivr.net/npm/fflate@0.8.2/esm/browser.js',
};

// [identifiant fontsource, nom affiché, graisses disponibles, graisse par défaut]
export const FONTS = [
  ['nunito', 'Nunito', [400, 500, 600, 700, 800, 900], 800],
  ['fredoka', 'Fredoka', [400, 500, 600, 700], 600],
  ['baloo-2', 'Baloo 2', [400, 500, 600, 700, 800], 800],
  ['poppins', 'Poppins', [400, 500, 600, 700, 800, 900], 700],
  ['rubik', 'Rubik', [400, 500, 600, 700, 800, 900], 700],
  ['montserrat', 'Montserrat', [400, 500, 600, 700, 800, 900], 800],
  ['open-sans', 'Open Sans', [400, 500, 600, 700, 800], 700],
  ['varela-round', 'Varela Round', [400], 400],
  ['comfortaa', 'Comfortaa', [400, 500, 600, 700], 700],
  ['lilita-one', 'Lilita One', [400], 400],
  ['titan-one', 'Titan One', [400], 400],
  ['archivo-black', 'Archivo Black', [400], 400],
  ['bebas-neue', 'Bebas Neue', [400], 400],
  ['pacifico', 'Pacifico', [400], 400],
];
export const fontUrl = (id, w) => `https://cdn.jsdelivr.net/npm/@fontsource/${id}@5.2.5/files/${id}-latin-${w}-normal.woff`;

// [section, identifiant, libellé, unité, défaut, min, max, pas]
export const PARAMS = [
  ['police', 'capH', 'Hauteur des majuscules', 'mm', 70, 10, 600, 1],
  ['police', 'track', 'Interlettrage', 'mm', 0, -30, 80, 0.5],
  ['forme', 'margin', 'Marge autour des lettres', 'mm', 9, 1, 80, 0.5],
  ['forme', 'smooth', 'Lissage des creux', 'mm', 6, 0, 80, 0.5],
  ['forme', 'depth', 'Épaisseur totale', 'mm', 20, 4, 150, 1],
  ['forme', 'face', 'Épaisseur de la face', 'mm', 2, 0.6, 10, 0.2],
  ['forme', 'wall', 'Épaisseur des parois', 'mm', 2, 0.8, 10, 0.2],
  ['forme', 'cutClear', 'Distance coupe ↔ lettres', 'mm', 2, 0.5, 20, 0.5],
  ['forme', 'bridge', 'Liaison entre les mots', '% minusc.', 60, 0, 150, 5],
  ['forme', 'linkT', 'Épaisseur de la liaison', 'mm', 4, 2, 10, 0.5],
  ['forme', 'minFeature', 'Largeur mini d\'une zone', 'mm', 6, 0, 30, 0.5],
  ['forme', 'chamfer', 'Chanfrein face visible', 'mm', 0.5, 0, 3, 0.1],
  ['forme', 'inlay', 'Épaisseur couleur des lettres', 'mm', 0.6, 0.2, 5, 0.2],
  ['impr', 'bedX', 'Plateau X', 'mm', 256, 50, 1000, 1],
  ['impr', 'bedY', 'Plateau Y', 'mm', 256, 50, 1000, 1],
  ['impr', 'gap', 'Jeu entre blocs', 'mm', 0.1, 0, 1, 0.05],
  ['assemblage', 'screws', 'Vis par jonction', '', 2, 0, 6, 1],
  ['assemblage', 'hole', 'Ø des trous', 'mm', 3.4, 2, 8, 0.1],
  ['assemblage', 'pad', 'Renfort de jonction', 'mm', 3, 0, 20, 0.5],
  ['fixation', 'fixPer', 'Points par bloc', '', 1, 1, 4, 1],
];

export const defaultParams = () => Object.fromEntries(PARAMS.map(p => [p[1], p[4]]));

// Choix qui ne sont pas des nombres (texte, menus, cases à cocher)
export const defaultOptions = () => ({
  text: 'RepairSpace',
  charColor: [0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1],
  manualCuts: null,        // tableau d'index « coupe après le caractère i », ou null = découpe auto
  arrow: 'none',           // none | left | right | down | up
  arrowColor: 0,
  signType: 'wall',        // wall | flag
  wallSide: 'left',        // drapeau : côté du mur vu depuis la face A
  fixType: 'keyhole',      // none | keyhole | hook | tape
  nutTrap: true,
  chamferJoints: true,
});
