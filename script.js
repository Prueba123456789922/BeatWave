// Escribir en localStorage sin romper nada si el espacio se llena (borra primero la caché de mapas, que se puede rehacer).
function evictCaches() { const ks = []; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && k.startsWith('bwmap8:')) ks.push(k); } ks.forEach(k => localStorage.removeItem(k)); }
function lsSet(k, v) { try { Storage.prototype.setItem.call(localStorage, k, v); return true; } catch (e) { try { evictCaches(); Storage.prototype.setItem.call(localStorage, k, v); return true; } catch (e2) { return false; } } }
// Migración de nombres antiguos (tb* / taikobeat) a los nuevos (bw* / beatwave): se copia una sola vez y no se pierde nada.
(function () { try { if (localStorage.getItem('bwmig')) return; const ks = []; for (let i = 0; i < localStorage.length; i++) ks.push(localStorage.key(i));
  const OLD = /^tb(tutNo|tut|rec|sstamp|fav|pls|hide|last|catids|streak|view|sync|scorev|hist|ach|mis|stats|pend|xp|name)$|^tbmap8:/;
  for (const k of ks) { const nk = k === 'taikobeat2' ? 'bwsettings' : OLD.test(k) ? 'bw' + k.slice(2) : null; if (!nk) continue; if (localStorage.getItem(nk) === null) { try { lsSet(nk, localStorage.getItem(k)); } catch (e) { continue; } } localStorage.removeItem(k); }
  lsSet('bwmig', '1'); } catch (e) {} })();
'use strict';
/* =========================================================
   BEATWAVE v1.2.1 — gameplay 3 carriles
   Fixes v1.2.1:
   · Tarjeta de canción con diseño inclinado (clip-path)
   · Sonido de toque estilo osu! (ruido blanco filtrado)
   · Sin countdown al iniciar la canción (t0 = currentTime + 2)
   ========================================================= */
const errBox = document.createElement('pre');
errBox.style.cssText = 'position:fixed;left:0;right:0;bottom:0;z-index:99;margin:0;padding:8px;background:#400;color:#fff;font:12px monospace;white-space:pre-wrap;display:none;max-height:40vh;overflow:auto';
errBox.onclick = () => { errBox.style.display = 'none'; errBox.textContent = ''; }; document.body.append(errBox);
const showErr = t => console.debug(t);
addEventListener('error', e => showErr(`${e.message} (${(e.filename || '').split('/').pop()}:${e.lineno})`));
addEventListener('unhandledrejection', e => showErr('Promesa: ' + (e.reason && e.reason.message || e.reason)));
if (!CanvasRenderingContext2D.prototype.roundRect) CanvasRenderingContext2D.prototype.roundRect = function (x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2); this.moveTo(x + r, y); this.arcTo(x + w, y, x + w, y + h, r); this.arcTo(x + w, y + h, x, y + h, r); this.arcTo(x, y + h, x, y, r); this.arcTo(x, y, x + w, y, r); this.closePath();
};
const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];

const NATIVE = !!(window.Capacitor && Capacitor.isNativePlatform && Capacitor.isNativePlatform());
const HW_LOW = NATIVE || (navigator.deviceMemory || 4) <= 3 || (navigator.hardwareConcurrency || 8) <= 4; // en la app Android se empieza ligero; puedes subir la calidad en Ajustes → Gráficos
let LOW = HW_LOW, loadedAll = false, menuSkip = 0, lowSec = 0, vzCol = null, vzColT = 0;

const S = Object.assign({
  speed: 1, lang: 'es', latency: 0, autoSync: true, sfx: .6, video: true, cover: true, diff: 0, size: 64, qual: 0,
  vib: false, skin: 0, lnLen: 1, mods: {}, vm: 1, vmu: 1, dim: .35, hud: 1, laneA: 1, ringA: 1, perf: 0, autoLite: false, cb: false, uis: 1, country: '',
  bgImage: null, accent: 0, pauseSize: 56, pausePos: 'pause-top-right',
  theme: 'menta', n3d: true, vmode: 'auto', vpos: 50
}, JSON.parse(localStorage.getItem('bwsettings') || '{}'));

const SKINS = [['#00E5FF', '#B388FF'], ['#FF6B35', '#FFD166'], ['#2EE59D', '#00B8D9'], ['#FF4D8D', '#B388FF'], ['#19D97B', '#19D97B'], ['#FFD166', '#FF8A3D'], ['#7CFFB2', '#4DA3FF'], ['#FFFFFF', '#B0B0B0']];
const ACCENTS = [['#00E5FF', '#B388FF'], ['#FF6B35', '#FFD166'], ['#2EE59D', '#00B8D9'], ['#FF4D8D', '#B388FF'], ['#FFD166', '#FF8A3D'], ['#7CFFB2', '#4DA3FF']];
const LANES = 3, COL = ['#00E5FF', '#B388FF', '#00E5FF'], KEYS = { f: 0, ' ': 1, j: 2 };
const WIN = { perf: .06, great: .12, good: .18 };
const DIFF = [{ lv: 0, s: 3, gap: .5, ln: 3, fl: 6, sl: 1, ch: 0, st: 99, sg: .5 }, { lv: 1, s: 2.2, gap: .34, ln: 3, fl: 4, sl: 1, ch: 6, st: 3, sg: .2 }, { lv: 2, s: 0, gap: .2, ln: 2, fl: 3, sl: 1, ch: 4.5, st: 2.4, sg: .15 }, { lv: 3, s: 0, gap: .15, ln: 2, fl: 3, sl: 1, ch: 3.8, st: 1.8, sg: .11 }];
const isLT = () => S.skin === 4 && !S.skinC;
function applySkin() { const k = S.skinC || SKINS[S.skin] || SKINS[0]; COL[0] = COL[2] = k[0]; COL[1] = k[1]; if (S.cb) { COL[0] = COL[2] = '#56B4E9'; COL[1] = '#F0A30A'; } }
const lite2 = () => S.perf === 1 || S.perf === 3 || (S.perf !== 2 && !!S.autoLite);
const minTier = () => S.perf === 3 || (S.perf === 0 && !!S.autoMin); // «Mínimo»: para equipos muy lentos
if (NATIVE && (S.perfInit || 0) < 3) { S.perfInit = 3; if (S.perf === 2 || !S.perf) { S.perf = 0; S.autoLite = true; } try { localStorage.setItem('bwsettings', JSON.stringify(S)); } catch (e) {} }
function applyPerf() { LOW = S.perf === 1 || S.perf === 3 || (S.perf !== 2 && (HW_LOW || !!S.autoLite)); const h = document.documentElement.classList; h.toggle('lite', LOW); h.toggle('lite2', lite2()); h.toggle('lite3', minTier()); h.toggle('nofx', NATIVE || LOW); }
function applyUis() { document.documentElement.style.fontSize = Math.round((S.uis || 1) * 100) + '%'; }
function perfWatch(f, el) { if (!loadedAll || S.perf !== 0 || S.autoLite || document.hidden || el > 1500) { lowSec = 0; return; } lowSec = f < 20 ? lowSec + 1 : 0; if (lowSec >= 5) { S.autoLite = true; saveSettings(); applyPerf(); msg('Modo ahorro activado para que todo vaya más fluido. Puedes cambiarlo en Ajustes → Gráficos.'); } }
function applyAccent() {
  const a = S.accentC || ACCENTS[S.accent] || ACCENTS[0];
  document.documentElement.style.setProperty('--accent', a[0]);
  document.documentElement.style.setProperty('--accent2', a[1]);
}
function applyPauseUI() {
  document.documentElement.style.setProperty('--pause-size', S.pauseSize + 'px');
  const w = $('#pauseWrap'); if (!w) return;
  w.className = '';
  w.classList.add(S.pausePos || 'pause-top-right');
}
let WELCOME = true, OUT, MUS, TUT = null, LTm = 0, ctx, songs = [], sel = null, PICKED = false, SELM = false, SELS = new Set(), G = null, raf = 0, booted = false;

const fade = $('#fade'); let goT = 0;
const applyVol = () => { if (OUT) { OUT.gain.value = S.vm; MUS.gain.value = S.vmu; } };
const idle = () => $('#menu').classList.contains('active') || $('#select').classList.contains('active');
const go = id => { if (SELM && id !== 'select') setSelMode(false); try { Ads.banner(id !== 'game' && id !== 'welcome'); } catch (e) {} fade.classList.add('on'); clearTimeout(goT); goT = setTimeout(() => { $$('.screen').forEach(e => e.classList.toggle('active', e.id === id)); if (id === 'select' || id === 'menu') { preview(sel); muffle(false); } if (id === 'menu') { setMenu(false); if (!menuRaf) menuRaf = requestAnimationFrame(menuFrame); } fade.classList.remove('on'); }, 170); };
$$('[data-go]').forEach(b => b.onclick = () => { if (G) stop(); go(b.dataset.go); });

/* ---------- Audio ---------- */
function init() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    try { ctx = new AC({ latencyHint: LOW ? 'balanced' : 'interactive' }); } catch (e) { ctx = new AC(); }
    OUT = ctx.createGain(); OUT.connect(ctx.destination); MUS = ctx.createGain(); MUS.connect(OUT); applyVol();
    (window.requestIdleCallback ? f => requestIdleCallback(f, { timeout: 3000 }) : f => setTimeout(f, 1500))(() => { try { TUT = TUT || makeTutorial(); showPin(); } catch (e) { showErr('Tutorial: ' + e.message); } });
  }
  if (ctx.state !== 'running' && !(G && G.paused)) try { const p = ctx.resume(); if (p && p.catch) p.catch(() => {}); } catch (e) {}
  loadSfxWav();
  if (!booted) { booted = true; bootLoad(); }
}
['pointerdown', 'touchend', 'keydown'].forEach(e => addEventListener(e, init, { passive: true }));
const SFXB = {}; let master;
const SFXW = {}; let sfxLoading = false;
async function loadSfxWav() { if (sfxLoading || !ctx) return; sfxLoading = true; for (const n of ['tap', 'miss', 'combo', 'click']) { try { const r = await fetch(`assets/sfx/${n}.wav`); if (!r.ok) continue; SFXW[n] = await ctx.decodeAudioData(await r.arrayBuffer()); } catch (e) {} } }
function playWav(n, rate = 1, vol = 1) { const b = SFXW[n]; if (!b || S.sfx < .01) return false; if (!master) { master = ctx.createGain(); master.connect(OUT); } const s = ctx.createBufferSource(), g = ctx.createGain(); s.buffer = b; s.playbackRate.value = rate; g.gain.value = Math.min(1.5, S.sfx * vol * 1.4); s.connect(g); g.connect(master); s.start(); return true; }
// Efecto «whoosh» al terminar la canción (se genera con el audio del propio juego: no necesita archivos)
function whoosh(fail) {
  if (!ctx || S.sfx < .01) return; if (!master) { master = ctx.createGain(); master.connect(OUT); }
  const t = ctx.currentTime, dur = .9, n = Math.floor(ctx.sampleRate * dur), buf = ctx.createBuffer(1, n, ctx.sampleRate), d = buf.getChannelData(0); let lp = 0;
  for (let i = 0; i < n; i++) { lp += (Math.random() * 2 - 1 - lp) * .5; d[i] = lp; } // ruido suave
  const src = ctx.createBufferSource(); src.buffer = buf; const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 1.3;
  const f0 = fail ? 2200 : 350, f1 = fail ? 300 : 3000; bp.frequency.setValueAtTime(f0, t); bp.frequency.exponentialRampToValueAtTime(f1, t + dur);
  const g = ctx.createGain(); g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(Math.max(.02, .9 * S.sfx), t + dur * .38); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
  src.connect(bp); bp.connect(g); g.connect(master); src.start(t); src.stop(t + dur + .05);
}
// ★ SONIDO ESTILO OSU!
function sfx(f) {
  if (S.sfx < .01 || S.tapSnd === false || (G && G.paused)) return;
  if (playWav('tap', Math.max(.75, Math.min(1.5, f / 900)))) return;
  if (!master) { master = ctx.createGain(); master.connect(OUT); }
  
  if (!SFXB.osu) {
    const n = ctx.sampleRate * .08 | 0;
    const b = ctx.createBuffer(1, n, ctx.sampleRate);
    const d = b.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    SFXB.osu = b;
  }
  
  const src = ctx.createBufferSource();
  src.buffer = SFXB.osu;
  
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = f;
  bp.Q.value = 1.2;
  
  const env = ctx.createGain();
  env.gain.setValueAtTime(S.sfx * .6, ctx.currentTime);
  env.gain.exponentialRampToValueAtTime(.01, ctx.currentTime + .05);
  
  src.connect(bp).connect(env).connect(master);
  src.start();
}
const CJK = /[\u3040-\u30ff\u3400-\u9fff\uf900-\ufaff\uac00-\ud7af]/;
function id3(ab) {
  const u = new Uint8Array(ab), d = new DataView(ab), r = {}; if (u.length < 10 || String.fromCharCode(u[0], u[1], u[2]) !== 'ID3') return r;
  const v = u[3], ss = o => (u[o] & 127) << 21 | (u[o + 1] & 127) << 14 | (u[o + 2] & 127) << 7 | u[o + 3] & 127, hl = v === 2 ? 6 : 10;
  let o = 10; const end = Math.min(u.length, 10 + ss(6)); if (u[5] & 64 && v >= 3) o += v === 4 ? ss(10) : d.getUint32(10) + 4;
  const td = (b, enc) => new TextDecoder(enc === 3 ? 'utf-8' : enc === 2 ? 'utf-16be' : enc === 1 ? (b[0] === 0xFE && b[1] === 0xFF ? 'utf-16be' : 'utf-16le') : 'iso-8859-1').decode(b).replace(/\0/g, '').replace(/^\uFEFF/, '');
  while (o + hl < end) {
    const id = String.fromCharCode(...u.slice(o, o + (v === 2 ? 3 : 4))); if (!/^[A-Z0-9]+$/.test(id)) break;
    const sz = v === 2 ? u[o + 3] << 16 | u[o + 4] << 8 | u[o + 5] : v === 4 ? ss(o + 4) : d.getUint32(o + 4), fl = v >= 3 ? d.getUint16(o + 8) : 0; if (!sz) break;
    let b = u.slice(o + hl, o + hl + sz); if (v === 4 && fl & 1) b = b.slice(4); if ((v === 4 && fl & 2) || (v < 4 && u[5] & 128)) b = b.filter((x, i, a) => !(x === 0 && a[i - 1] === 255));
    const enc = b[0];
    if (id === 'TIT2' || id === 'TT2') r.title = td(b.slice(1), enc);
    if (id === 'TPE1' || id === 'TP1') r.artist = td(b.slice(1), enc);
    if (id === 'TALB' || id === 'TAL') r.album = td(b.slice(1), enc);
    if (id === 'TXXX') { try { const body = td(b.slice(1), enc); const [k, v2] = body.split('\0'); if (k && /title/i.test(k) && v2 && !r.title) r.title = v2; } catch (e) {} }
    if (id === 'APIC' || id === 'PIC') {
      let p = 1; if (id === 'PIC') p += 3; else while (p < b.length && b[p++]); p++;
      if (enc === 1 || enc === 2) { while (p < b.length && (b[p] || b[p + 1])) p += 2; p += 2; } else while (p < b.length && b[p++]);
      const by = b.slice(p); if (by.length > 100) { r.coverBlob = new Blob([by], { type: by[0] === 0x89 ? 'image/png' : 'image/jpeg' }); r.cover = URL.createObjectURL(r.coverBlob); }
    }
    o += hl + sz;
  }
  return r;
}
function mp4cover(ab) {
  const u = new Uint8Array(ab, 0, Math.min(ab.byteLength, 4e6)), dv = new DataView(ab);
  for (let i = 4; i < u.length - 24; i++) if (u[i] === 99 && u[i + 1] === 111 && u[i + 2] === 118 && u[i + 3] === 114 && String.fromCharCode(u[i + 8], u[i + 9], u[i + 10], u[i + 11]) === 'data') {
    const by = new Uint8Array(ab, i + 20, dv.getUint32(i + 4) - 16); return new Blob([by], { type: by[0] === 0x89 ? 'image/png' : 'image/jpeg' });
  }
  return null;
}
function videoFrame(file) {
  return new Promise(res => {
    const v = document.createElement('video'), u = URL.createObjectURL(file), done = b => { URL.revokeObjectURL(u); res(b); };
    v.muted = true; v.preload = 'auto'; v.src = u; v.onloadeddata = () => { v.currentTime = Math.min(1, (v.duration || 2) / 2); };
    v.onseeked = () => { const c2 = document.createElement('canvas'); c2.width = c2.height = 320; const g = c2.getContext('2d'), s = Math.min(v.videoWidth, v.videoHeight); g.drawImage(v, (v.videoWidth - s) / 2, (v.videoHeight - s) / 2, s, s, 0, 0, 320, 320); c2.toBlob(done, 'image/jpeg', .85); };
    v.onerror = () => done(null); setTimeout(() => done(null), 4000);
  });
}
async function fillCover(ab, tag, v) {
  if (!tag.cover) { try { const cb = mp4cover(ab); if (cb) { tag.coverBlob = cb; tag.cover = URL.createObjectURL(cb); } } catch (e) {} }
  if (!tag.cover && v) { const fb = await videoFrame(v); if (fb) { tag.coverBlob = fb; tag.cover = URL.createObjectURL(fb); } }
}
function pickTitle(cands, fileBase) {
  const clean = v => (v == null ? null : String(v).trim());
  const all = cands.map(clean).filter(Boolean);
  if (!all.length) return fileBase;
  const fileIsCJK = CJK.test(fileBase);
  const nonCJK = all.filter(c => !CJK.test(c));
  if (!fileIsCJK && nonCJK.length) return nonCJK[0];
  return all[0];
}

let PV = { src: null, gain: null, song: null };
function stopPreview() { if (PV.src) { try { PV.gain.gain.setTargetAtTime(0, ctx.currentTime, .1); PV.src.stop(ctx.currentTime + .4); } catch (e) {} } PV = { src: null, gain: null, song: null }; }
function muffle(on) { if (PV.lp) PV.lp.frequency.setTargetAtTime(on ? 900 : 20000, ctx.currentTime, .25); }
function previewOff(s) { // empieza en el tramo más intenso de la canción
  const b = s.buf, d = b.duration, def = Math.min(d * .3, Math.max(0, d - 32)), en = s.map && s.map.en; if (!en || en.length < 400 || d < 45) return def;
  if (s._po !== undefined) return s._po; const W = 250; let sum = 0, best = -1, bi = 0;
  for (let i = 0; i < en.length; i++) { sum += en[i] || 0; if (i >= W) sum -= en[i - W] || 0; if (i >= W - 1 && sum > best) { best = sum; bi = i - W + 1; } }
  return s._po = Math.max(0, Math.min(d - 32, bi / 10 - 1.5));
}
function preview(s, force) {
  if (!ctx || !s || s.tut || (G && !force) || S.prev === false || (PV.song === s && PV.src)) return;
  if (ctx.state !== 'running') { try { ctx.resume(); } catch (e) {} }
  if (s.buf._stub) { // el audio aún no está decodificado: se calla la anterior y se carga ésta (con un reintento)
    stopPreview(); const go2 = () => { if (sel === s && idle() && !G) preview(s); };
    ensureBuf(s).then(go2).catch(() => { s._dec = null; ensureBuf(s).then(go2).catch(() => { if (sel === s) msg('No se pudo cargar el audio de esta canción.'); }); }); return;
  }
  stopPreview();
  const b = s.buf, off = previewOff(s), src = ctx.createBufferSource(), g = ctx.createGain();
  src.buffer = b; src.loop = true; src.loopStart = off; src.loopEnd = Math.min(b.duration, off + 30); g.gain.value = 0; g.gain.setTargetAtTime(.5, ctx.currentTime, .3);
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 20000; src.connect(lp).connect(g).connect(MUS); src.start(0, off); PV = { src, gain: g, lp, song: s, off, t0: ctx.currentTime, len: Math.max(1, src.loopEnd - off) };
}
async function loadBundled() {
  $('#nowPlaying').textContent = 'Cargando canciones…';
  let list = [], n = 0;
  try { const r = await fetch('songs/index.json'); if (r.ok) list = await r.json(); } catch (e) {}
  if (!list.length) list = [{ id: 'rocket', file: 'rocket.mp3', title: "This Isn't Science Rocket (2015 Edition)", artist: 'Prueba de sincronía', root: true }];
  await Promise.all(list.map(async s => {
    try {
      const ab = await (await fetch(s.root ? s.file : 'songs/' + s.file)).arrayBuffer(); let tag = {}; try { tag = id3(ab); } catch (e) {} await fillCover(ab, tag);
      const buf = await ctx.decodeAudioData(ab.slice(0)), id = s.id || s.file;
      addSong({ id, title: s.title || tag.title || s.file, artist: s.artist || tag.artist || '', cover: s.cover ? 'songs/' + s.cover : tag.cover, video: s.video ? 'songs/' + s.video : undefined, buf, bundled: true, map: await getMap(buf, id + '|' + buf.length) }); n++;
    } catch (e) {}
  }));
  if (!n) $('#nowPlaying').textContent = 'Importa una canción para empezar';
}
async function getMap(buf, key, nocache) {
  key = 'bwmap8:' + key;
  if (!nocache) {
    try { const m = await DB.mapGet(key); if (m && m.peaks) return m; } catch (e) {}
    try { const m = JSON.parse(localStorage.getItem(key)); if (m && m.peaks) { DB.mapPut(key, m).then(() => localStorage.removeItem(key)).catch(() => {}); return m; } } catch (e) {} // caché vieja: se pasa a IndexedDB
  }
  const m = await analyze(buf, f => { $('#nowPlaying').textContent = `Analizando audio… ${f * 100 | 0}%`; });
  if (!nocache) DB.mapPut(key, m).catch(() => {});
  return m;
}
// Libera localStorage: pasa los mapas guardados allí a IndexedDB (una sola vez, cuando el navegador está libre).
function moveMapCaches() { const ks = []; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && k.startsWith('bwmap8:')) ks.push(k); } (async () => { for (const k of ks) { try { const m = JSON.parse(localStorage.getItem(k)); if (m && m.peaks) await DB.mapPut(k, m); localStorage.removeItem(k); } catch (e) {} } })(); }
let addT = 0;
function addSong(s) { s.hue = s.hue ?? Math.random() * 360 | 0; if (s.cover) { s.img = new Image(); s.img.src = s.cover; } songs.push(s); if (!sel || !PICKED) sel = s; clearTimeout(addT); addT = setTimeout(() => { renderList(); info(); if (idle()) { preview(sel); muffle(false); } }, 60); } // se dibuja una sola vez por lote
async function bootLoad() {
  await Promise.all([loadBundled().catch(() => {}), loadLibrary().catch(() => {})]);
  songs.sort((a, b) => (b.bundled ? 1 : 0) - (a.bundled ? 1 : 0)); loadedAll = true; (window.requestIdleCallback || setTimeout)(moveMapCaches);
  renderPls(); if (!PICKED || !vis().includes(sel)) sel = vis()[0] || sel; renderList(); info(); if (idle()) { preview(sel); muffle(false); }
}
// Canciones guardadas: el audio vive aparte y se decodifica solo cuando hace falta (arranque rápido).
function lazySong(o, dur) { const s = { ...o, lazy: true, dur }; let real = null; Object.defineProperty(s, 'buf', { get: () => real || { duration: dur, length: 0, _stub: true }, set: v => { real = v; }, configurable: true, enumerable: true }); return s; }
async function ensureBuf(s) {
  if (!s || !s.buf || !s.buf._stub) return s && s.buf;
  if (!s._dec) s._dec = (async () => { const a = await DB.audioGet(s.id); if (!a || !a.ab) throw new Error('Audio no encontrado'); const buf = await ctx.decodeAudioData(a.ab.slice(0)); s.buf = buf; s.lazy = false; return buf; })().catch(e => { s._dec = null; throw e; });
  return s._dec;
}

/* ---------- Análisis de audio ---------- */
function analyzeCore(x, sr, dur, prog) {
  const hop = sr > 30000 ? 512 : 256, win = hop * 2, N = (x.length - win) / hop | 0, fps = sr / hop;
  const E0 = new Float32Array(N), E1 = new Float32Array(N), E2 = new Float32Array(N), E3 = new Float32Array(N), Eb = [E0, E1, E2, E3];
  const al = f => 1 - Math.exp(-2 * Math.PI * f / sr), a1 = al(200), a2 = al(1000), a3 = al(4000);
  for (let i = 0, y1 = 0, y2 = 0, y3 = 0; i < x.length; i++) {
    const v = x[i]; y1 += a1 * (v - y1); y2 += a2 * (v - y2); y3 += a3 * (v - y3);
    const d1 = y2 - y1, d2 = y3 - y2, d3 = v - y3, q0 = y1 * y1, q1 = d1 * d1, q2 = d2 * d2, q3 = d3 * d3, k = i / hop | 0;
    if (k < N) { E0[k] += q0; E1[k] += q1; E2[k] += q2; E3[k] += q3; }
    if (k > 0 && k - 1 < N) { E0[k - 1] += q0; E1[k - 1] += q1; E2[k - 1] += q2; E3[k - 1] += q3; }
    if ((i & 0x3FFFF) === 0) prog(i / x.length * .5);
  }
  for (let k = 0; k < N; k++) for (let b = 0; b < 4; b++) Eb[b][k] = Math.sqrt(Eb[b][k] / win);
  const env = new Float32Array(N); for (let k = 0; k < N; k++) env[k] = E0[k] + E1[k] + E2[k] + E3[k];
  const flux = e => { const f = new Float32Array(N); let m = 0; for (let k = 1; k < N; k++) { f[k] = Math.max(0, e[k] - e[k - 1]); m += f[k]; } m /= N || 1; for (let k = 0; k < N; k++) f[k] /= (m || 1); return f; };
  const F = Eb.map(flux), WT = [1, 1, .9, .8], cmb = new Float32Array(N);
  for (let k = 0; k < N; k++) cmb[k] = F[0][k] * WT[0] + F[1][k] * WT[1] + F[2][k] * WT[2] + F[3][k] * WT[3];
  const en = []; for (let s = 0; s < dur * 10; s++) { let m = 0, q = 0; for (let k = (s / 10 * fps) | 0, e = Math.min(N, ((s + 1) / 10 * fps) | 0); k < e; k++) { m += env[k]; q++; } en.push(q ? m / q : 0); }
  let mx = 0; for (const v of en) if (v > mx) mx = v; mx = mx || 1; for (let s = 0; s < en.length; s++) en[s] = +(en[s] / mx).toFixed(2);
  const sec = []; for (let s = 0; s * 40 < en.length; s++) { let m = 0, q = 0; for (let i = s * 40; i < Math.min(en.length, s * 40 + 40); i++) { m += en[i]; q++; } sec.push(q ? m / q : 0); }
  const med = [...sec].sort((a, b) => a - b)[sec.length >> 1] || 1; for (let s = 0; s < sec.length; s++) sec[s] = +(sec[s] / med).toFixed(2);
  const sc = (bpm, k0, k1) => { const p = fps * 60 / bpm; let b = { s: 0, ph: 0 }; for (let ph = 0; ph < p; ph++) { let s = 0, n = 0; for (let f = k0 + ph; f < k1 - 1; f += p) { s += cmb[f + .5 | 0]; n++; } if (n && s / n > b.s) b = { s: s / n, ph }; } return b; };
  let bb = { s: 0, bpm: 120, ph: 0 };
  for (let b = 80; b <= 170; b += .5) { const r = sc(b, 0, N); if (r.s > bb.s) bb = { ...r, bpm: b }; }
  prog(.7); for (let b = bb.bpm - .5; b <= bb.bpm + .5; b += .02) { const r = sc(b, 0, N); if (r.s > bb.s) bb = { ...r, bpm: b }; }
  const bt = [], seg = 8 * fps | 0;
  for (let k0 = 0; k0 < N; k0 += seg) { let best = { s: -1, bpm: bb.bpm }; for (let d = -.06; d <= .06; d += .005) { const bpm = bb.bpm * (1 + d), r = sc(bpm, k0, Math.min(N, k0 + seg)); if (r.s > best.s) best = { s: r.s, bpm }; } bt.push(+best.bpm.toFixed(2)); }
  const peaks = [], weak = [];
  for (let k = 2, last = -1, lastW = -1; k < N - 2; k++) {
    if (k % 1500 === 0) prog(.8 + k / N * .2);
    let m = 0, n = 0; for (let j = Math.max(0, k - 40); j < Math.min(N, k + 40); j++) { m += cmb[j]; n++; } m /= n;
    let j0 = k; const th = cmb[k] * .4; while (j0 > 1 && k - j0 < 8 && cmb[j0 - 1] > th) j0--;
    const fr = cmb[j0] > th ? (cmb[j0] - th) / ((cmb[j0] - cmb[j0 - 1]) || 1) : 0, t = ((j0 - fr) * hop + win * .75) / sr + .0015;
    if (cmb[k] > cmb[k - 1] && cmb[k] >= cmb[k + 1] && cmb[k] > m * 1.6 + .5 && t - last > .12) {
      const ref = Math.max(env[k], env[k + 1], env[k + 2]); let e = k + 2; while (e < N && env[e] > ref * .72 && e - k < 300) e++;
      let bd = 0, bv = -1; for (let b = 0; b < 4; b++) if (F[b][k] * WT[b] > bv) { bv = F[b][k] * WT[b]; bd = b; }
      peaks.push({ t: +t.toFixed(3), s: +(cmb[k] / (m || 1)).toFixed(2), bd, d: +((e - k) * hop / sr).toFixed(2) }); last = t;
    } else if (cmb[k] > cmb[k - 1] && cmb[k] >= cmb[k + 1] && cmb[k] > m * 1.02 + .1 && t - lastW > .1) {
      const ref = Math.max(env[k], env[k + 1], env[k + 2]); let e = k + 2; while (e < N && env[e] > ref * .72 && e - k < 300) e++;
      let bd = 0, bv = -1; for (let b = 0; b < 4; b++) if (F[b][k] * WT[b] > bv) { bv = F[b][k] * WT[b]; bd = b; }
      weak.push({ t: +t.toFixed(3), s: +(cmb[k] / (m || 1)).toFixed(2), bd, d: +((e - k) * hop / sr).toFixed(2) }); lastW = t;
    }
  }
  const weakF = weak.filter(w => !peaks.some(p => Math.abs(p.t - w.t) < .09));
  return { peaks, weak: weakF, en, sec, bt, bpm: +bb.bpm.toFixed(2), beat0: +((bb.ph * hop + win * .75) / sr).toFixed(3) };
}
function analyze(buf, prog = () => {}) {
  const x = buf.getChannelData(0), sr = buf.sampleRate, dur = buf.duration;
  return new Promise(res => {
    let w; try { w = new Worker(URL.createObjectURL(new Blob([`const AN=${analyzeCore.toString()};onmessage=e=>{const d=e.data;postMessage({r:AN(d.x,d.sr,d.dur,p=>postMessage({p}))})}`], { type: 'text/javascript' }))); }
    catch (e) { return res(analyzeCore(x, sr, dur, prog)); }
    w.onmessage = e => { if (e.data.p !== undefined) prog(e.data.p); else { w.terminate(); res(e.data.r); } };
    w.onerror = () => { w.terminate(); res(analyzeCore(x, sr, dur, prog)); };
    const cp = x.slice(); w.postMessage({ x: cp, sr, dur }, [cp.buffer]);
  });
}
const PAT = { stair: [0, 1, 2, 1], stairD: [2, 1, 0, 1], trill: [0, 2], trillA: [0, 1], trillB: [1, 2], wave: [0, 1, 2, 2, 1, 0], zig: [0, 2, 1, 0, 2, 1] };
const PK = ['stair', 'stairD', 'stair', 'trillA', 'stairD', 'wave', 'stair'];
function ergonomics(notes) { // máximo 2 dedos a la vez; al soltar una nota larga hay tiempo para levantar el dedo antes de la siguiente
  notes.sort((a, b) => a.t - b.t); const holds = [], slides = [], acc = [], REL = .2;
  for (const a of notes) {
    if (a.del) continue; while (acc.length && acc[0].t < a.t - .1) acc.shift();
    const live = holds.filter(h => h.end > a.t - REL).length, same = acc.filter(o => Math.abs(o.t - a.t) < .03).length;
    let bad = live + same + 1 > 2;
    if (!bad && holds.some(h => h.end > a.t - REL && h.end <= a.t + .02 && (h.lanes.includes(a.lane) || h.lanes.includes(a.to)))) bad = true; // el mismo dedo acaba de soltar
    if (!bad && a.type === 'slide') bad = slides.some(s => s.end > a.t && (s.l - a.lane) * (s.to - a.to) < 0);
    if (bad) { a.del = true; continue; }
    acc.push(a); if (a.d) { holds.push({ end: a.t + a.d, lanes: [a.lane, a.to ?? a.lane] }); if (a.type === 'slide') slides.push({ end: a.t + a.d, l: a.lane, to: a.to }); }
  }
  for (let q = notes.length - 1; q >= 0; q--) if (notes[q].del) notes.splice(q, 1);
}
function syncs(notes, D) { // notas dobles unidas (Sync): al menos una cada cierto tiempo en todas las dificultades
  notes.sort((a, b) => a.t - b.t); if (notes.length < 4) return;
  const lv = D.lv || 0, every = [8, 5.5, 4, 3][lv], near = lv >= 2 ? .08 : .12, end = notes[notes.length - 1].t, add = [];
  { const cap = [.12, .22, .3, .38][lv]; let slots = 0, kept = 0; // no más dobles de los que cada nivel aguanta: se reparten en toda la canción
    for (let i = 0; i < notes.length; i++) { slots++; const a = notes[i], b = notes[i + 1]; if (b && b.t - a.t < .03 && a.type === 'tap' && b.type === 'tap') { if (kept + 1 > cap * slots) b.del = true; else kept++; i++; } }
    for (let q = notes.length - 1; q >= 0; q--) if (notes[q].del) notes.splice(q, 1); }
  const dbl = o => notes.some(p => p !== o && Math.abs(p.t - o.t) < .03) || add.some(p => Math.abs(p.t - o.t) < .03);
  for (let w0 = notes[0].t; w0 < end; w0 += every) {
    const inW = notes.filter(o => o.t >= w0 && o.t < w0 + every); if (inW.some(dbl)) continue;
    const cand = inW.filter(o => o.type === 'tap').sort((a, b) => (b.s || 0) - (a.s || 0));
    for (const a of cand) {
      if (notes.some(p => p !== a && Math.abs(p.t - a.t) < near)) continue;
      const free = [0, 1, 2].filter(l => l !== a.lane && !notes.some(p => !p.del && (p.lane === l || p.to === l) && p.t < a.t + .25 && p.t + (p.d || 0) > a.t - .25));
      if (!free.length) continue;
      free.sort((x, y) => Math.abs(y - a.lane) - Math.abs(x - a.lane)); add.push({ t: a.t, lane: free[0], type: 'tap', d: 0 }); break;
    }
  }
  notes.push(...add); notes.sort((a, b) => a.t - b.t);
}
function specials(notes, D) {
  notes.sort((a, b) => a.t - b.t); if (notes.length < 4) return;
  const lv = D.lv || 0, every = [14, 9, 6, 5][lv], want = Math.floor(notes[notes.length - 1].t / every);
  const clear = (lanes, t0, t1, a) => { for (const o of notes) if (o !== a && lanes.includes(o.lane) && o.t > t0 - .05 && o.t < t1 + .1) o.del = true; };
  const busy = (lane, t0, t1, skip) => notes.some(o => !o.del && !skip.includes(o) && o.lane === lane && o.t < t1 + .1 && o.t + (o.d || 0) > t0 - .1);
  let made = notes.filter(o => o.type === 'slide').length, k = 0;
  for (const gmin of [.75, .5, 0]) {
    let last = -99;
    for (let i = 0; i < notes.length - 1 && made < want; i++) {
      const a = notes[i], gap = notes[i + 1].t - a.t; if (a.del) continue; if (a.type === 'slide') { last = a.t; continue; }
      const pr = notes.filter(o => o !== a && !o.del && Math.abs(o.t - a.t) < .03);
      if ((a.type !== 'tap' && a.type !== 'ln') || a.t - last < every || gap < gmin || (pr.length && gmin)) continue;
      pr.forEach(o => o.del = true);
      const d = +(gmin ? Math.min(gap * .85, 1.8) : .8).toFixed(3), l = a.lane, to = l === 0 ? (k % 2 ? 1 : 2) : l === 2 ? (k % 2 ? 1 : 0) : (k % 2 ? 0 : 2), skip = [a];
      if (gmin && busy(to, a.t, a.t + d, skip)) continue;
      const par = l !== 1 && to === 1 && (!gmin || !busy(2 - l, a.t, a.t + d, skip));
      if (!gmin) clear(par ? [l, 1, 2 - l] : [l, to], a.t, a.t + d, a);
      a.type = 'slide'; a.to = to; a.d = d; delete a.dir; last = a.t; made++; k++;
      if (par) notes.push({ t: a.t, lane: 1, type: 'slide', to: 2 - l, d });
    }
  }
  const lnEvery = [4, 3, 2.5, 2.5][lv]; let lastLn = -99;
  for (const a of notes) {
    if (a.del) continue; if (a.type === 'ln' || a.type === 'slide') { lastLn = a.t; continue; }
    if ((a.type !== 'tap' && a.type !== 'flick') || (a.sus || 0) < .35 || a.t - lastLn < lnEvery) continue;
    const d = +Math.min(a.sus * S.lnLen, 2.4).toFixed(3); if (d < .25) continue;
    notes.forEach(o => { if (o !== a && Math.abs(o.t - a.t) < .03) o.del = true; }); delete a.dir; clear([a.lane], a.t, a.t + d, a); a.type = 'ln'; a.d = d; lastLn = a.t;
  }
  for (let q = notes.length - 1; q >= 0; q--) if (notes[q].del) notes.splice(q, 1);
  notes.forEach(o => delete o.sus); notes.sort((a, b) => a.t - b.t);
}
const lvOf = (M, tut) => Math.max(0, Math.min(3, S.diff + (tut ? 0 : (M.more ? 1 : 0) - (M.fewer ? 1 : 0))));
const NPS = [[.7, 1.3], [1.3, 2.2], [2.2, 3.4], [3.2, 4.8]]; // notas por segundo (mín, máx) según el nivel
const uniqT = ns => { let c = 0, lt = -9; for (const o of ns) { if (o.t - lt > .03) c++; lt = o.t; } return c; };
const activeSecs = m => { const en = m.en; if (!en || !en.length) return Math.max(10, ((m.peaks[m.peaks.length - 1] || { t: 60 }).t)); let c = 0; for (const v of en) if (v > .12) c++; return Math.max(10, c / 10); };

/* ===== Ritmo primero: los pulsos de la canción mandan, la dificultad decide cuántas subdivisiones se añaden ===== */
function trackBeats(m) { // sigue el pulso real: parte de la rejilla (bpm, beat0) y se corrige con los golpes fuertes cercanos
  const P = m.peaks; if (!P || !P.length || !(m.beat0 >= 0)) return null;
  const end = P[P.length - 1].t + 1, spb0 = 60 / (m.bpm || 120), B = []; let t = m.beat0 % spb0, pi = 0, hit = 0;
  while (t < end) {
    while (pi < P.length && P[pi].t < t - .05) pi++;
    let best = null; for (let j = pi; j < P.length && P[j].t <= t + .05; j++) if (!best || P[j].s > best.s) best = P[j];
    const spb = 60 / ((m.bt && m.bt[Math.min(m.bt.length - 1, t / 8 | 0)]) || m.bpm || 120);
    if (best) { hit++; B.push(best.t); t += spb + (best.t - t) * .6; } else { B.push(t); t += spb; }
  }
  return B.length > 8 ? { B, conf: hit / B.length } : null;
}
function tagGrid(m, lv) { // marca cada golpe: g=0 en el pulso, 1 en medio pulso, 2 en cuartos, 3 fuera de rejilla
  const T = trackBeats(m); if (!T || T.conf < .3) return null; const B = T.B, step = lv === 0 && m.bpm > 112 ? 2 : 1;
  const tag = list => { let k = 0; return (list || []).map(p => { while (k < B.length - 2 && B[k + 1] <= p.t) k++;
    const sp = (B[k + 1] || B[k] + 60 / m.bpm) - B[k], o = { ...p }; let near = Math.abs(p.t - B[k]) <= .045 ? 0 : Math.abs(p.t - B[k + 1]) <= .045 ? 1 : -1;
    if (near >= 0) { o.g = 0; o.bi = k + near; } else { const r = (p.t - B[k]) / sp; o.g = Math.abs(r - .5) * sp <= .045 ? 1 : (Math.abs(r - .25) * sp <= .04 || Math.abs(r - .75) * sp <= .04) ? 2 : 3; o.bi = k; }
    return o; }); };
  const pk = tag(m.peaks), wk = tag(m.weak); let ev = 0, od = 0; for (const p of pk) if (p.g === 0) { if (p.bi % 2) od += p.s; else ev += p.s; }
  const ph = step === 2 && od > ev ? 1 : 0; for (const p of [...pk, ...wk]) p.sk = p.g === 0 && p.bi % step === ph;
  const bs = pk.filter(p => p.g === 0).map(p => p.s).sort((a, b) => a - b), ref = bs.length ? bs[bs.length >> 1] : 2; for (const p of [...pk, ...wk]) p.r = p.s / (ref || 1);
  return { pk, wk };
}
function keepPk(p, D) { // ¿entra este golpe al mapa en esta dificultad?
  if (p.g === undefined) return p.s >= D.s; const lv = D.lv || 0;
  if (p.g === 0) return p.sk;
  if (p.g === 1) return p.r >= [1.4, .9, .45, 0][lv];
  if (p.g === 2) return p.r >= [9, 9, .9, .35][lv];
  return p.r >= [9, 9, 2, 1.1][lv];
}
function buildMap(m, M, tut) { // el mapa se ajusta solo para que no tenga muchas más ni muchas menos notas de las que la canción pide
  const lv = lvOf(M, tut), base = { ...DIFF[lv], weak: !tut && M.more ? 1 : 0 }, GP = !tut && m.peaks && m.peaks.length >= 12 ? tagGrid(m, lv) : null, mk = D => build(GP ? GP.pk : m.peaks, D, m.bpm, m.en, m.beat0, m.bt, m.sec, GP ? GP.wk : m.weak);
  let notes = mk(base); if (tut || !m.peaks || m.peaks.length < 12) return notes;
  const act = activeSecs(m), lo = NPS[lv][0], hi = NPS[lv][1], dev = x => x > hi ? x / hi : x < lo ? lo / Math.max(x, .01) : 1;
  let D = { ...base }, best = notes, bd = dev(uniqT(notes) / act);
  for (let it = 0; it < 6 && bd > 1.12; it++) {
    const x = uniqT(notes) / act;
    if (x > hi) { D.s = Math.max(1.2, D.s * 1.2 + .25); D.gap *= 1.18; D.sg *= 1.12; D.weak = 0; }
    else { D.s = D.s * .72 < .3 ? 0 : D.s * .72; D.gap = Math.max(.12, D.gap * .86); D.sg = Math.max(.1, D.sg * .9); if (lv > 0) D.weak = 1; }
    notes = mk(D); const d2 = dev(uniqT(notes) / act); if (d2 < bd) { bd = d2; best = notes; }
  }
  return best;
}
function build(pk, D, bpm, en, b0, bt, sec, wk) {
  const f = Math.pow(S.speed, .4); D = { ...D, gap0: D.gap, sg0: D.sg, gap: Math.max(.12, D.gap * f), sg: Math.max(.1, D.sg * f) };
  const spbAt = t => 60 / ((bt && bt[t / 8 | 0]) || bpm || 120), inten = t => (sec && sec[t / 4 | 0]) || 1;
  const spb = 60 / (bpm || 120), q = (D.weak && wk ? [...pk, ...wk].sort((a, b) => a.t - b.t) : pk).filter(p => keepPk(p, D)), notes = [], free = [-9, -9, -9];
  let cnt = 0, last = -9, seq = PAT.stair, pos = 0, sc = 0, fc = 0;
  q.forEach((p, i) => {
    const fz = inten(p.t), mg = Math.max(.1, (p.s >= 3.5 ? (p.s > D.st ? D.sg0 : D.gap0) : (p.s > D.st ? D.sg : D.gap)) * (fz > 1.4 ? .6 : fz > 1.2 ? .75 : fz < .8 ? 1.25 : 1));
    const gx = p.g <= 1 ? Math.min(mg, spb * .42) : mg; // los golpes del pulso y del medio pulso no se saltan por separación
    if (p.t - last < gx) { // un golpe del pulso desplaza a una nota menos importante que le estorba
      if (p.g === undefined || p.g > 1) return;
      let z = notes.length; while (z > 0 && notes[z - 1].t > p.t - gx && notes[z - 1].g > p.g && !notes[z - 1].d) z--;
      if (z > 0 && notes[z - 1].t > p.t - gx) return;
      notes.length = z; last = z ? notes[z - 1].t : -9; cnt = Math.max(0, cnt - 1);
    }
    let j = i + 1; while (q[j] && q[j].t < p.t + mg) j++;
    const gap = (q[j] ? q[j].t : p.t + 2) - p.t, ok = [0, 1, 2].filter(l => free[l] <= p.t - .02); if (!ok.length) return;
    if (cnt % 8 === 0) {
      const r = ((cnt * 2654435761) >>> 0) % 97;
      seq = PAT[gap < .3 ? ['stair', 'stairD', 'wave'][r % 3] : p.s > 3.5 ? ['trill', 'trillA', 'trillB', 'stair'][r % 4] : PK[r % 7]]; pos = 0;
    }
    let lane = seq[pos++ % seq.length]; if (!ok.includes(lane)) lane = ok[0];
    const bl = [0, 1, 1, 2][p.bd || 0]; if (gap >= .3 && cnt % 2 === 0 && ok.includes(bl)) lane = bl;
    const nt = { t: p.t, lane, type: 'tap', d: 0, sus: p.d || 0, s: p.s, g: p.g }; last = p.t; cnt++;
    const sus = Math.min(p.d || gap, gap - .08), d = +Math.min(Math.max(.25, Math.round(sus / (spbAt(p.t) / 8)) * spbAt(p.t) / 8) * S.lnLen, gap - .08, 2.4).toFixed(3);
    const hold = (p.d || 0) >= .45 && gap >= .5 && p.d >= gap * .6;
    if (gap >= .42 && d >= .3 && (cnt % D.ln === 0 || hold)) {
      const to = lane === 0 ? (sc % 2 ? 2 : 1) : lane === 2 ? (sc % 2 ? 0 : 1) : (sc % 2 ? 0 : 2);
      if (D.sl && !hold && (cnt / D.ln) % 2 === 0 && d >= .5 && free[to] <= p.t) {
        sc++; Object.assign(nt, { type: 'slide', to, d }); free[to] = p.t + d; const dn = lane === 0 ? 1 : -1;
        if (d >= .7 && lane !== 1 && sc % 2 === 0 && free[2 - lane] <= p.t) { nt.to = 2 - lane; free[2 - lane] = p.t + d; notes.push({ t: p.t, lane: 2 - lane, type: 'slide', to: lane, d }); }
        else if (d >= .7 && lane !== 1 && free[lane + dn] <= p.t && free[lane + 2 * dn] <= p.t) { nt.to = lane + dn; free[lane + dn] = free[lane + 2 * dn] = p.t + d; notes.push({ t: p.t, lane: lane + dn, type: 'slide', to: lane + 2 * dn, d }); }
      } else Object.assign(nt, { type: 'ln', d });
      free[lane] = p.t + d;
    } else { if (gap >= .28 && cnt % D.fl === 0) { const wl = [0, 2, 1][fc++ % 3]; if (ok.includes(wl)) { lane = wl; nt.lane = wl; } nt.type = 'flick'; nt.dir = lane === 0 ? 1 : lane === 2 ? -1 : (fc % 2 ? 1 : -1); } free[lane] = p.t; }
    notes.push(nt);
    if (D.ch && p.s > D.ch && nt.type === 'tap') {
      ok.filter(l => l !== lane).sort((a, b) => Math.abs(b - lane) - Math.abs(a - lane)).slice(0, 1)
        .forEach(l => { notes.push({ t: p.t, lane: l, type: 'tap', d: 0, g: p.g }); free[l] = p.t; });
    }
  });
  if (en) {
    notes.sort((a, b) => a.t - b.t); const fill = [], stp = Math.max(spb, D.gap * 1.2); let sp = 0;
    for (let i = 0; i < notes.length - 1; i++) {
      const a = notes[i], b = notes[i + 1]; if (b.t - (a.t + a.d) < stp * 1.8) continue;
      let lf = a.t + a.d;
      for (const p of pk) {
        if (p.t < lf + stp || p.t > b.t - stp * .6 || (en[p.t * 10 | 0] || 0) < .3 || (p.g !== undefined && !keepPk(p, D))) continue;
        fill.push({ t: p.t, lane: PAT.stair[sp++ % 4], type: 'tap', d: 0 }); lf = p.t;
      }
    }
    notes.push(...fill);
  }
  specials(notes, D); syncs(notes, D); ergonomics(notes); notes.forEach(o => { delete o.s; delete o.g; });
  if (!notes.some(o => o.type !== 'tap')) notes.forEach((o, i) => { if (i % 6 === 3) o.type = 'flick'; });
  return notes;
}

/* ---------- Importar ---------- */
/* Importación: primero se guarda el audio de TODAS las canciones elegidas (queda "pendiente"); luego se analizan una por una.
   Si cierras el juego o sales a jugar a mitad, al volver continúa donde se quedó. */
const IMPQ = []; let impBusy = false;
const spaceOk = async n => { try { if (navigator.storage && navigator.storage.estimate) { const { quota, usage } = await navigator.storage.estimate(); if (quota && quota - usage < n * 1.4 + 8e6) return false; } } catch (e) {} return true; };
const noSpace = () => msg('No hay espacio para guardar más canciones. Libera espacio en el teléfono o elimina alguna canción de la biblioteca.');
const importFiles = async (e, kind) => {
  init(); const all = [...e.target.files]; e.target.value = ''; $('#impMenu').classList.remove('open');
  const isAud = x => x.type.startsWith('audio'), isVid = x => x.type.startsWith('video'), isImg = x => x.type.startsWith('image'), isJson = x => /\.(json|tbeat|bwave)$/i.test(x.name), base = x => x.name.replace(/\.[^.]+$/, '').toLowerCase();
  let aus = kind === 'vid' ? all.filter(isVid) : all.filter(isAud); if (!aus.length && kind !== 'aud' && kind !== 'vid') aus = all.filter(isVid); // sin tipo: un video con audio también sirve como canción
  if (!aus.length) return msg(kind === 'vid' ? 'Elige un video con audio (MP4, WEBM…). El mapa y la portada son opcionales.' : kind === 'aud' ? 'Elige una canción de audio (MP3, WAV, M4A…). El mapa y la portada son opcionales.' : 'Elige una canción o un video con audio. El mapa y la portada son opcionales.');
  const single = aus.length === 1; let saved = 0;
  try { navigator.storage && navigator.storage.persist && navigator.storage.persist(); } catch (er) {}
  for (const a of aus) {
    const same = x => single || base(x) === base(a), j = all.find(x => isJson(x) && same(x)), im = all.find(x => isImg(x) && same(x)), v = isVid(a) ? a : all.find(x => isVid(x) && x !== a && same(x));
    if (!(await spaceOk(a.size))) { noSpace(); break; }
    const id = Date.now() + '' + (Math.random() * 1e3 | 0) + saved;
    try {
      await DB.audioPut(id, await a.arrayBuffer());
      await DB.put({ id, pending: 1, base: a.name.replace(/\.\w+$/, ''), title: a.name.replace(/\.\w+$/, ''), artist: 'Importada', dur: 0, mapJson: j ? await j.text() : null, cover: im || null, video: v || null });
    } catch (er) { try { await DB.del(id); } catch (e2) {} if (er && er.name === 'QuotaExceededError') noSpace(); else msg('No se pudo guardar la canción.'); break; }
    IMPQ.push(id); saved++;
  }
  if (saved) { msg(saved > 1 ? `Importando ${saved} canciones… puedes seguir usando el juego.` : 'Importando la canción…'); go('select'); runImports(); }
};
$('#fileImport').onchange = e => importFiles(e); $('#impAud').onchange = e => importFiles(e, 'aud'); $('#impVid').onchange = e => importFiles(e, 'vid');
const openImp = () => { closeSide(); $('#impMenu').classList.add('open'); };
$('#btnImp2').onclick = $('#btnImp3').onclick = openImp; $('#impCancel').onclick = () => $('#impMenu').classList.remove('open');
async function runImports() {
  if (impBusy) return; impBusy = true;
  try {
    while (IMPQ.length) {
      while (G) await new Promise(r => setTimeout(r, 700)); // no se analiza mientras juegas: sin lag
      const id = IMPQ.shift();
      try { await finishImport(id); } catch (er) { if (er && er.name === 'QuotaExceededError') noSpace(); else if (er && er.message === 'audio') { try { await DB.del(id); } catch (e2) {} msg('No pude abrir una de las canciones.'); } }
    }
  } finally { impBusy = false; }
  loadedAll = true; if (typeof renderList === 'function') { renderList(); info(); }
}
async function finishImport(id) {
  const r = await DB.get(id); if (!r || !r.pending) return; const a = await DB.audioGet(id); if (!a || !a.ab) { await DB.del(id); return; }
  const buf = await ctx.decodeAudioData(a.ab.slice(0)).catch(() => null); if (!buf) throw new Error('audio');
  let tag = {}; try { tag = id3(a.ab.slice(0)); } catch (e) {}
  { const cjk = /[\u3400-\u9fff\uac00-\ud7af]/; if (tag.title && cjk.test(tag.title) && !cjk.test(r.base || '')) { tag.title = r.base; if (cjk.test(tag.artist || '')) tag.artist = ''; } }
  try { await fillCover(a.ab.slice(0), tag, r.video); } catch (e) {}
  let map = null; try { map = r.mapJson ? JSON.parse(r.mapJson) : null; } catch (e) {} if (!map || !map.peaks) map = await getMap(buf, id, true);
  const title = pickTitle([map.title, tag.title, tag.album], r.base || r.title), artist = map.artist || tag.artist || 'Importada';
  addSong({ id, title, artist, buf, map, cover: r.cover ? URL.createObjectURL(r.cover) : (map.cover || tag.cover), video: r.video ? URL.createObjectURL(r.video) : map.video });
  await DB.put({ id, map, title, artist, dur: buf.duration, cover: r.cover || tag.coverBlob || null, video: r.video || null });
}
$('#btnStart').onclick = () => { if (!sel) return; showLoading(sel); };
document.addEventListener('fullscreenchange', () => setTimeout(resize, 250));
$('#btnRetry').onclick = () => begin((G && G.song) || (LASTRES && LASTRES.g.song));
$('#search').oninput = () => renderList();
const showPin = () => { $('#tutPin').style.display = localStorage.getItem('bwtut') ? 'none' : 'flex'; };
$('#tutPin').onclick = async () => { if (!TUT) { try { TUT = makeTutorial(); } catch (e) { return; } } if (!localStorage.getItem('bwtour')) await runTour(); begin(TUT); };
function warmSfx() { [1400, 900, 1100, 2000, 700].forEach(f => { if (SFXB[f]) return; const n = ctx.sampleRate * .09 | 0, d = (SFXB[f] = ctx.createBuffer(1, n, ctx.sampleRate)).getChannelData(0); for (let i = 0, ph = 0; i < n; i++) { const t = i / ctx.sampleRate; ph += 2 * Math.PI * f * (1 - t * 5.5) / ctx.sampleRate; d[i] = Math.sin(ph) * Math.exp(-t * 45); } }); }
async function showLoading(s) {
  const tok = LTm = {}, st = stats(s), t = st.tier;
  $('#loadBody').innerHTML = `<div class="ring"><svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="46"/><circle class="fg" cx="50" cy="50" r="46" style="stroke-dasharray:${(t + 1) * 57.8} 289"/></svg><div class="cv">${thumb(s)}</div></div><h3></h3><p class="ar"></p><div class="tier" style="--c:${TC[t]}"><span>${TIERS[t]}</span></div><div class="dstats"><span>${ico('clock')} ${fmt(s.buf.duration | 0)}</span><span>${ico('note')} ${st.n} notas</span><span>${Math.round(s.map.bpm || 0)} BPM</span></div>${modList() ? `<p class="modl">${modList()}</p>` : ''}`;
  $('#loadBody h3').textContent = s.title; $('#loadBody .ar').textContent = s.artist;
  const bar = $('#loading .lbar i'), hint = $('#loadHint'), t0 = performance.now(), yld = () => Promise.resolve(); bar.style.width = '0';
  go('loading'); preview(s); muffle(true);
  const steps = [['Cargando audio…', async () => { try { await ensureBuf(s); } catch (e) { LTm = {}; RPLY = null; msg('No pude abrir el audio de esta canción.'); go('select'); throw e; } }], ['Generando notas…', async () => { stats(s); }], ['Cargando imagen…', async () => { if (s.img) await s.img.decode().catch(() => {}); }],
    ['Cargando fuentes…', async () => { await Promise.race([Promise.all([document.fonts.load('800 20px Orbitron'), document.fonts.load('600 16px Rajdhani')]), new Promise(r => setTimeout(r, 1500))]).catch(() => {}); }],
    ['Preparando sonidos…', async () => warmSfx()],
    ['Preparando gráficos…', async () => { W = innerWidth; H = innerHeight; GEO = null; buildGfx(Math.min(devicePixelRatio || 1, S.qual === 1 ? 2 : S.qual === 2 ? .75 : 1.5)); }],
    ...(S.video && s.video && !lite2() ? [['Cargando video…', async () => { vid.src = s.video; vid.preload = 'auto'; await new Promise(r => { vid.oncanplay = r; vid.onerror = r; setTimeout(r, 3000); }); }]] : [])];
  for (let i = 0; i < steps.length; i++) { if (LTm !== tok) return; hint.textContent = steps[i][0]; await steps[i][1](); bar.style.width = ((i + 1) / steps.length * 100) + '%'; await yld(); }
  hint.textContent = '¡Listo!'; if (LTm !== tok) return;
  const L = $('#loading'), dr = $('#dimRange'), upd = () => { const v = Math.round(S.dim * 100); dr.value = v; $('#dimVal').textContent = v + '%'; L.style.setProperty('--dim', S.dim); };
  L.style.setProperty('--cv', s.cover ? `url("${s.cover}")` : 'var(--theme)'); upd(); L.classList.add('ready'); $('#readyCount').style.animation = 'none'; void $('#readyCount').offsetWidth; $('#readyCount').style.animation = '';
  await new Promise(res => { let done = false, auto = setTimeout(go2, 3600);
    function go2() { if (done) return; done = true; clearTimeout(auto); res(); }
    const touch = () => { clearTimeout(auto); L.classList.add('manual'); };
    dr.oninput = () => { touch(); S.dim = dr.value / 100; lsSet('bwsettings', JSON.stringify(S)); upd(); };
    $$('#readyBox [data-d]').forEach(b => b.onclick = () => { touch(); S.dim = +b.dataset.d / 100; lsSet('bwsettings', JSON.stringify(S)); upd(); });
    $('#loadGo').onclick = go2; });
  L.classList.remove('ready', 'manual'); if (LTm !== tok) return; begin(s);
}
$('#loadCancel').onclick = () => { LTm = {}; muffle(false); go('select'); };
function showTut(st) {
  G.paused = true; G.pt.clear(); ctx.suspend(); $('#tTitle').textContent = st.title; $('#tText').textContent = st.text; $('#tutModal').classList.add('open');
}
$('#tOk').onclick = () => { $('#tutModal').classList.remove('open'); if (G) { G.paused = false; ctx.resume(); } };
function makeTutorial() {
  const sr = ctx.sampleRate, dur = 58, buf = ctx.createBuffer(1, sr * dur, sr), d = buf.getChannelData(0);
  for (let b = 0; b < dur * 2; b++) for (let i = 0, s0 = b * sr / 2 | 0; i < sr * .06; i++) d[s0 + i] += Math.sin(2 * Math.PI * (b % 4 ? 660 : 990) * i / sr) * Math.exp(-i / sr * 60) * .35;
  const T = (t, lane, type = 'tap', o = {}) => ({ t, lane, type, d: 0, ...o });
  const notes = [T(6, 1), T(7, 0), T(8, 2), T(9, 1), T(13, 1, 'ln', { d: 2 }), T(17, 0, 'ln', { d: 1.5 }),
    T(21, 0, 'flick', { dir: 1 }), T(22.5, 2, 'flick', { dir: -1 }), T(24, 1, 'flick', { dir: 1 }), T(25.5, 1, 'flick', { dir: -1 }),
    T(29, 0, 'slide', { to: 2, d: 2 }), T(33, 2, 'slide', { to: 0, d: 2 }), T(38, 0), T(38, 2), T(39.5, 0), T(39.5, 1), T(41, 1), T(41, 2)];
  for (let i = 0; i < 12; i++) notes.push(T(45 + i * .5, [0, 1, 2, 1][i % 4]));
  const tutorial = [
    { at: 0, title: '¡Bienvenido!', text: 'Las notas bajan por 3 carriles hasta los cuadrados de abajo. Te pausaremos antes de cada tipo de nota para explicarte qué hace.' },
    { at: 6, title: 'Tap', text: 'Toca el carril justo cuando el cuadrado llegue a la línea. Cuanto más exacto, más puntos.' },
    { at: 13, title: 'Nota larga (LN)', text: 'Toca y mantén el dedo apretado hasta que termine la barra. Ganas puntos mientras mantienes; si sueltas antes, fallas.' },
    { at: 21, title: 'Flick', text: 'Toca el carril y desliza el dedo de un solo tirón hacia el lado que indica la flecha doble.' },
    { at: 29, title: 'Cinta (Slide)', text: 'Mantén pulsado y sigue la cinta con el dedo mientras se desplaza poco a poco a otro carril. Solo puntúas si vas encima.' },
    { at: 38, title: 'Dobles', text: 'Dos notas a la vez: toca los dos carriles al mismo tiempo, cada uno con un dedo.' },
    { at: 45, title: 'Combo y Overdrive', text: 'Acertar seguido sube el combo y llena la barra Overdrive: al llenarse, ganas 50% más puntos. Cada 25 de combo verás un efecto. Fallar reinicia el combo.' }];
  return { tut: true, title: 'Tutorial', artist: 'Aprende las notas', buf, hue: 150, map: { notes, bpm: 120, tutorial } };
}
const FAV = JSON.parse(localStorage.getItem('bwfav') || '{}'), fkey = s => s.title + '|' + (s.buf.duration | 0); let favOnly = false;
const TIERS = ['Fácil', 'Normal', 'Difícil', 'Experto', 'Maestro'], TC = ['#7CFFB2', '#4DA3FF', '#FFD166', '#FF8A3D', '#FF4D6D'];
function stats(s) {
  const M = S.mods || {}, k = S.diff + '|' + S.speed + '|' + S.lnLen + '|' + (M.more ? 1 : 0) + (M.fewer ? 2 : 0); if (s.st && s.stk === k) return s.st;
  const ns = s.map.notes || buildMap(s.map, M, s.tut), a = [...ns].sort((x, y) => x.t - y.t), n = ns.length || 1, d = s.buf.duration;
  let pk = 0, j = 0; for (let i = 0; i < a.length; i++) { while (a[i].t - a[j].t > 5) j++; pk = Math.max(pk, (i - j + 1) / 5); }
  const sp = ns.filter(o => o.type !== 'tap').length / n, dbl = a.filter((o, i) => i && Math.abs(o.t - a[i - 1].t) < .03).length / n;
  const r = ns.length / d + .5 * pk + 3 * dbl + 2 * sp + .3 * (S.speed - 1);
  s.stk = k; return s.st = { n: ns.length, r, tier: r < 3.2 ? 0 : r < 5.5 ? 1 : r < 8 ? 2 : r < 10.5 ? 3 : 4 };
}
const ICO = { help: '<circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/>', stop: '<rect width="14" height="14" x="5" y="5" rx="2"/>', info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>', chev: '<path d="m6 9 6 6 6-6"/>', close: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>', prev: '<polygon points="19 20 9 12 19 4 19 20"/><line x1="5" x2="5" y1="19" y2="5"/>', next: '<polygon points="5 4 15 12 5 20 5 4"/><line x1="19" x2="19" y1="5" y2="19"/>', play: '<polygon points="6 3 20 12 6 21 6 3"/>', pause: '<rect x="14" y="4" width="4" height="16" rx="1"/><rect x="6" y="4" width="4" height="16" rx="1"/>', search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>', dice: '<rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><path d="M16 8h.01"/><path d="M8 8h.01"/><path d="M8 16h.01"/><path d="M16 16h.01"/><path d="M12 12h.01"/>', upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" x2="12" y1="3" y2="15"/>', gear: '<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/>', menu: '<line x1="4" x2="20" y1="12" y2="12"/><line x1="4" x2="20" y1="6" y2="6"/><line x1="4" x2="20" y1="18" y2="18"/>', star: '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>', plus: '<path d="M5 12h14"/><path d="M12 5v14"/>', dots: '<circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/>', back: '<path d="m15 18-6-6 6-6"/>', note: '<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>', clock: '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>', target: '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>', timer: '<line x1="10" x2="14" y1="2" y2="2"/><line x1="12" x2="15" y1="14" y2="11"/><circle cx="12" cy="14" r="8"/>', check: '<path d="M20 6 9 17l-5-5"/>', dot: '<circle cx="12" cy="12" r="1"/>', trash: '<path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/>', selmode: '<path d="M21 10.5V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h12.5"/><path d="m9 11 3 3L22 4"/>', video: '<rect width="18" height="18" x="3" y="3" rx="2"/><path d="m9 8 6 4-6 4Z"/>', music: '<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>', restore: '<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/>', all: '<path d="M8 6h13"/><path d="M8 12h13"/><path d="M8 18h13"/><path d="M3 6h.01"/><path d="M3 12h.01"/><path d="M3 18h.01"/>', user: '<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>', camera: '<path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/>', image: '<rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/>', download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/>' };
Object.assign(ICO, { coin: '<circle cx="8" cy="8" r="6"/><path d="M18.09 10.37A6 6 0 1 1 10.34 18"/><path d="M7 6h1v4"/><path d="m16.71 13.88.7.71-2.82 2.82"/>', gift: '<rect x="3" y="8" width="18" height="4" rx="1"/><path d="M12 8v13"/><path d="M19 12v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7"/><path d="M7.5 8a2.5 2.5 0 0 1 0-5A4.8 8 0 0 1 12 8a4.8 8 0 0 1 4.5-5 2.5 2.5 0 0 1 0 5"/>' });
Object.assign(ICO, { trophy: '<path d="M19 5h-2V3H7v2H5c-1.1 0-2 .9-2 2v1c0 2.55 1.92 4.63 4.39 4.94.63 1.5 1.98 2.63 3.61 2.96V19H7v2h10v-2h-4v-3.1c1.63-.33 2.98-1.46 3.61-2.96C19.08 12.63 21 10.55 21 8V7c0-1.1-.9-2-2-2zM5 8V7h2v3.82C5.84 10.4 5 9.3 5 8zm14 0c0 1.3-.84 2.4-2 2.82V7h2v1z"/>', gear: '<path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z"/>', award: '<path d="M9.68 13.69 12 11.93l2.31 1.76-.88-2.85L15.75 9h-2.84L12 6.19 11.09 9H8.25l2.31 1.84-.88 2.85zM20 10c0-4.42-3.58-8-8-8s-8 3.58-8 8c0 2.03.76 3.87 2 5.28V23l6-2 6 2v-7.72c1.24-1.41 2-3.25 2-5.28zm-8-6c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6 2.69-6 6-6z"/>', target: '<path fill-rule="evenodd" d="M12 2a10 10 0 100 20 10 10 0 000-20zm0 3a7 7 0 110 14 7 7 0 010-14z"/><circle cx="12" cy="12" r="3.6"/>', apps: '<circle cx="5" cy="5" r="2.1"/><circle cx="12" cy="5" r="2.1"/><circle cx="19" cy="5" r="2.1"/><circle cx="5" cy="12" r="2.1"/><circle cx="12" cy="12" r="2.1"/><circle cx="19" cy="12" r="2.1"/><circle cx="5" cy="19" r="2.1"/><circle cx="12" cy="19" r="2.1"/><circle cx="19" cy="19" r="2.1"/>', dots: '<circle cx="5" cy="12" r="2.2"/><circle cx="12" cy="12" r="2.2"/><circle cx="19" cy="12" r="2.2"/>', vlist: '<rect x="3" y="4" width="18" height="7" rx="2"/><rect x="3" y="13" width="18" height="7" rx="2"/>', vcompact: '<rect x="3" y="3.5" width="18" height="4.4" rx="1.6"/><rect x="3" y="9.8" width="18" height="4.4" rx="1.6"/><rect x="3" y="16.1" width="18" height="4.4" rx="1.6"/>', vgrid: '<rect x="3" y="3" width="8" height="8" rx="2.2"/><rect x="13" y="3" width="8" height="8" rx="2.2"/><rect x="3" y="13" width="8" height="8" rx="2.2"/><rect x="13" y="13" width="8" height="8" rx="2.2"/>', vcarousel: '<rect x="7" y="3" width="10" height="18" rx="2.6"/><rect x="2" y="6" width="3.5" height="12" rx="1.6"/><rect x="18.5" y="6" width="3.5" height="12" rx="1.6"/>', menu: '<circle cx="5" cy="5" r="2.1"/><circle cx="12" cy="5" r="2.1"/><circle cx="19" cy="5" r="2.1"/><circle cx="5" cy="12" r="2.1"/><circle cx="12" cy="12" r="2.1"/><circle cx="19" cy="12" r="2.1"/><circle cx="5" cy="19" r="2.1"/><circle cx="12" cy="19" r="2.1"/><circle cx="19" cy="19" r="2.1"/>' });
const FILLED = new Set(['trophy', 'gear', 'award', 'target', 'apps', 'dots', 'vlist', 'vcompact', 'vgrid', 'vcarousel', 'menu']);
const ico = (n, f) => `<svg class="i${f ? ' f' : ''}${FILLED.has(n) ? ' fi' : ''}" viewBox="0 0 24 24">${ICO[n]}</svg>`;
const thumb = s => s.cover ? `<img src="${s.cover}" alt="">` : `<span style="background:linear-gradient(135deg,hsl(${s.hue} 70% 45%),hsl(${(s.hue + 60) % 360} 60% 25%))">${(s.title || '?')[0].toUpperCase()}</span>`;
const LAST = JSON.parse(localStorage.getItem('bwlast') || '{}');
const REC = JSON.parse(localStorage.getItem('bwrec') || '{}'), RC = { SS: '#FFD166', 'S★': '#FFE680', S: '#FFD166', A: '#7CFFB2', B: '#4DA3FF', C: '#B388FF', D: '#FF4D6D', F: '#FF4D6D' };
function judgeHTML(r) {
  const J = [['PERFECT', r.perf, '#00E5FF'], ['GREAT', r.great, '#7CFFB2'], ['GOOD', r.good, '#FFD166'], ['MISS', r.miss, '#FF4D6D']];
  return `<div class="seg">${J.map(([, v, c]) => `<i style="flex:${v};background:${c}"></i>`).join('')}</div><div class="jd">${J.map(([n, v, c]) => `<div style="--c:${c}"><b>${v}</b><span>${n}</span></div>`).join('')}</div>`;
}
function showRecords(s) {
  const r = REC[fkey(s)];
  $('#recBody').innerHTML = r ? `<div class="rtop"><div class="rk2" style="color:${RC[r.rank]}">${rkh(r.rank)}</div><div class="dt"><b></b><small></small></div></div><div class="pill">${r.best.toLocaleString()}</div>${judgeHTML(r)}<div class="rk">Precisión ${r.acc}% · Combo máx. ${r.max} · Jugada ${r.plays} ${r.plays === 1 ? 'vez' : 'veces'}</div>` : '<p class="empty">Aún no has jugado esta canción.</p>';
  if (r) { $('#recBody .dt b').textContent = s.title; $('#recBody .dt small').textContent = s.artist; }
  $('#recModal').classList.add('open');
}
$('#recOk').onclick = () => $('#recModal').classList.remove('open');
let CAT = 'recent', PLSEL = null; const PLS = JSON.parse(localStorage.getItem('bwpls') || '{}'), HID = JSON.parse(localStorage.getItem('bwhide') || '[]'), savePls = () => lsSet('bwpls', JSON.stringify(PLS));
let FMT = 'all';
const TRASH = JSON.parse(localStorage.getItem('bwtrash') || '[]'), saveTrash = () => lsSet('bwtrash', JSON.stringify(TRASH));
const fmtOk = s => FMT === 'all' || (FMT === 'mp4' ? !!s.video : !s.video);
const vis = () => {
  const q = $('#search').value.toLowerCase(), L = songs.filter(s => !HID.includes(s.id) && !TRASH.includes(s.id) && fmtOk(s) && (s.title + s.artist).toLowerCase().includes(q));
  if (CAT === 'fav') return L.filter(s => FAV[fkey(s)]).sort((a, b) => a.title.localeCompare(b.title));
  if (CAT === 'lists') return (PLSEL && PLS[PLSEL] || []).map(k => L.find(s => fkey(s) === k)).filter(Boolean);
  return L.sort((a, b) => (LAST[fkey(b)] || 0) - (LAST[fkey(a)] || 0) || a.title.localeCompare(b.title));
};
function renderPls() {
  const row = $('#plRow'), names = Object.keys(PLS); if (PLSEL && !PLS[PLSEL]) PLSEL = null; if (CAT === 'lists' && !PLSEL && names.length) PLSEL = names[0];
  row.innerHTML = '';
  names.forEach(n => {
    const b = document.createElement('div'); b.className = 'plp' + (n === PLSEL ? ' on' : ''); b.innerHTML = `<button class="pn"></button><button class="px" aria-label="Eliminar lista">${ico('close')}</button>`;
    b.querySelector('.pn').textContent = `${n} · ${PLS[n].length}`; b.querySelector('.pn').onclick = () => { PLSEL = n; renderPls(); renderList(); };
    b.querySelector('.px').onclick = async () => { const r = await dlg('Eliminar lista', `¿Eliminar la lista “${n}”? Las canciones no se borran.`, { btns: ['Eliminar', 'Cancelar'] }); if (r.i === 0) { delete PLS[n]; if (PLSEL === n) PLSEL = null; savePls(); renderPls(); renderList(); } };
    row.append(b);
  });
  row.style.display = CAT === 'lists' ? '' : 'none';
  $$('#orgBar [data-org]').forEach(b => b.classList.toggle('on', b.dataset.org === CAT));
  const lb = $('#orgBar [data-org="lists"]'); if (lb) lb.textContent = names.length ? `Listas (${names.length})` : 'Listas';
}
$$('#orgBar [data-org]').forEach(b => b.onclick = () => { CAT = b.dataset.org; renderPls(); renderList(); });
function renderList() {
  const ul = $('#list'); ul.innerHTML = ''; const L0 = vis();
  if (!L0.length) { const hn = document.createElement('li'); hn.className = 'hint'; hn.dataset.cat = CAT; hn.innerHTML = '<svg class="i" viewBox="0 0 24 24"><path d="M9 18V6l10-2v12"/><circle cx="6" cy="18" r="3"/><circle cx="16" cy="16" r="3"/></svg><b></b><span>Toca aquí e importa tu primera canción: BeatWave crea el nivel.</span>'; hn.querySelector('b').textContent = CAT === 'fav' ? 'Aún no tienes favoritas. Marca la estrella de una canción.' : CAT === 'lists' ? (Object.keys(PLS).length ? 'Esta lista está vacía. Añade canciones desde las opciones de una canción.' : 'Aún no tienes listas. Usa “Crear lista”.') : (FMT === 'mp4' ? 'No hay videos (MP4) todavía. Importa un video para verlo aquí.' : FMT === 'mp3' ? 'No hay música de solo audio (MP3) todavía.' : 'No hay canciones. Usa “Importar canción”.'); ul.append(hn); }
  L0.forEach(s => {
    const li = document.createElement('li'), t = stats(s).tier; li.className = (s === sel ? 'on' : '') + (SELM ? ' sm' + (SELS.has(s.id || s.title) ? ' ck' : '') : ''); li._s = s;
    if (s.cover) li.style.backgroundImage = `linear-gradient(90deg,rgba(10,10,16,.95),rgba(10,10,16,.78) 62%,color-mix(in srgb,${TC[t]} 32%,rgba(10,10,16,.7))),url(${s.cover})`;
    li.innerHTML = `<div class="th">${thumb(s)}</div><div class="tx"><b></b><small></small></div><em style="--c:${TC[t]}">${TIERS[t]}</em>${REC[fkey(s)] ? `<i class="rkb" style="--c:${RC[REC[fkey(s)].rank]}">${rkh(REC[fkey(s)].rank)}</i>` : ''}<button class="mo" aria-label="Registros">${ico('dots')}</button><button class="st">${ico('star', !!FAV[fkey(s)])}</button><i class="ckb">${ico('check')}</i>`;
    li.querySelector('b').textContent = s.title; li.querySelector('small').textContent = `${s.artist} · ${fmt(s.buf.duration | 0)}` + (s.map.bpm ? ` · ${Math.round(s.map.bpm)} BPM` : '');
    li.querySelector('.st').onclick = e => { e.stopPropagation(); FAV[fkey(s)] = !FAV[fkey(s)]; lsSet('bwfav', JSON.stringify(FAV)); renderList(); };
    li.querySelector('.mo').onclick = e => { e.stopPropagation(); showRecords(s); };
    li.onclick = () => { if (li._lp) { li._lp = false; return; } if (SELM) return toggleSelS(s); if (sel === s && li.classList.contains('on')) return showLoading(s); chooseSong(s); };
    { let tm = 0, sx = 0, sy = 0; const clr = () => { clearTimeout(tm); tm = 0; };
      li.addEventListener('pointerdown', e => { if (e.target.closest('.st,.mo')) return; sx = e.clientX; sy = e.clientY; clr(); tm = setTimeout(() => { tm = 0; li._lp = true; try { navigator.vibrate && navigator.vibrate(18); } catch (_) {} enterSel(s); }, 480); });
      li.addEventListener('pointermove', e => { if (tm && Math.hypot(e.clientX - sx, e.clientY - sy) > 10) clr(); });
      ['pointerup', 'pointercancel', 'pointerleave'].forEach(t => li.addEventListener(t, clr)); li.addEventListener('contextmenu', e => e.preventDefault()); }
    ul.append(li);
  });
  try { updSelBar(); } catch (e) {}
  const on = ul.querySelector('li.on'); [...ul.children].forEach((li, i) => li.style.setProperty('--i', Math.min(i, 10)));
  if (on) { ul.scrollTop = on.offsetTop - ul.clientHeight / 2 + on.offsetHeight / 2; ul.scrollLeft = on.offsetLeft - ul.clientWidth / 2 + on.offsetWidth / 2; }
}

/* ===== Selección de canción (instantánea y a prueba de fallos) ===== */
function chooseSong(s) {
  if (!s) return; PICKED = true; sel = s;
  try { if (ctx && ctx.state !== 'running') ctx.resume(); } catch (e) {}
  const ul = $('#list'); let on = null;
  [...ul.children].forEach(li => { const m = li._s === s; li.classList.toggle('on', m); if (m) on = li; });
  if (!on) renderList(); else try { ul.scrollTo({ top: on.offsetTop - ul.clientHeight / 2 + on.offsetHeight / 2, left: on.offsetLeft - ul.clientWidth / 2 + on.offsetWidth / 2, behavior: 'smooth' }); } catch (e) {}
  try { info(); } catch (e) {}
  try { if (PV.song !== s) stopPreview(); preview(s); muffle(false); const np = $('#nPlay'); if (np) np.innerHTML = ico('pause'); } catch (e) {}
}

/* ===== Selección múltiple y papelera ===== */
const sKey = s => s.id || s.title;
function updSelBar() {
  const n = SELS.size; $('#smCount').textContent = n ? `${n} elegida${n > 1 ? 's' : ''}` : 'Toca para elegir';
  $('#smDel').disabled = !n; $('#smAll').textContent = n && n === vis().length ? 'Ninguna' : 'Todas';
  const t = TRASH.filter(id => songs.some(s => s.id === id)).length, b = $('#trashN'); b.textContent = t || ''; b.style.display = t ? '' : 'none';
}
function setSelMode(on) { SELM = !!on; SELS.clear(); $('#select').classList.toggle('selmode', SELM); renderList(); updSelBar(); }
function enterSel(s) { // toque largo: empieza la selección con esa canción
  if (!SELM) { SELM = true; SELS.clear(); $('#select').classList.add('selmode'); [...$('#list').children].forEach(li => li.classList.add('sm')); }
  SELS.add(sKey(s)); [...$('#list').children].forEach(li => li.classList.toggle('ck', !!li._s && SELS.has(sKey(li._s)))); updSelBar();
}
function toggleSelS(s) { const k = sKey(s); if (SELS.has(k)) SELS.delete(k); else SELS.add(k); const li = [...$('#list').children].find(x => x._s === s); if (li) li.classList.toggle('ck', SELS.has(k)); updSelBar(); }
$('#smOpt').onclick = async () => {
  const L = songs.filter(s => SELS.has(sKey(s))); if (!L.length) return msg('Elige al menos una canción.');
  if (L.length === 1) { sel = L[0]; PICKED = true; try { info(); } catch (e) {} $('#optModal').classList.add('open'); return; }
  const r = await dlg(`${L.length} canciones`, 'Opciones para las canciones elegidas.', { btns: ['Añadir a una lista', 'Marcar como favoritas', 'Quitar de favoritas', 'Cancelar'] });
  if (r.i === 0) {
    const names = Object.keys(PLS), q = await dlg('Añadir a una lista', names.length ? 'Elige una lista.' : 'Aún no tienes listas.', { btns: [...names, 'Nueva lista', 'Cancelar'] }); if (q.i > names.length) return; let name = names[q.i];
    if (q.i === names.length) { const w = await dlg('Nueva lista', 'Ponle un nombre a tu lista.', { input: 'Nombre', btns: ['Crear', 'Cancelar'] }); if (w.i !== 0 || !w.v.trim()) return; name = w.v.trim(); PLS[name] = PLS[name] || []; }
    L.forEach(s => { if (!PLS[name].includes(fkey(s))) PLS[name].push(fkey(s)); }); savePls(); renderPls(); setSelMode(false); msg(`${L.length} canciones añadidas a “${name}”`);
  } else if (r.i === 1 || r.i === 2) { L.forEach(s => { FAV[fkey(s)] = r.i === 1; }); lsSet('bwfav', JSON.stringify(FAV)); setSelMode(false); msg(r.i === 1 ? 'Añadidas a favoritas' : 'Quitadas de favoritas'); }
};
$('#smCancel').onclick = () => setSelMode(false);
$('#smAll').onclick = () => { const L = vis(); if (SELS.size && SELS.size === L.length) SELS.clear(); else L.forEach(s => SELS.add(sKey(s))); renderList(); updSelBar(); };
$('#smDel').onclick = async () => {
  const L = songs.filter(s => SELS.has(sKey(s))); if (!L.length) return;
  const r = await dlg('Mover a la papelera', L.length === 1 ? `¿Mover “${L[0].title}” a la papelera? Podrás recuperarla cuando quieras.` : `¿Mover ${L.length} canciones a la papelera? Podrás recuperarlas cuando quieras.`, { btns: ['Mover a la papelera', 'Cancelar'] }); if (r.i !== 0) return;
  L.forEach(s => { if (s.id && !TRASH.includes(s.id)) TRASH.push(s.id); }); saveTrash();
  if (sel && TRASH.includes(sel.id)) { stopPreview(); sel = vis()[0] || null; }
  const n = L.length; setSelMode(false); info(); if (sel && idle()) { preview(sel); muffle(false); } msg(n === 1 ? 'Canción movida a la papelera' : `${n} canciones movidas a la papelera`);
};
async function purgeSong(id) {
  const s = songs.find(x => x.id === id), i = songs.findIndex(x => x.id === id);
  if (s && s.bundled) { if (!HID.includes(id)) { HID.push(id); lsSet('bwhide', JSON.stringify(HID)); } } else { try { await DB.del(id); } catch (e) {} }
  if (i >= 0) songs.splice(i, 1); const k = TRASH.indexOf(id); if (k >= 0) TRASH.splice(k, 1); saveTrash();
}
function openTrash() {
  const b = $('#trashBody'); b.innerHTML = ''; const L = songs.filter(s => TRASH.includes(s.id));
  $('#trashEmpty').style.display = L.length ? '' : 'none';
  if (!L.length) { b.innerHTML = '<p class="empty">La papelera está vacía.</p>'; }
  L.forEach(s => {
    const r = document.createElement('div'); r.className = 'trow';
    r.innerHTML = `<div class="th">${thumb(s)}</div><div class="tx"><b></b><small></small></div><button class="trs" type="button" aria-label="Restaurar">${ico('restore')}</button><button class="trd" type="button" aria-label="Eliminar para siempre">${ico('trash')}</button>`;
    r.querySelector('b').textContent = s.title; r.querySelector('small').textContent = s.artist;
    r.querySelector('.trs').onclick = () => { const k = TRASH.indexOf(s.id); if (k >= 0) TRASH.splice(k, 1); saveTrash(); if (!sel) sel = s; renderList(); info(); updSelBar(); openTrash(); msg('Canción restaurada'); };
    r.querySelector('.trd').onclick = async () => { const q = await dlg('Eliminar para siempre', `¿Eliminar “${s.title}” definitivamente? No se puede deshacer.`, { btns: ['Eliminar', 'Cancelar'] }); if (q.i !== 0) return; await purgeSong(s.id); renderList(); info(); updSelBar(); openTrash(); };
    b.append(r);
  });
  $('#trashModal').classList.add('open');
}
$('#btnTrash').onclick = openTrash; $('#trashOk').onclick = () => $('#trashModal').classList.remove('open');
$('#trashEmpty').onclick = async () => {
  const L = songs.filter(s => TRASH.includes(s.id)); if (!L.length) return;
  const q = await dlg('Vaciar papelera', `¿Eliminar definitivamente ${L.length === 1 ? 'la canción' : 'las ' + L.length + ' canciones'}? No se puede deshacer.`, { btns: ['Vaciar', 'Cancelar'] }); if (q.i !== 0) return;
  for (const s of L) await purgeSong(s.id); renderList(); info(); updSelBar(); openTrash(); msg('Papelera vaciada');
};
function info() {
  const bg = $('#selBg');
  if (!sel) { $('#detail').innerHTML = '<p class="empty">No hay canciones aquí. Usa “Importar canción” en el menú lateral.</p>'; bg.style.backgroundImage = ''; return; }
  bg.style.setProperty('--h', sel.hue); bg.style.backgroundImage = S.cover && sel.cover ? `linear-gradient(rgba(10,10,14,${.35 + S.dim * .4}),rgba(10,10,14,.92)),url(${sel.cover})` : '';
  const st = stats(sel), t = st.tier;
  $('#detail').innerHTML = `<div class="bigcv">${thumb(sel)}</div><div class="dt"><b></b><small></small><div class="tier" style="--c:${TC[t]}"><span>${TIERS[t]}</span><i>${'●'.repeat(t + 1)}<u>${'●'.repeat(4 - t)}</u></i></div><div class="dstats"><span>${ico('clock')} ${fmt(sel.buf.duration | 0)}</span><span>${ico('note')} ${st.n} notas</span><span>${Math.round(sel.map.bpm || 0)} BPM</span></div></div>`;
  $('#detail b').textContent = sel.title; $('#detail small').textContent = sel.artist; { const ds = $('#detail .dstats'), is = $('#infoStrip'); if (is) is.innerHTML = ds ? ds.innerHTML : ''; } $('#nowPlaying').textContent = sel.title; $('#nowArtist').textContent = sel.artist; $('#nowThumb').innerHTML = thumb(sel); $('#menuBg').style.backgroundImage = S.cover && sel.cover ? `linear-gradient(rgba(10,10,14,${.4 + S.dim * .4}),rgba(10,10,14,.92)),url(${sel.cover})` : '';
}
const closeSide = () => $('#select').classList.remove('sd');
$('#sdOpen').onclick = () => $('#select').classList.add('sd'); $('#shade').onclick = closeSide;
$('#side').onclick = e => { const s = e.target.closest('[data-set]'); if (s) showSet(s.dataset.set); };
$('#btnNewList').onclick = async () => { const r = await dlg('Nueva lista', 'Ponle un nombre a tu lista de canciones.', { input: 'Nombre de la lista', btns: ['Crear', 'Cancelar'] }); if (r.i === 0 && r.v.trim()) { PLS[r.v.trim()] = PLS[r.v.trim()] || []; savePls(); CAT = 'lists'; PLSEL = r.v.trim(); renderPls(); renderList(); msg(`Lista “${r.v.trim()}” creada`); } };
$('#btnRand').onclick = () => { const L = vis(); if (!L.length) return msg('No hay canciones para elegir.'); PICKED = true; sel = L[Math.random() * L.length | 0]; renderList(); info(); preview(sel); muffle(false); };
$$('#mods button').forEach(b => b.onclick = () => { S.mods = S.mods || {}; S.mods[b.dataset.m] = !S.mods[b.dataset.m]; lsSet('bwsettings', JSON.stringify(S)); modsUI(); renderList(); info(); });
// Iconos de los mods (se toman de los mismos SVG del menú de modificadores)
const modIcons = keys => keys.map(k => { // icono ORIGINAL del modificador: mismo círculo, color y dibujo que en la pantalla de selección
  const mi = document.querySelector(`#mods button[data-m="${k}"] .mi`), sv = mi && mi.querySelector('svg'), im = new Image();
  let bc = '#9af06c', bf = '#3f9a3a', st = '#ffffff', inner = '<circle cx="12" cy="12" r="8"/><path d="M9 12l2 2 4-4"/>';
  if (mi && sv) { const cs = getComputedStyle(mi), ss = getComputedStyle(sv); bc = cs.borderTopColor || bc; bf = cs.backgroundColor || bf; inner = sv.innerHTML; if (ss.stroke && ss.stroke !== 'none') st = ss.stroke; }
  im.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><circle cx="32" cy="32" r="29" fill="${bf}" stroke="${bc}" stroke-width="4"/><g transform="translate(14 14) scale(1.5)" fill="none" stroke="${st}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${inner}</g></svg>`);
  return im; });
const MN = { nf: 'Sin fallo', fast: 'Rápido', slow: 'Lento', more: 'Más notas', fewer: 'Menos notas', hid: 'Oculto', strict: 'Estrictas', wide: 'Amplias', mirror: 'Espejo', rand: 'Aleatorio', auto: 'AUTO' };
const modList = () => s0().filter(k => MN[k]).map(k => MN[k]).join(' · '), s0 = () => Object.keys(S.mods || {}).filter(k => (S.mods || {})[k]);
// Valores de osu!: Easy/No Fail 0.50, Half Time 0.30, Hard Rock 1.10, Double Time 1.10, Hidden 1.06. Se multiplican entre sí.
const MV = { mirror: 1, rand: 1, fast: 1.1, more: 1.1, hid: 1.06, strict: 1.06, slow: .3, fewer: .5, wide: .8, nf: .5, auto: 1 };
function modsUI() {
  const M = S.mods || {}; $$('#mods button').forEach(b => b.classList.toggle('on', !!M[b.dataset.m]));
  const n = Object.keys(MV).filter(k => M[k]).length, m = Object.keys(MV).reduce((a, k) => a * (M[k] ? MV[k] : 1), 1);
  $('#btnMods').textContent = `Modificadores${n ? ' +' + n : ''}`; $('#modMult').textContent = `Multiplicador de puntaje: ×${m.toFixed(2)}`;
}
$('#modClear').onclick = () => { S.mods = {}; lsSet('bwsettings', JSON.stringify(S)); modsUI(); renderList(); info(); };
$('#btnMods').onclick = () => $('#modModal').classList.add('open'); $('#modOk').onclick = () => $('#modModal').classList.remove('open');

/* ---------- DROPDOWN DIFICULTAD ---------- */
const diffLabels = ['Fácil', 'Normal', 'Difícil'];
function diffUI() {
  $('#diffLabel').textContent = diffLabels[S.diff] || 'Normal';
  $$('#diffMenu button').forEach(b => b.classList.toggle('on', +b.dataset.diff === S.diff));
}
$('#diffSelect').onclick = e => { e.stopPropagation(); $('#diffMenu').classList.toggle('open'); $('#diffSelect').setAttribute('aria-expanded', $('#diffMenu').classList.contains('open')); };
$$('#diffMenu button').forEach(b => b.onclick = () => { S.diff = +b.dataset.diff; lsSet('bwsettings', JSON.stringify(S)); diffUI(); modsUI(); renderList(); if (sel) info(); $('#diffMenu').classList.remove('open'); $('#diffSelect').setAttribute('aria-expanded', 'false'); });
document.addEventListener('click', e => { if (!e.target.closest('#diffWrap')) { $('#diffMenu').classList.remove('open'); $('#diffSelect').setAttribute('aria-expanded', 'false'); } });

function dlg(title, text, o = {}) {
  return new Promise(res => {
    $('#dTitle').textContent = title; $('#dText').textContent = text; const inp = $('#dInput'); inp.style.display = o.input ? 'block' : 'none'; inp.value = ''; inp.placeholder = o.input || '';
    const box = $('#dBtns'); box.innerHTML = '';
    (o.btns || ['Aceptar']).forEach((t, i) => { const b = document.createElement('button'); b.textContent = t; b.onclick = () => { $('#dlg').classList.remove('open'); res({ i, v: inp.value }); }; box.append(b); });
    $('#dlg').classList.add('open');
  });
}
let toastT = 0; function msg(t) { const el = $('#toast'); el.textContent = t; el.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => el.classList.remove('on'), 3200); }
$('#btnOpts').onclick = () => sel ? $('#optModal').classList.add('open') : msg('Elige una canción primero.');
$('#oInfo').onclick = () => { $('#optModal').classList.remove('open'); const st = stats(sel); dlg('Información', `${sel.title}\n${sel.artist}\nDuración ${fmt(sel.buf.duration | 0)} · ${Math.round(sel.map.bpm || 0)} BPM · ${st.n} notas\nDificultad ${TIERS[st.tier]}`); };
$('#oCover').onclick = () => { $('#optModal').classList.remove('open'); $('#coverIn').click(); };
$('#coverIn').onchange = e => { const f = e.target.files[0]; if (!f || !sel) return; sel.cover = URL.createObjectURL(f); sel.img = new Image(); sel.img.src = sel.cover; persist(sel, { cover: f }); renderList(); info(); msg('Portada actualizada'); e.target.value = ''; };
$('#oRen').onclick = async () => { $('#optModal').classList.remove('open'); const r = await dlg('Renombrar', 'Nuevo nombre de la canción.', { input: sel.title, btns: ['Guardar', 'Cancelar'] }); if (r.i === 0 && r.v.trim()) { sel.title = r.v.trim(); persist(sel, { title: sel.title }); renderList(); info(); } };
$('#oClose').onclick = () => $('#optModal').classList.remove('open');

/* ---------- EXPORTAR ---------- */
let EXP = null;
function openExport(song, notes, bpm) { EXP = { song, notes, bpm }; $('#exportModal').classList.add('open'); }
$('#oExp').onclick = async () => { $('#optModal').classList.remove('open'); try { await ensureBuf(sel); } catch (e) { return msg('No pude abrir el audio.'); } openExport(sel, sel.map.notes || buildMap(sel.map, {}, false), sel.map.bpm); };
$('#eCancel').onclick = () => $('#exportModal').classList.remove('open');

$('#eAudio').onclick = () => {
  $('#exportModal').classList.remove('open');
  try {
    const blob = bufToWav(EXP.song.buf);
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `${EXP.song.artist} - ${EXP.song.title}.wav`.replace(/[\\/:*?"<>|]/g, '_'); a.click();
    msg('Música exportada');
  } catch (e) { msg('No se pudo exportar la música'); }
};
$('#eMapJson').onclick = () => {
  $('#exportModal').classList.remove('open');
  const title = EXP.song.title || 'Sin título', artist = EXP.song.artist || 'Desconocido';
  const map = { format: 'beatwave-1', title, artist, bpm: EXP.bpm, beat0: EXP.song.map.beat0, offset: 0, duration: +EXP.song.buf.duration.toFixed(2), exportedAt: new Date().toISOString(), notes: EXP.notes };
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(map, null, 1)], { type: 'application/octet-stream' })); a.download = `${artist} - ${title}.json`.replace(/[\\/:*?"<>|]/g, '_'); a.click();
  msg('Mapa exportado');
};
$('#eVideo').onclick = async () => {
  $('#exportModal').classList.remove('open');
  if (!window.MediaRecorder) return msg('Este dispositivo no puede grabar video.');
  const song = EXP.song;
  try {
    const cvs = document.createElement('canvas'); cvs.width = 720; cvs.height = 1280;
    const dest = ctx.createMediaStreamDestination(); MUS.connect(dest);
    const cstream = cvs.captureStream(30);
    const stream = new MediaStream([...cstream.getVideoTracks(), ...dest.stream.getAudioTracks()]);
    const rec = new MediaRecorder(stream, { mimeType: MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus') ? 'video/webm;codecs=vp9,opus' : 'video/webm' });
    const chunks = []; rec.ondataavailable = e => e.data.size && chunks.push(e.data);
    const dur = Math.min(15, song.buf.duration);
    rec.start(100);
    const g = cvs.getContext('2d');
    const src = ctx.createBufferSource(); src.buffer = song.buf; const gain = ctx.createGain(); gain.gain.value = S.vmu; src.connect(gain).connect(dest); src.connect(MUS); src.start();
    const t0 = ctx.currentTime, en = song.map && song.map.en;
    const draw = () => {
      const now = ctx.currentTime - t0, prog = Math.min(1, now / dur);
      g.fillStyle = '#0D0D11'; g.fillRect(0, 0, cvs.width, cvs.height);
      if (song.img && song.img.complete) { const s = Math.min(cvs.width, cvs.height) * .55, x = (cvs.width - s) / 2, y = cvs.height * .2; g.save(); g.beginPath(); g.arc(x + s / 2, y + s / 2, s / 2, 0, 7); g.clip(); g.drawImage(song.img, x, y, s, s); g.restore(); }
      g.fillStyle = '#fff'; g.textAlign = 'center'; g.font = '800 42px Orbitron, sans-serif'; g.fillText(song.title.slice(0, 28), cvs.width / 2, cvs.height * .82);
      g.font = '500 26px Rajdhani, sans-serif'; g.fillStyle = '#8a8a98'; g.fillText(song.artist, cvs.width / 2, cvs.height * .86);
      const bw = cvs.width / 48, e0 = en ? (en[(now * 10) | 0] || 0) : .5;
      for (let i = 0; i < 48; i++) { const h = (e0 * .7 + .3) * (60 + 180 * Math.abs(Math.sin(now * 2 + i))); g.fillStyle = COL[0]; g.fillRect(i * bw + 4, cvs.height * .92 - h / 2, bw - 8, h); }
      g.fillStyle = 'rgba(255,255,255,.12)'; g.fillRect(0, cvs.height * .95, cvs.width, 6);
      g.fillStyle = COL[0]; g.fillRect(0, cvs.height * .95, cvs.width * prog, 6);
      if (now < dur) requestAnimationFrame(draw); else { try { src.stop(); } catch (e) {} rec.stop(); }
    };
    draw();
    rec.onstop = () => {
      try { MUS.disconnect(dest); } catch (e) {}
      const blob = new Blob(chunks, { type: 'video/webm' });
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `${song.artist} - ${song.title} (clip).webm`.replace(/[\\/:*?"<>|]/g, '_'); a.click();
      msg('Video exportado');
    };
  } catch (e) { msg('No se pudo exportar el video'); }
};
function bufToWav(buf) {
  const ch = buf.numberOfChannels, len = buf.length * ch * 2 + 44, ab = new ArrayBuffer(len), v = new DataView(ab);
  const ws = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  ws(0, 'RIFF'); v.setUint32(4, len - 8, true); ws(8, 'WAVE'); ws(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, ch, true); v.setUint32(24, buf.sampleRate, true); v.setUint32(28, buf.sampleRate * ch * 2, true); v.setUint16(32, ch * 2, true); v.setUint16(34, 16, true); ws(36, 'data'); v.setUint32(40, len - 44, true);
  const chans = []; for (let c = 0; c < ch; c++) chans.push(buf.getChannelData(c));
  let o = 44; for (let i = 0; i < buf.length; i++) for (let c = 0; c < ch; c++) { const s = Math.max(-1, Math.min(1, chans[c][i])); v.setInt16(o, s < 0 ? s * 0x8000 : s * 0x7fff, true); o += 2; }
  return new Blob([ab], { type: 'audio/wav' });
}

/* ---------- Persistencia ---------- */
$('#oPl').onclick = async () => {
  $('#optModal').classList.remove('open'); const names = Object.keys(PLS);
  const r = await dlg('Añadir a una lista', names.length ? 'Elige una lista.' : 'Aún no tienes listas.', { btns: [...names, 'Nueva lista', 'Cancelar'] });
  if (r.i > names.length) return; let name = names[r.i];
  if (r.i === names.length) { const q = await dlg('Nueva lista', 'Ponle un nombre a tu lista.', { input: 'Nombre', btns: ['Crear', 'Cancelar'] }); if (q.i !== 0 || !q.v.trim()) return; name = q.v.trim(); PLS[name] = PLS[name] || []; }
  if (!PLS[name].includes(fkey(sel))) PLS[name].push(fkey(sel)); savePls(); renderPls(); msg(`Añadida a “${name}”`);
};
$('#oDel').onclick = async () => {
  $('#optModal').classList.remove('open'); const r = await dlg('Eliminar canción', `¿Eliminar “${sel.title}” de tu biblioteca?`, { btns: ['Eliminar', 'Cancelar'] }); if (r.i !== 0) return;
  stopPreview(); if (sel.id === 'rocket') { HID.push('rocket'); lsSet('bwhide', JSON.stringify(HID)); } else if (sel.id) DB.del(sel.id).catch(() => {});
  songs.splice(songs.indexOf(sel), 1); sel = vis()[0] || null; renderList(); info(); msg('Canción eliminada');
};
async function migrateOldDB(dst) {
  if (localStorage.getItem('bwdbmig')) return;
  const old = await new Promise(res => { let q; try { q = indexedDB.open('taikobeat'); } catch (e) { return res(null); } q.onupgradeneeded = () => { try { q.transaction.abort(); } catch (e) {} }; q.onsuccess = () => res(q.result); q.onerror = () => res(null); q.onblocked = () => res(null); });
  if (old) {
    try {
      for (const st of ['songs', 'audio']) {
        if (!old.objectStoreNames.contains(st)) continue;
        const keys = await new Promise(r => { const t = old.transaction(st), q = t.objectStore(st).getAllKeys(); t.oncomplete = () => r(q.result); t.onerror = () => r([]); });
        for (const k of keys) { // de una en una, para no llenar la memoria
          const v = await new Promise(r => { const t = old.transaction(st), q = t.objectStore(st).get(k); t.oncomplete = () => r(q.result); t.onerror = () => r(null); });
          if (v) await new Promise((r, j) => { const t = dst.transaction(st, 'readwrite'); t.objectStore(st).put(v); t.oncomplete = r; t.onerror = () => j(t.error); t.onabort = () => j(t.error); });
        }
      }
      old.close(); indexedDB.deleteDatabase('taikobeat');
    } catch (e) { try { old.close(); } catch (e2) {} return; }
  }
  lsSet('bwdbmig', '1');
}
const DB = (() => { let p; const open = () => p || (p = new Promise((res, rej) => { const r = indexedDB.open('beatwave', 2); r.onupgradeneeded = () => { const d = r.result; if (!d.objectStoreNames.contains('songs')) d.createObjectStore('songs', { keyPath: 'id' }); if (!d.objectStoreNames.contains('audio')) d.createObjectStore('audio', { keyPath: 'id' }); if (!d.objectStoreNames.contains('maps')) d.createObjectStore('maps'); }; r.onsuccess = async () => { try { await migrateOldDB(r.result); } catch (e) {} res(r.result); }; r.onerror = () => rej(r.error); }));
  const tx = async (m, f, st = 'songs') => { const d = await open(); return new Promise((res, rej) => { const t = d.transaction(st, m), q = f(t.objectStore(st)); t.oncomplete = () => res(q && q.result); t.onerror = () => rej(t.error); }); };
  return { put: o => tx('readwrite', s => s.put(o)), all: () => tx('readonly', s => s.getAll()), get: id => tx('readonly', s => s.get(id)), mapGet: k => tx('readonly', s => s.get(k), 'maps'), mapPut: (k, v) => tx('readwrite', s => s.put(v, k), 'maps'), audioPut: (id, ab) => tx('readwrite', s => s.put({ id, ab }), 'audio'), audioGet: id => tx('readonly', s => s.get(id), 'audio'),
    del: async id => { const d = await open(); return new Promise((res, rej) => { const t = d.transaction(['songs', 'audio'], 'readwrite'); t.objectStore('songs').delete(id); t.objectStore('audio').delete(id); t.oncomplete = () => res(); t.onerror = () => rej(t.error); }); } }; })();
async function persist(s, f) { if (!s.id || s.id === 'rocket') return; try { const r = await DB.get(s.id); if (r) DB.put({ ...r, ...f }); } catch (e) {} }
async function loadLibrary() {
  try {
    for (const r of await DB.all()) {
      try {
        if (r.pending) { IMPQ.push(r.id); continue; } // importación que se quedó a medias: se retoma
        const base = { id: r.id, title: r.title, artist: r.artist, map: r.map, cover: r.cover ? URL.createObjectURL(r.cover) : undefined, video: r.video ? URL.createObjectURL(r.video) : undefined };
        if (!r.ab && r.dur) { addSong(lazySong(base, r.dur)); continue; } // formato nuevo: sin decodificar hasta jugar
        let ab = r.ab; if (!ab) { const a = await DB.audioGet(r.id); ab = a && a.ab; } if (!ab) continue;
        const buf = await ctx.decodeAudioData(ab.slice(0)); addSong({ ...base, buf });
        if (r.ab) { await DB.audioPut(r.id, r.ab); const { ab: _x, ...rest } = r; rest.dur = buf.duration; await DB.put(rest); } // migra: el audio pasa a su propio almacén
        else await DB.put({ ...r, dur: buf.duration });
      } catch (e) {}
    }
  } catch (e) { showErr('Biblioteca: ' + e.message); }
  renderPls(); if (!PICKED || !vis().includes(sel)) sel = vis()[0] || sel; renderList(); info();
  if (IMPQ.length) { msg('Terminando de importar tus canciones…'); runImports(); }
}
const cclock = () => { const o = ctx.getOutputTimestamp && ctx.getOutputTimestamp(); if (o && o.contextTime > 0 && o.performanceTime > 0) { const v = o.contextTime + (performance.now() - o.performanceTime) / 1000; if (v <= ctx.currentTime + .05) return v; } return ctx.currentTime - (ctx.outputLatency || ctx.baseLatency || 0); };
let CAL = null;
function startCalib() {
  init(); stopPreview(); go('calib'); const sr = ctx.sampleRate, b = ctx.createBuffer(1, sr * .05, sr), d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.sin(2 * Math.PI * 1000 * i / sr) * Math.exp(-i / sr * 80);
  const base = ctx.currentTime + 1.5, ts = []; for (let i = 0; i < 12; i++) { const s = ctx.createBufferSource(); s.buffer = b; s.connect(OUT); s.start(base + i * .6); ts.push(base + i * .6); }
  CAL = { ts, dl: [] }; $('#calText').textContent = 'Toca el recuadro justo cuando oigas cada clic.'; $('#calRes').textContent = '';
}
$('#calPad').onpointerdown = () => {
  if (!CAL) return; const t = cclock(); let bi = -1, bd = .3; CAL.ts.forEach((c0, i) => { const d = Math.abs(t - c0); if (d < bd) { bd = d; bi = i; } }); if (bi < 0) return; CAL.dl.push(t - CAL.ts[bi]);
  if (CAL.dl.length >= 8) { const a = CAL.dl.slice(2).sort((x, y) => x - y), ms = Math.max(-150, Math.min(150, Math.round(a[a.length >> 1] * 200) * 5)); S.latency = ms; lsSet('bwsettings', JSON.stringify(S)); bindSettings(); $('#calRes').textContent = `Listo: latencia ajustada a ${ms} ms.`; CAL = null; }
  else $('#calRes').textContent = `${CAL.dl.length} / 8`;
};
$('#btnCalib').onclick = () => { $('#settings').classList.remove('open'); startCalib(); };
$('#calRetry').onclick = startCalib; $('#calDone').onclick = () => { CAL = null; go('select'); };
modsUI(); renderPls(); diffUI();
$('#setSearch').oninput = e => { const q = e.target.value.toLowerCase(); $$('#settings .panel > [data-cat]').forEach(l => l.style.display = l.textContent.toLowerCase().includes(q) ? '' : 'none'); };

/* ---------- Ajustes y skins ---------- */
function bindSettings() {
  $('#sQual').value = S.qual; $('#sSize').value = S.size; $('#sSpeed').value = S.speed; $('#sLat').value = S.latency; $('#sAuto').checked = S.autoSync !== false;
  $('#sVm').value = S.vm; $('#sMu').value = S.vmu; $('#sSfx').value = S.sfx; $('#sVideo').checked = S.video; $('#sCover').checked = S.cover; $('#sVib').checked = S.vib; $('#sDim').value = S.dim;
  $('#sPauseSize').value = S.pauseSize; $('#sPausePos').value = S.pausePos; $('#sHud').value = Math.round((S.hud || 1) * 100); $('#oHud').textContent = Math.round((S.hud || 1) * 100) + '%'; $('#sTheme').value = S.theme; $('#sN3d').checked = S.n3d !== false; $('#sVfit').value = S.vmode; $('#sVpos').value = String(S.vpos);
  $('#oSize').textContent = S.size + ' px'; $('#oSpeed').textContent = S.speed + 'x (según BPM)'; $('#oLat').textContent = S.latency + ' ms';
  $('#oVm').textContent = Math.round(S.vm * 100) + '%'; $('#oMu').textContent = Math.round(S.vmu * 100) + '%'; $('#oSfx').textContent = Math.round(S.sfx * 100) + '%'; $('#oDim').textContent = Math.round(S.dim * 100) + '%';
  $('#oPauseSize').textContent = S.pauseSize + ' px';
  $('#sPerf').value = String(S.perf || 0); $('#sCb').checked = !!S.cb; $('#sUis').value = Math.round((S.uis || 1) * 100); $('#oUis').textContent = Math.round((S.uis || 1) * 100) + '%';
  $('#sLane').value = Math.round((S.laneA ?? 1) * 100); $('#oLane').textContent = Math.round((S.laneA ?? 1) * 100) + '%'; $('#sRing').value = Math.round((S.ringA ?? 1) * 100); $('#oRing').textContent = Math.round((S.ringA ?? 1) * 100) + '%';
  $$('#settings select').forEach(s => s._sync && s._sync()); $$('#settings input[type=range]').forEach(r => r.style.setProperty('--p', ((r.value - r.min) / (r.max - r.min) * 100) + '%'));
  $('#sTap').checked = S.tapSnd !== false; $('#sHitFx').checked = S.hitFx !== false; $('#sFps30').checked = !!S.fps30; $('#sPrev').checked = S.prev !== false; $('#sShape').value = S.shape || 'round'; $('#sPrac').checked = !!S.prac; $('#sPracAt').value = String(S.pracAt || 0);
  syncWheels();
  $('#bgImgInfo').textContent = S.bgImage ? 'Imagen de ambiente aplicada.' : 'Ninguna imagen seleccionada.';
}
function saveSettings() {
  try { lsSet('bwsettings', JSON.stringify(S)); }
  catch (e) { try { const copy = { ...S, bgImage: null }; lsSet('bwsettings', JSON.stringify(copy)); } catch (e2) {} msg('La imagen es muy pesada: solo durará esta partida.'); }
}
$('#settings').oninput = () => {
  S.qual = +$('#sQual').value; S.size = +$('#sSize').value; S.speed = +$('#sSpeed').value; S.latency = +$('#sLat').value; S.autoSync = $('#sAuto').checked;
  S.vm = +$('#sVm').value; S.vmu = +$('#sMu').value; S.sfx = +$('#sSfx').value; S.video = $('#sVideo').checked; S.cover = $('#sCover').checked; S.vib = $('#sVib').checked; S.dim = +$('#sDim').value;
  { const pf0 = S.perf; S.perf = +$('#sPerf').value; S.cb = $('#sCb').checked; S.uis = +$('#sUis').value / 100; if (S.perf === 0 && pf0 !== 0) { S.autoLite = false; S.autoMin = false; } applyPerf(); applyUis(); }
  S.laneA = +$('#sLane').value / 100; S.ringA = +$('#sRing').value / 100;
  S.tapSnd = $('#sTap').checked; S.hitFx = $('#sHitFx').checked; S.fps30 = $('#sFps30').checked; S.prev = $('#sPrev').checked; S.shape = $('#sShape').value; S.prac = $('#sPrac').checked; S.pracAt = +$('#sPracAt').value;
  S.pauseSize = +$('#sPauseSize').value; S.pausePos = $('#sPausePos').value; S.hud = (+$('#sHud').value || 100) / 100; $('#oHud').textContent = Math.round(S.hud * 100) + '%'; { const o3 = S.n3d; S.theme = $('#sTheme').value; S.n3d = $('#sN3d').checked; S.vmode = $('#sVfit').value; S.vpos = +$('#sVpos').value; applyTheme(); if (o3 !== S.n3d && typeof GFX !== 'undefined' && GFX) { try { buildGfx(GFX.r); } catch (e) {} } }
  applySkin(); applyAccent(); applyPauseUI(); applyVol(); saveSettings(); bindSettings(); info(); if (songs.length) renderList();
  if (G) resize();
};
/* ---- Rueda de color ---- */
const hex2hsv = hx => { const n = parseInt(hx.slice(1), 16), r = (n >> 16) / 255, g = (n >> 8 & 255) / 255, b = (n & 255) / 255, mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn; let h = 0; if (d) h = mx === r ? ((g - b) / d + 6) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; return [h * 60, mx ? d / mx : 0, mx]; };
const hsv2hex = (h, s, v) => { const f = n => { const k = (n + h / 60) % 6; return v - v * s * Math.max(0, Math.min(k, 4 - k, 1)); }; return '#' + [f(5), f(3), f(1)].map(x => Math.round(x * 255).toString(16).padStart(2, '0')).join('').toUpperCase(); };
const WHEELS = [];
const WDEF = {
  cwSkin: { list: SKINS, cur: () => S.skinC || SKINS[S.skin] || SKINS[0], custom: c => { S.skinC = c; }, preset: i => { S.skin = i; S.skinC = null; }, isPreset: i => !S.skinC && S.skin === i, apply: applySkin, after: () => { if (songs.length) { renderList(); info(); } } },
  cwAccent: { list: ACCENTS, cur: () => S.accentC || ACCENTS[S.accent] || ACCENTS[0], custom: c => { S.accentC = c; }, preset: i => { S.accent = i; S.accentC = null; }, isPreset: i => !S.accentC && S.accent === i, apply: applyAccent, after: () => {} }
};
function setupWheel(block, W) {
  const wheel = block.querySelector('.cwWheel'), dot = wheel.querySelector('.cwDot'), light = block.querySelector('.cwLight'), hexEl = block.querySelector('.cwHex'), chips = [...block.querySelectorAll('.cwChips button')], pr = block.querySelector('.cwPresets');
  let slot = 0, hsv = [0, 0, 1], drag = false;
  W.list.forEach((c, i) => { const b = document.createElement('button'); b.className = 'cwP'; b.type = 'button'; b.style.setProperty('--c1', c[0]); b.style.setProperty('--c2', c[1]); b.setAttribute('aria-label', 'Color ' + (i + 1)); b.onclick = () => { W.preset(i); W.apply(); saveSettings(); load(); W.after(); }; pr.append(b); });
  const paint = () => {
    const cs = W.cur(), a = hsv[0] * Math.PI / 180, hx = hsv2hex(hsv[0], hsv[1], hsv[2]);
    dot.style.left = (50 + Math.sin(a) * hsv[1] * 50) + '%'; dot.style.top = (50 - Math.cos(a) * hsv[1] * 50) + '%'; dot.style.background = hx;
    light.value = Math.round(hsv[2] * 100); light.style.setProperty('--p', ((light.value - light.min) / (light.max - light.min) * 100) + '%'); wheel.style.setProperty('--dark', (1 - hsv[2]).toFixed(2)); hexEl.textContent = hx;
    chips.forEach((b, i) => { b.classList.toggle('on', i === slot); b.style.setProperty('--c', cs[i]); });
    [...pr.children].forEach((b, i) => b.classList.toggle('on', W.isPreset(i)));
  };
  const load = () => { hsv = hex2hsv(W.cur()[slot]); paint(); };
  const commit = fin => { const c = W.cur().slice(); c[slot] = hsv2hex(hsv[0], hsv[1], hsv[2]); W.custom(c); W.apply(); paint(); if (fin) { saveSettings(); W.after(); } };
  const pick = e => { const r = wheel.getBoundingClientRect(), dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2); let h = Math.atan2(dx, -dy) * 180 / Math.PI; if (h < 0) h += 360; hsv[0] = h; hsv[1] = Math.min(1, Math.hypot(dx, dy) / (r.width / 2)); commit(false); };
  wheel.addEventListener('pointerdown', e => { drag = true; try { wheel.setPointerCapture(e.pointerId); } catch (x) {} pick(e); e.preventDefault(); });
  wheel.addEventListener('pointermove', e => { if (drag) pick(e); });
  const end = () => { if (drag) { drag = false; commit(true); } };
  wheel.addEventListener('pointerup', end); wheel.addEventListener('pointercancel', end);
  light.addEventListener('input', e => { e.stopPropagation(); hsv[2] = light.value / 100; commit(false); }); light.addEventListener('change', () => commit(true));
  chips.forEach((b, i) => b.onclick = () => { slot = i; load(); });
  WHEELS.push({ sync: () => { if (drag) return; if (hsv2hex(hsv[0], hsv[1], hsv[2]) !== W.cur()[slot].toUpperCase()) load(); else paint(); } });
}
$$('.cw').forEach(b => setupWheel(b, WDEF[b.id]));
function syncWheels() { WHEELS.forEach(w => w.sync()); }
$('#bgImgIn').onchange = e => {
  const f = e.target.files[0]; if (!f) return;
  if (f.size > 500 * 1024) { msg('La imagen es muy pesada, elige una más ligera.'); e.target.value = ''; return; }
  const r = new FileReader(); r.onload = () => { S.bgImage = r.result; saveSettings(); bindSettings(); msg('Imagen de ambiente aplicada'); }; r.readAsDataURL(f); e.target.value = '';
};
$('#bgImgClear').onclick = () => { S.bgImage = null; saveSettings(); bindSettings(); msg('Imagen de ambiente quitada'); };
function showSet(cat) {
  closeSide(); bindSettings(); $('#setSearch').value = '';
  $$('#settings .panel > [data-cat]').forEach(l => l.style.display = cat === 'all' || l.dataset.cat === cat ? '' : 'none');
  $$('#setTabs button').forEach(b => b.classList.toggle('on', b.dataset.cat === cat)); $('#settings').classList.add('open');
}
$$('#setTabs button').forEach(b => b.onclick = () => showSet(b.dataset.cat));
$('#btnGear').onclick = () => showSet('gfx');
const startTut = () => { $('#settings').classList.remove('open'); closeSide(); init(); if (!TUT) { try { TUT = makeTutorial(); } catch (e) {} } if (TUT) begin(TUT); };
$('#btnTutS').onclick = startTut; $('#btnTutS2').onclick = startTut; $('#btnCalib2').onclick = () => { closeSide(); startCalib(); };
$('#nPrev').innerHTML = ico('prev'); $('#nNext').innerHTML = ico('next'); $('#nPlay').innerHTML = ico('pause');
const stepSong = d => { const L = vis(); if (!L.length) return; const i = Math.max(0, L.indexOf(sel)); PICKED = true; sel = L[(i + d + L.length) % L.length]; renderList(); info(); preview(sel); muffle(false); $('#nPlay').innerHTML = ico('pause'); };
$('#nPrev').onclick = () => stepSong(-1); $('#nNext').onclick = () => stepSong(1);
$('#nPlay').onclick = () => { if (PV.src) { stopPreview(); $('#nPlay').innerHTML = ico('play'); } else if (sel) { preview(sel); $('#nPlay').innerHTML = ico('pause'); } };

/* ---------- Menú principal ---------- */
const SESSION0 = Date.now(), MIC = { mExit: 'close', mPlay: 'play', btnHow: 'help', btnSettings: 'gear', mSolo: 'note', mRand: 'dice', mBack: 'back' };

$('#nStop').innerHTML = ico('stop'); $('#nInfo').innerHTML = ico('info'); $('#nMenu').innerHTML = ico('gear');
$('#nStop').onclick = () => { stopPreview(); $('#nPlay').innerHTML = ico('play'); };
$('#nInfo').onclick = () => { if (!sel) return msg('Elige una canción primero.'); const st = stats(sel); dlg('Información', `${sel.title}\n${sel.artist}\nDuración ${fmt(sel.buf.duration | 0)} · ${Math.round(sel.map.bpm || 0)} BPM · ${st.n} notas\nDificultad ${TIERS[st.tier]}`); };
$('#nMenu').onclick = () => showSet('all');
let menuS = 0, menuIdle = Date.now();
const setMenu = n => { menuS = n === true ? 1 : (n || 0); $('#mStage').dataset.s = menuS; $('#menu').classList.toggle('mopen', menuS > 0); menuIdle = Date.now(); };
$('#btnPlay').onclick = async () => { init(); menuIdle = Date.now(); if (menuS === 0 && !localStorage.getItem('bwtut') && !localStorage.getItem('bwtutNo')) { const r = await dlg('¿Quieres iniciar el tutorial?', 'Aprenderás todos los tipos de nota. Si ya sabes jugar, puedes saltarlo.', { btns: ['Sí, iniciar tutorial', 'No, jugar directamente'] }); if (r.i === 0) { await runTour(); return startTut(); } lsSet('bwtutNo', '1'); return go('select'); } if (menuS === 0) setMenu(1); else if (menuS === 1) setMenu(2); else go('select'); };
$('#mPlay').onclick = () => setMenu(2); $('#mBack').onclick = () => setMenu(1); $('#mSolo').onclick = () => go('select');
$('#mRand').onclick = () => { const L = songs.filter(s => !HID.includes(s.id) && !TRASH.includes(s.id)); if (!L.length) return msg('No hay canciones para elegir.'); PICKED = true; sel = L[Math.random() * L.length | 0]; renderList(); info(); showLoading(sel); };
$('#mStage').onclick = e => { if (menuS && !e.target.closest('#btnPlay,#mMenu')) setMenu(0); };
function infoUI() {
  const e = (Date.now() - SESSION0) / 1000 | 0, n = songs.length;
  $('#inf1').textContent = `¡Tienes un total de ${n} ${n === 1 ? 'canción' : 'canciones'}!`;
  $('#inf2').textContent = `Duración de la sesión: ${String(e / 60 | 0).padStart(2, '0')}:${String(e % 60).padStart(2, '0')}`;
  $('#inf3').textContent = `Hora actual: ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
}
(() => { const box = $('#mParts'); const n = LOW ? 8 : 16; for (let i = 0; i < n; i++) { const p = document.createElement('i'); p.textContent = i % 2 ? '+' : '×'; p.style.cssText = `left:${Math.random() * 100}%;top:${Math.random() * 100}%;font-size:${12 + Math.random() * 14}px;animation-duration:${12 + Math.random() * 16}s;animation-delay:${-Math.random() * 20}s`; box.append(p); } })();
let menuRaf = 0, vizS = 300, fpsN = 0, fpsT = 0; const vzh = new Float32Array(120), vz = $('#orbViz'), vc = vz.getContext('2d'), reduceMo = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
function sizeViz() { const o = $('#btnPlay').offsetWidth || 320, px = Math.min(Math.round(o * 1.9), LOW ? 320 : 480); vizS = Math.round(o * 1.9); vz.width = px; vz.height = px; vz.style.width = vz.style.height = vizS + 'px'; vc.setTransform(px / vizS, 0, 0, px / vizS, 0, 0); }
addEventListener('resize', sizeViz);
function menuFrame() {
  menuRaf = 0; if (!$('#menu').classList.contains('active')) return;
  if (LOW && (menuSkip ^= 1)) { menuRaf = requestAnimationFrame(menuFrame); return; }
  const MF = menuFrame.c || (menuFrame.c = { orb: $('#btnPlay'), menu: $('#menu'), prog: $('#nProg i'), fps: $('#fpsB b'), ms: $('#msB'), last: 0, ow: 0, still: false, pw: '' }), orb = MF.orb, now = performance.now(), t = now / 1000;
  let en = 0, ph = 0, prog = 0, playing = false;
  if (PV.src && PV.song && ctx && ctx.state === 'running') {
    playing = true;
    const m = PV.song.map, ts = PV.off + ((ctx.currentTime - PV.t0) % PV.len); prog = ts / PV.song.buf.duration;
    en = .25 + .75 * (m.en ? (m.en[ts * 10 | 0] || 0) : .5);
    if (m.beat0 !== undefined) { const spb = 60 / ((m.bt && m.bt[ts / 8 | 0]) || m.bpm || 120); ph = (((ts - m.beat0) / spb) % 1 + 1) % 1; }
  }
  fpsN++; if (now - fpsT >= 1000) { perfWatch(fpsN, now - fpsT); MF.fps.textContent = fpsN; MF.ms.textContent = ((now - fpsT) / fpsN).toFixed(1) + 'ms'; fpsN = 0; fpsT = now; infoUI(); if (menuS && Date.now() - menuIdle > 10000) setMenu(0); }
  if (!playing && MF.still && now - MF.last < 66) { menuRaf = requestAnimationFrame(menuFrame); return; } MF.last = now;
  const pulse = playing ? Math.exp(-ph * 5) : 0, sc = 1 + .035 * en + .06 * pulse * en, jit = reduceMo ? 0 : pulse * en * 2.4;
  orb.style.transform = `translate(${(Math.random() - .5) * 2 * jit}px,${(Math.random() - .5) * 2 * jit}px) scale(${sc})`;
  if ((playing && pulse > .8 && now - lastWave > 450) || (!playing && now - lastWave > 3400)) { lastWave = now; spawnWave(); }
  mx += (PTR.x - mx) * .07; my += (PTR.y - my) * .07; { const px = mx.toFixed(3), py = my.toFixed(3), key = px + py; if (key !== MF.pk) { MF.pk = key; MF.menu.style.setProperty('--px', px); MF.menu.style.setProperty('--py', py); } }
  { const w = (Math.min(1, prog) * 100).toFixed(1) + '%'; if (w !== MF.pw) { MF.pw = w; MF.prog.style.width = w; } }
  const ow = MF.ow || (MF.ow = orb.offsetWidth || 320), c0 = vizS / 2, k = ow / 320, hw = ow / 2 * sc, N = LOW ? 48 : 72, r0 = hw * 1.07 + 6 * k;
  if (!vzCol || now - vzColT > 1500) { const cs = getComputedStyle(document.documentElement); vzCol = [cs.getPropertyValue('--accent').trim() || '#63F2A8', cs.getPropertyValue('--accent2').trim() || '#4D8DF5']; vzColT = now; }
  vc.clearRect(0, 0, vizS, vizS); let vmax = 0; const N3 = N / 3, cols = ['#FF4D8D', vzCol[0], '#FFD166']; vc.lineWidth = Math.max(3, r0 * 2 * Math.PI / N * .52); vc.lineCap = 'round';
  for (let q = 0; q < 3; q++) { // tres abanicos, uno por carril (rosa, cian y amarillo), con huecos entre ellos
    vc.strokeStyle = cols[q]; vc.beginPath();
    for (let j = 0; j < N3; j++) {
      const i = q * N3 + j, m = i < N / 2 ? i : N - 1 - i, nz = Math.abs(Math.sin(t * 2.2 + m * .83)) * Math.abs(Math.cos(t * 1.4 + m * .31)), tg = (en || 0) * (.2 + .8 * nz) * (1 + pulse * .8);
      vzh[i] += (tg - vzh[i]) * (tg > vzh[i] ? .5 : .12); if (vzh[i] > vmax) vmax = vzh[i];
      if (j === 0 || j === N3 - 1) continue;
      const a = i / N * Math.PI * 2 - Math.PI / 2, bh = (4 + 50 * vzh[i]) * k, ca = Math.cos(a), sa = Math.sin(a); vc.moveTo(c0 + ca * r0, c0 + sa * r0); vc.lineTo(c0 + ca * (r0 + bh), c0 + sa * (r0 + bh));
    }
    vc.stroke();
  }
  MF.still = vmax < .02;
  menuRaf = requestAnimationFrame(menuFrame);
}
addEventListener('resize', () => { if (menuFrame.c) menuFrame.c.ow = 0; });
$('#btnSettings').onclick = () => showSet('all');
const closeSet = () => { try { saveSettings(); } catch (e) {} $('#settings').classList.remove('open'); };
$('#btnCloseSet').onclick = closeSet; $('#setX').onclick = closeSet;

/* ---------- Partida ---------- */
const cv = $('#cv'), c = cv.getContext('2d', { desynchronized: true }), vid = $('#bgVideo'), hS = $('#hScore'), hA = $('#hAcc'), fld = $('#field');
function layoutField() { const { pw, x0, lw, hy } = geo(); fld.style.left = x0 + 'px'; fld.style.width = pw + 'px'; fld.innerHTML = `<i style="left:${lw - 1 | 0}px"></i><i style="left:${lw * 2 - 1 | 0}px"></i><b style="top:${hy - 1}px"></b>`; }
let W = 0, H = 0;
function resize() {
  let r;
  if (S.qual === 1) r = Math.min(devicePixelRatio || 1, 2) * QH;
  else if (S.qual === 2) r = Math.min(devicePixelRatio || 1, .75);
  else if (S.qual === 3) r = Math.min(devicePixelRatio || 1, 1);
  else r = Math.min(devicePixelRatio || 1, LOW ? 1 : 1.25) * Q;
  if (minTier()) r = Math.min(devicePixelRatio || 1, 1) * .55;
  W = innerWidth || document.documentElement.clientWidth || 360;
  H = innerHeight || document.documentElement.clientHeight || 640;
  GEO = null;
  cv.width = W * r | 0;
  cv.height = H * r | 0;
  c.setTransform(r, 0, 0, r, 0, 0);
  layoutField();
  if (G) { buildGfx(r); GFX.cover = minTier() ? null : mkCover(G.song, r); }
}
addEventListener('resize', resize); addEventListener('orientationchange', () => setTimeout(resize, 200));
let GEO = null;
const geo = () => GEO || (GEO = (() => { const pw = Math.min(W, 480), lw = pw / LANES; const hy = H * .8 | 0; return { pw, x0: (W - pw) / 2 | 0, lw, hy, hor: (-12 - hy * .4545) / .5455, sz: Math.min(S.size, lw - 8, H * .13) | 0 }; })());
const lanePos = (o, n) => o.type !== 'slide' ? o.lane : o.lane + (o.to - o.lane) * Math.min(1, Math.max(0, (n - o.t) / (o.d || 1)));
const laneX = l => { const g = geo(); return g.x0 + g.lw * (l + .5); };
function aclock() {
  if (ctx.getOutputTimestamp) {
    const o = ctx.getOutputTimestamp();
    if (o.contextTime > 0 && o.performanceTime > 0) { const v = o.contextTime + (performance.now() - o.performanceTime) / 1000; if (v <= ctx.currentTime + .05) return G.ck = Math.max(G.ck, v); }
  }
  return G.ck = Math.max(G.ck, ctx.currentTime - G.lat);
}
const T = () => performance.now() / 1000;
const now = () => (aclock() - G.t0 - S.latency / 1000) * G.rate - (G.song.map.offset || 0) + (G.off || 0);

// ★ SIN COUNTDOWN AL INICIO
function paintGameBg(song, showV) {
  const g = $('#game'), d = S.dim;
  if (showV) { g.style.background = '#05050a'; return; } // con video no se muestra la portada detrás (evita el texto duplicado)
  if (S.bgImage) g.style.background = `linear-gradient(rgba(0,0,0,${d}),rgba(0,0,0,${Math.min(.95, d + .25)})),url(${S.bgImage}) center/cover`;
  else g.style.background = S.cover && song.cover ? `linear-gradient(rgba(0,0,0,${d}),rgba(0,0,0,${Math.min(.95, d + .25)})),url(${song.cover}) center/cover` : isLT() ? 'linear-gradient(#0f4a2a,#051a0d)' : `linear-gradient(rgba(0,0,0,${d}),rgba(0,0,0,${Math.min(.98, d + .15)})),var(--theme) center/cover`;
}
function applyBgLive() {
  if (!G) return; const song = G.song, showV = !!(S.video && song.video && !lite2() && !G.off);
  vid.style.opacity = Math.max(0, 1 - S.dim); bb.style.opacity = Math.max(0, 1 - S.dim) * .8; vid.style.display = showV ? 'block' : 'none';
  if (showV && !vid.getAttribute('src')) { vid.src = song.video; vid.currentTime = Math.max(0, G.fz || 0); }
  if (!showV) bb.style.display = 'none'; paintGameBg(song, showV);
}
function begin(song) {
  init(); stop(); stopPreview();
  const rp = RPLY && Date.now() - RPLY.arm < 60000 ? RPLY : null; RPLY = null;
  if (rp) { rp.keep = { mods: S.mods, diff: S.diff, speed: S.speed, lnLen: S.lnLen }; Object.assign(S, { mods: { ...rp.snap.mods }, diff: rp.snap.diff, speed: rp.snap.speed, lnLen: rp.snap.lnLen }); song.st = null; } // la repetición usa los ajustes de aquella partida
  if (!song.tut && !rp) { LAST[fkey(song)] = Date.now(); lsSet('bwlast', JSON.stringify(LAST)); }
  Q = 1; QH = 1;
  fld.classList.remove('gold');
  const raw = song.map.notes || buildMap(song.map, S.mods || {}, song.tut);
  const PR = !song.tut && !rp && !!S.prac, POFF = PR ? Math.floor(song.buf.duration * (+S.pracAt || 0) / 100) : 0;
  const notes = raw.map(n => ({ ...n, d: n.d || 0, to: n.to ?? n.lane, dir: n.dir ?? (n.lane === 2 ? -1 : 1), state: 0, on: 0, off: 0 })).filter(o => o.t >= POFF - .05).sort((a, b) => a.t - b.t); notes.forEach((o, i) => o.ix = i);
  const mods = song.tut ? {} : S.mods || {}, perm = (rp && rp.perm) ? rp.perm : mods.rand ? [0, 1, 2].sort(() => Math.random() - .5) : mods.mirror ? [2, 1, 0] : [0, 1, 2];
  if (mods.rand || mods.mirror) notes.forEach(o => { o.lane = perm[o.lane]; o.to = perm[o.to]; if (o.type === 'flick' && mods.mirror) o.dir = -o.dir; });
  const cn = {}; notes.forEach(o => cn[o.type] = (cn[o.type] || 0) + 1);
  const tp = notes.filter(n => n.type === 'tap');
  tp.forEach(a => { const g = tp.filter(b => Math.abs(b.t - a.t) < .03); if (g.length > 1) a.chord = [Math.min(...g.map(b => b.lane)), Math.max(...g.map(b => b.lane))]; });
  
  const LEAD = (Math.min(2.4, Math.max(1.2, 60 / (song.map.bpm || 120) * 4)) / S.speed + .4) / ((mods.fast ? 1.25 : 1) * (mods.slow ? .8 : 1));
  G = { song, notes, unit: 1, diff: S.diff | 0, revives: 0, pv: 1e6 / Math.max(1, notes.length), mult: Object.keys(MV).reduce((a, k) => a * (mods[k] ? MV[k] : 1), 1), rate: (mods.fast ? 1.25 : 1) * (mods.slow ? .8 : 1), modsTxt: Object.keys(mods).filter(k => mods[k] && MN[k]).map(k => MN[k]).join(' · '), modIco: modIcons(Object.keys(mods).filter(k => mods[k] && MN[k])), hid: !!mods.hid, wm: mods.strict ? .45 : mods.wide ? 1.5 : 1, auto: !!mods.auto, info: `Notas ${notes.length} · LN ${cn.ln || 0} · Slide ${cn.slide || 0} · Flick ${cn.flick || 0}`, i: 0, prac: PR, off: POFF, bpm: song.map.bpm || 120, t0: ctx.currentTime + LEAD, frz: false, fz: 0, perf: 0, great: 0, good: 0, miss: 0, score: 0, combo: 0, max: 0, pop: null,
    st: 0, stg: null, hp: 1, failed: false, od: 0, odOn: false, fx: [], flash: [0, 0, 0], held: [0, 0, 0], pt: new Map(), last: -2, lat: ctx.outputLatency || ctx.baseLatency || 0, paused: false, pausedAt: 0, ck: G ? G.ck : -9, tutI: 0, cfx: [], vc: 0, hT: 0, fa: 16, fc: 0, lp: performance.now(), hud: '', end: song.buf.duration + .5 };
  G.ck = 0; G.snap = { mods: { ...(song.tut ? {} : S.mods || {}) }, diff: S.diff, speed: S.speed, lnLen: S.lnLen }; G.perm = perm; G.rec = {}; G.dmult = diffMult(notes, lvOf(mods, song.tut), song.tut); if (rp) G.rp = rp;
  
  const showV = S.video && song.video && !lite2() && !POFF; vid.style.display = showV ? 'block' : 'none'; vid.style.opacity = Math.max(0, 1 - S.dim); vid.playbackRate = G.rate;
  vid.muted = true; vid.disablePictureInPicture = true; vid.playsInline = true; vid.style.objectPosition = (S.vpos ?? 50) + '% 50%'; bb.style.opacity = Math.max(0, 1 - S.dim) * .8;
  const fitV = () => { const land = vid.videoWidth > vid.videoHeight, m = S.vmode || 'auto', contain = m === 'contain' || (m === 'auto' && land); vid.style.objectFit = contain ? 'contain' : 'cover'; bb.style.display = showV && contain ? 'block' : 'none'; };
  vid.onloadedmetadata = fitV; fitV();
  if (showV) { vid.src = song.video; vid.currentTime = 0; setTimeout(() => G && vid.play().catch(() => {}), LEAD * 1000); }
  paintGameBg(song, showV);
  $('#btnPause').innerHTML = ico('pause');
  go('game');
  try { resize(); } catch (e) { showErr('Gráficos: ' + e.message); stop(); return go('select'); }
  
  // Arranca directamente sin countdown
  G.src = ctx.createBufferSource(); G.src.buffer = song.buf; G.src.connect(MUS); G.src.playbackRate.value = G.rate; G.src.start(G.t0, POFF); loop();
}

function ensureCountdown() {
  let ov = document.getElementById('countdownOverlay');
  if (!ov) {
    ov = document.createElement('div');
    ov.id = 'countdownOverlay';
    ov.innerHTML = '<span>3</span>';
    const gameScreen = document.getElementById('game');
    if (gameScreen) gameScreen.appendChild(ov);
  }
  return ov;
}
function showCountdown(n) {
  const ov = ensureCountdown();
  ov.querySelector('span').textContent = String(n);
  ov.classList.add('show');
  const sp = ov.querySelector('span');
  sp.style.animation = 'none'; void sp.offsetWidth; sp.style.animation = '';
}
function hideCountdown() {
  const ov = document.getElementById('countdownOverlay');
  if (ov) ov.classList.remove('show');
}

function stop() {
  if (G && G.rp && G.rp.keep) { Object.assign(S, G.rp.keep); G.rp.keep = null; }
  cancelAnimationFrame(raf);
  raf = 0;
  $('#pauseMenu').classList.remove('open');
  $('#tutModal').classList.remove('open');
  hideCountdown();
  if (G && G.src) { try { G.src.stop(); } catch (e) {} }
  try { vid.pause(); } catch (e) {}
  if (ctx && ctx.state === 'suspended') { try { ctx.resume(); } catch (e) {} }
  G = null;
}

function pause() {
  if (!G || G.paused) return;
  G.fz = now(); G.frz = true;
  G.paused = true;
  G.pt.clear();
  try { if (G.src) { G.src.stop(); G.src.disconnect(); } } catch (e) {}
  G.src = null;
  try { ctx.suspend(); } catch (e) {}
  try { vid.pause(); } catch (e) {}
  $('#pauseMenu').classList.remove('quick'); $('#pauseMenu').classList.add('open');
}

function resume() {
  if (!G || !G.paused) return;
  $('#pauseMenu').classList.remove('open');
  let n = 3;
  showCountdown(n);
  const tick = () => {
    n--;
    if (n > 0) { showCountdown(n); setTimeout(tick, 1000); }
    else {
      hideCountdown();
      try { ctx.resume(); } catch (e) {}
      const ctxElapsed = Math.max(0, (G.fz - (G.off || 0) + (G.song.map.offset || 0)) / G.rate + S.latency / 1000);
      const offset = Math.max(0, Math.min(G.song.buf.duration, ctxElapsed * G.rate + (G.off || 0)));
      G.t0 = ctx.currentTime - ctxElapsed + .05;
      G.ck = 0;
      if (G.src) { try { G.src.stop(); } catch (e) {} G.src = null; }
      G.src = ctx.createBufferSource(); G.src.buffer = G.song.buf; G.src.connect(MUS);
      G.src.playbackRate.value = G.rate;
      G.src.start(ctx.currentTime + .05, offset);
      if (vid.src && vid.style.display === 'block') { try { vid.currentTime = offset; vid.play().catch(() => {}); } catch (e) {} }
      G.frz = false; G.paused = false;
      G.last = G.fz;
      loop();
    }
  };
  setTimeout(tick, 1000);
}
$('#btnPause').onclick = pause; $('#pResume').onclick = resume;
$('#pRetry').onclick = () => { const s = G.song; stop(); begin(s); };
$('#pExit').onclick = () => { stop(); go('select'); };
document.addEventListener('visibilitychange', () => document.hidden && pause());

/* ---------- Juicio ---------- */
const PITCH = { tap: 1400, ln: 900, slide: 1100, flick: 2000 };
function judge(d, type, lane, e) {
  if (!G) return;
  const k = d < (WIN.perf * G.wm) ? 'perf' : d < (WIN.great * G.wm) ? 'great' : 'good';
  G[k]++; G.combo++; if (G.combo % 25 === 0) G.cfx.push({ t: T(), n: G.combo, v: Math.min(4, G.combo / 25 | 0) }); G.hp = Math.min(1, G.hp + .015); G.max = Math.max(G.max, G.combo);
  { const W = { perf: 300, great: 100, good: 50 }[k]; G.score += W * (1 + Math.min(G.combo, 100) / 100) * G.mult; } // valor del golpe × bono de combo (hasta ×2 con 100 de combo) × multiplicador de mods: más notas = más puntos
  G.od = Math.min(1, G.od + (k === 'good' ? .015 : .03)); if (G.od >= 1 && !G.odOn) { G.odOn = true; G.pop = { k: 'overdrive', t: T() }; } else G.pop = { k, t: T(), e: k === 'perf' ? 0 : e };
  G.fx.push({ l: lane, t: T(), k: type }); sfx(PITCH[type]); if (S.vib && navigator.vibrate) navigator.vibrate(6);
}
function holdTick(o, dt) { o.tk = (o.tk || 0) + dt; while (o.tk >= .25) { o.tk -= .25; G.score += 10 * G.mult; } } // como los ticks de slider de osu!: 10 puntos; al terminar la nota larga, 30
function miss() { if (!G) return; G.miss++; G.combo = 0; G.hp = Math.max(0, G.hp - .07); playWav('miss', 1, .8); G.od = Math.max(0, G.od - .2); G.pop = { k: 'miss', t: T() }; }
const acc = () => { if (!G) return 100; const n = G.perf + G.great + G.good + G.miss; return n ? (300 * G.perf + 100 * G.great + 50 * G.good) / (300 * n) * 100 : 100; }; // precisión de osu!
function rankOf(c, mods) { // rango según la precisión (igual que osu!mania): SS 100 %, S ≥95, A ≥90, B ≥80, C ≥70, D menos. S★ = S con Estrictas, Rápido u Oculto.
  const n = c.perf + c.great + c.good + c.miss; if (!n) return 'D'; const a = (300 * c.perf + 100 * c.great + 50 * c.good) / (300 * n) * 100;
  if (c.perf === n) return 'SS'; if (a >= 95) return mods && (mods.strict || mods.fast || mods.hid) ? 'S★' : 'S'; return a >= 90 ? 'A' : a >= 80 ? 'B' : a >= 70 ? 'C' : 'D'; }
const osuRank = g => rankOf(g, (g.snap && g.snap.mods) || {});
const rkh = r => r === 'S★' ? 'S<svg class="rst" viewBox="0 0 24 24"><path d="M12 2l2.9 6.6 7.1.6-5.4 4.7 1.6 7-6.2-3.7-6.2 3.7 1.6-7L2 9.2l7.1-.6z"/></svg>' : r;
function diffMult(notes, lv, tut) { // multiplicador de dificultad de osu!: redondeo((HP + OD + CS + notas por segundo×8 [0–16]) / 38 × 5), de 2 a 6
  if (tut || !notes.length) return 3; const HP = [3, 5, 7, 8][lv], OD = [3, 5, 7, 9][lv], CS = [3, 4, 4, 5][lv]; let drain = 0; for (let i = 1; i < notes.length; i++) { const g = notes[i].t - notes[i - 1].t; if (g < 5) drain += g; } drain = Math.max(10, drain);
  return Math.max(2, Math.min(6, Math.round((HP + OD + CS + Math.min(16, Math.max(0, notes.length / drain * 8))) / 38 * 5))); }

/* ---------- Entrada ---------- */
const cxOf = (x, y) => { const g = geo(), sc = Math.max(.35, Math.min(1.3, (y - g.hor) / (g.hy - g.hor))); return W / 2 + (x - W / 2) / sc; };
const laneOf = (x, y) => { const g = geo(); return Math.max(0, Math.min(LANES - 1, Math.floor((cxOf(x, y) - g.x0) / g.lw))); };
function nearest(l, n, fn) {
  if (!G) return null;
  let best = null, bd = (WIN.good * G.wm);
  for (let i = G.i; i < G.notes.length; i++) { const o = G.notes[i]; if (o.t > n + (WIN.good * G.wm)) break; const d = Math.abs(o.t - n); if (o.state === 0 && o.lane === l && fn(o) && d < bd) { bd = d; best = o; } }
  return best && { o: best, d: bd, e: best.t - n };
}
function flickHit(l, dir) { const r = nearest(l, now(), o => o.type === 'flick' && (!dir || o.dir === dir)); if (r) { r.o.state = 1; recHit(r.o, r.e); judge(r.d, 'flick', l, r.e); G.fx[G.fx.length - 1].dir = r.o.dir; } }
function down(id, l, x, flick) {
  if (!G || G.paused || G.rp) return; const n = now(); G.flash[l] = 1; const p = { lane: l, from: l, t: n, x0: x, x, note: null }; G.pt.set(id, p);
  if (flick) return flickHit(l);
  const r = nearest(l, n, o => o.type !== 'flick'); if (!r) return;
  recHit(r.o, r.e); judge(r.d, r.o.type, l, r.e); if (r.o.type === 'tap') r.o.state = 1; else { r.o.state = 2; p.note = r.o; }
}
function up(id) {
  if (!G) return; const p = G.pt.get(id); if (!p) return; G.pt.delete(id); const n = now();
  if (p.note && p.note.state === 2) endHold(p.note, p, n);
}
function endHold(o, p, n) { if (!G) return; const ok = n >= o.t + o.d - .25 && (o.type !== 'slide' || o.on / ((o.on + o.off) || 1) >= .5); o.state = 1; p.note = null; if (ok) { G.score += 30 * G.mult; sfx(700); } else { if (G.rec && G.rec[o.ix]) G.rec[o.ix][1] = 1; miss(); } }
function recHit(o, e) { if (G && !G.rp && G.rec) G.rec[o.ix] = [Math.round(e * 1000), 0]; }
cv.addEventListener('pointerdown', e => { e.preventDefault(); cv.setPointerCapture(e.pointerId); down(e.pointerId, laneOf(e.clientX, e.clientY), cxOf(e.clientX, e.clientY)); });
cv.addEventListener('pointermove', e => {
  const p = G && G.pt.get(e.pointerId); if (!p) return; p.x = cxOf(e.clientX, e.clientY); p.lane = laneOf(e.clientX, e.clientY);
  const dx = p.x - p.x0; if (!p.flick && !p.note && Math.abs(dx) > 14) { p.flick = true; p.fdir = dx > 0 ? 1 : -1; flickHit(p.from, p.fdir); }
});
['pointerup', 'pointercancel'].forEach(t => cv.addEventListener(t, e => up(e.pointerId)));
cv.addEventListener('contextmenu', e => e.preventDefault());
addEventListener('keydown', e => { if (e.key === 'Escape') return G && (G.paused ? resume() : pause()); const l = KEYS[e.key.toLowerCase()]; if (l !== undefined && !e.repeat) { e.preventDefault(); down('k' + e.key, l, undefined, e.shiftKey); } });
addEventListener('keyup', e => { if (KEYS[e.key.toLowerCase()] !== undefined) up('k' + e.key); });

/* ---------- Bucle ---------- */
const fxOn = () => S.qual !== 2 && !lite2();
function loop() {
  if (!G) return;
  raf = requestAnimationFrame(loop);
  if ((lite2() || S.fps30) && !G.paused) { const tn = performance.now(); if (tn - (G.t30 || 0) < 28) return; G.t30 = tn; } // modo ahorro: máximo ~30 cuadros por segundo
  try { frame(); } catch (e) { showErr('Frame: ' + e.message); const tn = performance.now(); if (G && tn - (G.er || 0) > 3000) { G.er = tn; resize(); } }
}
function frame() {
  if (!G) return;
  if (ctx.state !== 'running' && !G.paused) ctx.resume();
  const n = G.frz ? G.fz : now(), dt = Math.min(.1, Math.max(0, n - G.last)); G.last = n;
  const pn = performance.now(), ft = Math.min(100, pn - G.lp); G.lp = pn;
  if ((S.qual === 0 || S.qual === 1) && !G.paused && !document.hidden) { // ajuste automático (en «Alta» solo baja la densidad de píxeles, sin quitar efectos, hasta 1×): baja la calidad por escalones hasta que el equipo aguante
    const cap30 = lite2() || S.fps30, tgt = cap30 ? 33.4 : 16.7; G.fn = (G.fn || 0) + 1; G.fa = G.fa * .9 + Math.min(ft, tgt * 2.5) * .1;
    if (G.fn > 45 && ++G.fc > 20 && G.fa > tgt * 1.3) {
      G.fc = 0; const bad = G.fa > tgt * 2.2;
      if (S.qual === 1) { const qhMin = 1 / Math.min(devicePixelRatio || 1, 2); if (QH > qhMin + .01) { QH = Math.max(qhMin, QH * (bad ? .72 : .86)); G.fa = tgt; resize(); } }
      else if (Q > .4 && !minTier()) { Q = Math.max(.4, Q - (bad ? .3 : .15)); G.fa = tgt; resize(); }
      else if (S.perf === 0 && !S.autoLite) { S.autoLite = true; saveSettings(); applyPerf(); G.fa = 33.4; resize(); msg('Modo ahorro activado para que vaya más fluido.'); }
      else if (S.perf === 0 && !S.autoMin) { S.autoMin = true; saveSettings(); applyPerf(); G.fa = 33.4; resize(); msg('Modo mínimo activado: este equipo es muy lento. Puedes cambiarlo en Ajustes → Gráficos.'); }
    }
  }
  if (!G.paused) {
    if (n > G.end) return finish();
    if (G.hp <= 0 && !G.auto && !G.song.tut && !G.failed && !(S.mods && S.mods.nf)) { if (reviveOffer()) return; G.failed = true; finish(); return msg('Te quedaste sin vida'); }
    const sg = stageOf(Math.max(0, n) / G.song.buf.duration); if (sg !== G.st) { G.st = sg; G.stg = { t: T(), i: sg }; }
    if (G.song.tut && G.tutI < G.song.map.tutorial.length) {
      const st = G.song.map.tutorial[G.tutI], ap0 = Math.min(2.4, Math.max(1.2, 60 / G.bpm * 4)) / S.speed;
      if ((st.at - n) / ap0 <= 1) { G.tutI++; return showTut(st); }
    }
    const ns = G.notes;
    if (G.rp) for (let i = G.i; i < ns.length; i++) { // repetición: reproduce cada golpe grabado, igual de pronto o de tarde que fue
      const o = ns[i]; if (o.t > n + .3) break; const r = G.rp.m[i];
      if (o.state === 0 && r && n >= o.t - r[0] / 1000) { judge(Math.abs(r[0]) / 1000, o.type, o.lane, r[0] / 1000); if (o.type === 'flick') G.fx[G.fx.length - 1].dir = o.dir; G.flash[o.lane] = 1; if (o.type === 'tap' || o.type === 'flick') o.state = 1; else { o.state = 2; o.auto = true; } }
      else if (o.state === 2 && o.auto) { if (r && r[1]) { if (n >= o.t + o.d * .5) { o.state = 1; miss(); } } else { holdTick(o, dt); if (n >= o.t + o.d) { o.state = 1; G.score += 30; sfx(700); } } }
    }
    if (G.auto) for (let i = G.i; i < ns.length && ns[i].t <= n; i++) {
      const o = ns[i];
      if (o.state === 0) { judge(0, o.type, Math.round(lanePos(o, n)), 0); if (o.type === 'flick') G.fx[G.fx.length - 1].dir = o.dir; G.flash[o.lane] = 1; if (o.type === 'tap' || o.type === 'flick') o.state = 1; else { o.state = 2; o.auto = true; } }
      else if (o.state === 2 && o.auto && n >= o.t + o.d) { o.state = 1; G.score += 30; sfx(700); }
    }
    while (G.i < ns.length && ns[G.i].state === 1 && ns[G.i].t + ns[G.i].d < n - .3) G.i++;
    for (let i = G.i; i < ns.length && ns[i].t < n - (WIN.good * G.wm); i++) if (ns[i].state === 0) { ns[i].state = 1; miss(); }
    G.pt.forEach(p => {
      const o = p.note; if (!o) return; if (n >= o.t + o.d) return endHold(o, p, n);
      if (o.type !== 'slide' || Math.abs((p.x ?? laneX(p.lane)) - laneX(lanePos(o, n))) < geo().lw * 1) {
        o.on += dt; holdTick(o, dt);
        if ((o.tk = (o.tk || 0) + dt) > .25) { o.tk = 0; G.fx.push({ l: Math.round(lanePos(o, n)), t: T() }); }
      } else o.off += dt;
    });
    if (G.odOn) { G.od -= dt / 8; if (G.od <= 0) { G.od = 0; G.odOn = false; } }
  }
  { const d0 = performance.now(); draw(n); G.dm = (G.dm || 0) * .9 + (performance.now() - d0) * .1; G.ft = (G.ft || 16.7) * .9 + ft * .1; }
  if (bb.style.display === 'block' && (G.bq = (G.bq || 0) + 1) % 3 === 0) { try { bctx.drawImage(vid, 0, 0, 64, 36); } catch (e) {} }
  if (vid.style.display === 'block' && n > 0 && ++G.vc % 12 === 0) { const dv = n - vid.currentTime, ad = Math.abs(dv); if (ad > .8) vid.currentTime = n; else if (ad > .07) vid.playbackRate = G.rate * (dv > 0 ? 1.06 : .94); else if (vid.playbackRate !== G.rate) vid.playbackRate = G.rate; }
  if (pn - G.hT > 120) { G.hT = pn; const h = `Precision: ${acc().toFixed(2)}%`, k = G.score + h; if (k !== G.hud) { G.hud = k; hS.textContent = String(G.score).padStart(7, '0'); hA.textContent = h; } }
}

let RESVIEW = false, RESREP = null;
function paintResult(g, a, rank, rc, isRecord, isPerfect) {
  $('#resBody').innerHTML = `<div class="rtop"><div class="ring"><svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="46"/><circle class="fg" cx="50" cy="50" r="46" style="stroke-dasharray:${a * 2.89} 289"/></svg><div class="cv">${thumb(g.song)}</div></div><div class="rk2${isPerfect ? ' perfect' : ''}" style="color:${rc}">${rkh(rank)}</div></div><h3></h3><p class="ar"></p>
    <div class="sc"><small>PUNTAJE</small><b>${(g.score | 0).toLocaleString()}</b><span class="newBest${isRecord ? ' on' : ''}">NUEVO RÉCORD</span></div>
    <div class="hits"><div style="--c:#00E5FF"><small>PERFECT</small><b>${g.perf}×</b></div><div style="--c:#7CFFB2"><small>GREAT</small><b>${g.great}×</b></div><div style="--c:#FFD166"><small>GOOD</small><b>${g.good}×</b></div><div style="--c:#FF4D6D"><small>MISS</small><b>${g.miss}×</b></div></div>
    <div class="ends"><div><small>COMBO MÁX.</small><b>${g.max}×</b></div><div><small>PRECISIÓN</small><b>${a.toFixed(2)}%</b></div></div>
    <div class="rk">${g.failed ? 'Te quedaste sin vida. ' : ''}${g.mult !== 1 ? 'Mods ×' + g.mult.toFixed(2) + ' ' : ''}${g.auto ? 'AUTO (no cuenta)' : ''}${g.rp ? 'REPETICIÓN (no cuenta)' : ''}${g.prac ? 'MODO PRÁCTICA (no cuenta)' : ''}</div>`;
  if (g.coins) { const d = el('div', 'coinRow'); d.innerHTML = ico('coin') + ' +' + g.coins + ' monedas'; $('#resBody').append(d); }
  const sy = syncInfo(g); if (sy) { const d = el('div', 'syncRow'); d.append(el('span', '', sy.txt + (g.autoAdj ? ' · sincronía ajustada sola: ' + (g.autoAdj > 0 ? '+' : '') + g.autoAdj + ' ms' : ''))); if (!RESVIEW && !g.autoAdj && Math.abs(sy.ms) >= 8) { const b = el('button', '', 'Ajustar sincronía'); b.onclick = () => { S.latency = Math.max(-250, Math.min(250, Math.round((S.latency || 0) - sy.ms))); try { saveSettings(); } catch (e) {} b.disabled = true; b.textContent = 'Ajustado: ' + S.latency + ' ms'; }; d.append(b); } $('#resBody').append(d); }
}
function syncInfo(g) { // desfase medio de tus golpes (ms): + = tocas antes de tiempo, − = tocas tarde
  if (!g.rec) return null; const v = Object.values(g.rec).map(x => x[0]).filter(x => Math.abs(x) < 200); if (v.length < 12) return null; const ms = Math.round(v.reduce((a, b) => a + b, 0) / v.length);
  return { ms, txt: Math.abs(ms) < 8 ? 'Sincronía: muy bien (±' + Math.abs(ms) + ' ms)' : 'Tus golpes llegan ' + Math.abs(ms) + ' ms ' + (ms > 0 ? 'antes' : 'después') + ' de la nota' }; }
function autoSync(g) { // ajusta solo la compensación de latencia según cómo tocas (mediana de tus golpes); devuelve los ms corridos
  if (S.autoSync === false || g.auto || g.prac || g.rp || g.song.tut || !g.rec) return 0;
  const v = Object.values(g.rec).map(x => x[0]).filter(x => Math.abs(x) < 150); if (v.length < 40) return 0;
  v.sort((a, b) => a - b); const md = v[v.length >> 1]; if (Math.abs(md) < 10) return 0;
  const step = Math.round(md * .6), nl = Math.max(-300, Math.min(300, (S.latency || 0) - step)); if (nl === S.latency) return 0;
  S.latency = nl; try { $('#sLat').value = nl; saveSettings(); } catch (e) {} return nl - (nl + step);
}
function finish() {
  const g = G; stop(); G = g;
  const a = acc(), rank = g.failed ? 'F' : osuRank(g), rc = RC[rank];
  if (g.song.tut) { lsSet('bwtut', '1'); showPin(); }
  let isRecord = false;
  if (!g.song.tut && !g.auto && !g.failed && !g.rp && !g.prac) {
    const k = fkey(g.song), r = REC[k] || { plays: 0 }; r.plays++; r.last = Date.now();
    if (!r.best || r.sv !== 3 || g.score > r.best) { Object.assign(r, { sv: 3, best: g.score | 0, acc: +a.toFixed(2), rank, max: g.max, perf: g.perf, great: g.great, good: g.good, miss: g.miss }); isRecord = true; }
    REC[k] = r; lsSet('bwrec', JSON.stringify(REC));
  }
  $('#result').style.setProperty('--acc', rc); repHooks(g, a, rank, isRecord); whoosh(!!g.failed); countUp(); onRunEnd(g); try { afterRun(g, a, rank); } catch (e) {}
  const isPerfect = rank === 'S' || rank === 'SS' || rank === 'S★'; RESVIEW = false; g.autoAdj = autoSync(g); g.coins = awardCoins(g, a); paintResult(g, a, rank, rc, isRecord, isPerfect);
  $('#resBody h3').textContent = g.song.title; $('#resBody .ar').textContent = g.song.artist;
  LASTRES = { g, a, rank, rc }; RESREP = LASTREP && LASTREP.song === g.song ? LASTREP : null; $('#resRank').style.display = ''; $('#resBackRank').style.display = 'none';
  go('result'); if (!g.auto && !g.prac) setTimeout(() => { if ($('#result').classList.contains('active')) preview(g.song, true); }, 700);
  if (isPerfect && !g.auto && !g.prac) setTimeout(() => spawnConfetti(), 120);
}

/* ---------- Confetti ---------- */
let cfRaf = 0;
function spawnConfetti() {
  const cvs = $('#confetti'); if (!cvs) return;
  const r = Math.min(devicePixelRatio || 1, 2);
  cvs.width = innerWidth * r; cvs.height = innerHeight * r;
  cvs.style.width = innerWidth + 'px'; cvs.style.height = innerHeight + 'px';
  const g = cvs.getContext('2d'); g.setTransform(r, 0, 0, r, 0, 0);
  const cols = ['#00E5FF', '#B388FF', '#FFD166', '#FF4D8D', '#7CFFB2', '#FF8A3D'];
  const parts = [];
  const N = LOW ? 70 : 120;
  for (let i = 0; i < N; i++) parts.push({
    x: innerWidth * (.2 + Math.random() * .6), y: innerHeight * .25 + Math.random() * 30,
    vx: (Math.random() - .5) * 8, vy: -3 - Math.random() * 8,
    s: 4 + Math.random() * 5, c: cols[i % cols.length],
    rot: Math.random() * 6.28, vr: (Math.random() - .5) * .3
  });
  cvs.classList.add('on');
  const t0 = performance.now();
  const tick = () => {
    const now = performance.now(), el = now - t0;
    g.clearRect(0, 0, innerWidth, innerHeight);
    for (const p of parts) {
      p.vy += .25; p.x += p.vx; p.y += p.vy; p.rot += p.vr;
      g.save(); g.translate(p.x, p.y); g.rotate(p.rot); g.fillStyle = p.c;
      g.globalAlpha = Math.max(0, 1 - el / 2500);
      g.fillRect(-p.s / 2, -p.s / 2, p.s, p.s * 1.4);
      g.restore();
    }
    if (el < 2500) cfRaf = requestAnimationFrame(tick);
    else { cancelAnimationFrame(cfRaf); cvs.classList.remove('on'); g.clearRect(0, 0, innerWidth, innerHeight); }
  };
  cancelAnimationFrame(cfRaf); cfRaf = requestAnimationFrame(tick);
}

/* ---------- Gráficos ---------- */
function mkCover(s, r) {
  const d = 76, o = mk(d * r, d * r), g = o.getContext('2d'); g.scale(r, r); g.beginPath(); g.arc(d / 2, d / 2, d / 2, 0, 7); g.clip();
  if (s.img && s.img.complete && s.img.naturalWidth) g.drawImage(s.img, 0, 0, d, d);
  else { const gr = g.createLinearGradient(0, 0, d, d); gr.addColorStop(0, `hsl(${s.hue} 70% 45%)`); gr.addColorStop(1, `hsl(${(s.hue + 60) % 360} 60% 25%)`); g.fillStyle = gr; g.fillRect(0, 0, d, d); }
  return o;
}
let Q = 1, QH = 1, GFX = null; const FONT = "'Rajdhani','Segoe UI',sans-serif", FONT1 = "'Orbitron','Segoe UI',sans-serif";
const mk = (w, h) => { const o = document.createElement('canvas'); o.width = w | 0; o.height = h | 0; return o; };
function buildGfx(r) {
  const { pw, x0, lw, hy, sz } = geo(), u = sz + 20, LT = isLT(); GFX = { r, u, bg: [], spr: {}, glow: {} };
  const BLUR = (LOW || S.qual === 2) ? 4 : 12;
  const BLUR_REC = (LOW || S.qual === 2) ? 3 : 10;
  const SHP = S.shape || 'round', rad = SHP === 'circle' ? sz / 2 : SHP === 'sharp' ? 3 : 12;
  [...new Set(COL)].forEach(col => {
    const S2 = fn => { const o = mk(u * r, u * r), g = o.getContext('2d'); g.scale(r, r); g.translate(u / 2, u / 2); fn(g); return o; }, h = sz / 2;
    const body2D = (g, bc = col) => { g.shadowColor = LT ? 'rgba(0,0,0,.45)' : bc; g.shadowBlur = BLUR; const gr = g.createLinearGradient(0, -h, 0, h); LT ? (gr.addColorStop(0, '#3a3a3a'), gr.addColorStop(1, '#0a0a0a')) : (gr.addColorStop(0, '#fff'), gr.addColorStop(.3, bc), gr.addColorStop(1, bc)); g.fillStyle = gr; g.beginPath(); g.roundRect(-h, -h, sz, sz, rad); g.fill();
      g.strokeStyle = 'rgba(255,255,255,.6)'; g.lineWidth = 2.5; g.beginPath(); g.roundRect(-h + 4, -h + 4, sz - 8, sz - 8, Math.max(2, rad - 4)); g.stroke(); };
    const sh = (hx, t) => { if (!/^#[0-9a-f]{6}$/i.test(hx)) return hx; const n = parseInt(hx.slice(1), 16), m = t < 0 ? 0 : 255, k = Math.abs(t), f = v => Math.round(v + (m - v) * k); return `rgb(${f(n >> 16)},${f(n >> 8 & 255)},${f(n & 255)})`; };
    const body3D = (g, bc = col) => {
      const dep = Math.max(6, sz * .11), x = -h + 3, w = sz - 6, fh = sz - 6 - dep, r2 = SHP === 'circle' ? fh / 2 : SHP === 'sharp' ? 3 : Math.max(8, sz * .17), fy = -h + 3;
      g.shadowBlur = 0;
      for (let i = dep; i >= 1; i--) { g.fillStyle = sh(bc, -.62 + (dep - i) / dep * .28); g.beginPath(); g.roundRect(x, fy + i, w, fh, r2); g.fill(); }
      const gr = g.createLinearGradient(0, fy, 0, fy + fh); gr.addColorStop(0, sh(bc, .42)); gr.addColorStop(.55, bc); gr.addColorStop(1, sh(bc, -.14));
      g.fillStyle = gr; g.beginPath(); g.roundRect(x, fy, w, fh, r2); g.fill();
      g.save(); g.beginPath(); g.roundRect(x, fy, w, fh, r2); g.clip(); g.fillStyle = 'rgba(255,255,255,.16)'; g.beginPath(); g.moveTo(x, fy); g.lineTo(x + w, fy); g.lineTo(x + w, fy + fh * .36); g.lineTo(x, fy + fh * .55); g.closePath(); g.fill(); g.restore();
      g.strokeStyle = 'rgba(255,255,255,.7)'; g.lineWidth = 2; g.beginPath(); g.roundRect(x + 3, fy + 3, w - 6, fh - 6, Math.max(1, r2 - 3)); g.stroke();
      g.translate(0, -dep / 2);
    };
    const body = (g, bc = col) => (LT || S.n3d === false) ? body2D(g, bc) : body3D(g, bc);
    const arrow = (g, d) => { body(g, '#FF9F43'); const a = sz * .3; g.shadowBlur = 0; g.fillStyle = LT ? '#fff' : '#0D0D11'; for (const o of [-.9, .3]) { g.beginPath(); g.moveTo(d * (o * a + a * .75), 0); g.lineTo(d * (o * a - a * .15), -a * .85); g.lineTo(d * (o * a - a * .15), a * .85); g.closePath(); g.fill(); } };
    const rec = st => g => { g.shadowColor = st; g.shadowBlur = BLUR_REC; g.strokeStyle = st; g.lineWidth = 3; g.fillStyle = 'rgba(255,255,255,.05)'; g.beginPath(); g.roundRect(-h, -h, sz, sz, rad); g.fill(); g.stroke(); };
    GFX.spr[col] = { tap: S2(g => { body(g); if (LT) { g.shadowBlur = 0; g.fillStyle = '#fff'; g.fillRect(-sz * .2, -2.5, sz * .4, 5); } }), rec: S2(rec(col)), recG: S2(rec('#FFD166')),
      flickL: S2(g => arrow(g, -1)), flickR: S2(g => arrow(g, 1)),
      slide: S2(g => { body(g); g.fillStyle = LT ? '#fff' : '#0D0D11'; g.beginPath(); g.arc(0, 0, sz * .12, 0, 7); g.fill(); }) };
    const o = mk(lw * r, 240 * r), g = o.getContext('2d'), gr = g.createLinearGradient(0, 0, 0, 240 * r); gr.addColorStop(0, 'transparent'); gr.addColorStop(1, col); g.fillStyle = gr; g.fillRect(0, 0, o.width, o.height); GFX.glow[col] = o;
  });
}
const STAGES = [['INTRO', '#B388FF'], ['STAGE 2', '#2EE59D'], ['STAGE 3', '#4DA3FF'], ['FINAL STAGE', '#FFD166']], stageOf = p => p >= .8 ? 3 : p >= .5 ? 2 : p >= .2 ? 1 : 0;
const CFX = ['#00E5FF', '#7CFFB2', '#FFD166', '#FF4D8D', '#B388FF'], fmt = s => `${s / 60 | 0}:${String(s % 60).padStart(2, '0')}`;
function drawCombo(t, hy, x0, pw) {
  if (!G) return;
  for (let i = G.cfx.length - 1; i >= 0; i--) {
    const f = G.cfx[i], a = t - f.t; if (a > 1.1) { G.cfx.splice(i, 1); continue; }
    const k = a / 1.1, col = CFX[f.v % 5], cx = W / 2;
    c.globalAlpha = (1 - k) * .8; c.strokeStyle = col; c.lineWidth = 6 * (1 - k) + 1; c.beginPath(); c.arc(cx, hy, 30 + k * pw * .8, 0, 7); c.stroke();
    if (f.v >= 2 && fxOn()) { c.fillStyle = col; c.globalAlpha = (1 - k) * .18; c.fillRect(x0, 0, pw, H); }
    if (f.v >= 3 && fxOn()) for (let p = 0; p < 10; p++) { const ang = p * .628 + f.v, d = k * pw * (.35 + (p % 4) * .12); c.globalAlpha = 1 - k; c.fillStyle = p % 2 ? col : '#fff'; c.fillRect(cx + Math.cos(ang) * d - 3, hy - 40 + Math.sin(ang) * d - 3, 6, 6); }
    c.globalAlpha = Math.min(1, (1 - k) * 2); c.fillStyle = col; c.font = `800 ${28 + (1 - k) * 22 | 0}px ${FONT1}`; c.textAlign = 'center'; c.fillText(f.n + ' COMBO', cx, H * .22);
  }
  c.globalAlpha = 1;
}
function draw(n) {
  if (!G || !GFX || !H) { resize(); if (!GFX || !G) return; }
  const { pw, x0, lw, hy, sz } = geo(), spb = 60 / G.bpm, ap = Math.min(2.4, Math.max(1.2, spb * 4)) / S.speed, u = GFX.u, t = T();
  const LT = isLT(), SG = STAGES[G.st], FXO = fxOn();
  const hor = (-12 - hy * .4545) / .5455, P = z => 1 / (1 + Math.max(-.2, z) * 1.2), Yp = s => hor + (hy - hor) * s;
  const sc0 = -hor / (hy - hor), sc1 = (H - hor) / (hy - hor), mx = W / 2, X = (xx, s) => mx + (xx - mx) * s, cx = l => x0 + lw * (l + .5);
  c.clearRect(0, 0, W, H);
  c.fillStyle = LT ? 'rgba(226,229,231,.95)' : G.odOn ? 'rgba(48,36,8,.85)' : 'rgba(10,10,16,.82)';
  const LA = Math.min(1, Math.max(0, S.laneA ?? 1)); c.globalAlpha = LA;
  c.beginPath(); c.moveTo(X(x0, sc0), 0); c.lineTo(X(x0 + pw, sc0), 0); c.lineTo(X(x0 + pw, sc1), H); c.lineTo(X(x0, sc1), H); c.fill();
  c.strokeStyle = LT ? 'rgba(0,0,0,.14)' : 'rgba(255,255,255,.09)'; c.lineWidth = 2; c.beginPath();
  for (let l = 0; l <= LANES; l++) { c.moveTo(X(x0 + lw * l, sc0), 0); c.lineTo(X(x0 + lw * l, sc1), H); } c.stroke(); c.globalAlpha = 1;
  const b0 = G.song.map.beat0;
  if (b0 !== undefined) {
    const ph = ((n - b0) / spb % 1 + 1) % 1; c.globalAlpha = .35 * (1 - ph); c.strokeStyle = COL[0]; c.lineWidth = 4; c.beginPath();
    c.moveTo(X(x0, sc0), 0); c.lineTo(X(x0, sc1), H); c.moveTo(X(x0 + pw, sc0), 0); c.lineTo(X(x0 + pw, sc1), H); c.stroke(); c.globalAlpha = 1;
    if (fxOn()) { c.fillStyle = LT ? 'rgba(0,0,0,.07)' : 'rgba(255,255,255,.08)'; for (let i = Math.ceil((n - b0) / spb), m = 0; m < 8; i++, m++) { const z = (b0 + i * spb - n) / ap; if (z > 1) break; const s = P(z); c.fillRect(X(x0, s), Yp(s) - 1, pw * s, 2); } }
  }
  if (fxOn()) { c.fillStyle = 'rgba(255,255,255,.2)'; const ptc = LOW ? 6 : 16; for (let i = 0; i < ptc; i++) c.fillRect((i * 137.5) % W, H - ((t * 24 + i * 97) % H), 2, 2); }
  c.fillStyle = G.odOn ? 'rgba(255,209,102,.2)' : 'rgba(255,255,255,.08)'; c.fillRect(x0, hy - 14, pw, 28);
  c.fillStyle = G.odOn ? '#FFD166' : LT ? COL[0] : '#E8E8EE'; c.fillRect(x0, hy - 1, pw, 3);
  if (fxOn() && G.song.map.en) {
    const e0 = G.song.map.en[Math.max(0, n * 10 | 0)] || 0, bw = W / 32; c.fillStyle = SG[1]; c.globalAlpha = .28;
    for (let i = 0; i < 32; i++) { const bh = (e0 * .75 + .25) * (14 + 46 * Math.abs(Math.sin(t * 2.1 + i * 1.7) * Math.cos(t * 1.3 + i * .6))); c.fillRect(i * bw + 2, H - bh, bw - 4, bh); }
    c.globalAlpha = 1;
  }
  G.held.fill(0); G.pt.forEach(p => G.held[p.lane] = 1);
  for (let l = 0; l < LANES; l++) {
    G.flash[l] = Math.max(0, G.flash[l] - .08); const a = Math.max(G.flash[l] * .5, G.held[l] * .4);
    if (a > .01) {
      c.globalAlpha = a * .35; c.fillStyle = SG[1]; c.beginPath();
      c.moveTo(X(x0 + lw * l, sc0), 0); c.lineTo(X(x0 + lw * (l + 1), sc0), 0); c.lineTo(X(x0 + lw * (l + 1), sc1), H); c.lineTo(X(x0 + lw * l, sc1), H); c.fill();
      c.globalAlpha = a; c.drawImage(GFX.glow[COL[l]], cx(l) - lw * .35, hy - 200, lw * .7, 200); c.globalAlpha = 1;
    }
    c.drawImage(GFX.spr[COL[l]][G.odOn ? 'recG' : 'rec'], (cx(l) - u / 2) | 0, (hy - u / 2) | 0, u, u);
  }
  for (let i = G.i; i < G.notes.length; i++) {
    const o = G.notes[i], z = (o.t - n) / ap; if (z > 0.96) break; if (o.state === 1) continue;
    const hold = o.state === 2, hs = hold ? 1 : P(z), yh = hold ? hy : Yp(hs), al = G.hid ? Math.min(1, Math.max(0, (z - .12) / .3)) : 1, col = COL[o.lane], s = GFX.spr[col];
    const xh = X(cx(hold ? lanePos(o, n) : o.lane), hs); c.globalAlpha = al;
    if (o.type === 'ln' || o.type === 'slide') {
      const se = P(Math.min(1.02, (o.t + o.d - n) / ap)), ye = Yp(se);
      if (o.type === 'ln') { const xe = X(cx(o.lane), se), w1 = sz * .22 * hs, w2 = sz * .22 * se; c.fillStyle = col; c.globalAlpha = al * .4; c.beginPath(); c.moveTo(xh - w1, yh); c.lineTo(xh + w1, yh); c.lineTo(xe + w2, ye); c.lineTo(xe - w2, ye); c.fill(); }
      else {
        const t0 = Math.max(o.t, n); c.strokeStyle = col; c.globalAlpha = al * .45; c.lineCap = c.lineJoin = 'round'; c.lineWidth = sz * .38 * (hs + se) / 2; c.beginPath();
        for (let k = 0; k <= 10; k++) { const tt = t0 + (o.t + o.d - t0) * k / 10, ss = P(Math.min(1.02, (tt - n) / ap)), xx = X(cx(lanePos(o, tt)), ss); k ? c.lineTo(xx, Yp(ss)) : c.moveTo(xx, Yp(ss)); }
        c.stroke(); const ez = se * u * .7; c.globalAlpha = al; c.drawImage(GFX.spr[COL[o.to]].rec, X(cx(o.to), se) - ez / 2, ye - ez / 2, ez, ez);
      }
      c.globalAlpha = al;
    }
    if (o.chord && o.lane === o.chord[0]) { c.strokeStyle = '#fff'; c.lineWidth = 3 * hs; c.beginPath(); c.moveTo(X(cx(o.chord[0]), hs), yh); c.lineTo(X(cx(o.chord[1]), hs), yh); c.stroke(); }
    const d = u * hs; c.drawImage(s[o.type === 'flick' ? (o.dir < 0 ? 'flickL' : 'flickR') : o.type === 'slide' ? 'slide' : 'tap'], (xh - d / 2) | 0, (yh - d / 2) | 0, d, d);
  }
  c.globalAlpha = 1;
  for (let i = G.fx.length - 1; i >= 0; i--) {
    const f = G.fx[i], k = (t - f.t) / (f.k === 'flick' ? .4 : .28); if (k >= 1) { G.fx.splice(i, 1); continue; }
    const zz = u * (1 + k * .7), x = cx(f.l); c.globalAlpha = 1 - k; c.drawImage(GFX.spr[COL[f.l]].rec, (x - zz / 2) | 0, (hy - zz / 2) | 0, zz, zz);
    if (S.hitFx !== false && f.k !== 'flick' && FXO) { c.strokeStyle = COL[f.l]; c.lineWidth = 5 * (1 - k) + 1; c.globalAlpha = (1 - k) * .85; c.beginPath(); c.arc(x, hy, sz * (.4 + k * 1.05), 0, 7); c.stroke(); c.fillStyle = '#fff'; c.globalAlpha = (1 - k) * (1 - k) * .35; c.beginPath(); c.arc(x, hy, sz * .5, 0, 7); c.fill(); }
    if (f.k === 'flick') {
      const d = f.dir || 1, e = 1 - (1 - k) * (1 - k), spr = GFX.spr[COL[f.l]][d < 0 ? 'flickL' : 'flickR'];
      for (let g = 3; g >= 0; g--) { const ee = Math.max(0, e - g * .1); c.globalAlpha = (1 - k) * (g === 0 ? 1 : .3 / g); c.drawImage(spr, (x + d * lw * 1.15 * ee - u / 2) | 0, (hy - u / 2) | 0, u, u); }
    } else if (fxOn()) { c.fillStyle = COL[f.l]; const pts = LOW ? 3 : 6; for (let p = 0; p < pts; p++) { const an = p * 1.047 + f.t * 7, r = sz * (.55 + k * .6); c.fillRect(x + Math.cos(an) * r - 2, hy + Math.sin(an) * r * .8 - 2, 4, 4); } }
  }
  drawCombo(t, hy, x0, pw);
  c.globalAlpha = 1; c.fillStyle = 'rgba(255,255,255,.35)'; c.fillRect(0, 0, W * Math.min(1, Math.max(0, n / G.song.buf.duration)), 3);
    c.textAlign = 'left'; c.font = `600 15px ${FONT}`; c.fillStyle = LT ? '#222' : 'rgba(232,232,238,.92)';
  if (G.tlW !== W) { const mw = Math.max(120, W - 190), cut = s => { let q = s; while (q.length > 4 && c.measureText(q).width > mw) q = q.slice(0, -2); return q === s ? s : q + '…'; }; G.tl = cut(G.song.title); c.font = `500 13px ${FONT}`; G.ar = cut(G.song.artist || ''); G.tlW = W; }
  c.font = `600 15px ${FONT}`; c.fillText(G.tl, 14, 24); c.font = `500 13px ${FONT}`; c.fillStyle = '#8a8a98'; c.fillText((G.ar ? trS(G.ar) + ' · ' : '') + `${fmt(Math.max(0, n | 0))} / ${fmt(G.song.buf.duration | 0)}`, 14, 42); if (G.rp) { c.font = `700 12px ${FONT}`; c.fillStyle = '#FF4D6D'; c.beginPath(); c.moveTo(14, 80); c.lineTo(14, 92); c.lineTo(24, 86); c.closePath(); c.fill(); c.fillText('REPETICIÓN', 30, 90); } if (G.modIco && G.modIco.length) { const per = Math.max(3, Math.floor((W / 2 - 78 * (S.hud || 1) - 10) / 36)); G.modIco.forEach((im, i) => { if (im.complete && im.naturalWidth) c.drawImage(im, 12 + (i % per) * 36, 50 + ((i / per) | 0) * 36, 32, 32); }); } c.textAlign = 'center';
  hudRing(c, W, G, S.hud || 1, acc(), Math.min(1, Math.max(0, n / G.song.buf.duration)), LT, GFX.cover);
  if (G.stg && t - G.stg.t < 1.6) {
    const k = (t - G.stg.t) / 1.6, s = STAGES[G.stg.i]; c.globalAlpha = k < .15 ? k / .15 : 1 - (k - .15) / .85; c.fillStyle = s[1];
    c.font = `800 34px ${FONT1}`; c.fillText(s[0], W / 2, H * .3); c.font = `600 16px ${FONT}`; c.fillText('Multiplicador x' + (G.stg.i + 1), W / 2, H * .3 + 24); c.globalAlpha = 1;
  }
  const p = G.pop, JC = { perf: '#00E5FF', great: '#7CFFB2', good: '#FFD166', miss: '#FF4D6D', overdrive: '#FFD166' }, JN = { perf: 'PERFECT', great: 'GREAT', good: 'GOOD', miss: 'MISS', overdrive: 'OVERDRIVE' };
  if (p && t - p.t < .6) {
    const q = (t - p.t) / .6; c.globalAlpha = Math.min(1, (1 - q) * 1.6); c.fillStyle = JC[p.k]; c.font = `800 ${28 + Math.max(0, .15 - (t - p.t)) * 60 | 0}px ${FONT1}`; c.fillText(JN[p.k], W / 2, H * .4); c.globalAlpha = 1;
    if (p.e && q < .6) { c.font = `500 14px ${FONT}`; c.fillStyle = '#8a8a98'; c.fillText(p.e > 0 ? 'EARLY' : 'LATE', W / 2, H * .4 + 48); }
  }
  if (G.combo > 1) { c.globalAlpha = p && t - p.t < .6 ? 1 : .55; c.fillStyle = LT ? '#222' : 'rgba(232,232,238,.9)'; c.font = `600 16px ${FONT1}`; c.fillText(`${G.combo} STREAK`, W / 2, H * .4 + 26); c.globalAlpha = 1; }
  c.font = `500 16px ${FONT}`; c.fillStyle = '#8a8a98';
  if (ctx.state !== 'running' && !G.paused) { c.font = `500 20px ${FONT}`; c.fillStyle = '#FFD166'; c.fillText('Toca la pantalla para activar el audio', W / 2, H * .62); }
  c.save(); c.textAlign = 'right'; c.font = `500 11px ${FONT}`; c.fillStyle = 'rgba(255,255,255,.3)'; c.fillText(`${(1000 / (G.ft || 16.7)) | 0} fps · ${(G.dm || 0).toFixed(1)} ms`, W - 8, H - 8); c.restore();
  if (n < 0) {
    c.fillStyle = '#fff'; c.font = `800 84px ${FONT1}`; c.fillText(Math.ceil(-n), W / 2, H * .42);
    c.font = `500 18px ${FONT}`; c.fillStyle = '#8a8a98'; c.fillText(`${Math.round(G.bpm)} BPM · ${trS(diffLabels[S.diff])} · ${G.info}`, W / 2, H * .5);
  }
}
applySkin(); applyAccent(); applyPauseUI(); bindSettings();

/* ---------- HUD (anillo de puntaje + barras); se usa en la partida y en la vista previa de Ajustes ---------- */
function hudRing(c, W, g, k, accV, pr, LT, cover) {
  const SG = STAGES[g.st], rx = W / 2, ry = 118, rr = 68, ac = g.odOn ? '#FFD166' : SG[1];
  c.save(); c.translate(W / 2, 0); c.scale(k, k); c.translate(-W / 2, 0); c.textAlign = 'center';
  const RA = Math.min(1, Math.max(0, S.ringA ?? 1)); c.globalAlpha = RA;
  c.fillStyle = LT ? '#0b0b0b' : 'rgba(10,10,16,.9)'; c.beginPath(); c.arc(rx, ry, rr, 0, 7); c.fill();
  if (cover) { c.globalAlpha = .4 * RA; c.drawImage(cover, rx - 58, ry - 58, 116, 116); c.globalAlpha = RA; }
  c.lineWidth = 9; c.strokeStyle = 'rgba(255,255,255,.18)'; c.beginPath(); c.arc(rx, ry, rr - 3, 0, 7); c.stroke(); c.globalAlpha = 1;
  c.strokeStyle = ac; c.beginPath(); c.arc(rx, ry, rr - 3, -Math.PI / 2, -Math.PI / 2 + 6.283 * pr); c.stroke();
  c.strokeStyle = 'rgba(255,255,255,.7)'; c.lineWidth = 2; for (const bq of [.2, .5, .8]) { const an = -Math.PI / 2 + 6.283 * bq, co = Math.cos(an), si = Math.sin(an); c.beginPath(); c.moveTo(rx + co * (rr - 9), ry + si * (rr - 9)); c.lineTo(rx + co * (rr + 2), ry + si * (rr + 2)); c.stroke(); }
  c.fillStyle = ac; c.font = `700 15px ${FONT}`; c.fillText(SG[0], rx, ry - 27);
  c.fillStyle = '#fff'; c.font = `800 ${g.score > 99999 ? 22 : 30}px ${FONT1}`; c.fillText(g.score | 0, rx, ry + 12);
  c.fillStyle = ac; c.font = `700 22px ${FONT}`; c.fillText('x' + ((1 + Math.max(0, g.combo - 1) * 3 / 25) * (g.odOn ? 1.5 : 1)).toFixed(1), rx, ry + 42);
  c.fillStyle = LT ? '#222' : '#8a8a98'; c.font = `600 19px ${FONT}`; c.fillText(accV.toFixed(2) + '%', rx, ry + rr + 24);
  const bw = Math.min(W - 40, 340), bx = (W - bw) / 2;
  c.fillStyle = 'rgba(255,255,255,.1)'; c.fillRect(bx, 228, bw, 6); c.fillStyle = g.odOn ? '#FFD166' : '#00E5FF'; c.fillRect(bx, 228, bw * g.od, 6);
  c.fillStyle = 'rgba(255,255,255,.1)'; c.fillRect(bx, 240, bw, 6); c.fillStyle = g.hp > .5 ? '#2EE59D' : g.hp > .25 ? '#FFD166' : '#FF4D6D'; c.fillRect(bx, 240, bw * g.hp, 6);
  c.restore();
}
function drawHudPreview() {
  const cv = $('#hudPrev'); if (!cv) return; const c = cv.getContext('2d'), W = cv.width, H = cv.height, k = (+$('#sHud').value || 100) / 100;
  const gr = c.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, '#10101a'); gr.addColorStop(1, '#07070c'); c.fillStyle = gr; c.fillRect(0, 0, W, H);
  c.fillStyle = `rgba(255,255,255,${.05 + .12 * (S.laneA ?? 1)})`; c.beginPath(); c.moveTo(W * .46, 0); c.lineTo(W * .54, 0); c.lineTo(W * .9, H); c.lineTo(W * .1, H); c.closePath(); c.fill();
  c.strokeStyle = 'rgba(255,255,255,.12)'; c.lineWidth = 1; for (const q of [.37, .5, .63]) { c.beginPath(); c.moveTo(W * q, 0); c.lineTo(W * (q < .5 ? .1 : q > .5 ? .9 : .5), H); c.stroke(); }
  c.textBaseline = 'alphabetic'; hudRing(c, W, { st: 1, odOn: false, od: .6, hp: .8, score: 184200, combo: 37 }, k, 98.4, .38, false, null);
  c.fillStyle = 'rgba(255,255,255,.35)'; c.font = `500 12px ${FONT}`; c.textAlign = 'center'; c.fillText('Vista previa', W / 2, H - 8);
}

/* ---------- Selector custom ---------- */
function enhanceSelect(sel) {
  const wrap = document.createElement('div'), btn = document.createElement('button'), list = document.createElement('div');
  wrap.className = 'cs'; btn.type = 'button'; btn.className = 'cs-btn'; list.className = 'cs-list';
  const sync = () => { const o = sel.options[sel.selectedIndex]; btn.innerHTML = `<span class="cs-t"></span>${ico('chev')}`; btn.firstChild.textContent = o ? o.textContent : ''; [...list.children].forEach(c => c.classList.toggle('on', c.dataset.v === sel.value)); };
  [...sel.options].forEach(o => { const b = document.createElement('button'); b.type = 'button'; b.className = 'cs-opt'; b.dataset.v = o.value; b.textContent = o.textContent; b.onclick = e => { e.stopPropagation(); sel.value = o.value; sel.dispatchEvent(new Event('input', { bubbles: true })); wrap.classList.remove('open'); sync(); }; list.append(b); });
  btn.onclick = e => { e.stopPropagation(); $$('.cs.open').forEach(x => x !== wrap && x.classList.remove('open')); wrap.classList.toggle('open'); };
  wrap.append(btn, list); sel.after(wrap); sel._sync = sync; sync();
}
$$('#settings select').forEach(enhanceSelect);
document.addEventListener('click', () => $$('.cs.open').forEach(x => x.classList.remove('open')));
['contextmenu', 'dragstart'].forEach(ev => addEventListener(ev, e => e.preventDefault()));
addEventListener('selectstart', e => { if (!/INPUT|TEXTAREA/.test((e.target && e.target.tagName) || '')) e.preventDefault(); });
let fsTried = false;
function goFull() {
  if (fsTried || (typeof matchMedia === 'function' && matchMedia('(display-mode: fullscreen), (display-mode: standalone)').matches)) return;
  fsTried = true; const el = document.documentElement, f = el.requestFullscreen || el.webkitRequestFullscreen;
  try { const p = f && f.call(el); if (p && p.catch) p.catch(() => {}); } catch (e) {}
}
['pointerdown', 'keydown'].forEach(ev => addEventListener(ev, goFull, { passive: true }));
applyPerf(); applyUis();
bindSettings();
try { init(); infoUI(); sizeViz(); menuRaf = requestAnimationFrame(menuFrame); } catch (e) { showErr('Inicio: ' + e.message); }
if (document.fonts) ['500 1em Orbitron', '800 1em Orbitron', '500 1em Rajdhani', '600 1em Rajdhani', '700 1em Rajdhani', '400 1em Anton'].forEach(f => document.fonts.load(f).catch(() => {}));
if ('serviceWorker' in navigator && /^https?:/.test(location.protocol)) navigator.serviceWorker.register('sw.js').catch(() => {});

/* ---------- Recorrido de funciones: solo la primera vez, cuando aceptas el tutorial ---------- */
const sleep = ms => new Promise(r => setTimeout(r, ms));
const closeAll = () => { try { $('#drawer').classList.remove('open'); $('#settings').classList.remove('open'); $('#optModal') && $('#optModal').classList.remove('open'); } catch (e) {} };
function tourSteps() {
  const sel = () => { closeAll(); if (!$('#select').classList.contains('active')) go('select'); };
  return [
    { sel: '#profile', t: 'Tu perfil', p: 'Aquí ves tu nombre, tu nivel y tu XP. Tócalo para cambiar tu nombre.' },
    { sel: '#mPlayer', t: 'Reproductor', p: 'Controla la música del menú: canción anterior, pausa y siguiente. Suena tu biblioteca mientras estás aquí.' },
    { sel: '#orbBox', t: 'El logo', p: 'Es el botón principal: tócalo para abrir el menú. Late al ritmo de la canción que suena.' },
    { before: () => setMenu(1), sel: '#mMenu .s1', t: 'Menú principal', p: 'Jugar: elige una canción. Cómo jugar: guía de notas y controles. Ajustes: personaliza el juego. Salir: cierra la app.' },
    { before: sel, wait: 900, sel: '#search', t: 'Buscador', p: 'Escribe parte del título o del artista para encontrar una canción al instante.' },
    { sel: '#orgBar', t: 'Organizar por', p: 'Recientes: lo último que jugaste. Favoritas: las que marcaste con la estrella. Listas: tus carpetas de canciones.' },
    { sel: '#viewBar', t: 'Formas de ver la biblioteca', p: 'Cambia entre lista, filas compactas, cuadrícula y carrusel, según cuántas canciones tengas.' },
    { sel: '#list', t: 'Tus canciones', p: 'Toca una para elegirla. La estrella la marca como favorita y los tres puntos abren sus opciones: información, portada, renombrar, exportar, corregir BPM, añadir a una lista y eliminar.' },
    { sel: ['#detail', '#infoStrip'], t: 'Detalle de la canción', p: 'Dificultad con puntos de colores, duración, cantidad de notas, BPM y tu mejor récord. El fondo cambia a la portada de la canción.' },
    { sel: '#diffSelect', t: 'Dificultad', p: 'Fácil: solo los golpes más marcados. Normal: más notas y algunas dobles. Difícil: muchas notas, rachas rápidas y notas largas.' },
    { sel: '#btnStart', t: 'Jugar', p: 'Empieza la canción elegida. Antes se prepara el nivel: el juego analiza el audio y crea las notas.' },
    { sel: '#select footer', t: 'Botones de abajo', p: 'Atrás. Mods: modificadores que cambian el reto y el puntaje, como en osu! (los que dan ventaja suben el puntaje, los de desventaja lo bajan, Auto toca solo y no puntúa). Azar: canción al azar. Listas: crear carpetas. Importar: añade tus canciones, puedes elegir varias. Más: opciones de la canción.' },
    { before: () => { closeAll(); $('#drawerTab').click(); }, wait: 800, sel: '#drawer', t: 'Menú lateral', p: 'Importar canción. Competir: Mis récords (tus intentos y repeticiones) y Logros y misiones diarias. Ajustes. Ayuda: Cómo jugar, Repetir tutorial y Calibrar latencia.' },
    { before: () => { closeAll(); showSet('all'); }, wait: 800, sel: '#settings .panel', t: 'Ajustes', p: 'Audio: volúmenes. Gráficos: colores, calidad, rendimiento, opacidad de la pista y del círculo, modo daltónico y tamaño del texto. Jugabilidad: velocidad de notas, latencia (con calibración), vibración y botón de pausa. Fondo: portada, video y oscuridad.' },
    { before: closeAll, sel: null, t: 'Durante la partida', p: 'Arriba ves tu puntaje, la precisión y el combo; el botón de pausa te deja Continuar, Reintentar o Salir (al volver hay cuenta de 3 segundos). Abajo, el ecualizador late con la música. Al terminar verás tus resultados, tu rango, tus récords y podrás ver la repetición.' },
    { sel: null, t: '¡Listo!', p: 'Ya conoces todo. Ahora viene el tutorial de juego: aprenderás las notas Tap, largas, Flick, Slide y Sync.', last: true }
  ];
}
async function runTour() {
  const steps = tourSteps(), tour = $('#tour'), hole = $('#tHole'), card = $('#tCard'); let i = 0, end = null; lsSet('bwtour', '1'); tour.classList.add('on');
  const done = new Promise(r => { end = r; });
  const finish = () => { tour.classList.remove('on'); closeAll(); $('#tNext').onclick = $('#tSkip').onclick = null; end(); };
  const show = async () => {
    const st = steps[i]; if (!st) return finish();
    if (st.before) { try { await st.before(); } catch (e) {} }
    await sleep(st.wait || 650); menuIdle = Date.now();
    const find = () => { for (const q of [].concat(st.sel || [])) { const t = document.querySelector(q), b = t && t.getBoundingClientRect(); if (b && b.width >= 4 && b.height >= 4 && b.bottom > 0 && b.top < innerHeight && b.right > 0 && b.left < innerWidth) return b; } return null; };
    let r = null; if (st.sel) { for (let k = 0; k < 18 && !(r = find()); k++) await sleep(120); if (!r) { i++; return show(); } } // espera a que el elemento aparezca; si no existe en este equipo, salta el paso
    $('#tN').textContent = `${trS('Recorrido')} · ${i + 1}/${steps.length}`; $('#tT').textContent = trS(st.t); $('#tP').textContent = trS(st.p); $('#tNext').textContent = trS(st.last ? 'Empezar el tutorial de juego' : 'Siguiente'); $('#tSkip').style.display = st.last ? 'none' : '';
    if (r) { const pd = 8; Object.assign(hole.style, { display: 'block', left: Math.max(2, r.left - pd) + 'px', top: Math.max(2, r.top - pd) + 'px', width: Math.min(innerWidth - 4, r.width + pd * 2) + 'px', height: Math.min(innerHeight - 4, r.height + pd * 2) + 'px' }); }
    else Object.assign(hole.style, { display: 'block', left: '50%', top: '45%', width: '0px', height: '0px' });
    const ch = card.offsetHeight || 190; let top = r ? (r.bottom + ch + 28 < innerHeight ? r.bottom + 18 : Math.max(10, r.top - ch - 18)) : Math.max(10, (innerHeight - ch) / 2);
    if (r && top < r.bottom && top + ch > r.top) top = Math.max(10, innerHeight - ch - 14); card.style.top = top + 'px';
  };
  $('#tNext').onclick = () => { i++; show(); }; $('#tSkip').onclick = finish; show(); return done;
}

/* ===== Ranking, historial personal, logros y misiones, corrección de BPM ===== */
const HISTK = 'bwhist', ACHK = 'bwach', MISK = 'bwmis', STATK = 'bwstats', PENDK = 'bwpend';
const jget = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch (e) { return d; } };
const jset = (k, v) => { try { lsSet(k, JSON.stringify(v)); } catch (e) {} };
const el = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt !== undefined) e.textContent = txt; return e; };
const today = () => new Date().toISOString().slice(0, 10);

/* --- Mis récords (se guardan solo en este dispositivo) --- */
let RK = { song: null };
const rkMove = d => { const l = vis(); if (!l.length) return; const i = Math.max(0, l.indexOf(RK.song)); RK.song = l[(i + d + l.length) % l.length]; renderRank(); };
$('#rkPrev').onclick = () => rkMove(-1); $('#rkNext').onclick = () => rkMove(1);
$('#rkBack').onclick = () => go('select');
function openRank(s) { RK.song = s || sel || vis()[0]; if (!RK.song) return msg('Importa o elige una canción primero.'); go('rank'); renderRank(); }
$('#btnRank').onclick = () => openRank(sel); $('#btnTrophy').onclick = () => openRank(sel);
$('#resRank').onclick = () => openRank(G && G.song ? G.song : sel);
function renderRank() {
  const s = RK.song; $('#rkTitle').textContent = s ? s.title : ''; $('#rkSub').textContent = s ? s.artist : '';
  renderPersonal(s, $('#rkBody'));
}
function renderPersonal(s, body) {
  body.textContent = ''; const k = fkey(s), r = REC[k], H = jget(HISTK, []).filter(x => x.k === k).slice(-30);
  if (!r && !H.length) { body.append(el('div', 'rkMsg', 'Aún no has terminado esta canción. Tus intentos y tu mejor puntaje aparecerán aquí.')); return; }
  const pb = el('div', 'pbest'); [['Mejor puntaje', r ? (r.best || 0).toLocaleString() : '—'], ['Precisión', r ? r.acc + '%' : '—'], ['Intentos', r ? r.plays : H.length]].forEach(([t, v]) => { const d = el('div'); d.append(el('small', '', t), el('b', '', v)); pb.append(d); }); body.append(pb);
  const rpb = loadRep(k); if (rpb) { const b = el('button', 'rpBtn', 'Ver mejor repetición'); b.onclick = () => startReplay(s, rpb); body.append(b); }
  if (H.length > 1) { const mx = Math.max(...H.map(x => x.s), 1), W = 300, Hh = 80, pts = H.map((x, i) => `${(i / (H.length - 1) * (W - 20) + 10).toFixed(1)},${(Hh - 10 - x.s / mx * (Hh - 20)).toFixed(1)}`).join(' '); const ch = el('div', 'pchart'); ch.innerHTML = `<svg viewBox="0 0 ${W} ${Hh}" width="100%" height="100%" preserveAspectRatio="none"><polyline points="${pts}" fill="none" stroke="var(--accent)" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/></svg>`; body.append(ch); }
  body.append(el('div', 'pH', 'Intentos recientes · toca uno para ver el detalle')); const ul = el('ul', 'rkList');
  [...H].reverse().forEach(x => { const li = el('li'); li.style.gridTemplateColumns = '1fr auto auto auto'; li.classList.add('tap'); li.onclick = () => showPlay(s, x); const rk = el('span', 'rk'); rk.innerHTML = rkh(x.r); rk.style.color = RC[x.r] || '#FFD166'; const d = new Date(x.d); li.append(el('span', 'nm', d.toLocaleDateString() + (x.m ? ' · ' + x.m : '')), el('span', '', x.a + '%'), rk, el('span', 'sc', x.s.toLocaleString())); ul.append(li); });
  body.append(ul);
}

/* --- Fin de partida: historial, logros, misiones y envío al ranking --- */
const ACH = [
  ['first', 'Primer golpe', 'Termina tu primera canción.', c => c.st.plays >= 1],
  ['fc', 'Combo completo', 'Termina una canción de 50+ notas sin fallar ninguna.', c => c.g.miss === 0 && !c.g.failed && c.n >= 50],
  ['s', 'Rango S', 'Consigue rango S o SS.', c => c.rank === 'S' || c.rank === 'SS' || c.rank === 'S★'],
  ['ss', 'Perfección', 'Consigue 100 % de precisión.', c => c.a >= 100],
  ['c100', 'Racha de 100', 'Llega a un combo de 100.', c => c.g.max >= 100],
  ['c300', 'Racha de 300', 'Llega a un combo de 300.', c => c.g.max >= 300],
  ['p10', 'Constancia', 'Juega 10 canciones.', c => c.st.plays >= 10],
  ['p50', 'Veterano', 'Juega 50 canciones.', c => c.st.plays >= 50],
  ['mods', 'Con riesgo', 'Termina una canción con modificadores que den ventaja.', c => c.g.mult > 1 && !c.g.failed],
  ['lib', 'Coleccionista', 'Ten 5 canciones en tu biblioteca.', () => songs.length >= 5],
  ['streak', 'Fiel', 'Juega 3 días seguidos.', c => c.streak >= 3],
  ['hits', 'Mil notas', 'Acierta 1.000 notas en total.', c => c.st.hits >= 1000]
];
const MPOOL = [
  ['m_play', 'Juega 3 canciones', 3, false, () => 1], ['m_combo', 'Llega a un combo de 150', 150, true, c => c.g.max],
  ['m_acc', 'Termina una canción con 95 % o más', 1, false, c => c.a >= 95 ? 1 : 0], ['m_perf', 'Consigue 300 Perfect', 300, false, c => c.g.perf],
  ['m_mods', 'Juega 2 canciones con modificadores', 2, false, c => c.g.mult !== 1 ? 1 : 0], ['m_clear', 'Termina 2 canciones sin quedarte sin vida', 2, false, c => c.g.failed ? 0 : 1],
  ['m_hits', 'Acierta 500 notas', 500, false, c => c.g.perf + c.g.great + c.g.good]
];
/* ---- Misión activa: al completarla empieza un contador de 24 h y luego aparece una nueva ---- */
const MIS2K = 'bwmis2', MIS_CD = 24 * 3600 * 1000, MDEF = () => ({ cur: null, nextAt: 0, done: 0, last: null });
const misGet = () => jget(MIS2K, null) || MDEF(), misPut = m => jset(MIS2K, m), mDef = id => MPOOL.find(x => x[0] === id);
const misPick = last => { const c = MPOOL.filter(x => x[0] !== last); return c[Math.random() * c.length | 0][0]; };
function misEnsure(announce) {
  const m = misGet(); if (!m.cur && BWC.now() >= (m.nextAt || 0)) {
    m.cur = { id: misPick(m.last), v: 0, t: BWC.now() }; m.nextAt = 0; misPut(m); missionSched(m);
    if (announce) { const d = mDef(m.cur.id); if (document.hidden) phoneNotify('¡Nueva misión disponible!', d[1]); else achToast('new', d[1]); }
  }
  return m;
}
function afterRun(g, a, rank) {
  if (g.song.tut || g.auto || g.rp || g.prac) return;
  const H = jget(HISTK, []); H.push({ k: fkey(g.song), s: g.score | 0, a: +a.toFixed(2), r: rank, m: g.modsTxt || '', d: Date.now(), p: g.perf, g: g.great, o: g.good, x: g.miss, c: g.max, u: +(g.mult || 1).toFixed(2), sv: 3, sy: (syncInfo(g) || {}).ms }); if (LASTREP && LASTREP.song === g.song && !g.rp) saveAttemptRep(LASTREP, H[H.length - 1].d); jset(HISTK, H.slice(-300));
  const st = jget(STATK, { plays: 0, hits: 0 }), hits = g.perf + g.great + g.good; st.plays++; st.hits += hits; jset(STATK, st);
  const c = { g, a, rank, st, n: (g.notes || []).length, streak: (jget('bwstreak', { n: 0 }) || {}).n || 0 }, toasts = [];
  const got = jget(ACHK, {}); ACH.forEach(([id, name, , ok]) => { if (!got[id] && ok(c)) { got[id] = Date.now(); toasts.push(['ach', name]); } }); jset(ACHK, got);
  const m = misEnsure(false); let xp = 0;
  if (m.cur) { const d = mDef(m.cur.id); if (d) { const val = d[4](c); m.cur.v = d[3] ? Math.max(m.cur.v || 0, val) : (m.cur.v || 0) + val;
    if (m.cur.v >= d[2]) { toasts.push(['mis', d[1]]); xp += 60; m.last = m.cur.id; m.cur = null; m.done = (m.done || 0) + 1; m.nextAt = BWC.now() + MIS_CD; } } }
  misPut(m); missionSched(m); updStrip();
  if (xp) { lsSet(XPK, getXp() + xp); renderProfile(); scheduleSync(); }
  toasts.forEach(([k, n], i) => setTimeout(() => { if (document.hidden) phoneNotify(k === 'mis' ? '¡Misión completada!' : '¡Logro desbloqueado!', n); else achToast(k, n); }, 1800 + i * 600));
}
function renderAch() {
  const b = $('#achBody'); b.textContent = ''; const got = jget(ACHK, {}), n = Object.keys(got).length;
  const top = el('div', 'achTop'); top.append(el('b', '', `${n} / ${ACH.length}`), el('small', '', 'logros desbloqueados')); const bar = el('u'), fill = el('i'); fill.style.width = (n / ACH.length * 100) + '%'; bar.append(fill); top.append(bar); b.append(top);
  ACH.forEach(([id, name, desc]) => { const r = el('div', 'achI' + (got[id] ? ' on' : '')), t = el('div'); t.append(el('b', '', name), el('small', '', desc)); { const ic = el('span', 'ic'); ic.innerHTML = ico(got[id] ? 'check' : 'dot'); r.append(ic, t); } b.append(r); });
}
const fmtCd = ms => { const x = Math.max(0, Math.ceil(ms / 1000)); return [x / 3600 | 0, x % 3600 / 60 | 0, x % 60].map(v => String(v).padStart(2, '0')).join(':'); };
let misTimer = 0;
function renderMis() {
  const b = $('#misBody'); b.textContent = ''; const m = misEnsure(false);
  if (m.cur) { const d = mDef(m.cur.id), v = Math.min(m.cur.v || 0, d[2]), card = el('div', 'misCard'), t = el('div'); const bar = el('u'), fill = el('i'); fill.style.width = (v / d[2] * 100) + '%'; bar.append(fill);
    t.append(el('small', 'misTag', 'Misión activa'), el('b', '', d[1]), bar, el('small', '', `${v.toLocaleString()} / ${d[2].toLocaleString()}  ·  Recompensa: +60 XP`)); { const ic = el('span', 'misIc'); ic.innerHTML = ico('target'); card.append(ic, t); } b.append(card); }
  else { const card = el('div', 'misCard cool'), t = el('div'); t.append(el('small', 'misTag', 'Misión completada'), el('b', '', 'La siguiente misión aparece en'), el('div', 'misCd')); t.lastChild.id = 'misCd'; { const ic = el('span', 'misIc'); ic.innerHTML = ico('timer'); card.append(ic, t); } b.append(card); }
  b.append(el('div', 'misNote', `Misiones completadas: ${m.done || 0}`));
  const nb = el('div', 'notifCard'), nt = el('div'), btn = el('button', 'notifBtn'); btn.type = 'button'; nt.append(el('b', '', 'Notificaciones del teléfono'), el('small', '', '')); nb.append(nt, btn); b.append(nb);
  notifState().then(st => { const on = st === 'granted' && S.notif !== false; nt.lastChild.textContent = st === 'denied' ? 'Están bloqueadas: actívalas en los ajustes del teléfono.' : on ? 'Te avisaremos cuando una misión termine o cambie.' : 'Activa los avisos para saber cuándo hay una nueva misión.'; btn.textContent = on ? 'Desactivar' : 'Activar'; btn.classList.toggle('on', on); btn.disabled = st === 'denied' || st === 'unsupported';
    btn.onclick = async () => { if (on) { S.notif = false; saveSettings(); } else { const r = await notifAsk(); S.notif = r === 'granted'; saveSettings(); if (r === 'granted') missionSched(misGet()); } renderMis(); }; });
  clearInterval(misTimer); const tick = () => { const mm = misGet(), c = $('#misCd'); if (!c) { clearInterval(misTimer); return; } if (!mm.cur && BWC.now() >= mm.nextAt) { misEnsure(true); renderMis(); updStrip(); return; } c.textContent = fmtCd(mm.nextAt - Date.now()); };
  if (!m.cur) { tick(); misTimer = setInterval(tick, 1000); }
}
function updStrip() {
  try { const got = Object.keys(jget(ACHK, {})).length; $('#achCnt').textContent = `${got}/${ACH.length}`;
    const m = misGet(), mm = $('#misMini'), t = $('#misMiniT'), f = mm.querySelector('i');
    if (m.cur) { const d = mDef(m.cur.id), v = Math.min(m.cur.v || 0, d[2]); t.textContent = d[1]; f.style.width = (v / d[2] * 100) + '%'; mm.classList.remove('cool'); }
    else if (BWC.now() >= (m.nextAt || 0)) { misEnsure(false); return updStrip(); }
    else { const left = m.nextAt - BWC.now(), hh = left / 3600000 | 0, mi = Math.ceil(left % 3600000 / 60000); t.textContent = `Próxima misión en ${hh} h ${mi} min`; f.style.width = '100%'; mm.classList.add('cool'); } } catch (e) {}
}
$('#btnAch').onclick = () => { renderAch(); go('ach'); }; $('#btnAchTop').onclick = $('#btnAch').onclick;
$('#btnMis').onclick = () => { renderMis(); go('mis'); }; $('#btnMisTop').onclick = $('#btnMis').onclick; $('#misMini').onclick = $('#btnMis').onclick; $('#misBack').onclick = () => { clearInterval(misTimer); go('select'); };
$('#achBack').onclick = () => go('select');

/* ---- Avisos estilo Minecraft (logros y misiones) ---- */
const TQ = []; let TB = 0;
const TI = { ach: '<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/>', mis: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r="1"/>', new: '<circle cx="12" cy="13" r="8"/><path d="M12 8v5l3 2M9 3h6"/>' };
const TT = { ach: '¡Logro desbloqueado!', mis: '¡Misión completada!', new: '¡Nueva misión disponible!' };
function achToast(kind, name) { TQ.push([kind, name]); if (!TB) nextToast(); }
function nextToast() {
  const it = TQ.shift(); if (!it) { TB = 0; return; } TB = 1; const [kind, name] = it, t = el('div', 'mcT ' + kind), ic = el('i', 'mcI'), tx = el('div', 'mcX');
  ic.innerHTML = `<svg viewBox="0 0 24 24">${TI[kind]}</svg>`; tx.append(el('small', '', TT[kind]), el('b', '', name)); t.append(ic, tx); $('#achToastHost').append(t);
  try { playWav('combo', 1.35, .55); } catch (e) {}
  setTimeout(() => t.classList.add('out'), 4300); setTimeout(() => { t.remove(); nextToast(); }, 4800);
}

/* ---- Notificaciones del teléfono (APK: programadas con el sistema; web: service worker, según lo que permita el navegador) ---- */
const LNP = () => window.Capacitor && Capacitor.Plugins && Capacitor.Plugins.LocalNotifications;
const swReg = async () => { try { return navigator.serviceWorker ? await navigator.serviceWorker.getRegistration() : null; } catch (e) { return null; } };
async function notifState() { const L = LNP(); if (L) { try { return (await L.checkPermissions()).display; } catch (e) {} } return 'Notification' in window ? Notification.permission : 'unsupported'; }
async function notifAsk() { const L = LNP(); if (L) { try { return (await L.requestPermissions()).display; } catch (e) { return 'denied'; } } if (!('Notification' in window)) return 'unsupported'; try { return await Notification.requestPermission(); } catch (e) { return 'denied'; } }
async function phoneNotify(title, body) {
  if (S.notif === false) return;
  try { const L = LNP(); if (L) { await L.schedule({ notifications: [{ id: 1002, title, body, schedule: { at: new Date(Date.now() + 700) } }] }); return; }
    if ('Notification' in window && Notification.permission === 'granted') { const r = await swReg(); if (r) await r.showNotification(title, { body, icon: 'icon-192.png', badge: 'icon-192.png', tag: 'bw-mis' }); } } catch (e) {}
}
async function missionSched(m) {
  const due = !m.cur && m.nextAt > BWC.now() && S.notif !== false, dev = m.nextAt - BWC.now(), at = Date.now() + Math.max(2000, dev); // la hora del aviso se calcula con el reloj propio
  try { const L = LNP();
    if (L) { await L.cancel({ notifications: [{ id: 1001 }] }); if (due && (await L.checkPermissions()).display === 'granted') { try { await L.createChannel({ id: 'missions', name: 'Misiones', description: 'Aviso de nueva misión', importance: 5, visibility: 1, vibration: true }); } catch (e) {} if (!localStorage.getItem('bwexact')) { try { const ex = await L.checkExactNotificationSetting(); if (ex.exact_alarm !== 'granted') { lsSet('bwexact', '1'); await L.changeExactNotificationSetting(); } } catch (e) {} } await L.schedule({ notifications: [{ id: 1001, channelId: 'missions', title: '¡Nueva misión disponible!', body: 'Ya puedes jugar tu próxima misión de BeatWave.', schedule: { at: new Date(at), allowWhileIdle: true } }] }); } }
    if ('caches' in window) { const c = await caches.open('bw-meta'); await c.put('/_mission', new Response(JSON.stringify({ nextAt: due ? at : 0, notified: 0, on: S.notif !== false }))); }
    const r = await swReg();
    if (r && due && 'Notification' in window && Notification.permission === 'granted' && 'showTrigger' in Notification.prototype && typeof TimestampTrigger !== 'undefined') await r.showNotification('¡Nueva misión disponible!', { body: 'Ya puedes jugar tu próxima misión de BeatWave.', icon: 'icon-192.png', badge: 'icon-192.png', tag: 'bw-mis-next', showTrigger: new TimestampTrigger(at) });
    if (r && r.periodicSync) { try { await r.periodicSync.register('bw-mission', { minInterval: 12 * 3600 * 1000 }); } catch (e) {} }
  } catch (e) {}
}
// al abrir o volver al juego se revisa si ya pasaron las 24 h
const misCheck = () => { const m = misGet(); if (!m.cur && BWC.now() >= (m.nextAt || 0)) misEnsure(true); updStrip(); };
document.addEventListener('visibilitychange', () => { if (!document.hidden) misCheck(); }); setInterval(misCheck, 30000); setTimeout(misCheck, 2500);
/* ---- Filtro por tipo de archivo ---- */
FMT = S.fmt || 'all';
$$('#fmtBar [data-fmt]').forEach(b => { b.classList.toggle('on', b.dataset.fmt === FMT); b.onclick = () => { FMT = b.dataset.fmt; S.fmt = FMT; saveSettings(); $$('#fmtBar [data-fmt]').forEach(x => x.classList.toggle('on', x === b)); renderList(); info(); }; });

/* --- Corregir BPM --- */
$('#oBpm').onclick = async () => {
  $('#optModal').classList.remove('open'); if (!sel || sel.tut) return; const m = sel.map, cur = Math.round(m.bpm || 120);
  const r = await dlg('Corregir BPM', `BPM detectado: ${cur}. Si las líneas de tiempo no coinciden con la música, prueba duplicarlo, bajarlo a la mitad o escribir el tuyo.`, { btns: ['Doblar (×2)', 'Mitad (÷2)', 'Escribir BPM', 'Cancelar'] });
  let nb = 0; if (r.i === 0) nb = cur * 2; else if (r.i === 1) nb = cur / 2; else if (r.i === 2) { const q = await dlg('Escribir BPM', 'Número entre 40 y 300.', { input: String(cur), btns: ['Guardar', 'Cancelar'] }); if (q.i === 0) nb = parseFloat(q.v.replace(',', '.')); }
  if (!(nb >= 40 && nb <= 300)) return r.i <= 2 && r.i !== undefined && nb ? msg('Ese BPM no es válido (40–300).') : undefined;
  const k = nb / (m.bpm || 120); m.bpm = nb; if (Array.isArray(m.bt)) m.bt = m.bt.map(x => x * k); sel.st = null;
  if (sel.bundled && sel.buf && sel.buf.length) DB.mapPut('bwmap8:' + sel.id + '|' + sel.buf.length, m).catch(() => {});
  if (sel.id && !sel.bundled) persist(sel, { map: m }); renderList(); info(); msg('BPM: ' + Math.round(nb));
};

/* --- Repeticiones --- */
let RPLY = null, LASTREP = null;
const loadRep = k => jget('bwrep:' + k, null);
function showPlay(s, x) { // abre la misma pantalla de resultados con una partida guardada
  const g = { song: s, score: x.s, perf: x.p || 0, great: x.g || 0, good: x.o || 0, miss: x.x || 0, max: x.c || 0, mult: x.u || 1, failed: x.r === 'F', modsTxt: x.m || '', rec: null }, rank = x.r, rc = RC[rank] || '#FFD166', isPerfect = rank === 'S' || rank === 'SS' || rank === 'S★';
  if (!x.p && !x.g && !x.o && !x.x) { g.perf = g.great = g.good = g.miss = 0; }
  RESVIEW = true; const old = LASTRES; LASTRES = { g, a: x.a, rank, rc }; $('#result').style.setProperty('--acc', rc); paintResult(g, x.a, rank, rc, false, isPerfect);
  const nb = $('#resBody .newBest'); if (nb) nb.style.display = 'none'; const dt = $('#resBody .rk'); if (dt) dt.textContent = new Date(x.d).toLocaleString() + (x.sv >= 2 ? '' : ' · partida anterior (sin desglose)') + (g.mult !== 1 ? ' · Mods ×' + g.mult.toFixed(2) : '');
  let rp = jget(repKey(x.k, x.d), null); if (!rp) { const best = loadRep(x.k); if (best && best.d && Math.abs(best.d - x.d) < 4000) rp = best; } RESREP = rp ? { ...rp, song: s } : null;
  $('#resReplay').style.display = RESREP ? '' : 'none'; $('#resRank').style.display = 'none'; $('#resBackRank').style.display = ''; go('result');
}
$('#resBackRank').onclick = () => { openRank(LASTRES && LASTRES.g.song); };

const repKey = (k, d) => 'bwrp:' + k + ':' + d;
function saveAttemptRep(rep, d) { try { const key = repKey(rep.k, d); lsSet(key, JSON.stringify({ ...rep, song: undefined })); const ix = jget('bwrpidx', []).filter(x => x !== key); ix.push(key); while (ix.length > 25) localStorage.removeItem(ix.shift()); jset('bwrpidx', ix); } catch (e) {} }
function saveRep(rep) { try { const key = 'bwrep:' + rep.k; lsSet(key, JSON.stringify({ ...rep, song: undefined })); const ix = jget('bwrepidx', []).filter(x => x !== key); ix.push(key); while (ix.length > 20) localStorage.removeItem(ix.shift()); jset('bwrepidx', ix); } catch (e) {} }
function repHooks(g, a, rank, isRecord) {
  if (!g.rp && !g.auto && !g.prac && !g.song.tut && g.rec) { LASTREP = { v: 1, k: fkey(g.song), song: g.song, snap: g.snap, perm: g.perm, m: g.rec, score: g.score | 0, acc: +a.toFixed(2), rank, d: Date.now(), mods: g.modsTxt || '' }; if (isRecord) saveRep(LASTREP); }
  $('#resReplay').style.display = !g.rp && LASTREP && LASTREP.song === g.song ? '' : 'none'; $('#resBackRank').style.display = 'none';
}
async function startReplay(song, rep) {
  if (!song || !rep || rep.k !== fkey(song)) return msg('Esta repetición no corresponde a la canción.');
  try { await ensureBuf(song); } catch (e) { return msg('No pude abrir el audio.'); }
  RPLY = { ...rep, arm: Date.now() }; showLoading(song);
}
$('#resReplay').onclick = () => RESREP && startReplay(RESREP.song, RESREP);

/* ===== Idiomas ===== */
const I18N = {"en": {"Jugar": "Play", "Cómo jugar": "How to play", "Ajustes": "Settings", "Elegir canción": "Pick a song", "Aleatoria": "Random", "Atrás": "Back", "Menú": "Menu", "Audio y volumen": "Audio & volume", "Gráficos y color de notas": "Graphics & note colors", "Jugabilidad": "Gameplay", "Fondo": "Background", "Todos los ajustes": "All settings", "Repetir tutorial": "Repeat tutorial", "Calibrar latencia": "Calibrate latency", "Biblioteca": "Library", "Ayuda": "Help", "Organizar por": "Sort by", "Recientes": "Recent", "Favoritas": "Favorites", "Listas": "Lists", "Buscar canciones": "Search songs", "Buscar ajuste…": "Search setting…", "Audio": "Audio", "Gráficos": "Graphics", "Volumen general": "Master volume", "Volumen de la música": "Music volume", "Volumen del juego (efectos)": "Game volume (effects)", "Pausa": "Pause", "Continuar": "Resume", "Reintentar": "Retry", "Salir": "Exit", "Cerrar": "Close", "Cancelar": "Cancel", "Opciones de la canción": "Song options", "Información": "Information", "Cambiar portada": "Change cover", "Renombrar": "Rename", "Exportar canción": "Export song", "Añadir a una lista": "Add to a list", "Eliminar canción": "Delete song", "Exportar": "Export", "Listo": "Done", "Modificadores": "Modifiers", "Idioma": "Language", "Importar canción": "Import song", "Fácil": "Easy", "Normal": "Normal", "Difícil": "Hard", "Experto": "Expert", "Maestro": "Master", "Rápido": "Fast", "Más notas": "More notes", "Oculto": "Hidden", "Ventanas estrictas": "Strict timing", "Espejo": "Mirror", "Aleatorio": "Random", "Lento": "Slow", "Menos notas": "Fewer notes", "Ventanas amplias": "Wide timing", "Dificultad": "Difficulty", "Crear lista": "Create list", "Nueva lista": "New list", "Crear": "Create", "Registros": "Records", "Importada": "Imported", "Calidad gráfica": "Graphics quality", "Color de notas": "Note color", "Color de la interfaz": "Interface color", "Tamaño de notas": "Note size", "Velocidad de las notas": "Note speed", "Vibración al acertar": "Vibrate on hit", "Atenuación del fondo": "Background dimming", "Mostrar la portada de fondo": "Show cover as background", "Video de fondo en la partida": "Background video in game", "Elegir imagen": "Choose image", "Quitar": "Remove", "Tutorial": "Tutorial", "No hay canciones. Usa “Importar canción”.": "No songs yet. Use “Import song”.", "Toca aquí al oír cada clic": "Tap here at each click", "Elige el formato de exportación:": "Choose export format:", "Exportar video (WebM)": "Export video", "Exportar música (WAV)": "Export music", "Exportar mapa (.json)": "Export map", "Entendido": "Got it", "Con ventaja de puntaje": "Score bonus", "Neutros": "Neutral", "Con desventaja de puntaje": "Score penalty", "Especial": "Special", "Multiplicador de puntaje": "Score multiplier", "Duración de la sesión": "Session length", "Hora actual": "Current time", "Auto: se ajusta sola según tu dispositivo": "Auto: adjusts to your device", "Alta: máxima nitidez (más consumo)": "High: max sharpness (more power)", "Media: equilibrio fijo": "Medium: balanced", "Baja: más fluido, sin efectos extra": "Low: smoother, no extra effects", "Compensación de latencia": "Latency offset", "Calibrar latencia automáticamente": "Calibrate latency automatically", "Tamaño del botón de pausa": "Pause button size", "Posición del botón de pausa": "Pause button position", "Arriba a la derecha": "Top right", "Arriba a la izquierda": "Top left", "Abajo a la derecha": "Bottom right", "Abajo a la izquierda": "Bottom left", "Imagen de ambiente personalizada": "Custom ambient image", "Ninguna imagen seleccionada.": "No image selected.", "La canción y las notas van un 25% más rápido.": "The song and notes are 25% faster.", "Tienes un 55% menos de margen para acertar.": "You get 55% less margin to hit.", "Invierte los carriles y las direcciones.": "Flips lanes and directions.", "Mezcla los carriles al azar.": "Shuffles lanes at random.", "La canción y las notas van un 20% más lento.": "The song and notes are 20% slower.", "Baja un nivel la dificultad del mapa.": "Lowers the map difficulty one level.", "Tienes un 50% más de margen para acertar.": "You get 50% more margin to hit.", "Sube un nivel la dificultad e incluye golpes más sutiles de la canción.": "Raises difficulty one level, with subtler hits.", "Las notas se desvanecen al acercarse a los receptores.": "Notes fade as they near the receptors.", "El juego toca solo, perfecto. Ideal para demostraciones; no cuenta como puntaje.": "The game plays itself. Great for demos; no score.", "Aprende todas las notas": "Learn all the notes", "fijado hasta que lo completes": "pinned until you finish it", "Aprende las notas": "Learn the notes", "Prueba de sincronía": "Sync test", "Estrictas": "Strict", "Amplias": "Wide", "Ranking": "Ranking", "Nacional": "National", "Global": "Global", "Personal": "Personal", "Competir": "Compete", "Logros y misiones": "Achievements & missions", "Misiones de hoy": "Today's missions", "Corregir BPM": "Fix BPM", "Rendimiento": "Performance", "Auto: se ajusta sola": "Auto: adjusts itself", "Ahorro: para equipos lentos": "Saver: for slow devices", "Completo: todos los efectos": "Full: all effects", "Modo daltónico (colores de notas contrastados)": "Colorblind mode (high-contrast note colors)", "Tamaño del texto": "Text size", "Opacidad de la pista": "Track opacity", "Opacidad del círculo (HUD)": "Circle (HUD) opacity", "País": "Country", "Elige tu país…": "Pick your country…", "Entrar": "Sign in", "Cargando…": "Loading…", "Intentos recientes": "Recent attempts", "Mejor puntaje": "Best score", "Precisión": "Accuracy", "Intentos": "Attempts", "Doblar (×2)": "Double (×2)", "Mitad (÷2)": "Half (÷2)", "Escribir BPM": "Type BPM", "Elige tu país arriba para ver el ranking Nacional.": "Pick your country above to see the National ranking.", "Todavía no hay puntajes aquí. ¡Sé el primero!": "No scores here yet. Be the first!", "Inicia sesión para ver el ranking y enviar tu puntaje.": "Sign in to see the ranking and submit your score.", "El tutorial no cuenta para el ranking.": "The tutorial does not count for the ranking.", "Esta canción no está en el sitio web de BeatWave. Solo las canciones oficiales entran al ranking Nacional y Global. Tus intentos sí quedan en la pestaña Personal.": "This song is not on the BeatWave website. Only official songs enter the National and Global rankings. Your attempts still appear in the Personal tab.", "El ranking en línea todavía no está activado en esta versión.": "Online ranking is not enabled in this version yet.", "Aún no has terminado esta canción. Tus intentos y tu mejor puntaje aparecerán aquí.": "You haven't finished this song yet. Your attempts and best score will show here.", "Ver repetición": "Watch replay", "Ver mejor repetición": "Watch best replay", "REPETICIÓN (no cuenta)": "REPLAY (does not count)", "Esta repetición no corresponde a la canción.": "This replay does not match the song.", "Recorrido": "Tour", "Siguiente": "Next", "Saltar recorrido": "Skip tour", "Empezar el tutorial de juego": "Start the gameplay tutorial", "Tu perfil": "Your profile", "Reproductor": "Player", "El logo": "The logo", "Menú principal": "Main menu", "Buscador": "Search", "Formas de ver la biblioteca": "Ways to browse your library", "Tus canciones": "Your songs", "Detalle de la canción": "Song details", "Botones de abajo": "Bottom buttons", "Menú lateral": "Side menu", "Durante la partida": "During a game", "¡Listo!": "All set!", "Aquí ves tu nombre, tu nivel y tu XP. Tócalo para cambiar tu nombre.": "Here you see your name, level and XP. Tap it to change your name.", "Controla la música del menú: canción anterior, pausa y siguiente. Suena tu biblioteca mientras estás aquí.": "Control the menu music: previous, pause and next. Your library plays while you are here.", "Es el botón principal: tócalo para abrir el menú. Late al ritmo de la canción que suena.": "The main button: tap it to open the menu. It pulses to the beat of the song.", "Jugar: elige una canción. Cómo jugar: guía de notas y controles. Ajustes: personaliza el juego. Salir: cierra la app.": "Play: pick a song. How to play: notes and controls guide. Settings: customize the game. Exit: close the app.", "Escribe parte del título o del artista para encontrar una canción al instante.": "Type part of the title or artist to find a song instantly.", "Recientes: lo último que jugaste. Favoritas: las que marcaste con la estrella. Listas: tus carpetas de canciones.": "Recent: what you played last. Favorites: songs you starred. Lists: your song folders.", "Cambia entre lista, filas compactas, cuadrícula y carrusel, según cuántas canciones tengas.": "Switch between list, compact rows, grid and carousel depending on how many songs you have.", "Toca una para elegirla. La estrella la marca como favorita y los tres puntos abren sus opciones: información, portada, renombrar, exportar, corregir BPM, añadir a una lista y eliminar.": "Tap one to select it. The star marks it as a favorite and the three dots open its options: info, cover, rename, export, fix BPM, add to a list and delete.", "Dificultad con puntos de colores, duración, cantidad de notas, BPM y tu mejor récord. El fondo cambia a la portada de la canción.": "Difficulty dots, duration, note count, BPM and your best record. The background changes to the song cover.", "Fácil: solo los golpes más marcados. Normal: más notas y algunas dobles. Difícil: muchas notas, rachas rápidas y notas largas.": "Easy: only the strongest beats. Normal: more notes and some doubles. Hard: many notes, fast streams and long notes.", "Cambian el reto y el puntaje, como en osu!: los que dan ventaja (Rápido, Más notas, Oculto…) suben el puntaje y los de desventaja (Lento, Sin fallo…) lo bajan. Auto toca solo y no puntúa.": "They change the challenge and the score, like in osu!: advantage mods (Fast, More notes, Hidden…) raise the score and disadvantage mods (Slow, No fail…) lower it. Auto plays by itself and does not score.", "Empieza la canción elegida. Antes se prepara el nivel: el juego analiza el audio y crea las notas.": "Starts the chosen song. First the level is prepared: the game analyzes the audio and creates the notes.", "Atrás, Mods, Azar (canción al azar), Listas (crear listas), Importar (añade tus canciones; puedes elegir varias) y Más (opciones de la canción).": "Back, Mods, Random (random song), Lists (create lists), Import (add your songs; you can pick several) and More (song options).", "Importar canción. Competir: Mis récords (tus intentos y repeticiones) y Logros y misiones diarias. Ajustes. Ayuda: Cómo jugar, Repetir tutorial y Calibrar latencia.": "Import a song. Compete: My records (your attempts and replays) and Achievements and daily missions. Settings. Help: How to play, Repeat tutorial and Calibrate latency.", "Audio: volúmenes. Gráficos: colores, calidad, rendimiento, opacidad de la pista y del círculo, modo daltónico y tamaño del texto. Jugabilidad: velocidad de notas, latencia (con calibración), vibración y botón de pausa. Fondo: portada, video y oscuridad.": "Audio: volumes. Graphics: colors, quality, performance, track and circle opacity, colorblind mode and text size. Gameplay: note speed, latency (with calibration), vibration and pause button. Background: cover, video and darkness.", "Arriba ves tu puntaje, la precisión y el combo; el botón de pausa te deja Continuar, Reintentar o Salir (al volver hay cuenta de 3 segundos). Abajo, el ecualizador late con la música. Al terminar verás tus resultados, tu rango, tus récords y podrás ver la repetición.": "At the top you see your score, accuracy and combo; the pause button lets you Continue, Retry or Exit (there is a 3-second countdown when you return). At the bottom, the equalizer pulses with the music. When you finish you will see your results, your rank, your records and can watch the replay.", "Ya conoces todo. Ahora viene el tutorial de juego: aprenderás las notas Tap, largas, Flick, Slide y Sync.": "You know it all now. Next is the gameplay tutorial: you will learn Tap, long, Flick, Slide and Sync notes.", "Atrás. Mods: modificadores que cambian el reto y el puntaje, como en osu! (los que dan ventaja suben el puntaje, los de desventaja lo bajan, Auto toca solo y no puntúa). Azar: canción al azar. Listas: crear carpetas. Importar: añade tus canciones, puedes elegir varias. Más: opciones de la canción.": "Back. Mods: modifiers that change the challenge and the score, like in osu! (advantage mods raise the score, disadvantage mods lower it, Auto plays by itself and does not score). Random: random song. Lists: create folders. Import: add your songs, you can pick several. More: song options."}, "pt": {"Jugar": "Jogar", "Cómo jugar": "Como jogar", "Ajustes": "Ajustes", "Elegir canción": "Escolher música", "Aleatoria": "Aleatória", "Atrás": "Voltar", "Menú": "Menu", "Audio y volumen": "Áudio e volume", "Gráficos y color de notas": "Gráficos e cor das notas", "Jugabilidad": "Jogabilidade", "Fondo": "Fundo", "Todos los ajustes": "Todos os ajustes", "Repetir tutorial": "Repetir tutorial", "Calibrar latencia": "Calibrar latência", "Biblioteca": "Biblioteca", "Ayuda": "Ajuda", "Organizar por": "Ordenar por", "Recientes": "Recentes", "Favoritas": "Favoritas", "Listas": "Listas", "Buscar canciones": "Buscar músicas", "Buscar ajuste…": "Buscar ajuste…", "Audio": "Áudio", "Gráficos": "Gráficos", "Volumen general": "Volume geral", "Volumen de la música": "Volume da música", "Volumen del juego (efectos)": "Volume do jogo (efeitos)", "Pausa": "Pausa", "Continuar": "Continuar", "Reintentar": "Tentar de novo", "Salir": "Sair", "Cerrar": "Fechar", "Cancelar": "Cancelar", "Opciones de la canción": "Opções da música", "Información": "Informação", "Cambiar portada": "Mudar capa", "Renombrar": "Renomear", "Exportar canción": "Exportar música", "Añadir a una lista": "Adicionar a uma lista", "Eliminar canción": "Excluir música", "Exportar": "Exportar", "Listo": "Pronto", "Modificadores": "Modificadores", "Idioma": "Idioma", "Importar canción": "Importar música", "Fácil": "Fácil", "Normal": "Normal", "Difícil": "Difícil", "Experto": "Especialista", "Maestro": "Mestre", "Rápido": "Rápido", "Más notas": "Mais notas", "Oculto": "Oculto", "Ventanas estrictas": "Janelas estritas", "Espejo": "Espelho", "Aleatorio": "Aleatório", "Lento": "Lento", "Menos notas": "Menos notas", "Ventanas amplias": "Janelas amplas", "Dificultad": "Dificuldade", "Crear lista": "Criar lista", "Nueva lista": "Nova lista", "Crear": "Criar", "Registros": "Recordes", "Importada": "Importada", "Calidad gráfica": "Qualidade gráfica", "Color de notas": "Cor das notas", "Color de la interfaz": "Cor da interface", "Tamaño de notas": "Tamanho das notas", "Velocidad de las notas": "Velocidade das notas", "Vibración al acertar": "Vibrar ao acertar", "Atenuación del fondo": "Escurecer fundo", "Mostrar la portada de fondo": "Mostrar capa no fundo", "Video de fondo en la partida": "Vídeo de fundo na partida", "Elegir imagen": "Escolher imagem", "Quitar": "Remover", "Tutorial": "Tutorial", "No hay canciones. Usa “Importar canción”.": "Sem músicas. Use “Importar música”.", "Toca aquí al oír cada clic": "Toque aqui a cada clique", "Elige el formato de exportación:": "Escolha o formato de exportação:", "Exportar video (WebM)": "Exportar vídeo", "Exportar música (WAV)": "Exportar música", "Exportar mapa (.json)": "Exportar mapa", "Entendido": "Entendi", "Con ventaja de puntaje": "Com vantagem de pontos", "Neutros": "Neutros", "Con desventaja de puntaje": "Com desvantagem de pontos", "Especial": "Especial", "Multiplicador de puntaje": "Multiplicador de pontos", "Duración de la sesión": "Duração da sessão", "Hora actual": "Hora atual", "Auto: se ajusta sola según tu dispositivo": "Auto: ajusta-se ao seu dispositivo", "Alta: máxima nitidez (más consumo)": "Alta: máxima nitidez (mais consumo)", "Media: equilibrio fijo": "Média: equilibrada", "Baja: más fluido, sin efectos extra": "Baixa: mais fluida, sem efeitos extras", "Compensación de latencia": "Compensação de latência", "Calibrar latencia automáticamente": "Calibrar latência automaticamente", "Tamaño del botón de pausa": "Tamanho do botão de pausa", "Posición del botón de pausa": "Posição do botão de pausa", "Arriba a la derecha": "Superior direito", "Arriba a la izquierda": "Superior esquerdo", "Abajo a la derecha": "Inferior direito", "Abajo a la izquierda": "Inferior esquerdo", "Imagen de ambiente personalizada": "Imagem de ambiente personalizada", "Ninguna imagen seleccionada.": "Nenhuma imagem selecionada.", "La canción y las notas van un 25% más rápido.": "A música e as notas ficam 25% mais rápidas.", "Tienes un 55% menos de margen para acertar.": "Você tem 55% menos margem para acertar.", "Invierte los carriles y las direcciones.": "Inverte as pistas e as direções.", "Mezcla los carriles al azar.": "Embaralha as pistas ao acaso.", "La canción y las notas van un 20% más lento.": "A música e as notas ficam 20% mais lentas.", "Baja un nivel la dificultad del mapa.": "Baixa um nível a dificuldade do mapa.", "Tienes un 50% más de margen para acertar.": "Você tem 50% mais margem para acertar.", "Sube un nivel la dificultad e incluye golpes más sutiles de la canción.": "Sobe um nível a dificuldade, com batidas mais sutis.", "Las notas se desvanecen al acercarse a los receptores.": "As notas desaparecem ao se aproximar.", "El juego toca solo, perfecto. Ideal para demostraciones; no cuenta como puntaje.": "O jogo toca sozinho. Ideal para demos; não conta pontos.", "Aprende todas las notas": "Aprenda todas as notas", "fijado hasta que lo completes": "fixado até você completar", "Aprende las notas": "Aprenda as notas", "Prueba de sincronía": "Teste de sincronia", "Estrictas": "Estritas", "Amplias": "Amplas", "Ranking": "Ranking", "Nacional": "Nacional", "Global": "Global", "Personal": "Pessoal", "Competir": "Competir", "Logros y misiones": "Conquistas e missões", "Misiones de hoy": "Missões de hoje", "Corregir BPM": "Corrigir BPM", "Rendimiento": "Desempenho", "Auto: se ajusta sola": "Auto: ajusta sozinho", "Ahorro: para equipos lentos": "Economia: para aparelhos lentos", "Completo: todos los efectos": "Completo: todos os efeitos", "Modo daltónico (colores de notas contrastados)": "Modo daltônico (cores de notas contrastantes)", "Tamaño del texto": "Tamanho do texto", "Opacidad de la pista": "Opacidade da pista", "Opacidad del círculo (HUD)": "Opacidade do círculo (HUD)", "País": "País", "Elige tu país…": "Escolha seu país…", "Entrar": "Entrar", "Cargando…": "Carregando…", "Intentos recientes": "Tentativas recentes", "Mejor puntaje": "Melhor pontuação", "Precisión": "Precisão", "Intentos": "Tentativas", "Doblar (×2)": "Dobrar (×2)", "Mitad (÷2)": "Metade (÷2)", "Escribir BPM": "Digitar BPM", "Elige tu país arriba para ver el ranking Nacional.": "Escolha seu país acima para ver o ranking Nacional.", "Todavía no hay puntajes aquí. ¡Sé el primero!": "Ainda não há pontuações aqui. Seja o primeiro!", "Inicia sesión para ver el ranking y enviar tu puntaje.": "Entre para ver o ranking e enviar sua pontuação.", "El tutorial no cuenta para el ranking.": "O tutorial não conta para o ranking.", "Esta canción no está en el sitio web de BeatWave. Solo las canciones oficiales entran al ranking Nacional y Global. Tus intentos sí quedan en la pestaña Personal.": "Esta música não está no site do BeatWave. Só as músicas oficiais entram nos rankings Nacional e Global. Suas tentativas aparecem na aba Pessoal.", "El ranking en línea todavía no está activado en esta versión.": "O ranking online ainda não está ativado nesta versão.", "Aún no has terminado esta canción. Tus intentos y tu mejor puntaje aparecerán aquí.": "Você ainda não terminou esta música. Suas tentativas e melhor pontuação aparecerão aqui.", "Ver repetición": "Ver replay", "Ver mejor repetición": "Ver melhor replay", "REPETICIÓN (no cuenta)": "REPLAY (não conta)", "Esta repetición no corresponde a la canción.": "Este replay não corresponde à música."}, "fr": {"Jugar": "Jouer", "Cómo jugar": "Comment jouer", "Ajustes": "Réglages", "Elegir canción": "Choisir un titre", "Aleatoria": "Aléatoire", "Atrás": "Retour", "Menú": "Menu", "Audio y volumen": "Audio et volume", "Gráficos y color de notas": "Graphismes et couleur des notes", "Jugabilidad": "Jouabilité", "Fondo": "Arrière-plan", "Todos los ajustes": "Tous les réglages", "Repetir tutorial": "Refaire le tutoriel", "Calibrar latencia": "Calibrer la latence", "Biblioteca": "Bibliothèque", "Ayuda": "Aide", "Organizar por": "Trier par", "Recientes": "Récents", "Favoritas": "Favoris", "Listas": "Listes", "Buscar canciones": "Chercher des titres", "Buscar ajuste…": "Chercher un réglage…", "Audio": "Audio", "Gráficos": "Graphismes", "Volumen general": "Volume général", "Volumen de la música": "Volume de la musique", "Volumen del juego (efectos)": "Volume du jeu (effets)", "Pausa": "Pause", "Continuar": "Reprendre", "Reintentar": "Réessayer", "Salir": "Quitter", "Cerrar": "Fermer", "Cancelar": "Annuler", "Opciones de la canción": "Options du titre", "Información": "Informations", "Cambiar portada": "Changer la pochette", "Renombrar": "Renommer", "Exportar canción": "Exporter le titre", "Añadir a una lista": "Ajouter à une liste", "Eliminar canción": "Supprimer le titre", "Exportar": "Exporter", "Listo": "Terminé", "Modificadores": "Modificateurs", "Idioma": "Langue", "Importar canción": "Importer un titre", "Fácil": "Facile", "Normal": "Normal", "Difícil": "Difficile", "Experto": "Expert", "Maestro": "Maître", "Rápido": "Rapide", "Más notas": "Plus de notes", "Oculto": "Caché", "Ventanas estrictas": "Fenêtres strictes", "Espejo": "Miroir", "Aleatorio": "Aléatoire", "Lento": "Lent", "Menos notas": "Moins de notes", "Ventanas amplias": "Fenêtres larges", "Dificultad": "Difficulté", "Crear lista": "Créer une liste", "Nueva lista": "Nouvelle liste", "Crear": "Créer", "Registros": "Records", "Importada": "Importée", "Calidad gráfica": "Qualité graphique", "Color de notas": "Couleur des notes", "Color de la interfaz": "Couleur de l’interface", "Tamaño de notas": "Taille des notes", "Velocidad de las notas": "Vitesse des notes", "Vibración al acertar": "Vibrer au succès", "Atenuación del fondo": "Assombrissement du fond", "Mostrar la portada de fondo": "Afficher la pochette en fond", "Video de fondo en la partida": "Vidéo de fond en jeu", "Elegir imagen": "Choisir une image", "Quitar": "Retirer", "Tutorial": "Tutoriel", "No hay canciones. Usa “Importar canción”.": "Aucun titre. Utilisez « Importer un titre ».", "Toca aquí al oír cada clic": "Touchez ici à chaque clic", "Elige el formato de exportación:": "Choisissez le format d’export :", "Exportar video (WebM)": "Exporter la vidéo", "Exportar música (WAV)": "Exporter la musique", "Exportar mapa (.json)": "Exporter la carte", "Entendido": "Compris", "Con ventaja de puntaje": "Avec bonus de score", "Neutros": "Neutres", "Con desventaja de puntaje": "Avec malus de score", "Especial": "Spécial", "Multiplicador de puntaje": "Multiplicateur de score", "Duración de la sesión": "Durée de la session", "Hora actual": "Heure actuelle", "Auto: se ajusta sola según tu dispositivo": "Auto : s’adapte à votre appareil", "Alta: máxima nitidez (más consumo)": "Haute : netteté max (plus de conso)", "Media: equilibrio fijo": "Moyenne : équilibrée", "Baja: más fluido, sin efectos extra": "Basse : plus fluide, sans effets", "Compensación de latencia": "Compensation de latence", "Calibrar latencia automáticamente": "Calibrer la latence automatiquement", "Tamaño del botón de pausa": "Taille du bouton pause", "Posición del botón de pausa": "Position du bouton pause", "Arriba a la derecha": "En haut à droite", "Arriba a la izquierda": "En haut à gauche", "Abajo a la derecha": "En bas à droite", "Abajo a la izquierda": "En bas à gauche", "Imagen de ambiente personalizada": "Image d’ambiance personnalisée", "Ninguna imagen seleccionada.": "Aucune image sélectionnée.", "La canción y las notas van un 25% más rápido.": "Le morceau et les notes vont 25 % plus vite.", "Tienes un 55% menos de margen para acertar.": "Vous avez 55 % de marge en moins.", "Invierte los carriles y las direcciones.": "Inverse les voies et les directions.", "Mezcla los carriles al azar.": "Mélange les voies au hasard.", "La canción y las notas van un 20% más lento.": "Le morceau et les notes vont 20 % plus lentement.", "Baja un nivel la dificultad del mapa.": "Baisse la difficulté d’un niveau.", "Tienes un 50% más de margen para acertar.": "Vous avez 50 % de marge en plus.", "Sube un nivel la dificultad e incluye golpes más sutiles de la canción.": "Monte d’un niveau, avec des frappes plus subtiles.", "Las notas se desvanecen al acercarse a los receptores.": "Les notes s’estompent en approchant.", "El juego toca solo, perfecto. Ideal para demostraciones; no cuenta como puntaje.": "Le jeu joue seul. Idéal pour les démos ; sans score.", "Aprende todas las notas": "Apprenez toutes les notes", "fijado hasta que lo completes": "épinglé jusqu’à la fin", "Aprende las notas": "Apprenez les notes", "Prueba de sincronía": "Test de synchro", "Estrictas": "Strictes", "Amplias": "Larges", "Ranking": "Classement", "Nacional": "National", "Global": "Mondial", "Personal": "Personnel", "Competir": "Compétition", "Logros y misiones": "Succès et missions", "Misiones de hoy": "Missions du jour", "Corregir BPM": "Corriger le BPM", "Rendimiento": "Performances", "Auto: se ajusta sola": "Auto : s'ajuste seul", "Ahorro: para equipos lentos": "Économie : appareils lents", "Completo: todos los efectos": "Complet : tous les effets", "Modo daltónico (colores de notas contrastados)": "Mode daltonien (couleurs de notes contrastées)", "Tamaño del texto": "Taille du texte", "Opacidad de la pista": "Opacité de la piste", "Opacidad del círculo (HUD)": "Opacité du cercle (HUD)", "País": "Pays", "Elige tu país…": "Choisis ton pays…", "Entrar": "Se connecter", "Cargando…": "Chargement…", "Intentos recientes": "Essais récents", "Mejor puntaje": "Meilleur score", "Precisión": "Précision", "Intentos": "Essais", "Doblar (×2)": "Doubler (×2)", "Mitad (÷2)": "Moitié (÷2)", "Escribir BPM": "Saisir le BPM", "Elige tu país arriba para ver el ranking Nacional.": "Choisis ton pays ci-dessus pour voir le classement national.", "Todavía no hay puntajes aquí. ¡Sé el primero!": "Pas encore de scores ici. Sois le premier !", "Inicia sesión para ver el ranking y enviar tu puntaje.": "Connecte-toi pour voir le classement et envoyer ton score.", "El tutorial no cuenta para el ranking.": "Le tutoriel ne compte pas pour le classement.", "Esta canción no está en el sitio web de BeatWave. Solo las canciones oficiales entran al ranking Nacional y Global. Tus intentos sí quedan en la pestaña Personal.": "Ce titre n'est pas sur le site de BeatWave. Seuls les titres officiels entrent dans les classements national et mondial. Tes essais restent dans l'onglet Personnel.", "El ranking en línea todavía no está activado en esta versión.": "Le classement en ligne n'est pas encore activé dans cette version.", "Aún no has terminado esta canción. Tus intentos y tu mejor puntaje aparecerán aquí.": "Tu n'as pas encore fini ce titre. Tes essais et ton meilleur score apparaîtront ici.", "Ver repetición": "Voir le replay", "Ver mejor repetición": "Voir le meilleur replay", "REPETICIÓN (no cuenta)": "REPLAY (ne compte pas)", "Esta repetición no corresponde a la canción.": "Ce replay ne correspond pas au titre."}, "de": {"Jugar": "Spielen", "Cómo jugar": "Spielanleitung", "Ajustes": "Einstellungen", "Elegir canción": "Song wählen", "Aleatoria": "Zufällig", "Atrás": "Zurück", "Menú": "Menü", "Audio y volumen": "Audio und Lautstärke", "Gráficos y color de notas": "Grafik und Notenfarbe", "Jugabilidad": "Gameplay", "Fondo": "Hintergrund", "Todos los ajustes": "Alle Einstellungen", "Repetir tutorial": "Tutorial wiederholen", "Calibrar latencia": "Latenz kalibrieren", "Biblioteca": "Bibliothek", "Ayuda": "Hilfe", "Organizar por": "Sortieren nach", "Recientes": "Zuletzt", "Favoritas": "Favoriten", "Listas": "Listen", "Buscar canciones": "Songs suchen", "Buscar ajuste…": "Einstellung suchen…", "Audio": "Audio", "Gráficos": "Grafik", "Volumen general": "Gesamtlautstärke", "Volumen de la música": "Musiklautstärke", "Volumen del juego (efectos)": "Spiellautstärke (Effekte)", "Pausa": "Pause", "Continuar": "Weiter", "Reintentar": "Nochmal", "Salir": "Beenden", "Cerrar": "Schließen", "Cancelar": "Abbrechen", "Opciones de la canción": "Song-Optionen", "Información": "Informationen", "Cambiar portada": "Cover ändern", "Renombrar": "Umbenennen", "Exportar canción": "Song exportieren", "Añadir a una lista": "Zu einer Liste hinzufügen", "Eliminar canción": "Song löschen", "Exportar": "Exportieren", "Listo": "Fertig", "Modificadores": "Modifikatoren", "Idioma": "Sprache", "Importar canción": "Song importieren", "Fácil": "Leicht", "Normal": "Normal", "Difícil": "Schwer", "Experto": "Experte", "Maestro": "Meister", "Rápido": "Schnell", "Más notas": "Mehr Noten", "Oculto": "Versteckt", "Ventanas estrictas": "Strenges Timing", "Espejo": "Spiegel", "Aleatorio": "Zufall", "Lento": "Langsam", "Menos notas": "Weniger Noten", "Ventanas amplias": "Großzügiges Timing", "Dificultad": "Schwierigkeit", "Crear lista": "Liste erstellen", "Nueva lista": "Neue Liste", "Crear": "Erstellen", "Registros": "Rekorde", "Importada": "Importiert", "Calidad gráfica": "Grafikqualität", "Color de notas": "Notenfarbe", "Color de la interfaz": "Oberflächenfarbe", "Tamaño de notas": "Notengröße", "Velocidad de las notas": "Notengeschwindigkeit", "Vibración al acertar": "Vibration bei Treffer", "Atenuación del fondo": "Hintergrund abdunkeln", "Mostrar la portada de fondo": "Cover als Hintergrund", "Video de fondo en la partida": "Hintergrundvideo im Spiel", "Elegir imagen": "Bild wählen", "Quitar": "Entfernen", "Tutorial": "Tutorial", "No hay canciones. Usa “Importar canción”.": "Keine Songs. Nutze „Song importieren“.", "Toca aquí al oír cada clic": "Tippe hier bei jedem Klick", "Elige el formato de exportación:": "Exportformat wählen:", "Exportar video (WebM)": "Video exportieren", "Exportar música (WAV)": "Musik exportieren", "Exportar mapa (.json)": "Karte exportieren", "Entendido": "Verstanden", "Con ventaja de puntaje": "Mit Punktebonus", "Neutros": "Neutral", "Con desventaja de puntaje": "Mit Punkteabzug", "Especial": "Spezial", "Multiplicador de puntaje": "Punktemultiplikator", "Duración de la sesión": "Sitzungsdauer", "Hora actual": "Aktuelle Zeit", "Auto: se ajusta sola según tu dispositivo": "Auto: passt sich deinem Gerät an", "Alta: máxima nitidez (más consumo)": "Hoch: maximale Schärfe (mehr Verbrauch)", "Media: equilibrio fijo": "Mittel: ausgewogen", "Baja: más fluido, sin efectos extra": "Niedrig: flüssiger, ohne Extras", "Compensación de latencia": "Latenzausgleich", "Calibrar latencia automáticamente": "Latenz automatisch kalibrieren", "Tamaño del botón de pausa": "Größe der Pause-Taste", "Posición del botón de pausa": "Position der Pause-Taste", "Arriba a la derecha": "Oben rechts", "Arriba a la izquierda": "Oben links", "Abajo a la derecha": "Unten rechts", "Abajo a la izquierda": "Unten links", "Imagen de ambiente personalizada": "Eigenes Stimmungsbild", "Ninguna imagen seleccionada.": "Kein Bild ausgewählt.", "La canción y las notas van un 25% más rápido.": "Song und Noten sind 25 % schneller.", "Tienes un 55% menos de margen para acertar.": "Du hast 55 % weniger Spielraum.", "Invierte los carriles y las direcciones.": "Kehrt Spuren und Richtungen um.", "Mezcla los carriles al azar.": "Mischt die Spuren zufällig.", "La canción y las notas van un 20% más lento.": "Song und Noten sind 20 % langsamer.", "Baja un nivel la dificultad del mapa.": "Senkt die Schwierigkeit um eine Stufe.", "Tienes un 50% más de margen para acertar.": "Du hast 50 % mehr Spielraum.", "Sube un nivel la dificultad e incluye golpes más sutiles de la canción.": "Eine Stufe schwerer, mit feineren Schlägen.", "Las notas se desvanecen al acercarse a los receptores.": "Noten verblassen beim Näherkommen.", "El juego toca solo, perfecto. Ideal para demostraciones; no cuenta como puntaje.": "Das Spiel spielt allein. Ideal für Demos; zählt nicht.", "Aprende todas las notas": "Lerne alle Noten", "fijado hasta que lo completes": "angeheftet bis zum Abschluss", "Aprende las notas": "Lerne die Noten", "Prueba de sincronía": "Sync-Test", "Estrictas": "Streng", "Amplias": "Großzügig", "Ranking": "Rangliste", "Nacional": "National", "Global": "Global", "Personal": "Persönlich", "Competir": "Wettbewerb", "Logros y misiones": "Erfolge & Missionen", "Misiones de hoy": "Heutige Missionen", "Corregir BPM": "BPM korrigieren", "Rendimiento": "Leistung", "Auto: se ajusta sola": "Auto: passt sich an", "Ahorro: para equipos lentos": "Sparmodus: für langsame Geräte", "Completo: todos los efectos": "Voll: alle Effekte", "Modo daltónico (colores de notas contrastados)": "Farbenblind-Modus (kontrastreiche Notenfarben)", "Tamaño del texto": "Textgröße", "Opacidad de la pista": "Deckkraft der Bahn", "Opacidad del círculo (HUD)": "Deckkraft des Kreises (HUD)", "País": "Land", "Elige tu país…": "Wähle dein Land…", "Entrar": "Anmelden", "Cargando…": "Lädt…", "Intentos recientes": "Letzte Versuche", "Mejor puntaje": "Bestwert", "Precisión": "Genauigkeit", "Intentos": "Versuche", "Doblar (×2)": "Verdoppeln (×2)", "Mitad (÷2)": "Hälfte (÷2)", "Escribir BPM": "BPM eingeben", "Elige tu país arriba para ver el ranking Nacional.": "Wähle oben dein Land, um die nationale Rangliste zu sehen.", "Todavía no hay puntajes aquí. ¡Sé el primero!": "Noch keine Ergebnisse. Sei der Erste!", "Inicia sesión para ver el ranking y enviar tu puntaje.": "Melde dich an, um die Rangliste zu sehen und dein Ergebnis zu senden.", "El tutorial no cuenta para el ranking.": "Das Tutorial zählt nicht für die Rangliste.", "Esta canción no está en el sitio web de BeatWave. Solo las canciones oficiales entran al ranking Nacional y Global. Tus intentos sí quedan en la pestaña Personal.": "Dieser Song ist nicht auf der BeatWave-Website. Nur offizielle Songs kommen in die nationale und globale Rangliste. Deine Versuche stehen im Tab Persönlich.", "El ranking en línea todavía no está activado en esta versión.": "Die Online-Rangliste ist in dieser Version noch nicht aktiviert.", "Aún no has terminado esta canción. Tus intentos y tu mejor puntaje aparecerán aquí.": "Du hast diesen Song noch nicht beendet. Deine Versuche und dein Bestwert erscheinen hier.", "Ver repetición": "Replay ansehen", "Ver mejor repetición": "Beste Wiederholung ansehen", "REPETICIÓN (no cuenta)": "WIEDERHOLUNG (zählt nicht)", "Esta repetición no corresponde a la canción.": "Diese Wiederholung passt nicht zum Song."}};
Object.assign(I18N.en, { 'Mis récords': 'My records', 'Tu perfil': 'Your profile', 'Guardar': 'Save', 'Tu nombre': 'Your name', 'Audio': 'Audio', 'Gráficos': 'Graphics', 'Juego': 'Gameplay', 'Fondo': 'Background', 'Datos': 'Data', 'Color de notas': 'Note color', 'Color de la interfaz': 'Interface color', 'Normales': 'Normal', 'Largas': 'Long', 'Principal': 'Main', 'Secundario': 'Secondary', 'Brillo': 'Brightness', 'Animación al golpear la nota': 'Hit animation', 'Limitar a 30 FPS (para celulares lentos)': 'Limit to 30 FPS (for slow phones)', 'Forma de las notas': 'Note shape', 'Redondeadas': 'Rounded', 'Circulares': 'Circular', 'Cuadradas': 'Square', 'Escuchar un adelanto al elegir canción': 'Play a preview when picking a song', 'Modo práctica': 'Practice mode', 'Activar (no guarda récords ni XP)': 'Enable (no records or XP saved)', 'Empezar desde': 'Start from', 'El inicio': 'The start', 'Copia de seguridad': 'Backup', 'Guardar copia': 'Save backup', 'Cargar copia': 'Load backup', 'Compartir': 'Share', 'Ajustes': 'Settings', 'Cerrar': 'Close', 'Mínimo: para equipos muy lentos': 'Minimum: for very slow devices', 'Modo mínimo activado: este equipo es muy lento. Puedes cambiarlo en Ajustes → Gráficos.': 'Minimum mode on: this device is very slow. You can change it in Settings → Graphics.' });
Object.assign(I18N.pt, { 'Mis récords': 'Meus recordes', 'Audio': 'Áudio', 'Gráficos': 'Gráficos', 'Juego': 'Jogo', 'Fondo': 'Fundo', 'Datos': 'Dados', 'Compartir': 'Compartilhar' });
Object.assign(I18N.fr, { 'Mis récords': 'Mes records', 'Gráficos': 'Graphismes', 'Juego': 'Jeu', 'Fondo': 'Fond', 'Datos': 'Données', 'Compartir': 'Partager' });
Object.assign(I18N.de, { 'Mis récords': 'Meine Rekorde', 'Gráficos': 'Grafik', 'Juego': 'Spiel', 'Fondo': 'Hintergrund', 'Datos': 'Daten', 'Compartir': 'Teilen' });
const trMemo = {}, NN = { en: ' notes', pt: ' notas', fr: ' notes', de: ' Noten' }, TOT = { en: 'You have N songs in total!', pt: 'Você tem N músicas!', fr: 'Vous avez N titres !', de: 'Du hast N Songs!' };
function trS(s) {
  const lg = S.lang || 'es'; if (lg === 'es' || !s) return s;
  const key = lg + '|' + s; if (trMemo[key] !== undefined) return trMemo[key];
  const d = I18N[lg] || {}; let r, m;
  if ((m = s.match(/^(\d+) notas$/))) r = m[1] + NN[lg];
  else if ((m = s.match(/^¡Tienes un total de (\d+) canciones!$/))) r = TOT[lg].replace('N', m[1]);
  else if ((m = s.match(/^(Modificadores)( \+\d+)$/))) r = (d[m[1]] || m[1]) + m[2];
  else r = d[s] || s.split(' · ').map(x => { const i = x.indexOf(': '); return d[x] || (i > 0 && d[x.slice(0, i)] ? d[x.slice(0, i)] + x.slice(i) : x); }).join(' · ');
  return (trMemo[key] = r);
}
let trBusy = 0;
const trText = n => { const lg = S.lang || 'es', d = I18N[lg] || {}, o = n._o || (n._o = n.nodeValue), k = o.trim(); if (k) { const t = trS(k); if (n.nodeValue !== o.replace(k, t)) n.nodeValue = o.replace(k, t); } };
const trOk = n => !/SCRIPT|STYLE|OPTION/.test(n.parentNode.nodeName);
function trTree(root) {
  if (root.nodeType === 3) { if (trOk(root)) trText(root); return; }
  if (root.nodeType !== 1) return;
  const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let n; (n = w.nextNode());) if (trOk(n)) trText(n);
}
function applyLang() {
  const lg = S.lang || 'es', d = I18N[lg] || {};
  trBusy = 1; trTree(document.body);
  document.querySelectorAll('[placeholder]').forEach(e => { e._p = e._p || e.placeholder; e.placeholder = lg === 'es' ? e._p : (d[e._p] || e._p); });
  document.documentElement.lang = lg; trBusy = 0;
}
new MutationObserver(ms => { if (trBusy || (S.lang || 'es') === 'es') return; trBusy = 1; ms.forEach(m => m.addedNodes.forEach(trTree)); trBusy = 0; }).observe(document.body, { childList: true, subtree: true });
$('#sLang').value = S.lang || 'es';
const setLang = () => { S.lang = $('#sLang').value; for (const k in trMemo) delete trMemo[k]; applyLang(); try { saveSettings(); } catch (e) {} };
['input', 'change'].forEach(ev => $('#sLang').addEventListener(ev, setLang));
$('#settings').addEventListener('input', e => { if (e.target && e.target.id === 'sLang') setLang(); });
applyLang();
new MutationObserver(m => m.forEach(r => { const e = r.target; if (e.classList.contains('open')) e.querySelectorAll('.panel>button').forEach((b, i) => b.style.animationDelay = i * .05 + 's'); }))
  .observe(document.body, { subtree: true, attributes: true, attributeFilter: ['class'] });
// ===== Bienvenida =====
function playWelcome(c0) {
  const m = c0.createGain(); m.gain.value = .9; m.connect(c0.destination); const t = c0.currentTime + .05;
  const tone = (f, d, v, len, type = 'sine') => { const o = c0.createOscillator(), g = c0.createGain(); o.type = type; o.frequency.value = f; g.gain.setValueAtTime(0, t + d); g.gain.linearRampToValueAtTime(v, t + d + .05); g.gain.exponentialRampToValueAtTime(.001, t + d + len); o.connect(g); g.connect(m); o.start(t + d); o.stop(t + d + len + .05); };
  [261.63, 329.63, 392, 523.25].forEach(f => tone(f, 0, .09, 2.6, 'triangle'));
  [[523.25, .15], [659.25, .33], [783.99, .51], [1046.5, .72], [1318.5, 1]].forEach(([f, d]) => tone(f, d, .2, 1.8));
}
(() => {
  const w = $('#welcome'); let played = 0, wc = null;
  try { wc = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {}
  const tryPlay = () => { if (played || !wc) return; try { wc.resume(); } catch (e) {} if (wc.state === 'running') { played = 1; try { playWelcome(wc); } catch (e) {} } };
  tryPlay(); if (wc) wc.addEventListener('statechange', tryPlay);
  ['pointerdown', 'touchend', 'keydown', 'click'].forEach(e => addEventListener(e, tryPlay, { passive: true }));
  let wGo = 0; const toMenu = () => { if (wGo) return; wGo = 1; WELCOME = false; init(); go('menu'); const ob = $('#orbBox'); ob.classList.add('intro'); setTimeout(() => ob.classList.remove('intro'), 1600); setTimeout(() => { if (!localStorage.getItem('bwprof') && !localStorage.getItem('bwname')) openProfSetup(); }, 1500); };
  const outT = setTimeout(() => w.classList.add('out'), 2900), menuT = setTimeout(toMenu, 3800); // antes tardaba 5 s; las canciones ya cargan mientras suena
  setTimeout(() => addEventListener('pointerdown', () => { if (wGo || w.classList.contains('out')) return; clearTimeout(outT); clearTimeout(menuT); w.classList.add('out'); setTimeout(toMenu, 700); }, { once: true }), 1200);
})();
// ===== Vista de tarjetas en el selector =====
let VIEW = localStorage.getItem('bwview') || 'list';
const applyView = () => { $('#list').dataset.v = VIEW; $$('#viewBar button').forEach(b => b.classList.toggle('on', b.dataset.v === VIEW)); };
$$('#viewBar button').forEach(b => b.onclick = () => { VIEW = b.dataset.v; lsSet('bwview', VIEW); applyView(); renderList(); });
applyView();
document.addEventListener('contextmenu', e => e.preventDefault());

// ===== Salir, panel lateral del selector =====
$('#mExit').onclick = async () => { const r = await dlg('¿Salir del juego?', 'Guardaremos tu progreso antes de salir.', { btns: ['Salir', 'Cancelar'] }); if (r.i === 0) exitGame(); };
async function exitGame() {
  const A = window.Capacitor && Capacitor.Plugins && Capacitor.Plugins.App; if (A && A.exitApp) return A.exitApp(); // APK: cierra de verdad
  try { stopPreview(); } catch (e) {} try { ctx.suspend(); } catch (e) {}
  $('#bye').classList.add('show'); try { window.close(); } catch (e) {} // una PWA no puede cerrarse sola: se muestra una pantalla de despedida, sin salir al navegador
}
$('#byeBack').onclick = () => { $('#bye').classList.remove('show'); try { ctx.resume(); } catch (e) {} };
{ const sel0 = $('#select'), closeDr = () => sel0.classList.remove('dr'); $('#drawerTab').onclick = () => sel0.classList.add('dr'); $('#shade').addEventListener('click', closeDr); $('#drawerClose').onclick = closeDr;
  ['#btnMods', '#btnNewList', '#btnRand', '#drawer label.btn'].forEach(q => { const el = $(q); if (el) el.addEventListener('click', () => setTimeout(closeDr, 60)); }); }

// ===== Globo de texto de los modificadores =====
{ const tip = $('#modTip'); let tt = 0;
  $$('#mods button').forEach(b => b.addEventListener('click', () => { tip.textContent = trS(b.dataset.tip); const r = b.getBoundingClientRect(); tip.style.left = Math.max(100, Math.min(innerWidth - 100, r.left + r.width / 2)) + 'px'; tip.style.top = (r.top - 10) + 'px'; tip.classList.add('on'); clearTimeout(tt); tt = setTimeout(() => tip.classList.remove('on'), 2400); }));
  $('#modOk').addEventListener('click', () => tip.classList.remove('on')); }

$('#sHud').addEventListener('input', drawHudPreview); ['#sLane', '#sRing'].forEach(q => $(q).addEventListener('input', () => setTimeout(drawHudPreview, 0)));
function applyTheme() { document.documentElement.style.setProperty('--theme', `url(assets/themes/${S.theme || 'menta'}.png)`); }
applyTheme();

// ===== Sensación de juego: clics de interfaz y triángulos flotantes =====
const bb = $('#bgBlur'), bctx = bb.getContext('2d');
document.addEventListener('pointerdown', e => { if (e.target.closest && e.target.closest('button, .mb, #list li, label.btn')) playWav('click', 1, .55); }, { passive: true });
['menu', 'select', 'result'].forEach(id => { const el = document.getElementById(id); if (!el) return; const d = document.createElement('div'); d.className = 'tris'; for (let i = 0; i < 14; i++) { const t = document.createElement('i'); t.style.cssText = `--sx:${((i * 29) % 120) - 60}px;left:${(i * 37 + 11) % 100}%;--s:${40 + (i * 53) % 90}px;--d:${16 + (i * 7) % 18}s;--dl:-${(i * 5) % 20}s;--o:${(.05 + ((i * 13) % 10) / 100).toFixed(2)}`; d.appendChild(t); } el.appendChild(d); });

// ===== Dock del selector, consejos y animación de resultados =====
{ const act = { back: () => go('menu'), mods: () => $('#btnMods').click(), rand: () => $('#btnRand').click(), lists: () => $('#btnNewList').click() };
  $$('.dk[data-do]').forEach(b => b.addEventListener('click', () => act[b.dataset.do] && act[b.dataset.do]())); }
$('#list').addEventListener('click', e => { const h = e.target.closest('.hint'); if (h && h.dataset.cat === 'recent') openImp(); });
function countUp() { const el = $('#resBody .sc b'); if (!el) return; const target = parseInt(el.textContent.replace(/\D/g, '')) || 0, t0 = performance.now(); const step = t => { const k = Math.min(1, (t - t0) / 1100), e2 = 1 - Math.pow(1 - k, 3); el.textContent = Math.round(target * e2).toLocaleString(); if (k < 1) requestAnimationFrame(step); }; requestAnimationFrame(step); }
const TIPS = ['Toca el logo para empezar a jugar.', 'Con audífonos bluetooth, calibra la latencia en Ajustes.', 'Mantén el dedo en las notas largas hasta el final.', 'Desliza hacia arriba para los flicks.', 'Puedes importar varias canciones a la vez.', 'Los modificadores suben tu puntaje si el reto es mayor.', 'Tu vida baja con cada fallo: si llega a cero, pierdes.'];
{ const tl = document.createElement('div'); tl.id = 'tipLine'; $('#menu').appendChild(tl); let ti = 0; const nx = () => { tl.classList.remove('on'); setTimeout(() => { tl.textContent = 'Consejo · ' + TIPS[ti++ % TIPS.length]; tl.classList.add('on'); }, 380); }; nx(); setInterval(nx, 6500); }

// ===== Animaciones de entrada (solo cuando la pantalla aparece) =====
{ const was = {}; const hint = ['Analizando el ritmo…', 'Afinando los graves…', 'Colocando las notas…', 'Casi listo, respira hondo…'];
  new MutationObserver(ms => ms.forEach(m => { const el = m.target, on = el.classList.contains('active'); if (on && !was[el.id]) {
    if (el.id === 'select') { const l = $('#list'); l.classList.add('enter'); clearTimeout(l._t); l._t = setTimeout(() => l.classList.remove('enter'), 1600); }
    if (el.id === 'menu') { el.classList.add('intro'); setTimeout(() => el.classList.remove('intro'), 2800); }
    if (el.id === 'loading') { const lh = $('#loadHint'); if (lh && !lh.textContent) lh.textContent = hint[Math.random() * hint.length | 0]; }
  } was[el.id] = on; })).observe(document.body, { subtree: true, attributes: true, attributeFilter: ['class'] }); }

// tocar el nombre o la descripción de un modificador también lo activa
$$('#mods .mi').forEach(m => m.addEventListener('click', e => { if (!e.target.closest('button')) m.querySelector('button').click(); }));

// ===================== v2.1 · perfil, XP, nube, Android y sin conexión =====================
let lastWave = 0, mx = 0, my = 0; const PTR = { x: 0, y: 0 };
document.addEventListener('pointermove', e => { PTR.x = e.clientX / innerWidth * 2 - 1; PTR.y = e.clientY / innerHeight * 2 - 1; }, { passive: true });
function spawnWave() { const box = $('#orbBox'); if (!box || box.querySelectorAll('.wave').length > 3) return; const w = document.createElement('div'); w.className = 'wave'; w.addEventListener('animationend', () => w.remove()); box.appendChild(w); }
$('#btnPlay').addEventListener('pointerdown', spawnWave);
{ const tg = $('.tagline'); if (tg) tg.innerHTML = [...tg.textContent].map((c, i) => `<span style="--i:${i}">${c === ' ' ? '&nbsp;' : c}</span>`).join(''); }

/* ---- XP, nivel y racha ---- */
const XPK = 'bwxp', STK = 'bwstreak', getXp = () => +localStorage.getItem(XPK) || 0, xpLevel = xp => Math.floor(Math.sqrt(xp / 120)) + 1;
function onRunEnd(g) {
  if (g.rp || g.auto || g.prac || (g.song && g.song.tut)) return;
  const gain = Math.round(g.score / 250 + (g.max || 0) * .5 + (g.failed ? 0 : 25));
  lsSet(XPK, getXp() + gain); msg(`+${gain} XP`); renderProfile(); scheduleSync();
}
function touchStreak() {
  const d = new Date().toISOString().slice(0, 10), st = JSON.parse(localStorage.getItem(STK) || '{"last":"","n":0}');
  if (st.last === d) return st; const y = new Date(Date.now() - 864e5).toISOString().slice(0, 10);
  st.n = st.last === y ? st.n + 1 : 1; st.last = d; lsSet(STK, JSON.stringify(st)); return st;
}
function renderProfile() {
  const name = localStorage.getItem('bwname') || 'Invitado';
  const xp = getXp(), lv = xpLevel(xp), lo = 120 * (lv - 1) ** 2, hi = 120 * lv ** 2, st = JSON.parse(localStorage.getItem(STK) || '{"n":0}');
  $('#profile .pav').textContent = (name[0] || 'I').toUpperCase(); $('#profile .pnm').textContent = name;
  $('#profile .plv').textContent = `Nv. ${lv}${st.n > 1 ? ' · racha de ' + st.n + ' días' : ''}`;
  $('#profile .pbar i').style.width = Math.max(4, (xp - lo) / (hi - lo) * 100) + '%';
}
touchStreak(); renderProfile();

/* ---- Progreso: reunir, mezclar y aplicar ---- */
function collectProgress() {
  const s = { ...S }; delete s.bgImage;
  return JSON.parse(JSON.stringify({ v: 1, scoreV: 3, rec: REC, fav: FAV, pls: PLS, hid: HID, tut: !!localStorage.getItem('bwtut'), xp: getXp(), streak: JSON.parse(localStorage.getItem(STK) || '{"last":"","n":0}'), settings: s, sstamp: +localStorage.getItem('bwsstamp') || 0 })); // copia: nunca se comparte con los datos vivos
}
function mergeProgress(a, b) {
  if (!b) return a; if (!a) return b;
  const ra = (a.scoreV || 1) >= 3 ? (a.rec || {}) : {}, rb = (b.scoreV || 1) >= 3 ? (b.rec || {}) : {}, rec = { ...rb }; for (const k in ra) if (!rec[k] || (ra[k].score || 0) >= (rec[k].score || 0)) rec[k] = ra[k];
  const fav = { ...(b.fav || {}), ...(a.fav || {}) }, pls = {}; for (const n of new Set([...Object.keys(a.pls || {}), ...Object.keys(b.pls || {})])) pls[n] = [...new Set([...(a.pls && a.pls[n] || []), ...(b.pls && b.pls[n] || [])])];
  const newer = (a.sstamp || 0) >= (b.sstamp || 0) ? a : b, sa = a.streak || { last: '', n: 0 }, sb = b.streak || { last: '', n: 0 };
  return { v: 1, scoreV: 3, rec, fav, pls, hid: [...new Set([...(a.hid || []), ...(b.hid || [])])], tut: !!(a.tut || b.tut), xp: Math.max(a.xp || 0, b.xp || 0), streak: sa.last >= sb.last ? sa : sb, settings: newer.settings || a.settings, sstamp: Math.max(a.sstamp || 0, b.sstamp || 0) };
}
function applyProgress(p) {
  if (!p) return;
  for (const k in REC) delete REC[k]; Object.assign(REC, p.rec || {}); lsSet('bwrec', JSON.stringify(REC));
  for (const k in FAV) delete FAV[k]; Object.assign(FAV, p.fav || {}); lsSet('bwfav', JSON.stringify(FAV));
  for (const k in PLS) delete PLS[k]; Object.assign(PLS, p.pls || {}); lsSet('bwpls', JSON.stringify(PLS));
  HID.splice(0, HID.length, ...(p.hid || [])); lsSet('bwhide', JSON.stringify(HID));
  if (p.tut) lsSet('bwtut', '1'); lsSet(XPK, p.xp || 0); if (p.streak) lsSet(STK, JSON.stringify(p.streak));
  if (p.settings && (p.sstamp || 0) > (+localStorage.getItem('bwsstamp') || 0)) { const keep = S.bgImage; Object.assign(S, p.settings); S.bgImage = keep; lsSet('bwsettings', JSON.stringify(S)); lsSet('bwsstamp', p.sstamp); applyTheme(); }
  try { renderList(); info(); } catch (e) {} renderProfile();
}
const _si = Storage.prototype.setItem; Storage.prototype.setItem = function (k, v) { if (k === 'bwsettings') _si.call(this, 'bwsstamp', Date.now()); return _si.call(this, k, v); };

/* ---- Perfil (solo en este dispositivo) ---- */
const scheduleSync = () => {}, cloudSync = async () => {};
function openAcct() {
  const name = localStorage.getItem('bwname') || '', xp = getXp(), lv = xpLevel(xp), st = jget(STATK, { plays: 0, hits: 0 }), sk = jget(STK, { n: 0 }) || { n: 0 }, H = jget(HISTK, []);
  $('#acName').value = name; $('#acAv').textContent = ((name || 'I')[0]).toUpperCase(); $('#acUser').textContent = name || 'Invitado';
  const lo = 120 * (lv - 1) ** 2, hi = 120 * lv ** 2; $('#acLv').textContent = `Nivel ${lv}`; $('#acXpBar').style.width = Math.max(2, Math.min(100, (xp - lo) / (hi - lo) * 100)) + '%'; $('#acXpTxt').textContent = `${xp.toLocaleString()} XP · faltan ${(hi - xp).toLocaleString()} para el nivel ${lv + 1}`;
  const accs = H.map(x => x.a).filter(x => typeof x === 'number'), avg = accs.length ? accs.reduce((p, q) => p + q, 0) / accs.length : 0;
  const best = f => H.length ? Math.max(...H.map(x => +x[f] || 0)) : 0, since = H.length ? new Date(Math.min(...H.map(x => x.d))).toLocaleDateString() : '—';
  const lib = songs.filter(x => !HID.includes(x.id) && !TRASH.includes(x.id)).length, favs = Object.values(FAV).filter(Boolean).length, got = Object.keys(jget(ACHK, {})).length, md = (misGet().done) || 0;
  const cards = [['Partidas jugadas', (st.plays || 0).toLocaleString()], ['Golpes acertados', (st.hits || 0).toLocaleString()], ['Precisión media', accs.length ? avg.toFixed(1) + ' %' : '—'], ['Mejor precisión', accs.length ? Math.min(100, best('a')).toFixed(2) + ' %' : '—'],
    ['Mejor combo', best('c') ? best('c').toLocaleString() + '×' : '—'], ['Mejor puntaje', best('s') ? best('s').toLocaleString() : '—'], ['Canciones', lib], ['Favoritas', favs],
    ['Logros', `${got} / ${ACH.length}`], ['Misiones hechas', md], ['Monedas', getCoins().toLocaleString()], ['Racha de días', sk.n || 0], ['Jugando desde', since]];
  const g = $('#acStats'); g.innerHTML = ''; cards.forEach(([k, v]) => { const d = el('div'); d.append(el('b', '', String(v)), el('small', '', k)); g.append(d); });
  const cnt = {}; Object.values(REC).forEach(r => { if (r && r.rank) cnt[r.rank] = (cnt[r.rank] || 0) + 1; });
  const rk = $('#acRanks'); rk.innerHTML = ''; ['SS', 'S★', 'S', 'A', 'B', 'C', 'D'].forEach(r => { const c = el('span', cnt[r] ? '' : 'z'); c.style.setProperty('--c', RC[r]); c.innerHTML = `<i>${rkh(r)}</i><b>${cnt[r] || 0}</b>`; rk.append(c); });
  applyPfp(); $('#acctModal').classList.add('open'); $('#acctModal .panel').scrollTop = 0;
}
$('#profile').addEventListener('click', openAcct); $('#acClose').onclick = () => $('#acctModal').classList.remove('open');
$('#acGo').onclick = () => { const n = $('#acName').value.trim().slice(0, 24); if (n) lsSet('bwname', n); else localStorage.removeItem('bwname'); renderProfile(); $('#acctModal').classList.remove('open'); msg('Nombre guardado'); };

/* ---- Sin conexión ---- */
const netUI = () => document.body.classList.toggle('offline', !navigator.onLine); netUI();
addEventListener('offline', () => { netUI(); msg('Sin conexión: sigue jugando, tu progreso se guarda en el teléfono.'); });
addEventListener('online', () => { netUI(); msg('De vuelta en línea.'); });

/* ---- Botón «atrás» de Android (Capacitor) ---- */
function backAction() {
  const open = document.querySelector('.modal.open, #settings.open'); if (open) { open.classList.remove('open'); return; }
  const id = (document.querySelector('.screen.active') || {}).id;
  if (id === 'game') { try { pause(); } catch (e) {} return; }
  if (id === 'menu') { if (typeof menuS !== 'undefined' && menuS > 0) { setMenu(0); return; } $('#mExit').click(); return; }
  if (id === 'rank' || id === 'ach') { go('select'); return; }
  if (id && id !== 'welcome' && id !== 'loading') go('menu');
}
{ const A = window.Capacitor && Capacitor.Plugins && Capacitor.Plugins.App; if (A && A.addListener) A.addListener('backButton', backAction); }

if ((+localStorage.getItem('bwscorev') || 1) < 3) { for (const k in REC) delete REC[k]; lsSet('bwrec', '{}'); lsSet('bwscorev', '3'); } // puntaje nuevo (como osu!): los récords anteriores no son comparables

document.addEventListener('click', e => { if (e.target.closest('#setTabs, #side, #btnSettings, [data-set]')) setTimeout(drawHudPreview, 90); }); drawHudPreview();

/* ===== Compartir resultado, copia de seguridad ===== */
let LASTRES = null;
function roundedText(c, t, w) { let q = t; while (q.length > 3 && c.measureText(q).width > w) q = q.slice(0, -2); return q === t ? t : q + '…'; }
async function shareResult() {
  if (!LASTRES) return; const { g, a, rank, rc } = LASTRES, W2 = 1080, H2 = 1350, cv2 = document.createElement('canvas'); cv2.width = W2; cv2.height = H2; const x = cv2.getContext('2d');
  const gr = x.createLinearGradient(0, 0, W2, H2); gr.addColorStop(0, '#0B0B12'); gr.addColorStop(1, '#1b1633'); x.fillStyle = gr; x.fillRect(0, 0, W2, H2);
  const acc1 = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#00E5FF', acc2 = getComputedStyle(document.documentElement).getPropertyValue('--accent2').trim() || '#B388FF';
  x.globalAlpha = .18; x.fillStyle = acc1; x.beginPath(); x.arc(W2 * .85, H2 * .12, 380, 0, 7); x.fill(); x.fillStyle = acc2; x.beginPath(); x.arc(W2 * .1, H2 * .9, 420, 0, 7); x.fill(); x.globalAlpha = 1;
  try { if (g.song.cover) { const im = new Image(); im.src = g.song.cover; await Promise.race([im.decode(), new Promise((_, r) => setTimeout(r, 900))]); x.save(); x.beginPath(); x.roundRect(W2 / 2 - 190, 110, 380, 380, 56); x.clip(); x.drawImage(im, W2 / 2 - 190, 110, 380, 380); x.restore(); } } catch (e) {}
  x.textAlign = 'center'; x.fillStyle = '#fff'; x.font = `800 56px ${FONT1}`; x.fillText(roundedText(x, g.song.title, 900), W2 / 2, 570);
  x.font = `500 36px ${FONT}`; x.fillStyle = '#9aa0b4'; x.fillText(roundedText(x, g.song.artist || '', 900), W2 / 2, 622);
  x.font = `800 330px ${FONT1}`; x.fillStyle = rc; x.shadowColor = rc; x.shadowBlur = 50; x.fillText(rank.replace('★', ''), W2 / 2, 930); if (rank === 'S★') { const sw = x.measureText('S').width; x.beginPath(); for (let i = 0; i < 10; i++) { const r = i % 2 ? 26 : 62, an = -Math.PI / 2 + i * Math.PI / 5; x.lineTo(W2 / 2 + sw / 2 + 50 + Math.cos(an) * r, 640 + Math.sin(an) * r); } x.closePath(); x.fill(); } x.shadowBlur = 0;
  x.fillStyle = '#fff'; x.font = `800 96px ${FONT1}`; x.fillText((g.score | 0).toLocaleString(), W2 / 2, 1045);
  x.font = `600 40px ${FONT}`; x.fillStyle = '#c9cde0'; x.fillText(`${a.toFixed(2)} %  ·  Combo ${g.max}×  ·  ${g.perf} Perfect`, W2 / 2, 1110);
  if (g.mult !== 1 && g.modsTxt) { x.font = `600 32px ${FONT}`; x.fillStyle = acc1; x.fillText(roundedText(x, g.modsTxt + ' · ×' + g.mult.toFixed(2), 900), W2 / 2, 1160); }
  x.font = `800 46px ${FONT1}`; x.fillStyle = acc1; x.fillText('BeatWave', W2 / 2, 1280);
  cv2.toBlob(async b => { if (!b) return msg('No pude crear la imagen.'); const f = new File([b], 'beatwave-resultado.png', { type: 'image/png' });
    try { if (navigator.canShare && navigator.canShare({ files: [f] })) { await navigator.share({ files: [f], text: `${(g.score | 0).toLocaleString()} puntos en «${g.song.title}» con BeatWave` }); return; } } catch (e) { if (e && e.name === 'AbortError') return; }
    const u = URL.createObjectURL(b), l = document.createElement('a'); l.href = u; l.download = f.name; document.body.append(l); l.click(); l.remove(); setTimeout(() => URL.revokeObjectURL(u), 4000); msg('Imagen guardada'); }, 'image/png');
}
$('#resShare').onclick = shareResult;
$('#btnBkExp').onclick = () => {
  const d = collectProgress(); d.name = localStorage.getItem('bwname') || ''; d.app = 'BeatWave'; d.at = Date.now();
  const b = new Blob([JSON.stringify(d)], { type: 'application/json' }), u = URL.createObjectURL(b), l = document.createElement('a'); l.href = u; l.download = 'beatwave-copia-' + today() + '.json'; document.body.append(l); l.click(); l.remove(); setTimeout(() => URL.revokeObjectURL(u), 4000); msg('Copia guardada');
};
$('#bkIn').onchange = async e => {
  const f = e.target.files[0]; e.target.value = ''; if (!f) return;
  try { const d = JSON.parse(await f.text()); if (!d || d.app !== 'BeatWave' || typeof d.rec !== 'object') throw 0; applyProgress(mergeProgress(collectProgress(), d)); if (d.name) lsSet('bwname', d.name); renderProfile(); bindSettings(); msg('Copia cargada: récords, favoritas y ajustes'); }
  catch (x) { msg('Ese archivo no es una copia de BeatWave.'); }
};

/* ===== Ajustes dentro de la partida (menú de pausa) ===== */
function syncQuick() {
  $('#qCover').checked = !!S.cover; $('#qVideo').checked = !!S.video; $('#qTap').checked = S.tapSnd !== false; $('#qVib').checked = !!S.vib;
  const set = (id, v, txt) => { const e = $(id); e.value = v; e.style.setProperty('--p', ((v - e.min) / (e.max - e.min) * 100) + '%'); $('#o' + id.slice(1)).textContent = txt; };
  set('#qDim', S.dim, Math.round(S.dim * 100) + '%'); set('#qLane', Math.round(S.laneA * 100), Math.round(S.laneA * 100) + '%'); set('#qRing', Math.round(S.ringA * 100), Math.round(S.ringA * 100) + '%');
  set('#qSfx', S.sfx, Math.round(S.sfx * 100) + '%'); set('#qMu', S.vmu, Math.round(S.vmu * 100) + '%');
}
$('#pSet').onclick = () => { syncQuick(); $('#pauseMenu').classList.add('quick'); };
$('#pzBack').onclick = () => $('#pauseMenu').classList.remove('quick');
$('#pzAll').onclick = () => showSet('gfx');
$('#pzQuick').addEventListener('input', () => {
  S.cover = $('#qCover').checked; S.video = $('#qVideo').checked; S.tapSnd = $('#qTap').checked; S.vib = $('#qVib').checked; S.dim = +$('#qDim').value;
  S.laneA = +$('#qLane').value / 100; S.ringA = +$('#qRing').value / 100; S.sfx = +$('#qSfx').value; S.vmu = +$('#qMu').value;
  applyVol(); applyBgLive(); saveSettings(); bindSettings(); syncQuick();
});

/* ===== Crear perfil la primera vez (antes del tutorial) ===== */
const NM_A = ['Neo', 'Turbo', 'Super', 'Mega', 'Cosmo', 'Electro', 'Ultra', 'Retro', 'Hiper', 'Astro'], NM_B = ['Zorro', 'Panda', 'Cometa', 'Tambor', 'Delfín', 'Dragón', 'Búho', 'Tigre', 'Pulso', 'Eco', 'Koala', 'Lobo'];
const randName = () => NM_A[Math.random() * NM_A.length | 0] + NM_B[Math.random() * NM_B.length | 0] + (10 + (Math.random() * 90 | 0));
function psAv() { const n = $('#psName').value.trim(); $('#psAv').textContent = (n[0] || 'B').toUpperCase(); $('#psGo').disabled = !n; }
function openProfSetup() { $('#psName').value = randName(); psAv(); $('#profSetup').classList.add('open'); }
$('#psRand').onclick = () => { $('#psName').value = randName(); psAv(); };
$('#psName').addEventListener('input', psAv);
$('#psName').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); $('#psGo').click(); } });
$('#psGo').onclick = () => {
  const n = $('#psName').value.trim().slice(0, 16); if (!n) return;
  lsSet('bwname', n); lsSet('bwprof', '1'); renderProfile(); $('#profSetup').classList.remove('open');
  setTimeout(() => { const b = $('#btnPlay'); if (b && $('#menu').classList.contains('active')) b.onclick(); }, 350); // continúa con el tutorial y el flujo normal
};




/* ---- Pantalla completa en el navegador (en el APK ya lo hace MainActivity) ---- */
(() => {
  if (window.Capacitor && Capacitor.isNativePlatform && Capacitor.isNativePlatform()) return;
  if (!matchMedia('(pointer: coarse)').matches) return; // solo en pantallas táctiles
  const go = () => { removeEventListener('pointerup', go, true); const d = document.documentElement; if (document.fullscreenElement || matchMedia('(display-mode: fullscreen)').matches || !d.requestFullscreen) return; try { d.requestFullscreen({ navigationUI: 'hide' }).catch(() => {}); } catch (e) {} };
  addEventListener('pointerup', go, true);
})();


/* ===== Diagnóstico de rendimiento (mide tu teléfono por partes) ===== */
async function runDiag() {
  const out = $('#diagOut'), st = $('#diagSt'), line = t => { out.textContent += t + '\n'; };
  out.textContent = ''; $('#diagCopy').style.display = 'none'; st.textContent = 'Midiendo… no toques la pantalla (unos 10 segundos).'; $('#diagModal').classList.add('open');
  const ua = navigator.userAgent, ch = (ua.match(/Chrome\/(\d+)/) || [])[1];
  line(`Teléfono: ${(ua.match(/\(Linux; Android ([^;)]+)(?:; ([^)]+))?\)/) || []).slice(1).join(' · ') || 'desconocido'}`);
  line(`WebView/Chrome: ${ch || '?'} · núcleos: ${navigator.hardwareConcurrency || '?'} · RAM: ${navigator.deviceMemory || '?'} GB`);
  line(`Pantalla: ${innerWidth}×${innerHeight} · ratio ${devicePixelRatio} · modo: ${NATIVE ? 'app' : 'web'} · ahorro: ${LOW ? 'sí' : 'no'}`);
  line(`Ajuste de rendimiento: ${['Auto','Ahorro','Completo','Mínimo'][S.perf|0]} · clases: ${document.documentElement.className || '(ninguna)'} · autoLite: ${!!S.autoLite}`);
  const frames = (ms, draw) => new Promise(r => { let c = 0, t0 = 0, last = 0, mx = 0; const f = t => { if (!t0) { t0 = last = t; } c++; mx = Math.max(mx, t - last); last = t; if (draw) draw(c); if (t - t0 < ms) requestAnimationFrame(f); else r({ fps: (c - 1) * 1000 / (t - t0), mx }); }; requestAnimationFrame(f); });
  const fmt = r => `${r.fps.toFixed(0)} FPS (peor fotograma ${r.mx.toFixed(0)} ms)`;
  const cv = document.createElement('canvas'); cv.style.cssText = 'position:fixed;left:0;top:0;width:100vw;height:100vh;z-index:9999;pointer-events:none;opacity:.001'; cv.id = 'diagCv'; cv.width = innerWidth; cv.height = innerHeight; document.body.append(cv); const H0 = document.documentElement.classList;
  const g = cv.getContext('2d'), W = cv.width, H = cv.height;
  line(''); line('Velocidad de la pantalla y del dibujo:');
  H0.remove('dq'); line('• Pantalla vacía con TU interfaz detrás: ' + fmt(await frames(1500)));
  H0.add('dq'); line('• Pantalla vacía con la interfaz apagada: ' + fmt(await frames(1500)));
  line('• 200 rectángulos: ' + fmt(await frames(1500, () => { g.clearRect(0, 0, W, H); for (let i = 0; i < 200; i++) { g.fillStyle = i % 2 ? '#00E5FF' : '#B388FF'; g.fillRect((i * 37) % W, (i * 61) % H, 40, 40); } })));
  line('• 120 notas con degradado: ' + fmt(await frames(1500, () => { g.clearRect(0, 0, W, H); for (let i = 0; i < 120; i++) { const x = (i * 53) % W, y = (i * 97) % H, gr = g.createLinearGradient(x, y, x, y + 40); gr.addColorStop(0, '#FF7BB0'); gr.addColorStop(1, '#FF3D7F'); g.fillStyle = gr; g.beginPath(); if (g.roundRect) g.roundRect(x, y, 56, 40, 10); else g.rect(x, y, 56, 40); g.fill(); } })));
  line('• 40 formas con brillo (sombra): ' + fmt(await frames(1500, () => { g.clearRect(0, 0, W, H); g.shadowColor = '#00E5FF'; g.shadowBlur = 14; g.fillStyle = '#00E5FF'; for (let i = 0; i < 40; i++) g.fillRect((i * 71) % W, (i * 113) % H, 50, 30); g.shadowBlur = 0; })));
  line('• 40 textos: ' + fmt(await frames(1500, () => { g.clearRect(0, 0, W, H); g.fillStyle = '#fff'; g.font = '700 20px sans-serif'; for (let i = 0; i < 40; i++) g.fillText('PERFECT ' + i, (i * 83) % W, (i * 47) % H + 20); })));
  cv.remove(); H0.remove('dq');
  try { init(); const c = ctx; const t0 = performance.now(); for (let i = 0; i < 1000; i++) c.getOutputTimestamp(); const t1 = performance.now(); for (let i = 0; i < 1000; i++) void c.currentTime; const t2 = performance.now();
    line(''); line('Audio:'); line(`• Leer la hora del audio: ${((t1 - t0) / 1000).toFixed(3)} ms por lectura (normal: menos de 0.05)`); line(`• Estado: ${c.state} · latencia de salida: ${((c.outputLatency || c.baseLatency || 0) * 1000).toFixed(0)} ms`); } catch (e) { line('• Audio: no se pudo medir'); }
  st.textContent = 'Listo. Mándame una captura de esta pantalla.'; $('#diagCopy').style.display = '';
}
$('#btnDiag').onclick = runDiag; $('#diagClose').onclick = () => $('#diagModal').classList.remove('open');
$('#diagCopy').onclick = () => { try { navigator.clipboard.writeText($('#diagOut').textContent); msg('Copiado'); } catch (e) { msg('No se pudo copiar; haz una captura.'); } };

/* ===== Reloj propio: no depende de la fecha que pongas en el teléfono ===== */
const BWC = (() => {
  let A = null, busy = false; const mono = () => performance.now();
  const saved = (() => { try { return JSON.parse(localStorage.getItem('bwclk') || 'null'); } catch (e) { return null; } })();
  if (saved) A = { srv: Math.max(saved.srv, saved.srv + (Date.now() - saved.wall)), mono: mono(), wall: Date.now(), ok: false };
  if (!A) A = { srv: Date.now(), mono: mono(), wall: Date.now(), ok: false }; // sin hora guardada: se parte del teléfono y se corrige en cuanto haya internet
  const tmo = (u, o, ms) => { const c = new AbortController(), t = setTimeout(() => c.abort(), ms); return fetch(u, { ...o, signal: c.signal }).finally(() => clearTimeout(t)); };
  async function net() { // hora real de internet (se prueba una fuente tras otra)
    const tries = [
      async () => { if (!/^https?:$/.test(location.protocol) || /^(localhost|127\.)/.test(location.hostname)) throw 0; const r = await tmo(location.origin + '/?t=' + Date.now(), { method: 'HEAD', cache: 'no-store' }, 4000); const d = r.headers.get('date'); if (!d) throw 0; return Date.parse(d); },
      async () => { const r = await tmo('https://worldtimeapi.org/api/timezone/Etc/UTC', { cache: 'no-store' }, 4500); return (await r.json()).unixtime * 1000; },
      async () => { const r = await tmo('https://timeapi.io/api/Time/current/zone?timeZone=UTC', { cache: 'no-store' }, 4500); const j = await r.json(); return Date.parse(j.dateTime + 'Z'); }
    ];
    for (const f of tries) { try { const t = await f(); if (t > 1.7e12) return t; } catch (e) {} } return 0;
  }
  async function sync() { if (busy) return false; busy = true; try { const t = await net(); if (t) { A = { srv: t, mono: mono(), wall: Date.now(), ok: true }; localStorage.setItem('bwclk', JSON.stringify({ srv: t, wall: Date.now() })); return true; } } catch (e) {} finally { busy = false; } return false; }
  function now() {
    const p = mono() - A.mono, w = Date.now() - A.wall;
    if (Math.abs(w - p) <= 3000) return A.srv + w; // el reloj del teléfono coincide con el propio
    sync(); // el teléfono cambió de hora (o durmió): se vuelve a pedir la hora real
    return A.srv + (w - p > 0 && w - p < 12 * 3600e3 ? w : Math.max(p, 0)); // sin internet: se acepta una pausa normal (hasta 12 h) y se ignoran los saltos grandes
  }
  setTimeout(sync, 400); setInterval(sync, 30 * 60e3);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) sync().then(() => { try { missionSched(misGet()); misCheck(); } catch (e) {} }); });
  return { now, sync };
})();

/* ===== Monedas ===== */
const COINK = 'bwcoins', REV_COST = [10, 15, 20, 30], REV_MAX = 2;
const getCoins = () => +localStorage.getItem(COINK) || 0;
const paintCoins = () => $$('.coinN').forEach(e => { e.textContent = getCoins().toLocaleString(); });
const setCoins = n => { lsSet(COINK, Math.max(0, n | 0)); paintCoins(); };
function awardCoins(g, a) { // más dificultad y más modificadores = más monedas
  if (g.song.tut || g.auto || g.rp || g.prac || g.failed) return 0;
  const base = [4, 6, 9, 13][g.diff | 0] || 4, f = a >= 95 ? 1.25 : a >= 85 ? 1 : .8, n = Math.max(1, Math.round(base * (g.mult || 1) * f));
  setCoins(getCoins() + n); return n;
}

/* ===== Anuncios (AdMob en el APK; en la web solo un anuncio de prueba) ===== */
const ADS = { testing: true, banner: 'ca-app-pub-3940256099942544/6300978111', rewarded: 'ca-app-pub-3940256099942544/5224354917' };
// Los IDs reales se leen de ads.config.json (ahí pones los de TU cuenta de AdMob). Si faltan, se usan los de prueba de Google.
const ADS_READY = fetch('ads.config.json', { cache: 'no-store' }).then(r => r.ok ? r.json() : null).then(j => { if (j) { for (const k of ['banner', 'rewarded']) if (j[k]) ADS[k] = j[k]; if (typeof j.testing === 'boolean') ADS.testing = j.testing; } }).catch(() => {});
const isTestId = x => String(x).includes('3940256099942544'), testFor = x => ADS.testing || isTestId(x);
const AdP = () => window.Capacitor && Capacitor.Plugins && Capacitor.Plugins.AdMob;
const setAdH = h => document.documentElement.style.setProperty('--adh', (h || 0) + 'px');
const Ads = {
  ready: false, on: false,
  available() { return !!AdP(); }, // solo en la app Android (en la web no hay anuncios)
  async init() { const A = AdP(); if (!A || this.ready) return; await ADS_READY; try { await A.initialize({ initializeForTesting: ADS.testing }); this.ready = true; A.addListener('bannerAdSizeChanged', i => setAdH(i && i.height)); } catch (e) {} },
  async banner(show) { // anuncio pequeño abajo, solo fuera de la partida
    const A = AdP(); if (!A) return; await this.init(); if (!this.ready) return;
    if (show && !this.on) { this.on = true; try { await A.showBanner({ adId: ADS.banner, adSize: 'ADAPTIVE_BANNER', position: 'BOTTOM_CENTER', margin: 0, isTesting: testFor(ADS.banner) }); } catch (e) { this.on = false; } }
    else if (!show && this.on) { this.on = false; try { await A.removeBanner(); } catch (e) {} setAdH(0); }
  },
  async rewarded() { // anuncio que el jugador elige ver: devuelve true si se ganó la recompensa
    const A = AdP(); if (!A) return false; await this.init();
    let got = false; const h = await A.addListener('onRewardedVideoAdReward', () => { got = true; });
    try { await A.prepareRewardVideoAd({ adId: ADS.rewarded, isTesting: testFor(ADS.rewarded) }); const r = await A.showRewardVideoAd(); got = got || !!(r && (r.amount || r.type)); } catch (e) { msg('No hay anuncios disponibles ahora. Inténtalo más tarde.'); }
    try { h && h.remove(); } catch (e) {} return got;
  }
};
/* ===== Revivir al quedarte sin vida ===== */
function reviveOffer() {
  if (!G || G.rp || G.prac || (G.revives | 0) >= REV_MAX) return false;
  const cost = REV_COST[G.diff | 0] * ((G.revives | 0) + 1); G.revCost = cost;
  pause(); $('#pauseMenu').classList.remove('open');
  $('#revCost').textContent = cost; $('#revCoin').disabled = getCoins() < cost; $('#revAd').style.display = Ads.available() ? '' : 'none';
  $('#revLeft').textContent = `Revivir ${REV_MAX - (G.revives | 0)} vez${REV_MAX - (G.revives | 0) > 1 ? 'es' : ''} más en esta canción`; paintCoins(); $('#reviveModal').classList.add('open'); return true;
}
function doRevive() { G.revives = (G.revives | 0) + 1; G.hp = .6; $('#reviveModal').classList.remove('open'); resume(); }
function endRevive() { $('#reviveModal').classList.remove('open'); try { ctx.resume(); } catch (e) {} G.paused = false; G.failed = true; finish(); msg('Te quedaste sin vida'); }
$('#revCoin').onclick = () => { if (!G || getCoins() < G.revCost) return; setCoins(getCoins() - G.revCost); doRevive(); };
$('#revAd').onclick = async () => { const b = $('#revAd'); b.disabled = true; const ok = await Ads.rewarded(); b.disabled = false; if (ok && G && G.paused) doRevive(); else if (!ok) msg('Necesitas ver el anuncio completo para revivir.'); };
$('#revNo').onclick = endRevive;
$('#coinChip').onclick = async () => {
  const last = +localStorage.getItem('bwadlast') || 0, wait = 120000 - (BWC.now() - last);
  const hasAd = Ads.available(); const r = await dlg('Monedas', `Tienes ${getCoins().toLocaleString()} monedas. Las ganas al terminar canciones (más con dificultad y modificadores) y sirven para revivir.`, { btns: hasAd ? [wait > 0 ? `Anuncio disponible en ${Math.ceil(wait / 1000)} s` : 'Ver un anuncio (+10 monedas)', 'Cerrar'] : ['Cerrar'] });
  if (!hasAd || r.i !== 0 || wait > 0) return; if (await Ads.rewarded()) { setCoins(getCoins() + 10); lsSet('bwadlast', String(BWC.now())); msg('+10 monedas'); }
};
paintCoins();

/* ===== Foto de perfil con recorte (como WhatsApp) ===== */
const getPfp = () => localStorage.getItem('bwpfp') || '';
function applyPfp() {
  const u = getPfp(), no = $('#acNoPhoto'); if (no) no.style.display = u ? '' : 'none';
  $$('.pav').forEach(e => { e.classList.toggle('ph', !!u); e.style.backgroundImage = u ? `url(${u})` : ''; });
}
const CR = { img: null, S: 300, k: 1, base: 1, x: 0, y: 0, pts: new Map(), d0: 0, z0: 1 };
function cropClamp() { const { img, S } = CR, k = CR.base * CR.k, mx = Math.max(0, (img.width * k - S) / 2), my = Math.max(0, (img.height * k - S) / 2); CR.x = Math.max(-mx, Math.min(mx, CR.x)); CR.y = Math.max(-my, Math.min(my, CR.y)); }
function cropDraw() {
  const cv = $('#cropCv'), c = cv.getContext('2d'), { img, S } = CR; if (!img) return; cropClamp(); const k = CR.base * CR.k, d = cv.width / S;
  c.setTransform(1, 0, 0, 1, 0, 0); c.fillStyle = '#000'; c.fillRect(0, 0, cv.width, cv.height); c.setTransform(d, 0, 0, d, 0, 0);
  c.drawImage(img, S / 2 - img.width * k / 2 + CR.x, S / 2 - img.height * k / 2 + CR.y, img.width * k, img.height * k);
}
function cropSetZoom(z) { CR.k = Math.max(1, Math.min(4, z)); $('#cropZoom').value = CR.k; cropDraw(); }
async function openCrop(file) {
  let bmp; try { bmp = await createImageBitmap(file, { imageOrientation: 'from-image' }); } catch (e) { try { bmp = await new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = no; i.src = URL.createObjectURL(file); }); } catch (e2) { return msg('No pude abrir esa imagen.'); } }
  let src = bmp, w = bmp.width, h = bmp.height; if (Math.max(w, h) > 1600) { const r = 1600 / Math.max(w, h), t = document.createElement('canvas'); t.width = Math.round(w * r); t.height = Math.round(h * r); t.getContext('2d').drawImage(bmp, 0, 0, t.width, t.height); src = t; }
  CR.img = src; CR.k = 1; CR.x = CR.y = 0; $('#cropModal').classList.add('open');
  requestAnimationFrame(() => { const box = $('#cropBox'), S = Math.round(box.clientWidth || 300), cv = $('#cropCv'), dpr = Math.min(2, devicePixelRatio || 1); CR.S = S; cv.style.width = cv.style.height = S + 'px'; cv.width = cv.height = Math.round(S * dpr); CR.base = S / Math.min(src.width, src.height); $('#cropZoom').value = 1; cropDraw(); });
}
(() => {
  const box = $('#cropBox'), P = CR.pts;
  box.addEventListener('pointerdown', e => { box.setPointerCapture(e.pointerId); P.set(e.pointerId, [e.clientX, e.clientY]); if (P.size === 2) { const [a, b] = [...P.values()]; CR.d0 = Math.hypot(a[0] - b[0], a[1] - b[1]); CR.z0 = CR.k; } });
  box.addEventListener('pointermove', e => { if (!P.has(e.pointerId)) return; const o = P.get(e.pointerId); P.set(e.pointerId, [e.clientX, e.clientY]);
    if (P.size === 1) { CR.x += e.clientX - o[0]; CR.y += e.clientY - o[1]; cropDraw(); }
    else if (P.size === 2 && CR.d0) { const [a, b] = [...P.values()]; cropSetZoom(CR.z0 * Math.hypot(a[0] - b[0], a[1] - b[1]) / CR.d0); } });
  ['pointerup', 'pointercancel'].forEach(t => box.addEventListener(t, e => { P.delete(e.pointerId); CR.d0 = 0; }));
  box.addEventListener('wheel', e => { e.preventDefault(); cropSetZoom(CR.k * (e.deltaY < 0 ? 1.08 : .93)); }, { passive: false });
  $('#cropZoom').addEventListener('input', e => cropSetZoom(+e.target.value));
  $('#cropCancel').onclick = () => { $('#cropModal').classList.remove('open'); CR.img = null; };
  $('#cropOk').onclick = () => {
    const out = document.createElement('canvas'); out.width = out.height = 256; const c = out.getContext('2d'), r = 256 / CR.S, k = CR.base * CR.k, { img } = CR; cropClamp();
    c.fillStyle = '#000'; c.fillRect(0, 0, 256, 256); c.drawImage(img, 128 - img.width * k * r / 2 + CR.x * r, 128 - img.height * k * r / 2 + CR.y * r, img.width * k * r, img.height * k * r);
    try { localStorage.setItem('bwpfp', out.toDataURL('image/jpeg', .86)); } catch (e) { msg('No hay espacio para guardar la foto.'); }
    $('#cropModal').classList.remove('open'); CR.img = null; applyPfp(); msg('Foto de perfil actualizada');
  };
  const pick = () => $('#pfpIn').click();
  $('#psPhoto').onclick = $('#acPhoto').onclick = pick; $('#psAv').onclick = $('#acAv').onclick = pick;
  $('#pfpIn').onchange = e => { const f = e.target.files[0]; e.target.value = ''; if (f) openCrop(f); };
  $('#acNoPhoto').onclick = () => { localStorage.removeItem('bwpfp'); applyPfp(); msg('Foto quitada'); };
})();
applyPfp();

/* ===== Selector: un solo botón cambia la vista (lista, compacta, cuadrícula, carrusel) ===== */
$('#viewBar').addEventListener('click', e => { const b = e.target.closest('button'); if (!b || !b.classList.contains('on')) return; e.stopImmediatePropagation(); const bs = [...$$('#viewBar button')]; bs[(bs.indexOf(b) + 1) % bs.length].click(); }, true);