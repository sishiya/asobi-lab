'use strict';
// 知らせ・札・天命の書板のグラフ（v011 で横の箱は天命の書板へ）
const $ = id => document.getElementById(id);
// 英語のとき: HTML に書いた title・aria-label を data-en-title・data-en-aria-label の英語に入れかえる。ページの題も（v025。2026-10-13 ユーザー）
if (LANG === 'en') {
  for (const el of document.querySelectorAll('[data-en-title]')) el.title = el.dataset.enTitle;
  for (const el of document.querySelectorAll('[data-en-aria-label]')) el.setAttribute('aria-label', el.dataset.enAriaLabel);
  document.title = 'Edge Falls Garden';
}
let toastT = 0;
function toast(msg, sec = 3) {
  if (sec >= 4) {                     // 4 秒より長い知らせ（ヒント・てびき・季節・見つけたこと）は、メグリが話す（v034）。あとで読み返せる
    logMsg(msg);
    if (G.started && !document.body.classList.contains('ending')) { say(msg); return; }
  }
  const el = $('toast'); el.textContent = msg; el.classList.add('on');
  clearTimeout(toastT); toastT = setTimeout(() => el.classList.remove('on'), sec * 1000);
}

// ---- メグリ（v034。2026-10-13 ユーザー「マスコット的なキャラに喋らせる形」「シンプルでかわいいけど世界の謎を知ってそうな聡明さ」→ ウロボロス） ----
//   自分のしっぽをくわえて輪になった小さな金色のヘビ。この箱庭のきまり「何も生まれず、何も消えない。ただ、めぐるだけ」そのもの。
//   左上のメニューの下にいて、ヒントや知らせを吹き出しで話す（文の長さに合わせて長く残り、押すと消える。続いたら順に）。
//   これまでの話は 40 まで、吹き出しの中を上へスクロールして読み返せる（v033 の吹き出しのボタンと読み返しの札を置きかえた）
const MSGLOG = [];
function logMsg(text) {
  if (!text || (MSGLOG[0] && MSGLOG[0].text === text)) return;
  MSGLOG.unshift({ text, day: typeof W !== 'undefined' && W.day ? W.day : 0 });
  if (MSGLOG.length > 40) MSGLOG.pop();
  SAY.fresh = (SAY.fresh || 0) + 1;
  if (SAY.open) renderSay();
}
// 画素の絵（24×24 の格子を 48px に）。頭は右上、体は時計まわりに輪になり、細いしっぽの先が口に入る。rot で鱗の模様が流れて、輪がめぐって見える
function drawMeguri(ctx, rot, blink) {
  const S = 24, cx = 11.5, cy = 12.8, R = 7.2, HEAD = -Math.PI / 2 + 0.55, TAU = Math.PI * 2;
  const at = (a, r) => [cx + Math.cos(a) * r, cy + Math.sin(a) * r];
  const [hx, hy] = at(HEAD, R + 0.9);                                   // 頭（輪より少し外に）
  const [sx, sy] = at(HEAD - 0.4, R + 0.4);                             // 鼻先（しっぽのがわへ）
  const C = { out: '#3a2414', dark: '#9a6a2c', base: '#d6a64e', lite: '#f2d48c', belly: '#f6e8c4', scale: '#b88838', eye: '#22140c', blush: '#ec9c80', mouth: '#5a2e18' };
  const grid = Array.from({ length: S }, () => Array(S).fill(null));
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const dx = x + 0.5 - cx, dy = y + 0.5 - cy, r = Math.hypot(dx, dy);
    const u = ((Math.atan2(dy, dx) - HEAD) % TAU + TAU) % TAU / TAU;   // 頭で 0、時計まわりにしっぽの先へ 1
    const th = 2.6 - 1.7 * u;                                            // しっぽへ細く
    if (u < 0.87 && Math.abs(r - R) <= th) {
      const lit = (-dx * 0.6 - dy * 0.8) / (r || 1);
      let c = r < R - th * 0.3 ? C.belly : lit > 0.45 ? C.lite : lit < -0.35 ? C.dark : C.base;
      if (c !== C.belly && r > R - 0.3 && (Math.floor(u * 28 + rot) % 2 === 0) && (x + y) % 2 === 0) c = C.scale;   // 鱗
      grid[y][x] = c;
    }
  }
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {            // 頭と鼻先（まるく大きく、上が明るい）
    const px = x + 0.5, py = y + 0.5;
    if (Math.hypot(px - hx, py - hy) <= 3.9 || Math.hypot(px - sx, py - sy) <= 2.7)
      grid[y][x] = py - hy < -1.6 ? C.lite : py - hy > 2.2 ? C.dark : C.base;
  }
  // しっぽの先: 鼻先の口へ入っていく（細い2つの画素）
  for (const k of [0.7, 0.62]) { const [tx, ty] = at(HEAD - k, R); grid[Math.floor(ty)][Math.floor(tx)] = C.dark; }
  // 口: 鼻先の下に、しっぽをくわえた線
  for (const k of [0.52, 0.42, 0.32]) { const [mx, my] = at(HEAD - k, R - 0.6); const yy = Math.floor(my), xx = Math.floor(mx); if (grid[yy] && grid[yy][xx]) grid[yy][xx] = C.mouth; }
  // 目（鼻先のがわに大きく、光つき）とほお
  const ex = Math.round(hx - 2.0), ey = Math.round(hy - 1.8);
  if (blink) { grid[ey + 1][ex] = C.eye; grid[ey + 1][ex + 1] = C.eye; }
  else { grid[ey][ex] = '#ffffff'; grid[ey][ex + 1] = C.eye; grid[ey + 1][ex] = C.eye; grid[ey + 1][ex + 1] = C.eye; }
  if (grid[ey + 2] && grid[ey + 2][ex + 2]) grid[ey + 2][ex + 2] = C.blush;
  ctx.clearRect(0, 0, 48, 48);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    let c = grid[y][x];
    if (!c && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([a, b]) => grid[y + b] && grid[y + b][x + a] && grid[y + b][x + a] !== C.out)) c = C.out;   // 輪郭
    if (c) { ctx.fillStyle = c; ctx.fillRect(x * 2, y * 2, 2, 2); }
  }
}
// 話す（吹き出し）。これまでの話と一つになっていて、新しいものが下、上へスクロールでさかのぼれる（2026-10-13 ユーザー「トグルで出し続けることも」「スクロールで遡れるように」）。
//   メグリを押すと出しっぱなし（もう一度押すとしまう。次に遊ぶときも覚えている）。しまっているあいだに話したときは、文の長さに合わせて 7〜20 秒だけ出る（PLAYTEST #11）。
//   高さは、はじめのカメラで大地にかからないところまで（sayMaxH）
const SAY = { pinned: false, open: false, seen: 0 };
try { SAY.pinned = localStorage.getItem('edge-falls-say-pin') === '1'; } catch (e) { /* 覚えられなくても動く */ }
let sayT = 0;
const sayOpen = () => SAY.open;
function say() {
  if (!$('say')) return;
  openSay(false);
  if (!SAY.pinned) armSay(Math.min(20, Math.max(7, (MSGLOG[0] ? MSGLOG[0].text.length : 0) * 0.13 + 4)));
}
function armSay(sec) { clearTimeout(sayT); sayT = setTimeout(() => { if (!SAY.pinned) closeSay(); }, sec * 1000); }
// はじめのカメラ（寄りなし・まんなか・傾き 0.56）で、吹き出しの横の幅にかかる大地のいちばん上（画面の y）。かからなければ画面の 6 割
function sayMaxH(left, width, top) {
  const cw = V.cw, ch = V.ch; if (!cw) return 220;
  const tilt = 0.56, hf = Math.cos(Math.asin(tilt)) * 0.5;
  const s = Math.min(cw * (ch > cw * 1.3 ? 1.0 : 0.9) / (2 * RD), ch * 0.84 / (2 * RD * tilt + (16 + THICK + 12) * hf));
  const cx = cw / 2, cy = ch * 0.5 - (THICK + 4) * s * hf * 0.6 + (16 * s * hf) * 0.25 + Math.min(36, ch * 0.04);
  const rx = RD * s, near = Math.max(left - cx, Math.min(0, left + width - cx));   // 吹き出しの横の幅で、大地のまんなかにいちばん近い x
  if (Math.abs(near) >= rx) return Math.round(ch * 0.6);
  const yTop = cy - Math.sqrt(1 - (near / rx) ** 2) * rx * tilt - 6 * s * hf;      // 奥のふち（少し高い地形のぶん上に）
  return Math.round(yTop - top - 10);
}
//   幅は 400px から 240px まで、高さが 170px とれる広さをさがす（広い画面では大地の左に細く長く）。左の見る用のボタンにもかからない
function fitSay() {
  if (!V.cw) return;
  const el = $('say'), fr = field.getBoundingClientRect(), top = el.getBoundingClientRect().top - fr.top, left = 8;
  const pad = document.querySelector('.viewpad'), pr = pad ? pad.getBoundingClientRect() : null;
  const padLim = pr && pr.height ? pr.top - fr.top - top - 8 : 1e9;
  const maxW = Math.max(160, Math.min(400, V.cw - (V.cw <= 640 ? 128 : 16)));
  let best = null;
  for (let w = maxW; w >= Math.min(240, maxW); w -= 20) {
    const h = Math.min(sayMaxH(left, w, top), padLim, V.ch * 0.6);
    if (!best || w * h > best.w * best.h) best = { w, h };
    if (h >= 170) { best = { w, h }; break; }
  }
  el.style.width = best.w + 'px'; el.style.maxHeight = Math.max(96, Math.round(best.h)) + 'px';
  // 章のことば（まんなかの上）と横に重なるときは、ことばを吹き出しの下へずらす
  const lineL = V.cw / 2 - Math.min(640, V.cw * 0.92) / 2;
  SAY.over = left + best.w > lineL;
  document.body.style.setProperty('--lineTop', Math.round(top + Math.max(96, best.h) + 24) + 'px');
  document.body.classList.toggle('sayover', SAY.open && SAY.over);
}
function renderSay(stick) {
  const list = $('sayList'); if (!list) return;
  const atEnd = list.scrollHeight - list.scrollTop - list.clientHeight < 24;
  const esc = t => t.replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
  const items = MSGLOG.slice().reverse();
  list.innerHTML = items.length
    ? items.map((m, i) => `<li${SAY.fresh && i === items.length - 1 ? ' class="fresh"' : ''}>${m.day ? `<span>${TX(`第 ${m.day} 日`, `Day ${m.day}`)}</span>` : ''}${esc(m.text)}</li>`).join('')
    : `<li class="none">${TX('まだ何も話していない', 'Nothing yet')}</li>`;
  if (stick || atEnd) list.scrollTop = list.scrollHeight;                // さかのぼって読んでいるときは、動かさない
}
function openSay(pin) {
  if (pin) { SAY.pinned = true; try { localStorage.setItem('edge-falls-say-pin', '1'); } catch (e) { /* */ } clearTimeout(sayT); }
  const el = $('say'), was = SAY.open;
  SAY.open = true; el.hidden = false; $('meguri').classList.add('talk'); $('meguri').classList.toggle('pinned', SAY.pinned); $('meguri').setAttribute('aria-expanded', 'true');
  fitSay(); renderSay(!was);
  requestAnimationFrame(() => el.classList.add('on'));
}
function closeSay(unpin) {
  if (unpin) { SAY.pinned = false; try { localStorage.setItem('edge-falls-say-pin', '0'); } catch (e) { /* */ } }
  clearTimeout(sayT); SAY.open = false; SAY.fresh = 0; document.body.classList.remove('sayover');
  const el = $('say'); if (!el) return;
  el.classList.remove('on'); $('meguri').classList.remove('talk', 'pinned'); $('meguri').setAttribute('aria-expanded', 'false');
  setTimeout(() => { if (!SAY.open) el.hidden = true; }, 250);
}
function clearSay() { closeSay(); renderSay(true); }
addEventListener('DOMContentLoaded', () => {
  const b = document.createElement('button');
  b.type = 'button'; b.className = 'meguri'; b.id = 'meguri';
  b.title = TX('メグリ（押すと話を出しっぱなしに・もう一度でしまう）', 'Meguri (press to keep the talk open, again to close)'); b.setAttribute('aria-label', b.title);
  b.innerHTML = '<canvas width="48" height="48"></canvas>';
  const cx = b.firstChild.getContext('2d');
  let rot = 0, blinkT = 3;
  drawMeguri(cx, 0, false);
  setInterval(() => {                                                    // 輪がめぐる・まばたき（見えているときだけ）
    if (document.hidden || !G.started) return;
    rot = (rot + 1) % 2; blinkT -= 0.4;
    const bl = blinkT < 0; if (blinkT < -0.3) blinkT = 3 + Math.random() * 3;
    drawMeguri(cx, rot, bl);
  }, 400);
  const sb = document.createElement('div');
  sb.className = 'say'; sb.id = 'say'; sb.hidden = true; sb.setAttribute('role', 'log'); sb.setAttribute('aria-live', 'polite'); sb.setAttribute('aria-label', TX('メグリの話', 'What Meguri says'));
  sb.innerHTML = '<ol id="sayList"></ol>';
  $('btnMenu').after(b, sb);
  b.onclick = () => { Sound.unlock(); Sound.play('click'); if (SAY.open && SAY.pinned) closeSay(true); else openSay(true); };
  sb.addEventListener('pointerdown', e => e.stopPropagation());          // 吹き出しの上の操作は世界に渡さない（スクロールで読み返す）
  sb.addEventListener('click', () => { if (!SAY.pinned) closeSay(); });  // 出しっぱなしでないときは、押すとしまう
  sb.addEventListener('pointerenter', e => { if (e.pointerType === 'mouse') clearTimeout(sayT); });
  sb.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse' && SAY.open && !SAY.pinned) armSay(3); });
  sb.addEventListener('wheel', e => e.stopPropagation(), { passive: true });
  addEventListener('resize', () => { if (SAY.open) fitSay(); });
  addEventListener('keydown', e => { if (e.key === 'Escape' && SAY.open && !SAY.pinned) { closeSay(); e.stopImmediatePropagation(); e.preventDefault(); } }, true);
  setInterval(() => { if (G.started && SAY.pinned && !SAY.open && !document.body.classList.contains('ending')) openSay(false); }, 1000);   // 出しっぱなしなら、遊びはじめたら出す
});

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
