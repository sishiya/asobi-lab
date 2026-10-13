'use strict';
// 画面（v011。DESIGN.md 4章）: 画面のほとんどは世界。手に持つもの3つ（土ぶくろ・水がめ・命のつぼ）、天の輪（季節と時の速さ）、
//   観察帳（グラフ・遺伝子・水と土・見つけたこと・年・てびき）。数字はなるべく観察帳の中に。
//   見つけたこと（観察の記録）: いまのしくみがすでに起こしている出来事に名前をつける。見つけた瞬間の絵を小さく残す。
//   世界の版画: いま見えている絵を1枚にして保存する（型を見くらべる試作。v018）。

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
const LIFE_SUBS = [['seed', TX('たね', 'Seeds')], ['deer', TX('シカ', 'Deer')], ['wolf', TX('オオカミ', 'Wolf')], ['fish', TX('サカナ', 'Fish')], ['bird', TX('サギ', 'Heron')]];
function toolOf() {
  if (G.hand === 'soil') return G.sub.soil;
  if (G.hand === 'water') return G.sub.water;
  if (G.hand === 'life') return G.sub.life === 'seed' ? 'grass' : G.sub.life;
  return 'look';
}
function setHand(h) {
  G.hand = h; G.tool = toolOf();
  cv.classList.toggle('tool', !!h);
  setCursor();
  syncHands();
}
// しまう（Esc・スマホの「しまう」。v027 で「手放す」から。ユーザー「ツールを手放す（つかえなくなる）のかとおもっちゃう」）
function dropHand() { setHand(null); hover = null; Sound.play('release'); }
// マウスの横の絵: 土ぶくろ・水がめは、いまの中身の量で（2026-10-13 ユーザー「泉がからでも溜まっているようにみえる」）。6 段に丸める
let cursorKey = '';
function setCursor() {
  const lv = v => Math.round(Math.max(0, Math.min(1, v)) * 6) / 6, sf = lv(W.soil / SOIL_FULL), wf = lv(W.abyss / 1000);
  const cur = { dig: ['bagd' + sf, c => drawBag(c, sf, false)], raise: ['bagr' + sf, c => drawBag(c, sf, true)], spring: ['jar' + wf, c => drawJar(c, wf)], grass: ['seed', drawSeed] }[G.tool] ||
    (KINDS[G.tool] ? ['c' + G.tool, c => drawCreature(c, G.tool)] : null);
  const key = cur ? cur[0] : '';
  if (key === cursorKey) return; cursorKey = key;
  cv.style.cursor = cur ? `url(${iconURL(cur[0], cur[1])}) 4 28, crosshair` : '';
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
  $('btnHandOff').hidden = !G.hand;
  drawHands();
  // 手に持っているものの中身（扇のように上に並ぶ）。水がめは一つだけでも、ほかと同じく出す（2026-10-13 ユーザー）
  const fan = $('fan');
  if (G.hand) {
    const items = G.hand === 'soil' ? [['dig', TX('土をけずる', 'Dig')], ['raise', TX('土を盛る', 'Pile up')]] : G.hand === 'water' ? [['spring', TX('泉をわかせる', 'Make a spring')]] : LIFE_SUBS.filter(([k]) => k === 'seed' || u[k]);
    fan.innerHTML = items.map(([k, label]) => {
      const n = KINDS[k] ? `<em>${W.stock[k]}</em>` : k === 'raise' ? `<em id="soilN">${Math.floor(W.soil)}</em>` : '';
      const ic = k === 'dig' ? iconURL('bagd', c => drawBag(c, 0.5, false)) : k === 'raise' ? iconURL('bagr', c => drawBag(c, 0.8, true)) : k === 'spring' ? iconURL('jar', c => drawJar(c, 0.7)) : k === 'seed' ? iconURL('seed', drawSeed) : iconURL('c' + k, c => drawCreature(c, k));
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
  if (G.hand) setCursor();
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
  showPanel(`<p class="mtitle">${isFree() ? TX('自由な箱庭', 'Free Garden') : yearOf(Math.floor(G.ch))}${TX(`　第 ${W.day} 日`, ` · Day ${W.day}`)}</p>`, [
    { label: TX('つづける', 'Resume'), main: true, fn: closeMenu },
    { label: TX('セーブ', 'Save'), fn: () => { G.menuOpen = false; openSavePanel(() => openMenu(), 'save'); } },
    { label: TX('ロード', 'Load'), fn: () => { G.menuOpen = false; openSavePanel(() => openMenu(), 'load'); } },
    { label: TX('観察帳', 'Field Notes'), fn: () => { G.menuOpen = false; resume(); openBook(null, true); } },
    { label: TX('設定', 'Settings'), fn: () => { G.menuOpen = false; openSettings(() => openMenu()); } },
    { label: TX('タイトルへ', 'Title screen'), fn: () => { G.menuOpen = false; toTitle(); } },
    { label: TX('ゲームを終える', 'Quit'), fn: () => { G.menuOpen = false; quitGame(); } },
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
$('overlay').addEventListener('click', e => { if (e.target === $('overlay') && goBack()) { Sound.play('click'); G.closedT = performance.now(); } });
$('btnHandOff').onclick = () => { Sound.unlock(); dropHand(); };
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
  showPanel(TX('<h2>タイトルへ</h2><p class="center">セーブすると、いまの世界を自動セーブに残す。<br>タイトルの「つづきから」で、ここにもどれる。<br>セーブしないと、前に残った所までになる。</p>', '<h2>Title screen</h2><p class="center">If you save, the current world is kept in the autosave.<br>You can come back here with “Continue” on the title screen.<br>If you don’t save, you go back to the last saved point.</p>'), [
    { label: TX('セーブしてタイトルへ', 'Save and go to title'), main: true, fn: () => go(true) },
    { label: TX('セーブしないでタイトルへ', 'Go to title without saving'), fn: () => go(false) },
    { label: TX('もどる', 'Back'), fn: () => openMenu() },
  ]);
  $('panel').classList.add('world'); G.panelBack = openMenu;
}
// 設定（v016。2026-10-13 ユーザー「設定メニューを追加して」「メニューには文字フォント切り替えは必要ない。設定画面に移して」）
//   音楽・効果音・文字・背景（v017 で観察帳のてびきから移した）。言語は v020 でタイトルの右上だけに（遊んでいるとちゅうで読み直すと、
//   セーブのつもりがないのにページを離れるときの自動セーブが走るので）。押すとその場で切りかわる。back があれば「もどる」でそこへ（メニュー）
function openSettings(back, focus) {
  const on = v => v ? TX('オン', 'On') : TX('オフ', 'Off'), again = k => () => openSettings(back, k);
  const bi = BACK_CHOICES.findIndex(([k]) => k === backName);
  showPanel(`<p class="mtitle">${TX('設定', 'Settings')}</p>`, [
    { label: TX('音楽　', 'Music: ') + on(Sound.get('bgm')), fn: () => { Sound.set('bgm', !Sound.get('bgm')); again(0)(); } },
    { label: TX('効果音　', 'Sound effects: ') + on(Sound.get('sfx')), fn: () => { Sound.set('sfx', !Sound.get('sfx')); again(1)(); } },
    { label: TX('文字　', 'Font: ') + (fontName === 'dot' ? TX('ドット', 'Pixel') : TX('明朝', 'Serif')), fn: () => { setFont(fontName === 'dot' ? 'serif' : 'dot'); again(2)(); } },
    { label: TX('背景　', 'Background: ') + (bi >= 0 ? BACK_CHOICES[bi][1] : TX('ほか', 'Other')), fn: () => { setBack(BACK_CHOICES[(bi + 1) % BACK_CHOICES.length][0]); again(3)(); } },
    { label: back ? TX('もどる', 'Back') : TX('とじる', 'Close'), main: true, fn: () => { if (back) back(); } },
  ]);
  $('panel').classList.add('menu', 'world', 'settings');   // 設定のあいだは、世界をうすくしない（背景を選びやすく。css）
  G.panelBack = back || (() => { $('overlay').hidden = true; });
  if (focus !== undefined) $('panel').querySelectorAll('.btns .tbtn')[focus]?.focus();   // 押したボタンに印を残す（上下の矢印でつづけて選べる）
}
function quitGame() {
  // セーブしないで終えることもできる（2026-10-13 ユーザー）。ページを離れるときの自動セーブもしないよう、先に G.started を落とす
  showPanel(TX('<h2>ゲームを終える</h2><p class="center">あそびラボへもどる。<br>セーブすると、つぎに開いたとき「つづきから」ここで遊べる。<br>セーブしないと、前に残った所までになる。</p>', '<h2>Quit</h2><p class="center">Go back to Asobi Lab.<br>If you save, you can pick up here with “Continue” next time.<br>If you don’t save, you go back to the last saved point.</p>'), [
    { label: TX('セーブして終える', 'Save and quit'), main: true, fn: async () => { await saveSlot('auto'); G.started = false; location.href = TX('../', '../?lang=en'); } },   // 入口へ（v019 で保管庫から入口へ移した）
    { label: TX('セーブしないで終える', 'Quit without saving'), fn: () => { G.started = false; location.href = TX('../', '../?lang=en'); } },
    { label: TX('もどる', 'Back'), fn: () => openMenu() },
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
  $('stockTxt').textContent = ['deer', 'wolf', 'fish', 'bird'].filter(k => u[k]).map(k => KINDS[k].name + ' ' + W.stock[k]).join(TX('・', ' · ')) || TX('まだからっぽ', 'Still empty');
}
function renderYears() {
  const rows = CHAPTERS.map((c, n) => {
    const d = G.done && G.done[n];
    if (d) return `<li class="done"><b>${yearOf(n)}${TX('　', ': ')}${c.title}</b><span>${TX(`第 ${d.day} 日にできた`, `Done on day ${d.day}`)}</span>${d.what ? `<p>${d.what}</p>` : ''}<p>${c.truth}</p></li>`;
    if (n === Math.floor(G.ch)) return `<li class="now"><b>${yearOf(n)}${TX('　', ': ')}${c.title}</b><span>${TX('いまの年', 'This year')}</span><p>${c.text}</p>${G.helped ? `<p class="hint">${c.hint}</p>` : ''}</li>`;
    return `<li class="later"><b>${yearOf(n)}</b><span>……</span></li>`;
  }).join('');
  $('years').innerHTML = rows + (isFree() ? TX('<li class="done"><b>そして</b><span>十の年がめぐった</span><p>ここからは自由な箱庭。</p></li>', '<li class="done"><b>And then</b><span>The Ten Years have turned</span><p>From here on, it’s a Free Garden.</p></li>') : '');
}

// ---- 見つけたこと（観察の記録） ----
const FINDS = [
  ['fall', TX('果ての滝', 'The Edge Falls'), TX('水が、世界の果てから落ちていった。', 'Water fell from the edge of the world.'), s => s.out > 0.3],
  ['mist', TX('霧の雲', 'Mist clouds'), TX('滝のしぶきが、のぼって雲になった。', 'Spray from the falls rose and became clouds.'), () => W.flags.mist],
  ['mrain', TX('山の雨', 'Mountain rain'), TX('山にぶつかった雲が、雨をふらせた。', 'Clouds hit a mountain and it rained.'), () => W.flags.mrain],
  ['abyss', TX('深淵の底', 'The bottom of the Abyss'), TX('深淵の水が、底をつきかけた。泉が細くなる。', 'The Abyss almost ran out of water. The springs grow weak.'), () => W.abyss < 60 && W.springs.length > 0],
  ['green', TX('緑の原', 'Green plain'), TX('草が、大地の一割をおおった。', 'Grass covered a tenth of the land.'), s => s.grass > 0.1],
  ['tree', TX('はじめての木', 'The first tree'), TX('草の茂った乾いた所に、木が育った。', 'A tree grew in a dry, grassy place.'), () => G.maxTree > 0.7],
  ['born', TX('はじめての子', 'The first young'), TX('大地で、はじめて子が生まれた。', 'The first young was born on the land.'), () => L.born > 0],
  ['snow', TX('初雪', 'First snow'), TX('寒い山に、雪がつもった。', 'Snow piled up on a cold mountain.'), () => G.snowy],
  ['ice', TX('氷', 'Ice'), TX('水が凍った。凍った水は流れない。', 'Water froze. Frozen water doesn’t flow.'), () => G.icy],
  ['swim', TX('泳ぐシカ', 'Swimming deer'), TX('シカが、深い水を泳ぎわたった。', 'A deer swam across deep water.'), () => W.flags.swim],
  ['giveup', TX('逃げきった', 'Got away'), TX('オオカミが、シカを追いきれなかった。', 'A wolf couldn’t catch the deer it chased.'), () => W.flags.giveup],
  ['fallen', TX('果てへ', 'Over the edge'), TX('流された生き物が、滝から落ちていった。', 'An animal was carried away and fell off the falls.'), () => L.fell > 0],
  ['catch', TX('サギの漁', 'The heron’s catch'), TX('サギが、浅瀬でサカナをとった。', 'A heron caught a fish in the shallows.'), () => L.why['fish:caught'] > 0],
  ['return', TX('帰ってきた命', 'Lives come back'), TX('去った命が、深淵からつぼへ戻ってきた。', 'Lives that passed away came back from the Abyss to the jar.'), () => W.flags.ret],
  ['gen10', TX('十代目', 'Tenth generation'), TX('第 10 世代の子が生まれた。', 'A young of the 10th generation was born.'), () => W.flags.gen10],
  // 太陽と月の遊び（v020）
  ['bigtide', TX('大潮', 'Spring tide'), TX('月と太陽が同じ向きにそろうと、潮がいちばん大きく寄った。', 'When the Moon and Sun lined up on the same side, the tide pulled the hardest.'), s => (W.knob ? W.knob.tide : 1) >= 0.5 && s.wet > 0.03 && Math.abs(sunMoonGap()) < 0.2],
  ['eclipse', TX('日食', 'Eclipse'), TX('月が太陽に重なって、昼の大地が暗くなった。', 'The Moon covered the Sun, and the land grew dark in the daytime.'), () => eclipseK() > 0.6],
  ['stillsun', TX('止まった昼', 'The Sun stands still'), TX('太陽を止めたまま一日がすぎた。昼の所はずっと昼、夜の所はずっと夜。', 'A whole day passed with the Sun stopped. Day stayed day, and night stayed night.'), () => G.sunStill > DAY],
];
const SKETCH_KEY = 'asobi-lab/edge-falls/sketch';
let sketches = {}; try { sketches = JSON.parse(localStorage.getItem(SKETCH_KEY) || '{}'); } catch (e) { sketches = {}; }
let accFind = 0, wantSketch = null;
function stepFinds(s, dt) {
  if (!G.started || COL || THUMB) return;
  G.sunStill = W.sun.stop ? (G.sunStill || 0) + dt : 0;   // 太陽を止めていた時間
  accFind += dt; if (accFind < 0.5) return; accFind = 0;
  let mt = 0; for (const i of INS) if (W.tree[i] > mt) mt = W.tree[i]; G.maxTree = mt;
  if (!G.snowy || !G.icy) for (const i of INS) { if (W.snow[i] > 0.05) G.snowy = 1; if (W.ice[i]) G.icy = 1; }
  G.found = G.found || {};
  for (const [id, title, text, test] of FINDS) {
    if (G.found[id] || !test(s)) continue;
    G.found[id] = { day: W.day };
    toast(TX(`見つけた　${title}　— ${text}`, `Discovery: ${title} — ${text}`), 5); Sound.play('put');
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
  $('findN').textContent = TX(`${Object.keys(f).length} ／ ${FINDS.length}`, `${Object.keys(f).length} / ${FINDS.length}`);
  $('finds').innerHTML = FINDS.map(([id, title, text]) => f[id]
    ? `<figure>${sketches[id] ? `<button type="button" class="shot" data-find="${id}" aria-label="${TX(`${title}の絵を大きく見る`, `See the picture of ${title} larger`)}"><img src="${sketches[id]}" alt=""></button>` : '<div class="blank"></div>'}<figcaption><b>${title}</b><span>${TX(`第 ${f[id].day} 日`, `Day ${f[id].day}`)}</span><p>${text}</p></figcaption></figure>`
    : `<figure class="unfound"><div class="blank">${TX('？', '?')}</div><figcaption><b>${TX('まだ見ていない', 'Not seen yet')}</b></figcaption></figure>`).join('');
}
// 見つけたことの絵を大きく（2026-10-13 ユーザー「クリックしたら世界観にマッチする枠をつけて大きく表示」）。
//   観察帳と同じ羊皮紙の台紙に二重の墨の線。押す・Esc で閉じる。←→ でとなりの絵へ
let lbId = null;
$('finds').addEventListener('click', e => { const b = e.target.closest('[data-find]'); if (b) { Sound.play('click'); openLightbox(b.dataset.find); } });
function openLightbox(id) {
  const f = FINDS.find(x => x[0] === id), d = (G.found || {})[id];
  if (!f || !d || !sketches[id]) return;
  lbId = id;
  $('lbImg').src = sketches[id]; $('lbTitle').textContent = f[1]; $('lbDay').textContent = TX(`第 ${d.day} 日`, `Day ${d.day}`); $('lbText').textContent = f[2];
  $('lightbox').hidden = false;
}
function closeLightbox() { $('lightbox').hidden = true; $('lightbox').classList.remove('print'); lbId = null; }
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
  ['rotate', () => G.chT > DAY * 0.4, TX('大地の外をドラッグすると、回して見られる。ホイールで寄る', 'Drag outside the land to turn it. Scroll to zoom in')],
  ['speed', () => G.ch >= 1 && G.chT > DAY * 0.3, TX('右上の天の輪を押すと、時が止まる。下の ›› で速くなる', 'Press the Sky Dial at the top right to stop time. The ›› marks below make it faster')],
  ['sun', () => G.ch >= 2 && G.chT > DAY * 1.5, TX('太陽は、つかんで動かせる。止めた所はよく育つが、乾いて暑い。反対がわは夜のまま', 'You can grab the Sun and move it. Where you stop it, plants grow well but it gets dry and hot. The other side stays in night')],
  ['book', () => G.ch >= 3 && G.chT > DAY, TX('右下の観察帳に、いきものの移り変わりが書いてある', 'The Field Notes at the bottom right show how life is changing')],
  ['moon', () => G.ch >= 7 && G.chT > DAY, TX('月を寄せると、潮で水がそちらへ寄る。浅瀬が動き、ふちから水があふれる', 'Bring the Moon closer and the tide pulls water toward it. The shallows move, and water spills over the edge')],
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

// ---- 世界の版画（v018 試作。2026-10-13 ユーザー「見たままの絵にして。チープになっちゃう」「いくつか試したい。版画のパターンを試験的にみれるように」）
//   もとは画面の canvas（いま見えている絵そのもの。手に持つものなどの画面の部品はふくまない）。画素の絵なので、ぼかさずに整数倍で大きくする。
//   型: 見たまま（額なし）・羊皮紙の台紙・深淵の額・古い写真・銅版画（これまでの）。札で見くらべて、押すと大きく、「のこす」で PNG。
const PRINTS = [
  ['seen', TX('見たまま', 'As seen'), TX('画面の絵そのまま。下に小さく題', 'The picture on the screen, with a small title at the bottom')],
  ['mat', TX('羊皮紙の台紙', 'Parchment mount'), TX('観察帳と同じ紙に、墨の二重線', 'The same paper as the Field Notes, with double ink lines')],
  ['abyss', TX('深淵の額', 'Abyss frame'), TX('夜空の色の台紙に、金の二重線', 'A night-sky mount with double gold lines')],
  ['photo', TX('古い写真', 'Old photo'), TX('セピアに焼いて、羊皮紙の台紙に', 'Printed in sepia on a parchment mount')],
  ['stone', TX('石板', 'Stone tablet'), TX('欠けたふちの石に、絵をはめこんで題を彫る', 'Set into a chipped stone, with the title carved in')],
  ['etch', TX('銅版画', 'Etching'), TX('これまでの版画（銅版画の画風で描き直す）', 'The original print (redrawn in an etching style)')],
];
const printFont = px => `${px}px ${fontName === 'dot' ? '"DotGothic16",' : ''}"Hiragino Mincho ProN","Yu Mincho","Noto Serif JP",serif`;
function printWords() {
  const yr = Math.floor((W.t / DAY + 0.1 * YEAR) / YEAR) + 1;
  const nf = Object.keys(G.found || {}).length;
  return TX({ title: '果ての滝の箱庭', sub: `${isFree() ? '自由な箱庭・' : ''}${yr} 年目の${SEASONS[seasonOf()]}・第 ${W.day} 日　見つけたこと ${nf} ／ ${FINDS.length}　あそびラボ` },
    { title: 'Edge Falls Garden', sub: `${isFree() ? 'Free Garden · ' : ''}Year ${yr}, ${SEASONS[seasonOf()]} · Day ${W.day}   Discoveries ${nf} / ${FINDS.length}   Asobi Lab` });
}
// 見たままの絵（整数倍で 1600 画素ほどの幅に）
function seenCanvas() {
  const k = Math.max(1, Math.round(1600 / cv.width)), c = document.createElement('canvas');
  c.width = cv.width * k; c.height = cv.height * k;
  const x = c.getContext('2d'); x.imageSmoothingEnabled = false; x.drawImage(cv, 0, 0, c.width, c.height);
  return c;
}
// 銅版画（これまでの版画。くらべるために残す）
function etchCanvas() {
  const W0 = 1400, H0 = 1000, out = document.createElement('canvas'); out.width = W0; out.height = H0;
  const o = out.getContext('2d');
  const keep = { style: styleName, back: backName, cw: V.cw, ch: V.ch, zoom: V.zoom, panX: V.panX, panY: V.panY, sel: G.sel };
  try {
    styleName = 'etch'; backName = 'auto'; buf = null; G.sel = null;
    V.zoom = 1; V.panX = 0; V.panY = 0;
    layout(W0, H0 - 120);
    const t = performance.now() / 1000;
    for (let k = 0; k < 3; k++) { V.dirty = true; o.clearRect(0, 0, W0, H0); drawWorld(o, t, null); }
    o.fillStyle = '#efe3c4'; o.fillRect(0, H0 - 120, W0, 120);
    o.strokeStyle = '#3a2a1c'; o.lineWidth = 3; o.strokeRect(14, 14, W0 - 28, H0 - 28); o.lineWidth = 1; o.strokeRect(24, 24, W0 - 48, H0 - 48);
    const w = printWords();
    o.fillStyle = '#3a2a1c'; o.textAlign = 'center';
    o.font = printFont(44); o.fillText(w.title, W0 / 2, H0 - 66);
    o.font = printFont(22); o.fillText(w.sub, W0 / 2, H0 - 30);
  } finally {
    styleName = keep.style; backName = keep.back; buf = null; G.sel = keep.sel;
    V.zoom = keep.zoom; V.panX = keep.panX; V.panY = keep.panY; layout(keep.cw, keep.ch);
  }
  return out;
}
function printCanvas(kind) {
  if (kind === 'etch') return etchCanvas();
  const src = seenCanvas(), Wi = src.width, Hi = src.height, w = printWords();
  if (kind === 'stone') return stoneCanvas(src, w);
  if (kind === 'seen') {
    const out = document.createElement('canvas'); out.width = Wi; out.height = Hi;
    const o = out.getContext('2d'); o.drawImage(src, 0, 0);
    o.textAlign = 'right'; o.shadowColor = 'rgba(0,0,0,.9)'; o.shadowBlur = Wi * 0.006;
    o.fillStyle = 'rgba(239,227,196,.92)'; o.font = printFont(Math.round(Wi * 0.02)); o.fillText(w.title, Wi * 0.975, Hi * 0.94);
    o.fillStyle = 'rgba(239,227,196,.75)'; o.font = printFont(Math.round(Wi * 0.0105)); o.fillText(w.sub, Wi * 0.975, Hi * 0.94 + Wi * 0.02);
    return out;
  }
  // 台紙のある型: まわりに余白、下に題
  const pad = Math.round(Wi * 0.05), capH = Math.round(Wi * 0.075), out = document.createElement('canvas');
  out.width = Wi + pad * 2; out.height = Hi + pad * 2 + capH;
  const o = out.getContext('2d'), OW = out.width, OH = out.height, dark = kind === 'abyss';
  if (dark) {
    const g = o.createRadialGradient(OW / 2, OH * 0.45, 0, OW / 2, OH * 0.45, OW * 0.7);
    g.addColorStop(0, '#1c2440'); g.addColorStop(1, '#0a0d18'); o.fillStyle = g;
  } else {
    const g = o.createRadialGradient(OW * 0.3, 0, 0, OW * 0.5, OH * 0.5, OW * 0.8);
    g.addColorStop(0, '#fbf3dc'); g.addColorStop(0.6, '#f1e5c6'); g.addColorStop(1, '#e2d1a6'); o.fillStyle = g;
  }
  o.fillRect(0, 0, OW, OH);
  if (!dark) for (let n = 0; n < 2600; n++) {                       // 紙のすじと点（ごくうすく）
    o.fillStyle = `rgba(120,90,50,${0.03 + 0.04 * hash2(n, 3)})`;
    o.fillRect(hash2(n, 1) * OW, hash2(n, 2) * OH, 1 + hash2(n, 4) * 3, 1);
  }
  if (kind === 'photo') o.filter = 'sepia(0.8) contrast(1.12) brightness(0.98)';
  o.drawImage(src, pad, pad);
  o.filter = 'none';
  if (kind === 'photo') {                                            // 写真のふちを少しやかす
    const v = o.createRadialGradient(pad + Wi / 2, pad + Hi / 2, Hi * 0.35, pad + Wi / 2, pad + Hi / 2, Wi * 0.62);
    v.addColorStop(0, 'rgba(60,40,20,0)'); v.addColorStop(1, 'rgba(60,40,20,0.35)'); o.fillStyle = v; o.fillRect(pad, pad, Wi, Hi);
  }
  const ink = dark ? 'rgba(222,192,124,0.85)' : '#3a2a1c', lw = Math.max(2, Math.round(Wi * 0.0014));
  o.strokeStyle = ink; o.lineWidth = lw; o.strokeRect(pad - lw / 2, pad - lw / 2, Wi + lw, Hi + lw);              // 絵のふち
  o.lineWidth = lw * 1.6; o.strokeRect(pad * 0.35, pad * 0.35, OW - pad * 0.7, OH - pad * 0.7);                  // 外の二重線
  o.lineWidth = lw * 0.7; o.strokeRect(pad * 0.5, pad * 0.5, OW - pad, OH - pad);
  o.textAlign = 'center'; o.fillStyle = dark ? '#efe3c4' : '#3a2a1c';
  o.font = printFont(Math.round(Wi * 0.026)); o.fillText(w.title, OW / 2, Hi + pad + capH * 0.5);
  o.fillStyle = dark ? 'rgba(222,192,124,0.9)' : '#6d5a44';
  o.font = printFont(Math.round(Wi * 0.0125)); o.fillText(w.sub, OW / 2, Hi + pad + capH * 0.86);
  return out;
}
// 石板: 欠けたふちの灰色の石。光を当てるのは大きな形だけ（ふちの面取り・絵をはめるくぼみ・彫った字・ひび）。石らしさは色で出す（むら・うすい層・細かい粒）。
//   面の凹凸まで光で浮かせると、昔のエンボスの絵になる（2026-10-13 ユーザー「PS 時代のグラフィックみたい」「もうちょっとマイルドに」）
function stoneCanvas(src, w) {
  const Wi = src.width, Hi = src.height, u = Wi / 1000, pad = Math.round(Wi * 0.075), capH = Math.round(Wi * 0.1);
  const OW = Wi + pad * 2, OH = Hi + pad * 2 + capH, N = OW * OH;
  const mk = () => { const c = document.createElement('canvas'); c.width = OW; c.height = OH; return [c, c.getContext('2d')]; };
  // 石の形: 四辺をこまかくゆらし、角を欠く
  const pts = [], m = pad * 0.12, edge = (x0, y0, x1, y1, n, seed) => {
    for (let i = 0; i < n; i++) {
      const f = i / n, j = i ? (hash2(seed, i) - 0.5) * u * 7 + (hash2(seed + 9, i >> 2) - 0.5) * u * 10 : 0;   // 角の点はゆらさない（とげになる）
      const nx = y1 - y0, ny = x0 - x1, L = Math.hypot(nx, ny);
      pts.push([x0 + (x1 - x0) * f + nx / L * j, y0 + (y1 - y0) * f + ny / L * j]);
    }
  };
  const c1 = u * 34, c2 = u * 18, c3 = u * 46, c4 = u * 24;                  // 角の欠け（大きさをばらす）
  edge(m + c1, m, OW - m - c2, m, 40, 1); pts.push([OW - m, m + c2 * 1.3]);
  edge(OW - m, m + c2 * 1.3, OW - m, OH - m - c3, 40, 2); pts.push([OW - m - c3 * 0.8, OH - m]);
  edge(OW - m - c3 * 0.8, OH - m, m + c4, OH - m, 40, 3); pts.push([m, OH - m - c4 * 1.2]);
  edge(m, OH - m - c4 * 1.2, m, m + c1 * 0.7, 40, 4); pts.push([m + c1, m]);
  const slab = x => { x.beginPath(); pts.forEach(([a, b], i) => i ? x.lineTo(a, b) : x.moveTo(a, b)); x.closePath(); };
  // なめらかな雑音: 小さな乱数の絵を引きのばして重ねる（大きい粒から順に）
  const noise = (octs, seed) => {
    const [, x] = mk(); x.imageSmoothingEnabled = true; x.imageSmoothingQuality = 'high';
    octs.forEach(([cells, a], k) => {
      const gw = cells, gh = Math.max(2, Math.round(cells * OH / OW)), t = document.createElement('canvas'); t.width = gw; t.height = gh;
      const tx = t.getContext('2d'), id = tx.createImageData(gw, gh);
      for (let i = 0; i < gw * gh; i++) { const v = hash2(seed + k * 17.3, i * 1.618) * 255; id.data[i * 4] = id.data[i * 4 + 1] = id.data[i * 4 + 2] = v; id.data[i * 4 + 3] = 255; }
      tx.putImageData(id, 0, 0); x.globalAlpha = a; x.drawImage(t, 0, 0, OW, OH);
    });
    return x.getImageData(0, 0, OW, OH).data;
  };
  const tint = noise([[5, 1], [11, 0.45], [26, 0.3]], 101);                    // 色むら（大きい）
  const mott = noise([[18, 1], [48, 0.5], [130, 0.3]], 202);                   // 色の細かいむら（光は当てない）
  // 彫った字の位置: 絵の下からふちまでのまん中に、題と小さな字のひとかたまり
  const X = pad, Y = pad, r = u * 14, tp = Math.round(Wi * 0.034), sp = Math.round(Wi * 0.0165), gap = tp * 0.55;
  const top = Y + Hi + r, bottom = OH - m - u * 12, y0 = top + (bottom - top - (tp + gap + sp)) / 2;
  const tY = y0 + tp / 2, sY = y0 + tp + gap + sp / 2;
  // 高さの地図（白が高い）と、くぼみにたまる影（彫った字・ひび・穴）
  const [, hx] = mk(), [kc, kx] = mk();
  hx.fillStyle = '#000'; hx.fillRect(0, 0, OW, OH);
  hx.filter = `blur(${u * 9}px)`; slab(hx); hx.fillStyle = '#fff'; hx.fill();                                  // ふちは丸く落ちる
  hx.filter = `blur(${u * 2}px)`; hx.fillStyle = '#5a5a5a'; hx.fillRect(X - r, Y - r, Wi + r * 2, Hi + r * 2);   // 絵をはめるくぼみ
  const carve = (x, col, blur, col2, blur2) => {   // 小さな字はぼかしを少なく（読めるように）
    x.textAlign = 'center'; x.textBaseline = 'middle';
    x.filter = `blur(${blur}px)`; x.fillStyle = col; x.font = printFont(tp); x.fillText(w.title, OW / 2, tY);
    x.filter = `blur(${blur2}px)`; x.fillStyle = col2; x.font = printFont(sp); x.fillText(w.sub, OW / 2, sY);
  };
  carve(hx, '#8c8c8c', u * 1.1, '#a8a8a8', u * 0.55);
  carve(kx, 'rgba(0,0,0,.55)', u * 0.4, 'rgba(0,0,0,.55)', u * 0.2);
  hx.lineCap = kx.lineCap = 'round'; hx.lineJoin = kx.lineJoin = 'round';
  for (let n = 0; n < 4; n++) {                                      // ひび（ふちから少し入る）
    const side = n % 4, f = hash2(n, 31), fx = side === 2 ? (f < 0.5 ? 0.06 + f * 0.36 : 0.76 + (f - 0.5) * 0.36) : f;   // 下のひびは字をよける
    let x = side === 1 ? OW : side === 3 ? 0 : fx * OW, y = side === 0 ? 0 : side === 2 ? OH : f * OH;
    let ang = Math.atan2(OH / 2 - y, OW / 2 - x) + (hash2(n, 32) - 0.5);
    const path = new Path2D(); path.moveTo(x, y);
    for (let k = 0, len = pad * (0.7 + hash2(n, 33) * 1.1); k < 9; k++) { ang += (hash2(n, 40 + k) - 0.5) * 0.9; x += Math.cos(ang) * len / 9; y += Math.sin(ang) * len / 9; path.lineTo(x, y); }
    hx.filter = `blur(${u * 0.8}px)`; hx.strokeStyle = 'rgba(0,0,0,.3)'; hx.lineWidth = u * 1.8; hx.stroke(path);
    kx.filter = 'none'; kx.strokeStyle = 'rgba(0,0,0,.22)'; kx.lineWidth = u; kx.stroke(path);
  }
  for (let n = 0; n < 110; n++) {                                    // 小さな穴（風化）
    const x = hash2(n, 51) * OW, y = hash2(n, 52) * OH, rr = u * (0.8 + hash2(n, 53) * hash2(n, 54) * 5);
    kx.filter = 'none'; kx.fillStyle = 'rgba(0,0,0,.1)'; kx.beginPath(); kx.arc(x, y, rr * 0.7, 0, 7); kx.fill();
  }
  hx.filter = kx.filter = 'none';
  const [, mx] = mk(); slab(mx); mx.fillStyle = '#fff'; mx.fill();
  const H = hx.getImageData(0, 0, OW, OH).data, K = kx.getImageData(0, 0, OW, OH).data, M = mx.getImageData(0, 0, OW, OH).data;
  // 高さ（画素の単位）: 大きな形と、ゆるいうねり
  const h = new Float32Array(N), dep = u * 14;
  for (let i = 0; i < N; i++) {
    h[i] = H[i * 4] / 255 * dep + (tint[i * 4] / 255 - 0.5) * u * 3;   // 大きなうねりだけ
  }
  // 光: 左上から。面の向き × 光 ＋ まわりの明るさ。色は灰に、むらで少し暖かい色と冷たい色
  const Ln = Math.hypot(-0.45, -0.55, 0.7), lx = -0.45 / Ln, ly = -0.55 / Ln, lz = 0.7 / Ln;
  const [sc, sx] = mk(), img = sx.createImageData(OW, OH), D = img.data;
  for (let y = 1; y < OH - 1; y++) for (let x = 1; x < OW - 1; x++) {
    const i = y * OW + x, a = M[i * 4 + 3]; if (!a) continue;
    const gx = (h[i + 1] - h[i - 1]) * 0.5, gy = (h[i + OW] - h[i - OW]) * 0.5, nl = Math.hypot(gx, gy, 1);
    const dif = Math.max(0, (-gx * lx - gy * ly + lz) / nl);
    const t = tint[i * 4] / 255 - 0.5, b = mott[i * 4] / 255 - 0.5 + Math.sin(y / (u * 11) + t * 7 + x * 0.0004) * 0.06 + (hash2(x * 0.731, y * 1.377) - 0.5) * 0.12,   // むら＋うすい層＋粒
      low = 1 - H[i * 4] / 255, cav = 1 - K[i * 4 + 3] / 255;
    let s = (0.64 + 0.42 * dif) * (1 - low * 0.15) * cav;
    const g2 = hash2((x >> 1) * 1.31, (y >> 1) * 0.77);                // 鉱物の粒（暗い点と光る点）
    if (g2 > 0.995) s *= 0.75; else if (g2 > 0.99) s *= 1.08;
    D[i * 4] = (142 + t * 30 + b * 26) * s;
    D[i * 4 + 1] = (134 + t * 28 + b * 24) * s;
    D[i * 4 + 2] = (121 + t * 20 + b * 20) * s;
    D[i * 4 + 3] = a;
  }
  sx.putImageData(img, 0, 0);
  // 仕上げ: 落ち影の上に石を置き、くぼみに絵をはめる（上と左のふちの影）
  const [out, o] = mk();
  o.save(); o.shadowColor = 'rgba(0,0,0,.6)'; o.shadowBlur = u * 26; o.shadowOffsetY = u * 10; o.drawImage(sc, 0, 0); o.restore();
  o.drawImage(src, X, Y);
  o.strokeStyle = 'rgba(20,18,14,.7)'; o.lineWidth = u * 1.5; o.strokeRect(X, Y, Wi, Hi);
  const sh = o.createLinearGradient(0, Y, 0, Y + u * 24); sh.addColorStop(0, 'rgba(0,0,0,.5)'); sh.addColorStop(1, 'rgba(0,0,0,0)'); o.fillStyle = sh; o.fillRect(X, Y, Wi, u * 24);
  const sl = o.createLinearGradient(X, 0, X + u * 18, 0); sl.addColorStop(0, 'rgba(0,0,0,.4)'); sl.addColorStop(1, 'rgba(0,0,0,0)'); o.fillStyle = sl; o.fillRect(X, Y, u * 18, Hi);
  return out;
}
function savePrint(c, kind) {
  c.toBlob(b => {
    if (!b) { toast(TX('版画をつくれなかった', 'Couldn’t make the print')); return; }
    const url = URL.createObjectURL(b), a = document.createElement('a');
    a.href = url; a.download = `edge-falls-print-${kind}-day${W.day}.png`; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    toast(TX('世界の版画をのこした', 'Saved a World Print')); Sound.play('put');
  }, 'image/png');
}
function makePrint(kind = 'seen') { savePrint(printCanvas(kind), kind); }
// 型を見くらべる札（試作）。back があれば「もどる」でそこへ（エンディングの札）
function openPrints(back) {
  const made = PRINTS.map(([k]) => { try { return printCanvas(k); } catch (e) { return null; } });
  const thumb = c => { const t = document.createElement('canvas'), w = 300; t.width = w; t.height = Math.round(c.height * w / c.width); const x = t.getContext('2d'); x.imageSmoothingQuality = 'high'; x.drawImage(c, 0, 0, t.width, t.height); return t.toDataURL('image/jpeg', 0.85); };
  const cells = PRINTS.map(([k, name, note], n) => made[n] ? `<figure class="pcard"><button type="button" class="pshot" data-pv="${n}" aria-label="${TX(`${name}を大きく見る`, `See ${name} larger`)}"><img src="${thumb(made[n])}" alt=""></button><figcaption><b>${name}</b><span>${note}</span><button type="button" class="tbtn" data-ps="${n}">${TX('のこす', 'Save')}</button></figcaption></figure>` : '').join('');
  showPanel(TX(`<h2>世界の版画</h2><p class="small center">いま見えている世界を、一枚の絵にのこす（ためしに型をいくつか）。押すと大きく見られる。</p>`, `<h2>World Prints</h2><p class="small center">Save the world you see now as a single picture (in a few styles). Press one to see it larger.</p>`) + `<div class="prints">${cells}</div>`,
    [{ label: back ? TX('もどる', 'Back') : TX('とじる', 'Close'), main: true, fn: back }]);
  $('panel').classList.add('world', 'printpanel'); G.panelBack = back || (() => { $('overlay').hidden = true; });
  const panel = $('panel');
  panel.querySelectorAll('[data-ps]').forEach(b => b.onclick = () => savePrint(made[+b.dataset.ps], PRINTS[+b.dataset.ps][0]));
  panel.querySelectorAll('[data-pv]').forEach(b => b.onclick = () => {
    const n = +b.dataset.pv; Sound.play('click');
    lbId = null; $('lbImg').src = made[n].toDataURL('image/png'); $('lbTitle').textContent = PRINTS[n][1]; $('lbDay').textContent = ''; $('lbText').textContent = PRINTS[n][2];
    $('lightbox').classList.add('print'); $('lightbox').hidden = false;
  });
}
$('btnPrint').onclick = () => { Sound.unlock(); closeBook(); openPrints(null); };
