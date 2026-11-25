# BeatWave

Juego de ritmo para el celular y la tablet (HTML + CSS + JavaScript). Se instala como PWA, funciona sin internet
y guarda todo en tu dispositivo: no usa cuentas ni bases de datos.

## Carpeta
```
index.html  styles.css  script.js  sw.js  manifest.webmanifest  _headers
icon-192.png  icon-512.png        (tus íconos)
assets/themes  assets/sfx         (fondos y sonidos)
songs/                            (canciones incluidas; opcional)
tools/                            (scripts de ayuda)
android-extra/MainActivity.java   (solo para Android)
.github/workflows/android.yml     (crea el APK automáticamente en GitHub)
capacitor.config.json  package.json  .gitignore
```

## Probar en tu PC
Clic derecho en `index.html` → **Open with Live Server**. Recarga con Ctrl+Shift+R.

## Publicar (PWA en Netlify)
```
node tools/copy-www.js
```
Arrastra la carpeta **www** a app.netlify.com/drop. Abre el enlace en Chrome del celular, con internet, y elige "Instalar aplicación".

## Tu progreso
Todo se guarda en el dispositivo: récords, favoritas, listas, nivel, XP, racha y ajustes.
Para pasarlo a otro celular: **Ajustes → Datos → Guardar copia** y en el otro **Cargar copia**. No incluye las canciones.
En el selector, la **copa** abre *Mis récords* (mejor puntaje, intentos y repeticiones) y el **engranaje** abre los ajustes.

## Android (APK)
**Opción fácil, sin Android Studio:** sube la carpeta a un repositorio de GitHub. En la pestaña **Actions → Android APK**
se crea el APK; descárgalo en **Artifacts → BeatWave-debug-apk**.

**Opción local** (necesita Node.js y Android Studio):
```
npm install @capacitor/core @capacitor/app @capacitor/android @capacitor/local-notifications
npm install -D @capacitor/cli
npm run apk:add
npm run apk:sync
npm run apk:open
```
En Android Studio: Build → Build APK(s).

## Avisos de misiones
En el APK, el aviso de «nueva misión» se programa con el sistema (funciona con el juego cerrado). En la versión web (Netlify) los navegadores no permiten programar avisos sin un servidor: el juego lo intenta con el service worker, pero solo es seguro cuando la app está instalada y abierta en segundo plano. Se activan en **Misiones → Notificaciones del teléfono**.

## Sin conexión
Después de abrir el juego una vez con internet, funciona sin conexión: pantallas, sonidos, canciones importadas y fondos.

## Canciones
Importa desde el juego (puedes elegir varias a la vez). Para incluir canciones en la app, ponlas en `songs/` y lista cada una en `songs/index.json`:
```
[{ "id": "mi-cancion", "file": "mi-cancion.mp3", "title": "Mi canción", "artist": "Yo", "cover": "mi-cancion.jpg", "video": "mi-cancion.mp4" }]
```
`cover` y `video` son opcionales. Usa solo música libre de derechos o que tengas permiso de usar.

## Rendimiento en equipos lentos
En **Ajustes → Gráficos**: *Rendimiento → Ahorro*, *Calidad gráfica → Baja* y *Limitar a 30 FPS*.
En modo Auto el juego baja la resolución y los efectos solo si detecta tirones.

## Modo práctica
**Ajustes → Juego → Modo práctica**: empieza la canción desde el 25, 50 o 75 %. No guarda récords ni XP.

## Íconos y fondos (opcional)
```
pip install pillow numpy
python tools/make_assets_hd.py
```

## Puntaje y modificadores (como osu!)
Perfect 300 · Great 100 · Good 50, más un bonus por combo. Mientras más notas tenga la canción, más puntos.
Los multiplicadores de los mods se multiplican entre sí: Sin fallo ×0.50 · Menos notas (Easy) ×0.50 · Lento (Half Time) ×0.30 ·
Amplias ×0.80 · Rápido (Double Time) ×1.10 · Más notas (Hard Rock) ×1.10 · Oculto (Hidden) ×1.06 · Estrictas ×1.06 · Espejo/Aleatorio ×1.00 · Auto sin puntaje.