// Export STL binaire, dans le repère d'impression.

// Repère d'impression : rotation de 180° autour de X, face posée sur le plateau (z = 0)
export function printCoords(seg, p) {
  const b = seg.bounds, src = p.mesh.pos, out = new Float32Array(src.length);
  for (let i = 0; i < out.length; i += 3) {
    out[i] = src[i] - b.min[0];
    out[i+1] = b.max[1] - src[i+1];
    out[i+2] = seg.D - src[i+2];
  }
  return out;
}

export function makeStl(seg, p) {
  const v = printCoords(seg, p), idx = p.mesh.idx, nt = idx.length / 3;
  const buf = new ArrayBuffer(84 + nt * 50), dv = new DataView(buf);
  const head = `Enseigne ${seg.label}`;
  for (let i = 0; i < Math.min(80, head.length); i++) dv.setUint8(i, head.charCodeAt(i) & 0x7f);
  dv.setUint32(80, nt, true);
  let o = 84;
  for (let t = 0; t < nt; t++) {
    const a = idx[3*t]*3, b = idx[3*t+1]*3, c = idx[3*t+2]*3;
    const ux = v[b]-v[a], uy = v[b+1]-v[a+1], uz = v[b+2]-v[a+2], wx = v[c]-v[a], wy = v[c+1]-v[a+1], wz = v[c+2]-v[a+2];
    const nx = uy*wz - uz*wy, ny = uz*wx - ux*wz, nz = ux*wy - uy*wx, l = Math.hypot(nx, ny, nz) || 1;
    dv.setFloat32(o, nx/l, true); dv.setFloat32(o+4, ny/l, true); dv.setFloat32(o+8, nz/l, true); o += 12;
    for (const q of [a, b, c]) { dv.setFloat32(o, v[q], true); dv.setFloat32(o+4, v[q+1], true); dv.setFloat32(o+8, v[q+2], true); o += 12; }
    o += 2;
  }
  return new Uint8Array(buf);
}
