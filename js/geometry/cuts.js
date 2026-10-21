// Découpe de l'enseigne en blocs imprimables.
// Chaque jonction est verticale en x = c, mais contourne les lettres (à distance cutClear)
// pour qu'aucune lettre ne soit jamais coupée. Les vis M3 sont placées sur la partie droite.
import { BIG, NUT_DEPTH, isInk, fitsBed } from './context.js';

export function planCuts(ctx, { glyphs, outline, ob, dims, linked }) {
  const { k, CS, P, opts, rect, warnings, chars } = ctx;
  const { clearR, reach } = dims;

  /* Positions de coupe possibles (entre deux lettres consécutives) */
  // Axe de chaque jonction : là où la partie droite (sans contournement) est la plus longue,
  // pour pouvoir y mettre les vis. Départage : le plus près du milieu entre les lettres.
  const reachX = P.wall + P.pad + 1;
  const innerOutline = k(outline.offset(-(P.wall + 0.3), 'Miter', 2, 24));
  const cl = P.cutClear;
  const dil = glyphs.map(g => k(g.sec.offset(cl, 'Round', 2, 24)));
  // hauteur utilisable si l'axe est en xx : seules les lettres qui traversent l'axe gênent
  const freeLen = (xx, j) => {
    const H = rect(-BIG, -BIG, xx, BIG), strip = rect(xx - reachX, -BIG, xx + reachX, BIG);
    const near = q => glyphs[q] && glyphs[q].x0 - cl < xx + reachX && glyphs[q].x1 + cl > xx - reachX;
    const jogs = [];
    for (let q = 0; q < glyphs.length; q++) if (near(q)) jogs.push(k(q <= j ? dil[q].subtract(H) : dil[q].intersect(H)));
    // rangées où toute la largeur du renfort est libre (dans la silhouette, sans contournement)
    const J = jogs.length ? k(CS.union(jogs)) : null;
    let blocked = k(strip.subtract(innerOutline));
    if (J && !J.isEmpty()) blocked = k(blocked.add(k(k(J.offset(P.wall + 0.5, 'Round', 2, 16)).intersect(strip))));
    const iv = blocked.decompose().map(k).map(p => { const b = p.bounds(); return [b.min[1], b.max[1]]; })
      .map(([a, b]) => [Math.max(a, ob.min[1]), Math.min(b, ob.max[1])]).filter(([a, b]) => b > a).sort((a, b) => a[0] - b[0]);
    let covered = 0, cur = null;
    for (const [a, b] of iv) {
      if (!cur || a > cur[1]) { if (cur) covered += cur[1] - cur[0]; cur = [a, b]; } else cur[1] = Math.max(cur[1], b);
    }
    if (cur) covered += cur[1] - cur[0];
    return (ob.max[1] - ob.min[1]) - covered;
  };
  const gaps = [];
  for (let j = 0; j < glyphs.length - 1; j++) {
    const a = glyphs[j], b = glyphs[j+1];
    const mid = (a.x1 + b.x0) / 2;
    const lo = Math.min(mid, (a.x0 + a.x1) / 2), hi = Math.max(mid, (b.x0 + b.x1) / 2);
    const scored = [];
    for (let q = 0; q <= 16; q++) {
      const xx = lo + (hi - lo) * q / 16;
      scored.push([xx, freeLen(xx, j) - 0.05 * Math.abs(xx - mid)]);
    }
    // Positions candidates : d'abord le milieu de l'espace libre (si aucune lettre ne gêne), puis les meilleures estimations
    const cands = [];
    if (b.x0 - a.x1 > 2 * cl + 1) cands.push(mid);
    for (const xx of [a.x1 + cl + 0.5, b.x0 - cl - 0.5]) if (xx > lo && xx < hi) scored.push([xx, freeLen(xx, j)]);
    scored.sort((u, v) => v[1] - u[1]);
    for (const [xx] of scored) if (cands.length < 12 && cands.every(o => Math.abs(o - xx) > 1.5)) cands.push(xx);
    gaps.push({ after: a.i, x: cands[0], cands, j });
  }

  // leftRegion(gap) = partie de la silhouette qui part à gauche de la jonction
  const leftRegion = gap => {
    if (gap.L) return gap.L;
    const c = gap.x;
    gap.H = rect(-BIG, -BIG, c, BIG);
    const lefts = [], rights = [];
    glyphs.forEach((g, q) => {
      if (q <= gap.j && g.x1 + cl > c - 0.01) lefts.push(dil[q]);
      if (q > gap.j && g.x0 - cl < c + 0.01) rights.push(dil[q]);
    });
    let L = gap.H;
    const lu = lefts.length ? k(CS.union(lefts)) : null, ru = rights.length ? k(CS.union(rights)) : null;
    if (lu) L = k(L.add(lu));
    if (ru) L = k(L.subtract(ru));
    gap.touch = !!(lu && ru) && k(lu.intersect(ru)).area() > 0.01;
    // Nettoyage : toute languette plus fine que minFeature, collée à l'autre bloc,
    // change de côté (sauf si elle contient une lettre).
    let Lp = k(outline.intersect(L)), Rp = k(outline.subtract(L));
    const rr = P.minFeature / 2;
    if (rr > 0) {
      const a = glyphs[gap.j], b = glyphs[gap.j + 1];
      const win = rect(Math.min(a.x0, b.x0) - P.margin - 1, -BIG, Math.max(a.x1, b.x1) + P.margin + 1, BIG);
      const wb = win.bounds();
      const protect = side => {
        const l = glyphs.filter((g, q) => side ? q <= gap.j : q > gap.j).filter(g => g.x1 > wb.min[0] && g.x0 < wb.max[0]).map(g => g.sec);
        return l.length ? k(k(CS.union(l)).offset(0.3, 'Round', 2, 16)) : null;
      };
      const touches = (p, other) => k(k(p.offset(0.2, 'Miter', 2, 8)).intersect(other)).area() > 0.01;
      const thin = (piece, other, prot) => {
        const pw = k(piece.intersect(win));
        const op = k(k(pw.offset(-rr, 'Round', 2, 24)).offset(rr, 'Round', 2, 24));
        let t = k(pw.subtract(op));
        if (prot) t = k(t.subtract(prot));
        const keep = t.decompose().map(k).filter(p => p.area() > 0.3 * rr * rr && touches(p, other));
        return keep.length ? k(CS.union(keep)) : null;
      };
      const pL = protect(true), pR = protect(false);
      for (let pass = 0; pass < 2; pass++) {
        const tL = thin(Lp, Rp, pL), tR = thin(Rp, Lp, pR);
        if (tL) Lp = k(Lp.subtract(tL));
        if (tR) Lp = k(Lp.add(tR));
        Rp = k(outline.subtract(Lp));
      }
      // Îlots : un morceau détaché sans lettre rejoint le bloc qu'il touche
      const islands = (piece, other, prot) => piece.decompose().map(k)
        .filter(p => !(prot && k(p.intersect(prot)).area() > 0.01) && touches(p, other));
      for (const p of islands(Lp, Rp, pL)) Lp = k(Lp.subtract(p));
      Rp = k(outline.subtract(Lp));
      for (const p of islands(Rp, Lp, pR)) Lp = k(Lp.add(p));
    }
    return gap.L = Lp;
  };
  const piece = (ga, gb) => {
    let s = outline;
    if (gb) s = k(s.intersect(leftRegion(gb)));
    if (ga) s = k(s.subtract(leftRegion(ga)));
    return s;
  };
  const pieceFits = (ga, gb) => {
    const s = piece(ga, gb);
    if (s.isEmpty()) return true;
    const b = s.bounds();
    return fitsBed(P, b.max[0] - b.min[0], b.max[1] - b.min[1]);
  };

  // Mots non reliés : les deux lettres appartiennent à des morceaux différents de la silhouette
  const comps = outline.decompose().map(k);
  const compOf = g => comps.findIndex(c => k(c.intersect(g.sec)).area() > 0.01);
  if (comps.length > 1) gaps.forEach(g => { g.sep = compOf(glyphs[g.j]) !== compOf(glyphs[g.j + 1]); });

  /* Choix des coupes : manuelles, ou le plus de lettres possible par bloc selon le plateau */
  let cuts;
  if (opts.manualCuts) { const set = new Set(opts.manualCuts); cuts = gaps.filter(g => set.has(g.after)); }
  else {
    cuts = []; let start = 0, left = null;
    while (start < glyphs.length) {
      let end = start;
      for (let j = start; j < glyphs.length; j++) {
        if (j > start && gaps[j - 1].sep) break;   // coupe d'office entre deux mots non reliés
        if (pieceFits(left, j < gaps.length ? gaps[j] : null)) end = j; else break;
      }
      if (end >= gaps.length) break;
      cuts.push(gaps[end]); left = gaps[end]; start = end + 1;
    }
  }

  if (P.screws > 0 && cuts.length && P.depth - P.face < 2 * clearR + 2)
    warnings.push(`Épaisseur trop faible pour loger les vis : il faut au moins ${(2*clearR + 2 + P.face).toFixed(1)} mm d'épaisseur totale.`);

  /* Vis : uniquement là où la jonction est droite (x = c), loin des contournements */
  const screwsFor = c => {
    const L = leftRegion(c), holes = [];
    const jog = k(k(L.subtract(c.H)).add(k(k(outline.intersect(c.H)).subtract(L))));
    const x0 = c.x - reach - 1, x1 = c.x + reach + 1;
    let A = k(innerOutline.intersect(rect(x0 - 1, -BIG, x1 + 1, BIG)));
    if (!jog.isEmpty()) A = k(A.subtract(k(jog.offset(P.wall + 0.5, 'Round', 2, 16))));
    const runs = [];
    if (!A.isEmpty()) {
      const ab = A.bounds(); let run = null;
      for (let y = ab.min[1]; y <= ab.max[1] + 1; y += 1) {
        const ok = y <= ab.max[1] && k(rect(x0, y - clearR - 0.5, x1, y + clearR + 0.5).subtract(A)).isEmpty();
        if (ok) { if (!run) run = [y, y]; else run[1] = y; }
        else if (run) { runs.push(run); run = null; }
      }
    }
    runs.sort((a, b) => (b[1]-b[0]) - (a[1]-a[0]));
    let left = P.screws;
    for (const [lo, hi] of runs) {
      if (left <= 0) break;
      const room = hi - lo, minStep = 2 * clearR + 4;
      const n = Math.max(1, Math.min(left, Math.floor(room / minStep) + 1));
      for (let q = 0; q < n; q++) holes.push(n === 1 ? (lo + hi) / 2 : lo + room * q / (n - 1));
      left -= n;
    }
    return { holes, room: runs.reduce((t, [lo, hi]) => t + hi - lo, 0) };
  };
  const wordAt = i => {
    let a = i, b = i;
    while (a > 0 && isInk(chars[a-1])) a--;
    while (b < chars.length - 1 && isInk(chars[b+1])) b++;
    return chars.slice(a, b + 1).join('');
  };
  for (const c of cuts) {
    c.holes = [];
    if (P.screws > 0) {
      // essaie les axes candidats ; première position qui loge toutes les vis (le milieu de l'espace en priorité)
      let best = null;
      for (const x of c.cands) {
        c.x = x; c.L = null;
        const r = screwsFor(c);
        if (!best || r.holes.length > best.holes.length || (r.holes.length === best.holes.length && r.room > best.room + 5)) best = { ...r, x, L: c.L, H: c.H, touch: c.touch };
        if (r.holes.length >= P.screws) break;
      }
      Object.assign(c, { x: best.x, L: best.L, H: best.H, touch: best.touch, holes: best.holes });
    } else leftRegion(c);
    const a = glyphs[c.j], b = glyphs[c.j+1];
    if (c.touch) warnings.push(`Les lettres ${a.c} et ${b.c} sont trop proches : la coupe frôle les lettres. Réduis « Distance coupe ↔ lettres » ou augmente l'interlettrage.`);
    const crossing = k(outline.intersect(rect(c.x - 0.05, -BIG, c.x + 0.05, BIG))).area();
    if (crossing < 0.01 && linked.has(c.j)) { /* reliés par une pièce de liaison */ }
    else if (crossing < 0.01) warnings.push(`« ${wordAt(a.i)} » et « ${wordAt(b.i)} » ne se touchent pas : ce sont des blocs indépendants, sans vis entre eux. Augmente « Liaison entre les mots » pour les relier.`);
    else if (P.screws > 0 && !c.holes.length) warnings.push(`Jonction ${a.c}|${b.c} : pas de portion droite assez haute pour une vis. Coupe à un autre endroit, ou augmente la marge ou le lissage.`);
  }

  return { cuts, piece };
}

// Renforts plats et trous de vis d'un bloc, pour ses jonctions gauche (ga) et droite (gb)
export function jointFeatures(ctx, dims, ga, gb) {
  const { k, MF, P, opts, rect } = ctx;
  const { r, nutR, reach, zc } = dims;
  const strips = [], tools = [];
  if (ga) strips.push(rect(ga.x - 1, -BIG, ga.x + reach, BIG));
  if (gb) strips.push(rect(gb.x - reach, -BIG, gb.x + 1, BIG));
  for (const [cut, isLeft] of [[ga, true], [gb, false]]) {
    if (!cut) continue;
    for (const y of cut.holes) {
      tools.push(k(k(k(MF.cylinder(reach + 4, r, r, 24)).rotate([0, 90, 0])).translate([isLeft ? cut.x - 2 : cut.x - reach - 2, y, zc])));
      if (isLeft && opts.nutTrap && P.pad > 0) {
        const d = Math.min(NUT_DEPTH, reach - 1);
        tools.push(k(k(k(MF.cylinder(d + 2, nutR, nutR, 6)).rotate([0, 90, 0])).translate([cut.x + reach - d, y, zc])));
      }
    }
  }
  return { strips, tools };
}
