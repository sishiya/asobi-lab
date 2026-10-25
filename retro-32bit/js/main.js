// 棚（トップ）と遊ぶ画面。画面・音・入力をつなぐ（ブラウザの係。8ビット互換機の main.js と同じ形）
import { Console32 } from './psx.js';
import { LIBRARY } from './library.js?v=5';
import { createCRT } from './crt/crt-gl.js';
import { createInput, bindTouch, keyLabel } from './input.js?v=2';
import { initSettings } from './settings.js?v=2';
import { initShelf } from './shelf.js?v=1';
import { TX, initLang } from './i18n.js';
import { createAudio } from './audio.js';
import { attachCard } from './memcard.js';

const FRAME_MS = 1000 / 60;
const $ = (id) => document.getElementById(id);

const canvas = $('screen'), g = canvas.getContext('2d');
const frameBuf = new Uint8ClampedArray(640 * 480 * 4);   // 見えている絵（RGBA。いちばん大きい 640×480 まで）
let fw = 320, fh = 240;                                   // いまの絵の大きさ（ソフトが表示の形を変えたら変わる）
let m = null, current = null, running = false, audio = null;
let soundOn = read('retro32.sound', '1') === '1';
let volume = Math.min(1, Math.max(0, +read('retro32.volume', '0.8') || 0));
const COARSE = matchMedia('(pointer:coarse)').matches;
let vibrateOn = read('retro32.vibrate', '1') === '1';

function read(k, d) { try { return localStorage.getItem(k) ?? d; } catch { return d; } }
function save(k, v) { try { localStorage.setItem(k, v); return true; } catch { return false; } }

// ---------- 棚 ----------
const exeCache = new Map();
async function loadExe(entry) {
  if (!exeCache.has(entry.id)) exeCache.set(entry.id, fetch(entry.file + '?v=8').then((r) => { if (!r.ok) throw new Error(r.status); return r.arrayBuffer(); }).then((b) => new Uint8Array(b)));
  return exeCache.get(entry.id);
}
// 棚の手ざわりの音（sfx/。8ビット互換機と同じ音を写した。Stable Audio で作って、カチッが1つだけの所を切り出したもの）。
// ケースを開ける → 口へ シャッ → 奥で カチッ → ケースを閉める → 電源
const SFX = { caseOpen: ['case_open', 0.16], caseClose: ['case_close', 0.14], slide: ['slide', 0.2, 1.3], click: ['click', 0.26], out: ['slide', 0.18, 1.45], sw: ['power', 0.16] };
const sfxBytes = {}, sfxBuf = {};
for (const [k, [f]] of Object.entries(SFX)) fetch(`sfx/${f}.ogg`).then((r) => r.ok ? r.arrayBuffer() : null).then((b) => { if (b) sfxBytes[k] = b; }).catch(() => {});
let sfxCtx = null, sfxOut = null;
function sfxInit() {
  if (sfxCtx) return;
  sfxCtx = new (window.AudioContext || window.webkitAudioContext)();
  sfxOut = sfxCtx.createBiquadFilter(); sfxOut.type = 'lowpass'; sfxOut.frequency.value = 5000; sfxOut.connect(sfxCtx.destination);
}
async function sfxGet(kind) {
  if (sfxBuf[kind]) return sfxBuf[kind];
  const b = sfxBytes[kind];
  if (!b) return null;
  sfxBuf[kind] = sfxCtx.decodeAudioData(b.slice(0));
  return sfxBuf[kind];
}
function clack(kind) {
  if (!soundOn || !SFX[kind]) return;
  try {
    sfxInit();
    if (sfxCtx.state === 'suspended') sfxCtx.resume();
    for (const k of Object.keys(SFX)) sfxGet(k)?.catch?.(() => {});
    Promise.resolve(sfxGet(kind)).then((buf) => {
      if (!buf) return;
      const src = sfxCtx.createBufferSource(), gn = sfxCtx.createGain();
      gn.gain.value = volume * SFX[kind][1];
      src.playbackRate.value = SFX[kind][2] || 1;
      src.buffer = buf; src.connect(gn).connect(sfxOut); src.start();
    }).catch(() => {});
  } catch { /* 音が出せなくても動く */ }
}
initLang();
const shelf = initShelf({ library: LIBRARY, loadExe, open: (e) => openEntry(e, true), boot: bootEntry, powerOff, sfx: { clack } });

// ---------- 部屋（3D。js/room3d.js。トップの上半分・遊ぶ画面の「部屋で遊ぶ」） ----------
let room = null, roomPlay = read('retro32.roomPlay', '0') === '1';
const ROOM_OK = !matchMedia('(prefers-reduced-motion: reduce)').matches && (() => { try { return !!document.createElement('canvas').getContext('webgl2'); } catch { return false; } })();
if (ROOM_OK) {
  import('./room3d.js?v=1').then((mod) => {
    room = mod.createRoom();
    $('roombox').hidden = false; $('conbox').hidden = true;
    room.attach($('roombox'), 'shelf');
    $('roombox').append(ghost);
    shelf.useRoom(room);
    // テレビか本体を押す: 電源が入っていれば、テレビ＝続きから・本体＝電源を切る。切れていれば電源を入れる
    room.canPick = () => !!shelf.seated && !shelf.busy && $('player').hidden;
    room.onPick = (w) => {
      if (!shelf.powered) shelf.power(true);
      else if (w === 'con') shelf.power(false);
      else if (m && current) room.focusTV(true, 650).then(() => openEntry(current, true));
    };
    $('btnRoom').hidden = false; $('btnRoom').setAttribute('aria-pressed', String(roomPlay));
    if (current && roomPlay) setRoomPlay(true);
  }).catch((e) => { console.warn('room', e); document.documentElement.classList.remove('room3d'); });
} else document.documentElement.classList.remove('room3d');
function setRoomPlay(on) {
  roomPlay = on; save('retro32.roomPlay', on ? '1' : '0');
  $('btnRoom').setAttribute('aria-pressed', String(on));
  if (!room) return;
  $('bezel').hidden = on; $('stage').classList.toggle('roomon', on);
  if (on) { room.attach($('stage'), 'play'); room.setPower(true); if (m) room.show(frameNow()); }
  else { room.attach($('roombox'), 'shelf'); fit(); if (m) draw(); }
}
$('btnRoom').addEventListener('click', () => setRoomPlay(!roomPlay));

// ---------- 棚 ⇄ 遊ぶ画面（部屋のとき）: テレビの画面が遊ぶ画面の画面へのびる（View Transitions） ----------
const ghost = document.createElement('div'); ghost.className = 'tvghost'; ghost.setAttribute('aria-hidden', 'true');
function placeGhost() {
  if (!room || $('shelf').hidden) return;
  const r = room.screenRect(), b = $('roombox').getBoundingClientRect();
  Object.assign(ghost.style, { left: r.left - b.left + 'px', top: r.top - b.top + 'px', width: r.width + 'px', height: r.height + 'px' });
}
async function swap(update) {
  if (!room || !document.startViewTransition) { await update(); return; }
  placeGhost();
  const t = document.startViewTransition(async () => { await update(); placeGhost(); room.renderNow(); });
  await t.finished.catch(() => {});
}
const upTo = (p, ms) => Promise.race([p, new Promise((ok) => setTimeout(ok, ms))]);

// 見えている絵を frameBuf へ（大きさが変わったら画面も合わせる）
let img = g.createImageData(320, 240);
function grab() {
  const { w, h } = m.display(frameBuf);
  if (w !== fw || h !== fh) { fw = w; fh = h; canvas.width = w; canvas.height = h; img = g.createImageData(w, h); fit(); }
}
const frameNow = () => ({ data: frameBuf.subarray(0, fw * fh * 4), w: fw, h: fh });

// ---------- 部屋で電源を入れたとき: 棚のまま本体を動かし、テレビに映す ----------
async function bootEntry(e) {
  stopPlayer();
  current = e;
  let bytes;
  try { bytes = e.bytes || await loadExe(e); } catch { return; }
  if (current !== e || m) return;
  m = makeConsole(bytes);
  if (m) power();
}
function makeConsole(bytes) {
  const c = new Console32(audio ? audio.ctx.sampleRate : 48000);
  attachCard(c);   // メモリーカード（口 1。中身はこの端末の中だけ）
  try { c.loadExe(bytes); } catch (err) { alert(TX('このディスクは動かせません: ', 'Cannot run this disc: ') + err.message); return null; }
  return c;
}
function powerOff() {
  if (!$('player').hidden) return;
  stopPlayer();
  current = null;
}

// ---------- 遊ぶ画面へ ----------
let guideKeys = [];
async function openEntry(e, gesture) {
  const cont = !!m && current === e;
  if (!cont) { stopPlayer(); current = e; }
  await swap(async () => {
    $('shelf').hidden = true;
    $('player').hidden = false;
    $('discName').textContent = e.title;
    guideKeys = e.keys?.length ? e.keys : [['PAD', ''], ['A', ''], ['B', ''], ['X', ''], ['Y', ''], ['START', '']];
    renderGuide();
    document.body.classList.add('playing');
    fit();
    if (cont) { if (room && roomPlay) setRoomPlay(true); else { draw(); await upTo(drawn(), 200); } }
  });
  if (e.id && location.hash !== '#' + e.id) history.pushState({ retro32: 1 }, '', '#' + e.id);
  if (cont) { if (!running) power(); return; }
  let bytes;
  try { bytes = e.bytes || await loadExe(e); } catch { backToShelf(); return; }
  m = makeConsole(bytes);
  if (!m) { backToShelf(); return; }
  if (room && roomPlay) setRoomPlay(true);
  if (gesture) power();
  else {
    // 直接ひらいたとき: 音を出すには一度押してもらう
    for (let i = 0; i < (e.frames || 60); i++) m.runFrame();
    m.spu.take(); grab(); draw();
    canvas.style.opacity = '.45'; glCanvas.style.opacity = '.45';
    $('power').hidden = false;
  }
}
function stopPlayer() {
  running = false;
  audio?.ctx.suspend();
  m = null;
  canvas.style.visibility = glCanvas.style.visibility = 'hidden';
}
function leaveHash() {
  if (!location.hash) return false;
  if (history.state?.retro32) { history.back(); return true; }
  history.replaceState(null, '', location.pathname + location.search);
  return false;
}
async function backToShelf() {
  if (leaveHash()) return;
  if (room && m && !$('player').hidden) {
    // 部屋: 電源は入れたまま、テレビに止めた絵を映しておく。ひと呼吸おいて、電源を切ってディスクをケースへ
    running = false; audio?.ctx.suspend();
    const frame = { ...frameNow(), data: frameNow().data.slice() };
    await swap(async () => {
      $('bezel').hidden = false; $('stage').classList.remove('roomon');
      $('player').hidden = true; $('shelf').hidden = false;
      document.body.classList.remove('playing');
      room.attach($('roombox'), 'shelf'); room.focusTV(true, 0);
      await upTo(room.show(frame), 200);
    });
    await room.focusTV(false, 800);
    await new Promise((ok) => setTimeout(ok, 600));
    if ($('player').hidden && m && !shelf.busy) shelf.back();
    return;
  }
  stopPlayer();
  if (room) { $('bezel').hidden = false; $('stage').classList.remove('roomon'); room.attach($('roombox'), 'shelf'); }
  shelf.back();
  current = null;
  $('player').hidden = true;
  $('shelf').hidden = false;
  document.body.classList.remove('playing');
}
$('btnBack').addEventListener('click', backToShelf);
function route() {
  const id = location.hash.slice(1);
  const e = LIBRARY.find((x) => x.id === id);
  if (e) { if (current !== e) openEntry(e, false); else if ($('player').hidden) openEntry(e, true); }
  else if (current && !$('player').hidden) backToShelf();
}
addEventListener('popstate', route);

// ---------- 画面の大きさ（なるべく整数倍で、ドットをそろえる。4:3 に） ----------
function fit() {
  if ($('player').hidden || (room && roomPlay)) return;
  const stage = $('stage'), bez = $('bezel');
  const pad = parseFloat(getComputedStyle(bez).paddingLeft) * 2;
  const w = stage.clientWidth - pad, h = stage.clientHeight - pad - 8;
  const dpr = window.devicePixelRatio || 1;
  // たての 240 本（480 本なら半分）を基準に、画面は 4:3
  const lines = fh > 256 ? fh / 2 : fh;
  let sd = Math.max(1, Math.min(w / (lines * 4 / 3), h / lines)) * dpr;
  if (Math.floor(sd) / sd >= 0.85) sd = Math.floor(sd);
  const css = sd / dpr, cw = lines * 4 / 3 * css, ch = lines * css;
  for (const el of [canvas, glCanvas]) { el.style.width = cw + 'px'; el.style.height = ch + 'px'; }
  glCanvas.width = Math.round(cw * dpr); glCanvas.height = Math.round(ch * dpr);
  if (m && screenMode !== 'lcd' && crt) crtDraw();
}
addEventListener('resize', fit);

// ---------- 画面の見え方: くっきり（2D）か、ブラウン管（WebGL2。8ビット互換機と同じ計算） ----------
const glCanvas = $('crt');
let crt = null, worker = null, busy = false, crtFrames = 0, crtW = 320, crtH = 240;
let screenMode = read('retro32.screenMode', 'rgb');
try { crt = createCRT(glCanvas); } catch { crt = null; }
if (crt) {
  crt.setPicture({ w: 320, h: 240, data: new Uint8Array(320 * 240 * 4) });
  try {
    worker = new Worker(new URL('./crt/worker.js', import.meta.url), { type: 'module' });
    worker.onmessage = (e) => {
      busy = false;
      if (screenMode === 'lcd') return;
      crt.setSignal(e.data.sig, e.data.sigW, crtH, crtW, crtH, e.data.glow || false);
      crtDraw(); shown();
    };
  } catch { worker = null; }
}
if (!crt || !worker) screenMode = 'lcd';
function crtDraw() {
  crt.draw({ view: [0, 0, glCanvas.width / crtW], split: -1, scan: 1, inter: 0, mask: 1, triads: 1.5, gamma: 2.4, bloom: 0.12, curve: 1,
    par: (glCanvas.width / crtW) / (glCanvas.height / crtH), rowH: 1, dotW: crtW / 256, noise: screenMode === 'rf' ? 0.06 : 0, seed: (crtFrames++ % 97) * 0.37 });
}
let glowTick = 0;
function draw() {
  if (room && (roomPlay || $('player').hidden)) { room.show(frameNow()); return; }
  if (screenMode === 'lcd') { img.data.set(frameBuf.subarray(0, fw * fh * 4)); g.putImageData(img, 0, 0); shown(); return; }
  if (busy) return;
  if (fw !== crtW || fh !== crtH) { crtW = fw; crtH = fh; crt.setPicture({ w: fw, h: fh, data: new Uint8Array(fw * fh * 4) }); glowTick = 0; }
  busy = true;
  const copy = frameBuf.slice(0, fw * fh * 4);
  worker.postMessage({ data: copy, w: fw, h: fh, link: screenMode, glow: (glowTick++ & 3) === 0 }, [copy.buffer]);
}
let drawnWaiters = [];
function shown() { canvas.style.visibility = glCanvas.style.visibility = ''; const w = drawnWaiters; drawnWaiters = []; for (const f of w) f(); }
const drawn = () => new Promise((ok) => drawnWaiters.push(ok));
function setScreen(mode, chosen) {
  if ((!crt || !worker) && mode !== 'lcd') return;
  screenMode = mode; if (chosen) save('retro32.screenMode', mode); glowTick = 0;
  const on = mode !== 'lcd';
  canvas.hidden = on; glCanvas.hidden = !on;
  $('bezel').classList.toggle('crton', on);
  fit();
  if (m) draw();
}

// ---------- 音（8ビット互換機と同じ形: ためておく輪の入れ物から鳴らす。こちらは左右） ----------
function setSound(on) {
  soundOn = on; save('retro32.sound', on ? '1' : '0');
  $('btnSound').setAttribute('aria-pressed', String(on));
  $('soundLbl').textContent = on ? TX('音あり', 'Sound on') : TX('音なし', 'Muted');
  audio?.setGain(on ? volume : 0);
}
function setVolume(v) { volume = v; save('retro32.volume', String(v)); audio?.setGain(soundOn ? v : 0); }
setSound(soundOn);

// ---------- 入力（キー・指・ゲームパッド。くわしくは input.js） ----------
const input = createInput();
input.attachMouse($('bezel'));   // 画面をクリックでマウスをつかむ（口 2）
input.onPress = (p, b) => { if (!running && m && !$('player').hidden && (b === 'START' || b === 'A')) power(); };
const BUTTON_LABEL = { PAD: TX('十字キー', 'D-pad'), A: 'A', B: 'B', X: 'X', Y: 'Y', L: 'L', R: 'R', L2: 'L2', R2: 'R2', START: 'START', SELECT: 'SELECT' };
function renderGuide() {
  const k = input.keys.p1, first = (b) => (k[b][0] ? keyLabel(k[b][0]) : '—');
  $('keys').innerHTML = guideKeys.map(([btn, what]) => {
    const codes = btn === 'PAD' ? ['UP', 'DOWN', 'LEFT', 'RIGHT'].map(first) : k[btn].slice(0, 2).map(keyLabel);
    const kb = (codes.length ? codes : ['—']).map((x) => `<kbd>${x}</kbd>`).join('');
    if (btn === 'PAD') return `<span>${kb}<em>${what}</em></span>`;
    const face = 'ABXY'.includes(btn) ? `<b class="face f${btn}">${btn}</b>` : `<b class="face word">${BUTTON_LABEL[btn]}</b>`;
    return `<span>${face}<i>＝</i>${kb}<em>${what}</em></span>`;
  }).join('') + `<button class="keyedit" id="keyEdit">${TX('キーを変える', 'Change keys')}</button>`;
  $('keyEdit').addEventListener('click', () => settings.open('keys'));
}
const buzz = () => { if (COARSE && vibrateOn && navigator.vibrate) navigator.vibrate(8); };
bindTouch($('pad'), input, () => { if (!running) power(); buzz(); });

// ---------- 設定 ----------
let pausedBySettings = false;
const settings = initSettings({
  input,
  screen: { get: () => screenMode, set: (md) => setScreen(md, true), can: !!crt && !!worker },
  sound: { get: () => soundOn, set: setSound },
  volume: { get: () => volume, set: setVolume },
  vibrate: { get: () => vibrateOn, set: (v) => { vibrateOn = v; save('retro32.vibrate', v ? '1' : '0'); }, can: COARSE && !!navigator.vibrate },
  pause: () => { if (running) { running = false; pausedBySettings = true; audio?.ctx.suspend(); } },
  resume: () => { renderGuide(); if (pausedBySettings) { pausedBySettings = false; running = true; last = 0; acc = 0; audio?.ctx.resume(); requestAnimationFrame(loop); } },
});
$('btnSettings').addEventListener('click', () => settings.open('view'));

// ---------- 動かす ----------
const stats = { frames: 0 };
window.__retro32 = { stats, get mode() { return screenMode; }, setScreen: (md) => setScreen(md), get m() { return m; }, get room() { return room; } };
let acc = 0, last = 0;
function loop(t) {
  if (!running || !m) return;
  if (!last) last = t;
  const dt = t - last;
  acc = Math.min(acc + dt, FRAME_MS * 4);
  last = t;
  let n = 0;
  while (acc >= FRAME_MS) {
    input.apply(m);
    m.runFrame();
    const s = m.spu.take();
    if (audio) audio.push(s);
    acc -= FRAME_MS; n++;
    stats.frames++;
  }
  if (n) { grab(); draw(); }
  requestAnimationFrame(loop);
}
function power() {
  if (running || !m) return;
  running = true;
  $('power').hidden = true;
  canvas.style.opacity = ''; glCanvas.style.opacity = '';
  if (!audio) { audio = createAudio(); setSound(soundOn); }
  if (audio) { audio.ctx.resume(); m.spu.setRate(audio.ctx.sampleRate); }
  last = 0; acc = 0;
  requestAnimationFrame(loop);
}
$('power').addEventListener('click', power);
$('btnSound').addEventListener('click', () => setSound(!soundOn));
$('btnReset').addEventListener('click', () => { if (current) { const e = current; stopPlayer(); current = e; (e.bytes ? Promise.resolve(e.bytes) : loadExe(e)).then((b) => { m = makeConsole(b); if (m) power(); }); } });
$('btnFull').addEventListener('click', () => {
  if (document.fullscreenElement) document.exitFullscreen();
  else document.documentElement.requestFullscreen?.().catch(() => {});
});
document.addEventListener('fullscreenchange', () => setTimeout(fit, 50));

// 遊んでいるあいだ: 画面を暗くしない・iOS の指2本の拡大をしない・長押しのメニューを出さない
let wake = null;
function keepAwake(on) {
  if (on) { if (!wake && navigator.wakeLock) navigator.wakeLock.request('screen').then((w) => { wake = w; w.addEventListener('release', () => { wake = null; }); }).catch(() => {}); }
  else { wake?.release().catch(() => {}); wake = null; }
}
new MutationObserver(() => keepAwake(document.body.classList.contains('playing') && !document.hidden)).observe(document.body, { attributes: true, attributeFilter: ['class'] });
for (const t of ['gesturestart', 'gesturechange']) document.addEventListener(t, (e) => { if (document.body.classList.contains('playing')) e.preventDefault(); }, { passive: false });
$('player').addEventListener('contextmenu', (e) => { if (!e.target.closest('input,textarea')) e.preventDefault(); });

document.addEventListener('visibilitychange', () => {
  if (!m || !$('power').hidden || $('player').hidden) return;
  if (document.hidden) { running = false; audio?.ctx.suspend(); }
  else { running = true; last = 0; acc = 0; audio?.ctx.resume(); requestAnimationFrame(loop); keepAwake(true); }
});

shelf.render();
setScreen(screenMode);
route();
