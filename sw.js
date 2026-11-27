// BeatWave · service worker: funciona sin internet (caché primero, se actualiza en segundo plano)
const C = 'bw-v31';
const ASSETS = ['./', 'index.html', 'styles.css', 'script.js', 'manifest.webmanifest', 'rocket.mp3', 'icon-192.png', 'icon-512.png', 'icon-maskable-512.png',
  'assets/themes/menta.png', 'assets/sfx/tap.wav', 'assets/sfx/miss.wav', 'assets/sfx/combo.wav'];
const FONT_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com'];
const filling = new Set();
self.addEventListener('install', e => e.waitUntil(
  caches.open(C).then(c => Promise.all(ASSETS.map(a => c.add(new Request(a, { cache: 'reload' })).catch(() => {})))).then(() => self.skipWaiting())));
self.addEventListener('activate', e => e.waitUntil(
  caches.keys().then(ks => Promise.all(ks.filter(k => k !== C && k !== 'bw-meta').map(k => caches.delete(k)))).then(() => self.clients.claim())));
// Videos y audio piden «rangos»: se sirven desde la copia guardada; si no existe, se descarga completa en segundo plano.
async function ranged(r, e) {
  const c = await caches.open(C), hit = await c.match(r.url);
  if (!hit) {
    if (!filling.has(r.url)) { filling.add(r.url); e.waitUntil(fetch(r.url).then(async res => { const n = +res.headers.get('content-length') || 0; if (res.ok && res.status === 200 && n < 200e6) await c.put(r.url, res); }).catch(() => {}).finally(() => filling.delete(r.url))); }
    return fetch(r);
  }
  const buf = await hit.arrayBuffer(), m = /bytes=(\d*)-(\d*)/.exec(r.headers.get('range') || ''), len = buf.byteLength;
  let s = 0, en = len - 1; if (m) { if (m[1] === '') { s = Math.max(0, len - +m[2]); } else { s = +m[1]; if (m[2] !== '') en = Math.min(len - 1, +m[2]); } }
  return new Response(buf.slice(s, en + 1), { status: 206, headers: { 'Content-Type': hit.headers.get('Content-Type') || 'video/mp4', 'Content-Range': `bytes ${s}-${en}/${len}`, 'Content-Length': String(en - s + 1), 'Accept-Ranges': 'bytes' } });
}
self.addEventListener('fetch', e => {
  const r = e.request, u = new URL(r.url), font = FONT_HOSTS.includes(u.hostname);
  if (u.hostname === 'localhost' || u.hostname === '127.0.0.1') return; // en tu PC (Live Server) siempre carga lo más nuevo
  if (r.method !== 'GET' || (u.origin !== location.origin && !font)) return;
  if (r.headers.has('range')) { e.respondWith(ranged(r, e)); return; }
  e.respondWith(caches.match(r, { ignoreSearch: !font }).then(hit => {
    const net = fetch(r).then(res => { if ((res.ok && res.status === 200) || (font && res.type === 'opaque')) { const cp = res.clone(); caches.open(C).then(c => c.put(r, cp)).catch(() => {}); } return res; });
    if (hit) { net.catch(() => {}); return hit; }
    return net.catch(() => r.mode === 'navigate' ? caches.match('index.html') : Response.error());
  }));
});
// ---- Avisos del teléfono ----
self.addEventListener('notificationclick', e => { e.notification.close(); e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(cs => cs.length ? cs[0].focus() : self.clients.openWindow('./'))); });
self.addEventListener('periodicsync', e => { if (e.tag !== 'bw-mission') return; e.waitUntil((async () => {
  const c = await caches.open('bw-meta'), r = await c.match('/_mission'); if (!r) return; const d = await r.json();
  if (d.on !== false && d.nextAt && !d.notified && Date.now() >= d.nextAt) { await self.registration.showNotification('¡Nueva misión disponible!', { body: 'Ya puedes jugar tu próxima misión de BeatWave.', icon: 'icon-192.png', badge: 'icon-192.png', tag: 'bw-mis' }); d.notified = 1; await c.put('/_mission', new Response(JSON.stringify(d))); }
})()); });