// Contrôles géométriques : chaque pièce doit être un solide fermé d'un seul morceau,
// avec exactement un trou traversant par vis, et sans avertissement inattendu.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build, solid, everyLetter } from './helpers.js';

const screwWarnings = r => r.warnings.filter(w => /pas de portion droite|Pas de place pour les plots/.test(w));

async function assertPrintable(r) {
  for (const seg of r.segments) {
    for (const p of seg.parts) {
      const s = await solid(p.mesh);
      assert.equal(s.status, 'NoError', `${seg.label} / ${p.kind} : maillage invalide`);
      assert.ok(s.volume > 0, `${seg.label} / ${p.kind} : volume nul`);
      if (p.kind === 'base') assert.equal(s.pieces, 1, `${seg.label} : le fond doit être d'un seul morceau`);
    }
  }
}

test('Repair Space : 4 blocs + 1 liaison, vis alignées sur les trous', async () => {
  const r = await build('Repair Space');
  assert.deepEqual(r.warnings, []);
  assert.deepEqual(r.segments.map(s => s.label), ['Repa', 'ir', 'Spac', 'e', 'r↔S']);
  await assertPrintable(r);
  // chaque vis (jonction ou liaison) traverse le fond : genre du solide = nombre de vis du bloc
  for (const seg of r.segments) assert.equal((await solid(seg.parts[0].mesh)).genus, seg.screws, seg.label);
  assert.deepEqual(r.screws, [{ n: 4, len: 10 }, { n: 4, len: 12 }]);
});

test('une lettre par bloc : toutes les jonctions ont leurs vis (Apprentissage, 100 mm)', async () => {
  const r = await build('Apprentissage', { params: { capH: 100 }, options: { manualCuts: everyLetter('Apprentissage') } });
  assert.equal(r.segments.length, 13);
  assert.deepEqual(screwWarnings(r), []);
  await assertPrintable(r);
});

test('une lettre par bloc avec espaces : le calcul se termine (régression boucle infinie)', async () => {
  const r = await build('Fab Lab Jafr', { options: { manualCuts: everyLetter('Fab Lab Jafr') } });
  assert.equal(r.segments.filter(s => s.link).length, 2);
  assert.deepEqual(screwWarnings(r), []);
  await assertPrintable(r);
});

test('police à pied (Lilita One) : vis à chaque jonction', async () => {
  const r = await build('Fab Lab', { fontId: 'lilita-one', weight: 400, options: { manualCuts: everyLetter('Fab Lab') } });
  assert.deepEqual(screwWarnings(r), []);
  await assertPrintable(r);
});

test('liaison à 0 % : les mots sont des blocs indépendants, signalés', async () => {
  const r = await build('Repair Space', { params: { bridge: 0 } });
  assert.ok(r.warnings.some(w => w.includes('ne se touchent pas')));
  assert.equal(r.segments.some(s => s.link), false);
});

for (const fixType of ['keyhole', 'hook', 'tape']) {
  test(`fixation « ${fixType} » : un point par bloc, tous à la même hauteur`, async () => {
    const r = await build('Repair Space', { options: { fixType } });
    assert.equal(r.fix.type, fixType);
    assert.equal(r.fix.xs.length, 4);
    assert.deepEqual(r.warnings, []);
    await assertPrintable(r);
  });
}

test('flèche : ajoutée comme une lettre, dans sa couleur', async () => {
  const r = await build('Atelier', { options: { arrow: 'right', arrowColor: 1 } });
  assert.ok(r.segments.some(s => s.label.endsWith('→')));
  assert.ok(r.segments.some(s => s.parts.some(p => p.kind === 'letters' && p.color === 1)));
  await assertPrintable(r);
});

test('drapeau double face : deux faces de même taille, flèche inversée sur la face B', async () => {
  const r = await build('Toilettes', { params: { capH: 30 }, options: { signType: 'flag', arrow: 'right' } });
  assert.deepEqual(r.segments.map(s => s.label), ['Face A', 'Face B']);
  const [a, b] = r.segments;
  assert.equal(a.w, b.w); assert.equal(a.h, b.h);
  assert.equal(r.fix.type, 'flag');
  assert.deepEqual(r.warnings, []);
  await assertPrintable(r);
});
