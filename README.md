# El Cilindro · Visor 3D 🔵⚪

Visor 3D interactivo del **Estadio Presidente Perón** (_El Cilindro_) de **Racing Club**,
en Avellaneda. Inspirado en la demo [StadiView](https://football-stadium-ruddy.vercel.app/):
recorrés el estadio desde una vista aérea y "te sentás" en cada tribuna para ver
la cancha desde esa ubicación, como si estuvieras eligiendo tu entrada.

Construido con [Three.js](https://threejs.org/) + [Vite](https://vitejs.dev/) sobre
un modelo `RACING_3D.glb` del estadio y su manzana.

## ✨ Qué incluye

- **Vista aérea** del Cilindro con órbita libre (arrastrar para girar, rueda para zoom).
- **7 ubicaciones** para previsualizar: Platea Belgrano (baja y alta), Platea San Martín,
  Popular Local, Popular Norte, Palco Preferencial y "Ras del campo".
- **Vuelo de cámara** animado entre la vista aérea y cada butaca.
- **Modo butaca en primera persona**: arrastrás para mirar alrededor y la rueda hace
  zoom óptico (FOV) hacia la cancha.
- **Ficha de la ubicación**: sector, fila, butaca y precio (demo).
- **Día / Noche** con reflectores del estadio que se encienden de noche.
- **Giro automático** (botón 360°).
- Diseño responsive con la paleta de Racing (celeste y blanco).

## 🚀 Desarrollo

```bash
npm install
npm run dev      # http://localhost:5173
```

## 📦 Build / Deploy

```bash
npm run build    # genera dist/
npm run preview  # sirve el build localmente
```

Está listo para desplegar en **Vercel** (framework Vite autodetectado; ver `vercel.json`).
Basta con importar el repo en Vercel o correr `vercel`.

## 🗂️ Estructura

```
index.html          Estructura + overlays de UI
src/main.js         Escena Three.js: carga, luces, cámaras, controles y UI
src/sectors.js      Definición de sectores/ubicaciones del Cilindro
src/style.css       Estilos (glassmorphism, paleta Racing)
public/models/      RACING_3D.glb (modelo del estadio)
```

## 🧱 Sobre el modelo

`RACING_3D.glb` es el modelo del Cilindro y su entorno (edificios, calles y manzanas
de Avellaneda). El original pesaba ~40 MB; se comprimió a **~8 MB** con
[glTF-Transform](https://gltf-transform.dev/) (dedup + prune + weld + quantize +
compresión **meshopt**), por eso la app usa `MeshoptDecoder` al cargarlo.

Varios materiales del estadio (césped, hormigón, asientos, líneas) se exportaron sin
color base; `src/main.js` los pinta por nombre para lograr el look real: césped verde
con rayado, asientos celestes y blancos, hormigón gris y líneas blancas.

## 🎮 Controles

| Acción | Vista aérea | Modo butaca |
| --- | --- | --- |
| Arrastrar | Girar alrededor del estadio | Mirar alrededor |
| Rueda | Acercar / alejar | Zoom (FOV) a la cancha |
| Chips inferiores | Elegir ubicación | — |
| ← Volver al estadio | — | Regresar a la vista aérea |
| 360° | Giro automático on/off | — |
| ☀ / ☾ | Cambiar día / noche | Cambiar día / noche |

---

Hecho por hinchas, para hinchas. _¡Aguante Racing!_ 🔵⚪
