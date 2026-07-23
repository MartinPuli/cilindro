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
controls.dampingFactor = 0.06;
controls.target.copy(STADIUM_CENTER);
controls.minDistance = 42;
controls.maxDistance = 430;
controls.maxPolarAngle = Math.PI * 0.495;
controls.rotateSpeed = 0.62;
controls.zoomSpeed = 0.9;
controls.enablePan = false;

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

/* Suelo (el barrio se quitó del modelo) */
const groundMat = new THREE.MeshStandardMaterial({ color: 0x2f4a34, roughness: 1, metalness: 0 });
const ground = new THREE.Mesh(new THREE.CircleGeometry(430, 64), groundMat);
ground.rotation.x = -Math.PI / 2;
ground.position.y = -0.02;
ground.receiveShadow = true;
scene.add(ground);

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
    groundMat.color.set(0x101c18);
    renderer.toneMappingExposure = 1.12;
    floodGroup.children.forEach((f) => (f.intensity = 900));
  } else {
    scene.background = SKY.day; scene.fog.color.set(0xcfe6f5); scene.environmentIntensity = 0.4;
    hemi.color.set(0xbfe3ff); hemi.groundColor.set(0x45543f); hemi.intensity = 0.85;
    sun.color.set(0xfff4e2); sun.intensity = 2.5;
    groundMat.color.set(0x2f4a34);
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
  const toPos = new THREE.Vector3(area.view.pos.x, area.view.pos.y, area.view.pos.z);
  const toLook = new THREE.Vector3(area.view.look.x, area.view.look.y, area.view.look.z);
  startTween({
    toPos, toLook, toFov: area.view.fov, duration: 1300,
    onDone: () => {
      mode = 'area'; controls.target.copy(toLook); controls.enabled = true;
      controls.minDistance = 20; controls.maxDistance = 150;
    },
  });
  setModeTag(area.name);
  showBack('Sectores');
  renderArea(area);
}

function goSeat(seat) {
  mode = 'transition'; pendingSeat = seat; marker.visible = false;
  controls.enabled = false; controls.autoRotate = false;
  const eye = seat.point.clone().add(new THREE.Vector3(0, 1.35, 0));
  // un pasito hacia la cancha para no quedar dentro de la butaca
  const toC = PITCH.clone().sub(eye); toC.y = 0; toC.normalize();
  eye.add(toC.multiplyScalar(0.6));
  const look = PITCH.clone();
  startTween({
    toPos: eye, toLook: look, toFov: seat.area.kind === 'palco' ? 52 : 60, duration: 1350,
    onDone: () => {
      mode = 'seat';
      const dir = look.clone().sub(eye).normalize();
      seatYawPitch.yaw = Math.atan2(dir.x, dir.z);
      seatYawPitch.pitch = Math.asin(THREE.MathUtils.clamp(dir.y, -1, 1));
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
  if (!modelRoot) return;
  ndc.x = (clientX / window.innerWidth) * 2 - 1;
  ndc.y = -(clientY / window.innerHeight) * 2 + 1;
  raycaster.setFromCamera(ndc, camera);
  const hits = raycaster.intersectObjects(raycastTargets, false);
  for (const h of hits) {
    const p = h.point;
    const r = Math.hypot(p.x - PITCH.x, p.z - PITCH.z);
    if (r < 34 || r > 100 || p.y < 1.2 || p.y > 20) continue; // debe ser una tribuna (no techo)
    const angle = Math.atan2(p.z - PITCH.z, p.x - PITCH.x);
    const area = areaFromAngle(angle);
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
}

/* ============================================================ Puntero ======= */
let downX = 0, downY = 0, downT = 0, dragging = false, moved = 0;
const LOOK_SENS = 0.0028;
canvas.addEventListener('pointerdown', (e) => {
  downX = e.clientX; downY = e.clientY; moved = 0; dragging = true;
  if (mode === 'seat') canvas.setPointerCapture(e.pointerId);
});
canvas.addEventListener('pointermove', (e) => {
  if (!dragging) return;
  moved = Math.max(moved, Math.hypot(e.clientX - downX, e.clientY - downY));
  if (mode === 'seat') {
    const dx = e.movementX || 0, dy = e.movementY || 0;
    seatYawPitch.yaw -= dx * LOOK_SENS;
    seatYawPitch.pitch = THREE.MathUtils.clamp(seatYawPitch.pitch + dy * LOOK_SENS, -0.7, 0.5);
  }
});
canvas.addEventListener('pointerup', (e) => {
  dragging = false;
  if (mode === 'area' && moved < 7) pickSeat(e.clientX, e.clientY);
});
canvas.addEventListener('pointercancel', () => (dragging = false));
canvas.addEventListener('wheel', (e) => {
  if (mode !== 'seat') return;
  e.preventDefault();
  camera.fov = THREE.MathUtils.clamp(camera.fov + e.deltaY * 0.03, 22, 74);
  camera.updateProjectionMatrix();
}, { passive: false });

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

  if (tween) {
    tween.t += dt / (tween.duration / 1000);
    const k = easeInOut(Math.min(1, tween.t));
    camera.position.lerpVectors(tween.fromPos, tween.toPos, k);
    currentLook.lerpVectors(tween.fromLook, tween.toLook, k);
    camera.fov = tween.fromFov + (tween.toFov - tween.fromFov) * k;
    camera.updateProjectionMatrix();
    camera.lookAt(currentLook);
    if (tween.t >= 1) { const d = tween.onDone; tween = null; if (d) d(); }
  } else if (mode === 'overview' || mode === 'area') {
    controls.update();
    currentLook.copy(controls.target);
  } else if (mode === 'seat') {
    const cp = Math.cos(seatYawPitch.pitch);
    const dir = new THREE.Vector3(Math.sin(seatYawPitch.yaw) * cp, Math.sin(seatYawPitch.pitch), Math.cos(seatYawPitch.yaw) * cp);
    currentLook.copy(camera.position).add(dir);
    camera.lookAt(currentLook);
  }

  renderer.render(scene, camera);
}
animate();
