// 外まわり: 確認・名前の入力（ask）、タイトル画面、メニュー（あそびかた・音・データ・このゲームについて・クレジット）、
// セーブの書き出し・読み込み、全大会を制覇したときのエンディング、動かせないときやエラーのおしらせ。

const VERSION = 'ver. 1.1';
const SKIP_TITLE = 'asobi-lab/dino-race/skip-title'; // やり直し・読み込みで読み直したときはタイトルを出さない（sessionStorage）

// ---------- 確認・入力（ブラウザの confirm／prompt の代わり） ----------
// ask('…') → true/false。ask('…', {input: '今の名前'}) → 入力した文字（やめたら null）
function ask(msg, {ok = 'はい', cancel = 'やめる', input = null, max = 12} = {}) {
  const d = $('ask'), inp = $('askInput');
  $('askMsg').textContent = msg; $('askOk').textContent = ok; $('askNo').textContent = cancel;
  inp.hidden = input == null; inp.value = input ?? ''; inp.maxLength = max;
  d.returnValue = '';
  d.showModal();
  if (input != null) { inp.focus(); inp.select(); } else $('askOk').focus();
  return new Promise(res => d.addEventListener('close', () => {
    const yes = d.returnValue === 'ok';
    res(input == null ? yes : yes ? inp.value.trim().slice(0, max) || null : null);
  }, {once: true}));
}
// 入力中の Enter は「はい」（フォームの決まりのままだと先に書いた「やめる」になる）
$('askInput').addEventListener('keydown', e => { if (e.key === 'Enter' && !e.isComposing) { e.preventDefault(); $('ask').close('ok'); } });

// ---------- 動かせないとき・思わぬエラー ----------
function fatal(msg) { $('fatalMsg').textContent = msg; $('fatal').hidden = false; }
let errShown = false;
function onError(err) {
  window.__dinoErr = err;
  if (errShown) return; errShown = true;
  toast('思わぬエラーが起きました。おかしいときはページを読み直してください（牧場は保存されています）', 7000);
}
addEventListener('error', e => onError(e.error || e.message));
addEventListener('unhandledrejection', e => onError(e.reason));
for (const w of [worker, practiceWorker]) w.addEventListener('error', e => onError(e.message || 'worker'));

// ---------- 音のボタン ----------
function renderSoundBtn() {
  $('btnSound').setAttribute('aria-pressed', SFX.on);
  $('btnSound').classList.toggle('off', !SFX.on);
  $('btnSound').setAttribute('aria-label', SFX.on ? '効果音（オン）' : '効果音（オフ）');
}
$('btnSound').addEventListener('click', () => {
  SFX.on = !SFX.on; renderSoundBtn();
  if (SFX.on) SFX.play('done');
  const c = $('chkSound'); if (c) c.checked = SFX.on;
});

// ---------- タイトル画面 ----------
function hasSave() {
  try { return !!localStorage.getItem(SAVE_KEY); } catch (e) { return false; }
}
function showTitle() {
  try { if (sessionStorage.getItem(SKIP_TITLE)) { sessionStorage.removeItem(SKIP_TITLE); return; } } catch (e) { /* 出す */ }
  const has = hasSave();
  $('titleVer').textContent = VERSION;
  $('titleBtns').innerHTML = has
    ? `<button type="button" class="primary" data-t="go">つづきから</button><button type="button" class="quiet" data-t="new">はじめから</button>`
    : `<button type="button" class="primary" data-t="go">はじめる</button>`;
  $('titleScreen').hidden = false;
  document.body.classList.add('titled');
  $('titleBtns').querySelector('.primary').focus();
}
function closeTitle() {
  $('titleScreen').hidden = true;
  document.body.classList.remove('titled');
  if (VIEW.mode === 'idle-run') { VIEW.mode = 'idle'; idleRun(); } // タイトルの1匹から、牧場の練習場（2〜3匹）へ
  SFX.play('hatch');
}
$('titleBtns').addEventListener('click', async e => {
  const b = e.target.closest('[data-t]'); if (!b) return;
  if (b.dataset.t === 'go') closeTitle();
  if (b.dataset.t === 'new' && await ask('はじめからやり直しますか？ 牧場・メダル・記録が消えます。', {ok: 'やり直す'})) resetAll();
});

function reloadNoTitle() {
  try { sessionStorage.setItem(SKIP_TITLE, '1'); } catch (e) { /* タイトルが出るだけ */ }
  location.reload();
}
function resetAll() {
  try { localStorage.removeItem(SAVE_KEY); localStorage.removeItem(PROG_KEY); } catch (e) { /* 消せなくても */ }
  reloadNoTitle();
}

// ---------- セーブの書き出し・読み込み ----------
const noPractice = (k, v) => k === 'practice' || k === 'isNew' ? undefined : v;
function exportSave() {
  const data = {app: 'dino-race', format: 1, version: VERSION, saved: new Date().toISOString(), ranch, kids, serial, prog};
  const blob = new Blob([JSON.stringify(data, noPractice, 1)], {type: 'application/json'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `dino-race-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  toast('牧場をファイルに書き出しました');
}
// 読み込んだ恐竜を確かめる（遺伝子は範囲の中におさめる。名前は短く）
function cleanDino(x) {
  if (!x || typeof x !== 'object' || typeof x.id !== 'string' || typeof x.name !== 'string' || !x.g || typeof x.g !== 'object') return null;
  const g = {...x.g};
  for (const d of GENES) { if (typeof g[d.k] !== 'number' || !isFinite(g[d.k])) return null; g[d.k] = clamp(g[d.k], d.min, d.max); }
  return {...x, id: x.id.slice(0, 40), name: x.name.slice(0, 24), g, rec: null, gen: Math.max(0, x.gen | 0), parents: Array.isArray(x.parents) ? x.parents.map(String) : []};
}
async function importSave(file) {
  let d;
  try { d = JSON.parse(await file.text()); } catch (e) { d = null; }
  const list = d && d.app === 'dino-race' && Array.isArray(d.ranch) ? d.ranch.map(cleanDino) : null;
  const kidList = d && Array.isArray(d.kids) ? d.kids.map(cleanDino) : [];
  if (!list || !list.length || list.some(x => !x) || kidList.some(x => !x)) { toast('このファイルは読み込めませんでした（恐竜かけっこ牧場の書き出したファイルを選んでください）', 5000); return; }
  if (!await ask(`「${file.name}」を読み込みますか？ いまの牧場・メダル・記録は、ファイルの中身に置きかわります。`, {ok: '読み込む'})) return;
  const p = d.prog && typeof d.prog === 'object' ? d.prog : {};
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify({ranch: list, kids: kidList, serial: Math.max(1, d.serial | 0)}));
    localStorage.setItem(PROG_KEY, JSON.stringify({...p, medals: p.medals && typeof p.medals === 'object' ? p.medals : {}, tipDone: true}));
  } catch (e) { toast('ブラウザに保存できませんでした'); return; }
  reloadNoTitle();
}
$('importFile').addEventListener('change', e => { const f = e.target.files[0]; e.target.value = ''; if (f) importSave(f); });

// ---------- メニュー ----------
const CREDITS = `<dl class="credits">
  <dt>企画・制作</dt><dd>あそびラボ</dd>
  <dt>物理の計算</dt><dd><a href="https://github.com/piqnt/planck.js" target="_blank" rel="noopener">Planck.js</a>（Box2D の JavaScript 版。MIT License）</dd>
  <dt>アイデアのもと</dt><dd>Sellers &amp; Manning（2007）の、恐竜の骨格を物理の中で進化させて走らせた研究</dd>
  <dt>走り方のしくみ</dt><dd>SIMBICON（Yin, Loken &amp; van de Panne 2007）に寄せたもの</dd>
  <dt>効果音</dt><dd>Web Audio でその場で作った音</dd>
</dl>`;
function openMenu() {
  const done = Object.keys(prog.medals).length === CUPS.length;
  openSheet('メニュー', `<div class="menu about-body">
    <div class="btn-row"><button type="button" id="btnMenuHelp">あそびかた</button></div>
    <h3>設定</h3>
    <label class="switch"><input type="checkbox" id="chkSound"${SFX.on ? ' checked' : ''}> 効果音</label>
    <h3>データ</h3>
    <p class="small">牧場と記録は、このブラウザの中にだけ保存されます（ブラウザのデータを消すと消えます）。ファイルに書き出しておくと、あとで読み込んで続きから遊べます。</p>
    <div class="btn-row"><button type="button" id="btnExport">ファイルに書き出す</button><button type="button" id="btnImport">ファイルから読み込む</button></div>
    <p class="small"><button type="button" id="btnReset" class="link">はじめからやり直す（牧場・メダル・記録を消す）</button></p>
    ${done ? '<div class="btn-row"><button type="button" id="btnEnding">エンディングをもう一度見る</button></div>' : ''}
    <details><summary>このゲームについて（本物のしくみ・出どころ）</summary>${$('aboutTpl').innerHTML}</details>
    <h3>クレジット</h3>${CREDITS}
    <p class="small">${VERSION}</p>
  </div>`, 'menu');
  $('chkSound').onchange = e => { SFX.on = e.target.checked; renderSoundBtn(); if (SFX.on) SFX.play('done'); };
  $('btnExport').onclick = exportSave;
  $('btnImport').onclick = () => $('importFile').click();
  $('btnReset').onclick = async () => { if (await ask('はじめからやり直しますか？ 牧場・メダル・記録が消えます。', {ok: 'やり直す'})) resetAll(); };
  if (done) $('btnEnding').onclick = showEnding;
  $('btnMenuHelp').onclick = openHelp;
}
$('btnAbout').addEventListener('click', openMenu);

// ---------- あそびかた（v005: いつもは出さない。見出しの ? ・タイトル・メニューから開く） ----------
function openHelp() {
  openSheet('あそびかた', `<div class="help about-body">
    <p>恐竜をかけ合わせて育て、物理の計算で本当に走らせて、100m のかけっこの大会でメダルを集めます。</p>
    <ol class="steps">
      <li><b>牧場</b>で2匹を選んで<b>かけ合わせる</b>。子が3匹、<b>生まれた子</b>の画面で卵からかえります。体は両親のあいだ、走り方は選んだ親ゆずり。体の近い2匹ほど、子が転びにくい。</li>
      <li>生まれた子の記録を見て<b>残す</b>か決める。転んだ子も<b>練習</b>すると走れるようになることがあります（体は変わらないので、伸びには限りがあります）。</li>
      <li>残した子で<b>大会</b>へ。お題をクリアするとメダル（牧場が1匹分広がる）。初級・中級・上級の3段で、段のお題をぜんぶ取ると次の段が開きます。</li>
    </ol>
    <h3>カードの見かた</h3>
    <dl>
      <dt>100m ◯秒</dt><dd>いつもの走りでの記録。</dd>
      <dt>6回中◯回ゴール</dt><dd>本番は毎回ほんの少し調子がちがいます。調子を少しずらして6回走らせ、走りきれた数（しっかり度）。多いほど本番で転びにくい。</dd>
      <dt>親ごえ ▲</dt><dd>速いほうの親より速い子。</dd>
    </dl>
    <h3>ほかに</h3>
    <ul>
      <li>カードの「…」で詳しく。<b>おまかせで進化</b>は、群れを何世代も育てて、いちばん速い子を連れて帰ります。</li>
      <li>かけっこは 100m。40秒たってもゴールできないと、そこまでの距離が記録です。</li>
      <li><b>記録帳</b>では、体重と速さの関係（大きいほど遅くなる相似則）や、研究の推定とくらべられます。</li>
    </ul>
    <details><summary>このゲームについて（本物のしくみ・出どころ）</summary>${$('aboutTpl').innerHTML}</details>
    <div class="btn-row"><button type="button" class="primary" id="btnHelpOk">わかった</button></div>
  </div>`, 'help');
  $('btnHelpOk').onclick = closeSheet;
}
$('btnHelp').addEventListener('click', openHelp);
$('btnTitleHelp').addEventListener('click', openHelp);

// ---------- エンディング（お題をぜんぶクリア） ----------
const allMedals = () => Object.keys(prog.medals).length === CUPS.length;
function showEnding() {
  prog.endingSeen = true; saveProg();
  SFX.play('ending');
  const b = prog.best;
  openSheet('全大会制覇！', `<div class="ending">
    <div class="medal-row">${CUPS.map((c, i) => `<span class="medal-s" style="animation-delay:${i * 0.08}s" title="${esc(c.title)}">★</span>`).join('')}</div>
    <p class="lead">${CUPS.length}の大会すべてでメダルを取りました。おめでとう！</p>
    <div class="facts">
      <div><span>最速の 100m</span>${b ? `${fmtT(b.t)}（${esc(b.name)}）` : '—'}</div>
      <div><span>いちばん新しい世代</span>${prog.maxGen}代目</div>
      <div><span>生まれた子</span>${prog.born}匹</div>
      <div><span>かけっこ</span>${prog.races}回</div>
    </div>
    <p>あなたがしてきたこと（体の形を少しずつ変えながら、速く走れる子を選んで残す）は、本物の研究と同じやり方です。Sellers と Manning（2007）は、化石から作った骨格の模型をコンピューターの中で何世代も走らせて、ティラノサウルスやヴェロキラプトルの最高速度を見積もりました。</p>
    <p>牧場はこのまま続けられます。記録帳の「研究の推定とくらべる」で、それぞれの恐竜の推定の速さに、どこまで近づけるか挑んでみてください。</p>
    <h3>クレジット</h3>${CREDITS}
    <p class="thanks">遊んでくれて、ありがとう。</p>
    <div class="btn-row"><button type="button" class="primary" id="btnEndClose">牧場にもどる</button></div>
  </div>`, 'ending');
  $('btnEndClose').onclick = () => { closeSheet(); setTab('ranch'); };
}
