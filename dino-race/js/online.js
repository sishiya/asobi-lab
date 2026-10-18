// みんなの記録（オンラインのランキング。v010。決めごとは PLAN.md の v010、サーバーは ../server/）。
// サーバーと話すのはこのファイルだけ。通信するのは記録帳の「みんな」のページを開いたときと「出す」を押したときだけ。
// 失敗してもほかの遊びは止めない。牧場のセーブとは別のかぎに保存する（書き出すファイルにも入らない）。

// 送り先（1か所のスイッチ。null にすると「みんな」のページも「出す」ボタンも出ない）
const ONLINE_URL = (() => {
  if (/\/versions\//.test(location.pathname)) return null;   // 過去の版からは送らない
  const h = location.hostname;
  if (h === 'sishiya.github.io') return null;                 // 公開の送り先（Cloudflare に出したら https://… を書く）
  if (h === 'localhost' || h === '127.0.0.1') return 'http://127.0.0.1:8787'; // ローカルで試すとき（server で npm run dev）
  return null;
})();
const PHYS_VER = 'sim1';   // 物理の版。sim.js や planck を変えてタイムが変わるときは上げる（サーバーの PHYS にも足す）
const ONLINE_KEY = 'asobi-lab/dino-race/online-v1';
const STEADY_MIN = 7;      // 出せるしっかり度（10回中）

// 牧場の名前は、決まった言葉を2つ自分で選んで組み立てる（自由な文字は送らない。2026-10-18 ユーザー「A案でいこう」）。
// 番号で送るので、足すときは必ず後ろに（前の番号の言葉を変えると、もう出した名前が変わる）。数を変えたらサーバーの FARM_WORDS も。
// 自然・恐竜の時代の植物・紙と化石の言葉だけ。どう組み合わせても悪い意味にならないもの（ディレクターが確かめた）
const FARM_A = [['ひだまり', 'Sunny'], ['そよかぜ', 'Breezy'], ['あさやけ', 'Dawn'], ['ゆうやけ', 'Sunset'], ['ほしぞら', 'Starry'], ['こはく', 'Amber'], ['いしころ', 'Pebble'], ['どんぐり', 'Acorn'],
  ['シダ', 'Fern'], ['こけ', 'Moss'], ['すなはま', 'Sandy'], ['いずみ', 'Spring'], ['かせき', 'Fossil'], ['あおぞら', 'Sky'], ['わかば', 'Leafy'], ['にじ', 'Rainbow'],
  // v010 の2回目で足した（16〜）
  ['つきよ', 'Moonlit'], ['あさつゆ', 'Dewy'], ['こもれび', 'Dappled'], ['ほたる', 'Firefly'], ['やまびこ', 'Echo'], ['くるみ', 'Walnut'], ['まつぼっくり', 'Pinecone'], ['さんご', 'Coral'],
  ['ひすい', 'Jade'], ['たんぽぽ', 'Dandelion'], ['ひまわり', 'Sunflower'], ['もみじ', 'Maple'], ['さくら', 'Blossom'], ['ソテツ', 'Cycad'], ['イチョウ', 'Ginkgo'], ['トクサ', 'Horsetail'],
  ['あけぼの', 'Daybreak'], ['ゆうなぎ', 'Calm'], ['ながれぼし', 'Comet'], ['すいれん', 'Lotus'], ['しずく', 'Droplet'], ['かざぐるま', 'Pinwheel'], ['ゆきどけ', 'Snowmelt'], ['オーロラ', 'Aurora']];
const FARM_B = [['おか', 'Hill'], ['たに', 'Valley'], ['はら', 'Meadow'], ['もり', 'Wood'], ['かわら', 'Riverside'], ['みさき', 'Cape'], ['だいち', 'Plateau'], ['いりえ', 'Cove'],
  // v010 の2回目で足した（8〜）
  ['みずうみ', 'Lake'], ['ぬま', 'Marsh'], ['しま', 'Island'], ['はま', 'Shore'], ['さわ', 'Brook'], ['たき', 'Falls'], ['こみち', 'Lane'], ['せせらぎ', 'Creek'],
  ['さきゅう', 'Dune'], ['がけ', 'Cliff'], ['ほらあな', 'Cave'], ['くさはら', 'Grassland'], ['ふもと', 'Foothill'], ['わん', 'Bay'], ['うみべ', 'Seaside'], ['いけ', 'Pond'],
  ['こだち', 'Grove'], ['かわぐち', 'Rivermouth'], ['やまあい', 'Glen'], ['とうげ', 'Pass'], ['いわば', 'Crag'], ['こうげん', 'Highland']];
const farmName = f => TX(`${FARM_A[f[0]][0]}の${FARM_B[f[1]][0]}牧場`, `${FARM_A[f[0]][1]} ${FARM_B[f[1]][1]} Ranch`);

let online = {farm: null, fname: null, agreed: false, sent: {}, cache: null};
function loadOnline() {
  try { Object.assign(online, JSON.parse(localStorage.getItem(ONLINE_KEY)) || {}); } catch (e) { /* 読めなければはじめから */ }
  if (!/^[0-9a-f]{32}$/.test(online.farm || '')) online.farm = [...crypto.getRandomValues(new Uint8Array(16))].map(b => b.toString(16).padStart(2, '0')).join('');
  if (!Array.isArray(online.fname) || !(online.fname[0] in FARM_A) || !(online.fname[1] in FARM_B)) rerollFarm();
}
function saveOnline() { try { localStorage.setItem(ONLINE_KEY, JSON.stringify(online)); } catch (e) { /* 保存できなくても遊べる */ } }
// 牧場の名前を選ぶ（2つの一覧。並びは見る人の言語の五十音・ABC 順、値は番号）
function farmPickerHTML() {
  const opts = (list, cur) => list.map((w, i) => [TX(w[0], w[1]), i]).sort((a, b) => a[0].localeCompare(b[0], LANG))
    .map(([w, i]) => `<option value="${i}"${i === cur ? ' selected' : ''}>${esc(w)}</option>`).join('');
  return `<div class="ol-farm">
    <select data-farm="0" aria-label="${TX('牧場の名前（はじめの言葉）', 'Ranch name (first word)')}">${opts(FARM_A, online.fname[0])}</select>
    ${TX('<span>の</span>', '')}
    <select data-farm="1" aria-label="${TX('牧場の名前（あとの言葉）', 'Ranch name (second word)')}">${opts(FARM_B, online.fname[1])}</select>
    <span>${TX('牧場', 'Ranch')}</span>
    <button type="button" class="chip-btn" data-ol="dice">${TX('おまかせ', 'Surprise me')}</button></div>`;
}
// 選ぶと online.fname に入れて、見本（.ol-fname）を書きかえる。はじめて出す前の名前は保存もする
function bindFarmPicker(box, onChange) {
  const sel = [...box.querySelectorAll('[data-farm]')];
  const show = () => box.querySelectorAll('.ol-fname').forEach(e => e.textContent = farmName(online.fname));
  sel.forEach(el => el.onchange = () => { online.fname = sel.map(x => +x.value); show(); onChange && onChange(); });
  box.querySelector('[data-ol=dice]').onclick = () => { rerollFarm(); sel.forEach((x, k) => x.value = online.fname[k]); show(); onChange && onChange(); };
}
function rerollFarm() {
  const r = n => crypto.getRandomValues(new Uint32Array(1))[0] % n;
  let f; do { f = [r(FARM_A.length), r(FARM_B.length)]; } while (online.fname && f[0] === online.fname[0] && f[1] === online.fname[1]);
  online.fname = f;
}

// 系統: 恐竜の line（「ラプコン」「Rapcom」「ラプトル」など。作ったときの言語）から種の id 1〜2個へ。表示は見る人の言語で
const LINE_JA = {trex: 'ティラノ', raptor: 'ラプトル', compy: 'コンピー', struthio: 'ストルティオ'};
const LINE_EN = {trex: 'Tyranno', raptor: 'Raptor', compy: 'Compy', struthio: 'Struthio'};
function lineIds(line) {
  const ids = Object.keys(LINE_JA);
  const full = ids.find(k => line === LINE_JA[k] || line === LINE_EN[k]);
  if (full) return [full];
  const ja = s => ids.find(k => LINE_JA[k].slice(0, 2) === s), en = s => ids.find(k => LINE_EN[k].slice(0, 3).toLowerCase() === s.toLowerCase());
  const a = ja(line.slice(0, 2)) && ja(line.slice(2, 4)) ? [ja(line.slice(0, 2)), ja(line.slice(2, 4))] : [en(line.slice(0, 3)), en(line.slice(3, 6))];
  return a.every(Boolean) ? (a[0] === a[1] ? [a[0]] : a) : null;
}
const lineName = ids => ids.length === 1 ? TX(LINE_JA[ids[0]], LINE_EN[ids[0]]) : TX(LINE_JA[ids[0]].slice(0, 2) + LINE_JA[ids[1]].slice(0, 2), LINE_EN[ids[0]].slice(0, 3) + LINE_EN[ids[1]].slice(0, 3).toLowerCase());
const geneOnly = g => Object.fromEntries(GENES.map(d => [d.k, g[d.k]]));

// 出せるか（だめなら理由の文）
function sendBlock(x) {
  if (!ranch.includes(x)) return TX('牧場に残した恐竜だけ出せます', 'Only dinosaurs kept on the ranch can be entered');
  if (!x.gen) return TX('牧場で生まれた恐竜だけ出せます', 'Only dinosaurs born on your ranch can be entered');
  if (x.practice) return TX('練習が終わってから出せます', 'Wait until training finishes');
  if (!x.rec || x.rec.finishT == null) return TX('100m をゴールできる子だけ出せます', 'Only dinosaurs that finish the 100m can be entered');
  if (!x.rec.rb || x.rec.rb.ok < STEADY_MIN) return TX(`10回中${STEADY_MIN}回以上ゴールする子だけ出せます`, `Only dinosaurs that finish at least ${STEADY_MIN} of 10 runs can be entered`);
  if (!lineIds(x.line || '')) return TX('この子の系統がわかりません', 'This dinosaur’s line is unknown');
  return null;
}
const clsOfDino = x => classOf(x.rec.M).id;

// ---------- 通信 ----------
async function api(path, body) {
  const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), 8000);
  try {
    const res = await fetch(`${ONLINE_URL}/dino-race/${path}${path.includes('?') ? '&' : '?'}v=${PHYS_VER}`, body ? {method: 'POST', headers: {'content-type': 'application/json'}, body: JSON.stringify(body), signal: ctl.signal} : {signal: ctl.signal});
    const data = await res.json().catch(() => ({error: 'json'}));
    return data;
  } catch (e) { return {error: 'net'}; } finally { clearTimeout(timer); }
}
const errText = e => e === 'busy' ? TX('いまは混みあっています。少し待ってからもう一度どうぞ', 'Busy right now. Please wait a moment and try again')
  : e === 'same' ? TX('同じ恐竜がもう出ています', 'This exact dinosaur is already entered')
  : e === 'net' ? TX('いまはつながりません', 'Can’t connect right now')
  : TX('送れませんでした', 'Couldn’t send');

// ---------- 記録帳の「みんな」のページ ----------
const CLS_SHORT = TX({xs: '〜5kg', s: '5〜50kg', m: '50〜500kg', l: '0.5〜5t', xl: '5t〜'}, {xs: '≤5kg', s: '5–50kg', m: '50–500kg', l: '0.5–5t', xl: '>5t'}); // 375px で1行に入るように
let olCls = null, olState = 'idle', olErr = null; // idle / loading / ok / error
if (ONLINE_URL) BOOK_PAGES.push(['online', TX('みんな', 'Everyone')]);

async function loadBoard() {
  olState = 'loading'; olErr = null; if (bookPage === 'online') renderBook();
  const r = await api('board?farm=' + online.farm);
  if (r.error) { olState = 'error'; olErr = r.error; }
  else { olState = 'ok'; online.cache = {at: Date.now(), classes: r.classes, mine: r.mine}; saveOnline(); }
  if (tab === 'book' && bookPage === 'online') renderBook();
}

// 表の恐竜を、この端末の物理で計算し直す（いま見ているクラスだけ。結果は覚えておく）。
// 合わない行は薄くして「この環境では再現できず」。Safari と Chrome などで計算がわずかにちがうこともあるので、消しはしない
const olCheck = new Map(); // 遺伝子の JSON → 'ok' / 'odd' / 'wait'
function checkRows(rows) {
  const todo = rows.filter(e => !olCheck.has(JSON.stringify(e.g)));
  if (!todo.length) return;
  todo.forEach(e => olCheck.set(JSON.stringify(e.g), 'wait'));
  const id = reqId++;
  waiting.set(id, res => {
    todo.forEach((e, i) => olCheck.set(JSON.stringify(e.g), res[i].finishT != null && Math.abs(res[i].finishT - e.t) < 0.005 ? 'ok' : 'odd'));
    if (tab === 'book' && bookPage === 'online') renderBook();
  });
  worker.postMessage({type: 'check', id, genomes: todo.map(e => e.g)});
}

// はじめに開くクラス: 出した子 → 出せるいちばん速い子 → 記録のあるいちばん速い子のクラス（空の表を先に見せない）
function firstCls() {
  const sent = Object.keys(online.sent)[0]; if (sent) return sent;
  const done = ranch.filter(x => x.rec && x.rec.finishT != null).sort((a, b) => a.rec.finishT - b.rec.finishT);
  const best = done.find(x => !sendBlock(x)) || done[0];
  return best ? clsOfDino(best) : 'xs';
}
const sendableIn = cls => ranch.some(x => x.rec && x.rec.finishT != null && !sendBlock(x) && clsOfDino(x) === cls);

function onlineHTML() {
  if (!olCls) olCls = firstCls();
  const c = online.cache, rows = c ? c.classes[olCls] || [] : [], mine = c && c.mine[olCls];
  const chips = CLASSES.map(k => `<button type="button" class="chip-btn" data-cls="${k.id}" aria-pressed="${k.id === olCls}" aria-label="${k.name}">${CLS_SHORT[k.id]}${sendableIn(k.id) ? '<i class="dot" aria-hidden="true"></i>' : ''}</button>`).join('');
  const status = olState === 'loading' ? `<p class="note">${TX('読みこみ中…', 'Loading…')}</p>`
    : olState === 'error' ? `<p class="ol-err">${errText(olErr)}${c ? TX(`（${new Date(c.at).toLocaleString('ja')} の表）`, ` (table from ${new Date(c.at).toLocaleString('en')})`) : ''} <button type="button" class="chip-btn" data-ol="retry">${TX('もう一度', 'Retry')}</button></p>` : '';
  const list = rows.map((e, i) => { const ck = olCheck.get(JSON.stringify(e.g)); return `<li><button type="button" class="ol-row${mine && mine.rank === i + 1 ? ' me' : ''}${ck === 'odd' ? ' odd' : ''}" data-i="${i}">
      <b class="rk">${i + 1}</b><span class="tm">${fmtT(e.t)}<small>${ck === 'odd' ? TX('再現できず', 'not reproduced') : e.ok + '/10'}</small></span>
      <span class="who">${esc(lineName(e.line))}<small>${esc(farmName(e.fname))}</small></span></button></li>`; }).join('');
  const meLine = mine && mine.rank > rows.length ? `<p class="ol-me">${TX(`あなた ${mine.rank}位（${fmtT(mine.t)}）`, `You: #${mine.rank} (${fmtT(mine.t)})`)}</p>` : '';
  const empty = c && !rows.length ? `<p class="note">${TX('このクラスにはまだだれもいません。一番乗りのチャンス！', 'Nobody in this class yet — be the first!')}</p>` : '';
  return `<div class="ol-chips" role="group" aria-label="${TX('体重クラス', 'Weight class')}">${chips}</div>
    ${status}${empty}<ol class="ol-list">${list}</ol>${meLine}
    <div class="btn-row"><button type="button" class="primary" data-ol="send">${TX('このクラスに出す', 'Enter this class')}</button></div>
    <p class="note">${TX(`あなたの牧場: ${esc(farmName(online.fname))}`, `Your ranch: ${esc(farmName(online.fname))}`)} <button type="button" class="link ol-link" data-ol="farm">${TX('名前を変える', 'Rename')}</button><br>
    ${TX('行を押すと、その恐竜の走りをこの画面で計算して見られます。', 'Tap a row to watch that dinosaur run, computed on your device.')}
    <button type="button" class="link ol-link" data-ol="about">${TX('送るもの・送らないもの', 'What is sent')}</button></p>`;
}
function onlineBind() {
  const box = $('book');
  box.querySelectorAll('[data-cls]').forEach(b => b.onclick = () => { olCls = b.dataset.cls; renderBook(); });
  box.querySelectorAll('.ol-row').forEach(b => b.onclick = () => watchEntry(+b.dataset.i));
  box.querySelector('[data-ol=send]').onclick = () => openSendPick(olCls);
  box.querySelector('[data-ol=about]').onclick = openOnlineAbout;
  box.querySelector('[data-ol=farm]').onclick = openFarmName;
  const re = box.querySelector('[data-ol=retry]'); if (re) re.onclick = loadBoard;
  if (online.cache) checkRows(online.cache.classes[olCls] || []);
  // 開いたとき読みこむ。前に読んだ表が1分より古ければ読み直す（失敗したときは「もう一度」を待つ）
  if (olState === 'idle' || (olState === 'ok' && Date.now() - online.cache.at > 60e3)) loadBoard();
}

// ランキングの恐竜の走りを、この画面の物理で計算して見る。送られたタイムとくらべる（責めない言い方で）
function watchEntry(i) {
  const e = online.cache && online.cache.classes[olCls][i]; if (!e) return;
  const label = `${i + 1}${TX('位 ', '. ')}${lineName(e.line)}`;
  startView([e.g], [label], {mode: 'watch', onEnd: res => {
    const r = res[0], same = r.ok && Math.abs(r.t - e.t) < 0.005;
    toast(same ? TX(`${label}: 100m ${fmtT(r.t)}（記録どおり）`, `${label}: 100m ${fmtT(r.t)} (matches the record)`)
      : TX(`${label}: この環境では同じ走りになりませんでした（${r.ok ? fmtT(r.t) : TX('ゴールせず', 'no finish')}）`, `${label}: this run came out differently on your device (${r.ok ? fmtT(r.t) : 'no finish'})`), 4200);
  }});
}

// このクラスに出す子を選ぶ
function openSendPick(cls) {
  // 出せない子も灰色で理由つきで並べる（「あと1回ゴールすれば出せる」がわかるように）。出せる子が先、それぞれ速い順
  const inCls = ranch.filter(x => x.rec && x.rec.finishT != null && clsOfDino(x) === cls)
    .sort((a, b) => !!sendBlock(a) - !!sendBlock(b) || a.rec.finishT - b.rec.finishT);
  const name = CLASSES.find(k => k.id === cls).name, sent = online.sent[cls];
  const items = inCls.map(x => { const why = sendBlock(x); return `<button type="button" class="ol-pick" data-id="${esc(x.id)}"${why ? ' disabled' : ''}><b>${esc(x.name)}</b> ${fmtT(x.rec.finishT)} <small>${x.rec.rb ? x.rec.rb.ok + '/10' : ''}${sent && sent.id === x.id ? TX(' ・出しています', ' · entered') : ''}${why ? '<br>' + esc(why) : ''}</small></button>`; }).join('');
  openSheet(TX(`${name} に出す`, `Enter ${name}`), `<div class="about-body">
    ${items ? `<div class="ol-picks">${items}</div>` : `<p>${TX('このクラスの恐竜は牧場にいません。', 'You have no dinosaurs in this class.')}</p>`}
    <p class="ol-msg" aria-live="polite"></p>
    <p class="note">${TX(`出せるのは、牧場で生まれて 10回中${STEADY_MIN}回以上ゴールする子です。1つのクラスに1匹まで（出し直すと入れかわります）。`, `You can enter dinosaurs born on your ranch that finish at least ${STEADY_MIN} of 10 runs. One per class (entering again replaces it).`)}</p></div>`, 'online');
  $('sheetBody').querySelectorAll('.ol-pick').forEach(b => b.onclick = () => sendDino(ranch.find(x => x.id === b.dataset.id), b));
}

// 出す。はじめての1回だけ、送る1行の見本と「送るのはこれだけ」を見せる（そのシートの「出す」で送る）
function sendDino(x, btn) {
  const why = x && sendBlock(x); if (!x || why) { toast(why || ''); return; }
  if (online.agreed) doSend(x, btn); else confirmFirstSend(x);
}
// 送る。押したらすぐ「送っています…」でボタンを止め、失敗したらシートの中に理由（ボタンはまた押せる＝もう一度）
let sending = false;
async function doSend(x, btn) {
  if (sending) return;
  sending = true;
  const msg = $('sheetBody').querySelector('.ol-msg'), label = btn && btn.innerHTML;
  if (btn) { btn.disabled = true; btn.textContent = TX('送っています…', 'Sending…'); }
  if (msg) msg.textContent = '';
  const cls = clsOfDino(x);
  const r = await api('submit', {farm: online.farm, fname: online.fname, line: lineIds(x.line), t: x.rec.finishT, ok: x.rec.rb.ok, g: geneOnly(x.g)});
  sending = false;
  if (r.error) {
    if (btn) { btn.disabled = false; btn.innerHTML = label; }
    const text = errText(r.error) + (r.error === 'same' ? '' : TX('。もう一度押してください', '. Please try again'));
    if (msg) msg.textContent = text; else toast(text, 4200);
    return;
  }
  online.agreed = true; online.sent[r.cls] = {id: x.id, t: x.rec.finishT}; saveOnline();
  const m = r.mine[r.cls];
  toast(TX(`${x.name} を出しました: ${CLASSES.find(k => k.id === r.cls).name} で ${m.rank}位`, `Entered ${x.name}: #${m.rank} in ${CLASSES.find(k => k.id === r.cls).name}`), 4200);
  SFX.play('done');
  closeSheet();
  olCls = cls; olState = 'idle';
  setTab('book'); bookPage = 'online'; renderBook();
}
function confirmFirstSend(x) {
  openSheet(TX('みんなの記録に出す', 'Enter the shared rankings'), `<div class="about-body">
    <p>${TX('送るのは、この1行と走りのもと（遺伝子の数値）だけです。名前やあなたのことは送りません。', 'Only this one line and the dinosaur’s genes (numbers) are sent — no names or anything about you.')}</p>
    <ol class="ol-list"><li><div class="ol-row me"><b class="rk">?</b><span class="tm">${fmtT(x.rec.finishT)}<small>${x.rec.rb.ok}/10</small></span>
      <span class="who">${esc(lineName(lineIds(x.line)))}<small class="ol-fname">${esc(farmName(online.fname))}</small></span></div></li></ol>
    <h3>${TX('牧場の名前', 'Ranch name')}</h3>
    ${farmPickerHTML()}
    <p class="note">${TX('言葉を2つ選んで組み立てます（あとから「みんな」のページで変えられます）。', 'Build it from two words (you can change it later on the Everyone page).')}</p>
    <p class="ol-msg" aria-live="polite"></p>
    <div class="btn-row"><button type="button" class="primary" data-ol="yes">${TX('出す', 'Enter')}</button><button type="button" data-ol="no">${TX('やめる', 'Cancel')}</button></div></div>`, 'online-confirm');
  const body = $('sheetBody');
  bindFarmPicker(body, saveOnline);
  body.querySelector('[data-ol=yes]').onclick = e => doSend(x, e.currentTarget);
  body.querySelector('[data-ol=no]').onclick = closeSheet;
}

// 牧場の名前を変える。もう出していれば、サーバーの自分の行もすぐにそろえる
function openFarmName() {
  const before = [...online.fname];
  openSheet(TX('牧場の名前', 'Ranch name'), `<div class="about-body">
    <p class="ol-preview"><b class="ol-fname">${esc(farmName(online.fname))}</b></p>
    ${farmPickerHTML()}
    <p class="ol-msg" aria-live="polite"></p>
    <div class="btn-row"><button type="button" class="primary" data-ol="save">${TX('決める', 'Save')}</button><button type="button" data-ol="no">${TX('やめる', 'Cancel')}</button></div></div>`, 'online-farm');
  const body = $('sheetBody');
  bindFarmPicker(body);
  let saved = false; // やめたとき（× や外側を押したときも）は前の名前にもどす
  const onClose = () => { if (!$('sheet').open) { if (!saved) online.fname = before; $('sheet').removeEventListener('close', onClose); } };
  $('sheet').addEventListener('close', onClose);
  body.querySelector('[data-ol=no]').onclick = closeSheet;
  body.querySelector('[data-ol=save]').onclick = async e => {
    const btn = e.currentTarget, msg = body.querySelector('.ol-msg');
    if (online.agreed && Object.keys(online.sent).length) {
      btn.disabled = true; btn.textContent = TX('送っています…', 'Sending…'); msg.textContent = '';
      const r = await api('rename', {farm: online.farm, fname: online.fname});
      if (r.error) { btn.disabled = false; btn.textContent = TX('決める', 'Save'); msg.textContent = errText(r.error) + TX('。もう一度押してください', '. Please try again'); return; }
      olState = 'idle';
    }
    saved = true; saveOnline(); closeSheet();
    toast(TX(`牧場の名前を「${farmName(online.fname)}」にしました`, `Ranch renamed to “${farmName(online.fname)}”`));
    renderBook();
  };
}

function openOnlineAbout() {
  openSheet(TX('送るもの・送らないもの', 'What is sent'), `<div class="about-body">
    <h3>${TX('送るもの（「出す」を押したときだけ）', 'Sent (only when you press “Enter”)')}</h3>
    <p>${TX('100m のタイムとしっかり度、恐竜の系統（ラプコンなど）、遺伝子の数値、牧場の名前（決まった言葉から選んだもの）、この端末でくじ引きした牧場の番号（同じ牧場の記録を入れかえるため）。', 'The 100m time and steadiness, the dinosaur’s line (e.g. Rapcom), its gene values, your ranch name (chosen from fixed words), and a random ranch number made on this device (to replace your own entries).')}</p>
    <h3>${TX('送らないもの', 'Not sent')}</h3>
    <p>${TX('恐竜につけた名前、あなたの名前やメールなど。サーバーは IP アドレスを保存しません（送りすぎを防ぐために少しのあいだ数えるだけ）。', 'Names you gave your dinosaurs, or your name, e-mail, etc. The server does not store IP addresses (it only counts requests briefly to prevent flooding).')}</p>
    <p class="note">${TX('サーバーは Cloudflare の無料の枠で動かしています。混みあうと、その日は見られないことがあります。', 'The server runs on Cloudflare’s free tier; on busy days it may be unavailable.')}</p></div>`, 'online');
}

if (ONLINE_URL) loadOnline();
