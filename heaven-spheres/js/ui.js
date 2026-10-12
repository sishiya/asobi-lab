'use strict';
// 画面のまわり: 札（はじめ・お題クリア・全滅）、横のようす（お題・世界・種の一覧と移り変わりのグラフ）、知らせ。
// 状態は main.js の Wd・L・G を使う。
const $ = s => document.querySelector(s);
const BEST_KEY = 'asobi-lab/heaven-spheres/best-v2';     // お題ごとのいちばんの★

let toastTimer = 0;
function toast(text, sec = 3) { const t = $('#toast'); t.textContent = text; t.classList.add('on'); toastTimer = sec; }

function loadBest() { try { return JSON.parse(localStorage.getItem(BEST_KEY)) || {}; } catch (e) { return {}; } }
function saveBest(b) { try { localStorage.setItem(BEST_KEY, JSON.stringify(b)); } catch (e) { /* なし */ } }

// ---- 札 -----------------------------------------------------------------
const NUM = ['一', '二', '三', '四', '五', '六'];
function panel(html) { $('#panel').innerHTML = html; $('#overlay').hidden = false; }
function closePanel() { $('#overlay').hidden = true; }
function startPanel() {
  const q = QUESTS[0];
  panel(`<h2>天をまわす箱庭</h2>
    <p>世界の真ん中に、小さな大地がある。まわりを月・太陽・星の天球がめぐっている。きみは神の手で天球を回し、大地の形を変えられる。</p>
    <p><b>第一の日のお題:</b> ${q.title}。</p>
    <ul class="howto">
      <li>天球の帯をドラッグで回す。タップで止める／また動かす。</li>
      <li>大地のふちを外へなぞると盛り上がり、内へなぞるとへこむ。</li>
      <li>太陽を止めると、昼の側は焼けて水が蒸発し、夜の側は凍える。</li>
    </ul>
    <div class="btns"><button class="tbtn main" data-act="go">はじめる</button></div>`);
}
function questPanel(qi, days) {
  const q = QUESTS[qi], stars = questStars(q, days), best = loadBest(), isBest = !best[qi] || stars > best[qi];
  if (isBest) { best[qi] = stars; saveBest(best); }
  const next = QUESTS[qi + 1];
  panel(`<h2>第${NUM[qi]}の日 クリア</h2>
    <p class="stars">${'★'.repeat(stars)}${'☆'.repeat(3 - stars)}</p>
    <p style="text-align:center">${q.title}（${days} 日）</p>
    <p class="truth"><b>本当は:</b> ${q.truth}</p>
    ${next ? `<p><b>第${NUM[qi + 1]}の日のお題:</b> ${next.title}</p>` : '<p><b>5つのお題をすべてクリアした。</b>このまま世界をながめてもいいし、最初から作り直してもいい。</p>'}
    <div class="btns"><button class="tbtn main" data-act="close">${next ? '次のお題へ' : 'このまま見る'}</button><button class="tbtn" data-act="reset">最初から</button></div>`);
}
function losePanel() {
  panel(`<h2>生き物がいなくなった</h2>
    <p>すべての生き物が死んでしまった。津波が多すぎたか、太陽を止めすぎたのかもしれない。</p>
    <div class="btns"><button class="tbtn main" data-act="reset">最初から</button></div>`);
}

// ---- 横のようす -----------------------------------------------------------
$('#genes').innerHTML = GENES.map(g => `<span>${g.name}</span><span class="bar"><i data-gene="${g.k}"></i></span>`).join('');

function updateQuestBox() {
  const q = QUESTS[G.qi];
  $('#questLabel').textContent = q ? `第${NUM[G.qi]}の日のお題` : 'お題はすべてクリア';
  $('#questText').textContent = q ? q.title : '世界をながめよう';
  $('#questHint').textContent = q ? q.hint : '';
  const best = loadBest();
  $('#questStars').innerHTML = QUESTS.map((_, i) => `<span class="${i === G.qi ? 'now' : ''}" title="第${NUM[i]}の日">${best[i] ? '★'.repeat(best[i]) : i < G.qi ? '◇' : '・'}</span>`).join('');
}

function updateSide(S) {
  const day = Math.floor(Wd.t / DAY) + 1;
  $('#day').textContent = `第 ${day} 日`;
  $('#gen').textContent = `第 ${L.maxGen} 世代`;
  $('#pop').textContent = S.n;
  const q = QUESTS[G.qi];
  if (q) {
    const [v, goal] = q.prog(S, Wd, L, G);
    $('#questBar').style.width = Math.min(100, v / goal * 100) + '%';
    $('#questNum').textContent = q.fixed ? v.toFixed(q.fixed) : Math.floor(v);
    $('#questUnit').textContent = q.fixed ? ` / ${goal} ${q.unit}` : ` / ${goal} ${q.unit}`;
  } else { $('#questBar').style.width = '100%'; $('#questNum').textContent = ''; $('#questUnit').textContent = ''; }
  $('#soilBar').style.width = Wd.soil / SOIL_MAX * 100 + '%';
  const sp = springness(Wd);
  $('#tide').textContent = (Wd.maxU > 110 ? '津波！' : sp > 0.9 ? '大潮' : sp < 0.35 ? '小潮' : 'ふつう') + `（潮の力 ${tidePow(Wd).toFixed(1)}）`;
  let tMax = -99, tMin = 99;
  for (let i = 0; i < N; i++) { if (Wd.T[i] > tMax) tMax = Wd.T[i]; if (Wd.T[i] < tMin) tMin = Wd.T[i]; }
  $('#temp').textContent = `${Math.round(tMin)}〜${Math.round(tMax)} 度`;
  $('#temp').className = tMax > 40 ? 'hot' : tMin < 0 ? 'cold' : '';
  for (const g of GENES) $(`[data-gene=${g.k}]`).style.width = S.avg[g.k] * 100 + '%';
  updateSpeciesList();
}

// 種の一覧（数の多い順）。押すとその種のいる所へ寄る
function updateSpeciesList() {
  const al = L.species.filter(s => s.alive).sort((a, b) => b.n - a.n);
  $('#spList').innerHTML = al.map(s => `<button type="button" class="sp" data-sp="${s.id}">
    <i style="background:${s.color}"></i><span class="nm">${s.name}${s.landers >= s.n / 2 && s.n ? ' <em>陸</em>' : ''}</span><b>${s.n}</b></button>`).join('');
}
$('#spList').addEventListener('click', e => {
  const b = e.target.closest('[data-sp]'); if (!b) return;
  const s = L.species.find(x => x.id === +b.dataset.sp); if (!s) return;
  const a = s.deg * Math.PI / 180;
  flyTo(CX + 250 * Math.cos(a), CY + 250 * Math.sin(a), 3);
});

// 種の移り変わり: 半日ごとに種ごとの数を記録し、積み重ねた帯で描く
const hist = [];
function recordHistory() {
  const row = { t: Wd.t, v: {} };
  for (const s of L.species) if (s.alive) row.v[s.id] = s.n;
  hist.push(row);
  if (hist.length > 400) hist.splice(0, hist.length - 400);
}
function drawChart() {
  const cv = $('#spChart'), w = cv.clientWidth, hgt = cv.clientHeight, dp = Math.min(2, devicePixelRatio || 1);
  if (!w) return;
  if (cv.width !== Math.round(w * dp)) { cv.width = Math.round(w * dp); cv.height = Math.round(hgt * dp); }
  const c = cv.getContext('2d');
  c.setTransform(dp, 0, 0, dp, 0, 0); c.clearRect(0, 0, w, hgt);
  if (hist.length < 2) return;
  const maxN = Math.max(60, ...hist.map(r => Object.values(r.v).reduce((a, b) => a + b, 0)));
  const xs = k => k / (hist.length - 1) * w, ys = v => hgt - v / maxN * (hgt - 4);
  const ids = [...new Set(hist.flatMap(r => Object.keys(r.v)))].map(Number).sort((a, b) => a - b);
  const base = new Array(hist.length).fill(0);
  for (const id of ids) {
    const sp = L.species.find(s => s.id === id); if (!sp) continue;
    c.beginPath();
    hist.forEach((r, k) => { const y = ys(base[k] + (r.v[id] || 0)); k ? c.lineTo(xs(k), y) : c.moveTo(xs(k), y); });
    for (let k = hist.length - 1; k >= 0; k--) c.lineTo(xs(k), ys(base[k]));
    c.closePath(); c.fillStyle = sp.color; c.globalAlpha = 0.85; c.fill(); c.globalAlpha = 1;
    c.strokeStyle = 'rgba(58,42,28,.6)'; c.lineWidth = 0.6; c.stroke();
    hist.forEach((r, k) => { base[k] += r.v[id] || 0; });
  }
}

// ---- 知らせ（生き物の出来事） ------------------------------------------------
const labels = [];       // 地図の上の札 { deg, text, t }
function handleEvents() {
  for (const e of L.events.splice(0)) {
    if (e.type === 'new') { toast(`新しい種「${e.sp.name}」が生まれた`, 4); Sound.play('species'); labels.push({ deg: e.sp.deg || 0, sp: e.sp, text: `新しい種 ${e.sp.name}`, t: 6 }); }
    if (e.type === 'gone') toast(`「${e.sp.name}」が絶えた`, 4);
    if (e.type === 'merge') toast(`「${e.sp.name}」と「${e.into.name}」が混ざって、ひとつの種になった`, 4);
  }
  for (const lb of labels) if (lb.sp && lb.sp.n) lb.deg = lb.sp.deg;    // 生まれた種の場所が決まったら合わせる
}
