// Contexte de calcul : accès à manifold-3d, réglages, avertissements,
// et suivi des objets WASM à libérer en fin de calcul.

export const BIG = 1e5;
export const NUT_AF = 5.7, NUT_DEPTH = 2.6;   // écrou M3 : 5,5 mm sur plats + jeu
export const SEGS = 48;                        // segments des arrondis

export const isInk = c => !/\s/.test(c);
export const fitsBed = (P, w, h) => (w <= P.bedX && h <= P.bedY) || (w <= P.bedY && h <= P.bedX);
export const stdScrewLength = need => [6, 8, 10, 12, 14, 16, 20, 25, 30, 35, 40].find(l => l >= need) ?? Math.ceil(need);

export function createContext(wasm, P, opts) {
  const G = [];
  const k = o => (G.push(o), o);
  const CS = wasm.CrossSection, MF = wasm.Manifold;
  return {
    CS, MF, k, P, opts,
    chars: Array.from(opts.text),
    warnings: [],
    rect: (x0, y0, x1, y1) => k(new CS([[[x0, y0], [x1, y0], [x1, y1], [x0, y1]]])),
    dispose() { for (const o of G) { try { o.delete(); } catch (e) { /* déjà libéré */ } } G.length = 0; },
  };
}

// Dimensions des jonctions vissées, communes à la découpe, aux liaisons et aux fixations
export function jointDims(P, opts) {
  const r = P.hole / 2, nutR = NUT_AF / Math.sqrt(3);
  return { r, nutR, clearR: opts.nutTrap ? nutR : r + 1, reach: P.wall + P.pad, zc: (P.depth - P.face) / 2 };
}
