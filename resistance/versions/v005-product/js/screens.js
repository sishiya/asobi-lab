// screens.js — 画面のまわり: タイトル・あそびかた・せってい・このゲームについて・メニュー（一時停止）・確認の窓・
// つづきから（夜の始まりで自動セーブ）・はじめてのてびき・思わぬエラーのお知らせ
'use strict';

const VERSION = '1.0';
const RUN_KEY = 'resistance.run';       // つづきから（夜の始まりの状態）
const PLAYED_KEY = 'resistance.played'; // 1回でも最後まで遊んだら、てびきを出さない

// ---- 窓（シート）: 開いた順に重ねる。Esc でいちばん上を閉じる ----
const sheets = [];
function openSheet(id) {
  const el = $(id); if (!el.hidden && sheets.includes(id)) return;
  el.hidden = false; sheets.push(id);
  const f = el.querySelector('button'); if (f) f.focus({preventScroll: true});
}
function closeSheet(id) {
  $(id).hidden = true;
  const i = sheets.indexOf(id); if (i >= 0) sheets.splice(i, 1);
  if (!sheets.length && S.phase === 'night' && S.paused) setPaused(false);
}

// ゲームの見た目の確認（ブラウザの confirm のかわり）
function ask(msg, yes, fn, no = 'やめる') {
  $('askMsg').innerHTML = msg; $('askYes').textContent = yes; $('askNo').textContent = no;
  $('askYes').onclick = () => { Sound.play('click'); closeSheet('askOv'); fn(); };
  $('askNo').onclick = () => { Sound.play('click'); closeSheet('askOv'); };
  openSheet('askOv');
}

// ---- 一時停止とメニュー ----
function setPaused(v) {
  S.paused = v;
  if (S.world && S.world.spraying) S.world.spraying = null;
  Sound.setSpray(false);
  Sound.suspend(v && S.phase === 'night');
  syncMenu();
}
function openMenu() {
  if (S.phase === 'title') return;
  if (S.phase === 'night') setPaused(true);
  syncMenu();
  openSheet('menuOv');
}
function syncMenu() {
  $('menuTitle').textContent = S.phase === 'night' ? '一時停止中' : 'メニュー';
  $('mResume').textContent = S.phase === 'night' ? 'つづける' : 'とじる';
  for (const b of document.querySelectorAll('.sndBtn')) { b.textContent = Sound.on ? '音: オン' : '音: オフ'; b.setAttribute('aria-pressed', Sound.on); }
  $('btnMenu').textContent = S.paused ? '▶ つづける' : '❚❚ メニュー';
}

// ---- タイトル ----
let attract = null;   // タイトルのうしろで動く台所（道具は使わない）
function showTitle() {
  for (const id of sheets.slice()) closeSheet(id);
  S.phase = 'title'; S.paused = false; Sound.suspend(false);
  resetStage(); kitchenCache = null;
  attract = newWorld(firstPopulation(rnd, 18)); S.world = attract;
  for (let t = 0; t < 8; t += 1 / 20) stepWorld(attract, 1 / 20);   // 虫が出てきたところから見せる
  for (const id of ['startOv', 'resultOv', 'endOv']) $(id).hidden = true;
  $('banner').hidden = true;
  const run = loadRun(), b = loadBest();
  $('tCont').hidden = !run;
  $('tContInfo').textContent = run ? `第${run.gen}夜から（虫 ${run.pop.length} 匹）` : '';
  $('tBest').innerHTML = b ? `いちばんの記録 <span class="stars">${starText(b.stars)}</span> 第${b.nights}夜で全滅` : 'まだ記録はありません';
  $('titleOv').hidden = false; document.body.classList.add('at-title');
  Sound.setAmbient(false);
  syncButtons();
}
function leaveTitle() { $('titleOv').hidden = true; document.body.classList.remove('at-title'); attract = null; }

function newGame() {
  leaveTitle(); clearRun();
  reset();
  $('startOv').hidden = false;
}
function continueGame() {
  const run = loadRun();
  if (!run) return newGame();
  leaveTitle(); reset();
  restoreRun(run);
  startNight();
  refreshPanel();
}

// ---- つづきから: 夜の始まりで保存する（夜のとちゅうでやめたら、その夜のはじめから） ----
const packBug = b => TRAITS.map(t => Array.from(b.g[t.id]).join(''));
const unpackBug = (a, gen) => makeBug(Object.fromEntries(TRAITS.map((t, i) => [t.id, Uint8Array.from(a[i], c => +c)])), gen);
function saveRun() {
  try {
    localStorage.setItem(RUN_KEY, JSON.stringify({v: 1, gen: S.gen, arrived: S.arrived, pop: S.pop.map(packBug), first: S.first.map(packBug),
      hist: S.hist, taken: S.taken, used: S.used, baits: S.world ? S.world.baits.map(b => ({x: b.x, y: b.y})) : []}));
  } catch (e) { /* 保存できなくても遊べる */ }
}
function loadRun() {
  try { const r = JSON.parse(localStorage.getItem(RUN_KEY) || 'null'); return r && r.v === 1 && r.pop && r.pop.length ? r : null; } catch (e) { return null; }
}
function clearRun() { try { localStorage.removeItem(RUN_KEY); } catch (e) { /* なし */ } }
function restoreRun(r) {
  resetStage();
  for (const [id, n] of Object.entries(r.taken)) { const c = CARDS.find(c => c.id === id); if (c) for (let i = 0; i < n; i++) c.apply(); }
  kitchenCache = null;
  S.gen = r.gen; S.arrived = r.arrived || 0; S.taken = r.taken; S.used = r.used; S.hist = r.hist;
  S.pop = r.pop.map(a => unpackBug(a, r.gen)); S.first = r.first.map(a => unpackBug(a, 1));
  S.world = newWorld(S.pop, r.baits || []);
  syncOwned();
}

// ---- はじめてのてびき（1回でも最後まで遊ぶまで） ----
const TIPS = [
  {night: 1, at: 2.5, t: '虫をクリック（タップ）して叩こう。<b>食べている虫</b>は止まっていて当てやすい。'},
  {night: 1, on: 'dodge', t: 'スリッパの<b>影が落ちる前に気づいた虫</b>は逃げる。逃げ道の先をねらおう。'},
  {night: 2, at: 1.5, t: '<b>スプレー</b>は押している間、霧が出る。食べこぼしに集まったところへ。使える量に注意。'},
  {night: 3, at: 1.5, t: '<b>毒エサ</b>を床に置こう（3つまで）。置いたものは次の夜にも残る。'},
  {on: 'warn', t: '虫が<b>あなたのやり方に強く</b>なってきた。ほかの道具や「薬を使わない」強化もためそう。'},
  {on: 'tough', t: '「効かない！」は殺虫剤に強い遺伝子を持つ虫。スプレーだけにたよると、この虫ばかりになる。'},
];
let tipsShown = new Set();
function tipsOn() { try { return !localStorage.getItem(PLAYED_KEY); } catch (e) { return true; } }
function markPlayed() { try { localStorage.setItem(PLAYED_KEY, '1'); } catch (e) { /* なし */ } }
function showTip(tip) {
  const i = TIPS.indexOf(tip);
  if (tipsShown.has(i)) return;
  tipsShown.add(i);
  toast('💡 ' + tip.t, 5200);
}
// ループから毎フレーム
function tickTips(w, flags) {
  if (!tipsOn() || S.watching) return;
  for (const tip of TIPS) {
    if (tip.night && tip.night !== S.gen) continue;
    if (tip.at != null && w.t >= tip.at) showTip(tip);
    if (tip.on && flags[tip.on]) showTip(tip);
  }
}

// ---- 思わぬエラー ----
function onError(e) {
  window.__rzErr = e;
  try { console.error(e); } catch (x) { /* なし */ }
  if (!$('errOv').hidden) return;
  $('errMsg').textContent = String(e && (e.message || e)).slice(0, 200);
  $('errOv').hidden = false;
}
addEventListener('error', e => onError(e.error || e.message));
addEventListener('unhandledrejection', e => onError(e.reason));

function wireScreens() {
  const click = (id, fn) => $(id).addEventListener('click', () => { Sound.play('click'); fn(); });
  click('tNew', () => loadRun() ? ask('とちゅうのゲーム（つづきから）は消えます。はじめから遊びますか？', 'はじめから', newGame) : newGame());
  click('tCont', continueGame);
  for (const [b, s] of [['tHow', 'howOv'], ['tSet', 'setOv'], ['tAbout', 'aboutOv'], ['mHow', 'howOv'], ['mSet', 'setOv']]) click(b, () => openSheet(s));
  for (const b of document.querySelectorAll('[data-close]')) b.addEventListener('click', () => { Sound.play('click'); closeSheet(b.dataset.close); });
  click('btnMenu', () => S.paused ? closeSheet('menuOv') : openMenu());
  click('mResume', () => closeSheet('menuOv'));
  click('mRestart', () => ask('第1夜からやり直しますか？（いまのゲームは消えます）', 'やり直す', () => { closeSheet('menuOv'); newGame(); }));
  click('mTitle', () => ask(S.phase === 'night' ? 'タイトルにもどりますか？<br><small>この夜は、つづきから遊ぶと夜のはじめからになります。</small>' : 'タイトルにもどりますか？', 'もどる', showTitle));
  for (const b of document.querySelectorAll('.sndBtn')) b.addEventListener('click', () => { Sound.setOn(!Sound.on); Sound.play('click'); syncMenu(); });
  click('sWipe', () => ask('記録（★）と、つづきからのデータを消しますか？', '消す', () => {
    try { for (const k of [SAVE_KEY, RUN_KEY, PLAYED_KEY]) localStorage.removeItem(k); } catch (e) { /* なし */ }
    tipsShown = new Set(); toast('記録を消しました', 2000);
    if (S.phase === 'title') showTitle();
  }));
  click('errReload', () => location.reload());
  click('btnTitle', showTitle);
  $('aboutVer').textContent = VERSION;
  $('tVer').textContent = 'ver. ' + VERSION;
  // 別のタブに行ったら、夜を止める
  document.addEventListener('visibilitychange', () => { if (document.hidden && S.phase === 'night' && !S.paused) openMenu(); });
  window.addEventListener('keydown', e => {
    if (e.key === 'Escape') { if (sheets.length) closeSheet(sheets[sheets.length - 1]); else openMenu(); }
    else if ((e.key === 'p' || e.key === 'P') && S.phase === 'night') { if (S.paused) closeSheet('menuOv'); else openMenu(); }
  });
  syncMenu();
}
