// シート（下からせり上がる）と、その中身: 恐竜を詳しく、おまかせで進化。

// ---------- シート ----------
let sheetKind = null, sheetDino = null;
function openSheet(title, html, kind, dino = null) {
  sheetKind = kind; sheetDino = dino;
  $('sheetTitle').textContent = title;
  $('sheetBody').innerHTML = html;
  $('sheetBody').scrollTop = 0;
  if (!$('sheet').open) $('sheet').showModal();
  updateSelection();
}
function closeSheet() { if ($('sheet').open) $('sheet').close(); }
// close はあとから届く。閉じてすぐ別の中身で開き直したとき（かけっこの開始→結果など）は、古い close なので何もしない
$('sheet').addEventListener('close', () => {
  if ($('sheet').open) return;
  const was = sheetKind;
  sheetKind = null; sheetDino = null; updateSelection();
  // メダルがぜんぶそろってエンディングをまだ見ていない: 結果を × で閉じても、走っていなければ出す
  if (was === 'result' && VIEW.mode === 'idle' && allMedals() && !prog.endingSeen) setTimeout(showEnding, 250);
});
$('btnSheetClose').addEventListener('click', closeSheet);
$('sheet').addEventListener('click', e => { if (e.target === $('sheet')) closeSheet(); }); // 外側（暗いところ）を押すと閉じる

// 詳しく: 大きな絵・体のようす・記録・操作
const SHOW_GENES = ['legLen', 'tibRatio', 'metaRatio', 'muscle', 'tailLen', 'neckLen', 'bodyLen'];
// 遺伝子の英語の名前（genome.js は Worker でも読むので TX を使わない。英語はここで持つ）
const GENE_EN = {legLen: 'Leg length', tibRatio: 'Shin ÷ thigh', metaRatio: 'Foot ÷ thigh', muscle: 'Leg muscle ÷ body weight', tailLen: 'Tail ÷ leg', neckLen: 'Neck ÷ leg', bodyLen: 'Body ÷ leg'};
function geneRatio(d, v) { return d.log ? Math.log(v / d.min) / Math.log(d.max / d.min) : (v - d.min) / (d.max - d.min); }
function openDetail(x) { openSheet(x.name, '', 'detail', x); renderDetail(x); }
function renderDetail(x) {
  const p = bodyPlan(x.g), r = restPose(p);
  const bars = SHOW_GENES.map(k => {
    const d = GENE_BY_KEY[k], v = x.g[k];
    const shown = k === 'legLen' ? v.toFixed(2) + 'm' : k === 'muscle' ? Math.round(v * 100) + '%' : v.toFixed(2);
    // 両親の位置（v004。かけ合わせで生まれた子だけ）: 1・2 の小さな印
    const par = (x.pg || []).map((pg, i) => pg && pg[k] != null ? `<b class="par" style="left:${(geneRatio(d, pg[k]) * 100).toFixed(1)}%">${i + 1}</b>` : '').join('');
    return `<span>${esc(TX(d.label, GENE_EN[k]))} <b>${shown}</b></span><span class="bar">${par}<i style="left:${(geneRatio(d, v) * 100).toFixed(1)}%"></i></span>`;
  }).join('');
  const busy = !!x.practice, evo = evolving && evolving.src === x;
  $('sheetTitle').textContent = x.name;
  $('sheetBody').innerHTML = `<canvas class="big" data-portrait="${esc(x.id)}"></canvas>
    <div class="facts">
      <div><span>${TX('体重', 'Weight')}</span>${fmtMass(p.M)}</div>
      <div><span>${TX('全長', 'Length')}</span>${(r.headEnd[0] - r.tailEnd[0]).toFixed(2)}m</div>
      <div><span>${TX('腰の高さ', 'Hip height')}</span>${r.hip[1].toFixed(2)}m</div>
      <div><span>${TX('世代', 'Generation')}</span>${x.gen ? TX(x.gen + '代目', 'Gen ' + x.gen) : TX('はじめの恐竜', 'Founder')}${x.practiced ? TX(`・練習 ${x.practiced}回`, ` ・ trained ${x.practiced}×`) : ''}</div>
    </div>
    <p>${recText(x.rec)} <span class="status">${statusOf(x)}</span><br><span class="rb ${rbClass(x.rec)}">${rbText(x.rec)}</span>${x.practiceNote ? `<br><span class="small">${esc(x.practiceNote)}</span>` : ''}</p>
    ${x.parents && x.parents.length ? `<p class="hint">${TX('親: ', 'Parents: ')}${esc(x.parents.map((n, i) => (x.pg ? (i + 1) + ' ' : '') + n).join(' × '))}${x.gaitName ? TX(`${SEP}走り方は${esc(x.gaitName)}ゆずり`, `${SEP}gait from ${esc(x.gaitName)}`) : ''}</p>` : ''}
    <h3>${TX(`体のようす（遺伝子の範囲のどこにいるか${x.pg ? '。1・2 は両親' : ''}）`, `Body (where it sits in each gene’s range${x.pg ? '; 1 and 2 are the parents' : ''})`)}</h3>
    <div class="bars">${bars}</div>
    <div class="btn-row">
      <button type="button" data-d="watch"${x.rec ? '' : ' disabled'}>${TX('走りを見る', 'Watch run')}</button>
      <button type="button" data-d="practice"${busy ? ' disabled' : ''}>${busy ? practiceLabel(x) : TX('練習させる', 'Train')}</button>
      <button type="button" data-d="evolve"${evolving ? ' disabled' : ''}>${evo ? TX('おまかせで進化中', 'Auto-evolving') : TX('おまかせで進化', 'Auto-evolve')}</button>
      ${ONLINE_URL && ranch.includes(x) ? `<button type="button" data-d="online"${sendBlock(x) ? ' disabled' : ''}>${TX('みんなの記録に出す', 'Enter the rankings')}</button>` : ''}
      <button type="button" data-d="rename">${TX('名前を変える', 'Rename')}</button>
      <button type="button" data-d="release" class="quiet"${ranch.length <= 1 ? ' disabled' : ''}>${TX('逃がす', 'Release')}</button>
    </div>
    ${ONLINE_URL && ranch.includes(x) && sendBlock(x) ? `<p class="hint">${TX('みんなの記録: ', 'Rankings: ')}${esc(sendBlock(x))}</p>` : ''}
    <p class="ol-msg" aria-live="polite"></p>
    <p class="hint">${TX('練習: 体はそのままで走り方を数秒〜数十秒かけて練習（よくなったら覚える。体が変わらないので、伸びには限りがある）。おまかせ: この恐竜をもとに群れを育て、いちばん速い子を連れて帰る（数分）。', 'Train: practise the gait for a few seconds to a minute with the body unchanged (it keeps any improvement; since the body stays the same, gains are limited). Auto-evolve: raise a herd from this dinosaur and bring back the fastest one (a few minutes).')}</p>`;
  paintPortraits($('sheetBody'), [x]);
  $('sheetBody').querySelector('.btn-row').onclick = async e => {
    const b = e.target.closest('[data-d]'); if (!b || b.disabled) return;
    const act = b.dataset.d;
    if (act === 'watch') watchRun(x);
    if (act === 'practice') practice(x);
    if (act === 'evolve') openEvolve(x);
    if (act === 'online') sendDino(x, b);
    if (act === 'rename') {
      const nm = await ask(TX('新しい名前（12文字まで）', 'New name (up to 12 characters)'), {input: x.name, ok: TX('決める', 'OK')});
      if (nm) { x.name = nm; save(); renderRanch(); if (sheetDino === x) renderDetail(x); }
    }
    if (act === 'release' && await ask(TX(`${x.name} を逃がしますか？（もどせません）`, `Release ${x.name}? (This can’t be undone.)`), {ok: TX('逃がす', 'Release')})) {
      ranch = ranch.filter(y => y !== x); save(); closeSheet(); renderRanch(); renderKids(); toast(TX(`${x.name} を逃がしました`, `Released ${x.name}`));
    }
  };
}

// ---------- おまかせで進化 ----------
let evolving = null;
function openEvolve(x) {
  if (evolving) return showEvolve();
  const bodyOk = tierOpen(3);
  openSheet(TX(`おまかせで進化: ${x.name}`, `Auto-evolve: ${x.name}`), `<p>${TX(`${esc(x.name)} をもとに、24匹の群れを牧場の外で育てます。走り方は毎回変わり、「体の形も変える」と体も変わります。終わると、いちばん速い子を1匹連れて帰ります（生まれた子に入る）。`, `Raise a herd of 24 from ${esc(x.name)} outside the ranch. The gait changes every generation, and with “Also change body shape” the body changes too. When it ends, the fastest one comes back (to Hatchlings).`)}</p>
    <div class="evo-set">
      <label>${TX('世代', 'Generations')} <select id="selGens"><option>5</option><option selected>10</option><option>30</option></select></label>
      <label${bodyOk ? '' : ' class="off"'}><input type="checkbox" id="chkBody"${bodyOk ? '' : ' disabled'}> ${TX('体の形も変える', 'Also change body shape')}</label>
    </div>
    ${bodyOk ? '' : `<p class="hint">${TX('「体の形も変える」は、上級のお題が開くと使えます（それまでは体の形はかけ合わせで）。', '“Also change body shape” unlocks with the Advanced cups (until then, shape bodies by breeding).')}</p>`}
    <p class="hint">${TX('1世代に数秒〜十数秒かかります。シートを閉じても、裏で進みます。', 'Each generation takes a few to 20-odd seconds. It keeps going if you close this sheet.')}</p>
    <div class="btn-row"><button type="button" class="primary" id="btnEvolveGo">${TX('はじめる', 'Start')}</button></div>`, 'evolve-set', x);
  $('btnEvolveGo').onclick = () => {
    const gens = +$('selGens').value;
    evolving = {src: x, gens, hist: [], best: null, id: reqId++};
    worker.postMessage({type: 'evolve', id: evolving.id, gens, seeds: [x.g], opts: {size: 24, seed: (Date.now() % 1e9) | 0, bodyLock: !(bodyOk && $('chkBody').checked)}});
    renderBanner(); refreshDino(x); showEvolve();
  };
}
function showEvolve() {
  const E = evolving; if (!E) return;
  openSheet(TX(`おまかせで進化: ${E.src.name}`, `Auto-evolve: ${E.src.name}`), `<canvas id="evoChart" aria-label="${TX('世代ごとの記録のグラフ', 'Score by generation')}"></canvas>
    <p class="evo-stat" id="evoStat"></p>
    <div class="btn-row"><button type="button" id="btnEvolveStop">${TX('ここでやめて、いちばん速い子を連れて帰る', 'Stop here and bring back the fastest')}</button></div>`, 'evolve', E.src);
  $('btnEvolveStop').onclick = () => { worker.postMessage({type: 'stop'}); bringBack(); };
  updateEvolveView();
}
function onEvolveProgress(m) {
  const E = evolving; if (!E || m.id !== E.id) return;
  E.hist.push({gen: m.gen, best: m.best, median: m.median});
  if (!E.best || m.best > E.best.score) E.best = {score: m.best, g: m.bestG, res: m.bestRes};
  updateEvolveView(); renderBanner();
  if (m.done) bringBack();
}
function updateEvolveView() {
  const E = evolving; if (!E || sheetKind !== 'evolve') return;
  $('evoStat').innerHTML = E.best ? TX(`第${E.hist.length}世代 / ${E.gens} ・ いちばん速い子: ${recText(E.best.res)}`, `Generation ${E.hist.length} / ${E.gens} ・ Fastest: ${recText(E.best.res)}`) : TX('第0世代を走らせています…', 'Running generation 0…');
  $('btnEvolveStop').disabled = !E.best;
  drawEvoChart();
}
function renderBanner() {
  const E = evolving, el = $('evolveBanner');
  if (!E) { el.hidden = true; return; }
  el.hidden = false;
  el.innerHTML = `<span>${TX(`おまかせで進化中: ${esc(E.src.name)} ${E.hist.length}/${E.gens}世代${E.best ? ' ・ いちばん ' + recShort(E.best.res) : ''}`, `Auto-evolving: ${esc(E.src.name)} gen ${E.hist.length}/${E.gens}${E.best ? ' ・ best ' + recShort(E.best.res) : ''}`)}</span><button type="button" class="chip-btn" id="btnEvoShow">${TX('見る', 'View')}</button>`;
  $('btnEvoShow').onclick = showEvolve;
}
function bringBack() {
  const E = evolving; if (!E) return;
  evolving = null;
  renderBanner(); refreshDino(E.src);
  if (sheetKind === 'evolve') closeSheet();
  if (!E.best) return;
  const x = E.src, n = E.hist.length, no = serial++;
  prog.evolved++; prog.born++; saveProg();
  addKids([{id: 'e-' + Date.now(), line: x.line, name: TX(`${x.line} ${no}号`, `${x.line} #${no}`), g: E.best.g, rec: null, gen: (x.gen || 0) + n,
    parents: [x.name], parentBest: x.rec?.finishT ?? null, origin: TX(`${x.name}から ${n}世代 進化（もと ${recShort(x.rec)}）`, `Evolved ${n} generations from ${x.name} (was ${recShort(x.rec)})`)}]);
  SFX.play('done');
  toast(TX(`おまかせの進化が終わりました（${recShort(E.best.res)}）`, `Auto-evolve finished (${recShort(E.best.res)})`));
}
function drawEvoChart() {
  const cv = $('evoChart'); if (!cv) return;
  const dpr = window.devicePixelRatio || 1, r = cv.getBoundingClientRect(); if (!r.width) return;
  cv.width = Math.round(r.width * dpr); cv.height = Math.round(r.height * dpr);
  const ctx = cv.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const W = r.width, H = r.height, E = evolving, h = E ? E.hist : [];
  ctx.clearRect(0, 0, W, H);
  const pad = {l: 34, r: 12, t: 22, b: 22};
  const maxY = Math.max(5, ...h.map(p => p.best)) * 1.1, maxX = Math.max(E ? E.gens : 10, 1);
  const X = g => pad.l + (W - pad.l - pad.r) * g / maxX, Y = v => H - pad.b - (H - pad.t - pad.b) * Math.max(0, v) / maxY;
  ctx.strokeStyle = INK['paper-line']; ctx.fillStyle = INK.muted; ctx.font = '11px ' + getComputedStyle(document.body).fontFamily; ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i++) { const v = maxY * i / 4, y = Y(v); ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(W - pad.r, y); ctx.stroke(); ctx.textAlign = 'right'; ctx.fillText(v.toFixed(0), pad.l - 6, y + 4); }
  ctx.textAlign = 'center'; ctx.fillText(TX('世代', 'Generation'), W / 2, H - 6);
  ctx.textAlign = 'left'; ctx.fillText(TX('点数（ゴールすると 100点 ＋ 速さ）', 'Score (finish = 100 + speed)'), pad.l + 4, 14);
  if (maxY > FINISH) { const y = Y(FINISH); ctx.save(); ctx.setLineDash([4, 4]); ctx.strokeStyle = INK.accent; ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(W - pad.r, y); ctx.stroke(); ctx.restore(); }
  const line = (key, color, w) => { if (!h.length) return; ctx.strokeStyle = color; ctx.lineWidth = w; ctx.beginPath(); h.forEach((p, i) => { const x = X(p.gen), y = Y(p[key]); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }); ctx.stroke(); };
  line('median', INK['ink-soft'], 1.5);
  line('best', INK.accent, 2.5);
}
