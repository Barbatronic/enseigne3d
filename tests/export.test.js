// Contrôles des exports : STL binaire et 3MF multi-plateaux (OrcaSlicer / Bambu Studio).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { zipSync, unzipSync, strToU8, strFromU8 } from 'fflate';
import { build } from './helpers.js';
import { makeStl, printCoords } from '../js/export/stl.js';
import { make3mf, packPlates } from '../js/export/threemf.js';
import { defaultParams } from '../js/config.js';

const P = defaultParams();
const COLORS = ['#f2f2ef', '#d7192a', '#1b1b1b', '#1d63c9'];
const sign = build('Repair Space', { options: { charColor: [0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1] } });

test('STL : face posée sur le plateau, taille conforme', async () => {
  const r = await sign;
  for (const seg of r.segments) for (const p of seg.parts) {
    const stl = makeStl(seg, p), nt = p.mesh.idx.length / 3;
    assert.equal(stl.length, 84 + nt * 50);
    const v = printCoords(seg, p);
    let zmin = Infinity; for (let i = 2; i < v.length; i += 3) zmin = Math.min(zmin, v[i]);
    assert.ok(Math.abs(zmin) < 1e-3, `${seg.label} / ${p.kind} : la pièce doit toucher le plateau`);
  }
});

test('plateaux : chaque pièce tient dans son plateau, sans chevauchement', async () => {
  const r = await sign;
  const plates = packPlates(r.segments, P.bedX, P.bedY);
  assert.equal(plates.flatMap(pl => pl.items).length, r.segments.length);
  for (const pl of plates) {
    for (const [i, a] of pl.items.entries()) {
      assert.ok(a.x >= 0 && a.y >= 0 && a.x + a.w <= P.bedX && a.y + a.h <= P.bedY, `${a.seg.label} hors plateau`);
      for (const b of pl.items.slice(i + 1))
        assert.ok(a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y, `${a.seg.label} chevauche ${b.seg.label}`);
    }
  }
});

test('3MF : plateaux et filament par pièce pour OrcaSlicer / Bambu Studio', async () => {
  const r = await sign;
  const files = unzipSync(make3mf(r.segments, { colors: COLORS, bedX: P.bedX, bedY: P.bedY }, { zipSync, strToU8 }));
  assert.deepEqual(Object.keys(files).sort(), ['3D/3dmodel.model', 'Metadata/model_settings.config', '[Content_Types].xml', '_rels/.rels']);
  const cfg = strFromU8(files['Metadata/model_settings.config']);
  const plates = [...cfg.matchAll(/<plate>([\s\S]*?)<\/plate>/g)];
  const instances = plates.flatMap(p => [...p[1].matchAll(/key="object_id" value="(\d+)"/g)]);
  assert.equal(instances.length, r.segments.length);
  // fond sur le filament 1, lettres A et B sur les filaments 2 et 3
  const extruders = new Set([...cfg.matchAll(/value="(Fond|Lettres [ABC]|Liaison)"\/>\s*<metadata key="extruder" value="(\d)"/g)].map(m => `${m[1]}=${m[2]}`));
  assert.deepEqual([...extruders].sort(), ['Fond=1', 'Lettres A=2', 'Lettres B=3', 'Liaison=1']);
});
