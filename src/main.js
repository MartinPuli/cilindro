import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { AREAS, PITCH_CENTER, HIGH_Y, CAPACITY, fmtPrice, fmtNum, areaForSeat } from './areas.js';

/* ============================================================ Escena ======= */
const STADIUM_CENTER = new THREE.Vector3(3.8, 7, 3.6);
const PITCH = new THREE.Vector3(PITCH_CENTER.x, PITCH_CENTER.y, PITCH_CENTER.z);
const OVERVIEW_POS = new THREE.Vector3(150, 108, 178);
// En desarrollo se carga el modelo local; en producción, desde jsDelivr (CDN
// sobre el repo público) para no tener que subir el binario en cada deploy.
const IS_LOCAL = ['localhost', '127.0.0.1', ''].includes(location.hostname);
const MODEL_URL = IS_LOCAL
  ? './models/RACING_3D.glb'
  : 'https://cdn.jsdelivr.net/gh/MartinPuli/cilindro@52e41f42dbee578a7d0a0a77f2d1b2c08293ebfe/public/models/RACING_3D.glb';

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

/* ============================================================ Cámara libre ==
   Navegación tipo "caminar/volar": moverse con flechas/WASD o joystick,
   mirar arrastrando, y zoom con rueda/pellizco. En la butaca la posición queda
   fija (sólo se gira la cabeza). */
const view = { pos: OVERVIEW_POS.clone(), yaw: 0, pitch: 0, fov: 46 };
const keys = new Set();
const joy = { x: 0, y: 0, up: 0 };
let autoOrbit = false;

function aimView(pos, look) {
  view.pos.copy(pos);
  const d = look.clone().sub(pos).normalize();
  view.yaw = Math.atan2(d.x, d.z);
  view.pitch = Math.asin(THREE.MathUtils.clamp(d.y, -1, 1));
}
function viewDir() {
  const cp = Math.cos(view.pitch);
  return new THREE.Vector3(Math.sin(view.yaw) * cp, Math.sin(view.pitch), Math.cos(view.yaw) * cp);
}
function clampPos() {
  const dx = view.pos.x - STADIUM_CENTER.x, dz = view.pos.z - STADIUM_CENTER.z;
  const r = Math.hypot(dx, dz);
  if (mode === 'area') {
    // dentro de un sector te movés por el cuenco; podés subir bastante alto para
    // ver desde arriba, pero no te vas a la calle.
    view.pos.y = THREE.MathUtils.clamp(view.pos.y, 3, 85);
    const maxR = 110;
    if (r > maxR) { const s = maxR / r; view.pos.x = STADIUM_CENTER.x + dx * s; view.pos.z = STADIUM_CENTER.z + dz * s; }
  } else {
    // vista aérea: recorrido alrededor del estadio, sin salirse del pasto
    view.pos.y = THREE.MathUtils.clamp(view.pos.y, 2.5, 135);
    if (r > 225) { const s = 225 / r; view.pos.x = STADIUM_CENTER.x + dx * s; view.pos.z = STADIUM_CENTER.z + dz * s; }
  }
}
function applyMove(dt) {
  let mx = joy.x, my = joy.y, uy = joy.up;
  if (keys.has('w') || keys.has('arrowup')) my += 1;
  if (keys.has('s') || keys.has('arrowdown')) my -= 1;
  if (keys.has('d') || keys.has('arrowright')) mx += 1;
  if (keys.has('a') || keys.has('arrowleft')) mx -= 1;
  if (keys.has(' ') || keys.has('e')) uy += 1;
  if (keys.has('shift') || keys.has('q')) uy -= 1;
  if (mx || my || uy) autoOrbit = false;
  if (autoOrbit) { // giro suave alrededor del centro (botón 360°)
    const dx = view.pos.x - STADIUM_CENTER.x, dz = view.pos.z - STADIUM_CENTER.z;
    const a = Math.atan2(dz, dx) + dt * 0.14, r = Math.hypot(dx, dz);
    view.pos.x = STADIUM_CENTER.x + Math.cos(a) * r;
    view.pos.z = STADIUM_CENTER.z + Math.sin(a) * r;
    aimView(view.pos, new THREE.Vector3(STADIUM_CENTER.x, view.pos.y - 14, STADIUM_CENTER.z));
    return;
  }
  if (!mx && !my && !uy) return;
  const speed = 34 * dt;
  const d = viewDir();
  const fwd = new THREE.Vector3(d.x, 0, d.z);
  if (fwd.lengthSq() < 1e-4) fwd.set(0, 0, 1);
  fwd.normalize();
  const right = new THREE.Vector3(-fwd.z, 0, fwd.x);
  view.pos.addScaledVector(fwd, my * speed);
  view.pos.addScaledVector(right, mx * speed);
  view.pos.y += uy * speed;
  clampPos();
}

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
scene.fog = new THREE.Fog(0xcfe6f5, 260, 560);

const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.4;

/* Suelo: sólo pasto verde alrededor del estadio (sin edificios ni ciudad) */
function makeGroundTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 1024;
  const x = c.getContext('2d');
  x.fillStyle = '#4b7d44';
  x.fillRect(0, 0, 1024, 1024);
  // manchas suaves para que el pasto no quede plano
  for (let i = 0; i < 1600; i++) {
    const px = Math.random() * 1024, py = Math.random() * 1024, rr = 7 + Math.random() * 44;
    x.fillStyle = Math.random() < 0.5 ? 'rgba(92,132,74,0.10)' : 'rgba(44,74,40,0.10)';
    x.beginPath(); x.arc(px, py, rr, 0, Math.PI * 2); x.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(7, 7);
  t.anisotropy = 4;
  return t;
}
const groundMat = new THREE.MeshStandardMaterial({ map: makeGroundTexture(), roughness: 1, metalness: 0 });
const ground = new THREE.Mesh(new THREE.CircleGeometry(230, 72), groundMat);
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
const markerMat = new THREE.MeshStandardMaterial({ color: 0x6ec6ec, emissive: 0x2f9fe0, emissiveIntensity: 1.4, roughness: 0.4 });
{
  const ring = new THREE.Mesh(new THREE.TorusGeometry(1.05, 0.18, 10, 28), markerMat);
  ring.rotation.x = Math.PI / 2;
  const pin = new THREE.Mesh(new THREE.ConeGeometry(0.5, 1.6, 16), markerMat);
  pin.position.y = 1.7;
  pin.rotation.x = Math.PI;
  marker.add(ring, pin);
}
marker.visible = false;
scene.add(marker);

// Estado de iluminación del sector activo (lo usa el shader de las butacas).
const seatGlow = { active: 0, ang: 0, half: 0.6, ylo: 1, yhi: 21, pulse: 0 };
const seatShaders = [];

/* ====================================================== Resaltado de área == */
// Cámara para encuadrar una tribuna (desde el campo, por debajo del techo,
// mirando hacia la tribuna elegida — evita chocar con estructuras).
function areaView(area) {
  const dir = new THREE.Vector3(Math.cos(area.ang), 0, Math.sin(area.ang));
  const lookY = area.band === 'high' ? 14 : area.band === 'low' ? 6.5 : 9;
  const look = new THREE.Vector3(PITCH.x, lookY, PITCH.z).addScaledVector(dir, area.band === 'high' ? 66 : 60);
  const pos = new THREE.Vector3(PITCH.x, 16.5, PITCH.z).addScaledVector(dir, 7);
  const fov = area.kind === 'popular' ? 60 : 55;
  return { pos, look, fov };
}

const filaAt = (y) => THREE.MathUtils.clamp(Math.round((y - 1.6) / 0.42) + 1, 1, 58);
// butaca numerada: cada sector tiene ~cap/58 butacas por fila (capacidad real).
// Resolución fina (~180/rad ≈ una butaca cada 33 cm): tocar la butaca de al
// lado YA cambia el número.
function colNumAt(area, angle) {
  const perRow = Math.max(40, Math.round(area.cap / 58));
  return 1 + (Math.abs(Math.round((angle + Math.PI) * 180)) % perRow);
}
// Algunas butacas ya están ocupadas (ejemplo, sin marcarlas en el 3D): no se
// pueden reservar. Es determinístico, así una misma butaca siempre da igual.
function seatSold(area, fila, colNum) {
  const salt = AREAS.indexOf(area) + 1;
  let h = (Math.imul(fila * salt, 73856093) ^ Math.imul(colNum + 1, 19349663)) >>> 0;
  h = (h ^ (h >>> 13)) >>> 0;
  return (h % 100) < 28; // ~28% ocupadas
}

/* ====================================================== Resaltado de área == */
// Al elegir un sector, a esa tribuna se le SUBE EL BRILLO (las butacas se
// iluminan con su propio color, vía shader). El recorte angular es EXACTO:
// el límite con el sector vecino es el punto medio, igual que areaForSeat.
function bandsOverlap(a, b) { return a === 'all' || b === 'all' || a === b; }
function sectorHalf(area) {
  let min = Math.PI;
  for (const o of AREAS) {
    if (o === area || !bandsOverlap(area.band, o.band)) continue;
    const d = Math.abs(Math.atan2(Math.sin(o.ang - area.ang), Math.cos(o.ang - area.ang)));
    if (d > 1e-6 && d < min) min = d;
  }
  return min / 2;
}
function showAreaHighlight(area) {
  seatGlow.active = 1;
  seatGlow.ang = area.ang;
  seatGlow.half = sectorHalf(area);
  seatGlow.ylo = area.band === 'high' ? HIGH_Y : 0.5;
  seatGlow.yhi = area.band === 'low' ? HIGH_Y : 21;
}
function hideAreaHighlight() { seatGlow.active = 0; }

/* ============================================================ Carga ======== */
const loaderEl = document.getElementById('loader');
const fillEl = document.getElementById('loader-fill');
const pctEl = document.getElementById('loader-pct');
let modelRoot = null;
const raycastTargets = [];

/* Tribunas: las franjas celestes/blancas lindas vienen del PROPIO modelo
   (bloques de butacas primarias/secundarias). El shader hace dos cosas:
   - striped=true SOLO para las gradas del cuenco que quedaban lisas
     (terrazas pintadas): les agrega las mismas franjas radiales.
   - siempre: SUBE EL BRILLO de la tribuna del sector elegido, con su propio
     color y el recorte EXACTO del sector (mismo criterio que areaForSeat). */
const SEAT_STRIPES = 20.0; // pares de franjas en las gradas pintadas
const SEAT_CEL = new THREE.Color(0x33a0da).convertSRGBToLinear(); // celeste Racing
const SEAT_WHT = new THREE.Color(0xeef3f7).convertSRGBToLinear();
const PITCH_XZ = new THREE.Vector2(PITCH.x, PITCH.z);
function addStandShader(mat, striped) {
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, {
      uStripes: { value: SEAT_STRIPES },
      uCel: { value: SEAT_CEL }, uWht: { value: SEAT_WHT },
      uPitchXZ: { value: PITCH_XZ },
      uActive: { value: 0 }, uActAng: { value: 0 }, uActHalf: { value: 0.6 },
      uActYLo: { value: 1 }, uActYHi: { value: 21 }, uActPulse: { value: 0 },
    });
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWPos;')
      .replace('#include <begin_vertex>',
        '#include <begin_vertex>\n#ifdef USE_INSTANCING\n  vWPos = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz;\n#else\n  vWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;\n#endif');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>',
        '#include <common>\nvarying vec3 vWPos;\nuniform float uStripes;uniform vec3 uCel;uniform vec3 uWht;uniform vec2 uPitchXZ;\nuniform float uActive;uniform float uActAng;uniform float uActHalf;uniform float uActYLo;uniform float uActYHi;uniform float uActPulse;')
      .replace('#include <emissivemap_fragment>',
        '#include <emissivemap_fragment>\n  if (uActive > 0.5) {\n    vec2 dpz = vWPos.xz - uPitchXZ;\n    float da = abs(atan(sin(atan(dpz.y, dpz.x) - uActAng), cos(atan(dpz.y, dpz.x) - uActAng)));\n    if (da < uActHalf && vWPos.y > uActYLo && vWPos.y < uActYHi) {\n      totalEmissiveRadiance += diffuseColor.rgb * (0.2 + 0.12 * uActPulse);\n    }\n  }');
    // franjas (si corresponde) + FILETE divisorio negro en el límite exacto de
    // cada sector (los límites están cada PI/4, corridos PI/8): separa bien
    // plateas y populares, y coincide con el borde de la iluminación.
    const stripeCode = striped
      ? '\n    float s = (ang + 3.14159265) * uStripes / 6.28318531;\n    diffuseColor.rgb = fract(s) < 0.5 ? uCel : uWht;'
      : '';
    sh.fragmentShader = sh.fragmentShader.replace('#include <color_fragment>',
      '#include <color_fragment>\n  {\n    vec2 dxz = vWPos.xz - uPitchXZ;\n    float ang = atan(dxz.y, dxz.x);' + stripeCode +
      '\n    float mB = mod(ang - 0.39269908, 0.78539816);\n    float dB = min(mB, 0.78539816 - mB);\n    if (dB < 0.008) diffuseColor.rgb *= 0.3;\n  }');
    seatShaders.push(sh);
  };
  mat.needsUpdate = true;
}

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
        // butacas: franjas radiales celestes/blancas SIEMPRE (el patrón propio
        // del modelo traía bloques enteros de un solo color — acá se rayan todos)
        if (mat.name === 'BLK_STADIUM_SEATS_PRIMARY' || mat.name === 'BLK_STADIUM_SEATS_SECONDARY') {
          if (!mat.userData.glowed) { mat.userData.glowed = true; addStandShader(mat, true); }
        }
        // TODA superficie lisa del cuenco (terrazas pintadas, paredones y las
        // gradas de las medialunas) lleva las franjas radiales: no queda ninguna
        // zona todo blanca o todo celeste. Los túneles quedan afuera.
        const isBowlPaint =
          ((mat.name === 'BLK_STADIUM_CONCRETE' || mat.name === 'BLK_STADIUM_TERR_STRIPE') && !/Tunnel/.test(o.name)) ||
          (mat.name === 'BLK_FEATURE' && /Wall|Seating/.test(o.name));
        if (isBowlPaint) {
          o.material = mat.clone();
          addStandShader(o.material, true);
        }
        // techo: gris grafito arriba (foto aérea); por dentro claro, casi blanco
        if (mat.name === 'BLK_STADIUM_ROOF_TOP') mat.color.setHex(0x3d434b);
        if (mat.name === 'BLK_STADIUM_ROOF') mat.color.setHex(0xc5cdd3);
        // la visera interior del techo NO va negra: va blanca como en la realidad
        if (mat.name === 'BLK_STADIUM_VISOR_A') mat.color.setHex(0xe2e7eb);
        // el alambrado (reja) entre el campo y las populares es una malla de acero
        // galvanizado: se ve la cancha a través, como el alambrado olímpico real
        if (mat.name === 'BLK_STADIUM_FENCE') {
          mat.transparent = true;
          mat.opacity = 0.22;
          mat.depthWrite = false;
          mat.metalness = 0.7;
          mat.roughness = 0.4;
          mat.color.setHex(0x9aa6b0);
        }
        // hormigón de palcos/cabinas: mate (no se "quema" en blanco tipo vidrio)
        if (mat.name === 'BLK_STADIUM_FACADE') { mat.roughness = 0.92; mat.metalness = 0; }
        // vidrios de verdad (ventanales y frente de palcos): azulados y
        // reflejan el cielo (baja rugosidad), no negros opacos
        if (mat.name === 'BLK_STADIUM_FACADE_GLASS') { mat.color.setHex(0x244f6e); mat.metalness = 0.35; mat.roughness = 0.08; }
        if (mat.name === 'BLK_STADIUM_PALCO') { mat.color.setHex(0x162838); mat.metalness = 0.3; mat.roughness = 0.12; }
        // césped: verde más vivo, con el corte alternado un tono más oscuro
        if (mat.name === 'BLK_STADIUM_TURF') {
          mat.color.setHex(0x3f8f39); mat.roughness = 0.85;
          if (/Alternate/.test(o.name)) { o.material = mat.clone(); o.material.color.setHex(0x347c30); }
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
  aimView(OVERVIEW_POS.clone(), STADIUM_CENTER.clone());
  view.fov = 46; autoOrbit = true; updateJoy();
  setTimeout(() => { if (mode === 'overview' && !userRotate) autoOrbit = false; }, 4200);
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

function goOverview() {
  mode = 'transition'; activeArea = null; pendingSeat = null; marker.visible = false;
  hideAreaHighlight(); updateJoy();
  startTween({
    toPos: OVERVIEW_POS.clone(), toLook: STADIUM_CENTER.clone(), toFov: 46, duration: 1250,
    onDone: () => {
      mode = 'overview';
      aimView(OVERVIEW_POS.clone(), STADIUM_CENTER.clone());
      view.fov = 46; autoOrbit = userRotate; updateJoy();
    },
  });
  setModeTag('Vista aérea');
  hideBack();
  renderOverview();
}

function goArea(area) {
  mode = 'transition'; activeArea = area; pendingSeat = null; marker.visible = false;
  autoOrbit = false;
  const v = areaView(area);
  showAreaHighlight(area);
  startTween({
    toPos: v.pos, toLook: v.look, toFov: v.fov, duration: 1300,
    onDone: () => {
      mode = 'area';
      aimView(v.pos.clone(), v.look.clone());
      view.fov = v.fov; updateJoy();
    },
  });
  setModeTag(area.name);
  showBack('Sectores');
  renderArea(area);
}

function goSeat(seat) {
  mode = 'transition'; pendingSeat = seat; marker.visible = false;
  hideAreaHighlight();
  autoOrbit = false;
  // altura de los ojos sentado, apenas hacia adelante (sobre la baranda)
  const eye = seat.point.clone();
  eye.y += 1.2;
  const toC = PITCH.clone().sub(eye); toC.y = 0; toC.normalize();
  eye.addScaledVector(toC, 0.6);
  // mirar al mediocampo a media altura: se ve la cancha y la tribuna de enfrente
  const look = new THREE.Vector3(PITCH.x, 3.0, PITCH.z).addScaledVector(toC, 6);
  const fov = seat.area.kind === 'palco' ? 52 : 58;
  startTween({
    toPos: eye, toLook: look, toFov: fov, duration: 1350,
    onDone: () => {
      // en la butaca estás sentado: sólo girás la cabeza (primera persona, sin moverte)
      mode = 'seat';
      aimView(eye.clone(), look.clone());
      view.fov = fov;
      updateJoy();
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
    if (r < 34 || r > 108 || p.y < 1.2 || p.y > 22) continue; // debe ser una tribuna (no techo)
    const angle = Math.atan2(p.z - PITCH.z, p.x - PITCH.x);
    const area = areaForSeat(p.x, p.z, p.y);
    // si tocaste el lugar de otro sector, te cambia a ese sector
    if (area !== activeArea) {
      activeArea = area;
      showAreaHighlight(area);
      setModeTag(area.name);
    }
    const fila = filaAt(p.y);
    const isPop = area.kind === 'popular';
    const colNum = colNumAt(area, angle);
    const butaca = isPop ? 'Gral.' : colNum;
    const sold = !isPop && seatSold(area, fila, colNum); // las populares no se numeran
    let price = area.priceFrom;
    if (!isPop) price = area.priceFrom * (1 + Math.max(0, 18 - fila) * 0.02);
    pendingSeat = { point: p.clone(), area, fila, butaca, price, kind: area.kind, sold };
    marker.position.copy(p);
    marker.visible = true;
    renderArea(area, pendingSeat);
    return;
  }
}

/* ============================================================ Puntero ======= */
// Arrastrar sobre la escena mira alrededor (girar la cabeza / la cámara).
// En modo 'area', un "toque" (poco movimiento) elige la butaca.
// Dos dedos = pellizco -> zoom (FOV). Moverse: flechas/WASD o el joystick.
const LOOK_SENS = 0.0026;
const pointers = new Map();
let downX = 0, downY = 0, dragging = false, moved = 0, lastX = 0, lastY = 0, pinchDist = 0;

function lookDrag(dx, dy) {
  autoOrbit = false;
  view.yaw -= dx * LOOK_SENS;
  const lim = mode === 'seat' ? [-0.72, 0.55] : [-1.4, 0.9];
  view.pitch = THREE.MathUtils.clamp(view.pitch + dy * LOOK_SENS, lim[0], lim[1]);
}
function zoomFov(delta) {
  view.fov = THREE.MathUtils.clamp(view.fov + delta, 22, 74);
}

canvas.addEventListener('pointerdown', (e) => {
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  downX = lastX = e.clientX; downY = lastY = e.clientY; moved = 0; dragging = true;
  try { canvas.setPointerCapture(e.pointerId); } catch (_) {}
});
canvas.addEventListener('pointermove', (e) => {
  const pt = pointers.get(e.pointerId);
  if (pt) { pt.x = e.clientX; pt.y = e.clientY; }
  if (dragging) moved = Math.max(moved, Math.hypot(e.clientX - downX, e.clientY - downY));
  if (mode === 'transition') { lastX = e.clientX; lastY = e.clientY; return; }
  if (pointers.size >= 2) {
    // pellizco -> zoom (FOV)
    const [a, b] = [...pointers.values()];
    const d = Math.hypot(a.x - b.x, a.y - b.y);
    if (pinchDist) zoomFov(-(d - pinchDist) * 0.12);
    pinchDist = d;
  } else if (dragging) {
    lookDrag(e.clientX - lastX, e.clientY - lastY);
  }
  lastX = e.clientX; lastY = e.clientY;
});
function endPointer(e) {
  pointers.delete(e.pointerId);
  if (pointers.size < 2) pinchDist = 0;
  if (pointers.size === 0) dragging = false;
}
canvas.addEventListener('pointerup', (e) => {
  if (mode === 'area' && moved < 7 && pointers.size <= 1) pickSeat(e.clientX, e.clientY);
  endPointer(e);
});
canvas.addEventListener('pointercancel', endPointer);
canvas.addEventListener('wheel', (e) => {
  if (mode === 'transition') return;
  e.preventDefault();
  zoomFov(e.deltaY * 0.03);
}, { passive: false });

/* ---- Teclado: flechas / WASD para moverse, Espacio/Shift para subir/bajar --- */
const MOVE_KEYS = new Set(['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' ', 'e', 'q', 'shift']);
window.addEventListener('keydown', (e) => {
  const k = e.key.toLowerCase();
  if (!MOVE_KEYS.has(k)) return;
  keys.add(k);
  if (mode !== 'seat') autoOrbit = false;
  if (k.startsWith('arrow') || k === ' ') e.preventDefault();
});
window.addEventListener('keyup', (e) => keys.delete(e.key.toLowerCase()));
window.addEventListener('blur', () => keys.clear());

/* ---- Joystick táctil ("circulito") para moverse en el celular --------------- */
const joyEl = document.createElement('div');
joyEl.id = 'joystick';
joyEl.innerHTML = '<div id="joyknob"></div>';
document.body.appendChild(joyEl);
const joyKnob = joyEl.firstElementChild;
const isTouch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
let joyId = null;
function resetKnob() { joy.x = 0; joy.y = 0; joyKnob.style.transform = 'translate(-50%,-50%)'; }
function updateJoy() {
  // el joystick (celu) para caminar y los botones subir/bajar aparecen cuando
  // estás dentro de un sector; en la vista aérea elegís de la lista.
  const inArea = mode === 'area';
  joyEl.style.display = (isTouch && inArea) ? 'block' : 'none';
  udEl.style.display = inArea ? 'flex' : 'none';
  if (!(isTouch && inArea)) { joyId = null; resetKnob(); }
  if (!inArea) joy.up = 0;
}
function joyMove(e) {
  const r = joyEl.getBoundingClientRect();
  const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
  const dx = e.clientX - cx, dy = e.clientY - cy;
  const R = r.width / 2;
  const len = Math.hypot(dx, dy) || 1;
  const cl = Math.min(len, R);
  const nx = dx / len, ny = dy / len;
  joy.x = nx * (cl / R);
  joy.y = -ny * (cl / R); // arriba en el joystick = avanzar
  joyKnob.style.transform = `translate(calc(-50% + ${nx * cl}px), calc(-50% + ${ny * cl}px))`;
}
joyEl.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  joyId = e.pointerId; autoOrbit = false;
  try { joyEl.setPointerCapture(e.pointerId); } catch (_) {}
  joyMove(e);
});
joyEl.addEventListener('pointermove', (e) => { if (e.pointerId === joyId) joyMove(e); });
function joyEnd(e) { if (e.pointerId === joyId) { joyId = null; resetKnob(); } }
joyEl.addEventListener('pointerup', joyEnd);
joyEl.addEventListener('pointercancel', joyEnd);

/* ---- Botones Subir / Bajar (para moverte en altura dentro del sector) ------ */
const udEl = document.createElement('div');
udEl.id = 'updown';
udEl.innerHTML = '<button id="ud-up" aria-label="Subir">▲</button><button id="ud-down" aria-label="Bajar">▼</button>';
document.body.appendChild(udEl);
function holdVert(btn, dir) {
  const on = (e) => { e.preventDefault(); joy.up = dir; autoOrbit = false; btn.classList.add('on'); try { btn.setPointerCapture(e.pointerId); } catch (_) {} };
  const off = () => { if (joy.up === dir) joy.up = 0; btn.classList.remove('on'); };
  btn.addEventListener('pointerdown', on);
  btn.addEventListener('pointerup', off);
  btn.addEventListener('pointercancel', off);
  btn.addEventListener('pointerleave', off);
}
holdVert(udEl.querySelector('#ud-up'), 1);
holdVert(udEl.querySelector('#ud-down'), -1);

/* ============================================================ UI ============ */
const sheet = document.getElementById('sheet');
const sheetContent = document.getElementById('sheet-content');
const backbtn = document.getElementById('backbtn');
const backText = document.getElementById('backbtn-text');
function showBack(t) { backText.textContent = t; backbtn.classList.remove('hidden'); }
function hideBack() { backbtn.classList.add('hidden'); }
function setModeTag(t) { document.getElementById('mode-tag').textContent = t; }
// el "handle" colapsa/expande el panel para ver mejor el estadio (sobre todo en el celu)
function untuck() { sheet.classList.remove('tuck'); }
document.getElementById('sheet-handle').addEventListener('click', () => sheet.classList.toggle('tuck'));

function renderOverview() {
  untuck();
  const cards = AREAS.map((a) => `
    <button class="area-card" data-area="${a.id}">
      <span class="area-swatch" style="background:${a.color}"></span>
      <span class="area-info">
        <span class="area-name">${a.name}</span>
        <span class="area-meta">${a.tier} · ${fmtNum(a.cap)} lugares · desde ${fmtPrice(a.priceFrom)}</span>
      </span>
    </button>`).join('');
  sheetContent.innerHTML = `
    <div class="sheet-kicker">Paso 1 de 2 · ${fmtNum(CAPACITY)} lugares</div>
    <div class="sheet-title">Elegí tu sector</div>
    <div class="sheet-sub">Tocá una tribuna para acercarte. Movete con las flechas o el joystick, arrastrá para mirar y hacé zoom con la rueda o pellizcando.</div>
    <div class="area-grid">${cards}</div>`;
  sheetContent.querySelectorAll('.area-card').forEach((el) =>
    el.addEventListener('click', () => goArea(AREAS.find((a) => a.id === el.dataset.area)))
  );
}

function renderArea(area, seat) {
  untuck();
  if (!seat) {
    sheetContent.innerHTML = `
      <div class="sheet-kicker">Paso 2 de 2 · ${area.name}</div>
      <div class="sheet-title">Tocá tu ${area.kind === 'popular' ? 'lugar' : 'butaca'}</div>
      <div class="pick-row">
        <span class="pick-pulse"></span>
        <span class="pick-text">Tocá sobre la tribuna para elegir tu lugar. Arrastrá para mirar y usá las flechas o el joystick para acercarte caminando.</span>
      </div>`;
    return;
  }
  sheetContent.innerHTML = seatCardHTML(seat, false);
  wireSeatCard(seat, false);
}

function renderSeat(seat) {
  untuck();
  sheetContent.innerHTML = seatCardHTML(seat, true);
  wireSeatCard(seat, true);
}

// Card compartida: paso de confirmación (inSeat=false) y vista desde la butaca (inSeat=true).
function metaLabel(seat) {
  return seat.kind === 'popular'
    ? `<div class="meta-item"><span class="meta-k">Ubicación</span><span class="meta-v">Popular</span></div>`
    : `<div class="meta-item"><span class="meta-k">Butaca</span><span class="meta-v">${seat.butaca}</span></div>`;
}
function seatCardHTML(seat, inSeat) {
  const a = seat.area;
  const sold = seat.sold;
  const soldTag = sold ? `<span class="tag-sold">Ocupada</span>` : '';
  const grabBtn = sold
    ? `<button class="btn btn-off" id="seat-grab" disabled>Butaca ocupada</button>`
    : `<button class="btn btn-primary" id="seat-grab">Reservar (demo)</button>`;
  const actions = inSeat
    ? `<button class="btn btn-ghost" id="seat-change">Cambiar butaca</button>${grabBtn}`
    : `<button class="btn btn-ghost" id="re-pick">Otro lugar</button>
       <button class="btn btn-primary" id="go-view">Ver desde acá</button>`;
  const note = inSeat
    ? `<div class="seat-desc">${a.desc} <b>Arrastrá para mirar alrededor y usá la rueda o el pellizco para acercar.</b></div>`
    : (sold ? `<div class="seat-desc"><b>Esta butaca ya está ocupada</b>, no se puede reservar. Podés verla igual o elegir otra.</div>` : '');
  return `
    <div class="seat-head">
      <span class="seat-accent"></span>
      <span class="seat-head-txt"><span class="seat-name">${a.name}</span><span class="seat-tier">${a.tier}</span></span>
      ${soldTag}
    </div>
    <div class="seat-meta">
      <div class="meta-item"><span class="meta-k">Fila</span><span class="meta-v">${seat.fila}</span></div>
      ${metaLabel(seat)}
      <div class="meta-item"><span class="meta-k">Entrada</span><span class="meta-v">${fmtPrice(seat.price)}</span></div>
    </div>
    <div class="cap-note">${fmtNum(a.cap)} lugares en este sector · ${fmtNum(CAPACITY)} en todo el Cilindro</div>
    ${note}
    <div class="row-actions">${actions}</div>`;
}
function wireSeatCard(seat, inSeat) {
  const a = seat.area;
  if (inSeat) {
    sheetContent.querySelector('#seat-change').addEventListener('click', () => goArea(a));
    const grab = sheetContent.querySelector('#seat-grab');
    if (!seat.sold) grab.addEventListener('click', () => toast(`¡Lugar en ${a.name} reservado! 🔵⚪`));
  } else {
    sheetContent.querySelector('#go-view').addEventListener('click', () => goSeat(pendingSeat));
    sheetContent.querySelector('#re-pick').addEventListener('click', () => {
      pendingSeat = null; marker.visible = false; renderArea(a);
    });
  }
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
  if (mode === 'overview') autoOrbit = userRotate;
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
  // brillo de las butacas del sector elegido (shader en ambos materiales)
  const pulse = Math.sin(t * 2.6) * 0.5 + 0.5;
  for (const sh of seatShaders) {
    const u = sh.uniforms;
    u.uActive.value = seatGlow.active;
    u.uActAng.value = seatGlow.ang;
    u.uActHalf.value = seatGlow.half;
    u.uActYLo.value = seatGlow.ylo;
    u.uActYHi.value = seatGlow.yhi;
    u.uActPulse.value = pulse;
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
  } else {
    // cámara libre: en aérea/sector te movés (flechas/joystick); en la butaca la
    // posición queda fija y sólo girás la cabeza. Siempre podés mirar y hacer zoom.
    if (mode !== 'seat') applyMove(dt);
    camera.position.copy(view.pos);
    if (camera.fov !== view.fov) { camera.fov = view.fov; camera.updateProjectionMatrix(); }
    currentLook.copy(view.pos).add(viewDir());
    camera.lookAt(currentLook);
  }

  renderer.render(scene, camera);
}
animate();
