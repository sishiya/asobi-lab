// 棚（トップ）と遊ぶ画面。画面・音・入力・セーブをつなぐ（ブラウザの係）
import { Console8, BTN } from './nes.js';
import { LIBRARY } from './library.js';
import { createCRT } from './crt/crt-gl.js';
import { createInput, keyLabel } from './input.js';
import { initSettings } from './settings.js';
import { initShelf } from './shelf.js';

const FRAME_MS = 1000 / 60.0988;
const $ = (id) => document.getElementById(id);

const canvas = $('screen'), g = canvas.getContext('2d');
const img = g.createImageData(256, 240), px = new Uint32Array(img.data.buffer);
let nes = null, current = null, running = false, audio = null;
let soundOn = read('retro8.sound', '1') === '1';
let volume = Math.min(1, Math.max(0, +read('retro8.volume', '0.8') || 0));
const COARSE = matchMedia('(pointer:coarse)').matches;
let vibrateOn = read('retro8.vibrate', '1') === '1';

function read(k, d) { try { return localStorage.getItem(k) ?? d; } catch { return d; } }
function save(k, v) { try { localStorage.setItem(k, v); return true; } catch { return false; } }

// ---------- 棚 ----------
const romCache = new Map();
async function loadRom(entry) {
  if (!romCache.has(entry.id)) romCache.set(entry.id, fetch(entry.file + '?v=5').then((r) => { if (!r.ok) throw new Error(r.status); return r.arrayBuffer(); }).then((b) => new Uint8Array(b)));
  return romCache.get(entry.id);
}
// 小さな音（カセットが入る・抜ける・スイッチ・ケースから出す／もどす）。設定の音と大きさにしたがう
let sfxCtx = null;
function clack(kind) {
  if (!soundOn) return;
  if (kind === 'lift' || kind === 'tuck') { caseTone(kind); return; }
  try {
    sfxCtx ||= new (window.AudioContext || window.webkitAudioContext)();
    const t = sfxCtx.currentTime, n = Math.floor(sfxCtx.sampleRate * 0.06), buf = sfxCtx.createBuffer(1, n, sfxCtx.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, kind === 'in' ? 6 : kind === 'out' ? 4 : 10);
    const src = sfxCtx.createBufferSource(), f = sfxCtx.createBiquadFilter(), gn = sfxCtx.createGain();
    f.type = 'bandpass'; f.frequency.value = kind === 'in' ? 900 : kind === 'out' ? 1400 : 2400; f.Q.value = 1.2;
    gn.gain.value = volume * 0.5;
    src.buffer = buf; src.connect(f).connect(gn).connect(sfxCtx.destination); src.start(t);
  } catch { /* 音が出せなくても動く */ }
}
// ケースから出す（少し上がる）・ケースにもどす（少し下がる）: 小さく丸い音。高い音と立ち上がりのとがりを消して耳にやさしく
function caseTone(kind) {
  try {
    sfxCtx ||= new (window.AudioContext || window.webkitAudioContext)();
    const t = sfxCtx.currentTime + 0.01, up = kind === 'lift';
    const os = sfxCtx.createOscillator(), f = sfxCtx.createBiquadFilter(), gn = sfxCtx.createGain();
    os.type = 'triangle';
    os.frequency.setValueAtTime(up ? 440 : 560, t);
    os.frequency.exponentialRampToValueAtTime(up ? 620 : 392, t + 0.09);
    f.type = 'lowpass'; f.frequency.value = 1600;
    gn.gain.setValueAtTime(0, t);
    gn.gain.linearRampToValueAtTime(volume * 0.13, t + 0.012);
    gn.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
    os.connect(f).connect(gn).connect(sfxCtx.destination);
    os.start(t); os.stop(t + 0.18);
  } catch { /* 音が出せなくても動く */ }
}
// 棚（くわしくは shelf.js）
const shelf = initShelf({ library: LIBRARY, loadRom, open: (e) => openEntry(e, true), sfx: { clack } });

// ---------- 遊ぶ画面へ ----------
async function openEntry(e, gesture) {
  stopPlayer();
  current = e;
  $('shelf').hidden = true;
  $('player').hidden = false;
  $('cartName').textContent = e.title;
  guideKeys = e.keys?.length ? e.keys : [['PAD', ''], ['A', ''], ['B', ''], ['START', ''], ['SELECT', '']];
  renderGuide();
  document.body.classList.add('playing');
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
  shelf.back();
  current = null;
  $('player').hidden = true;
  $('shelf').hidden = false;
  document.body.classList.remove('playing');
  if (location.hash) history.pushState(null, '', location.pathname);
}
// まちがえて押すと遊んでいた所が消えるボタンは、遊んでいる途中なら2回押す（1回目でボタンの下に案内）
function twoTap(btn, text, act) {
  let armed = 0;
  const tip = document.createElement('span');
  tip.className = 'tip'; tip.setAttribute('role', 'status');
  btn.style.position = 'relative'; btn.append(tip);
  btn.addEventListener('click', () => {
    if (!running || Date.now() - armed < 2000) { armed = 0; tip.classList.remove('show'); act(); return; }
    armed = Date.now(); tip.textContent = text; tip.classList.add('show');
    setTimeout(() => { if (Date.now() - armed >= 1990) tip.classList.remove('show'); }, 2000);
  });
}
twoTap($('btnBack'), 'もう一度押すと棚へ', backToShelf);
function route() {
  const id = location.hash.slice(1);
  const e = LIBRARY.find((x) => x.id === id);
  if (e) { if (current !== e) openEntry(e, false); }
  else if (current) { stopPlayer(); shelf.back(); current = null; $('player').hidden = true; $('shelf').hidden = false; document.body.classList.remove('playing'); }
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
    worker.onmessage = (e) => {
      busy = false;
      if (screenMode === 'lcd') return;
      crt.setSignal(e.data.sig, 1024, 240, 256, 240, e.data.glow || false);
      crtDraw();
    };
  } catch { worker = null; }
}
if (!crt) screenMode = 'lcd';
const sig = new Uint32Array(1024 * 240), sig8 = new Uint8Array(sig.buffer);
function crtDraw() {
  // crt-pixels と同じ値（ブルーム 0.12 を mix で。画素はたて横同じ＝par 1。テレビの 8:7 にはしない）
  crt.draw({ view: [0, 0, glCanvas.width / 256], split: -1, scan: 1, inter: 0, mask: 1, triads: 1.5, gamma: 2.4, bloom: 0.12, curve: 1, par: 1, rowH: 1, dotW: 1,
    noise: screenMode === 'rf' ? 0.06 : 0, seed: (crtFrames++ % 97) * 0.37 });
}
// 信号とにじみは worker で（にじみは 4 回に 1 回。ぼかした光なので少しおくれても見えない）。
// worker が使えないときだけ、ここで RGB の信号を作る（にじみは はじめの 1 回だけ）
let glowTick = 0;
function draw() {
  if (screenMode === 'lcd') { px.set(nes.ppu.frame); g.putImageData(img, 0, 0); return; }
  const f = nes.ppu.frame;
  if (worker) {
    if (busy) return;
    busy = true;
    const copy = new Uint8ClampedArray(f.buffer.slice(0));
    worker.postMessage({ data: copy, link: screenMode, glow: (glowTick++ & 3) === 0 }, [copy.buffer]);
    return;
  }
  for (let i = 0, j = 0; i < f.length; i++, j += 4) { const c = f[i]; sig[j] = c; sig[j + 1] = c; sig[j + 2] = c; sig[j + 3] = c; }
  crt.setSignal(sig8, 1024, 240, 256, 240, glowTick++ ? false : undefined);
  crtDraw();
}
function setScreen(mode) {
  if (!crt && mode !== 'lcd') return;
  screenMode = mode; save('retro8.screen', mode); glowTick = 0;
  const on = mode !== 'lcd';
  canvas.hidden = on; glCanvas.hidden = !on;
  $('bezel').classList.toggle('crton', on);
  fit();
  if (nes) draw();
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
  a.gain.gain.value = soundOn ? volume : 0;
  node.connect(a.gain).connect(ctx.destination);
  return a;
}
function setSound(on) {
  soundOn = on; save('retro8.sound', on ? '1' : '0');
  $('btnSound').setAttribute('aria-pressed', String(on));
  $('soundLbl').textContent = on ? '音あり' : '音なし';
  if (audio) audio.gain.gain.value = on ? volume : 0;
}
function setVolume(v) {
  volume = v; save('retro8.volume', String(v));
  if (audio) audio.gain.gain.value = soundOn ? v : 0;
}
setSound(soundOn);

// ---------- 入力（キー・指・ゲームパッド。くわしくは input.js） ----------
const input = createInput();
input.onPress = (p, b) => { if (!running && nes && (b === 'START' || b === 'A')) power(); };
// キーの案内: コントローラーのボタン → いまの割り当てのキー → すること
let guideKeys = [];
const BUTTON_LABEL = { PAD: '十字キー', A: 'A', B: 'B', START: 'START', SELECT: 'SELECT' };
function renderGuide() {
  const k = input.keys.p1, first = (b) => (k[b][0] ? keyLabel(k[b][0]) : '—');
  $('keys').innerHTML = guideKeys.map(([btn, what]) => {
    const codes = btn === 'PAD' ? ['UP', 'DOWN', 'LEFT', 'RIGHT'].map(first) : k[btn].slice(0, 2).map(keyLabel);
    const kb = (codes.length ? codes : ['—']).map((x) => `<kbd>${x}</kbd>`).join('');
    if (btn === 'PAD') return `<span>${kb}<em>${what}</em></span>`;
    const face = btn === 'A' || btn === 'B' ? `<b class="face">${btn}</b>` : `<b class="face word">${BUTTON_LABEL[btn]}</b>`;
    return `<span>${face}<i>＝</i>${kb}<em>${what}</em></span>`;
  }).join('') + '<button class="keyedit" id="keyEdit">キーを変える</button>';
  $('keyEdit').addEventListener('click', () => settings.open('keys'));
}
const buzz = () => { if (COARSE && vibrateOn && navigator.vibrate) navigator.vibrate(8); };
for (const el of document.querySelectorAll('[data-btn]')) {
  const names = el.dataset.btn.split(' ');
  const on = (e) => { e.preventDefault(); if (!running) power(); input.touchDown(names); el.classList.add('on'); buzz(); try { el.setPointerCapture(e.pointerId); } catch { /* 指がもう離れている */ } };
  const off = () => { input.touchUp(names); el.classList.remove('on'); };
  el.addEventListener('pointerdown', on);
  el.addEventListener('pointerup', off);
  el.addEventListener('pointercancel', off);
  el.addEventListener('lostpointercapture', off);
  el.addEventListener('contextmenu', (e) => e.preventDefault());
}
// 十字キー: 指の位置から向きを決める（ななめも）。押したまま指をすべらせて向きを変えられる
{
  const dp = $('dpad'), parts = { UP: dp.querySelector('.u'), DOWN: dp.querySelector('.d'), LEFT: dp.querySelector('.l'), RIGHT: dp.querySelector('.r') };
  let held = [];
  const set = (e) => {
    const r = dp.getBoundingClientRect();
    const dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
    const now = [];
    if (Math.hypot(dx, dy) > 12) {
      if (dx < -Math.abs(dy) * 0.5) now.push('LEFT');
      if (dx > Math.abs(dy) * 0.5) now.push('RIGHT');
      if (dy < -Math.abs(dx) * 0.5) now.push('UP');
      if (dy > Math.abs(dx) * 0.5) now.push('DOWN');
    }
    const add = now.filter((b) => !held.includes(b));
    input.touchUp(held.filter((b) => !now.includes(b)));
    input.touchDown(add);
    if (add.length) buzz();
    held = now;
    for (const [k, el] of Object.entries(parts)) el.classList.toggle('on', held.includes(k));
  };
  const clear = () => { input.touchUp(held); held = []; for (const el of Object.values(parts)) el.classList.remove('on'); };
  dp.addEventListener('pointerdown', (e) => { e.preventDefault(); try { dp.setPointerCapture(e.pointerId); } catch { /* 指がもう離れている */ } set(e); });
  dp.addEventListener('pointermove', (e) => { if (e.buttons || e.pointerType === 'touch') set(e); });
  dp.addEventListener('pointerup', clear);
  dp.addEventListener('pointercancel', clear);
}

// ---------- 設定 ----------
let pausedBySettings = false;
const settings = initSettings({
  input,
  screen: { get: () => screenMode, set: setScreen, can: !!crt },
  sound: { get: () => soundOn, set: setSound },
  volume: { get: () => volume, set: setVolume },
  vibrate: { get: () => vibrateOn, set: (v) => { vibrateOn = v; save('retro8.vibrate', v ? '1' : '0'); }, can: COARSE && !!navigator.vibrate },
  pause: () => { if (running) { running = false; pausedBySettings = true; audio?.ctx.suspend(); } },
  resume: () => { renderGuide(); if (pausedBySettings) { pausedBySettings = false; running = true; last = 0; acc = 0; audio?.ctx.resume(); requestAnimationFrame(loop); } },
});
$('btnSettings').addEventListener('click', () => settings.open('view'));

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
    input.apply(nes);
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
twoTap($('btnReset'), 'もう一度押すとリセット', () => { if (nes) { saveBattery(); nes.reset(); if (!running) power(); } });
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

shelf.render();
setScreen(screenMode);
route();
