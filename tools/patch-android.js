// BeatWave · ajusta el proyecto Android que crea Capacitor.
// Uso (después de `npx cap add android`):  node tools/patch-android.js
const fs = require('fs'), path = require('path');
const root = process.env.BW_ROOT || path.join(__dirname, '..');
const cfg = JSON.parse(fs.readFileSync(path.join(root, 'capacitor.config.json'), 'utf8'));
const pkgDir = path.join(root, 'android', 'app', 'src', 'main', 'java', ...cfg.appId.split('.'));
const manifest = path.join(root, 'android', 'app', 'src', 'main', 'AndroidManifest.xml');
// 1) MainActivity propio
fs.mkdirSync(pkgDir, { recursive: true });
fs.copyFileSync(path.join(root, 'android-extra', 'MainActivity.java'), path.join(pkgDir, 'MainActivity.java'));
console.log('MainActivity.java copiado a', path.relative(root, pkgDir));
// 2) Permisos y opciones del manifiesto
let x = fs.readFileSync(manifest, 'utf8');
if (!x.includes('android.permission.VIBRATE')) x = x.replace('</manifest>', '    <uses-permission android:name="android.permission.VIBRATE" />\n</manifest>');
for (const p of ['POST_NOTIFICATIONS', 'RECEIVE_BOOT_COMPLETED', 'READ_MEDIA_AUDIO', 'READ_MEDIA_VIDEO', 'READ_MEDIA_IMAGES']) if (!x.includes('android.permission.' + p)) x = x.replace('</manifest>', `    <uses-permission android:name="android.permission.${p}" />\n</manifest>`); // avisos de misiones
if (!x.includes('READ_EXTERNAL_STORAGE')) x = x.replace('</manifest>', '    <uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE" android:maxSdkVersion="32" />\n</manifest>'); // elegir música/videos de la galería
for (const p of ['SCHEDULE_EXACT_ALARM', 'ACCESS_NETWORK_STATE', 'INTERNET', 'com.google.android.gms.permission.AD_ID']) { const n = p.includes('.') ? p : 'android.permission.' + p; if (!x.includes(n)) x = x.replace('</manifest>', `    <uses-permission android:name=\"${n}\" />\n</manifest>`); } // alarmas exactas (aviso de misión) y anuncios
// AdMob: ID de la APP. Este es el ID de PRUEBA de Google; cámbialo por el tuyo (variable BW_ADMOB_APP_ID) cuando tengas tu cuenta de AdMob.
const admobId = process.env.BW_ADMOB_APP_ID || 'ca-app-pub-3940256099942544~3347511713';
if (!x.includes('com.google.android.gms.ads.APPLICATION_ID')) x = x.replace('</application>', `    <meta-data android:name=\"com.google.android.gms.ads.APPLICATION_ID\" android:value=\"${admobId}\" />\n    </application>`);
if (!x.includes('android:allowBackup')) x = x.replace('<application', '<application android:allowBackup="false"');
fs.writeFileSync(manifest, x);
console.log('AndroidManifest.xml listo (vibración, sin copias de seguridad).');