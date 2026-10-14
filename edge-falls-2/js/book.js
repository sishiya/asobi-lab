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
// 観察帳（v038 でもどした。2026-10-13 ユーザー「最初のバージョンの観察帳がよかったかも」。v033〜v037 は巻物・博物誌・天命の書板をためした）: ひらいた本と赤いしおり
//   2026-10-14 ユーザー「観察帳はあまり見ないので、吹き出しのようなデザイン・色味とサイズ感に」: 吹き出し（ui.js drawBubble）と同じ
//   3色（羊皮紙色・影・墨）だけで、同じ大きさの印に。しおりも墨の色
function drawBook(ctx) {
  ctx.clearRect(0, 0, 32, 32);
  px(ctx, 2, 4, 6, 8, '#e6dcc4'); px(ctx, 8, 4, 6, 8, '#e6dcc4'); px(ctx, 7, 4, 2, 9, '#b8a888');   // ひらいた頁と、とじ目
  px(ctx, 2, 12, 12, 1, '#b8a888');                                                                   // 頁の影
  for (let k = 0; k < 3; k++) { px(ctx, 3, 6 + k * 2, 3, 1, '#5a4636'); px(ctx, 10, 6 + k * 2, 3, 1, '#5a4636'); }   // 文字
  px(ctx, 11, 3, 1, 3, '#5a4636');                                                                    // しおり
}
function drawSeed(ctx) { ctx.clearRect(0, 0, 32, 32); px(ctx, 7, 4, 2, 6, '#6aa84f'); px(ctx, 4, 5, 3, 2, '#8fcf6a'); px(ctx, 9, 3, 3, 2, '#8fcf6a'); px(ctx, 5, 10, 6, 3, '#8a6238'); }
function drawCreature(ctx, kind) {
  ctx.clearRect(0, 0, 32, 32);
  if (kind === 'deer') { px(ctx, 4, 7, 7, 3, '#c08040'); px(ctx, 10, 4, 3, 3, '#c08040'); px(ctx, 11, 2, 1, 2, '#6e4c2a'); px(ctx, 13, 1, 1, 3, '#6e4c2a'); px(ctx, 4, 10, 1, 3, '#8a5a2a'); px(ctx, 9, 10, 1, 3, '#8a5a2a'); }
  else if (kind === 'wolf') { px(ctx, 3, 7, 8, 3, '#7d8597'); px(ctx, 10, 5, 4, 3, '#7d8597'); px(ctx, 10, 4, 1, 1, '#5a6070'); px(ctx, 12, 4, 1, 1, '#5a6070'); px(ctx, 1, 6, 2, 1, '#7d8597'); px(ctx, 4, 10, 1, 3, '#5a6070'); px(ctx, 9, 10, 1, 3, '#5a6070'); }
  else if (kind === 'fish') { px(ctx, 4, 6, 7, 4, '#ef9a4a'); px(ctx, 2, 5, 2, 6, '#d8803a'); px(ctx, 9, 7, 1, 1, '#3a2418'); }
  else if (kind === 'human') { px(ctx, 7, 2, 3, 3, '#d6a880'); px(ctx, 7, 1, 3, 1, '#3a281e'); px(ctx, 6, 5, 5, 5, '#bc8040'); px(ctx, 5, 6, 1, 3, '#d6a880'); px(ctx, 11, 6, 1, 3, '#d6a880'); px(ctx, 7, 10, 1, 4, '#4a3a2c'); px(ctx, 9, 10, 1, 4, '#4a3a2c'); }
  else if (kind === 'bird') { px(ctx, 6, 6, 4, 4, '#9ab4cc'); px(ctx, 9, 2, 2, 4, '#9ab4cc'); px(ctx, 11, 3, 3, 1, '#e8b040'); px(ctx, 7, 10, 1, 4, '#5a6070'); px(ctx, 9, 10, 1, 4, '#5a6070'); }
}
const iconURL = (() => { const cache = {}; return (key, fn) => { if (!cache[key]) { const c = document.createElement('canvas'); c.width = c.height = 32; fn(c.getContext('2d')); cache[key] = c.toDataURL(); } return cache[key]; }; })();

// ---- 手に持つもの ----
const LIFE_SUBS = [['seed', TX('たね', 'Seeds')], ['deer', TX('シカ', 'Deer')], ['wolf', TX('オオカミ', 'Wolf')], ['fish', TX('サカナ', 'Fish')], ['bird', TX('サギ', 'Heron')], ['human', TX('ヒト', 'Human')]];
function toolOf() {
  if (G.hand === 'soil') return G.sub.soil;
  if (G.hand === 'water') return G.sub.water;
  if (G.hand === 'life') return G.sub.life === 'seed' ? 'grass' : G.sub.life;
  return 'look';
}
function setHand(h) {
  G.hand = h; G.tool = toolOf();
  if (h) { G.did['pick_' + h] = 1; G.did['pick_' + G.sub[h]] = 1; }   // 選んだことのある道具（まだのものには印。v060）
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
    b.classList.toggle('new', !!map[k] && !G.did['pick_' + k]);   // まだ一度も選んでいない道具に小さな光（v060。2026-10-14 ユーザー）
    // 持っている道具は、もう一度押すとしまう（説明に出す）
    if (!b.dataset.t0) b.dataset.t0 = b.title;
    b.title = G.hand === k ? TX('しまう（もう一度押す・Esc）', 'Put away (press again or Esc)') : b.dataset.t0;
  });
  $('btnBook').hidden = !G.started;
  showNew();
  drawHands();
  // 手に持っているものの中身（扇のように上に並ぶ）。水がめは一つだけでも、ほかと同じく出す（2026-10-13 ユーザー）
  const fan = $('fan');
  if (G.hand) {
    const items = G.hand === 'soil' ? [['dig', TX('土をけずる', 'Dig')], ['raise', TX('土を盛る', 'Pile up')]] : G.hand === 'water' ? [['spring', TX('泉をわかせる', 'Make a spring')]] : LIFE_SUBS.filter(([k]) => k === 'seed' || u[k]);
    fan.innerHTML = items.map(([k, label]) => {
      const n = KINDS[k] || k === 'seed' ? `<em>${W.stock[k]}</em>` : k === 'raise' ? `<em id="soilN">${Math.floor(W.soil)}</em>` : '';
      const ic = k === 'dig' ? iconURL('bagd', c => drawBag(c, 0.5, false)) : k === 'raise' ? iconURL('bagr', c => drawBag(c, 0.8, true)) : k === 'spring' ? iconURL('jar', c => drawJar(c, 0.7)) : k === 'seed' ? iconURL('seed', drawSeed) : iconURL('c' + k, c => drawCreature(c, k));
      const cls = [(KINDS[k] || k === 'seed') && W.stock[k] <= 0 ? 'empty' : '', G.did['pick_' + k] ? '' : 'new'].filter(Boolean).join(' ');
      return `<button type="button" data-sub="${k}" aria-pressed="${G.sub[G.hand] === k}"${cls ? ` class="${cls}"` : ''}><img src="${ic}" alt="">${label}${n}</button>`;
    }).join('') +
      // しまう: 並びのいちばん右に「×」だけ（v039。2026-10-13 ユーザー「草やシカのならびの最後に馴染む色味で ×」。v034〜v038 は持っている道具の角の × 印）
      `<button type="button" class="putaway" data-put title="${TX('しまう（Esc）', 'Put away (Esc)')}" aria-label="${TX('しまう（Esc）', 'Put away (Esc)')}"><b aria-hidden="true">×</b></button>`;
    const hb = document.querySelector(`.hand[data-hand="${G.hand}"]`), r = hb.getBoundingClientRect(), fr = field.getBoundingClientRect();
    fan.style.left = Math.max(8, r.left - fr.left + r.width / 2) + 'px';
    fan.hidden = false; document.body.classList.add('fan-open');
    const fw = fan.offsetWidth, cxp = r.left - fr.left + r.width / 2;   // 画面からはみ出さないように
    fan.style.left = Math.max(fw / 2 + 8, Math.min(fr.width - fw / 2 - 8, cxp)) + 'px';
    fan.querySelectorAll('[data-sub]').forEach(b => b.onclick = () => { G.sub[G.hand] = b.dataset.sub; setHand(G.hand); Sound.play('click'); });
    fan.querySelector('[data-put]').onclick = () => { Sound.unlock(); dropHand(); };
  } else { fan.hidden = true; document.body.classList.remove('fan-open'); }
}
let handSig = '';
function drawMeters() {   // 量の線（ゲージ）は v040 でやめた（ユーザー「情報が二重化・選んだ印の黄色とまざってノイズ」）。量はふくろ・かめの絵の中身で見せる
  const n = $('soilN'); if (n) n.textContent = Math.floor(W.soil);
  const bag = document.querySelector('.hand[data-hand="soil"]');
  bag.classList.toggle('empty', W.soil < 1);
  if (G.hand) setCursor();
}
const SOIL_FULL = 300;
function drawHands() {
  drawMeters();
  const lifeN = ['deer', 'wolf', 'fish', 'bird', 'human'].reduce((s, k) => s + ((G.unlock || {})[k] ? W.stock[k] : 0), 0);
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
  if (key === 'genes') markNew('genes');   // 遺伝子の頁がひらけた
  const h = key === 'water' ? 'water' : key === 'soil' ? 'soil' : key === 'genes' ? null : 'life';
  const el = h ? document.querySelector(`.hand[data-hand="${h}"]`) : $('btnBook');
  if (el) { el.classList.remove('glow'); void el.offsetWidth; el.classList.add('glow'); }
}
(() => { const c = $('btnBook').querySelector('canvas').getContext('2d'); drawBook(c); })();
// メニューの印（画素の巻物の三本線）
(() => { const c = $('btnMenu').querySelector('canvas').getContext('2d'); for (let k = 0; k < 3; k++) { px(c, 3, 4 + k * 4, 10, 2, '#e6dcc4'); px(c, 3, 5 + k * 4, 10, 1, '#a08260'); } })();

// ---- メニュー（Esc。2026-10-13 ユーザー「Esc で中央にメニュー」）。開いているあいだは時を止める ----
// v067（2026-10-14 ユーザー「セーブ・ロードを一から見直して。シンプルに」）: セーブ・ロードはなくした。開くと、いまの世界を書きとめて、
//   見出しの下に「いまの世界を書きとめた」。タイトルへ・ゲームを終えるは、書きとめてからすぐ（たずねない）。
//   自由な箱庭のときだけ「大地をつくりなおす」（新しい自由な箱庭。たしかめる）
let menuSpeed = null;
function openMenu() {
  if (!G.started || COL || ENDING) return;
  closeBook();
  if (menuSpeed === null) { menuSpeed = G.speed; setSpeed(0); }
  G.menuOpen = true;
  const where = G.mode === 'free' ? TX('自由な箱庭', 'Free Garden') : isFree() ? TX('十の年のあと', 'After the Ten Years') : yearOf(Math.floor(G.ch));
  showPanel(`<p class="mtitle">${where}${TX(`　第 ${W.day} 日`, ` · Day ${W.day}`)}</p><p class="msub noted-line" id="menuNoted">${TX('書きとめている…', 'Noting down…')}</p>`, [
    { label: TX('つづける', 'Resume'), main: true, fn: closeMenu },
    // 観察帳は右下の印・B キーからひらく（v024。2026-10-15 ユーザー「ESC メニューから観察帳を外して」）
    { label: TX('設定', 'Settings'), fn: () => { G.menuOpen = false; openSettings(() => openMenu()); } },
    { label: TX('大地をつくりなおす', 'Make new land'), fn: () => { G.menuOpen = false; remakeFree(); } },   // 十の年でも（v025。2026-10-15 ユーザー）
    { label: TX('タイトルへ', 'Title screen'), fn: () => { G.menuOpen = false; toTitle(); } },
    { label: TX('ゲームを終える', 'Quit'), fn: () => { G.menuOpen = false; quitGame(); } },
  ]);
  $('panel').classList.add('menu', 'world');
  noteWorld(true).then(ok => { const el = $('menuNoted'); if (el) el.textContent = ok ? TX('いまの世界を書きとめた', 'This world is noted down') : TX('書きとめられなかった', 'Couldn’t note it down'); });
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

// タイトルへ（2026-10-13 ユーザー「メニューの最初からの代わりにタイトルに戻れるように」）。いまの世界を書きとめてから、すぐ（v067）
async function toTitle() {
  await noteWorld(true);
  G.started = false;                 // ページを閉じたときに書きとめるのも、もうしない（タイトルのうしろは別の大地）
  menuSpeed = null; setHand(null); closeBook(); closeLog(); G.sel = null; updateCard(); setSpeed(1);
  newGame(); layout(V.cw, V.ch);    // タイトルのうしろは、ひらいたときと同じ新しい大地に（2026-10-13 ユーザー「箱庭が切り替わってない」）
  document.body.classList.remove('paused'); chapterLine('', ''); clearToasts(); start();
}
// 大地をつくりなおす（v067 は自由な箱庭だけ。v025 で十の年も。2026-10-15 ユーザー「通常モードにも」）。「もどる」を先に選んでおく。
//   十の年は第一の年から、岩と土だけの新しい大地で。自由な箱庭は、全部そろった新しい大地で（もう一つの世界には さわらない）
function remakeFree() {
  const free = G.mode === 'free';
  const yr = isFree() ? TX('十の年のあと', 'after the Ten Years') : yearOf(Math.floor(G.ch));
  const where = free ? TX(`自由な箱庭（第 ${W.day} 日）`, `This Free Garden (day ${W.day})`) : TX(`十の年の世界（${yr}・第 ${W.day} 日）`, `Your Ten Years world (${yr}, day ${W.day})`);
  showPanel(TX(`<p class="mtitle">大地をつくりなおす</p><p class="warn">${free ? 'いまの箱庭' : 'いまの世界'}は、消えてしまう</p><p class="small center">${where}は、<br>もとにはもどせない。${free ? '' : '<br>第一の年から、新しい大地で。'}</p>`, `<p class="mtitle">Make new land</p><p class="warn">Your current ${free ? 'garden' : 'world'} will be gone</p><p class="small center">${where}<br>can’t be brought back.${free ? '' : '<br>You start again from the First Year on new land.'}</p>`), [   // はじめからと同じ形（2026-10-14 ユーザー）
    { label: free ? TX('箱庭を消して、新しい大地へ', 'Erase it and start on new land') : TX('世界を消して、新しい大地へ', 'Erase it and start on new land'), cls: 'danger', fn: () => {
      menuSpeed = null; setHand(null); G.sel = null; updateCard(); setSpeed(1); chapterLine('', ''); clearToasts();
      newGame(undefined, !free); layout(V.cw, V.ch); syncHands();
      if (!free) enterChapter(0);   // 第一の年の札（タイトルの「はじめる」と同じ）
      noteWorld(true); Sound.play('spring');
    } },
    { label: TX('もどる', 'Back'), main: true, fn: () => openMenu() },
  ]);
  $('panel').classList.add('menu', 'world'); G.panelBack = openMenu;
}
// 設定（v016。2026-10-13 ユーザー「設定メニューを追加して」「メニューには文字フォント切り替えは必要ない。設定画面に移して」）
//   音楽・効果音・文字・背景（v017 で観察帳のてびきから移した）。言語は v020 でタイトルの右上だけに（遊んでいるとちゅうで読み直すと、
//   ページを離れるときに書きとめるのが走るので）。押すとその場で切りかわる。back があれば「もどる」でそこへ（メニュー）。
//   いちばん下に「ファイル」（ほかの端末へ持っていく。v067 でセーブの札からここへ）
function openSettings(back, focus) {
  const on = v => v ? TX('オン', 'On') : TX('オフ', 'Off'), again = k => () => openSettings(back, k);
  const bi = BACK_CHOICES.findIndex(([k]) => k === backName);
  showPanel(`<p class="mtitle">${TX('設定', 'Settings')}</p>`, [
    { label: TX('音楽', 'Music'), vol: 'bgm' },   // 音の大きさは、光の数（0〜5）。その場で変わり、札は作り直さない（v023）
    { label: TX('効果音', 'Sound effects'), vol: 'sfx' },
    { label: TX('曲（試験）　', 'Tune (test): ') + Sound.trackName(Sound.track()), fn: () => { const ts = Sound.tracks; Sound.setTrack(ts[(ts.indexOf(Sound.track()) + 1) % ts.length]); again(2)(); } },
    { label: TX('文字　', 'Font: ') + (fontName === 'dot' ? TX('ドット', 'Pixel') : TX('明朝', 'Serif')), fn: () => { setFont(fontName === 'dot' ? 'serif' : 'dot'); again(3)(); } },
    { label: TX('背景　', 'Background: ') + (bi >= 0 ? BACK_CHOICES[bi][1] : TX('ほか', 'Other')), fn: () => { setBack(BACK_CHOICES[(bi + 1) % BACK_CHOICES.length][0]); again(4)(); } },
    { label: TX('数の印　', 'Population marks: ') + on(tallyOn), fn: () => { setTally(!tallyOn); again(5)(); } },
    { label: TX('ボクセル（試験）　', 'Voxels (test): ') + VOX_NAME[VOXSMOOTH], fn: () => { setVoxSmooth(nextVox()); again(6)(); } },
    ...(G.started ? [{ label: TX('ファイル', 'File'), fn: () => openFilePanel(() => openSettings(back, 7)) }] : []),
    { label: back ? TX('もどる', 'Back') : TX('とじる', 'Close'), main: true, fn: () => { if (back) back(); } },
  ]);
  $('panel').querySelectorAll('.btns .tbtn').forEach((el, n) => { if (n < 2) volRow(el, n ? 'sfx' : 'bgm', n ? TX('効果音', 'Sound effects') : TX('音楽', 'Music')); });
  $('panel').classList.add('menu', 'world', 'settings');   // 設定のあいだは、世界をうすくしない（背景を選びやすく。css）
  G.panelBack = back || (() => { $('overlay').hidden = true; });
  if (focus !== undefined) $('panel').querySelectorAll('.btns .tbtn')[focus]?.focus();   // 押したボタンに印を残す（上下の矢印でつづけて選べる）
}
// 音の大きさの行（v023）: 名前と、5 つの小さな灯り。灯りを押すとその数に（いちばん上の灯りをもう一度押すと一つへる。0 は鳴らさない）。
//   左右の矢印でも変えられる。押しても札は作り直さない（上下の矢印でほかの行へ移れるように）
function volRow(el, kind, name) {
  el.classList.add('volrow'); el.textContent = '';
  el.innerHTML = `<span class="vname">${name}</span><span class="vlights">${[1, 2, 3, 4, 5].map(i => `<i data-v="${i}"></i>`).join('')}</span>`;
  el.setAttribute('aria-label', name);
  const paint = () => { const v = Sound.level(kind); el.querySelectorAll('i').forEach(d => d.classList.toggle('on', +d.dataset.v <= v)); el.classList.toggle('mute', !v); el.setAttribute('aria-valuenow', v); };
  const put = v => { Sound.setLevel(kind, v); paint(); if (kind === 'sfx') Sound.play('put'); };
  el.setAttribute('role', 'slider'); el.setAttribute('aria-valuemin', 0); el.setAttribute('aria-valuemax', 5);
  el.onclick = e => {
    Sound.unlock();
    const d = e.target.closest('i'), now = Sound.level(kind);
    put(d ? (+d.dataset.v === now ? now - 1 : +d.dataset.v) : (now + 1) % 6);
  };
  el.onkeydown = e => { if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { put(Sound.level(kind) + (e.key === 'ArrowRight' ? 1 : -1)); e.preventDefault(); } };
  paint();
}
// ゲームを終える: いまの世界を書きとめてから、すぐ保管庫へ（v067。たずねない）。保管庫へ（v019 で入口へ移し、v028 で調整のため保管庫へもどした）
async function quitGame() {
  await noteWorld(true);
  G.started = false;
  location.href = '../archive.html';
}
// 文字（2026-10-13 ユーザー「ピクセル風のフォント」「いまのフォントも雰囲気に合うので切りかえられると」）。
//   ドット＝DotGothic16（Google Fonts、SIL Open Font License。商用も無料）、明朝＝これまでの文字。localStorage に覚える
//   はじめは明朝（2026-10-13 ユーザー「デフォルトはきれいなフォントに」）。v014 で 'font' に覚えた値は使わない
const FONT_KEY = 'asobi-lab/edge-falls-2/font2';
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
  const [mx, my] = at(W.moon.a - V.yaw - Math.PI / 2, r4 * 0.68);                       // 月は満ち欠けの形で（v2。3×3 の右・左が欠ける）
  const lit = moonPhase().lit, wax = moonPhase().ph < Math.PI;
  P(mx - 1, my - 1, 3, 3, '#3a4460'); if (lit > 0.15) P(mx - 1 + (lit < 0.6 ? (wax ? 2 : 0) : lit < 0.9 ? (wax ? 1 : 0) : 0), my - 1, lit < 0.6 ? 1 : lit < 0.9 ? 2 : 3, 3, '#e4e8ee');
  if (springTide()) { for (let k = -2; k <= 2; k++) P(cx + k, cy + 5 + ((k & 1) ? 1 : 0), 1, 1, '#9cc4e8'); }   // 大潮: 大地の下に波の印
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
  if (b) logMsg(b, a);   // 章のことばも、あとで読み返せる（ui.js。見出しつきで少し目立たせる）
  $('lineA').textContent = a; $('lineB').textContent = b;
  const el = $('line'); el.classList.toggle('on', !!(a || b));
  clearTimeout(lineT); if (a || b) lineT = setTimeout(() => el.classList.remove('on'), sec * 1000);
  if (toastOn()) placeToast();   // いま出ている知らせは、章のことばの下へ（v053）
}

// ---- 観察帳の未読（2026-10-14 ユーザー「観察帳にも新しい要素があったら未読マーク」）----
//   新しいこと（見つけたこと・できた年・遺伝子の頁）が書きこまれると、観察帳の印と、その頁のタブに、吹き出しと同じ小さな光。
//   その頁をひらくと消える。ひらいているあいだは、新しく書きこまれたもの（見つけたことの絵）にも光（freshIds。とじるか頁を変えると消える）。
//   G.unread = { 頁: { id: 1 } }。記録に残す（save.js）
let freshIds = {};
function markNew(pg, id) { G.unread = G.unread || {}; (G.unread[pg] = G.unread[pg] || {})[id || '_'] = 1; showNew(); }
function showNew() {
  const u = G.unread || {}, has = pg => !!u[pg] && Object.keys(u[pg]).length > 0;
  document.querySelectorAll('.tabs [data-page]').forEach(b => b.classList.toggle('new', has(b.dataset.page)));
  $('btnBook').classList.toggle('new', Object.keys(u).some(has));
}

// ---- 観察帳 ----
// ひらいているあいだは時を止める（2026-10-13 ユーザー）。閉じると、もとの速さへ（ひらいたまま速さを変えたら、そのまま）
let page = 'life', bookSpeed = null, bookFromMenu = false;
function openBook(p, fromMenu) {
  if (p && p !== page) freshIds = {};
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
  $('book').hidden = true; closeLightbox(); bookFromMenu = false; freshIds = {};
  if (bookSpeed !== null) { if (G.speed === 0) setSpeed(bookSpeed); bookSpeed = null; }
}
$('btnBook').onclick = () => { Sound.unlock(); Sound.play('click'); $('btnBook').classList.remove('glow'); $('book').hidden ? openBook() : closeBook(); };
$('bookClose').onclick = closeBook;
document.querySelectorAll('.tabs [data-page]').forEach(b => b.onclick = () => { Sound.play('click'); openBook(b.dataset.page); });
function renderBook() {
  if ($('book').hidden) return;
  const u = G.unlock || {};
  if (G.unread && G.unread[page]) { Object.assign(freshIds, G.unread[page]); delete G.unread[page]; showNew(); }   // ひらいた頁は読んだことに
  if (page === 'life') drawChart();
  if (page === 'genes') { $('genesLocked').hidden = !!u.genes; $('genesBody').hidden = !u.genes; if (u.genes) { updateGenes(); drawGeneChart(); } }
  if (page === 'finds') renderFinds();
  if (page === 'years') renderYears();
  document.querySelectorAll('.legend [data-k]').forEach(el => { el.hidden = !u[el.dataset.k]; });
  $('stockTxt').textContent = ['deer', 'wolf', 'fish', 'bird', 'human'].filter(k => u[k]).map(k => KINDS[k].name + ' ' + W.stock[k]).join(TX('・', ' · ')) || TX('まだからっぽ', 'Still empty');
}
function renderYears() {
  const rows = CHAPTERS.map((c, n) => {
    const d = G.done && G.done[n];
    if (d) return `<li class="done${freshIds['ch' + n] ? ' fresh' : ''}"><b>${yearOf(n)}${TX('　', ': ')}${c.title}</b><span>${TX(`第 ${d.day} 日にできた`, `Done on day ${d.day}`)}</span>${d.what ? `<p>${d.what}</p>` : ''}<p>${c.truth}</p></li>`;
    if (n === Math.floor(G.ch)) return `<li class="now"><b>${yearOf(n)}${TX('　', ': ')}${c.title}</b><span>${TX('いまの年', 'This year')}</span><p>${c.text}</p>${G.helped ? `<p class="hint">${c.hint}</p>` : ''}</li>`;
    return `<li class="later"><b>${yearOf(n)}</b><span>……</span></li>`;
  }).join('');
  $('years').innerHTML = rows + (isFree() ? TX('<li class="done"><b>そして</b><span>十の年がめぐった</span><p>ここからは自由な箱庭。</p></li>', '<li class="done"><b>And then</b><span>The Ten Years have turned</span><p>From here on, it’s a Free Garden.</p></li>') : '');
}

// ---- 見つけたこと（観察の記録） ---- 一覧の FINDS は finds.js（v2 で book.js が 60KB をこえたので分けた）
const SKETCH_KEY = 'asobi-lab/edge-falls-2/sketch';
let sketches = {}; try { sketches = JSON.parse(localStorage.getItem(SKETCH_KEY) || '{}'); } catch (e) { sketches = {}; }
let accFind = 0, wantSketch = null;
// 知らせを出す「見つけたこと」（大きな出来事・遊びの手がかりになるもの）。のこりは静かに観察帳へ
const FIND_LOUD = new Set(['fall', 'abyss', 'born', 'bigtide', 'eclipse', 'stillsun', 'longlegs', 'bigbody', 'bigfish', 'longbeak', 'species', 'litter', 'follow']);
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
    // 知らせを出すのは大きな出来事だけ（v017。2026-10-14 気になること 2「知らせが多い」）。ほかは観察帳に書きとめて、観察帳の印が光るだけ。
    //   知らせを出すものも、前の知らせから世界の半日はあける（あいだに見つけたものは静かに書きとめる）
    const loud = FIND_LOUD.has(id) && W.t - (G.findT || -1e9) > DAY / 2;
    if (loud) { G.findT = W.t; toast(TX(`見つけた　${title}　— ${text}`, `Discovery: ${title} — ${text}`), 5); Sound.play('put'); }
    wantSketch = id;
    $('btnBook').classList.remove('glow'); void $('btnBook').offsetWidth; $('btnBook').classList.add('glow');
    markNew('finds', id);
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
function addPage(id) { /* 年の頁は G.done から作るので、ここでは観察帳の印だけ */ markNew('years', id); $('btnBook').classList.remove('glow'); void $('btnBook').offsetWidth; $('btnBook').classList.add('glow'); }
function renderFinds() {
  const f = G.found || {};
  $('findN').textContent = TX(`${Object.keys(f).length} ／ ${FINDS.length}`, `${Object.keys(f).length} / ${FINDS.length}`);
  $('finds').innerHTML = FINDS.map(([id, title, text]) => f[id]
    ? `<figure${freshIds[id] ? ' class="fresh"' : ''}>${sketches[id] ? `<button type="button" class="shot" data-find="${id}" aria-label="${TX(`${title}の絵を大きく見る`, `See the picture of ${title} larger`)}"><img src="${sketches[id]}" alt=""></button>` : '<div class="blank"></div>'}<figcaption><b>${title}</b><span>${TX(`第 ${f[id].day} 日`, `Day ${f[id].day}`)}</span><p>${text}</p></figcaption></figure>`
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
  ['rotate', () => !touchy() && G.chT > DAY * 0.4, TX('大地の外をドラッグすると、回して見られる。ホイールで寄る。左のボタンでも', 'Drag outside the land to turn it, and scroll to zoom. The buttons on the left work too')],
  ['speed', () => G.ch >= 1 && G.chT > DAY * 0.3, TX('右上の天の輪を押すと、時が止まる。下の ›› で速くなる', 'Press the Sky Dial at the top right to stop time. The ›› marks below make it go faster')],
  ['sun', () => G.ch >= 2 && G.chT > DAY * 1.5, TX('太陽は、つかんで動かせる。押すと止まる。止めた真下は日ざしがたまって暖かく、長く止めると乾いて焼ける。反対がわは夜のまま冷える', 'You can grab the Sun and move it. Press it to stop it. Right under a stopped Sun, sunlight builds up and warms the land; stop it too long and it dries and scorches. The far side stays in night and cools')],
  ['wsun', () => CHAPTERS[G.ch] && CHAPTERS[G.ch].key === 'winter' && seasonOf() === 3, TX('冬が来た。太陽をシカの草地の上で止めると、そこだけ暖かい', 'Winter is here. Stop the Sun over the deer’s grassland to keep just that place warm')],
  ['book', () => G.ch >= 3 && G.chT > DAY, TX('右下の観察帳に、いきものの移り変わりが書いてある', 'The Field Notes at the bottom right show how life is changing')],
  ['moon', () => G.ch >= 6 && G.chT > DAY, TX('月を寄せると、潮で水がそちらへ寄る。新月と満月のころは潮が大きく（大潮。天の輪の下に波の印）、サカナは満月に卵を産む', 'Bring the Moon closer and the tide pulls the water toward it. Around the new and full moon the tides are big (spring tides; a wave mark under the Sky Dial), and fish lay eggs at the full moon')],
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
];
const printFont = px => `${px}px ${fontName === 'dot' ? '"DotGothic16",' : ''}"Hiragino Mincho ProN","Yu Mincho","Noto Serif JP",serif`;
function printWords() {
  const yr = Math.floor((W.t / DAY + 0.1 * YEAR) / YEAR) + 1;
  const nf = Object.keys(G.found || {}).length;
  return TX({ title: '果ての滝の箱庭 2', sub: `${isFree() ? '自由な箱庭・' : ''}${yr} 年目の${SEASONS[seasonOf()]}・第 ${W.day} 日　見つけたこと ${nf} ／ ${FINDS.length}　あそびラボ` },
    { title: 'Edge Falls Garden 2', sub: `${isFree() ? 'Free Garden · ' : ''}Year ${yr}, ${SEASONS[seasonOf()]} · Day ${W.day}   Discoveries ${nf} / ${FINDS.length}   Asobi Lab` });
}
// 見たままの絵（v2）: 画面を写さず、版画のために大きなキャンバス（幅 2400）へ、いまの向き・寄り・平行移動のまま一度だけ描き直す。
//   画素の板も細かくする（PRINT。粒は残して線をくっきり）。遊ぶための印（止めた印・選んだ輪・足もとの輪・泉の印・道すじ）は描かない。重いのは押した一瞬だけ
function seenCanvas() {
  const W0 = 2400, H0 = Math.round(W0 * V.ch / Math.max(1, V.cw)), out = document.createElement('canvas'); out.width = W0; out.height = H0;
  const o = out.getContext('2d'), k = W0 / Math.max(1, V.cw);
  const keep = { cw: V.cw, ch: V.ch, panX: V.panX, panY: V.panY, sel: G.sel };
  try {
    PRINT = true; buf = null; G.sel = null;
    V.panX = (V.panX || 0) * k; V.panY = (V.panY || 0) * k;
    layout(W0, H0);
    const t = performance.now() / 1000;
    o.fillStyle = '#05070e'; o.fillRect(0, 0, W0, H0);
    V.dirty = true; drawWorld(o, t, null);
  } finally {
    PRINT = false; buf = null; G.sel = keep.sel;
    V.panX = keep.panX; V.panY = keep.panY; layout(keep.cw, keep.ch);
  }
  return out;
}
function printCanvas(kind, seen) {
  const src = seen || seenCanvas(), Wi = src.width, Hi = src.height, w = printWords();
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
  const seen = seenCanvas();   // 描き直すのは一度だけ（v2）
  const made = PRINTS.map(([k]) => { try { return printCanvas(k, seen); } catch (e) { return null; } });
  const thumb = c => { const t = document.createElement('canvas'), w = 300; t.width = w; t.height = Math.round(c.height * w / c.width); const x = t.getContext('2d'); x.imageSmoothingQuality = 'high'; x.drawImage(c, 0, 0, t.width, t.height); return t.toDataURL('image/jpeg', 0.85); };
  const cells = PRINTS.map(([k, name, note], n) => made[n] ? `<figure class="pcard"><button type="button" class="pshot" data-pv="${n}" aria-label="${TX(`${name}を大きく見る`, `See ${name} larger`)}"><img src="${thumb(made[n])}" alt=""></button><figcaption><b>${name}</b><span>${note}</span><button type="button" class="tbtn" data-ps="${n}">${TX('画像で保存', 'Save as image')}</button></figcaption></figure>` : '').join('');
  showPanel(TX(`<h2>世界の版画</h2><p class="small center">いま見えている世界を、一枚の絵にする。型を選んで「画像で保存」。押すと大きく見られる。</p>`, `<h2>World Prints</h2><p class="small center">Turn the world you see now into a single picture. Choose a style and press “Save as image”. Press one to see it larger.</p>`) + `<div class="prints">${cells}</div>`,
    [{ label: back ? TX('もどる', 'Back') : TX('とじる', 'Close'), main: true, fn: back }]);
  $('panel').classList.add('world', 'printpanel'); G.panelBack = back || (() => { $('overlay').hidden = true; });
  const panel = $('panel');
  panel.querySelector('.tbtn.main')?.focus({ preventScroll: true }); panel.scrollTop = 0;   // 開いたときは一番上（型の一覧）から（PLAYTEST #18）
  panel.querySelectorAll('[data-ps]').forEach(b => b.onclick = () => savePrint(made[+b.dataset.ps], PRINTS[+b.dataset.ps][0]));
  panel.querySelectorAll('[data-pv]').forEach(b => b.onclick = () => {
    const n = +b.dataset.pv; Sound.play('click');
    lbId = null; $('lbImg').src = made[n].toDataURL('image/png'); $('lbTitle').textContent = PRINTS[n][1]; $('lbDay').textContent = ''; $('lbText').textContent = PRINTS[n][2];
    $('lightbox').classList.add('print'); $('lightbox').hidden = false;
  });
}
$('btnPrint').onclick = () => { Sound.unlock(); closeBook(); openPrints(null); };
