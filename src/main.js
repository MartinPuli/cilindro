import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { SECTORS, PITCH_CENTER, fmtPrice } from './sectors.js';

/* ============================================================
   Constantes de escena
   ============================================================ */
const STADIUM_CENTER = new THREE.Vector3(3.8, 8, 3.6);
const OVERVIEW_POS = new THREE.Vector3(168, 118, 196);
const MODEL_URL = './models/RACING_3D.glb';

/* ============================================================
   Renderer
   ============================================================ */
const canvas = document.getElementById('scene');
const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  powerPreference: 'high-performance',
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

/* ============================================================
   Escena, cámara, controles
   ============================================================ */
const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(
  46,
  window.innerWidth / window.innerHeight,
  0.5,
  4000
);
camera.position.copy(OVERVIEW_POS);
camera.lookAt(STADIUM_CENTER);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.06;
controls.target.copy(STADIUM_CENTER);
controls.minDistance = 60;
controls.maxDistance = 620;
controls.maxPolarAngle = Math.PI * 0.495; // no bajar del horizonte
controls.rotateSpeed = 0.7;
controls.zoomSpeed = 0.9;

/* ============================================================
   Cielo (fondo degradado) + niebla + entorno PBR
   ============================================================ */
function makeSkyTexture(top, mid, bottom) {
  const c = document.createElement('canvas');
  c.width = 8;
  c.height = 512;
  const ctx = c.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 0, 512);
  g.addColorStop(0, top);
  g.addColorStop(0.55, mid);
  g.addColorStop(1, bottom);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 8, 512);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

const SKY = {
  day: makeSkyTexture('#4ea3e0', '#a9d7f2', '#e8f4fb'),
  night: makeSkyTexture('#050c1a', '#0b1c33', '#16324d'),
};
scene.background = SKY.day;
scene.fog = new THREE.Fog(0xcfe6f5, 260, 720);

const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.42;

/* ============================================================
   Luces
   ============================================================ */
const hemi = new THREE.HemisphereLight(0xbfe3ff, 0x40503f, 1.0);
scene.add(hemi);

const sun = new THREE.DirectionalLight(0xfff2df, 2.7);
sun.position.set(120, 160, 80);
sun.target.position.copy(STADIUM_CENTER);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.near = 40;
sun.shadow.camera.far = 520;
sun.shadow.camera.left = -150;
sun.shadow.camera.right = 150;
sun.shadow.camera.top = 150;
sun.shadow.camera.bottom = -150;
sun.shadow.bias = -0.0004;
sun.shadow.normalBias = 0.6;
scene.add(sun);
scene.add(sun.target);

// Reflectores del Cilindro (encienden de noche)
const floodGroup = new THREE.Group();
scene.add(floodGroup);
const FLOOD_COUNT = 6;
const FLOOD_R = 74;
const FLOOD_H = 26;
for (let i = 0; i < FLOOD_COUNT; i++) {
  const a = (i / FLOOD_COUNT) * Math.PI * 2 + Math.PI / 6;
  const sp = new THREE.SpotLight(0xeaf3ff, 0, 320, Math.PI / 5, 0.4, 1.2);
  sp.position.set(
    PITCH_CENTER.x + Math.cos(a) * FLOOD_R,
    FLOOD_H,
    PITCH_CENTER.z + Math.sin(a) * FLOOD_R
  );
  const tgt = new THREE.Object3D();
  tgt.position.set(PITCH_CENTER.x, 0, PITCH_CENTER.z);
  scene.add(tgt);
  sp.target = tgt;
  floodGroup.add(sp);
}

/* ============================================================
   Estados de iluminación día / noche
   ============================================================ */
let isNight = false;
function applyDayNight(night) {
  isNight = night;
  if (night) {
    scene.background = SKY.night;
    scene.fog.color.set(0x0b1c33);
    scene.environmentIntensity = 0.16;
    hemi.color.set(0x2c4a6e);
    hemi.groundColor.set(0x0a1420);
    hemi.intensity = 0.4;
    sun.color.set(0x8fb4e8);
    sun.intensity = 0.3;
    renderer.toneMappingExposure = 1.12;
    floodGroup.children.forEach((f) => (f.intensity = 850));
  } else {
    scene.background = SKY.day;
    scene.fog.color.set(0xcfe6f5);
    scene.environmentIntensity = 0.42;
    hemi.color.set(0xbfe3ff);
    hemi.groundColor.set(0x45543f);
    hemi.intensity = 0.85;
    sun.color.set(0xfff4e2);
    sun.intensity = 2.4;
    renderer.toneMappingExposure = 0.98;
    floodGroup.children.forEach((f) => (f.intensity = 0));
  }
}

/* ============================================================
   Carga del modelo
   ============================================================ */
const loaderEl = document.getElementById('loader');
const fillEl = document.getElementById('loader-fill');
const pctEl = document.getElementById('loader-pct');

// El modelo exporta varios materiales del estadio sin color base (césped,
// hormigón, asientos): sin este mapa saldrían blancos. Los pintamos con la
// paleta real de El Cilindro.
const MATERIAL_TINT = {
  BLK_STADIUM_TURF: 0x3f8036, // césped
  BLK_STADIUM_CONCRETE: 0xb8b4a9, // hormigón bandejas
  BLK_STADIUM_TERR_STRIPE: 0x808b92, // franjas de las bandejas
  BLK_STADIUM_SEATS_PRIMARY: 0x2f9fe0, // asientos celestes (Racing)
  BLK_STADIUM_SEATS_SECONDARY: 0xeef4f8, // asientos blancos
  BLK_STADIUM_LINE: 0xf4f8ff, // líneas de la cancha
};

const gltfLoader = new GLTFLoader();
gltfLoader.setMeshoptDecoder(MeshoptDecoder);

gltfLoader.load(
  MODEL_URL,
  (gltf) => {
    const model = gltf.scene;
    const tinted = new Set();
    model.traverse((o) => {
      if (!o.isMesh) return;
      o.castShadow = true;
      o.receiveShadow = true;
      const mat = o.material;
      if (!mat) return;
      mat.side = THREE.FrontSide;
      if (mat.map) mat.map.anisotropy = 4;

      // El facade exterior comparte material con los asientos: lo dejamos gris.
      if (mat.name === 'BLK_STADIUM_SEATS_PRIMARY' && /Exterior/.test(o.name)) {
        o.material = mat.clone();
        o.material.color.setHex(0xd8d5cc);
        return;
      }
      // Césped alternado: clonamos para dibujar el rayado del corte.
      if (mat.name === 'BLK_STADIUM_TURF' && /Alternate/.test(o.name)) {
        o.material = mat.clone();
        o.material.color.setHex(0x357030);
        return;
      }
      if (MATERIAL_TINT[mat.name] !== undefined && !tinted.has(mat.uuid)) {
        mat.color.setHex(MATERIAL_TINT[mat.name]);
        tinted.add(mat.uuid);
      }
    });
    scene.add(model);
    onModelReady();
  },
  (evt) => {
    if (evt.lengthComputable || evt.total) {
      const pct = Math.min(100, Math.round((evt.loaded / (evt.total || evt.loaded)) * 100));
      fillEl.style.width = pct + '%';
      pctEl.textContent = `Cargando el estadio… ${pct}%`;
    }
  },
  (err) => {
    console.error(err);
    pctEl.textContent = 'No se pudo cargar el modelo 😞';
  }
);

function onModelReady() {
  applyDayNight(false);
  loaderEl.classList.add('done');
  setTimeout(() => (loaderEl.style.display = 'none'), 800);
  // Aparecer UI
  document.querySelectorAll('.hidden-on-load').forEach((el, i) => {
    setTimeout(() => {
      el.classList.remove('hidden-on-load');
      el.classList.add('fade-in');
    }, 250 + i * 90);
  });
  buildSectorChips();
  // Intro: pequeño giro de bienvenida
  controls.autoRotate = true;
  controls.autoRotateSpeed = 0.6;
  setTimeout(() => {
    if (mode === 'overview' && !userRotateOn) controls.autoRotate = false;
  }, 4200);
}

/* ============================================================
   Modos de cámara: overview <-> seat
   ============================================================ */
let mode = 'overview';
let userRotateOn = false;

// Tween de cámara
let tween = null;
function easeInOut(t) {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}
function startTween({ toPos, toLook, toFov, duration = 1250, onDone }) {
  tween = {
    fromPos: camera.position.clone(),
    toPos: toPos.clone(),
    fromLook: currentLook.clone(),
    toLook: toLook.clone(),
    fromFov: camera.fov,
    toFov: toFov ?? camera.fov,
    t: 0,
    duration,
    onDone,
  };
}

// Punto que la cámara está mirando actualmente (se mantiene sincronizado)
const currentLook = new THREE.Vector3().copy(STADIUM_CENTER);

// Look de primera persona (modo butaca)
const seatYawPitch = { yaw: 0, pitch: 0 };
let activeSeat = null;

function enterSeat(sector) {
  activeSeat = sector;
  mode = 'transition';
  controls.autoRotate = false;
  controls.enabled = false;
  const toPos = new THREE.Vector3(sector.pos.x, sector.pos.y, sector.pos.z);
  const toLook = new THREE.Vector3(sector.aim.x, sector.aim.y, sector.aim.z);
  startTween({
    toPos,
    toLook,
    toFov: sector.fov,
    duration: 1400,
    onDone: () => {
      mode = 'seat';
      // inicializar yaw/pitch desde la dirección actual
      const dir = toLook.clone().sub(toPos).normalize();
      seatYawPitch.yaw = Math.atan2(dir.x, dir.z);
      seatYawPitch.pitch = Math.asin(THREE.MathUtils.clamp(dir.y, -1, 1));
    },
  });
  showSeatCard(sector);
  setModeTag(sector.name);
  document.getElementById('sector-dock').classList.add('hidden');
  document.getElementById('hint-text').textContent =
    'Arrastrá para mirar alrededor · Rueda para acercar';
}

function exitToOverview() {
  activeSeat = null;
  mode = 'transition';
  controls.enabled = false;
  startTween({
    toPos: OVERVIEW_POS.clone(),
    toLook: STADIUM_CENTER.clone(),
    toFov: 46,
    duration: 1300,
    onDone: () => {
      mode = 'overview';
      controls.target.copy(STADIUM_CENTER);
      controls.enabled = true;
      controls.autoRotate = userRotateOn;
    },
  });
  hideSeatCard();
  setModeTag('Vista aérea');
  document.getElementById('sector-dock').classList.remove('hidden');
  document.getElementById('hint-text').textContent =
    'Arrastrá para girar · Rueda para acercar';
}

/* ============================================================
   Controles de "mirar" en modo butaca
   ============================================================ */
let dragging = false;
let lastX = 0;
let lastY = 0;
const LOOK_SENS = 0.0028;

renderer.domElement.addEventListener('pointerdown', (e) => {
  if (mode !== 'seat') return;
  dragging = true;
  lastX = e.clientX;
  lastY = e.clientY;
  renderer.domElement.setPointerCapture(e.pointerId);
});
renderer.domElement.addEventListener('pointermove', (e) => {
  if (mode !== 'seat' || !dragging) return;
  const dx = e.clientX - lastX;
  const dy = e.clientY - lastY;
  lastX = e.clientX;
  lastY = e.clientY;
  seatYawPitch.yaw -= dx * LOOK_SENS;
  seatYawPitch.pitch = THREE.MathUtils.clamp(
    seatYawPitch.pitch + dy * LOOK_SENS,
    -0.7,
    0.55
  );
});
renderer.domElement.addEventListener('pointerup', () => (dragging = false));
renderer.domElement.addEventListener('pointercancel', () => (dragging = false));

// Zoom (FOV) en modo butaca
renderer.domElement.addEventListener(
  'wheel',
  (e) => {
    if (mode !== 'seat') return;
    e.preventDefault();
    camera.fov = THREE.MathUtils.clamp(camera.fov + e.deltaY * 0.03, 22, 74);
    camera.updateProjectionMatrix();
  },
  { passive: false }
);

/* ============================================================
   UI
   ============================================================ */
function buildSectorChips() {
  const dock = document.getElementById('dock-chips');
  dock.innerHTML = '';
  SECTORS.forEach((s) => {
    const chip = document.createElement('button');
    chip.className = 'chip';
    chip.innerHTML = `
      <span class="chip-dot" style="color:${s.color};background:${s.color}"></span>
      <span>${s.name}</span>
      <span class="chip-price">${fmtPrice(s.price)}</span>`;
    chip.addEventListener('click', () => enterSeat(s));
    dock.appendChild(chip);
  });
}

const seatCard = document.getElementById('seat-card');
function showSeatCard(s) {
  document.getElementById('seat-accent').style.background = s.color;
  document.getElementById('seat-accent').style.color = s.color;
  document.getElementById('seat-sector').textContent = s.name;
  document.getElementById('seat-tier').textContent = s.tier;
  document.getElementById('seat-row').textContent = s.row;
  document.getElementById('seat-num').textContent = s.seat === 0 ? 'Gral.' : s.seat;
  document.getElementById('seat-price').textContent = fmtPrice(s.price);
  document.getElementById('seat-desc').textContent = s.desc;
  seatCard.classList.remove('hidden');
  requestAnimationFrame(() => seatCard.classList.add('show'));
}
function hideSeatCard() {
  seatCard.classList.remove('show');
  setTimeout(() => seatCard.classList.add('hidden'), 400);
}

function setModeTag(text) {
  document.getElementById('mode-tag').textContent = text;
}

// Toast
let toastEl = null;
function toast(msg) {
  if (!toastEl) {
    toastEl = document.createElement('div');
    toastEl.id = 'toast';
    document.body.appendChild(toastEl);
  }
  toastEl.textContent = msg;
  toastEl.classList.add('show');
  clearTimeout(toastEl._t);
  toastEl._t = setTimeout(() => toastEl.classList.remove('show'), 2600);
}

// Botones
document.getElementById('btn-back').addEventListener('click', exitToOverview);
document.getElementById('btn-grab').addEventListener('click', () => {
  if (activeSeat) toast(`¡${activeSeat.name} reservada! 🔵⚪ (demo)`);
});

const btnRotate = document.getElementById('btn-rotate');
btnRotate.addEventListener('click', () => {
  userRotateOn = !userRotateOn;
  btnRotate.classList.toggle('active', userRotateOn);
  if (mode === 'overview') controls.autoRotate = userRotateOn;
});

const btnDayNight = document.getElementById('btn-daynight');
btnDayNight.addEventListener('click', () => {
  applyDayNight(!isNight);
  document.getElementById('daynight-ico').textContent = isNight ? '☾' : '☀';
  btnDayNight.classList.toggle('active', isNight);
});

/* ============================================================
   Resize
   ============================================================ */
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

/* ============================================================
   Loop de render
   ============================================================ */
const clock = new THREE.Clock();
function animate() {
  requestAnimationFrame(animate);
  const dt = clock.getDelta();

  if (tween) {
    tween.t += dt / (tween.duration / 1000);
    const k = easeInOut(Math.min(1, tween.t));
    camera.position.lerpVectors(tween.fromPos, tween.toPos, k);
    currentLook.lerpVectors(tween.fromLook, tween.toLook, k);
    camera.fov = tween.fromFov + (tween.toFov - tween.fromFov) * k;
    camera.updateProjectionMatrix();
    camera.lookAt(currentLook);
    if (tween.t >= 1) {
      const done = tween.onDone;
      tween = null;
      if (done) done();
    }
  } else if (mode === 'overview') {
    controls.update();
    currentLook.copy(controls.target);
  } else if (mode === 'seat' && activeSeat) {
    const cp = Math.cos(seatYawPitch.pitch);
    const dir = new THREE.Vector3(
      Math.sin(seatYawPitch.yaw) * cp,
      Math.sin(seatYawPitch.pitch),
      Math.cos(seatYawPitch.yaw) * cp
    );
    currentLook.copy(camera.position).add(dir);
    camera.lookAt(currentLook);
  }

  renderer.render(scene, camera);
}
animate();
