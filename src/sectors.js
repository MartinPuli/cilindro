// Sectores de El Cilindro (Estadio Presidente Perón).
// Coordenadas en el espacio del modelo GLB. El campo de juego está centrado
// aprox. en (3.8, 0, 3.6); los arcos corren sobre el eje Z y las líneas de
// banda sobre el eje X. `pos` es la ubicación de la butaca (cámara); la mirada
// apunta siempre al centro de la cancha.

export const PITCH_CENTER = { x: 3.8, y: 1.2, z: 3.6 };

// Formato de precio en pesos argentinos.
export const fmtPrice = (n) =>
  '$' + n.toLocaleString('es-AR', { maximumFractionDigits: 0 });

export const SECTORS = [
  {
    id: 'belgrano-baja',
    name: 'Platea Belgrano',
    tier: 'Bandeja baja · lateral',
    pos: { x: -55, y: 6.5, z: 6 },
    aim: { x: 3.8, y: 1.0, z: 3.6 },
    fov: 62,
    color: '#58bff0',
    row: 8,
    seat: 114,
    price: 42000,
    desc: 'A metros de la línea de banda. La platea histórica del Cilindro, con el mediocampo justo al frente.',
  },
  {
    id: 'belgrano-alta',
    name: 'Platea Belgrano Alta',
    tier: 'Bandeja alta · lateral',
    pos: { x: -78, y: 15.5, z: 9 },
    aim: { x: 3.8, y: 0.8, z: 3.6 },
    fov: 55,
    color: '#3fa9e8',
    row: 27,
    seat: 61,
    price: 33000,
    desc: 'Vista panorámica desde lo alto del lateral. Se ve el dibujo táctico completo de los dos equipos.',
  },
  {
    id: 'san-martin',
    name: 'Platea San Martín',
    tier: 'Bandeja media · lateral',
    pos: { x: 66, y: 12.5, z: 1 },
    aim: { x: 3.8, y: 1.0, z: 3.6 },
    fov: 58,
    color: '#7ad0ff',
    row: 18,
    seat: 88,
    price: 38000,
    desc: 'Lateral opuesto, de frente a las cámaras de TV. Media cancha con el sol de tarde a favor.',
  },
  {
    id: 'popular-local',
    name: 'Popular Local',
    tier: 'Cabecera Sur · popular',
    pos: { x: 6, y: 9, z: 66 },
    aim: { x: 3.8, y: 0.8, z: 3.6 },
    fov: 66,
    color: '#ffffff',
    row: 24,
    seat: 0,
    price: 18000,
    desc: 'Detrás del arco, en el corazón del aguante. Donde la hinchada de Racing empuja los 90 minutos.',
  },
  {
    id: 'popular-visitante',
    name: 'Popular Norte',
    tier: 'Cabecera Norte · popular',
    pos: { x: 2, y: 10.5, z: -60 },
    aim: { x: 3.8, y: 0.8, z: 3.6 },
    fov: 66,
    color: '#c9e9fb',
    row: 30,
    seat: 0,
    price: 16000,
    desc: 'Cabecera opuesta, detrás del otro arco. Vista frontal del ataque de local sobre este lado.',
  },
  {
    id: 'palco',
    name: 'Palco Preferencial',
    tier: 'Codo Sudeste · palco',
    pos: { x: 58, y: 16.5, z: 56 },
    aim: { x: 3.8, y: 1.2, z: 3.6 },
    fov: 52,
    color: '#ffd66b',
    row: 3,
    seat: 12,
    price: 95000,
    desc: 'Butaca premium en el codo, a resguardo bajo el techo. La mejor vista diagonal de todo el estadio.',
  },
  {
    id: 'ras-campo',
    name: 'Ras del campo',
    tier: 'Perimetral · nivel campo',
    pos: { x: 3.8, y: 2.2, z: -47 },
    aim: { x: 3.8, y: 1.6, z: 20 },
    fov: 60,
    color: '#8affc0',
    row: 1,
    seat: 4,
    price: 120000,
    desc: 'Al ras del césped, detrás del arco. Sentís la velocidad del juego como un jugador más.',
  },
];
