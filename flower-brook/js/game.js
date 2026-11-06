// 花の小川 段階A2 の画面: 3D の世界（js/world3d.js）・指・タイトル・教える順・おわり・庭。決まりは js/sim.js。
// 手: 指を置いた位置で決める（左右＝寄る岸、高さ＝速さ。上ほど速い）。はなすと、その場でとどまる。
// キー: ←→ 岸、↑↓ 速さ、スペース（押しているあいだ）進む、Esc 止める。?seed=<番号> で川を選ぶ。
import { RULE, newState, step, gradeOf, bloomOf } from './sim.js';
import { makeWorld } from './world3d.js';
import { GRADE_NAME, drawGradeFlower } from './flowers.js';
import * as A from './audio.js';

const $ = id => document.getElementById(id);
const VER = 'ver. 0.2';
const world = makeWorld($('stage'));
const q = new URLSearchParams(location.search);
let seed = +(q.get('seed') || 1 + Math.floor(Math.random() * 9999));
let S = newState(seed), mode = 'title', acc = 0, last = performance.now(), logAt = 0, endAt = 0;
world.setCourse(S);

// ---------- 保存（端末の中だけ） ----------
const store = {
  get(k, d) { try { const v = localStorage.getItem('flowerBrook.' + k); return v === null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem('flowerBrook.' + k, JSON.stringify(v)); } catch {} },
};
let garden = store.get('garden', []);
let tut = store.get('tut', 0);             // 教える順: 0〜3（3 で終わり）
A.setSound(store.get('sound', true));

// ---------- 入力 ----------
const input = { hold: false, u: 0.5, x: 0 };
const keys = new Set();
let pointerId = null;
const ring = $('ring');
function fromPointer(e) {
  const W = innerWidth, H = innerHeight;
  input.x = Math.max(-1, Math.min(1, (e.clientX - W / 2) / (W * 0.32)));
  input.u = Math.max(0, Math.min(1, (H * 0.92 - e.clientY) / (H * 0.8)));
  ring.style.transform = `translate(${e.clientX}px, ${e.clientY}px)`;
  ring.style.setProperty('--u', input.u.toFixed(2));
}
const stage = $('stage');
stage.addEventListener('pointerdown', e => {
  if (mode !== 'play') return;
  A.startAudio();
  pointerId = e.pointerId; try { stage.setPointerCapture(e.pointerId); } catch {}
  input.hold = true; fromPointer(e); ring.hidden = false;
});
stage.addEventListener('pointermove', e => { if (e.pointerId === pointerId) fromPointer(e); });
const up = e => { if (e.pointerId === pointerId) { pointerId = null; input.hold = false; ring.hidden = true; } };
stage.addEventListener('pointerup', up); stage.addEventListener('pointercancel', up);
addEventListener('keydown', e => {
  keys.add(e.key);
  if (e.key === ' ') e.preventDefault();
  if (e.key === 'Escape' && (mode === 'play' || mode === 'pause')) togglePause();
  if (mode === 'play') A.startAudio();
});
addEventListener('keyup', e => keys.delete(e.key));
function keyInput(dt) {
  if (!keys.size) return;
  if (keys.has('ArrowLeft')) input.x = Math.max(-1, input.x - 1.6 * dt);
  if (keys.has('ArrowRight')) input.x = Math.min(1, input.x + 1.6 * dt);
  if (keys.has('ArrowUp')) input.u = Math.min(1, input.u + 0.8 * dt);
  if (keys.has('ArrowDown')) input.u = Math.max(0, input.u - 0.8 * dt);
  if (pointerId === null) input.hold = keys.has(' ');
}

// ---------- 画面の切りかえ ----------
function show(id, on) { $(id).hidden = !on; }
function toTitle() {
  mode = 'title'; show('title', true); show('result', false); show('menu', false); show('hud', false);
  drawGarden($('garden'), 22);
  $('gardenCount').textContent = garden.length ? `庭に咲いた花 ${garden.length}　（${new Set(garden.map(f => f.g)).size} 種類）` : '';
}
function start(sd) {
  seed = sd; S = newState(seed); world.setCourse(S); logAt = 0; acc = 0;
  input.hold = false; input.u = 0.5; input.x = 0;
  mode = 'play'; show('title', false); show('result', false); show('menu', false); show('hud', true);
  toastT = 0; hintStep = tut < 3 ? Math.max(1, tut + 1) : 0; hintT = 0; setHint();
}
function togglePause() {
  if (mode === 'play') { mode = 'pause'; show('menu', true); $('soundBtn').textContent = `音: ${A.soundOn() ? 'あり' : 'なし'}`; }
  else if (mode === 'pause') { mode = 'play'; show('menu', false); }
}
$('startBtn').onclick = () => { A.startAudio(); start(1 + Math.floor(Math.random() * 9999)); };
$('pauseBtn').onclick = togglePause;
$('resumeBtn').onclick = togglePause;
$('titleBtn').onclick = toTitle;
$('soundBtn').onclick = () => { A.setSound(!A.soundOn()); store.set('sound', A.soundOn()); $('soundBtn').textContent = `音: ${A.soundOn() ? 'あり' : 'なし'}`; };
$('againBtn').onclick = () => start(1 + Math.floor(Math.random() * 9999));
$('sameBtn').onclick = () => start(seed);
$('resTitleBtn').onclick = toTitle;
$('ver').textContent = VER;

// ---------- 教える順（1つずつ。PLAN.md の手ざわり） ----------
let hintStep = 0, hintT = 0;
const HINTS = ['', '指を置くと流れに乗って進む（上ほど速い）', '指をはなすと止まる。岸に寄ると、花が水を飲んで咲く', '乾いたしずくは、花のアーチでちぎれる'];
function setHint() { if (toastT > 0) return; $('hint').classList.remove('alert'); $('hint').textContent = HINTS[hintStep] || ''; $('hint').hidden = !hintStep; }
function hints(dt, bloomedNow) {
  if (!hintStep) return;
  hintT += dt;
  const lead = S.beads[0].s, arch0 = S.course.arches[0].s;
  const next = hintStep === 1 ? lead > 420 :
    hintStep === 2 ? (bloomCount > 6 && hintT > 4) || hintT > 22 :
    hintT > 6 && lead > arch0 + 40;
  if (toastT > 0) return;   // 知らせが出ているあいだは待つ（1行に1つ）
  if (hintStep === 3 && lead < arch0 - 260) { $('hint').hidden = true; hintT = 0; return; }   // 3つ目は最初のアーチが見えてから
  if (hintStep === 3) setHint();
  if (next) { tut = hintStep; store.set('tut', tut); hintStep = hintStep < 3 ? hintStep + 1 : 0; hintT = 0; setHint(); }
}

// ---------- できごと（音と、短い知らせ） ----------
let bloomCount = 0, toastT = 0;
// 知らせ: 教えることばと同じ1行を借りる（一度に1つ。RULES 4章）
function toast(t, sec = 2.5) { const h = $('hint'); h.textContent = t; h.classList.add('alert'); h.hidden = false; toastT = sec; }
function events() {
  for (; logAt < S.log.length; logAt++) {
    const e = S.log[logAt];
    if (e.ev === 'break') A.sBreak();
    else if (e.ev === 'clump') A.sClump();
    else if (e.ev === 'fiber') A.sFiber();
    else if (e.ev === 'thunder') { A.sThunder(); toast(e.kind === 'squeeze' ? '雷　アーチが強く締まる' : '雷　流れが急に', 4); }
    else if (e.ev === 'ride') { A.sWave(true); toast('大きな流れに乗った！'); }
    else if (e.ev === 'wave-miss') A.sWave(false);
  }
  const wv = S.course.waves.find(w => w.front !== null && !w.used);
  if (wv && S.beads[0].s - wv.front < 260 && toastT <= 0.2) toast('大きな流れ！　指を上へ', 0.4);
}

// ---------- 庭（咲いた花の列） ----------
function drawGarden(c, n) {
  const g = c.getContext('2d'), dpr = Math.min(2, devicePixelRatio || 1), w = c.clientWidth, h = c.clientHeight;
  c.width = w * dpr; c.height = h * dpr; g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, w, h);
  const list = garden.slice(-n), slot = w / Math.max(list.length, 6), r = Math.min(h * 0.42, slot * 0.82 / 1.1), x0 = (w - slot * list.length) / 2;
  list.forEach((f, i) => drawGradeFlower(g, f.g, x0 + (i + 0.5) * slot, h * 0.5 + (i % 2 ? r * 0.12 : -r * 0.12), r, 1, i + 1));
}

// ---------- おわり ----------
function rareStretches() {
  const rs = S.course.patches.filter(p => p.rare), all = Math.ceil(rs.length / 2);
  let got = 0; for (let i = 0; i < rs.length; i += 2) if (rs.slice(i, i + 2).some(p => p.drunk >= RULE.patch.rareBloom)) got++;
  return { got, all };
}
function finish() {
  mode = 'end'; endAt = performance.now();
  world.finish(S.grade); A.sFinish(S.grade);
  input.hold = false; ring.hidden = true; $('hint').hidden = true; toastT = 0;
  const r = rareStretches();
  garden.push({ g: S.grade, r: r.got }); garden = garden.slice(-200); store.set('garden', garden);
  setTimeout(() => {
    if (mode !== 'end') return;
    $('resName').textContent = GRADE_NAME[S.grade];
    $('resRare').textContent = `めずらしい花　${r.got} / ${r.all}`;
    show('result', true); show('hud', false);
  }, 4600);   // 池で花が咲いて、花びらがふき出すのを見てから
}

// ---------- まわす ----------
function frame(now) {
  const dt = Math.min(0.1, (now - last) / 1000); last = now;
  keyInput(dt);
  if (thumbBot) { Object.assign(input, thumbBot(S)); toastT = 0; $('hint').hidden = true; }
  if (mode === 'play') {
    acc += dt;
    while (acc >= RULE.dt && !S.done) { step(S, input); acc -= RULE.dt; }
    events();
    if (S.done) finish();
  }
  const out = world.update(S, dt, { showPred: mode === 'play' && tut >= 2, grade: gradeOf(S) }) || {};
  if (out.bloomed) { bloomCount += out.bloomed; for (let i = 0; i < Math.min(2, out.bloomed); i++) A.sBloom(out.rareBloomed > 0); }
  if (mode === 'play' && !thumbBot) {
    hints(dt, out.bloomed);
    const r = rareStretches(); $('rare').textContent = `${r.got} / ${r.all}`;
    if (toastT > 0) { toastT -= dt; if (toastT <= 0) { $('hint').hidden = true; setHint(); } }
  }
  requestAnimationFrame(frame);
}
// サムネイル（?thumb。tools/thumb.html が撮る）: 13番の小川の 51 秒目。日なたの右岸でとどまって、めずらしい花を咲かせているところ。
// 字はすべて隠し、考える遊び手（tools/bots.mjs の smart）が手を動かしつづける（動くサムネイル用）
let thumbBot = null;
if (q.has('thumb')) {
  tut = 3; start(13); show('hud', false);
  const { smart } = await import('../tools/bots.mjs');
  while (S.t < 51) step(S, smart(S));
  logAt = S.log.length; thumbBot = smart;
} else toTitle();
requestAnimationFrame(frame);
window.__fb = { get S() { return S; }, input, start, world, get mode() { return mode; } };   // しらべ用
