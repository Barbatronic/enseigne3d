// Calcul en arrière-plan : l'interface reste fluide pendant que manifold-3d travaille.
// Messages reçus :  { type: 'font', buffer }  |  { type: 'build', id, P, opts }
// Messages envoyés : { type: 'ready' } | { type: 'font', ok, error } | { type: 'result', id, result } | { type: 'error', id, message }
import { CDN } from './config.js';
import { buildSign } from './geometry/build.js';

let wasm = null, font = null, opentype = null;

const ready = Promise.all([
  import(CDN.manifold).then(async ({ default: Module }) => { wasm = await Module(); wasm.setup(); }),
  import(CDN.opentype).then(m => { opentype = m.default; }),
]);
ready.then(() => self.postMessage({ type: 'ready' }), e => self.postMessage({ type: 'engine-error', message: String(e?.message || e) }));

self.onmessage = async ({ data }) => {
  await ready;
  if (data.type === 'font') {
    try { font = opentype.parse(data.buffer); self.postMessage({ type: 'font', ok: true }); }
    catch (e) { self.postMessage({ type: 'font', ok: false, error: String(e?.message || e) }); }
  } else if (data.type === 'build') {
    const t0 = performance.now();
    try {
      const result = buildSign(wasm, font, data.P, data.opts);
      result.ms = Math.round(performance.now() - t0);
      const transfer = result.segments.flatMap(s => s.parts.flatMap(p => [p.mesh.pos.buffer, p.mesh.idx.buffer]));
      self.postMessage({ type: 'result', id: data.id, result }, transfer);
    } catch (e) {
      self.postMessage({ type: 'error', id: data.id, message: String(e?.message || e) });
    }
  }
};
