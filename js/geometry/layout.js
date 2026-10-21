// Mise en page du texte : contours des glyphes (opentype.js) et flèche éventuelle.
import { isInk } from './context.js';

// Aplatit les courbes d'un chemin opentype en polygones (y vers le haut)
export function pathToPolys(cmds, tol) {
  const polys = []; let cur = [], px = 0, py = 0;
  const push = (x, y) => { const l = cur[cur.length-1]; if (!l || Math.hypot(l[0]-x, l[1]+y) > 1e-4) cur.push([x, -y]); };
  const close = () => { if (cur.length > 2) polys.push(cur); cur = []; };
  for (const c of cmds) {
    if (c.type === 'M') { close(); push(c.x, c.y); }
    else if (c.type === 'L') push(c.x, c.y);
    else if (c.type === 'Q') {
      const n = Math.min(24, Math.max(2, Math.ceil((Math.hypot(c.x1-px, c.y1-py) + Math.hypot(c.x-c.x1, c.y-c.y1)) / tol)));
      for (let k = 1; k <= n; k++) { const t = k/n, u = 1-t;
        push(u*u*px + 2*u*t*c.x1 + t*t*c.x, u*u*py + 2*u*t*c.y1 + t*t*c.y); }
    } else if (c.type === 'C') {
      const n = Math.min(32, Math.max(2, Math.ceil((Math.hypot(c.x1-px, c.y1-py) + Math.hypot(c.x2-c.x1, c.y2-c.y1) + Math.hypot(c.x-c.x2, c.y-c.y2)) / tol)));
      for (let k = 1; k <= n; k++) { const t = k/n, u = 1-t;
        push(u*u*u*px + 3*u*u*t*c.x1 + 3*u*t*t*c.x2 + t*t*t*c.x, u*u*u*py + 3*u*u*t*c.y1 + 3*u*t*t*c.y2 + t*t*t*c.y); }
    } else if (c.type === 'Z') close();
    if (c.x !== undefined) { px = c.x; py = c.y; }
  }
  close();
  // supprime le point de fermeture dupliqué
  for (const p of polys) { const a = p[0], b = p[p.length-1]; if (Math.hypot(a[0]-b[0], a[1]-b[1]) < 1e-4) p.pop(); }
  return polys.filter(p => p.length > 2);
}

// Prépare la mise en page pour une police ; layout(dir) renvoie la liste des glyphes
// { i, c, sec, x0, x1, color } avec la flèche dans la direction dir (ou 'none').
export function createLayout(ctx, font) {
  const { k, CS, P, opts, chars } = ctx;
  const capUnits = font.tables.os2?.sCapHeight || font.charToGlyph('H').getBoundingBox().y2 || font.unitsPerEm * 0.7;
  const scale = P.capH / capUnits, fontSize = font.unitsPerEm * scale;
  const tol = Math.max(0.15, P.capH / 300);
  const missing = new Set();

  // flèche pleine, hauteur = majuscules, coins adoucis ; cx0 = bord gauche
  const arrowSec = (dir, cx0) => {
    const horiz = dir === 'left' || dir === 'right';
    const h = P.capH, w = horiz ? h * 0.95 : h * 0.8;
    const len = horiz ? w : h, wid = horiz ? h : w, L = len * 0.5, t = wid * 0.14;
    // flèche vers +x centrée sur l'origine, puis tournée
    let a0 = k(new CS([[[-len / 2, -t], [len / 2 - L, -t], [len / 2 - L, -wid / 2], [len / 2, 0], [len / 2 - L, wid / 2], [len / 2 - L, t], [-len / 2, t]]]));
    const rr = wid * 0.04;
    a0 = k(k(a0.offset(-rr, 'Round', 2, 16)).offset(rr, 'Round', 2, 16));
    const rot = { right: 0, up: 90, left: 180, down: -90 }[dir];
    return k(k(a0.rotate(rot)).translate([cx0 + w / 2, h / 2]));
  };

  const layout = dir => {
    const gl = []; let x = 0, prev = null;
    chars.forEach((c, i) => {
      const g = font.charToGlyph(c);
      if (g.index === 0 && isInk(c)) missing.add(c);
      if (prev) x += font.getKerningValue(prev, g) * scale;
      if (isInk(c)) {
        const polys = pathToPolys(g.getPath(x, 0, fontSize).commands, tol);
        if (polys.length) {
          const sec = k(new CS(polys, 'NonZero'));
          if (!sec.isEmpty()) { const b = sec.bounds(); gl.push({ i, c, sec, x0: b.min[0], x1: b.max[0], color: opts.charColor[i] ?? 0 }); }
        }
      }
      x += g.advanceWidth * scale + P.track; prev = g;
    });
    if (dir !== 'none' && gl.length) {
      const gap = P.capH * 0.3 + P.track, color = +opts.arrowColor;
      const left = dir === 'left';
      const sec = left ? arrowSec(dir, gl[0].x0 - gap - P.capH * 0.95) : arrowSec(dir, gl[gl.length - 1].x1 + gap);
      const b = sec.bounds();
      const glyph = { i: left ? -1 : chars.length, c: { left: '←', right: '→', up: '↑', down: '↓' }[dir], sec, x0: b.min[0], x1: b.max[0], color, arrow: true };
      left ? gl.unshift(glyph) : gl.push(glyph);
    }
    return gl;
  };

  const xh = (font.tables.os2?.sxHeight || capUnits * 0.7) * scale;   // hauteur des minuscules
  return { layout, missing, xh };
}
