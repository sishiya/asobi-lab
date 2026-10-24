// 画面・音・入力をつなぐ（ブラウザの係）
import { Console8, BTN } from './nes.js';

const ROM = 'roms/frog-night.nes?v=1';
const FRAME_MS = 1000 / 60.0988;
const $ = (id) => document.getElementById(id);

const canvas = $('screen'), g = canvas.getContext('2d');
const img = g.createImageData(256, 240), px = new Uint32Array(img.data.buffer);
let nes = null, running = false, audio = null;
let soundOn = read('retro8.sound', '1') === '1';

function read(k, d) { try { return localStorage.getItem(k) ?? d; } catch { return d; } }
function save(k, v) { try { localStorage.setItem(k, v); } catch { /* 保存できなくても遊べる */ } }

// ---------- 画面の大きさ（なるべく整数倍で、ドットをそろえる） ----------
function fit() {
  const stage = $('stage'), bez = $('bezel');
  const pad = parseFloat(getComputedStyle(bez).paddingLeft) * 2;
  const w = stage.clientWidth - pad, h = stage.clientHeight - pad - 8;
  let s = Math.max(1, Math.min(w / 256, h / 240));
  if (Math.floor(s) >= s * 0.8) s = Math.floor(s);
  canvas.style.width = Math.round(256 * s) + 'px';
  canvas.style.height = Math.round(240 * s) + 'px';
}
addEventListener('resize', fit);
fit();

function draw() { px.set(nes.ppu.frame); g.putImageData(img, 0, 0); }

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
  if (!b) return;
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
    dpadHeld.clear();
    if (Math.hypot(dx, dy) > 12) {
      if (dx < -Math.abs(dy) * 0.5) dpadHeld.add('LEFT');
      if (dx > Math.abs(dy) * 0.5) dpadHeld.add('RIGHT');
      if (dy < -Math.abs(dx) * 0.5) dpadHeld.add('UP');
      if (dy > Math.abs(dx) * 0.5) dpadHeld.add('DOWN');
    }
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
let acc = 0, last = 0;
function loop(t) {
  if (!running) return;
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
  }
  if (n) draw();
  requestAnimationFrame(loop);
}

async function boot() {
  const bytes = new Uint8Array(await (await fetch(ROM)).arrayBuffer());
  nes = new Console8(bytes, 48000);
  // 電源を入れる前の画面: タイトルまで音なしで進めて、うすく見せる
  for (let i = 0; i < 70; i++) nes.runFrame();
  nes.apu.take();
  draw();
  canvas.style.opacity = '.45';
}
const booted = boot();

async function power() {
  if (running) return;
  running = true;
  $('power').hidden = true;
  canvas.style.opacity = '';
  if (!audio) { audio = setupAudio(); if (audio) nes.apu.setRate(audio.ctx.sampleRate); }
  audio?.ctx.resume();
  await booted;
  if (audio) nes.apu.setRate(audio.ctx.sampleRate);
  last = 0; acc = 0;
  requestAnimationFrame(loop);
}
$('power').addEventListener('click', power);
$('btnSound').addEventListener('click', () => setSound(!soundOn));
$('btnReset').addEventListener('click', () => { if (nes) { nes.reset(); if (!running) power(); } });
$('btnFull').addEventListener('click', () => {
  if (document.fullscreenElement) document.exitFullscreen();
  else document.documentElement.requestFullscreen?.().catch(() => {});
});
document.addEventListener('fullscreenchange', () => setTimeout(fit, 50));

// タブを離れたら止め、もどったら続ける
document.addEventListener('visibilitychange', () => {
  if (!nes || !$('power').hidden) return;
  if (document.hidden) { running = false; audio?.ctx.suspend(); }
  else { running = true; last = 0; acc = 0; audio?.ctx.resume(); requestAnimationFrame(loop); }
});
