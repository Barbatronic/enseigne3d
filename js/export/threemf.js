// Export 3MF « projet » lisible par OrcaSlicer / Bambu Studio (Fichier > Ouvrir un projet) :
// une pièce par couleur avec son filament, et les pièces réparties sur plusieurs plateaux.
// Les autres trancheurs lisent la géométrie et les couleurs.
import { printCoords } from './stl.js';
import { segName } from './naming.js';

const NAMES = ['Fond', 'Lettres A', 'Lettres B', 'Lettres C'];

// Range les pièces sur des plateaux (rangées successives), avec rotation de 90° si besoin
export function packPlates(segs, bedX, bedY) {
  const M = 5, G = 8;
  const items = segs.map(seg => {
    let w = seg.w, h = seg.h, rot = false;
    if ((w > bedX - 2 * M || h > bedY - 2 * M) && h <= bedX - 2 * M && w <= bedY - 2 * M) { rot = true; [w, h] = [h, w]; }
    return { seg, w, h, rot };
  }).sort((a, b) => b.h - a.h);
  const plates = [];
  const tryPlace = (pl, it) => {
    for (const sh of pl.shelves) if (it.h <= sh.h && sh.x + it.w <= bedX - M) { it.x = sh.x; it.y = sh.y; sh.x += it.w + G; pl.items.push(it); return true; }
    const last = pl.shelves[pl.shelves.length - 1], y = last ? last.y + last.h + G : M;
    if (y + it.h > bedY - M || M + it.w > bedX - M) return false;
    pl.shelves.push({ y, h: it.h, x: M + it.w + G }); it.x = M; it.y = y; pl.items.push(it); return true;
  };
  for (const it of items) {
    if (plates.some(pl => tryPlace(pl, it))) continue;
    const pl = { shelves: [], items: [] }; plates.push(pl);
    if (!tryPlace(pl, it)) { it.x = M; it.y = M; pl.items.push(it); }   // pièce plus grande que le plateau : seule
  }
  return plates;
}

// colors : [fond, A, B, C] en #rrggbb ; zip : { zipSync, strToU8 } de fflate
export function make3mf(segs, { colors, bedX, bedY }, { zipSync, strToU8 }) {
  const used = [...new Set(segs.flatMap(sg => sg.parts.filter(p => p.color >= 0).map(p => p.color)))].sort();
  const extruder = c => c < 0 ? 1 : 2 + used.indexOf(c);
  const plates = packPlates(segs, bedX, bedY);
  // disposition des plateaux d'OrcaSlicer / Bambu Studio : grille de ceil(√n) colonnes, écart 1/5 du plateau
  const nCols = Math.ceil(Math.sqrt(plates.length) - 1e-9);
  let id = 2; const objs = [], items = [], cfgObjs = [], cfgPlates = [];
  plates.forEach((pl, pi) => {
    const ox = (pi % nCols) * bedX * 1.2, oy = -Math.floor(pi / nCols) * bedY * 1.2;
    const inst = [];
    for (const it of pl.items) {
      const seg = it.seg, comps = [], cfgParts = [];
      for (const p of seg.parts) {
        const v = printCoords(seg, p), idx = p.mesh.idx;
        const vs = []; for (let i = 0; i < v.length; i += 3) vs.push(`<vertex x="${+v[i].toFixed(4)}" y="${+v[i+1].toFixed(4)}" z="${+v[i+2].toFixed(4)}"/>`);
        const ts = []; for (let i = 0; i < idx.length; i += 3) ts.push(`<triangle v1="${idx[i]}" v2="${idx[i+1]}" v3="${idx[i+2]}"/>`);
        const nm = seg.link ? 'Liaison' : NAMES[p.color + 1];
        objs.push(`<object id="${id}" type="model" pid="1" pindex="${p.color + 1}" name="${nm}"><mesh><vertices>${vs.join('')}</vertices><triangles>${ts.join('')}</triangles></mesh></object>`);
        comps.push(`<component objectid="${id}"/>`);
        cfgParts.push(`    <part id="${id}" subtype="normal_part">\n      <metadata key="name" value="${nm}"/>\n      <metadata key="extruder" value="${extruder(p.color)}"/>\n    </part>`);
        id++;
      }
      objs.push(`<object id="${id}" type="model" name="${segName(seg)}"><components>${comps.join('')}</components></object>`);
      const tx = ox + it.x + (it.rot ? seg.h : 0), ty = oy + it.y;
      const m = it.rot ? '0 1 0 -1 0 0 0 0 1' : '1 0 0 0 1 0 0 0 1';
      items.push(`<item objectid="${id}" transform="${m} ${tx.toFixed(3)} ${ty.toFixed(3)} 0" printable="1"/>`);
      cfgObjs.push(`  <object id="${id}">\n    <metadata key="name" value="${segName(seg)}"/>\n    <metadata key="extruder" value="1"/>\n${cfgParts.join('\n')}\n  </object>`);
      inst.push(`    <model_instance>\n      <metadata key="object_id" value="${id}"/>\n      <metadata key="instance_id" value="0"/>\n      <metadata key="identify_id" value="${id}"/>\n    </model_instance>`);
      id++;
    }
    cfgPlates.push(`  <plate>\n    <metadata key="plater_id" value="${pi + 1}"/>\n    <metadata key="plater_name" value="Plateau ${pi + 1}"/>\n    <metadata key="locked" value="false"/>\n${inst.join('\n')}\n  </plate>`);
  });
  const model = `<?xml version="1.0" encoding="UTF-8"?>
<model unit="millimeter" xml:lang="fr-FR" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02">
<metadata name="Application">Enseigne3D</metadata>
<resources><basematerials id="1">${NAMES.map((n, i) => `<base name="${n}" displaycolor="${colors[i].toUpperCase()}FF"/>`).join('')}</basematerials>
${objs.join('\n')}</resources>
<build>${items.join('')}</build>
</model>`;
  const config = `<?xml version="1.0" encoding="UTF-8"?>\n<config>\n${cfgObjs.join('\n')}\n${cfgPlates.join('\n')}\n</config>\n`;
  return zipSync({
    '[Content_Types].xml': strToU8('<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/><Default Extension="config" ContentType="text/xml"/></Types>'),
    '_rels/.rels': strToU8('<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Target="/3D/3dmodel.model" Id="rel0" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/></Relationships>'),
    '3D/3dmodel.model': strToU8(model),
    'Metadata/model_settings.config': strToU8(config),
  }, { level: 6 });
}
