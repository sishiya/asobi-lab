'use strict';
// 画面（v011。DESIGN.md 4章）: 画面のほとんどは世界。手に持つもの3つ（土ぶくろ・水がめ・命のつぼ）、天の輪（季節と時の速さ）、
//   観察帳（グラフ・遺伝子・水と土・見つけたこと・年・てびき）。数字はなるべく観察帳の中に。
//   見つけたこと（観察の記録）: いまのしくみがすでに起こしている出来事に名前をつける。見つけた瞬間の絵を小さく残す。
//   世界の版画: いまの大地を銅版画の画風で1枚の絵にして保存する。

// ---- 画素の小物の絵（16×16 を 2 倍に。ボクセルの画風に合わせる） ----
function px(ctx, x, y, w, h, c) { ctx.fillStyle = c; ctx.fillRect(x * 2, y * 2, w * 2, h * 2); }
function drawBag(ctx, fill, open) {
  ctx.clearRect(0, 0, 32, 32);
  const h = 6 + Math.round(5 * fill);                 // 中身の量でふくらむ
  const top = 15 - h;
  px(ctx, 4, top + 2, 8, h + 0, '#8a6238'); px(ctx, 3, top + 4, 10, h - 3, '#9b7043');
  px(ctx, 4, 13, 8, 2, '#6e4c2a'); px(ctx, 5, top + 3, 2, h - 2, '#b48756');
  px(ctx, 6, top, 4, 2, open ? '#4a3018' : '#6e4c2a');   // 口
  px(ctx, 5, top + 1, 6, 1, '#d8b070');                  // ひも
  if (open) { px(ctx, 6, top - 2, 1, 1, '#a07a50'); px(ctx, 9, top - 3, 1, 1, '#a07a50'); px(ctx, 7, top - 1, 2, 1, '#8a6238'); }
  else { px(ctx, 7, top - 1, 2, 1, '#d8b070'); }
}
function drawJar(ctx, level) {
  ctx.clearRect(0, 0, 32, 32);
  px(ctx, 6, 1, 4, 2, '#a85a38'); px(ctx, 5, 3, 6, 1, '#7a3e24');
  px(ctx, 4, 4, 8, 10, '#b8673f'); px(ctx, 3, 6, 10, 6, '#b8673f'); px(ctx, 5, 14, 6, 1, '#7a3e24');
  px(ctx, 5, 6, 6, 6, '#3a2418');                       // のぞき窓（中の水）
  const lv = Math.round(6 * Math.max(0, Math.min(1, level)));
  if (lv) { px(ctx, 5, 12 - lv, 6, lv, '#4f8fc8'); px(ctx, 5, 12 - lv, 6, 1, '#9fd0f0'); }
  px(ctx, 4, 5, 1, 7, '#d88a5c');
}
function drawPot(ctx, n, glow) {
  ctx.clearRect(0, 0, 32, 32);
  px(ctx, 5, 2, 6, 2, '#5c6a5a'); px(ctx, 4, 4, 8, 1, '#3e4a3e');
  px(ctx, 3, 5, 10, 8, '#6f7f6c'); px(ctx, 4, 13, 8, 2, '#4f5c4d'); px(ctx, 2, 7, 12, 4, '#6f7f6c');
  px(ctx, 3, 6, 1, 6, '#93a58e');
  const dots = Math.min(6, n);
  for (let k = 0; k < dots; k++) px(ctx, 4 + (k % 3) * 3, 7 + ((k / 3) | 0) * 3, 2, 2, glow ? '#fff2b0' : '#e8d890');
}
function drawBook(ctx) {
  ctx.clearRect(0, 0, 32, 32);
  px(ctx, 1, 4, 7, 10, '#e9dcb8'); px(ctx, 8, 4, 7, 10, '#f4ead0'); px(ctx, 7, 4, 2, 11, '#6e4c2a');
  px(ctx, 1, 14, 14, 1, '#6e4c2a');
  for (let k = 0; k < 4; k++) { px(ctx, 2, 6 + k * 2, 4, 1, '#a08a64'); px(ctx, 10, 6 + k * 2, 4, 1, '#a08a64'); }
  px(ctx, 11, 2, 2, 5, '#b04a2a');
}
function drawSeed(ctx) { ctx.clearRect(0, 0, 32, 32); px(ctx, 7, 4, 2, 6, '#6aa84f'); px(ctx, 4, 5, 3, 2, '#8fcf6a'); px(ctx, 9, 3, 3, 2, '#8fcf6a'); px(ctx, 5, 10, 6, 3, '#8a6238'); }
function drawCreature(ctx, kind) {
  ctx.clearRect(0, 0, 32, 32);
  if (kind === 'deer') { px(ctx, 4, 7, 7, 3, '#c08040'); px(ctx, 10, 4, 3, 3, '#c08040'); px(ctx, 11, 2, 1, 2, '#6e4c2a'); px(ctx, 13, 1, 1, 3, '#6e4c2a'); px(ctx, 4, 10, 1, 3, '#8a5a2a'); px(ctx, 9, 10, 1, 3, '#8a5a2a'); }
  else if (kind === 'wolf') { px(ctx, 3, 7, 8, 3, '#7d8597'); px(ctx, 10, 5, 4, 3, '#7d8597'); px(ctx, 10, 4, 1, 1, '#5a6070'); px(ctx, 12, 4, 1, 1, '#5a6070'); px(ctx, 1, 6, 2, 1, '#7d8597'); px(ctx, 4, 10, 1, 3, '#5a6070'); px(ctx, 9, 10, 1, 3, '#5a6070'); }
  else if (kind === 'fish') { px(ctx, 4, 6, 7, 4, '#ef9a4a'); px(ctx, 2, 5, 2, 6, '#d8803a'); px(ctx, 9, 7, 1, 1, '#3a2418'); }
  else if (kind === 'bird') { px(ctx, 6, 6, 4, 4, '#9ab4cc'); px(ctx, 9, 2, 2, 4, '#9ab4cc'); px(ctx, 11, 3, 3, 1, '#e8b040'); px(ctx, 7, 10, 1, 4, '#5a6070'); px(ctx, 9, 10, 1, 4, '#5a6070'); }
}
const iconURL = (() => { const cache = {}; return (key, fn) => { if (!cache[key]) { const c = document.createElement('canvas'); c.width = c.height = 32; fn(c.getContext('2d')); cache[key] = c.toDataURL(); } return cache[key]; }; })();

// ---- 手に持つもの ----
const LIFE_SUBS = [['seed', 'たね'], ['deer', 'シカ'], ['wolf', 'オオカミ'], ['fish', 'サカナ'], ['bird', 'サギ']];
function toolOf() {
  if (G.hand === 'soil') return G.sub.soil;
  if (G.hand === 'water') return 'spring';
  if (G.hand === 'life') return G.sub.life === 'seed' ? 'grass' : G.sub.life;
  return 'look';
}
function setHand(h) {
  G.hand = h; G.tool = toolOf();
  cv.classList.toggle('tool', !!h);
  const cur = { dig: ['bagd', c => drawBag(c, 0.5, false)], raise: ['bagr', c => drawBag(c, 0.8, true)], spring: ['jar', c => drawJar(c, 0.7)], grass: ['seed', drawSeed] }[G.tool] ||
    (KINDS[G.tool] ? ['c' + G.tool, c => drawCreature(c, G.tool)] : null);
  cv.style.cursor = cur ? `url(${iconURL(cur[0], cur[1])}) 4 28, crosshair` : '';
  syncHands();
}
function syncHands() {
  const u = G.unlock || {};
  const map = { soil: u.soil, water: u.water, life: u.seed };
  document.querySelectorAll('.hand').forEach(b => {
    const k = b.dataset.hand;
    b.hidden = !map[k];
    b.setAttribute('aria-pressed', G.hand === k);
  });
  $('btnBook').hidden = !G.started;
  drawHands();
  // 手に持っているものの中身（扇のように上に並ぶ）
  const fan = $('fan');
  if (G.hand === 'soil' || G.hand === 'life') {
    const items = G.hand === 'soil' ? [['dig', '土をけずる'], ['raise', '土を盛る']] : LIFE_SUBS.filter(([k]) => k === 'seed' || u[k]);
    fan.innerHTML = items.map(([k, label]) => {
      const n = KINDS[k] ? `<em>${W.stock[k]}</em>` : k === 'raise' ? `<em id="soilN">${Math.floor(W.soil)}</em>` : '';
      const ic = k === 'dig' ? iconURL('bagd', c => drawBag(c, 0.5, false)) : k === 'raise' ? iconURL('bagr', c => drawBag(c, 0.8, true)) : k === 'seed' ? iconURL('seed', drawSeed) : iconURL('c' + k, c => drawCreature(c, k));
      return `<button type="button" data-sub="${k}" aria-pressed="${G.sub[G.hand] === k}"${KINDS[k] && W.stock[k] <= 0 ? ' class="empty"' : ''}><img src="${ic}" alt="">${label}${n}</button>`;
    }).join('');
    const hb = document.querySelector(`.hand[data-hand="${G.hand}"]`), r = hb.getBoundingClientRect(), fr = field.getBoundingClientRect();
    fan.style.left = Math.max(8, r.left - fr.left + r.width / 2) + 'px';
    fan.hidden = false; document.body.classList.add('fan-open');
    const fw = fan.offsetWidth, cxp = r.left - fr.left + r.width / 2;   // 画面からはみ出さないように
    fan.style.left = Math.max(fw / 2 + 8, Math.min(fr.width - fw / 2 - 8, cxp)) + 'px';
    fan.querySelectorAll('[data-sub]').forEach(b => b.onclick = () => { G.sub[G.hand] = b.dataset.sub; setHand(G.hand); Sound.play('click'); });
  } else { fan.hidden = true; document.body.classList.remove('fan-open'); }
}
let handSig = '';
function drawMeters() {
  $('soilMeter').style.width = Math.min(100, W.soil / SOIL_FULL * 100) + '%';
  $('waterMeter').style.width = Math.min(100, W.abyss / 1300 * 100) + '%';
  const n = $('soilN'); if (n) n.textContent = Math.floor(W.soil);
  const bag = document.querySelector('.hand[data-hand="soil"]');
  bag.classList.toggle('empty', W.soil < 1);
}
const SOIL_FULL = 300;
function drawHands() {
  drawMeters();
  const lifeN = ['deer', 'wolf', 'fish', 'bird'].reduce((s, k) => s + ((G.unlock || {})[k] ? W.stock[k] : 0), 0);
  const sig = [Math.round(W.soil / 15), Math.round(W.abyss / 60), lifeN, G.sub.soil].join();
  if (sig === handSig) return; handSig = sig;
  for (const b of document.querySelectorAll('.hand')) {
    const c = b.querySelector('canvas').getContext('2d');
    if (b.dataset.hand === 'soil') drawBag(c, Math.min(1, W.soil / SOIL_FULL), G.sub.soil === 'raise');
    else if (b.dataset.hand === 'water') drawJar(c, Math.min(1, W.abyss / 1000));
    else drawPot(c, lifeN + 1, lifeN > 0);
  }
}
document.querySelectorAll('.hand').forEach(b => b.addEventListener('click', () => {
  Sound.unlock();
  const k = b.dataset.hand;
  b.classList.remove('glow');
  setHand(G.hand === k ? null : k); Sound.play(G.hand ? 'grab' : 'release');
  G.did.hand = 1;
}));
function glowHand(key) {
  const h = key === 'water' ? 'water' : key === 'soil' ? 'soil' : key === 'genes' ? null : 'life';
  const el = h ? document.querySelector(`.hand[data-hand="${h}"]`) : $('btnBook');
  if (el) { el.classList.remove('glow'); void el.offsetWidth; el.classList.add('glow'); }
}
(() => { const c = $('btnBook').querySelector('canvas').getContext('2d'); drawBook(c); })();
// メニューの印（画素の巻物の三本線）
(() => { const c = $('btnMenu').querySelector('canvas').getContext('2d'); for (let k = 0; k < 3; k++) { px(c, 3, 4 + k * 4, 10, 2, '#e6dcc4'); px(c, 3, 5 + k * 4, 10, 1, '#a08260'); } })();

// ---- メニュー（Esc。2026-10-13 ユーザー「Esc で中央にメニュー。セーブ・ロード・ゲームの終了」）。開いているあいだは時を止める ----
let menuSpeed = null;
function openMenu() {
  if (!G.started || COL || ENDING) return;
  closeBook();
  if (menuSpeed === null) { menuSpeed = G.speed; setSpeed(0); }
  const resume = () => { if (menuSpeed !== null) { setSpeed(menuSpeed); menuSpeed = null; } };
  G.menuOpen = true;
  showPanel(`<p class="mtitle">${isFree() ? '自由な箱庭' : YEARNAME[Math.floor(G.ch)] + 'の年'}　第 ${W.day} 日</p>`, [
    { label: 'つづける', main: true, fn: closeMenu },
    { label: 'セーブ', fn: () => { G.menuOpen = false; openSavePanel(() => openMenu(), 'save'); } },
    { label: 'ロード', fn: () => { G.menuOpen = false; openSavePanel(() => openMenu(), 'load'); } },
    { label: '観察帳', fn: () => { G.menuOpen = false; resume(); openBook(null, true); } },
    { label: '設定', fn: () => { G.menuOpen = false; openSettings(() => openMenu()); } },
    { label: 'タイトルへ', fn: () => { G.menuOpen = false; toTitle(); } },
    { label: 'ゲームを終える', fn: () => { G.menuOpen = false; quitGame(); } },
  ]);
  $('panel').classList.add('menu', 'world');
}
function closeMenu() {
  $('overlay').hidden = true; G.menuOpen = false;
  if (menuSpeed !== null) { setSpeed(menuSpeed); menuSpeed = null; }
}
// ひとつ前へもどる（Esc・札の外を押したとき）。2026-10-13 ユーザー「メニューのサブメニューも ESC キーで一段戻れるように」
//   大きな絵 → 観察帳（メニューから開いたならメニューへ）→ メニューの下の札（G.panelBack）→ メニューを閉じる。
//   タイトルやエンディングの札には、もどる先がない（false）
function goBack() {
  if (!$('lightbox').hidden) { closeLightbox(); return true; }
  if (!$('book').hidden) { const m = bookFromMenu; closeBook(); if (m) openMenu(); return true; }
  if ($('overlay').hidden) return false;
  if (G.menuOpen) { closeMenu(); return true; }
  if (G.panelBack) { G.panelBack(); return true; }
  return false;
}
// 札の外（何もない所）を押すと、ひとつ前へ（2026-10-13 ユーザー）
$('overlay').addEventListener('click', e => { if (e.target === $('overlay') && goBack()) Sound.play('click'); });
// タイトルへ（2026-10-13 ユーザー「メニューの最初からの代わりにタイトルに戻れるように」）。いまの世界は自動セーブに残す
//   セーブしないでもどることもできる（2026-10-13 ユーザー）。そのときは自動セーブも書きかえない（前に残った所から「つづきから」）
function toTitle() {
  const go = async save => {
    if (save) await saveSlot('auto');
    G.started = false;                 // ページを閉じたときの自動セーブも、もうしない
    menuSpeed = null; setHand(null); closeBook(); G.sel = null; updateCard(); setSpeed(1);
    newGame(); layout(V.cw, V.ch);    // タイトルのうしろは、ひらいたときと同じ新しい大地に（2026-10-13 ユーザー「箱庭が切り替わってない」）
    document.body.classList.remove('paused'); chapterLine('', ''); start();
  };
  showPanel('<h2>タイトルへ</h2><p class="center">セーブすると、いまの世界を自動セーブに残す。<br>タイトルの「つづきから」で、ここにもどれる。<br>セーブしないと、前に残った所までになる。</p>', [
    { label: 'セーブしてタイトルへ', main: true, fn: () => go(true) },
    { label: 'セーブしないでタイトルへ', fn: () => go(false) },
    { label: 'もどる', fn: () => openMenu() },
  ]);
  $('panel').classList.add('world'); G.panelBack = openMenu;
}
// 設定（v016。2026-10-13 ユーザー「設定メニューを追加して」「メニューには文字フォント切り替えは必要ない。設定画面に移して」）
//   音楽・効果音・文字・背景（v017 で観察帳のてびきから移した）。押すとその場で切りかわる。back があれば「もどる」でそこへ（メニュー）
function openSettings(back, focus) {
  const on = v => v ? 'オン' : 'オフ', again = k => () => openSettings(back, k);
  const bi = BACK_CHOICES.findIndex(([k]) => k === backName);
  showPanel('<p class="mtitle">設定</p>', [
    { label: '音楽　' + on(Sound.get('bgm')), fn: () => { Sound.set('bgm', !Sound.get('bgm')); again(0)(); } },
    { label: '効果音　' + on(Sound.get('sfx')), fn: () => { Sound.set('sfx', !Sound.get('sfx')); again(1)(); } },
    { label: '文字　' + (fontName === 'dot' ? 'ドット' : '明朝'), fn: () => { setFont(fontName === 'dot' ? 'serif' : 'dot'); again(2)(); } },
    { label: '背景　' + (bi >= 0 ? BACK_CHOICES[bi][1] : 'ほか'), fn: () => { setBack(BACK_CHOICES[(bi + 1) % BACK_CHOICES.length][0]); again(3)(); } },
    { label: back ? 'もどる' : 'とじる', main: true, fn: () => { if (back) back(); } },
  ]);
  $('panel').classList.add('menu', 'world');
  G.panelBack = back || (() => { $('overlay').hidden = true; });
  if (focus !== undefined) $('panel').querySelectorAll('.btns .tbtn')[focus]?.focus();   // 押したボタンに印を残す（上下の矢印でつづけて選べる）
}
function quitGame() {
  showPanel('<h2>ゲームを終える</h2><p class="center">いまの世界は自動セーブに残してから、<br>あそびラボの保管庫へもどる。<br>つぎに開くと「つづきから」遊べる。</p>', [
    { label: 'セーブして終える', main: true, fn: async () => { await saveSlot('auto'); location.href = '../archive.html'; } },
    { label: 'もどる', fn: () => openMenu() },
  ]);
  $('panel').classList.add('world'); G.panelBack = openMenu;
}
// 文字（2026-10-13 ユーザー「ピクセル風のフォント」「いまのフォントも雰囲気に合うので切りかえられると」）。
//   ドット＝DotGothic16（Google Fonts、SIL Open Font License。商用も無料）、明朝＝これまでの文字。localStorage に覚える
//   はじめは明朝（2026-10-13 ユーザー「デフォルトはきれいなフォントに」）。v014 で 'font' に覚えた値は使わない
const FONT_KEY = 'asobi-lab/edge-falls/font2';
let fontName = 'serif';
try { fontName = localStorage.getItem(FONT_KEY) || 'serif'; } catch (e) { /* なし */ }
function setFont(n, keep) {
  fontName = n === 'dot' ? 'dot' : 'serif';
  document.body.classList.toggle('font-dot', fontName === 'dot');
  if (!keep) try { localStorage.setItem(FONT_KEY, fontName); } catch (e) { /* なし */ }
}
setFont(fontName, true);
// メニューの中は上下の矢印でえらぶ
addEventListener('keydown', e => {
  if ($('overlay').hidden || !(e.key === 'ArrowDown' || e.key === 'ArrowUp')) return;
  const bs = [...$('panel').querySelectorAll('button')]; if (!bs.length) return;
  const i = bs.indexOf(document.activeElement);
  bs[(i + (e.key === 'ArrowDown' ? 1 : -1) + bs.length) % bs.length].focus(); e.preventDefault(); e.stopImmediatePropagation();
}, true);
$('btnMenu').onclick = () => { Sound.unlock(); Sound.play('click'); openMenu(); };

// ---- 天の輪（季節と時の速さ） ----
// 画素の天の輪（v011 のあと。2026-10-13 ユーザー「下のアイコンは感じがいいので、右上も色味とルックに統一感を」「小さくて最初よく見えなかった」）
//   30×30 の画素。外の輪＝1年（春・夏・秋・冬の土の色に近い落ち着いた色。いまの季節だけ明るい）、まわりは真鍮のふち、
//   中は深淵の夜空に、平らな大地と太陽・月の点。針＝今日。止めているときは真ん中に ❚❚。
// 2026-10-13 ユーザー「色味をおさえて（土水命とおなじような淡さ）」「最初の版との中間くらいの粗さに」→ 48×48 の画素（1 画素＝2px）、
//   季節は土の色に寄せた淡い色、いまの季節だけ少し明るい。夜空はのっぺりさせず、ふちは影で丸みを出す
const DIAL_N = 48;
const SEASON_PX = [['#c9a7a4', '#8e7a76'], ['#a3b48a', '#76835f'], ['#c8a272', '#8f7655'], ['#aeb8c2', '#7f8892']];
function drawDial() {
  const cvd = $('dialCv'), c = cvd.getContext('2d'), Np = DIAL_N, cx = Np / 2 - 0.5, cy = Np / 2 - 0.5, R = Np / 2 - 0.5;
  c.clearRect(0, 0, cvd.width, cvd.height);
  const p = seasonPhase(), se = seasonOf();
  const r1 = R, r2 = R - 1.4, r3 = R * 0.72, r4 = r3 - 1.4;      // 外のふち・季節の輪・内のふち・夜空
  for (let y = 0; y < Np; y++) for (let x = 0; x < Np; x++) {
    const dx = x - cx, dy = y - cy, d = Math.hypot(dx, dy);
    if (d > r1) continue;
    const lit = 0.88 + 0.12 * (-(dx + dy) / (R * 1.4));            // 左上から光
    let col;
    if (d > r2) col = '#5a4030';
    else if (d > r3) {
      const a = ((Math.atan2(dy, dx) + Math.PI / 2) / (Math.PI * 2) + 1) % 1, k = Math.floor(a * 4) % 4;
      col = SEASON_PX[k][k === se ? 0 : 1];
      if (Math.abs(a * 4 - Math.round(a * 4)) < 0.022) col = '#5a4030';
      if (k === se && d > r2 - 1) col = '#e6dcc4';
    } else if (d > r4) col = '#a08260';
    else col = hash2(x * 3, y * 7) > 0.965 ? '#56607a' : (d < r4 * 0.55 ? '#1a2238' : '#151c30');
    c.fillStyle = col; c.globalAlpha = 1; c.fillRect(x * 2, y * 2, 2, 2);
    if (lit !== 1) { c.fillStyle = lit > 1 ? `rgba(255,248,230,${(lit - 1) * 0.9})` : `rgba(0,0,0,${(1 - lit) * 0.9})`; c.fillRect(x * 2, y * 2, 2, 2); }
  }
  const P = (x, y, w, h, col) => { c.fillStyle = col; c.fillRect(Math.round(x) * 2, Math.round(y) * 2, w * 2, h * 2); };
  // まん中の平らな大地（小さな円盤と滝のしずく）
  P(cx - 4, cy - 1, 9, 2, '#8ea070'); P(cx - 3, cy - 2, 7, 1, '#a4b484'); P(cx - 3, cy + 1, 7, 1, '#7a6048'); P(cx - 1, cy + 2, 3, 1, '#5e4836'); P(cx + 3, cy + 2, 1, 2, '#9cb8cc');
  // 太陽と月（見ている向きに合わせて回る）
  const at = (a, r) => [cx + Math.cos(a) * r, cy + Math.sin(a) * r];
  const [mx, my] = at(W.moon.a - V.yaw - Math.PI / 2, r4 * 0.68); P(mx - 1, my - 1, 2, 2, '#d8dce0');
  const [sx, sy] = at(W.sun.a - V.yaw - Math.PI / 2, r4 * 0.68 * (W.rs / RS)); P(sx - 1, sy - 1, 3, 3, '#e8c870'); P(sx, sy, 1, 1, '#f6e6b0');
  // 針（今日）
  const na = -Math.PI / 2 + p * Math.PI * 2;
  for (let r = r3 - 1; r <= r2; r += 0.7) { const [x, y] = at(na, r); P(x, y, 1, 1, '#f0e6cc'); }
  if (G.speed === 0) { P(cx - 4, cy - 6, 3, 12, 'rgba(236,226,200,.9)'); P(cx + 2, cy - 6, 3, 12, 'rgba(236,226,200,.9)'); }
}
// 速さの印（真鍮の小さな札。手に持つものと同じ画素の絵）
function drawSpeedIcon(ctx, v) {
  ctx.clearRect(0, 0, 32, 32);
  px(ctx, 3, 3, 10, 10, '#5a4030'); px(ctx, 2, 4, 12, 8, '#5a4030'); px(ctx, 4, 2, 8, 12, '#5a4030');   // 天の輪と同じ淡い真鍮
  px(ctx, 3, 4, 10, 8, '#a08a6c'); px(ctx, 4, 3, 8, 10, '#a08a6c'); px(ctx, 4, 4, 8, 1, '#c8b494');
  const ink = '#3a2a1c';
  if (v === 0) { px(ctx, 5, 5, 2, 6, ink); px(ctx, 9, 5, 2, 6, ink); return; }
  const n = v === 1 ? 1 : v === 4 ? 2 : 3, w = 3, x0 = 8 - Math.round(n * w / 2);
  for (let k = 0; k < n; k++) { const x = x0 + k * w; px(ctx, x, 5, 1, 6, ink); px(ctx, x + 1, 6, 1, 4, ink); px(ctx, x + 2, 7, 1, 2, ink); }
}
document.querySelectorAll('.speeds [data-speed]').forEach(b => drawSpeedIcon(b.querySelector('canvas').getContext('2d'), +b.dataset.speed));

$('dialBtn').addEventListener('click', () => { Sound.unlock(); bookSpeed = null; setSpeed(G.speed ? 0 : (G.lastSpeed || 1)); Sound.play('pin'); G.did.speed = 1; });

// ---- ことば（章のはじめ） ----
let lineT = 0;
function chapterLine(a, b, sec = 7) {
  $('lineA').textContent = a; $('lineB').textContent = b;
  const el = $('line'); el.classList.toggle('on', !!(a || b));
  clearTimeout(lineT); if (a || b) lineT = setTimeout(() => el.classList.remove('on'), sec * 1000);
}

// ---- 観察帳 ----
// ひらいているあいだは時を止める（2026-10-13 ユーザー）。閉じると、もとの速さへ（ひらいたまま速さを変えたら、そのまま）
let page = 'life', bookSpeed = null, bookFromMenu = false;
function openBook(p, fromMenu) {
  if (p) page = p;
  if ($('book').hidden) {
    bookFromMenu = !!fromMenu;
    if (G.started && bookSpeed === null && menuSpeed === null) { bookSpeed = G.speed; setSpeed(0); }
  }
  $('book').hidden = false; G.did.book = 1;
  document.querySelectorAll('.tabs [data-page]').forEach(b => b.setAttribute('aria-selected', b.dataset.page === page));
  document.querySelectorAll('.page').forEach(s => { s.hidden = s.dataset.page !== page; });
  renderBook();
}
function closeBook() {
  if ($('book').hidden) return;
  $('book').hidden = true; closeLightbox(); bookFromMenu = false;
  if (bookSpeed !== null) { if (G.speed === 0) setSpeed(bookSpeed); bookSpeed = null; }
}
$('btnBook').onclick = () => { Sound.unlock(); Sound.play('click'); $('btnBook').classList.remove('glow'); $('book').hidden ? openBook() : closeBook(); };
$('bookClose').onclick = closeBook;
document.querySelectorAll('.tabs [data-page]').forEach(b => b.onclick = () => { Sound.play('click'); openBook(b.dataset.page); });
function renderBook() {
  if ($('book').hidden) return;
  const u = G.unlock || {};
  if (page === 'life') drawChart();
  if (page === 'genes') { $('genesLocked').hidden = !!u.genes; $('genesBody').hidden = !u.genes; if (u.genes) { updateGenes(); drawGeneChart(); } }
  if (page === 'finds') renderFinds();
  if (page === 'years') renderYears();
  document.querySelectorAll('.legend [data-k]').forEach(el => { el.hidden = !u[el.dataset.k]; });
  $('stockTxt').textContent = ['deer', 'wolf', 'fish', 'bird'].filter(k => u[k]).map(k => KINDS[k].name + ' ' + W.stock[k]).join('・') || 'まだからっぽ';
}
function renderYears() {
  const rows = CHAPTERS.map((c, n) => {
    const d = G.done && G.done[n];
    if (d) return `<li class="done"><b>${YEARNAME[n]}の年　${c.title}</b><span>第 ${d.day} 日にできた</span>${d.what ? `<p>${d.what}</p>` : ''}<p>${c.truth}</p></li>`;
    if (n === Math.floor(G.ch)) return `<li class="now"><b>${YEARNAME[n]}の年　${c.title}</b><span>いまの年</span><p>${c.text}</p>${G.helped ? `<p class="hint">${c.hint}</p>` : ''}</li>`;
    return `<li class="later"><b>${YEARNAME[n]}の年</b><span>……</span></li>`;
  }).join('');
  $('years').innerHTML = rows + (isFree() ? '<li class="done"><b>そして</b><span>十の年がめぐった</span><p>ここからは自由な箱庭。</p></li>' : '');
}

// ---- 見つけたこと（観察の記録） ----
const FINDS = [
  ['fall', '果ての滝', '水が、世界の果てから落ちていった。', s => s.out > 0.3],
  ['mist', '霧の雲', '滝のしぶきが、のぼって雲になった。', () => W.flags.mist],
  ['mrain', '山の雨', '山にぶつかった雲が、雨をふらせた。', () => W.flags.mrain],
  ['abyss', '深淵の底', '深淵の水が、底をつきかけた。泉が細くなる。', () => W.abyss < 60 && W.springs.length > 0],
  ['green', '緑の原', '草が、大地の一割をおおった。', s => s.grass > 0.1],
  ['tree', 'はじめての木', '草の茂った乾いた所に、木が育った。', () => G.maxTree > 0.7],
  ['born', 'はじめての子', '大地で、はじめて子が生まれた。', () => L.born > 0],
  ['snow', '初雪', '寒い山に、雪がつもった。', () => G.snowy],
  ['ice', '氷', '水が凍った。凍った水は流れない。', () => G.icy],
  ['swim', '泳ぐシカ', 'シカが、深い水を泳ぎわたった。', () => W.flags.swim],
  ['giveup', '逃げきった', 'オオカミが、シカを追いきれなかった。', () => W.flags.giveup],
  ['fallen', '果てへ', '流された生き物が、滝から落ちていった。', () => L.fell > 0],
  ['catch', 'サギの漁', 'サギが、浅瀬でサカナをとった。', () => L.why['fish:caught'] > 0],
  ['return', '帰ってきた命', '去った命が、深淵からつぼへ戻ってきた。', () => W.flags.ret],
  ['gen10', '十代目', '第 10 世代の子が生まれた。', () => W.flags.gen10],
];
const SKETCH_KEY = 'asobi-lab/edge-falls/sketch';
let sketches = {}; try { sketches = JSON.parse(localStorage.getItem(SKETCH_KEY) || '{}'); } catch (e) { sketches = {}; }
let accFind = 0, wantSketch = null;
function stepFinds(s, dt) {
  if (!G.started || COL || THUMB) return;
  accFind += dt; if (accFind < 0.5) return; accFind = 0;
  let mt = 0; for (const i of INS) if (W.tree[i] > mt) mt = W.tree[i]; G.maxTree = mt;
  if (!G.snowy || !G.icy) for (const i of INS) { if (W.snow[i] > 0.05) G.snowy = 1; if (W.ice[i]) G.icy = 1; }
  G.found = G.found || {};
  for (const [id, title, text, test] of FINDS) {
    if (G.found[id] || !test(s)) continue;
    G.found[id] = { day: W.day };
    toast(`見つけた　${title}　— ${text}`, 5); Sound.play('put');
    wantSketch = id;
    $('btnBook').classList.remove('glow'); void $('btnBook').offsetWidth; $('btnBook').classList.add('glow');
    break;                              // 一度に一つずつ
  }
}
// 見つけた瞬間の絵（セピアは CSS で）。v017: 画面を切り取るのをやめて、大地全体が入る向きで別に描く
//   （寄ったり動かしたりしていると、切り取りが画面の外にはみ出して黒くなったり、大地が端に寄ったりしていた）。
//   いまの見る向き・傾きのまま、寄りと平行移動だけもとに。大きく見せられるよう 540×360 で残す
function takeSketch(t) {
  if (!wantSketch) return;
  const id = wantSketch; wantSketch = null;
  const keep = { cw: V.cw, ch: V.ch, zoom: V.zoom, panX: V.panX, panY: V.panY, sel: G.sel };
  try {
    const W0 = 720, H0 = 480, big = document.createElement('canvas'); big.width = W0; big.height = H0;
    const o = big.getContext('2d');
    G.sel = null; V.zoom = 1; V.panX = V.panY = 0; layout(W0, H0);
    for (let k = 0; k < 2; k++) { V.dirty = true; o.clearRect(0, 0, W0, H0); drawWorld(o, t, null); }
    const c = document.createElement('canvas'); c.width = 540; c.height = 360;
    const cx = c.getContext('2d'); cx.imageSmoothingQuality = 'high'; cx.drawImage(big, 0, 0, 540, 360);
    sketches[id] = c.toDataURL('image/jpeg', 0.8);
    localStorage.setItem(SKETCH_KEY, JSON.stringify(sketches));
  } catch (e) { /* 残せなくても遊べる */ }
  finally { G.sel = keep.sel; V.zoom = keep.zoom; V.panX = keep.panX; V.panY = keep.panY; layout(keep.cw, keep.ch); }
}
function addPage() { /* 年の頁は G.done から作るので、ここでは観察帳の印だけ */ $('btnBook').classList.remove('glow'); void $('btnBook').offsetWidth; $('btnBook').classList.add('glow'); }
function renderFinds() {
  const f = G.found || {};
  $('findN').textContent = `${Object.keys(f).length} ／ ${FINDS.length}`;
  $('finds').innerHTML = FINDS.map(([id, title, text]) => f[id]
    ? `<figure>${sketches[id] ? `<button type="button" class="shot" data-find="${id}" aria-label="${title}の絵を大きく見る"><img src="${sketches[id]}" alt=""></button>` : '<div class="blank"></div>'}<figcaption><b>${title}</b><span>第 ${f[id].day} 日</span><p>${text}</p></figcaption></figure>`
    : '<figure class="unfound"><div class="blank">？</div><figcaption><b>まだ見ていない</b></figcaption></figure>').join('');
}
// 見つけたことの絵を大きく（2026-10-13 ユーザー「クリックしたら世界観にマッチする枠をつけて大きく表示」）。
//   観察帳と同じ羊皮紙の台紙に二重の墨の線。押す・Esc で閉じる。←→ でとなりの絵へ
let lbId = null;
$('finds').addEventListener('click', e => { const b = e.target.closest('[data-find]'); if (b) { Sound.play('click'); openLightbox(b.dataset.find); } });
function openLightbox(id) {
  const f = FINDS.find(x => x[0] === id), d = (G.found || {})[id];
  if (!f || !d || !sketches[id]) return;
  lbId = id;
  $('lbImg').src = sketches[id]; $('lbTitle').textContent = f[1]; $('lbDay').textContent = `第 ${d.day} 日`; $('lbText').textContent = f[2];
  $('lightbox').hidden = false;
}
function closeLightbox() { $('lightbox').hidden = true; lbId = null; }
function stepLightbox(dir) {
  const ids = FINDS.map(x => x[0]).filter(k => (G.found || {})[k] && sketches[k]);
  const i = ids.indexOf(lbId); if (i < 0 || ids.length < 2) return;
  openLightbox(ids[(i + dir + ids.length) % ids.length]); Sound.play('click');
}
$('lightbox').addEventListener('click', () => { closeLightbox(); Sound.play('click'); });
addEventListener('keydown', e => {
  if ($('lightbox').hidden || !(e.key === 'ArrowLeft' || e.key === 'ArrowRight')) return;
  stepLightbox(e.key === 'ArrowRight' ? 1 : -1); e.preventDefault(); e.stopImmediatePropagation();
}, true);

// ---- ちょっとしたてびき（その操作をまだしていない人にだけ、一度ずつ） ----
const TIPS = [
  ['rotate', () => G.chT > DAY * 0.4, '大地の外をドラッグすると、回して見られる。ホイールで寄る'],
  ['speed', () => G.ch >= 1 && G.chT > DAY * 0.3, '右上の天の輪を押すと、時が止まる。下の ›› で速くなる'],
  ['sun', () => G.ch >= 2 && G.chT > DAY * 1.5, '太陽は、つかんで動かせる。止めた所はよく育つが、乾いて暑い。反対がわは夜のまま'],
  ['book', () => G.ch >= 3 && G.chT > DAY, '右下の観察帳に、いきものの移り変わりが書いてある'],
  ['moon', () => G.ch >= 7 && G.chT > DAY, '月を寄せると、潮で水がそちらへ寄る。浅瀬が動き、ふちから水があふれる'],
];
let accTip = 0;
function stepTips(dt) {
  if (!G.started || COL || isFree() || G.ch % 1) return;
  accTip += dt; if (accTip < 2) return; accTip = 0;
  for (const [id, when, text] of TIPS) if (!G.did[id] && !G.tipped[id] && when()) { G.tipped[id] = 1; toast(text, 7); return; }
}

// ヒントのはしごの光（世界の上に、ほたるのように。chapters.js の pickSpots）
function drawSpots(ctx, t) {
  if (!G.spots || COL) return;
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  G.spots.forEach((p, k) => {
    const q = proj(p.x, p.y, surfAt(p.x, p.y) + 0.8 + 0.4 * Math.sin(t * 1.3 + k)), a = 0.22 + 0.16 * Math.sin(t * 2 + k * 1.7), r = Math.max(6, V.s * 2.2);
    const g = ctx.createRadialGradient(q.x, q.y, 0, q.x, q.y, r);
    g.addColorStop(0, `rgba(255,236,170,${a})`); g.addColorStop(1, 'rgba(255,236,170,0)');
    ctx.fillStyle = g; ctx.fillRect(q.x - r, q.y - r, r * 2, r * 2);
  });
  ctx.restore();
}

// ---- 世界の版画（銅版画の画風で1枚に） ----
function makePrint() {
  const W0 = 1400, H0 = 1000, out = document.createElement('canvas'); out.width = W0; out.height = H0;
  const o = out.getContext('2d');
  const keep = { style: styleName, back: backName, cw: V.cw, ch: V.ch, zoom: V.zoom, panX: V.panX, panY: V.panY, sel: G.sel, col: COL };
  try {
    COL = null;                                    // エンディングのあいだでも、くずす前の世界を刻む
    styleName = 'etch'; backName = 'auto'; buf = null; G.sel = null;
    V.zoom = 1; V.panX = 0; V.panY = 0;
    layout(W0, H0 - 120);
    const t = performance.now() / 1000;
    for (let k = 0; k < 3; k++) { V.dirty = true; o.clearRect(0, 0, W0, H0); drawWorld(o, t, null); }
    // 下に刻む: 題・年・見つけたこと
    o.fillStyle = '#efe3c4'; o.fillRect(0, H0 - 120, W0, 120);
    o.strokeStyle = '#3a2a1c'; o.lineWidth = 3; o.strokeRect(14, 14, W0 - 28, H0 - 28); o.lineWidth = 1; o.strokeRect(24, 24, W0 - 48, H0 - 48);
    o.fillStyle = '#3a2a1c'; o.textAlign = 'center';
    o.font = '44px "Hiragino Mincho ProN","Yu Mincho","Noto Serif JP",serif';
    o.fillText('果ての滝の箱庭', W0 / 2, H0 - 66);
    const yr = Math.floor((W.t / DAY + 0.1 * YEAR) / YEAR) + 1;
    o.font = '24px "Hiragino Mincho ProN","Yu Mincho","Noto Serif JP",serif';
    o.fillText(`${yr} 年目の${SEASONS[seasonOf()]}・第 ${W.day} 日　見つけたこと ${Object.keys(G.found || {}).length}　あそびラボ`, W0 / 2, H0 - 30);
  } finally {
    styleName = keep.style; backName = keep.back; buf = null; G.sel = keep.sel; COL = keep.col;
    V.zoom = keep.zoom; V.panX = keep.panX; V.panY = keep.panY; layout(keep.cw, keep.ch);
  }
  out.toBlob(b => {
    if (!b) { toast('版画をつくれなかった'); return; }
    const url = URL.createObjectURL(b), a = document.createElement('a');
    a.href = url; a.download = `edge-falls-print-day${W.day}.png`; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    toast('世界の版画をのこした'); Sound.play('put');
  }, 'image/png');
}
$('btnPrint').onclick = () => { Sound.unlock(); makePrint(); };
