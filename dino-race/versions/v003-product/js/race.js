// かけっこと大会: 結果のシート、大会のお題の一覧、出る恐竜を選ぶ、記録帳。

// ---------- かけっこ ----------
// entries: [{name, g, me}]。cup があれば大会（勝ち負けとメダル）
function runRace(entries, {cup = null} = {}) {
  const ghosts = cup && cup.ghosts ? cup.ghosts.map(k => REFS[k]) : [];
  prog.races++; saveProg();
  startView(entries.map(e => e.g), entries.map(e => e.name), {mode: 'race', ghosts, onEnd: res => showResult(entries, res, cup, ghosts)});
}

$('btnRace').addEventListener('click', () => {
  const list = selected.map(id => ranch.find(x => x.id === id)).filter(Boolean).slice(0, MAX_RACE);
  if (!list.length) return;
  runRace(list.map(x => ({name: x.name, g: x.g, me: true, x})));
});

function showResult(entries, res, cup, ghosts) {
  const rows = res.map(r => ({...r, me: entries[r.i].me, ghost: false}));
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
      banner = `<div class="result-banner win${first ? ' medal-get' : ''}">${first ? '<span class="medal-big" aria-hidden="true">★</span>' : ''}<div><b>${first ? 'メダル獲得！' : 'クリア！'}</b> 「${esc(cup.title)}」${first ? `<br>牧場が1匹分広がりました（${slots()}匹まで）` : ''}</div></div>`;
      SFX.play(first ? 'medal' : 'done');
      if (first) { renderRanch(); renderKids(); }
      renderCups();
    } else {
      const gap = cupGap(cup, mine, rivals);
      banner = `<div class="result-banner"><b>${mine.fell ? '転んでしまった…' : 'おしい！'}</b> 「${esc(cup.title)}」${gap ? '<br>' + gap : ''}<br><span class="hint">練習させたり、かけ合わせたりして、もう一度。</span></div>`;
    }
  }
  ending = cup && allMedals() && !prog.endingSeen; // 10個そろった → 「つづき」でエンディング（× で閉じたときは sheets.js）
  let place = 0; // ゴーストは順位に数えない
  const items = rows.map(r => `<li class="${r.me && cup && rows.length > 1 ? 'me' : ''}">
    <span class="no">${r.ghost ? '–' : ++place}</span><span class="nm">${esc(r.label)}${r.ghost ? '（目安）' : ''}</span>
    <span class="tm">${r.ok ? fmtT(r.t) : (r.fell ? '転倒' : '—')}</span>
    <span class="sub">${r.ghost ? `時速 ${kmh(r.v)}km` : `${r.ok ? '' : r.dist.toFixed(1) + 'm ・ '}平均 時速 ${kmh(r.v)}km${r.a ? ` ・ 足あとから推定 時速 ${kmh(r.a.v)}km（歩幅 ${r.a.lambda.toFixed(2)}m）` : ''}`}</span></li>`).join('');
  openSheet(cup ? '大会の結果' : 'かけっこの結果', `${banner}<ol class="rank">${items}</ol>
    <p class="hint">「足あとから推定」は、歩幅と腰の高さから速さを出す Alexander（1976）の式。化石の足あとから恐竜の速さを見積もるのに使われています。</p>
    <div class="btn-row"><button type="button" id="btnAgain">もう一度</button><button type="button" class="primary" id="btnResClose">${ending ? 'つづき ▶' : '閉じる'}</button></div>`, 'result');
  $('btnAgain').onclick = () => runRace(entries, {cup});
  $('btnResClose').onclick = ending ? showEnding : closeSheet;
}
function cupGap(cup, mine, rivals) {
  if (mine.finishT == null) return `${mine.dist.toFixed(1)}m で${mine.fell ? '転んだ' : '時間切れ'}`;
  const rivalT = rivals.map(r => r.finishT).filter(t => t != null);
  const target = cup.target ?? (rivalT.length ? Math.min(...rivalT) : null);
  return target ? `あと ${(mine.finishT - target).toFixed(2)}秒` : '';
}

// ---------- 大会 ----------
function renderCups() {
  const won = Object.keys(prog.medals).length;
  $('medalCount').textContent = `${won}/${CUPS.length}`;
  // 牧場のタブの上に「次のお題」（まだのお題のうち、いちばん上）
  const next = CUPS.find(c => !prog.medals[c.id]), nb = $('nextCup');
  nb.hidden = !next;
  if (next) {
    nb.innerHTML = `<span><b>次のお題</b> ${esc(next.title)} — ${esc(next.text)}</span><button type="button" class="chip-btn" id="btnNextCup">出場する</button>`;
    $('btnNextCup').onclick = () => openPick(next);
  }
  $('cupList').innerHTML = CUPS.map(c => {
    const m = prog.medals[c.id];
    const who = [...(c.rivals || []).map(id => SPECIES.find(s => s.id === id).name), ...(c.ghosts || []).map(k => REFS[k].short + '（目安）')];
    return `<div class="cup${m ? ' won' : ''}">
      <span class="medal">${m ? '★' : 'まだ'}</span>
      <h3>${esc(c.title)}</h3>
      <p>${esc(c.text)}${who.length ? `<br>いっしょに走る: ${esc(who.join('、'))}` : ''}</p>
      <span class="best">${m ? `クリア: ${esc(m.name)} ${fmtT(m.t)}` : ''}</span>
      <button type="button" data-cup="${c.id}"${m ? '' : ' class="primary"'}>${m ? 'もう一度出る' : '出場する'}</button>
    </div>`;
  }).join('');
}
$('cupList').addEventListener('click', e => { const b = e.target.closest('[data-cup]'); if (b) openPick(CUPS.find(c => c.id === b.dataset.cup)); });

function openPick(cup) {
  // 出られる恐竜を先に、その中は速い順
  const list = [...ranch].sort((a, b) => (!!cupBlock(cup, a) - !!cupBlock(cup, b)) || ((a.rec?.finishT ?? 999) - (b.rec?.finishT ?? 999)));
  openSheet(`「${cup.title}」に出る恐竜`, `<p class="hint">${esc(cup.text)}</p><ul class="pick">${list.map(x => {
    const why = cupBlock(cup, x);
    return `<li><button type="button" data-id="${esc(x.id)}"${why ? ' disabled' : ''}><canvas data-portrait="${esc(x.id)}"></canvas>
      <b>${esc(x.name)}</b><span class="why">${fmtMass(bodyPlan(x.g).M)} ・ ${x.rec ? recShort(x.rec) : '記録なし'}${why ? '<br>' + esc(why) : ''}</span></button></li>`;
  }).join('')}</ul>`, 'pick');
  paintPortraits($('sheetBody'), list);
  $('sheetBody').querySelector('.pick').onclick = e => {
    const b = e.target.closest('button[data-id]'); if (!b || b.disabled) return;
    const x = ranch.find(y => y.id === b.dataset.id);
    const rivals = (cup.rivals || []).map(id => starter(SPECIES.find(s => s.id === id)));
    runRace([{name: x.name, g: x.g, me: true, x}, ...rivals.map(r => ({name: 'ライバル ' + r.name, g: r.g, me: false}))], {cup});
  };
}

// ---------- 記録帳 ----------
function renderBook() {
  const b = prog.best;
  const cls = CLASSES.map(c => { const e = prog.classes[c.id]; return `<tr><td>${c.name}</td><td>${e ? `${fmtT(e.t)}（時速 ${kmh(FINISH / e.t)}km）` : '—'}</td><td>${e ? esc(e.name) + `（${fmtMass(e.M)}）` : ''}</td></tr>`; }).join('');
  const refs = Object.values(REFS).map(r => ({name: r.name, t: r.t, note: r.note}));
  if (b) refs.push({name: `あなたの最速（${b.name}）`, t: b.t, note: `${fmtMass(b.M)}・${b.gen ? b.gen + '代目' : 'はじめの恐竜'}`, me: true});
  refs.sort((x, y) => x.t - y.t);
  $('book').innerHTML = `<div class="book">
    <div class="stat">
      <div><span>最速の 100m</span><b>${b ? fmtT(b.t) : '—'}</b><span>${b ? esc(b.name) : ''}</span></div>
      <div><span>メダル</span><b>${Object.keys(prog.medals).length} / ${CUPS.length}</b></div>
      <div><span>生まれた子</span><b>${prog.born}匹</b></div>
      <div><span>いちばん新しい世代</span><b>${prog.maxGen}代目</b></div>
      <div><span>練習</span><b>${prog.practiced}回</b></div>
      <div><span>かけっこ</span><b>${prog.races}回</b></div>
    </div>
    <h3>体重クラスごとの最速</h3>
    <p class="note">体が大きいほど、重さの割に筋肉の力が足りなくなります（体を2倍にすると、重さは8倍・力は4倍）。</p>
    <table><thead><tr><th>体重</th><th>100m</th><th>恐竜</th></tr></thead><tbody>${cls}</tbody></table>
    <h3>本物とくらべる（100m）</h3>
    <table><thead><tr><th></th><th>100m</th><th>時速</th></tr></thead><tbody>${refs.map(r => `<tr${r.me ? ' style="font-weight:700"' : ''}><td>${esc(r.name)}<br><span class="note">${esc(r.note)}</span></td><td>${fmtT(r.t)}</td><td>${kmh(FINISH / r.t)}km</td></tr>`).join('')}</tbody></table>
    <p class="note">ゾウとダチョウは全力の速さから計算した目安です（100m を同じ速さで走るとして）。</p>
  </div>`;
}
