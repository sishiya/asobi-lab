// 画面: 牧場・大会・記録帳のタブ、選んだ恐竜の操作バー、シート（詳しく・結果・大会に出る恐竜・おまかせ・説明）。
// 牧場とメダル・記録はブラウザに保存する（消えることがある。説明のシートに書いている）。
// 読み込み順: sound → store → ranch → view → race → sheets → shell → main（main がさいごに画面を作って始める）

// ---------- タブ ----------
let tab = 'ranch';
function setTab(t) {
  tab = t;
  for (const k of ['ranch', 'cups', 'book']) {
    $('tab-' + k).setAttribute('aria-selected', k === t);
    $('panel-' + k).hidden = k !== t;
  }
  if (t === 'ranch') { paintPortraits($('ranch'), ranch); paintPortraits($('nurseryBox'), kids); }
  if (t === 'cups') renderCups();
  if (t === 'book') renderBook();
  if (t === 'ranch') renderCups(); // 次のお題
  updateSelection();
}
for (const k of ['ranch', 'cups', 'book']) $('tab-' + k).addEventListener('click', () => setTab(k));

// ---------- あそびかた（メニューは shell.js） ----------
$('btnTipOk').addEventListener('click', () => { prog.tipDone = true; saveProg(); $('tip').hidden = true; });

// ---------- はじめ ----------
readInk();
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { readInk(); renderRanch(); renderKids(); });
load();
$('tip').hidden = !!prog.tipDone;
giveJoiners(); // 段が開いていて、まだ来ていない仲間（セーブを読み込んだときなど）
renderRanch(); renderKids(); renderCups(); renderBanner();
measure([...ranch, ...kids].filter(x => !x.rec), () => { save(); renderRanch(); renderKids(); });
for (const x of ranch) noteRecord(x);
let resizeT = 0;
addEventListener('resize', () => { clearTimeout(resizeT); resizeT = setTimeout(() => { paintPortraits($('ranch'), ranch); paintPortraits($('nurseryBox'), kids); if (tab === 'book') drawBookChart(); }, 150); });
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
  idleRun();
  requestAnimationFrame(loop);
  showTitle();
}

window.__dino = {VIEW, get ranch() { return ranch; }, get kids() { return kids; }, get prog() { return prog; }, stepView, finishView, startView, setTab, openDetail, openPick, showEnding, showTitle, exportSave, ask};
