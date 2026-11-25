// BeatWave · arma la carpeta www/ solo con lo que necesita el juego.
// Uso:  node tools/copy-www.js
// Sube www/ a Netlify, o úsala como carpeta web de Capacitor (APK).
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..'), out = path.join(root, 'www');
const files = ['index.html', 'styles.css', 'script.js', 'sw.js', 'manifest.webmanifest', '_headers', 'icon-192.png', 'icon-512.png', 'icon-maskable-512.png', 'rocket.mp3'];
const dirs = ['assets', 'fonts'];
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });
for (const f of files) {
  const s = path.join(root, f);
  if (fs.existsSync(s)) fs.copyFileSync(s, path.join(out, f));
  else console.log('(no está, se omite)', f);
}
for (const d of dirs) {
  const s = path.join(root, d);
  if (fs.existsSync(s)) fs.cpSync(s, path.join(out, d), { recursive: true });
}
// Opcional: si tienes esbuild (npm i -D esbuild), se minifican los archivos para que la app cargue más rápido.
let esb = null; try { esb = require('esbuild'); } catch (e) {}
if (esb) {
  for (const [f, loader] of [['script.js', 'js'], ['cloud.js', 'js'], ['sw.js', 'js'], ['styles.css', 'css']]) {
    const p = path.join(out, f); if (!fs.existsSync(p)) continue;
    try { fs.writeFileSync(p, esb.transformSync(fs.readFileSync(p, 'utf8'), { minify: true, loader, target: 'es2020' }).code); } catch (e) { console.log('(no se minificó)', f, e.message.split('\n')[0]); }
  }
  console.log('Archivos minificados.');
} else console.log('(opcional) npm i -D esbuild  →  la app carga más rápido');
console.log('Listo: carpeta www/ creada.');