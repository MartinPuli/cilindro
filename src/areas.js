// Sectores REALES de El Cilindro (Estadio Presidente Perón), según el mapa
// oficial de Racing Club: populares Sur (local) y Norte (visitante) en las
// cabeceras bajas, plateas laterales (A, B), plateas de codo (C, Damas) y
// plateas de la bandeja alta (D, E — la E, detrás del arco local).
//
// La cancha está centrada en ~(3.8, 0, 3.6); los arcos corren sobre el eje Z
// (Sur = +Z, Norte = -Z) y las plateas laterales sobre el eje X.
//
// `ang` = dirección de la tribuna respecto del centro.
// `band` = altura: 'low' (bandeja baja / popular), 'high' (bandeja alta) o 'all'.

export const PITCH_CENTER = { x: 3.8, y: 1.2, z: 3.6 };
export const HIGH_Y = 10.5; // límite entre bandeja baja y alta

export const fmtPrice = (n) =>
  '$' + Math.round(n).toLocaleString('es-AR', { maximumFractionDigits: 0 });

// kind: 'platea' (numerada) | 'popular' (general)
export const AREAS = [
  {
    id: 'popular-sur',
    name: 'Popular Sur',
    tier: 'Cabecera Sur · Local',
    kind: 'popular',
    band: 'low',
    color: '#eef3f7',
    priceFrom: 16000,
    ang: Math.PI / 2, // +Z
    desc: 'El corazón del aguante académico, detrás del arco Sur. La popular local del Cilindro.',
  },
  {
    id: 'popular-norte',
    name: 'Popular Norte',
    tier: 'Cabecera Norte · Visitante',
    kind: 'popular',
    band: 'low',
    color: '#cfe0ee',
    priceFrom: 15000,
    ang: -Math.PI / 2, // -Z
    desc: 'Cabecera Norte, detrás del otro arco. Sector para la hinchada visitante.',
  },
  {
    id: 'platea-a',
    name: 'Platea A',
    tier: 'Lateral · Preferencial',
    kind: 'platea',
    band: 'all',
    color: '#5bb6ea',
    priceFrom: 52000,
    ang: Math.PI, // -X
    desc: 'La platea más exclusiva del Cilindro, sobre el lateral. Mediocampo justo de frente.',
  },
  {
    id: 'platea-b',
    name: 'Platea B',
    tier: 'Lateral Este',
    kind: 'platea',
    band: 'all',
    color: '#70c5e8',
    priceFrom: 42000,
    ang: 0, // +X
    desc: 'Platea lateral, de frente a las cámaras de TV. El sol de tarde a favor.',
  },
  {
    id: 'platea-c',
    name: 'Platea C',
    tier: 'Codo Sudeste',
    kind: 'platea',
    band: 'all',
    color: '#8fd3f2',
    priceFrom: 34000,
    ang: Math.PI / 4, // +X+Z
    desc: 'Platea en el codo, con una gran vista diagonal de toda la cancha.',
  },
  {
    id: 'platea-damas',
    name: 'Platea Damas',
    tier: 'Codo Sur · Puerta 5',
    kind: 'platea',
    band: 'all',
    color: '#a7dbef',
    priceFrom: 30000,
    ang: (3 * Math.PI) / 4, // -X+Z
    desc: 'Sector histórico junto a la Popular Sur, sobre el codo Sudoeste (Puerta 5).',
  },
  {
    id: 'platea-e',
    name: 'Platea E',
    tier: 'Bandeja Alta · detrás del arco local',
    kind: 'platea',
    band: 'high',
    color: '#9ad7f5',
    priceFrom: 28000,
    ang: Math.PI / 2, // +Z (arriba de la Popular Sur)
    desc: 'En lo alto, detrás del arco local, sobre la Popular Sur. Vista panorámica de toda la cancha.',
  },
  {
    id: 'platea-d',
    name: 'Platea D',
    tier: 'Bandeja Alta · Norte',
    kind: 'platea',
    band: 'high',
    color: '#c2e6fa',
    priceFrom: 26000,
    ang: -Math.PI / 2, // -Z (arriba de la Popular Norte)
    desc: 'Bandeja alta sobre la cabecera Norte. Panorámica desde lo alto del Cilindro.',
  },
];

// A qué sector pertenece un punto del cuenco, según su ángulo Y su altura
// (así una misma cabecera tiene popular abajo y platea alta arriba).
export function areaForSeat(x, z, y) {
  const angle = Math.atan2(z - PITCH_CENTER.z, x - PITCH_CENTER.x);
  let best = null;
  let bestD = Infinity;
  for (const a of AREAS) {
    if (a.band === 'low' && y > HIGH_Y) continue;
    if (a.band === 'high' && y <= HIGH_Y) continue;
    const d = Math.abs(Math.atan2(Math.sin(angle - a.ang), Math.cos(angle - a.ang)));
    if (d < bestD) {
      bestD = d;
      best = a;
    }
  }
  return best || AREAS[0];
}
