import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { AREAS, PITCH_CENTER, fmtPrice, areaFromAngle } from './areas.js';

/* ============================================================ Escena ======= */
const STADIUM_CENTER = new THREE.Vector3(3.8, 7, 3.6);
const PITCH = new THREE.Vector3(PITCH_CENTER.x, PITCH_CENTER.y, PITCH_CENTER.z);
const OVERVIEW_POS = new THREE.Vector3(150, 108, 178);
// En desarrollo se carga el modelo local; en producción, desde jsDelivr (CDN
// sobre el repo público) para no tener que subir el binario en cada deploy.
const IS_LOCAL = ['localhost', '127.0.0.1', ''].includes(location.hostname);
const MODEL_URL = IS_LOCAL
  ? './models/RACING_3D.glb'
  : 'https://cdn.jsdelivr.net/gh/MartinPuli/cilindro@c59dc48f3f2386b738fce4b32dae7c9a631106a5/public/models/RACING_3D.glb';

const canvas = document.getElementById('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(46, window.innerWidth / window.innerHeight, 0.4, 4000);
camera.position.copy(OVERVIEW_POS);
camera.lookAt(STADIUM_CENTER);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.target.copy(STADIUM_CENTER);
controls.minDistance = 26;
controls.maxDistance = 470;
controls.maxPolarAngle = Math.PI * 0.49;
controls.rotateSpeed = 0.95;
controls.zoomSpeed = 1.1;
controls.zoomToCursor = true;
controls.enablePan = true;              // moverse por el estadio (2 dedos / botón derecho)
controls.screenSpacePanning = true;
controls.keyPanSpeed = 24;
// cortar la autorrotación apenas el usuario toca
controls.addEventListener('start', () => { if (mode === 'overview' && !userRotate) controls.autoRotate = false; });

/* ============================================================ Cielo/Env ==== */
function makeSky(top, mid, bottom) {
  const c = document.createElement('canvas');
  c.width = 8; c.height = 512;
  const x = c.getContext('2d');
  const g = x.createLinearGradient(0, 0, 0, 512);
  g.addColorStop(0, top); g.addColorStop(0.55, mid); g.addColorStop(1, bottom);
  x.fillStyle = g; x.fillRect(0, 0, 8, 512);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
const SKY = { day: makeSky('#4ea3e0', '#a9d7f2', '#e8f4fb'), night: makeSky('#050c1a', '#0b1c33', '#16324d') };
scene.background = SKY.day;
scene.fog = new THREE.Fog(0xcfe6f5, 320, 620);

const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.4;

/* Suelo: pasto alrededor del estadio que se transforma en ciudad hacia afuera */
function makeGroundTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 1024;
  const x = c.getContext('2d');
  const g = x.createRadialGradient(512, 512, 60, 512, 512, 512);
  g.addColorStop(0.0, '#3a5740');
  g.addColorStop(0.16, '#3e5c43');
  g.addColorStop(0.24, '#6e6857');
  g.addColorStop(0.55, '#6a655a');
  g.addColorStop(1.0, '#4c4842');
  x.fillStyle = g;
  x.fillRect(0, 0, 1024, 1024);
  // trama de calles sutil
  x.strokeStyle = 'rgba(25,24,20,0.13)';
  x.lineWidth = 3;
  for (let p = 96; p < 1024; p += 96) {
    x.beginPath(); x.moveTo(p, 0); x.lineTo(p, 1024); x.stroke();
    x.beginPath(); x.moveTo(0, p); x.lineTo(1024, p); x.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}
const groundMat = new THREE.MeshStandardMaterial({ map: makeGroundTexture(), roughness: 1, metalness: 0 });
const ground = new THREE.Mesh(new THREE.CircleGeometry(440, 72), groundMat);
ground.rotation.x = -Math.PI / 2;
ground.position.y = -0.02;
ground.receiveShadow = true;
scene.add(ground);

/* Barrio bajo alrededor del estadio (sutil, se desvanece con la niebla) */
(function buildNeighborhood() {
  const geo = new THREE.BoxGeometry(1, 1, 1);
  const mat = new THREE.MeshStandardMaterial({ roughness: 0.92, metalness: 0 });
  const MAX = 300;
  const inst = new THREE.InstancedMesh(geo, mat, MAX);
  inst.castShadow = true;
  inst.receiveShadow = true;
  const m = new THREE.Matrix4(), pos = new THREE.Vector3(), q = new THREE.Quaternion(), scl = new THREE.Vector3(), col = new THREE.Color();
  const palette = ['#9c988e', '#b3aa96', '#8f938d', '#a7a199', '#82817a', '#b8b1a0', '#767b7d'];
  const block = 30;
  let i = 0;
  for (let gx = -9; gx <= 9; gx++) {
    for (let gz = -9; gz <= 9; gz++) {
      if (i >= MAX) break;
      const cx = PITCH.x + gx * block + (Math.random() - 0.5) * 11;
      const cz = PITCH.z + gz * block + (Math.random() - 0.5) * 11;
      const r = Math.hypot(cx - PITCH.x, cz - PITCH.z);
      if (r < 122 || r > 250) continue;      // libre el estadio; anillo de ~4 manzanas
      if (Math.random() < 0.14) continue;    // huecos: plazas, calles, baldíos
      const w = 11 + Math.random() * 16;
      const d = 11 + Math.random() * 16;
      const h = 4 + Math.random() * Math.random() * 22; // mayoría bajos
      pos.set(cx, h / 2 - 0.02, cz);
      scl.set(w, h, d);
      m.compose(pos, q, scl);
      inst.setMatrixAt(i, m);
      col.set(palette[(Math.random() * palette.length) | 0]).multiplyScalar(0.82 + Math.random() * 0.3);
      inst.setColorAt(i, col);
      i++;
    }
  }
  inst.count = i;
  inst.instanceMatrix.needsUpdate = true;
  scene.add(inst);
})();

/* ============================================================ Luces ======== */
const hemi = new THREE.HemisphereLight(0xbfe3ff, 0x45543f, 0.85);
scene.add(hemi);

const sun = new THREE.DirectionalLight(0xfff4e2, 2.5);
sun.position.set(115, 155, 70);
sun.target.position.copy(STADIUM_CENTER);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.near = 40;
sun.shadow.camera.far = 480;
sun.shadow.camera.left = -140; sun.shadow.camera.right = 140;
sun.shadow.camera.top = 140; sun.shadow.camera.bottom = -140;
sun.shadow.bias = -0.0004;
sun.shadow.normalBias = 0.6;
scene.add(sun, sun.target);

const floodGroup = new THREE.Group();
scene.add(floodGroup);
for (let i = 0; i < 6; i++) {
  const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
  const sp = new THREE.SpotLight(0xeaf3ff, 0, 340, Math.PI / 5, 0.4, 1.2);
  sp.position.set(PITCH.x + Math.cos(a) * 74, 26, PITCH.z + Math.sin(a) * 74);
  const tgt = new THREE.Object3D();
  tgt.position.set(PITCH.x, 0, PITCH.z);
  scene.add(tgt);
  sp.target = tgt;
  floodGroup.add(sp);
}

let isNight = false;
function applyDayNight(night) {
  isNight = night;
  if (night) {
    scene.background = SKY.night; scene.fog.color.set(0x0b1c33); scene.environmentIntensity = 0.16;
    hemi.color.set(0x2c4a6e); hemi.groundColor.set(0x0a1420); hemi.intensity = 0.4;
    sun.color.set(0x8fb4e8); sun.intensity = 0.3;
    groundMat.color.set(0x2a333e);
    renderer.toneMappingExposure = 1.12;
    floodGroup.children.forEach((f) => (f.intensity = 900));
  } else {
    scene.background = SKY.day; scene.fog.color.set(0xcfe6f5); scene.environmentIntensity = 0.4;
    hemi.color.set(0xbfe3ff); hemi.groundColor.set(0x45543f); hemi.intensity = 0.85;
    sun.color.set(0xfff4e2); sun.intensity = 2.5;
    groundMat.color.set(0xffffff);
    renderer.toneMappingExposure = 1.0;
    floodGroup.children.forEach((f) => (f.intensity = 0));
  }
}

/* ============================================================ Marcador ===== */
const marker = new THREE.Group();
{
  const ringGeo = new THREE.TorusGeometry(1.05, 0.18, 10, 28);
  const ringMat = new THREE.MeshStandardMaterial({ color: 0x6ec6ec, emissive: 0x2f9fe0, emissiveIntensity: 1.4, roughness: 0.4 });
  const ring = new THREE.Mesh(ringGeo, ringMat);
  ring.rotation.x = Math.PI / 2;
  const pinGeo = new THREE.ConeGeometry(0.5, 1.6, 16);
  const pin = new THREE.Mesh(pinGeo, ringMat);
  pin.position.y = 1.7;
  pin.rotation.x = Math.PI;
  marker.add(ring, pin);
}
marker.visible = false;
scene.add(marker);

/* ====================================================== Resaltado de área == */
// Cámara para encuadrar una tribuna (desde el campo, por debajo del techo,
// mirando hacia la tribuna elegida — evita chocar con estructuras).
function areaView(area) {
  const dir = new THREE.Vector3(Math.cos(area.ang), 0, Math.sin(area.ang));
  const look = new THREE.Vector3(PITCH.x, 9, PITCH.z).addScaledVector(dir, 60);
  const pos = new THREE.Vector3(PITCH.x, 16.5, PITCH.z).addScaledVector(dir, 7);
  const fov = area.kind === 'popular' ? 60 : 55;
  return { pos, look, fov };
}

// Panel celeste translúcido que marca la tribuna seleccionada sobre el cuenco.
let areaHL = null;
function showAreaHighlight(area) {
  if (areaHL) { scene.remove(areaHL); areaHL.geometry.dispose(); areaHL.material.dispose(); }
  const thetaLen = area.kind === 'popular' ? 1.5 : 1.2;
  const thetaCenter = Math.PI / 2 - area.ang; // ver convención CylinderGeometry
  const geo = new THREE.CylinderGeometry(93, 50, 19, 40, 1, true, thetaCenter - thetaLen / 2, thetaLen);
  const mat = new THREE.MeshBasicMaterial({
    color: 0xcdeeff, transparent: true, opacity: 0.4,
    side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  areaHL = new THREE.Mesh(geo, mat);
  areaHL.position.set(PITCH.x, 10.5, PITCH.z);
  areaHL.renderOrder = 2;
  scene.add(areaHL);
}
function hideAreaHighlight() { if (areaHL) { scene.remove(areaHL); areaHL.geometry.dispose(); areaHL.material.dispose(); areaHL = null; } }

/* ============================================================ Carga ======== */
const loaderEl = document.getElementById('loader');
const fillEl = document.getElementById('loader-fill');
const pctEl = document.getElementById('loader-pct');
let modelRoot = null;
const raycastTargets = [];

const gltfLoader = new GLTFLoader();
gltfLoader.setMeshoptDecoder(MeshoptDecoder);
gltfLoader.load(
  MODEL_URL,
  (gltf) => {
    modelRoot = gltf.scene;
    modelRoot.traverse((o) => {
      if (!o.isMesh) return;
      o.castShadow = true;
      o.receiveShadow = true;
      const mat = o.material;
      if (mat) {
        mat.side = THREE.FrontSide;
        // celeste de Racing más fiel para los asientos (oficial ~#029CDC)
        if (mat.name === 'BLK_STADIUM_SEATS_PRIMARY') mat.color.setHex(0x2ea3e0);
        // el Cilindro tiene techo celeste translúcido (en el modelo venía gris)
        if (mat.name === 'BLK_STADIUM_ROOF' || mat.name === 'BLK_STADIUM_ROOF_TOP') mat.color.setHex(0x8ec4e2);
        // rayado del corte de césped: la mitad alterna, un verde más oscuro
        if (mat.name === 'BLK_STADIUM_TURF' && /Alternate/.test(o.name)) {
          o.material = mat.clone();
          o.material.color.multiplyScalar(0.82);
        }
      }
      raycastTargets.push(o);
    });
    scene.add(modelRoot);
    onReady();
  },
  (e) => {
    if (e.total) {
      const p = Math.min(100, Math.round((e.loaded / e.total) * 100));
      fillEl.style.width = p + '%';
      pctEl.textContent = `Cargando el estadio… ${p}%`;
    }
  },
  (err) => { console.error(err); pctEl.textContent = 'No se pudo cargar el modelo 😞'; }
);

function onReady() {
  applyDayNight(false);
  loaderEl.classList.add('done');
  setTimeout(() => (loaderEl.style.display = 'none'), 800);
  document.querySelectorAll('.hidden-on-load').forEach((el, i) =>
    setTimeout(() => { el.classList.remove('hidden-on-load'); el.classList.add('fade-in'); }, 220 + i * 80)
  );
  renderOverview();
  controls.autoRotate = true; controls.autoRotateSpeed = 0.55;
  setTimeout(() => { if (mode === 'overview' && !userRotate) controls.autoRotate = false; }, 4200);
}

/* ============================================================ Modos ========= */
let mode = 'overview'; // overview | area | seat | transition
let userRotate = false;
let activeArea = null;
let pendingSeat = null; // {point, area, fila, butaca, price, kind}

const currentLook = new THREE.Vector3().copy(STADIUM_CENTER);
let tween = null;
const easeInOut = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
function startTween({ toPos, toLook, toFov, duration = 1250, onDone }) {
  tween = {
    fromPos: camera.position.clone(), toPos: toPos.clone(),
    fromLook: currentLook.clone(), toLook: toLook.clone(),
    fromFov: camera.fov, toFov: toFov ?? camera.fov,
    t: 0, duration, onDone,
  };
}

const seatYawPitch = { yaw: 0, pitch: 0 };

function goOverview() {
  mode = 'transition'; activeArea = null; pendingSeat = null; marker.visible = false;
  hideAreaHighlight();
  controls.enabled = false; controls.autoRotate = false;
  startTween({
    toPos: OVERVIEW_POS.clone(), toLook: STADIUM_CENTER.clone(), toFov: 46, duration: 1250,
    onDone: () => {
      mode = 'overview'; controls.target.copy(STADIUM_CENTER); controls.enabled = true;
      controls.minDistance = 42; controls.maxDistance = 430;
      controls.autoRotate = userRotate;
    },
  });
  setModeTag('Vista aérea');
  hideBack();
  renderOverview();
}

function goArea(area) {
  mode = 'transition'; activeArea = area; pendingSeat = null; marker.visible = false;
  controls.enabled = false; controls.autoRotate = false;
  const v = areaView(area);
  showAreaHighlight(area);
  startTween({
    toPos: v.pos, toLook: v.look, toFov: v.fov, duration: 1300,
    onDone: () => {
      mode = 'area'; controls.target.copy(v.look); controls.enabled = true;
      controls.minDistance = 22; controls.maxDistance = 135;
    },
  });
  setModeTag(area.name);
  showBack('Sectores');
  renderArea(area);
}

function goSeat(seat) {
  mode = 'transition'; pendingSeat = seat; marker.visible = false;
  hideAreaHighlight();
  controls.enabled = false; controls.autoRotate = false;
  const eye = seat.point.clone().add(new THREE.Vector3(0, 1.35, 0));
  // un pasito hacia la cancha para no quedar dentro de la butaca
  const toC = PITCH.clone().sub(eye); toC.y = 0; toC.normalize();
  eye.add(toC.multiplyScalar(0.6));
  const look = PITCH.clone();
  startTween({
    toPos: eye, toLook: look, toFov: seat.area.kind === 'palco' ? 52 : 60, duration: 1350,
    onDone: () => {
      // desde la butaca también se navega en 3D (orbitar la cancha + zoom)
      mode = 'seat';
      controls.target.copy(PITCH);
      controls.enabled = true;
      controls.minDistance = 8;
      controls.maxDistance = 185;
    },
  });
  setModeTag(seat.area.name);
  showBack('Elegir otra');
  renderSeat(seat);
}

/* ============================================================ Picking ======= */
const raycaster = new THREE.Raycaster();
const ndc = new THREE.Vector2();
function pickSeat(clientX, clientY) {
  if (!modelRoot || !activeArea) return;
  ndc.x = (clientX / window.innerWidth) * 2 - 1;
  ndc.y = -(clientY / window.innerHeight) * 2 + 1;
  raycaster.setFromCamera(ndc, camera);
  const hits = raycaster.intersectObjects(raycastTargets, false);
  let outOfArea = false;
  for (const h of hits) {
    const p = h.point;
    const r = Math.hypot(p.x - PITCH.x, p.z - PITCH.z);
    if (r < 34 || r > 100 || p.y < 1.2 || p.y > 20) continue; // debe ser una tribuna (no techo)
    const angle = Math.atan2(p.z - PITCH.z, p.x - PITCH.x);
    // cada butaca pertenece a un sector: solo se puede elegir dentro del activo
    if (areaFromAngle(angle) !== activeArea) { outOfArea = true; continue; }
    const area = activeArea;
    const fila = THREE.MathUtils.clamp(Math.round((p.y - 1.6) / 0.42) + 1, 1, 58);
    const isPop = area.kind === 'popular';
    const butaca = isPop ? 'Gral.' : 1 + (Math.abs(Math.round((angle + Math.PI) * 34)) % 214);
    let price = area.priceFrom;
    if (!isPop) price = area.priceFrom * (1 + Math.max(0, 18 - fila) * 0.02);
    pendingSeat = { point: p.clone(), area, fila, butaca, price, kind: area.kind };
    marker.position.copy(p);
    marker.visible = true;
    renderArea(activeArea, pendingSeat);
    return;
  }
  if (outOfArea) toast(`Esa butaca es de otro sector — tocá dentro de ${activeArea.name}.`);
}

/* ============================================================ Puntero ======= */
// Para elegir butaca detectamos un "toque" (poco movimiento) sobre la tribuna.
let downX = 0, downY = 0, dragging = false, moved = 0;
canvas.addEventListener('pointerdown', (e) => {
  downX = e.clientX; downY = e.clientY; moved = 0; dragging = true;
});
canvas.addEventListener('pointermove', (e) => {
  if (!dragging) return;
  moved = Math.max(moved, Math.hypot(e.clientX - downX, e.clientY - downY));
});
canvas.addEventListener('pointerup', (e) => {
  dragging = false;
  if (mode === 'area' && moved < 7) pickSeat(e.clientX, e.clientY);
});
canvas.addEventListener('pointercancel', () => (dragging = false));

/* ============================================================ UI ============ */
const sheet = document.getElementById('sheet');
const sheetContent = document.getElementById('sheet-content');
const backbtn = document.getElementById('backbtn');
const backText = document.getElementById('backbtn-text');
function showBack(t) { backText.textContent = t; backbtn.classList.remove('hidden'); }
function hideBack() { backbtn.classList.add('hidden'); }
function setModeTag(t) { document.getElementById('mode-tag').textContent = t; }

function renderOverview() {
  const cards = AREAS.map((a) => `
    <button class="area-card" data-area="${a.id}">
      <span class="area-swatch" style="background:${a.color}"></span>
      <span class="area-info">
        <span class="area-name">${a.name}</span>
        <span class="area-meta">${a.tier} · desde ${fmtPrice(a.priceFrom)}</span>
      </span>
    </button>`).join('');
  sheetContent.innerHTML = `
    <div class="sheet-kicker">Paso 1 de 2</div>
    <div class="sheet-title">Elegí tu sector</div>
    <div class="sheet-sub">Tocá una tribuna del Cilindro para acercarte y elegir tu butaca.</div>
    <div class="area-grid">${cards}</div>`;
  sheetContent.querySelectorAll('.area-card').forEach((el) =>
    el.addEventListener('click', () => goArea(AREAS.find((a) => a.id === el.dataset.area)))
  );
}

function renderArea(area, seat) {
  if (!seat) {
    sheetContent.innerHTML = `
      <div class="sheet-kicker">Paso 2 de 2 · ${area.name}</div>
      <div class="sheet-title">Tocá tu ${area.kind === 'popular' ? 'lugar' : 'butaca'}</div>
      <div class="pick-row">
        <span class="pick-pulse"></span>
        <span class="pick-text">Tocá sobre la tribuna para elegir dónde te querés sentar. Arrastrá para mirar mejor.</span>
      </div>`;
    return;
  }
  const seatLabel = seat.kind === 'popular'
    ? `<div class="meta-item"><span class="meta-k">Ubicación</span><span class="meta-v">Popular</span></div>`
    : `<div class="meta-item"><span class="meta-k">Butaca</span><span class="meta-v">${seat.butaca}</span></div>`;
  sheetContent.innerHTML = `
    <div class="seat-head">
      <span class="seat-accent" style="background:${area.color};color:${area.color}"></span>
      <span><span class="seat-name">${area.name}</span><span class="seat-tier">${area.tier}</span></span>
    </div>
    <div class="seat-meta">
      <div class="meta-item"><span class="meta-k">Fila</span><span class="meta-v">${seat.fila}</span></div>
      ${seatLabel}
      <div class="meta-item"><span class="meta-k">Entrada</span><span class="meta-v">${fmtPrice(seat.price)}</span></div>
    </div>
    <div class="row-actions">
      <button class="btn btn-ghost" id="re-pick">Otro lugar</button>
      <button class="btn btn-primary" id="go-view">Ver desde acá</button>
    </div>`;
  sheetContent.querySelector('#go-view').addEventListener('click', () => goSeat(pendingSeat));
  sheetContent.querySelector('#re-pick').addEventListener('click', () => {
    pendingSeat = null; marker.visible = false; renderArea(area);
  });
}

function renderSeat(seat) {
  const a = seat.area;
  const seatLabel = seat.kind === 'popular'
    ? `<div class="meta-item"><span class="meta-k">Ubicación</span><span class="meta-v">Popular</span></div>`
    : `<div class="meta-item"><span class="meta-k">Butaca</span><span class="meta-v">${seat.butaca}</span></div>`;
  sheetContent.innerHTML = `
    <div class="seat-head">
      <span class="seat-accent" style="background:${a.color};color:${a.color}"></span>
      <span><span class="seat-name">${a.name}</span><span class="seat-tier">${a.tier}</span></span>
    </div>
    <div class="seat-meta">
      <div class="meta-item"><span class="meta-k">Fila</span><span class="meta-v">${seat.fila}</span></div>
      ${seatLabel}
      <div class="meta-item"><span class="meta-k">Entrada</span><span class="meta-v">${fmtPrice(seat.price)}</span></div>
    </div>
    <div class="seat-desc">${a.desc} <b>Arrastrá para mirar alrededor y usá la rueda para acercar.</b></div>
    <div class="row-actions">
      <button class="btn btn-ghost" id="seat-change">Cambiar butaca</button>
      <button class="btn btn-primary" id="seat-grab">Reservar (demo)</button>
    </div>`;
  sheetContent.querySelector('#seat-change').addEventListener('click', () => goArea(a));
  sheetContent.querySelector('#seat-grab').addEventListener('click', () => toast(`¡Lugar en ${a.name} reservado! 🔵⚪`));
}

backbtn.addEventListener('click', () => {
  if (mode === 'seat') goArea(activeArea);
  else goOverview();
});

let toastEl = null;
function toast(msg) {
  if (!toastEl) { toastEl = document.createElement('div'); toastEl.id = 'toast'; document.body.appendChild(toastEl); }
  toastEl.textContent = msg; toastEl.classList.add('show');
  clearTimeout(toastEl._t); toastEl._t = setTimeout(() => toastEl.classList.remove('show'), 2600);
}

const btnRotate = document.getElementById('btn-rotate');
btnRotate.addEventListener('click', () => {
  userRotate = !userRotate;
  btnRotate.classList.toggle('active', userRotate);
  if (mode === 'overview') controls.autoRotate = userRotate;
});
const btnDayNight = document.getElementById('btn-daynight');
btnDayNight.addEventListener('click', () => {
  applyDayNight(!isNight);
  document.getElementById('daynight-ico').textContent = isNight ? '☾' : '☀';
  btnDayNight.classList.toggle('active', isNight);
});

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

/* ============================================================ Loop ========== */
const clock = new THREE.Clock();
function animate() {
  requestAnimationFrame(animate);
  const dt = clock.getDelta();
  const t = clock.elapsedTime;

  if (marker.visible) {
    marker.rotation.y = t * 1.2;
    const s = 1 + Math.sin(t * 3) * 0.08;
    marker.scale.setScalar(s);
  }
  if (areaHL) areaHL.material.opacity = 0.28 + (Math.sin(t * 2.3) * 0.5 + 0.5) * 0.28;

  if (tween) {
    tween.t += dt / (tween.duration / 1000);
    const k = easeInOut(Math.min(1, tween.t));
    camera.position.lerpVectors(tween.fromPos, tween.toPos, k);
    currentLook.lerpVectors(tween.fromLook, tween.toLook, k);
    camera.fov = tween.fromFov + (tween.toFov - tween.fromFov) * k;
    camera.updateProjectionMatrix();
    camera.lookAt(currentLook);
    if (tween.t >= 1) { const d = tween.onDone; tween = null; if (d) d(); }
  } else {
    // overview | area | seat: todos navegables en 3D con OrbitControls
    controls.update();
    currentLook.copy(controls.target);
  }

  renderer.render(scene, camera);
}
animate();
