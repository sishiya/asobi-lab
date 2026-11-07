// 花の小川 の画面: 3D の世界（js/world3d.js）・指・タイトル・教える順・おわり・庭。決まりは js/sim.js。
// 手（段階A3）: さわらなくても流れる（まん中ほど速く、岸ほどおそい）。水面に指を置くと、しずくの先頭が指へ引かれる
// （左右＝岸へ、前＝速く、うしろ＝とどまる）。はなすと、その場から流れにまかせる。どこにさわっても波紋と花のおじぎ。
// キー: ←→（A/D）岸、↑（W）前へ、↓（S）うしろへ、Esc 止める。?seed=<番号> で川を選ぶ。
import { RULE, newState, step, gradeOf, bloomOf, currentAt } from './sim.js';
import { makeWorld } from './world3d.js';
import { GRADE_NAME, drawGradeFlower } from './flowers.js';
import * as A from './audio.js';

const $ = id => document.getElementById(id);
const VER = 'ver. 0.9';
const world = makeWorld($('stage'));
const q = new URLSearchParams(location.search);
let seed = +(q.get('seed') || 1 + Math.floor(Math.random() * 9999));
let S = newState(seed), mode = 'title', acc = 0, last = performance.now(), logAt = 0, endAt = 0;
await world.ready;   // 空の光（しずくに映す）を読み終えてから
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
// 指は「せき」（段階A4）: 水面に指を置くと、まわりのしずくが塊ごと指へ寄って、そこにたまる。
// つまむ（ver. 0.6）: 押しているあいだ、つまんだ塊は指の下へついてくる。カメラは押しているあいだ川の流れの速さで進むので、
// 指を止めれば流れといっしょに下り、指を画面の上へ動かせば急ぎ、下へ動かせば戻る。はなすと勢いが残る。
// input: { on, fs, fx }（js/sim.js の step）。キーは群れのまわりに「見えない指」を置く
const input = { on: false, fs: 0, fx: 0 };
const keys = new Set();
let pointerId = null, grabT = 0, finger = null, press = null, lastTouchAt = 0;
const kf = { x: 0, d: 18 };
const stage = $('stage');
function aimFinger(now) {   // 毎こま: 指を止めていても、カメラは動くので、置いた点を世界の点に置きなおす
  if (!press) return;
  const p = world.pick(press.cx, press.cy, S.main.s);
  if (!p) return;
  finger = p;
  if (now - lastTouchAt > 0.25 || press.moved) { world.touch(p.point, 0.8); lastTouchAt = now; press.moved = false; }
  if (mode !== 'play') return;
  input.on = true; input.fs = p.s; input.fx = Math.max(-1.3, Math.min(1.3, p.x));
  world.setFinger(p.point, true);
}
stage.addEventListener('pointerdown', e => {
  if (mode === 'title' || mode === 'pause') return;
  A.startAudio();
  pointerId = e.pointerId; try { stage.setPointerCapture(e.pointerId); } catch {}
  if (e.pointerType === 'touch') touched = true;
  press = { cx: e.clientX, cy: e.clientY, moved: true, trail: [{ t: performance.now(), x: e.clientX, y: e.clientY }] };
  world.holdCam(mode === 'play');   // 押しているあいだ、カメラは流れの速さで進む（指を止めると、塊は流れといっしょに）
  aimFinger(performance.now() / 1000);
  if (finger) { A.sTouch(finger.x); world.splash(finger.point); }
  buzz(8);
});
stage.addEventListener('pointermove', e => {
  if (e.pointerId === pointerId && press) { if (Math.hypot(e.clientX - press.cx, e.clientY - press.cy) > 18) press.moved = true; press.cx = e.clientX; press.cy = e.clientY; press.trail.push({ t: performance.now(), x: e.clientX, y: e.clientY }); if (press.trail.length > 12) press.trail.shift(); }
  else if (e.pointerType === 'mouse' && pointerId === null) { const p = world.pick(e.clientX, e.clientY, S.main.s); world.hover(p && p.point); }   // マウスでなでるだけでも、花がゆれる
});
// はなす: 最後の 0.1 秒の指の動きを、いまのカメラで川の上の速さにして、つかんでいた塊を放る
const up = e => {
  if (e.pointerId !== pointerId) return;
  if (press && mode === 'play') {
    const now = performance.now(), old = press.trail.find(q => now - q.t < 110) || press.trail[press.trail.length - 1];
    const dtS = Math.max(0.03, (now - old.t) / 1000), p0 = world.pick(old.x, old.y, S.main.s), p1 = world.pick(e.clientX, e.clientY, S.main.s);
    const holding = S.held && S.held.some(Boolean);
    if (p0 && p1 && now - old.t < 160 && holding && Math.hypot(p1.s - p0.s, (p1.x - p0.x) * 35) / dtS > 60) { A.sFling(); flung = true; }   // 勢いよくはなした: ひゅっ
  }
  pointerId = null; finger = null; press = null; input.on = false; world.setFinger(null); world.holdCam(false);
};
stage.addEventListener('pointerup', up); stage.addEventListener('pointercancel', up);
stage.addEventListener('pointerleave', () => { world.hover(null); if (pointerId === null) world.setFinger(null); });
addEventListener('keydown', e => {
  keys.add(e.key.length === 1 ? e.key.toLowerCase() : e.key);
  if (e.key.startsWith('Arrow')) e.preventDefault();
  if (e.key === 'Escape' && (mode === 'play' || mode === 'pause')) togglePause();
  if (mode === 'play') A.startAudio();
});
addEventListener('keyup', e => keys.delete(e.key.length === 1 ? e.key.toLowerCase() : e.key));
function handInput(dt) {
  if (pointerId !== null) { if (S.held && S.held.some(Boolean)) grabT += dt; aimFinger(performance.now() / 1000); return; }   // 教える順は、本当につかんでいた時間で
  const k = a => a.some(x => keys.has(x));
  const any = k(['ArrowLeft', 'a', 'ArrowRight', 'd', 'ArrowUp', 'w', 'ArrowDown', 's']);
  if (!any) { input.on = false; kf.x = S.main.x; world.setFinger(null); return; }
  // 見えない指: いちばん大きな塊をつまむ。←→ で左右、↑ で急ぐ、↓ で戻る、どちらも押さなければ流れの速さ
  if (k(['ArrowLeft', 'a'])) kf.x = Math.max(-1.2, kf.x - 1.4 * dt);
  if (k(['ArrowRight', 'd'])) kf.x = Math.min(1.2, kf.x + 1.4 * dt);
  const want = (k(['ArrowUp', 'w']) ? 70 : k(['ArrowDown', 's']) ? -25 : currentAt(kf.x)) / RULE.herd.k;   // 運ぶ速さ → 塊のまん中から指までの長さ
  kf.d += (want - kf.d) * Math.min(1, dt * 4);
  if (mode === 'play') { input.on = true; input.fs = S.main.s + kf.d; input.fx = kf.x; world.setFingerSim(input.fs, input.fx); }
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
  input.on = false; kf.x = 0; kf.d = 0; grabT = 0; flung = false;
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
const HINTS = ['', 'しずくをつまむと、指についてくる。押したまま ほかのしずくに近づけると、まとめて運べる', '指を上へ動かすと急ぎ、下へ動かすと戻る。勢いよくはなすと、ぽんと放れる', '岸へつれていくと、花が水を飲んで咲く。乾いたしずくは、花のアーチでちぎれる'];
function setHint() { if (toastT > 0) return; $('hint').classList.remove('alert'); $('hint').textContent = HINTS[hintStep] || ''; $('hint').hidden = !hintStep; }
function hints(dt, bloomedNow) {
  if (!hintStep) return;
  hintT += dt;
  const lead = S.main.s, arch0 = S.course.arches[0].s;
  const next = hintStep === 1 ? grabT > 1.5 || lead > 600 :
    hintStep === 2 ? (grabT > 4 && hintT > 5) || flung || hintT > 18 :
    hintT > 6 && lead > arch0 + 40;
  if (toastT > 0) return;   // 知らせが出ているあいだは待つ（1行に1つ）
  if (hintStep === 3 && lead < arch0 - 260) { $('hint').hidden = true; hintT = 0; return; }   // 3つ目は最初のアーチが見えてから
  if (hintStep === 3) setHint();
  if (next) { tut = hintStep; store.set('tut', tut); hintStep = hintStep < 3 ? hintStep + 1 : 0; hintT = 0; setHint(); }
}

// ---------- できごと（音と、短い知らせ） ----------
// ふるえ（Android）: 人がさわったあとだけ、0.25 秒に1回まで（水っぽい塊はちぎれてはくっつくをくり返すので）
let lastBuzz = 0, touched = false, flung = false;   // ふるえは指でさわったことがあるときだけ（マウスのクリックでは Chrome がこばんで、こばんだ知らせがたくさん出る）
function buzz(ms) { const t = performance.now(); if (t - lastBuzz < 250 || !touched) return; lastBuzz = t; navigator.vibrate?.(ms); }
let bloomCount = 0, toastT = 0;
// 知らせ: 教えることばと同じ1行を借りる（一度に1つ。RULES 4章）
function toast(t, sec = 2.5) { const h = $('hint'); h.textContent = t; h.classList.add('alert'); h.hidden = false; toastT = sec; }
function events() {
  for (; logAt < S.log.length; logAt++) {
    const e = S.log[logAt];
    if (e.ev === 'break') { A.sBreak(); world.wobble(e.i); world.wobble(e.j); buzz(12); }
    else if (e.ev === 'join') { A.sJoin(S.beads.filter(b => b.g === S.beads[e.i].g).length / S.beads.length); world.wobble(e.i, 0.8, e.j); }   // 大きな塊になるほど、むにゅの音が高く（集まっていく手ごたえ）
    else if (e.ev === 'clump') A.sClump();
    else if (e.ev === 'fiber') A.sFiber();
    else if (e.ev === 'thunder') { A.sThunder(); toast(e.kind === 'squeeze' ? '雷　アーチが強く締まる' : '雷　流れが急に', 4); }
    else if (e.ev === 'ride') { A.sWave(true); toast(e.n >= S.beads.length / 2 ? '大きな流れに乗った' : '大きな流れに、なかまの一部が乗った'); }
    else if (e.ev === 'wave-miss') A.sWave(false);
  }
  const wv = S.course.waves.find(w => w.front !== null && !w.used);
  if (wv && S.main.s - wv.front < 260 && toastT <= 0.2) toast('大きな流れ　まん中にいると乗る、岸ならよける', 0.4);
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
  input.on = false; $('hint').hidden = true; toastT = 0;
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
  handInput(dt);
  A.setFlow(world.speed());
  A.setProgress(Math.min(1, S.main.s / RULE.len), mode === 'end' ? 'end' : mode === 'title' ? 'title' : 'play');   // 川を下った道のりが、曲の進み
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
