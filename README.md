# El Cilindro · Visor 3D 🔵⚪

Visor 3D interactivo del **Estadio Presidente Perón** (_El Cilindro_) de **Racing Club**,
en Avellaneda. Inspirado en la demo [StadiView](https://football-stadium-ruddy.vercel.app/):
elegís tu **sector** y después tu **butaca (o lugar en la popular)** y ves cómo se ve la
cancha desde ahí, como si estuvieras eligiendo tu entrada. Pensado para andar **bien en el celu**.

Construido con [Three.js](https://threejs.org/) + [Vite](https://vitejs.dev/).

## ✨ Cómo funciona

1. **Vista aérea** del Cilindro (arrastrar para girar, rueda/pellizco para zoom).
2. **Paso 1 — Elegí tu sector**: tocás una de las tribunas reales del estadio y la cámara
   vuela hasta ahí.
3. **Paso 2 — Elegí tu butaca**: tocás directamente sobre la tribuna el lugar exacto donde
   te querés sentar. Aparece un marcador con la fila, la butaca y el precio.
4. **Ver desde acá**: te sienta en esa butaca en primera persona. Arrastrás para mirar
   alrededor y la rueda hace zoom hacia la cancha.

Extras: **día/noche** con los reflectores del estadio, **giro automático 360°**, y UI
responsive tipo _bottom sheet_ en el celular.

## 🏟️ Sectores (reales del Cilindro)

Platea Belgrano (lateral Oeste) · Platea San Martín (lateral Este) · Popular Sur (local) ·
Popular Norte (visitante) · Palcos Preferenciales (codo) · Platea Damas. Los precios, filas
y butacas de la demo son ilustrativos (editables en `src/areas.js`).

## 🎨 Colores reales del modelo

Los colores salen del **`.blend` original**: se extrajeron con Blender (`bpy`) y se
hornearon en el GLB como `baseColorFactor` — asientos celestes `#70c5e8` y blancos `#f4f4f2`,
fachada, techo, palcos, pantallas y reflectores con emisión. El césped se pinta de verde
(en el blend ese material venía sin color de base). Todo esto vive ya dentro del `.glb`.

## 🧱 El modelo

`public/models/RACING_3D.glb` contiene **solo el estadio** (se quitó la manzana / barrio
del modelo original). Se comprimió con [glTF-Transform](https://gltf-transform.dev/)
(dedup + prune + weld + quantize + **meshopt**), de ~40 MB a **~7 MB**, por eso la app usa
`MeshoptDecoder` al cargar y anda liviano en el celular.

## 🚀 Desarrollo

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # dist/ listo para Vercel
npm run preview
```

Listo para desplegar en **Vercel** (framework Vite autodetectado; ver `vercel.json`).

## 🗂️ Estructura

```
index.html          Estructura + overlays de UI (bottom sheet)
src/main.js         Escena Three.js: carga, luces, cámaras, raycast de butacas, UI
src/areas.js        Sectores reales del Cilindro + helpers
src/style.css       Estilos mobile-first (glassmorphism, paleta Racing)
public/models/      RACING_3D.glb (solo el estadio, colores del .blend)
```

## 🎮 Controles

| Acción | Vista aérea | Elegir butaca | En la butaca |
| --- | --- | --- | --- |
| Arrastrar | Girar el estadio | Mirar la tribuna | Mirar alrededor |
| Rueda / pellizco | Zoom | Zoom | Zoom (FOV) a la cancha |
| Tocar | Elegir sector | Elegir tu lugar | — |
| 360° | Giro automático | — | — |
| ☀ / ☾ | Día / noche | Día / noche | Día / noche |

---

Hecho por hinchas, para hinchas. _¡Aguante Racing!_ 🔵⚪
