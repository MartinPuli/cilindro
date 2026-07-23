// Sectores REALES de El Cilindro (Estadio Presidente Perón), según el mapa
// oficial de Racing Club: plateas por letra (A, B, C, E…), Platea Damas, y
// populares Sur (local) y Norte (visitante). La cancha está centrada en
// ~(3.8, 0, 3.6); los arcos corren sobre el eje Z (Sur = +Z, Norte = -Z) y las
// plateas laterales sobre el eje X.
//
// Cada área define una cámara `view` para encuadrar esa tribuna (y poder elegir
// la butaca tocando), y metadatos para la ficha.

export const PITCH_CENTER = { x: 3.8, y: 1.2, z: 3.6 };

export const fmtPrice = (n) =>
  '$' + Math.round(n).toLocaleString('es-AR', { maximumFractionDigits: 0 });

// kind: 'platea' (numerada) | 'popular' (general)
export const AREAS = [
  {
    id: 'popular-sur',
    name: 'Popular Sur',
    tier: 'Cabecera Sur · Local',
    kind: 'popular',
    color: '#eef3f7',
    priceFrom: 16000,
    view: { pos: { x: 4, y: 24, z: -24 }, look: { x: 4, y: 10, z: 84 }, fov: 56 },
    ang: Math.PI / 2, // +Z
    desc: 'El corazón del aguante académico, detrás del arco Sur. La popular local del Cilindro.',
  },
  {
    id: 'popular-norte',
    name: 'Popular Norte',
    tier: 'Cabecera Norte · Visitante',
    kind: 'popular',
    color: '#cfe0ee',
    priceFrom: 15000,
    view: { pos: { x: 4, y: 26, z: 32 }, look: { x: 4, y: 11, z: -80 }, fov: 56 },
    ang: -Math.PI / 2, // -Z
    desc: 'Cabecera Norte, detrás del otro arco. Sector para la hinchada visitante.',
  },
  {
    id: 'platea-a',
    name: 'Platea A',
    tier: 'Lateral · Preferencial',
    kind: 'platea',
    color: '#5bb6ea',
    priceFrom: 52000,
    view: { pos: { x: 34, y: 26, z: 4 }, look: { x: -74, y: 10, z: 4 }, fov: 52 },
    ang: Math.PI, // -X
    desc: 'La platea más exclusiva del Cilindro, sobre el lateral. Mediocampo justo de frente.',
  },
  {
    id: 'platea-b',
    name: 'Platea B',
    tier: 'Lateral Este',
    kind: 'platea',
    color: '#70c5e8',
    priceFrom: 42000,
    view: { pos: { x: -26, y: 26, z: 4 }, look: { x: 86, y: 11, z: 4 }, fov: 52 },
    ang: 0, // +X
    desc: 'Platea lateral, de frente a las cámaras de TV. El sol de tarde a favor.',
  },
  {
    id: 'platea-c',
    name: 'Platea C',
    tier: 'Codo Sudeste',
    kind: 'platea',
    color: '#8fd3f2',
    priceFrom: 34000,
    view: { pos: { x: -22, y: 28, z: -22 }, look: { x: 60, y: 13, z: 60 }, fov: 50 },
    ang: Math.PI / 4, // +X+Z
    desc: 'Platea en el codo, con una gran vista diagonal de toda la cancha.',
  },
  {
    id: 'platea-damas',
    name: 'Platea Damas',
    tier: 'Codo Sur · Puerta 5',
    kind: 'platea',
    color: '#a7dbef',
    priceFrom: 30000,
    view: { pos: { x: 34, y: 24, z: -24 }, look: { x: -56, y: 11, z: 58 }, fov: 52 },
    ang: (3 * Math.PI) / 4, // -X+Z
    desc: 'Sector histórico junto a la Popular Sur, sobre el codo Sudoeste (Puerta 5).',
  },
];

// A qué área pertenece un punto del cuenco, según el ángulo respecto del centro.
export function areaFromAngle(angle) {
  let best = AREAS[0];
  let bestD = Infinity;
  for (const a of AREAS) {
    let d = Math.abs(Math.atan2(Math.sin(angle - a.ang), Math.cos(angle - a.ang)));
    if (d < bestD) {
      bestD = d;
      best = a;
    }
  }
  return best;
}
