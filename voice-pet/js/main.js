// こえのこ（仮）: 画面の流れ。たまご → 声をふきこむ → かえる → なでる・声をかける
import { analyze } from './features.js';
import { makeGenome, express, GENES, FORMS, sourceText } from './genes.js';
import { synthVoice, sylls, sampleVoice, SAMPLES } from './synth.js';
import * as E from './engrave.js';
import * as B from './behave.js';
import * as S from './scene.js';
import * as A from './audio.js';

const q = new URLSearchParams(location.search);
const TEST = q.get('test'); // マイクのかわりに声の見本（low high child breathy rough sing quick）
if (q.has('mute')) A.setMuted(true);
const KEY = 'voicepet.v2'; // v2: 体の型（form）の遺伝子つき
// 見た目（ART.md）: 鉛筆・ふ化したての幼い体つき・顔③・ふさふさ強
E.setStyle('pencil'); E.setJuv(1); E.setFace(3); E.setFur(1);
const MAX_REC = 6;

const cv = document.getElementById('stage'), g2 = cv.getContext('2d');
const $ = id => document.getElementById(id);
const micBtn = $('mic'), hint = $('hint'), ring = $('ring');
let W = 0, H = 0, DPR = 1, L = null, backdrop = null;

// 状態
let mode = 'egg';          // egg | rec | hatch | pet
let gm = null, ph = null, plan = null, st = B.makeSt(), ref = null, shellA = 0;
let recT = 0, recLevel = 0, recPet = false, hatchT = 0, eggWob = 0;
let mouthTrack = null, mouthT = 0;
let pointer = { x: 0, y: 0, down: false, sx: 0, sy: 0, onPet: false, moved: 0 };
let last = performance.now();

function load() {
  try { const s = JSON.parse(localStorage.getItem(KEY) || 'null'); if (s && s.v === 1 && s.genes && s.genes.form) return s; } catch (e) {}
  return null;
}
function save() { try { localStorage.setItem(KEY, JSON.stringify(gm)); } catch (e) {} }

function setCreature(g) {
  gm = g; ph = express(gm); plan = E.PLANS[ph.form]; st = B.makeSt(ph.seed);
  ref = measure(plan, { ...ph, size: 0.5 });
  renderGenes();
}
// 毛色の濃さ: 声が高いほど淡く、低いほど濃く（鉛筆なので色のかわりに）
const coat = () => 0.25 - (ph.lum - 0.36) / 0.38 * 0.45;
// 型ごとの大きさ（大きさの遺伝子がまんなかの子）を、透明の板に描いて測る
const refCache = {};
function measure(pl, p) {
  const k = pl.name + (p.size === 0.5 ? '' : p.seed);
  if (refCache[k]) return refCache[k];
  const c = document.createElement('canvas'); c.width = 500; c.height = 380;
  const g = c.getContext('2d'); g.translate(250, 330);
  E.setCoat(0); pl.draw(g, p, B.makeSt(), 0, 0, {});
  const d = g.getImageData(0, 0, 500, 380).data;
  let top = 380, left = 500, right = 0;
  for (let y = 0; y < 380; y++) for (let x = 0; x < 500; x++) if (d[(y * 500 + x) * 4 + 3] > 30) { if (y < top) top = y; if (x < left) left = x; if (x > right) right = x; }
  return (refCache[k] = { top: top - 330, left: left - 250, right: right - 250 });
}

function resize() {
  DPR = Math.min(2, window.devicePixelRatio || 1);
  W = window.innerWidth; H = window.innerHeight;
  cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR);
  cv.style.width = W + 'px'; cv.style.height = H + 'px';
  L = S.layout(W, H);
  backdrop = document.createElement('canvas'); backdrop.width = Math.round(W * DPR); backdrop.height = Math.round(H * DPR);
  const bg = backdrop.getContext('2d'); bg.scale(DPR, DPR);
  E.plate(bg, W, H); E.ground(bg, W, L.gx, L.gy, L.u); E.nest(bg, L.gx, L.gy - L.u * 0.06, L.u * 1.9, L.u * 0.45, 'back');
  document.body.classList.toggle('wide', L.wide);
}

// 生き物の大きさを画面に合わせる（型ごとに、まんなかの大きさの子が収まる倍率）
const fit = () => Math.min(Math.min(L.u * 3.2, L.gy - 96) / -ref.top, Math.min(L.playW * 0.8, L.u * 3.6) / (ref.right - ref.left));

// ---- 鳴き声 ----
function makeCry(contour, dur, f0) {
  const v = gm.voice;
  const vow = v.front > 0.6 ? 'ieai' : v.front < 0.35 ? 'uoau' : 'aoie';
  const n = Math.max(1, Math.round(dur * Math.min(4, Math.max(1.5, v.rate * 0.6))));
  let text = ''; for (let i = 0; i < n; i++) text += vow[(i * 3 + (gm.genes.seed % 4)) % vow.length];
  const sy = sylls(text, n / dur, dur + 0.15);
  const sr = A.ctx().sampleRate;
  const out = synthVoice({ sr, dur: dur + 0.25, f0: f0 || v.f0, vtl: v.vtl, breath: Math.min(0.7, v.breath * 0.6), rough: v.rough * 0.6, syl: sy, contour, seed: (Math.random() * 1e6) | 0, gain: 0.6 });
  return out;
}
function cry(contour, dur, f0) {
  const { samples, mouth } = makeCry(contour || gm.voice.contour.map(x => x * 0.8), dur || 1.0, f0);
  A.play(samples, A.ctx().sampleRate);
  mouthTrack = mouth; mouthT = 0;
}

// ---- 声をふきこむ ----
let testBuf = null;
async function beginRec() {
  if (mode === 'hatch' || mode === 'rec') return;
  if (!TEST) {
    try { await A.openMic(); }
    catch (e) { say('マイクが使えません。ブラウザの許可を見てください', true); return; }
  } else A.ctx();
  if (!pointerHeld && !keyHeld) return; // 許可を待つあいだにはなした
  recPet = !!gm;
  mode = 'rec'; recT = 0;
  if (TEST) testBuf = sampleVoice(TEST in SAMPLES ? TEST : 'low', A.ctx().sampleRate);
  else A.startRec();
  micBtn.classList.add('on');
  say(recPet ? 'きいてる…' : 'たまごが声をきいています…');
  if (recPet) st.earKick = 1;
}
function endRec() {
  if (mode !== 'rec') return;
  micBtn.classList.remove('on');
  let res;
  if (TEST) res = { samples: testBuf, sr: A.ctx().sampleRate };
  else res = A.stopRec();
  const dur = res.samples.length / res.sr;
  if (!TEST && dur < 0.5) { mode = recPet ? 'pet' : 'egg'; say('ボタンを押したまま話してね'); return; }
  const a = analyze(res.samples, res.sr);
  res.samples = null; // 声そのものはここで手放す
  if (!a.ok) {
    mode = recPet ? 'pet' : 'egg';
    if (recPet) st.puzzled = 1.4;
    say({ quiet: '声が小さいみたい。もうすこし大きく', short: 'もうすこし長く話してね（1秒より長く）', unvoiced: 'ささやきでなく、声を出してみて' }[a.why] || 'もういちど');
    return;
  }
  if (!recPet) {
    mode = 'hatch';
    setCreature(makeGenome(a));
    save(); hatchT = 0; say('');
  } else {
    // まねっこ: 聞いた声の高さと節まわしを、自分の体（声の筒）で
    mode = 'pet';
    const d = Math.max(0.6, Math.min(2.4, a.raw.vDur * 0.9));
    setTimeout(() => { cry(a.contour, d, Math.sqrt(a.raw.f0 * gm.voice.f0)); B.hop(st, 4); st.happy = 1; }, 380);
    say('');
  }
}

// ---- 遺伝子の表 ----
function renderGenes() {
  const box = $('genes'), list = $('geneList');
  if (!gm) { box.hidden = true; return; }
  box.hidden = mode === 'hatch' || mode === 'egg' || mode === 'rec';
  list.innerHTML = '';
  const f = FORMS[ph.form], fli = document.createElement('li');
  fli.className = 'form'; fli.style.setProperty('--d', '0s');
  fli.innerHTML = `<div class="gname">体の型<i class="real" title="本物の手本あり">●</i><b class="fname">${f.name}</b></div><div class="gfrom">${f.why}</div><div class="greal">${f.real}</div>`;
  list.appendChild(fli);
  GENES.filter(g => !g.hidden).forEach((g, i0) => {
    const i = i0 + 1;
    const [a, b] = gm.genes[g.key], m = (a + b) / 2;
    const li = document.createElement('li');
    li.style.setProperty('--d', (i * 0.12) + 's');
    const src = sourceText(gm, g.key);
    li.innerHTML = `<div class="gname">${g.name}${g.real ? '<i class="real" title="本物の手本あり">●</i>' : ''}</div>
      <div class="bar"><span class="fill" style="width:${(m * 100).toFixed(0)}%"></span><span class="al" style="left:${(a * 100).toFixed(0)}%"></span><span class="al" style="left:${(b * 100).toFixed(0)}%"></span></div>
      <div class="gfrom">${g.from}${src ? `<b>${src}</b>` : ''}</div>`;
    list.appendChild(li);
  });
}

function say(t, warn) { hint.textContent = t; hint.classList.toggle('warn', !!warn); hint.classList.toggle('show', !!t); }

// ---- 入力 ----
let pointerHeld = false, keyHeld = false;
micBtn.addEventListener('pointerdown', e => { e.preventDefault(); pointerHeld = true; micBtn.setPointerCapture?.(e.pointerId); beginRec(); });
const upMic = () => { if (!pointerHeld) return; pointerHeld = false; endRec(); };
micBtn.addEventListener('pointerup', upMic); micBtn.addEventListener('pointercancel', upMic);
addEventListener('keydown', e => { if (e.code === 'Space' && !e.repeat && !e.target.closest('button,dialog')) { e.preventDefault(); keyHeld = true; beginRec(); } });
addEventListener('keyup', e => { if (e.code === 'Space') { keyHeld = false; endRec(); } });
addEventListener('blur', () => { pointerHeld = keyHeld = false; endRec(); });
document.addEventListener('visibilitychange', () => { if (document.hidden) { pointerHeld = keyHeld = false; endRec(); A.closeMic(); } });

let lastBox = null;
const onCreature = (x, y) => lastBox && Math.hypot((x - lastBox.cx) / (lastBox.ax * 1.1), (y - lastBox.cy) / (lastBox.R * 1.1)) < 1;
cv.addEventListener('pointerdown', e => {
  pointer.down = true; pointer.sx = e.clientX; pointer.sy = e.clientY; pointer.moved = 0;
  pointer.onPet = mode === 'pet' && onCreature(e.clientX, e.clientY);
});
cv.addEventListener('pointermove', e => {
  if (pointer.down) pointer.moved += Math.hypot(e.clientX - pointer.x, e.clientY - pointer.y);
  pointer.x = e.clientX; pointer.y = e.clientY;
  if (pointer.down && pointer.onPet && pointer.moved > 10 && onCreature(e.clientX, e.clientY)) { st.pet = Math.min(1.5, st.pet + 0.08); petAmount += 0.03; }
});
let petAmount = 0;
cv.addEventListener('pointerup', e => {
  if (pointer.onPet && pointer.moved < 10) { B.hop(st, 5); st.earKick = 1; cry(null, 0.7); }
  else if (pointer.onPet && petAmount > 0.8) { st.happy = 1; cry(gm.voice.contour.map(x => -Math.abs(x) * 0.5), 1.1); }
  pointer.down = false; pointer.onPet = false; petAmount = 0;
});
cv.addEventListener('pointerleave', () => { pointer.down = false; });

$('again').addEventListener('click', () => $('bye').showModal());
$('byeNo').addEventListener('click', () => $('bye').close());
$('byeYes').addEventListener('click', () => {
  $('bye').close();
  gm = null; ph = null; mode = 'egg'; renderGenes();
  try { localStorage.removeItem(KEY); } catch (e) {}
  say('ボタンを押しながら、声をふきこんでね');
});
$('sound').addEventListener('click', () => { A.setMuted(!A.muted); $('sound').setAttribute('aria-pressed', String(!A.muted)); $('sound').classList.toggle('off', A.muted); });
$('genesToggle').addEventListener('click', () => document.body.classList.toggle('genesOpen'));

// ---- まいこま ----
let clock = 0;
function frame(now) {
  tick(Math.min(0.05, (now - last) / 1000)); last = now;
  requestAnimationFrame(frame);
}
function tick(dt) {
  clock += dt;
  const ctx = g2;
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  ctx.drawImage(backdrop, 0, 0, W, H);

  // 声の大きさ
  let lv = 0;
  if (mode === 'rec') {
    recT += dt;
    if (TEST) { const i = Math.floor(recT * A.ctx().sampleRate) % testBuf.length; let s = 0; for (let k = 0; k < 512; k++) s += Math.abs(testBuf[(i + k) % testBuf.length]); lv = s / 512 * 3; }
    else lv = A.micLevel() * 6;
    if (recT > MAX_REC) { pointerHeld = keyHeld = false; endRec(); }
  }
  recLevel += (Math.min(1, lv) - recLevel) * (1 - Math.exp(-dt * 18));
  ring.style.setProperty('--p', mode === 'rec' ? Math.min(1, recT / MAX_REC) : 0);
  ring.style.setProperty('--lv', recLevel.toFixed(3));

  const gx = L.gx, gy = L.gy;
  if (mode === 'egg' || (mode === 'rec' && !recPet)) {
    eggWob = Math.sin(clock * 9) * recLevel * 0.08 + Math.sin(clock * 0.9) * 0.015;
    E.setCoat(0); E.egg(ctx, gx, gy, L.u, clock, mode === 'rec' ? recLevel : 0, eggWob, 0);
  } else if (mode === 'hatch') {
    hatchT += dt;
    const c = Math.min(1, hatchT / 1.3);
    if (hatchT < 1.35) {
      const shake = Math.sin(hatchT * 40) * 0.07 * c;
      E.setCoat(0); E.egg(ctx, gx, gy, L.u, clock, 0.4 + c * 0.6, shake, c);
      for (const at of [0.35, 0.8, 1.2]) if (hatchT - dt < at && hatchT >= at) A.blip('crack');
    } else {
      if (hatchT - dt < 1.35) { A.blip('pop'); st.scale = 0.35; B.hop(st, 8); shellA = 1; }
      st.scale += (1 - st.scale) * (1 - Math.exp(-dt * 7));
      if (hatchT - dt < 2.0 && hatchT >= 2.0) cry(null, 1.2);
      if (hatchT > 2.6) { mode = 'pet'; document.body.classList.add('hatched'); renderGenes(); say('なでたり、つついたり、声をかけたりしてみて'); setTimeout(() => mode === 'pet' && hint.textContent.startsWith('なでたり') && say(''), 6000); }
    }
  }
  if (ph && mode !== 'egg' && !(mode === 'rec' && !recPet) && !(mode === 'hatch' && hatchT < 1.35)) {
    // 口
    let m = 0;
    if (mouthTrack) {
      mouthT += dt; const i = Math.floor(mouthT * 60);
      m = i < mouthTrack.length ? mouthTrack[i] : 0;
      if (i >= mouthTrack.length) mouthTrack = null;
    }
    B.step(st, dt, ph, { listening: mode === 'rec', level: recLevel, mouth: m });
    if (st.scale === undefined) st.scale = 1;
    st.scale += (1 - st.scale) * (1 - Math.exp(-dt * 7));
    const sc = fit() * st.scale, oy = gy - st.hop * L.u * 0.35;
    ctx.save(); ctx.translate(gx, oy); ctx.scale(sc, sc);
    E.setCoat(coat()); plan.draw(ctx, ph, st, 0, 0, {});
    ctx.restore();
    const bx = gx + ref.left * sc - 8, bw = (ref.right - ref.left) * sc + 16, by = oy + ref.top * sc * 1.15 - 8, bh = -ref.top * sc * 1.15 + 16;
    E.grain(ctx, bx, by, bw, bh);
    lastBox = { cx: gx + (ref.left + ref.right) / 2 * sc, cy: oy + ref.top * sc / 2, ax: (ref.right - ref.left) / 2 * sc, R: -ref.top * sc / 2 };
    if (shellA > 0) { E.shell(ctx, gx, gy, L.u, shellA); shellA -= dt * 0.25; }
  } else if (mode === 'egg' || mode === 'rec' || mode === 'hatch') E.grain(ctx, gx - L.u, gy - L.u * 2.2, L.u * 2, L.u * 2.4);
  E.nest(ctx, gx, gy - L.u * 0.06, L.u * 1.9, L.u * 0.45, 'front');
}

// ---- はじめ ----
resize();
addEventListener('resize', resize);
const saved = load();
if (saved) { mode = 'pet'; setCreature(saved); document.body.classList.add('hatched'); say(''); }
else say('ボタンを押しながら、声をふきこんでね');
requestAnimationFrame(frame);

// 確かめ用（tools から呼ぶ）
window.__vp = {
  get mode() { return mode; }, get layout() { return L; }, get box() { return lastBox; }, get st() { return st; }, get mouthOn() { return !!mouthTrack; }, get gm() { return gm; }, get ph() { return ph; },
  hatch(name) { const sr = 48000, a = analyze(sampleVoice(name, sr), sr); if (!a.ok) return a; mode = 'hatch'; setCreature(makeGenome(a, 12345)); hatchT = 0; return a; },
  advance(sec) { for (let t = 0; t < sec; t += 1 / 60) tick(1 / 60); },
  skip() { if (mode === 'hatch') { hatchT = 2.7; st.scale = 1; } },
  form() { return FORMS[ph.form].name; },
};
