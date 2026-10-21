// Liaisons entre les mots : plaque imprimée à plat, encastrée à fleur du dos des deux mots
// et vissée dans des plots (écrou glissé dans une fente latérale, ouverte vers l'intérieur du bloc).
import { NUT_AF, NUT_DEPTH, isInk, fitsBed } from './context.js';

// Espaces entre deux mots, à relier par une liaison
export function findSpaces(ctx, glyphs, xh) {
  const { P, chars } = ctx;
  const spaces = [];
  if (P.bridge <= 0) return spaces;
  const bh = xh * P.bridge / 100;
  for (let j = 0; j < glyphs.length - 1; j++) {
    const a = glyphs[j], b = glyphs[j+1];
    if (chars.slice(a.i + 1, b.i).some(c => !isInk(c))) spaces.push({ j, a, b, yc: xh / 2, bh });
  }
  return spaces;
}

export function planLinks(ctx, { spaces, outline, dims }) {
  const { k, CS, P, warnings } = ctx;
  const { r, nutR } = dims;
  // la plaque occupe z de 0 à linkT ; les plots partent de la face et s'arrêtent dessous
  const bossR = Math.max(nutR + 1.6, r + 2.5), LINK_Z = P.linkT + 0.2, NUT_Z = LINK_Z + 2.5;
  const links = [];
  if (spaces.length && P.depth - P.face < NUT_Z + NUT_DEPTH + 2)
    warnings.push(`Épaisseur trop faible pour les plots de liaison : il faut au moins ${(NUT_Z + NUT_DEPTH + 2 + P.face).toFixed(1)} mm d'épaisseur totale.`);
  const bossFits = (x, y) => k(k(CS.circle(bossR + P.wall, 32).translate([x, y])).subtract(outline)).isEmpty();
  const findBoss = (y, x0, dir) => { for (let d = 0; d <= 120; d += 1) if (bossFits(x0 + dir * d, y)) return x0 + dir * d; return null; };
  for (const sp of spaces) {
    const ys = sp.bh >= 4 * bossR + 2 ? [sp.yc - sp.bh / 2 + bossR + 1, sp.yc + sp.bh / 2 - bossR - 1] : [sp.yc];
    const pts = [];
    for (const y of ys) {
      const xl = findBoss(y, sp.a.x1 + P.margin, -1), xr = findBoss(y, sp.b.x0 - P.margin, +1);
      if (xl !== null && xr !== null) pts.push([xl, y, -1], [xr, y, +1]);
    }
    if (!pts.length) { warnings.push(`Pas de place pour les plots de liaison entre ${sp.a.c} et ${sp.b.c}.`); continue; }
    const plate = k(CS.hull(pts.map(([x, y]) => k(CS.circle(bossR + 1, 48).translate([x, y])))));
    links.push({ sp, pts, plate });
  }
  return { links, bossR, LINK_Z, NUT_Z, linked: new Set(links.map(l => l.sp.j)) };
}

// Plots, trous, fentes d'écrou et encoche de la plaque, pour le bloc de contour S
export function linkFeatures(ctx, plan, S, dims) {
  const { k, MF, P, rect } = ctx;
  const { r, nutR } = dims, { links, bossR, LINK_Z, NUT_Z } = plan;
  const D = P.depth, F = P.face;
  const bossPts = links.flatMap(l => l.pts).filter(([x, y]) => k(S.intersect(rect(x - 0.1, y - 0.1, x + 0.1, y + 0.1))).area() > 0);
  const solids = bossPts.map(([x, y]) => k(k(MF.cylinder(D - F - LINK_Z + 0.01, bossR, bossR, 32)).translate([x, y, LINK_Z])));
  const tools = [];
  for (const [x, y, dir] of bossPts) {
    tools.push(k(k(MF.cylinder(Math.min(D - F - 1, NUT_Z + NUT_DEPTH + 4) + 1, r, r, 24)).translate([x, y, -1])));
    const slot = k(MF.union([k(MF.cylinder(NUT_DEPTH, nutR, nutR, 6)),
      k(k(MF.cube([bossR + 2, NUT_AF, NUT_DEPTH])).translate([dir < 0 ? -(bossR + 2) : 0, -NUT_AF / 2, 0]))]));
    tools.push(k(slot.translate([x, y, NUT_Z])));
  }
  // encoche dans les parois pour loger la plaque de liaison à fleur du dos
  for (const l of links.filter(l => l.pts.some(p => bossPts.includes(p))))
    tools.push(k(k(k(l.plate.offset(0.3, 'Round', 2, 32)).extrude(LINK_Z + 1)).translate([0, 0, -1])));
  return { solids, tools, bossPts };
}

// Pièces de liaison à imprimer (z de 0 à linkT)
export function linkPieces(ctx, plan, dims, hostOrder, meshOf) {
  const { k, MF, P } = ctx, { r } = dims;
  return plan.links.map(l => {
    let body = k(l.plate.extrude(P.linkT));
    body = k(body.subtract(k(MF.union(l.pts.map(([x, y]) => k(k(MF.cylinder(P.linkT + 2, r, r, 24)).translate([x, y, -1])))))));
    const lb = l.plate.bounds(), w = lb.max[0] - lb.min[0], h = lb.max[1] - lb.min[1];
    return {
      label: `${l.sp.a.c}↔${l.sp.b.c}`, link: true, bounds: lb, w, h, D: P.linkT, fits: fitsBed(P, w, h),
      order: hostOrder(l.pts[0]) + 0.5, parts: [{ kind: 'base', color: -1, mesh: meshOf(body) }], screws: l.pts.length,
    };
  });
}
