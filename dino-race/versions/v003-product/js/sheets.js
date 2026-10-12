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
  // 10個そろってエンディングをまだ見ていない: 結果を × で閉じても、走っていなければ出す
  if (was === 'result' && VIEW.mode === 'idle' && allMedals() && !prog.endingSeen) setTimeout(showEnding, 250);
});
$('btnSheetClose').addEventListener('click', closeSheet);
$('sheet').addEventListener('click', e => { if (e.target === $('sheet')) closeSheet(); }); // 外側（暗いところ）を押すと閉じる

// 詳しく: 大きな絵・体のようす・記録・操作
const SHOW_GENES = ['legLen', 'tibRatio', 'metaRatio', 'muscle', 'tailLen', 'neckLen', 'bodyLen'];
function geneRatio(d, v) { return d.log ? Math.log(v / d.min) / Math.log(d.max / d.min) : (v - d.min) / (d.max - d.min); }
function openDetail(x) { openSheet(x.name, '', 'detail', x); renderDetail(x); }
function renderDetail(x) {
  const p = bodyPlan(x.g), r = restPose(p);
  const bars = SHOW_GENES.map(k => {
    const d = GENE_BY_KEY[k], v = x.g[k];
    const shown = k === 'legLen' ? v.toFixed(2) + 'm' : k === 'muscle' ? Math.round(v * 100) + '%' : v.toFixed(2);
    return `<span>${esc(d.label)} <b>${shown}</b></span><span class="bar"><i style="left:${(geneRatio(d, v) * 100).toFixed(1)}%"></i></span>`;
  }).join('');
  const busy = !!x.practice, evo = evolving && evolving.src === x;
  $('sheetTitle').textContent = x.name;
  $('sheetBody').innerHTML = `<canvas class="big" data-portrait="${esc(x.id)}"></canvas>
    <div class="facts">
      <div><span>体重</span>${fmtMass(p.M)}</div>
      <div><span>全長</span>${(r.headEnd[0] - r.tailEnd[0]).toFixed(2)}m</div>
      <div><span>腰の高さ</span>${r.hip[1].toFixed(2)}m</div>
      <div><span>世代</span>${x.gen ? x.gen + '代目' : 'はじめの恐竜'}${x.practiced ? `・練習 ${x.practiced}回` : ''}</div>
    </div>
    <p>${recText(x.rec)} <span class="status">${statusOf(x)}</span></p>
    ${x.parents && x.parents.length ? `<p class="hint">親: ${esc(x.parents.join(' × '))}</p>` : ''}
    <h3>体のようす（遺伝子の範囲のどこにいるか）</h3>
    <div class="bars">${bars}</div>
    <div class="btn-row">
      <button type="button" data-d="watch"${x.rec ? '' : ' disabled'}>走りを見る</button>
      <button type="button" data-d="practice"${busy ? ' disabled' : ''}>${busy ? practiceLabel(x) : '練習させる'}</button>
      <button type="button" data-d="evolve"${evolving ? ' disabled' : ''}>${evo ? 'おまかせで進化中' : 'おまかせで進化'}</button>
      <button type="button" data-d="rename">名前を変える</button>
      <button type="button" data-d="release" class="quiet"${ranch.length <= 1 ? ' disabled' : ''}>逃がす</button>
    </div>
    <p class="hint">練習: 体はそのままで走り方を数十秒かけて練習（よくなったら覚える）。おまかせ: この恐竜をもとに群れを育て、いちばん速い子を連れて帰る（数分）。</p>`;
  paintPortraits($('sheetBody'), [x]);
  $('sheetBody').querySelector('.btn-row').onclick = async e => {
    const b = e.target.closest('[data-d]'); if (!b || b.disabled) return;
    const act = b.dataset.d;
    if (act === 'watch') watchRun(x);
    if (act === 'practice') practice(x);
    if (act === 'evolve') openEvolve(x);
    if (act === 'rename') {
      const nm = await ask('新しい名前（12文字まで）', {input: x.name, ok: '決める'});
      if (nm) { x.name = nm; save(); renderRanch(); if (sheetDino === x) renderDetail(x); }
    }
    if (act === 'release' && await ask(`${x.name} を逃がしますか？（もどせません）`, {ok: '逃がす'})) {
      ranch = ranch.filter(y => y !== x); save(); closeSheet(); renderRanch(); renderKids(); toast(`${x.name} を逃がしました`);
    }
  };
}

// ---------- おまかせで進化 ----------
let evolving = null;
function openEvolve(x) {
  if (evolving) return showEvolve();
  openSheet(`おまかせで進化: ${x.name}`, `<p>${esc(x.name)} をもとに、24匹の群れを牧場の外で育てます。走り方は毎回変わり、「体の形も変える」と体も変わります。終わると、いちばん速い子を1匹連れて帰ります（生まれた子に入る）。</p>
    <div class="evo-set">
      <label>世代 <select id="selGens"><option>5</option><option selected>10</option><option>30</option></select></label>
      <label><input type="checkbox" id="chkBody"> 体の形も変える</label>
    </div>
    <p class="hint">1世代に数秒〜十数秒かかります。シートを閉じても、裏で進みます。</p>
    <div class="btn-row"><button type="button" class="primary" id="btnEvolveGo">はじめる</button></div>`, 'evolve-set', x);
  $('btnEvolveGo').onclick = () => {
    const gens = +$('selGens').value;
    evolving = {src: x, gens, hist: [], best: null, id: reqId++};
    worker.postMessage({type: 'evolve', id: evolving.id, gens, seeds: [x.g], opts: {size: 24, seed: (Date.now() % 1e9) | 0, bodyLock: !$('chkBody').checked}});
    renderBanner(); refreshDino(x); showEvolve();
  };
}
function showEvolve() {
  const E = evolving; if (!E) return;
  openSheet(`おまかせで進化: ${E.src.name}`, `<canvas id="evoChart" aria-label="世代ごとの記録のグラフ"></canvas>
    <p class="evo-stat" id="evoStat"></p>
    <div class="btn-row"><button type="button" id="btnEvolveStop">ここでやめて、いちばん速い子を連れて帰る</button></div>`, 'evolve', E.src);
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
  $('evoStat').innerHTML = E.best ? `第${E.hist.length}世代 / ${E.gens} ・ いちばん速い子: ${recText(E.best.res)}` : '第0世代を走らせています…';
  $('btnEvolveStop').disabled = !E.best;
  drawEvoChart();
}
function renderBanner() {
  const E = evolving, el = $('evolveBanner');
  if (!E) { el.hidden = true; return; }
  el.hidden = false;
  el.innerHTML = `<span>おまかせで進化中: ${esc(E.src.name)} ${E.hist.length}/${E.gens}世代${E.best ? ' ・ いちばん ' + recShort(E.best.res) : ''}</span><button type="button" class="chip-btn" id="btnEvoShow">見る</button>`;
  $('btnEvoShow').onclick = showEvolve;
}
function bringBack() {
  const E = evolving; if (!E) return;
  evolving = null;
  renderBanner(); refreshDino(E.src);
  if (sheetKind === 'evolve') closeSheet();
  if (!E.best) return;
  const x = E.src, n = E.hist.length;
  prog.evolved++; prog.born++; saveProg();
  addKids([{id: 'e-' + Date.now(), line: x.line, name: `${x.line} ${serial++}号`, g: E.best.g, rec: E.best.res, gen: (x.gen || 0) + n,
    parents: [x.name], origin: `${x.name}から ${n}世代 進化（もと ${recShort(x.rec)}）`}]);
  noteRecord(kids[kids.length - 1]);
  SFX.play('done');
  toast(`おまかせの進化が終わりました（${recShort(E.best.res)}）`);
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
  ctx.textAlign = 'center'; ctx.fillText('世代', W / 2, H - 6);
  ctx.textAlign = 'left'; ctx.fillText('点数（ゴールすると 100点 ＋ 速さ）', pad.l + 4, 14);
  if (maxY > FINISH) { const y = Y(FINISH); ctx.save(); ctx.setLineDash([4, 4]); ctx.strokeStyle = INK.accent; ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(W - pad.r, y); ctx.stroke(); ctx.restore(); }
  const line = (key, color, w) => { if (!h.length) return; ctx.strokeStyle = color; ctx.lineWidth = w; ctx.beginPath(); h.forEach((p, i) => { const x = X(p.gen), y = Y(p[key]); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }); ctx.stroke(); };
  line('median', INK['ink-soft'], 1.5);
  line('best', INK.accent, 2.5);
}
