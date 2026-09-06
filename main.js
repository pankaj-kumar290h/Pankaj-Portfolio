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
  const n = layers.length;
  const topY = (n - 1) * GAP / 2;

  const FILL_O = 0.05, EDGE_O = 0.55, CONN_O = 0.4, LEAD_O = 0.6;

  const accentMats = [];
  const mutedMats = [];
  const anchors = [];
  const connectors = [];   // { line, mat, verts, gap }
  const leaders = [];      // { line, verts }

  const slabGeo = new THREE.BoxGeometry(W, T, W);
  const edgeGeo = new THREE.EdgesGeometry(slabGeo);
  const DROP = new THREE.Vector3(0.7, 5.2, 0.7);   // where a tile flies in from

  const segGeom = (a, b, seg) => {
    const pts = [];
    for (let s = 0; s <= seg; s++) pts.push(new THREE.Vector3().lerpVectors(a, b, s / seg));
    return new THREE.BufferGeometry().setFromPoints(pts);
  };

  layers.forEach((l, i) => {
    const y = topY - i * GAP;
    l.baseY = y;

    const fillMat = new THREE.MeshBasicMaterial({ color: accent(), transparent: true, opacity: 0 });
    l.slab = new THREE.Mesh(slabGeo, fillMat);
    group.add(l.slab); accentMats.push(fillMat);
    l.fillMat = fillMat;

    const edgeMat = new THREE.LineBasicMaterial({ color: accent(), transparent: true, opacity: 0 });
    l.edges = new THREE.LineSegments(edgeGeo, edgeMat);
    group.add(l.edges); accentMats.push(edgeMat);
    l.edgeMat = edgeMat;

    // leader line (drawn on during the label phase)
    const a = new THREE.Vector3(W / 2, y, W / 6);
    const b = new THREE.Vector3(W / 2 + 1.0, y, W / 6);
    const leadMat = new THREE.LineBasicMaterial({ color: muted(), transparent: true, opacity: 0 });
    const lead = new THREE.Line(segGeom(a, b, 10), leadMat);
    lead.geometry.setDrawRange(0, 0);
    group.add(lead); mutedMats.push(leadMat);
    leaders.push({ line: lead, verts: 11 });
    anchors.push(b);

    const el = document.createElement('div');
    el.className = 'iso-label';
    el.innerHTML = `<span class="tier">${l.tier}</span>`;
    labelWrap.appendChild(el);
    l._el = el;

    // corner connectors between this tile and the one above it
    if (i > 0){
      const yAbove = topY - (i - 1) * GAP;
      [[1, 1], [1, -1], [-1, 1], [-1, -1]].forEach(([sx, sz]) => {
        const p = new THREE.Vector3(sx * W / 2, yAbove, sz * W / 2);
        const q = new THREE.Vector3(sx * W / 2, y, sz * W / 2);
        const cMat = new THREE.LineBasicMaterial({ color: accent(), transparent: true, opacity: 0 });
        const cLine = new THREE.Line(segGeom(p, q, 6), cMat);
        cLine.geometry.setDrawRange(0, 0);
        group.add(cLine); accentMats.push(cMat);
        connectors.push({ line: cLine, mat: cMat, verts: 7, gap: i });
      });
    }
  });

  // ---- interaction: drag to rotate ----
  let rotY = -0.85, rotX = 0.14;
  const targetRot = { y: -0.4, x: 0 };
  let dragging = false, px = 0, py = 0;
  let forceDone = false;
  const skipIntro = () => { forceDone = true; };

  canvas.style.cursor = 'grab';
  canvas.addEventListener('pointerdown', (e) => {
    dragging = true; px = e.clientX; py = e.clientY;
    canvas.style.cursor = 'grabbing';
    canvas.setPointerCapture(e.pointerId);
    skipIntro();
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
      const x = Math.min((tmp.x * 0.5 + 0.5) * r.width, r.width - 88);
      const y = (-tmp.y * 0.5 + 0.5) * r.height;
      l._el.style.left = x + 'px';
      l._el.style.top = (y - 9) + 'px';
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

  // ---- intro timeline: tiles fly in, connectors draw, then labels reveal ----
  const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
  const easeOut = (x) => 1 - Math.pow(1 - x, 3);

  const SLAB_STAGGER = 0.18, SLAB_DUR = 0.52, CONN_DUR = 0.3;
  const LABEL_START = (n - 1) * SLAB_STAGGER + SLAB_DUR + 0.12;
  const LABEL_STAGGER = 0.14, LABEL_DUR = 0.45;
  const INTRO_END = LABEL_START + (n - 1) * LABEL_STAGGER + LABEL_DUR + 0.1;

  let armed = REDUCE_MOTION;
  let introT0 = null;
  let introDone = REDUCE_MOTION;

  if (!REDUCE_MOTION && 'IntersectionObserver' in window){
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) { armed = true; io.disconnect(); }
    }, { threshold: 0.2 });
    io.observe(canvas);
    setTimeout(() => { armed = true; }, 1500);   // safety net
  } else {
    armed = true;
  }

  function applyIntro(p){
    layers.forEach((l, i) => {
      const sp = clamp01((p - i * SLAB_STAGGER) / SLAB_DUR);
      const e = easeOut(sp);
      l.slab.position.set(DROP.x * (1 - e), l.baseY + DROP.y * (1 - e), DROP.z * (1 - e));
      l.edges.position.copy(l.slab.position);
      const s = 0.9 + 0.1 * e;
      l.slab.scale.setScalar(s);
      l.edges.scale.setScalar(s);
      l.fillMat.opacity = FILL_O * e;
      l.edgeMat.opacity = EDGE_O * e;

      const lp = clamp01((p - (LABEL_START + i * LABEL_STAGGER)) / LABEL_DUR);
      const le = easeOut(lp);
      leaders[i].line.geometry.setDrawRange(0, lp > 0 ? Math.round(le * (leaders[i].verts - 1)) + 1 : 0);
      leaders[i].line.material.opacity = LEAD_O * clamp01(lp * 2);
      l._el.style.opacity = lp.toFixed(3);
      l._el.style.transform = 'translateX(' + (12 * (1 - le)).toFixed(1) + 'px)';
    });

    connectors.forEach((c) => {
      const cp = clamp01((p - (c.gap * SLAB_STAGGER + SLAB_DUR * 0.55)) / CONN_DUR);
      c.line.geometry.setDrawRange(0, cp > 0 ? Math.round(easeOut(cp) * (c.verts - 1)) + 1 : 0);
      c.mat.opacity = CONN_O * clamp01(cp * 3);
    });
  }

  const clock = new THREE.Clock();
  (function tick(){
    const t = clock.getElapsedTime();

    if (REDUCE_MOTION || forceDone){
      applyIntro(INTRO_END + 1);
      introDone = true;
    } else if (armed){
      if (introT0 === null) introT0 = t;
      const p = t - introT0;
      applyIntro(p);
      if (p >= INTRO_END) introDone = true;
    } else {
      applyIntro(-1);
    }

    const idle = (introDone && !REDUCE_MOTION && !dragging) ? Math.sin(t * 0.15) * 0.12 : 0;
    rotY += ((targetRot.y + idle) - rotY) * 0.06;
    rotX += (targetRot.x - rotX) * 0.06;
    group.rotation.set(rotX, rotY, 0);
    pivot.updateMatrixWorld(true);

    renderer.render(scene, camera);
    updateLabels();
    requestAnimationFrame(tick);
  })();
})();
