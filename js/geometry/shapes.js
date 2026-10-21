// Formes de base partagées : silhouette pleine et corps chanfreiné.
import { SEGS } from './context.js';

const signedArea = p => p.reduce((a, v, i) => { const w = p[(i + 1) % p.length]; return a + v[0] * w[1] - w[0] * v[1]; }, 0) / 2;

// Silhouette pleine : on ne garde que les contours extérieurs (centres des O, p, A… remplis)
export function filled(ctx, cs) {
  return ctx.k(new ctx.CS(cs.toPolygons().filter(p => signedArea(p) > 0), 'NonZero'));
}

// Contour « bulle » autour de lettres : marge, puis lissage des creux
export function outlineOf(ctx, secs) {
  const { k, CS, P } = ctx, sm = P.smooth;
  const grown = k(k(CS.union(secs)).offset(P.margin + sm, 'Round', 2, SEGS));
  return filled(ctx, k(k(grown.offset(-sm, 'Round', 2, SEGS)).simplify(0.02)));
}

// Corps plein d'épaisseur P.depth, avec chanfrein sur l'arête de la face visible (marches de 0,1 mm ≈ 45°).
// inset(d) donne la section rétrécie de d ; par défaut un simple décalage du contour.
export function chamferedBody(ctx, S, inset) {
  const { k, MF, P } = ctx, D = P.depth;
  const ch = Math.min(P.chamfer, P.face - 0.2, P.wall);
  if (ch <= 0.05) return k(S.extrude(D));
  inset ??= d => k(S.offset(-d, 'Round', 2, 24));
  const n = Math.max(2, Math.min(8, Math.round(ch / 0.1)));
  const layers = [k(S.extrude(D - ch))];
  for (let i = 0; i < n; i++) layers.push(k(k(inset(ch * (i + 0.5) / n).extrude(ch / n)).translate([0, 0, D - ch + ch * i / n])));
  return k(MF.union(layers));
}
