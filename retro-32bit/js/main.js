// ページ: ソフトの札・自分のファイルを開く・1こまずつ回して画面に出す
import { Console32 } from './psx.js';
import { TX, initLang } from './i18n.js';
import { createInput, bindTouch } from './input.js';
import { createAudio } from './audio.js';

// 棚のソフト（あそびラボのオリジナルだけ。PLAN.md 0章）
const DISCS = [
  { id: 'glow-belly', name: TX('ムネエソの腹あかり', 'Glow Belly'), file: 'discs/glow-belly.exe?v=5' },
  { id: 'cube', name: TX('光るキューブ', 'Lit Cube'), file: 'discs/cube.exe?v=4' },
  { id: 'spin-tri', name: TX('回る三角形', 'Spinning Triangle'), file: 'discs/spin-tri.exe?v=1' },
];

const $ = (id) => document.getElementById(id);
const canvas = $('screen'), ctx = canvas.getContext('2d');
const msg = $('msg');
const m = new Console32();
const off = document.createElement('canvas'), offCtx = off.getContext('2d');
let img = null, running = false, paused = false, lastBuf = null, acc = 0, prev = 0;
// 音（8ビット互換機と同じ: 音あり／音なしを覚える。鳴らしはじめは、さわったあと＝ブラウザの決まり）
const read = (k, d) => { try { return localStorage.getItem(k) ?? d; } catch { return d; } };
const save = (k, v) => { try { localStorage.setItem(k, v); } catch { /* 残せなくても遊べる */ } };
let soundOn = read('retro32.sound', '1') === '1', audio = null;
function setSound(on) {
  soundOn = on; save('retro32.sound', on ? '1' : '0');
  $('btnSound').setAttribute('aria-pressed', String(on));
  $('soundLbl').textContent = on ? TX('音あり', 'Sound on') : TX('音なし', 'Muted');
  if (audio) audio.setGain(on ? 0.8 : 0);
}
function startAudio() {
  if (!audio) { audio = createAudio(); if (audio) { m.spu.setRate(audio.ctx.sampleRate); setSound(soundOn); } }
  audio?.ctx.resume();
}

initLang();
const input = createInput();
bindTouch($('pad'), input);

function show(text) { msg.textContent = text; msg.hidden = !text; }

function boot(buf) {
  startAudio();
  try { m.loadExe(buf); if (audio) m.spu.setRate(audio.ctx.sampleRate); } catch (e) { running = false; show(TX('このファイルは動かせません: ', 'Cannot run this file: ') + e.message); return; }
  lastBuf = buf; running = true; acc = 0; setPause(false); show('');
}

function setPause(p) {
  paused = p;
  if (audio) { if (p) audio.ctx.suspend(); else audio.ctx.resume(); }
  const b = $('btnPause');
  b.firstElementChild.textContent = p ? '▶' : '⏸';
  b.setAttribute('aria-label', p ? TX('つづける', 'Resume') : TX('一時停止', 'Pause'));
}

async function insert(d) {
  for (const el of document.querySelectorAll('.disc')) el.setAttribute('aria-pressed', String(el.dataset.id === d.id));
  try { boot(await (await fetch(d.file)).arrayBuffer()); } catch { show(TX('読みこめませんでした', 'Could not load')); }
}

for (const d of DISCS) {
  const b = document.createElement('button');
  b.type = 'button'; b.className = 'disc'; b.dataset.id = d.id; b.setAttribute('aria-pressed', 'false');
  b.innerHTML = '<i aria-hidden="true"></i>';
  b.append(d.name);
  b.addEventListener('click', () => insert(d));
  $('discs').append(b);
}

$('btnOpen').addEventListener('click', () => $('file').click());
$('file').addEventListener('change', async (e) => {
  const f = e.target.files[0]; e.target.value = '';
  if (!f) return;
  if (f.size > 2 * 1024 * 1024 + 2048) { show(TX('大きすぎます（2MB まで）', 'Too large (2 MB max)')); return; }
  for (const el of document.querySelectorAll('.disc')) el.setAttribute('aria-pressed', 'false');
  boot(await f.arrayBuffer()); // この端末の中だけで読む。送らない・残さない
});
$('btnPause').addEventListener('click', () => { if (running) setPause(!paused); });
$('btnSound').addEventListener('click', () => { startAudio(); setSound(!soundOn); });
addEventListener('keydown', () => startAudio(), { once: true });
addEventListener('pointerdown', () => startAudio(), { once: true });
setSound(soundOn);
$('btnReset').addEventListener('click', () => { if (lastBuf) boot(lastBuf); });

// 60 こま／秒で回す（画面の書きかえの速さに関係なく）
function loop(t) {
  requestAnimationFrame(loop);
  if (!running || paused) { prev = t; return; }
  acc += prev ? Math.min(t - prev, 100) : 1000 / 60; prev = t;
  let n = 0;
  try {
    while (acc >= 1000 / 60 && n < 4) { input.apply(m); m.runFrame(); acc -= 1000 / 60; n++; }
  } catch (e) { running = false; show(TX('止まりました: ', 'Stopped: ') + e.message); console.error(e); return; }
  const snd = m.spu.take();
  if (audio && n) audio.push(snd);
  if (n) draw();
}
function draw() {
  const g = m.gpu, w = g.hres, h = g.vres;
  if (!img || img.width !== w || img.height !== h) { off.width = w; off.height = h; img = offCtx.createImageData(w, h); }
  m.display(img.data);
  offCtx.putImageData(img, 0, 0);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(off, 0, 0, canvas.width, canvas.height);
}
requestAnimationFrame(loop);
insert(DISCS[0]);
