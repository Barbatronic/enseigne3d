// Calcul complet d'une enseigne : du texte aux maillages de chaque pièce à imprimer.
// Fonction pure (pas de DOM) : utilisée par le worker du navigateur et par les tests Node.
//
// Repère « affichage » : face visible en z = P.depth, dos ouvert en z = 0, texte lisible depuis +z.
import { createContext, jointDims, fitsBed, stdScrewLength, NUT_DEPTH } from './context.js';
import { createLayout } from './layout.js';
import { outlineOf, chamferedBody } from './shapes.js';
import { planCuts, jointFeatures } from './cuts.js';
import { findSpaces, planLinks, linkFeatures, linkPieces } from './links.js';
import { planFixings, fixFeatures } from './fixings.js';
import { buildFlag } from './flag.js';
import { meshOf } from './mesh.js';

export function buildSign(wasm, font, P, opts) {
  const ctx = createContext(wasm, P, opts);
  try {
    const result = build(ctx, font);
    result.segments.forEach((sg, i) => { sg.n = i + 1; });
    result.warnings = ctx.warnings;
    return result;
  } finally {
    ctx.dispose();
  }
}

function build(ctx, font) {
  const { k, CS, MF, P, opts, warnings } = ctx;
  const { layout, missing, xh } = createLayout(ctx, font);
  const glyphs = layout(opts.arrow);
  if (missing.size) warnings.push(`Caractères absents de la police : ${[...missing].join(' ')}`);
  if (!glyphs.length) return { segments: [], empty: true, shownCuts: [] };

  if (opts.signType === 'flag') return buildFlag(ctx, { glyphs, layout });

  const outline = outlineOf(ctx, glyphs.map(g => g.sec));
  const ob = outline.bounds();
  const dims = jointDims(P, opts);

  /* 1. Liaisons entre les mots, découpe et vis des jonctions */
  const linkPlan = planLinks(ctx, { spaces: findSpaces(ctx, glyphs, xh), outline, dims });
  const { cuts, piece } = planCuts(ctx, { glyphs, outline, ob, dims, linked: linkPlan.linked });

  /* 2. Contours des blocs */
  const hg = P.gap / 2, D = P.depth, F = P.face, inlay = Math.min(P.inlay, F - 0.2);
  const pieces = [];
  for (let s = 0; s <= cuts.length; s++) {
    let S = piece(s > 0 ? cuts[s-1] : null, s < cuts.length ? cuts[s] : null);
    if (!S.isEmpty()) { if (hg > 0) S = k(S.offset(-hg, 'Miter', 2, 16)); S = k(S.simplify(0.01)); }
    pieces.push(S);
  }

  /* 3. Fixation murale alignée */
  const fixPlan = planFixings(ctx, { pieces, cuts, links: linkPlan.links, ob, dims });

  /* 4. Solides de chaque bloc */
  const lettersByColor = [0, 1, 2].map(ci => { const l = glyphs.filter(g => g.color === ci).map(g => g.sec); return l.length ? k(CS.union(l)) : null; });
  const segments = [];
  for (let s = 0; s <= cuts.length; s++) {
    const ga = s > 0 ? cuts[s-1] : null, gb = s < cuts.length ? cuts[s] : null;
    const S = pieces[s];
    if (S.isEmpty()) continue;
    const sb = S.bounds();
    const nParts = S.decompose().map(k).filter(p => p.area() > 1).length;
    const joint = jointFeatures(ctx, dims, ga, gb);
    const link = linkFeatures(ctx, linkPlan, S, dims);
    const fixing = fixFeatures(ctx, fixPlan, fixPlan.fixPts[s]);

    // coque : corps chanfreiné, moins la cavité (sauf sous les renforts de jonction)
    let cavity = k(S.offset(-P.wall, 'Miter', 2, 24));
    if (joint.strips.length) cavity = k(cavity.subtract(k(CS.union(joint.strips))));
    let inset;
    if (!opts.chamferJoints) {
      // pas de chanfrein le long des jonctions : on garde la pleine section au contact des blocs voisins
      const others = k(outline.subtract(S));
      inset = d => k(k(S.offset(-d, 'Round', 2, 24)).add(k(S.intersect(k(others.offset(d + 0.05, 'Miter', 2, 8))))));
    }
    let shell = chamferedBody(ctx, S, inset);
    if (!cavity.isEmpty()) shell = k(shell.subtract(k(cavity.extrude(D - F))));
    const solids = [...link.solids, ...fixing.solids];
    if (solids.length) shell = k(shell.add(k(MF.union(solids))));

    // lettres incrustées sur la face, une pièce par couleur
    const tools = [...joint.tools, ...link.tools, ...fixing.tools];
    const parts = [];
    lettersByColor.forEach((lc, ci) => {
      if (!lc) return;
      const l = k(lc.intersect(S));
      if (l.isEmpty()) return;
      const body = k(k(l.extrude(inlay)).translate([0, 0, D - inlay]));
      tools.push(body);
      parts.push({ kind: 'letters', color: ci, mesh: meshOf(body) });
    });
    if (tools.length) shell = k(shell.subtract(k(MF.union(tools))));
    parts.unshift({ kind: 'base', color: -1, mesh: meshOf(shell) });

    const j0 = ga ? ga.j + 1 : 0, j1 = gb ? gb.j : glyphs.length - 1;
    const label = glyphs.slice(j0, j1 + 1).map(g => g.c).join('');
    const w = sb.max[0] - sb.min[0], h = sb.max[1] - sb.min[1];
    const fits = fitsBed(P, w, h);
    if (nParts > 1) warnings.push(`Le bloc « ${label} » est en ${nParts} morceaux séparés : ajoute une coupe entre les mots ou augmente « Liaison entre les mots ».`);
    if (!fits) warnings.push(`Le bloc « ${label} » (${w.toFixed(0)} × ${h.toFixed(0)} mm) dépasse le plateau.`);
    segments.push({ label, bounds: sb, w, h, D, fits, parts, order: s, bossPts: link.bossPts,
      screws: (ga?.holes.length ?? 0) + (gb?.holes.length ?? 0) + link.bossPts.length });
  }
  const hostOrder = pt => segments.find(sg => sg.bossPts.includes(pt))?.order ?? 0;
  segments.push(...linkPieces(ctx, linkPlan, dims, hostOrder, meshOf));
  for (const sg of segments) delete sg.bossPts;

  // visserie : jonctions entre blocs + liaisons entre les mots
  const screwSets = {};
  const addScrews = (n, len) => { if (n > 0) screwSets[len] = (screwSets[len] ?? 0) + n; };
  addScrews(cuts.reduce((a, c) => a + c.holes.length, 0), stdScrewLength(2 * dims.reach + (opts.nutTrap ? 0 : 2.4) + 0.5));
  addScrews(linkPlan.links.reduce((a, l) => a + l.pts.length, 0), stdScrewLength(linkPlan.NUT_Z + NUT_DEPTH + 0.5));
  const screws = Object.entries(screwSets).map(([len, n]) => ({ n, len: +len })).sort((a, b) => a.len - b.len);

  return {
    segments, screws, fix: fixPlan.info,
    totalW: ob.max[0] - ob.min[0], totalH: ob.max[1] - ob.min[1],
    shownCuts: cuts.map(c => c.after),
  };
}
