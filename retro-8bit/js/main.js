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
  if (!romCache.has(entry.id)) romCache.set(entry.id, fetch(entry.file + '?v=5').then((r) => { if (!r.ok) throw new Error(r.status); return r.arrayBuffer(); }).then((b) => new Uint8Array(b)));
  return romCache.get(entry.id);
}
function renderShelf() {
  const box = $('carts'), blank = $('drop');
  for (const old of box.querySelectorAll('.cart:not(.blank)')) old.remove();
  for (const e of LIBRARY) {
    const cart = document.createElement('article');
    cart.className = 'cart';
    cart.style.setProperty('--c', e.color || '#8f8d88');
    cart.innerHTML = `<button class="shell"><span class="label"><canvas width="256" height="240"></canvas><b></b><small>ROM CASSETTE</small></span><span class="grip"></span></button>
      <a class="tag" download>ROM ↓</a><p class="desc"></p>`;
    const shell = cart.querySelector('.shell');
    shell.setAttribute('aria-label', `${e.title} であそぶ`);
    cart.querySelector('b').textContent = e.title;
    cart.querySelector('.desc').textContent = e.desc;
    const dl = cart.querySelector('.tag');
    dl.href = e.file; dl.download = e.id + '.nes';
    dl.title = `${e.id}.nes をダウンロード`;
    shell.addEventListener('click', () => insertCart(cart, () => openEntry(e, true)));
    box.insertBefore(cart, blank);
    // ラベルの絵: 音なしでタイトルまで進めて1枚描く
    loadRom(e).then((bytes) => {
      const m = new Console8(bytes, 8000);
      for (let i = 0; i < e.frames; i++) m.runFrame();
      const c = cart.querySelector('canvas').getContext('2d'), im = c.createImageData(256, 240);
      new Uint32Array(im.data.buffer).set(m.ppu.frame);
      c.putImageData(im, 0, 0);
      dl.textContent = `ROM ↓ ${Math.round(bytes.length / 1024)}KB`;
    }).catch(() => { dl.textContent = 'ROM ↓'; });
  }
}

// カセットを本体のさしこみ口へ: 口の上まで飛んで、口の線より下が見えなくなりながら入っていく
// （動きを減らす設定や、本体が画面の外なら、すぐ次へ）
function insertCart(cart, then) {
  const slot = $('slot').getBoundingClientRect(), shell = cart.querySelector('.shell'), c = shell.getBoundingClientRect();
  const led = $('led'), con = $('console');
  if (matchMedia('(prefers-reduced-motion: reduce)').matches || slot.bottom < 0 || slot.top > innerHeight || !shell.animate) {
    led.classList.add('on'); con.classList.add('on'); then(); return;
  }
  const k = Math.min(0.55, (slot.width * 0.9) / c.width);          // 口の幅に合わせて縮める
  const dx = slot.left + slot.width / 2 - (c.left + c.width / 2);
  const above = slot.top + slot.height / 2 - c.height * k / 2 - (c.top + c.height / 2) - 40; // 口の 40px 上
  const into = above + c.height * k;                                  // 口へ入りきる
  cart.classList.add('flying');
  shell.animate([
    { transform: 'none', clipPath: 'inset(0 0 0 0)' },
    { transform: `translate(${dx}px, ${above}px) scale(${k})`, clipPath: 'inset(0 0 0 0)', offset: 0.7 },
    { transform: `translate(${dx}px, ${into}px) scale(${k})`, clipPath: 'inset(0 0 100% 0)' },
  ], { duration: 600, easing: 'cubic-bezier(.45,0,.3,1)', fill: 'forwards' });
  setTimeout(() => { led.classList.add('on'); con.classList.add('on'); }, 560);
  setTimeout(then, 760);
}
function resetShelf() {
  $('led').classList.remove('on'); $('console').classList.remove('on');
  for (const c of document.querySelectorAll('.cart.flying')) { c.classList.remove('flying'); for (const an of c.querySelector('.shell').getAnimations()) an.cancel(); }
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
    insertCart($('drop'), () => openEntry({ id: null, title: file.name, keys: [], bytes }, true));
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
  const keys = e.keys?.length ? e.keys : [['PAD', ''], ['A', ''], ['B', ''], ['START', ''], ['SELECT', '']];
  $('keys').innerHTML = keyGuide(keys) + '<span class="dim">ゲームパッドも使えます</span>';
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
  resetShelf();
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
  else if (current) { stopPlayer(); resetShelf(); current = null; $('player').hidden = true; $('shelf').hidden = false; }
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
// とりあつかい説明書の「セーブを消す」（遊んでいないときだけ押せる。消したら、つぎに入れたとき牧場ははじめから）
$('eraseDino').addEventListener('click', () => {
  if (!confirm('恐竜かけっこ牧場のセーブ（牧場の恐竜と、勝ちすすんだ杯）を消します。もとにはもどせません。消しますか？')) return;
  try { localStorage.removeItem('retro8.save.dino-ranch'); } catch { /* 保存できない設定なら、もともと残っていない */ }
  $('erased').textContent = '消しました';
});
addEventListener('pagehide', () => { if (nes) saveBattery(); });

// ---------- 画面の大きさ（なるべく整数倍で、ドットをそろえる） ----------
function fit() {
  if ($('player').hidden) return;
  const stage = $('stage'), bez = $('bezel');
  const pad = parseFloat(getComputedStyle(bez).paddingLeft) * 2;
  const w = stage.clientWidth - pad, h = stage.clientHeight - pad - 8;
  // デバイスのピクセルで1ドットが整数になるように（Windows の 125%・150% でも走査線がゆがまない。crt-pixels と同じ決め方）
  const dpr = window.devicePixelRatio || 1;
  let sd = Math.max(1, Math.min(w / 256, h / 240)) * dpr;
  if (Math.floor(sd) / sd >= 0.85) sd = Math.floor(sd);
  const css = sd / dpr;
  for (const el of [canvas, glCanvas]) { el.style.width = 256 * css + 'px'; el.style.height = 240 * css + 'px'; }
  glCanvas.width = Math.round(256 * sd); glCanvas.height = Math.round(240 * sd);
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
  // 画面の字（A・B・START）と同じ名前のキーで押せるように。X・Z はコントローラーの並び（B が左・A が右）が好きな人むけ
  KeyA: 'A', KeyX: 'A', Space: 'A', KeyB: 'B', KeyZ: 'B', Enter: 'START', ShiftLeft: 'SELECT', ShiftRight: 'SELECT',
};
// キーの案内: コントローラーのボタン → 押せるキー
const BUTTON_KEYS = { PAD: ['↑', '↓', '←', '→'], A: ['A', 'X'], B: ['B', 'Z'], START: ['Enter'], SELECT: ['Shift'] };
const BUTTON_LABEL = { PAD: '十字キー', A: 'A', B: 'B', START: 'START', SELECT: 'SELECT' };
function keyGuide(keys) {
  return keys.map(([btn, what]) => {
    const kb = BUTTON_KEYS[btn].map((k) => `<kbd>${k}</kbd>`).join('');
    const face = btn === 'A' || btn === 'B' ? `<b class="face">${btn}</b>` : `<b class="face word">${BUTTON_LABEL[btn]}</b>`;
    return `<span>${face}${kb}<em>${what}</em></span>`;
  }).join('');
}
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
  const on = (e) => { e.preventDefault(); if (!running) power(); touchHeld.add(b); tapped.add(b); el.classList.add('on'); try { el.setPointerCapture(e.pointerId); } catch { /* 指がもう離れている */ } };
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
  dp.addEventListener('pointerdown', (e) => { e.preventDefault(); try { dp.setPointerCapture(e.pointerId); } catch { /* 指がもう離れている */ } set(e); });
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
