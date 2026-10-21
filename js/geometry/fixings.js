// Fixation murale : trous de serrure, crochets ou plots double face,
// tous alignés sur une même ligne horizontale y = fixY.
import { BIG } from './context.js';

// gabarit du plot autour du point (x, y) : demi-largeur, bas et haut relatifs à y
const TEMPLATES = { keyhole: { hw: 10, lo: -18, hi: 6 }, hook: { hw: 13, lo: -17, hi: 6 }, tape: { hw: 15, lo: -10, hi: 10 } };

export function planFixings(ctx, { pieces, cuts, links, ob, dims }) {
  const { k, CS, P, opts, rect, warnings } = ctx;
  const type = opts.fixType, FIX = TEMPLATES[type];
  const fixPts = pieces.map(() => []);
  let fixY = null;
  if (!FIX) return { type, FIX, fixPts, info: null };
  const D = P.depth, F = P.face, { reach } = dims;
  if (D - F < 8) warnings.push(`Épaisseur trop faible pour la fixation murale : il faut au moins ${(8 + F).toFixed(1)} mm.`);
  const keepOut = [...cuts.map(c => rect(c.x - reach - 2, -BIG, c.x + reach + 2, BIG)), ...links.map(l => k(l.plate.offset(2, 'Round', 2, 16)))];
  const forbid = keepOut.length ? k(CS.union(keepOut)) : null;
  // zone où le plot peut se trouver : dans la cavité, hors renforts et liaisons
  const usable = S => { let U = k(S.offset(-(P.wall + 0.3), 'Miter', 2, 16)); if (forbid) U = k(U.subtract(forbid)); return U; };
  // centres possibles par bloc (érosion approchée de la zone par le gabarit)
  const feas = pieces.map(S => {
    if (S.isEmpty()) return null;
    const U = usable(S);
    let Fz = null;
    for (const dx of [-FIX.hw, 0, FIX.hw]) for (const dy of [FIX.lo, (FIX.lo + FIX.hi) / 2, FIX.hi]) {
      const t = k(U.translate([-dx, -dy]));
      Fz = Fz ? k(Fz.intersect(t)) : t;
    }
    return Fz && !Fz.isEmpty() ? Fz : null;
  });
  const box = (x, y) => rect(x - FIX.hw, y + FIX.lo, x + FIX.hw, y + FIX.hi);
  // intervalles en x de la ligne y dans Fz (les morceaux vides ont des bornes infinies : on les écarte)
  const lineX = (Fz, y) => Fz ? k(Fz.intersect(rect(-BIG, y - 0.05, BIG, y + 0.05))).decompose().map(k)
    .filter(p => p.area() > 1e-6).map(p => { const b = p.bounds(); return [b.min[0], b.max[0]]; }) : [];
  // hauteur visée : un peu au-dessus du milieu pour accrocher, au milieu pour le double face
  const target = type === 'tape' ? P.capH * 0.45 : P.capH * 0.65;
  let best = -Infinity;
  for (let y = ob.min[1]; y <= ob.max[1]; y += 1.5) {
    const n = feas.filter(Fz => lineX(Fz, y).length).length;
    const score = n * 10000 - Math.abs(y - target);
    if (n && score > best) { best = score; fixY = y; }
  }
  if (fixY !== null) pieces.forEach((S, s) => {
    const iv = lineX(feas[s], fixY);
    if (!iv.length) return;
    const sb = S.bounds(), lo = Math.min(...iv.map(v => v[0])), hi = Math.max(...iv.map(v => v[1]));
    const want = P.fixPer === 1 ? [(sb.min[0] + sb.max[0]) / 2] : Array.from({ length: P.fixPer }, (_, q) => lo + (hi - lo) * q / (P.fixPer - 1));
    const U = usable(S);
    const cand = [];
    for (const [a, b] of iv) for (let x = a; x <= b + 0.01; x += 2) cand.push(Math.min(x, b));
    for (const wx of want) {
      // position faisable la plus proche de celle souhaitée (vérification exacte du plot entier)
      cand.sort((u, v) => Math.abs(u - wx) - Math.abs(v - wx));
      for (const x of cand.slice(0, 60)) {
        if (fixPts[s].some(([px]) => Math.abs(px - x) < 2 * FIX.hw + 2)) continue;
        if (k(box(x, fixY).subtract(U)).isEmpty()) { fixPts[s].push([x, fixY]); break; }
      }
    }
  });
  if (pieces.some((S, s) => !S.isEmpty() && !fixPts[s].length))
    warnings.push('Certains blocs n\'ont pas de place pour une fixation : ils tiennent par leurs voisins.');
  const info = fixY === null ? null : {
    type, xs: fixPts.flat().map(([x]) => x - ob.min[0]).sort((a, b) => a - b),
    fromTop: ob.max[1] - fixY, fromBottom: fixY - ob.min[1],
  };
  return { type, FIX, fixPts, info };
}

// Plots pleins (de la face jusqu'au dos) et empreintes de fixation pour les points d'un bloc
export function fixFeatures(ctx, plan, pts) {
  const { k, CS, P, rect } = ctx, { FIX, type } = plan;
  const solids = [], tools = [];
  if (!FIX) return { solids, tools };
  const ext = (cs, z0, z1) => k(k(cs.extrude(z1 - z0)).translate([0, 0, z0]));
  for (const [x, y] of pts) {
    const pad = k(k(rect(x - FIX.hw, y + FIX.lo, x + FIX.hw, y + FIX.hi).offset(-2, 'Round', 2, 16)).offset(2, 'Round', 2, 16));
    solids.push(k(pad.extrude(P.depth - P.face + 0.01)));
    const slot = w2 => k(k(rect(x - w2, y - 9, x + w2, y)).add(k(k(CS.circle(w2, 32)).translate([x, y]))));
    if (type === 'keyhole') {
      // trou de serrure : entrée Ø9,5 en bas, fente 4,5 mm vers le haut, glissière pour la tête derrière
      tools.push(ext(k(k(CS.circle(4.75, 32)).translate([x, y - 9])), -1, 6));
      tools.push(ext(slot(2.25), -1, 6));
      tools.push(ext(slot(4.75), 2.5, 6));
    } else if (type === 'hook') {
      // poche ouverte vers le bas et vers l'arrière : le crochet s'appuie sur le plafond (y)
      tools.push(ext(rect(x - 8, y + FIX.lo - 1, x + 8, y), -1, 6));
    }
  }
  return { solids, tools };
}
