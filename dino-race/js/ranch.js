// 牧場: 裏の計算（Worker）、走る練習、カードの絵、牧場のカードと選択、生まれた子、かけ合わせ。

// ---------- 裏の計算（Worker） ----------
const worker = new Worker('js/worker.js');
const waiting = new Map();
let reqId = 1;
worker.onmessage = e => {
  const m = e.data;
  if (m.type === 'evaluated') { const cb = waiting.get(m.id); waiting.delete(m.id); cb && cb(m.res); }
  if (m.type === 'progress') onEvolveProgress(m);
};
function measure(list, done) { // 記録のないものの記録をはかる
  if (!list.length) return;
  const id = reqId++;
  waiting.set(id, res => { list.forEach((x, i) => { x.rec = res[i]; noteRecord(x); }); done && done(); });
  worker.postMessage({type: 'evaluate', id, genomes: list.map(x => x.g)});
}

// 走る練習: 体はそのままで、走り方だけを小さな群れで PRACTICE.gens 世代育て、よくなったら入れかえる。
// おまかせの進化とぶつからないように別の Worker で、1匹ずつ順番に
const PRACTICE = {gens: 6, size: 10};
const practiceWorker = new Worker('js/worker.js');
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
    const better = !x.rec || b.score > scoreOf(x.rec);
    if (better) { x.g = b.g; x.rec = b.res; noteRecord(x); }
    x.practiced = (x.practiced || 0) + 1;
    x.practice = null; practicing = null;
    prog.practiced++; saveProg(); save();
    SFX.play('done');
    toast(better ? `${x.name} の練習: ${recShort(before)} → ${recShort(x.rec)}` : `${x.name} の練習: 記録は変わらず（${recShort(x.rec)}）`);
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
  $('actbar').hidden = !show; document.body.classList.toggle('has-actbar', show);
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
    if (full) { card.querySelector('.rec').innerHTML = recText(x.rec, true); }
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
function renderKids() {
  const box = $('nurseryBox');
  if (!kids.length) { box.hidden = true; box.innerHTML = ''; return; }
  const full = ranch.length >= slots();
  box.hidden = false;
  box.innerHTML = `<h2>生まれた子（${kids.length}匹）</h2>
    <p class="parents">記録を見て、残す子を選ぶ。転んだ子も練習すると走れるようになることがあります。${full ? `<br><b>牧場がいっぱい</b>（${slots()}匹）。残すには先に牧場から逃がすか、大会でメダルを取って広げる。` : ''}</p>
    <div class="kids">${kids.map(x => {
      const p = bodyPlan(x.g);
      return `<div class="kid" data-id="${esc(x.id)}">
        <canvas data-portrait="${esc(x.id)}"></canvas>
        <span class="kid-main"><span class="name">${esc(x.name)} <span class="meta">${x.gen}代目</span></span>
          <span class="rec">${recText(x.rec, true)}</span><span class="status">${practiceLabel(x)}</span></span>
        <span class="meta wide">${fmtMass(p.M)} ・ 脚 ${p.L.toFixed(2)}m ・ ${esc(x.origin || '')}</span>
        <span class="row">
          <button type="button" data-act="watch"${x.rec ? '' : ' disabled'}>走りを見る</button>
          <button type="button" data-act="practice"${x.rec && !x.practice ? '' : ' disabled'}>${x.practiced ? 'もっと練習' : '練習'}</button>
          <button type="button" data-act="keep" class="primary"${full ? ' disabled' : ''}>残す</button>
        </span></div>`;
    }).join('')}</div>
    <div class="foot"><button type="button" class="quiet" data-act="releaseAll">のこりは逃がす</button></div>`;
  paintPortraits(box, kids);
}
$('nurseryBox').addEventListener('click', async e => {
  const b = e.target.closest('button'); if (!b) return;
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
  }
});

function addKids(list) {
  kids.push(...list);
  save(); renderKids();
  measure(list.filter(x => !x.rec), () => { save(); renderKids(); });
  setTab('ranch');
  $('nurseryBox').scrollIntoView({behavior: 'smooth', block: 'start'});
}

$('btnBreed').addEventListener('click', () => {
  const [a, b] = selected.map(id => ranch.find(x => x.id === id));
  if (!a || !b) return;
  const list = [];
  for (let i = 0; i < 3; i++) {
    const g = mutate(crossover(a.g, b.g, rng), rng, {rate: 0.3}); // 強いと子の多くが転ぶ
    list.push({id: 'c-' + Date.now() + '-' + i, ...childName(a, b), g, rec: null, gen: Math.max(a.gen, b.gen) + 1,
      parents: [a.name, b.name], origin: `${a.line === b.line ? a.line + 'どうし' : a.line + '×' + b.line}の子（親 ${recShort(a.rec)}・${recShort(b.rec)}）`});
  }
  prog.born += 3; saveProg();
  selected = []; updateSelection();
  addKids(list);
  SFX.play('hatch');
  toast('たまごがかえった！ 3匹生まれました');
});
