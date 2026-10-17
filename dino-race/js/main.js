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
  // サムネイルを撮るとき（?thumb）: 場面を描いて止め、title を ready に。?thumb=<絵> で絵を選ぶ（../tools/make-thumbs.ps1）
  //   orig（v001〜v007 と同じ: ティラノの2.6秒目、名前と物差しつき）／big（同じティラノを、名前・物差しなしで大きく）／
  //   raptor（orig の作りで、ラプトルが似た姿勢の瞬間）／run（v008: タイトルと同じ絵づくりで、ラプトル1匹を大きく）
  const kind = new URLSearchParams(location.search).get('thumb') || 'orig'; // 入口のサムネイルは orig（2026-10-17 ユーザーが3案から選んだ）
  document.body.classList.add('thumb');
  const one = (id, t, title) => {
    if (title) document.body.classList.add('titled');
    const st = [starter(SPECIES.find(q => q.id === id))];
    startView(st.map(x => x.g), st.map(x => x.name), {mode: 'idle-run'});
    for (let i = 0; i < t / DT; i++) stepRace(VIEW.R);
    updateCamera(true);
    drawScene($('view'), VIEW.R, VIEW.cams, {title, labels: VIEW.labels, progressH: 0});
  };
  if (kind === 'orig') one('trex', 2.6, false);
  else if (kind === 'big') one('trex', 2.6, true);
  else if (kind === 'raptor') one('raptor', +(new URLSearchParams(location.search).get('t') || 2.6), false);
  else one('raptor', 6.3, true); // 胴が水平に近く、脚を大きく開いた瞬間
  document.title = 'ready';
} else if (typeof planck === 'undefined') {
  // 物理のライブラリ（CDN）が読めなかった
  fatal(TX('恐竜を走らせる物理の計算（Planck.js）を読み込めませんでした。インターネットにつながっているか確かめて、ページを読み直してください。', 'Could not load the physics engine (Planck.js) that runs the dinosaurs. Check your internet connection and reload the page.'));
} else {
  renderSoundBtn();
  showTitle(); // 先にタイトル（練習場の恐竜の数が変わる）
  idleRun();
  requestAnimationFrame(loop);
}

window.__dino = {VIEW, get ranch() { return ranch; }, get kids() { return kids; }, get prog() { return prog; }, stepView, finishView, startView, setTab, openDetail, openPick, showEnding, showTitle, exportSave, ask};
