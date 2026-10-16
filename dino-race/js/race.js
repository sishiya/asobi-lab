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

// この子のいつもの幅（しっかり度をはかった6通り）と、今回の位置
function dayBand(x, r) {
  const rb = x && x.rec && x.rec.rb; if (!rb) return '';
  if (!r.ok) return `<span class="day">今回は${r.fell ? '転んだ' : '時間切れ'}。この子はふだん${rb.n}回中${rb.ok}回ゴール${rb.ok < rb.n ? '（練習するとしっかりしやすい）' : ''}</span>`;
  if (rb.lo == null) return '';
  const lo = Math.min(rb.lo, r.t) - 0.05, hi = Math.max(rb.hi, r.t) + 0.05, at = v => (100 * (v - lo) / (hi - lo)).toFixed(1);
  const word = r.t <= rb.lo + 0.02 ? '絶好調' : r.t >= rb.hi - 0.02 ? 'いまひとつ' : 'いつもどおり';
  return `<span class="day">今回は<b>${word}</b>（ふだん ${rb.lo.toFixed(2)}〜${rb.hi.toFixed(2)}秒）<span class="day-bar"><i style="left:${at(rb.lo)}%;width:${(at(rb.hi) - at(rb.lo)).toFixed(1)}%"></i><b style="left:${at(r.t)}%"></b></span></span>`;
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
      banner = `<div class="result-banner win${first ? ' medal-get' : ''}">${first ? '<span class="medal-big" aria-hidden="true">★</span>' : ''}<div><b>${first ? 'メダル獲得！' : 'クリア！'}</b> 「${esc(cup.title)}」${first ? `<br>牧場が1匹分広がりました（${slots()}匹まで）` : ''}${news}</div></div>`;
      SFX.play(first ? 'medal' : 'done');
      if (first) { renderRanch(); renderKids(); }
      renderCups();
    } else {
      const gap = cupGap(cup, mine, rivals);
      banner = `<div class="result-banner"><b>${mine.fell ? '転んでしまった…' : 'おしい！'}</b> 「${esc(cup.title)}」${gap ? '<br>' + gap : ''}<br><span class="hint">次の一手: ${esc(cup.hint || '練習させたり、かけ合わせたりして、もう一度。')}</span></div>`;
    }
  }
  ending = cup && allMedals() && !prog.endingSeen; // ぜんぶそろった → 「つづき」でエンディング（× で閉じたときは sheets.js）
  let place = 0; // ゴーストは順位に数えない
  const items = rows.map(r => `<li class="${r.me && cup && rows.length > 1 ? 'me' : ''}">
    <span class="no">${r.ghost ? '–' : ++place}</span><span class="nm">${esc(r.label)}${r.ghost ? '（目安）' : ''}</span>
    <span class="tm">${r.ok ? fmtT(r.t) : (r.fell ? '転倒' : '—')}</span>
    <span class="sub">${r.ghost ? `時速 ${kmh(r.v)}km` : `${r.ok ? '' : r.dist.toFixed(1) + 'm ・ '}平均 時速 ${kmh(r.v)}km`}${r.me && !(cup && cup.steady) ? dayBand(r.x, r) : ''}</span></li>`).join('');
  const foot = rows.filter(r => !r.ghost && r.a).map(r => `${esc(r.label)}: 時速 ${kmh(r.a.v)}km（歩幅 ${r.a.lambda.toFixed(2)}m）`).join('<br>');
  openSheet(cup ? '大会の結果' : 'かけっこの結果', `${banner}<ol class="rank">${items}</ol>
    ${cup && cup.steady ? '' : '<p class="hint">本番は毎回ほんの少し調子がちがいます（ライバルはいつもの走り）。</p>'}
    ${foot ? `<details class="foot-est"><summary>足あとだけが残ったとしたら（推定）</summary><p class="small">${foot}</p><p class="hint">歩幅と腰の高さから速さを出す Alexander（1976）の式。化石の足あとから恐竜の速さを見積もるのに使われています。実際の速さとのずれも見どころ。</p></details>` : ''}
    <div class="btn-row"><button type="button" id="btnAgain">もう一度</button><button type="button" class="primary" id="btnResClose">${ending ? 'つづき ▶' : '閉じる'}</button></div>`, 'result');
  $('btnAgain').onclick = () => runRace(entries, {cup});
  $('btnResClose').onclick = ending ? showEnding : closeSheet;
}
function cupGap(cup, mine, rivals) {
  if (mine.finishT == null) return `${mine.dist.toFixed(1)}m で${mine.fell ? '転んだ' : '時間切れ（40秒）'}`;
  const rivalT = rivals.map(r => r.finishT).filter(t => t != null);
  const target = cup.target ?? (rivalT.length ? Math.min(...rivalT) : null);
  return target ? `あと ${(mine.finishT - target).toFixed(2)}秒` : '';
}

// ---------- 段が開いたときのおくりもの（v004） ----------
// 中級: ストルティオミムスが仲間入り（牧場がいっぱいなら生まれた子の欄へ）。上級: おまかせで体の形も変えられる
function giveJoiners() {
  for (const sp of SPECIES) {
    if (!sp.joins || prog.joined[sp.id] || !tierOpen(sp.joins)) continue;
    prog.joined[sp.id] = true; saveProg();
    const x = starter(sp);
    if (ranch.some(y => y.id === x.id)) continue;
    if (ranch.length < slots()) ranch.push({...x, isNew: true}); else kids.push(x);
    save(); renderRanch(); renderKids();
    measure([x].filter(y => !y.rec), () => { save(); renderRanch(); renderKids(); });
    return sp;
  }
  return null;
}
function tierNews() {
  const out = [];
  const sp = giveJoiners();
  if (sp) out.push(`中級のお題が開きました。<b>${esc(sp.name)}</b>が牧場に仲間入り！`);
  if (tierOpen(3) && !prog.joined.evolveBody) { prog.joined.evolveBody = true; saveProg(); out.push('上級のお題が開きました。おまかせの進化で<b>体の形も変える</b>が使えます。'); }
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
      ? `<span><b>まずは</b> <b>ヴェロキラプトル</b>と<b>コンプソグナトゥス</b>を選んで「かけ合わせる」。体の近い2匹ほど、子が転びにくい。</span>`
      : `<span><b>次のお題</b> ${esc(next.title)} — ${esc(next.text)}</span><button type="button" class="chip-btn" id="btnNextCup">出場する</button>`;
    if (!first) $('btnNextCup').onclick = () => openPick(next);
  }
  $('cupList').innerHTML = TIERS.map(T => {
    const open = tierOpen(T.id), list = CUPS.filter(c => c.tier === T.id), got = list.filter(c => prog.medals[c.id]).length;
    const head = `<h3 class="tier-h${open ? '' : ' locked'}">${T.name} <span class="n">${got}/${list.length}</span>${open ? '' : `<span class="lock">${TIERS[T.id - 2].name}のお題をぜんぶ取ると開きます</span>`}</h3>${!open && T.gift ? `<p class="hint">${esc(T.gift)}</p>` : ''}`;
    return head + `<div class="cup-list">${list.map(c => {
      const m = prog.medals[c.id];
      const who = [...(c.rivals || []).map(id => SPECIES.find(s => s.id === id).name), ...(c.ghosts || []).map(k => REFS[k].short + '（目安）')];
      return `<div class="cup${m ? ' won' : ''}${open ? '' : ' locked'}">
        <span class="medal">${m ? '★' : open ? 'まだ' : '🔒'}</span>
        <h3>${esc(c.title)}</h3>
        <p>${esc(c.text)}${who.length ? `<br>いっしょに走る: ${esc(who.join('、'))}` : ''}</p>
        <span class="best">${m ? `クリア: ${esc(m.name)} ${fmtT(m.t)}` : ''}</span>
        ${open ? `<button type="button" data-cup="${c.id}"${m ? '' : ' class="primary"'}>${m ? 'もう一度出る' : '出場する'}</button>` : ''}
      </div>`;
    }).join('')}</div>`;
  }).join('');
}
$('cupList').addEventListener('click', e => { const b = e.target.closest('[data-cup]'); if (b) openPick(CUPS.find(c => c.id === b.dataset.cup)); });

function openPick(cup) {
  // 出られる恐竜を先に、その中は速い順
  const list = [...ranch].sort((a, b) => (!!cupBlock(cup, a) - !!cupBlock(cup, b)) || ((a.rec?.finishT ?? 999) - (b.rec?.finishT ?? 999)));
  openSheet(`「${cup.title}」に出る恐竜`, `<p class="hint">${esc(cup.text)}${cup.steady ? '' : '<br>本番は毎回ほんの少し調子がちがいます。「6回中◯回ゴール」が多い子ほど転びにくい。'}</p><ul class="pick">${list.map(x => {
    const why = cupBlock(cup, x);
    return `<li><button type="button" data-id="${esc(x.id)}"${why ? ' disabled' : ''}><canvas data-portrait="${esc(x.id)}"></canvas>
      <b>${esc(x.name)}</b><span class="why">${fmtMass(bodyPlan(x.g).M)} ・ ${x.rec ? recShort(x.rec) : '記録なし'}${x.rec && x.rec.rb && !cup.steady ? ' ・ ' + rbText(x.rec) : ''}${why ? '<br>' + esc(why) : ''}</span></button></li>`;
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
  const res = RESEARCH.map(r => {
    const e = prog.research && prog.research[r.name], v = e ? FINISH / e.t : 0, pct = Math.round(100 * v / r.v);
    return `<tr><td>${esc(r.name)}<br><span class="note">${fmtMass(r.M)} ・ 推定 秒速 ${r.v}m（時速 ${kmh(r.v)}km）</span></td>
      <td>${e ? `${esc(e.name)}（${fmtMass(e.M)}）<br><span class="note">秒速 ${v.toFixed(1)}m</span>` : '—'}</td>
      <td><span class="pct"><i style="width:${Math.min(100, pct)}%"></i></span>${e ? pct + '%' : ''}</td></tr>`;
  }).join('');
  $('book').innerHTML = `<div class="book">
    <div class="stat">
      <div><span>最速の 100m</span><b>${b ? fmtT(b.t) : '—'}</b><span>${b ? esc(b.name) : ''}</span></div>
      <div><span>メダル</span><b>${Object.keys(prog.medals).length} / ${CUPS.length}</b></div>
      <div><span>生まれた子</span><b>${prog.born}匹</b></div>
      <div><span>いちばん新しい世代</span><b>${prog.maxGen}代目</b></div>
      <div><span>練習</span><b>${prog.practiced}回</b></div>
      <div><span>かけっこ</span><b>${prog.races}回</b></div>
    </div>
    <h3>体重と速さ（相似則）</h3>
    <canvas id="bookChart" class="book-chart" aria-label="体重と速さの図"></canvas>
    <p class="note">● あなたの恐竜（牧場と生まれた子、体重クラスの最速）、□ 研究の推定（Sellers &amp; Manning 2007）、△ 人・ダチョウ・ゾウ。横は体重（目盛りは10倍ずつ）。体を2倍にすると重さは8倍、筋肉が関節を回す力も8倍になりますが、重い体を長い脚で支えるのに要る力は16倍。だから大きいほど力が足りず、遅くなります（Hutchinson &amp; Garcia 2002）。</p>
    <h3>研究の推定とくらべる</h3>
    <p class="note">Sellers &amp; Manning（2007）は、化石から作った骨格の模型をコンピューターの中で進化させて走らせ、最高速度を見積もりました。体重が半分〜2倍の、あなたの最速の恐竜とくらべます（100m の平均の速さ。スタートの加速もふくむので、少し不利）。研究の模型は筋肉や腱がもっとくわしく、推定にも幅があります。</p>
    <table><thead><tr><th>研究の推定</th><th>あなたの恐竜</th><th>推定の何%</th></tr></thead><tbody>${res}</tbody></table>
    <h3>体重クラスごとの最速</h3>
    <table><thead><tr><th>体重</th><th>100m</th><th>恐竜</th></tr></thead><tbody>${cls}</tbody></table>
    <h3>本物とくらべる（100m）</h3>
    <table><thead><tr><th></th><th>100m</th><th>時速</th></tr></thead><tbody>${refs.map(r => `<tr${r.me ? ' style="font-weight:700"' : ''}><td>${esc(r.name)}<br><span class="note">${esc(r.note)}</span></td><td>${fmtT(r.t)}</td><td>${kmh(FINISH / r.t)}km</td></tr>`).join('')}</tbody></table>
    <p class="note">ゾウとダチョウは全力の速さから計算した目安です（100m を同じ速さで走るとして）。</p>
  </div>`;
  drawBookChart();
}

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
  ctx.save(); ctx.translate(11, (pad.t + H - pad.b) / 2); ctx.rotate(-Math.PI / 2); ctx.textAlign = 'center'; ctx.fillText('秒速（m）', 0, 0); ctx.restore();
  ctx.textAlign = 'center'; ctx.fillText('体重', W / 2, H - 4);
  // 研究の推定 □
  ctx.strokeStyle = INK['ink-soft']; ctx.lineWidth = 1.4; ctx.fillStyle = INK['ink-soft']; ctx.textAlign = 'left';
  for (const r of RESEARCH) { const x = X(r.M), y = Y(r.v); ctx.strokeRect(x - 4, y - 4, 8, 8); ctx.fillText(r.name.slice(0, 5), x + 6, y - 5); }
  // 人・ダチョウ・ゾウ △
  for (const r of Object.values(REFS)) { const x = X(r.M), y = Y(FINISH / r.t); ctx.beginPath(); ctx.moveTo(x, y - 5); ctx.lineTo(x + 5, y + 4); ctx.lineTo(x - 5, y + 4); ctx.closePath(); ctx.stroke(); ctx.fillText(r.short, x + 6, y + 12); }
  // あなたの恐竜 ●（ゴールした子）
  const mine = [...ranch, ...kids].filter(x => x.rec && x.rec.finishT != null).map(x => ({M: bodyPlan(x.g).M, v: FINISH / x.rec.finishT}));
  for (const e of Object.values(prog.classes)) mine.push({M: e.M, v: FINISH / e.t, best: true});
  for (const p of mine) { ctx.beginPath(); ctx.arc(X(p.M), Y(p.v), p.best ? 4.5 : 3.2, 0, Math.PI * 2); ctx.fillStyle = p.best ? INK.accent : INK.ink; ctx.fill(); }
}
