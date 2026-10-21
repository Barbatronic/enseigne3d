// Noms de fichiers
export const slug = t => t.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9]+/g, '') || 'x';
export const segName = seg => `${seg.link ? 'liaison' : 'bloc'}-${String(seg.n).padStart(2, '0')}-${slug(seg.label)}`;
export const partName = (seg, p) => `${segName(seg)}${p.kind === 'base' ? '_fond' : `_lettres-${'ABC'[p.color]}`}`;
