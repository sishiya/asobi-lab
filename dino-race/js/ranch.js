// 牧場: 裏の計算（Worker）、走る練習、カードの絵、牧場のカードと選択、生まれた子、かけ合わせ。

// ---------- 裏の計算（Worker） ----------
const worker = new Worker('js/worker.js?v=4');
const waiting = new Map();
let reqId = 1;
worker.onmessage = e => {
  const m = e.data;
  if (m.type === 'evaluated') { const cb = waiting.get(m.id); waiting.delete(m.id); cb && cb(m.res); }
  if (m.type === 'progress') onEvolveProgress(m);
};
function measure(list, done) { // 記録としっかり度をはかる（sim.js の measureRobust）
  if (!list.length) return;
  const id = reqId++;
  waiting.set(id, res => { list.forEach((x, i) => { x.rec = res[i]; noteRecord(x); }); done && done(); });
  worker.postMessage({type: 'evaluate', id, genomes: list.map(x => x.g)});
}

// 走る練習: 体はそのままで、走り方だけを小さな群れで PRACTICE.gens 世代育て、よくなったら入れかえる。
// おまかせの進化とぶつからないように別の Worker で、1匹ずつ順番に
const PRACTICE = {gens: 6, size: 10};
const practiceWorker = new Worker('js/worker.js?v=4');
const practiceQueue = [];
let practicing = null;
function practice(x) {
  if (x.practice) return;
  x.practice = {gen: 0, best: null, before: x.rec};
  practiceQueue.push(x);
  nextPractice();
  refreshDino(x);
}
function nextPractice() {
  if (practicing || !practiceQueue.length) return;
  practicing = practiceQueue.shift();
  practiceWorker.postMessage({type: 'evolve', id: reqId++, gens: PRACTICE.gens, seeds: [practicing.g], opts: {size: PRACTICE.size, seed: (Date.now() % 1e9) | 0, bodyLock: true}});
}
practiceWorker.onmessage = e => {
  const m = e.data, x = practicing; if (m.type !== 'progress' || !x) return;
  x.practice.gen = m.gen;
  if (!x.practice.best || m.best > x.practice.best.score) x.practice.best = {score: m.best, g: m.bestG, res: m.bestRes};
  if (m.done) {
    const b = x.practice.best, before = x.practice.before;
    const better = !x.rec || b.score > scoreOf(x.rec) + 0.5; // ほんの少しの差は「変わらず」
    x.practiced = (x.practiced || 0) + 1;
    x.practice = null; practicing = null;
    prog.practiced++; saveProg();
    SFX.play('done');
    if (better) {
      x.g = b.g; x.rec = b.res; x.plateau = false;
      // しっかり度をはかり直してから、練習の成果を残す（カードに「前 → 今」）
      measure([x], () => { x.practiceNote = `練習${x.practiced}回目: ${recShort(before)} → ${recShort(x.rec)}`; save(); refreshDino(x, true); });
      toast(`${x.name} の練習: ${recShort(before)} → ${recShort(x.rec)}`);
    } else {
      x.plateau = true; x.practiceNote = `練習${x.practiced}回目: 変わらず（この体では、ほぼ出しきった）`;
      toast(`${x.name} の練習: 記録は変わらず。この体では、ほぼ出しきったようです`, 3600);
    }
    save();
    nextPractice();
  }
  refreshDino(x, m.done);
};
const practiceLabel = x => x.practice ? (x.practice.gen ? `練習中 ${x.practice.gen}/${PRACTICE.gens}` : '練習の順番待ち') : '';

// ---------- 絵 ----------
function paintPortraits(root, list) {
  const dpr = window.devicePixelRatio || 1;
  root.querySelectorAll('canvas[data-portrait]').forEach(cv => {
    const x = list.find(y => y.id === cv.dataset.portrait); if (!x) return;
    const r = cv.getBoundingClientRect(); if (!r.width) return; // 隠れたタブ（あとで描く）
    cv.width = Math.round(r.width * dpr); cv.height = Math.round(r.height * dpr);
    drawPortrait(cv, x.g);
  });
}

// ---------- 牧場 ----------
function statusOf(x) {
  if (x.practice) return practiceLabel(x);
  if (evolving && evolving.src === x) return 'おまかせで進化中';
  return '';
}
function ranchCard(x) {
  const p = bodyPlan(x.g), i = selected.indexOf(x.id);
  return `<div class="card${x.rec ? '' : ' wait'}${x.isNew ? ' born' : ''}" role="button" tabindex="0" data-id="${esc(x.id)}" aria-pressed="${i >= 0}">
    <span class="selno"${i >= 0 ? '' : ' hidden'}>${i + 1}</span>
    <button type="button" class="more" data-act="detail" aria-label="${esc(x.name)} をくわしく">…</button>
    <canvas data-portrait="${esc(x.id)}"></canvas>
    <span class="name">${esc(x.name)}</span>
    <span class="meta">${fmtMass(p.M)} ・ ${x.gen ? x.gen + '代目' : 'はじめの恐竜'}</span>
    <span class="rec">${recText(x.rec, true)}</span>
    <span class="rb ${rbClass(x.rec)}">${rbText(x.rec)}</span>
    <span class="status" data-status>${statusOf(x)}</span>
  </div>`;
}
function renderRanch() {
  $('ranchCount').textContent = `${ranch.length}/${slots()}`;
  $('ranch').innerHTML = ranch.map(ranchCard).join('');
  paintPortraits($('ranch'), ranch);
  for (const x of ranch) delete x.isNew;
  updateSelection();
}
function updateSelection() {
  selected = selected.filter(id => ranch.some(x => x.id === id));
  $('ranch').querySelectorAll('.card').forEach(c => {
    const i = selected.indexOf(c.dataset.id), no = c.querySelector('.selno');
    c.setAttribute('aria-pressed', i >= 0); no.hidden = i < 0; no.textContent = i + 1;
  });
  const n = selected.length, show = n > 0 && tab === 'ranch' && !$('sheet').open;
  $('actbar').hidden = !show;
  $('actN').textContent = n === 1 ? '1匹（もう1匹でかけ合わせ）' : `${n}匹を選んでいます`;
  $('btnBreed').disabled = n !== 2;
  $('btnRace').disabled = n < 1 || n > MAX_RACE;
  $('btnRace').textContent = n > MAX_RACE ? `かけっこは${MAX_RACE}匹まで` : 'かけっこ';
}
function toggleSelect(id) {
  const i = selected.indexOf(id);
  if (i >= 0) selected.splice(i, 1); else selected.push(id);
  updateSelection();
}
$('ranch').addEventListener('click', e => {
  const c = e.target.closest('.card'); if (!c) return;
  const x = ranch.find(y => y.id === c.dataset.id);
  if (e.target.closest('[data-act=detail]')) { openDetail(x); return; }
  toggleSelect(c.dataset.id);
});
$('ranch').addEventListener('keydown', e => { const c = e.target.closest('.card'); if (c && e.target === c && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); toggleSelect(c.dataset.id); } });
$('btnClearSel').addEventListener('click', () => { selected = []; updateSelection(); });

// 1匹の表示を更新（練習の進みぐあいなど）。カード・生まれた子・詳しくのシート
function refreshDino(x, full = false) {
  const card = $('ranch').querySelector(`.card[data-id="${CSS.escape(x.id)}"]`);
  if (card) {
    if (full) { card.querySelector('.rec').innerHTML = recText(x.rec, true); const rb = card.querySelector('.rb'); rb.className = 'rb ' + rbClass(x.rec); rb.textContent = rbText(x.rec); }
    card.querySelector('[data-status]').textContent = statusOf(x);
  }
  if (kids.includes(x)) renderKids();
  if (sheetKind === 'detail' && sheetDino === x) renderDetail(x);
}

// ---------- 生まれた子 ----------
const rng = makeRng(Date.now() % 1e9);
function childName(a, b) {
  const line = a.line === b.line ? a.line : a.line.slice(0, 2) + b.line.slice(0, 2);
  return {line, name: `${line} ${serial++}号`};
}
// 親ごえの札: 速いほうの親の記録とくらべる
function kidTag(x) {
  if (!x.rec || x.parentBest == null || x.rec.finishT == null) return '';
  const d = x.rec.finishT - x.parentBest;
  return d < 0 ? `<span class="tag win">親ごえ ▲${(-d).toFixed(2)}秒</span>` : `<span class="tag">親より +${d.toFixed(2)}秒</span>`;
}
// 記録をはかっている間は卵（v004）。図鑑の卵化石ふう: 殻の点描とひび
const EGG_SVG = `<svg viewBox="0 0 60 70" aria-hidden="true"><ellipse cx="30" cy="38" rx="22" ry="28" class="shell"/><g class="dots"><circle cx="20" cy="28" r="1"/><circle cx="36" cy="22" r="1.2"/><circle cx="40" cy="44" r="1"/><circle cx="24" cy="50" r="1.1"/><circle cx="30" cy="36" r=".8"/><circle cx="16" cy="42" r=".9"/><circle cx="44" cy="32" r=".8"/></g><path class="crack" d="M10 36l7 4 5-6 6 7 5-5 6 6 5-4 6 3"/></svg>`;
function renderKids() {
  const box = $('nurseryBox'), badge = $('kidsCount');
  badge.hidden = !kids.length; badge.textContent = kids.length;
  if (!kids.length) {
    box.innerHTML = `<div class="empty">${EGG_SVG}いまは、生まれた子はいません。<br>牧場で2匹を選んで「かけ合わせる」と、ここで卵がかえります。<div class="btn-row"><button type="button" data-act="toRanch">牧場へ</button></div></div>`;
    return;
  }
  const full = ranch.length >= slots();
  box.innerHTML = `<p class="parents">記録を見て、残す子を選ぶ。本番は毎回ほんの少し調子がちがうので、「6回中◯回ゴール」が多い子ほど転びにくい。転んだ子も練習すると走れるようになることがあります。${full ? `<br><b>牧場がいっぱい</b>（${slots()}匹）。残すには先に牧場から逃がすか、大会でメダルを取って広げる。` : ''}</p>
    <div class="kids">${kids.map(x => {
      const p = bodyPlan(x.g), egg = x.hatching;
      return `<div class="kid${egg ? ' egg-wait' : ''}${x.justHatched ? ' hatched' : ''}" data-id="${esc(x.id)}">
        ${egg ? `<span class="egg">${EGG_SVG}</span>` : `<canvas data-portrait="${esc(x.id)}"></canvas>`}
        <span class="kid-main"><span class="name">${egg ? 'たまご' : esc(x.name)} <span class="meta">${x.gen}代目</span></span>
          <span class="rec">${egg ? 'もうすぐかえる…' : recText(x.rec, true) + ' ' + kidTag(x)}</span>
          <span class="rb ${egg ? '' : rbClass(x.rec)}">${egg ? '' : rbText(x.rec)}</span>
          <span class="status">${practiceLabel(x) || (egg ? '' : esc(x.practiceNote || ''))}</span></span>
        <span class="meta wide">${fmtMass(p.M)} ・ 脚 ${p.L.toFixed(2)}m ・ ${esc(x.origin || '')}${x.gaitName ? ` ・ 走り方は${esc(x.gaitName)}ゆずり` : ''}</span>
        <span class="row">
          <button type="button" data-act="watch"${x.rec && !egg ? '' : ' disabled'}>走りを見る</button>
          <button type="button" data-act="practice"${x.rec && !x.practice && !egg ? '' : ' disabled'}>${x.practiced ? 'もっと練習' : '練習'}</button>
          <button type="button" data-act="keep" class="primary"${full || egg ? ' disabled' : ''}>残す</button>
        </span></div>`;
    }).join('')}</div>
    <div class="foot"><button type="button" class="quiet" data-act="releaseAll">のこりは逃がす</button></div>`;
  paintPortraits(box, kids);
  for (const x of kids) delete x.justHatched;
}
$('nurseryBox').addEventListener('click', async e => {
  const b = e.target.closest('button'); if (!b) return;
  if (b.dataset.act === 'toRanch') { setTab('ranch'); return; }
  if (b.dataset.act === 'releaseAll') {
    if (kids.some(x => x.practiced) && !await ask('練習した子もいます。のこりを逃がしますか？', {ok: '逃がす'})) return;
    kids = []; save(); renderKids(); toast('のこりの子を逃がしました'); return;
  }
  const x = kids.find(y => y.id === b.closest('.kid').dataset.id); if (!x) return;
  if (b.dataset.act === 'watch') watchRun(x);
  if (b.dataset.act === 'practice') practice(x);
  if (b.dataset.act === 'keep' && ranch.length < slots()) {
    kids = kids.filter(y => y !== x); x.isNew = true; ranch.push(x);
    save(); renderRanch(); renderKids(); toast(`${x.name} を牧場に残しました`);
    if (!kids.length) { setTab('ranch'); const c = $('ranch').lastElementChild; if (c) c.scrollIntoView({block: 'center'}); } // ぜんぶ決めたら牧場へ（残した子はいちばん下）
  }
});

// 子を生まれた子の欄へ。記録のない子は卵のまま、記録が出たら1匹ずつかえる（v004）
const HATCH_MIN = 1400, HATCH_GAP = 650;
function addKids(list) {
  const t0 = performance.now();
  kids.push(...list);
  const todo = list.filter(x => !x.rec);
  for (const x of todo) x.hatching = true;
  save(); renderKids();
  measure(todo, () => {
    const wait = Math.max(0, HATCH_MIN - (performance.now() - t0));
    todo.forEach((x, i) => setTimeout(() => {
      x.hatching = false; x.justHatched = true;
      SFX.play('crack');
      if (x.rec && x.rec.finishT != null && x.parentBest != null && x.rec.finishT < x.parentBest) setTimeout(() => SFX.play('record'), 250);
      save(); renderKids();
    }, wait + i * HATCH_GAP));
  });
  setTab('kids', {top: true}); // 卵は「生まれた子」の画面でかえる
}

// ---------- かけ合わせ（v004: かける前のシートで、走り方を受けつぐ親を選ぶ・子の体重の幅を見る） ----------
function breedForecast(a, b) {
  const r = makeRng(12345), Ms = [];
  for (let i = 0; i < 200; i++) Ms.push(bodyPlan(crossover(a.g, b.g, r)).M);
  Ms.sort((p, q) => p - q);
  return {lo: Ms[10], hi: Ms[189], Ma: bodyPlan(a.g).M, Mb: bodyPlan(b.g).M};
}
const rbScore = x => x.rec && x.rec.rb ? x.rec.rb.ok * 100 - (x.rec.finishT ?? 99) : -1;
function openBreed(a, b) {
  const F = breedForecast(a, b), ratio = Math.max(F.Ma, F.Mb) / Math.min(F.Ma, F.Mb);
  const pick = rbScore(a) >= rbScore(b) ? a : b;
  // 体重の帯（対数の目盛り。両親と子の幅）
  const lo = Math.min(F.Ma, F.Mb, F.lo) / 1.5, hi = Math.max(F.Ma, F.Mb, F.hi) * 1.5;
  const pos = M => (100 * Math.log(M / lo) / Math.log(hi / lo)).toFixed(1);
  const opt = x => `<label class="gait-opt"><input type="radio" name="gaitFrom" value="${esc(x.id)}"${x === pick ? ' checked' : ''}>
    <canvas data-portrait="${esc(x.id)}"></canvas><b>${esc(x.name)}</b>
    <span class="small">${fmtMass(bodyPlan(x.g).M)} ・ ${recShort(x.rec)}</span><span class="rb ${rbClass(x.rec)}">${rbText(x.rec)}</span></label>`;
  openSheet('かけ合わせ', `<p class="hint">子は3匹。体は両親のあいだ（ときどき少しはみ出す）、走り方は<b>どちらか一方の親から丸ごと</b>受けつぎます。</p>
    <h3>走り方を受けつぐ親</h3>
    <div class="gait-pick">${opt(a)}${opt(b)}</div>
    <p class="hint">「6回中◯回ゴール」が多い親の走り方ほど、くずれにくい。子の体に近い親の走り方ほど、合いやすい。</p>
    <h3>子の体重（予想）</h3>
    <div class="mass-band"><i class="band" style="left:${pos(F.lo)}%;width:${(pos(F.hi) - pos(F.lo)).toFixed(1)}%"></i>
      <b class="pa" style="left:${pos(F.Ma)}%">1</b><b class="pb" style="left:${pos(F.Mb)}%">2</b></div>
    <p class="small">およそ ${fmtMass(F.lo)}〜${fmtMass(F.hi)}（1: ${esc(a.name)} ${fmtMass(F.Ma)}、2: ${esc(b.name)} ${fmtMass(F.Mb)}）</p>
    ${ratio > 8 ? `<p class="warn">体の大きさがかなりちがう2匹です。受けついだ走り方が子の体に合わず、転ぶ子が多くなりがち（練習で直ることもあります）。</p>` : ''}
    <div class="btn-row"><button type="button" class="primary" id="btnBreedGo">かけ合わせる</button></div>`, 'breed');
  paintPortraits($('sheetBody'), [a, b]);
  $('btnBreedGo').onclick = () => {
    const id = $('sheetBody').querySelector('input[name=gaitFrom]:checked').value;
    closeSheet(); breed(a, b, id === a.id ? a : b);
  };
}
const bodyOnly = g => Object.fromEntries(GENES.filter(d => d.kind === 'body').map(d => [d.k, g[d.k]]));
function breed(a, b, src) {
  const list = [], pb = [a.rec?.finishT, b.rec?.finishT].filter(t => t != null);
  for (let i = 0; i < 3; i++) {
    const g = mutate(crossover(a.g, b.g, rng, src.g), rng, {rate: 0.3}); // 強いと子の多くが転ぶ
    list.push({id: 'c-' + Date.now() + '-' + i, ...childName(a, b), g, rec: null, gen: Math.max(a.gen, b.gen) + 1,
      parents: [a.name, b.name], parentBest: pb.length ? Math.min(...pb) : null, gaitName: src.name, pg: [bodyOnly(a.g), bodyOnly(b.g)],
      origin: `${a.line === b.line ? a.line + 'どうし' : a.line + '×' + b.line}の子（親 ${recShort(a.rec)}・${recShort(b.rec)}）`});
  }
  prog.born += 3; saveProg();
  selected = []; updateSelection();
  addKids(list);
  SFX.play('hatch');
}

$('btnBreed').addEventListener('click', () => {
  const [a, b] = selected.map(id => ranch.find(x => x.id === id));
  if (a && b) openBreed(a, b);
});
