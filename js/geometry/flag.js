// Enseigne drapeau : deux demi-coques dos à dos, perpendiculaires au mur.
// Fixation par tiges filetées M6 dans le chant côté mur, écrous prisonniers entre les faces.
import { fitsBed } from './context.js';
import { filled, outlineOf, chamferedBody } from './shapes.js';
import { meshOf } from './mesh.js';

export function buildFlag(ctx, { glyphs, layout }) {
  const { k, CS, MF, P, opts, rect, warnings } = ctx;
  const D = P.depth, F = P.face, inlay = Math.min(P.inlay, F - 0.2);
  // face B : même texte, flèche gauche/droite inversée pour indiquer la même direction réelle
  const flip = { left: 'right', right: 'left' }[opts.arrow] ?? opts.arrow;
  const centered = gl => {
    const c = (Math.min(...gl.map(g => g.x0)) + Math.max(...gl.map(g => g.x1))) / 2;
    return gl.map(g => ({ ...g, sec: k(g.sec.translate([-c, 0])), x0: g.x0 - c, x1: g.x1 - c }));
  };
  const gA = centered(glyphs), gB = centered(layout(flip));
  // silhouette commune aux deux faces (B est vue en miroir depuis A)
  let S = k(outlineOf(ctx, gA.map(g => g.sec)).add(k(outlineOf(ctx, gB.map(g => g.sec)).mirror([1, 0]))));
  let sb = S.bounds();
  const wallLeft = opts.wallSide === 'left', band = P.margin + 8;
  // bande droite côté mur, sur toute la hauteur
  S = filled(ctx, k(S.add(wallLeft ? rect(sb.min[0], sb.min[1], sb.min[0] + band, sb.max[1]) : rect(sb.max[0] - band, sb.min[1], sb.max[0], sb.max[1]))));
  sb = S.bounds();
  const W = sb.max[0] - sb.min[0], H = sb.max[1] - sb.min[1];
  const wallX = wallLeft ? sb.min[0] : sb.max[0], inw = wallLeft ? 1 : -1;
  const xr = (a, b) => [Math.min(a, b), Math.max(a, b)];

  // tiges M6 : canal dans le plan de jonction (z = 0), écrou prisonnier partagé entre les deux faces
  const rodR = 3.3, nutR6 = 10.3 / Math.sqrt(3), nutT = 5.4, blockL = 34;
  const rodYs = H > 100 ? [sb.min[1] + H * 0.22, sb.max[1] - H * 0.22] : [(sb.min[1] + sb.max[1]) / 2];
  if (D - F < nutR6 + 1.5) warnings.push(`Épaisseur trop faible pour l'écrou M6 : il faut au moins ${(nutR6 + 1.5 + F).toFixed(1)} mm par face.`);
  const solids = [], tools = [];
  for (const y of rodYs) {
    const [x0, x1] = xr(wallX, wallX + inw * blockL);
    solids.push(k(k(rect(x0, y - 10, x1, y + 10).intersect(S)).extrude(D - F + 0.01)));
    const [c0] = xr(wallX - inw * 1, wallX + inw * (blockL - 6));
    tools.push(k(k(k(MF.cylinder(blockL - 5, rodR, rodR, 32)).rotate([0, 90, 0])).translate([c0, y, 0])));
    const [n0] = xr(wallX + inw * 16, wallX + inw * (16 + nutT));
    tools.push(k(k(k(MF.cylinder(nutT, nutR6, nutR6, 6)).rotate([0, 90, 0])).translate([n0, y, 0])));
  }

  // pions de centrage : plots Ø10 loin du mur, pion Ø4,6 sur A, trou Ø5,2 sur B
  const pinPts = [];
  const keep = k(S.offset(-(P.wall + 5.5), 'Round', 2, 16));
  const inside = (x, y) => k(k(CS.circle(0.1, 8)).translate([x, y])).subtract(keep).isEmpty();
  for (const fy of [0.3, 0.7]) for (const fx of [0.45, 0.9]) {
    const x = wallX + inw * W * fx, y = sb.min[1] + H * fy;
    if (inside(x, y) && !pinPts.some(([px, py]) => Math.hypot(px - x, py - y) < 25)) pinPts.push([x, y]);
  }
  if (pinPts.length < 2) for (const fx of [0.3, 0.6, 0.8]) {
    const x = wallX + inw * W * fx, y = (sb.min[1] + sb.max[1]) / 2;
    if (pinPts.length < 3 && inside(x, y)) pinPts.push([x, y]);
  }
  for (const [x, y] of pinPts) solids.push(k(k(k(CS.circle(5, 32)).translate([x, y])).extrude(D - F + 0.01)));

  // coque commune (repère de A), chanfrein sur la face visible
  let shell = chamferedBody(ctx, S);
  shell = k(shell.subtract(k(k(S.offset(-P.wall, 'Miter', 2, 24)).extrude(D - F))));
  shell = k(k(shell.add(k(MF.union(solids)))).subtract(k(MF.union(tools))));
  const pins = pinPts.map(([x, y]) => k(k(MF.cylinder(4, 2.3, 2.3, 24)).translate([x, y, -4])));
  const pinHoles = pinPts.map(([x, y]) => k(k(MF.cylinder(6, 2.6, 2.6, 24)).translate([-x, y, -1])));

  const half = isB => {
    let base = isB ? k(shell.mirror([1, 0, 0])) : shell;
    if (isB && pinHoles.length) base = k(base.subtract(k(MF.union(pinHoles))));
    if (!isB && pins.length) base = k(base.add(k(MF.union(pins))));
    const SS = isB ? k(S.mirror([1, 0])) : S, gl = isB ? gB : gA;
    const parts = [], bodies = [];
    for (const ci of [0, 1, 2]) {
      const l = gl.filter(g => g.color === ci).map(g => g.sec);
      if (!l.length) continue;
      const body = k(k(k(k(CS.union(l)).intersect(SS)).extrude(inlay)).translate([0, 0, D - inlay]));
      bodies.push(body); parts.push({ kind: 'letters', color: ci, mesh: meshOf(body) });
    }
    if (bodies.length) base = k(base.subtract(k(MF.union(bodies))));
    parts.unshift({ kind: 'base', color: -1, mesh: meshOf(base) });
    return { label: isB ? 'Face B' : 'Face A', bounds: SS.bounds(), w: W, h: H, D, fits: fitsBed(P, W, H), parts, order: 0, flag: isB ? 'B' : 'A', screws: 0 };
  };
  const segments = [half(false), half(true)];
  if (!segments[0].fits) warnings.push(`L'enseigne (${W.toFixed(0)} × ${H.toFixed(0)} mm) dépasse le plateau : réduis la hauteur des majuscules.`);
  return {
    segments, totalW: W, totalH: H, screws: [], hardware: `${rodYs.length} × M6`, shownCuts: [],
    fix: { type: 'flag', rods: rodYs.map(y => sb.max[1] - y), pins: pinPts.length },
  };
}
