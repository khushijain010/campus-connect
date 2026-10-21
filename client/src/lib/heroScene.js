// Landing-page hero: a 3D "connection globe" — students as glowing nodes on a dotted sphere, arcs that draw
// themselves between them with pulses travelling along, orbit rings and floating glossy shapes.
// Plain three.js (no React renderer) so it loads as its own chunk only on the landing page.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const COLORS = { navy: '#0f1d3a', blue: '#1f6feb', sky: '#60a5fa', red: '#ef4444', amber: '#f59e0b', violet: '#8b5cf6', green: '#22c55e' };
const NODE_COLORS = [COLORS.blue, COLORS.red, COLORS.amber, COLORS.violet, COLORS.green, COLORS.sky];
const R = 2;

// Deterministic randomness so the globe looks the same on every visit.
function mulberry32(seed) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function radialTexture(stops) {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  for (const [at, color] of stops) grad.addColorStop(at, color);
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

const easeOut = (t) => 1 - (1 - t) ** 3;

export function createHeroScene(container, { reducedMotion = false } = {}) {
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
  } catch {
    return null; // no WebGL → the page shows its CSS fallback
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.domElement.style.touchAction = 'pan-y';
  container.appendChild(renderer.domElement);

  const disposables = [];
  const track = (x) => { disposables.push(x); return x; };

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environment = envTex;
  pmrem.dispose();

  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
  scene.add(new THREE.HemisphereLight('#ffffff', '#dbe6ff', 0.9));
  const key = new THREE.DirectionalLight('#ffffff', 1.6);
  key.position.set(4, 5, 6);
  scene.add(key);
  const rimV = new THREE.PointLight(COLORS.violet, 18, 14);
  rimV.position.set(-4.5, -1.5, 3);
  scene.add(rimV);
  const rimA = new THREE.PointLight(COLORS.amber, 12, 14);
  rimA.position.set(4.5, -2.5, 2.5);
  scene.add(rimA);

  const rand = mulberry32(20251);
  const root = new THREE.Group();
  scene.add(root);
  const tilt = new THREE.Group();
  tilt.rotation.set(0.32, 0, 0.28);
  root.add(tilt);
  const globe = new THREE.Group();
  tilt.add(globe);

  // Core: soft glossy pearl sphere.
  globe.add(new THREE.Mesh(
    track(new THREE.SphereGeometry(R * 0.985, 72, 72)),
    track(new THREE.MeshPhysicalMaterial({ color: '#e4edff', roughness: 0.3, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.25, envMapIntensity: 0.9 })),
  ));

  // Surface dots on a Fibonacci lattice, mostly blue with the odd brand colour.
  const DOTS = 1500;
  const dotPos = new Float32Array(DOTS * 3);
  const dotCol = new Float32Array(DOTS * 3);
  const c = new THREE.Color();
  for (let i = 0; i < DOTS; i++) {
    const y = 1 - (i / (DOTS - 1)) * 2;
    const r = Math.sqrt(1 - y * y);
    const th = Math.PI * (3 - Math.sqrt(5)) * i;
    dotPos.set([Math.cos(th) * r * R * 1.004, y * R * 1.004, Math.sin(th) * r * R * 1.004], i * 3);
    const roll = rand();
    c.set(roll < 0.04 ? NODE_COLORS[Math.floor(rand() * NODE_COLORS.length)] : roll < 0.55 ? '#4f86ea' : '#98b4e6');
    dotCol.set([c.r, c.g, c.b], i * 3);
  }
  const dotGeo = track(new THREE.BufferGeometry());
  dotGeo.setAttribute('position', new THREE.BufferAttribute(dotPos, 3));
  dotGeo.setAttribute('color', new THREE.BufferAttribute(dotCol, 3));
  const dotTex = track(radialTexture([[0, 'rgba(255,255,255,1)'], [0.55, 'rgba(255,255,255,1)'], [1, 'rgba(255,255,255,0)']]));
  globe.add(new THREE.Points(dotGeo, track(new THREE.PointsMaterial({
    size: 0.058, map: dotTex, vertexColors: true, transparent: true, alphaTest: 0.2, toneMapped: false,
  }))));

  // Student nodes, spread out so arcs don't bunch up.
  const glowTex = track(radialTexture([[0, 'rgba(255,255,255,0.95)'], [0.3, 'rgba(255,255,255,0.45)'], [1, 'rgba(255,255,255,0)']]));
  const nodeGeo = track(new THREE.SphereGeometry(0.075, 20, 20));
  const nodes = [];
  while (nodes.length < 18) {
    const u = rand() * 2 - 1;
    const phi = rand() * Math.PI * 2;
    const s = Math.sqrt(1 - u * u);
    const dir = new THREE.Vector3(s * Math.cos(phi), u, s * Math.sin(phi));
    if (nodes.some((n) => n.dir.angleTo(dir) < 0.55)) continue;
    const color = NODE_COLORS[nodes.length % NODE_COLORS.length];
    const mesh = new THREE.Mesh(nodeGeo, track(new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.55, roughness: 0.3 })));
    mesh.position.copy(dir).multiplyScalar(R * 1.02);
    const glow = new THREE.Sprite(track(new THREE.SpriteMaterial({ map: glowTex, color, transparent: true, depthWrite: false, opacity: 0.75, toneMapped: false })));
    glow.position.copy(mesh.position);
    glow.scale.setScalar(0.42);
    globe.add(mesh, glow);
    nodes.push({ dir, glow, phase: rand() * Math.PI * 2 });
  }

  // Arcs between nodes; each draws itself in, then carries a travelling pulse.
  const arcs = [];
  const pulseGeo = track(new THREE.SphereGeometry(0.045, 12, 12));
  for (let i = 0; i < nodes.length && arcs.length < 17; i++) {
    const others = nodes.map((n, j) => ({ j, ang: nodes[i].dir.angleTo(n.dir) }))
      .filter(({ j, ang }) => j !== i && ang > 0.6 && ang < 2.2 && !arcs.some((a) => (a.i === j && a.j === i)))
      .sort(() => rand() - 0.5).slice(0, i % 3 === 0 ? 2 : 1);
    for (const { j, ang } of others) {
      const a = nodes[i].dir.clone().multiplyScalar(R * 1.02);
      const b = nodes[j].dir.clone().multiplyScalar(R * 1.02);
      const mid = a.clone().add(b).normalize().multiplyScalar(R * (1.25 + ang * 0.32));
      const curve = new THREE.QuadraticBezierCurve3(a, mid, b);
      const color = NODE_COLORS[(i + j) % NODE_COLORS.length];
      const geo = track(new THREE.TubeGeometry(curve, 80, 0.011, 6, false));
      const tube = new THREE.Mesh(geo, track(new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.8, toneMapped: false })));
      const pulse = new THREE.Mesh(pulseGeo, track(new THREE.MeshBasicMaterial({ color: '#ffffff', toneMapped: false })));
      const halo = new THREE.Sprite(track(new THREE.SpriteMaterial({ map: glowTex, color, transparent: true, depthWrite: false, toneMapped: false })));
      halo.scale.setScalar(0.3);
      pulse.add(halo);
      globe.add(tube, pulse);
      arcs.push({ i, j, curve, geo, pulse, start: 0.35 + arcs.length * 0.18, speed: 0.22 + rand() * 0.18, offset: rand() });
    }
  }

  // Orbit rings with little satellites.
  const rings = [];
  for (const [radius, rx, ry, color, speed] of [[2.75, 1.2, 0.25, COLORS.blue, 0.35], [3.05, 1.75, -0.6, COLORS.violet, -0.22]]) {
    const g = new THREE.Group();
    g.rotation.set(rx, ry, 0);
    g.add(new THREE.Mesh(track(new THREE.TorusGeometry(radius, 0.007, 8, 220)), track(new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.35, toneMapped: false }))));
    const sat = new THREE.Mesh(track(new THREE.SphereGeometry(0.09, 24, 24)), track(new THREE.MeshPhysicalMaterial({ color, roughness: 0.15, clearcoat: 1 })));
    g.add(sat);
    root.add(g);
    rings.push({ sat, radius, speed, angle: rand() * Math.PI * 2 });
  }

  // Floating glossy shapes around the globe (in root space, so they don't spin with it).
  const glossy = (color) => track(new THREE.MeshPhysicalMaterial({ color, roughness: 0.16, metalness: 0.05, clearcoat: 1, clearcoatRoughness: 0.08 }));
  const shapes = [
    [new THREE.IcosahedronGeometry(0.36, 0), COLORS.violet, [-3.0, 1.55, 0.4]],
    [new THREE.TorusGeometry(0.28, 0.11, 24, 64), COLORS.amber, [2.95, 1.75, -0.3]],
    [new THREE.CapsuleGeometry(0.15, 0.42, 8, 24), COLORS.red, [3.05, -1.55, 0.6]],
    [new THREE.OctahedronGeometry(0.3, 0), COLORS.sky, [-2.75, -1.85, 0.7]],
    [new THREE.SphereGeometry(0.16, 32, 32), COLORS.green, [-1.2, 2.75, -0.8]],
    [new THREE.TorusKnotGeometry(0.17, 0.055, 96, 12), COLORS.blue, [1.45, -2.7, 0.3]],
  ].map(([geo, color, pos], k) => {
    const m = new THREE.Mesh(track(geo), glossy(color));
    m.position.set(...pos);
    m.rotation.set(rand() * 3, rand() * 3, rand() * 3);
    root.add(m);
    return { m, base: pos[1], phase: k * 1.3, spin: 0.25 + rand() * 0.35 };
  });

  // ---------------------------------------------------------------- interaction
  const pointer = { x: 0, y: 0 };
  let spinVel = 0;
  let drag = null;
  const onMove = (e) => {
    const r = container.getBoundingClientRect();
    pointer.x = THREE.MathUtils.clamp(((e.clientX - r.left) / r.width) * 2 - 1, -1.5, 1.5);
    pointer.y = THREE.MathUtils.clamp(((e.clientY - r.top) / r.height) * 2 - 1, -1.5, 1.5);
    if (drag) {
      const dx = e.clientX - drag.x;
      drag.x = e.clientX;
      globe.rotation.y += dx * 0.008;
      spinVel = dx * 0.0006;
    }
  };
  const onDown = (e) => { if (e.pointerType === 'mouse') { drag = { x: e.clientX }; container.classList.add('grabbing'); } };
  const onUp = () => { drag = null; container.classList.remove('grabbing'); };
  window.addEventListener('pointermove', onMove, { passive: true });
  renderer.domElement.addEventListener('pointerdown', onDown);
  window.addEventListener('pointerup', onUp);

  // ---------------------------------------------------------------- sizing
  const resize = () => {
    const w = container.clientWidth || 1;
    const h = container.clientHeight || 1;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    // Keep the globe, rings and shapes inside the frame at any aspect ratio.
    const tan = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    camera.position.set(0, 0, Math.max(6.7 / (2 * tan), 7.4 / (2 * tan * camera.aspect)));
    camera.updateProjectionMatrix();
    if (!running) render(); // keep a correct still frame when paused / reduced motion
  };

  // ---------------------------------------------------------------- loop
  let elapsed = reducedMotion ? 30 : 0;
  let last = performance.now();
  let raf = 0;
  let running = false;
  let visible = true;

  function update(dt) {
    elapsed += dt;
    root.rotation.y += (pointer.x * 0.28 - root.rotation.y) * 0.04;
    root.rotation.x += (pointer.y * 0.16 - root.rotation.x) * 0.04;
    if (!drag) {
      globe.rotation.y += (0.12 * dt) + spinVel;
      spinVel *= 0.95;
    }
    for (const n of nodes) n.glow.scale.setScalar(0.36 + Math.sin(elapsed * 2.2 + n.phase) * 0.08);
    for (const a of arcs) {
      const p = THREE.MathUtils.clamp((elapsed - a.start) / 1.3, 0, 1);
      const count = a.geo.index.count;
      a.geo.setDrawRange(0, Math.floor((count * easeOut(p)) / 3) * 3);
      if (p < 1) { a.pulse.visible = false; continue; }
      const t = ((elapsed - a.start - 1.3) * a.speed + a.offset) % 1;
      a.pulse.visible = true;
      a.curve.getPoint(t, a.pulse.position);
      a.pulse.scale.setScalar(Math.sin(t * Math.PI) * 1.1 + 0.2);
    }
    for (const r of rings) {
      r.angle += r.speed * dt;
      r.sat.position.set(Math.cos(r.angle) * r.radius, Math.sin(r.angle) * r.radius, 0);
    }
    for (const s of shapes) {
      s.m.position.y = s.base + Math.sin(elapsed * 0.9 + s.phase) * 0.14;
      s.m.rotation.x += s.spin * dt;
      s.m.rotation.y += s.spin * 0.7 * dt;
    }
  }
  function render() { renderer.render(scene, camera); }
  function frame(now) {
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    update(dt);
    render();
    raf = requestAnimationFrame(frame);
  }
  function setRunning() {
    const should = visible && !document.hidden && !reducedMotion;
    if (should && !running) { running = true; last = performance.now(); raf = requestAnimationFrame(frame); }
    if (!should && running) { running = false; cancelAnimationFrame(raf); }
  }

  const ro = new ResizeObserver(resize);
  ro.observe(container);
  const io = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; setRunning(); });
  io.observe(container);
  const onVis = () => setRunning();
  document.addEventListener('visibilitychange', onVis);

  update(0);
  resize();
  render();
  setRunning();

  return {
    dispose() {
      running = false;
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      renderer.domElement.removeEventListener('pointerdown', onDown);
      for (const d of disposables) d.dispose();
      envTex.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}
