// 棚（トップ）と遊ぶ画面。画面・音・入力・セーブをつなぐ（ブラウザの係）
import { Console8, BTN } from './nes.js';
import { LIBRARY } from './library.js';
import { createCRT } from './crt/crt-gl.js';

const FRAME_MS = 1000 / 60.0988;
const $ = (id) => document.getElementById(id);

const canvas = $('screen'), g = canvas.getContext('2d');
const img = g.createImageData(256, 240), px = new Uint32Array(img.data.buffer);
let nes = null, current = null, running = false, audio = null;
let soundOn = read('retro8.sound', '1') === '1';

function read(k, d) { try { return localStorage.getItem(k) ?? d; } catch { return d; } }
function save(k, v) { try { localStorage.setItem(k, v); return true; } catch { return false; } }

// ---------- 棚 ----------
const romCache = new Map();
async function loadRom(entry) {
  if (!romCache.has(entry.id)) romCache.set(entry.id, fetch(entry.file + '?v=2').then((r) => { if (!r.ok) throw new Error(r.status); return r.arrayBuffer(); }).then((b) => new Uint8Array(b)));
  return romCache.get(entry.id);
}
function renderShelf() {
  const box = $('carts');
  box.textContent = '';
  for (const e of LIBRARY) {
    const card = document.createElement('article');
    card.className = 'cartcard';
    card.innerHTML = `<canvas width="256" height="240" aria-hidden="true"></canvas>
      <div class="body"><h3></h3><p></p>
      <div class="row"><button class="play">あそぶ</button><a class="dl" download>ROM ↓</a></div></div>`;
    card.querySelector('h3').textContent = e.title;
    card.querySelector('p').textContent = e.desc;
    const dl = card.querySelector('.dl');
    dl.href = e.file; dl.download = e.id + '.nes';
    dl.title = `${e.id}.nes をダウンロード`;
    card.querySelector('.play').addEventListener('click', () => openEntry(e, true));
    card.querySelector('canvas').addEventListener('click', () => openEntry(e, true));
    box.append(card);
    // 小さな画面: 音なしでタイトルまで進めて1枚描く
    loadRom(e).then((bytes) => {
      const m = new Console8(bytes, 8000);
      for (let i = 0; i < e.frames; i++) m.runFrame();
      const c = card.querySelector('canvas').getContext('2d'), im = c.createImageData(256, 240);
      new Uint32Array(im.data.buffer).set(m.ppu.frame);
      c.putImageData(im, 0, 0);
      dl.textContent = `ROM ↓ ${Math.round(bytes.length / 1024)}KB`;
    }).catch(() => { dl.textContent = 'ROM ↓'; });
  }
}

// 自分のファイルを開く（この端末の中だけ。fetch も送信もしない）
function openLocal(file) {
  const err = $('openErr');
  err.hidden = true;
  if (!file) return;
  if (file.size > 1024 * 1024) { err.textContent = '大きすぎるファイルです（1MB まで）'; err.hidden = false; return; }
  file.arrayBuffer().then((buf) => {
    const bytes = new Uint8Array(buf);
    try { new Console8(bytes, 8000); } catch (e) { err.textContent = '開けませんでした: ' + e.message; err.hidden = false; return; }
    openEntry({ id: null, title: file.name, keys: [], bytes }, true);
  });
}
$('file').addEventListener('change', (e) => { openLocal(e.target.files[0]); e.target.value = ''; });
{
  const drop = $('drop');
  drop.addEventListener('dragover', (e) => { e.preventDefault(); drop.classList.add('over'); });
  drop.addEventListener('dragleave', () => drop.classList.remove('over'));
  drop.addEventListener('drop', (e) => { e.preventDefault(); drop.classList.remove('over'); openLocal(e.dataTransfer.files[0]); });
}

// ---------- 遊ぶ画面へ ----------
async function openEntry(e, gesture) {
  stopPlayer();
  current = e;
  $('shelf').hidden = true;
  $('player').hidden = false;
  $('cartName').textContent = e.title;
  const keys = e.keys?.length ? e.keys : [['↑↓←→', '十字キー'], ['X', 'A'], ['Z', 'B'], ['Enter', 'スタート'], ['Shift', 'セレクト']];
  $('keys').innerHTML = keys.map(([k, t]) => `<span>${k.split(/(?=[↑↓←→])|\s/).filter(Boolean).map((x) => `<kbd>${x}</kbd>`).join('')} ${t}</span>`).join('') + '<span class="dim">ゲームパッドも使えます</span>';
  if (e.id && location.hash !== '#' + e.id) history.pushState(null, '', '#' + e.id);
  fit();
  let bytes;
  try { bytes = e.bytes || await loadRom(e); } catch { backToShelf(); return; }
  nes = new Console8(bytes, audio ? audio.ctx.sampleRate : 48000);
  loadBattery();
  if (gesture) power();
  else {
    // 直接ひらいたとき: 音を出すには一度押してもらう
    for (let i = 0; i < (e.frames || 60); i++) nes.runFrame();
    nes.apu.take(); draw();
    canvas.style.opacity = '.45'; glCanvas.style.opacity = '.45';
    $('power').hidden = false;
  }
}
function stopPlayer() {
  if (nes) saveBattery();
  running = false;
  audio?.ctx.suspend();
  nes = null;
}
function backToShelf() {
  stopPlayer();
  current = null;
  $('player').hidden = true;
  $('shelf').hidden = false;
  if (location.hash) history.pushState(null, '', location.pathname);
}
$('btnBack').addEventListener('click', backToShelf);
function route() {
  const id = location.hash.slice(1);
  const e = LIBRARY.find((x) => x.id === id);
  if (e) { if (current !== e) openEntry(e, false); }
  else if (current) { stopPlayer(); current = null; $('player').hidden = true; $('shelf').hidden = false; }
}
addEventListener('popstate', route);

// ---------- 電池のセーブ（$6000 の RAM を localStorage に） ----------
let lastSave = '';
const saveKey = () => current?.id ? 'retro8.save.' + current.id : null;
function loadBattery() {
  lastSave = '';
  const k = saveKey();
  if (!k || !nes.cart.battery) return;
  const s = read(k, '');
  if (!s) return;
  try {
    const bin = atob(s);
    for (let i = 0; i < bin.length && i < 8192; i++) nes.cart.prgRam[i] = bin.charCodeAt(i);
    lastSave = s;
  } catch { /* こわれたセーブは使わない */ }
}
function saveBattery() {
  const k = saveKey();
  if (!k || !nes?.cart.battery) return;
  let bin = '';
  const r = nes.cart.prgRam;
  for (let i = 0; i < r.length; i++) bin += String.fromCharCode(r[i]);
  const s = btoa(bin);
  if (s !== lastSave && save(k, s)) lastSave = s;
}
setInterval(() => { if (running) saveBattery(); }, 3000);
addEventListener('pagehide', () => { if (nes) saveBattery(); });

// ---------- 画面の大きさ（なるべく整数倍で、ドットをそろえる） ----------
function fit() {
  if ($('player').hidden) return;
  const stage = $('stage'), bez = $('bezel');
  const pad = parseFloat(getComputedStyle(bez).paddingLeft) * 2;
  const w = stage.clientWidth - pad, h = stage.clientHeight - pad - 8;
  let s = Math.max(1, Math.min(w / 256, h / 240));
  if (Math.floor(s) >= s * 0.8) s = Math.floor(s);
  const cw = Math.round(256 * s), ch = Math.round(240 * s);
  for (const el of [canvas, glCanvas]) { el.style.width = cw + 'px'; el.style.height = ch + 'px'; }
  // ブラウン管はデバイスのピクセルで描く（走査線と光る点が見えるように）
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  glCanvas.width = Math.round(cw * dpr); glCanvas.height = Math.round(ch * dpr);
  if (nes && screenMode !== 'lcd' && crt) crtDraw();
}
addEventListener('resize', fit);

// ---------- 画面の見え方: くっきり（2D）か、ブラウン管（WebGL2。まなびラボ「ブラウン管のドット絵」の計算） ----------
const glCanvas = $('crt');
let crt = null, worker = null, busy = false, crtFrames = 0;
// はじめは: PC はブラウン管（ビデオ端子）、スマホは くっきり（描くのが重いので。メニューで変えられる）
let screenMode = read('retro8.screen', matchMedia('(pointer:coarse)').matches ? 'lcd' : 'composite');
try { crt = createCRT(glCanvas); } catch { crt = null; }
if (crt) {
  crt.setPicture({ w: 256, h: 240, data: new Uint8Array(256 * 240 * 4) });
  try {
    worker = new Worker(new URL('./crt/worker.js', import.meta.url), { type: 'module' });
    worker.onmessage = (e) => { busy = false; if (screenMode !== 'lcd' && screenMode !== 'rgb') { crt.setSignal(e.data, 1024, 240); crtDraw(); } };
  } catch { worker = null; }
}
if (!crt) screenMode = 'lcd';
const sig = new Uint32Array(1024 * 240), sig8 = new Uint8Array(sig.buffer);
function crtDraw() {
  crt.draw({ view: [0, 0, glCanvas.width / 256], split: -1, scan: 1, inter: 0, mask: 1, triads: 1.5, gamma: 2.4, bloom: 0.10, curve: 1,
    noise: screenMode === 'rf' ? 0.06 : 0, seed: (crtFrames++ % 97) * 0.37 });
}
function draw() {
  if (screenMode === 'lcd') { px.set(nes.ppu.frame); g.putImageData(img, 0, 0); return; }
  const f = nes.ppu.frame;
  if (screenMode === 'rgb' || !worker) {
    // RGB: 信号はドットのまま（1ドット 4 点にのばす）
    for (let i = 0, j = 0; i < f.length; i++, j += 4) { const c = f[i]; sig[j] = c; sig[j + 1] = c; sig[j + 2] = c; sig[j + 3] = c; }
    crt.setSignal(sig8, 1024, 240);
    crtDraw();
  } else if (!busy) {
    busy = true;
    const copy = new Uint8ClampedArray(f.buffer.slice(0));
    worker.postMessage({ data: copy, link: screenMode }, [copy.buffer]);
  }
}
function setScreen(mode) {
  if (!crt && mode !== 'lcd') return;
  screenMode = mode; save('retro8.screen', mode);
  const on = mode !== 'lcd';
  canvas.hidden = on; glCanvas.hidden = !on;
  $('bezel').classList.toggle('crton', on);
  for (const b of document.querySelectorAll('[data-screen]')) {
    b.setAttribute('aria-checked', String(b.dataset.screen === mode));
    if (!crt && b.dataset.screen !== 'lcd') b.disabled = true;
  }
  fit();
  if (nes) draw();
}
{
  const btn = $('btnScreen'), menu = $('screenMenu');
  const close = () => { menu.hidden = true; btn.setAttribute('aria-expanded', 'false'); };
  btn.addEventListener('click', (e) => { e.stopPropagation(); menu.hidden = !menu.hidden; btn.setAttribute('aria-expanded', String(!menu.hidden)); });
  for (const b of menu.querySelectorAll('[data-screen]')) b.addEventListener('click', () => { setScreen(b.dataset.screen); close(); });
  document.addEventListener('click', (e) => { if (!menu.hidden && !menu.contains(e.target)) close(); });
  addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
}

// ---------- 音（ためておく輪の入れ物から鳴らす） ----------
function setupAudio() {
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  const ctx = new AC();
  const ring = new Float32Array(16384), mask = ring.length - 1;
  const a = { ctx, r: 0, w: 0, gain: ctx.createGain() };
  const node = ctx.createScriptProcessor(1024, 0, 1);
  node.onaudioprocess = (e) => {
    const out = e.outputBuffer.getChannelData(0);
    for (let i = 0; i < out.length; i++) {
      if (a.r !== a.w) { out[i] = ring[a.r]; a.r = (a.r + 1) & mask; } else out[i] = 0;
    }
  };
  a.push = (s) => {
    if (((a.w - a.r) & mask) > 6000) return; // おくれすぎたら捨てる
    for (let i = 0; i < s.length; i++) {
      const n = (a.w + 1) & mask;
      if (n === a.r) break;
      ring[a.w] = s[i] * 1.6; a.w = n;
    }
  };
  a.gain.gain.value = soundOn ? 1 : 0;
  node.connect(a.gain).connect(ctx.destination);
  return a;
}
function setSound(on) {
  soundOn = on; save('retro8.sound', on ? '1' : '0');
  $('btnSound').setAttribute('aria-pressed', String(on));
  if (audio) audio.gain.gain.value = on ? 1 : 0;
}
setSound(soundOn);

// ---------- 入力（キー・指・ゲームパッドを合わせる） ----------
const KEYS = {
  ArrowLeft: 'LEFT', ArrowRight: 'RIGHT', ArrowUp: 'UP', ArrowDown: 'DOWN',
  KeyX: 'A', Space: 'A', KeyZ: 'B', Enter: 'START', ShiftLeft: 'SELECT', ShiftRight: 'SELECT',
};
const keyHeld = new Set(), touchHeld = new Set(), dpadHeld = new Set();
const tapped = new Set(); // 押してすぐはなしても、1フレームは押したことにする
addEventListener('keydown', (e) => {
  const b = KEYS[e.code];
  if (!b || $('player').hidden) return;
  e.preventDefault();
  if (!running && (b === 'START' || b === 'A')) { power(); return; }
  keyHeld.add(b); tapped.add(b);
});
addEventListener('keyup', (e) => { const b = KEYS[e.code]; if (b) keyHeld.delete(b); });
addEventListener('blur', () => { keyHeld.clear(); touchHeld.clear(); dpadHeld.clear(); });

for (const el of document.querySelectorAll('[data-btn]')) {
  const b = el.dataset.btn;
  const on = (e) => { e.preventDefault(); if (!running) power(); touchHeld.add(b); tapped.add(b); el.classList.add('on'); el.setPointerCapture?.(e.pointerId); };
  const off = () => { touchHeld.delete(b); el.classList.remove('on'); };
  el.addEventListener('pointerdown', on);
  el.addEventListener('pointerup', off);
  el.addEventListener('pointercancel', off);
  el.addEventListener('contextmenu', (e) => e.preventDefault());
}
// 十字キー: 指の位置から向きを決める（ななめも）
{
  const dp = $('dpad'), parts = { UP: dp.querySelector('.u'), DOWN: dp.querySelector('.d'), LEFT: dp.querySelector('.l'), RIGHT: dp.querySelector('.r') };
  const set = (e) => {
    const r = dp.getBoundingClientRect();
    const dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
    const before = new Set(dpadHeld);
    dpadHeld.clear();
    if (Math.hypot(dx, dy) > 12) {
      if (dx < -Math.abs(dy) * 0.5) dpadHeld.add('LEFT');
      if (dx > Math.abs(dy) * 0.5) dpadHeld.add('RIGHT');
      if (dy < -Math.abs(dx) * 0.5) dpadHeld.add('UP');
      if (dy > Math.abs(dx) * 0.5) dpadHeld.add('DOWN');
    }
    for (const b of dpadHeld) if (!before.has(b)) tapped.add(b);
    for (const [k, el] of Object.entries(parts)) el.classList.toggle('on', dpadHeld.has(k));
  };
  const clear = () => { dpadHeld.clear(); for (const el of Object.values(parts)) el.classList.remove('on'); };
  dp.addEventListener('pointerdown', (e) => { e.preventDefault(); dp.setPointerCapture(e.pointerId); set(e); });
  dp.addEventListener('pointermove', (e) => { if (e.buttons || e.pointerType === 'touch') set(e); });
  dp.addEventListener('pointerup', clear);
  dp.addEventListener('pointercancel', clear);
}
function gamepadHeld() {
  const s = new Set();
  const gp = navigator.getGamepads ? [...navigator.getGamepads()].find(Boolean) : null;
  if (!gp) return s;
  const p = (i) => gp.buttons[i]?.pressed;
  if (p(0)) s.add('A');
  if (p(1) || p(2)) s.add('B');
  if (p(8)) s.add('SELECT');
  if (p(9)) s.add('START');
  if (p(12) || gp.axes[1] < -0.5) s.add('UP');
  if (p(13) || gp.axes[1] > 0.5) s.add('DOWN');
  if (p(14) || gp.axes[0] < -0.5) s.add('LEFT');
  if (p(15) || gp.axes[0] > 0.5) s.add('RIGHT');
  return s;
}
function applyInput() {
  let bits = 0;
  for (const set of [keyHeld, touchHeld, dpadHeld, tapped, gamepadHeld()]) for (const b of set) bits |= 1 << BTN[b];
  tapped.clear();
  // 左右・上下を同時に押したことにしない（本物の十字キーではできない）
  if ((bits & 0xc0) === 0xc0) bits &= ~0xc0;
  if ((bits & 0x30) === 0x30) bits &= ~0x30;
  nes.pad[0] = bits;
}

// ---------- 動かす ----------
// 確かめ用の窓口（動いたフレームの数・画面の見え方）
const stats = { frames: 0 };
window.__retro8 = { stats, get mode() { return screenMode; }, setScreen: (m) => setScreen(m), get nes() { return nes; } };
let acc = 0, last = 0;
function loop(t) {
  if (!running || !nes) return;
  if (!last) last = t;
  acc = Math.min(acc + (t - last), FRAME_MS * 4);
  last = t;
  let n = 0;
  while (acc >= FRAME_MS) {
    applyInput();
    nes.runFrame();
    const s = nes.apu.take();
    if (audio) audio.push(s);
    acc -= FRAME_MS; n++;
    stats.frames++;
  }
  if (n) draw();
  requestAnimationFrame(loop);
}
function power() {
  if (running || !nes) return;
  running = true;
  $('power').hidden = true;
  canvas.style.opacity = ''; glCanvas.style.opacity = '';
  if (!audio) audio = setupAudio();
  if (audio) { audio.ctx.resume(); nes.apu.setRate(audio.ctx.sampleRate); }
  last = 0; acc = 0;
  requestAnimationFrame(loop);
}
$('power').addEventListener('click', power);
$('btnSound').addEventListener('click', () => setSound(!soundOn));
$('btnReset').addEventListener('click', () => { if (nes) { saveBattery(); nes.reset(); if (!running) power(); } });
$('btnFull').addEventListener('click', () => {
  if (document.fullscreenElement) document.exitFullscreen();
  else document.documentElement.requestFullscreen?.().catch(() => {});
});
document.addEventListener('fullscreenchange', () => setTimeout(fit, 50));

// タブを離れたら止め、もどったら続ける
document.addEventListener('visibilitychange', () => {
  if (!nes || !$('power').hidden) return;
  if (document.hidden) { saveBattery(); running = false; audio?.ctx.suspend(); }
  else { running = true; last = 0; acc = 0; audio?.ctx.resume(); requestAnimationFrame(loop); }
});

renderShelf();
setScreen(screenMode);
route();
