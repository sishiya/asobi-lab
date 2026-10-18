// 外まわり: 確認・名前の入力（ask）、タイトル画面、メニュー（あそびかた・音・データ・このゲームについて・クレジット）、
// セーブの書き出し・読み込み、全大会を制覇したときのエンディング、動かせないときやエラーのおしらせ。

const VERSION = 'ver. 1.3';
const SKIP_TITLE = 'asobi-lab/dino-race/skip-title'; // やり直し・読み込みで読み直したときはタイトルを出さない（sessionStorage）

// ---------- 確認・入力（ブラウザの confirm／prompt の代わり） ----------
// ask('…') → true/false。ask('…', {input: '今の名前'}) → 入力した文字（やめたら null）
function ask(msg, {ok = TX('はい', 'OK'), cancel = TX('やめる', 'Cancel'), input = null, max = 12} = {}) {
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
  toast(TX('思わぬエラーが起きました。おかしいときはページを読み直してください（牧場は保存されています）', 'Something went wrong. If anything looks odd, reload the page (your ranch is saved).'), 7000);
}
addEventListener('error', e => onError(e.error || e.message));
addEventListener('unhandledrejection', e => onError(e.reason));
for (const w of [worker, practiceWorker]) w.addEventListener('error', e => onError(e.message || 'worker'));

// ---------- 音のボタン ----------
function renderSoundBtn() {
  $('btnSound').setAttribute('aria-pressed', SFX.on);
  $('btnSound').classList.toggle('off', !SFX.on);
  $('btnSound').setAttribute('aria-label', SFX.on ? TX('効果音（オン）', 'Sound effects (on)') : TX('効果音（オフ）', 'Sound effects (off)'));
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
    ? `<button type="button" class="primary" data-t="go">${TX('つづきから', 'Continue')}</button><button type="button" class="quiet" data-t="new">${TX('はじめから', 'New game')}</button>`
    : `<button type="button" class="primary" data-t="go">${TX('はじめる', 'Start')}</button>`;
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
  if (b.dataset.t === 'new' && await ask(TX('はじめからやり直しますか？ 牧場・メダル・記録が消えます。', 'Start a new game? Your ranch, medals and records will be erased.'), {ok: TX('やり直す', 'Start over')})) resetAll();
});

// ---------- 言語の切りかえ（タイトル画面の JP／EN と、メニューの設定） ----------
function bindLangBtns(root) {
  for (const b of root.querySelectorAll('[data-lang]')) {
    b.setAttribute('aria-pressed', b.dataset.lang === LANG);
    b.onclick = () => { if (b.dataset.lang !== LANG) setLang(b.dataset.lang); };
  }
}
bindLangBtns($('titleScreen'));

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
  toast(TX('牧場をファイルに書き出しました', 'Ranch exported to a file'));
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
  if (!list || !list.length || list.some(x => !x) || kidList.some(x => !x)) { toast(TX('このファイルは読み込めませんでした（恐竜かけっこ牧場の書き出したファイルを選んでください）', 'This file could not be imported (choose a file exported from Dino Sprint Ranch).'), 5000); return; }
  if (!await ask(TX(`「${file.name}」を読み込みますか？ いまの牧場・メダル・記録は、ファイルの中身に置きかわります。`, `Import “${file.name}”? Your current ranch, medals and records will be replaced by the file’s contents.`), {ok: TX('読み込む', 'Import')})) return;
  const p = d.prog && typeof d.prog === 'object' ? d.prog : {};
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify({ranch: list, kids: kidList, serial: Math.max(1, d.serial | 0)}));
    localStorage.setItem(PROG_KEY, JSON.stringify({...p, medals: p.medals && typeof p.medals === 'object' ? p.medals : {}, tipDone: true}));
  } catch (e) { toast(TX('ブラウザに保存できませんでした', 'Could not save in this browser')); return; }
  reloadNoTitle();
}
$('importFile').addEventListener('change', e => { const f = e.target.files[0]; e.target.value = ''; if (f) importSave(f); });

// ---------- メニュー ----------
const CREDITS = TX(`<dl class="credits">
  <dt>企画・制作</dt><dd>あそびラボ</dd>
  <dt>物理の計算</dt><dd><a href="https://github.com/piqnt/planck.js" target="_blank" rel="noopener">Planck.js</a>（Box2D の JavaScript 版。MIT License）</dd>
  <dt>アイデアのもと</dt><dd>Sellers &amp; Manning（2007）の、恐竜の骨格を物理の中で進化させて走らせた研究</dd>
  <dt>走り方のしくみ</dt><dd>SIMBICON（Yin, Loken &amp; van de Panne 2007）に寄せたもの</dd>
  <dt>効果音</dt><dd>Web Audio でその場で作った音</dd>
</dl>`, `<dl class="credits">
  <dt>Concept and development</dt><dd>Asobi Lab</dd>
  <dt>Physics</dt><dd><a href="https://github.com/piqnt/planck.js" target="_blank" rel="noopener">Planck.js</a> (a JavaScript port of Box2D, MIT License)</dd>
  <dt>Inspiration</dt><dd>Sellers &amp; Manning (2007), who evolved dinosaur skeletons to run in a physics simulation</dd>
  <dt>Gait control</dt><dd>Based on SIMBICON (Yin, Loken &amp; van de Panne 2007)</dd>
  <dt>Sound effects</dt><dd>Generated on the fly with Web Audio</dd>
</dl>`);
function openMenu() {
  const done = Object.keys(prog.medals).length === CUPS.length;
  openSheet(TX('メニュー', 'Menu'), `<div class="menu about-body">
    <div class="btn-row"><button type="button" id="btnMenuHelp">${TX('あそびかた', 'How to play')}</button></div>
    <h3>${TX('設定', 'Settings')}</h3>
    <label class="switch"><input type="checkbox" id="chkSound"${SFX.on ? ' checked' : ''}> ${TX('効果音', 'Sound effects')}</label>
    <p class="small" id="menuLang">言語 Language <span class="langsw" role="group" aria-label="言語 Language" style="position:static;display:inline-flex;vertical-align:middle;margin-left:6px"><button type="button" data-lang="ja" aria-label="日本語">JP</button><button type="button" data-lang="en" aria-label="English">EN</button></span></p>
    <h3>${TX('データ', 'Data')}</h3>
    <p class="small">${TX('牧場と記録は、このブラウザの中にだけ保存されます（ブラウザのデータを消すと消えます）。ファイルに書き出しておくと、あとで読み込んで続きから遊べます。', 'Your ranch and records are saved only in this browser (clearing browser data erases them). Export to a file to import later and keep playing.')}</p>
    <div class="btn-row"><button type="button" id="btnExport">${TX('ファイルに書き出す', 'Export to file')}</button><button type="button" id="btnImport">${TX('ファイルから読み込む', 'Import from file')}</button></div>
    <p class="small"><button type="button" id="btnReset" class="link">${TX('はじめからやり直す（牧場・メダル・記録を消す）', 'Start over (erase ranch, medals and records)')}</button></p>
    ${done ? `<div class="btn-row"><button type="button" id="btnEnding">${TX('エンディングをもう一度見る', 'Watch the ending again')}</button></div>` : ''}
    <details><summary>${TX('このゲームについて（本物のしくみ・出どころ）', 'About this game (the real science and sources)')}</summary>${$('aboutTpl').innerHTML}</details>
    <h3>${TX('クレジット', 'Credits')}</h3>${CREDITS}
    <p class="small">${VERSION}</p>
  </div>`, 'menu');
  $('chkSound').onchange = e => { SFX.on = e.target.checked; renderSoundBtn(); if (SFX.on) SFX.play('done'); };
  $('btnExport').onclick = exportSave;
  $('btnImport').onclick = () => $('importFile').click();
  $('btnReset').onclick = async () => { if (await ask(TX('はじめからやり直しますか？ 牧場・メダル・記録が消えます。', 'Start a new game? Your ranch, medals and records will be erased.'), {ok: TX('やり直す', 'Start over')})) resetAll(); };
  if (done) $('btnEnding').onclick = showEnding;
  $('btnMenuHelp').onclick = openHelp;
  bindLangBtns($('menuLang'));
}
$('btnAbout').addEventListener('click', openMenu);

// ---------- あそびかた（v005: いつもは出さない。見出しの ? ・タイトル・メニューから開く） ----------
function openHelp() {
  openSheet(TX('あそびかた', 'How to play'), `<div class="help about-body">
    ${TX(`
    <p>恐竜をかけ合わせて育て、物理の計算で本当に走らせて、100m のかけっこの大会でメダルを集めます。</p>
    <ol class="steps">
      <li><b>牧場</b>で2匹を選んで<b>かけ合わせる</b>。子が3匹、<b>生まれた子</b>の画面で卵からかえります。体は両親のあいだ、走り方は選んだ親ゆずり。体の近い2匹ほど、子が転びにくい。</li>
      <li>生まれた子の記録を見て<b>残す</b>か決める。転んだ子も<b>練習</b>すると走れるようになることがあります（体は変わらないので、伸びには限りがあります）。</li>
      <li>残した子で<b>大会</b>へ。お題をクリアするとメダル（牧場が1匹分広がる）。初級・中級・上級の3段で、段のお題をぜんぶ取ると次の段が開きます。</li>
    </ol>
    <h3>カードの見かた</h3>
    <dl>
      <dt>100m ◯秒</dt><dd>いつもの走りでの記録。</dd>
      <dt>10回中◯回ゴール</dt><dd>本番は毎回ほんの少し調子がちがいます。調子を少しずらして10回走らせ、走りきれた数（しっかり度）。多いほど本番で転びにくい。</dd>
      <dt>親ごえ ▲</dt><dd>速いほうの親より速い子。</dd>
    </dl>
    <h3>ほかに</h3>
    <ul>
      <li>カードの「…」で詳しく。<b>おまかせで進化</b>は、群れを何世代も育てて、いちばん速い子を連れて帰ります。</li>
      <li>かけっこは 100m。40秒たってもゴールできないと、そこまでの距離が記録です。</li>
      <li><b>記録帳</b>では、体重と速さの関係（大きいほど遅くなる相似則）や、研究の推定とくらべられます。</li>
    </ul>`, `
    <p>Breed dinosaurs, raise them, race them with real physics, and win medals at 100m cups.</p>
    <ol class="steps">
      <li>On the <b>Ranch</b>, pick two and <b>Breed</b> them. Three eggs hatch on the <b>Hatchlings</b> screen. Their bodies fall between the parents’, and their gait comes from the parent you chose. The more alike the two parents’ bodies, the less likely the hatchlings are to fall.</li>
      <li>Check each hatchling’s record and decide whether to <b>Keep</b> it. Even one that fell may learn to run with <b>Train</b> (its body stays the same, so there is a limit to how much it can improve).</li>
      <li>Take your keepers to the <b>Cups</b>. Clear a cup to win a medal (the ranch grows by one space). There are three levels, Beginner, Intermediate and Advanced; win every cup in a level to open the next.</li>
    </ol>
    <h3>Reading a card</h3>
    <dl>
      <dt>100m ◯s</dt><dd>Time with its usual run.</dd>
      <dt>Finished ◯/10</dt><dd>Race-day form varies a little every time. The dino runs 10 times with its form slightly shifted; this is how many runs it finished (steadiness). Higher means less likely to fall in a race.</dd>
      <dt>Beat parents ▲</dt><dd>Faster than its faster parent.</dd>
    </dl>
    <h3>Also</h3>
    <ul>
      <li>Tap “…” on a card for details. <b>Auto-evolve</b> raises a herd for many generations and brings back the fastest one.</li>
      <li>Races are 100m. If a dino has not finished after 40 seconds, the distance it reached is its record.</li>
      <li>In <b>Records</b> you can see how weight relates to speed (the scaling law: bigger is slower) and compare with research estimates.</li>
    </ul>`)}
    <details><summary>${TX('このゲームについて（本物のしくみ・出どころ）', 'About this game (the real science and sources)')}</summary>${$('aboutTpl').innerHTML}</details>
    <div class="btn-row"><button type="button" class="primary" id="btnHelpOk">${TX('わかった', 'Got it')}</button></div>
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
  openSheet(TX('全大会制覇！', 'All cups conquered!'), `<div class="ending">
    <div class="medal-row">${CUPS.map((c, i) => `<span class="medal-s" style="animation-delay:${i * 0.08}s" title="${esc(c.title)}">★</span>`).join('')}</div>
    <p class="lead">${TX(`${CUPS.length}の大会すべてでメダルを取りました。おめでとう！`, `You won a medal in all ${CUPS.length} cups. Congratulations!`)}</p>
    <div class="facts">
      <div><span>${TX('最速の 100m', 'Fastest 100m')}</span>${b ? TX(`${fmtT(b.t)}（${esc(b.name)}）`, `${fmtT(b.t)} (${esc(b.name)})`) : '—'}</div>
      <div><span>${TX('いちばん新しい世代', 'Latest generation')}</span>${TX(`${prog.maxGen}代目`, `Gen ${prog.maxGen}`)}</div>
      <div><span>${TX('生まれた子', 'Hatchlings')}</span>${TX(`${prog.born}匹`, `${prog.born}`)}</div>
      <div><span>${TX('かけっこ', 'Races')}</span>${TX(`${prog.races}回`, `${prog.races}`)}</div>
    </div>
    ${TX(`<p>あなたがしてきたこと（体の形を少しずつ変えながら、速く走れる子を選んで残す）は、本物の研究と同じやり方です。Sellers と Manning（2007）は、化石から作った骨格の模型をコンピューターの中で何世代も走らせて、ティラノサウルスやヴェロキラプトルの最高速度を見積もりました。</p>
    <p>牧場はこのまま続けられます。記録帳の「研究の推定とくらべる」で、それぞれの恐竜の推定の速さに、どこまで近づけるか挑んでみてください。</p>`, `<p>What you have been doing (changing body shapes bit by bit and keeping the fastest runners) is the same method real researchers use. Sellers and Manning (2007) ran skeleton models built from fossils for many generations in a computer to estimate the top speeds of Tyrannosaurus and Velociraptor.</p>
    <p>Your ranch carries on. In Records, compare with research estimates and see how close you can get to each dinosaur’s estimated speed.</p>`)}
    <h3>${TX('クレジット', 'Credits')}</h3>${CREDITS}
    <p class="thanks">${TX('遊んでくれて、ありがとう。', 'Thank you for playing.')}</p>
    <div class="btn-row"><button type="button" class="primary" id="btnEndClose">${TX('牧場にもどる', 'Back to the ranch')}</button></div>
  </div>`, 'ending');
  $('btnEndClose').onclick = () => { closeSheet(); setTab('ranch'); };
}
