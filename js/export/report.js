// Textes de synthèse : fixation murale, visserie, LISEZMOI de l'archive.

const FIX_NAMES = { keyhole: 'Trous de serrure', hook: 'Crochets', tape: 'Plots double face' };

export function fixText(f, html) {
  const b = v => html ? `<b>${v}</b>` : v;
  if (f.type === 'flag') {
    const n = f.rods.length, s = n > 1 ? 's' : '';
    return `Drapeau : ${b(n)} tige${s} filetée${s} M6 dans le chant côté mur, à ${b(f.rods.map(v => v.toFixed(0)).join(' et '))} mm sous le haut de l'enseigne (chevilles au mur, écrou M6 prisonnier entre les faces). ` +
      `Assemblage des 2 faces : ${b(f.pins)} pions de centrage + colle (cyanoacrylate ou époxy), écrous en place avant collage.`;
  }
  const xs = f.xs.map(x => x.toFixed(0)).join(' / ');
  const gaps = f.xs.slice(1).map((x, i) => (x - f.xs[i]).toFixed(0)).join(' / ');
  const what = f.type === 'tape' ? 'Plots' : f.type === 'hook' ? 'Points d\'appui des crochets' : 'Vis au mur (haut des fentes)';
  return `${FIX_NAMES[f.type]} : ${b(f.xs.length)} point${f.xs.length > 1 ? 's alignés' : ''} à ${b(f.fromTop.toFixed(0))} mm sous le haut de l'enseigne (${b(f.fromBottom.toFixed(0))} mm au-dessus du bas). ` +
    `${what} à ${b(xs)} mm du bord gauche` + (gaps ? `, soit des entraxes de ${b(gaps)} mm.` : '.');
}

export const hardwareText = r => r.hardware ?? (r.screws.length ? r.screws.map(v => `${v.n} × M3×${v.len}`).join(' + ') : '0');

export function readme(r, { text, fontName, P }) {
  const fmt = n => n.toFixed(0);
  return `Enseigne « ${text} » — police ${fontName}\r\n` +
    `Dimensions assemblées : ${fmt(r.totalW)} x ${fmt(r.totalH)} x ${P.depth} mm, ${r.segments.length} pièces.\r\n` +
    (r.screws.length ? `Visserie : ${r.screws.map(v => `${v.n} vis M3x${v.len}`).join(' + ')}, et autant d'écrous M3.\r\n` : '') +
    (r.fix ? fixText(r.fix, false) + `\r\n` : '') +
    (r.segments.some(sg => sg.link) ? `Les pièces « liaison » se vissent au dos des deux mots ; glisser les écrous dans les fentes des plots.\r\n` : '') +
    `Imprimer face contre le plateau. Couleur des lettres sur les ${Math.min(P.inlay, P.face - 0.2).toFixed(1)} premiers mm.\r\n`;
}
