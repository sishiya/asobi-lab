// かけっこと大会: 結果のシート、大会のお題の一覧、出る恐竜を選ぶ、記録帳。

// ---------- かけっこ ----------
// entries: [{name, g, me}]。cup があれば大会（勝ち負けとメダル）
// 当日の調子（v004）: 自分の恐竜は、走り方を毎回ほんの少しずらして走る（GA の「少しずらした2回目」と同じ大きさ）。
// ライバルはいつもの走り。お題の steady（はじめの2つ）はずらさない
function runRace(entries, {cup = null} = {}) {
  const ghosts = cup && cup.ghosts ? cup.ghosts.map(k => REFS[k]) : [];
  const steady = cup && cup.steady, day = (Math.random() * 1e9) | 0;
  const genomes = entries.map((e, i) => e.me && !steady ? jitter(e.g, day + i * 7919) : e.g);
  prog.races++; saveProg();
  startView(genomes, entries.map(e => e.name), {mode: 'race', ghosts, onEnd: res => showResult(entries, res, cup, ghosts)});
}

$('btnRace').addEventListener('click', () => {
  const list = selected.map(id => ranch.find(x => x.id === id)).filter(Boolean).slice(0, MAX_RACE);
  if (!list.length) return;
  runRace(list.map(x => ({name: x.name, g: x.g, me: true, x})));
});

// この子のいつもの幅（しっかり度をはかった10通り）と、今回の位置
function dayBand(x, r) {
  const rb = x && x.rec && x.rec.rb; if (!rb) return '';
  if (!r.ok) return `<span class="day">${TX(`今回は${r.fell ? '転んだ' : '時間切れ'}。この子はふだん${rb.n}回中${rb.ok}回ゴール${rb.ok >= 0.8 * rb.n ? '（運が悪かった。もう一度でたいていは走りきれる）' : '（練習するとしっかりしやすい）'}`, `${r.fell ? 'Fell' : 'Time up'} this time. Usually finishes ${rb.ok}/${rb.n}${rb.ok >= 0.8 * rb.n ? ' (bad luck — it will usually finish next time)' : ' (training tends to make it steadier)'}`)}</span>`;
  if (rb.lo == null) return '';
  const lo = Math.min(rb.lo, r.t) - 0.05, hi = Math.max(rb.hi, r.t) + 0.05, at = v => (100 * (v - lo) / (hi - lo)).toFixed(1);
  const word = r.t <= rb.lo + 0.02 ? TX('絶好調', 'On form') : r.t >= rb.hi - 0.02 ? TX('いまひとつ', 'Off day') : TX('いつもどおり', 'As usual');
  return `<span class="day">${TX(`今回は<b>${word}</b>（ふだん ${rb.lo.toFixed(2)}〜${rb.hi.toFixed(2)}秒）`, `This time: <b>${word}</b> (usually ${rb.lo.toFixed(2)}–${rb.hi.toFixed(2)}s)`)}<span class="day-bar"><i style="left:${at(rb.lo)}%;width:${(at(rb.hi) - at(rb.lo)).toFixed(1)}%"></i><b style="left:${at(r.t)}%"></b></span></span>`;
}

function showResult(entries, res, cup, ghosts) {
  const rows = res.map(r => ({...r, me: entries[r.i].me, x: entries[r.i].x, ghost: false}));
  for (const gh of ghosts) rows.push({label: gh.name, ok: true, t: gh.t, v: FINISH / gh.t, ghost: true});
  rows.sort((x, y) => (y.ok - x.ok) || (x.ok ? x.t - y.t : y.dist - x.dist));
  let banner = '', ending = false;
  if (cup) {
    const mine = res[0], rivals = res.slice(1).map(r => ({finishT: r.finishT}));
    const won = cup.win({finishT: mine.finishT, fell: mine.fell, dist: mine.dist}, {rivals});
    const x = entries[0].x;
    if (won) {
      const first = !prog.medals[cup.id];
      if (first || mine.t < prog.medals[cup.id].t) prog.medals[cup.id] = {t: mine.t, name: x.name, date: new Date().toISOString().slice(0, 10)};
      saveProg();
      const news = first ? tierNews() : '';
      banner = `<div class="result-banner win${first ? ' medal-get' : ''}">${first ? '<span class="medal-big" aria-hidden="true">★</span>' : ''}<div><b>${first ? TX('メダル獲得！', 'Medal won!') : TX('クリア！', 'Cleared!')}</b> ${TX(`「${esc(cup.title)}」`, `“${esc(cup.title)}”`)}${first ? TX(`<br>牧場が1匹分広がりました（${slots()}匹まで）`, `<br>The ranch grew by one (room for ${slots()})`) : ''}${news}</div></div>`;
      SFX.play(first ? 'medal' : 'done');
      if (first) { renderRanch(); renderKids(); }
      renderCups();
    } else {
      const gap = cupGap(cup, mine, rivals);
      banner = `<div class="result-banner"><b>${mine.fell ? TX('転んでしまった…', 'Took a tumble…') : TX('おしい！', 'So close!')}</b> ${TX(`「${esc(cup.title)}」`, `“${esc(cup.title)}”`)}${gap ? '<br>' + gap : ''}<br><span class="hint">${TX('次の一手: ', 'Next step: ')}${esc(cup.hint || TX('練習させたり、かけ合わせたりして、もう一度。', 'Train or breed, then try again.'))}</span></div>`;
    }
  }
  ending = cup && allMedals() && !prog.endingSeen; // ぜんぶそろった → 「つづき」でエンディング（× で閉じたときは sheets.js）
  let place = 0; // ゴーストは順位に数えない
  const items = rows.map(r => `<li class="${r.me && cup && rows.length > 1 ? 'me' : ''}">
    <span class="no">${r.ghost ? '–' : ++place}</span><span class="nm">${esc(r.label)}${r.ghost ? TX('（目安）', ' (pace line)') : ''}</span>
    <span class="tm">${r.ok ? fmtT(r.t) : (r.fell ? TX('転倒', 'Fell') : '—')}</span>
    <span class="sub">${r.ghost ? kmhText(r.v) : `${r.ok ? '' : r.dist.toFixed(1) + 'm' + TX(' ・ ', ' · ')}${TX('平均 ', 'avg ')}${kmhText(r.v)}`}${r.me && !(cup && cup.steady) ? dayBand(r.x, r) : ''}</span></li>`).join('');
  const foot = rows.filter(r => !r.ghost && r.a).map(r => `${esc(r.label)}: ${kmhText(r.a.v)}${TX(`（歩幅 ${r.a.lambda.toFixed(2)}m）`, ` (stride ${r.a.lambda.toFixed(2)}m)`)}`).join('<br>');
  openSheet(cup ? TX('大会の結果', 'Cup results') : TX('かけっこの結果', 'Race results'), `${banner}<ol class="rank">${items}</ol>
    ${cup && cup.steady ? '' : `<p class="hint">${TX('本番は毎回ほんの少し調子がちがいます（ライバルはいつもの走り）。', 'Race-day form varies a little every time (rivals always run their usual way).')}</p>`}
    ${foot ? `<details class="foot-est"><summary>${TX('足あとだけが残ったとしたら（推定）', 'If only footprints were left (estimate)')}</summary><p class="small">${foot}</p><p class="hint">${TX('歩幅と腰の高さから速さを出す Alexander（1976）の式。化石の足あとから恐竜の速さを見積もるのに使われています。実際の速さとのずれも見どころ。', "Alexander's (1976) formula estimates speed from stride length and hip height. It is used to estimate dinosaur speeds from fossil trackways. Compare it with the actual speed.")}</p></details>` : ''}
    <div class="btn-row"><button type="button" id="btnAgain">${TX('もう一度', 'Run again')}</button><button type="button" class="primary" id="btnResClose">${ending ? TX('つづき ▶', 'Continue ▶') : TX('閉じる', 'Close')}</button></div>`, 'result');
  $('btnAgain').onclick = () => runRace(entries, {cup});
  $('btnResClose').onclick = ending ? showEnding : closeSheet;
}
function cupGap(cup, mine, rivals) {
  if (mine.finishT == null) return TX(`${mine.dist.toFixed(1)}m で${mine.fell ? '転んだ' : '時間切れ（40秒）'}`, mine.fell ? `Fell at ${mine.dist.toFixed(1)}m` : `Time up (40s) at ${mine.dist.toFixed(1)}m`);
  const rivalT = rivals.map(r => r.finishT).filter(t => t != null);
  const target = cup.target ?? (rivalT.length ? Math.min(...rivalT) : null);
  return target ? TX(`あと ${(mine.finishT - target).toFixed(2)}秒`, `${(mine.finishT - target).toFixed(2)}s short`) : '';
}

// ---------- 段が開いたときのおくりもの（v004） ----------
// 中級: ストルティオミムスが仲間入り（牧場がいっぱいなら生まれた子の欄へ）。上級: おまかせで体の形も変えられる
function giveJoiners() {
  for (const sp of SPECIES) {
    if (!sp.joins || prog.joined[sp.id] || !tierOpen(sp.joins)) continue;
    prog.joined[sp.id] = true; saveProg();
    const x = starter(sp);
    if (ranch.some(y => y.id === x.id)) continue;
    if (ranch.length < slots()) { x.isNew = true; ranch.push(x); } else kids.push(x); // 写しでなくそのものを入れる（記録をはかって書きこむ先）
    save(); renderRanch(); renderKids();
    measure([x].filter(y => !y.rec), () => { save(); renderRanch(); renderKids(); });
    return sp;
  }
  return null;
}
function tierNews() {
  const out = [];
  const sp = giveJoiners();
  if (sp) { out.push(TX(`中級のお題が開きました。<b>${esc(spName(sp))}</b>が牧場に仲間入り！`, `Intermediate cups are open. <b>${esc(spName(sp))}</b> joins your ranch!`)); cupTier = 2; }
  if (tierOpen(3) && !prog.joined.evolveBody) { prog.joined.evolveBody = true; saveProg(); out.push(TX('上級のお題が開きました。おまかせの進化で<b>体の形も変える</b>が使えます。', 'Advanced cups are open. Auto-evolve can now <b>Also change body shape</b>.')); cupTier = 3; }
  return out.map(t => `<br><span class="news">${t}</span>`).join('');
}

// ---------- 大会 ----------
function nextCupOf() { return CUPS.find(c => !prog.medals[c.id] && tierOpen(c.tier)); }
function renderCups() {
  const won = Object.keys(prog.medals).length;
  $('medalCount').textContent = `${won}/${CUPS.length}`;
  // 牧場のタブの上に「次のお題」（開いている段の、まだのお題のうち、いちばん上）。はじめてのかけ合わせの前は、最初の1組をすすめる
  const next = nextCupOf(), nb = $('nextCup');
  nb.hidden = !next;
  if (next) {
    const first = !prog.born && !kids.length && prog.medals.first;
    nb.innerHTML = first
      ? TX(`<span><b>まずは</b> <b>ヴェロキラプトル</b>と<b>コンプソグナトゥス</b>を選んで「かけ合わせる」。体の近い2匹ほど、子が転びにくい。</span>`, `<span><b>First,</b> select <b>Velociraptor</b> and <b>Compsognathus</b> and tap “Breed”. The closer two bodies are, the less their young fall.</span>`)
      : `<span><b>${TX('次のお題', 'Next cup')}</b> ${esc(next.title)} — ${esc(next.text)}</span><button type="button" class="chip-btn" id="btnNextCup">${TX('出場する', 'Enter')}</button>`;
    if (!first) $('btnNextCup').onclick = () => openPick(next);
  }
  // 段は1つずつ見せる（v005。上の切りかえで初級・中級・上級）。はじめは、まだ取っていないお題のある、開いている段
  if (!cupTier || !TIERS.some(T => T.id === cupTier)) cupTier = (TIERS.find(T => tierOpen(T.id) && !tierDone(T.id)) || TIERS.filter(T => tierOpen(T.id)).pop()).id;
  $('tierSeg').innerHTML = TIERS.map(T => {
    const list = CUPS.filter(c => c.tier === T.id), got = list.filter(c => prog.medals[c.id]).length;
    return `<button type="button" role="tab" data-tier="${T.id}" aria-selected="${T.id === cupTier}">${tierOpen(T.id) ? '' : '🔒 '}${T.name}<small>${got}/${list.length}</small></button>`;
  }).join('');
  $('cupList').innerHTML = TIERS.filter(T => T.id === cupTier).map(T => {
    const open = tierOpen(T.id), list = CUPS.filter(c => c.tier === T.id);
    const head = open ? '' : `<p class="hint"><b>${TX(`${TIERS[T.id - 2].name}のお題をぜんぶ取ると開きます。`, `Opens when you win every ${TIERS[T.id - 2].name} cup.`)}</b>${T.gift ? '<br>' + esc(T.gift) : ''}</p>`;
    return head + `<div class="cup-list">${list.map(c => {
      const m = prog.medals[c.id];
      const who = [...(c.rivals || []).map(id => spName(SPECIES.find(s => s.id === id))), ...(c.ghosts || []).map(k => REFS[k].short + TX('（目安）', ' (pace line)'))];
      return `<div class="cup${m ? ' won' : ''}${open ? '' : ' locked'}">
        <span class="medal">${m ? '★' : open ? TX('まだ', 'Not yet') : '🔒'}</span>
        <h3>${esc(c.title)}</h3>
        <p>${esc(c.text)}${who.length ? `<br>${TX('いっしょに走る: ', 'Running with: ')}${esc(who.join(TX('、', ', ')))}` : ''}</p>
        <span class="best">${m ? `${TX('クリア: ', 'Cleared: ')}${esc(m.name)} ${fmtT(m.t)}` : ''}</span>
        ${open ? `<button type="button" data-cup="${c.id}"${m ? '' : ' class="primary"'}>${m ? TX('もう一度出る', 'Enter again') : TX('出場する', 'Enter')}</button>` : ''}
      </div>`;
    }).join('')}</div>`;
  }).join('');
}
let cupTier = 0;
$('cupList').addEventListener('click', e => { const b = e.target.closest('[data-cup]'); if (b) openPick(CUPS.find(c => c.id === b.dataset.cup)); });
$('tierSeg').addEventListener('click', e => { const b = e.target.closest('[data-tier]'); if (b) { cupTier = +b.dataset.tier; renderCups(); } });

function openPick(cup) {
  // 出られる恐竜を先に、その中は速い順
  const list = [...ranch].sort((a, b) => (!!cupBlock(cup, a) - !!cupBlock(cup, b)) || ((a.rec?.finishT ?? 999) - (b.rec?.finishT ?? 999)));
  openSheet(TX(`「${cup.title}」に出る恐竜`, `Enter “${cup.title}”`), `<p class="hint">${esc(cup.text)}${cup.steady ? '' : TX('<br>本番は毎回ほんの少し調子がちがいます。「10回中◯回ゴール」が多い子ほど転びにくい。', '<br>Race-day form varies a little every time. The more of its 10 tries a dinosaur finishes, the less likely it is to fall.')}</p><ul class="pick">${list.map(x => {
    const why = cupBlock(cup, x);
    return `<li><button type="button" data-id="${esc(x.id)}"${why ? ' disabled' : ''}><canvas data-portrait="${esc(x.id)}"></canvas>
      <b>${esc(x.name)}</b><span class="why">${fmtMass(bodyPlan(x.g).M)}${TX(' ・ ', ' · ')}${x.rec ? recShort(x.rec) : TX('記録なし', 'No record')}${x.rec && x.rec.rb && !cup.steady ? TX(' ・ ', ' · ') + rbText(x.rec) : ''}${why ? '<br>' + esc(why) : ''}</span></button></li>`;
  }).join('')}</ul>`, 'pick');
  paintPortraits($('sheetBody'), list);
  $('sheetBody').querySelector('.pick').onclick = e => {
    const b = e.target.closest('button[data-id]'); if (!b || b.disabled) return;
    const x = ranch.find(y => y.id === b.dataset.id);
    const rivals = (cup.rivals || []).map(id => starter(SPECIES.find(s => s.id === id)));
    runRace([{name: x.name, g: x.g, me: true, x}, ...rivals.map(r => ({name: TX('ライバル ', 'Rival ') + r.name, g: r.g, me: false}))], {cup});
  };
}

// ---------- 記録帳 ----------
function renderBook() {
  const b = prog.best;
  const cls = CLASSES.map(c => { const e = prog.classes[c.id]; return `<tr><td>${c.name}</td><td>${e ? `${fmtT(e.t)}${TX(`（${kmhText(FINISH / e.t)}）`, ` (${kmhText(FINISH / e.t)})`)}` : '—'}</td><td>${e ? esc(e.name) + TX(`（${fmtMass(e.M)}）`, ` (${fmtMass(e.M)})`) : ''}</td></tr>`; }).join('');
  const refs = Object.values(REFS).map(r => ({name: r.name, t: r.t, note: r.note}));
  if (b) refs.push({name: TX(`あなたの最速（${b.name}）`, `Your fastest (${b.name})`), t: b.t, note: `${fmtMass(b.M)}${TX('・', ' · ')}${b.gen ? TX(b.gen + '代目', 'Gen ' + b.gen) : TX('はじめの恐竜', 'Founder')}`, me: true});
  refs.sort((x, y) => x.t - y.t);
  const res = RESEARCH.map(r => {
    const e = prog.research && prog.research[r.id], v = e ? FINISH / e.t : 0, pct = Math.round(100 * v / r.v);
    return `<tr><td>${esc(r.name)}<br><span class="note">${fmtMass(r.M)}${TX(' ・ ', ' · ')}${TX(`推定 秒速 ${r.v}m（${kmhText(r.v)}）`, `est. ${r.v} m/s (${kmhText(r.v)})`)}</span></td>
      <td>${e ? `${esc(e.name)}${TX(`（${fmtMass(e.M)}）`, ` (${fmtMass(e.M)})`)}<br><span class="note">${TX(`秒速 ${v.toFixed(1)}m`, `${v.toFixed(1)} m/s`)}</span>` : '—'}</td>
      <td><span class="pct"><i style="width:${Math.min(100, pct)}%"></i></span>${e ? pct + '%' : ''}</td></tr>`;
  }).join('');
  const pages = {
    sum: `<div class="stat">
      <div><span>${TX('最速の 100m', 'Fastest 100m')}</span><b>${b ? fmtT(b.t) : '—'}</b><span>${b ? esc(b.name) : ''}</span></div>
      <div><span>${TX('メダル', 'Medals')}</span><b>${Object.keys(prog.medals).length} / ${CUPS.length}</b></div>
      <div><span>${TX('生まれた子', 'Hatchlings')}</span><b>${TX(`${prog.born}匹`, `${prog.born}`)}</b></div>
      <div><span>${TX('いちばん新しい世代', 'Latest generation')}</span><b>${TX(`${prog.maxGen}代目`, `Gen ${prog.maxGen}`)}</b></div>
      <div><span>${TX('練習', 'Training runs')}</span><b>${TX(`${prog.practiced}回`, `${prog.practiced}`)}</b></div>
      <div><span>${TX('かけっこ', 'Races')}</span><b>${TX(`${prog.races}回`, `${prog.races}`)}</b></div>
    </div>
    <h3>${TX('体重クラスごとの最速', 'Fastest by weight class')}</h3>
    <table><thead><tr><th>${TX('体重', 'Weight')}</th><th>100m</th><th>${TX('恐竜', 'Dinosaur')}</th></tr></thead><tbody>${cls}</tbody></table>`,
    speed: `<h3>${TX('体重と速さ（相似則）', 'Weight and speed (scaling)')}</h3>
    <canvas id="bookChart" class="book-chart" aria-label="${TX('体重と速さの図', 'Chart of weight and speed')}"></canvas>
    <p class="note">${TX('● あなたの恐竜（牧場と生まれた子、体重クラスの最速）、□ 研究の推定（Sellers &amp; Manning 2007）、△ 人・ダチョウ・ゾウ。横は体重（目盛りは10倍ずつ）。体を2倍にすると重さは8倍、筋肉が関節を回す力も8倍になりますが、重い体を長い脚で支えるのに要る力は16倍。だから大きいほど力が足りず、遅くなります（Hutchinson &amp; Garcia 2002）。', '● Your dinosaurs (ranch, hatchlings and the fastest in each weight class), □ research estimates (Sellers &amp; Manning 2007), △ human, ostrich, elephant. Across: weight (each mark is ×10). Double the body size and weight goes up 8×, and so does the turning force of the muscles — but holding a heavy body up on long legs takes 16× the force. So the bigger the animal, the less strength it has to spare, and the slower it runs (Hutchinson &amp; Garcia 2002).')}</p>
    <h3>${TX('研究の推定とくらべる', 'Compare with research estimates')}</h3>
    <p class="note">${TX('Sellers &amp; Manning（2007）は、化石から作った骨格の模型をコンピューターの中で進化させて走らせ、最高速度を見積もりました。体重が半分〜2倍の、あなたの最速の恐竜とくらべます（100m の平均の速さ。スタートの加速もふくむので、少し不利）。研究の模型は筋肉や腱がもっとくわしく、推定にも幅があります。', 'Sellers &amp; Manning (2007) built skeleton models from fossils, evolved them to run inside a computer, and estimated their top speeds. Each is compared with your fastest dinosaur weighing between half and twice as much (average speed over 100m, including the start, so slightly unfavourable). The research models have more detailed muscles and tendons, and their estimates have a range too.')}</p>
    <table><thead><tr><th>${TX('研究の推定', 'Research estimate')}</th><th>${TX('あなたの恐竜', 'Your dinosaur')}</th><th>${TX('推定の何%', '% of estimate')}</th></tr></thead><tbody>${res}</tbody></table>`,
    real: `<h3>${TX('本物とくらべる（100m）', 'Compare with real animals (100m)')}</h3>
    <table><thead><tr><th></th><th>100m</th><th>${TX('時速', 'km/h')}</th></tr></thead><tbody>${refs.map(r => `<tr${r.me ? ' style="font-weight:700"' : ''}><td>${esc(r.name)}<br><span class="note">${esc(r.note)}</span></td><td>${fmtT(r.t)}</td><td>${TX(`${kmh(FINISH / r.t)}km`, kmh(FINISH / r.t))}</td></tr>`).join('')}</tbody></table>
    <p class="note">${TX('ゾウとダチョウは全力の速さから計算した目安です（100m を同じ速さで走るとして）。', 'Elephant and ostrich times are rough guides worked out from their top speeds (as if they held that speed for the full 100m).')}</p>`,
  };
  $('bookSeg').innerHTML = BOOK_PAGES.map(([k, name]) => `<button type="button" role="tab" data-page="${k}" aria-selected="${k === bookPage}">${name}</button>`).join('');
  $('book').innerHTML = `<div class="book">${pages[bookPage]}</div>`;
  if (bookPage === 'speed') drawBookChart();
}
// 記録帳は3ページ（v005）: まとめ・体重と速さ（図と研究の推定）・本物とくらべる
const BOOK_PAGES = [['sum', TX('まとめ', 'Summary')], ['speed', TX('体重と速さ', 'Weight & speed')], ['real', TX('本物とくらべる', 'Real animals')]];
let bookPage = 'sum';
$('bookSeg').addEventListener('click', e => { const b = e.target.closest('[data-page]'); if (b) { bookPage = b.dataset.page; renderBook(); $('screens').scrollTop = 0; } });

// 体重（対数）と速さの図。図鑑の図表ふうに、インクの線と記号で
function drawBookChart() {
  const cv = $('bookChart'); if (!cv) return;
  const dpr = window.devicePixelRatio || 1, rc = cv.getBoundingClientRect(); if (!rc.width) return;
  cv.width = Math.round(rc.width * dpr); cv.height = Math.round(rc.height * dpr);
  const ctx = cv.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const W = rc.width, H = rc.height, pad = {l: 40, r: 14, t: 14, b: 30};
  const m0 = 0.5, m1 = 20000, v1 = 20;
  const X = M => pad.l + (W - pad.l - pad.r) * Math.log(M / m0) / Math.log(m1 / m0);
  const Y = v => H - pad.b - (H - pad.t - pad.b) * Math.min(v, v1) / v1;
  const font = getComputedStyle(document.body).fontFamily;
  ctx.font = '11px ' + font; ctx.lineWidth = 1;
  ctx.strokeStyle = INK['paper-line']; ctx.fillStyle = INK.muted;
  for (const M of [1, 10, 100, 1000, 10000]) { const x = X(M); ctx.beginPath(); ctx.moveTo(x, pad.t); ctx.lineTo(x, H - pad.b); ctx.stroke(); ctx.textAlign = 'center'; ctx.fillText(fmtMass(M), x, H - pad.b + 14); }
  for (let v = 0; v <= v1; v += 5) { const y = Y(v); ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(W - pad.r, y); ctx.stroke(); ctx.textAlign = 'right'; ctx.fillText(v + '', pad.l - 6, y + 4); }
  ctx.save(); ctx.translate(11, (pad.t + H - pad.b) / 2); ctx.rotate(-Math.PI / 2); ctx.textAlign = 'center'; ctx.fillText(TX('秒速（m）', 'Speed (m/s)'), 0, 0); ctx.restore();
  ctx.textAlign = 'center'; ctx.fillText(TX('体重', 'Weight'), W / 2, H - 4);
  // 研究の推定 □
  ctx.strokeStyle = INK['ink-soft']; ctx.lineWidth = 1.4; ctx.fillStyle = INK['ink-soft']; ctx.textAlign = 'left';
  for (const r of RESEARCH) { const x = X(r.M), y = Y(r.v); ctx.strokeRect(x - 4, y - 4, 8, 8); ctx.fillText(TX(r.name.slice(0, 5), r.en.length > 7 ? r.en.slice(0, 6) + '.' : r.en), x + 6, y - 5); }
  // 人・ダチョウ・ゾウ △
  for (const r of Object.values(REFS)) { const x = X(r.M), y = Y(FINISH / r.t); ctx.beginPath(); ctx.moveTo(x, y - 5); ctx.lineTo(x + 5, y + 4); ctx.lineTo(x - 5, y + 4); ctx.closePath(); ctx.stroke(); ctx.fillText(r.short, x + 6, y + 12); }
  // あなたの恐竜 ●（ゴールした子）
  const mine = [...ranch, ...kids].filter(x => x.rec && x.rec.finishT != null).map(x => ({M: bodyPlan(x.g).M, v: FINISH / x.rec.finishT}));
  for (const e of Object.values(prog.classes)) mine.push({M: e.M, v: FINISH / e.t, best: true});
  for (const p of mine) { ctx.beginPath(); ctx.arc(X(p.M), Y(p.v), p.best ? 4.5 : 3.2, 0, Math.PI * 2); ctx.fillStyle = p.best ? INK.accent : INK.ink; ctx.fill(); }
}
