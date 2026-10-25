// 棚（トップ）と遊ぶ画面。画面・音・入力・セーブをつなぐ（ブラウザの係）
import { Console8, BTN } from './nes.js';
import { LIBRARY } from './library.js?v=15';
import { createCRT } from './crt/crt-gl.js';
import { createInput, keyLabel } from './input.js';
import { initSettings } from './settings.js';
import { initShelf } from './shelf.js?v=23';
import { TX, initLang, setRomLang } from './i18n.js';

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
// 棚の手ざわりの音（sfx/。Stable Audio で作って、カチッが1つだけの所を切り出した）。設定の音と大きさにしたがう。
// 音は動きの説得力をそっと足すだけ（主役にしない。v015 ユーザー）。入れる: ケースを開ける（うすいプラスチック）→ 溝で シャッ → 底で カチャッ1回 →
// ケースを閉める → 電源。もどる: 電源を切る → シャッ（少し速く）→ ケースを開ける → 閉める。高い音を少し落として（ローパス 5kHz）小さく
const SFX = { caseOpen: ['case_open', 0.16], caseClose: ['case_close', 0.14], slide: ['slide', 0.22], click: ['click', 0.3], out: ['slide', 0.18, 1.15], sw: ['power', 0.16] };
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
    // はじめて鳴らすときに、ほかの音もまとめて用意しておく（次から遅れない）
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
// 棚（くわしくは shelf.js）
initLang();
const shelf = initShelf({ library: LIBRARY, loadRom, open: (e) => openEntry(e, true), boot: bootEntry, powerOff, sfx: { clack } });

// ---------- 部屋（3D。js/room3d.js。案A: トップの上半分・案C: 遊ぶ画面の「部屋で遊ぶ」） ----------
// WebGL2 がない・動きを減らす設定 では使わない（トップは 2D の本体のまま）
let room = null, roomPlay = read('retro8.roomPlay', '0') === '1';
const ROOM_OK = !matchMedia('(prefers-reduced-motion: reduce)').matches && (() => { try { return !!document.createElement('canvas').getContext('webgl2'); } catch { return false; } })();
if (ROOM_OK) {
  import('./room3d.js?v=7').then((m) => {
    room = m.createRoom();
    $('roombox').hidden = false; $('conbox').hidden = true;
    room.attach($('roombox'), 'shelf');
    $('roombox').append(ghost);
    shelf.useRoom(room);
    // テレビか本体を押す: 電源が入っていれば、テレビ＝続きから・本体＝電源を切る。切れていれば電源を入れる（v023）
    room.canPick = () => !!shelf.seated && !shelf.busy && $('player').hidden;
    room.onPick = (w) => {
      if (!shelf.powered) shelf.power(true);
      else if (w === 'con') shelf.power(false);
      else if (nes && current) room.focusTV(true, 650).then(() => openEntry(current, true));
    };
    $('btnRoom').hidden = false; $('btnRoom').setAttribute('aria-pressed', String(roomPlay));
    if (current && roomPlay) setRoomPlay(true);
  }).catch((e) => { console.warn('room', e); document.documentElement.classList.remove('room3d'); });
} else document.documentElement.classList.remove('room3d');   // 2D の本体にもどす
// 遊ぶ画面で: 部屋のテレビで遊ぶ（ふつうの画面は隠す）／ふつうの画面にもどす
function setRoomPlay(on) {
  roomPlay = on; save('retro8.roomPlay', on ? '1' : '0');
  $('btnRoom').setAttribute('aria-pressed', String(on));
  if (!room) return;
  $('bezel').hidden = on; $('stage').classList.toggle('roomon', on);
  if (on) { room.attach($('stage'), 'play'); room.setPower(true); if (nes) room.show(nes.ppu.frame); }
  else { room.attach($('roombox'), 'shelf'); fit(); if (nes) draw(); }
}
$('btnRoom').addEventListener('click', () => setRoomPlay(!roomPlay));

// ---------- 棚 ⇄ 遊ぶ画面（部屋のとき） ----------
// テレビの画面の上に見えない四角（ghost）を置き、遊ぶ画面の画面と同じ名前にする。View Transitions で、テレビの画面が遊ぶ画面の画面へのびる（もどるときは縮む）。
// 使えないブラウザ・部屋がないときは、そのまま入れかえる
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

// ---------- 部屋で電源を入れたとき: 棚のまま本体を動かし、テレビに映す（そのまま遊ぶ画面へ続く） ----------
async function bootEntry(e) {
  stopPlayer();
  current = e;
  let bytes;
  try { bytes = e.bytes || await loadRom(e); } catch { return; }
  if (current !== e || nes) return;
  nes = new Console8(bytes, audio ? audio.ctx.sampleRate : 48000);
  loadBattery();
  setRomLang(nes);
  power();
}
// 本体の電源が切れた（棚で）: 止めて、テレビは消える（room.setPower）
function powerOff() {
  if (!$('player').hidden) return;
  stopPlayer();
  current = null;
}

// ---------- 遊ぶ画面へ ----------
async function openEntry(e, gesture) {
  const cont = !!nes && current === e;   // 部屋で電源が入っている（入れたところ・棚へもどっていた）→ そのまま続ける
  if (!cont) { stopPlayer(); current = e; }
  await swap(async () => {
    $('shelf').hidden = true;
    $('player').hidden = false;
    $('cartName').textContent = e.title;
    guideKeys = e.keys?.length ? e.keys : [['PAD', ''], ['A', ''], ['B', ''], ['START', ''], ['SELECT', '']];
    renderGuide();
    document.body.classList.add('playing');
    fit();
    if (cont) { if (room && roomPlay) setRoomPlay(true); else { draw(); await upTo(drawn(), 200); } }
  });
  if (e.id && location.hash !== '#' + e.id) history.pushState({ retro8: 1 }, '', '#' + e.id);   // 棚から開いた印（もどるときに1つ戻す）
  if (cont) { if (!running) power(); return; }
  let bytes;
  try { bytes = e.bytes || await loadRom(e); } catch { backToShelf(); return; }
  nes = new Console8(bytes, audio ? audio.ctx.sampleRate : 48000);
  loadBattery();
  setRomLang(nes); // ソフトのことば（かな／英語）は、このページのことばに合わせる
  if (room && roomPlay) setRoomPlay(true);
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
  // 遊ぶ画面の画面に前のソフトの絵を残さない（つぎの絵が描けるまで見せない）
  canvas.style.visibility = glCanvas.style.visibility = 'hidden';
}
// 遊ぶ画面の #id を消す（v026。ユーザー「履歴がすごい数になる。トップに戻るのが大変」）。
// 棚から開いたとき（pushState した）はブラウザの履歴を1つ戻すだけ＝履歴はふえない（popstate の route がもう一度 backToShelf を呼ぶ）。
// #id つきで直接ひらいたときは、その履歴を書きかえる
function leaveHash() {
  if (!location.hash) return false;
  if (history.state?.retro8) { history.back(); return true; }
  history.replaceState(null, '', location.pathname + location.search);
  return false;
}
async function backToShelf() {
  if (leaveHash()) return;
  if (room && nes && !$('player').hidden) {
    // 部屋: 電源は入れたまま、テレビに止めた絵を映しておく（v023。本体を押して電源を切ると消える）
    saveBattery(); running = false; audio?.ctx.suspend();
    const frame = nes.ppu.frame;
    await swap(async () => {
      $('bezel').hidden = false; $('stage').classList.remove('roomon');
      $('player').hidden = true; $('shelf').hidden = false;
      document.body.classList.remove('playing');
      room.attach($('roombox'), 'shelf'); room.focusTV(true, 0);
      await upTo(room.show(frame), 200);
    });
    await room.focusTV(false, 800);
    // ひと呼吸おいて、電源を切ってカセットをケースへ（v024。ユーザー「ワンテンポおいて」）。そのあいだにテレビを押せば続きから
    await new Promise((ok) => setTimeout(ok, 600));
    if ($('player').hidden && nes && !shelf.busy) shelf.back();
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
// ← とリセットは1回で効く（2026-10-25 ユーザー「2回押さないと効かないのはストレス」。棚へもどるときもセーブは残す）
$('btnBack').addEventListener('click', backToShelf);
function route() {
  const id = location.hash.slice(1);
  const e = LIBRARY.find((x) => x.id === id);
  if (e) { if (current !== e) openEntry(e, false); else if ($('player').hidden) openEntry(e, true); }
  else if (current && !$('player').hidden) backToShelf();
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
  if ($('player').hidden || (room && roomPlay)) return;
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
// はじめは ブラウン管・RGB（v024。ユーザー。PC もスマホも。メニューで変えられる）。
// 前は起動のたびに `retro8.screen` へ書いていて、選んだのかどうか分からないので、メニューで選んだときだけ `retro8.screenMode` に残す
let screenMode = read('retro8.screenMode', 'rgb');
try { crt = createCRT(glCanvas); } catch { crt = null; }
if (crt) {
  crt.setPicture({ w: 256, h: 240, data: new Uint8Array(256 * 240 * 4) });
  try {
    worker = new Worker(new URL('./crt/worker.js', import.meta.url), { type: 'module' });
    worker.onmessage = (e) => {
      busy = false;
      if (screenMode === 'lcd') return;
      crt.setSignal(e.data.sig, 1024, 240, 256, 240, e.data.glow || false);
      crtDraw(); shown();
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
  if (room && (roomPlay || $('player').hidden)) { room.show(nes.ppu.frame); return; }   // 部屋のテレビに映す（棚にいるあいだも）
  if (screenMode === 'lcd') { px.set(nes.ppu.frame); g.putImageData(img, 0, 0); shown(); return; }
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
  crtDraw(); shown();
}
// 遊ぶ画面の画面に絵が描けた
let drawnWaiters = [];
function shown() { canvas.style.visibility = glCanvas.style.visibility = ''; const w = drawnWaiters; drawnWaiters = []; for (const f of w) f(); }
const drawn = () => new Promise((ok) => drawnWaiters.push(ok));
function setScreen(mode, chosen) {
  if (!crt && mode !== 'lcd') return;
  screenMode = mode; if (chosen) save('retro8.screenMode', mode); glowTick = 0;
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
  $('soundLbl').textContent = on ? TX('音あり', 'Sound on') : TX('音なし', 'Muted');
  if (audio) audio.gain.gain.value = on ? volume : 0;
}
function setVolume(v) {
  volume = v; save('retro8.volume', String(v));
  if (audio) audio.gain.gain.value = soundOn ? v : 0;
}
setSound(soundOn);

// ---------- 入力（キー・指・ゲームパッド。くわしくは input.js） ----------
const input = createInput();
input.onPress = (p, b) => { if (!running && nes && !$('player').hidden && (b === 'START' || b === 'A')) power(); };
// キーの案内: コントローラーのボタン → いまの割り当てのキー → すること
let guideKeys = [];
const BUTTON_LABEL = { PAD: TX('十字キー', 'D-pad'), A: 'A', B: 'B', START: 'START', SELECT: 'SELECT' };
function renderGuide() {
  const k = input.keys.p1, first = (b) => (k[b][0] ? keyLabel(k[b][0]) : '—');
  $('keys').innerHTML = guideKeys.map(([btn, what]) => {
    const codes = btn === 'PAD' ? ['UP', 'DOWN', 'LEFT', 'RIGHT'].map(first) : k[btn].slice(0, 2).map(keyLabel);
    const kb = (codes.length ? codes : ['—']).map((x) => `<kbd>${x}</kbd>`).join('');
    if (btn === 'PAD') return `<span>${kb}<em>${what}</em></span>`;
    const face = btn === 'A' || btn === 'B' ? `<b class="face">${btn}</b>` : `<b class="face word">${BUTTON_LABEL[btn]}</b>`;
    return `<span>${face}<i>＝</i>${kb}<em>${what}</em></span>`;
  }).join('') + `<button class="keyedit" id="keyEdit">${TX('キーを変える', 'Change keys')}</button>`;
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
  screen: { get: () => screenMode, set: (m) => setScreen(m, true), can: !!crt },
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
window.__retro8 = { stats, get mode() { return screenMode; }, setScreen: (m) => setScreen(m), get nes() { return nes; }, get room() { return room; } };
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
$('btnReset').addEventListener('click', () => { if (nes) { saveBattery(); nes.reset(); if (!running) power(); } });
$('btnFull').addEventListener('click', () => {
  if (document.fullscreenElement) document.exitFullscreen();
  else document.documentElement.requestFullscreen?.().catch(() => {});
});
document.addEventListener('fullscreenchange', () => setTimeout(fit, 50));

// 遊んでいるあいだ: 画面を暗くしない（使えるブラウザだけ）・iOS の指2本の拡大をしない・長押しのメニューを出さない
let wake = null;
function keepAwake(on) {
  if (on) { if (!wake && navigator.wakeLock) navigator.wakeLock.request('screen').then((w) => { wake = w; w.addEventListener('release', () => { wake = null; }); }).catch(() => {}); }
  else { wake?.release().catch(() => {}); wake = null; }
}
new MutationObserver(() => keepAwake(document.body.classList.contains('playing') && !document.hidden)).observe(document.body, { attributes: true, attributeFilter: ['class'] });
for (const t of ['gesturestart', 'gesturechange']) document.addEventListener(t, (e) => { if (document.body.classList.contains('playing')) e.preventDefault(); }, { passive: false });
$('player').addEventListener('contextmenu', (e) => { if (!e.target.closest('input,textarea')) e.preventDefault(); });

// タブを離れたら止め、もどったら続ける
document.addEventListener('visibilitychange', () => {
  if (!nes || !$('power').hidden || $('player').hidden) return;   // 棚で止めているあいだは、もどっても動かさない
  if (document.hidden) { saveBattery(); running = false; audio?.ctx.suspend(); }
  else { running = true; last = 0; acc = 0; audio?.ctx.resume(); requestAnimationFrame(loop); keepAwake(true); }
});

shelf.render();
setScreen(screenMode);
route();
