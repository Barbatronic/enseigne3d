// Outils communs aux tests : moteur manifold, polices locales, contrôle des solides.
import { readFileSync } from 'node:fs';
import Module from 'manifold-3d';
import opentype from 'opentype.js';
import { buildSign } from '../js/geometry/build.js';
import { defaultParams, defaultOptions } from '../js/config.js';

let wasmPromise;
export function engine() {
  wasmPromise ??= Module().then(w => { w.setup(); return w; });
  return wasmPromise;
}

const fonts = new Map();
export function font(id = 'nunito', weight = 800) {
  const key = `${id}-${weight}`;
  if (!fonts.has(key)) {
    const buf = readFileSync(new URL(`../node_modules/@fontsource/${id}/files/${id}-latin-${weight}-normal.woff`, import.meta.url));
    fonts.set(key, opentype.parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength)));
  }
  return fonts.get(key);
}

export { everyLetter } from '../js/ui/chips.js';

export async function build(text, { params = {}, options = {}, fontId, weight } = {}) {
  const wasm = await engine();
  const opts = { ...defaultOptions(), text, charColor: Array.from(text).map(() => 0), ...options };
  return buildSign(wasm, font(fontId, weight), { ...defaultParams(), ...params }, opts);
}

// Reconstruit un solide depuis un maillage exporté : état, genre (nombre de trous traversants), morceaux
export async function solid(mesh) {
  const wasm = await engine();
  const m = new wasm.Manifold(new wasm.Mesh({ numProp: 3, vertProperties: mesh.pos, triVerts: mesh.idx }));
  const out = { status: m.status(), genus: m.genus(), pieces: m.decompose().length, volume: m.volume() };
  m.delete();
  return out;
}
