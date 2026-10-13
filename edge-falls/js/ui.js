'use strict';
// 知らせ・札・観察の巻物のグラフ（v011 で横の箱は観察の巻物へ）
const $ = id => document.getElementById(id);
// 英語のとき: HTML に書いた title・aria-label を data-en-title・data-en-aria-label の英語に入れかえる。ページの題も（v025。2026-10-13 ユーザー）
if (LANG === 'en') {
  for (const el of document.querySelectorAll('[data-en-title]')) el.title = el.dataset.enTitle;
  for (const el of document.querySelectorAll('[data-en-aria-label]')) el.setAttribute('aria-label', el.dataset.enAriaLabel);
  document.title = 'Edge Falls Garden';
}
let toastT = 0;
function toast(msg, sec = 3) {
  const el = $('toast'); el.textContent = msg; el.classList.add('on');
  clearTimeout(toastT); toastT = setTimeout(() => el.classList.remove('on'), sec * 1000);
  if (sec >= 4) logMsg(msg);          // 4 秒より長い知らせ（ヒント・てびき・季節・見つけたこと）は、あとで読み返せる
}

// ---- 知らせの記録（v033。2026-10-13 ユーザー「直近のヒントは吹き出しっぽいアイコンから読み返せるように」） ----
//   左上のメニューの下の吹き出しを押すと、新しい順に 20 まで。新しい知らせが来たら吹き出しに小さな光
const MSGLOG = [];
function logMsg(text) {
  if (!text || (MSGLOG[0] && MSGLOG[0].text === text)) return;
  MSGLOG.unshift({ text, day: typeof W !== 'undefined' && W.day ? W.day : 0 });
  if (MSGLOG.length > 20) MSGLOG.pop();
  if (!$('msglog')) return;
  if ($('msglog').hidden) $('btnMsg').classList.add('new'); else renderMsgLog();
}
function drawBubble(ctx) {
  ctx.clearRect(0, 0, 32, 32);
  px(ctx, 3, 3, 10, 7, '#e6dcc4'); px(ctx, 2, 4, 12, 5, '#e6dcc4'); px(ctx, 4, 10, 3, 1, '#e6dcc4'); px(ctx, 4, 11, 1, 2, '#e6dcc4'); px(ctx, 5, 11, 1, 1, '#e6dcc4');   // 吹き出し
  px(ctx, 3, 9, 10, 1, '#b8a888'); px(ctx, 13, 4, 1, 5, '#b8a888');                                                                                      // 影
  for (let k = 0; k < 3; k++) px(ctx, 5 + k * 2, 6, 1, 1, '#5a4636');                                                                                   // …
}
addEventListener('DOMContentLoaded', () => {   // px（book.js）が読みこまれてから
  const b = document.createElement('button');
  b.type = 'button'; b.className = 'msgbtn'; b.id = 'btnMsg';
  b.title = TX('これまでの知らせ', 'Recent messages'); b.setAttribute('aria-label', b.title);
  b.innerHTML = '<canvas width="32" height="32"></canvas>'; drawBubble(b.firstChild.getContext('2d'));
  const box = document.createElement('div');
  box.className = 'msglog'; box.id = 'msglog'; box.hidden = true; box.setAttribute('role', 'dialog'); box.setAttribute('aria-label', b.title);
  $('btnMenu').after(b, box);
  b.onclick = () => { Sound.unlock(); Sound.play('click'); if (box.hidden) openMsgLog(); else closeMsgLog(); };
  // 外を押す・Esc で閉じる（世界の操作には渡さない）
  addEventListener('pointerdown', e => { if (!box.hidden && !box.contains(e.target) && !b.contains(e.target)) { closeMsgLog(); e.stopPropagation(); e.preventDefault(); } }, true);
  addEventListener('keydown', e => { if (e.key === 'Escape' && !box.hidden) { closeMsgLog(); e.stopImmediatePropagation(); e.preventDefault(); } }, true);
});
function renderMsgLog() {
  $('msglog').innerHTML = `<h4>${TX('これまでの知らせ', 'Recent messages')}</h4>` + (MSGLOG.length
    ? '<ol>' + MSGLOG.map(m => `<li>${m.day ? `<span>${TX(`第 ${m.day} 日`, `Day ${m.day}`)}</span>` : ''}${m.text.replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]))}</li>`).join('') + '</ol>'
    : `<p>${TX('まだ知らせはない', 'No messages yet')}</p>`);
}
function openMsgLog() { renderMsgLog(); $('msglog').hidden = false; $('btnMsg').classList.remove('new'); $('btnMsg').setAttribute('aria-expanded', 'true'); }
function closeMsgLog() { $('msglog').hidden = true; $('btnMsg').setAttribute('aria-expanded', 'false'); }

function showPanel(html, btns) {
  $('panel').className = 'panel'; G.panelBack = null;   // Esc・札の外でもどる先（入れる札だけが入れる。book.js の goBack）
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
  $('day').textContent = TX(`${yr} 年目の${SEASONS[seasonOf()]}・第 ${W.day} 日`, `Year ${yr}, ${SEASONS[seasonOf()]} · Day ${W.day}`);
  $('hud').textContent = TX(`${SEASONS[seasonOf()]}・${Math.round(W.Tavg ?? 15)}℃`, `${SEASONS[seasonOf()][0].toUpperCase() + SEASONS[seasonOf()].slice(1)} · ${Math.round(W.Tavg ?? 15)}°C`) + (W.Tavg < 2 ? TX('・雪', ' · snow') : '');
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
  $('genGen').textContent = g.n ? TX(`いちばん新しい世代 ${g.gen}`, `Newest generation: ${g.gen}`) : TX('いない', 'none');
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
    el.innerHTML = `<h4><span>${TX(`${KINDS[a.kind].name}（第 ${a.gen} 世代）`, `${KINDS[a.kind].name} (generation ${a.gen})`)}</span><button type="button" aria-label="${TX('とじる', 'Close')}" onclick="G.sel=null;updateCard()">×</button></h4><p>${DIE_WORD[a.how] || TX('いなくなった', 'Gone')}</p>`;
    el.hidden = false; return;
  }
  const days = (a.age / DAY).toFixed(1);
  el.innerHTML = `<h4><span>${TX(`${KINDS[a.kind].name}（第 ${a.gen} 世代）`, `${KINDS[a.kind].name} (generation ${a.gen})`)}</span><button type="button" aria-label="${TX('とじる', 'Close')}" onclick="G.sel=null;updateCard()">×</button></h4>` +
    GENES[a.kind].map(([k, name]) => `<div class="row"><span>${name}</span>${gbar(a.g[k])}</div>`).join('') +
    `<div class="row"><span>${TX('おなか', 'Hunger')}</span>${gbar(Math.max(0, a.e / a.tr.eMax))}</div><p>${TX(`生まれて ${days} 日`, `${days} days old`)}</p>`;
  el.hidden = false;
}
const DIE_WORD = TX({ caught: 'サギに食べられた', eaten: 'オオカミに食べられた', hunger: '飢えて死んだ', thirst: 'のどがかわいて死んだ', drown: '深い水でおぼれた', fall: '滝から落ちた', dry: '水がなくなって死んだ', old: '年をとって死んだ' },
  { caught: 'Eaten by a heron', eaten: 'Eaten by a wolf', hunger: 'Died of hunger', thirst: 'Died of thirst', drown: 'Drowned in deep water', fall: 'Fell off the falls', dry: 'Died when the water dried up', old: 'Died of old age' });
