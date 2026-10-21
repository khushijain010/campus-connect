// Small decorative 3D scenes for page banners in the logged-in app: a cluster of glossy shapes that float,
// spin and lean toward the cursor. Presets give each page its own arrangement and colours.
// Loaded lazily (see components/Scene3D.jsx) so three.js never blocks the first paint.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

const C = { blue: '#1f6feb', sky: '#60a5fa', violet: '#8b5cf6', amber: '#f59e0b', red: '#ef4444', green: '#22c55e', pink: '#ec4899', white: '#f8fbff' };

// [shape, colour, [x, y, z], scale]. The scene frames a ~6.4 × 4 box, so x ∈ [-3.2, 3.2], y ∈ [-2, 2].
const PRESETS = {
  home: [
    ['torus', C.blue, [0.2, 0.15, 0], 1.25],
    ['ico', C.violet, [-1.95, 0.95, -0.4], 0.8],
    ['sphere', C.amber, [1.95, 1.05, 0.3], 0.6],
    ['capsule', C.red, [2.15, -0.95, 0.2], 0.75],
    ['knot', C.sky, [-1.7, -1.05, 0.5], 0.62],
    ['sphere', C.green, [-0.55, 1.65, -0.8], 0.3],
    ['octa', C.pink, [0.85, -1.55, 0.6], 0.42],
  ],
  discover: [
    ['octa', C.violet, [0, 0.05, 0], 1.3],
    ['torus', C.amber, [-2.0, 0.85, -0.3], 0.75],
    ['box', C.blue, [2.0, 0.95, -0.2], 0.8],
    ['sphere', C.green, [1.9, -1.1, 0.4], 0.5],
    ['capsule', C.sky, [-1.9, -1.05, 0.3], 0.7],
    ['ico', C.red, [-0.6, -1.6, 0.8], 0.36],
    ['sphere', C.pink, [0.9, 1.65, -0.6], 0.26],
  ],
  chats: [
    ['bubble', C.blue, [-0.75, 0.35, 0], 1.15],
    ['bubbleR', C.white, [0.95, -0.45, 0.6], 0.95],
    ['dot', C.violet, [0.55, -0.45, 1.2], 0.2],
    ['dot', C.violet, [0.95, -0.45, 1.2], 0.2],
    ['dot', C.violet, [1.35, -0.45, 1.2], 0.2],
    ['sphere', C.amber, [-2.2, -1.2, 0.3], 0.38],
    ['torus', C.violet, [2.25, 1.25, -0.4], 0.5],
    ['ico', C.green, [-2.1, 1.35, -0.5], 0.35],
  ],
};

function geometry(kind) {
  switch (kind) {
    case 'torus': return new THREE.TorusGeometry(0.62, 0.25, 40, 96);
    case 'ico': return new THREE.IcosahedronGeometry(0.62, 0);
    case 'octa': return new THREE.OctahedronGeometry(0.62, 0);
    case 'capsule': return new THREE.CapsuleGeometry(0.28, 0.75, 10, 28);
    case 'knot': return new THREE.TorusKnotGeometry(0.42, 0.14, 140, 18);
    case 'box': return new RoundedBoxGeometry(0.95, 0.95, 0.95, 5, 0.22);
    case 'dot': return new THREE.SphereGeometry(0.5, 24, 24);
    case 'bubble':
    case 'bubbleR': {
      // A rounded speech bubble: a soft slab plus a little tail.
      const body = new RoundedBoxGeometry(1.7, 1.15, 0.5, 6, 0.24);
      const tail = new THREE.ConeGeometry(0.2, 0.42, 24);
      tail.rotateZ(kind === 'bubble' ? Math.PI * 0.82 : -Math.PI * 0.82);
      tail.translate(kind === 'bubble' ? -0.55 : 0.55, -0.66, 0);
      return mergeGeometries([body, tail]);
    }
    default: return new THREE.SphereGeometry(0.62, 48, 48);
  }
}

// Minimal non-indexed merge so we don't pull in BufferGeometryUtils for one use.
function mergeGeometries(geos) {
  const parts = geos.map((g) => (g.index ? g.toNonIndexed() : g));
  const total = parts.reduce((n, g) => n + g.attributes.position.count, 0);
  const pos = new Float32Array(total * 3);
  const nor = new Float32Array(total * 3);
  let o = 0;
  for (const g of parts) {
    pos.set(g.attributes.position.array, o * 3);
    nor.set(g.attributes.normal.array, o * 3);
    o += g.attributes.position.count;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  geos.forEach((g) => g.dispose());
  parts.forEach((g) => g.dispose());
  return out;
}

export function createShapesScene(container, { preset = 'home', reducedMotion = false } = {}) {
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' });
  } catch {
    return null;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environment = envTex;
  pmrem.dispose();

  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
  scene.add(new THREE.HemisphereLight('#ffffff', '#dbe6ff', 0.8));
  const key = new THREE.DirectionalLight('#ffffff', 1.5);
  key.position.set(3, 4, 6);
  scene.add(key);
  const rim = new THREE.PointLight(C.violet, 14, 12);
  rim.position.set(-3.5, -1.5, 3);
  scene.add(rim);

  const root = new THREE.Group();
  scene.add(root);
  const disposables = [];
  const items = (PRESETS[preset] || PRESETS.home).map(([kind, color, pos, scale], i) => {
    const geo = geometry(kind);
    const mat = new THREE.MeshPhysicalMaterial({
      color, roughness: kind === 'bubbleR' ? 0.25 : 0.14, metalness: 0.04, clearcoat: 1, clearcoatRoughness: 0.08,
      flatShading: kind === 'ico' || kind === 'octa',
    });
    disposables.push(geo, mat);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(...pos);
    mesh.scale.setScalar(scale);
    const isBubble = kind.startsWith('bubble') || kind === 'dot';
    if (!isBubble) mesh.rotation.set(i * 0.7, i * 1.1, i * 0.4);
    else mesh.rotation.set(0.1, kind === 'bubble' ? 0.35 : -0.35, 0);
    root.add(mesh);
    return { mesh, kind, baseY: pos[1], phase: i * 1.37, spin: isBubble ? 0 : 0.18 + (i % 3) * 0.08 };
  });

  const pointer = { x: 0, y: 0 };
  const onMove = (e) => {
    const r = container.getBoundingClientRect();
    pointer.x = THREE.MathUtils.clamp(((e.clientX - r.left) / r.width) * 2 - 1, -1.5, 1.5);
    pointer.y = THREE.MathUtils.clamp(((e.clientY - r.top) / r.height) * 2 - 1, -1.5, 1.5);
  };
  window.addEventListener('pointermove', onMove, { passive: true });

  let running = false;
  let visible = true;
  let raf = 0;
  let last = performance.now();
  let t = 0;

  const resize = () => {
    const w = container.clientWidth || 1;
    const h = container.clientHeight || 1;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    const tan = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    camera.position.set(0, 0, Math.max(4.4 / (2 * tan), 6.8 / (2 * tan * camera.aspect)));
    camera.updateProjectionMatrix();
    if (!running) renderer.render(scene, camera);
  };

  function update(dt) {
    t += dt;
    root.rotation.y += (pointer.x * 0.35 - root.rotation.y) * 0.05;
    root.rotation.x += (pointer.y * 0.2 - root.rotation.x) * 0.05;
    for (const it of items) {
      const bob = it.kind === 'dot' ? 0.12 : 0.1;
      const speed = it.kind === 'dot' ? 3 : 0.9;
      it.mesh.position.y = it.baseY + Math.sin(t * speed + it.phase) * bob;
      if (it.spin) { it.mesh.rotation.x += it.spin * dt; it.mesh.rotation.y += it.spin * 0.8 * dt; }
    }
  }
  const frame = (now) => {
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    update(dt);
    renderer.render(scene, camera);
    raf = requestAnimationFrame(frame);
  };
  const setRunning = () => {
    const should = visible && !document.hidden && !reducedMotion;
    if (should && !running) { running = true; last = performance.now(); raf = requestAnimationFrame(frame); }
    if (!should && running) { running = false; cancelAnimationFrame(raf); }
  };

  const ro = new ResizeObserver(resize);
  ro.observe(container);
  const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; setRunning(); });
  io.observe(container);
  document.addEventListener('visibilitychange', setRunning);
  update(0);
  resize();
  setRunning();

  return {
    dispose() {
      running = false;
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      document.removeEventListener('visibilitychange', setRunning);
      window.removeEventListener('pointermove', onMove);
      disposables.forEach((d) => d.dispose());
      envTex.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}
