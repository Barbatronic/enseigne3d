// Aperçu 3D (three.js) : blocs éclatés ou assemblés, vue de face ou de dos.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

export function createViewer(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(2, devicePixelRatio));
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(35, 1, 1, 50000);
  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  scene.add(new THREE.HemisphereLight(0xffffff, 0x8a8f8a, 1.6));
  const sun = new THREE.DirectionalLight(0xffffff, 1.6); sun.position.set(-0.6, 1, 1.4); scene.add(sun);
  const sun2 = new THREE.DirectionalLight(0xffffff, 0.5); sun2.position.set(1, -0.5, -1); scene.add(sun2);
  let root = new THREE.Group(); scene.add(root);
  let explode = true, gapMm = 8, needsFraming = true;
  const materials = [];

  const resize = () => {
    const w = canvas.clientWidth, h = canvas.clientHeight, pr = renderer.getPixelRatio();
    if (canvas.width !== Math.round(w * pr) || canvas.height !== Math.round(h * pr)) {
      renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
    }
  };
  (function loop() { resize(); controls.update(); renderer.render(scene, camera); requestAnimationFrame(loop); })();

  const recolor = colors => { for (const m of materials) m.color.set(colors[m.userData.ci + 1]); };

  const applyExplode = () => {
    const d = explode ? gapMm : 0;
    const maxO = Math.max(0, ...root.children.map(g => Math.floor(g.userData.order)));
    root.children.forEach(g => {
      // drapeau : les deux faces s'écartent dos à dos ; sinon les blocs s'écartent le long du texte
      if (g.userData.flag) { g.position.set(0, 0, (g.userData.flag === 'A' ? 1 : -1) * d / 2); return; }
      g.position.x = (g.userData.order - maxO / 2) * d;
    });
  };

  const frame = side => {
    const box = new THREE.Box3().setFromObject(root); if (box.isEmpty()) return;
    const c = box.getCenter(new THREE.Vector3()), s = box.getSize(new THREE.Vector3());
    const dist = Math.max(s.x / camera.aspect, s.y) / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))) * 1.15 + s.z;
    const dir = side === 'back' ? new THREE.Vector3(0.25, -0.35, -1) : new THREE.Vector3(-0.25, -0.35, 1);
    controls.target.copy(c); camera.position.copy(c).add(dir.normalize().multiplyScalar(dist));
    camera.near = dist / 100; camera.far = dist * 20; camera.updateProjectionMatrix();
  };

  const show = (result, colors, explodeGap) => {
    scene.remove(root); root.traverse(o => o.geometry?.dispose());
    materials.forEach(m => m.dispose()); materials.length = 0;
    root = new THREE.Group(); scene.add(root);
    gapMm = explodeGap;
    const mats = {};
    for (const ci of [-1, 0, 1, 2]) {
      const m = new THREE.MeshStandardMaterial({ color: colors[ci + 1], roughness: ci < 0 ? 0.75 : 0.55, metalness: 0, flatShading: true });
      m.userData.ci = ci; materials.push(m); mats[ci] = m;
    }
    result.segments.forEach((seg, i) => {
      const g = new THREE.Group();
      Object.assign(g.userData, { order: seg.order ?? i, flag: seg.flag });
      if (seg.flag === 'B') g.rotation.y = Math.PI;   // face B retournée, dos à dos avec A
      for (const p of seg.parts) {
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.BufferAttribute(p.mesh.pos, 3));
        geo.setIndex(new THREE.BufferAttribute(p.mesh.idx, 1));
        const flat = geo.toNonIndexed(); flat.computeVertexNormals(); geo.dispose();
        g.add(new THREE.Mesh(flat, mats[p.color]));
      }
      root.add(g);
    });
    applyExplode();
    if (needsFraming && result.segments.length) { frame('front'); needsFraming = false; }
  };

  return {
    show, recolor, frame,
    toggleExplode() { explode = !explode; applyExplode(); return explode; },
    reframeNext() { needsFraming = true; },
    camera, controls,
  };
}
