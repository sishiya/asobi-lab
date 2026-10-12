'use strict';
// 知らせ・札・観察帳のグラフ（v011 で横の箱は観察帳へ）
const $ = id => document.getElementById(id);
let toastT = 0;
function toast(msg, sec = 3) {
  const el = $('toast'); el.textContent = msg; el.classList.add('on');
  clearTimeout(toastT); toastT = setTimeout(() => el.classList.remove('on'), sec * 1000);
}

function showPanel(html, btns) {
  $('panel').innerHTML = html;
  const box = document.createElement('div'); box.className = 'btns';
  for (const b of btns) {
    const el = document.createElement('button'); el.type = 'button'; el.className = 'tbtn' + (b.main ? ' main' : ''); el.textContent = b.label;
    el.onclick = () => { Sound.unlock(); Sound.play('click'); $('overlay').hidden = true; b.fn && b.fn(); };
    box.appendChild(el);
  }
  $('panel').appendChild(box);
  $('overlay').hidden = false;
  box.querySelector('.main')?.focus();
}

const HIST = [];
function updateSide(s) {
  const yr = Math.floor((W.t / DAY + 0.1 * YEAR) / YEAR) + 1;
  $('day').textContent = `${yr} 年目の${SEASONS[seasonOf()]}・第 ${W.day} 日`;
  $('hud').textContent = `${SEASONS[seasonOf()]}・${Math.round(W.Tavg ?? 15)}℃` + (W.Tavg < 2 ? '・雪' : '');
  $('nGrass').textContent = Math.round(s.grass * 100);
  $('nDeer').textContent = L.counts.deer; $('nWolf').textContent = L.counts.wolf; $('nFish').textContent = L.counts.fish; $('nBird').textContent = L.counts.bird;
  $('fallRate').textContent = s.out.toFixed(1);
  const tot = s.land + s.clouds + s.abyss || 1;
  $('wLand').style.width = (s.land / tot * 100) + '%';
  $('wCloud').style.width = (s.clouds / tot * 100) + '%';
  $('wAbyss').style.width = (s.abyss / tot * 100) + '%';
  $('soilBar').style.width = Math.min(100, W.soil / 300 * 100) + '%';
  $('nSpring').textContent = W.springs.length;
  questLine(s); drawDial(); drawHands();
  if (!$('fan').hidden) { const sig = ['deer', 'wolf', 'fish', 'bird'].map(k => W.stock[k]).join(); if (sig !== G.fanSig) { G.fanSig = sig; syncHands(); } }
  renderBook(); updateCard();
}

// 半日ごとに記録して、移り変わりのグラフ
function recordHist(s) {
  HIST.push({ g: s.grass, d: L.counts.deer, w: L.counts.wolf, f: L.counts.fish, b: L.counts.bird, s: seasonOf(), gs: { deer: geneStats('deer'), wolf: geneStats('wolf'), fish: geneStats('fish'), bird: geneStats('bird') } });
  if (HIST.length > 240) HIST.shift();
  if (!$('book').hidden) { drawChart(); drawGeneChart(); }
}
function drawChart() {
  const cv = $('chart'), dpr = devicePixelRatio || 1;
  const w = cv.clientWidth, h = cv.clientHeight;
  if (!w) return;
  if (cv.width !== Math.round(w * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
  const ctx = cv.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, w, h);
  if (HIST.length < 2) return;
  // 季節の帯（うすく）
  const SCOL = ['rgba(240,170,200,0.10)', 'rgba(120,200,110,0.10)', 'rgba(230,150,60,0.12)', 'rgba(170,190,230,0.14)'];
  HIST.forEach((p, k) => { if (p.s === undefined) return; ctx.fillStyle = SCOL[p.s]; const x = k / (HIST.length - 1) * w; ctx.fillRect(x, 0, w / (HIST.length - 1) + 1, h); });
  const maxA = Math.max(20, ...HIST.map(p => Math.max(p.d, p.f, p.w * 4)));
  const line = (col, f, dash) => {
    ctx.strokeStyle = col; ctx.lineWidth = 1.6; ctx.setLineDash(dash || []);
    ctx.beginPath();
    HIST.forEach((p, k) => { const x = k / (HIST.length - 1) * w, y = h - 2 - f(p) * (h - 6); k ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
    ctx.stroke(); ctx.setLineDash([]);
  };
  line('#6aa84f', p => p.g, [4, 3]);
  line('#ef9a4a', p => p.f / maxA);
  line('#c08040', p => p.d / maxA);
  line('#7d8597', p => p.w * 4 / maxA);
  line('#9ab4cc', p => (p.b || 0) * 4 / maxA);
}

// ---- 遺伝子の箱 ----
const GCOL = ['#c0503a', '#4a8a4a', '#3a6aa8'];
let gKind = 'deer';
document.querySelectorAll('[data-gk]').forEach(b => b.addEventListener('click', () => {
  gKind = b.dataset.gk;
  document.querySelectorAll('[data-gk]').forEach(x => x.setAttribute('aria-pressed', x === b));
  updateGenes(); drawGeneChart();
}));
const gbar = (v, col) => `<span class="gbar"><b style="width:${(v * 100).toFixed(0)}%${col ? ';background:' + col : ''}"></b><s></s></span>`;
function updateGenes() {
  const g = geneStats(gKind);
  $('genGen').textContent = g.n ? `いちばん新しい世代 ${g.gen}` : 'いない';
  $('grows').innerHTML = GENES[gKind].map(([k, name], n) =>
    `<span><i style="background:${GCOL[n]}"></i>${name}</span>${gbar(g.n ? g[k] : 0, GCOL[n])}<em>${g.n ? g[k].toFixed(2) : '―'}</em>`).join('');
}
function drawGeneChart() {
  const cv = $('gchart'), dpr = devicePixelRatio || 1;
  const w = cv.clientWidth, h = cv.clientHeight;
  if (!w) return;
  if (cv.width !== Math.round(w * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
  const ctx = cv.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, w, h);
  ctx.strokeStyle = 'rgba(128,128,128,0.4)'; ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.moveTo(0, h / 2); ctx.lineTo(w, h / 2); ctx.stroke(); ctx.setLineDash([]);
  const pts = HIST.filter(p => p.gs && p.gs[gKind] && p.gs[gKind].n > 0);
  if (pts.length < 2) return;
  GENES[gKind].forEach(([k], n) => {
    ctx.strokeStyle = GCOL[n]; ctx.lineWidth = 1.6; ctx.beginPath();
    pts.forEach((p, i) => { const x = i / (pts.length - 1) * w, y = h - 2 - (p.gs[gKind][k] - 0.2) / 0.6 * (h - 4); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });   // 0.2〜0.8 を広げて
    ctx.stroke();
  });
}

// ---- 1匹の札（「見る」で生き物を押す） ----
function updateCard() {
  const a = G.sel, el = $('card');
  if (!a) { el.hidden = true; return; }
  if (a.dead) {
    el.innerHTML = `<h4><span>${KINDS[a.kind].name}（第 ${a.gen} 世代）</span><button type="button" aria-label="とじる" onclick="G.sel=null;updateCard()">×</button></h4><p>${DIE_WORD[a.how] || 'いなくなった'}</p>`;
    el.hidden = false; return;
  }
  const days = (a.age / DAY).toFixed(1);
  el.innerHTML = `<h4><span>${KINDS[a.kind].name}（第 ${a.gen} 世代）</span><button type="button" aria-label="とじる" onclick="G.sel=null;updateCard()">×</button></h4>` +
    GENES[a.kind].map(([k, name]) => `<div class="row"><span>${name}</span>${gbar(a.g[k])}</div>`).join('') +
    `<div class="row"><span>おなか</span>${gbar(Math.max(0, a.e / a.tr.eMax))}</div><p>生まれて ${days} 日</p>`;
  el.hidden = false;
}
const DIE_WORD = { caught: 'サギに食べられた', eaten: 'オオカミに食べられた', hunger: '飢えて死んだ', thirst: 'のどがかわいて死んだ', drown: '深い水でおぼれた', fall: '滝から落ちた', dry: '水がなくなって死んだ', old: '年をとって死んだ' };
