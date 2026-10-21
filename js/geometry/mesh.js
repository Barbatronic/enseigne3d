// Conversion d'un solide manifold en tableaux simples (positions + triangles)
export function meshOf(m) {
  const me = m.getMesh(), np = me.numProp, vp = me.vertProperties, nv = vp.length / np;
  let pos;
  if (np !== 3) {
    pos = new Float32Array(nv * 3);
    for (let i = 0; i < nv; i++) { pos[3*i] = vp[np*i]; pos[3*i+1] = vp[np*i+1]; pos[3*i+2] = vp[np*i+2]; }
  } else pos = new Float32Array(vp);
  return { pos, idx: new Uint32Array(me.triVerts) };
}
