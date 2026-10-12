'use strict';
// 画面（タイトル・面えらび・図鑑・エンディング）と記録。あそぶ画面は main.js。
// タイトルのうしろでは、3面を自動のプレイヤーが代わるがわる遊ぶ（Demo）。

const $ = id => document.getElementById(id);

/* ───── 記録（★）と進み具合 ───── */
const SAVE_KEY = 'asobi-lab/parasite-pilot/best-v1';     // {面のid: {stars, time}}（v001 から同じ）
const PROG_KEY = 'asobi-lab/parasite-pilot/progress-v1'; // {seen: {面のid: true}, ending: true}
function load(key) { try { return JSON.parse(localStorage.getItem(key) || '{}') || {}; } catch (e) { return {}; } }
let best = load(SAVE_KEY), prog = load(PROG_KEY);
if (!prog.seen) prog.seen = {};
function saveBest() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(best)); } catch (e) { /* 保存できなくても遊べる */ } }
function saveProg() { try { localStorage.setItem(PROG_KEY, JSON.stringify(prog)); } catch (e) { /* なし */ } }
const cleared = i => !!best[STAGES[i].id];
const unlocked = i => i === 0 || cleared(i - 1);
const allCleared = () => STAGES.every((S, i) => cleared(i));
const totalStars = () => STAGES.reduce((n, S) => n + (best[S.id] ? best[S.id].stars : 0), 0);
const starText = n => '★'.repeat(n) + '☆'.repeat(3 - n);
function resetRecords() { best = {}; prog = { seen: {} }; saveBest(); saveProg(); }

/* ───── 画面の切りかえ ───── */
const SCREENS = ['title', 'menu', 'book', 'ending', 'play'];
function show(name) {
  for (const s of SCREENS) $(s).hidden = s !== name;
  document.body.dataset.screen = name;
  if (name !== 'play') { Sound.setAmbient(null); Sound.setPull(0); }
  if (name === 'title') { renderTitle(); Demo.start(); } else Demo.stop();
  if (name === 'menu') renderMenu();
  if (name === 'book') renderBook();
  if (name === 'ending') renderEnding();
  window.scrollTo(0, 0);
}
document.addEventListener('click', e => {
  const b = e.target.closest('[data-go]'); if (!b) return;
  Sound.play('click'); show(b.dataset.go);
});

/* ───── タイトル ───── */
function renderTitle() {
  const n = STAGES.findIndex((S, i) => !cleared(i));
  const b = $('btnPlay');
  b.textContent = n === 0 ? 'はじめる' : n > 0 ? `つづきから（${n + 1}面）` : 'もう一度あそぶ';
  b.dataset.i = n;
  const t = totalStars();
  $('totalStars').textContent = t ? `★ ${t} / ${STAGES.length * 3}` : '';
}
$('btnPlay').addEventListener('click', () => {
  Sound.play('click');
  const n = +$('btnPlay').dataset.i;
  if (n >= 0) openStage(n); else show('menu');
});
$('btnStages').addEventListener('click', () => { Sound.play('click'); show('menu'); });
$('btnBook').addEventListener('click', () => { Sound.play('click'); show('book'); });

/* ───── 面えらび ───── */
function renderMenu() {
  $('menuStars').textContent = `★ ${totalStars()} / ${STAGES.length * 3}`;
  $('stageList').innerHTML = STAGES.map((S, i) => {
    const r = best[S.id], open = unlocked(i);
    return `<button type="button" class="stage-card${open ? '' : ' locked'}" data-i="${i}"${open ? '' : ' aria-disabled="true"'}>
      <span class="no">${i + 1}面 ・ 寄生者: ${open ? S.parasite : '？？？'}</span>
      <b>${S.title}</b>
      <span class="route">${S.host} <i>→</i> ${S.next}</span>
      <span class="stars ${r ? '' : 'none'}">${r ? `${starText(r.stars)}　${r.time.toFixed(1)}秒` : open ? 'まだ' : `🔒 ${i}面をクリアすると遊べる`}</span>
    </button>`;
  }).join('');
}
$('stageList').addEventListener('click', e => {
  const b = e.target.closest('.stage-card'); if (!b) return;
  if (!unlocked(+b.dataset.i)) { Sound.play('deny'); return; }
  Sound.play('click'); openStage(+b.dataset.i);
});

/* ───── 生活環（図鑑とエンディング） ───── */
const CYCLES = {
  snail: ['鳥のおなかの中で、おとなになって卵を産む', '卵が、ふんといっしょに外へ', 'カタツムリが、ふんごと食べる', '体の中で育ち、触角の中へ。カタツムリは明るい所へ', '鳥がカタツムリを食べる'],
  mouse: ['ネコの仲間のおなかの中で、次の世代のもと（オーシスト）を作る', 'ふんといっしょに外へ。土や水にまじる', 'ネズミが口に入れる', '脳や筋肉で休むすがたになる。ネコのにおいがこわくなくなる', 'ネコがネズミを食べる'],
  cricket: ['水の中で、おとなが卵を産む', '小さな幼生が、水の虫（カゲロウなど）の幼虫に入る', 'その虫がおとなになって陸へ飛び、カマドウマに食べられる', 'カマドウマの中で長く育つ。カマドウマは光のほう・水辺へ', 'カマドウマが水に飛びこみ、ハリガネムシが泳ぎ出る'],
};
function cycleHtml(S) {
  return `<ol class="cycle">${CYCLES[S.id].map(s => `<li>${s}</li>`).join('')}</ol>`;
}

/* ───── 図鑑 ───── */
function renderBook() {
  $('bookList').innerHTML = STAGES.map((S, i) => {
    if (!prog.seen[S.id]) return `<div class="book-item locked"><b>？？？</b><span class="small">${i + 1}面を遊ぶと読めます</span></div>`;
    return `<details class="book-item"><summary><b>${S.parasite}</b><span class="small">${S.host} → ${S.next}（${i + 1}面）</span></summary>
      ${S.facts.body.map(p => `<p>${p}</p>`).join('')}
      <h3>ひとめぐり（生活環）</h3>${cycleHtml(S)}
      <h3>出どころ</h3><ul class="src">${S.facts.src.map(s => `<li>${s}</li>`).join('')}</ul>
    </details>`;
  }).join('') + (prog.ending ? '<p class="center"><button type="button" class="soft" data-go="ending">エンディングをもう一度見る</button></p>' : '');
}

/* ───── エンディング ───── */
function renderEnding() {
  $('cycles').innerHTML = STAGES.map(S => `<div class="cyc"><h3>${S.parasite}<span>${S.host} → ${S.next}</span></h3>${cycleHtml(S)}</div>`).join('');
  $('endStars').textContent = `★ ${totalStars()} / ${STAGES.length * 3}${totalStars() < STAGES.length * 3 ? '　（★を全部あつめると…？ 速くクリアしてみよう）' : '　ぜんぶ集めた！'}`;
}

/* ───── タイトルのうしろのデモ ───── */
const Demo = (() => {
  const cv = $('demo'), c2 = cv.getContext('2d');
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let D = null, k = -1, endAt = 0, raf = 0, last = 0, vs = { s: 1, ox: 0, oy: 0 };
  function begin(i) {
    k = i % STAGES.length; endAt = 0;
    D = { pointer: { on: false, x: 0, y: 0 }, keys: {}, t: 0, gauge: 100, tired: false, ability: false, will: null, pulled: false,
      toast() {}, sfx() {}, end() { if (!endAt) endAt = D.t + 1.5; } };
    STAGES[k].init(D);
    if (D.cat) D.cat.wait = 1.5; // デモでは、ネコはすぐ起きる
  }
  // 自動のプレイヤー: 面ごとに、行き先へ引っぱり、ちょうどよい所で特別なあやつり
  function pilot() {
    const h = D.host, p = D.pointer; p.on = true;
    if (k === 0) { Object.assign(p, D.clear[2]); D.ability = h.L > 0.6; }
    else if (k === 1) { if (D.cat.st === 'sleep') Object.assign(p, { x: 520, y: 330 }); else Object.assign(p, D.cat); D.ability = D.cat.st !== 'sleep' && dist(h, D.cat) < 300; }
    else { Object.assign(p, h.y < 300 ? { x: 220, y: 400 } : { x: 260, y: 660 }); D.ability = h.y > 440; }
  }
  function step(dt) {
    D.t += dt;
    if (endAt) { if (D.t > endAt) begin(k + 1); return; }
    D.gauge = 100; pilot();
    STAGES[k].update(D, dt);
    if (D.t > 22 && !endAt) endAt = D.t + 0.5;
  }
  function fit() {
    const r = cv.getBoundingClientRect(), dpr = Math.min(2, devicePixelRatio || 1);
    cv.width = Math.max(1, Math.round(r.width * dpr)); cv.height = Math.max(1, Math.round(r.height * dpr));
    const s = Math.max(cv.width / W, cv.height / H);
    vs = { s, ox: (cv.width - W * s) / 2, oy: (cv.height - H * s) / 2 };
  }
  function draw() {
    c2.setTransform(1, 0, 0, 1, 0, 0); c2.fillStyle = '#111'; c2.fillRect(0, 0, cv.width, cv.height);
    c2.setTransform(vs.s, 0, 0, vs.s, vs.ox, vs.oy);
    STAGES[k].draw(c2, D);
  }
  function loop(now) {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    if (!still) step(dt);
    draw();
    raf = still ? 0 : requestAnimationFrame(loop);
  }
  function start() {
    if (raf) return;
    if (!D) { begin(0); if (still) for (let i = 0; i < 300; i++) step(1 / 60); }
    fit(); last = performance.now(); raf = requestAnimationFrame(loop);
  }
  function stop() { cancelAnimationFrame(raf); raf = 0; }
  addEventListener('resize', () => { if (raf || still) { fit(); if (D) draw(); } });
  return { start, stop, step: s => { for (let i = 0; i < s * 60; i++) step(1 / 60); draw(); }, get D() { return D; } };
})();
