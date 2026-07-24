import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { AREAS, PITCH_CENTER, fmtPrice, areaForSeat } from './areas.js';

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
    // vista aérea: recorrido amplio alrededor del estadio
    view.pos.y = THREE.MathUtils.clamp(view.pos.y, 2.5, 135);
    if (r > 440) { const s = 440 / r; view.pos.x = STADIUM_CENTER.x + dx * s; view.pos.z = STADIUM_CENTER.z + dz * s; }
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
scene.fog = new THREE.Fog(0xcfe6f5, 320, 620);

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
const ground = new THREE.Mesh(new THREE.CircleGeometry(440, 72), groundMat);
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
let seatShader = null;

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

const bowlRadiusAt = (y) => 50 + (93 - 50) * (y - 1) / 19; // radio del cuenco a esa altura
const filaAt = (y) => THREE.MathUtils.clamp(Math.round((y - 1.6) / 0.42) + 1, 1, 58);
const colNumAt = (angle) => 1 + (Math.abs(Math.round((angle + Math.PI) * 34)) % 214); // butaca numerada
// Algunas butacas ya están ocupadas (ejemplo, sin marcarlas en el 3D): no se
// pueden reservar. Es determinístico, así una misma butaca siempre da igual.
function seatSold(area, fila, colNum) {
  const salt = AREAS.indexOf(area) + 1;
  let h = (Math.imul(fila * salt, 73856093) ^ Math.imul(colNum + 1, 19349663)) >>> 0;
  h = (h ^ (h >>> 13)) >>> 0;
  return (h % 100) < 28; // ~28% ocupadas
}

/* ====================================================== Resaltado de área == */
// Al elegir un sector, esa tribuna SE ILUMINA en celeste: un glow sobre el cuenco
// + (en las plateas) un realce emisivo de las propias butacas via shader.
let areaHL = null;
function showAreaHighlight(area) {
  hideAreaHighlight();
  const thetaLen = area.kind === 'popular' ? 1.55 : 1.2;
  const thetaStart = (Math.PI / 2 - area.ang) - thetaLen / 2; // convención CylinderGeometry
  const lo = area.band === 'high' ? 10.5 : 1;
  const hi = area.band === 'low' ? 10.5 : 20;
  const rAt = bowlRadiusAt;
  const g = new THREE.Group();
  // baño de luz celeste sobre la tribuna elegida
  const fillMat = new THREE.MeshBasicMaterial({
    color: 0x4fc6ff, transparent: true, opacity: 0.2,
    side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const fill = new THREE.Mesh(
    new THREE.CylinderGeometry(rAt(hi), rAt(lo), hi - lo, 48, 1, true, thetaStart, thetaLen), fillMat);
  fill.position.set(PITCH.x, (lo + hi) / 2, PITCH.z);
  // borde brillante arriba: remarca prolijo del sector
  const bandMat = new THREE.MeshBasicMaterial({
    color: 0xbdeeff, transparent: true, opacity: 0.85,
    side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const band = new THREE.Mesh(
    new THREE.CylinderGeometry(rAt(hi + 1.3), rAt(hi - 1.3), 2.6, 48, 1, true, thetaStart, thetaLen), bandMat);
  band.position.set(PITCH.x, hi, PITCH.z);
  g.add(fill, band);
  g.userData = { fillMat, bandMat };
  areaHL = g;
  scene.add(areaHL);
  // realce de las butacas del sector (shader): ángulo y banda activos
  seatGlow.active = 1;
  seatGlow.ang = area.ang;
  seatGlow.half = (area.kind === 'popular' ? 1.55 : 1.2) / 2;
  seatGlow.ylo = lo - 0.5;
  seatGlow.yhi = hi + 0.5;
}
function hideAreaHighlight() {
  seatGlow.active = 0;
  if (!areaHL) return;
  scene.remove(areaHL);
  areaHL.traverse((o) => { if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); } });
  areaHL = null;
}

/* ============================================================ Carga ======== */
const loaderEl = document.getElementById('loader');
const fillEl = document.getElementById('loader-fill');
const pctEl = document.getElementById('loader-pct');
let modelRoot = null;
const raycastTargets = [];

/* Franjas de las tribunas: teñimos el material de los asientos por posición, con
   franjas DIAGONALES celestes y blancas (~35°, mitad y mitad) como en el Cilindro
   real. El mismo shader ilumina en celeste la tribuna del sector elegido. */
const SEAT_BAND_H = 0.9;   // ancho de cada franja
const SEAT_R = 68.0;       // radio medio para la coordenada tangencial
const SEAT_CEL = new THREE.Color(0x2ba7e6).convertSRGBToLinear();
const SEAT_WHT = new THREE.Color(0xeff4f8).convertSRGBToLinear();
const SEAT_GLOWC = new THREE.Color(0x3fc0ff).convertSRGBToLinear();
const PITCH_XZ = new THREE.Vector2(PITCH.x, PITCH.z);
let stripedSeatMat = null;
function makeStripedSeatMat(base) {
  const m = base.clone();
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, {
      uBandH: { value: SEAT_BAND_H }, uR: { value: SEAT_R },
      uCel: { value: SEAT_CEL }, uWht: { value: SEAT_WHT },
      uPitchXZ: { value: PITCH_XZ }, uGlowC: { value: SEAT_GLOWC },
      uActive: { value: 0 }, uActAng: { value: 0 }, uActHalf: { value: 0.6 },
      uActYLo: { value: 1 }, uActYHi: { value: 21 }, uActPulse: { value: 0 },
    });
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWPos;')
      .replace('#include <begin_vertex>',
        '#include <begin_vertex>\n#ifdef USE_INSTANCING\n  vWPos = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz;\n#else\n  vWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;\n#endif');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>',
        '#include <common>\nvarying vec3 vWPos;\nuniform float uBandH;uniform float uR;uniform vec3 uCel;uniform vec3 uWht;uniform vec2 uPitchXZ;\nuniform vec3 uGlowC;uniform float uActive;uniform float uActAng;uniform float uActHalf;uniform float uActYLo;uniform float uActYHi;uniform float uActPulse;')
      .replace('#include <color_fragment>',
        '#include <color_fragment>\n  {\n    vec2 dxz = vWPos.xz - uPitchXZ;\n    float arc = atan(dxz.y, dxz.x) * uR;\n    float u = vWPos.y * 0.819 - arc * 0.574;\n    float band = mod(u, uBandH * 2.0);\n    diffuseColor.rgb = band < uBandH ? uCel : uWht;\n  }')
      .replace('#include <emissivemap_fragment>',
        '#include <emissivemap_fragment>\n  if (uActive > 0.5) {\n    vec2 dpz = vWPos.xz - uPitchXZ;\n    float da = abs(atan(sin(atan(dpz.y, dpz.x) - uActAng), cos(atan(dpz.y, dpz.x) - uActAng)));\n    if (da < uActHalf && vWPos.y > uActYLo && vWPos.y < uActYHi) {\n      totalEmissiveRadiance += uGlowC * (0.45 + 0.55 * uActPulse);\n    }\n  }');
    seatShader = sh;
  };
  m.needsUpdate = true;
  return m;
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
        // asientos: en las gradas van en franjas celestes y blancas (por altura);
        // en el exterior quedan celeste sólido
        if (mat.name === 'BLK_STADIUM_SEATS_PRIMARY') {
          if (/Seats/.test(o.name)) {
            if (!stripedSeatMat) stripedSeatMat = makeStripedSeatMat(mat);
            o.material = stripedSeatMat;
          } else {
            mat.color.setHex(0x12a0e8);
          }
        }
        // la franja celeste pintada sobre el cemento de las plateas (seña de Racing)
        if (mat.name === 'BLK_STADIUM_TERR_STRIPE') mat.color.setHex(0x2f9fdd);
        // cemento de las tribunas y del playón: gris claro parejo (resalta la
        // franja y las butacas, y los costados quedan como pavimento, no un pozo)
        if (mat.name === 'BLK_STADIUM_CONCRETE') { mat.color.setHex(0x70737a); mat.roughness = 0.92; }
        // el techo real es gris grafito visto desde arriba (no celeste)
        if (mat.name === 'BLK_STADIUM_ROOF' || mat.name === 'BLK_STADIUM_ROOF_TOP') mat.color.setHex(0x3d434b);
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
        // las barandas/vallas bajas de las gradas SÍ son sólidas (metal pintado)
        if (mat.name === 'BLK_STADIUM_BARRIER') {
          mat.metalness = 0.45; mat.roughness = 0.5; mat.color.setHex(0x8b96a0);
        }
        // hormigón de palcos/cabinas/estructura: gris claro MATE (así no se
        // "quema" en blanco brillante ni parece vidrio bajo el sol)
        if (mat.name === 'BLK_STADIUM_FACADE') { mat.color.setHex(0xbcc1c6); mat.roughness = 0.9; mat.metalness = 0; }
        // los pasillos/escaleras blancos, un pelín menos encandiladores
        if (mat.name === 'BLK_STADIUM_SAFETY') mat.color.setHex(0xc2c7cb);
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
    if (r < 34 || r > 100 || p.y < 1.2 || p.y > 20) continue; // debe ser una tribuna (no techo)
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
    const colNum = colNumAt(angle);
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
        <span class="area-meta">${a.tier} · desde ${fmtPrice(a.priceFrom)}</span>
      </span>
    </button>`).join('');
  sheetContent.innerHTML = `
    <div class="sheet-kicker">Paso 1 de 2</div>
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
      <span class="seat-accent" style="background:${a.color};color:${a.color}"></span>
      <span class="seat-head-txt"><span class="seat-name">${a.name}</span><span class="seat-tier">${a.tier}</span></span>
      ${soldTag}
    </div>
    <div class="seat-meta">
      <div class="meta-item"><span class="meta-k">Fila</span><span class="meta-v">${seat.fila}</span></div>
      ${metaLabel(seat)}
      <div class="meta-item"><span class="meta-k">Entrada</span><span class="meta-v">${fmtPrice(seat.price)}</span></div>
    </div>
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
  if (areaHL) {
    const p = Math.sin(t * 2.3) * 0.5 + 0.5;
    areaHL.userData.fillMat.opacity = 0.14 + p * 0.2;
    areaHL.userData.bandMat.opacity = 0.6 + p * 0.35;
  }
  // realce emisivo de las butacas del sector elegido (shader)
  if (seatShader) {
    const u = seatShader.uniforms;
    u.uActive.value = seatGlow.active;
    u.uActAng.value = seatGlow.ang;
    u.uActHalf.value = seatGlow.half;
    u.uActYLo.value = seatGlow.ylo;
    u.uActYHi.value = seatGlow.yhi;
    u.uActPulse.value = Math.sin(t * 2.6) * 0.5 + 0.5;
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
