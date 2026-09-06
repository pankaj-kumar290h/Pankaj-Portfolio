import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';

const REDUCE_MOTION = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const cssColor = (name, fallback) => new THREE.Color(
  getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback
);
const accent = () => cssColor('--accent', '#a8641a');
const muted  = () => cssColor('--fg-muted', '#4c6883');

/* ------------------------------------------------------------------ *
 *  1. Cursor spotlight (DOM)
 * ------------------------------------------------------------------ */
(function spotlight(){
  if (REDUCE_MOTION) return;
  const spot = document.querySelector('.spotlight');
  const frame = document.querySelector('.sheet-frame');
  if (!spot || !frame) return;

  window.addEventListener('mousemove', (e) => {
    spot.style.setProperty('--mx', e.clientX + 'px');
    spot.style.setProperty('--my', e.clientY + 'px');
  });
  frame.addEventListener('mouseenter', () => { spot.style.opacity = '1'; });
  frame.addEventListener('mouseleave', () => { spot.style.opacity = '0'; });
})();

/* ------------------------------------------------------------------ *
 *  2. three.js blueprint background
 * ------------------------------------------------------------------ */
(function background(){
  const canvas = document.getElementById('bg');
  if (!canvas) return;

  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
  camera.position.set(0, 0, 9);

  const group = new THREE.Group();
  scene.add(group);

  const mats = [];

  const ico = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.IcosahedronGeometry(2.4, 1)),
    new THREE.LineBasicMaterial({ color: accent(), transparent: true, opacity: 0.35 })
  );
  ico.position.set(3.2, 0.4, 0);
  group.add(ico); mats.push(ico.material);

  const torus = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.TorusGeometry(3.6, 0.9, 8, 24)),
    new THREE.LineBasicMaterial({ color: accent(), transparent: true, opacity: 0.14 })
  );
  torus.position.copy(ico.position);
  torus.rotation.x = Math.PI / 3;
  group.add(torus); mats.push(torus.material);

  const count = 140;
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i++){
    positions[i * 3]     = (Math.random() - 0.5) * 22;
    positions[i * 3 + 1] = (Math.random() - 0.5) * 14;
    positions[i * 3 + 2] = (Math.random() - 0.5) * 6;
  }
  const pts = new THREE.Points(
    new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(positions, 3)),
    new THREE.PointsMaterial({ color: accent(), size: 0.045, transparent: true, opacity: 0.5 })
  );
  scene.add(pts); mats.push(pts.material);

  const target = { x: 0, y: 0 };
  window.addEventListener('mousemove', (e) => {
    target.x = (e.clientX / window.innerWidth - 0.5) * 2;
    target.y = (e.clientY / window.innerHeight - 0.5) * 2;
  });

  function resize(){
    const w = window.innerWidth, h = window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  window.addEventListener('resize', resize);
  resize();

  const syncColor = () => {
    const c = accent();
    mats.forEach(m => m.color.copy(c));
    if (REDUCE_MOTION) renderer.render(scene, camera);
  };
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', syncColor);
  new MutationObserver(syncColor).observe(document.documentElement, {
    attributes: true, attributeFilter: ['data-theme']
  });

  if (REDUCE_MOTION){
    renderer.render(scene, camera);
    return;
  }

  const clock = new THREE.Clock();
  (function tick(){
    const t = clock.getElapsedTime();
    ico.rotation.y = t * 0.15;
    ico.rotation.x = t * 0.08;
    torus.rotation.z = t * 0.05;
    pts.rotation.y = t * 0.02;

    group.rotation.y += (target.x * 0.25 - group.rotation.y) * 0.04;
    group.rotation.x += (target.y * 0.15 - group.rotation.x) * 0.04;

    renderer.render(scene, camera);
    requestAnimationFrame(tick);
  })();
})();

/* ------------------------------------------------------------------ *
 *  3. Isometric view — full-stack assembly (labelled)
 * ------------------------------------------------------------------ */
(function isometric(){
  const canvas = document.getElementById('iso');
  const labelWrap = document.querySelector('.iso-labels');
  if (!canvas || !labelWrap) return;

  const layers = [
    { tier: 'Client · UI', tech: 'React · Next.js · TypeScript' },
    { tier: 'Rendering',   tech: 'Next.js SSG / SSR / ISR · CDN' },
    { tier: 'API',         tech: 'Node.js · Express · GraphQL · REST' },
    { tier: 'Data',        tech: 'PostgreSQL · Prisma · Supabase' },
    { tier: 'Cloud',       tech: 'AWS S3 / EC2 · CI/CD · Sentry' },
  ];

  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  const scene = new THREE.Scene();
  const FR = 6.5;
  const camera = new THREE.OrthographicCamera(-FR, FR, FR, -FR, -100, 100);
  camera.position.set(10, 8.7, 10);   // ~30° isometric
  camera.lookAt(0, 0, 0);

  // pivot shifts the whole assembly left so labels sit in the empty right area
  const pivot = new THREE.Group();
  pivot.position.x = -1.5;
  scene.add(pivot);
  const group = new THREE.Group();
  pivot.add(group);

  const W = 5, T = 0.32, GAP = 1.7;
  const topY = (layers.length - 1) * GAP / 2;
  const botY = topY - (layers.length - 1) * GAP;

  const accentMats = [];
  const mutedMats = [];
  const anchors = [];

  const slabGeo = new THREE.BoxGeometry(W, T, W);
  const edgeGeo = new THREE.EdgesGeometry(slabGeo);

  layers.forEach((l, i) => {
    const y = topY - i * GAP;

    const fillMat = new THREE.MeshBasicMaterial({ color: accent(), transparent: true, opacity: 0.05 });
    const slab = new THREE.Mesh(slabGeo, fillMat);
    slab.position.y = y;
    group.add(slab); accentMats.push(fillMat);

    const edgeMat = new THREE.LineBasicMaterial({ color: accent(), transparent: true, opacity: 0.55 });
    const edges = new THREE.LineSegments(edgeGeo, edgeMat);
    edges.position.y = y;
    group.add(edges); accentMats.push(edgeMat);

    const p1 = new THREE.Vector3(W / 2, y, W / 6);
    const p2 = new THREE.Vector3(W / 2 + 1.0, y, W / 6);
    const leadMat = new THREE.LineBasicMaterial({ color: muted(), transparent: true, opacity: 0.6 });
    group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([p1, p2]), leadMat));
    mutedMats.push(leadMat);
    anchors.push(p2);

    const el = document.createElement('div');
    el.className = 'iso-label';
    el.innerHTML = `<span class="tier">${l.tier}</span>`;
    labelWrap.appendChild(el);
    l._el = el;
  });

  // corner posts tying the stack together
  const postMat = new THREE.LineBasicMaterial({ color: accent(), transparent: true, opacity: 0.22 });
  accentMats.push(postMat);
  [[1, 1], [1, -1], [-1, 1], [-1, -1]].forEach(([sx, sz]) => {
    const g = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(sx * W / 2, topY, sz * W / 2),
      new THREE.Vector3(sx * W / 2, botY, sz * W / 2),
    ]);
    group.add(new THREE.Line(g, postMat));
  });

  // ---- interaction: drag to rotate ----
  let rotY = -0.4, rotX = 0;
  const targetRot = { y: -0.4, x: 0 };
  let dragging = false, px = 0, py = 0;

  canvas.style.cursor = 'grab';
  canvas.addEventListener('pointerdown', (e) => {
    dragging = true; px = e.clientX; py = e.clientY;
    canvas.style.cursor = 'grabbing';
    canvas.setPointerCapture(e.pointerId);
  });
  const endDrag = () => { dragging = false; canvas.style.cursor = 'grab'; };
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);
  canvas.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    targetRot.y += (e.clientX - px) * 0.008;
    targetRot.x += (e.clientY - py) * 0.005;
    targetRot.x = Math.max(-0.45, Math.min(0.55, targetRot.x));
    px = e.clientX; py = e.clientY;
  });

  const rectOf = () => canvas.getBoundingClientRect();
  const tmp = new THREE.Vector3();

  function updateLabels(){
    const r = rectOf();
    layers.forEach((l, i) => {
      tmp.copy(anchors[i]).applyMatrix4(group.matrixWorld).project(camera);
      const x = Math.min((tmp.x * 0.5 + 0.5) * r.width, r.width - 90);
      const y = (-tmp.y * 0.5 + 0.5) * r.height;
      l._el.style.transform = `translate(${x}px, ${y - 9}px)`;
    });
  }

  function resize(){
    const r = rectOf();
    renderer.setSize(r.width, r.height, false);
    const a = r.width / r.height;
    camera.left = -FR * a; camera.right = FR * a;
    camera.top = FR; camera.bottom = -FR;
    camera.updateProjectionMatrix();
  }
  window.addEventListener('resize', resize);
  resize();

  const syncColor = () => {
    const a = accent(), m = muted();
    accentMats.forEach(mat => mat.color.copy(a));
    mutedMats.forEach(mat => mat.color.copy(m));
  };
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', syncColor);
  new MutationObserver(syncColor).observe(document.documentElement, {
    attributes: true, attributeFilter: ['data-theme']
  });

  const clock = new THREE.Clock();
  (function tick(){
    const t = clock.getElapsedTime();
    const idle = (!REDUCE_MOTION && !dragging) ? Math.sin(t * 0.15) * 0.12 : 0;

    rotY += ((targetRot.y + idle) - rotY) * 0.09;
    rotX += (targetRot.x - rotX) * 0.09;
    group.rotation.set(rotX, rotY, 0);
    pivot.updateMatrixWorld(true);

    renderer.render(scene, camera);
    updateLabels();
    requestAnimationFrame(tick);
  })();
})();
