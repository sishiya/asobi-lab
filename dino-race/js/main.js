// 画面: 牧場・生まれた子・大会・記録帳（下のタブで切りかえ。中身だけがスクロール）、選んだ恐竜の操作バー、シート（詳しく・結果・大会に出る恐竜・おまかせ・説明）。
// 牧場とメダル・記録はブラウザに保存する（消えることがある。説明のシートに書いている）。
// 読み込み順: sound → store → ranch → view → race → sheets → shell → main（main がさいごに画面を作って始める）

// ---------- 画面（下のタブ） ----------
// 画面ごとにスクロールの位置を覚えておく（中身の入れ物 #screens はひとつ）
const SCREENS = ['ranch', 'kids', 'cups', 'book'];
let tab = 'ranch';
const scrollMemo = {};
function setTab(t, {top = false} = {}) {
  if (t !== tab) scrollMemo[tab] = $('screens').scrollTop;
  tab = t;
  document.body.dataset.screen = t;
  for (const k of SCREENS) {
    $('tab-' + k).setAttribute('aria-selected', k === t);
    $('screen-' + k).hidden = k !== t;
  }
  if (t === 'ranch') { paintPortraits($('ranch'), ranch); renderCups(); } // 次のお題
  if (t === 'kids') paintPortraits($('nurseryBox'), kids);
  if (t === 'cups') renderCups();
  if (t === 'book') renderBook();
  $('screens').scrollTop = top ? 0 : scrollMemo[t] || 0;
  updateSelection();
}
for (const k of SCREENS) $('tab-' + k).addEventListener('click', () => setTab(k));
// かけっこの間、走るようすを見出しのすぐ下から画面いっぱいに（CSS の --top-h）
function measureTop() { document.documentElement.style.setProperty('--top-h', $('btnAbout').closest('.top').offsetHeight + 'px'); }

// ---------- はじめ ----------
readInk();
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { readInk(); renderRanch(); renderKids(); });
load();
measureTop();
giveJoiners(); // 段が開いていて、まだ来ていない仲間（セーブを読み込んだときなど）
renderRanch(); renderKids(); renderCups(); renderBanner();
measure([...ranch, ...kids].filter(x => !x.rec), () => { save(); renderRanch(); renderKids(); });
for (const x of ranch) noteRecord(x);
let resizeT = 0;
addEventListener('resize', () => { clearTimeout(resizeT); resizeT = setTimeout(() => { paintPortraits($('ranch'), ranch); paintPortraits($('nurseryBox'), kids); if (tab === 'book') drawBookChart(); measureTop(); }, 150); });
if (new URLSearchParams(location.search).has('thumb')) {
  // サムネイルを撮るとき（?thumb）: ティラノサウルスを数秒走らせたところで止め、title を ready に
  document.body.classList.add('thumb');
  const st = [starter(SPECIES[0])];
  startView(st.map(x => x.g), st.map(x => x.name), {mode: 'idle-run'});
  for (let i = 0; i < 2.6 / DT; i++) stepRace(VIEW.R);
  updateCamera(true);
  drawScene($('view'), VIEW.R, VIEW.cams, {labels: VIEW.labels, progressH: 0});
  document.title = 'ready';
} else if (typeof planck === 'undefined') {
  // 物理のライブラリ（CDN）が読めなかった
  fatal('恐竜を走らせる物理の計算（Planck.js）を読み込めませんでした。インターネットにつながっているか確かめて、ページを読み直してください。');
} else {
  renderSoundBtn();
  showTitle(); // 先にタイトル（練習場の恐竜の数が変わる）
  idleRun();
  requestAnimationFrame(loop);
}

window.__dino = {VIEW, get ranch() { return ranch; }, get kids() { return kids; }, get prog() { return prog; }, stepView, finishView, startView, setTab, openDetail, openPick, showEnding, showTitle, exportSave, ask};
