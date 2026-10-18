'use strict';
// 知らせ・札・観察帳のグラフ（v011 で横の箱は観察帳へ）
const $ = id => document.getElementById(id);
// 英語のとき: HTML に書いた title・aria-label を data-en-title・data-en-aria-label の英語に入れかえる。ページの題も（v025。2026-10-13 ユーザー）
if (LANG === 'en') {
  for (const el of document.querySelectorAll('[data-en-title]')) el.title = el.dataset.enTitle;
  for (const el of document.querySelectorAll('[data-en-aria-label]')) el.setAttribute('aria-label', el.dataset.enAriaLabel);
  document.title = 'Edge Falls Garden';
}
// 知らせ（v055。2026-10-14 ユーザー「重なると古いほうがすぐ上書きで消されるので、下へ連ねて。先に出たものが消えたら、次のものはパカっとではなく、ふわっと上へ」）:
//   #toast は入れ物（置き場所）で、知らせは一つずつ .tmsg として下へ積む。それぞれ自分の時間で消え、消えるときは
//   うすくなってから高さをちぢめるので、下のものがなめらかに上へよる。同じ文がまだ出ていれば、出ている時間をのばすだけ。いちどに 4 つまで
// 置き場所: はじめから章のことばのすぐ下の高さ（CSS。v054）。章のことばが長くて（スマホで折り返すなど）かかるときだけ、もう少し下へ
function placeToast() {
  const t = $('toast'), l = $('line');
  t.style.top = '';
  if (!l.classList.contains('on') || !l.textContent.trim()) return;
  const lb = l.getBoundingClientRect().bottom + 30, tt = t.getBoundingClientRect().top, fr = field.getBoundingClientRect();
  if (lb > tt) t.style.top = Math.round(lb - fr.top) + 'px';
}
const toastOn = () => !!$('toast').querySelector('.tmsg.on');
function dropToast(el) {
  if (el.dataset.gone) return;
  el.dataset.gone = '1'; clearTimeout(el.tm);
  el.classList.remove('on');                                         // まず、うすく
  setTimeout(() => {                                                 // それから高さをちぢめる（下のものが、ふわっと上へ）
    el.style.height = el.offsetHeight + 'px'; void el.offsetHeight;
    el.classList.add('fold'); el.style.height = '0px';
    setTimeout(() => el.remove(), 640);
  }, 420);
}
function clearToasts() { for (const el of [...$('toast').children]) dropToast(el); }
function toast(msg, sec = 3) {
  const box = $('toast');
  const same = [...box.children].find(el => !el.dataset.gone && el.textContent === msg);
  if (same) { clearTimeout(same.tm); same.tm = setTimeout(() => dropToast(same), sec * 1000); }
  else {
    if (!toastOn()) placeToast();                                    // 何も出ていないときだけ置き場所を決めなおす（出ているあいだは動かさない）
    const live = [...box.children].filter(el => !el.dataset.gone);
    if (live.length >= 4) dropToast(live[0]);
    const el = document.createElement('div'); el.className = 'tmsg'; el.textContent = msg;
    box.appendChild(el); void el.offsetHeight; el.classList.add('on');
    el.tm = setTimeout(() => dropToast(el), sec * 1000);
  }
  if (sec >= 4) logMsg(msg);          // 4 秒より長い知らせ（ヒント・てびき・季節・見つけたこと）は、あとで読み返せる
}

// ---- これまでの知らせ（v049。2026-10-14 ユーザー「吹き出し機能を付ける前の表示にもどしつつ、吹き出し機能自体を刷新。押したときに時間をとめ、
//      画面大きめに。ふわっと出て見逃しがちなメッセージを見返せる。半透明系が圧迫感なくていいかも」） ----
//   知らせはもとの、ふわっと出て消える形（toast）。右下の観察帳の上の吹き出しのボタンを押すと、時が止まり、半透明の大きな札に
//   これまでの知らせ（古いものが上、40 まで。開くといちばん下の新しいものへ）が出る。×・Esc・札の外・もう一度ボタン でとじると、時がもとの速さにもどる。
//   v033〜v048 のためし（メグリ・出しっぱなしの吹き出し）はやめた
const MSGLOG = [];
function logMsg(text, title) {   // title: 章のことばの見出し（「第一の年　水」）。見返しの札で少し目立たせる（v054）
  if (!text || (MSGLOG[0] && MSGLOG[0].text === text)) return;
  MSGLOG.unshift({ text, title, day: typeof W !== 'undefined' && W.day ? W.day : 0 });
  if (MSGLOG.length > 40) MSGLOG.pop();
  if ($('msgbtn')) $('msgbtn').classList.add('new');
}
function drawBubble(ctx) {
  ctx.clearRect(0, 0, 32, 32);
  px(ctx, 3, 3, 10, 7, '#e6dcc4'); px(ctx, 2, 4, 12, 5, '#e6dcc4'); px(ctx, 4, 10, 3, 1, '#e6dcc4'); px(ctx, 4, 11, 1, 2, '#e6dcc4'); px(ctx, 5, 11, 1, 1, '#e6dcc4');   // 吹き出し
  px(ctx, 3, 9, 10, 1, '#b8a888'); px(ctx, 13, 4, 1, 5, '#b8a888');                                                                                      // 影
  for (let k = 0; k < 3; k++) px(ctx, 5 + k * 2, 6, 1, 1, '#5a4636');                                                                                   // …
}
let logSpeed = null;
const logOpen = () => $('msglog') && !$('msglog').hidden;
function openLog() {
  const esc = t => t.replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
  let day = -1;   // 日が変わる所にだけ「第 ◯ 日」の区切り（v051）。古いものが上、新しいものが下（v052。2026-10-14 ユーザー）
  $('msglogList').innerHTML = MSGLOG.length
    ? MSGLOG.slice().reverse().map(m => (m.day !== day && (day = m.day) ? `<li class="day">${TX(`第 ${m.day} 日`, `Day ${m.day}`)}</li>` : '') + (m.title ? `<li class="year"><b>${esc(m.title)}</b><p>${esc(m.text)}</p></li>` : `<li><p>${esc(m.text)}</p></li>`)).join('')
    : `<li class="none"><p>${TX('まだ知らせはない', 'No messages yet')}</p></li>`;
  $('msglog').hidden = false; $('msglogList').scrollTop = $('msglogList').scrollHeight;   // 開いたら、いちばん新しい知らせ（下）へ
  clearToasts();                                                   // いま出ている知らせは札の中にあるので消す
  $('msgbtn').classList.remove('new'); $('msgbtn').setAttribute('aria-expanded', 'true');
  if (G.started && G.speed) { logSpeed = G.speed; setSpeed(0); }   // 読んでいるあいだは時を止める
  requestAnimationFrame(() => $('msglog').classList.add('on'));
  $('msglogClose').focus();
}
function closeLog() {
  if (!logOpen()) return;
  $('msglog').classList.remove('on'); $('msgbtn').setAttribute('aria-expanded', 'false');
  setTimeout(() => { if (!$('msglog').classList.contains('on')) $('msglog').hidden = true; }, 200);
  if (logSpeed !== null && G.speed === 0) setSpeed(logSpeed);
  logSpeed = null;
}
function clearSay() { closeLog(); }   // 新しいゲームのとき（main.js）
addEventListener('DOMContentLoaded', () => {
  const b = document.createElement('button');
  b.type = 'button'; b.className = 'msgbtn'; b.id = 'msgbtn';
  b.title = TX('これまでの知らせ（時が止まる）', 'Recent messages (time stops)'); b.setAttribute('aria-label', b.title);
  b.innerHTML = '<canvas width="32" height="32"></canvas>'; drawBubble(b.firstChild.getContext('2d'));
  const box = document.createElement('div');
  box.className = 'msglog'; box.id = 'msglog'; box.hidden = true; box.setAttribute('role', 'dialog'); box.setAttribute('aria-label', TX('これまでの知らせ', 'Recent messages'));
  box.innerHTML = `<div class="msglogbox"><h3>${TX('これまでの知らせ', 'Recent messages')}</h3>` +
    `<button type="button" class="msglogclose" id="msglogClose" aria-label="${TX('とじる', 'Close')}">×</button><ol id="msglogList"></ol></div>`;
  $('btnBook').before(b);   // 右下に、観察帳の上（2026-10-14 ユーザー。前は左上のメニューの下）
  document.body.appendChild(box);
  b.onclick = () => { Sound.unlock(); Sound.play('click'); if (logOpen()) closeLog(); else openLog(); };
  $('msglogClose').onclick = () => { Sound.play('click'); closeLog(); };
  box.addEventListener('pointerdown', e => { e.stopPropagation(); if (e.target === box) { closeLog(); e.preventDefault(); } });   // 札の外（うすい所）を押すと閉じる
  box.addEventListener('wheel', e => e.stopPropagation(), { passive: true });
  addEventListener('keydown', e => { if (e.key === 'Escape' && logOpen()) { closeLog(); e.stopImmediatePropagation(); e.preventDefault(); } }, true);
});

function showPanel(html, btns, cls) {   // cls: 札の形（'titlecard' など）。ボタンを作る前に付ける（あとから付けると、ふつうの色から移り変わるのが一瞬見える。v067）
  $('panel').className = 'panel' + (cls ? ' ' + cls : ''); G.panelBack = null; document.body.classList.remove('atitle');   // JP／EN はタイトルの札のときだけ（start が付けなおす）   // Esc・札の外でもどる先（入れる札だけが入れる。book.js の goBack）
  $('panel').innerHTML = html;
  const box = document.createElement('div'); box.className = 'btns';
  for (const b of btns) {
    const el = document.createElement('button'); el.type = 'button'; el.className = 'tbtn' + (b.main ? ' main' : '') + (b.cls ? ' ' + b.cls : ''); el.textContent = b.label;
    if (b.sub) { const s = document.createElement('small'); s.textContent = b.sub; el.appendChild(s); }   // ボタンの下の小さな行（タイトルの「第三の年・第 24 日」。v067）
    el.onclick = () => { Sound.unlock(); Sound.play('click'); $('overlay').hidden = true; b.fn && b.fn(); };
    box.appendChild(el);
  }
  $('panel').appendChild(box);
  $('overlay').hidden = false;
  box.querySelector('.main')?.focus({ focusVisible: false });
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
  questLine(s); drawDial(); drawHands(); updateTally(s);
  renderSpecies();
  if (!$('fan').hidden) { const sig = ['deer', 'wolf', 'fish', 'bird', 'human'].map(k => W.stock[k]).join(); if (sig !== G.fanSig) { G.fanSig = sig; syncHands(); } }
  renderBook(); updateCard();
}

// 数の印（v2。PLAYTEST #9・#10「シムシティの需要バーのようにさりげなく」）: 天の輪の下に、来ている生き物だけの細い棒。
//   数字は出さず、絵と長さと色だけ。少ない（青み）・ちょうど（緑）・多すぎ（琥珀）。めぐる世界の年は、足りないものが光る。
//   設定の「数の印」で出す・出さない（localStorage に覚える）
const TALLY_KEY = 'asobi-lab/edge-falls/tally';
let tallyOn = true; try { tallyOn = localStorage.getItem(TALLY_KEY) !== '0'; } catch (e) { /* なし */ }
function setTally(v) { tallyOn = v; try { localStorage.setItem(TALLY_KEY, v ? '1' : '0'); } catch (e) { /* なし */ } updateTally(lastStats); }
// 回す向きの逆転（v070。2026-10-18 ユーザー「カメラ回転の上下と左右をそれぞれ逆転させるオプション」）: 設定の「左右の回転」「上下の回転」。
//   マウス・指でなぞる・2本指でひねる・矢印キーに効く（見る用のボタンは絵の矢印どおりのまま）。localStorage に覚える
const INVERT_KEY = 'asobi-lab/edge-falls/invert';
let invert = { x: false, y: false }; try { Object.assign(invert, JSON.parse(localStorage.getItem(INVERT_KEY) || '{}')); } catch (e) { /* なし */ }
function setInvert(axis, v) { invert[axis] = v; try { localStorage.setItem(INVERT_KEY, JSON.stringify(invert)); } catch (e) { /* なし */ } }
const invX = () => invert.x ? -1 : 1, invY = () => invert.y ? -1 : 1;
const TALLY = [   // [種類, ちょうどの下, ちょうどの上, 棒いっぱいの数]
  ['grass', 15, 65, 80], ['deer', 10, 35, 45], ['wolf', 3, 10, 16], ['fish', 15, 60, 90], ['bird', 3, 10, 14], ['human', 4, 12, 14]];
function updateTally(s) {
  const el = $('tally'); if (!el) return;
  const u = G.unlock || {}, rows = TALLY.filter(([k]) => k === 'grass' ? u.seed : u[k]);
  el.hidden = !tallyOn || !G.started || !rows.length;
  if (el.hidden || !s) return;
  const need = typeof tallyNeed === 'function' ? tallyNeed(s) : null;
  if (el.dataset.sig !== rows.map(r => r[0]).join()) {
    el.dataset.sig = rows.map(r => r[0]).join();
    el.innerHTML = rows.map(([k]) => `<div class="trow" data-k="${k}"><img alt="" src="${k === 'grass' ? iconURL('seed', drawSeed) : iconURL('c' + k, c => drawCreature(c, k))}"><i><b></b></i></div>`).join('');
  }
  for (const [k, lo, hi, full] of rows) {
    const n = k === 'grass' ? Math.round(s.grass * 100) : L.counts[k], r = el.querySelector(`[data-k="${k}"]`);
    r.querySelector('b').style.width = Math.max(n > 0 ? 6 : 0, Math.min(100, n / full * 100)) + '%';
    r.className = 'trow ' + (n < lo ? 'low' : n > hi ? 'many' : 'ok') + (need === k ? ' need' : '');
    r.title = (k === 'grass' ? TX('草', 'Grass') : KINDS[k].name) + (n < lo ? TX('：少ない', ': few') : n > hi ? TX('：多すぎ', ': too many') : TX('：ちょうど', ': about right'));
  }
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
  el.innerHTML = `<h4><span>${TX(`${speciesName(a.kind, a.sp)}（第 ${a.gen} 世代）`, `${speciesName(a.kind, a.sp)} (generation ${a.gen})`)}</span><button type="button" aria-label="${TX('とじる', 'Close')}" onclick="G.sel=null;updateCard()">×</button></h4>` +
    (a.kind === 'human' ? `<p>${TX('村の知恵', 'Village wisdom')}: ${wisdomList() || TX('まだない', 'none yet')}</p>` : `<div class="anc"><canvas id="ancCv" width="168" height="64"></canvas><span>${TX('はじめの姿', 'First form')}</span><span>${TX('この子', 'This one')}</span></div>`) +
    GENES[a.kind].map(([k, name]) => `<div class="row"><span>${name}</span>${gbar(a.g[k])}</div>`).join('') +
    `<div class="row"><span>${TX('おなか', 'Hunger')}</span>${gbar(Math.max(0, a.e / a.tr.eMax))}</div><p>${TX(`生まれて ${days} 日`, `${days} days old`)}</p>`;
  el.hidden = false;
  drawAncestor(a);
}
// はじめの姿（命のつぼから来たころ＝遺伝子がみな 0.5）の影と、この子を並べる（v2。進化を一目で）
function drawAncestor(a) {
  const c = $('ancCv'); if (!c || !style().icon) return;
  const x = c.getContext('2d'); x.clearRect(0, 0, c.width, c.height); x.imageSmoothingEnabled = false;
  const first = { kind: a.kind, g: {} }; for (const [k] of GENES[a.kind]) first.g[k] = 0.5;
  const k = a.kind === 'fish' ? 6 : 5;
  style().icon(x, first, 42, 58, k, true); style().icon(x, a, 126, 58, k, false);
}
const DIE_WORD = TX({ hunted: 'ヒトに狩られた', fished: 'ヒトにとられた', caught: 'サギに食べられた', eaten: 'オオカミに食べられた', hunger: '飢えて死んだ', thirst: 'のどがかわいて死んだ', drown: '深い水でおぼれた', fall: '滝から落ちた', dry: '水がなくなって死んだ', old: '年をとって死んだ' },
  { hunted: 'Hunted by humans', fished: 'Caught by humans', caught: 'Eaten by a heron', eaten: 'Eaten by a wolf', hunger: 'Died of hunger', thirst: 'Died of thirst', drown: 'Drowned in deep water', fall: 'Fell off the falls', dry: 'Died when the water dried up', old: 'Died of old age' });
